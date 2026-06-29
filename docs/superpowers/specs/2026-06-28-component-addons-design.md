# Component Addons ("Puzzle") System — Design Spec

**Date:** 2026-06-28
**Status:** Approved — implementation in progress (Phase 1)

## Context

The library's large compound components (`data-table` at ~5,100 lines,
`rich-text-editor` at ~6,534 lines) have accumulated many optional features —
AI helpers, export, import parsers, context menus — all woven **inline** into a
single monolithic component file. In the shadcn model the source lands in the
consumer's repo and **they own it forever**, so every shipped line is a line the
dev maintains. Even a 55-line AI helper is "another file (or block) living in my
git that I never asked for."

The goal: a **base component + opt-in addons** system where, at `add` time, the
dev chooses which addons to include (all / none / pick), and can add an addon
later in **one command** ("oh, you can have a ready-made context menu for the
data-table — let me add that real quick"). The hard constraint: **do not become
ag-grid module hell** — no runtime `ModuleRegistry.registerModules()`, no
ceremony in app code, no features gated behind 100 commands/installs.

### Why we can avoid ag-grid hell
ag-grid must gate features behind runtime module registration because it ships as
a **compiled npm package** — that's the only way to keep its bundle small. This
library **owns the source** and the CLI assembles files from git at install time,
so puzzle pieces snap together at **`add` time, not runtime**. That is the thing
ag-grid structurally cannot do.

### Decisions already locked (with the user)
1. **Opt-in unit = files.** An addon is a separately-installable set of files,
   chosen by the dev. A feature that is never wanted should not exist in their repo.
2. **Attach mechanism = DI host contract, zero runtime ceremony.** The base
   exposes extension points; the addon attaches via Angular DI with no runtime
   registration. Once the addon's attribute is present on a `<ui-data-table>`
   tag, it "just works" — no `registerModules()`, no provider wiring in app code.
3. **`add` and wiring are SEPARATE commands.** `add` only makes the addon
   *available* (copies files, installs deps) and **never touches the dev's app
   code**. A separate **`apply`** command does the optional, explicit,
   targeted text-wiring into a chosen usage. The dev controls where the feature
   is actually used — the CLI does not guess or silently edit consumer files on
   `add`.

### What today's code actually looks like (verified)
- AI is **already zero-dependency**: `lib/ai.ts` is 55 lines of types + a
  `runAiTask` helper; the component takes `aiProvider = input<AiProvider |
  undefined>(undefined)` and no-ops if unset. No AI SDK is pulled.
- The real weight is (a) **source/cognitive weight** of the monolith the dev
  owns, and (b) **transitive npm deps** like `xlsx`/PDF-DOCX parsers pulled via
  `npmDependencies` whether or not the dev exports.
- Features today are inline, gated only by `enable*` boolean inputs. **None are
  separate files** — so the addon model *requires* extracting them.
- The registry already has unused scaffolding: `optionalDependencies` exists on
  `ComponentDefinition` but is **informational only** (never consulted by the
  resolver); `peerFiles` already models "extra files installed only when needed."

---

## The Addon Architecture

### 1. Code shape: addon = an Angular directive that auto-wires via DI

An addon's primary artifact is a **directive with an attribute selector** that
attaches to the base component's host element and talks to the base through a
small, typed **host contract** obtained by DI.

```
ui/data-table/
  data-table.component.ts          # lean base — knows NOTHING about addons
  data-table.host.ts               # NEW: DataTableAddonHost contract (the API addons use)
  addons/
    context-menu/
      context-menu.directive.ts    # selector: '[uiDtContextMenu]'
      index.ts
    ai/
      ai.directive.ts              # selector: '[uiDtAi]'  (+ ai.component.html for its UI panel)
      index.ts
    export/
      export.directive.ts          # selector: '[uiDtExport]' (pulls xlsx here, not in base)
      index.ts
```

- Addon directive selectors are **`ui`-prefixed** (lint-enforced by
  `@angular-eslint/directive-selector`), so the consumer-facing attribute is
  e.g. `uiDtContextMenu` (not `dtContextMenu`).
- The base component
  **`providers: [{ provide: DataTableAddonHost, useExisting: DataTableComponent }]`**
  (or exposes itself as the token). Crucially the base **does not import any addon** —
  decoupling is one-directional, so the base stays lean and addons are purely additive.
- The addon directive does `private readonly host = inject(DataTableAddonHost)`
  in its constructor and registers its capability (e.g.
  `host.registerContextMenuProvider(...)`, `host.registerToolbarSlot(...)`,
  reads `host.columns()`, calls `host.applyFilter(spec)`).
- **Zero runtime registry, zero ceremony** — Angular's DI + selector matching is
  the wiring. Per-usage opt-in via the attribute (`<ui-data-table uiDtContextMenu>`);
  the directive only needs to be in the consuming standalone component's `imports`.

### 2. The host extension contract (the real API-design work)

Each addon-capable base ships a `*.host.ts` defining the **minimum public surface**
addons need — this is the stable boundary that lets the base internals change
without breaking addons. Sketch for data-table:

```ts
export abstract class DataTableAddonHost<T = unknown> {
  abstract columns(): readonly ColumnDef<T>[];
  abstract filteredData(): readonly T[];
  abstract applyFilter(spec: NlFilterSpec): void;
  abstract registerToolbarSlot(slot: ToolbarSlot): () => void;        // returns teardown
  abstract registerContextMenuProvider(p: ContextMenuProvider<T>): () => void;
  abstract registerCellEditor(/* ... */): () => void;
  // ...only what addons genuinely need
}
```

rich-text already has the pattern to mirror: `RichTextCommandRegistry`
(injectable, `registerCommand` returns an unregister fn). The host contract
generalizes that idea to all extension points.

#### Generic slot mechanism (locked for the context-menu pilot)

Some addon affordances need **template real-estate inside the base** (e.g. a
visible ⋮ button in a row cell or a column header) that a directive cannot
inject on its own. The base therefore exposes **generic, addon-agnostic slot
registration** on the host contract — the base renders whatever is registered
without knowing which addon registered it:

```ts
abstract registerCellAction(slot: CellActionSlot<T>): () => void;    // ⋮ per row
abstract registerHeaderAction(slot: HeaderActionSlot<T>): () => void; // ⋮ per header
```

The base template iterates registered slots and renders their button (icon +
click handler the slot supplies); the addon supplies the renderer + behavior.
This is the reusable foundation future addons (export toolbar button, etc.)
also build on.

#### Task 3 pilot decisions (locked with the user)

- **Pilot addon = `data-table/context-menu`** (the user's vision exemplar).
- **Clean break + codemod.** `[rowActions]` / `[enableColumnMenu]` move off the
  bare `<ui-data-table>` onto the `uiDtContextMenu` directive. The base sheds ALL
  context-menu code *and* its dependency on the `context-menu` component. A
  `breaking` registry entry (`kind:'input'`) announces it via
  `get_install_plan`/`update`; demo/stories/e2e migrate to the directive form.
- **Keep the visible ⋮ buttons** via the generic slot mechanism above (not
  right-click-only). The directive also wires `contextmenu` (mouse) **and**
  long-press (touch, via `lib/touch.ts`) so the menu is reachable on touch
  (CLAUDE.md §6).
- **Menu rendering is imperative**: the directive instantiates
  `ContextMenuComponent` via `ViewContainerRef` + `setInput('items', …)` +
  `show(x, y)` — confirmed self-managing its own overlay — so the base needs no
  context-menu template.
- **What stays in the base** (generic row/column primitives the contract
  exposes): `enhancedColumns()`, row access by index, `getRowContext(row,index)`
  (generic row metadata incl. selection + tree state), sort get/set, column
  pin get/set, column visibility set + `showAllColumns()`, locale `t()`, and the
  two slot registries. **What moves to the addon**: the `rowActions` /
  `enableColumnMenu` inputs, all menu-building (row-action, column sort/pin/hide
  menus), the event listeners, and the `ContextMenuComponent` rendering.

Task 3 is split into sub-tasks, each gated ≥95: **3a** host contract + provider
+ generic slot machinery; **3b** the `uiDtContextMenu` addon directive; **3c**
delete context-menu from the base + migrate its tests; **3d** registry addon
entry + `breaking` codemod + demo/stories/e2e migration.

### 3. Registry & CLI mechanism

**Registry schema (`ComponentDefinition` in `packages/cli/src/registry/index.ts`):**
- Addons are first-class registry entries keyed `parent/addon` (e.g.
  `data-table/ai`, `data-table/context-menu`) with new fields:
  ```ts
  type?: 'component' | 'block' | 'addon';
  parent?: ComponentName;                 // addon → its base
  attach?: { import: string; selector: string; snippet?: string };  // selector required: an addon needs an attribute to attach
  addons?: readonly string[];             // base → its available addon keys
  ```
- `attach` tells the CLI how to wire: which symbol to import and which attribute
  to add to the base's usage tag.
- The existing **informational `optionalDependencies`** is migrated to real
  addon entries and then retired.

**CLI UX (`packages/cli/src/core/` + commands).** Two distinct commands.
At a glance:

| Command | Installs files/deps? | Edits your app code? | Use when |
| --- | --- | --- | --- |
| `add data-table[/addon]` | yes | **no** | make a base/addon *available*; you wire it yourself |
| `apply data-table/addon` | yes (installs first if missing) | **yes**, targeted | the "add that real quick" one-liner: install + wire |

`add` — **install only, never touches consumer app code:**
- `add data-table` → after resolving the base, if it has `addons`, show an
  interactive **multiselect**: `all / none / pick`. Default = **none** (lean
  base); non-interactive flags `--with ai,export` / `--addons all` / `--no-addons`.
- `add data-table/ai` → install a **single addon** onto an already-installed base
  *without wiring it*. If the base is missing, offer to add it too.
- On install the CLI: writes the addon files into the library folder, installs
  the addon's own `npmDependencies`/`libFiles` (so `xlsx` only arrives with
  `export`). **It does not read or edit any consuming component.** It prints a
  one-line hint: add the `uiDtExport` attribute where you want it, or run `apply`.

`apply` — **explicit, opt-in, targeted wiring (the only command that edits app code):**
- `apply data-table/export [targeting]` → inserts the addon's `import` + attribute
  into the dev's `<ui-data-table>` usage(s) via best-effort AST edit.
- **Installs the addon first if it isn't already present** (runs the `add` step
  internally), so `apply` is the true one-liner: install + wire in one command —
  the "let me add that real quick" path. If the addon is already installed it
  skips straight to wiring. (`add` alone remains available for install-without-wiring.)
