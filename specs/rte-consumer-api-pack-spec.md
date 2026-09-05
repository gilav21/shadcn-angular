# Rich Text Editor — Consumer API Pack

> **Status:** Spec — ready for an executing agent
> **Date:** 2026-09-04
> **Source plan:** `C:\Users\dasha\.claude\plans\look-at-the-richtext-snuggly-cook.md`
> (bundle 4 — items **A2** imperative API, **A3** reactive-forms validators,
> **A4** `ui-rich-text-view`, **A6** locale cascade)
> This document is append-only history. Never delete a task row, a superseded
> decision or a fixed bug — mark it and add the new entry below.

> # 🛑 STOP — READ BEFORE ANY WORK
>
> **This spec depends on:** `rte-find-replace-v2-and-undo-consistency-spec`
> (which itself depends on `rte-markdown-input-rules-and-block-toolbar-spec`
> and `rte-dx-trio-and-base-e2e-spec` — all three must be complete)
>
> **Before writing any code, verify each prerequisite is complete** by checking
> its Completion Log — every task row must show a review score ≥ 91.
>
> **If any prerequisite is incomplete: STOP IMMEDIATELY. Do not start. Do not
> work around it. Do not implement the prerequisite yourself.** Alert the user
> that this spec is blocked, name the missing prerequisite, and end your turn.

Why this order: all four specs edit `rich-text-editor.component.ts` (serialize
to avoid merge conflicts), and this spec **reuses** names the prerequisites
fix. What they leave behind, and what this spec builds on (names are final —
do not rename them here):

- From `rte-dx-trio-and-base-e2e-spec` (Spec 1): `customToolbarItems` /
  `customToolbarAction` / `RichTextCustomToolbarItem` / `RichTextEditorRef`
  are **deleted** (the ref's `insertText`/`insertHtml`/`focus` were the only
  consumer-facing imperative API — see §0 C-1); the toolbar exports
  `ToolbarButtonItem = Exclude<ToolbarItem, 'separator'>` and
  `TOOLBAR_BUTTONS: Record<ToolbarButtonItem, ToolbarButton>`; the base e2e
  harness `e2e/harness/rich-text-editor/` exists (test ids `editor`,
  `editor-html`, `editor-markdown`, `editor-markdown-output`, `editor-form`,
  `form-value`, `toggle-disabled`); `docs/rich-text-editor.md` exists with a
  host-contract table guarded by a drift test (T-16 there) that parses every
  `abstract` member of `rich-text-editor.host.ts`; the registry entry for
  `rich-text-editor` carries a `breaking[]` note mapping
  `ref.insertText → host.insertTextAtCaret`, `ref.focus → host.contentRoot.focus()`.
- From `rte-markdown-input-rules-and-block-toolbar-spec` (Spec 2):
  `ToolbarItem` gains `'textStyle'` (a `<select>`, not a button command);
  `activeFormats()` reports block state; `revertLastInputRule()` calls the
  private `undo()`.
- From `rte-find-replace-v2-and-undo-consistency-spec` (Spec 3):
  `ToolbarItem` gains `'find'`; **`setContent(value, { recordHistory = true })`**
  (mode-aware like `writeValue`, calls `onChange`, one history entry, does not
  reset `isDirty`), `RichTextSetContentOptions`, `RichTextHistoryState
  { canUndo, canRedo }`, the `historyChange` output, the `canUndo` / `canRedo`
  / `isDirty` signals, `markClean()`, the `recordExternalWrites` and
  `findDebounceMs` inputs; `insertTextFromOverlay` now pushes one history
  entry; the **private** `insertText(text)` / `insertHtml(html)` names are
  kept by Spec 3 (§D.5 items 12–13 there) and `undo()` / `redo()` stay
  **private** — Spec 3 §B.4 explicitly hands "making `undo()`/`redo()` public,
  `focus()`, `insertText()`, `format()`" to this spec.

---

## 0. Step-0 verification — what the plan got wrong (⚠️ corrections)

Every claim below was checked against the working tree at commit `17d09663`
(master) on 2026-09-04. Line numbers are for `packages/components/ui/rich-text-editor/`
unless another path is given; the three prerequisite specs will have shifted
them — Task 2 starts by re-locating every cited symbol.

| # | Plan claim | What the source says | Consequence for this spec |
|---|---|---|---|
| ⚠️ C-1 | **A2:** "Today the only programmatic path is `onFormatCommand` plus host-contract members meant for addons." | Mostly true, with two nuances. (1) `RichTextEditorRef` (`rich-text-editor.component.ts:103-117`: `insertText`, `insertHtml`, `getSelectedText`, `getHtmlContent`, `focus`) *was* a consumer-facing imperative surface, but only reachable from the dead `customToolbarAction` output — Spec 1 deletes it. (2) The component already exposes as **public** members: `onFormatCommand(command: string)` (`:1289`), `selection(): RichTextSelectionSnapshot` (`:3775-3796`), `insertTextAtCaret` / `insertHtmlAtCaret` (`:1540-1548`), `insertTextFromOverlay` (`:1515`), `restoreSelection` (`:3855-3875`), `htmlOutput` / `markdownOutput` (`:487-493`), `flushPendingHistoryPush`, `commitContent` — all documented as "(addon host surface)". `undo()` / `redo()` are `private` (`:4461`, `:4484`); `focusEditor()` is `private` (`:3723`); the working inserts `insertText` / `insertHtml` are `private` (`:3572-3619`) and are called from 8 sites (`:854, :1074, :1099, :1523, :1541, :1547, :1887, :3284`, plus the ref at `:3315-3316` that Spec 1 removes). | The public API is a **documented, typed subset** (`RichTextEditorApi`, §D.1) that the component `implements`, not a second set of methods. New members: `focus()`, `insertText()`, `insertHtml()`, `format()`, `isEmpty()`, public `undo()`/`redo()`. The two private inserts are **renamed** to `insertTextNode` / `insertHtmlFragment` so the public names are free (§D.4 option set A). |
| ⚠️ C-2 | **A2:** "`getSelectionSnapshot()`". | `selection(): RichTextSelectionSnapshot` already exists, is public, and is the host-contract member every addon uses (`rich-text-editor.host.ts:96-106, 133`; impl `:3775-3796`). | **Not added.** `selection()` is listed in `RichTextEditorApi` as the consumer's snapshot; adding an alias would be duplication (Sonar S4144 territory and two names for one thing). |
| ⚠️ C-3 | **A2:** "`setContent(value, {recordHistory})`… make `writeValue` optionally undoable". | Both are **defined and implemented by Spec 3** (its UC-26…UC-29, §D.5 item 12; `recordExternalWrites` input). | Reused, not redefined. `RichTextEditorApi` includes `setContent`, `markClean`, `canUndo`, `canRedo`, `isDirty` by reference to Spec 3's names. |
| ⚠️ C-4 | **A3:** "`<p><br></p>` currently counts as content". | **HTML mode only.** `onInput` emits `sanitizer.sanitize(div.innerHTML)` (`:787, :805-807`); `br` and `p` are allow-listed (`rich-text-sanitizer.service.ts:38-41`) so an emptied editor's form value is `<p><br></p>` (or a bare `<br>`), which passes `Validators.required`. In **markdown mode** `toMarkdown('<p><br></p>')` is `'\n  \n\n'.trim()` → `''` (`rich-text-markdown.service.ts:420-431, 545-549`), so `required` already works there. `Validators.maxLength` counts markup in **both** modes (`'**bold**'.length === 8`). | The validators are mode-agnostic by **detecting** the value's syntax (§D.4 option set B), not by taking a `mode` argument. T-14 records the built-in behaviour as evidence. |
| ⚠️ C-5 | **A4:** "styles published HTML/markdown with the same typography as the editor". | The editor's typography is **not** Tailwind Typography: `@tailwindcss/typography` is not installed (`package-lock.json`: zero hits; `demo/src/styles.css:4-7` has only `@source` lines, no `@plugin`). The classes `prose prose-sm dark:prose-invert max-w-none` in `editableClasses` (`:451`) and in the stories' preview (`rich-text-editor.stories.ts:401`) are **no-ops**. The real typography is the 30 arbitrary-variant utilities `[&_h1]:text-3xl …` (`:453-482`), interleaved with editor-only chrome (`[&:empty]:before:content-[attr(placeholder)]` `:450`, `[&_*]:outline-none` `:452`, `[&_img]:cursor-pointer` `:463`, `[&_td.rte-cell-selected]` `:467`, `[&_summary]:outline-none` `:480`, `disabled:cursor-not-allowed` `:483`). There is no `rich-text-editor.component.css`. | Extract the typography-only classes into one exported constant `RICH_TEXT_PROSE_CLASSES` (`rich-text-editor/rich-text-prose.ts`) consumed by both the editor and the view; drop the dead `prose*` classes (§D.4 option set C). A test asserts the two class lists agree. |
| ⚠️ C-6 | **A4:** "zero-dep". | The view must reuse `RichTextSanitizerService` (`providedIn: 'root'`, injects `DOCUMENT`, `rich-text-sanitizer.service.ts:33-35`) and `RichTextMarkdownService` (`providedIn: 'root'`, injects the sanitizer, `rich-text-markdown.service.ts:115-117`; `toHtml` already sanitizes its output `:133-165`). Both live in the **editor's folder** and are exported from its barrel (`rich-text-editor/index.ts`). "Zero-dep" therefore means zero **npm** dependencies; the registry entry gets `dependencies: ['rich-text-editor']` (the CLI pulls the 21-file base). Moving the two services to `lib/` was costed and rejected for this spec (§D.4 option set D). Nothing else in the library renders sanitized RTE output today: the only other `RichTextSanitizerService` consumer is `packages/components/ui/rich-text-security.spec.ts`; `chat` does not render HTML; `file-viewer`/`autocomplete` use Angular's `[innerHTML]` for their own content. `packages/components/ui/rich-text-view/` does not exist. | Build, not extend. Registry: `sync-registry --fix` does **not** create entries for new `ui/` folders (it only reports orphan *block* folders — `sync-registry.ts:104,163`, `sync-registry-lib.ts:1446`); the entry is hand-added to `packages/cli/src/registry/index.ts` and `--fix` fills `files[]`/`libFiles[]`/`dependencies`. `registry-meta.spec.ts:28-37` requires a frozen category (use `'editor'`), a description ≤ 140 chars and ≥ 3 tags. |
| ⚠️ C-7 | **A4:** "plus the actions runtime hook". | The runtime is `bindRichTextActions(container, options)` (`addons/actions/actions-runtime.ts:33-70`): delegated `click`/`keydown`/`mouseover`/`mouseout`/`focusin`/`focusout`/`touchend` listeners on **any** container, `decorateExisting` via `container.querySelectorAll` (`:72-89`). The `[uiRichTextActions]` directive (`rich-text-actions-bind.directive.ts`, 77 lines) binds to its **host element** and re-binds through a `MutationObserver` (`childList, subtree`). So placing the directive **on** `<ui-rich-text-view>` already delivers events for content rendered *inside* the view — no import from view → addon is needed. **The real gap is the sanitizer**: `data-action-*` attributes are only allow-listed while an editor carrying `uiRteActions` is alive (`rich-text-actions.directive.ts:95-103`, ref-counted `registerAttributeRules`, `rich-text-sanitizer.service.ts:157-180`). On a render-only page the view would strip every action. | The hook is two-sided: (1) the view's host element is the delegation container (documented, tested); (2) `RichTextActionsBindDirective` **also registers the four sanitizer rules** for its lifetime (extracted into `RICH_TEXT_ACTIONS_SANITIZER_RULES` in `rich-text-actions.serializer.ts`, shared with `uiRteActions`). Markdown mode is covered: `protectRawTags` keeps `<span …>` and `data-action-*` `<img>` tags opaque through the parser and re-sanitizes them (`rich-text-markdown.service.ts:168-189`). |
| ⚠️ C-8 | **A6:** "host exposes `resolvedLocale()`… addon locales default to the editor's resolved locale". | `resolvedLocale = this.i18n.t` (`:313`) is the resolved **object** (`Signal<RichTextLocale>`), not a key; there is no host member for it (`rich-text-editor.host.ts` has 40 abstract members, none locale-related). Every one of the 13 addon directives owns `uiRte<X>Locale = input<LocaleInput<…>>()` and calls `createLocaleBindings(input, REGISTRY)` (`addons/*/rich-text-*.directive.ts`, e.g. emoji `:53, :62`), which resolves `input → registry[UI_LOCALE_ID()] → 'en'` (`lib/i18n/i18n.utils.ts:24-41, 56-71`). All 13 addon registries have a `he` entry. **The library already has the mechanism**: `provideComponentLocale(() => Cmp)` (`lib/i18n/i18n.token.ts:74-100`) re-broadcasts a component's `locale` input as `UI_LOCALE_ID` (key or `code` of an object, falling through to the upstream token), and four components put it in **`providers`** — `data-table.component.ts:188-192`, `breadcrumb.component.ts:20`, `kanban.component.ts:150`, `pagination.component.ts:14` — where it is visible to **directives on the same element** (the data-table's own addon directives use `createLocaleBindings`, `data-table/addons/export/export.directive.ts`; `data-table.component.spec.ts:3875-3881` proves the re-broadcast). Its JSDoc (`i18n.token.ts:44-73`) still says "add to `viewProviders`, not `providers`" — stale relative to those four call sites. | **No host-contract member, no addon edits.** One line in the editor's `providers` (§D.4 option set E). Spec 1's host table (T-16 there) is unaffected. The stale JSDoc paragraph is corrected. |
| ⚠️ C-9 | **A6:** "removes the 'set locale 14 times' footgun in the RTL demo". | The demo's Hebrew section sets it **twice** (`demo/src/app/demos/inputs/rich-text-editor-demo.component.ts:183-184`: `locale="he"` + `uiRteSlashCommandsLocale="he"`) — the section attaches only the slash-commands addon. The footgun is real for a consumer using `uiRteFull` (14 bindings), not for the current demo. Ten registry `breaking[]` notes (`packages/cli/src/registry/index.ts:970-984`, colors/history/typography/links/tables/images/mentions/file-import/ai/outline) tell `update` users that addon strings resolve "from `[uiRte…Locale]` (or the global `UI_LOCALE_ID`), **not the editor's `[locale]`**" — true today, false after this spec. | The demo section becomes `uiRteFull` + one `locale="he"` (the honest demonstration); the ten notes are reworded (registry **data**, served live, no publish). |
| ⚠️ C-10 | Plan A2 lists `format(cmd)` with `ToolbarButtonItem` (brief). | After Specs 2 and 3, `ToolbarButtonItem` contains `'textStyle'` (a select — `onFormatCommand('textStyle')` is meaningless), `'find'` (opens a panel, not a format) and `'undo'`/`'redo'` (which get their own public methods here). `executeListFormatCommand` also handles a `'toggle'` command (`:1370`) that is **not** in the `ToolbarItem` union (`sub/rich-text-toolbar.component.ts:57-81`) — a dead branch, out of scope, noted for the record. | `format()` takes `RichTextFormatCommand = Exclude<ToolbarButtonItem, 'textStyle' \| 'find' \| 'undo' \| 'redo'>` (§D.1). |

