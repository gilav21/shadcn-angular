# Component Architecture Refactor — file-per-component, template/style trio, `sub/` directories

## Goal

`packages/components/ui/` today keeps each compound component (the main
component plus all of its sub-components) in **one `.ts` file** with **inline
templates**, and stores most components as **flat files** directly under
`ui/`. This refactor moves the library to a predictable, one-folder-per-component
layout and, in the process, makes the registry/sync/hook pipeline able to
classify components **deterministically** instead of guessing.

It does four things (this spec consolidates and supersedes original task **T5**,
"extraction of components from the same file"):

1. **Extraction (T5)** — split every multi-component file so **one file = one
   component / directive / pipe**.
2. **Trio** — every component gets a `.component.ts` / `.component.html` /
   `.component.css` trio: inline `template:` and `styles:` are extracted into
   sibling files.
3. **Folders + `sub/`** — every top-level component gets its own folder; its
   sub-components move into a dedicated `sub/` directory inside that folder.
4. **Tooling** — `sync-registry.ts` and `validate-registry.mjs` are updated to
   understand the new layout (barrel entry files, `templateUrl`/`styleUrl`
   discovery) and to classify a new component file as top-level vs sub-component
   from its **directory** — a declared signal that is immune to the
   "compounding" ambiguity (a top-level component such as `button` is imported
   by many components, so the import graph alone cannot classify it).

## Target structure

```text
packages/components/ui/
  accordion/
    index.ts                       # barrel — public exports
    accordion.component.ts          # entry / main component
    accordion.component.html
    accordion.component.css         # only if it has real CSS — see D1
    accordion.component.spec.ts
    accordion.stories.ts
    sub/
      accordion-item.component.ts
      accordion-item.component.html
      accordion-trigger.component.ts
      accordion-trigger.component.html
      accordion-content.component.ts
      accordion-content.component.html
  data-table/
    index.ts
    data-table.component.ts  / .html / .css
    data-table.types.ts             # support files stay in the folder
    data-table.utils.ts
    sub/
      data-table-column-header.component.ts  / .html
      data-table-pagination.component.ts     / .html
      ...
  button/
    index.ts
    button.component.ts / .html
    button.component.spec.ts
    button.stories.ts                # single-component → no sub/
```

## Conventions (to be added to `.claude/CLAUDE.md`)

- **One** component / directive / pipe per `.ts` file.
- **One folder per top-level component:** `packages/components/ui/<name>/`.
- The folder's **entry file** is `<name>.component.ts` (or `.directive.ts` /
  `.pipe.ts`).
- Each folder has a **barrel `index.ts`** re-exporting the component's public
  API (main component + any sub-components consumers use directly).
- **Sub-components live in `<name>/sub/`.** A file under `sub/` is *never* its
  own registry entry — it belongs to the folder's component.
- **Trio:** `<name>.component.ts` + `<name>.component.html`
  + `<name>.component.css` (see D1). Tailwind utility classes stay inline in the
  HTML; `.css` holds only real CSS rules.
- **Support files** (`<name>.types.ts`, `<name>.utils.ts`, services) live in the
  component folder.
- `<name>.component.spec.ts` and `<name>.stories.ts` move into the folder.
- **Cross-component imports go through the barrel** — `from '../button'`, never
  deep `from '../button/button.component'`. The sync's component-boundary
  detection relies on this.

## Open decisions (RESOLVED 2026-05-19 — locked before Phase 1)

All six decisions were reviewed and locked with the maintainer before any code
was written. Resolutions below; original recommendations kept for history.

- **D1 — Always create `.component.css`?** Only 13 of ~119 components currently
  have inline `styles:`. Either always create the file (uniform trio) or create
  it only when there is real CSS. *Recommendation: create only when needed; the
  "trio" is `.ts` + `.html` + optional `.css`.*
  **→ RESOLVED: create `.component.css` only when there is real CSS.** The trio
  is `.ts` + `.html` + *optional* `.css`. No empty placeholder files.