- Targeting is **two independent questions** — keep them conceptually and in the
  flag design separate:

  **(1) Which files?** (file selection)
  - Positional **component class name(s)** — e.g.
    `apply data-table/export DashboardComponent` (repeatable / comma-separated),
    or an explicit path (`apply data-table/export ./src/app/orders`).
  - **Default:** if the cwd is truly a single-component dir, that component's
    files. Otherwise the dev must name the component(s) or pass a path (no
    whole-project guessing).

  **(2) Which `<ui-data-table>` instances inside the selected files?**
  (instance selection) — flags, never collide with the file question:
  - `--all` → every instance in the selected files
  - `--class <token>` → instances whose tag **CSS `class="…"`** contains the token
  - `--id <token>` → instances matching that id / template-ref / `data-testid`
  - **Default:** if a selected file has exactly one instance, wire it; if >1 and
    no instance flag, **interactive multiselect** (the "make it a choice" path).

- **Snippet fallback** (never a hard failure): in non-interactive runs (CI, `--yes`)
  where the instance is still ambiguous, or nothing matches, print the exact import +
  attribute lines to paste and edit nothing.
- Idempotent: re-running on an already-wired instance is a no-op.

`update` preserves the set of installed addons. `why` and `list` surface addons.
MCP tools `add_component`, `get_install_plan`, `get_component` surface addons;
an `apply_addon` MCP tool mirrors the `apply` command.

