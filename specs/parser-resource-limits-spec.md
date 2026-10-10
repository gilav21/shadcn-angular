# Parser Resource Limits — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **Merge-order note (not a prerequisite):**
> [`import-and-parser-hardening-spec.md`](import-and-parser-hardening-spec.md)
> also edits `lib/parsers/pdf-parser.ts` (the `buildItemStyles` font-family
> escaping and link-URI filtering). Those are different functions; whichever
> spec merges second rebases.

Source: codebase review of 2026-10-03, parser audit (proof-of-concept probes
run against a byte-identical copy of `lib/parsers/` at `6fae7f7f`). The
HTML-injection finding from that audit (`pdf-parser.ts` font-family in
`style="…"`) is **not** here — it lives in the import-hardening spec because it
shares that spec's invariant.

---

## Step 0 — verification record

Every finding below was re-checked against the source at `6fae7f7f` with
scaled-down timing probes. Corrections to the original audit are kept, never
silently rewritten.

| # | Finding | Status |
|---|---------|--------|
| F1 | PDF image dimensions / BitsPerComponent uncapped (`pdf-parser.ts` image decode ~4352-4410, `buildPng`/`deflateRawData`; reused by `pdf-pixel-perfect.ts` `buildImageDataUrl`). The only guard is `decoded.length >= expected * 0.8`; output amplifies ~24× through RGB rows, PNG and base64. A tiny file can exhaust the heap. | ✅ confirmed |
| F2 | Form XObject `Do` recursion. `pdf-pixel-perfect.ts` `processFormXObject` (~3014) has no depth cap; per-level stack overflows are caught by `catch { /* skip malformed */ }` and the parent continues. `pdf-parser.ts` `processFormXObject` (2988) caps depth at 10 but tracks no visited set → cost k^depth for k draws per level. | ✅ confirmed · ⚠️ **correction:** the pixel-perfect blow-up needs ≥2 draws per level; a single self-draw terminates quickly (via the caught overflow — still a violation of R2) |
| F3 | Traditional xref subsection loop (`pdf-parser.ts` ~889) iterates `count` (from the file) with no end-of-text guard; xref streams (`processXRefStreamEntries`, 930) accept an entry width of 0, so the bounds check never trips and `/Index` can fill `objects` toward the Map size limit. | ✅ confirmed · ⚠️ **correction:** the traditional-xref case is finite (≈1 min measured), not an endless hang — still unbounded by file size |
| F4 | OLE2 (`ole2-reader.ts`): `buildDifat` / `buildFat` size arrays from the header's sector count; `readMiniStreamData` allocates `entry.size` from the file; directory entries sharing one chain are each copied in full. | ✅ confirmed |
| F5 | xlsx `<row r>` index (`xlsx-reader.ts` ~206, `while (data.length <= rowIndex) data.push([])`) is not bounded by `maxRows` (`DEFAULT_MAX_ROWS = 10000`, line 21). | ✅ confirmed by reading; parser specs run in the Chromium leg, so `DOMParser` is available for a test |
| F6 | ToUnicode CMap regexes `/beginbfchar\s([\s\S]*?)endbfchar/g` (1592) and `/beginbfrange\s([\s\S]*?)endbfrange/g` (1645) are quadratic on unterminated sections; CMaps decompress up to `MAX_DECODED_STREAM_BYTES` (64 MB, line 13). | ✅ confirmed |
| F7 | Page tree `collectPages` (~1449) keeps no visited set: a self-referencing `/Kids` throws an uncaught `RangeError` out of `parsePdf`; repeated kids double the page count per level. | ✅ confirmed |
| F8 | `.doc` piece table (`doc-parser.ts` `assemblePieceText`, `doc-enhanced-parser.ts` ~200-235): overlapping pieces, only cap is the file-controlled `ccpText` → output N × stream size. | ✅ confirmed by reading |
| F9 | Further super-linear regexes: `pdf-pixel-perfect.ts` ~686 font style-suffix regex (runs twice per font), `pdf-parser.ts` ~5078 `NUMBERED_PATTERN_RTL_END`. | ✅ confirmed |
| F10 | Cycles that terminate only because a `RangeError` is caught: trailer `/Prev` self-reference (~871/~952), `/Length` resolving to its own object (~1004). | ✅ confirmed |
| F11 | `decodeCCITTFax` (393): `Columns`/`Rows` from the file uncapped. | ⚠️ **upgraded Low → High:** a decoder path can also loop without consuming input |
| F12 | Deep nesting without a depth cap: PDF object arrays (`[[[…`), `pptx-parser.ts` ~2078 nested `grpSp` (docx has `MAX_TABLE_NESTING = 20`, line 168; pptx has none), `doc-enhanced-parser.ts` ~1622 `findBlipImage`. | ✅ confirmed · pptx may be bounded by the browser's XML parser depth limit — **needs verification** in Task 8 |
| F13 | **New:** structure tree (`parseStructureTree`, 6371) and outlines were listed as "checked safe". | ⚠️ **refuted "safe":** both have a depth cap but no visited set spanning the whole traversal, so shared nodes blow up — same class as F2 |
| F14 | **New:** the readable-PDF font-resource walk (`pdf-readable/`) has the same shared-node blow-up; it is on the RTE import path. | ✅ found in Step 0 |
| F15 | **New:** no budget on repeated decoding of the same stream (each reference re-decodes, each up to 64 MB). | ✅ found in Step 0 |

