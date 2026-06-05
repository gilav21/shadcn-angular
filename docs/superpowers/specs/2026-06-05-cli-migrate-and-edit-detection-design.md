# CLI: safe `update`, `migrate` command, and edit detection

**Date:** 2026-06-05
**Status:** Approved (design) — pending implementation plan
**Area:** `packages/cli`

## Problem

A consumer on the **legacy single-file layout** (each component is one
self-contained `<name>.component.ts` with inline HTML/CSS) tried to upgrade with
`npx @gilav21/shadcn-angular@latest` and it **broke their app**. Root causes,
all reproduced from source:

1. **`update` blast radius.** `update data-table component-outlet` printed
   "2 component(s) have updates" then "Updated 16 component(s)." `update` calls
   `performInstall` with `options.overwrite = true`; `performInstall` resolves
   the *full dependency closure* (`resolveDependencies`) and, because
   `options.overwrite` is set, `toOverwrite` swallows **every** conflicting
   component in that closure — not just the named two. It also writes brand-new
   directory-form components (`button/`, `input/`, …) alongside the consumer's
   existing flat files.

2. **`--dry-run` under-reports.** `update.ts` diffs only the *named* targets
   (2) while the real run expands to the closure (16). The preview does not
   reflect the real write set, defeating its purpose.

3. **Build-breaking imports.** The new `data-table` imports four context-menu
   directives (`tree-context-menu`, `table-context-menu`,
   `data-table-context-menu`, `context-menu-attach`) the old one didn't.
   Updating `data-table` without those installed leaves
   `context-menu-integrations.ts` importing files that don't exist →
   `ng build` fails.

4. **Layout mismatch.** The registry migrated components from flat files
   (`button.component.ts`, inline template) to the folder/trio layout
   (`button/button.component.ts` + `button/button.component.html` +
   `button/index.ts`). The CLI wrote the new folder files **alongside** the old
   flat files (duplicates) and never rewrote the consumer's imports
   (`@/components/ui/button.component`), leaving an ambiguous, non-building tree.

5. **`doctor` wording ambiguous.** "Modified locally (drift from registry)"
   can't tell "you edited this file" from "the registry moved ahead" — there is
   no recorded baseline, so both look identical.

### Foundational gap

Detection keys off `registry[name].files[0]` in **new-layout** form
(`button/button.component.html`). A legacy consumer's flat
`button.component.ts` fails that existence check, so `doctor` and bare `update`
don't even *see* those components as installed (`data-table` only surfaced
because it happened to already be a folder). **Layout detection** is the
capability every fix depends on.

## Decisions (locked with the user)

- **Layout mismatch** → build a **full old→new migration** (not safe-refuse).
- **Command surface** → a **dedicated `migrate` command**. `update` stays
  scoped to in-layout content refresh and aborts (pointing at `migrate`) when it
  detects a legacy-layout target.
- **Import rewrite** → **project-wide**, guarded by a **clean git working tree**
  (or `--force`), so the whole change is one reviewable/revertible diff.
- **Migration set** → **all installed components, all-at-once**, plus pull any
  **newly-required dependencies** so every import resolves.
- **Edit detection** → introduce an **install manifest (lockfile)** as the
  baseline; warn the user about components they may have customized before
  overwriting.
- **`components.lock.json` is git-committed** (not ignored) — the baseline must
  travel with the project so edit-detection is shared across the team and CI.
- **`customized[]` blocks `migrate`** — if any component has local edits and the
  user did not pass `--yes`, `migrate` stops and lists them, so the user
  consciously confirms before their changes are overwritten.

## Design

### Part A — Correctness fixes to existing commands

These are unambiguous bugs; they ship independent of `migrate`.

**A1. `update` write set is bounded.**
`update X Y` overwrites **only** the named components plus **already-installed
required deps**. It never silently installs brand-new components. When a target's
new version *newly requires* a dependency that is not installed (the
context-menu case), `update`:
- lists the newly-required dep(s),
- requires `--yes`/confirmation to proceed, and
- when confirmed, installs them (so the tree builds).

Mechanism: stop passing `options.overwrite = true` for the whole closure.
`update` computes the closure, partitions it into
`{named, alreadyInstalledDeps, newlyRequiredDeps}`, and passes an explicit
`overwrite` set of `named + alreadyInstalledDeps` to `performInstall`.
`newlyRequiredDeps` are only added with consent.