- **D2 — `charts/` shared utilities.** `charts/chart.types.ts` and
  `charts/chart.utils.ts` are shared by 8 chart components. Once each chart is
  its own folder they cannot live in one chart's folder. *Recommendation: move
  them to `packages/components/lib/` so they become `libFiles`.*
  **→ RESOLVED: move the shared chart utilities to `packages/components/lib/`**
  so they become `libFiles`.
- **D3 — Barrel `index.ts` per folder.** *Recommendation: yes — gives the sync a
  stable entry file and keeps cross-component imports clean.*
  **→ RESOLVED: yes.** Each component folder gets a barrel `index.ts`. The
  barrel is scoped to a single component (main + its sub-components), so it
  introduces no cross-component import bloat; unused sub-component exports
  tree-shake out. `data-table/` already has one.
- **D4 — `.stories.ts` files that define demo components** (e.g.
  `data-table.stories.ts` defines 7). *Recommendation: out of scope for the
  one-component-per-file rule — they are test scaffolding, not shipped
  components. They still move into the component folder.*
  **→ RESOLVED: out of scope.** Do not split story-defined demo components; the
  `.stories.ts` file moves into its component folder unchanged.
- **D5 — Registry `files[]` path format** becomes folder-prefixed
  (`accordion/accordion.component.ts`). Confirm.
  **→ RESOLVED: confirmed.** Registry `files[]` paths are folder-prefixed and
  regenerated by `sync-registry.ts --fix`; never hand-edited.
- **D6 — Directives / pipes** get a folder for consistency but only a `.ts`
  (+ barrel); the trio does not apply.
  **→ RESOLVED — DIVERGES FROM RECOMMENDATION: directives and pipes stay FLAT**
  directly under `ui/`. They are *not* folderized and get no barrel. Phase 1
  tooling is already backward-compatible with flat files, so flat
  directives/pipes remain fully supported; Phase 3.7 and the conventions are
  adjusted accordingly.

## Phase 1 — Tooling & conventions

Backward-compatible; **no file moves**. Lands before any migration so the
half-migrated tree (flat + folder layouts coexisting) stays correct.

### Phase 1 Tasks

- [x] **1.1** `sync-registry.ts` — `resolveImport` must resolve **directory /
  barrel imports**: `'./foo'` where `foo/` is a directory should resolve to
  `foo/index.ts`. Today it returns the directory path, producing a broken file
  entry.
- [x] **1.2** `sync-registry.ts` — the walker must discover **`templateUrl`,
  `styleUrl`, and `styleUrls`** from each walked `.component.ts` and add those
  `.html` / `.css` files to the component's files (leaf files — no recursion).
  Today the walker only follows `from '...'` imports, so trio HTML/CSS would
  never be bundled.
- [x] **1.3** `sync-registry.ts` — confirm component-boundary detection
  (`buildBoundaryMap`) works when entry files are barrels (`<name>/index.ts`);
  add a report-mode **warning for deep cross-component imports** that bypass a
  barrel (they break boundary detection).