Verified safe (do not re-audit): `resolveDeep` (cycle spec at
`pdf-parser.spec.ts` ~2180), OLE2 FAT/DIFAT chain loops (`MAX_CHAIN_LENGTH`,
`ole2-reader.ts:28`), TTF composite glyphs (components are never followed), ppt
record loops, pixel-perfect output escaping and link-scheme filtering,
`xlsx.ts` `escapeXml`, `zip-reader.ts` (bounds uncompressed size).

---

## PM section

### Business logic

Every document parser in `lib/parsers/` finishes in time and memory
proportional to the size of the file it was given, whatever that file claims
about itself. When a file's internal structure exceeds a limit — dimensions,
counts, nesting, reference cycles — the parser skips or truncates the offending
part and returns everything else, exactly as it already does for any other
malformed section.

### Why the customer wants this

The customer is a developer whose app lets *their* users open files:

- **`ui-file-viewer`** renders PDF, DOCX, PPTX, XLSX, DOC, PPT.
- **The rich-text-editor file-import addon** runs `parseDocx` and
  `parsePdfReadable` on whatever the user drops into the editor.
- **The `ui/index.ts` barrel** exports `parsePdf`, `parsePdfPaged` and the
  xlsx/docx/pptx parsers for direct use.

Today, a file of a few kilobytes can freeze the tab for minutes or crash it
with an out-of-memory error, taking the user's unsaved work with it. The
developer has no workaround short of not shipping the feature, or wrapping
every call in a Worker with a kill timer, which they would have to discover
the need for on their own.

### Use cases — definition of done

- **UC-1** — A PDF containing an image whose declared dimensions or bit depth
  exceed the cap opens in `ui-file-viewer` and via `parsePdf`; that image is
  skipped and every other page element renders.
- **UC-2** — A PDF whose form XObjects draw themselves, directly or through a
  cycle, or share sub-forms many times over, is parsed by `parsePdf`,
  `parsePdfReadable` and the pixel-perfect renderer in bounded time, with each
  form's content drawn at most once per draw path.
- **UC-3** — A PDF with a cyclic or exponentially fanned-out page tree returns
  a page list capped at the real distinct pages, never an uncaught
  `RangeError`.
- **UC-4** — A PDF whose xref claims more entries than the file can hold, or
  whose xref stream has a zero entry width, parses in time proportional to file
  size, falling back the same way it does for any other damaged xref.
- **UC-5** — A PDF with a large or unterminated ToUnicode CMap, or a long font
  name, parses in time linear in the input.
- **UC-6** — A `.doc`/`.xls`/`.ppt` (OLE2) file whose header claims more
  sectors or larger streams than the file contains is parsed partially or
  rejected with the existing error. It never allocates beyond a fixed multiple
  of the file's size.