**A2. `--dry-run` previews the exact write set.**
`--dry-run` runs the same planning path as the real run and prints the
file-level result: `created / modified / skipped / newly-required-deps`. The
preview equals the real run's effect. No closure-vs-named discrepancy.

**A3. `doctor` honesty + layout awareness.**
- Rename the drift section to **"Differs from registry (local edits or newer
  version) — run `diff <name>` to inspect, `update` to apply."** when no manifest
  baseline exists.
- With a manifest present (Part C), split into two precise sections:
  **"Locally modified (your edits)"** and **"Update available."**
- Add a **"Legacy single-file layout — run `migrate`"** section that fires when
  old-layout installs are detected.

### Part B — `migrate` command

**Layout detection (shared utility, also used by A3 and the `update` guard).**
A registry component is *folderized* when its `files[]` are `<name>/…`-prefixed.
For each folderized component:
- `newEntry = <name>/<name>.component.ts`
- `legacyEntry = <name>.component.ts` (de-prefixed, directly under the ui dir)
- **old-layout install** = `exists(uiDir/legacyEntry)` **and**
  `!exists(uiDir/newEntry)`.
- **new-layout install** = `exists(uiDir/newEntry)`.
- **not installed** = neither.

Directives/pipes (flat under `ui/`, unchanged — their `files[]` have no `/`) need
no migration. Already-folder components (e.g. `data-table` in the report) get a
**content refresh** (+ newly-required deps), not a structural move.

**Guards.** `migrate` requires a clean git working tree (or `--force`); supports
`--dry-run` (print the full plan, write nothing) and `--yes` (skip confirmation).

**Plan (all-or-nothing across the installed set):**
1. `structural[]` — old-layout components to convert flat→folder.
2. `refresh[]` — already-folder components whose content is outdated.
3. `newDeps[]` — dependencies newly required by the migrated versions and not
   yet installed.
4. `importRewrites[]` — every project source file importing a migrated
   component's old path.
5. `customized[]` — components whose local content differs from baseline
   (manifest if present, else current library version). If any are present and
   `--yes` was not passed, `migrate` **stops** and lists them — the user must
   re-run with `--yes` to consciously accept overwriting their edits.

**Execute:**
1. Write new folder/trio files for `structural ∪ refresh ∪ newDeps`. Files come
   from `fetchAndTransform`, so their internal imports are already correct
   (folder-prefixed, prefix-aware).
2. Delete old flat files: `<name>.component.ts` and any sibling flat
   `<name>.component.{html,css}` for `structural` components.
3. **Rewrite imports project-wide**: for every migrated `<name>`, rewrite any
   import specifier ending `…/<name>.component` → `…/<name>` (the folder
   barrel). Covers alias forms (`@/components/ui/<name>.component`) and relative
   forms (`./<name>.component`, `../**/<name>.component`). Pure, well-tested
   string transform; only touches specifiers that resolve to a migrated
   component (no broad regex over unrelated text).
4. Install newly-required npm deps + lib files.
5. Update the manifest (Part C) for every written file.
6. Print a summary: files written / deleted, imports rewritten (file count),
   deps added, `customized[]` warnings, and **`ng build`** as the verify step.

**`update` ↔ `migrate` handoff.** When `update` detects an old-layout target it
aborts: *"this project uses the legacy single-file layout — run `migrate`
first."*

### Part C — Edit detection (install manifest)

**C1. Manifest / lockfile.** A sidecar **`components.lock.json`** next to
`components.json` records, per installed file, the **sha256 of exactly what the
CLI wrote**:

```jsonc
{
  "version": 1,
  "files": {
    "button/button.component.ts": { "sha256": "…", "component": "button" },
    "button/button.component.html": { "sha256": "…", "component": "button" }
  }
}
```

`components.lock.json` is **committed to git** (alongside `components.json`) so
the baseline is shared across the team and CI. Every write path updates it —
`add`, `update`, `migrate`. Two independent comparison axes:

| Compare | Verdict |
|---|---|
| local file vs **manifest hash** | **You edited it** (drift from what was installed) |
| manifest hash vs **current registry** | **A newer version exists** (safe to update) |

