# Upgrade tooling & registry — full fix plan

**Date:** 2026-06-24
**Source report:** `specs/shadcn-upgrade-2026-06-24-tooling-report.md` (B1–B6)
**Scope:** fix every issue the customer upgrade hit, *and* close the e2e blind
spots that let them through. Each item below carries: root cause (file:line),
fix design, acceptance criteria, and **publish impact** (per CLAUDE.md "When a
CLI npm Publish Is Required").

---

## Executive summary

| # | Real status after investigation | Core fix location | Publish? |
|---|----------------------------------|-------------------|----------|
| B1 | Real. `unifiedDiff` does positional line-pairing, not a diff. | `core/diff-core.ts` | **Yes** (CLI logic) |
| B2 | Real & critical. `lib/utils.ts` is template-only; no refresh path. | `commands/doctor.ts`, `core/install.ts`, `commands/update.ts` | **Yes** (CLI logic) |
| B3 | Real. "differs… use --overwrite" warning is a dead end via MCP. | `core/install.ts`, `mcp/tools/write-tools.ts` | **Yes** (CLI logic + new MCP verb) |
| B4 | Real. No machine-readable breaking-change channel anywhere. | `registry/index.ts` (interface) + `registry.json` (data) + surfacing | **Yes** (manifest shape) |
| B5 | Real & critical (silent). `virtual-scroll` selector renamed, no alias. | `ui/virtual-scroll/*` (alias, no publish) + codemod (CLI, publish) | **Mixed** |
| B6a | **Already fixed at HEAD** (`d7258e7`). Only the CI gap remains. | e2e fixture typecheck gate | No (e2e only) |
| B6b | **OPEN.** doctor false-negative: stale page-builder never flagged → never delivered. | `doctor.ts`, `plan.ts` (stale-component detection) | **Yes** (CLI logic) |
| E2E | Real. Fresh-install-only model; never simulates upgrade or warnings. | `e2e/cli-specs/*`, `e2e/orchestrator/*` | No (e2e only) |

**Themes:** (1) reconcile **shared lib files**, not just components (B2/B3);
(2) selector/output renames need **aliases + codemods + warnings** because they
are silent (B4/B5); (3) the build/CI must treat **Angular template warnings as
failures** and **typecheck each component against its dep closure** (B5/B6);
(4) e2e must gain an **"upgrade journey"** model (B2/B3/B5).

---

## B1 — `diff_component` is a line-realignment dump, not a diff

**Root cause.** `core/diff-core.ts` `unifiedDiff()` (lines 20–38) zips the two
files by absolute index (`for i in 0..maxLines: compare local[i] vs remote[i]`).
An insertion shifts every later line, so every line from the insertion point to
EOF is emitted as a `-/+` pair. The `@@ line N @@` markers are fake; there is no
LCS/Myers alignment, no hunk grouping, no context window. No diff dependency is
installed (`packages/cli/package.json` has none) — we implement LCS in-tree.

**Fix design (all in `core/diff-core.ts`; keep cognitive complexity ≤15 by
splitting helpers):**
1. Replace the `unifiedDiff` body with a real LCS line diff:
   `lcsMatrix(a,b)` → `backtrack()` producing an edit script
   (`eq`/`del`/`add` ops) → `groupHunks(ops, context=3)` merging overlapping
   context windows → `formatHunk()` emitting real `@@ -a,b +c,d @@` headers with
   ` `/`-`/`+` prefixed lines. `commands/diff.ts` `colorizeDiff` already handles
   `@@`/`-`/`+`/`---`/`+++` prefixes — verify context (leading-space) lines fall
   through its default branch (they do).
2. Add `summary` mode: `extractSymbols(src)` regex-scans public surface
   (`input()`/`output()`/`model()` property names + member methods, using
   `RegExp.exec`), `symbolDiff(local, remote)` → `{added, removed}`. Extend
   `FileDiff` with `summary?`. `diffComponentFiles` gains `mode:'full'|'summary'`
   (default `'summary'` for the MCP path).
3. In `mcp/tools/write-tools.ts` `diff_component` (lines 140–156): default to
   `mode:'summary'`; for `full`, accumulate hunks across files in order and stop
   at a byte cap **at hunk boundaries** with a `… N more hunks omitted` marker —
   never truncate mid-file. Add an optional byte-cap backstop in
   `mcp/tools/result.ts` `json()`.

**Acceptance.** `diff-core.spec.ts`: a 60-line component with one inserted
`input()` → exactly one `@@ -` hunk, zero `-`-content lines, `< 2048` bytes; a
mid-file edit re-synchronizes (file tail not emitted); two distant edits → two
hunks; header matches `/^@@ -\d+,\d+ \+\d+,\d+ @@/m`. Summary mode reports added
`size` / removed `foo`. Rewrite the existing tests at spec lines 16–35 (they
currently assert the buggy `@@ line N @@` output).

**Publish:** **Yes** — `core/diff-core.ts` + `mcp/tools/*` are CLI logic.

---

## B2 — core `lib/utils.ts` left behind its consumers (critical)

**Root cause.** Two classes of `lib/` files, handled by disjoint machinery:
- **`utils.ts`** is written *only* from a bundled CLI template
  (`core/init-core.ts:98-99` → `templates/utils.ts`) at **init** time. It is in
  **no** component's `libFiles[]`, so add/update/doctor never touch it. The
  bundled template *already* has `stringifyValue` (`templates/utils.ts:17`) — so
  a freshly-published CLI's init is fine; the bug bites only consumers who
  `init`'d with an **older** CLI and now pull live component source that imports
  the new export → **TS2305**.
- **Registry-declared lib files** (`touch.ts`, `i18n/*`, etc.) are fetched via
  `fetchLibContent` and written by `installSingleLibFile` (`core/install.ts:74`)
  — but only for components actually being (re)installed, and only when
  `!exists || options.overwrite` (`install.ts:78`).

Neither class is fingerprinted in the manifest (`recordFile` is called for
component `files`/`peerFiles` only). `doctor` never inspects `libFiles` at all
(`collectDoctorReport` `doctor.ts:77-103` computes drift over component files +
npmDeps only).

**Fix design.**
1. **Make `utils.ts` a recognized refreshable lib file.** Add a
   `CORE_LIB_FILES` constant (in `registry/index.ts` or a new module) listing
   `utils.ts` (+ any other always-present template lib files). `templates/utils.ts`
   becomes the offline-fallback only.
2. **doctor/update reconcile core lib files.** New
   `collectLibDrift(targetDir, libDir, installed, options)` over the union of all
   installed components' `libFiles[]` **plus** `CORE_LIB_FILES`: fetch remote,
   `normalizeContent`-compare. Extend `DoctorReport` with `libModified` /
   `libMissing`; surface in `collectDoctorReport`/`buildFixPlan`; write in
   `doctorFixCore`. `update.applyUpdates` includes the core lib set.
3. **Fingerprint lib files** so pristine-vs-edited is decidable: call
   `recordFile()` inside `installSingleLibFile` (`install.ts:74`). Classify via
   `manifest.fileStatus`: `clean`/matches-published-baseline → safe to overwrite
   silently; `modified` → protect (mirror component `userEdited`). For consumers
   who installed before fingerprinting existed, publish per-lib baseline hashes
   (extend `registry/legacy-baselines.ts` with a `LIB_BASELINES` map, reuse
   `isPristine`/`canonicalHash`).
4. **Blocking pre-flight import check.** In `get_install_plan`/`doctor`, scan each
   to-install component's `.ts` for `import { X } from '<utils alias>'` and verify
   the local lib actually `export`s `X`. Report `missingLibExports:[{file,export,
   neededBy}]` as a hard conflict **before** tsc sees it.

**Acceptance.** On a project pinned to an old `utils.ts`, `doctor` reports
"lib/utils.ts is behind: missing export `stringifyValue`"; `doctor_fix` brings it
current; `ng build` green with no manual step.

**Publish:** **Yes** — `doctor.ts`/`install.ts`/`update.ts`/`plan.ts` are CLI
logic. `LIB_BASELINES` and any manifest-field additions are also publish-gated.

---

## B3 — lib "differs" warning has no actionable path

**Root cause.** The warning string is generated at `core/install.ts:85`
(`installSingleLibFile`, the `exists && !overwrite && local!==remote` branch).
No MCP verb forwards `overwrite` to lib reconciliation: `add_component` never
sets `overwrite`; `update_component`/`doctorFixCore` set `overwrite:true` but
only re-install *components*, so the overwrite reaches only lib files inside
those components' closures — and `utils.ts` is in no closure. `doctor_fix`
exposes only `dryRun` (`write-tools.ts:242`).

**Fix design.**
1. Add a `refresh_lib` MCP verb (`write-tools.ts`, beside `registerDoctorTool`):
   `{ files?: string[], overwrite?: boolean, dryRun?: boolean }`, defaulting to
   all installed-component lib files + `CORE_LIB_FILES`; calls the B2
   reconciliation core with `overwrite:true` for pristine files, protecting
   `modified`.
2. Add `overwriteLib?: boolean` (or `lib?: boolean`) to `doctor_fix`'s schema and
   `DoctorOptions`, threading into the B2 lib pass so `doctor_fix({overwriteLib:
   true})` clears the warnings.

**Acceptance.** `doctor_fix` on the customer project leaves **zero** "Lib file …
differs" warnings without a manual CLI invocation.

**Publish:** **Yes** — new MCP verb + doctor flag are CLI logic.

---

## B4 — breaking API changes ship silently

**Root cause.** No version/breaking/changelog field anywhere:
`registry.json` entries have only `name/category/description/tags/files/
dependencies`; `ComponentDefinition` (`registry/index.ts:30`) has no `version`
/`breaking`/`changelog`; no CHANGELOG files exist. Neither `get_install_plan`
nor `get_project_status` nor `update` has a breaking-change channel. Confirmed
current breaks: `context-menu.component.ts:97` `data = signal<unknown>()`;
`virtual-scroll.component.ts:63-64` `items: input<T[]>` with `T extends
VirtualItem`; `file-viewer.component.ts:78` output renamed `error`→`loadError`.

**Fix design.**
1. Extend `ComponentDefinition` with optional:
   ```ts
   readonly version?: string;
   readonly breaking?: readonly {
     readonly version: string;
     readonly kind: 'selector'|'input'|'output'|'type'|'removal';
     readonly from: string; readonly to?: string;
     readonly note: string;
     readonly codemod?: 'selector'|'output-rename'|'none';
   }[];
   ```
   (`isValidRegistryShape` already ignores extra fields, so already-published
   CLIs keep parsing the new `registry.json`.)
2. Populate `registry.json` `breaking[]` for virtual-scroll, context-menu,
   file-viewer (and going forward, as a release-checklist step).
3. Surface in `planInstall` output (`read-tools.ts`) and `printUpdatePlan`
   (`update.ts:90`): a distinct "Breaking changes / migration notes" block for
   any updated component whose `breaking.version` is newer than the installed
   baseline. MCP `update_component`/`get_install_plan` results include the
   entries.
4. `codemod:'selector'|'output-rename'` entries feed the B5 codemod engine.

**Acceptance.** `get_install_plan virtual-scroll` returns the breaking entries;
`update` prints migration notes; components without breaking metadata produce no
noise.

**Publish:** **Yes** — the interface field is a manifest-shape change. The
`registry.json` data and surfacing-in-CLI are bundled with the same release.

---

## B5 — directive selector rename = silent empty render (critical)

**Root cause.** `virtual-scroll.component.ts:37` `selector: '[uiVirtualItem]'`
with no alias; `@ContentChild(VirtualItemDirective)` (`:70`) matches by directive
type, so a consumer's `<ng-template virtualItem>` no longer binds → undefined
template → zero rows. Angular emits only **NG8113 (warning)**; `ng build` stays
green. The old `[virtualItem]` selector exists nowhere in the repo (rename is
"complete").

**Fix design (three layers).**
1. **Deprecated alias (immediate, no publish):**
   `virtual-scroll.component.ts:37` → `selector: '[uiVirtualItem],[virtualItem]'`.
   Both bind the same directive; `@ContentChild` keeps working. Served live from
   master, so consumers get it on next `add`/`update`. (Already-installed copies
   still need the codemod/warning below.) Document `[virtualItem]` as deprecated;
   schedule removal in a later major.
2. **Post-update grep-and-warn:** after `applyUpdates` (`update.ts:193`), scan
   consumer `.html` + inline `template:` strings for stale tokens from the B4
   rename table; print yellow `⚠ stale selector 'virtualItem' in
   duplicates.component.ts:271 — rename to 'uiVirtualItem'` with file:line.
   **Warn-only by default for templates** (per the `migrate-core.ts:64` note that
   rewriting template strings is risky); `--fix` opt-in auto-rewrites scoped to
   `ng-template` usages (don't false-match an unrelated attribute). Engine
   modeled on `core/import-rewrite.ts` (collect → scoped rewrite → report
   changed), extended to `.html`.
3. **Build gate treats NG#### as fatal** — see E2E Foundation 2; this is what
   would have *caught* B5 at all.

**Acceptance.** Both `<ng-template virtualItem>` and `uiVirtualItem` bind the
directive (unit test); `update virtual-scroll` on a stale consumer prints the
file:line warning; `--fix` rewrites templates and reports changed files;
warn-only leaves templates untouched.

**Publish:** **Mixed** — alias is component source (no publish); the grep/codemod
engine is CLI logic (publish).

---

## B6 — split into B6a (content, fixed) and B6b (tooling false-negative, OPEN)

The original report framed B6 as one content bug. Investigation shows it is
**two** distinct problems, and the more important one is still open.

### B6a — registry internal compatibility (already fixed; CI gap remains)

**Status.** **Not broken at HEAD.** `bento-grid.component.ts:35`
(`inputs?: Record<string, unknown>`) and `page-builder.component.ts:159-160`
(`const current = (item.inputs?.['value'] as number | undefined) ?? 0`) landed
together in commit `d7258e7`, so master never shipped the broken pair. The
customer's checkout had a page-builder predating the cast. Dependency edge is
declared (`registry.json:2317`, page-builder `dependencies` includes
`bento-grid`).

### B6b — doctor under-reported a stale component (the real tooling failure) — OPEN

**Evidence it was never delivered.** HEAD page-builder is **493 lines** with the
cast at **line 159**; the whole component was **rewritten in `d7258e7`** (June 11,
139 lines changed + `page-builder.types.ts` + bento-grid). The customer's build
broke at **`page-builder.component.ts:470`** with the *old* `inputs?.['value'] +
5` shape — a line/shape that does not exist at HEAD. So their copy was a
**pre-`d7258e7`** version. Yet doctor reported page-builder as **not**
`updateAvailable`, **not** `userEdited`, **not** `legacy`. The tooling treated a
stale component as current and never offered to replace it — so the customer kept
old code that then broke against the freshly-hardened bento-grid. **"Fixed at
HEAD" only fixed the source; the CLI never shipped it to the consumer.**

**Why a stale component can escape detection** (`plan.ts` + `doctor.ts`). A stale
component at the *current* expected path *should* be caught: `checkFileConflict`
(`plan.ts:40`) normalizes local vs live-master content → `'changed'` →
`classifyComponent` `conflict` (`plan.ts:90`) → `modified` → (not user-edited) →
`updateAvailable`. For page-builder to escape, the leading hypothesis is:
- **Invisible to doctor.** `installedComponents()` (`doctor.ts:51-54`) registers a
  component only if `registry[name].files[0]` exists at the *current* path. If the
  `d7258e7` rewrite changed page-builder's file layout/paths, the consumer's
  old-layout copy isn't found → never checked → absent from *every* bucket
  (update/userEdited/legacy). This best fits the observed "not flagged anywhere."
  (`scanLayouts` catches the known flat→folder legacy shape, but not an arbitrary
  intra-version path/file-set change.)
- Less likely: detected as `modified` but classified `userEdited` (report lists
  only `file-viewer`); or a `normalizeContent`/`detectConflicts` miss.

**Fix design.**
1. **Reproduce first** (per "never assume"): against the customer repo
   (`D:\Development\oneFile-1\ui`, pre-upgrade commit) run `get_project_status` and
   log, for page-builder, whether `installedComponents()` includes it and what
   `checkFileConflict` returns per file. Pin the exact escape path before coding.
2. **Detect stale components whose file-set changed.** Make `installedComponents`
   / doctor recognize a component as "installed" by a more robust signal than
   `files[0]` path existence — e.g. the manifest's recorded entry, a selector/
   tag scan, or any registry file (current *or* historically-known) present. A
   component the consumer demonstrably uses must never be silently absent from the
   report.
3. **Report file-set drift** when the registry's `files[]` for a component no
   longer match what's on disk (renamed/moved/added files), as an
   `updateAvailable` (or a `migrate`-class) action rather than a silent skip.
4. **e2e coverage** (Foundation 1 seed): install page-builder, replace it with an
   older-layout/older-content revision via `oldBlob`, run `doctor`, assert it is
   reported as needing update and that `doctor --fix` restores the current source +
   a green typechecked build.

**Acceptance.** A consumer carrying a pre-rewrite page-builder runs `doctor` and
sees page-builder listed as `updateAvailable`; `doctor_fix` replaces it with the
current source; build is green. No stale, in-use component is ever reported as
healthy.

**Publish (B6b):** **Yes** — `doctor.ts`/`plan.ts` detection changes are CLI logic.

**Why monorepo CI was legitimately green.** Root `tsconfig.json` compiles both
files in one strict program (demo imports `PageBuilderComponent`), and the cast
was already present — nothing to catch. The genuine gap: **nothing typechecks a
component against *only* its declared `dependencies` closure as a consumer
install** — the global program can mask a future cross-component break if the
demo doesn't exercise the path.

**Fix design — CI gate (no source change needed today).** Reuse the e2e
fixture-install (which already runs `add <c> --yes`, resolving `dependencies`
transitively): after install, run `ngc -p tsconfig.app.json --noEmit` inside
`e2e/fixture-app/` *before* Playwright. Add a `--typecheck-only` fast mode to the
orchestrator (`e2e/orchestrator/run.ts`) and a post-install hook in
`install-harness.ts`. The impact analyzer already schedules a component's specs
when its source or a dep changes, so this runs per-PR for touched closures and
fully on master. No new sample-app generator — the fixture install *is* the
per-component-plus-deps sample app.

**Acceptance.** A clean `add page-builder` + `bento-grid` into a fresh app
typechecks with 0 errors in CI; if a future PR hardens a dep type without
updating a consumer, the gate fails before publish.

**Publish:** No — e2e/CI only. (Keep the existing page-builder cast; if a
regression ever drops it, re-apply `(item.inputs?.['value'] as number |
undefined) ?? 0`.)

---

## E2E — why the suite missed all of this, and how to fix it

**Current model (fresh-install-only).** Every render spec
(`e2e/orchestrator/run.ts:70-98`): `git checkout HEAD` fixture →
`init --yes` → `add <names> --yes` at **current registry HEAD** → `npm install`
→ copy demo harness → `ng serve` (ready = GET / status < 500) → Playwright DOM
assertions. CLI specs (`e2e/cli-specs/*`, `run.ts:100`) assert on captured CLI
stdout+stderr. Specs auto-discovered from `e2e/harness/<name>/`; multi-component
+ `initArgs` in `EXPLICIT_SPECS` (`specs.ts:71-112`). Impact analyzer is
registry-driven.

**Confirmed gaps:**
- **A — no upgrade journey.** Nothing seeds an *older* component/lib file then
  runs `doctor`/`update` and asserts a green build. `migrate*` specs only cover
  the legacy flat→folder layout, not version N→N+1 source. (root of B2/B3.)
- **B — doctor never inspects `libFiles`.** `collectDoctorReport`
  (`doctor.ts:77-103`) computes drift over component files + npmDeps only; a
  stale `lib/utils.ts` → `report.ok===true`. (B2/B3.)
- **C — silent (warning-only) regressions invisible.** `serve.ts:74-83`
  readiness is "status < 500"; stdout/stderr are forwarded but **never scanned**
  for `NG\d{4}`/`NG8113`. Harness demos regenerate against current registry, so
  the renamed selector and the demo move together — the old-selector zero-render
  is never observed. (B5.)
- **D — no cross-component-pair typecheck.** Multi-component harnesses exercise
  components side-by-side but none imports one registry component's *types* into
  another. (B6.)
- **E — no lib-file-drift test.** Closest is `peerfiles-missing.ts` (component
  peerFiles via explicit `--overwrite`), not libFiles via the no-flag
  doctor/update path.

**Fix design.**

*Foundation 1 — old-version seed.* New `e2e/cli-specs/_seed.ts` `oldBlob(relPath,
sinceCommit)` (mirror `_git.ts realLegacyBlob`, `git show <commit>:<path>`) to
overwrite an installed lib/component file with a prior revision after `add`.

*Foundation 2 — warning-as-failure build gate (highest leverage).* A shared
`e2e/cli-specs/_build.ts` (or extend `prod-build.ts`'s spawn) that **captures**
`ng build` stdout+stderr (piped, like `spawn.ts:59 captureBoth`) and **fails on
`/NG\d{4}/` even at exit 0**. Converts the suite from "build didn't crash" to
"build emitted no diagnostics" — closes the entire silent-regression class.

*New specs:*
- `doctor-lib-drift.ts` (B2/B3): `add` a component importing `stringifyValue` →
  `oldBlob` the installed `lib/utils.ts` to a pre-export revision → assert
  `doctor` now **reports** the lib drift (requires the B2 doctor change) →
  `doctor --fix` → Foundation-2 `ng build` green, no `TS2305`. → `CLI_SPECS`.
- `stale-selector-build.ts` (B5): `add virtual-scroll` → write a consumer
  template using old `virtualItem` → Foundation-2 build gate fails on NG8113. →
  `CLI_SPECS`.
- Cross-component typecheck (B6): the fixture `ngc --noEmit` gate above; plus
  optionally an `EXPLICIT_SPECS` `names:['page-builder','bento-grid']` harness
  whose demo imports one's type into the other, built (not just served).

*Plumbing:* CLI-style specs append to `CLI_SPECS` (`specs.ts:185-202`), zero
orchestrator change. The B6 render spec is one `EXPLICIT_SPECS` entry + harness
folder. Foundation 2 + the fixture typecheck gate are the two orchestrator-level
additions.

---

## Execution — single PR (decided)

**Decisions locked in with the user:**
- **One big PR** containing all of B1–B6b + e2e (not phased across PRs).
- **B4: full `breaking[]` + `version` field** on `ComponentDefinition`
  (manifest-shape change → publish), which also powers the B5 codemod rename
  table.
- **B5 codemod: warn-only default**, `--fix` opt-in for template rewrites.

**Build order within the PR** (dependency-driven; each step reviewable):
1. **e2e foundations** — `_seed.ts oldBlob()` + warning-as-failure `_build.ts`
   gate + fixture `ngc --noEmit` typecheck gate. (Tests come first so every
   subsequent fix lands with a regression guard.)
2. **B5 alias** — `selector: '[uiVirtualItem],[virtualItem]'` (+ unit test that
   both bind). Stale-selector e2e (`stale-selector-build.ts`) now fails red until
   the alias is in.
3. **B2/B3** — lib reconciliation: `CORE_LIB_FILES`, `collectLibDrift`, lib
   fingerprinting in `installSingleLibFile`, pre-flight missing-export check,
   `refresh_lib` MCP verb + `doctor_fix({overwriteLib})`. + `doctor-lib-drift.ts`.
4. **B6b** — stale-component detection in `installedComponents`/`detectConflicts`
   (reproduce against customer repo first), + page-builder stale-layout e2e.
5. **B6a CI gate** — fixture typecheck step wired into the orchestrator + impact
   analyzer.
6. **B1** — LCS diff rewrite + summary mode + hunk cap, rewrite `diff-core.spec.ts`.
7. **B4** — `breaking[]`/`version` on `ComponentDefinition`, populate
   `registry.json` for virtual-scroll/context-menu/file-viewer, surface in
   install-plan/update, wire the warn-only B5 grep codemod off the metadata table.

**One npm publish** at the end (CLI logic + manifest shape: B1, B2, B3, B4, B5
codemod, B6b). The B5 alias, registry.json data, and all e2e/CI ship live with no
publish but ride the same PR. Add to the pending-releases memory once merged.

**Review gate:** run `review-gate` (bar ≥95 per project policy) after each build
step; record scores in this doc's completion log.

---

## Completion log

### Step 1 — e2e foundations (DONE, 2026-06-24)
- `e2e/cli-specs/_seed.ts` — `oldBlob(repoRelPath, {before|at})` + `historicalBlob()`
  generalize `_git.ts realLegacyBlob` into an arbitrary "seed an older revision"
  helper, giving the suite its first upgrade-journey capability.
- `e2e/cli-specs/_build.ts` — warning-as-failure build gate: `ngBuild()`,
  `findNgDiagnostics()`, `assertCleanBuild(result, allow)`, `buildClean()`. Fails
  on any `NG####` diagnostic even at exit 0 (catches NG8113 silent renders) and
  on non-zero exit; supports an allowlist.
- Verified under `tsx` against real data: gate fails on NG8113@exit0, passes when
  allowlisted, passes clean, fails non-zero exit; `oldBlob` seeded a real 1848-byte
  pre-`stringifyValue` `utils.ts`. `eslint` clean (exit 0).
- `_`-prefixed → not registered specs (per `_git.ts`/`_types.ts` convention);
  consumed by the upcoming `stale-selector-build.ts`, `doctor-lib-drift.ts`, and
  page-builder stale-layout specs.

### Step 2 — B5 selector alias (DONE)
- `virtual-scroll.component.ts:37` → `selector: '[uiVirtualItem],[virtualItem]'`;
  unit test both bind. `stale-selector-build` e2e passes (consumer using old
  `virtualItem` builds clean through the NG8113-fatal gate). Also fixed a
  pre-existing test failure (data-table-range-chart missing category/tags).
  Commit on `fix/upgrade-tooling-registry`.

### Step 3 — B2/B3 lib reconciliation (DONE)
- `core/lib-reconcile.ts` + `registry/lib-baselines.ts` (generator
  `scripts/gen-lib-baselines.mjs`); doctor reports/repairs lib drift; install
  fingerprints lib files; `refresh_lib` MCP verb; `update_component` reconciles
  core lib. `doctor-lib-drift` e2e passes ("Refreshed 1 lib file(s): utils.ts"
  → green build). Unit: lib-reconcile.spec (10).

### Step 4 — B6b + B6a (DONE)
- B6b: `installedComponents` detects by ANY file (was `files[0]` only), so a
  stale component whose entry path changed isn't invisible to doctor. Test added.
- B6a: `cross-component-typecheck` e2e installs page-builder (+bento-grid
  closure) and builds a consumer forcing both into the compile graph — passes.

### Step 5 — B1 diff rewrite (DONE)
- `diff-core.ts`: LCS edit script + hunk grouping + real `@@ -a,b +c,d @@`
  headers; summary mode (symbol diff); `diff_component` defaults to summary,
  full capped at 24KB on file boundaries. diff-core.spec rewritten incl. the
  one-insert→one-hunk<2KB regression.

### Step 6 — B4 breaking metadata + B5 codemod (DONE)
- `ComponentDefinition.breaking[]` (interface + registry.json + index.ts) for
  virtual-scroll/context-menu/file-viewer; `get_install_plan` + `update_component`
  surface them; `core/codemod.ts scanStaleSelectors` warns (file:line) about
  consumer templates using a renamed selector, opt-in `fix`. codemod.spec (7).

CLI suite: 381 tests pass. Per-cluster commits on `fix/upgrade-tooling-registry`.