- **UC-7** — An `.xlsx` whose row index is far beyond `maxRows` returns at most
  `maxRows` rows.
- **UC-8** — A `.doc` with overlapping piece-table entries produces text no
  longer than its WordDocument stream.
- **UC-9** — Deep nesting (PDF arrays, PPTX group shapes, DOC image lookups)
  past the cap is truncated rather than overflowing the stack.
- **UC-10** — A PDF that references the same stream many times decodes it
  within a total decode budget.
- **UC-11** — Every well-formed document in the existing parser fixtures and
  demo files produces **identical** output before and after this spec. No
  regression for real files.
- **UC-12** — Shared and cyclic references in the structure tree, outlines and
  readable-PDF font resources are visited once each.

### Explicitly out of scope

- **Running parsers in a Web Worker.**
  - It would bound the damage to the UI thread, but it doesn't make the
    parsers correct.
  - It changes every public API to transferables, and DOM-based parsers (xlsx,
    docx, pptx use `DOMParser`) can't run in a Worker without a polyfill.
  - Revisit after this spec, once the parsers are bounded.
- **A public "limits hit" report on the parse result types.**
  - Truncation stays silent, as malformed-section skipping already is.
  - A `truncated` flag for the file-viewer is a follow-up idea, not part of
    this spec.
- **Making the caps configurable** by consumers through any public API.
- **HTML/attribute injection** in parser output. That belongs to
  `import-and-parser-hardening-spec.md`.
- **Fuzzing infrastructure.** The tests below sample the classes by hand.

---

## QA section — tests are written FIRST

> **Write every test in this section before writing any implementation code.**
> Each must fail (by assertion, or by exceeding its time budget) before the fix
> and pass after.

### The three rules every test samples

- **R1 — bounded by bytes.** Every allocation size and loop bound derived from
  file data is clamped to what the remaining bytes can actually encode, or to a
  documented hard cap in `limits.ts`.
- **R2 — bounded traversal.** Every walk over file-defined references (forms,
  page tree, structure tree, outlines, font resources, `/Prev`, `/Length`)
  tracks visited nodes and a depth cap. Terminating by catching a stack
  overflow counts as a failure.
- **R3 — linear text scanning.** No regex runs in super-linear time on
  file-controlled text.

### Making failing tests safe to run

A pre-fix run of an allocation-bomb test must **fail, not crash the test
runner**:

- **Allocation tests (R1):** the parser takes an internal `limits` argument
  (see Architecture). The test passes **tiny** caps, so the fixture allocates a
  few kilobytes. Before the fix the parser ignores the cap and returns the
  oversized element, so the assertion fails cheaply. After the fix the element
  is skipped. A separate unit test pins the production cap values.
- **Time tests (R2, R3):** use inputs scaled so the pre-fix run takes ~2–5 s
  while the post-fix run takes <100 ms. Assert against a generous budget
  (e.g. 1 s) with a per-test timeout. This fails safely; it never hangs.
- **Fixtures:**
  - Build them in code, using the existing helpers in `pdf-test-fixtures.ts`
    and `doc-test-fixtures.ts`, and the in-code builders already in
    `ole2-reader.spec.ts`, `xlsx-reader.spec.ts` and `pptx-parser.spec.ts`.
    No binary fixture files.
  - Each fixture is the **smallest real-shaped file of its class**: a valid
    header, a valid trailer, and one hostile structure.

### Traceability