`doctor` uses both to separate "Locally modified (your edits)" from "Update
available." `update`/`migrate` warn before overwriting any file whose local hash
≠ manifest hash.

**C2. Legacy consumers (no manifest).** Pre-existing installs have no baseline,
so "user-edited" vs "old registry version" can't be proven. `migrate` gives the
best available info:
- the clean-git guard makes the whole before/after one revertible `git diff`;
- per component, compare local content vs current library version and **flag the
  differing ones** as likely-customized;
- after a successful migrate, **write the manifest**, so detection is exact from
  then on.

**C3. Report.** `migrate` and `update` end with a
**"Customized components — re-apply your edits if needed: …"** list (manifest-
exact, or heuristic for legacy) plus the `git diff` pointer.

## Out of scope

- Rewriting imports of symbols that were *not* part of a component's public
  barrel export (rare internal-only imports) — these are reported, not rewritten.
- Migrating non-component assets the consumer added by hand under `ui/`.
- Any change to how components are authored in this repo (this is consumer-side
  tooling only).

## Testing strategy

Tooling: Vitest for unit/integration (matches existing `*.spec.ts` under
`packages/cli/src`); the `e2e/cli-specs/` harness (`runCli`/`captureCli`) for
black-box CLI behavior on a real temp project; the Playwright e2e harness only
where a true consumer install/compile is needed.

### Part A — `update` / `doctor` / `--dry-run`

- **`update` regression (cli-spec)** — the gate that proves bugs 1+2:
  - `add data-table` → `update data-table` touches **only** the named component
    + already-installed required deps (assert the exact set; assert it is **not**
    the full 16-component closure).
  - `--dry-run` output **equals** the real run's effect (same created / modified
    / skipped / newly-required-dep list).
  - A target whose new version newly-requires an uninstalled dep: without `--yes`
    it does **not** write the dep and says so; with `--yes` it installs the dep
    and the tree resolves.
- **`doctor`** — with a manifest: separates "Locally modified" from "Update
  available"; without a manifest: single "Differs from registry" section; with a
  legacy install present: shows the "Legacy single-file layout — run `migrate`"
  section.

### Part C — manifest (pure unit)

- Write-then-read round-trips; hash of written content matches.
- Local edit flips local-vs-manifest to "modified"; an untouched file stays
  clean. Registry bump flips manifest-vs-registry to "update available" while
  local-vs-manifest stays clean (the two axes are independent).
- Missing manifest → graceful legacy path (no crash). Corrupt/partial manifest →
  treated as "no baseline for these files", never throws.

### Part B — `migrate`: extensive

**B-unit. Import-rewrite transform (pure, exhaustive — this is the riskiest
code).** For a fixed set of migrated names, assert each case rewrites or is left
untouched exactly:
- Alias import: `from '@/components/ui/button.component'` →
  `from '@/components/ui/button'`.
- Relative imports at every depth: `'./button.component'`,
  `'../button.component'`, `'../../ui/button.component'`.
- With explicit extension: `'./button.component.ts'` → `'./button'`.
- `export { X } from '…/button.component'` rewritten the same as `import`.
- Dynamic `import('…/button.component')` and lazy `loadComponent` specifiers.
- Single-line multi-import files and multi-line `import {\n …\n }` blocks: named
  bindings preserved verbatim; only the specifier changes.
- **Must NOT match (negative cases):**
  - Substring collision: migrating `button` must not touch
    `'…/button-group.component'` or `'…/icon-button.component'` (word-boundary
    on the component segment).
  - A component **not** in the migrated set is left alone.
  - `.component` appearing inside an unrelated path segment
    (`'…/my-button.component-helpers'`) or inside a string/comment that is not an
    import specifier.
- **Preservation:** CRLF vs LF line endings, quote style (`'` vs `"`), and
  trailing semicolons are preserved.
- **Idempotency:** running the transform twice yields no further change.

**B-detect. Layout detection (pure, over a synthesized tree).**
- Old-layout (`<name>.component.ts` present, `<name>/` absent) → `structural`.
- New-layout (`<name>/<name>.component.ts` present) → `refresh`-eligible only.
- Not installed (neither) → ignored.
- Directive/pipe (flat `files[]`, no `/`) → never migrated.
- Mixed project (some flat, some folder) → correctly partitioned.