**Resolver (`packages/cli/src/core/resolve.ts` / `install.ts`):**
- `resolveDependencies` learns to resolve selected addons alongside the base and
  collect their deps. Base resolution **never** auto-pulls addons.

**sync-registry (`packages/cli/scripts/sync-registry.ts`):**
- Discover `ui/<comp>/addons/<addon>/` folders; each becomes an addon registry
  entry under the parent with its own import-walked `files[]` / `npmDependencies`
  / `libFiles`.
- Enforce the **one-directional boundary**: the base's import-walk must NOT reach
  into `addons/` (else addon files get folded into the base and the lean split is
  lost). The base barrel `index.ts` must NOT re-export addons.

### 4. Base-vs-addon split (recommended starting inventory)

Extract the **cleanly-separable, heaviest** features first; leave deeply-woven
ones inline behind their existing `enable*` flags (extracting virtual-scroll or
cell-range is high-risk and low-reward for v1).

- **data-table base keeps:** sorting, pagination, basic + column filtering, row
  selection, column resize/reorder, inline edit, virtual scroll.
- **data-table addons (v1):** `ai` (nl-filter + fill), `export` (csv/excel +
  `xlsx`), `import` (clipboard/parsers), `context-menu`, `advanced-filter-builder`.
- **rich-text base keeps:** core editing, toolbar, sanitizer, paste-normalizer.
- **rich-text addons (v1):** `ai`, `file-import` (DOCX/PDF + parsers),
  `markdown-mode`, `mentions-tags`, `emoji`, `history`.