**Facts the design rests on (verified, cite-able):**

- `onBlur` saves the caret as `savedRange` (`:1186-1190`); `restoreSelection()` re-focuses and restores it, or the live in-editor selection, else collapses to the end (`:3855-3875`). `insertTextFromOverlay` = flush → `inputMode='none'` guard → `restoreSelection` → private insert → re-save caret (`:1515-1531`; Spec 3 appends `pushHistory()`). `insertTextAtCaret`/`insertHtmlAtCaret` = private insert + `pushHistory()` on the **live** selection, no restore (`:1540-1548`).
- `onFormatCommand` = readonly/disabled guard → `restoreSelection` → flush → dispatch → `applyMutation({ focus, updateActiveFormats })` (`:1289-1300`); it is the toolbar's path and the host's `executeToolbarCommandOnBlock` fallback.
- Counters: `characterCount = stripTags(htmlContent()).length`, `wordCount = stripTags(…).trim().split(/\s+/).length` (`:495-503`); `stripTags` is `DOMParser` → `body.textContent` (`rich-text-sanitizer.service.ts:337-345`) — block boundaries yield **no** separator (`<p>a</p><p>b</p>` → `ab`).
- Task checkboxes: the sanitizer allows `input[type,checked,disabled]`, `li[data-task,data-checked]`, `ul[data-task-list]` (`:66-69`); the editor re-enables them and copies `li.dataset.checked` into `checked` after every DOM write (`enableTaskCheckboxes`, `:3171-3179`).
- Sonar: `bypassSecurityTrustHtml` is rule S6268, excluded per file in `sonar-project.properties:92-100` for existing components. The editor writes `innerHTML` imperatively (`:724, :752`) and needs no exclusion — the view does the same.
- `sync-registry` records spec-only cross-component imports as `testDependencies` (`sync-registry-lib.ts:679-681`), so a spec that imports another component's barrel is legal and tracked.
- Demo registration is three edits: nav list `demo/src/app/app.ts:202-203`, routes `demo/src/app/demo.routes.ts:57-58` (two route arrays — mirror the `error-page` precedent at `:11` and `:14`), barrel `demo/src/app/demos/index.ts:37-38`; demo strings live in `<page>.locales.ts` (`en` + `he`) read through a `t()` computed.
- `docs:regen` runs compodoc over `tsconfig.json` (`package.json:42,49`), so a new folder is indexed automatically; `docs:check` verifies the generated artifacts.
- e2e: `npm run e2e:scaffold -- <name>` resolves the name in the registry, refuses an existing folder, reads `<name>/index.ts` `export *` lines and writes demo + smoke spec (`e2e/orchestrator/scaffold.ts:1-26`); harnesses are auto-discovered. `e2e/harness/` has 14 `rte-*` folders and (after Spec 1) `rich-text-editor/`; none for the view.

---

## B. Product Manager section

### B.1 Business logic

Four deliverables that make the editor **consumable from application code**
without touching its internals:

1. **A documented imperative API.** `RichTextEditorComponent` implements one
   exported interface, `RichTextEditorApi`, that names everything a consumer
   may call on a `viewChild`: `focus()`, `insertText()`, `insertHtml()`,
   `format()`, `selection()`, `isEmpty()`, `undo()`, `redo()`, plus Spec 3's
   `setContent()`, `markClean()`, `canUndo`, `canRedo`, `isDirty` and the
   `htmlOutput` / `markdownOutput` signals. Everything else public on the class
   is the addon-host contract (`RichTextEditorAddonHost`) or template plumbing,
   and the guide says so.
2. **Reactive-forms validators** — `richTextRequired()`,
   `richTextMaxLength(n)`, `richTextMinWords(n)` — that measure the **visible
   text** of the value, whether the editor is in HTML or markdown mode, and
   return Angular-compatible error keys so `ui-field-auto-errors` renders
   messages with no configuration.
3. **`ui-rich-text-view`** — a read-only component that renders an HTML or
   markdown string through the editor's sanitizer with the editor's exact
   typography, freezes task checkboxes, and is a ready-made container for the
   actions addon's runtime (`[uiRichTextActions]`) on pages that have no
   editor at all — "author here, render there".
4. **One locale cascade.** An addon's strings resolve from its own
   `uiRte<X>Locale` input when set, else from the editor's `locale`, else from
   the app-wide `UI_LOCALE_ID`, else `'en'`. `<ui-rich-text-editor locale="he"
   uiRteFull>` is fully Hebrew with one binding.

### B.2 Why the customer wants this

| Pain today | Workaround forced today |
|---|---|
| "I have an *Insert signature* button next to the editor. Which method do I call? `insertTextAtCaret` says *addon host surface*, `insertTextFromOverlay` says *overlay UI*, and the one that was for me (`RichTextEditorRef`) is gone." | Read 4,670 lines, pick `insertTextAtCaret`, discover it inserts at the *page's* live selection (the button just stole it) or appends at the end. |
| "`Validators.required` passes on an emptied editor" (HTML mode emits `<p><br></p>`); "`Validators.maxLength(280)` counts `<strong>` tags — my 200-character tweet fails." | A custom validator that regex-strips tags — wrong for entities, wrong for markdown, duplicated per project. |
| "I need to *show* what was authored on a public page. Mounting the whole editor `readonly` for that is absurd, and my hand-rolled `[innerHTML]` with `prose` classes looks different from the editor" (and `prose` is not even installed — §0 C-5). | Copy the 30 `[&_h1]…` classes out of the editor source; discover Angular's `[innerHTML]` drops the actions addon's attributes; add `uiRteActions` to a hidden editor to keep the sanitizer rules alive. |
| "I set `locale="he"` and the emoji picker, the table grid and the AI panel stayed English." (`rich-text-editor-demo.component.ts:183-184` sets it twice for one addon.) | Bind `uiRte<X>Locale="he"` on every addon — 14 attributes for `uiRteFull` — and keep them in sync with `locale` by hand. |

### B.3 Use cases = definition of done

Written from the consuming developer's point of view. Each is observable
without reading the source and covers one behaviour.

**Imperative API (A2)**

- **UC-1** `RichTextEditorApi` and `RichTextFormatCommand` are exported from
  the `rich-text-editor` barrel; `const api: RichTextEditorApi = editor` (an
  instance of `RichTextEditorComponent`) compiles, and `viewChild.required(RichTextEditorComponent)`
  exposes every member listed in §D.1.
- **UC-2** `focus()` puts DOM focus on the editable and restores the caret
  the user last had inside the editor (after the editor blurred to a button)
  — or places it at the end of the content when there was none. While
  `disabled` it does nothing.
- **UC-3** With the caret after `Hello` and a page button that calls
  `editor.insertText(' world')`: the editable reads `Hello world`, the form's
  `onChange` received the new value once, `canUndo()` is true, **one** `undo()`
  removes only ` world`, and the editable has focus afterwards. While
  `readonly` or `disabled`, `insertText` is a no-op (content, history and
  `onChange` untouched).
- **UC-4** `editor.insertHtml('<b>bold</b><script>alert(1)</script>')` inserts
  `<b>bold</b>` at the restored caret, drops the script, records one history
  entry and calls `onChange` once; the same readonly/disabled no-op rule
  applies.
- **UC-5** `editor.format('bold')` behaves exactly like clicking the toolbar's
  bold button (same selection restore, one history entry, `activeFormats()`
  contains `bold`, editor refocused); `editor.format('textStyle')`,
  `format('find')`, `format('undo')` and `format('nope')` are **compile
  errors**.
- **UC-6** `editor.undo()` / `editor.redo()` are public and mirror `Ctrl+Z` /
  `Ctrl+Y`: after typing, `undo()` restores the previous entry and `redo()`
  re-applies it; at the ends of the stack they are no-ops; `historyChange`
  emits on each effective call.
- **UC-7** `editor.isEmpty()` is `true` for `''`, `<p><br></p>`, `<br>`,
  `<p>&nbsp;</p>`, `<p>\u200b</p>`, `<ul data-task-list><li data-task><input
  type="checkbox"><span>&nbsp;</span></li></ul>`; `false` for `<p>a</p>`,
  `<p><img src="x.png"></p>`, `<hr>`, and a table with empty cells. It
  updates after typing and after `setContent`.
- **UC-8** `editor.selection()` is documented as the consumer's selection
  snapshot; no `getSelectionSnapshot` member exists.
- **UC-9** `docs/rich-text-editor.md` has an "Imperative API" table naming
  every member of `RichTextEditorApi` with one line each, and a drift test
  fails when the interface and the table diverge; `npm run docs:regen` output
  includes `focus`, `insertText`, `insertHtml`, `format`, `isEmpty`, `undo`,
  `redo`.
