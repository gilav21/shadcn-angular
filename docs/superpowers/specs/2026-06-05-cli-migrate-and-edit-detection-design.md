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
   (manifest if present, else current library version) — surfaced as warnings.

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

Every write path updates it — `add`, `update`, `migrate`. Two independent
comparison axes:

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

- **Unit (pure):** import-rewrite transform (alias + relative + `.component`
  inside an unrelated path must NOT match); old-layout detection over a
  synthesized file tree; manifest read/write + hash comparison.
- **`update` regression (cli-spec):** `add data-table` → `update data-table`
  touches only the expected set; `--dry-run` output equals the real run's
  effect. This is the regression gate that proves bugs 1+2 fixed.
- **`migrate` integration:** synthesize a legacy old-layout fixture (flat
  `button.component.ts` + an app file importing `@/…/button.component`), run
  `migrate`, assert: folder/trio files created, flat files deleted, imports
  rewritten, newly-required deps pulled, manifest written, and the result
  compiles.
- **`doctor`:** with and without a manifest, asserts the correct sections.

## Rollout note

Fixes only reach consumers on **npm publish** of the CLI (per the project's
registry-publish policy). "Code merged" ≠ "user fixed" — a publish must follow.