> The exact split is a **per-component design pass** during implementation, not
> fixed here. The principle: a feature becomes an addon when its code +
> deps can live behind a clean host-contract boundary and a real subset of devs
> won't want it.

---

## Phasing (keep blast radius small)

1. **Mechanism first, one pilot addon.** Build the registry/CLI/sync addon
   support + the `DataTableAddonHost` contract, and extract **one** clean addon
   (`data-table/context-menu` or `data-table/export`) end-to-end. Prove the
   DI auto-wire and both the `add data-table/<addon>` (install-only) and
   `apply data-table/<addon>` (install + targeted wire) flows.
2. **Extract the rest of data-table's v1 addons** against the proven contract.
3. **Apply to rich-text** (reuse the `RichTextCommandRegistry` precedent).
4. **Retire `optionalDependencies`** once all are migrated.

---

## Files to create / modify (representative)

- `packages/cli/src/registry/index.ts` — `ComponentDefinition`: add `type:'addon'`,
  `parent`, `attach`, `addons`; migrate `optionalDependencies`.
- `packages/cli/src/registry/load.ts` — `isValidRegistryShape` accepts new fields.
- `packages/cli/src/core/resolve.ts`, `plan.ts`, `install.ts` — addon resolution,
  per-addon npm/lib install (no consumer-file editing in the `add` path).
- `packages/cli/src/commands/add*` — multiselect prompt, `--with/--addons/--no-addons`,
  `add <parent>/<addon>` shorthand. **Install-only; never edits app code.**
- `packages/cli/src/commands/apply*` (NEW) — best-effort AST insert of import +
  attribute, `--all/--class/--id` targeting, path-scoped, snippet fallback.
- `packages/cli/src/mcp/tools/*` — surface addons in read/write tools; add an
  `apply_addon` tool mirroring `apply`.
- `packages/cli/scripts/sync-registry.ts` (+ `sync-registry-lib.ts`) — discover
  `addons/`, enforce boundary, emit addon entries.
- `packages/components/ui/data-table/data-table.host.ts` — host contract (NEW).
- `packages/components/ui/data-table/addons/<addon>/...` — extracted addon dirs.
- `packages/components/ui/data-table/data-table.component.ts` — expose host
  contract via `providers`, remove extracted feature code, keep `enable*` flags
  for inline-staying features.
- `packages/components/registry.json` — regenerated by `sync-registry --fix`.

| 4 — Resolver + `add`: install addons | 2026-06-29 | 95 | `promptAddons` (mirrors `promptOptionalDependencies`) collects each resolved base's `addons[]` and is lean-by-default: precedence `--no-addons` > `--with <list\|all>` > `--yes` (none) > `--all` (all) > interactive (none pre-selected). `--with` requires the full `parent/addon` key (same form as `add parent/addon`); a bare short name is rejected with a hint (short names collide across bases, e.g. future `data-table/ai` vs `rich-text-editor/ai`); unknown tokens warn. Selected addons thread through the existing `optionalDeps` install pipeline (files/npm/lib install). `selectableComponentNames` hides addons from the picker/`--all` without touching shared `getComponentNames` (so `update`/`list` still see them); explicit `add parent/addon` works. Resolver invariants proven (addon→base+context-menu; base↛addon). `add` stays install-only. **Discoverability:** after every `add` (incl. `--yes`/`--no-addons`/CI/multi-component/dry-run/nothing-to-install), `collectAvailableAddons` prints a short note listing any installed component's available-but-not-installed addons + how to add — so devs who skip the prompt still learn addons exist. Verified end-to-end: real CLI install of `data-table/context-menu` + `ng build` passed; hint shows on `--no-addons`, absent for addon-less components. CLI 424 pass; tsc+eslint clean. |

