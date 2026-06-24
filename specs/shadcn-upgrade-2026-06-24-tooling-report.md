# `@gilav21/shadcn-angular` upgrade — tooling & registry bug report (oneFile `ui/`)

**Date:** 2026-06-24
**Surface:** the shadcn-angular **MCP server** (`mcp__shadcn-angular__*`) + the
registry content it installs. Driven against `D:\Development\oneFile-1\ui`.
**Outcome:** the upgrade succeeded, but **only after 4 manual fixes** that the
tooling should have handled or surfaced. One of the four was a *silent runtime
regression* (no build error) that nearly shipped. The end state builds clean
(`ng build`, 0 errors, review-gate 96/100), but a fresh `update` on another
project would hit the same wall.

This document is a **handoff for an agent fixing the registry / MCP / CLI repo**
(`gilav21/shadcn-angular`, dev checkout at `D:\Development\shadcd\shadcn-angular`).
Each issue ends with concrete **action items + acceptance criteria**.

---

## TL;DR — what's broken in the tooling

| # | Issue | Class | Severity | Build-breaking? |
|---|-------|-------|----------|-----------------|
| B1 | `diff_component` emits a line-by-line re-aligned dump (190 KB) instead of a hunk diff; unusable past the token cap | MCP tool | High | no (blocks review, not build) |
| B2 | Core lib `utils.ts` is never refreshed, but upgraded components import a new export (`stringifyValue`) from it | Registry/CLI | **Critical** | **yes** (TS2305) |
| B3 | 6 shared lib files reported "differs… use `--overwrite`", but no MCP/`doctor` path exposes that overwrite | MCP tool | Medium | no (stale, latent) |
| B4 | Breaking public-API changes ship with no changelog / migration note / codemod | Process | High | yes (TS2345/TS2322) |
| B5 | A **directive *selector* rename** (`virtualItem`→`uiVirtualItem`) produces only an NG8113 *warning* → silent empty render | Registry/Process | **Critical** | **no — worse: silent** |
| B6 | Registry ships an internally-incompatible component pair: latest `page-builder` does not typecheck against latest `bento-grid` | Registry content | High | yes (TS2365) |

What the tooling did **well** (keep these): `file-viewer` was correctly
*protected* during `doctor_fix` (user edits never clobbered); `update_component`
cleanly force-overwrote a component's own closure (the `parsers/*.ts` deps of
`file-viewer`); component-version diagnosis (`updateAvailable`) was accurate.

---

## What the tooling did (command sequence)

```
get_project_status        → healthy:false, 31 updateAvailable, userEdited:[file-viewer]
doctor_fix(dryRun:true)   → plan: reinstall 31, protected:[file-viewer]
doctor_fix()              → re-installed 32 components; PROTECTED file-viewer;
                            ⚠ WARNED on 6 lib files "differs from remote (use --overwrite)";
                            did NOT touch utils.ts at all
update_component([file-viewer])         → overwrote file-viewer + its parser lib deps cleanly
update_component([select,data-table,…]) → overwrote component files; did NOT refresh core utils.ts
diff_component([file-viewer])           → 190,195-char line-aligned dump, exceeded token cap
get_component_source(select)            → returns component files only; NOT the shared lib it imports
ng build                                → 9 errors (see below) → fixed by hand → 0 errors
```

---

## Bugs in detail

### B1 — `diff_component` is a line-realignment dump, not a diff
**Symptom.** `diff_component(["file-viewer"])` returned **190,195 chars across 24
lines** and exceeded the tool token cap, twice. Inspecting it: it is not a
hunk-based unified diff. A single inserted block (our ~16-line tweak) caused
**every subsequent line to be reported as changed** via per-line markers like
`@@ line 57 @@\n-<local line>\n+<remote line>`. The `.ts` "diff" was 162 KB for
what is semantically a 3-member insertion.

**Impact.** Impossible to see the real semantic delta of a customized component
from the tool output. I had to fall back to `git diff` against the committed
base to actually understand what to re-apply.

**Action items (MCP `diff_component`):**
1. Emit a real unified diff (hunks with context), not a positional line pairing.
   Use an LCS/Myers diff so an insertion doesn't cascade into a whole-file diff.
2. Add a `summary` mode returning only changed symbol names (added/removed
   `input()`/`output()`/`model()`/methods) so a caller can decide relevance
   without paying for the full body.
3. Cap/paginate output by hunk, not by truncating mid-file.
- **Acceptance:** for a component with one inserted `input()`, `diff_component`
  returns < 2 KB showing only that hunk.