| Test ID | Test name | Proves | Rule | Type |
|---|---|---|---|---|
| T-1 | `skips an image whose declared pixel count exceeds the cap and keeps the rest of the page` | UC-1 | R1 | unit (pdf-parser) |
| T-2 | `rejects BitsPerComponent outside 1/2/4/8/16, including fractional` | UC-1 | R1 | unit |
| T-3 | `pixel-perfect image path honours the same cap` | UC-1 | R1 | unit (pdf-pixel-perfect) |
| T-4 | `CCITT decode with oversized Columns/Rows or a non-consuming code is bounded` | UC-1 | R1 | unit |
| T-5 | `a self-drawing and a mutually-recursive form XObject each render in bounded time in parsePdf, parsePdfReadable and pixel-perfect` | UC-2 | R2 | unit ×3 entry points (one parameterised test) |
| T-6 | `a form DAG with k shared sub-forms per level costs linear, not k^depth` | UC-2 | R2 | unit |
| T-7 | `a cyclic /Kids returns the distinct pages; a fan-out tree is capped` | UC-3 | R2 | unit |
| T-8 | `xref subsection count larger than the file and xref-stream width 0 parse in time proportional to size` | UC-4 | R1 | unit |
| T-9 | `self-referencing /Prev and /Length terminate via the visited set, not a caught RangeError` | UC-4 | R2 | unit (assert by a spy-free check: parse succeeds at a depth below the JS stack limit, e.g. by forcing a reduced depth cap via `limits`) |
| T-10 | `unterminated bfchar/bfrange CMap sections scan in linear time` | UC-5 | R3 | unit (time budget) |
| T-11 | `long font names and long RTL numbered lines scan in linear time` | UC-5 | R3 | unit |
| T-12 | `OLE2 header sector counts and stream sizes beyond the file are clamped` | UC-6 | R1 | unit (ole2-reader, tiny limits) |
| T-13 | `OLE2 directory entries sharing one chain do not each copy it` | UC-6 | R1 | unit |
| T-14 | `xlsx row r far beyond maxRows yields ≤ maxRows rows` | UC-7 | R1 | unit (browser leg, DOMParser) |
| T-15 | `overlapping .doc pieces yield text ≤ WordDocument length` (both `doc-parser` and `doc-enhanced-parser`) | UC-8 | R1 | unit |
| T-16 | `nesting past the cap is truncated: PDF arrays, pptx grpSp, doc blip lookup` | UC-9 | R2 | unit |
| T-17 | `repeated references to one stream stay within the total decode budget` | UC-10 | R1 | unit |
| T-18 | `structure tree, outlines and readable font resources visit shared nodes once` | UC-12 | R2 | unit |
| T-19 | `every existing parser fixture produces identical output` (snapshot the current outputs **before** any change, then compare) | UC-11 | — | unit (golden) |
| T-20 | `production limits are the documented values` | UC-1, UC-6 | R1 | unit (limits.ts) |
| T-21 | `opening a hostile PDF in ui-file-viewer keeps the page responsive` (one fixture, F2 class) | UC-2 | R2 | e2e (`e2e/harness/file-viewer`) |

### Edge cases the tests must cover

- A file **at** a cap still parses fully. A file one unit over is truncated.
- The cycle classes are self-reference, a 2-cycle, and shared DAG nodes. Shared
  nodes are not cycles and must still render each time they are drawn, just
  without exponential cost.
- Empty and minimal files keep their current behaviour; T-19 covers this.

### Coverage expectation

No uncovered lines in `limits.ts`. Every new guard branch in the touched
parsers is covered by T-1…T-18.

---

## Architecture

### Usability

There is no public API change: `parsePdf(buffer)`, `parseXlsx(data, options)`
and the others keep their signatures. Hostile input produces a partial result,
the same as malformed input does today.

Internally each top-level parser gains a trailing optional parameter:

```ts
// internal — not re-exported from ui/index.ts
export interface ParserLimits {
  maxImagePixels: number;          // e.g. 50_000_000
  maxDecodedBytesTotal: number;    // across all streams in one parse
  maxNestingDepth: number;         // arrays, forms, groups
  maxPages: number;
  maxOle2StreamBytes: number;
}
export const DEFAULT_PARSER_LIMITS: Readonly<ParserLimits>;
```

### Efficiency

- Visited sets are per parse and keyed by object reference, so lookups are
  O(1).
- The regex rewrites use `indexOf` scans, which are linear.
- **Budget:** T-19 golden-file parse time must not regress by more than 5%.
  Measure it before and after on the largest existing fixture.

### DX for the consuming developer