| 5 — `apply` command (install + targeted wire) | 2026-06-29 | 95 | `apply <addon> [Components…]` installs the addon if missing (`performInstall`) then wires it. Pure editing primitives in `apply-wire.ts` (quote-aware `findTemplateInstances`, `insertSelectorAtInstances` idempotent before `/>`, `wireDirectiveImport` adds import + `imports[]` entry / returns null→snippet, `addonImportModule`/`parseAttachSymbol`/`resolveTemplateLocation`), all ReDoS-safe (no adjacent-star regexes). Two-level targeting: file selection (component name / single-dir / **scan-fallback when ambiguous**, app-code-only — skips managed ui/blocks dirs) + instance selection (`--all`/`--class`/`--id`, single auto, >1 interactive). Snippet fallback on non-interactive ambiguity / uneditable; idempotent; inline vs templateUrl handled. Verified end-to-end: real CLI wired `OrdersComponent` (import + `imports[]` + `uiDtContextMenu` on tag, correct alias path), idempotent re-run, `ng build` passed. Also added a sync regression test: a component importing an addon barrel is auto-detected as depending on it. apply-wire 20 + CLI 445 pass; tsc+ngc+eslint clean. |

## Open decisions (call out, don't block)
- Exact base/addon split per component (per-component pass in Phase 2/3).
- Addon directive uses an **attribute selector** (`[uiDtExport]`) so the feature is
  off until the dev writes that attribute on a specific table — per-usage opt-in.
  (Alternative: an element selector that auto-applies to *every* `<ui-data-table>`
  once imported — rejected; too blunt for real apps with multiple tables.)
- `apply` targeting is **two levels**: (1) *which files* — positional component
  class name(s) or a path, defaulting to the single component in the current dir;
  (2) *which instances in those files* — `--all` / `--class` (tag CSS class) /
  `--id`. The component name (file selection) is never an instance filter.
- `apply` with selected files but no instance flag + >1 instance — **interactive
  multiselect**; snippet-print is the non-interactive fallback only.
- `apply` file default — only auto-selects when the cwd is truly a single-component
  dir; otherwise require an explicit component name / path (no project-wide guess).
- Default addon selection on `add` — **recommend `none`** (lean by default).