### B2 — core `utils.ts` left behind its consumers (build breaker)
**Symptom.** After the upgrade, `ng build` failed:
```
TS2305: Module '"@/components/lib/utils"' has no exported member 'stringifyValue'.
  src/components/ui/data-table/data-table.component.ts:22
  src/components/ui/select/sub/select-value.component.ts:8
```
The upgraded `data-table` and `select` import `stringifyValue` from
`@/components/lib/utils`, but **`utils.ts` was never updated** — `doctor_fix`
didn't flag it (not in its 6 warnings) and `update_component` skipped it (it
force-overwrites a component's *own* files + closure, but treats the shared core
lib as untouchable).

**Root cause (likely).** Shared "core" lib files are installed at `init` and are
neither tracked per-component nor refreshed by `update`. When the registry adds a
new export consumed by components, existing projects never receive it.

**Manual fix I made.** Fetched the canonical file from
`raw.githubusercontent.com/gilav21/shadcn-angular/master/packages/components/lib/utils.ts`
and added the `stringifyValue` helper verbatim.

**Action items (CLI/registry):**
1. Make `update` / `doctor` reconcile **core lib files** too, not just component
   files — diff each against the registry and offer to update (additive merges
   like a new export should be safe to apply, or at least warned).
2. Declare lib files as versioned registry artifacts with their own
   fingerprints so drift is *detectable* (see B3).
3. When a component's `registryDependencies`/imports reference a lib export that
   the local lib lacks, `get_install_plan` / `doctor` must report it as a
   blocking conflict — not let it surface as a downstream `tsc` error.
- **Acceptance:** on a project pinned to an older `utils.ts`, `doctor` reports
  "lib/utils.ts is behind: missing export `stringifyValue`" and `doctor_fix`
  (or `--overwrite`) brings it current; `ng build` is green with no manual step.

### B3 — 6 lib files warned but no tool path to fix them
**Symptom.** `doctor_fix` printed:
```
Warning: Lib file i18n/common.locales.ts differs from remote (use --overwrite to update)
Warning: Lib file i18n/i18n.utils.ts differs from remote (use --overwrite to update)
Warning: Lib file touch.ts differs from remote (use --overwrite to update)
Warning: Lib file code-scopes.ts differs from remote (use --overwrite to update)
Warning: Lib file parsers/xlsx.ts differs from remote (use --overwrite to update)
Warning: Lib file input-group.token.ts differs from remote (use --overwrite to update)
```
But the MCP `doctor_fix` exposes **no `--overwrite`/`dryRun:false`+force option**,
and `update_component` only refreshes a *component's* closure. There is **no MCP
verb** that does what the warning tells the user to do. (I confirmed none of the
6 are oneFile-edited — all were added wholesale by past installs — so they are
simply stale registry copies. They don't break the build *today*, but they will
the next time a component starts importing from them, exactly as `utils.ts` did
in B2.)

**Action items (MCP):**
1. Add an `overwrite_lib`/`refresh_lib` capability (or a `lib: true` flag on
   `doctor_fix`) so the warning is actionable through the MCP, not just the raw
   CLI.
2. Have `doctor_fix` apply safe lib updates by default when the local copy has
   no user edits (fingerprint match against any *published* prior version ⇒ safe
   to overwrite), mirroring how component protection already distinguishes
   user-edited from pristine.
- **Acceptance:** `doctor_fix` on this project leaves **zero** "Lib file …
  differs" warnings without a manual CLI invocation.

### B4 — breaking API changes ship silently (no changelog / codemod)
**Symptom.** Three public-API breaks surfaced only at `ng build`:
- `context-menu`: `data` is now `signal<unknown>` (was loosely typed) →
  `TS2345 … 'unknown' not assignable to 'StoredSuggestion'` ×5
  (`suggestions.component.ts:166-180`).
- `virtual-scroll`: `items` input is now `T extends VirtualItem` →
  `TS2322: Type 'Group[]' is not assignable to type 'VirtualItem[]'`
  (`duplicates.component.ts`).
- `file-viewer`: `error` output renamed to `loadError` (we happened to not bind
  it, so no break — but a consumer that did would break with no warning).

None of these were surfaced by `get_project_status`, `get_install_plan`, or the
`update` result. There is no per-component changelog and no codemod.