There is nothing new to learn. The JSDoc on each exported parser gains one
sentence: "Input is untrusted; structures exceeding internal limits are
skipped."

### Implementation options

**Option 1 — fix each parser in place.** Add a local cap or visited set at
each site.
Pros: smallest diff per site; no new module.
Cons:
- The same three rules get re-implemented about 15 times, with drifting cap
  values.
- No single place documents the limits.
- This is exactly how the class re-ships, per CLAUDE.md "Fixing Bugs".

**Option 2 — shared `lib/parsers/limits.ts`.** It holds the caps, a
`VisitedSet` / `withDepth()` traversal helper and a decode-budget counter. Each
parser takes an internal `limits` argument that defaults to
`DEFAULT_PARSER_LIMITS`.
Pros:
- One definition of each rule.
- Tests can inject tiny caps, which makes the pre-fix allocation tests safe.
- `sync-registry`'s `closeLibImports` picks up a new statically imported lib
  file automatically.
Cons: one new lib file in each affected registry entry's closure (automatic);
an internal parameter threaded through the call chains.

**Option 3 — Worker isolation plus a watchdog.**
Pros: protects against unknown future bugs too.
Cons:
- It doesn't fix anything; it only contains the damage.
- It breaks the DOM-based parsers.
- It changes the public API.
- It's ruled out of scope (see PM).

**✅ Chosen: Option 2.** The rules are cross-cutting, and injectable limits are
what make the failing-first tests safe to run.

### Risks

| Risk | Mitigation |
|---|---|
| A cap truncates a legitimate large document (a scanned 600-dpi A0 page is ≈ 70 MP — ⚠️ **corrected during implementation:** ≈ 70 MP is a 600-dpi **A3** scan; A0 at 600 dpi is ≈ 560 MP. The 50 MP default holds 600-dpi A4/Letter and 300-dpi A2, and skips 600-dpi A3 and larger) | Pick caps from the largest real file classes; T-19 guards the existing fixtures; document the caps in `limits.ts` JSDoc |
| A visited set wrongly suppresses a legitimately re-drawn shared form (a logo on every page) | Key the visited set by **draw path in progress** (a recursion stack), not "ever drawn"; T-6 asserts that shared nodes still render |
| Regex rewrite changes matching semantics | T-19 golden outputs, plus a focused equivalence test on real CMaps from the fixtures |
| A pre-fix test OOMs or hangs the browser runner | Tiny injected limits and scaled time inputs (see QA); never run unscaled proof-of-concept sizes in the suite |

### Publish verdict

- **CLI:** no publish. These are lib source changes, served live on merge.
- **RTE package:** `release:package rte` **is required**. Its closure includes
  `pdf-parser.ts`, `pdf-pixel-perfect.ts` and `pdf-readable/`.
- **Data-table package:** no release. It only uses `xlsx.ts`, which this spec
  doesn't touch.

---

## Task table

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Capture T-19 golden outputs at HEAD; write failing tests T-1…T-18, T-20 with tiny-limit and scaled-time fixtures | all | ⬜ Not started | — | — | — |
| 2 | Add `lib/parsers/limits.ts` (`ParserLimits`, defaults, `withDepth`/visited helper, decode budget) and thread an internal `limits` param through `parsePdf`, `parsePdfPaged`, `parsePdfReadable`, pixel-perfect, `parseDoc*`, `parsePpt*`, `parseXlsx`; T-20 green | UC-1, UC-6 | ⬜ Not started | — | — | — |
| 3 | PDF images + CCITT: pixel cap, BPC whitelist, CCITT dims + progress guard (T-1…T-4) | UC-1 | ⬜ Not started | — | — | — |
| 4 | PDF xref: EOF guard, width-0 rejection, count clamped to remaining bytes; `/Prev` and `/Length` visited sets (T-8, T-9) | UC-4 | ⬜ Not started | — | — | — |
| 5 | PDF graph traversals: form XObjects in both renderers, page tree, structure tree, outlines, readable font resources (T-5…T-7, T-18) | UC-2, UC-3, UC-12 | ⬜ Not started | — | — | — |
| 6 | Total decode budget across repeated stream references (T-17) | UC-10 | ⬜ Not started | — | — | — |
| 7 | OLE2 clamps (sector counts, stream sizes, shared chains, sector size ∈ {512, 4096}) + `.doc` piece-table output cap (T-12, T-13, T-15) | UC-6, UC-8 | ⬜ Not started | — | — | — |
| 8 | xlsx row clamp; depth caps for PDF arrays, pptx `grpSp` (verify browser XML depth first), doc `findBlipImage` (T-14, T-16) | UC-7, UC-9 | ⬜ Not started | — | — | — |
| 9 | Linear scanning: CMap bfchar/bfrange via `indexOf`, font style-suffix, `NUMBERED_PATTERN_RTL_END`. Sweep `lib/parsers/**` for any other lazy `[\s\S]*?` or nested-quantifier regex over stream text (T-10, T-11) | UC-5 | ⬜ Not started | — | — | — |
| 10 | T-19 golden comparison green; perf budget measured; T-21 e2e in `e2e/harness/file-viewer`; JSDoc sentence on exported parsers; `sync-registry --fix`; note `release:package rte` in the PR | UC-11, UC-2 | ⬜ Not started | — | — | — |