## Publish impact
This changes **CLI logic + the `ComponentDefinition` shape** → an **npm publish IS
required** (already-installed CLIs can't parse the new manifest otherwise). Add to
the pending-releases memory when the PR lands. (Per CLAUDE.md "When a CLI npm
Publish Is Required".)

## Verification
- Unit: registry-shape validator accepts addon entries; resolver pulls a base
  without addons and a base + selected addons; addon brings its own npm dep
  (`xlsx` only with `export`).
- CLI e2e (the real gate): scaffold a pristine consumer app, `add data-table`
  (lean — assert no `xlsx` in package.json, no addon files). Then
  `add data-table/export` — assert addon files written + `xlsx` added, and assert
  **the consumer component is untouched** (add must not edit app code). Then
  `apply data-table/export DashboardComponent --id ordersTable` — assert file
  selection (only `DashboardComponent`'s files touched) AND instance selection
  (only the `ordersTable` instance wired), then drive Playwright to confirm the
  export button works. Also assert the **snippet fallback** path: `apply` on a
  file with two instances and no instance flag, non-interactively, prints the
  snippet and edits nothing. Mirror for `context-menu`.
- `npm run e2e:scaffold -- data-table` updates / add an addon-specific harness.
- Confirm the base component compiles and tree-shakes with **no** addon imports
  (proves one-directional decoupling).

---

## Completion Log

Each task is implemented test-first (TDD) and must pass an independent
review-gate at **≥95** before advancing. Highest score recorded.

| Task | Completed | Score | Rationale |
| --- | --- | --- | --- |
| 1 — Registry schema: addon fields + validator | 2026-06-29 | 95 | Faithfully adds `AddonAttach` (`selector` required), `type:'addon'`, optional `parent`/`attach`/`addons` to `ComponentDefinition`, and hardens `isValidRegistryShape` via small well-factored helpers that reject malformed addons/addons-arrays while preserving snapshot fallback. Tests cover the full risk surface; change is appropriately minimal (stops short of resolver-level checks that belong to later tasks); no `any`, all new members `readonly`, complexity well under 15. |
| 2 — sync-registry: addon-aware walk + boundary enforcement | 2026-06-29 | 95 | `getEntryFile` resolves a `parent/addon` name to its `addons/<addon>/index.ts` barrel; `addonReachedFromBase`/`classifyImport` flag a base reaching into its own `addons/` (checked before entry-owner lookup) and `walkTree` records the violation without absorbing addon files; `main` escalates to a hard `exitCode=1` abort in both check and `--fix` modes. One walk rule covers both the deep-import and barrel-re-export forms (tested end-to-end). Minimal, SonarQube-clean, matches the hand-authored-then-maintained pattern. |
| 3a — Host contract + provider + generic slot registry | 2026-06-29 | 96 | `DataTableAddonHost<T>` abstract DI token exposes exactly the base-retained surface (columns, row access, getRowContext, sort/pin get-set, visibility, showAllColumns, getLocale) + cell/header slot register+list; `AddonSlotRegistry<S>` is a signal-backed reactive registry with identity-correct teardown; `DataTableComponent` implements + provides the token (useExisting/forwardRef). Purely additive (slot rendering + context-menu removal deferred to 3c); one-directional boundary holds (base imports no addon); `implements` compiles under strict root tsconfig. 9 tests (4 unit + 5 TestBed DI). |
| 3b — uiDtContextMenu addon directive | 2026-06-29 | 96 | Opt-in `[uiDtContextMenu]` directive injects `DataTableAddonHost` via the parent barrel (`../..`), owns the `context-menu` dependency, and renders menus imperatively (`ContextMenuComponent` via `ViewContainerRef`). Slots register/unregister reactively (`effect`+`onCleanup`) keyed on `rowActions`/`enableColumnMenu`; reachable by mouse (`contextmenu`), touch (`onLongPress`), and ⋮ buttons; `ComponentRef`s + listener torn down on destroy. Column-menu logic is a faithful port (sort/pin/hide, separators, enableSorting/enableHiding omissions, faithful `{columnKey,column}` payload). 13 tests. Base imports no addon; sync reports in-sync. |
| 3d — Registry addon entry + retire optionalDeps/peerFiles + breaking codemod + stories | 2026-06-29 | 96 | Hand-authored the `data-table/context-menu` addon entry (`type:'addon'`, `parent`, `attach.selector:'uiDtContextMenu'`, `files`/`deps` before `attach` per the regex ordering constraint); added it to data-table's `addons[]` + 2 `breaking` entries; retired the stale `optionalDependencies` + 5 unused `peerFiles`. Refactored `parseRegistrySource` into the lib (widened key class `[\w/-]`) + guarded `main()` so it's importable; new spec proves slash-key parsing. `--fix` populated the addon (`libFiles:['touch.ts']`, `deps:[context-menu,data-table]`). Fixed the directive's deep import (barrel `../..`) so the addon doesn't absorb parent i18n. Migrated stories; fixed 3 collateral tests with real coverage (peerFiles fixture w/ restore; `tree` for the optional-dep test; positive addon assertion). CLI 410 pass; tsc+ngc+eslint clean; sync in-sync. |
| 3c — Delete context-menu from base + render slots + migrate tests | 2026-06-29 | 96 | Removed ALL context-menu code from the 5,100-line base (inputs, computeds, viewChildren/signals, 7 menu methods, the `ContextMenuComponent` import + template menus/⋮ buttons/`(contextmenu)` listener); base now renders addon ⋮ buttons from `cellActionSlots()`/`headerActionSlots()` and injects `_actions` reactively from `cellActionSlots().length>0`. Kept generic primitives (`getRowContext`/`pinColumn`/`getColumnPin`); preserved the other `_actions` special-column guards. Migrated ~20 base tests → slot-driven base suite + menu localisation in the directive spec. Demo migrated to `uiDtContextMenu` (breaking). Base sheds the `context-menu` dependency. tsc+ngc+eslint clean; 327 pass (2 pre-existing jsdom). Slot `onClick` widened to `Event`. |
