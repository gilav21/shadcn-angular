# Document Parsers in a Web Worker — Spec

> # 🛑 STOP — READ BEFORE ANY WORK
>
> **This spec depends on:** `parser-resource-limits-spec.md`
>
> **Before writing any code, verify each prerequisite is complete** by checking
> its Completion Log — every task row must show a review score ≥ 91.
>
> **If any prerequisite is incomplete: STOP IMMEDIATELY. Do not start. Do not
> work around it. Do not implement the prerequisite yourself.** Alert the user
> that this spec is blocked, name the missing prerequisite, and end your turn.
>
> (The resource-limits work is merged and released as part of the 15-spec
> codebase-review program, 2026-10-17. The check is still yours to make: read
> that spec's log, do not rely on this sentence.)

**Status:** ⬜ Not started
**Date:** 2026-10-17
**Source:** follow-up "Run parsers in a Web Worker" of
`codebase-review-fixes-index.md`, recorded by `parser-resource-limits-spec.md`
as "containment, not correctness".
**Living history:** never delete a completed row, a fixed bug or a superseded
decision — mark it and append below.

---

## Step 0 — verification record

Every claim re-checked against the tree at branch `chore/backlog-sweep`
(2026-10-17).

| # | Claim | What the source says |
|---|-------|----------------------|
| V-1 | "DOM-based parsers block it." | ✅ **True, and narrower than it sounds.** `DOMParser` (and `XMLSerializer`) are `Window`-only: they do not exist in a worker. Files that call them: `docx-parser.ts:236`, `pptx-parser.ts:300`, `xlsx-reader.ts:25`, `svg-sanitizer.ts:52,64`. **The byte-level parsers use no DOM at all**: `pdf-parser.ts`, `pdf-pixel-perfect.ts`, `pdf-readable/*`, `doc-parser.ts`, `doc-enhanced-parser.ts`, `ppt-parser.ts`, `ole2-reader.ts`, `ttf-parser.ts`, `zip-reader.ts`, `inflate.ts`. `file-type-detector.ts` has no DOM call (its `docx`/`xlsx` strings are zip entry names). The PDF family is also where findings F1–F15 of the limits spec live, i.e. the hostile-input surface that most needs containment. |
| V-2 | Parsers are asynchronous, so the UI stays alive. | ❌ Refuted. `parsePdf` and `parsePdfPaged` are `async` but contain no yield (a single synchronous run after the first `await`); `parseDoc`, `parsePpt`, `parseDocx`, `parsePptx` and `parseXlsx` are **synchronous** functions (`doc-parser.ts:347`, `docx-parser.ts:1813`, `pptx-parser.ts:2575`, `xlsx-reader.ts:251`). A dropped file freezes the tab for the whole parse and **cannot be cancelled**. `AbortSignal` appears in no parser. |
| V-3 | The limits spec already contains hostile input. | ⚠️ **Partly.** It bounds *work proportional to the file* (caps, visited sets, `DecodeBudget`). It states no wall-clock or heap ceiling and does not remove catastrophic regex backtracking as a class (F6, F9). A worker adds what limits cannot: **the main thread keeps running, and a parse can be killed.** |
| V-4 | A worker is a security sandbox. | ❌ **No.** It is a separate thread in the same renderer process. Memory exhaustion in a worker can still crash the tab in some browsers; it does not stop a heap-heavy file. The resource limits remain the primary defence. This spec sells **responsiveness, cancel and a wall-clock kill**, and the user-facing text must not promise more. |
| V-5 | Nothing in the repo uses a worker. | ✅ `grep "new Worker"` over `packages/components` (non-spec) is empty. There is no precedent to copy. |
| V-6 | Angular bundles a worker with no extra configuration. | ⚠️ **Unverified, and the CLI's `application` builder lists a separate option:** `webWorkerTsConfig` ("TypeScript configuration for Web Worker modules", `node_modules/@angular/build/src/builders/application/schema.json:549`). Whether `new Worker(new URL('./x.worker', import.meta.url), { type: 'module' })` builds without it is **the open question this spec must settle first** (Task 2). |
| V-7 | The library is copied into the consumer's project. | ✅ (CLAUDE.md "the source lives in YOUR project"). A worker entry file therefore lands in the consumer's tree and is built by *their* builder, under *their* `angular.json`. The CLI registry ships files by `libFiles[]`; `new URL(…, import.meta.url)` relative paths survive the copy only if the worker file is installed next to its caller. |
| V-8 | The compiled packages can ship the worker. | ❌ `@gilav21/shadcn-angular-rte` and `-data-table` are built with ng-packagr (`packages/*-package/tsconfig.lib.json`); a `new Worker(new URL())` inside a library built that way is not bundled by ng-packagr. Those packages must keep the in-thread path (UC-6). |
| V-9 | Results survive `postMessage`. | ⚠️ Structured clone keeps `Map`/`Set`/typed arrays and drops class prototypes and functions. `PdfParseResult` / `PptxParseResult` shapes must be verified to be plain data (Task 1 test T-4 asserts deep equality across the boundary). |
| V-10 | The test environments can run a real worker. | ✅ for the repo's browser leg (vitest runs in real Chromium; Vite resolves `new URL(…, import.meta.url)`). ❌ for the consumer-facing portable legs (jsdom and jest have no `Worker`): those legs exercise the **fallback** only, which is exactly the consumer without a worker. |

---

## PM section

### Business logic

Importing a document (the file viewer, the rich-text editor's file import) hands the bytes to a parser. With this spec the **PDF,
Word 97 (`.doc`) and PowerPoint 97 (`.ppt`)** parsers run on a separate thread
when the browser and the build allow it, report back a result that is
**identical** to the in-thread one, and can be **cancelled** or **time-limited**.
When a worker is unavailable the same call runs in-thread as it does today.
The Office Open XML parsers (`.docx`, `.pptx`, `.xlsx`) and the SVG sanitiser
stay in-thread in this spec (V-1) and are documented as such.

### Why the customer wants this

A user drops a 300-page scanned PDF into the editor and the whole tab stops
responding until the parse ends: no cursor, no scroll, no Cancel — the browser's
"page unresponsive" prompt is the only way out. A hostile or merely pathological
file is the same experience with no end. The developer integrating the library
cannot fix this from outside: they do not own the parser, cannot interrupt a
synchronous call, and a `setTimeout` race does not stop the work. Their
workaround is to refuse large files by byte count, which rejects legitimate
scans and still hangs on a small hostile file.

### Use cases = definition of done

| ID | Use case |
|----|----------|
| UC-1 | While a large PDF is parsing through the file viewer, the page stays interactive: a main-thread timer scheduled every 16 ms is never late by more than **100 ms**, and a click on a nearby button is handled during the parse. |
| UC-2 | A consumer can cancel a parse (an `AbortSignal` aborts, or the viewer's own Cancel button is pressed): the worker is terminated, the promise rejects with an `AbortError`, no further CPU is used by it, and the next parse starts a fresh worker. |
| UC-3 | A parse that exceeds a wall-clock `timeoutMs` (default **30 s**, per call overridable) is terminated and surfaces as the **same kind of import error** the UI already shows for an unreadable file, with the message "This file took too long to process". |
| UC-4 | For every file in the parser fixture corpus (PDF, DOC, PPT), the worker result is **deep-equal** to the in-thread result. |
| UC-5 | If a worker cannot be created (no `Worker` global, the builder did not bundle the worker file, a CSP blocks it, SSR, jest/jsdom), the **same call falls back to the in-thread parser** and returns the same result; it logs **one** `console.warn` per page load naming the reason. |
| UC-6 | The compiled `rte` and `data-table` packages build and behave exactly as before (in-thread only). |
| UC-7 | Server-side rendering (`isPlatformBrowser` false) never touches `Worker`, at module evaluation or at render time. |
| UC-8 | A consumer who installs with the CLI gets a working worker setup, or is told precisely what to add: **either** the CLI installs the worker file and any builder configuration, **or** the install summary and `doctor` print the exact two lines needed (decided in Task 2; no silent half-installs). |
| UC-9 | A production AOT build of a pristine consumer app contains the worker chunk, and a real PDF parsed in the browser goes through the worker (asserted by the app, not assumed). |
| UC-10 | The `.docx`, `.pptx`, `.xlsx` and SVG paths behave exactly as before; the docs list them as in-thread and say why. |

### Explicitly out of scope

- Moving the DOM-based formats off the main thread. (Writing a worker-safe XML
  reader is a separate, larger spec; Option 3 below records why it is deferred.)
- Making the worker a memory sandbox (V-4).
- Streaming or page-at-a-time progressive results from the worker. (One request,
  one response, plus cancel.)
- Worker pools, parsing several files concurrently, or SharedArrayBuffer.
- Changing any parser's output format or its limits.
- The "truncated / limits hit" result flag (its own follow-up).

---

## QA section

> Tests are written **first**; Task 1 produces them red.

### Traceability

| Test | Name | Proves | Type |
|------|------|--------|------|
| T-1 | `the main thread stays responsive while a large PDF parses in the worker` — builds a many-page PDF from the in-repo fixture builders; a 16 ms timer records its worst lateness; a click handler fires during the parse; lateness ≤ 100 ms | UC-1 | browser (real Chromium) |
| T-2 | `aborting stops the parse, rejects with AbortError and the next call works` — abort mid-parse of a pathological (hostile fixture) PDF; assert rejection kind and that a following parse of a small PDF succeeds | UC-2 | browser |
| T-3 | `a parse past timeoutMs is terminated and reported as a too-long import error` — `timeoutMs: 50` against the pathological fixture | UC-3 | browser |
| T-4 | `the worker result equals the in-thread result for every fixture` — `it.each` over the PDF, DOC and PPT corpus the parser specs already build (pdf-test-fixtures, doc-test-fixtures, hostile fixtures included) | UC-4 | browser |
| T-5 | `falls back to the in-thread parser when Worker is missing` and `… when the worker file fails to load` (stub `globalThis.Worker` undefined / a constructor that throws / a worker that errors on load); result equals T-4's; exactly one `console.warn` across two calls | UC-5 | unit (portable: runs under jsdom and jest too) |
| T-6 | `no Worker access during SSR render` — `PLATFORM_ID = 'server'`, a stub `Worker` that throws if constructed; render file-viewer and RTE import; assert not constructed | UC-7 | unit |
| T-7 | `the compiled packages still build without a worker` — the existing `pkg-rte` and `pkg-data-table` e2e specs stay green; add an assertion that the staged package source contains no `new Worker(` | UC-6 | e2e + gate |
| T-8 | `install summary or doctor reports the worker setup` (shape decided by Task 2's record) | UC-8 | CLI unit |
| T-9 | `a pristine app's prod build emits a worker chunk and parses a PDF through it` — e2e harness page prints `parsedIn: "worker"` and the page count | UC-9 | e2e |
| T-10 | `docx/pptx/xlsx/svg are untouched` — existing specs for those parsers pass unchanged; a unit test asserts `parseDocument('docx', …)` is **not** offered by the worker client (type-level and runtime) | UC-10 | unit |

### Edge cases and failure modes the tests must cover

- Empty buffer; a 0-byte file; a file with a PDF header and nothing else.
- A **detached `ArrayBuffer`** after transfer: the caller's buffer must be intact
  (the client copies unless told to transfer), asserted in T-4.
- Abort **before** the call, **during** the parse, and **after** it finished (no
  effect). Two calls queued, abort the first: the second still completes.
- Worker `error` and `messageerror` events become rejections, never hangs.
- Result larger than 50 MB (data-URL-heavy pixel-perfect output): posts without
  copying the buffers twice; peak main-thread memory is asserted in the perf test.
- RTL document text and an embedded-font PDF round-trip unchanged (T-4 corpus).
- Touch: the viewer's Cancel button is a real `ui-button` with the 44 px target
  (Section 6 of CLAUDE.md).

### Performance assertions (measured, not asserted by feel)

| Quantity | Budget |
|----------|--------|
| Main-thread lateness during a worker parse | ≤ **100 ms** worst case; **no long task > 50 ms** attributable to the parse (PerformanceObserver `longtask`) |
| Added latency, worker vs in-thread, for a 1 MB / 30-page PDF | ≤ **+100 ms** or **+10 %**, whichever is larger |
| Cost of the buffer copy | ≤ 10 ms per 10 MB |
| Time from `abort()` to the worker being gone | ≤ **200 ms** |
| Worker start (cold) | measured and recorded in the log; no budget |

### Coverage expectation

100 % lines on the new client and protocol modules; the worker entry file is
exercised by T-1…T-4 in the browser leg.

---

## Architecture section

### Usability — the consuming developer's view

**Simple mode: nothing to do.** `ui-file-viewer` and the rich-text editor's file
import use the worker automatically when it is available.

```html
<ui-file-viewer [file]="file" />
```

```ts
// Custom mode: call the client directly, with cancel and a time limit.
import { parseDocument } from '@/lib/parsers/parse-in-worker';

const controller = new AbortController();
const result = await parseDocument('pdf', await file.arrayBuffer(), {
  signal: controller.signal,
  timeoutMs: 15_000,
});
// result.parsedIn === 'worker' | 'main'   (for diagnostics and tests)
```

Proposed public surface (names final in Task 3, shape fixed here):

```ts
export type WorkerParseKind = 'pdf' | 'pdf-paged' | 'doc' | 'ppt';
export interface ParseOptions {
  /** Aborting rejects with a DOMException named 'AbortError' and terminates the worker. */
  readonly signal?: AbortSignal;
  /** Wall-clock cap in ms. Default 30 000. Past it the call rejects with ParseTimeoutError. */
  readonly timeoutMs?: number;
}
export class ParseTimeoutError extends Error {}
export function parseDocument(kind: WorkerParseKind, data: ArrayBuffer, options?: ParseOptions):
  Promise<{ result: ParseResultFor<typeof kind>; parsedIn: 'worker' | 'main' }>;
```

The DOM formats are deliberately **not** in `WorkerParseKind` (UC-10): a caller
cannot ask for something that cannot be offered.

### Efficiency

- One lazily created worker, reused for sequential calls; **terminated** on
  abort or timeout and re-created on the next call; terminated when no call has
  arrived for 60 s so an idle page holds no thread.
- The input buffer is **copied** into the message (`data.slice(0)` transferred)
  so the caller keeps theirs. Opt-in `transfer: true` hands the original over
  for callers who are done with it.
- Result transfer: typed arrays in the result are listed as transferables to
  avoid a second copy.
- No new work in the parsers; they are called as they are, with the default
  `ParserLimits`.

### DX for the consuming developer

- Learn: nothing in simple mode; `parseDocument`, `ParseOptions` in custom mode.
- Ignore: the protocol, the worker file.
- Wrong-hold messages: `ParseTimeoutError` ("This file took too long to
  process"), `AbortError`, and the one-time fallback warning
  `[parse-in-worker] running in the main thread: <reason>. See
  docs/parsers-in-worker.md` (the reason is one of: no Worker global, worker
  failed to load, server render).
- Docs: one page, `docs/parsers-in-worker.md`, linked from the file-viewer and
  RTE-import pages: what moves to a worker, what does not and why, the
  fallback, the two lines of builder configuration if Task 2 finds they are
  needed.

### Implementation options

**Option 1 — worker entry inside the library, created with
`new Worker(new URL('./parser.worker', import.meta.url), { type: 'module' })`,
fallback in-thread.**
Pros: zero consumer code in simple mode; the standard bundler idiom; works in
the repo's own browser tests (V-10).
Cons: depends on the consumer's builder bundling the file (V-6) — possibly a
`webWorkerTsConfig` entry and a `tsconfig.worker.json` that the CLI would have to
create or patch; a silent no-op if the file is not emitted, which is why the
fallback and the one-time warning are mandatory; ng-packagr cannot bundle it
(V-8).

**Option 2 — consumer supplies the worker.** The library exports the worker
source and `createParserClient(worker)`; the consumer writes the one
`new Worker(new URL(…))` line in their own code and passes it in.
Pros: nothing hidden; the consumer's own builder sees the `new URL` in *their*
source, which is the case every builder handles; works for any packaging.
Cons: the built-in `ui-file-viewer` and RTE import would not use a worker by
default, so UC-1 is not true out of the box; a documented step every integrator
must do.

**Option 3 — a worker-safe XML reader so the Office XML formats can move too.**
Pros: complete containment.
Cons: a hand-written XML tokeniser and DOM-lite for docx/pptx/xlsx — thousands
of lines to rewrite and re-verify against the current output, with a
`DOMParser`-free parity gate. Not proportionate to a containment follow-up and
not needed for the F1–F15 surface (V-1). Recorded so it is not re-proposed
without new evidence.

**Option 4 — no worker; cooperative scheduling.** `await` a `scheduler.yield()`
or `setTimeout(0)` every N ms, plus `AbortSignal` and a deadline check.
Pros: no bundler or packaging question; works everywhere including the packages.
Cons: it cannot interrupt a single long synchronous stretch (a backtracking
regex, one huge stream inflate) — the cases that motivate containment — and it
means threading a deadline through ~20,000 lines of parser. It is also a
*complement*, not a rival; recorded as the follow-up for the formats that stay
in-thread.

**✅ Chosen: Option 1 for PDF, DOC and PPT, with Option 2's explicit entry point
exposed as the same function's lower layer** (`createParserClient(worker)`), so a
consumer whose builder does not bundle the default worker can wire their own in
one line and the fallback stays the safety net. Reasoning: UC-1 must hold with
no integrator effort; Option 2 alone fails that; Option 1 alone is a trap when the
build silently omits the file; Option 3 and 4 are larger and answer different
questions. **Task 2 is a decision gate:** build a pristine consumer app both
with and without `webWorkerTsConfig`. If the default worker builds without it,
no CLI patching is needed; if not, the CLI installs `tsconfig.worker.json` and
sets the option for the `application` builder (and `doctor` verifies it) — and
that choice is recorded in the log *before* Task 3 starts.

### Risks

| Risk | Mitigation |
|------|------------|
| The builder omits the worker and nothing fails | The fallback (UC-5) plus the one-time warning; T-9 asserts `parsedIn: "worker"` in a real prod build so the e2e fails loudly. |
| The CLI patching `angular.json` is fragile (multiple projects, other builders) | Prefer the no-patch result of Task 2; if patching is required, support only the `application` builder, and have `doctor` print a precise instruction for anything else instead of editing. |
| A worker file next to `lib/` files breaks the registry's file-resolution (`libFiles`) | Task 7 adds it to `libFiles` for exactly the components that import `parse-in-worker`; `sync-registry` misses `await import()` lib files (known), so the entry is verified by `check:registry` **and** by the e2e install. |
| Results lose information across structured clone (V-9) | T-4 deep-equals every fixture; any prototype-bearing field is turned into plain data in the parser's result type, not special-cased in the client. |
| Users read "worker" as "sandbox" (V-4) | The docs page and the timeout message promise only responsiveness, cancel and a time limit. |
| CSP blocks workers | UC-5 fallback; the warning names the CSP reason when `Worker` construction throws a `SecurityError`. |
| The compiled packages inherit the new import and fail to build (V-8) | Task 6 puts the worker creation behind a function the packages' tsconfig path maps to the in-thread stub; T-7 asserts no `new Worker(` in staged package source. |

---

## Task table (order = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests **T-1…T-6, T-10** against stubs of `parse-in-worker` (`parseDocument`, `createParserClient`, `ParseTimeoutError`) and a stub worker; build the shared pathological-PDF fixture (a file that takes > 1 s in-thread and is bounded by the limits) for T-2/T-3; record the red list in the log | UC-1…UC-5, UC-7, UC-10 | ⬜ Not started | — | — | — |
| 2 | **Decision gate.** In a pristine consumer app (the e2e fixture app), build the same worker with and without `webWorkerTsConfig` (dev and prod, `application` builder, in both `e2e/fixture-app` and `e2e/fixture-app-21`). Record in the log: does it build, does it emit a chunk, what does the browser load. Decide "no patch" or "CLI installs `tsconfig.worker.json` + option" and write the decision and its evidence in the log | UC-8, UC-9 | ⬜ Not started | — | — | — |
| 3 | Implement the protocol, `parser.worker.ts` (PDF/PDF-paged/DOC/PPT entry points only) and the client: lazy single worker, request ids, copy-then-transfer, transferable results, error and `messageerror` mapping, idle termination | UC-1, UC-4 | ⬜ Not started | — | — | — |
| 4 | Abort and timeout: terminate on abort/timeout, reject with `AbortError` / `ParseTimeoutError`, re-create lazily; queue behaviour; T-2, T-3 green | UC-2, UC-3 | ⬜ Not started | — | — | — |
| 5 | Fallback and SSR: detect `Worker` / construction failure / load failure / server platform; run in-thread; one-time warning; T-5, T-6 green; add T-5 to `portable-tests.json` coverage so it runs under jsdom and jest | UC-5, UC-7 | ⬜ Not started | — | — | — |
| 6 | Wire the consumers: `ui-file-viewer` (add a visible Cancel `ui-button` while a worker parse runs; "took too long" error state) and the RTE file import; keep the compiled packages on the in-thread stub (V-8, T-7) | UC-1, UC-2, UC-3, UC-6 | ⬜ Not started | — | — | — |
| 7 | CLI and registry: add the new lib files to `libFiles` for the importing components; implement the Task 2 decision (nothing, or `tsconfig.worker.json` + builder option + `doctor` check); T-8; `sync-registry --fix`; `check:registry`; note the **CLI publish** consequence if `packages/cli/src/**` changed | UC-8 | ⬜ Not started | — | — | — |
| 8 | e2e harness `parser-worker` (scaffold with `npm run e2e:scaffold -- <name>` per CLAUDE.md): prod AOT build, real PDF, page prints `parsedIn: "worker"`; T-9; run `npm run e2e -- parser-worker`, the `pkg-*` specs and the RTE specs; `npm run e2e:reset` | UC-6, UC-9 | ⬜ Not started | — | — | — |
| 9 | Measure the performance table on a 30-page and a 300-page PDF and record the numbers (Chromium; note the machine); fix a budget miss before proceeding | UC-1 | ⬜ Not started | — | — | — |
| 10 | Docs: `docs/parsers-in-worker.md`, file-viewer and RTE import pages, README note; state the DOM-format gap and the Option 3 / Option 4 follow-ups; `npm run docs:regen`, `docs:check` | UC-10 | ⬜ Not started | — | — | — |
| 11 | Close: mutation checks (drop the terminate on abort → T-2 red; skip the copy → T-4 red; construct `Worker` on the server → T-6 red; lose `parsedIn` honesty → T-9 red), `npm run check:all`, `test-visual`, `verify:portable`, Storybook axe on the viewer's Cancel state, impacted e2e, `npm run sonar:gate` with the four-condition verdict, **release verdict**: importing components change, so `release:package -- rte` and `-- data-table` are needed only if their closure changed (compute with `release-package`; do not guess) | all | ⬜ Not started | — | — | — |

---

## Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run sonar:gate`
   against `http://localhost:9000` — coverage re-measured unless the tree
   fingerprint proves it current) run and clean on the changed code. eslint is
   NOT a substitute. If the token, server, or Docker is unavailable, the task is
   **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with:

- **Completed** — the date/time (`date +"%Y-%m-%d %H:%M"`).
- **Score** — the review-gate score.
- **Retrospective** — 1–2 sentences: what went well, and what to improve later.

Marking a row Done without all five is a process violation, not a shortcut.

---

## Completion log

_Append per task: the red list, the Task 2 decision with evidence, the
performance numbers, mutation-check results, gate evidence._

| Date | Task | Event |
|------|------|-------|
| 2026-10-17 | — | Spec written. Step 0 narrowed the follow-up: only the four DOM-using files (docx, pptx, xlsx-reader, svg-sanitizer) are excluded, and the PDF family — where limits findings F1–F15 live — can move; a worker is **not** a memory sandbox; the parsers are synchronous or yield-free, so today a parse can neither be cancelled nor keep the UI alive; whether Angular bundles a worker without `webWorkerTsConfig` is unverified and is the Task 2 decision gate. |