### Implementation notes and deviations (recorded during implementation)

- **Tasks 1 and 2 share one commit.** The failing-first tests import
  `limits.ts` and pass `limits` to the entry points, so Task 1 cannot compile
  or run without Task 2's module.
- **`it.fails` marks each failing-first test until its fix lands.** Every one
  was first observed failing for the stated reason: an assertion, or a
  timing of 1.3–4.2 s against the 1 s budget. Marking them keeps the suite
  green between tasks; the task that fixes one flips it to `it` (an
  `it.fails` test turns red as soon as its fix lands, so a flip can't be
  forgotten).
- **Deferred tests.** The cases that need an injected `limits` argument on a
  non-PDF parser are written with the task that threads `limits` into that
  parser, so no commit carries an unused parameter:
  - T-12's per-stream cap case and `readOle2` threading go with Task 7.
  - T-16's `.doc` BLIP and pptx `grpSp` cases, with `parseDocEnhanced` and
    `parsePptx` threading, go with Task 8.
  - The test-first rule still holds: each was observed failing before its fix.
  - T-12's no-limit cases, T-13, T-14 and T-15 need no injected limits and
    are written in Task 1.
  - `parseXlsx` takes no `limits`: its row cap is the existing `maxRows` option.
  - `parseDoc` and `parsePpt` get `limits` in Task 7, passed through to
    `readOle2`.
  - The PDF side is the exception to "no unused parameter". `PdfReader`
    stores `limits` from Task 2 on, as a public `readonly` field the PDF fixes
    in Tasks 3–6 read. This is accepted because the PDF tests T-1…T-18 must
    inject limits through the entry points now.
- **Helper names.** The spec's `VisitedSet` / `withDepth()` ship as
  `visitOnce()` (an ever-visited set, for page tree, structure tree, outlines
  and font resources) and `DrawPath` (cycle check, depth cap and draw budget
  for form XObjects). `DrawPath`'s depth is the size of the draw path in
  progress.
- **T-4's non-consuming-code case is added with Task 3, not Task 1.** Before
  the fix, a Group 3 row whose data runs out mid-row loops forever:
  `readBit` returns 0 past the end and no code is all zeros. That is a hang,
  not a slow test, so it cannot run in the suite. It was shown in a throwaway
  Worker probe, which reported `HUNG after 5000ms` and was killed.
- **`ParserLimits.maxFormDrawsPerPage` is added.** A per-draw-path visited
  set cuts cycles but cannot bound a shared k^depth form DAG, whose output is
  k^depth by definition. UC-2/T-6 bound it with a per-page form-draw budget
  (default 10 000), so shared forms still draw every time below the budget.