- **UC-10** The registry `breaking[]` note that Spec 1 added for
  `customToolbarItems` maps `ref.insertText → editor.insertText()`,
  `ref.insertHtml → editor.insertHtml()`, `ref.focus → editor.focus()`,
  `ref.getSelectedText → editor.selection().text`, `ref.getHtmlContent →
  editor.htmlOutput()`.

**Validators (A3)**

- **UC-11** `richTextRequired()` returns `{ required: true }` for `null`,
  `''`, `<p><br></p>`, `<p>&nbsp;</p>`, `'  \n'` and `'\u200b'`; returns
  `null` for `<p>a</p>`, `<img src="x">`, `<hr>`, `![alt](x.png)`, `---`, and
  a markdown table row.
- **UC-12** `richTextMaxLength(10)` counts visible characters:
  `<p><b>hello</b> world</p>` (11) → `{ maxlength: { requiredLength: 10,
  actualLength: 11 } }`; `**hello** world` (11) → the same; `<p>hello</p>`
  (5) → `null`; empty → `null`; `&amp;` counts as one character; line breaks
  (`<br>`, block boundaries) are not characters.
- **UC-13** `richTextMinWords(3)` → `{ minWords: { requiredWords: 3,
  actualWords: 2 } }` for `<p>two words</p>`; `null` for
  `<p>one</p><p>two</p><p>three</p>` (block boundaries separate words) and for
  `שלום עולם שוב`; empty → `null` (only `required` reports emptiness).
- **UC-14** Evidence test: Angular's own `Validators.required` returns `null`
  for `<p><br></p>` and `Validators.maxLength(4)` fails `**ab**` — the
  behaviour the validators exist to fix (recorded, not "fixed").
- **UC-15** `<ui-field-auto-errors>` renders a message for each of the three
  validators with **no** `messages` input: `required` and `maxlength` through
  the existing locale keys, `minWords` through a new `minWords` key present in
  every `FIELD_ERROR_LOCALES` dictionary (`'Minimum {requiredWords} words'`,
  he `'מינימום {requiredWords} מילים'`).
- **UC-16** The editor's `isEmpty()` and `richTextRequired()` agree on every
  fixture in UC-7/UC-11 (one shared pure function).

**`ui-rich-text-view` (A4)**

- **UC-17** `<ui-rich-text-view mode="html" [value]="'<p>Hi<script>x()</script></p><img src=x onerror=alert(1)>'" />`
  renders `<p>Hi</p><img src="x">` inside `[data-slot="rich-text-view"]`: no
  `<script>`, no `onerror`.
- **UC-18** `<ui-rich-text-view [value]="'# Title\n\nSome **bold**'" />`
  (default `mode="markdown"`) renders `<h1>Title</h1>` and `<strong>bold</strong>`.
- **UC-19** Every class in `RICH_TEXT_PROSE_CLASSES` is present on both the
  editor's editable (`[data-slot="rich-text-editor"]`) and the view's content
  element; the editor-only classes (`[&:empty]:before:…`, `[&_*]:outline-none`,
  `[&_img]:cursor-pointer`, `[&_td.rte-cell-selected]:…`,
  `disabled:cursor-not-allowed`) are **not** on the view; neither element
  carries `prose`, `prose-sm` or `dark:prose-invert`. Rendered geometry
  matches: an `<h1>` in the view has the same computed `font-size` and
  `font-weight` as an `<h1>` in the editor (browser leg).
- **UC-20** Task-list items render with the checkbox `checked` iff
  `data-checked="true"`; clicking the checkbox does not toggle it; it is not
  in the tab order.
- **UC-21** `size="sm"` / `"lg"` apply the editor's `text-sm` / `text-lg`;
  `class="…"` merges onto the content element; `dir="rtl"` sets `dir` on the
  content element and Hebrew content renders right-aligned (computed
  `direction: rtl`).
- **UC-22** Changing `value` re-renders; `value=""` renders an empty content
  element with no placeholder and no error.
- **UC-23** On a page with **no editor**, `<ui-rich-text-view mode="html"
  [value]="published" [uiRichTextActions]="{ open: handler }" />` where
  `published` contains `<span data-action-click="open" data-action-click-params='{"id":1}'>`:
  the span survives sanitization, clicking it calls `handler` with
  `{ actionId: 'open', params: { id: 1 }, trigger: 'click' }`; the same holds
  with `mode="markdown"` when the markdown carries the addon-serialized span;
  removing the directive (destroy) unregisters the sanitizer rules (a
  subsequent `sanitize` strips the attribute again).
- **UC-24** `npx shadcn-angular why rich-text-view` lists
  `dependencies: rich-text-editor` and the view's own files; `sync-registry`
  (check mode) is clean; `npm run e2e -- rich-text-view` installs the view
  into the pristine app and its spec passes (sanitized render, markdown
  render, heading geometry).
- **UC-25** Storybook stories `Html`, `Markdown`, `Sizes`, `Rtl`, `WithActions`
  pass axe; the demo page `/rich-text-view` (nav "Rich Text View", category
  Inputs) shows an editor and a view bound to the **same** model in both
  modes, an actions "author here → render there" example, and copy-paste
  snippets; strings localized (en + he).

**Locale cascade (A6)**

- **UC-26** `<ui-rich-text-editor locale="he" uiRteEmoji>` with no
  `uiRteEmojiLocale`: the emoji toolbar slot's tooltip is the Hebrew string
  from `RICH_TEXT_EMOJI_LOCALES.he`.
- **UC-27** `<ui-rich-text-editor locale="he" uiRteEmoji uiRteEmojiLocale="en">`:
  the tooltip is English — the addon input wins.
- **UC-28** With no editor `locale` and the app providing
  `provideUiLocale('fr')`: the addon resolves `fr` when its registry has it
  and `en` when it does not (fallback), exactly as before this spec.
- **UC-29** `[locale]="customLocale"` where `customLocale` is a
  `RichTextLocale` object with `code: 'he'`: addons resolve `he`.
- **UC-30** Changing the editor's `locale` input at runtime from `'en'` to
  `'he'` re-localizes the addon's strings without re-creating the editor.
