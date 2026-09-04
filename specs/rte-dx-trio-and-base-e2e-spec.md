# Rich Text Editor — DX Trio + Base E2E Harness

> **Status:** Spec — ready for an executing agent
> **Date:** 2026-09-03
> **Source plan:** `C:\Users\dasha\.claude\plans\look-at-the-richtext-snuggly-cook.md`
> (bundle 1 — items A1, A8, A5, A7; review Rec 16 folded in, see §0)
> **Companion review:** `docs/reviews/rich-text-editor-review.md` (Recs 9, 10, 11, 16;
> "Two gaps worth raising separately")
> This document is append-only history. Never delete a task row, a superseded
> decision or a fixed bug — mark it and add the new entry below.

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.

Other specs in this set depend on **this** one (`markdown-input-rules-and-block-state-toolbar`
extends the typed toolbar table and the base e2e harness; `find-replace-v2-and-undo-consistency`
assumes `RichTextEditorRef` is gone). The exact names those specs reference are
fixed in §D.1 and §D.3 — do not rename them during implementation.

---

## 0. Step-0 verification — what the plan got wrong (⚠️ corrections)

Every claim below was checked against the working tree on 2026-09-03. The
plan doc is not edited by this spec (the brief forbids it); corrections are
recorded here and reported to the lead.