**B-integ. End-to-end migration on a synthesized legacy fixture (Vitest +
temp dir).** Because the current CLI can no longer *produce* old layout, the test
**fabricates** legacy state: writes flat `button.component.ts` / `input.component.ts`
(inline template), an already-folder outdated `data-table`, a flat
`app.component.ts` importing both `@/components/ui/button.component` (alias) and
`../components/ui/input.component` (relative), a `components.json`, and `git init`
+ commit for a clean tree. Then run `migrate` and assert:
1. Folder/trio created for every migrated component (`button/button.component.ts`,
   `button/button.component.html`, `button/index.ts`, …).
2. Old flat files deleted (`button.component.ts` gone; sibling flat
   `button.component.{html,css}` gone if they existed).
3. App imports rewritten — both the alias and the relative form now point at the
   folder barrel; no `.component` specifier for a migrated name remains anywhere
   in the project.
4. Newly-required deps (context-menu directives) fetched and present.
5. npm deps + lib files installed; `package.json` updated.
6. `components.lock.json` written with a hash entry per written file.
7. Summary lists files written/deleted, import-rewrite file count, deps added,
   and the `customized[]` warnings.
8. **The migrated project type-checks** (run `tsc --noEmit` against the temp
   project, or assert no unresolved-import remains via a resolver pass).

**B-guard. Flags & safety.**
- Dirty git tree → aborts with guidance; **nothing written**; `--force`
  overrides.
- `--dry-run` → prints the full plan; the working tree (and git status) is
  **byte-for-byte unchanged**; no manifest written.
- `--yes` → no interactive prompt; non-interactive CI path works.
- Not-a-git-repo → treated like a guard failure unless `--force` (don't strand
  the user with no revert path silently).

**B-edge.**
- **Already fully new-layout** project → "Nothing to migrate."
- **Partially migrated** project → completes to all-folder; no duplicate writes.
- **Idempotency:** a second `migrate` run is a clean no-op.
- **Customized component:** local content differs from baseline → `migrate`
  **blocks and lists** them without `--yes`; with `--yes` it proceeds and the
  user can still recover the old version via `git diff`.
- **`--prefix` install:** selectors/tags rewritten at install time must survive
  migration (files fetched with the project's prefix).
- **Mid-run failure:** if a fetch/write throws partway, the clean-git guard
  guarantees `git checkout .` fully restores; assert no partial manifest claims
  success.

**B-e2e (smoke, Playwright harness).** One end-to-end spec that fabricates a
legacy install inside the pristine fixture app, runs `migrate`, then runs the
real `ng build` — the ultimate "the consumer's app compiles after upgrade" gate
that unit/integration layers can't fully prove.

## Rollout note

Fixes only reach consumers on **npm publish** of the CLI (per the project's
registry-publish policy). "Code merged" ≠ "user fixed" — a publish must follow.

## Completion Review

| Phase / Task | Completed | Score | Rationale |
|---|---|---|---|
| Phase 1 (Tasks 1–3): layout detection + bounded update + dry-run + legacy guard | 2026-06-05 | 95 | Bounded write set proven structurally (`precomputedConflicts` skips dependency re-resolution; `options.overwrite` never forced); closure-wide legacy guard + newly-required-deps consent split exercised by the `update-guards` cli-spec. `update()` complexity <15; 9 unit tests + two cli-specs green. Cosmetic nit: dry-run omits a "skipped" line. |
| Phase 2 (Tasks 4–7): manifest + edit-aware doctor + update warning | 2026-06-05 | 95 | CRLF/LF-safe hash baseline; two comparison axes correct; `readManifest` never throws. `performInstall` records component+peer writes and persists the lock; doctor splits user-edits vs updates + legacy section; `update` non-blocking customization warning. 203 unit tests green, complexity <15. Cosmetic nits only. |
| Phase 3 (Tasks 8–14): migrate command | 2026-06-05 | 93 | Correct scan→plan→guard→execute flow; bounded write set; legacy files deleted + dropped from manifest; barrel-skip fix (caught by the real `ng build` compile-smoke gate) with regression test. 222 unit tests + migrate/migrate-build cli-specs green. Documented limitation: no-manifest legacy edit-flagging relies on the clean-git guard + git-diff report (spec-C2 remote heuristic not implemented). |