- [x] **1.4** `validate-registry.mjs` — replace the name-based new-component
  guess with **directory-based classification**, in priority order:
  1. file already referenced in the registry → skip (existing
     `registryReferencesFile`);
  2. path contains a `sub` path segment → sub-component → skip;
  3. file sits in a **registry-derived single-owner directory** (a directory
     containing exactly one component's entry file) → sub-component → skip;
  4. otherwise → new top-level component → auto-register.
- [x] **1.5** `validate-registry.mjs` — keep the sync-first ordering and the
  per-file existence guard (already implemented).
- [x] **1.6** `validateRegistryFiles` already validates every `files` /
  `libFiles` path; confirm it also covers `.html` / `.css` entries (it resolves
  any path under `ui/` — should already work).
- [x] **1.7** CLI `add` — gate the `../lib/` → alias import rewrite in
  `fetchAndTransform` to `.ts` files only; `.html` / `.css` are copied verbatim.
- [x] **1.8** CLI `add` — every file writer must create nested directories.
  `writeComponentFiles` already calls `fs.ensureDir`; add it to `writePeerFiles`
  and audit `installLibFiles` / `installSingleLibFile`.
- [x] **1.9** CLI `add` / `diff` — `classifyComponent`, `detectConflicts`,
  `checkFileConflict`, and `showConflictDiffs` all iterate `component.files`;
  confirm `.html` / `.css` and `sub/` paths flow through unchanged (plain-text
  diff, no `.ts`-only assumptions). `sub/` files need no special handling — they
  are ordinary `files[]` entries.
- [x] **1.10** CLI `add` — post-install messaging and import hints point at the
  component folder / barrel (`@/components/ui/<name>`), not the old flat path;
  confirm the remote registry base URL serves `.html` / `.css` (GitHub raw does).
- [x] **1.11** Add unit tests for 1.1–1.10 (extend `add.spec.ts` with a
  trio + `sub/` component fixture); update `.claude/CLAUDE.md` with the
  conventions above and the resolved decisions.

### CLI `add` / `diff` changes

The CLI installs a component by iterating its registry `files[]` and writing
each entry to `path.join(targetDir, file)`, so folder-prefixed paths
(`accordion/accordion.component.ts`, `accordion/sub/accordion-item.component.ts`,
`accordion/accordion.component.html`) and the directory structure are preserved
in the consumer's project automatically — **`sub/` needs no special CLI logic;
it is just more `files[]` entries.** The required changes are narrow:

- **Transform scope.** `fetchAndTransform` rewrites `../lib/` imports to the
  user's alias via `replaceAll(/(\.\.\/)+lib\//g, …)`. The `(\.\.\/)+` already
  matches the extra `../` that folder nesting introduces, so `.ts` rewriting
  keeps working — but the transform must not run on `.html` / `.css` (today it
  is a harmless no-op; gate it by extension so future transforms stay safe).
- **Directory creation.** Nested paths require `fs.ensureDir` before every
  write, on *all* writers (task 1.8).
- **No other behavioural change.** Conflict detection, diffing, and overwrite
  prompts are file-path agnostic and work on `.html` / `.css` as plain text once
  1.8 and 1.9 are confirmed.

Cross-component imports resolve correctly in the consumer project because the
CLI preserves the folder layout: `from '../button'` in
`<targetDir>/accordion/accordion.component.ts` resolves to
`<targetDir>/button/index.ts`.

## Phase 2 — Pilot migration

Migrate two representative components end-to-end to validate the recipe and the
Phase 1 tooling before bulk work.

### Phase 2 Tasks

- [x] **2.1** `accordion` — flat compound (4 components) → `ui/accordion/` with
  `sub/`.
- [x] **2.2** `data-table` — already a folder, compound → move its
  sub-components into `data-table/sub/`, extract templates.
- [x] **2.3** Verify for both: build passes, unit tests pass, Storybook renders,
  `npx tsx sync-registry.ts` reports clean, the hook behaves on edits, and
  `cli add accordion` into a scratch project produces a working component.

### Per-component migration recipe

The exact procedure applied to every component in Phase 3:

1. Create `ui/<name>/`.
2. Move `<name>.component.ts`, `<name>.component.spec.ts`, `<name>.stories.ts`
   into it.
3. Extract each sub-component from the file into
   `ui/<name>/sub/<sub>.component.ts` — one component per file. The component
   whose selector matches the registry entry is the **main** file; the rest are
   sub-components.
4. For every component file, extract inline `template:` → `<file>.html` and set
   `templateUrl`; extract inline `styles:` → `<file>.css` and set `styleUrl`
   (per D1). Watch for nested backticks / `${}` in template literals.
5. Add `ui/<name>/index.ts` re-exporting the public API.
6. Fix intra-folder relative imports; update **all external importers** to use
   the barrel.
7. Run `sync-registry.ts --fix` to regenerate the registry entry's `files[]`
   (do not hand-edit).
8. Build + unit tests + affected stories; commit.

## Phase 3 — Bulk migration (batched)

Apply the recipe to every component. Batch to keep the build green and PRs
reviewable — one PR per batch.

### Phase 3 Tasks

- [ ] **3.1** Batch A — single-component flat files (button, badge, input,
  skeleton, …): trio + folder, no `sub/`.
- [ ] **3.2** Batch B — small compound (2–4 components): avatar, alert,
  collapsible, tabs, popover, tooltip, input-otp, input-group, button-group,
  split-button, sortable, carousel, accordion (pilot), …
- [ ] **3.3** Batch C — medium compound (5–9): card, empty, tree, breadcrumb,
  dialog, navigation-menu, pagination, speed-dial, stepper, drawer, field,
  kanban, select, sheet, command, dropdown-menu, table, timeline, alert-dialog.
- [ ] **3.4** Batch D — large compound: `sidebar` (15), `context-menu` (11),
  `menubar` (10).
- [ ] **3.5** Batch E — existing folder `page-builder/`: split `page-builder`
  and `page-renderer` into their own folders; `property-editor` → `sub/`.
- [ ] **3.6** Batch F — `charts/`: each chart (`pie-chart`, `bar-chart`,
  `org-chart`, …) → its own folder; apply D2 for the shared chart utilities.
- [ ] **3.7** Non-`.component.ts` multi-component files (`context-menu-integrations.ts`)
  and directives/pipes (D6).

### Multi-component file inventory (extraction scope, ~52 files)

`.stories.ts` files are excluded per D4.

| Components in file | Files |
| --- | --- |
| 15 | sidebar |
| 10–11 | context-menu, menubar |
| 9 | timeline, table, dropdown-menu, command, alert-dialog |
| 8 | sheet, select, kanban, field, drawer |
| 7 | stepper, speed-dial, pagination, navigation-menu, dialog, breadcrumb |
| 6 | empty, card |
| 5 | tree, carousel |
| 4 | tooltip, tabs, split-button, sortable, popover, input-otp, input-group, accordion, context-menu-integrations |
| 3 | tree-select, resizable, hover-card, file-viewer, emoji-picker, collapsible, chat, button-group, avatar, alert |
| 2 | virtual-scroll, toggle-group, toast, spinner, sparkles, radio-group, number-ticker, date-picker, bento-grid, data-table-date-filter |

Single-component files (~67 remaining `.component.ts`) only need the trio split
and folder move (Batch A).

## Phase 4 — Cleanup & verification

### Phase 4 Tasks

- [ ] **4.1** Full registry regenerated; every `files[]` path is folder-prefixed
  and resolves to a real file (`validateRegistryFiles` passes).
- [ ] **4.2** All cross-component imports go through barrels; no deep imports
  (the 1.3 lint reports zero).
- [ ] **4.3** Build, all unit tests, and all Storybook stories green.
- [ ] **4.4** CLI smoke test: `add` several components (single, compound, and a
  former-`charts/` one) into a fresh project; confirm `.html`/`.css` land.
- [ ] **4.5** Once every component is folderized, hook rule 1.4(3)
  (registry-derived ownership) is redundant — keep it as a safety net or remove.
- [ ] **4.6** `.claude/CLAUDE.md` reflects the final structure and the component
  template/checklist examples use the trio layout.

## Risks & mitigations

- **Template extraction errors** (nested backticks, interpolation) — extract
  carefully; rely on the unit tests + Storybook to catch breakage per batch.
- **Boundary detection breakage** — a cross-component import that bypasses the
  barrel makes the sync absorb another component's files. Mitigation: barrel-only
  convention + the 1.3 deep-import lint.
- **Large blast radius** — 119 components × their importers. Mitigation: strict
  batching, build-green gate per batch, one PR per batch.
- **Hook fires mid-migration** — the half-migrated tree mixes flat and folder
  layouts. Phase 1 tooling is explicitly backward-compatible so this is safe.
- **Registry churn** — let `sync-registry.ts --fix` regenerate `files[]`; never
  hand-edit paths.

## Surfaces affected

- `packages/components/ui/**` — every component file (split, moved, trio).
- `packages/cli/src/registry/index.ts` — every entry's `files[]`.
- `packages/cli/scripts/sync-registry.ts` — `resolveImport`, the walker,
  boundary handling.
- `.claude/hooks/validate-registry.mjs` — directory-based classification.
- `.claude/CLAUDE.md` — conventions and examples.
- `packages/cli/src/commands/add.ts` (and `diff.ts`) — transform scope,
  `ensureDir` on all writers, post-install messaging (Phase 1, tasks 1.7–1.11).
- All `*.stories.ts`, `*.spec.ts`, and any demo/docs app importing components.

## Completion log

The implementing session fills this in (one row per phase; record the
reviewer score if a review gate is run).

| Phase | Status | Reviewer score | Notes |
| --- | --- | --- | --- |
| 1 — Tooling | Done (2026-05-19) | 94/100 ⚠️ | Tasks 1.1–1.11 and decisions D1–D6 implemented and empirically verified: sync reports "All components are in sync." (exit 0), `--fix` produces a zero-line registry diff, 93 CLI tests pass, and both `tsc --noEmit` and `typecheck:scripts` are clean. Pure helpers extracted into `sync-registry-lib.ts` / `registry-classify.mjs` with risk-proportional tests (`resolveImport`, `walkTree`, `classifyImport`, classification, trio+`sub/` install path); the 1.3 lint surfaced a genuine pre-existing boundary violation (`component-outlet` → `data-table/component-pool.service.ts`). ⚠️ Review gate ran the full 5 iterations (93/94/93/94/94) without reaching the ≥95 bar; every reviewer rated it "ships as-is" and the final review found no actionable defect — the only standing nit is a deliberate, documented helper overlap between the `node`-run hook and the `tsx`-run script that cannot be cleanly merged. Score 94 accepted by the maintainer. |
| 2 — Pilot | Done (2026-05-19) | 95/100 | Tasks 2.1–2.3: `accordion` (flat 4-component file) migrated to `ui/accordion/` + `sub/`; `data-table` sub-components moved to `data-table/sub/` with the two-component `data-table-date-filter` file split one-per-file (shared helpers extracted to a private `data-table-date-utils.ts`, not duplicated). Templates extracted to `.component.html` content-identically; barrels, registry, and all import paths correct. All verification green: sync "All components are in sync." (exit 0), 339 component tests, 98 CLI tests, `tsc` clean; `cli add accordion` installs the folder structure end-to-end. **Recipe note for Phase 3:** before `sync --fix`, seed a migrated entry's `files` with `['<name>/index.ts']` — the sync derives the entry file from the current registry, so it cannot find a moved component otherwise. Pilot surfaced and fixed two pre-existing tooling bugs: `getEntryFile` foreign-`index.ts` match and the `getLocalComponentsDir` path depth. |
| 3 — Bulk migration | In progress | | Batched per "Phase 3 Tasks"; review gate per sub-batch (bar ≥95). |
| 3.1 — Batch A.1 | Done (2026-05-19) | 97/100 | Phase 3 prep + 12 single-component flat files migrated to `ui/<name>/` trio + barrel: badge, button, label, separator, skeleton, switch, checkbox, progress, kbd, aspect-ratio, toggle, slider. Prep commit moved the two genuinely-shared support files (`input-group.token.ts`, `calendar-locales.ts`) to `lib/` as `libFiles` (maintainer decision, D2 analogy). All external importers repointed to barrels; registry `files[]` regenerated by `sync --fix`; D1 honored (`separator` keeps empty inline template, `skeleton` gets a real `.component.css`). Verified: `build:demo`, `build-storybook`, sync clean, 2914/2914 tests pass. Two fix commits folded in: `separator` empty-`.html` removal and a `switch.stories.ts` stale `./label` import (build-storybook does not compile `.stories.ts`, so it escaped `build:demo`). Reviewer: clean complete execution of the recipe, no actionable defects; only standing nit is the pre-existing `component-outlet` boundary-lint warning. |
| 3.2 — Batch A.2 | Done (2026-05-19) | 97/100 | 12 single-component flat files migrated to `ui/<name>/` trio + barrel: icon, scroll-area, rating, native-select, code-block, comparison-slider, file-upload, file-viewer, color-picker, tour, shortcut-bindings-dialog, virtual-scroll. Special cases: `icon` moved its `icon.token.ts` support file into the folder (barrel re-exports it); `virtual-scroll` moved `virtual-scroll.runway.spec.ts` into the folder (`virtual-scroll-dummy.txt` is unreferenced — left flat). `.component.css` extracted for icon/file-viewer/virtual-scroll (real CSS). One fix commit folded in: stale relative imports in moved `tour.stories.ts` / `shortcut-bindings-dialog.stories.ts` (build:demo does not compile `.stories.ts`). Verified: `build:demo`, `build-storybook`, sync clean, 2914/2914 tests pass. Reviewer: clean pure move/refactor, ships as-is, no actionable defects. |
| 3.3 — Batch A.3 | Done (2026-05-20) | 97/100 | 12 single-component flat files migrated to `ui/<name>/` trio + barrel: input, textarea, number-input, phone-input, chip-list, calendar, autocomplete, streaming-text, text-reveal, particles, orbit, stagger-children. Support-file moves: `phone-input-data.ts` into `phone-input/` and `highlight.pipe.ts` into `autocomplete/` (both barrels re-export the support file; `ui/index.ts` collapses the previously-separate export lines). `.component.css` extracted for text-reveal only (real `@keyframes`); `particles` keeps empty template inline (D1). Two fix commits folded in: `input-group.stories.ts` stale `./input.component` → `./input` (caught by the subagent's mandatory final `build-storybook` self-check) and `text-reveal.component.spec.ts` that was left at the flat location (now moved into the folder). Verified: `build:demo`, `build-storybook`, sync clean, 2914/2914 tests pass. Reviewer: clean pure move/refactor, ships as-is. |
| 3.4 — Batch A.4 | Done (2026-05-20) | 96/100 | 11 single-component flat files migrated to `ui/<name>/` trio + barrel: blur-fade, flip-text, gradient-text, marquee, meteors, morphing-text, scroll-progress, shine-border, typing-animation, word-rotate, wobble-card. Real `.component.css` extracted for flip-text/morphing-text/typing-animation/word-rotate; `meteors` keeps empty template inline (D1). Minor scope item recorded: `flip-text` extracted its inline `char === ' ' ? ' ' : char` ternary to a `displayChar()` method (the `' '` escape does not survive HTML template extraction unambiguously); behavior verified byte-identical (U+00A0 / `c2 a0` UTF-8) by reviewer. `word-rotate` duplicate `cn` / `prefersReducedMotion` imports merged into one statement. Verified: `build:demo`, `build-storybook`, sync clean, 2914/2914 tests pass. Reviewer: clean, ships as-is. |
| 3 — Bulk migration — Batch A complete | Done (2026-05-20) | — | 47 single-component flat files now folderized (Phase 3.1 / Batches A.1–A.4). Remaining: Batch B (compound 2–4 components), C (5–9), D (10+), E (page-builder), F (charts). |
| 3.B.1 — Batch B.1 | Done (2026-05-20) | 95/100 | 5 small compound (2 @Component each) flat files migrated to `ui/<name>/` + `sub/`: spinner, toggle-group, sparkles, bento-grid, toast. Each: main `<name>.component.ts` + barrel + extracted sub in `sub/`; trio per component. Only structurally-required deviations from byte-identity allowed: `toggleVariants` and `TOGGLE_GROUP` promoted to `export` (toggle-group sub imports them); `forwardRef(() => Sub)` dropped from main `imports[]` where the sub is now imported at top (toggle-group, toast); unused-after-split imports stripped (`inject`/`forwardRef` etc.). D1 honored — `.component.css` extracted only for sparkles (keyframes) and bento-grid (`:host` flex). External importers updated: 1 for spinner, 0 for toggle-group/sparkles/toast (only ui/index.ts), 7 for bento-grid (page-builder ×4 + demo + ui/index.ts). Verified: build:demo, build-storybook, sync clean, 2914/2914 tests pass. Note: this batch followed a failed parallel-worktree experiment — worktrees were based on master merge `7e68065`, not current branch HEAD, so commits could not be cherry-picked; subagent-internal self-review-gates also reported inflated scores (96-97) where independent controller-side reviewers found 72-94 (notably one 243-LOC scope-creep bundle into CLI tooling). Worktrees discarded; sequential migration + independent controller review-gate is the proven pattern. |
| 3.B.2 — Batch B.2 | Done (2026-05-20) | 96/100 | 6 compound flat files migrated to `ui/<name>/` + `sub/`: date-picker, number-ticker, radio-group, sortable, alert, avatar. Allowed deviations only: 5 helpers promoted to `export` in `date-picker.component.ts` (sub `date-range-picker` imports them); `forwardRef` dropped + unused imports stripped where structurally required. D1 honored — no `.component.css` files needed. External importers updated: 3 for date-picker, 1 for number-ticker, 0 for radio-group/sortable/alert, 4 for avatar (kanban, chat, hover-card stories, dashboard-widgets). Verified: build:demo, build-storybook, sync clean, 2914/2914 tests. One follow-up fix folded in: `radio-group.stories.ts` stale `./label` → `../label` (caught by the subagent's final build-storybook check). Reviewer: pure refactor, no SonarQube scope creep, byte-identical class bodies; minor nit (non-blocker): `date-range-picker.stories.ts` left at flat `ui/` despite being the stories file for the now-sub `DateRangePickerComponent`. |
| 3.B.3 — Batch B.3 | Done (2026-05-20) | 95/100 | 6 compound flat files migrated to `ui/<name>/` + `sub/`: button-group, chat, collapsible, hover-card, resizable, tooltip. **tooltip required a follow-up fix** — the initial migration kept `TooltipContentComponent` and `TooltipDirective` in the main file claiming a circular forwardRef blocker; reviewer scored 86 and flagged it as violating "one entity per `.ts` file". Fix introduced an `InjectionToken<TooltipComponent>('TOOLTIP')` mirroring accordion's `ACCORDION` pattern, extracted both into `sub/`, and re-scored to 95. `chat` has no `ui-chat` selector; `ChatMessageComponent` placed as main (defensible but `ChatListComponent` would arguably be more natural). External importers updated: 0 for button-group/chat/collapsible/hover-card/resizable; 3 for tooltip (emoji-picker, sidebar, speed-dial.stories). D1 honored throughout. Verified: build:demo, build-storybook, sync clean, 2914/2914 tests. **Pattern lesson:** circular forwardRef between main and a sub is NEVER a reason to keep two `@Component`s in the same file — use an `InjectionToken<MainComponent>` (provided by main, injected by sub) to break the cycle. |
| 3.B.4 — Batch B.4 | Done (2026-05-20) | 97/100 | 6 compound flat files migrated to `ui/<name>/` + `sub/`: emoji-picker, tree-select, input-otp, popover, split-button, tabs. `InjectionToken<MainComponent>` pattern correctly applied where subs injected main: `EMOJI_PICKER`, `POPOVER`, `SPLIT_BUTTON` (newly introduced), `TABS` (pre-existing). Correctly omitted for tree-select and input-otp (their subs never injected main). External importers updated: autocomplete, color-picker, phone-input, rich-text-editor, rich-text-toolbar, plus ui/index.ts. D1 honored — only tree-select got a `.component.css` (real styles). Verified: build:demo, build-storybook, sync clean, 2914/2914 tests. Reviewer: clean execution, exactly one @Component per .ts file in final state, no CRLF churn. |
| 3.B.5 — Batch B.5 | Done (2026-05-20) | 97/100 | 3 final B-batch entries: **input-group** (4 comps, no InjectionToken — subs don't inject main; `UI_INPUT_GROUP` token lives in `lib/`), **tree** (4 comps, pre-existing `TREE` token kept; `let nextId = 0` correctly localized to `tree-item.component.ts` since only that sub uses it; tree-select imports updated to `'../tree'`), **dock** (special: was split across 4 separate flat files at `ui/`, consolidated into `ui/dock/` + `sub/`; no leftover `dock-*.component.ts` at flat). One follow-up fix folded in: sub-depth `lib/utils` imports needed `../../../lib/utils` (3 levels from sub/, not 2). Verified: build, storybook, sync clean, 2914/2914 tests. |
| 3 — Bulk migration — Batch B complete | Done (2026-05-20) | — | Batch B fully migrated across 5 sub-batches: B.1 (5 comps, 95), B.2 (6, 96), B.3 (6, 95 after tooltip fix), B.4 (6, 97), B.5 (3, 97). **26 compound multi-component files** migrated to `ui/<name>/` + `sub/` with the InjectionToken<MainComponent> pattern applied wherever subs injected the main class (4 newly introduced: EMOJI_PICKER, POPOVER, SPLIT_BUTTON, TOOLTIP). Remaining: Batch C (medium 5–9 component files), D (10+), E (page-builder), F (charts), Phase 3.7. |
| 3.C.1 — Batch C.1 | Done (2026-05-20) | 95/100 | 6 medium compound flat files migrated to `ui/<name>/` + `sub/`: carousel (5), card (6), empty (6), breadcrumb (7), pagination (7), alert-dialog (9). `CAROUSEL` and `ALERT_DIALOG` InjectionTokens introduced where subs injected main concretely; card/empty/breadcrumb/pagination omitted token (pure composition, subs don't inject main). Data-table's deep import `'../../pagination.component'` repointed to barrel. One follow-up fix folded in for `card.stories.ts` stale `./label` import. D1 honored. Verified: build, storybook, sync clean, 2914/2914 tests. Minor LF↔CRLF noise on 4 of 6 main files (project baseline is mixed). |
| 3.C.2 — Batch C.2 | Done (2026-05-20) | 95/100 | 6 medium compound flat files migrated to `ui/<name>/` + `sub/`: dialog (7), navigation-menu (7), speed-dial (6), stepper (7), drawer (8), field (8). Tokens introduced: `DIALOG`, `NAVIGATION_MENU_ITEM`, `SPEED_DIAL`+`SPEED_DIAL_MENU`, `STEPPER_ITEM` (plus pre-existing `STEPPER` reused), `DRAWER`; `FIELD_CONTEXT` pre-existed. `field/field.utils.ts` and `navigation-menu/navigation-menu.service.ts` extracted as folder-internal support. One follow-up fix folded in: dialog.stories.ts stale `./button`/`./input`/`./label` imports rebased. D1 honored. Verified: build, storybook, sync clean, 2914/2914 tests. |
| 4 — Cleanup | | | |
