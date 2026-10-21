# Merge the Two `DataTableContextMenuDirective`s — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **Merge-order note (not a prerequisite):** PR #207 (`chore/backlog-sweep`)
> regenerates `packages/cli/src/registry/{component,lib}-baselines.ts`,
> `packages/components/file-sizes.json`, `api-docs.json` and
> `demo/public/component-docs.json`, and turns on `noUnusedLocals` /
> `noUnusedParameters`. This spec regenerates the same generated files again
> (Task 11). Cut the branch from #207's head (or from `master` after it merges),
> never regenerate on a stale base, and never merge the generated files by
> hand — regenerate (`.claude/skills/spec-waves`, "never merge generated files").

**Status:** ✅ Implemented on branch `refactor/merge-data-table-context-menu` (stacked on `chore/backlog-sweep`); review-gate **93/100** on round 4 (84 → 90 → 90 → 93). Gate evidence for the final commit is in the pull request.
**Date:** 2026-10-18
**Source:** follow-up recorded in `repo-hygiene-and-docs-drift-spec.md` §6
(2026-10-17, "duplicate `DataTableContextMenuDirective`: a design decision,
needs its own spec"), then the human's decision on 2026-10-18: *"Merge into the
addon and expand the host contract to include what's needed."*
**Living history:** never delete a completed row, a fixed bug or a superseded
decision — mark it and append below.

---

## Step 0 — what the two directives are, verified against the source

Everything below was read from the tree at branch
`refactor/merge-data-table-context-menu` (cut from `chore/backlog-sweep`,
2026-10-18). Nothing is from memory.

### The two directives, side by side

Both are exported as `class DataTableContextMenuDirective<T = unknown>`. They
share nothing else: no base class, no common helper beyond `onContextGesture`.

| | **Flat** — `ui/data-table-context-menu.directive.ts` (139 lines) | **Addon** — `ui/data-table/addons/context-menu/context-menu.directive.ts` (213 lines) |
|---|---|---|
| Selector | `ui-data-table[uiDataTableContextMenu]` | `[uiDtContextMenu]` |
| Born | earliest commit in its tracked history is the 2026-05-21 file-per-component refactor (`e57aa555`); last touched `b445ed18` (2026-10-12, `onContextGesture`) | `3bbb2300` (2026-06-29, "review 96"), when `e6b684ed` **removed the built-in row/column menu from the table base** so the base ships no `context-menu` code |
| Job | **"Show *my* menu where the user right-clicks."** The consumer owns a `<ui-context-menu>` (templated content, any items, shortcuts, sub-menus) and binds it. | **"Give the table its standard menus."** The directive *builds* the menu: a ⋮ row-actions menu from a `rowActions` callback, and a sort / pin / hide column menu. |
| How it reaches the table | `inject(DataTableComponent, { optional: true })` — the whole component | `inject(DataTableAddonHost)` — the small DI contract the base provides (`data-table.host.ts`) |
| Menu comes from | Input `uiDataTableContextMenu: ContextMenuComponent` (required, doubles as the selector) | Input `rowActions: (RowActionContext<T>) => ContextMenuItem[]`; it creates a `ContextMenuComponent` itself with `vcr.createComponent` and **inherits the table's theme tokens onto it** (`inheritThemeTokens`) |
| Inputs | `uiDataTableContextMenu` (menu), `contextMenuDisabled` (false), `contextMenuRowsOnly` (true) | `rowActions`, `enableColumnMenu` (false) |
| Outputs | `rowContextMenu: TableRowContextMenuEvent<T>`, `headerContextMenu: DataTableHeaderContextMenuEvent` | `rowMenuOpen: RowActionContext<T>`, `columnMenuOpen: ColumnDef<T>` |
| Gesture entry | `onContextGesture(tableElement, …)` in the constructor | `onContextGesture(el, …)` inside `afterNextRender`, torn down on destroy |
| Row detection | `closest('[data-slot="table-row"], [data-slot="data-table-row"], tr[data-row-index]')`; index from `data-row-index` (**defaults to 0** when absent); data from `dataTable.getRenderedRowAt(index)`, falling back to `{ id: data-row-id }` or `{}` | `closest('[data-row-index]')`; index from `data-row-index`; `host.getRenderedRowAt(index)`; **ignores** the gesture when the row is not rendered |
| Header gesture | **Yes**, when `contextMenuRowsOnly` is `false`: `closest('[data-slot="table-head"], [data-slot="data-table-header"], th')`; emits `{ column: { id, name, element }, event }`; opens the menu with that column object | **No.** The header menu opens only from the ⋮ header button |
| Data handed to the menu (`menu.show(x, y, data)`) | Row: the whole `FlattenedTreeRow` merged with `row` (`{ ...treeRow, row }`) in tree mode, else the row; header: `{ id, name, element }` | Row: the `RowActionContext` (`row`, `index`, `selected`, and `depth`/`isLeaf`/`parentRow`/`isExpanded` when sub-rows are on); column: `{ columnKey, column }` |
| Table side effect | Sets `dataTable.focusedCell` to the clicked cell, unless the column is `_selection` / `_expander` | none |
| Touch guard | A one-finger hold on a cell **returns `false` while `enableCellRangeSelection()` is on**, so the hold starts a range selection; a right-click or the key still opens the menu | none: a long-press always opens the row menu |
| Extra UI | none | The ⋮ row button (`registerCellAction`) and ⋮ header button (`registerHeaderAction`) — the table renders them through the host's slot registries |
| Tests | `data-table-context-menu.directive.spec.ts`, 492 lines, 18 tests | `data-table/addons/context-menu/context-menu.directive.spec.ts`, 509 lines, 22 tests, with a `FakeHost` |
| Registry | component `data-table-context-menu` (flat file, deps `context-menu`, `data-table`, **`table-context-menu`** — only to borrow the `TableRowContextMenuEvent` type) | addon `data-table/context-menu` (`parent: 'data-table'`, `requiresBaseFiles: ['data-table/data-table.host.ts']`, `attach.selector: 'uiDtContextMenu'`) |
| Barrel | `ui/index.ts:86` `export * from './data-table-context-menu.directive'` | the addon's own `index.ts` only (addons are not re-exported from `ui/index.ts`) |
| In the compiled package | **No** | **Yes** (`@gilav21/shadcn-angular-data-table`; its README lists it) |
| Used by | demo `data-table-context-menu-demo` (route + nav), `data-table-demo` (two tables), `data-table-context-menu.stories.ts`, `data-table.stories.ts:1107`, `context-menu-integration.stories.ts:375`, e2e harness `data-table-ctx-directive` | CLI `apply` wiring (`apply-wire.spec.ts`, `apply-core.spec.ts`, `why.spec.ts` all name this class and `uiDtContextMenu`), demo `data-table-demo` (two tables), `data-table.stories.ts:1178`, e2e harness `data-table-context-menu`, `pkg-data-table` |

No table in the repo uses both directives at once (`data-table-demo` uses the
flat one on tables 609 and 742 and the addon on 367 and 966).

### Claims checked

| # | Claim | Verdict |
|---|-------|---------|
| V-1 | "They are duplicates." | ❌ **Refuted as stated.** The addon replaced the table's *built-in* menu, not the flat directive, and has capabilities the flat one lacks (⋮ buttons, column sort/pin/hide menu). The flat one has capabilities the addon lacks (bring-your-own menu, header right-click, tree-row context, cell focus, range-selection guard). They **overlap in one gesture** — right-click a row, a menu opens — and nobody decided to keep both. |
| V-2 | The collision is only cosmetic. | ⚠️ **No.** The CLI already special-cases it: `gen-component-docs-lib.ts:64` and its spec say docs are "keyed by file, not class name: `DataTableContextMenuDirective` exists both as a standalone directive and …". The compiled-package README maps the name to `uiDtContextMenu`. An IDE auto-import can pick either file; the two have different selectors and inputs, so the mistake shows at runtime. |
| V-3 | The addon can host the flat directive's behaviour through `DataTableAddonHost`. | ❌ **Not today.** The flat one reaches three things the host does not expose: `focusedCell` (a writable signal), `getRenderedTreeRowAt(index)`, and `enableCellRangeSelection()`. `DataTableComponent` already implements the middle one publicly (`data-table.component.ts:5482`) and has the other two as members; **none is on `DataTableAddonHost`** (`data-table.host.ts`, 96 lines). The touch route chosen in D-6 also needs "is this cell selected": in the range, or the focused cell when there is no range (a 1×1 range collapses to a plain focus when the finger lifts, `onRangeDragEnd`). The table has the parts (`isCellInRange`, `data-table.component.ts:2524`, and `focusedCell`) but no single answer, and the host has neither. |
| V-4 | Adding to the host breaks only the table. | ⚠️ It also breaks every hand-written host in tests: `FakeHost` classes `extends DataTableAddonHost` in `addons/context-menu/context-menu.directive.spec.ts:26` and `addons/export/export.directive.spec.ts:36` (the only two; `pivot` does not). The table provides itself with `useExisting` (`data-table.component.ts:265`) and does not `extends`/`implements` the token, so a **missing method is a runtime error, not a compile error**, in a consumer whose addon is newer than their table (see Risks). |
| V-5 | The flat row finder is a superset of the addon's. | ❌ **Wrong direction.** `[data-slot="table-row"]` matches rows that carry no `data-row-index`; the flat code then **defaults the index to 0** and would attribute a group-header or footer row's gesture to row 0's data. The addon's `[data-row-index]` rule cannot do that. Whether the flat directive's `{ id: data-row-id }` / `{}` fallbacks serve any real DOM is **unverified** — they are exercised only by hand-built DOM in its spec. Task 1 settles it (see Decision D-3). |
| V-6 | Merging needs the addon to import `table-context-menu`. | ❌ It must **not**: that would add `table-context-menu.directive.ts` to the data-table package's closure. The shared event type is structurally `{ row, index, event, depth?, isLeaf?, parentRow? }`; the addon defines its own interface of that shape and TypeScript's structural typing keeps every existing handler typed with `TableRowContextMenuEvent` compiling. |
| V-7 | The breaking-change machinery can announce the rename. | ✅ `BreakingChange { kind: 'selector', from: 'uiDataTableContextMenu', … }` is scanned in consumer templates (`core/breaking-scan.ts:31-41`: a bare identifier `from` is a token; a binding `[token]`, `(token)` or `[(token)]` matches) and `suggestedAddon` points at `apply`. The earlier moves of `rowActions` / `enableColumnMenu` off the table use exactly this (`registry/index.ts:480-481`). It is **data-only**: no CLI logic change. |
| V-8 | My earlier estimate: "touches 3 demos, the stories and 3 e2e harnesses." | ⚠️ **Corrected.** Demos: `data-table-context-menu-demo.component.ts` (plus its route `demo.routes.ts:133` and nav `app.ts:280`) and `data-table-demo.component.{ts,html}` (two uses). Stories: `data-table-context-menu.stories.ts` (delete or fold), `data-table.stories.ts`, `context-menu-integration.stories.ts`, and a text mention in `table-context-menu.stories.ts:114`. E2E: **one** harness (`data-table-ctx-directive`) deleted with its `EXPLICIT_SPECS` entry (`e2e/orchestrator/specs.ts:286-294`), and the addon's own harness (`data-table-context-menu`) extended. Docs: `docs/directives.md:46,52`, plus generated files. |

### Why the existing tests did not catch the problem (CLAUDE.md "When a bug gets past the tests")

Not a bug, but the same shape of question: each directive's spec is thorough
for *its own* behaviour, and no test ever places both on one page or asks
"which one owns the gesture". Answer **case 3**: the combined behaviour (UC-7,
both modes at once; UC-8, neither) is covered by no test. Those are new tests,
written against the merged directive.

---

## PM section

### Business logic

A developer who wants a context menu on a `<ui-data-table>` uses **one**
directive, `uiDtContextMenu`, in one of two modes:

- **Simple mode** — give it a callback. The table gets the ⋮ buttons, a
  right-click row menu built from your items, and (optionally) the standard
  sort/pin/hide column menu.
- **Custom mode** — give it your own `<ui-context-menu>`. It opens on a row
  right-click, a long-press and the context-menu key, and (optionally) on a
  header; it emits the row or column that was hit.

The directive keeps working through the table's public contract
(`DataTableAddonHost`) and never imports the table component.

### Why the customer wants this

Today the library ships two directives with the same class name, different
selectors and different inputs, and the docs, auto-import and the compiled
package README all say "`DataTableContextMenuDirective`" without saying which.
A developer who wants "a menu on right-click" has to learn there are two
products, pick one, and discover afterwards that the other one had the feature
they needed (for example, the addon cannot open a menu from a header
right-click; the flat one cannot give them the ⋮ buttons). The workaround is to
read both source files. The merged directive removes the choice and the
collision, and it is the only one that works in the compiled data-table package.

### Use cases = definition of done

| ID | Use case |
|----|----------|
| UC-1 | **Custom mode, row.** `<ui-data-table uiDtContextMenu [contextMenu]="menu">`: a right-click on a rendered row opens `menu` at the pointer and emits `rowContextMenu` with `row`, `index`, the source event and, in tree mode, `depth`, `isLeaf`, `parentRow`. The menu receives the same data it receives today (`{ ...treeRow, row }` in tree mode, else the row). |
| UC-2 | **Custom mode, touch.** A one-finger long-press on a row opens the menu at the finger and emits exactly what a right-click emits, once, even when the platform also raises a `contextmenu` (Android). |
| UC-3 | **Custom mode, header.** With `[contextMenuRowsOnly]="false"`, a right-click or long-press on a column header opens `menu` with `{ id, name, element }` and emits `headerContextMenu`. With the default (`true`) a header gesture is not taken and the browser menu appears. |
| UC-4 | **Touch and range selection.** In **simple mode** a long-press on a row opens the built menu exactly as it does today, including while `enableCellRangeSelection` is on. In **custom mode** with `enableCellRangeSelection` on, a long-press on a cell that is **already selected** (inside the current range, or the focused cell when there is no range) opens the bound menu and leaves the selection as it is; a long-press on any other **data cell** starts a new range, as today, and opens no menu (the table's range handler ignores a hold on a header, on its own selection / expander / actions columns and on a row's padding, so those open the menu as usual); a right-click and the keyboard key open the menu either way. With range selection off, a long-press opens the menu everywhere. So a touch-only user always has a route to the menu (D-6). |
| UC-5 | **Disabled.** `[contextMenuDisabled]="true"` makes every context gesture on the table fall through to the browser in both modes. The ⋮ buttons are explicit clicks and are unaffected. |
| UC-6 | **Simple mode is unchanged.** `rowActions`, the ⋮ row and header buttons, the column menu (sort / pin / hide, localised), theme inheritance, `rowMenuOpen` and `columnMenuOpen` behave exactly as before. |
| UC-7 | **Both inputs set.** `[contextMenu]` owns right-click, long-press and the key; the ⋮ buttons registered by `rowActions` still open the built menu. Documented, tested, not an error. |
| UC-8 | **Neither input set.** The directive takes no gesture (the browser menu appears) and registers no ⋮ button. |
| UC-9 | **Cell focus.** A row gesture on a cell sets the table's focused cell to that cell, except for the table's own selection, expander and actions columns (the flat directive skipped the first two; the third matches the table's own `cellFromElement`, and is tested). |
| UC-10 | **One directive.** `DataTableContextMenuDirective` is declared exactly once, with selector `[uiDtContextMenu]`. The flat file, its spec, its stories, its registry entry, its e2e harness and its `ui/index.ts` export are gone; `npm run check:registry` is clean. |
| UC-11 | **Host contract.** `DataTableAddonHost` exposes `getRenderedTreeRowAt`, `focusCell`, `isCellRangeSelectionEnabled`, `isCellSelected` and `isEditingCell`; the real `DataTableComponent` returns what it returns today for each; the addon never imports `DataTableComponent`. |
| UC-12 | **Upgrade path.** A consumer who still writes `[uiDataTableContextMenu]` is told, by `npx @gilav21/shadcn-angular update`, the exact replacement, and applying the addon prunes the orphaned flat files (pristine copies only). `update` finds installed components by their first file, so a project that has only the removed flat directive installed keeps its own copy and learns what to do from the note; it is never silently rewritten. |
| UC-13 | **Docs and demos.** The demo page, the Storybook stories and `docs/directives.md` show both modes with copy-paste examples, and no longer describe a second directive. *(Deviation, recorded in the log: the dedicated demo page demonstrates custom mode; simple mode's copy-paste examples are on the data-table demo page and in the `RowActions` / `ColumnMenu` stories, because a new section on the dedicated page needs copy in ten locales.)* |
| UC-14 | **Package.** The compiled `@gilav21/shadcn-angular-data-table` contains the merged directive and **no** new dependency (in particular not `table-context-menu`). |

### Explicitly out of scope

- Changing `table-context-menu`, `tree-context-menu`, `context-menu-attach` or
  `node-editor-context-menu`. (They stay separate: different hosts.)
- Adding new menu items or new table features. Menus are as rich as today.
- A dev-mode warning for the "neither input set" case (UC-8 is silent by
  design; a warning is a possible follow-up).
- Backward-compatible aliases for the old selector or class name (pre-1.0, per
  the project rule). Migration help is limited to the data-only breaking-change
  note and pruning orphaned files (UC-12).
- Merging the two *outputs* pairs (Decision D-2).
- Changing `onContextGesture`.

---

## QA section

> Tests are written **first**. Task 1 produces them red against stubs of the
> new host methods and the new inputs.

### Traceability

| Test | Name | Proves | Type | Red today because |
|------|------|--------|------|-------------------|
| T-1 | `custom mode: a row right-click opens the bound menu with the row (tree row merged in tree mode) and emits rowContextMenu` | UC-1 | unit (addon spec, real DOM + `FakeHost`) | the addon has no `contextMenu` input |
| T-2 | `custom mode: a long-press opens at the finger, emits once, and swallows the echoed contextmenu` | UC-2 | unit | same |
| T-3 | `custom mode: header gestures open the menu with {id,name,element} only when contextMenuRowsOnly is false; a header without attributes falls back to id null, name ''` | UC-3 | unit | same |
| T-4 | `simple mode: a long-press still opens the built menu while range selection is on` and `custom mode, range selection on: a long-press on a selected cell (in the range, or the focused cell with no range) opens the menu, on any other cell it opens none, a right-click and the key open either way; range selection off: a long-press opens` — `it.each` over `{simple, custom} × {in the range, focused with no range, elsewhere} × {touch, mouse}` | UC-4 | unit | the addon has no custom mode |
| T-5 | `contextMenuDisabled releases every gesture in both modes and leaves the ⋮ buttons working` | UC-5 | unit | no such input |
| T-6 | **The addon's existing 22 tests, unchanged** | UC-6 | unit | (must stay green; any edit to them needs a recorded reason) |
| T-7 | `both inputs: contextMenu owns right-click, the ⋮ button opens the built menu` | UC-7 | unit | no `contextMenu` |
| T-8 | `neither input: the gesture is not taken and no ⋮ button is registered` | UC-8 | unit | partly (no ⋮) |
| T-9 | `a row gesture focuses the clicked cell unless the column is _selection or _expander` — asserts the **host** call, not a private field | UC-9 | unit | no `focusCell` on the host |
| T-10 | `the real DataTableComponent: getRenderedTreeRowAt, focusCell, isCellRangeSelectionEnabled and isCellSelected behave as the members they wrap` — a component test over a tree table and a range-selection table | UC-11 | unit (`data-table.component*.spec.ts`) | host methods absent |
| T-11 | `a row without data-row-index (group header, footer) is not taken as row 0` — the V-5 hazard | UC-1, UC-6 | unit + e2e | the flat rule takes it |
| T-12 | `the merged directive on a real table in a pristine consumer app: right-click row → custom menu with the row; header right-click; ⋮ button → built menu` | UC-1, UC-3, UC-6, UC-7 | e2e (extend harness `data-table-context-menu`) | no custom mode |
| T-13 | `registry: data-table-context-menu is gone, data-table/context-menu has no table-context-menu dependency, no flat file remains, obsoleteFiles lists the two orphans` | UC-10, UC-12, UC-14 | unit (`sync-registry` / `check:registry` fixtures) + gate | entry exists |
| T-14 | `update reports uiDataTableContextMenu with the exact replacement and the addon to apply` | UC-12 | CLI unit (`breaking-scan.spec.ts`) | no such entry |
| T-15 | `the data-table package source contains the merged directive and imports nothing from table-context-menu` | UC-14 | e2e (`pkg-data-table`) + gate | — |
| T-16 | Storybook: a story per mode passes axe | UC-13 | Storybook a11y | — |
| T-17 | README / docs read-through: `docs/directives.md` has one row; demo page shows both modes | UC-13 | gate evidence | two rows |
| T-18 | `table: a touch long-press inside a multi-cell range keeps the range; outside it starts a new one` — extends the existing touch range tests (`data-table.component.spec.ts`, "drives a touch-based range drag via onPointerDrag", "long-press is a no-op …") | UC-4 | unit | the table restarts the range on every hold |
| T-19 | `custom mode: the long-press decision is taken at touchstart, so it does not depend on which handler fires first` — the table's range handler is made to fire first and re-anchor the range onto the pressed cell; the directive must still treat an outside press as outside | UC-4 | unit | no such snapshot |

### Edge cases and failure modes the tests must cover

- **Inputs, as classes** ("Writing Tests" step 2): flat table rows; tree rows
  (root, nested, leaf); a row index with no rendered row; a group header and a
  footer row (no `data-row-index`); a header with and without `data-column-id`
  and with surrounding whitespace in its text; a cell in `_selection`,
  `_expander` and a data column; right-click, keyboard key (`contextmenu` with
  no pointer), one-finger long-press, and long-press plus echoed `contextmenu`;
  `enableCellRangeSelection` on and off; RTL.
- **Lifecycle:** destroying the table removes the gesture listener and destroys
  a built menu; changing `contextMenu` from one menu to another, or to
  `undefined`, takes effect on the next gesture (no stale reference); toggling
  `rowActions` while a custom menu is bound keeps ⋮ working.
- **Accessibility:** the custom menu is the consumer's; the built menu keeps its
  existing keyboard behaviour; the ⋮ buttons keep their `aria-label`s and the
  44 px touch target; the long-press has the touch alternative required by
  CLAUDE.md §6 (it is the touch alternative to `contextmenu`).
- **Mutation checks before done** (derive each from the contract):
  (a) drop the `isCellRangeSelectionEnabled()` guard in custom mode → T-4 red;
  (h) apply that guard to simple mode too → T-4's simple-mode case red;
  (i) evaluate "selected" when the hold fires instead of at touchstart → T-19 red;
  (j) make the table restart the range on a hold on a selected cell → T-18 red;
  (b) take the first matching row without requiring `data-row-index` → T-11 red;
  (c) stop calling `focusCell` for non-special columns → T-9 red;
  (d) make `contextMenuDisabled` also suppress the ⋮ button → T-5 red;
  (e) hand the menu `row` instead of `{ ...treeRow, row }` in tree mode → T-1 red;
  (f) let the built menu win over `contextMenu` when both are set → T-7 red;
  (g) delete `getRenderedTreeRowAt` from the host → T-10 and the type check red.
- **Coverage:** 100 % lines on the changed addon file; the four host members
  are covered by T-10; the deleted files take their coverage with them.

---

## Architecture section

### Usability — the public API

**Simple mode (unchanged):**

```html
<ui-data-table
  [data]="rows" [columns]="columns"
  uiDtContextMenu
  [rowActions]="rowActions"
  [enableColumnMenu]="true" />
```

**Custom mode (what the flat directive does today):**

```html
<ui-context-menu #menu>
  <ui-context-menu-item (click)="edit()">Edit</ui-context-menu-item>
  <ui-context-menu-item (click)="remove()">Delete</ui-context-menu-item>
</ui-context-menu>

<ui-data-table
  [data]="rows" [columns]="columns"
  uiDtContextMenu
  [contextMenu]="menu"
  [contextMenuRowsOnly]="false"
  (rowContextMenu)="onRow($event)"
  (headerContextMenu)="onHeader($event)" />
```

**Migration (what `update` prints for UC-12):**

```html
<!-- before -->  <ui-data-table [uiDataTableContextMenu]="menu" (rowContextMenu)="onRow($event)" />
<!-- after  -->  <ui-data-table uiDtContextMenu [contextMenu]="menu" (rowContextMenu)="onRow($event)" />
```

and `import { DataTableContextMenuDirective } from '@/components/ui/data-table/addons/context-menu'`
(the class name is unchanged; only the module path and the selector change).

Final input and output list (names fixed here, types in code):

| Member | Type | Mode | Notes |
|---|---|---|---|
| `rowActions` | `(context: RowActionContext<T>) => ContextMenuItem[]` | simple | existing |
| `enableColumnMenu` | `boolean` (false) | simple | existing |
| `contextMenu` | `ContextMenuComponent \| undefined` | custom | **new** |
| `contextMenuDisabled` | `boolean` (false) | both | **new**, gestures only (UC-5) |
| `contextMenuRowsOnly` | `boolean` (true) | custom | **new**; header gestures need `false` |
| `rowMenuOpen` / `columnMenuOpen` | `RowActionContext<T>` / `ColumnDef<T>` | simple | existing |
| `rowContextMenu` | `DataTableRowContextMenuEvent<T>` | custom | **moved** from the flat directive |
| `headerContextMenu` | `DataTableHeaderContextMenuEvent` | custom | **moved** |

Gesture routing, as a rule the code and tests both state:

1. `contextMenuDisabled()` → not taken.
2. Custom mode only: a touch long-press while `host.isCellRangeSelectionEnabled()` is **not taken** when the pressed spot was an **unselected data cell** at touchstart (`host.isCellSelected`, sampled by the directive's own passive `touchstart` listener, D-6): that hold belongs to range selection. A hold on a selected cell, a header, a table-owned column or a row's padding is taken as usual. Simple mode has no such rule.
3. The target is inside a row (`[data-row-index]`):
   `contextMenu()` set → custom row path; else `rowActions()` set → built row
   path; else not taken.
4. Otherwise the target is inside a header and `contextMenu()` is set and
   `contextMenuRowsOnly()` is `false` → custom header path; else not taken.

### The host contract (what is added to `DataTableAddonHost`)

```ts
// data-table.host.ts — five additions (the fifth came out of review round 3), all documented where they are declared
/** The flattened tree row at a rendered index (depth, path, expansion), or undefined outside tree mode or out of range. */
abstract getRenderedTreeRowAt(index: number): FlattenedTreeRow<T> | undefined;
/** Move the grid's keyboard focus to a cell (the cell a context gesture landed on). */
abstract focusCell(rowIndex: number, columnKey: string): void;
/** Whether cell range selection is on (a finger's hold on a cell then starts a range). */
abstract isCellRangeSelectionEnabled(): boolean;
/** Whether a cell is selected: inside the current range, or the focused cell when there is no range. */
abstract isCellSelected(rowIndex: number, columnKey: string): boolean;
/** Whether a cell is open in the inline editor (the table's range handler ignores every touch hold meanwhile). */
abstract isEditingCell(): boolean;
```

`DataTableComponent` implements them as one-line wrappers over what it already
has (`processedTreeRows()[index]`, `focusedCell.set({ rowIndex, columnKey })`,
`enableCellRangeSelection()`, and the public `isCellInRange` plus `focusedCell` for `isCellSelected`; `editingCell() !== null` for `isEditingCell`). The host file imports `FlattenedTreeRow` for its own signature; addon authors already get the type from the `data-table` barrel (`export * from './data-table.types'`), so it is **not** re-exported from the host file (this section said it would be; recorded in the log). Both FakeHosts get stubs.

### Efficiency

No new hot path. Gestures are rare; the new work is one `closest` plus two
host calls per gesture. The directive registers one `onContextGesture` listener
per table, as each directive does today (it is **one** now instead of up to two
if both had been placed on a table). Budget: unchanged; no measured assertion
is claimed because there is no perf claim.

### DX for the consuming developer

- **Learn:** one directive, one attribute, two modes, and the routing rule above.
- **Ignore:** the host contract (addon authors only).
- **Types they touch:** `DataTableContextMenuDirective`,
  `DataTableRowContextMenuEvent<T>`, `DataTableHeaderContextMenuEvent`,
  `RowActionContext<T>`, `ContextMenuItem`.
- **Wrong-hold messages:** the `update` note for the old selector (UC-12). A
  table with `uiDtContextMenu` and neither input simply does nothing (UC-8); a
  dev-mode warning is a recorded follow-up, not part of this spec.

### Implementation options

#### Decision D-1 — how to remove the duplication

**Option 1 — merge the flat directive's behaviour into the addon as a second
mode, extend the host, delete the flat file.**
Pros: one class, one selector, one place; keeps the addon architecture (the base
imports no addon; addons use only the host); the capability the flat directive
had is preserved and gains the compiled package; matches the dual-mode pattern
in `CLAUDE.md`. Cons: touches ~25 files; grows the host contract (four
members); a breaking selector change for flat-directive users (mitigated by the
data-only breaking note).

**Option 2 — rename the addon directive only** (for example
`DataTableRowActionsDirective`).
Pros: smallest change; removes the name collision. Cons: leaves the overlap
(two ways to open a menu on a row right-click) and the two-products confusion;
renames a class the CLI's own `apply` wiring and the published package README
name.

**Option 3 — move the addon's built menus into the flat directive.**
Pros: the flat directive already handles gestures and headers. Cons: the flat
directive injects `DataTableComponent`, the coupling the addon pattern exists to
remove; the built-in menu and its ⋮ slots would drag the table back into
depending on the flat file; the compiled package would need the flat file and
`table-context-menu`.

**Option 4 — keep both, share a base class.**
Pros: no breaking change. Cons: keeps two selectors and two classes; the
confusion is the problem.

**✅ Chosen: Option 1**, as the human decided. Option 2 is the cheap fallback
if the host expansion turns out larger than estimated; Options 3 and 4 are ruled
out for the reasons above so a future agent does not re-litigate them.

#### Decision D-2 — the API of custom mode

**A — the selector doubles as the input** (`[uiDtContextMenu]="menu"`, an alias
input typed `ContextMenuComponent | ''`).
Pros: shortest. Cons: a bare `uiDtContextMenu` attribute (simple mode, today's
usage, shipped in the package README) would bind `''` to a menu input — a type
union and a runtime check for an empty string.

**B — the selector is a marker, the menu is a named input**
(`uiDtContextMenu [contextMenu]="menu"`).
Pros: consistent with the sibling addons (`uiDtExport` plus
`[exportDataProvider]`); typed `ContextMenuComponent | undefined`; today's bare
usage is untouched. Cons: two attributes where the flat directive had one.

**✅ Chosen: B.** Outputs: **keep both pairs** (`rowMenuOpen`/`columnMenuOpen` for
the built menus, `rowContextMenu`/`headerContextMenu` for a bound menu). Their
payloads differ (`RowActionContext<T>` vs the event with the source event and
tree fields) and unifying them would change a published output's payload.

#### Decision D-3 — how a row is found (V-5)

The merged rule is the addon's: `closest('[data-row-index]')`, rows not rendered
by the table are ignored. Task 1 inspects the real DOM the table renders (data
rows, group headers, footers, pivot and tree rows) and records whether any row
that should open a menu lacks `data-row-index`. **Decision rule:** if none does,
the flat directive's selectors, its index default of 0 and its
`{ id: data-row-id }` / `{}` fallbacks are dropped and their tests are deleted
with a note in the log; if some do, the table is changed to emit
`data-row-index` on them (a base change, recorded), never the directive to
guess.

#### Decision D-4 — the row event type

The addon defines `DataTableRowContextMenuEvent<T>` (same fields as
`TableRowContextMenuEvent<T>`) in a support file `context-menu.types.ts` in the
addon folder, together with `DataTableHeaderContextMenuEvent`, so the addon has
no import from `table-context-menu` (V-6).

#### Decision D-5 — behaviour changes in simple mode

Three simple-mode behaviours change; they are recorded so they are decisions,
not accidents (the first draft of this section said "exactly one"; the other two
were found by review and are corrections):

1. **`contextMenuDisabled` (UC-5)** now also silences the built menu's gestures.
   There was no way to do that before.
2. The built row menu tests `getRenderedRowAt(index) === undefined` where it
   tested truthiness, so a falsy row such as `0` is no longer dropped.
3. A row element with no `data-row-index` gives `NaN`, which is not taken,
   where it used to be read as index 0.

~~**Range-selection guard.** The first draft also applied the custom mode's
guard to simple mode, so a long-press with `enableCellRangeSelection` on would
no longer open the built row menu.~~ **Superseded 2026-10-18.** The human asked
why a touch long-press would be removed ("it's a mobile need"). It is: the table's
own touch range selection is "long-press a cell, then drag" (a 500 ms hold,
`setupTouchRangeSelection` in `data-table.component.ts`), the same hold the
context-menu long-press uses, and the guard only exists because the two collide.
Simple mode keeps its long-press unchanged.

#### Decision D-6 — a touch route to the custom-mode menu on a range-selection table (was OQ-1)

**Chosen 2026-10-18 by the human: option 2.** The problem: with
`enableCellRangeSelection` on, a touch-only user had no way to open a bound menu
(no right-click, no keyboard key, no ⋮ button in custom mode). The flat
directive has always had this gap; the first draft carried it over unflagged,
against the touch rule of CLAUDE.md §6. The options were: (1) keep it and
document it, (2) open the menu when the hold lands **inside the current range**
(the spreadsheet convention), (3) add a ⋮ row button to custom mode. Options 1
and 3 are ruled out: 1 leaves the gap, 3 adds UI nobody asked for.

How option 2 works, so the code and the tests agree:

- **"Selected" means:** inside the current range, **or** the focused cell when
  there is no range. The second half matters: a 1×1 range collapses to a plain
  focus when the finger lifts (`onRangeDragEnd`), so after a hold or a tap that
  selects one cell, the table holds only a focused cell, not a range. (The first
  draft of this decision said a tap leaves a 1×1 range; the code says otherwise,
  and "inside the range" alone would have given a touch user no route to the menu
  for a single cell. Corrected 2026-10-18 while writing the tests.)
- The table's range handler (`setupTouchRangeSelection`) **does not restart the
  range when the hold lands on a selected cell**; on any other cell it starts a
  new range exactly as today. This is a base change and applies even to a table
  with no menu directive (T-18).
- The directive reads `host.isCellSelected(row, column)` for the pressed cell in
  its own passive `touchstart` listener and keeps that answer until the next
  touchstart. When the hold fires (or the platform echoes a `contextmenu`) it
  takes the gesture only if the answer was "selected". Sampling at touchstart makes
  the result independent of which of the two 500 ms handlers fires first: the
  table's handler may already have re-anchored the range onto the pressed cell
  by then (T-19, mutation (i)).
- The sequence on a phone: hold an unselected cell → it is focused and a range
  starts (no menu); lift (a lone cell collapses to a focus); hold the same cell
  again → it is selected → the menu opens. Drag out a range first, lift, hold
  inside it → the menu opens for that range.

**Cost, accepted:** on a table with range selection on, holding on the focused
cell or inside an existing range no longer starts a fresh drag from there; the
user holds on a different cell to start one. **Editing a cell:** the table's range handler ignores every hold while a
cell is being edited (`editingCell() !== null`). The first draft of this spec left
that as a known edge (a hold on an unselected data cell then did nothing in either
handler, a touch dead end); review round 3 flagged it and it is fixed with a fifth
host member, `isEditingCell`: while a cell is being edited the directive no longer
yields, so the menu opens. Simple mode is unaffected: its hold
still opens the built menu, and the range handler's new rule only changes whether
the range is restarted.

### Risks

| Risk | Mitigation |
|------|------------|
| A consumer has an **older table** and a **newer addon**: the new host methods do not exist, so `host.focusCell is not a function` at the first gesture | The addon entry already carries `requiresBaseFiles: ['data-table/data-table.host.ts']`; Task 9 verifies, with a CLI unit/e2e over `update`, that updating the addon also brings the table component that implements the methods (the entry depends on `data-table`). If that is not guaranteed, the addon is given a defensive check of the four members at construction with a clear error, and this risk is raised as a blocker before merging. |
| The selector rename is silently missed by a consumer | UC-12: the breaking note is scanned in templates by `update`; T-14 asserts it fires for `[uiDataTableContextMenu]`, `(rowContextMenu)` alone does not. |
| A group-header or footer row opens a menu for the wrong row | D-3 and T-11; mutation (b). |
| Two outputs pairs confuse readers | The JSDoc on each output says which mode emits it; the demo shows each. |
| Orphaned flat files remain in consumers' projects | `obsoleteFiles` on the addon entry lists `data-table-context-menu.directive.ts` and its spec; T-13. |
| The change reaches the compiled data-table package | Expected (UC-14): a `release:package -- data-table` is required; Task 11 computes the verdict with the tooling and records it. The CLI verdict is computed too (the bundled baselines regenerate, so a CLI release is expected, as in #207). |
| Generated files conflict with PR #207 | See the merge-order note; regenerate, never merge. |

---

## Task table (order = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | **Inspect first, then write failing tests.** (a) Render a real `<ui-data-table>` in a browser spec (flat, tree, grouped, with footer, pivot) and record which rows carry `data-row-index` (Decision D-3); (b) write **T-1…T-5, T-7…T-11, T-18, T-19** against stubs of the four host members and the new inputs; keep the addon's 22 existing tests untouched as **T-6**; record the red list in the log | UC-1…UC-5, UC-7…UC-9, UC-11 | ✅ Done | 2026-10-18 22:20 | 93 | A real-table DOM probe found two bugs in the old directive that hand-built DOM could not show (a header right-click reported row 0, and so did a grouped row); the red list stayed honest because the 22 existing tests passed untouched. |
| 2 | **Extend the host and the table.** Add `getRenderedTreeRowAt`, `focusCell`, `isCellRangeSelectionEnabled`, `isCellSelected` and the `FlattenedTreeRow` re-export to `data-table.host.ts`; implement them in `DataTableComponent`; make the touch range handler keep the selection on a hold on a selected cell (D-6, **T-18**); add stubs to both `FakeHost`s; T-10 and T-18 green; run the **consumers**: `npx vitest --run packages/components/ui/data-table` (all addons) | UC-11 | ✅ Done | 2026-10-18 22:20 | 93 | Making the table `implements` the host turned a missing member into a compile error; the one-cell range collapsing to null (`onRangeDragEnd`) corrected my D-6 design before any code depended on it. |
| 3 | **Add the types file** `context-menu.types.ts` (`DataTableRowContextMenuEvent<T>`, `DataTableHeaderContextMenuEvent`) and export it from the addon barrel | UC-1, UC-3 | ✅ Done | 2026-10-18 22:20 | 93 | A support types file kept the addon free of any import from another directive, so the compiled package gained one file and no dependency. |
| 4 | **Implement custom mode** in the addon directive: `contextMenu`, `contextMenuDisabled`, `contextMenuRowsOnly`, the two outputs, the routing rule, the cell-focus side effect and the range-selection guard; keep the structure under cognitive complexity 15 (extract the row, header and routing helpers); T-1…T-9, T-11 green and the 22 existing tests still green | UC-1…UC-9 | ✅ Done | 2026-10-18 22:20 | 93 | The first version yielded to range selection for every touch hold; review showed that stranded the header and table-owned columns, and the final rule is decided at touchstart for an unselected data cell only. |
| 5 | **Migrate the demos and stories.** `data-table-context-menu-demo.component.ts` (custom mode, keep its route and nav), `data-table-demo.component.{ts,html}` (drop the `Flat…` alias; two tables move to `uiDtContextMenu [contextMenu]`), `data-table.stories.ts`, `context-menu-integration.stories.ts`, the text in `table-context-menu.stories.ts`; fold `data-table-context-menu.stories.ts` into stories for the addon (one per mode, all options); every demo keeps a copy-paste example | UC-13 | ✅ Done | 2026-10-18 22:20 | 93 | Demos and stories migrated cleanly; the dedicated demo page stays custom-mode only because a new section needs copy in ten locales (recorded under UC-13). |
| 6 | **Remove the flat directive.** Delete `ui/data-table-context-menu.directive.ts`, its `.spec.ts` and `.stories.ts`, the `ui/index.ts:86` export; delete the registry entry `data-table-context-menu` (CLI literal) and its `portable-tests.json` entry; add `obsoleteFiles` to `data-table/context-menu`; add the `BreakingChange` (`kind: 'selector'`, `from: 'uiDataTableContextMenu'`, `suggestedAddon: 'data-table/context-menu'`, note with the exact before/after) — on the entry the scan reads for installed components (verify in `breaking-scan.ts`; if the addon's `breaking` is not scanned, put it on `data-table`); `sync-registry --fix`; T-13, T-14 | UC-10, UC-12, UC-14 | ✅ Done | 2026-10-18 22:20 | 93 | Removal plus registry data was small; a pruning test against the real last published source proved the regenerated baselines recognise the old file, and exposed that baselines hold no specs. |
| 7 | **E2E.** Extend `e2e/harness/data-table-context-menu` with custom mode (row, header, both-inputs) — **T-12**; delete `e2e/harness/data-table-ctx-directive` and its `EXPLICIT_SPECS` entry (`e2e/orchestrator/specs.ts:286-294`, per CLAUDE.md the only legitimate edit of that file); run `npm run e2e -- data-table-context-menu`, `pkg-data-table`, `pkg-data-table-ng21`, `data-table`, `data-table-pivot`, `data-table-export` | UC-1, UC-3, UC-6, UC-7, UC-14 | ✅ Done | 2026-10-18 22:20 | 93 | The addon harness gained a custom-mode table; the two `ng serve` timeouts in the full run were cold-start flakes and passed serially. |
| 8 | **Docs.** `docs/directives.md` rows 46 and 52 (one directive, two modes, the collision note removed), the data-table package README row, JSDoc on every new input and output; `npm run docs:regen` (restore `documentation.json`) and `docs:check`; **T-17** | UC-13 | ✅ Done | 2026-10-18 22:20 | 93 | The docs generator had to learn that a route named after an addon is its own page; diffing the payload showed exactly one component changed page. |
| 9 | **The stale-table risk.** Prove with a CLI test or an e2e over `update` that bringing the addon forward also brings the table that implements the host methods; if it cannot be guaranteed, add the construction-time check and record it | UC-11, UC-12 | ✅ Done | 2026-10-18 22:20 | 93 | The CLI cannot guarantee a newer addon meets a newer table, so custom mode reports one error through the ErrorHandler and steps aside; throwing from the effect had also stopped the gesture listener from registering. |
| 10 | **Mutation checks (a)–(j)** from the QA section, each red then restored; record the results | all | ✅ Done | 2026-10-18 22:20 | 93 | Sixteen mutations were red; one of my own tests survived its mutation and was rewritten until it was killed, which is what exposed the thrown-effect problem. |
| 11 | **Close.** `npm run check:all`, `check:registry`, `check:completeness`, regenerate once (component and lib baselines via `packages/cli` build + `gen-component-baselines.mjs` / `gen-lib-baselines.mjs`, `docs:sizes`, `docs:regen`), `npm run test-visual` (zero failures), `npm run verify:portable -- data-table/context-menu` (both legs, if the entry stays verified), Storybook axe on the new stories (**T-16**; run one pattern per invocation — the launcher takes a single path pattern), `npm run e2e:impact -- --base origin/master` and run the impacted set serially if load makes `ng serve` slow, then `npm run sonar:gate` with the four-condition verdict from CLAUDE.md §4 (no `coverage] FAILED`, `SCM revision ID` equals HEAD, `coverage/.tree-hash` current, server gate OK and `inNewCodePeriod` issues 0). **Release verdicts** from the tooling (`release:cli -- patch --dry-run`, `release:package -- data-table patch --dry-run`), recorded in the PR description | all | ✅ Done | 2026-10-18 22:20 | 93 | Portable jsdom leg 100 % lines and the jest leg identical to master, Storybook axe clean, e2e green, Sonar gate OK, release verdicts computed from the tooling; four review rounds (84, 90, 90, 93) each found real, fixable items. |

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

_Append per task: the DOM inspection result for D-3, the red lists, the
mutation-check results, the stale-table finding, gate evidence and the release
verdicts._

| Date | Task | Event |
|------|------|-------|
| 2026-10-18 | — | Spec written on branch `refactor/merge-data-table-context-menu` after the human chose "merge into the addon and expand the host contract". Step 0 corrected two earlier statements: the directives are not duplicates (the addon replaced the table's *built-in* menu), and the e2e blast radius is one harness plus the addon's own, not three. It also found the flat row finder's index-0 default (V-5) and that the host lacks exactly three members the flat directive needs (V-3). |
| 2026-10-18 | UC-4, D-5 | **Revised after the human asked "why remove the touch long-press?"** The first draft applied the range-selection guard to simple mode too. Checked against the code: the table's touch range selection is a 500 ms long-press (`setupTouchRangeSelection`), the same hold as the context-menu long-press, which is why the flat directive steps aside when `enableCellRangeSelection` is on. Simple mode now keeps its long-press; the guard stays custom-mode-only. The same check exposed that the guard leaves touch-only users with no way to open a custom-mode menu on a range-selection table (OQ-1, awaiting the human's choice). |
| 2026-10-18 | D-6 (was OQ-1) | **Human chose option 2.** Spec updated: `isCellInRange` joins the host (four members, not three; the table already has it publicly at `data-table.component.ts:2524`), the table's touch range handler keeps the range on a hold inside it, and the directive samples "inside the range" at touchstart so the result does not depend on handler order. UC-4, the routing rule, T-4, new T-18 / T-19, mutations (i)–(j) and Tasks 1–2 revised. Options 1 and 3 recorded as ruled out. |
| 2026-10-18 | 1 (a) | **DOM inspection of a real `<ui-data-table>` (D-3), measured with a throwaway browser spec, since deleted.** Rows that carry `data-row-index`: data rows in the flat, tree and virtual-scroll templates. Rows that do **not**: the header row, an expanded **detail** row, group-header rows, **grouped data rows** (they carry `data-row-id` only, and grouping partitions `sortedData()` so a "rendered index" is undefined for them), the spacer row and the footer row. Every one of them still matches `[data-slot="table-row"]`. **Two pre-existing bugs in the flat directive, reproduced on a real table:** (1) a **header** right-click with `contextMenuRowsOnly=false` emits `rowContextMenu` for row 0 (`ROW idx=0 Alice`) and never `headerContextMenu`, because the header row itself matches the row selector; (2) a body right-click in a **grouped** table emits `idx=0` with row 0's data whatever was clicked. Its hand-built-DOM spec could not see either. **Outcome for D-3:** the merged directive resolves rows only through `[data-row-index]` (so both bugs are fixed by construction, and detail, footer and spacer rows are not taken); the `data-row-id` / index-0 fallbacks are dropped and their tests deleted. **Deviation from D-3's second branch, recorded:** grouped data rows lack `data-row-index` but the table is **not** changed to emit one, because a rendered index has no defined meaning under grouping; a grouped table's row gestures therefore fall through to the browser menu (it previously opened a menu with the wrong row). Follow-up for the human: give grouped rows a defined row identity for menus. T-3 and T-11 must run on the real table, not on hand-built DOM. |
| 2026-10-18 | D-6, host contract | **Corrected while writing the tests.** The table's `onRangeDragEnd` collapses a 1×1 range to a plain focus (`cellRange` becomes null), so after a tap or a lone hold there is no range at all and "inside the range" never holds for a single cell. The fourth host member is therefore `isCellSelected(rowIndex, columnKey)` (in the range, or the focused cell when there is no range), not `isCellInRange`; the table keeps `isCellInRange` as is. UC-4, T-4, T-10, T-18, T-19, mutations (i)–(j), Task 2 and the D-6 walk-through revised. Side effect, recorded as the accepted cost: holding on the focused cell no longer starts a fresh drag. |
| 2026-10-18 | 1 (b) | **Red list (tests written first, nothing implemented).** `addons/context-menu/context-menu.directive.spec.ts`: the **22 existing tests (T-6) still pass**; of 22 new tests, 14 fail for the stated reason (no `contextMenu` input, no `contextMenuDisabled`, no `contextMenuRowsOnly`, no outputs, no `focusCell` call) — T-1 (2 cases), T-2, T-3 (2), T-4 (3), T-5 (built-menu case), T-7, T-9 (3 cases), the swap test; the other 8 are guard tests that pass vacuously until the directive takes any gesture (header-by-default, neither-input, detail row, outside, destroyed, the simple-mode long-press, T-19 and the custom-mode disabled case) and are proven by mutation checks (a)–(j), not by this list. `data-table.host.spec.ts` (T-10): `focusCell`, `isCellRangeSelectionEnabled` and `isCellSelected` fail (not a function); `getRenderedTreeRowAt` passes because the table already has it publicly, so it now pins the contract. `data-table.component.spec.ts` (T-18): fails — the table restarts the range on every hold. New `addons/context-menu/context-menu.table.spec.ts` (real table): the row and header cases fail; the detail/footer/grouped cases are guards. |
| 2026-10-18 | 10 | **Mutation checks, all red then restored.** (a) custom mode ignores the touch rule → T-4 "any other cell" and T-19 red; (b) any `table-row` counts as a row (the old flat rule) → T-3 header tests red in both the hand-built and the **real-table** spec; (c) the clicked cell is never focused → T-9 red; (c2) the table-owned columns are focused too → T-9 red; (d) `contextMenuDisabled` removes the ⋮ button → T-5 red; (e) the menu gets `row` instead of the merged tree row → T-1 (tree) red; (f) the built menu wins over a bound one → T-7 red; (g) a host member deleted → `tsc` fails in the directive and in the host spec; (h) the touch rule also applies to simple mode → T-4 simple-mode case red; (i) "selected" decided when the hold fires → T-19 red **and** the real-table touch test red, which also shows the table's 500 ms handler really does fire first; (j) the table restarts the range on a hold on a selected cell → T-18 and the real-table touch test red; (k) no report for an older table → red; (l) the touch snapshot reads the host in simple mode → red; (m) a header gesture never reaches the header path → real-table test red. One of my own tests survived its mutation on the first run and was rewritten until the mutation killed it: the older-table fall-through test (it passed because a thrown effect error stopped the gesture listener from registering, so nothing was exercised). |
| 2026-10-18 | 9 | **Stale-table finding.** The CLI cannot guarantee a newer addon meets a newer table: `missingBaseFilesFor` is a file-presence check and `apply` does not update the base. The fallback the spec allows was implemented: binding `[contextMenu]` to a table whose `DataTableAddonHost` lacks the four members now **reports one clear error through the `ErrorHandler`** (not a throw: a thrown effect error also stopped the gesture listener from registering) naming the members and `update data-table`, and custom mode steps aside so gestures fall through to the browser. Simple mode never reads the four members, not even on a touch (the touch listener used to call `isCellSelected` on every touch in every mode; found by a test that captured the uncaught error). The table itself `implements DataTableAddonHost`, so inside this repository a missing member is a compile error; the spec's V-4 said "runtime" only for the cross-file case. |
| 2026-10-18 | review-gate round 1 | Independent reviewer: **84/100**, below the bar. Valid findings fixed: (5) the touch rule yielded to range selection for *every* hold, so a touch-only user could not open the header menu, the selection / actions column or row padding on a range-selection table, although the table's range handler (`cellFromElement`) ignores all of those → now only an unselected **data cell** is left to range selection (new tests for header, the three other spots and an Android echo on a selected cell; mutation-checked); (7) the table's handler and the directive's snapshot were only ever tested separately → new real-table touch test (first hold selects, next hold opens and keeps the selection; three mutations red); (8) the older-table path (above); (6) `_actions` was added to the table-owned columns (matches the table's own `cellFromElement`) without a test → case added to T-9, mutation red; (12) `contextMenu() !== undefined` vs truthiness → one `customMenu()` accessor; (3) the directive-count floor is back to 9, the real count; (4) the host spec set a nonexistent `getSubRows` input (NG0303 noise) → removed; (2) the rewritten focus test in `context-menu.component.spec.ts` builds the flyout by hand so it passes under jest, and a **real keyboard-opened-flyout** version now lives in `context-menu.component.browser.spec.ts` (mutation red). **Deviations the reviewer found and I confirm, now recorded:** (a) Tasks 2–11 rows were not updated while working (they are below); (b) `context-menu.component.spec.ts` and `registry-meta.spec.ts` are outside the spec's file list: the first because the touch fix from the sweep branch had to run under jest too (the jest leg of `verify:portable` is red on master with the same 12 suites and 3 failed tests, measured with a master worktree; after the rewrite this branch matches it exactly: 3 failed / 12 suites, 13 more passing tests at that point), the second because deleting the flat entry changed the directive-entry count; (c) the simple-mode changes are more than D-5's "exactly one": `getRenderedRowAt(index) === undefined` replaces a truthiness test (a falsy row such as `0` is no longer dropped) and a row with no `data-row-index` now yields NaN, which is not taken, instead of index 0; both are corrections, not behaviour anyone relied on; (d) UC-13: the dedicated demo page now demonstrates custom mode only. Adding simple mode there means new copy in all ten locales of `data-table-context-menu-demo.locales.ts`, so simple mode's copy-paste examples are in the data-table demo page (`uiDtContextMenu [rowActions]`, two tables) and in the Storybook stories `RowActions` / `ColumnMenu`; (e) no CHANGELOG edit: `packages/cli/CHANGELOG.md` is generated from conventional commits by `release:cli`; the breaking-change note ships as registry data, which `update` shows. |
| 2026-10-18 | 11 (evidence so far) | `verify:portable -- data-table/context-menu`: jsdom leg green at **100 % lines (125/125)**; jest leg identical to master (3 failed / 12 suites, none new). Storybook axe, one pattern per run: `context-menu` 6 suites / 35 tests and `data-table.stories` 30 tests, no violations. e2e: full suite 215/217 on 3 workers, the 2 failures were `ng serve did not become ready within 120000ms` (`alert`, `alert-dialog`, the first specs started) and pass serially together with `data-table-context-menu` (6 tests, 3 of them new); fixtures reset and pristine. `pkg-data-table` and `pkg-data-table-ng21` are in the 215. `check:all`, `check:registry`, `check:completeness`, `docs:check` clean. Sonar gate and the second review round are recorded below once run. |
| 2026-10-18 | review-gate round 2 | Independent reviewer on the same template, no knowledge of round 1: **90/100**, one point under the bar. Its code findings were all minor (an inaccurate "reported once" comment, the editing-cell edge above, a mouse right-click on a selected cell untested, a pre-existing `as HTMLElement`); the rest was this record: Status and the Task rows not updated, UC-9 / UC-12 / D-5 wording behind the code, and "obsoleteFiles prunes orphans" asserted rather than proven. Fixed: the comment; the missing test; UC-9, UC-12, UC-13 and D-5 now match the code; the edge is recorded; and a new CLI test proves the pruning against the **real last published source** of the removed directive (kept as a fixture): applying the addon removes it when it is clean against the lockfile and when it is untracked but byte-identical to what we shipped (which proves the regenerated baselines recognise it), and keeps an edited copy; the registry mutation (dropping `obsoleteFiles`) turns it red. |
| 2026-10-18 | 11 (release verdicts) | From the release tooling, not guessed: **CLI** `release:cli -- patch --dry-run`: publish REQUIRED (`packages/cli/package.json` MCP floor from the sweep branch, regenerated baselines, the new fixture); **`@gilav21/shadcn-angular-data-table`** `release:package -- data-table patch --dry-run`: release REQUIRED, 9 files (context-menu content, the addon's directive / types / barrel, the table component and its host, dialog, select); **`@gilav21/shadcn-angular-rte`** `release:package -- rte patch --dry-run`: release REQUIRED, 9 files, none from this change (the dialog, parser and colour-picker fixes of the sweep branch). Publishing is manual (2FA) after both PRs merge. The compiled data-table package gains exactly one file (184 staged, `context-menu.types.ts`) and no `table-context-menu`. |
| 2026-10-18 | 11 (gate evidence) | The Sonar gate, its four-condition verdict and the final review score are on the final commit, so they are in the pull request description, not here: a line in this file would need a commit after the scan it describes. |
| 2026-10-18 | review-gate round 3 | Independent reviewer, fresh context: **90/100** again, with the code judged faithful and the findings narrower. Fixed: (1) the table-level T-18 test never held a cell outside a *live* range, so a wrong guard such as `if (this.cellRange()) return` passed it → a case with a live multi-cell range and a hold outside it, mutation red; (3) the stale JSDoc in `gen-component-docs-lib.ts` that still said `DataTableContextMenuDirective` exists twice; (5) the compiled package's README row (`packages/data-table-package/README.md`) now describes both modes; (6) the editing-cell touch dead end → fixed with a fifth host member, `isEditingCell` (host spec, directive spec, older-table list, export fake host, mutation red); (7) the context-menu key on a range-selection table is now tested with the right-click, on a selected and an unselected cell; (8) the second `obsoleteFiles` entry (the removed spec file) is tested too, and that exposed a real limit worth recording: the baselines hold published component sources, **not specs**, so an *untracked* old spec cannot be proven ours and is kept with a warning, while a *tracked* one (the only way a spec is installed, `--include-tests` post-dates the lockfile) is pruned; (9) `buttonRect` uses an `instanceof Element` check instead of an assertion. **Recorded deviations:** (2) `scoreRoute` ranks a route named `parent-addon` first for *every* addon, not just this one; measured by diffing `component-docs.json` before and after, **exactly one component changed page** (`data-table/context-menu`: `data-table` → `data-table-context-menu`), so no other addon page moved; (4) `FlattenedTreeRow` is not re-exported from `data-table.host.ts` (addons get it from the barrel), the host-contract section above now says so. |
| 2026-10-18 | review-gate round 4 | Independent reviewer, fresh context: **93/100**, over the bar; the task rows above were filled in from that score. Remaining observations, all minor: (a) **the grouped-table trade-off stands** (D-3's second branch was not followed: a grouped table has no rendered row index, so a bound menu falls through to the browser there, where the old directive opened it with row 0's data) and is the one capability change for the human to rule on; (b) **touch drift:** the directive decides from the `touchstart` target while the table decides from `elementFromPoint` when the hold fires, so a finger that drifts across a cell boundary inside the slop can make the two disagree (both act, or neither); no test covers it, and the effect is a menu that does or does not open for one hold; (c) **Android native echo on an unselected cell:** the directive declines the hold, so the platform's own `contextmenu` is not claimed and the browser menu may show over the range start; this carries over from the flat directive; (d) the table's range handler now ignores a hold on any selected cell even with no menu bound (a tap followed by a hold on the same cell no longer starts a drag from it), accepted in D-6 and tested by T-18; (e) `registry-meta` and the new `scoreRoute` unit test overlap with `check:registry` and the real-routes test, kept because they fail with a clearer message. The expander column was added to the touch-hold test (mutation red). |