| # | Plan / review claim | What the source says | Consequence for this spec |
|---|---|---|---|
| ⚠️ C-1 | **A1:** "Re-export addons + `RTE_FULL` from the root barrel… extend `sync-registry` to append the barrel lines" (plan A1; review Rec 11). | A base barrel importing or re-exporting anything under its own `addons/` is a **hard error that aborts `sync-registry` in both modes**: `packages/cli/scripts/sync-registry-lib.ts:129-135` (`addonReachedFromBase`), `:205-216` (`AddonBoundary` — "The base must never import or re-export an addon"), `:946-963` (`formatAddonViolationReport`, "Remove the import/barrel re-export"), wired as a blocking issue in `packages/cli/scripts/sync-registry.ts:114-124`. The walk starts at the barrel (`getEntryFile`, `sync-registry-lib.ts:185-186`), so the re-export would also fold every addon file into the base's `files[]` (21 → ~116 files). Independently, in the **copy model** a base barrel that re-exports `./addons/emoji` does not compile for any consumer who installed the base without that addon — which is the default install. | **A1 as written is infeasible and is rewritten.** The "one import line" already exists: `packages/components/ui/rich-text-editor/addons/full/index.ts` (generated, `sync-registry-lib.ts:1088-1113`) named-re-exports all 13 directives **and** `RTE_FULL`. A1 becomes: lock that re-export contract with a test, fix the demo's 12 imports to one `addons/full` import, document it. See §D.4 Option set A. |
| ⚠️ C-2 | Review: "the demo carries 12 lines of deep relative imports". | They are 12 imports of addon **barrels** (`…/addons/<name>`, `demo/src/app/demos/inputs/rich-text-editor-demo.component.ts:13-27`) — not deep imports in `sync-registry`'s sense (those bypass a barrel). Still 12 lines instead of 1. The *addons* demo already does it right (`rich-text-editor-addons-demo.component.ts:7` imports `RTE_FULL` from `addons/full`). | Fix only the main demo. Types (`MentionItem`, `TagItem`) stay imported from the mentions barrel — the generated `full` barrel re-exports directive classes only, by design (NG3004 fix, C-6). |
| ⚠️ C-3 | **A8:** "merge `ICONS` into `TOOLBAR_BUTTONS` as `Record<ToolbarItem, ToolbarButton>`". | `ToolbarItem` includes `'separator'` (`sub/rich-text-toolbar.component.ts:71`), which has no button, icon or label. A `Record<ToolbarItem, …>` cannot be satisfied. Both tables currently have 23 entries for the 23 non-separator members (`:90-114`, `:116-140`) — complete today, but nothing enforces it. The `ToolbarItem` JSDoc also documents a `'link'` item (`:36-37`) that is not in the union. | Key the table by `Exclude<ToolbarItem, 'separator'>` (named `ToolbarButtonItem`). Fix the stale `'link'` JSDoc line. |
| ⚠️ C-4 | Review Rec 10: fallbacks at `getIcon :261` / `getTooltip :273`. | Now at `:370` (`ICONS[key] ?? ''`) and `:387` (`return item`). RTL swap is duplicated in `getIcon :364-369` and `getTooltip :382-385`. | Line numbers updated; the duplicated swap collapses into one helper. |
| ⚠️ C-5 | **A7:** "make `npm run e2e -- rich-text-editor` also run all `rte-*` specs". | `run.ts` matches requested names against spec labels **exactly** (`e2e/orchestrator/run.ts:175-177`) and exits 2 on an unknown name (`:182-187`); there is no glob or group concept in `parse-args.ts`. Harness folders are auto-discovered as `{ names: [folder] }` (`specs.ts:291-332`), so a new `e2e/harness/rich-text-editor/` folder appears with label `rich-text-editor` and installs only the base — correct. The 14 `rte-*` specs are `EXPLICIT_SPECS` entries whose `names[]` all include `'rich-text-editor'` (`specs.ts:104-225`). | Expansion is new orchestrator code (§D.4 Option set D). It is registry-driven: a requested name that is a base component with `addons[]` in the registry (`packages/cli/src/registry/index.ts:964`) expands to every spec whose `names[]` includes that base or one of its addons. |
| ⚠️ C-6 | Brief: "the NG3004 gotcha noted in sync-registry.ts for RTE_FULL re-exports". | The gotcha lives in `sync-registry-lib.ts:1088-1094` (`renderCompositeBarrel` JSDoc): Angular's AOT reference emitter resolves a directive used through `imports: [RTE_FULL]` via the array's own module, so **each class must be named-re-exported from the same barrel** or a consumer build fails with NG3004. The existing unit test only asserts the header and one `import` line (`sync-registry-lib.spec.ts:1565-1571`) — the `export { … }` block is unguarded. | T-1 locks the re-export block. Any future barrel design (including Spec 6's package `public-api.ts`) must keep named re-exports next to the array. |
| ⚠️ C-7 | Brief: "whether `customToolbarItems`/`RichTextEditorRef` deletion (Rec 16) should be folded into A5 if blast radius is zero". | Repo-wide grep for `customToolbarItems\|RichTextCustomToolbarItem\|RichTextEditorRef\|customToolbarAction\|customItemClick\|customItems` hits **only**: the RTE folder's own definition (`rich-text-editor.component.ts:103-117, 232-252, 3303-3322`, `.html:9-10`, `sub/rich-text-toolbar.component.ts:16, 221-224, 404-428`, `.html:24-34`), its specs (`rich-text-editor.component.spec.ts:2241-2268`, `sub/rich-text-toolbar.component.spec.ts:7, 194-~240`), the Storybook argTypes (`rich-text-editor.stories.ts:96-99`), three **generated** docs artifacts (`demo/public/llms.txt`, `demo/public/component-docs.json`, `packages/components/api-docs.json` — regenerated by `npm run docs:regen`), the review itself and a historical plan doc. Zero usages in `demo/src`, `e2e/`, `docs/*.md`. | **Folded in (recommended yes).** Pre-1.0 policy: delete outright, no compat shim. A registry `breaking` entry of `kind: 'removal'` (shape at `packages/cli/src/registry/index.ts:137-152`, precedent `:428`) tells `update` users. The class-helper triplication (A8) collapses to two callers once this lands. |
| ⚠️ C-8 | Review Rec 16 says the base editor "has no e2e coverage… `npm run e2e:scaffold -- rich-text-editor` would create one". | Confirmed: `e2e/harness/` has 14 `rte-*` folders and no `rich-text-editor` folder. The scaffolder (`e2e/orchestrator/scaffold.ts:170-221`) reads the 8 `export *` lines of the base barrel and will emit a `<ui-rich-text-toolbar data-testid="rich-text-toolbar">` child for the `sub/` toolbar export — harmless scaffolding the agent replaces (§D.1 harness template). | Scaffold first (to keep the auto-discovery contract exact), then overwrite the demo/spec bodies. |
| ⚠️ C-9 | Plan A5: "`docs/rich-text-editor.md` documenting… the 8 `register*` hooks". | `rich-text-editor.host.ts` declares **8** `register*` hooks (`:182, 190, 197, 204, 214, 233, 267, 312`) plus ~22 other abstract members; the whole contract is 40 members. Nothing in `docs/` covers the editor (`docs/` holds 7 files, none RTE); `README.md:37` is the only mention. | The guide documents all 8 hooks by name and the full member table, generated-checked by a drift test (T-16) so the guide cannot silently fall behind the host. |
| ⚠️ C-10 | Brief: "whether sync-registry already emits anything into the base barrel". | No. `writeComposites` (`sync-registry.ts:67-73`) writes only the composite barrel (`<parent>/addons/full/index.ts`) and the sibling directives' selector clauses (`sync-registry-lib.ts:1137-1170`). The base barrel `rich-text-editor/index.ts` is hand-maintained and untouched by the sync. | Keep it that way — see C-1. |

**Facts the design rests on (verified, cite-able):**

- Composite barrel today: `addons/full/index.ts` = header + 13 `import` lines + one `export { … }` block of the 13 classes + `export const RTE_FULL = […] as const` (48 lines).
- The base registry entry ships 14 `files[]` + 7 `libFiles[]` = 21 files, `dependencies: ['separator']`, and lists all 14 addons in `addons[]` (`registry/index.ts:960-968`).
- `run.ts` runs component specs through `runOne` (`:73-101`): `init` → `add <names> --yes` → `npm install` → copy harness → `ng serve` → `playwright test e2e/harness/<folder>/<folder>.spec.ts`. Playwright config: `testDir: 'harness'`, 30 s per test (`e2e/playwright.config.ts:18-37`).
- Editor shortcuts dispatch from the editable's own `keydown` (`rich-text-editor.component.ts:833-835`), so Playwright `keyboard.press('Control+f')` with the editable focused reaches `openFindReplace(false)` (`:697-702`); `Control+h` → replace row (`:703-710`); `Control+z` / `Control+y` / `Control+Shift+z` → undo/redo (`:660-675`).
- Table context menu: right-click on a `td`/`th` inside the editable opens it (`onEditorContextMenu`, `:1995-2016`); it renders `<button>`s with the locale strings `Insert Row Below`, `Delete Table`, … (`rich-text-locales.ts:116-140`; template `rich-text-editor.component.html:118-217`). Touch has cell range-select (`onEditorTouchStart`, `:2187-2199`) but **no long-press path to the menu** — a known gap tracked under plan item B5, out of scope here.
- Find panel: `[placeholder="Search text..."]` input, `N/M` counter, `Replace` / `Replace All` buttons (`.html:48-92`; strings `rich-text-locales.ts:106-115`).
- `writeValue` records no history and does not emit (`:729-755`); `registerOnChange` fires on typing/undo (`:757-765`). `mode = input<EditorMode>('markdown')` (`:211`), `markdownChange` / `htmlChange` outputs (`:328-335`).
- Toolbar sub-component tests already exist in `sub/rich-text-toolbar.component.spec.ts` (TestBed, vitest browser). CLI-leg vitest picks up `packages/cli/scripts/**` and `e2e/orchestrator/**/*.spec.ts` (`vitest.config.cli.ts:10`).
- `AddonSlotRegistry` is 19 lines (`packages/components/lib/addon-slots.ts`): `register(slot) → teardown`, reactive `slots` signal. `createLocaleBindings(input, registry, fallback)` at `lib/i18n/i18n.utils.ts:98-107`. The emoji directive (`addons/emoji/rich-text-emoji.directive.ts`, 92 lines) is the canonical minimal addon.

---

## B. Product Manager section

### B.1 Business logic

Four small deliverables that together make the editor **easier to adopt and
extend** without changing any editing behaviour:

1. **One import line for "everything"** — a consumer who installed
   `rich-text-editor/full` imports every addon directive and `RTE_FULL` from
   one barrel. The contract is locked by a test; the demo proves it.
2. **A typed toolbar table** — the built-in toolbar's icon, label, locale key
   and shortcut live in **one** `Record` keyed by the button union, so adding a
   built-in button is one union member + one row, and forgetting the row is a
   compile error instead of a blank button.
3. **One extension path** — the dead `customToolbarItems` API is removed; the
   addon host (`RichTextEditorAddonHost`) is the only way to add toolbar UI,
   and it is documented in `docs/rich-text-editor.md` with a ~40-line worked
   addon that also runs live on the addons demo page.
4. **A base e2e safety net** — `e2e/harness/rich-text-editor/` installs the
   base editor into a pristine consumer app with **no addon** and drives table
   editing, find & replace, undo/redo, markdown round-trip and forms through
   Playwright. `npm run e2e -- rich-text-editor` runs it **and** every `rte-*`
   addon spec.

### B.2 Why the customer wants this

| Pain today | Workaround forced today |
|---|---|
| "I installed `full`, now I need 12 import lines and I have to know the folder layout to find `addons/mentions`." | Read the source tree; copy the demo's 12 imports. |
| "I added a `'superscript'` toolbar item and got a blank button with tooltip `superscript` — no error anywhere." (review §2 "failing silently") | Grep four files for `bold` to find every table to edit. |
| "There are three ways to add a toolbar button (`customToolbarItems`, host slots, `toolbarItems`) — which is canonical?" | Guess; the weakest one (`customToolbarItems`) is the one that looks simplest, and its inserts don't record undo. |
| "How do I write my own addon?" — nothing in `docs/`, the only teacher is a 317-line abstract class. | Reverse-engineer `addons/emoji/`. |
| "I want to refactor the 4.6k-line editor but nothing proves the base still works in a real install." — `npm run e2e -- rich-text-editor` exits 2 "Unknown name". | Run 14 `rte-*` labels by hand and hope an addon spec incidentally covers the base path you touched. |

### B.3 Use cases = definition of done

Written from the consuming developer's point of view. Each is observable
without reading the source and atomic.

**Barrel / one-import (A1, rewritten)**

- **UC-1** In a project with `rich-text-editor/full` installed, the single line
  `import { RichTextEmojiDirective, RichTextTablesDirective, RTE_FULL } from '@/components/ui/rich-text-editor/addons/full'`
  compiles under AOT and both named imports are usable in a standalone
  component's `imports: []` (no NG3004).
- **UC-2** The main demo page (`/rich-text-editor`) imports its addon
  directives through exactly one `addons/full` import statement (down from 12
  addon-barrel imports) and renders identically.
- **UC-3** When a fourteenth addon is added and `sync-registry --fix` runs, the
  regenerated `full` barrel re-exports the new directive class by name **and**
  includes it in `RTE_FULL`, with no hand edit.
- **UC-4** The base `rich-text-editor` registry entry still ships the same 14
  `files[]` (no addon file folded in) and `sync-registry` (check mode) reports
  zero addon-boundary violations.

**Typed toolbar table (A8)**

- **UC-5** Adding a member to the `ToolbarItem` union without adding its
  `TOOLBAR_BUTTONS` row fails `tsc` (a `Record<ToolbarButtonItem, ToolbarButton>`
  missing-property error) — the blank-button failure mode is gone.
- **UC-6** Every built-in button's icon and tooltip come from the one table:
  for each non-separator `ToolbarItem`, `getIcon(item)` yields the table's
  `icon` SVG and `getTooltip(item)` yields the localized label (+ shortcut).
- **UC-7** RTL behaviour is unchanged: under an RTL locale `alignLeft` /
  `alignRight` swap icons and tooltips, `indent` / `outdent` swap icons only —
  the existing toolbar spec assertions for this keep passing.
- **UC-8** The toolbar has one button-class computation shared by built-in and
  addon-slot buttons; both render the identical class list for the inactive
  state and the identical `bg-accent text-accent-foreground` addition when
  active.

**One extension path (Rec 16, folded into A5)**

- **UC-9** `RichTextEditorComponent` no longer has the `customToolbarItems`
  input or the `customToolbarAction` output; `RichTextCustomToolbarItem` and
  `RichTextEditorRef` are no longer exported from the barrel; the toolbar has
  no `customItems` input. A consumer template using `[customToolbarItems]`
  fails to compile (NG8002) rather than silently ignoring it.
- **UC-10** `npx shadcn-angular update rich-text-editor` (and `diff`) shows a
  breaking-change notice of kind `removal` naming `customToolbarItems` and
  pointing to `host.toolbarSlots.register(...)` — driven by a registry
  `breaking[]` entry.

**Addon-author guide + demo (A5)**

- **UC-11** `docs/rich-text-editor.md` exists and contains: the one-import
  section (UC-1), a table of every abstract member of
  `RichTextEditorAddonHost` (all 40, grouped: toolbar/commands, selection &
  mutation, the 8 `register*` hooks, image routing, history, overlay/shortcut),
  the `RichTextToolbarSlot` shape (button vs component slot), and the
  "install as a consumer" boundary (a consumer-written addon is *not* a
  registry entry; it lives in the app).
- **UC-12** The guide's worked example (`uiRteInsertDate`, ≤ 45 lines) is a
  real file in the demo app; the guide embeds it verbatim (import path
  rewritten to the consumer alias). A drift test fails when the doc and the
  file diverge or when the guide omits any host member or any addon directive
  name.
- **UC-13** The addons demo page (`/rich-text-editor-addons`) has a "Write
  your own addon" section: an editor carrying `uiRteInsertDate` whose toolbar
  shows the extra button, clicking it inserts today's date at the caret, and a
  copy-paste code block of the directive; strings localized (en + he) through
  the demo's existing locale pattern.
- **UC-14** `README.md` links `docs/rich-text-editor.md` from the editor
  feature bullet.

**Base e2e harness (A7)**

- **UC-15** `e2e/harness/rich-text-editor/` exists, is auto-discovered (label
  `rich-text-editor`, not in `EXPLICIT_SPECS`), installs **only** the base
  (`add rich-text-editor --yes`), and its demo imports nothing from `addons/`.
- **UC-16** Table editing e2e: right-clicking a cell of a pre-seeded 2×2 table
  opens the context menu; "Insert Row Below" makes 3 rows in the DOM **and** in
  the `ngModel` string; "Delete Table" removes it from both.
- **UC-17** Find & replace e2e: with the editable focused, `Control+h` opens
  the panel with the replace row; typing `Hello` shows `1/2`; `Replace All`
  with `Bye` leaves zero `Hello` and two `Bye` in the model.
- **UC-18** Undo/redo e2e: typing ` appended` then `Control+z` removes it from
  DOM and model; `Control+y` restores it.
- **UC-19** Markdown round-trip e2e: `mode="markdown"` with model `# Title\n\nSome **bold** text`
  renders `<h1>` + `<strong>`; typing more text emits `markdownChange` whose
  value still begins with `# Title` and contains `**bold**`.
- **UC-20** Forms e2e: a `FormControl` bound editor shows the control's initial
  HTML; typing updates `control.value`; `control.disable()` sets
  `contenteditable="false"` and hides the toolbar's clickability
  (`[disabled]` on every toolbar button); `enable()` reverses it.
- **UC-21** `npm run e2e -- rich-text-editor` prints an expansion line and runs
  the base spec plus every spec whose `names[]` includes `rich-text-editor` or
  one of its registry addons (today: 1 + 14). `npm run e2e -- rte-tables`
  still runs exactly one spec. `npm run e2e -- button` is unchanged (no
  `addons[]` → no expansion).

### B.4 Explicitly out of scope

- Any change to editing behaviour, history, find, tables, sanitizer, markdown
  (Specs 2 and 3 own those).
- A generated per-install "installed addons" barrel or any CLI code change
  (would require an npm publish; rejected in §D.4 Option set A).
- Deleting `builtinCommands` (review Rec 17) — kept; near-zero cost, touches
  the abstract host every addon extends.
- Touch long-press for the table context menu (plan B5), toolbar roving
  tabindex (B4), density (B7).
- Extracting `coerceEnabled` to `lib/addon-slots.ts` (Rec 7) and folding the
  9 `*.context.ts` files (Rec 14) — the guide documents the *current* pattern;
  a later spec may simplify it.
- Fixing `rich-text-security.spec.ts`'s deep import (Rec 6).
- Documenting every addon's inputs (compodoc already does; the guide links the
  demo's `app-docs-for` sections).
- Storybook stories for the toolbar (it has none today and gains no new
  visual state; only the dead `customToolbarItems` argType is removed).

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.
> This is the mechanism that keeps implementation honest against the PM
> section.

### C.1 Traceability table

| Test ID | Test name | Proves | Type | File |
|---|---|---|---|---|
| T-1 | `renderCompositeBarrel named-re-exports every sibling class next to the array` | UC-1, UC-3 | unit (cli leg) | `packages/cli/scripts/sync-registry-lib.spec.ts` |
| T-2 | `analyzeComposites adds a fourteenth sibling to both the export block and the array` | UC-3 | unit (cli leg) | same |
| T-3 | `walkTree from the rich-text-editor barrel yields zero addon-boundary violations and no addons/ file` (real tree, not fixture) | UC-4 | unit (cli leg) | `packages/cli/scripts/sync-registry.spec.ts` |
| T-4 | `the full barrel re-exports every directive that RTE_FULL contains` (imports the real `addons/full/index.ts`; `Object.keys(module)` ⊇ every class name in `RTE_FULL`) | UC-1 | unit (browser) | `packages/components/ui/rich-text-editor/addons/full/full-barrel.spec.ts` (new) |
| T-5 | `TOOLBAR_BUTTONS has exactly one row per non-separator ToolbarItem with a non-empty icon` (asserts `Object.keys(TOOLBAR_BUTTONS)` equals the runtime list derived from the default items + every id used in the spec; type-level: `const _check: Record<ToolbarButtonItem, ToolbarButton> = TOOLBAR_BUTTONS`) | UC-5 | unit (browser) | `sub/rich-text-toolbar.component.spec.ts` |
| T-6 | `getIcon returns the table icon and getTooltip the localized label for every button item` | UC-6 | unit (browser) | same |
| T-7 | `RTL locale swaps align icons+tooltips and indent/outdent icons only` (existing `:185-191` kept; extend to assert tooltips) | UC-7 | unit (browser) | same |
| T-8 | `built-in and addon-slot buttons share the class list; active adds bg-accent on both` | UC-8 | unit (browser) | same |
| T-9 | `the toolbar exposes no customItems input` (`fixture.componentRef.setInput('customItems', [])` throws NG0303) | UC-9 | unit (browser) | same — replaces the deleted `custom items` describe (`:194-~240`) |
| T-10 | `the editor exposes no customToolbarItems input and no customToolbarAction output` (`setInput` throws; `'customToolbarAction' in component === false`) | UC-9 | unit (browser) | `rich-text-editor.component.spec.ts` — replaces `:2241-2268` |
| T-11 | `the base barrel exports neither RichTextCustomToolbarItem nor RichTextEditorRef` (type-level: `// @ts-expect-error` on `import type { RichTextEditorRef }`; runtime: barrel keys) | UC-9 | unit (browser) | `rich-text-editor/barrel.spec.ts` (new) |
| T-12 | `rich-text-editor registry entry carries a removal breaking entry for customToolbarItems` | UC-10 | unit (cli leg) | `packages/cli/src/registry/registry-meta.spec.ts` |
| T-13 | `update prints the customToolbarItems removal notice` — only if an existing CLI spec already asserts breaking notices; otherwise T-12 suffices (verify by grepping `breaking` in `packages/cli/src/**/*.spec.ts` first; record the finding in the task retrospective) | UC-10 | unit (cli leg) | existing update spec |
| T-14 | `uiRteInsertDate registers a toolbar slot and inserts today's date at the caret through the host` | UC-13 | unit (browser) | `demo/src/app/demos/inputs/rich-text-insert-date.directive.spec.ts` (new) |
| T-15 | `addons demo renders the "write your own addon" section with the insert-date button` | UC-13 | unit (browser) | `demo/src/app/demos/inputs/rich-text-editor-addons-demo.component.spec.ts` (new or extended) |
| T-16 | `docs/rich-text-editor.md embeds the example verbatim and names every host member and every addon directive` | UC-11, UC-12 | unit (cli leg) | `packages/cli/scripts/docs-rte-guide.spec.ts` (new) |
| T-17 | `README links docs/rich-text-editor.md` | UC-14 | unit (cli leg) | same file as T-16 |
| T-18 | `main demo imports addon directives through one addons/full statement` (reads the demo source; asserts exactly one `from '…/rich-text-editor/addons/full'` import and zero `from '…/addons/<x>'` **value** imports — `import type` allowed) | UC-2 | unit (cli leg) | same file as T-16 |
| T-19 | `rich-text-editor renders in a base-only install` (smoke; scaffold output) | UC-15 | e2e | `e2e/harness/rich-text-editor/rich-text-editor.spec.ts` |
| T-20 | `right-click table menu inserts a row and deletes the table` | UC-16 | e2e | same |
| T-21 | `Control+h opens find/replace; counter shows 1/2; Replace All rewrites the model` | UC-17 | e2e | same |
| T-22 | `Control+z undoes typing and Control+y redoes it` | UC-18 | e2e | same |
| T-23 | `markdown mode renders the seeded markdown and round-trips edits` | UC-19 | e2e | same |
| T-24 | `a FormControl drives the editor and disable() locks it` | UC-20 | e2e | same |
| T-25 | `expandRequestedNames expands a base with addons to every spec installing it or an addon; leaves labels and addon-less names alone` | UC-21 | unit (cli leg) | `e2e/orchestrator/expand-names.spec.ts` (new) |
| T-26 | `expandRequestedNames dedupes and keeps a requested label that is also produced by expansion once` | UC-21 | unit (cli leg) | same |
| T-27 | `harness folder rich-text-editor is auto-discovered with names ['rich-text-editor'] and is not claimed by EXPLICIT_SPECS` | UC-15 | unit (cli leg) | `e2e/orchestrator/impact.spec.ts` (extend) |
| T-28 | `impact: a change to rich-text-editor.component.ts schedules the base label and all rte-* labels` | UC-15, UC-21 | unit (cli leg) | same |

Every UC-1 … UC-21 appears above (UC-1: T-1, T-4; UC-2: T-18; UC-3: T-1, T-2;
UC-4: T-3; UC-5: T-5; UC-6: T-6; UC-7: T-7; UC-8: T-8; UC-9: T-9–T-11;
UC-10: T-12/T-13; UC-11: T-16; UC-12: T-16; UC-13: T-14, T-15; UC-14: T-17;
UC-15: T-19, T-27, T-28; UC-16: T-20; UC-17: T-21; UC-18: T-22; UC-19: T-23;
UC-20: T-24; UC-21: T-25, T-26, T-28).

### C.2 Test types covered

- **Unit, browser leg** (`npm run test-visual` / vitest browser): toolbar,
  editor, barrel, demo directive.
- **Unit, CLI leg** (`npm run test-cli`, `vitest.config.cli.ts`): sync-registry
  lib, registry meta, orchestrator expansion, docs drift.
- **E2E** (`npm run e2e -- rich-text-editor`): the new base harness — six
  Playwright tests in one spec file, each with its own `page.goto('/')`.
- **Storybook + axe**: no new story. The toolbar's DOM is unchanged for built-in
  and addon buttons (same classes, same attributes), so the existing editor
  stories' a11y runs stay the regression guard; the dead `customToolbarItems`
  argType is removed from `rich-text-editor.stories.ts:96-99`.
- **Perf**: none claimed. `TOOLBAR_BUTTONS[item]` replaces a `find()` over 23
  rows per tooltip call — strictly cheaper; no assertion needed.

### C.3 Edge cases and failure modes the tests must cover

| Case | Covered by |
|---|---|
| Composite with **zero** siblings renders an empty `export {}` block and an empty array (no syntax error) | T-1 (second `it`) |
| RTL locale: icons swap, tooltips swap for align only; `indent` tooltip stays "Increase Indent" | T-7 |
| Toolbar `disabled` / `readonly`: addon-slot button gets `[disabled]`; classes unchanged | T-8 (extends existing disabled tests) |
| Expansion when the requested name is both a label and a base (`rich-text-editor`) — one entry, not two | T-26 |
| Expansion of a name with `addons[]` but whose specs are all explicit (`data-table` → 4 labels) | T-25 |
| Unknown name still exits 2 with the "Available:" list (existing behaviour) — add a case to T-25 for a `names` list containing an unknown after expansion | T-25 |
| e2e: the table seed must survive the sanitizer (`<table><tbody><tr><td>` allowed) — T-20 asserts 2 rows **before** interacting | T-20 |
| e2e: context menu closes on the next document click (`:1929-1938`) — T-20 clicks the menu button directly, never elsewhere first | T-20 |
| e2e: find counter when the query has no match shows `0/0` and buttons are disabled | T-21 (second half) |
| e2e: undo when history is empty is a no-op (model unchanged) | T-22 (first step, before typing) |
| e2e: markdown mode with an **empty** model renders the placeholder and emits nothing | T-23 (control editor) |
| e2e: `disable()` then typing does nothing (`contenteditable="false"`) | T-24 |
| Docs drift: a host member added later (e.g. Spec 4's `resolvedLocale`) breaks T-16 until the guide lists it — intended | T-16 |
| Demo example directive on a `readonly` editor: slot `isEnabled` returns false → button disabled | T-14 |

### C.4 Coverage expectation

- `sub/rich-text-toolbar.component.ts`: ≥ 95% lines (it drops ~40 lines; every
  remaining branch — RTL mirror, active, disabled — is asserted).
- `rich-text-editor.component.ts`: no decrease from current (`onCustomToolbarAction`
  and its spec are removed together).
- `e2e/orchestrator/expand-names.ts` (new): 100%.
- `packages/cli/scripts/docs-rte-guide.spec.ts` helpers: 100%.
- `demo/src/app/demos/inputs/rich-text-insert-date.directive.ts`: 100%.
- Sabotage rule (memory): each new test must be shown to fail by breaking the
  contract it guards (e.g. delete one `export` line from the rendered composite
  barrel for T-1; remove one row from `TOOLBAR_BUTTONS` for T-5 — that one
  fails at `tsc`, which is the point; drop the `Insert Row Below` click for
  T-20).

---

## D. Architecture section

### D.1 Usability — the public API shape

**One import line (full install)**

```ts
// Everything, one line (requires `add rich-text-editor/full`):
import { RTE_FULL, RichTextEmojiDirective, RichTextTablesDirective }
  from '@/components/ui/rich-text-editor/addons/full';

// Types still come from the owning addon's barrel (the full barrel re-exports classes only):
import type { MentionItem } from '@/components/ui/rich-text-editor/addons/mentions';

@Component({ imports: [RichTextEditorComponent, RTE_FULL] /* or a subset */ })
```

```html
<!-- all thirteen at once -->
<ui-rich-text-editor uiRteFull [(ngModel)]="doc" />
<!-- or pick -->
<ui-rich-text-editor uiRteEmoji uiRteTables [(ngModel)]="doc" />
```

A partial install (3 addons) has no `full` barrel by construction; those
consumers import each addon's barrel — three lines — and the guide says so.

**Typed toolbar table** (`packages/components/ui/rich-text-editor/sub/rich-text-toolbar.component.ts`;
names are referenced by Spec 2 — keep them exactly)

```ts
/** Every toolbar item that renders a button — `ToolbarItem` minus the visual `'separator'`. */
export type ToolbarButtonItem = Exclude<ToolbarItem, 'separator'>;

export interface ToolbarButton {
  readonly id: ToolbarButtonItem;
  readonly label: string;
  readonly localeKey: keyof RichTextLocale['toolbar'];
  /** Inline SVG glyph, trusted as-is (literal table, never consumer input). */
  readonly icon: string;
  readonly shortcut?: string;
}

/** One row per button item. A missing row is a compile error, not a blank button. */
export const TOOLBAR_BUTTONS: Record<ToolbarButtonItem, ToolbarButton> = {
  bold: { id: 'bold', label: 'Bold', localeKey: 'bold', shortcut: 'Ctrl+B', icon: `<svg …>` },
  // … 22 more rows; `ICONS` is deleted
};
```

Adding a built-in button becomes: union member → row → execute case in the
component's dispatch (`executeFormatCommand`) → locale key in the 10
dictionaries (the locale type `RichTextLocale['toolbar']` already makes a
missing key a compile error). Execution stays in the component — review Rec 10:
"Keep `exec` out of the table."

Toolbar internals after A8:

```ts
private rtlMirror(item: ToolbarButtonItem): ToolbarButtonItem   // alignLeft↔alignRight, indent↔outdent; identity for the rest
getIcon(item: ToolbarItem): SafeHtml        // separator → '' ; else TOOLBAR_BUTTONS[rtlMirror(item)].icon (indent/outdent mirrored)
getTooltip(item: ToolbarItem): string       // separator → '' ; align items mirrored, indent/outdent NOT (label unchanged, as today)
private readonly baseButtonClasses = computed(() => cn(BUTTON_BASE_CLASSES, this.compact() && 'p-1'));
buttonClasses(item: ToolbarItem): string    // cn(baseButtonClasses(), isActive(item) && BUTTON_ACTIVE_CLASSES)
addonButtonClasses(slot): string            // cn(baseButtonClasses(), addonSlotActive(slot) && BUTTON_ACTIVE_CLASSES)
```

`getIcon`/`getTooltip` keep accepting `ToolbarItem` (the template iterates the
mixed array) and return `''` only for `'separator'`, which the template never
reaches (`@if (item === 'separator')` renders `<ui-separator>`). The `?? ''` /
`return item` *unknown-item* fallbacks are gone — an unknown item cannot
exist at the type level.

**Removed API (Rec 16)** — `RichTextEditorComponent.customToolbarItems`,
`customToolbarAction`, `onCustomToolbarAction`; types
`RichTextCustomToolbarItem`, `RichTextEditorRef`; toolbar `customItems`,
`customItemClick`, `onCustomItemClick`, `customButtonClasses`; template
blocks `rich-text-editor.component.html:9-10` and
`sub/rich-text-toolbar.component.html:24-34`. Registry `breaking` entry
(hand-edited in `packages/cli/src/registry/index.ts` under `'rich-text-editor'`,
then `sync-registry --fix` regenerates `registry.json`):

```ts
{ kind: 'removal',
  from: 'the [customToolbarItems] input + (customToolbarAction) output on <ui-rich-text-editor> (RichTextCustomToolbarItem / RichTextEditorRef types)',
  to: 'a toolbar slot registered through RichTextEditorAddonHost.toolbarSlots',
  note: 'Custom toolbar buttons are now addons: inject(RichTextEditorAddonHost).toolbarSlots.register({ id, icon, tooltip, onClick }) from a directive on the editor element. ref.insertText → host.insertTextAtCaret, ref.insertHtml → host.insertHtmlAtCaret, ref.getSelectedText → host.selection().text, ref.getHtmlContent → htmlOutput(), ref.focus → host.contentRoot.focus(). See docs/rich-text-editor.md.',
  codemod: 'none' },
```

**Worked example addon** — the guide's ~40-line directive, shipped as
`demo/src/app/demos/inputs/rich-text-insert-date.directive.ts`:

```ts
import { Directive, effect, inject, input } from '@angular/core';
import { RichTextEditorAddonHost } from '@/components/ui/rich-text-editor';

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;

/**
 * Minimal addon: one toolbar button that inserts today's date at the caret.
 * Attach with `<ui-rich-text-editor uiRteInsertDate />`.
 */
@Directive({ selector: 'ui-rich-text-editor[uiRteInsertDate]' })
export class RichTextInsertDateDirective {
  private readonly host = inject(RichTextEditorAddonHost);

  /** `Intl.DateTimeFormat` locale for the inserted text; defaults to the browser's. */
  readonly uiRteInsertDateLocale = input<string>();
  /** Sort order among addon toolbar buttons; lower first. */
  readonly uiRteInsertDateOrder = input(900);

  constructor() {
    effect((onCleanup) => {
      onCleanup(this.host.toolbarSlots.register({
        id: 'insert-date',
        icon: ICON,
        tooltip: 'Insert today\'s date',
        order: this.uiRteInsertDateOrder(),
        isEnabled: () => !this.host.readonly() && !this.host.disabled(),
        onClick: () => this.host.insertTextAtCaret(
          new Intl.DateTimeFormat(this.uiRteInsertDateLocale()).format(new Date()),
        ),
      }));
    });
  }
}
```

(In the demo app the import path is the relative
`../../../../../packages/components/ui/rich-text-editor`; the drift test
normalises that one line to the `@/…` alias before comparing with the doc.)

**Base e2e harness** — `e2e/harness/rich-text-editor/rich-text-editor-demo.component.ts`
(names referenced by Spec 2 — keep them exactly):

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '@/components/ui/rich-text-editor';   // base ONLY — no addons/

@Component({
  selector: 'app-rich-text-editor-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, RichTextEditorComponent],
  template: `
    <main class="p-8 space-y-6">
      <section>
        <h2 class="mb-2 font-semibold">HTML mode, ngModel</h2>
        <ui-rich-text-editor data-testid="editor" mode="html" [ngModel]="html()" (ngModelChange)="html.set($event)" />
        <pre data-testid="editor-html" class="sr-only">{{ html() }}</pre>
      </section>
      <section>
        <h2 class="mb-2 font-semibold">Markdown mode</h2>
        <ui-rich-text-editor data-testid="editor-markdown" mode="markdown" [ngModel]="markdown()" (ngModelChange)="markdown.set($event)" />
        <pre data-testid="editor-markdown-output" class="sr-only">{{ markdown() }}</pre>
      </section>
      <section>
        <h2 class="mb-2 font-semibold">Reactive form</h2>
        <ui-rich-text-editor data-testid="editor-form" mode="html" [formControl]="control" />
        <pre data-testid="form-value" class="sr-only">{{ control.value }}</pre>
        <button type="button" data-testid="toggle-disabled" (click)="toggleDisabled()">toggle disabled</button>
      </section>
    </main>
  `,
})
export class RichTextEditorDemoComponent {
  protected readonly html = signal(
    '<p>Hello world. Hello again.</p><table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>',
  );
  protected readonly markdown = signal('# Title\n\nSome **bold** text');
  protected readonly control = new FormControl('<p>form</p>', { nonNullable: true });
  protected toggleDisabled(): void { this.control.disabled ? this.control.enable() : this.control.disable(); }
}
```

Spec skeleton (`rich-text-editor.spec.ts`), one `test` per T-19…T-24. Locators:
editable = `[data-testid="editor"] [data-slot="rich-text-editor"]`; context
menu buttons by role name (`Insert Row Below`, `Delete Table`); find input by
placeholder `Search text...`; counter text `1/2`; `Replace All` by role name.

**E2E name expansion** — `e2e/orchestrator/expand-names.ts` (new, pure,
unit-tested) + a 4-line call in `run.ts:parseArgs`:

```ts
/**
 * A requested name that is a base component with registry `addons[]` expands
 * to every spec whose `names[]` installs the base or one of its addons — so
 * `npm run e2e -- rich-text-editor` runs the base harness AND all rte-* specs.
 * Labels and addon-less names pass through unchanged. Order-stable, deduped.
 */
export function expandRequestedNames(names: readonly string[], specs: readonly ComponentSpec[]): string[]
```

`run.ts` prints `[e2e] rich-text-editor expands to 15 spec(s): rich-text-editor, rte-actions, …`
when an expansion changed the list; the unknown-name check runs on the expanded
list and stays exit 2.

### D.2 Efficiency

No meaningful runtime perf concern. `TOOLBAR_BUTTONS[item]` is O(1) vs the
current O(23) `find()` per `getTooltip` call per change-detection pass; the
shared `baseButtonClasses` computed memoizes one `cn()` per `compact` change
instead of recomputing five identical `cn()` lines per button per pass. The e2e
expansion adds one pass over ≤ 200 specs at startup. Suite wall-clock:
`npm run e2e -- rich-text-editor` goes from "exit 2" to ~15 specs (~3–5 min on
4 workers) — that is the intended cost.

### D.3 DX for the consuming developer

- **Learn:** one import (`addons/full`) for everything; `docs/rich-text-editor.md`
  for writing an addon — host contract table, slot shapes, the example.
- **Ignore:** `ToolbarButtonItem` / `TOOLBAR_BUTTONS` unless adding a built-in
  button to their copy; the orchestrator expansion (maintainers only).
- **Exported names touched:** `ToolbarButtonItem` (new), `ToolbarButton` (now
  exported), `TOOLBAR_BUTTONS` (now exported) from the base barrel via
  `sub/rich-text-toolbar.component`; **removed** `RichTextCustomToolbarItem`,
  `RichTextEditorRef`.
- **Error messages when held wrong:**
  - `[customToolbarItems]` in a template → Angular NG8002 "Can't bind to
    'customToolbarItems' since it isn't a known property of
    'ui-rich-text-editor'"; the CLI `update` output shows the `removal` note
    with the name mapping.
  - Union member without a row → `tsc`: "Property 'superscript' is missing in
    type '{ bold: …; … }' but required in type 'Record<ToolbarButtonItem, ToolbarButton>'".
  - `npm run e2e -- rich-text` (typo) → unchanged: "[e2e] Unknown name(s): rich-text" + the
    available list.
  - Importing a directive type from `addons/full` → TS2305 "has no exported
    member" — the guide says types come from the addon's own barrel.

### D.4 Implementation options

**Option set A — "one import line" (A1)**

**Option A1 — Re-export addons from the base barrel** (plan/review wording)
Pros: literally one import from the component's own barrel.
Cons: hard `sync-registry` error (`sync-registry-lib.ts:129-135, 952-963`);
folds all addon files into the 21-file base install; in the copy model the
barrel does not compile for any consumer missing even one addon (the default
install). Not viable.

**Option A2 — CLI generates a per-install `rich-text-editor/addons/index.ts` listing only installed addons**
Pros: exact one line for every install shape.
Cons: CLI logic → npm publish (2FA, manual); the file is non-deterministic per
project so `update`'s pristine baseline (`core/baseline.ts`) cannot hash it;
`apply`/`why`/`diff` all need awareness; ~2 days for a convenience.

**Option A3 — Treat the generated `addons/full` barrel as the one line; lock the contract; fix the demo; document**
Pros: zero runtime/CLI change; already generated and NG3004-safe; partial
installs keep the honest N-line form; the only new code is a test and a doc.
Cons: not available to partial installs (inherent to the copy model).

**✅ Chosen: Option A3**, because A1 is a hard error by design and A2 buys a
convenience with a publish and a baseline hole.

**Option set B — typed toolbar table (A8)**

**Option B1 — One `Record<ToolbarButtonItem, ToolbarButton>` with `icon` folded in; `ICONS` deleted**
Pros: one edit per button; compile-time completeness; O(1) lookup; the review's
recommendation (Rec 10).
Cons: a ~23-row object literal with long SVG strings (same lines as today, just
one table).

**Option B2 — Keep two tables, add `satisfies Record<ToolbarButtonItem, …>` to each**
Pros: smallest diff.
Cons: still two places to edit; `TOOLBAR_BUTTONS` is an array today (would
need to become a record anyway to `satisfies` a `Record`).

**Option B3 — Put `exec` into the table** (data-driven dispatch)
Rejected per review Rec 10: inverts the dependency (toolbar data would own
editor behaviour) and adds abstraction.

**✅ Chosen: Option B1.**

**Option set C — collapse the class helper**

**Option C1 — `toolbarButtonClasses(active: boolean)`** (review Rec 9 wording)
Pros: one function. Cons: a boolean parameter that switches output — Sonar
S2301 candidate; two thin wrappers remain anyway.

**Option C2 — `BUTTON_BASE_CLASSES` + `BUTTON_ACTIVE_CLASSES` constants and a `baseButtonClasses` computed; `buttonClasses`/`addonButtonClasses` become one `cn()` each**
Pros: no boolean parameter, memoized base, the five duplicated lines exist
once; the two remaining callers differ only in *where* `active` comes from,
which is exactly the review's observation.
Cons: two public methods remain (they have different inputs — by design).

**✅ Chosen: Option C2.**

**Option set D — `npm run e2e -- rich-text-editor` also runs `rte-*`**

**Option D1 — Expand any requested registry component to every spec whose `names[]` includes it**
Pros: generic, registry-driven. Cons: silently broadens today's behaviour —
`npm run e2e -- dialog` would run `form-flow`, `rtl`, `a11y-form`,
`dialog-focus`, `rte-actions`, `rte-history` too; `button` runs ~8.

**Option D2 — Expand only names that are a base component with registry `addons[]`, to specs installing the base or any of its addons**
Pros: matches the addon mental model ("run everything about the editor");
affects exactly `rich-text-editor`, `data-table`, `infinite-canvas` today;
exact labels (`rte-tables`) and everything else unchanged; zero new config —
the registry's `addons[]` is the group definition.
Cons: `dialog`-style broad runs still need labels typed out (that is what
`e2e:impact` is for).

**Option D3 — Shell glob (`npm run e2e -- 'rte-*'`)**
Cons: quoting differs between PowerShell, cmd and bash (this repo is
Windows-primary); still misses the base harness.

**✅ Chosen: Option D2.**

**Option set E — the guide**

**Option E1 — Hand-written `docs/rich-text-editor.md` with the example embedded verbatim and a drift test**
Pros: narrative + why; the drift test (member list + directive list + example
body) keeps it honest.
Cons: one more file to update when the host grows (that is the drift test's
job — it fails loudly).

**Option E2 — Generate the guide from JSDoc (compodoc already indexes the host)**
Pros: never stale. Cons: no narrative, no "which hook when", no example;
`docs:regen` outputs land in the demo's JSON, not `docs/`.

**✅ Chosen: Option E1**, with E2's data (compodoc JSON) used only as the
source for the demo's existing `app-docs-for` sections the guide links to.

### D.5 Risks

| Risk | Mitigation |
|---|---|
| A future contributor "fixes" A1 by re-exporting addons from the base barrel | `sync-registry` hard error already exists; T-3 runs it against the real tree; the guide states the boundary and why. |
| `Record` literal with 23 SVG strings trips Sonar duplication (S4144/S1192) | SVG strings are already literals in `ICONS`; they move, not multiply. Run `npm run sonar` after Task 2 to confirm no new finding. |
| Removing `customToolbarItems` breaks a consumer who used it | Blast radius zero in-repo (C-7); registry `breaking` entry surfaces the migration in `update`/`diff`; pre-1.0 policy is no shim. |
| Playwright `Control+h` / `Control+f` intercepted by the browser | Shortcuts dispatch on the editable's keydown (`:833-835`), Chromium in Playwright has no find bar; T-21 focuses the editable first. If a run shows the panel not opening, add a fallback harness button calling `openFindReplace(true)` via `viewChild` — record the finding. |
| Context menu right-click in Playwright hits the `<td>` padding not text | `click({ button: 'right' })` on the `td` locator centres on the cell; the handler resolves `closest('td, th')` (`:2001`). |
| Undo debounce: `Control+z` immediately after typing may collapse into the typing entry | Playwright types with per-key events; wait `historyDebounceMs` (default in the component — read it, do not guess) + 100 ms before pressing undo, as `rte-history.spec.ts:30-33` does. |
| e2e expansion makes `rich-text-editor` heavy for Spec 2/3 agents iterating on the base | Documented: pass the exact label `rte-*` for a single addon, or the new base label only via `npm run e2e -- rich-text-editor` (expanded) — a `--no-expand` flag is deliberately not added (one mechanism per concern; type the labels instead). |
| `docs:regen` after Rec 16 rewrites `documentation.json` (tracked empty stub) | Restore with `git checkout origin/master -- documentation.json` before committing (memory: documentation-json-stub). |
| Deleting the toolbar's `RichTextCustomToolbarItem` import (`sub/…toolbar.component.ts:16`) breaks the sub→base import cycle expectation | The toolbar then imports nothing from the component file — strictly fewer edges; `sync-registry` check must stay clean (T-3). |

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-18, T-25…T-28 (unit, both legs) and the e2e spec file T-19…T-24 against a stub harness folder (spec exists, harness demo empty — the orchestrator fails on the missing demo until Task 5). Sabotage-check each test's ability to fail per C.4. | all UC | ✅ Done | 2026-09-04 04:28 | — | 12 unit tests fail for the right reason (missing `TOOLBAR_BUTTONS`, missing guide, missing `expand-names.ts`, absent `breaking` entry). T-1/T-2/T-3/T-4 already pass — they are contract LOCKS on already-correct generator output, so each was sabotage-verified instead (dropped the `export {}` block from `renderCompositeBarrel`; forced a ghost sibling; added `export * from './addons/emoji'` to the base barrel; deleted one name from the generated full barrel) and each failed. **Spec correction C-11:** T-11's runtime `Object.keys` assertion is vacuous — `RichTextCustomToolbarItem`/`RichTextEditorRef` are interfaces and erase at runtime; the `@ts-expect-error` type-level import is the only assertion that can fail, so T-11 is a tsc-leg test. **T-13 finding:** no CLI spec asserts breaking-notice *text* (`update.spec.ts` mocks `printBreakingUsages`; `breaking-scan.spec.ts` uses real entries only as scanner fixtures) — T-12 suffices, T-13 dropped. |
| 2 | A8: `ToolbarButtonItem`, exported `ToolbarButton` (+`icon`), `TOOLBAR_BUTTONS` record, delete `ICONS`, `rtlMirror`, C2 class constants + `baseButtonClasses`; fix the stale `'link'` JSDoc; `readonly` on never-reassigned toolbar members you touch. | UC-5–UC-8 (T-5–T-8) | ⬜ Not started | — | — | — |
| 3 | Rec 16: delete `customToolbarItems`/`customToolbarAction`/`onCustomToolbarAction`/types from the component + `.html:9-10`; delete toolbar `customItems`/`customItemClick`/`onCustomItemClick`/`customButtonClasses` + `.html:24-34` + import `:16`; remove `stories.ts:96-99` argType; replace old specs with T-9–T-11; add the registry `breaking` entry; `sync-registry --fix`; `npm run docs:regen` (restore `documentation.json`). | UC-9, UC-10 (T-9–T-13) | ⬜ Not started | — | — | — |
| 4 | A1 (rewritten): T-1/T-2 pass against `renderCompositeBarrel` (add the empty-siblings case); T-3 against the real tree; T-4 barrel spec; rewrite `rich-text-editor-demo.component.ts:13-27` to one `addons/full` import (+ `import type` from mentions); T-18. `sync-registry` check mode clean. | UC-1–UC-4 (T-1–T-4, T-18) | ⬜ Not started | — | — | — |
| 5 | A7 harness: `npm run e2e:scaffold -- rich-text-editor`, then replace demo + spec with §D.1 bodies; `npm run e2e -- rich-text-editor` green (6 tests). | UC-15–UC-20 (T-19–T-24) | ⬜ Not started | — | — | — |
| 6 | A7 expansion: `e2e/orchestrator/expand-names.ts` + `run.ts` wiring + expansion log line; T-25–T-28; update `e2e/README.md` quick-start (`:32-36`) with the addon-expansion line and `.claude/CLAUDE.md` E2E section (one sentence under "Run it"). | UC-21 (T-25–T-28) | ⬜ Not started | — | — | — |
| 7 | A5 guide: `demo/src/app/demos/inputs/rich-text-insert-date.directive.ts` (+ T-14 spec); `docs/rich-text-editor.md` (sections: install & one import; addon model & the base/addon boundary; host contract table — all 40 members grouped, 8 `register*` hooks called out; slot shapes; worked example; locale pattern via `createLocaleBindings`; testing your addon; what is *not* an extension point); README link; T-16/T-17 drift tests. | UC-11, UC-12, UC-14 (T-14, T-16, T-17) | ⬜ Not started | — | — | — |
| 8 | A5 demo section: "Write your own addon" in `rich-text-editor-addons-demo.component.ts` (editor with `uiRteInsertDate`, copy-paste code block, en + he strings in `rich-text-editor-addons-demo.locales.ts`); T-15; demo builds. | UC-13 (T-15) | ⬜ Not started | — | — | — |
| 9 | Gates: `npm run lint`, `npm run test-visual`, `npm run test-cli`, `npm run e2e -- rich-text-editor` (expanded, 15 specs), `npm run docs:check`, `npm run sonar:gate` clean on changed files; publish-boundary check (component/lib/registry-data/e2e/docs only → **no CLI publish**; `e2e/orchestrator` is dev tooling, not shipped); fill this table's Completed/Score/Retrospective. | all | ⬜ Not started | — | — | — |

Rules: Task 1 first, tests before implementation throughout; one task = one
commit; do not reorder. Spec 2 starts only when every row here shows ≥ 91.

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

## F. Implementation notes for the executing agent (normative details)

- **Toolbar spec surgery:** the `describe('custom items')` block in
  `sub/rich-text-toolbar.component.spec.ts:194-~240` and the `import type
  { RichTextCustomToolbarItem }` at `:7` go away with Task 3; T-9 takes their
  place. `rich-text-editor.component.spec.ts:2241-2268` likewise → T-10.
- **`readonly readonly`:** the toolbar member named `readonly`
  (`sub/rich-text-toolbar.component.ts:200`) is out of scope for the
  `readonly` sweep unless you touch it; if you do, keep the JSDoc line above
  it so `readonly readonly = input(false)` does not startle the next reader.
- **RTL contract to preserve** (from the current code, `:362-391`): icons
  mirror for `alignLeft/alignRight/indent/outdent`; tooltips mirror for
  `alignLeft/alignRight` only. `rtlMirror` therefore takes a second
  discriminator or two helpers (`mirrorIcon`, `mirrorLabel`) — pick two
  tiny helpers over a boolean parameter (S2301).
- **Composite barrel test fixture:** `sync-registry-lib.spec.ts` already builds
  a temp component tree for composites (`~:1500-1563`, `compositeEntries()`);
  add the fourteenth-sibling case there rather than inventing a new fixture.
- **T-3 (real tree):** `sync-registry.spec.ts` imports the lib through the
  script; build a `BoundaryContext` from `parseRegistrySource(readFileSync(REGISTRY_PATH))`
  and call `walkTree('rich-text-editor/index.ts', 'rich-text-editor', ctx, COMPONENTS_ROOT)`;
  assert `addonViolations` is `[]` and no `ownFiles` entry contains `/addons/`.
- **Demo main page import:** keep `RichTextMentionsDirective` in `imports`
  (it comes from `addons/full` now); the `[uiRteMentionsSearch]` inputs are
  unchanged. Verify the page renders (`ng serve` demo, screenshot the
  `/rich-text-editor` route once) before claiming UC-2.
- **e2e T-20 sequencing:** `await expect(editable.locator('tr')).toHaveCount(2)`
  → `td.first().click({ button: 'right' })` → `getByRole('button', { name: 'Insert Row Below' }).click()`
  → `toHaveCount(3)` and `expect(page.getByTestId('editor-html')).toContainText('<tr>', …)`
  (count the `<tr` occurrences in the text, 3) → right-click again → `Delete Table`
  → `toHaveCount(0)` and the model has no `<table`.
- **e2e T-21:** click into the paragraph → `keyboard.press('Control+h')` →
  `getByPlaceholder('Search text...')` visible → `fill('Hello')` → text `1/2`
  visible → `getByPlaceholder('Replace with...')` `fill('Bye')` →
  `getByRole('button', { name: 'Replace All' })` → model contains `Bye` twice
  and no `Hello`. Then `fill('zzz')` → `0/0` and the ▲/▼ buttons disabled.
- **e2e T-22:** read `historyDebounceMs`'s default from the component
  (`input<number>(…)` — cite it in the retrospective), then
  `waitForTimeout(default + 100)` between typing and `Control+z`.
- **e2e T-24:** after `toggle-disabled`, assert
  `editable` has `contenteditable="false"` and `[data-testid="editor-form"] [role="toolbar"] button` all have the `disabled` attribute (the top toolbar stays rendered when `disabled`; it hides only for `readonly`, `.html:1`).
- **Expansion helper shape:** `expandRequestedNames` needs the registry
  (`registry[name].addons`) — import from `../../packages/cli/src/registry/index.js`
  as `specs.ts` already does; keep it pure (no `process.exit`) and let
  `run.ts` do the unknown-name check on the expanded list.
- **Guide drift test (T-16) parsing:** host members = every line matching
  `/^\s+abstract (?:readonly )?(\w+)/` in `rich-text-editor.host.ts`
  (40 today); addon names = every `entry.parent === 'rich-text-editor'` key
  in the registry (14, including `full`); example body = file content from
  the first `const ICON` line to EOF, compared with the fenced block in the
  guide after replacing the relative import with `@/components/ui/rich-text-editor`.
- **Locale pattern for the demo section:** add the new keys to the
  `RichTextEditorAddonsDemoLocale` interface and both dictionaries (`en`, `he`)
  in `rich-text-editor-addons-demo.locales.ts`; the component reads them via
  the existing `t()` computed.
- **Publish boundary:** nothing in `packages/cli/src/**` changes except the
  registry *data* literal (`breaking` entry) → served live from master, **no
  publish**. Re-verify against `packages/cli/src/registry/load.ts` before
  asserting in the Task 9 retrospective.

---

## G. Completion Log

| Row | Date | Task | Reviewer score | Notes |
|---|---|---|---|---|
| — | — | — | — | (append one row per task as it passes the gate; never edit an earlier row) |