- **T-9 uses a stale-object fixture, not a reduced depth cap.**
  - The file holds a second, unreferenced copy of the page content after the
    referenced one. Only a parse that abandoned the xref and re-scanned the
    file — what catching the stack overflow did — returns the stale copy. No
    spy is needed.
  - A third case chains 20 000 distinct `/Prev` sections, and only the oldest
    indexes the page. A recursive walk that catches its own overflow loses that
    section, so the case pins R2 against a local `try/catch RangeError` fix.
  - The `/Prev` walk is therefore iterative. Visiting each distinct offset
    once bounds it by the file size; it needs no depth cap.
  - The `/Length` cases pin termination and output only. A caught-overflow
    fallback would produce the same bytes via the endstream scan, so R2 there
    rests on the in-progress resolution set, which code review checks.
- **T-17 bounds decode cost, not render count.** A 1 MiB Flate stream is shared
  as the ToUnicode CMap of 600 fonts. The test asserts that the page text
  survives within the time budget, which holds under both a decode budget and
  decode-once caching. A second T-17 case gives six fonts six distinct 1 MiB
  CMaps under a 4.5 MiB budget. Only an enforced budget passes it.
  - The first four must map.
  - The sixth must not, because no budget is left for it.
  - The fifth straddles the budget and may be skipped or truncated, as R1
    allows.
- **T-18's structure-tree case asserts structure-derived output.** The tagged
  12pt text must still come out as `<h1>`, so a fix that drops a shared tree
  fails.
- **T-12's sector-size case asserts the existing `OLE2: …` error family**, not
  new wording.
- **T-12 and T-4 accept every outcome the spec allows.**
  - T-12's FAT-count and mini-stream cases pass with a partial read or an
    `OLE2: …` rejection (UC-6). Any other outcome fails, including the bare
    `RangeError` of an oversized allocation.
  - T-4's tall-rows case passes whether the image is truncated to the
    rows the cap allows or skipped. In both T-4 cases the time budget is the
    binding assertion.
- **T-6 pins the per-page scope of `maxFormDrawsPerPage`.** Two pages draw
  the same DAG under a budget that fits exactly one page, and both pages must
  still draw every leaf.
- **Why the non-PDF parsers don't get a stored-but-unused `limits` the way
  `PdfReader` does.** The PDF tests in Task 1 inject limits through the entry
  points today, which needs the field. No non-PDF Task 1 test injects
  limits, so threading them now would only add unread parameters.
- **T-4 also bounds Rows.** A second case claims a million rows on an image
  inside the cap, over data that decodes at two rows per byte. The decoder
  must stop at the rows the cap allows, so a fix that bounds only Columns
  fails it on time.
- **T-19 covers more than the demo PDFs.** It hashes every PDF entry point on
  the 5 demo PDFs and a built PDF, and a built .doc, .xlsx, .pptx (nested
  groups) and .ppt (OLE2). The PDF, .doc and .xlsx hashes were captured twice
  at 14216e9b, identical both times. The .pptx and .ppt hashes were added
  later in Task 1, from pptx, ppt and OLE2 sources still identical to
  14216e9b.
- **T-4 when `Columns` disagrees with `/Width`.** Refusing the oversized rows
  and clamping them to `/Width` are both allowed, and they differ in what that
  image shows. The test therefore pins only what they share: the page and a
  valid CCITT image inside the cap render, and a 20-million-column claim
  parses within the time budget. Bounding only Rows fails that budget.
- **Perf baseline** (largest demo fixture `invoice.pdf`, all four PDF entry
  points, median of 25): 13.8–15.2 ms at 14216e9b. It is measured with a
  local, uncommitted workload spec. The coordinator directed that the
  benchmark carry no assertion, and lint's `sonarjs/assertions-in-tests` would
  reject a committed test without one, so it stays local.

## Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run sonar:gate`
   against `http://localhost:9000` — coverage re-measured unless the tree
   fingerprint proves it current) run and clean on the changed code. eslint is NOT a substitute. If the token, server, or Docker
   is unavailable, the task is **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with:

- **Completed** — the date/time (`date +"%Y-%m-%d %H:%M"`).
- **Score** — the review-gate score.
- **Retrospective** — 1–2 sentences: what went well, and what to improve later.

Marking a row Done without all five is a process violation, not a shortcut.