- **UC-31** The demo's Hebrew section is `uiRteFull` + a single `locale="he"`
  and renders Hebrew addon tooltips; the ten registry `breaking[]` notes no
  longer say "not the editor's `[locale]`"; the guide's locale section
  documents the cascade; `rich-text-editor.host.ts` has **no** new abstract
  member (Spec 1's drift test is untouched).

### B.4 Explicitly out of scope

- Any new editing behaviour, history model change, find, tables, markdown
  grammar (Specs 2/3 own those). No new host-contract members.
- Moving `RichTextSanitizerService` / `RichTextMarkdownService` to `lib/`
  (§D.4 option D-2 — recorded as the follow-up that makes a view-only
  install ~8 files instead of ~24).
- Fixing the counters (`characterCount`/`wordCount`, `:495-503`) to use the
  validators' block-aware text — `wordCount` reports `1` for
  `<p>one</p><p>two</p>` today; noted in `specs/rich-text-editor.ideas.md`
  as a follow-up, not changed here (it drives `wordCountChange`, a public
  output).
- A `[value]`-less "project content" mode for the view, syntax highlighting
  in the view's code blocks (C2), lazy images (B8), a print stylesheet (C10).
- Validators for images/links count, HTML-size limits, or async validators.
- Locale cascade **into** sub-components rendered by addons through their own
  injectors is a side-effect of the mechanism, not a contract: only the addon
  directive's strings are asserted.
- The dead `'toggle'` command branch (§0 C-10) and the `provideComponentLocale`
  behaviour in other components.
- Density tokens for the view (it has no padding of its own — padding is the
  consumer's container concern; `class` is the hook).

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them
> pass. Sabotage-verify every new test — break the behaviour it guards (from
> the contract, never from the assertion), watch it fail, restore — before
> recording it as passing.

### C.1 Traceability table

Files: `EDITOR` = `rich-text-editor.component.spec.ts` (new
`describe('RichTextEditorComponent — imperative API')` and
`describe('… — locale cascade')`); `VALID` = `rich-text-editor.validators.spec.ts`
(new, pure — no TestBed); `FIELD` = `field/sub/field-auto-errors.component.spec.ts`
(extend); `VIEW` = `rich-text-view/rich-text-view.component.spec.ts` (new);
`EMOJI` = `addons/emoji/rich-text-emoji.directive.spec.ts` (extend); `BIND` =
`addons/actions/rich-text-actions-bind.directive.spec.ts` (extend); `GUIDE` =
`packages/cli/scripts/docs-rte-guide.spec.ts` (Spec 1's file, extend); `META` =
`packages/cli/src/registry/registry-meta.spec.ts`; `E2E-VIEW` =
`e2e/harness/rich-text-view/rich-text-view.spec.ts`; `E2E-RTE` =
`e2e/harness/rich-text-editor/rich-text-editor.spec.ts` (extend); `STORY` =
`rich-text-view.stories.ts` under `npm run test-storybook:a11y`.

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `the component satisfies RichTextEditorApi and the barrel exports the interface + RichTextFormatCommand` (type-level `const api: RichTextEditorApi = component`; runtime: every method name in a literal list is `typeof 'function'` on the instance) | UC-1 | unit (EDITOR) |
| T-2 | `focus() focuses the editable and restores the saved caret; places the caret at the end when none was saved; is a no-op while disabled` | UC-2 | unit (EDITOR) |
| T-3 | `insertText from a blurred editor inserts at the saved caret, calls onChange once, pushes exactly one entry (undo removes only the insert), and focuses the editor` | UC-3 | unit (EDITOR) |
| T-4 | `insertText / insertHtml are no-ops while readonly or disabled (content, history length, onChange untouched)` | UC-3, UC-4 | unit (EDITOR) |
| T-5 | `insertHtml sanitizes (script dropped, <b> kept), pushes one entry and calls onChange once` | UC-4 | unit (EDITOR) |
| T-6 | `format('bold') equals onFormatCommand('bold'): restores selection, one entry, activeFormats has bold, editor focused` (spy on `onFormatCommand`; then assert effects with the spy removed) | UC-5 | unit (EDITOR) |
| T-7 | `format rejects textStyle, find, undo, redo and unknown ids at the type level` (`// @ts-expect-error` × 5; the file must still compile) | UC-5 | unit (EDITOR, type-level) |
| T-8 | `undo()/redo() are public, mirror the shortcut path, are no-ops at stack ends, and emit historyChange` | UC-6 | unit (EDITOR) |
| T-9 | `isEmpty() is true/false for the UC-7 fixtures and tracks typing and setContent` | UC-7 | unit (EDITOR) |
| T-10 | `no getSelectionSnapshot member exists; selection() is the snapshot` (`'getSelectionSnapshot' in component === false`) | UC-8 | unit (EDITOR) |
| T-11 | `richTextVisibleText: HTML → text with block separators; entities decoded; NBSP/ZWSP normalised; br is a line break` | UC-12, UC-13 | unit (VALID) |
| T-12 | `richTextVisibleText: markdown → text with headings, list markers, quotes, emphasis, code, links (text), images (alt), fences and hr stripped; raw <span>/<img> action tags stripped` | UC-12, UC-13 | unit (VALID) |
| T-13 | `syntax detection: a value with a block/inline tag other than span/img is HTML; markdown carrying an action <span> is still markdown` | UC-12 | unit (VALID) |
| T-14 | `evidence: Validators.required passes '<p><br></p>' and Validators.maxLength(4) fails '**ab**'` | UC-14 | unit (VALID) |
| T-15 | `richTextRequired: UC-11 fixtures (both syntaxes, media counts as content)` | UC-11 | unit (VALID) |
| T-16 | `richTextMaxLength: UC-12 fixtures incl. entity and line-break rules; null on empty` | UC-12 | unit (VALID) |
| T-17 | `richTextMinWords: UC-13 fixtures incl. Hebrew and block-separated words; null on empty` | UC-13 | unit (VALID) |
| T-18 | `isRichTextEmpty and the component's isEmpty agree on every fixture` (imports the helper; iterates the shared fixture table) | UC-16 | unit (EDITOR) |
| T-19 | `ui-field-auto-errors renders required, maxlength and minWords messages for the three validators with no messages input; every FIELD_ERROR_LOCALES entry has a non-empty minWords` | UC-15 | unit (FIELD) |
| T-20 | `renders sanitized HTML in html mode (script/onerror stripped, allowed tags kept)` | UC-17 | unit (VIEW) |
| T-21 | `renders markdown by default (h1 + strong)` | UC-18 | unit (VIEW) |
| T-22 | `content element carries every RICH_TEXT_PROSE_CLASSES class, none of the editor-only classes, and no prose* class; the editor's editable carries every RICH_TEXT_PROSE_CLASSES class` | UC-19 | unit (VIEW + EDITOR) |
| T-23 | `an h1 in the view and an h1 in the editor have identical computed font-size and font-weight` (browser leg; `getComputedStyle`, skipped under jsdom via the existing `navigator.userAgent.includes('jsdom')` guard idiom) | UC-19 | layout (VIEW) |
| T-24 | `task checkboxes reflect data-checked, do not toggle on click (defaultPrevented + checked unchanged) and have tabindex -1` | UC-20 | unit (VIEW) |
| T-25 | `size sm/lg add text-sm/text-lg; class merges; dir=rtl yields computed direction rtl` | UC-21 | unit + layout (VIEW) |
| T-26 | `value change re-renders; empty value renders an empty content element` | UC-22 | unit (VIEW) |
| T-27 | `with no editor on the page, [uiRichTextActions] on the view keeps data-action-* through sanitization and delivers the click event in html mode` | UC-23 | unit (VIEW; imports the actions addon barrel → `testDependencies`) |
| T-28 | `the same in markdown mode with the addon-serialized span` | UC-23 | unit (VIEW) |
| T-29 | `RichTextActionsBindDirective registers RICH_TEXT_ACTIONS_SANITIZER_RULES on creation and tears them down on destroy (sanitize keeps, then strips, data-action-click)` | UC-23 | unit (BIND) |
| T-30 | `uiRteActions and the bind directive share one rules constant` (`RICH_TEXT_ACTIONS_SANITIZER_RULES` has the four attrs; the directive spec spies `registerAttributeRules` and asserts it was called with that constant) | UC-23 | unit (BIND + actions directive spec) |
| T-31 | `registry: rich-text-view entry exists with category editor, ≤140-char description, ≥3 tags, dependencies ['rich-text-editor'], no npmDependencies, testDependencies ['rich-text-editor/actions']` | UC-24 | unit (META, cli leg) |
| T-32 | `e2e: the view renders sanitized HTML and markdown in a pristine install; the h1 is heavier and larger than body text` | UC-24 | e2e (E2E-VIEW) |
| T-33 | `stories Html, Markdown, Sizes, Rtl, WithActions pass axe` | UC-25 | story + a11y |
| T-34 | `demo page /rich-text-view is routed, listed in the nav and exported from demos/index.ts` (reads the three demo files; cli leg, same style as Spec 1's T-18) | UC-25 | unit (GUIDE file, cli leg) |
| T-35 | `emoji addon on locale="he" resolves Hebrew without uiRteEmojiLocale` | UC-26 | unit (EMOJI) |
| T-36 | `uiRteEmojiLocale="en" wins over locale="he"` | UC-27 | unit (EMOJI) |
| T-37 | `with no editor locale the addon follows provideUiLocale (fr when present, en fallback when absent)` (spec-local registry with/without `fr`) | UC-28 | unit (EDITOR, fake addon directive using createLocaleBindings — no addon import) |
| T-38 | `a locale object with code 'he' cascades as 'he'` | UC-29 | unit (EDITOR, fake addon) |
| T-39 | `switching locale en → he at runtime re-localizes the addon` (`fixture.componentRef.setInput('locale','he')`) | UC-30 | unit (EMOJI) |
| T-40 | `the host contract has no new abstract member and the guide's host table still matches` (Spec 1's T-16 re-run; assert the member count is unchanged from the value Spec 3 left — read it, do not guess) | UC-31 | unit (GUIDE) |
| T-41 | `the guide's Imperative API table names every RichTextEditorApi member; its validators section names all three validators; its view section names ui-rich-text-view; its locale section contains "cascade"` | UC-9, UC-31 | unit (GUIDE) |
| T-42 | `no registry breaking note contains "not the editor's [locale]"; the customToolbarItems note maps ref.insertText → editor.insertText()` | UC-10, UC-31 | unit (META) |
| T-43 | `main demo Hebrew section uses uiRteFull with exactly one locale binding and no uiRte*Locale attribute` (reads the demo source) | UC-31 | unit (GUIDE file, cli leg) |
| T-44 | `e2e: a page button calling editor.insertText inserts at the caret and Ctrl+Z removes only it; a page button calling editor.format('bold') bolds the selection` (harness demo gains `insert-text` and `format-bold` buttons) | UC-3, UC-5 | e2e (E2E-RTE) |
| T-45 | `docs:regen && docs:check green with the new members and the new component` (gate evidence recorded in the log, not a spec test) | UC-9, UC-25 | gate |

Every UC-1 … UC-31 appears above (UC-1: T-1; UC-2: T-2; UC-3: T-3, T-4,
T-44; UC-4: T-4, T-5; UC-5: T-6, T-7, T-44; UC-6: T-8; UC-7: T-9; UC-8: T-10;
UC-9: T-41, T-45; UC-10: T-42; UC-11: T-15; UC-12: T-11–T-13, T-16; UC-13:
T-11, T-12, T-17; UC-14: T-14; UC-15: T-19; UC-16: T-18; UC-17: T-20; UC-18:
T-21; UC-19: T-22, T-23; UC-20: T-24; UC-21: T-25; UC-22: T-26; UC-23:
T-27–T-30; UC-24: T-31, T-32; UC-25: T-33, T-34, T-45; UC-26: T-35; UC-27:
T-36; UC-28: T-37; UC-29: T-38; UC-30: T-39; UC-31: T-40–T-43).

### C.2 Test types covered

- **Unit, browser leg** (`npm run test-visual`) and **portable leg**
  (`npm run test:portable`): EDITOR, VALID (pure — runs anywhere), VIEW,
  EMOJI, BIND, FIELD. Layout tests (T-23, T-25) assert **computed style**, not
  class strings (memory: layout tests assert style), and skip under jsdom.
- **Unit, CLI leg** (`npm run test-cli`): META, GUIDE (docs drift, demo
  registration, registry notes).
- **Storybook + axe**: five view stories (`npm run test-storybook:a11y`).
  The editor gains no new visual state; its existing stories stay the guard.
- **E2E**: new `e2e/harness/rich-text-view/` (auto-discovered, installs
  `rich-text-view` → pulls `rich-text-editor` + `separator`), and two tests
  appended to the base editor harness spec.
- **Perf**: no perf claim. The view renders one `sanitize` (DOMParser, O(n))
  per `value` change — the same cost the editor already pays on every
  keystroke; the validators run one `DOMParser` parse (HTML) or ~12 regex
  passes (markdown) per validation, on strings the form already holds.

### C.3 Edge cases and failure modes the tests must cover

| Case | Covered by |
|---|---|
| `insertText` before the view exists (`editorDiv` undefined) — no throw, nothing inserted, no entry | T-4 (extra case) |
| `insertText('')` — no entry, no `onChange` change (empty insert is a no-op) | T-3 (extra case) |
| `insertHtml` with a value that sanitizes to `''` — no-op | T-5 (extra case) |
| `format()` on a collapsed caret (no selection) still runs (toggles typing state) — same as the toolbar | T-6 |
| `undo()` right after typing with the debounce pending — pending push is flushed first (Spec 3 contract), so undo removes the burst | T-8 |
| `isEmpty()` with an image-only document, an `<hr>` only, a table with empty cells, an empty task item, `&nbsp;` only, ZWSP only | T-9, T-15 |
| Validators: `null`/`undefined` control value, non-string value (number) → treated as `String(value)` | T-15–T-17 |
| `maxLength` with emoji (`'🎉'.length === 2` — UTF-16 units, matching the counter and Angular) — documented | T-16 |
| Markdown: nested emphasis `***x***`, code span containing `*`, fenced block containing `# not a heading`, link text with brackets — the visible text is the rendered text | T-12 |
| HTML syntax detection: `<b>*x*</b>` counts the stars literally (HTML path); markdown with `<span data-action-click>` still strips `**` (markdown path) | T-13 |
| View: `value` with `<script>`, `javascript:` href, `data:` image, `style="expression(...)"` → sanitizer's existing rules apply (assert href dropped) | T-20 |
| View: markdown with raw HTML block `<div>` — escaped as text (`toHtml` behaviour, `:146`) | T-21 (extra assertion) |
| View: very large value (500 KB) renders without throwing (no timing assertion) | T-26 (extra case) |
| View RTL: `dir="rtl"` + Hebrew; `dir` unset inherits from an ancestor `dir="rtl"` | T-25 |
| View touch: checkbox `touchend`/`click` both prevented | T-24 |
| Actions: the bind directive on an **ancestor** of the view (`<article uiRichTextActions><ui-rich-text-view/></article>`) also works (rules registered before the child renders) | T-27 (second `it`) |
| Actions: two views under one directive, one destroyed — rules stay registered (ref-count) until the directive dies | T-29 (extra case) |
| Locale: addon registry lacks the editor's key (`'ja'` on an addon with only en/he) → `'en'` | T-37 |
| Locale: `locale=""` (empty string bound from an unset query param) → upstream `UI_LOCALE_ID` | T-38 (extra case) |
| Locale: the toolbar still receives the resolved **object** (`[locale]="resolvedLocale()"`, `.html:7`) — unchanged | T-35 (assert toolbar tooltip too) |
| Registry: `sync-registry` check mode reports no deep import from the view into `rich-text-editor/` internals (only barrel imports) | T-31 + Task 5 gate |
| Docs: adding a member to `RichTextEditorApi` without a guide row fails T-41 — intended | T-41 |

### C.4 Coverage expectation

- `rich-text-editor.validators.ts`: 100% lines and branches (pure).
- `rich-text-view/rich-text-view.component.ts`: 100% lines.
- `rich-text-editor.api.ts`: types only (no runtime lines).
- New/changed lines in `rich-text-editor.component.ts`,
  `addons/actions/rich-text-actions-bind.directive.ts`,
  `addons/actions/rich-text-actions.serializer.ts`,
  `addons/actions/rich-text-actions.directive.ts`, `rich-text-prose.ts`,
  `field/field.locales.ts`: 100% of the introduced lines; the files' overall
  line coverage must not drop below their pre-spec value (record the numbers
  from `npm run coverage` in the Task 1 retrospective).
- Coverage is measured by `npm run sonar:gate` (both legs).

---

## D. Architecture section

### D.1 Usability — the public API shape

**Imperative API — simple mode (a page button next to the editor):**

```ts
import { RichTextEditorComponent, richTextRequired, richTextMaxLength } from '@/components/ui/rich-text-editor';

@Component({
  imports: [RichTextEditorComponent, ReactiveFormsModule],
  template: `
    <ui-rich-text-editor mode="html" [formControl]="body" />
    <button type="button" (click)="editor().insertText('— Jane')">Sign</button>
    <button type="button" (click)="editor().format('bold')">B</button>
    <button type="button" [disabled]="!editor().canUndo()" (click)="editor().undo()">Undo</button>
    <button type="button" [disabled]="editor().isEmpty()" (click)="send()">Send</button>
  `,
})
export class ComposeComponent {
  readonly editor = viewChild.required(RichTextEditorComponent);
  readonly body = new FormControl('', { nonNullable: true, validators: [richTextRequired(), richTextMaxLength(280)] });
}
```

**Custom mode (typed handle, no component import at the call site):**

```ts
import type { RichTextEditorApi } from '@/components/ui/rich-text-editor';

function insertSignature(editor: RichTextEditorApi, name: string): void {
  editor.focus();
  editor.insertHtml(`<p>— <em>${name}</em></p>`);
}
```

**Exported additions** (all from the `rich-text-editor` barrel):

```ts
// rich-text-editor/rich-text-editor.api.ts  (NEW — types only)
import type { Signal } from '@angular/core';
import type { RichTextSelectionSnapshot } from './rich-text-editor.host';
import type { RichTextSetContentOptions } from './rich-text-editor.component';   // Spec 3's type
import type { ToolbarButtonItem } from './sub/rich-text-toolbar.component';

/** Toolbar commands a consumer may run through {@link RichTextEditorApi.format}. */
export type RichTextFormatCommand = Exclude<ToolbarButtonItem, 'textStyle' | 'find' | 'undo' | 'redo'>;

/**
 * The consumer-facing surface of `<ui-rich-text-editor>` — what application
 * code may call on a `viewChild`. Everything else public on the component is
 * either the addon-host contract (`RichTextEditorAddonHost`) or template
 * plumbing, and is not covered by this contract.
 */
export interface RichTextEditorApi {
  /** Focus the editable and restore the caret the user last had in it (or place it at the end). No-op while disabled. */
  focus(): void;
  /** Insert plain text at the restored caret as one history entry; focuses the editor. No-op while readonly/disabled or for ''. */
  insertText(text: string): void;
  /** Insert sanitized HTML at the restored caret as one history entry; focuses the editor. No-op while readonly/disabled or when nothing survives sanitization. */
  insertHtml(html: string): void;
  /** Run a toolbar command exactly as a toolbar click would (selection restored, one history entry, editor refocused). */
  format(command: RichTextFormatCommand): void;
  /** Snapshot of the current selection / caret target (shared with the addon host). */
  selection(): RichTextSelectionSnapshot;
  /** `true` when the document has no visible text and no image, rule or table — the same rule `richTextRequired()` applies. */
  isEmpty(): boolean;
  undo(): void;
  redo(): void;
  /** Spec 3: programmatic write, recorded by default. */
  setContent(value: string, options?: RichTextSetContentOptions): void;
  /** Spec 3: baseline `isDirty()` at the current content. */
  markClean(): void;
  readonly canUndo: Signal<boolean>;
  readonly canRedo: Signal<boolean>;
  readonly isDirty: Signal<boolean>;
  readonly htmlOutput: Signal<string>;
  readonly markdownOutput: Signal<string>;
}
```

```ts
// rich-text-editor.component.ts — additions/changes
export class RichTextEditorComponent extends RichTextEditorAddonHost
  implements RichTextEditorApi, ControlValueAccessor, OnInit, AfterViewInit, OnDestroy {

  focus(): void;                                   // NEW  = disabled guard → focusEditor() → restoreSelection()
  insertText(text: string): void;                  // NEW  = canEdit && text !== '' → insertAtRestoredCaret(() => this.insertTextNode(text))
  insertHtml(html: string): void;                  // NEW  = canEdit && sanitize(html) !== '' → insertAtRestoredCaret(() => this.insertHtmlFragment(html))
  format(command: RichTextFormatCommand): void;    // NEW  = this.onFormatCommand(command)
  isEmpty(): boolean;                              // NEW  = isRichTextEmpty(this.htmlContent())
  undo(): void; redo(): void;                      // private → public (bodies unchanged)
  readonly htmlOutput / markdownOutput             // add `readonly` (never reassigned; S2933)

  private insertTextNode(text: string): void;      // RENAMED from insertText (:3572)
  private insertHtmlFragment(html: string): void;  // RENAMED from insertHtml (:3592)
  private insertAtRestoredCaret(insert: () => void): void;
  //   flushPendingHistoryPush → inputMode guard (as insertTextFromOverlay does today) → restoreSelection
  //   → insert() → pushHistory → re-save savedRange → restore inputMode.
  //   insertTextFromOverlay(text) becomes `this.insertAtRestoredCaret(() => this.insertTextNode(text))`
  //   (its Spec 3 behaviour — one entry — is preserved; the guard/restore/re-save sequence is now in one place).
}
```

**Validators** (`rich-text-editor/rich-text-editor.validators.ts`, NEW,
barrel-exported):

```ts
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Visible text of an editor value (HTML or markdown, auto-detected): entities decoded, markup removed, blocks separated by '\n', NBSP → space, zero-width chars removed, trimmed. */
export function richTextVisibleText(value: unknown): string;
/** Whether the value carries non-text content that counts as "something": an image, a horizontal rule or a table (both syntaxes). */
export function richTextHasMedia(value: unknown): boolean;
/** `richTextVisibleText(value) === '' && !richTextHasMedia(value)` — the single emptiness rule shared with `RichTextEditorComponent.isEmpty()`. */
export function isRichTextEmpty(value: unknown): boolean;

export function richTextRequired(): ValidatorFn;          // → { required: true } | null
export function richTextMaxLength(max: number): ValidatorFn; // → { maxlength: { requiredLength, actualLength } } | null   (characters = visible text without '\n', UTF-16 length like Angular's)
export function richTextMinWords(min: number): ValidatorFn;  // → { minWords: { requiredWords, actualWords } } | null       (words = visible text split on /\s+/)
```

`FieldErrorsLocale` (`field/field.locales.ts:15-23`) gains `minWords: string`
in the interface and all dictionaries (en `'Minimum {requiredWords} words'`,
he `'מינימום {requiredWords} מילים'`, natural translations for the rest —
no placeholder English).

**`ui-rich-text-view`** (`packages/components/ui/rich-text-view/`, NEW):

```html
<!-- Simple: render what the editor produced, same model string, same mode -->
<ui-rich-text-editor mode="html" [(ngModel)]="doc" />
<ui-rich-text-view  mode="html" [value]="doc" />

<!-- Markdown is the default, like the editor -->
<ui-rich-text-view [value]="readme" />

<!-- Author here, render there: published HTML + the actions runtime, no editor on this page -->
<ui-rich-text-view mode="html" [value]="post.html" [uiRichTextActions]="{ 'open-pricing': openPricing }" size="lg" dir="rtl" class="px-4" />
```

```ts
// rich-text-view/rich-text-view.component.ts
@Component({
  selector: 'ui-rich-text-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rich-text-view.component.html',   // <div #content [class]="classes()" [attr.dir]="dir() ?? null" data-slot="rich-text-view"></div>
  host: { class: 'block' },
})
export class RichTextViewComponent {
  /** The document — HTML or markdown per {@link mode}; the same string the editor emits. */
  readonly value = input<string>('');
  /** How to interpret {@link value}. Defaults to `'markdown'`, matching the editor. */
  readonly mode = input<EditorMode>('markdown');
  /** Text size preset — the editor's `size` values. */
  readonly size = input<EditorSize>('default');
  /** Text direction for the content; unset inherits from the page. */
  readonly dir = input<'ltr' | 'rtl' | 'auto'>();
  /** Extra classes merged onto the content element. */
  readonly class = input('');

  readonly classes = computed(() => cn('w-full', RICH_TEXT_PROSE_CLASSES, sizeClass(this.size()), this.class()));
  readonly renderedHtml = computed(() => this.mode() === 'markdown'
    ? this.markdown.toHtml(this.value())          // toHtml sanitizes (rich-text-markdown.service.ts:165)
    : this.sanitizer.sanitize(this.value()));
  // effect: content.nativeElement.innerHTML = renderedHtml(); freezeTaskCheckboxes(content) — imperative like the editor (:724), no DomSanitizer bypass
}
```

Shared typography — `rich-text-editor/rich-text-prose.ts` (NEW, barrel-exported):

```ts
/** The editor's content typography (headings, lists, links, code, tables, task lists, details, hr). Shared verbatim by `ui-rich-text-view`. Editor chrome (placeholder, outline, selection tints, cursors) is NOT here. */
export const RICH_TEXT_PROSE_CLASSES: readonly string[] = [
  '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2',
  // … every typography line from editableClasses :453-482 except the editor-only ones listed in §0 C-5
] as const;
```

`EditorMode` / `EditorSize` are the editor's existing exported types; the
view imports them, `RICH_TEXT_PROSE_CLASSES`, `RichTextSanitizerService` and
`RichTextMarkdownService` from `'../rich-text-editor'` (barrel — never a deep
path). `sizeClass` mirrors the editor's cva `size` map (`:41-60`: `default ''`,
`sm 'text-sm'`, `lg 'text-lg'`).

**Actions hook** — no new API. `RichTextActionsBindDirective` (existing,
`[uiRichTextActions]`) gains, in its constructor:

```ts
inject(DestroyRef).onDestroy(inject(RichTextSanitizerService).registerAttributeRules(RICH_TEXT_ACTIONS_SANITIZER_RULES));
```

and `rich-text-actions.serializer.ts` exports the constant the editor
directive (`rich-text-actions.directive.ts:97-102`) now also uses:

```ts
export const RICH_TEXT_ACTIONS_SANITIZER_RULES: SanitizerAttributeRule[] = [
  { tag: '*', attr: 'data-action-click', validate: validateActionId },
  { tag: '*', attr: 'data-action-hover', validate: validateActionId },
  { tag: '*', attr: 'data-action-click-params', requiresAttr: 'data-action-click', validate: validateActionParams },
  { tag: '*', attr: 'data-action-hover-params', requiresAttr: 'data-action-hover', validate: validateActionParams },
];
```

**Locale cascade** — no new API. `rich-text-editor.component.ts` `providers`
(`:178-188`) gains `provideComponentLocale(() => RichTextEditorComponent)`.
Resulting resolution for every addon (`resolveLocale`, `i18n.utils.ts:24-41`):
`uiRte<X>Locale` (object or key) → editor `locale` key (or object `code`) →
app `UI_LOCALE_ID` → `'en'`.

### D.2 Efficiency

| Concern | Budget / approach |
|---|---|
| `insertText` / `insertHtml` | Same work as `insertTextFromOverlay` today: one `restoreSelection`, one DOM insert, one `syncContentFromEditor` (full-document sanitize — the existing cost of every mutation), one `pushHistory`. No new traversal. |
| `isEmpty()` | One `DOMParser` parse of `htmlContent()` per call (same as `characterCount`). Not memoised — callers that bind it in a template should wrap it in a `computed` over `htmlOutput()`; documented in the guide. |
| Validators | HTML: one `DOMParser` parse + one `querySelectorAll` for block separators. Markdown: ~12 anchored regex passes, all linear, no backtracking-prone patterns (no nested quantifiers on the same class; code fences are matched lazily per block). Runs once per form validation, on strings the form already holds. |
| View render | One sanitize per `value` change (the editor pays this per keystroke); `innerHTML` assignment in an `effect` — Angular batches signal writes, so a burst of `value` updates renders once per CD pass. `freezeTaskCheckboxes` is one `querySelectorAll`. |
| Locale cascade | Zero runtime cost beyond one `computed` per editor instance (`provideComponentLocale`'s factory). Addon `createLocaleBindings` computeds already existed. |

No measured perf assertion is required (no claim is made).

### D.3 DX for the consuming developer

- **Learn:** `RichTextEditorApi` (one interface, 15 members) is *the* list of
  what to call; the three validators; `ui-rich-text-view` with `value` +
  `mode`; "set `locale` once".
- **Ignore:** everything marked *(addon host surface)* on the component;
  `RICH_TEXT_PROSE_CLASSES` (unless restyling); `RICH_TEXT_ACTIONS_SANITIZER_RULES`.
- **Types they touch:** `RichTextEditorApi`, `RichTextFormatCommand`,
  `EditorMode`/`EditorSize` (existing), `FieldErrorsLocale` (gains
  `minWords` — a consumer shipping a custom full object gets a compile error
  naming the key; intended pre-1.0 behaviour).
- **Holding it wrong:**
  - `editor.format('find')` → TS2345 "Argument of type '"find"' is not
    assignable to parameter of type 'RichTextFormatCommand'".
  - `editor.insertText()` while `readonly` → silent no-op (documented; same
    as the toolbar).
  - `<ui-rich-text-view [html]="x">` → NG8002 "Can't bind to 'html'" — the
    input is `value`; the message names the element.
  - `[uiRichTextActions]` present but actions still stripped → the directive
    was created *after* the view rendered (e.g. attached dynamically); the
    guide says: put it on the view or an ancestor in the same template.
  - `richTextMaxLength` on a control whose value is not a string → coerced
    with `String(value)`; `null`/`undefined` → empty.
- **Behavioural changes to announce in the PR body:** addon strings now
  inherit the editor's `locale` (consumers who relied on the app-wide token
  overriding a per-editor `locale` for addons must set `uiRte<X>Locale`
  explicitly); `RichTextEditorRef` migration targets change from host members
  to `editor.insertText()` etc. (registry note updated); the dead `prose*`
  classes are removed from the editable's class list (no visual change —
  §0 C-5).

### D.4 Implementation options

**Option set A — where the public imperative API lives (A2)**

**Option A-1 — New public methods with distinct names (`insertTextAtSelection`, `insertHtmlAtSelection`), privates untouched**
Pros: zero renames. Cons: three insert families with near-identical names
(`…AtCaret`, `…AtSelection`, `…FromOverlay`) on one class; the natural names
the plan and the deleted ref used (`insertText`/`insertHtml`) stay taken by
privates nobody outside can see.

**Option A-2 — Rename the privates to what they do (`insertTextNode`, `insertHtmlFragment`); public `insertText`/`insertHtml`; one exported `RichTextEditorApi` interface the component `implements`**
Pros: consumer-facing names match the plan and the old ref (migration note
becomes `ref.insertText → editor.insertText()`); the interface is a
compile-checked, drift-tested list that *separates* the consumer surface from
the 40-member host contract without a second class; `tsc` finds the eight
private call sites. Cons: a mechanical rename in the 4.6k-line file (after
Spec 3 lands — no conflict).

**Option A-3 — A separate `RichTextEditorHandle` object returned by `editor.api()`**
Pros: hard separation. Cons: a second object with delegating methods (pure
duplication, S4144 risk), `viewChild` users must remember the extra call.

**✅ Chosen: Option A-2.**

**Option set B — mode handling in the validators (A3)**

**Option B-1 — `richTextRequired({ mode })` takes the editor mode**
Pros: exact. Cons: the validator and the editor can disagree (two sources of
truth); every call site repeats the mode; a `null`-mode default is still
needed.

**Option B-2 — Convert markdown through `RichTextMarkdownService.toHtml` inside the validator**
Pros: reuses the real grammar. Cons: the service is DI-bound (`inject(RichTextSanitizerService)`
which injects `DOCUMENT`) — a validator factory has no injection context
(`richTextRequired()` is called in field initialisers, `ngOnInit`, or plain
functions), so it would need `runInInjectionContext` plumbing or a manual
`new` that throws outside DI.

**Option B-3 — Pure, DI-free helper that auto-detects the syntax (a tag other than `span`/`img` ⇒ HTML via `DOMParser`; else markdown via a small stripper mirroring the parser's grammar), shared with `isEmpty()`**
Pros: mode-agnostic by construction; zero DI; testable headlessly; one
emptiness rule for the component and the validator. Cons: the markdown
stripper is a second, smaller grammar (headings, lists, quotes, emphasis,
code, links, images, fences, hr, tables — the constructs the markdown service
documents at `rich-text-markdown.service.ts:100-113`); the `span`/`img`
exception encodes the fact that the editor's markdown output carries only
those raw tags (`protectRawTags`, `:177-189`).

**✅ Chosen: Option B-3.**

**Option set C — sharing the typography (A4)**

**Option C-1 — Duplicate the 30 classes in the view**
Cons: the exact drift the plan wants to end; no test can keep two literals
equal without a shared constant anyway.

**Option C-2 — A shared `.css` in `lib/` with real CSS rules (`@layer components { [data-slot=…] h1 {…} }`)**
Pros: one stylesheet, density-friendly. Cons: the editor's typography is
utility classes today; rewriting them as CSS is a visual-regression risk with
no functional gain; component `.css` files must be per-component (trio rule)
and lib has no CSS precedent.

**Option C-3 — One exported class-list constant in the editor folder, consumed by both `cn()` calls; dead `prose*` classes dropped**
Pros: zero visual change (same classes), one source, a test can assert both
elements carry every entry; the view already depends on the editor barrel.
Cons: a lib placement would be marginally cleaner for a future view-only
extraction — trivially movable later.

**✅ Chosen: Option C-3.**

**Option set D — where the view gets its sanitizer/markdown (A4)**

**Option D-1 — Depend on `rich-text-editor` (barrel imports; registry `dependencies: ['rich-text-editor']`)**
Pros: no file moves; the two services stay where 13 addons and the security
spec import them; install = view files + the 21-file base (+ `separator`);
unused editor code tree-shakes out of the consumer's bundle. Cons: a
view-only app copies ~24 files to render HTML (file-count perception, which
Spec 5 addresses generally).

**Option D-2 — Move both services (+ specs) to `lib/rich-text/`, re-export from the editor barrel**
Pros: view-only install ≈ 8 files. Cons: two ~700-line service moves; every
addon and the security spec re-pointed; Sonar exclusions keyed by path break
on moves (memory: `sonar-exclusions-break-on-move`) and the moved files read
as *new code* to the server, resurfacing accepted findings; `sync-registry`'s
lib walk must be re-verified for a barrel that re-exports lib; Spec 6 is
concurrently staging these exact paths.

**✅ Chosen: Option D-1**, with D-2 recorded in `specs/rich-text-editor.ideas.md`
as the follow-up if a view-only consumer materialises.

**Option set E — the actions hook (A4)**

**Option E-1 — The view exposes a `sanitizerRules` input the consumer fills from the addon**
Cons: one more thing to wire; the view API mentions a concept only one addon
uses.

**Option E-2 — The view imports the addon and registers the rules itself**
Cons: base → addon import; the view would pull the whole actions addon into
every install; violates the addon boundary the sync enforces.

**Option E-3 — `[uiRichTextActions]` (the addon's existing render directive) registers the sanitizer rules for its lifetime; the view's host element is the delegation container**
Pros: the directive that *means* "actions render here" is the one that keeps
the attributes alive; nothing new to learn; the view stays addon-free; the
same directive keeps working on a plain `<article>`. Cons: the rules must be
registered before the view's first render — guaranteed for same-element and
ancestor placement (directives are created before children render), and
documented for dynamic attachment.

**✅ Chosen: Option E-3.**

**Option set F — the locale cascade (A6)**

**Option F-1 — New abstract host member `resolvedLocaleKey: Signal<string>`; each of the 13 addons passes it into `createLocaleBindings`**
Pros: explicit. Cons: 13 addon edits + a new `createLocaleBindings` overload
(or a wrapping `computed` in every addon); Spec 1's host table and drift test
gain a row; nested sub-components rendered by addons (emoji picker, colour
picker, autocomplete) still fall to the app-wide token, so `locale="he"` is
*still* not one binding.

**Option F-2 — `provideComponentLocale(() => RichTextEditorComponent)` in the editor's `providers`**
Pros: one line; the library's own established pattern (four components,
`data-table` with same-element addon directives — a proven precedent);
addons and everything they render under the editor's injector inherit the
key; explicit addon inputs keep winning because `resolveLocale` checks the
input first; no host member, no addon edit, no Spec 1 table change. Cons:
the token's JSDoc says `viewProviders` (stale — corrected here); consumers
who deliberately set a per-editor `locale` *different* from the app token and
expected addons to follow the app token see a change (announced).

**Option F-3 — Addons `inject(RichTextEditorComponent)` and read `resolvedLocale().code`**
Cons: addons would import the component class (they inject the abstract host
today — the whole point of the host boundary).

**✅ Chosen: Option F-2.**

### D.5 Risks

| Risk | Mitigation |
|---|---|
| Line numbers/shape drift after three prerequisite specs (`setContent`, `insertTextFromOverlay` push, `undo` callers from Spec 2's Backspace revert) | §0 cites capabilities, not only lines; Task 2 starts by re-locating every cited symbol and noting the new lines in the log. `undo()` going public is compatible with Spec 2's private call. |
| Renaming `insertText`/`insertHtml` misses a caller | `tsc` (`noUnusedLocals`) plus the 8 cited sites; grep `\.insertText(\|\.insertHtml(` in the folder before and after — the only remaining hits must be the two public methods and their spec. |
| `insertAtRestoredCaret` changes `insertTextFromOverlay` timing (the `inputMode` restore is a `setTimeout`) | Keep the exact sequence of the current method (`:1515-1531`) inside the helper; Spec 3's T-35/T-43 (emoji entry count) stay green. |
| `provideComponentLocale` in `providers` creates a cyclic DI at construction | The factory captures `Injector` + upstream token eagerly and looks the component up **lazily inside a `computed`** (`i18n.token.ts:83-98`); `data-table`/`kanban`/`pagination`/`breadcrumb` already run this in `providers`. T-35–T-39 are the guard; if NG0200 ever appears, the fallback is `viewProviders` + Option F-1 — record it, do not improvise. |
| Addon component slots re-rendered with a stale locale | `createLocaleSelector` is a `computed` over the input and the token (`i18n.utils.ts:70`); T-39 asserts the runtime switch. |
| The view double-sanitizes markdown (`toHtml` sanitizes; a second pass is idempotent but wasteful) | `renderedHtml` calls `toHtml` **or** `sanitize`, never both (D.1). |
| Angular's `[innerHTML]` sanitizer vs the library's | Never used: the view assigns `innerHTML` imperatively after the allow-list sanitizer, like the editor (`:724`) — no `bypassSecurityTrustHtml`, no S6268 exclusion. |
| Sonar S3776 on the markdown stripper / `richTextVisibleText` | Table-driven: an ordered array of `[RegExp, replacement]` pairs applied in a `for-of`; the HTML path is a 6-line function; no function above 15. |
| Markdown stripper diverges from the parser grammar | T-12 fixtures are taken from `rich-text-markdown.service.spec.ts` inputs (the same strings the parser is tested with), asserting the stripped text equals `stripTags(toHtml(input))` with block separators — a cross-check against the real grammar in the browser leg. |
| `minWords` key added to `FieldErrorsLocale` breaks a consumer's custom locale object | Pre-1.0: compile error names the key (Spec 2 sets the same precedent for `RichTextLocale.toolbar.textStyle`); README changelog line. |
| The view's spec imports the actions addon → `--include-tests` installs need the addon | `sync-registry --fix` writes `testDependencies: ['rich-text-editor/actions']` (`sync-registry-lib.ts:679-681`); T-31 asserts it; the CLI's include-tests path already honours `testDependencies`. |
| `e2e:scaffold` emits a sub-component tag for every `export *` in the view barrel | The barrel exports only the component (+ nothing else); the scaffold output is replaced by the §F harness body anyway. |
| `docs:regen` rewrites `documentation.json` (tracked empty stub) | Restore with `git checkout origin/master -- documentation.json` before committing (memory: documentation-json-stub). |
| Ten registry `breaking[]` notes reworded — `registry.json` diff is large | Registry **data** only (served live from master; no CLI publish). Reword the single clause, keep the rest of each note byte-identical; T-42 guards. |

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests: T-1…T-10, T-18, T-37, T-38 (EDITOR), T-11…T-17 (VALID), T-19 (FIELD), T-20…T-28 (VIEW — the folder does not exist yet; the spec file fails at import, which is the intended red), T-29, T-30 (BIND + actions directive spec), T-35, T-36, T-39 (EMOJI), T-31, T-42 (META), T-34, T-40, T-41, T-43 (GUIDE), and the e2e skeletons T-32, T-44. Record pre-spec coverage numbers for every touched file. Sabotage-check each per C.4. | all UC | ✅ Done | 2026-09-05 18:24 | — | Every spec file written and red for the intended reason (missing module / missing member), not a typo. Two §C.1 corrections found while writing: FIELD lives at `field/field.component.spec.ts` (there is no `field/sub/field-auto-errors.component.spec.ts`), and there are **9** `not the editor's [locale]` breaking notes, not ten. Host member count read off the base branch: 39. |
| 2 | A2: `rich-text-editor.api.ts` (`RichTextEditorApi`, `RichTextFormatCommand`); rename the private inserts to `insertTextNode`/`insertHtmlFragment` (all call sites); `insertAtRestoredCaret` helper (refactor `insertTextFromOverlay` onto it); public `focus`, `insertText`, `insertHtml`, `format`, `undo`, `redo`; `readonly` on `htmlOutput`/`markdownOutput`; `implements RichTextEditorApi`; JSDoc on every new member; barrel export. T-1…T-8, T-10 green. | UC-1…UC-6, UC-8 | ✅ Done | 2026-09-05 19:04 | 94 | The `insertAtRestoredCaret` extraction paid for itself immediately: deleting its `pushHistory()` failed 7 tests, three of them wave 3's, so the shared sequence is guarded from both sides. Improve later: UC-2's collapse-to-end fallback turned out unreachable through `focus()` in a real browser (§G.14) — the spec should state observable behaviour, not an internal branch. |
| 3 | A3: `rich-text-editor.validators.ts` (helpers + three validators, table-driven stripper); `isEmpty()` on the component via `isRichTextEmpty`; `minWords` in `FieldErrorsLocale` + every dictionary; barrel export; `sync-registry --fix` (new file). T-9, T-11…T-19 green. | UC-7, UC-11…UC-16 | ✅ Done | 2026-09-05 19:15 | 94 | Writing the tests first paid off twice: the fenced-block fixture caught a real pass-ordering bug (the heading pass was eating a `#` inside a code fence), and cross-checking the link pattern against `RichTextMarkdownService.parseLinks` stopped the stripper being cleverer than the grammar it shadows. Improve later: §C.4's 100%-branch target is unreachable without a type assertion (§G.16). |
| 4 | A4 core: `rich-text-prose.ts` + editor `editableClasses` refactor (drop `prose*`); `packages/components/ui/rich-text-view/` trio + barrel (`value`, `mode`, `size`, `dir`, `class`, imperative `innerHTML` effect, `freezeTaskCheckboxes`, `data-slot`); hand-add the `'rich-text-view'` registry entry (`category: 'editor'`, description ≤ 140, ≥ 3 tags) then `sync-registry --fix`. T-20…T-26 green; `sync-registry` check clean. | UC-17…UC-22 | ⬜ Not started | — | — | — |
| 5 | A4 actions hook: `RICH_TEXT_ACTIONS_SANITIZER_RULES` in `rich-text-actions.serializer.ts` used by `uiRteActions`; `RichTextActionsBindDirective` registers/tears down the rules; `sync-registry --fix` (writes `testDependencies` for the view spec). T-27…T-31 green. | UC-23, UC-24 | ⬜ Not started | — | — | — |
| 6 | A4 surfaces: `rich-text-view.stories.ts` (5 stories, axe); demo page `demo/src/app/demos/inputs/rich-text-view-demo.component.ts` + `.locales.ts` (en/he), nav + two route lists + `demos/index.ts`; editor demo page gains "Imperative API" and "Form validators" sections (with `ui-field-auto-errors`); `npm run e2e:scaffold -- rich-text-view` then replace demo/spec bodies per §F; `npm run e2e -- rich-text-view` green; `README.md` feature bullet mentions the view. T-32…T-34 green. | UC-25, UC-24, UC-15 | ⬜ Not started | — | — | — |
| 7 | A6: `provideComponentLocale(() => RichTextEditorComponent)` in the editor's `providers`; correct the stale `viewProviders` paragraph in `i18n.token.ts:44-73`; demo Hebrew section → `uiRteFull` + single `locale="he"`; reword the ten registry `breaking[]` notes and update Spec 1's `customToolbarItems` note to the new method names; `sync-registry --fix`. T-35…T-39, T-42, T-43 green. | UC-26…UC-31, UC-10 | ⬜ Not started | — | — | — |
| 8 | Docs: `docs/rich-text-editor.md` sections "Imperative API" (drift-tested table), "Form validators", "Rendering published content — `ui-rich-text-view`" (incl. the actions placement rule), "Locale cascade" (replacing the pattern paragraph Spec 1 wrote); `e2e` harness for the editor gains the two page buttons + T-44; `npm run docs:regen` + `docs:check` (restore `documentation.json`); append the D-2 extraction and the counters follow-up to `specs/rich-text-editor.ideas.md`. T-40, T-41, T-44, T-45 green. | UC-9, UC-31, UC-3, UC-5 | ⬜ Not started | — | — | — |
| 9 | Gates: `npm run lint`, `npm run test-visual` (zero failures, pre-existing included), `npm run test:portable`, `npm run test-cli`, `npm run test-storybook:a11y`, `npm run e2e -- rich-text-editor` (expanded: base + 14 `rte-*`) and `npm run e2e -- rich-text-view`, `npm run docs:check`, `npm run sonar:gate` clean on every changed file; publish-boundary check (component/lib-doc/registry-data/demo/e2e/docs only → **no CLI publish**); fill this table and the Completion Log. | all | ⬜ Not started | — | — | — |

Rules: Task 1 first, tests before implementation throughout; one task = one
commit; do not reorder.

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

**A2 — component surgery**

- `focus()`: `if (this.disabled()) return; this.focusEditor(); this.restoreSelection();`
  (`restoreSelection` alone returns early without focusing when the live
  selection is already in the editor — hence the explicit `focusEditor()`
  first).
- `insertAtRestoredCaret(insert)`: lift the body of today's
  `insertTextFromOverlay` (`:1515-1531`, plus Spec 3's `pushHistory()`) and
  replace the `this.insertText(text)` line with `insert()`. Then
  `insertTextFromOverlay(text) { this.insertAtRestoredCaret(() => this.insertTextNode(text)); }`.
  Keep the JSDoc blocks (component + host `:145-151`) truthful: they already
  say "one history entry" after Spec 3.
- `insertText(text)`: guard `text === ''` and `this.readonly() || this.disabled()`;
  `insertHtml(html)`: guard on `this.sanitizer.sanitize(html) === ''` and the
  same editable check, then insert the **original** `html` (the fragment
  helper sanitizes again — do not pre-sanitize twice; pass the sanitized
  string through a local so the check and the insert use one call).
- `format(command)`: a one-liner delegating to `onFormatCommand`; the type is
  the whole feature. Do not add a runtime allow-list — the union is the
  contract.
- `undo()` / `redo()`: remove `private`, add JSDoc ("mirrors Ctrl/Cmd+Z / Y;
  flushes a pending typing burst first; no-op at the ends of the stack").
  Spec 2's `revertLastInputRule` keeps calling it unchanged.
- `isEmpty()`: `return isRichTextEmpty(this.htmlContent());` — import from
  `./rich-text-editor.validators`.
- Registry note (Task 7): in `packages/cli/src/registry/index.ts` under
  `'rich-text-editor'.breaking[]`, the `customToolbarItems` entry Spec 1
  added — rewrite its `note` mapping to `ref.insertText → editor.insertText()`,
  `ref.insertHtml → editor.insertHtml()`, `ref.getSelectedText →
  editor.selection().text`, `ref.getHtmlContent → editor.htmlOutput()`,
  `ref.focus → editor.focus()`; keep `to:` and `codemod:` as they are.

**A3 — `rich-text-editor.validators.ts`**

- Syntax detection: `const HTML_MARKER = /<\/?(?!span\b|img\b)[a-z][^>]*>/i;`
  — HTML iff it matches.
- HTML path (`htmlToText`): `new DOMParser().parseFromString(value, 'text/html')`;
  for each element matching `p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr,td,th,hr,br,details,summary,figcaption`
  append a `\n` text node (`td`/`th` append `' '` instead); return
  `body.textContent`. (`DOMParser` is available in both test legs; the
  editor's `stripTags` already relies on it, `:341-344`.)
- Markdown path (`markdownToText`): apply, in order, a `const MARKDOWN_STRIP: ReadonlyArray<readonly [RegExp, string]>`:
  raw `<span…>`/`</span>`/`<img…>` tags → `''`; fenced blocks
  ```` /^```[^\n]*\n([\s\S]*?)\n```[ \t]*$/gm ```` → `$1`; images
  `/!\[([^\]]*)\]\([^)]*\)/g` → `$1`; links `/\[([^\]]+)\]\([^)]*\)/g` → `$1`;
  headings `/^#{1,6}[ \t]+/gm` → `''`; blockquotes `/^>[ \t]?/gm` → `''`;
  task/list markers `/^[ \t]*(?:[-*+]|\d{1,9}\.)[ \t]+(?:\[[ xX]\][ \t]+)?/gm`
  → `''`; hr lines `/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm` → `''`; table
  separator rows `/^\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/gm`
  → `''`; table pipes `/^\||\|$/gm` and `/\|/g` → `' '`; strong
  `/(\*\*|__)(.+?)\1/g` → `$2`; strike `/~~(.+?)~~/g` → `$1`; emphasis
  `/(\*|_)(?=\S)(.+?)(?<=\S)\1/g` → `$2`; inline code `` /`([^`]+)`/g `` → `$1`;
  then the HTML-entity decode (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`,
  `&nbsp;`). Every pattern is anchored or non-greedy on a bounded class — no
  nested quantifiers over the same character set (Sonar S5852).
- Normalisation (both paths): remove `[\u200b\ufeff]`, `\u00a0` → `' '`,
  `\r\n` → `\n`, collapse runs of `\n` to one, trim.
- `richTextHasMedia`: HTML → `body.querySelector('img, hr, table') !== null`;
  markdown → `/!\[[^\]]*\]\(/`, an hr line, a table row (`/^\|.*\|[ \t]*$/m`)
  or a raw `<img`.
- Character count for `richTextMaxLength`: `richTextVisibleText(v).replaceAll('\n', '').length`.
  Words for `richTextMinWords`: `const t = richTextVisibleText(v); t === '' ? 0 : t.split(/\s+/).length`.
- Non-string control values: `typeof value === 'string' ? value : value == null ? '' : String(value)`.
- Error shapes: `{ required: true }`; `{ maxlength: { requiredLength: max, actualLength } }`
  (Angular's key and fields, so `ui-field-auto-errors`'s existing
  `maxlength` template interpolates); `{ minWords: { requiredWords: min, actualWords } }`.

**A4 — the view**

- Template (`rich-text-view.component.html`):
  `<div #content [class]="classes()" [attr.dir]="dir() ?? null" [attr.data-slot]="'rich-text-view'"></div>`.
  No `.css` file (no real CSS).
- Effect: `effect(() => { const el = this.content().nativeElement; el.innerHTML = this.renderedHtml(); this.freezeTaskCheckboxes(el); })`
  with `readonly content = viewChild.required<ElementRef<HTMLElement>>('content')`.
- `freezeTaskCheckboxes(root)`: for each `li[data-task] input[type="checkbox"]`:
  `cb.checked = li.dataset['checked'] === 'true'; cb.tabIndex = -1; cb.setAttribute('aria-readonly', 'true');`
  plus one delegated `click` listener on the content element (registered once
  in the constructor via `fromEvent`-free `addEventListener`, removed in
  `DestroyRef.onDestroy`) that `preventDefault()`s when
  `target.closest('li[data-task] input[type="checkbox"]')`.
- `classes()`: `cn('w-full', RICH_TEXT_PROSE_CLASSES, VIEW_SIZE_CLASSES[this.size()], this.class())`
  where `VIEW_SIZE_CLASSES: Record<NonNullable<EditorSize>, string> = { default: '', sm: 'text-sm', lg: 'text-lg' }`.
- `RICH_TEXT_PROSE_CLASSES` contents = `editableClasses` lines `:453-482`
  **minus** `[&_*]:outline-none` (`:452`), `[&_img]:cursor-pointer` (inside
  `:463` — keep the rest of that line), `[&_td.rte-cell-selected]:… [&_th.rte-cell-selected]:…`
  (`:467`), `[&_summary]:outline-none` (inside `:480`). The editor's
  `editableClasses` becomes `cn('w-full h-full overflow-auto p-3 outline-none', <placeholder line :450>, '[&_*]:outline-none', RICH_TEXT_PROSE_CLASSES, '[&_img]:cursor-pointer', '[&_td.rte-cell-selected]:bg-primary/15 [&_th.rte-cell-selected]:bg-primary/25', '[&_summary]:outline-none', 'disabled:cursor-not-allowed')`.
  Remove `'prose prose-sm dark:prose-invert max-w-none'` (`:451`) — dead
  (§0 C-5). Also delete the `prose …` classes from the stories' preview
  (`rich-text-editor.stories.ts:401`) and render that preview with
  `<ui-rich-text-view>` instead (the story becomes the first consumer).
- Registry entry to hand-add (then `sync-registry --fix`):
  ```ts
  'rich-text-view': {
    name: 'rich-text-view',
    category: 'editor',
    description: 'Read-only renderer for rich-text-editor output (HTML or markdown) with the editor typography and sanitizer.',
    tags: ['rich-text-view', 'rich-text', 'markdown', 'render', 'read-only'],
    files: [],           // filled by --fix
    dependencies: [],    // --fix derives ['rich-text-editor']
  },
  ```
- Stories: `Html`, `Markdown`, `Sizes` (three views), `Rtl` (`dir="rtl"`,
  Hebrew), `WithActions` (imports `RichTextActionsBindDirective` from the
  actions barrel and a preset; test scaffolding — allowed in a `.stories.ts`).
- Demo page sections: (1) "Author and preview" — one signal, editor +
  view side by side, a mode toggle (`html`/`markdown`) applied to both; (2)
  "Publish and render" — a `published` string with a `data-action-click`
  span rendered by a view carrying `[uiRichTextActions]` that opens a
  `ui-dialog` (demo-only) — strings via the page's `.locales.ts`; (3)
  copy-paste snippets. Nav: `{ id: 'rich-text-view', name: 'Rich Text View', category: 'Inputs', icon: '📄' }`
  after the addons entry; routes in **both** arrays of `demo.routes.ts`;
  export from `demos/index.ts`.
- e2e harness body (after scaffolding): the demo renders
  `<ui-rich-text-view data-testid="view-html" mode="html" [value]="html">` with
  `html = '<h1>Title</h1><p>Body</p><script>window.pwned = true</script>'` and
  `<ui-rich-text-view data-testid="view-md" [value]="'# Md\n\nSome **bold**'">`;
  spec: `view-html` contains an `h1` and no `script`, `page.evaluate(() => window.pwned)`
  is `undefined`; `view-md` has `h1` + `strong`; computed `fontWeight` of the
  `h1` ≥ 700 and its `fontSize` > the `p`'s.

**A6 — the cascade**

- `providers: [ …existing three…, provideComponentLocale(() => RichTextEditorComponent) ]`
  (import from `'../../lib/i18n'` — the editor already imports
  `createLocaleBindings` from `i18n.utils` and `LocaleInput` from
  `i18n.types` (`:40-41`); merge into one import from the barrel only if the
  sync's lib walk still resolves it — verify with `sync-registry` check; if
  it warns, keep the two direct-file imports and add a third).
- `i18n.token.ts:44-73`: replace the "Add to **`viewProviders`** (not
  `providers` …)" paragraph with: use `providers` when directives on the same
  element must inherit (addon pattern — `data-table`, `rich-text-editor`);
  `viewProviders` when only the template's children should. The lookup is
  lazy (inside the `computed`), so neither placement cycles.
- Demo `rich-text-editor-demo.component.ts:181-185`: the section becomes
  `<ui-rich-text-editor mode="markdown" toolbar="top" locale="he" [showCount]="true" [showWordCount]="true" uiRteFull minHeight="150px" />`
  (the main demo imports `RTE_FULL` from `addons/full` after Spec 1; verify
  the `uiRteFull` selector clause exists on the sibling directives — it is
  what `e2e/harness/rte-all` exercises). Update the section's description
  string (en/he) to say one `locale` binding localizes every addon.
- Registry notes: in each of the ten notes replace the clause
  `not the editor's [locale]` with `and otherwise inherit the editor's [locale]`
  — e.g. "Colour strings resolve from [uiRteColorsLocale] (or the global
  UI_LOCALE_ID), and otherwise inherit the editor's [locale]." Keep every
  other byte. `sync-registry --fix` regenerates `registry.json`.
- Fake addon for T-37/T-38 (in the EDITOR spec, no addon import):
  `@Directive({ selector: 'ui-rich-text-editor[fakeLocaleAddon]' })` with
  `readonly fakeLocale = input<LocaleInput<FakeLocale>>()` and
  `readonly t = createLocaleBindings(this.fakeLocale, { en: {code:'en', hello:'Hello'}, he: {code:'he', rtl:true, hello:'שלום'} }).t`;
  read `t().hello` through `fixture.debugElement.query(By.directive(...))`.

**Docs (Task 8)**

- Guide drift for the API table: parse `rich-text-editor.api.ts` with
  `/^\s+(?:readonly )?(\w+)\s*[(:]/gm` (skip the `import`/`export type`
  lines) and assert each name appears in a `| \`name\` |` row of the
  "Imperative API" table; place the parser next to Spec 1's host-member
  parser in `docs-rte-guide.spec.ts`.
- The "Locale cascade" section replaces Spec 1's "locale pattern via
  `createLocaleBindings`" paragraph: addon authors get the cascade for free
  by using `createLocaleBindings` — nothing to wire.
- `specs/rich-text-editor.ideas.md` (append, never delete): "Move
  `RichTextSanitizerService`/`RichTextMarkdownService` to `lib/` for a
  view-only install (Spec 4 option D-2)"; "`characterCount`/`wordCount`
  should use the block-aware `richTextVisibleText` (currently `1` word for
  two paragraphs)"; "dead `'toggle'` branch in `executeListFormatCommand`".

**Publish boundary:** nothing under `packages/cli/src/**` changes except the
registry **data** literal (new entry + note wording) → served live from
master, **no CLI publish**. Re-verify against `packages/cli/src/registry/load.ts`
before asserting in the Task 9 retrospective. Note for Spec 6 (npm packages):
its staged RTE closure should include `rich-text-view` — recorded in the
lead's cross-spec notes, not edited here.

---

## G. Plan corrections recorded by this spec (⚠️, never rewrite the plan silently)

1. `getSelectionSnapshot()` is not added — `selection()` already is the
   public snapshot (§0 C-2).
2. `setContent` / undoable `writeValue` belong to Spec 3 and are reused
   (§0 C-3).
3. `<p><br></p>` defeats `required` in **HTML mode only**; markdown mode
   already emits `''`; `maxLength` counts markup in both modes (§0 C-4).
4. The editor's typography is 30 arbitrary-variant utilities, not Tailwind
   Typography — `@tailwindcss/typography` is not installed and the `prose*`
   classes are no-ops (§0 C-5).
5. "Zero-dep" for the view means zero **npm** deps; it depends on
   `rich-text-editor` for the sanitizer and markdown services; `sync-registry`
   does not create entries for new folders (§0 C-6).
6. The actions runtime already works on any container; the missing piece is
   the sanitizer rule registration on render-only pages (§0 C-7).
7. `resolvedLocale` is an object, not a key; the cascade needs no host member
   and no addon edits — `provideComponentLocale` in `providers` is the
   library's existing mechanism (§0 C-8); its JSDoc is stale.
8. The RTL demo sets the locale twice today, not 14 times; the footgun is
   real for `uiRteFull` consumers (§0 C-9).
9. `format()` takes `RichTextFormatCommand`, narrower than
   `ToolbarButtonItem`, because `textStyle`/`find`/`undo`/`redo` are not
   format commands after Specs 2–3 (§0 C-10).

**Corrections found while executing this spec (append-only):**

10. ⚠️ §C.1 names the FIELD test file `field/sub/field-auto-errors.component.spec.ts`.
    That file does not exist — `FieldAutoErrorsComponent` is specced inside
    `packages/components/ui/field/field.component.spec.ts` (its `sub/` folder
    holds only `.ts` sources). T-19 was appended there. (Task 1)
11. ⚠️ §0 C-9, §D.5 and §F say **ten** registry `breaking[]` notes carry the
    clause `not the editor's [locale]`. Only **nine** do. The tenth
    addon-locale note (`links`) names `[uiRteLinksLocale] (or the global
    UI_LOCALE_ID)` but never carried the contradicted clause — so "ten notes
    to reword" was right, "ten occurrences of the clause" was not. All ten now
    end with "and otherwise inherit the editor's `[locale]`"; T-42 asserts the
    clause is gone everywhere and that every note mentioning the token states
    the cascade. (Tasks 1 and 7)
12. ⚠️ §D.1 lists 15 `RichTextEditorApi` members but §B.1 also promises the
    guide names them all; the parser in T-41 must skip the file's
    `RichTextFormatCommand` type alias, which is not a member. Recorded so the
    "15 members" figure is read as *interface body only*. (Task 1)
13. ⚠️ Post-spec reconciliation: the editor gained `setDisabledState` +
    `isDisabled()` after this spec was written. Every new guard
    (`focus`, `insertText`, `insertHtml`) gates on `isDisabled()`, not the raw
    `disabled()` input §F names; T-2d/T-4c cover the form-disabled path that
    §F's wording would have missed. (Task 1)
14. ⚠️ UC-2's "or places it at the end of the content when there was none" is
    **not observable through `focus()`**. §F requires `focusEditor()` before
    `restoreSelection()`, and a real browser caret lands inside the editable on
    focus — so `restoreSelection`'s live-selection branch always wins and the
    collapse-to-end fallback is unreachable from `focus()`. Verified in real
    Chromium, not only jsdom. T-2b now asserts the observable contract (a
    collapsed caret inside the editable) and T-2b2 exercises the fallback
    through `restoreSelection()` directly, where it is reachable. The
    implementation is unchanged — §F's order stands. (Task 2)
15. ⚠️ §F's `richTextVisibleText` normalisation list does not mention runs of
    spaces or tabs. They are collapsed to one, because that is what a browser
    renders and therefore what "visible characters" means — `<p>a  b</p>` shows
    one space, so `richTextMaxLength` must charge for one. It also cleans up
    after the table-cell separators, which pad each boundary independently.
    Documented on `normalise` and locked by a test. (Task 3a)
16. ⚠️ §C.4 asks for 100% branches on `rich-text-editor.validators.ts`; it
    reaches 93.75%. The two uncovered branches are `?? ''` fallbacks that the
    DOM typings (`textContent: string | null`) and `noUncheckedIndexedAccess`
    require but that no input can reach. Removing them needs a type assertion
    (S4325) and an implementation comment, both of which CLAUDE.md forbids, so
    the honest number is recorded instead. (Task 3a)

---

## H. Completion Log

| Row | Date | Task | Reviewer score | Notes |
|---|---|---|---|---|
| 1 | 2026-09-05 | Task 1 — tests first | — | No gate (tests only, all red for the intended reason). Corrections §G.10–13 recorded. |
| 2 | 2026-09-05 | Tasks 2 + 3a — imperative API + validators | 94 | `insertAtRestoredCaret` reproduces §F's load-bearing sequence exactly; the rename hit every call site (reviewer independently grepped the component and all 13 addons); `RichTextFormatCommand` excludes precisely `textStyle\|find\|undo\|redo`. Four reviewer nits all fixed before commit: single sanitize pass in `insertHtml`, the space-collapsing rule documented and tested, the §C.3 `editorDiv`-undefined case added as T-4d. Sabotage: 5 component + 7 validator breaks, every one caught; one permitted free change confirmed no over-specification. Residual: `rich-text-editor.validators.ts` is 93.75% branch, the two gaps being `?? ''` fallbacks the DOM typings force but that no input can reach. |
