# CLI — Install Integrity: One Source, Honest Plans, Honest Exit Codes

> **Status:** Spec — ready for an executing agent
> **Date:** 2026-10-03
> **Source:** code review of `packages/cli/src` (branch `docs/codebase-review-fix-specs`).
> **Living history:** never delete a completed row, a fixed bug or a superseded
> decision — mark it and append below.

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **Merge-order note (not a prerequisite):** `specs/cli-registry-path-safety-spec.md`
> edits different functions in the same files — `core/install.ts`
> (`installLibFiles`, `pruneObsoleteFiles` vs. this spec's write loops,
> `performInstall`, `previewComponentMerges`), `core/merge.ts` (`mergeWriteFile`
> path guard vs. this spec's `shouldAdvanceRef`), `core/lib-reconcile.ts`
> (`refreshLibFiles` guard vs. this spec's explicit-file classification),
> `commands/add.ts`, `commands/diff.ts`, `mcp/tools/write-tools.ts`. Merge the
> path-safety spec **first** and rebase onto it: its sink guards throw, and this
> spec turns those throws into recorded failures. No conflict with
> `specs/cli-network-and-package-manager-spec.md` (disjoint files).
>
> **Split note:** the review's package-manager-detection, network-timeout and
> `fetchLibContent` items were moved to
> `specs/cli-network-and-package-manager-spec.md` to keep this bundle under ten
> tasks (plan-to-specs bundling rule).

---

## The invariant

> **An `add` / `update` either reports every failure and exits non-zero, or
> leaves the project, the lockfile refs and the reported plan consistent with
> what is actually on disk — never a silent partial success.**

Sub-rules, each one sentence:

- **I1 (one source)** — the manifest that names components and files always
  comes from the same registry source the file contents are fetched from:
  flag/argument › `components.json` `registry` › default.
- **I2 (right place)** — every component is compared, fetched, cached and
  written as its own kind (`component` → ui dir, `block` → blocks dir); a
  plan's verdict for a component is the verdict for the files that would
  actually be written.
- **I3 (unknown ≠ changed)** — a file whose upstream could not be fetched is
  *unchecked*, never *changed*, *conflicting* or *identical*.
- **I4 (ref = disk)** — a component's lockfile ref advances only when every
  file of that component the run meant to write reached that ref.
- **I5 (no silent failure)** — every failed file, lib file, npm install or
  lockfile write is listed at the end, and the command exits 1; MCP tools
  return `isError: true` with the list.
- **I6 (no silent markers)** — a run that writes conflict markers says so, and
  exits 1 when nobody is there to see it (`--yes` or stdin not a TTY).
- **I7 (consent to destroy)** — a customized lib file is overwritten only under
  `--force` / `force: true`, however the target set was chosen.

---

## 0. Step-0 verification — what the source actually says

Re-read on 2026-10-03. ✓ confirmed · ⚠️ wrong or incomplete (original kept,
truth added) · ➕ same class, not in the review.

| # | Finding | Verdict | Evidence |
| --- | --- | --- | --- |
| V1 | The global `preAction` hook loads the manifest from the CLI flags only (`program.ts:270-273`); commands then merge `components.json` `registry` into their options and fetch file sources from it. ⚠️ **Eight** commands do this, not three: `add.ts:606-608`, `apply.ts:203`, `diff.ts:41-42`, `doctor.ts:439`, `migrate.ts:101`, `refresh-lib.ts:65`, `status.ts:144`, `update.ts:318`. | ✓ + ⚠️ widened | as cited |
| V2 | ⚠️ "MCP side does it right" is only half true. Tools that pass `config` to `resolveSource` (`mcp/tools/options.ts:54-58`) do (`write-tools.ts:138,178,253,…`, `read-tools.ts:86,103,133,150`), but `list_components`, `search_components`, `get_component` and `why` call `resolveSource(source)` **without** config (`read-tools.ts:23,38,48,65`) and so describe the default registry in a project pinned to a fork. | ⚠️ widened | as cited |
| V3 | Commander calls `this.opts()` **after** `preAction` (`node_modules/commander/lib/command.js:538` inside the listener invoked at `:1501-1503`, commander 12.1.0), so a value set in the hook with `setOptionValue` reaches the action's `options`. | ✓ | as cited |
| V4 | `getConfig` prints `Error: components.json is missing required fields…` on an invalid file (`utils/config.ts:123-138`) — calling it from the hook would print that twice for commands that call it again. | ✓ | as cited |
| V5 | Block conflict detection: `add` passes one `targetDir` (the ui dir) to `detectConflicts` (`add.ts:588-591`); `checkFileConflict` calls `fetchAndTransform` without `kind` (`plan.ts:51`) and looks under `targetDir` (`plan.ts:46`). Same for `update` (`update.ts:244-246`), MCP `get_install_plan` (`install.ts:301-305`) and `performInstall`'s own scan (`install.ts:405-407`). An installed block is therefore always `missing` → `install`. ⚠️ **Worse than "never a conflict":** `performInstall` then writes it into the blocks dir through `mergeWriteFile` (`install.ts:335-343`) with `forceWholeFile` false, so an **edited** block is silently 3-way merged — possibly with `<<<<<<<` markers — and `add` never prints the merge report (`add.ts:518-546`). An identical installed block is reported as `Would install` / `Added`. | ✓ + ⚠️ | as cited |
| V6 | `contentCache` is keyed by the bare relative file (`plan.ts:52`, read at `install.ts:59`, `add.ts:318`). No component/block path collides in today's manifest (scan 2026-10-03), so this is latent — but I2 must hold by construction, not by luck. | ✓ latent | scan |
| V7 | `checkFileConflict` turns **any** fetch error into `'changed'` (`plan.ts:56-58`): offline or on a 404, every installed component is a conflict; `add` offers to overwrite them, `update` puts them in the write set, then the write re-fetches and fails into a warning. | ✓ | as cited |
| V8 | `writeComponentFiles` catches a failed file, pushes a warning and records **no outcome** (`install.ts:99-108`); `shouldAdvanceRef` only rejects `fellback-kept` (`merge.ts:130-132`), so if any other file of the component was written the ref advances (`install.ts:346-348`). Next `update`: BASE fetched at the new ref equals THEIRS, `merge3(base=theirs, ours, theirs)` keeps OURS — the upstream change to the failed file is silently dropped, exactly what the comment at `merge.ts:121-129` says it prevents. ➕ `writePeerFiles` / `writeTestFiles` failures (`install.ts:126-128`, `:150-152`) do not even mark the component unsuccessful, so it is listed as installed. | ✓ + ➕ | as cited |
| V9 | File / lib / npm failures are warnings only (`install.ts:105`, `:189`, `:216`); ➕ so is a failed lockfile write (`install.ts:435-439`), which loses every ref and baseline recorded in the run. `add` exits 0 (`add.ts:666-685` exits 1 only on a throw); `update` exits 0. | ✓ + ➕ | as cited |
| V10 | `update` exits 1 on written conflict markers only when `options.yes` (`update.ts:368-370`); the comment says "CI / --yes". A non-TTY run without `--yes` writes markers and exits 0 (new dependencies are the only non-TTY abort, `update.ts:155-161`). ➕ `apply` has the identical guard (`apply.ts:222-224`). `shouldOfferAddonApply` already defines "interactive" as `!yes && isTTY` (`update.ts:71-73`). | ✓ + ➕ | as cited |
| V11 | ⚠️ `refresh-lib --files` / MCP `refresh_lib.files` overwrite customized lib files without force (`doctor.ts:336-342`: explicit `files` become the targets and `protectedFiles` is `[]`). **This is intentional in code** — `refreshLibCore`'s JSDoc says "An explicit `files` list is treated as user consent to overwrite exactly those" (`doctor.ts:322-324`) — **but it contradicts every user-facing contract**: README "Lib files you customized are protected and listed, never overwritten, unless you pass `--force`" (`packages/cli/README.md:260-262`), help (`help.ts:139`), the MCP description "lib files you customized are protected unless force is set" (`write-tools.ts:447`), and the `--force` confirmation prompt that `--files` bypasses (`refresh-lib.ts:67-70`). Decision (§D.4 f): the documented contract wins. | ⚠️ intentional but contradicted | as cited |
| V12 | `previewComponentMerges` swallows per-file errors (`install.ts:515-521`), so `update --dry-run` omits files it could not preview. ➕ It also ignores `input.blocksPath` (`install.ts:490`). | ✓ + ➕ | as cited |
| V13 | `writeComponentFiles` / `writePeerFiles` / `writeTestFiles` are near-duplicate loops (`install.ts:92-154`) — fixing V8 in one place requires unifying them. | ✓ | as cited |
| V14 | MCP write tools return `json(result)` with no error signal on partial failure (`write-tools.ts:152-158`, `:198-206`, `:436`); `json`/`err` in `mcp/tools/result.ts` support `isError`. | ✓ | as cited |
| V15 | Real `registry.json` has 10 blocks (`login`, `dashboard`, `settings-profile`, …); e2e harnesses exist for `dashboard` and `login`. No entry declares `peerFiles` today (scan) — the peer-file path is fork-only. | ✓ | scan; `e2e/harness/` |

### Refuted / corrected findings (summary)

- ⚠️ V1/V2 — source mismatch hits 8 CLI commands and 4 MCP read tools, not 3 commands; MCP is not uniformly the reference.
- ⚠️ V5 — block mis-detection silently 3-way **merges** edited blocks during `add` (markers possible, never reported), not merely "always install".
- ⚠️ V11 — `--files` overwrite is a deliberate code decision, not an oversight; it is still wrong against the documented contract, so the spec records the decision explicitly.
- Package-manager detection, network timeouts and `fetchLibContent` wrapping → moved to `specs/cli-network-and-package-manager-spec.md` (verified there).

---

## B. Product Manager section

### B.1 Business logic

`add`, `update`, `apply` and their MCP twins read one registry source, compare
each component against the directory it really lives in, and tell the truth
about the outcome. When the registry cannot be reached, the CLI says *could not
check* instead of *you have conflicts*. When a file cannot be written, the
component is not marked as updated in the lockfile, the failure is listed, and
the command exits 1 so scripts and CI notice. When a merge leaves conflict
markers and nobody is watching, the command fails. `refresh-lib` only
overwrites a lib file you customized when you say `--force`.

### B.2 Why the customer wants this

- **"My fork's components fail with 404 / Invalid component."** A team pins a
  fork in `components.json`; the CLI resolves names and file lists against the
  default registry and fetches contents from the fork. Workaround today: pass
  `--registry` on every single command.
- **"`add` merged into my edited dashboard block and I found `<<<<<<<` in it a
  week later."** Blocks are never shown as conflicts; nothing is reported.
  Workaround: never re-`add` a block.
- **"I went offline and `add` said every component conflicts."** The developer
  is invited to overwrite files based on a fetch error.
- **"CI passed, but half the files were not updated."** Partial failures are
  yellow warnings with exit 0; worse, the lockfile records the component as up
  to date, so the next `update` silently throws away the upstream change.
  Workaround: grep CI logs for "Could not".
- **"`refresh-lib --files i18n.token.ts` wiped my locale."** The docs promised
  protection without `--force`.

### B.3 Use cases = definition of done

- **UC-1** With `"registry": "<fork>"` in `components.json` and no flag, every
  CLI command that declares `--registry` (`add`, `apply`, `diff`, `doctor`,
  `list`, `migrate`, `refresh-lib`, `search`, `set-locale`, `status`,
  `update`, `why`) loads the **manifest** from the fork and fetches files from
  the fork.
- **UC-2** The MCP tools `list_components`, `search_components`,
  `get_component` and `why` resolve the source from `components.json` exactly
  like the write tools.
- **UC-3** Precedence is unchanged: `--registry` / tool `registry` ›
  `components.json` `registry` › default; with neither, behaviour is
  byte-identical to today.
- **UC-4** For an installed block (e.g. `dashboard` under the blocks alias):
  edited → reported as a conflict (overwrite prompt / `Components skipped (kept
  local changes)`); identical → `Components skipped (up to date)`; absent →
  installed. Same verdicts from `update` and MCP `get_install_plan`.
- **UC-5** A component file and a block file with the same relative path never
  receive each other's fetched content.
- **UC-6** If the registry cannot be reached or a file 404s during the conflict
  scan, the component is listed under `Could not check (registry unreachable)`
  with the URL and reason, is **not** offered for overwrite or written, and
  the command exits 1 after the report.
- **UC-7** If any file of a component fails to write, its lockfile ref stays
  at the old value, it is not listed as added/updated, and a later successful
  `update` still 3-way merges that upstream change into the user's edit.
- **UC-8** `add`, `update` and `apply` list every failure (component, peer,
  test or lib file; npm install; lockfile write) under `Failed:` at the end and
  exit 1.
- **UC-9** MCP `add_component`, `update_component` and `apply_addon` return
  `isError: true` with the usual JSON body plus `failures[]` when any failure
  was recorded.
- **UC-10** `update` and `apply` (and `add`, when it merges) that write
  conflict markers exit 1 when run with `--yes` **or** with stdin not a TTY;
  an interactive run keeps exit 0 with the red warning.
- **UC-11** `add` prints the `Merge summary (files):` block whenever it merged,
  merged with conflicts, or kept a file (fell back).
- **UC-12** `refresh-lib --files <f>` and MCP `refresh_lib` `files: [...]`
  refresh a listed pristine-stale or missing file, but list a customized one
  under `Protected (your edits — pass --force to overwrite)` and leave it
  untouched; with `--force` (confirmed, or `-y`) it is overwritten.
- **UC-13** `update --dry-run` lists a file it could not preview as
  `could not preview: <file> (<reason>)` instead of omitting it.
- **UC-14** Consumer installs still pass: `npm run e2e -- dashboard` (block)
  and `npm run e2e -- button`.

### B.4 Explicitly out of scope

- Network timeouts, retries, package-manager detection, `fetchLibContent`
  error wrapping → `specs/cli-network-and-package-manager-spec.md`.
- Path / name validation → `specs/cli-registry-path-safety-spec.md`.
- Per-file refs in the lockfile (the "ref-granularity open decision" in
  `merge.ts:127-128`) — I4 is met conservatively by not advancing.
- `doctor` / `doctor --fix` exit-code semantics (`doctor.ts:412-461`); it
  consumes `performInstall` and must keep compiling — new result fields are
  additive.
- Rolling back files already written when a later file of the same component
  fails (the ref rule makes the next `update` correct; rollback is a separate
  design).
- `migrate`'s own conflict scan (`migrate-core.ts:293-295`) — legacy layouts
  have no blocks.

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.
> Follow `.claude/CLAUDE.md` "Writing Tests": one test per behaviour, one
> representative per input class, real-shaped inputs, assert state (files on
> disk, lockfile contents, exit code, printed report), not internal calls.

Runner: `npm run test:cli`. Coverage leg: `npm run coverage:cli`.

### C.1 Traceability table

| Test ID | Test name | Proves | Type | File |
| --- | --- | --- | --- | --- |
| T-1 | `commands load the manifest from the source their files come from` — `createProgram().parseAsync([...,'add','button'])` with `process.chdir` into a temp project, `registry/load.js` and `commands/add.js` mocked; `it.each`: flag only · `components.json` only · both (flag wins) · neither (`undefined`); assert the source `loadRegistry` received **and** the `options.registry` the action received are the same value | UC-1, UC-3 | unit (program wiring) | `program.spec.ts` (new) |
| T-2 | `a read-only command (why) honours components.json too, and a command without --registry is untouched` — same harness, `why button` and `help` | UC-1, UC-3 | unit | `program.spec.ts` |
| T-3 | `MCP read tools resolve the registry from components.json` — in-memory MCP client (pattern of `mcp/server.spec.ts`), temp cwd with a fork in `components.json`, call `get_component` and `list_components`; assert the loaded source is the fork | UC-2 | integration | `mcp/server.spec.ts` |
| T-4 | `detectConflicts judges each component in its own directory as its own kind` — **real temp dirs** (ui + blocks), `./fetch.js` mocked to return different upstream text per `kind`; `it.each`: edited block → `conflicting`; identical block → `toSkip`; absent block → `toInstall`; an edited ui component alongside → `conflicting` (unchanged behaviour) | UC-4 | unit (real fs) | `core/plan.spec.ts` |
| T-5 | `a component and a block declaring the same relative path keep their own content` — in-memory entries `widget` (component) and `widget-page` (block) both declaring `shared/x.ts`; `performInstall` with real temp dirs; assert each directory's file holds its own kind's upstream text | UC-5 | unit (real fs) | `core/install.spec.ts` or `core/install-integrity.spec.ts` (new, real fs) |
| T-6 | `a fetch failure during the scan is unchecked, never a conflict` — real temp dir with an installed **identical** file and an installed **edited** file; `it.each` over the two failure classes: transport rejection (`fetch` throws) and HTTP 404; assert `unchecked` lists both components with the reason, `conflicting` and `toSkip` are empty | UC-6 | unit | `core/plan.spec.ts` |
| T-7 | `add reports unchecked components, writes nothing for them and exits 1` — existing `add()` shell; assert the `Could not check` block names component + reason, no overwrite prompt text, `ExitError(1)` | UC-6 | unit | `commands/add.spec.ts` |
| T-8 | `a component with a failed file keeps its old ref and is not reported installed` — real temp dirs + lockfile with `ref: OLD`; `resolveRef` → `NEW`; `it.each` over where the failure happens: a `files` entry, a `testFiles` entry (`includeTests`), a `peerFiles` entry; assert the written `components.lock.json` still has `OLD`, `result.installed` lacks the component, `result.failures` names the file and stage | UC-7, UC-8 | unit (real fs) | `core/install-integrity.spec.ts` (new) |
| T-9 | `the next update merges an upstream change into an edited file whose previous update failed` — real temp dir; `fetchAtRef` / fetch mocked per ref (`OLD`, `NEW` contents of a realistic component file); run 1 at `NEW` fails on `b.ts` (ref stays `OLD`); the user edits `b.ts`; run 2 at `NEW` succeeds; assert `b.ts` contains the user's edit **and** the upstream change | UC-7 | unit (real fs) | `core/install-integrity.spec.ts` |
| T-10 | `lib, npm and lockfile failures are recorded as failures` — `it.each`: lib fetch rejects · `installPackages` rejects · lockfile write throws (read-only lockfile path); assert one `failures` entry with the right `stage` and message each | UC-8 | unit | `core/install-integrity.spec.ts` |
| T-11 | `add exits 1 after listing failures` / `update exits 1 after listing failures` / `apply exits 1 after listing failures` — `performInstall` mocked to return one failure; assert the `Failed:` block and `ExitError(1)`; with `failures: []` exit is not called | UC-8 | unit | `commands/add.spec.ts`, `commands/update.spec.ts`, `commands/apply.spec.ts` |
| T-12 | `conflict markers fail a non-interactive run` — `it.each` over `{yes, isTTY}`: `(true, true)` → exit 1; `(false, false)` → exit 1; `(false, true)` → no exit; and no conflicts → no exit — through `update()` with `process.stdin.isTTY` set per row (the reported case is `(false, false)`) | UC-10 | unit | `commands/update.spec.ts` |
| T-13 | `apply and add fail a non-interactive run that wrote conflict markers` — one row each, `(false, false)` | UC-10 | unit | `commands/apply.spec.ts`, `commands/add.spec.ts` |
| T-14 | `add prints the merge summary when it merged or kept files` — `performInstall` mocked with a `mergeReport` holding one `mergedConflicted` and one `fellBack`; assert `Merge summary (files):` and the conflict warning appear | UC-11 | unit | `commands/add.spec.ts` |
| T-15 | `add_component, update_component and apply_addon flag failures as isError with failures[]` | UC-9 | unit | `mcp/tools/write-tools.spec.ts` |
| T-16 | `an explicit --files list never overwrites a customized lib file without force` — `it.each`: listed pristine-stale → refreshed; listed missing → written; listed customized → protected + untouched; listed customized + `force` → refreshed; via `refreshLibCore` with real temp dirs and the existing lib-baseline fixtures | UC-12 | unit (real fs) | `commands/doctor.spec.ts` or `commands/refresh-lib.spec.ts` |
| T-17 | `update --dry-run lists files it could not preview` — `previewComponentMerges` with one file whose fetch rejects; assert the preview contains it with the reason, and `update --dry-run` prints `could not preview:` | UC-13 | unit | `core/install-integrity.spec.ts`, `commands/update.spec.ts` |
| T-18 | `e2e: block and component consumer installs` — `npm run e2e -- dashboard`, `npm run e2e -- button` | UC-14 | e2e | existing harnesses |

Every UC-1 … UC-14 appears at least once.

### C.2 Test types

- **Unit** — most behaviour lives in `core/` and is observable as files on disk
  and lockfile contents, so the integrity tests use **real temp directories**
  (`fs.mkdtemp`) in a new `core/install-integrity.spec.ts`; only `./fetch.js`,
  `./ref.js` and `utils/package-manager.js` are mocked. `install.spec.ts`
  mocks `fs-extra` wholesale and cannot see "the lockfile still says OLD".
- **Command wiring** — the existing shells (`add.spec.ts:850-915` pattern:
  mocked `prompts`/`ora`/`performInstall`, `console.log` captured, `process.exit`
  throws `ExitError`).
- **Program wiring** — new `program.spec.ts`; `parity.spec.ts` already calls
  `createProgram()` without parsing, so it is unaffected.
- **MCP** — in-memory client (`mcp/server.spec.ts`) and
  `mcp/tools/write-tools.spec.ts`.
- **e2e** — T-18 only. No Storybook / a11y (no UI). No perf claim.

### C.3 Edge cases and failure modes the tests must cover

- Source precedence: all four rows of T-1, including **neither** (must stay
  `undefined`, not `''`).
- An invalid `components.json` must not print its error twice (V4): the hook
  reads the `registry` field quietly.
- Blocks: edited **and** identical **and** absent (T-4) — the identical case
  catches "always conflict", the absent case catches "never install".
- Scan failures: transport **and** HTTP 404 (T-6) — different code paths in
  `fetchComponentContent` (`fetch.ts:40-58`).
- Failure location: `files`, `testFiles`, `peerFiles` (T-8) — the three loops
  being unified.
- A component that failed **every** file (outcomes empty) vs. one of several —
  only the latter used to advance the ref; include the partial case (T-8).
- Interactivity: `--yes` with a TTY, non-TTY without `--yes` (T-12).
- `failures: []` must never exit 1 (T-11 negative row).
- `refresh-lib` explicit list containing a file outside the required set but
  present and customized (T-16 extra row) — protected.

### C.4 Coverage expectation

New `core/install-integrity.spec.ts` drives `core/install.ts` changes to full
line coverage of the new code. Touched files must not drop below their current
`npm run coverage:cli` line coverage: `program.ts`, `core/plan.ts`,
`core/install.ts`, `core/merge.ts`, `core/lib-reconcile.ts`,
`commands/add.ts`, `commands/update.ts`, `commands/apply.ts`,
`commands/doctor.ts`, `commands/refresh-lib.ts`, `commands/merge-report.ts`,
`mcp/tools/read-tools.ts`, `mcp/tools/write-tools.ts`.

### C.5 Mutation check (mandatory before Task 8)

Derived from I1–I7, not from the assertions. Back up, break, run, restore:

1. I1: drop the `components.json` read from the hook → T-1, T-2 red. Load
   from the config but do not write back into options → T-1 red (the two
   values differ).
2. I2: drop `kind` from the scan fetch → T-4 red. Key the cache by file only →
   T-5 red. Scan blocks in the ui dir → T-4 red.
3. I3: restore `catch { return 'changed'; }` → T-6, T-7 red.
4. I4: restore `shouldAdvanceRef(outcomes)` ignoring failures → T-8, T-9 red.
   Unify the loops but forget the peer loop's failure → T-8 (peer row) red.
5. I5: drop the exit in one command → that command's T-11 red. Record npm
   failure as a warning → T-10 red.
6. I6: restore `options.yes`-only → T-12 `(false, false)` red.
7. I7: restore "explicit list = consent" → T-16 red.
8. Over-reach: exit 1 on an empty `failures` list → T-11 negative row red.

---

## D. Architecture section

### D.1 Usability — the public API

No new flags. The developer-visible surface is behaviour and output.

**Simple mode** (unchanged commands, now honest):

```bash
npx @gilav21/shadcn-angular add dashboard          # edited block → conflict prompt, not a silent merge
npx @gilav21/shadcn-angular update --yes           # any failure or conflict marker → exit 1
```

**Custom mode** (a project pinned to a fork — no flag needed any more):

```jsonc
// components.json
{ "registry": "https://gitlab.example.com/org/fork/-/raw/main/packages/components", … }
```

```bash
npx @gilav21/shadcn-angular add data-table        # manifest AND files from the fork
```

**Offline run (what the developer sees):**

```text
Could not check (registry unreachable) — nothing was written for these:
  - button: Could not reach the registry (https://…/button/button.component.ts): fetch failed
  - card: File not found locally or remotely: card/card.component.ts
✖ 2 component(s) could not be checked.          (exit 1)
```

**Partial failure at the end of `add` / `update` / `apply`:**

```text
Failed:
  - data-table/data-table.component.html — Could not reach the registry (…): ECONNRESET
  - npm install — Failed to install npm dependencies: …
These components were NOT recorded as updated; re-run when the cause is fixed.   (exit 1)
```

CLI-internal types (exported, consumed by commands and MCP):

```ts
// core/install.ts
export type InstallFailureStage = 'component' | 'peer' | 'test' | 'lib' | 'npm' | 'lockfile';
export interface InstallFailure {
  readonly stage: InstallFailureStage;
  /** Component name, or null for project-wide stages (npm, lockfile). */
  readonly component: string | null;
  /** Relative file, or null for npm / lockfile. */
  readonly file: string | null;
  readonly message: string;
}
export interface InstallResult { /* existing fields */ readonly failures: InstallFailure[]; }

// core/plan.ts
export interface UncheckedComponent { readonly name: ComponentName; readonly file: string; readonly reason: string; }
export interface ConflictCheckResult { /* existing fields */ unchecked: UncheckedComponent[]; }
/** Where each kind installs; built once by resolveInstallTargets() and passed everywhere. */
export interface InstallTargets { readonly uiDir: string; readonly blocksDir: string; }

// core/install.ts — MergePreview gains an optional reason
export interface MergePreview { readonly file: string; readonly outcome: MergeOutcome | 'error'; readonly reason?: string; }
```

MCP results (`add_component`, `update_component`, `apply_addon`):

```jsonc
{ "isError": true, "content": [{ "type": "text", "text": "{ …InstallResult…, \"failures\": [ … ] }" }] }
```

### D.2 Efficiency

No meaningful perf concern. The hook adds one small file read
(`components.json`, already read by the command moments later). The block fix
removes a wasted fetch per block file (today fetched from `ui/`, 404). No new
network calls.

### D.3 DX for the consuming developer

- **Must learn:** exit codes now mean something — `0` = everything written and
  recorded; `1` = something failed or was left with markers in a
  non-interactive run. README `update` section (`packages/cli/README.md:240-242`)
  is reworded from "In CI, `update --yes` exits non-zero…" to "Any
  non-interactive run (`--yes`, or piped / CI stdin) exits non-zero…", and the
  same sentence is added for `add` and `apply`.
- **Can ignore:** everything else; interactive happy paths print the same as
  today.
- **Exact texts:** `Could not check (registry unreachable) — nothing was
  written for these:` · `Failed:` · `These components were NOT recorded as
  updated; re-run when the cause is fixed.` · `could not preview: <file>
  (<reason>)` · refresh-lib reuses its existing `Protected (your edits — pass
  --force to overwrite):`.

### D.4 Implementation options

#### (a) One registry source (I1)

**Option 1 — Resolve in the `preAction` hook.** Read `components.json`'s
`registry` field quietly (new `readConfiguredRegistry(cwd)` in
`utils/config.ts`, no validation, no printing), compute
`flag ?? configured`, call `loadRegistry` once with it, and
`actionCommand.setOptionValue('registry', resolved)` **only when the command
declares a `registry` option** (V3).
Pros: one place for every current and future command; one manifest fetch per
run; the commands' own `if (!options.registry && config.registry)` lines become
harmless no-ops (left in place: programmatic callers and tests call the action
functions directly). Cons: the hook reads a file for commands that do not need
the registry (`set-density`) — negligible.

**Option 2 — Each command calls `loadRegistry(options)` after merging config**
(the MCP `resolveSource` pattern). Pros: explicit. Cons: eight edits plus every
future command must remember; the hook has already fetched the default manifest
— two manifest fetches per run, the first wasted (and slow when the default
host stalls).

**Option 3 — Lazy load on first registry access.** Cons: the registry is a
plain exported object read synchronously by ~60 call sites; making it lazy is a
large refactor.

**✅ Chosen: Option 1.** MCP read tools get the one-line fix of passing
`config` (`await getConfig(cwd) ?? undefined`) like the write tools.

#### (b) Block-aware detection (I2)

**Option 1 — `InstallTargets { uiDir, blocksDir }` built by one
`resolveInstallTargets(cwd, config, { path, blocksPath })` and passed to
`detectConflicts`, `classifyComponent`, `planInstall`, `performInstall`,
`previewComponentMerges`; each component's kind comes from
`registry[name].type`; `checkFileConflict` takes `kind`; cache key
`` `${kind}:${file}` `` via one `contentKey(kind, file)` helper.**
Pros: the directory/kind decision exists once; also fixes V12's ignored
`blocksPath`. Cons: signature change on exported `detectConflicts` /
`checkFileConflict` (CLI-internal; re-exported from `add.ts:29-30` for tests).

**Option 2 — Call `detectConflicts` twice (components, then blocks) and merge
the results.** Pros: no signature change. Cons: every caller must remember to
split and merge; the cache collision (V6) remains.

**✅ Chosen: Option 1.**

#### (c) Fetch failure during the scan (I3)

**Option 1 — Keep `'changed'`.** ✗ violates I3 (status quo).
**Option 2 — Throw; abort the whole command on the first error.** Pros:
simple. Cons: one 404 in a fork blocks updating every other component; the
report names only the first problem.
**Option 3 — New `unchecked` bucket: excluded from every write set, reported,
exit 1 at the end.** Pros: everything checkable proceeds; every problem is
named; consistent with I5.

**✅ Chosen: Option 3.** `classifyComponent` returns `'unchecked'` when any
file errored; a missing local file still short-circuits to `missing` before any
fetch (unchanged).

#### (d) Failure model (I4, I5)

**Option 1 — Exit 1 whenever `warnings` is non-empty.** ✗ warnings also carry
benign notices (`fellback-kept`, `Lib file … differs`, `@jest/globals` hint).
**Option 2 — Typed `failures: InstallFailure[]` beside `warnings`; one
`writeFileSet(files, stage, component, ctx)` loop replaces the three loops
(V13) and returns `{ outcomes, failed }`; the ref advances only when
`shouldAdvanceRef(outcomes) && failed === 0`; a component with any failure is
not pushed to `installed`.**

**✅ Chosen: Option 2.** `shouldAdvanceRef`'s signature gains the failure
count so its JSDoc rule ("advance only when … NONE fell back") reads "…none
fell back and none failed".

#### (e) MCP failure signalling (I5)

**Option 1 — JSON body with `ok: false`, no `isError`.** Cons: clients and
agents treat the call as successful.
**Option 2 — `isError: true` with the same JSON body (including `failures`).**
Pros: surfaced by every MCP client; structure kept for the agent. Cons: a
partial success reads as an error — which is the point of I5.

**✅ Chosen: Option 2**, via `json(value, { isError })` in
`mcp/tools/result.ts`. `hadConflicts` alone stays non-error (documented
outcome of a merge).

#### (f) `refresh-lib` explicit list (I7)

**Option 1 — Keep "explicit list = consent" and change README / help / MCP
description.** Cons: a destructive default an agent can trigger by naming a
file; bypasses the `--force` confirm.
**Option 2 — Explicit list selects *which* files; protection still applies;
`--force` is the only consent.** Classify each listed file with the same rule
as `collectLibDrift` (export the classifier from `lib-reconcile.ts`).

**✅ Chosen: Option 2**, because three user-facing contracts already promise it
and only an internal JSDoc says otherwise (V11). The JSDoc is rewritten; the
change is called out in the commit message.

#### (g) "Non-interactive" (I6)

One helper `isNonInteractive({ yes, isTTY })` = `yes === true || !isTTY` in
`commands/merge-report.ts` (already shared by `update` and `apply`), and
`exitIfUnattendedConflicts(hadConflicts, options)` used by `add`, `update`,
`apply`. `shouldOfferAddonApply` becomes `!isNonInteractive(...)`.

### D.5 Risks

| Risk | Mitigation |
| --- | --- |
| Scripts that relied on exit 0 despite failures now fail. | Intended (I5). README wording updated; commit message names the change. |
| The hook reading `components.json` on every command surprises `init` (no file yet) or an invalid file. | Quiet read returns `undefined` on missing / unparsable / non-string; T-1 "neither" row and C.3. |
| Signature changes ripple into `migrate-core.ts`, `doctor.ts`, MCP tools. | `tsc` finds every call site (pre-1.0: no compatibility shims — memory "Pre-1.0: no backward-compat scaffolding"); `npm run test:cli` in full. |
| Sonar S3776 in `performInstall` / `add()` after new branches. | Extract `printFailures`, `printUnchecked`, `writeFileSet`, `resolveInstallTargets`; each ≤ 15. |
| Rebase conflicts with the path-safety spec. | Merge order in the banner; both specs name the functions they touch. |
| `isTTY` is `undefined` in vitest. | Tests set `process.stdin.isTTY` explicitly per row and restore it. |

### D.6 Publish verdict

**A CLI npm publish IS required.** All changes are CLI logic under
`packages/cli/src/**` (`program.ts`, `core/*`, `commands/*`, `mcp/tools/*`,
`utils/config.ts`); no registry data or manifest shape changes — checked
against `.claude/CLAUDE.md` "When a CLI npm Publish Is Required". **Publish is
manual (passkey / 2FA) and is done by the human after the PR is merged to
`master`.** Recording the PR in the pending-releases memory is the lead's job.

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Write failing tests T-1 … T-17 (new `program.spec.ts`, new `core/install-integrity.spec.ts`, additions to `plan.spec`, `add.spec`, `update.spec`, `apply.spec`, `server.spec`, `write-tools.spec`, `doctor`/`refresh-lib` spec). Confirm each fails for the right reason. | UC-1 … UC-13 | ⬜ Not started | — | — | — |
| 2 | One registry source: `readConfiguredRegistry` + `preAction` resolution and write-back (§D.4 a); MCP read tools pass `config` | UC-1, UC-2, UC-3 | ⬜ Not started | — | — | — |
| 3 | `InstallTargets` + `resolveInstallTargets`; kind-aware `checkFileConflict` / `classifyComponent` / `detectConflicts`; `contentKey(kind, file)` cache; thread through `add`, `update`, `planInstall`, `performInstall`, `previewComponentMerges` | UC-4, UC-5 | ⬜ Not started | — | — | — |
| 4 | `unchecked` bucket in the scan; `add` / `update` / `get_install_plan` report it and exclude it from write sets; `previewComponentMerges` returns `error` previews and `update --dry-run` prints them | UC-6, UC-13 | ⬜ Not started | — | — | — |
| 5 | Failure recording: `writeFileSet` replaces the three loops; `failures` on `InstallResult` (component / peer / test / lib / npm / lockfile); ref advances only with zero failures; failed components not in `installed` | UC-7, UC-8 (data) | ⬜ Not started | — | — | — |
| 6 | Reporting & exit codes: `Failed:` block + exit 1 in `add` / `update` / `apply`; `isNonInteractive` + `exitIfUnattendedConflicts`; `add` prints the merge summary; MCP `isError` + `failures`; README (`update` / `add` / `apply` exit-code wording) and `help.ts` | UC-8, UC-9, UC-10, UC-11 | ⬜ Not started | — | — | — |
| 7 | `refresh-lib` explicit list respects protection (§D.4 f): export the lib-file classifier, classify listed files, `protectedFiles` populated unless `force`; rewrite the `refreshLibCore` JSDoc | UC-12 | ⬜ Not started | — | — | — |
| 8 | Gates: mutation check §C.5; `npm run test:cli`; `npm run coverage:cli`; `npm run lint`; `npm run e2e -- dashboard` and `npm run e2e -- button` (T-18); `npm run sonar:gate` with the four verdict checks from `.claude/CLAUDE.md` §4; record "**CLI publish required — manual, after merge**" in the completion log | all | ⬜ Not started | — | — | — |

Task sizing: one coherent commit per row. Task 3 must precede 4 (both change
`checkFileConflict`); 5 must precede 6 (6 reports what 5 records).

### Implementation notes the executing agent must honour

- State the sub-rule (I1–I7) in each implementing commit message and re-read
  the diff against it (`.claude/CLAUDE.md` "Fixing Bugs" §3).
- Run the consumers: `performInstall` is used by `add`, `update`, `apply`,
  `doctor --fix`, `migrate` and four MCP tools — run `npm run test:cli` in full,
  not a folder.
- Keep every string existing specs assert (`Success! Added N component(s)`,
  `Components skipped (up to date)`, `Components skipped (kept local changes)`,
  `Merge summary (files):`, `[Dry Run] No changes will be made.`).
- No new runtime dependencies. Sonar rules from `.claude/CLAUDE.md` §4 apply.

---

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

---

## Completion Log

| Row | Date | Task | Reviewer score | Notes |
| --- | --- | --- | --- | --- |