**Action items (process + tooling):**
1. Maintain a machine-readable **CHANGELOG with `BREAKING:` entries** per
   component version, and surface them in `get_install_plan` /
   `update_component` results ("updating context-menu 1.x→2.0 — BREAKING: `data`
   output type is now `unknown`; renamed output `error`→`loadError`").
2. Ship **codemods** (or at least documented find/replace recipes) for renames
   like `error`→`loadError` and `virtualItem`→`uiVirtualItem` (see B5).
3. `diff_component` summary mode (B1.2) should explicitly tag removed/renamed
   public symbols as breaking.
- **Acceptance:** running the upgrade prints a "BREAKING CHANGES" section listing
  these three before any file is written.

### B5 — directive *selector* rename = silent empty render (CRITICAL)
**Symptom.** `virtual-scroll` renamed its item-template directive selector from
`[virtualItem]` to `[uiVirtualItem]` (`virtual-scroll.component.ts:37`). The
component reads the template via `@ContentChild(VirtualItemDirective)`. Our
consumer still had `<ng-template virtualItem>`. Result: the directive **no longer
matches**, `itemTemplateRef` is `undefined`, and the duplicates list renders
**zero rows** — with **no build error**, only:
```
NG8113: VirtualItemDirective is not used within the template of DuplicatesComponent
```
NG8113 is a **warning**. `ng build` reported "0 errors" while the feature was
silently broken. This is the most dangerous class: green build, dead UI. It was
caught only by an independent review pass, not by the build.

**Action items (registry + tooling):**
1. **Avoid renaming directive selectors** across versions; if unavoidable, treat
   it as a top-tier BREAKING entry (B4.1) AND ship a codemod that rewrites
   `<ng-template virtualItem>` → `<ng-template uiVirtualItem>` in consumer
   templates.
2. Consider keeping the old selector as a deprecated alias for one minor version
   (`selector: '[uiVirtualItem],[virtualItem]'`) so the rename is non-breaking.
3. Post-update, the CLI should grep consumer templates for known old selectors
   and warn loudly when found.
- **Acceptance:** after upgrading virtual-scroll, the tool either rewrites the
  consumer template or prints "⚠ stale selector `virtualItem` found in
  duplicates.component.ts:271 — rename to `uiVirtualItem`".

### B6 — registry ships an internally-incompatible component pair (CRITICAL, content bug)
**Symptom.** `bento-grid` hardened `DashboardItem.inputs` from
`Record<string, any>` → `Record<string, unknown>`
(`bento-grid.component.ts:35`). The registry's **own** `page-builder` consumes
`DashboardItem` and does `item.inputs?.['value'] + 5`
(`page-builder.component.ts:470`), which no longer typechecks against `unknown`:
```
TS2365: Operator '+' cannot be applied to types '{}' and 'number'.
```
`page-builder` was **not** in `updateAvailable`, i.e. our copy *is* the latest
registry version — so **the registry's latest `page-builder` does not compile
against its latest `bento-grid`.** This is a registry QA gap: paired components
are not built together in CI.

**Manual fix I made (in `page-builder`, marking it a local edit):** coerced the
value — `const raw = item.inputs?.['value']; const current = typeof raw ===
'number' ? raw : 0;` with a `TODO` referencing this bug.

**Action items (registry content + CI):**
1. Fix `page-builder.component.ts` upstream to handle `unknown` inputs (apply the
   same coercion, or type the progress value at the call site). Then this project
   can drop its local `page-builder` edit and let `update` reclaim it.
2. Add a CI gate that **type-checks every component against its
   `registryDependencies` together** (a sample app importing all components), so
   a cross-component type break can't be published.
- **Acceptance:** a clean install of `page-builder` + `bento-grid` from the
  registry into a fresh Angular app builds with 0 errors.

---

## Manual fixes required beyond re-applying our own customization

For the record, separating *our* feature work (re-applying the file-viewer
re-extract tweak — expected) from fixes **forced by tooling/registry defects**:

| Fix | File(s) | Forced by |
|-----|---------|-----------|
| Added `stringifyValue` export | `ui/src/components/lib/utils.ts` | **B2** |
| `$any(contextMenu.data())` ×5 | `ui/src/app/features/suggestions/suggestions.component.ts` | **B4** |
| `$any()` on `[items]` + rename `<ng-template virtualItem>`→`uiVirtualItem` | `ui/src/app/features/duplicates/duplicates.component.ts` | **B4 + B5** |
| Numeric coercion of `inputs['value']` | `ui/src/components/ui/page-builder/page-builder.component.ts` | **B6** |

The file-viewer re-extract tweak re-application (3 members + toolbar button) is
**not** in this list — that is our own customization, expected to be re-applied
after any component overwrite, and is the one thing the tooling correctly
*protected* and left to us.

---

## Reproduction notes for the fixer agent

- Project: `D:\Development\oneFile-1\ui`; upgrade commits `3b5fa08` (upgrade) and
  `d647c7c` (B5 fix). Pre-upgrade base builds clean — every error above is
  introduced by the registry update, verified by stashing the upgrade and
  rebuilding.
- To see B6/B2 in isolation: `git stash` the upgrade, `npm run build` (clean),
  pop, `npm run build` (the 9 errors).
- Registry dev checkout for fixes: `D:\Development\shadcd\shadcn-angular`
  (components under `packages/components/ui/`, lib under
  `packages/components/lib/`).
- Prior precedent report (now resolved): `specs/shadcn-migrate-0.0.33-bug-report.md`.
