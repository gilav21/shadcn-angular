# Rich Text Editor — Markdown Input Rules + Block-State Toolbar

> **Status:** Spec — ready for an implementing agent
> **Date:** 2026-09-03
> **Plan:** `C:\Users\dasha\.claude\plans\look-at-the-richtext-snuggly-cook.md`, bundle 2 (ideas **C1** + **B1**)
> **Living history:** never delete a task row, a fixed bug or a superseded decision — mark it and append below.

> # 🛑 STOP — READ BEFORE ANY WORK
>
> **This spec depends on:** `rte-dx-trio-and-base-e2e-spec`
>
> **Before writing any code, verify each prerequisite is complete** by checking
> its Completion Log — every task row must show a review score ≥ 91.
>
> **If any prerequisite is incomplete: STOP IMMEDIATELY. Do not start. Do not
> work around it. Do not implement the prerequisite yourself.** Alert the user
> that this spec is blocked, name the missing prerequisite, and end your turn.

What the prerequisite leaves behind, and what this spec builds on (names are
final, agreed with the author of that spec on 2026-09-03):

- `sub/rich-text-toolbar.component.ts` exports `ToolbarButtonItem = Exclude<ToolbarItem, 'separator'>`,
  `interface ToolbarButton { readonly id; readonly label; readonly localeKey; readonly icon; readonly shortcut? }`
  and `TOOLBAR_BUTTONS: Record<ToolbarButtonItem, ToolbarButton>` (the old
  `ICONS` map is gone; a new item = one union member + one table row, else a
  compile error). A private `rtlMirror(item)` helper does the RTL glyph swap.
- `customToolbarItems` / `customToolbarAction` / `RichTextCustomToolbarItem` /
  `RichTextEditorRef` and the toolbar's `customItems` / `customItemClick` /
  `customButtonClasses` are **deleted**. `activeFormats` is the only
  pressed-state input for built-in buttons; addon slots keep their own `isActive`.
- Base e2e harness `e2e/harness/rich-text-editor/` with
  `rich-text-editor-demo.component.ts` + `rich-text-editor.spec.ts`,
  auto-discovered, run via `npm run e2e -- rich-text-editor`. Test ids:
  `editor` (mode `html`, `[(ngModel)]`) + `editor-html` (sr-only `<pre>`
  mirror), `editor-markdown` + `editor-markdown-output`, `editor-form` +
  `form-value` + `toggle-disabled`. The editable surface inside each is
  `[data-slot="rich-text-editor"]`.
- `docs/rich-text-editor.md` exists (addon-author guide, A5).

---

## 0. Step-0 verification — what the source actually says

Every claim below was read from the tree on 2026-09-03. Line numbers are from
`packages/components/ui/rich-text-editor/` unless another path is given.

### 0.1 The typing path (`rich-text-editor.component.ts`)

- `onInput(event)` (L786-810): sanitizes `div.innerHTML` into `html`, builds
  `triggerTextContent = buildTriggerAwareText(div.innerHTML)` (L4259-4264:
  `<br>` and block closers become `\n`, then `sanitizer.stripTags`), computes
  `caretOffset` via `getCaretOffset(div)` (L1839-1848: range from the editor
  start to the anchor, `.toString().length`), then **in this order**:
  `notifyInputObservers(text, caret)` (L797) → `htmlContent.set(html)` →
  `onChange(markdown|html)` → `scheduleDebouncedHistoryPush()` unless
  `isUndoRedo`, then `isUndoRedo = false`.
- `registerInputObserver(observer)` (L1558-1561) adds to the private
  `inputObservers` Set (L426); `notifyInputObservers` (L1620-1624) loops it.
  Observers are told the **post-input, pre-model** text — so anything the base
  transforms inside `onInput` must run **before** L797, or addons see stale text.
- `onBeforeInput(event)` (L1020-1038) only enforces `maxLength`: returns early
  when no limit or when `inputType` starts with `delete`/`format`, else cancels
  an insertion that would exceed the limit. It is the right hook for nothing in
  this spec (rules need the DOM *after* the character lands).
- `onKeydown(event)` (L833-848) strict order: addon keydown interceptors →
  `shortcutHandle.dispatch` (`Mod+Z` undo lives here) → `Escape` → `Tab`
  (`handleTabKey`, L850-862) → `Enter` (`handleEnterKey`, L864-874, which owns
  task-list / summary / details / code-block Enter rules). **There is no
  `Backspace` handling anywhere in the file** (grep `Backspace`: zero hits).
- `handleEnterInCodeBlock` (L956-972): Enter inside `<pre>` inserts `\n`, or
  exits the block when the text already ends with `\n` — so a "```" transform
  only has to create `<pre><code>`; the exit behaviour already exists.
- Template (`rich-text-editor.component.html` L30-38): `(input)`,
  `(beforeinput)`, `(keydown)`, `(paste)`, `(mouseup)`/`(keyup)` →
  `onSelectionChange()`, `(mousedown)` → `onEditorMouseDown`, `(blur)`.

### 0.2 History — what "one undo step" means here

- `pushHistory()` (L4413-4459) snapshots `this.htmlContent()` (NOT the DOM):
  dedups when identical to the last reconstructed entry, truncates redo, keeps
  a keyframe every 10 entries, captures the selection via `captureSelection()`
  (L4577-4595, node-path based), bumps `historyVersion`.
- `scheduleDebouncedHistoryPush()` (L4507-4516) delays `pushHistory` by
  `historyDebounceMs` (default 450, L292); `flushPendingHistoryPush()`
  (L4519-4526) pushes immediately if a timer is pending, else no-op.
- `syncContentFromEditor()` (L3628-3639) re-reads the DOM into `htmlContent`
  and calls `onChange`. `applyMutation()` (L3696-3708) = flush → sync →
  optional `updateActiveFormats` → optional focus → `pushHistory`.
- `undo()` (L4461-4482) / `redo()` (L4484-4505): flush, move index, set
  `editorDiv.innerHTML` directly, `enableTaskCheckboxes`, restore the
  serialized selection, `onChange`, bump version. They set `isUndoRedo = true`;
  no `input` event is dispatched by the innerHTML assignment, so the flag stays
  set until the next real `onInput`, which then skips one debounced push —
  identical to the existing `Mod+Z` shortcut path (also keydown-driven).
- Existing "own undo step" idiom used by every command (e.g. `onFormatCommand`
  L1289-1300, `onPaste` L1052-1076, `insertTextAtCaret` L1540-1543):
  `flushPendingHistoryPush()` **before** the mutation, `pushHistory()` **after**.

### 0.3 Block-transform engine already in the base

- `executeToolbarCommandOnBlock(command, anchorBlock)` (L4136-4153) is the
  host-surface engine the slash-commands addon drives; it uses
  `transformBlockForSlashCommand` (L4155-4180) → `replaceBlockTag(block, tag)`
  (L4210-4222, moves children into a fresh element) and
  `wrapBlockInList(block, 'ul'|'ol')` (L4224-4248), plus `isEmptyBlock`
  (L4250-4257) and `placeCaretAtEndOfBlock`. These are private but live in the
  same class — the input rules reuse them directly, no `execCommand`.
- `insertTaskList()` (L3240-3280) builds `<ul data-task-list><li data-task
  data-checked="false"><input type=checkbox><span>&nbsp;</span></li></ul>` at
  the caret and pushes history; `insertHorizontalRule()` (L1886-1889) is
  `insertHtml('<hr><p><br></p>')` + push; `insertCodeBlock()` (L1867-1884)
  creates `<pre><code>` from the selection text (or `\n`) and places the caret
  inside; `wrapSelectionWithTag(tag)` (L1850-1865) wraps the live range.
- `getParentListItem()` (L3152-3163) / `getParentTaskListItem()` (L3165-3169),
  `findAncestorByTag` (L993-1002), `getListDepth(li)` (L3205-3216).

### 0.4 What `updateActiveFormats()` detects today (L3880-3895)

`queryEditorCommandState` (L3717-3720, wraps `document.queryCommandState`) for
`bold`, `italic`, `underline`, `strikeThrough`, `insertUnorderedList`,
`insertOrderedList`, plus `detectTaskListFormat` (L3897-3910, `closest('ul[data-task-list]')`).
Nothing about headings, paragraph, blockquote, `<pre>`, inline `<code>`,
alignment or nesting. It is called from `onSelectionChange` (L1224) and from
`applyMutation({ updateActiveFormats: true })`.

⚠️ **Plan correction 1.** The plan says pressed-state tracks
"bold/italic/underline/strike/lists/task list". The base *does* put
`bulletList`/`orderedList` in the set, but the toolbar's `isActive` map
(`sub/rich-text-toolbar.component.ts` L342-353) only honours `bold`, `italic`,
`underline`, `strikethrough`, `code`, `taskList` — so list buttons never render
pressed, and `code` is honoured by the toolbar but **never set** by the base.
Both halves must be fixed together (see §D.4).

### 0.5 How the toolbar renders items and `aria-pressed`

- `sub/rich-text-toolbar.component.html` L7-23: `@for (item of items())`,
  `'separator'` → `<ui-separator>`, else a `<button>` with
  `[class]="buttonClasses(item)"`, `[title]="getTooltip(item)"`,
  `[attr.aria-pressed]="isActive(item)"`, `[attr.data-state]="isActive(item) ? 'on' : 'off'"`,
  `(click)="onFormatClick(item)"` → `formatCommand.emit(item)`.
- Container classes (L275-282): `flex items-center flex-wrap gap-0.5 p-1 …
  max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:scrollbar-hide` — on phones
  the toolbar **scrolls horizontally**; the four block buttons
  (`paragraph`,`heading1`,`heading2`,`heading3`, `DEFAULT_TOOLBAR_ITEMS`
  L141-157) are a quarter of the default width. That is the mobile motivation.
- `sub/rich-text-toolbar.component.css` (4 lines): `@media (pointer: coarse)
  { :host button:not([data-grid-cell]) { min-height: 40px; min-width: 40px } }`
  — a `<select>` added to the toolbar needs the same rule.
- `RichTextLocale.toolbar` (`rich-text-locales.ts` L4-28) has no `textStyle`
  key; ten dictionaries exist (`en he ar de fr es ja zh ru pt`, L79-711).
- The editor forwards `[activeFormats]="activeFormats()"` (html L4) and the
  floating toolbar hardcodes `['bold','italic','underline','separator','clear']`
  with `emptyFormats` (html L105-106) — unchanged by this spec.

### 0.6 The slash-commands addon and the other trigger consumers

- `addons/slash-commands/rich-text-slash-commands.directive.ts` L122-123
  registers a keydown interceptor and an input observer; `onInputObserved`
  (L146-166) matches `/` triggers on the observed text (`matchSlashTriggerInText`,
  utils L17-19) with DOM fallbacks. Its `select()` (L244-267) removes the
  trigger text, `host.commitContent()`, then runs the command, whose
  `executeToolbarCommand` lands on `executeToolbarCommandOnBlock`.
- `addons/mentions/rich-text-mentions.directive.ts` L107 registers an input
  observer; `detectTrigger` (`rich-text-mentions.utils.ts` L36-47) matches
  `@word` / `#word` **at the caret with no space** — `MENTION_TRIGGER` /
  `TAG_TRIGGER` (L16-17) end in `$` after a `[-\p{L}\p{N}_.]*` run, so `# `
  (hash + space) is *not* a tag trigger and closes any open tag popover.
- `addons/emoji/rich-text-emoji.directive.ts`: **no typed trigger at all** —
  it registers a toolbar component slot (L76-84) and inserts via
  `insertTextFromOverlay` (L68). ⚠️ **Plan correction 2:** the plan's
  "mentions/emoji triggers" is half right — only mentions/tags and slash
  commands consume the input observer; `:shortcode:` emoji is future idea C12.

### 0.7 What the markdown service already knows (`rich-text-markdown.service.ts`)

- Parser side (markdown → HTML): `parseHeadings` L267-272 (`^#{1,6}\s+`),
  `parseListLine` L28-50 (`[-*+] `, `\d+\. `, task `[-*+] [ x]`),
  `parseBlockquotes` L237-262 (`> `), `parseHorizontalRules` L317-319
  (`^([-*_]){3,}\s*$`), `parseCodeBlocks` L207-225 (```` ```lang ```` →
  `<pre><code data-language class="language-…">`), `parseBoldItalic`
  L372-381 (`**`, `__`, `*`, `_` with `(?<!\w)…(?!\w)` guards),
  `parseInlineCode` L393-395. The **syntax table the rules must mirror**.
- `hasMarkdownSyntax` (L670-686), `applyFormat` (L692-739), `insertHeading`
  (L792-806), `insertCodeBlock` (L811-826) are **string-offset helpers with
  zero callers** in the component (grep `markdownService.` in the component:
  only `toMarkdown`/`toHtml`). ⚠️ **Plan correction 3:** they are not a seam
  for live rules — they operate on a plain-text buffer, not the DOM. Do not
  reuse them; do not delete them in this spec (out of scope).
- Sanitizer (`rich-text-sanitizer.service.ts`): `h1`–`h6`, `hr`, `pre`,
  `code`, `blockquote` allowed (L40-43); `pre` may carry `data-language`
  (L65); `style` is allowed on `*` with `text-align` in
  `ALLOWED_STYLE_PROPERTIES` (L72, L76-80) — so alignment survives as
  inline style and can be detected from the DOM.

### 0.8 Test scaffolding the QA section relies on

- `rich-text-editor.component.spec.ts` L142-213 installs `execCommand` /
  `queryCommandState` shims (formatBlock → `retagBlocks`, lists →
  `wrapBlocksInList`, state by ancestor tag) so the headless leg can run the
  toolbar paths. Typing is simulated by mutating `editor.innerHTML`, placing
  the caret with `setCaretAt` (L12-19), and dispatching
  `new Event('input', { bubbles: true })` (e.g. L370) or `new InputEvent(...)`
  (L354-360). The shim has **no** `justify*` state — alignment detection must
  therefore read the DOM, not `queryCommandState` (§D.4).
- `sub/rich-text-toolbar.component.spec.ts` L52-68 is the `aria-pressed` /
  `data-state` pattern to extend.

### 0.9 Verdict on the plan's C1 placement question — **base, not an addon**

The plan offers "base (or `markdown-shortcuts` addon)". Base wins, for reasons
that are structural rather than taste:

1. A transform must run **inside `onInput` before `notifyInputObservers`**
   (0.1) so slash/mention detection sees the post-transform text. An addon
   observer runs *after* that point; the base would need a new
   "pre-observer transform hook" seam — a seam whose only consumer is this
   feature.
2. "Exactly one undo step" needs `flushPendingHistoryPush` + `pushHistory` +
   `syncContentFromEditor` interleaved with the mutation (0.2). Only
   `mutateContent` is on the host, and it always pushes *after* the mutation;
   the pre-mutation marker snapshot (§D.4.3) is not expressible through the
   host without another new seam.
3. Backspace-revert must sit **between** addon interceptors and the shortcut
   dispatch in `onKeydown` (0.1) so `Mod+Z` and the slash menu keep priority;
   an interceptor runs *before* the slash menu's own interceptor and would
   have to re-implement its ordering.
4. The transforms reuse six private engine methods (0.3). Exposing them on
   the host would widen the contract by more lines than the feature adds.
5. It is zero-dependency and is the "feels modern" default every comparable
   editor ships on; the project rule is "zero-dep features stay in base".

The escape hatch for consumers who dislike it is a single input
(`[markdownShortcuts]="false"`), per the inputs-only configuration rule.

---

## B. Product Manager section

### B.1 Business logic

Two features on the same surface (the typing path and the toolbar's
pressed-state model):

**Markdown input rules.** While the author types, recognised Markdown prefixes
and wrappers turn into real formatting the moment they are completed:
`# `/`## `/`### ` → heading, `- `/`* ` → bullet list, `1. ` → numbered list,
`> ` → blockquote, `[] `/`[x] ` → task list (unchecked/checked), `---` →
horizontal rule, ```` ``` ```` (+ optional language, then Space or Enter) → code
block, `**text**` → bold, `*text*` → italic, `` `text` `` → inline code. A
transform is one undo step. Pressing Backspace immediately after a transform
puts the literal characters back (so `# ` can be typed as text when that is
what was meant). Works in both `mode="markdown"` and `mode="html"`. One input,
`[markdownShortcuts]`, turns the whole feature off.

**Block-state toolbar.** `activeFormats()` now also reports the block the
caret is in — heading level, paragraph, blockquote, code block, inline code,
alignment, task list, list nesting — so the toolbar's `paragraph`, `heading1-3`,
`blockquote`, `codeBlock`, `code`, `bulletList`, `orderedList`, `taskList` and
`alignLeft/Center/Right` buttons render pressed (`aria-pressed="true"`,
`data-state="on"`) when they apply. A new `'textStyle'` toolbar item renders a
compact **Text style** select (Normal text / Heading 1 / 2 / 3) that both
reflects and sets the block type; it replaces the four block buttons in
`DEFAULT_TOOLBAR_ITEMS`. The four old items keep working for consumers who
list them explicitly.

### B.2 Why the customer wants this

- Authors coming from Notion, GitHub, Slack, Google Docs type `- ` and `# `
  reflexively and today get literal characters. The developer's workaround is
  to tell users about the slash menu (an addon most installs skip) or to
  post-process pasted Markdown through `mode="markdown"` — which converts
  *values*, not keystrokes.
- The toolbar lies about state: click **H2**, keep typing, the H2 button looks
  unpressed; press **Align center** and nothing indicates the block is
  centred. Developers currently work around it by hiding the block buttons
  (`[toolbarItems]`) or by reading `htmlChange` and re-deriving the block type
  themselves for a custom toolbar — which the prerequisite just deleted the
  hook for (`customToolbarItems`).
- On a 320-375px phone the default toolbar overflows into a horizontal scroll
  (0.5); the four block buttons are the biggest fixed cost. One select
  reclaims ~3 buttons of width with no loss of function.

### B.3 Use cases = definition of done

Written from the consuming developer's point of view; each is observable
without reading the source and covers one behaviour.

**Markdown input rules**

- **UC-1** Typing `# ` at the start of an empty or plain paragraph turns that
  paragraph into `<h1>` (`## ` → `<h2>`, `### ` → `<h3>`), the caret stays in
  it, and the marker characters are gone. (`####`+ is *not* a rule.)
- **UC-2** Typing `- ` or `* ` at the start of a paragraph turns it into a
  `<ul><li>`; typing `1. ` (any 1–3 digit number followed by `.`) turns it
  into `<ol><li>`; the caret sits in the new item.
- **UC-3** Typing `> ` at the start of a paragraph turns it into `<blockquote>`.
- **UC-4** Typing `[] ` turns the paragraph into a task list item
  (`ul[data-task-list] > li[data-task][data-checked="false"]` with its
  checkbox); `[x] ` / `[X] ` produce a checked item (`data-checked="true"`,
  checkbox checked). If the paragraph already had text after the caret, that
  text becomes the item's text.
- **UC-5** Typing `---` as the only content of a paragraph replaces it with
  `<hr>` followed by a new empty paragraph holding the caret.
- **UC-6** Typing ```` ``` ```` (optionally followed by a language word such as
  ```` ```ts ````) then **Space or Enter** turns the paragraph into
  `<pre><code>` (with `data-language="ts"` + `class="language-ts"` when a
  language was given), caret inside; existing text after the caret is kept as
  the code content.
- **UC-7** Typing `**bold**` (the second closing `*` completes it) replaces
  the six characters with `<strong>bold</strong>`; continuing to type produces
  plain text after the `<strong>`, not inside it.
- **UC-8** Typing `*italic*` replaces it with `<em>italic</em>` — and does
  not fire on the inner `*` of an in-progress `**bold` (a `*…*` whose opening
  `*` is preceded by `*` is ignored).
- **UC-9** Typing `` `code` `` replaces it with `<code>code</code>`; inline
  rules never fire inside an existing `<code>` or `<pre>`.
- **UC-10** Pressing **Backspace** immediately after any transform (no other
  key, input, click or blur in between) restores the literal characters
  (e.g. `<h1>` becomes `<p># </p>` with the caret after the space), as a
  normal editing step the user can then continue from.
- **UC-11** A transform is exactly one undo step: after typing `hello`,
  Enter, `# `, one `Mod+Z` yields `<p># </p>` (markers back, the text
  `hello` untouched); `Mod+Shift+Z` re-applies the heading.
- **UC-12** Rules do not fire when the prefix is not the whole content before
  the caret (`foo - `), when the caret's block is a list item, table cell,
  `<pre>`, `<summary>` or a heading (for block rules), or when
  `[markdownShortcuts]="false"`; nothing happens to the text in those cases.
- **UC-13** With the slash-commands addon attached, `/h1` still opens the menu
  and `# ` still converts — and after a block transform the observed text the
  slash and mentions addons receive is the post-transform text (typing `# `
  then `@a` opens the mention popover in the new heading).
- **UC-14** Every transform emits `htmlChange`/`markdownChange`/form
  `onChange` once with the transformed content (`# Title` in markdown mode
  after typing `# Title`), and `maxLength` counting uses the post-transform
  text.

**Block-state toolbar**

- **UC-15** With the caret inside `<h1>`/`<h2>`/`<h3>`, the matching
  `heading1`/`heading2`/`heading3` toolbar button renders
  `aria-pressed="true"` + `data-state="on"`; inside a plain `<p>` the
  `paragraph` button does; moving the caret updates it.
- **UC-16** The `blockquote`, `codeBlock` (caret inside `<pre>`), `code`
  (caret inside inline `<code>`), `bulletList`, `orderedList` and `taskList`
  buttons render pressed when the caret is inside the matching structure.
- **UC-17** After **Align center** (or a block carrying `style="text-align:
  center"`), `alignCenter` renders pressed; `alignLeft`/`alignRight` follow
  the block's physical `text-align` mirrored through the locale's RTL flag
  (in an RTL locale a `text-align: right` block presses `alignLeft`, the item
  whose glyph and command are already mirrored).
- **UC-18** `activeFormats()` (the public signal) contains
  `'indent'` when the caret's list item is nested (depth ≥ 2) — but the
  `indent`/`outdent` toolbar buttons never render `aria-pressed` (they are
  momentary actions, not toggles).
- **UC-19** `'textStyle'` is a valid `ToolbarItem`; it renders a
  `<select data-slot="rich-text-toolbar-text-style">` with the localized
  options Normal text / Heading 1 / Heading 2 / Heading 3, whose value tracks
  the caret's block (`paragraph` for anything that is not h1-h3).
- **UC-20** Choosing an option in the Text style select converts the current
  block exactly like clicking the corresponding old button did (same command
  ids `paragraph`/`heading1`/`heading2`/`heading3`, one history entry,
  editor refocused), including when the selection was made after the editor
  blurred to the select.
- **UC-21** `DEFAULT_TOOLBAR_ITEMS` starts `'bold','italic','underline',
  'separator','textStyle','separator',…` (the four block buttons removed);
  a consumer passing `[toolbarItems]="['paragraph','heading1','heading2',
  'heading3']"` still gets four working buttons with pressed state.
- **UC-22** The select is disabled with the toolbar (`disabled`/`readonly`),
  carries `aria-label` from the locale (`toolbar.textStyle`, present in all
  ten locales), is ≥ 40px tall on coarse pointers, and at 320px the default
  toolbar is at least three button-widths narrower than before this spec.

### B.4 Explicitly out of scope

- No `####`–`######` rules, no `_italic_`/`__bold__`, `~~strike~~`, link
  `[t](u)` or image `![a](s)` rules, no `1)` lists, no numbered list starting
  value (`3. ` starts at 1 — the sanitizer keeps no `start`), no Arabic-Indic
  digits. Append accepted follow-ups to `specs/rich-text-editor.ideas.md`.
- No configurable rule set (`[inputRules]` array). One boolean input only.
- No new host-contract members; no addon. The slash-commands addon is not
  modified.
- No toolbar overflow menu / roving tabindex (B4), no density tokens (B7),
  no floating-toolbar changes, no `blockquote`/`codeBlock` entries in the
  Text style select.
- Deleting the dead `hasMarkdownSyntax`/`applyFormat`/`insertHeading`/
  `insertCodeBlock` helpers of the markdown service (0.7) — separate cleanup.
- Consumers' own `<select>` styling; the select uses the library's toolbar
  look only.

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them
> pass. Sabotage-verify each new test (break the behaviour it guards, watch
> it fail, restore) before recording it as passing.

### C.1 Traceability table

Files: `RULES` = `rich-text-input-rules.spec.ts` (new, pure functions);
`EDITOR` = `rich-text-editor.component.spec.ts` (new `describe('markdown input
rules')` and `describe('block-state activeFormats')`); `TOOLBAR` =
`sub/rich-text-toolbar.component.spec.ts`; `E2E` =
`e2e/harness/rich-text-editor/rich-text-editor.spec.ts`; `STORY` =
`rich-text-editor.stories.ts` under `npm run test-storybook:a11y`.

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `matchBlockRule: '# ' → heading 1, '## ' → 2, '### ' → 3, '#### ' → null` | UC-1 | unit (RULES) |
| T-2 | `matchBlockRule: '- ' and '* ' → bulletList; '1. ' / '12. ' / '999. ' → orderedList; '1000. ' and '1.' → null` | UC-2 | unit (RULES) |
| T-3 | `matchBlockRule: '> ' → blockquote; '[] ' → task unchecked; '[x] ' and '[X] ' → task checked; '[ ] ' → null` | UC-3, UC-4 | unit (RULES) |
| T-4 | `matchBlockRule: '---' → horizontalRule; '--' and '----' → null` | UC-5 | unit (RULES) |
| T-5 | ``matchBlockRule: '``` ' → codeBlock lang ''; '```ts ' → lang 'ts'; '```' alone → null unless terminator is Enter`` | UC-6 | unit (RULES) |
| T-6 | `matchInlineRule: '**bold**' → strong over the last 8 chars; '**bo ld**' works; '** **' → null; '***' → null` | UC-7 | unit (RULES) |
| T-7 | `matchInlineRule: '*it*' → em; '**bo*' (opening preceded by *) → null; 'a*b*' → null (no leading boundary)` | UC-8 | unit (RULES) |
| T-8 | `` matchInlineRule: '`x`' → code; '``' → null `` | UC-9 | unit (RULES) |
| T-9 | `typing "# " in an empty paragraph produces <h1> with the caret inside and no marker text` | UC-1 | unit (EDITOR) |
| T-10 | `typing "# " before existing text keeps the text: <p>|Title</p> → <h1>Title</h1>` | UC-1 | unit (EDITOR) |
| T-11 | `typing "- " / "1. " wraps the paragraph in ul/ol > li and the caret is inside the li` | UC-2 | unit (EDITOR) |
| T-12 | `typing "> " re-tags the paragraph as blockquote` | UC-3 | unit (EDITOR) |
| T-13 | `typing "[] " creates an unchecked task item; "[x] " a checked one with the checkbox checked; trailing text becomes the item text` | UC-4 | unit (EDITOR) |
| T-14 | `typing "---" replaces the paragraph with <hr> + a new empty <p> holding the caret` | UC-5 | unit (EDITOR) |
| T-15 | `typing "```ts" then Space produces pre>code[data-language=ts]; "```" then Enter produces a plain pre>code and the Enter is prevented` | UC-6 | unit (EDITOR) |
| T-16 | `typing "**bold**" yields <strong>bold</strong> and a later typed "x" lands outside the strong` | UC-7 | unit (EDITOR) |
| T-17 | `typing "*it*" yields <em>; the inner star of an unfinished "**bo*" does not` | UC-8 | unit (EDITOR) |
| T-18 | `` typing "`c`" yields <code>; the same keystrokes inside <pre> or <code> change nothing `` | UC-9 | unit (EDITOR) |
| T-19 | `Backspace right after "# " → <h1> restores <p># </p> with the caret after the space and preventDefault` | UC-10 | unit (EDITOR) |
| T-20 | `Backspace after a transform followed by any other key/input/mousedown/blur is NOT a revert (default not prevented)` | UC-10 | unit (EDITOR) |
| T-21 | `undo after "hello", Enter, "# " restores the literal "# " in one step and leaves "hello"; redo re-applies the heading; historyEntries grows by exactly one for the transform` | UC-11 | unit (EDITOR) |
| T-22 | `no rule fires for "foo - ", inside li, td, pre, summary, or an existing heading; nothing fires with [markdownShortcuts]=false` | UC-12 | unit (EDITOR) |
| T-23 | `input observers receive the post-transform text and caret (observer sees '' after "# ", not "# ")` | UC-13 | unit (EDITOR) |
| T-24 | `slash-commands directive: "/h1" still opens the menu on an editor with rules on; after "# " the menu is closed` | UC-13 | unit (addons/slash-commands spec) |
| T-25 | `htmlChange fires once per transform with the transformed html; markdownChange emits "# Title" after typing "# Title"; maxLength budget uses post-transform length` | UC-14 | unit (EDITOR) |
| T-26 | `activeFormats has heading1/2/3 or paragraph according to the caret's block; blockquote, codeBlock, code, bulletList, orderedList, taskList detected` | UC-15, UC-16 | unit (EDITOR) |
| T-27 | `activeFormats has alignCenter for text-align:center; alignLeft/alignRight mirror under locale="he"` | UC-17 | unit (EDITOR) |
| T-28 | `activeFormats has 'indent' for a nested li and not for a top-level li` | UC-18 | unit (EDITOR) |
| T-29 | `every block/list/align item renders aria-pressed + data-state from activeFormats; indent/outdent never do` | UC-15–UC-18 | unit (TOOLBAR) |
| T-30 | `'textStyle' renders a <select data-slot="rich-text-toolbar-text-style"> with 4 localized options and value paragraph|heading1|2|3 from activeFormats` | UC-19 | unit (TOOLBAR) |
| T-31 | `changing the select emits formatCommand with the option id; disabled/readonly toolbar disables the select and does not emit; aria-label = locale.toolbar.textStyle` | UC-20, UC-22 | unit (TOOLBAR) |
| T-32 | `editor: choosing Heading 2 in the select after blurring to it converts the saved block, pushes one history entry and refocuses the editor` | UC-20 | unit (EDITOR) |
| T-33 | `DEFAULT_TOOLBAR_ITEMS contains textStyle and none of paragraph/heading1-3; the explicit four-button list still renders four buttons that convert and press` | UC-21 | unit (EDITOR + TOOLBAR) |
| T-34 | `TOOLBAR_BUTTONS has a textStyle row and every locale has toolbar.textStyle` | UC-22 | unit (TOOLBAR) |
| T-35 | `at 320px the default toolbar's scrollWidth is smaller than with the four block buttons listed explicitly, by at least 3 × one button's offsetWidth (measured, not class-asserted)` | UC-22 | layout (EDITOR, browser leg only via a `sm`-independent geometry check) |
| T-36 | `select has min-height ≥ 40px under (pointer: coarse) (computed style via emulated media in the browser leg)` | UC-22 | layout (TOOLBAR) |
| T-37 | `e2e: type "# Hello" → h1 in DOM and "<h1" in editor-html; Backspace immediately after "# " reverts to text` | UC-1, UC-10 | e2e |
| T-38 | `e2e: type "**bold**" → strong; "- item" → ul>li; "---" → hr; "[] task" → task checkbox` | UC-2, UC-4, UC-5, UC-7 | e2e |
| T-39 | `e2e: Mod+Z once after "# " restores "# " literally; Text style select shows "Heading 1" while in the h1 and selecting "Normal text" converts back` | UC-11, UC-19, UC-20 | e2e |
| T-40 | `e2e (markdown editor): typing "# Title" makes editor-markdown-output read "# Title"` | UC-14 | e2e |
| T-41 | `stories MarkdownShortcuts, TextStyleSelect, ClassicHeadingButtons, TextStyleRTL pass axe (select has an accessible name; no aria-pressed on non-toggles)` | UC-19, UC-22 | story + a11y |

### C.2 Test types to cover

- **Unit** (`.spec.ts`, vitest browser leg + headless leg): RULES is pure and
  runs anywhere; EDITOR tests use the existing `installBrowserStubs` shims
  (0.8) and drive the editor by `innerHTML` + `setCaretAt` + `dispatchEvent(new
  InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' ' }))`.
  Backspace/Enter tests dispatch `KeyboardEvent('keydown', { key, cancelable:
  true })` and assert `defaultPrevented`. Undo tests call
  `component.onFormatCommand('undo')` (the toolbar path) and read
  `historyEntries()`.
- **Storybook + axe**: four stories in `rich-text-editor.stories.ts`
  (§D.6); `npm run test-storybook:a11y`.
- **e2e**: extend `e2e/harness/rich-text-editor/rich-text-editor.spec.ts`
  (auto-discovered). No `EXPLICIT_SPECS` edit. Run `npm run e2e --
  rich-text-editor` (which, after the prerequisite, also runs every `rte-*`
  spec — the slash-commands and mentions harnesses are the interaction gate).
- **Perf**: no perf claim in this spec; the rule check is O(length of the
  caret's block text) per input event (§D.2) — T-9…T-18 double as the
  guard that the check reads only the caret block, by asserting a spy on
  `buildTriggerAwareText` is still called exactly once per input.

### C.3 Edge cases and failure modes the tests must cover

- Empty editor (`<p><br></p>`), a bare text node with no block wrapper
  (jsdom fixtures set `editor.innerHTML = 'abc'`): block rules apply to a
  wrapper-less top-level text node by first wrapping it in `<p>` (T-9 covers
  the empty case; add one assertion for the bare-text case).
- Marker typed in the middle of text (`foo # `) — no fire (T-22).
- Very long block (10 000 chars) — the inline rule only inspects the caret's
  text node's last 200 characters (`INLINE_RULE_LOOKBEHIND`); assert a
  200-char-plus-marker case still transforms and a marker 300 chars back does
  not (T-6 boundary case).
- RTL (`locale="he"`): `# ` before Hebrew text, and alignment mirroring (T-27).
- Touch-only: the Text style select is a native control — coarse-pointer
  height (T-36); no hover-only affordance exists.
- Disabled / readonly: rules never run (contenteditable is off; add a guard
  test in T-22 with `readonly=true` and a synthetic input event).
- Undo/redo replay: `isUndoRedo` true → rules skipped (T-21 exercises it).
- IME: `inputType: 'insertCompositionText'` must **not** fire block rules
  (composition still open); `insertText` and a test-only `Event('input')`
  with no `inputType` do (T-9 variant).
- Rule inside a mention chip / actioned span: inline rules require the match
  to lie in a single text node whose closest element ancestor within the
  editor is the block itself or an inline formatting element (`strong`,
  `em`, `u`, `s`, `span` without `data-*`) — assert `**x**` typed inside a
  `[data-mention]` span does not fire.

### C.4 Coverage expectation

- `rich-text-input-rules.ts`: 100% lines/branches (pure).
- New/changed lines in `rich-text-editor.component.ts`,
  `sub/rich-text-toolbar.component.ts/.html`, `rich-text-locales.ts`: 100% of
  the introduced lines; the files' overall line coverage must not drop below
  their pre-spec value (record the numbers from `npm run coverage` in the
  Task 1 retrospective).
- Coverage is measured by `npm run sonar:gate` (both legs) — the Definition
  of Done requires zero uncovered introduced lines.

---

## D. Architecture section

### D.1 Usability — the public API

**Simple mode (defaults on, nothing to write):**

```html
<ui-rich-text-editor [(ngModel)]="doc" />
<!-- typing "# ", "- ", "1. ", "> ", "[] ", "---", "```", **bold**, *italic*, `code` just works;
     the toolbar shows a Text style select instead of P/H1/H2/H3 buttons -->
```

**Opting out of the rules, keeping the new toolbar:**

```html
<ui-rich-text-editor [markdownShortcuts]="false" />
```

**Custom toolbar — the classic four buttons instead of the select:**

```html
<ui-rich-text-editor
  [toolbarItems]="['bold', 'italic', 'separator', 'paragraph', 'heading1', 'heading2', 'heading3']" />
```

**Custom toolbar — select plus block toggles, minimal:**

```html
<ui-rich-text-editor [toolbarItems]="['textStyle', 'separator', 'bulletList', 'blockquote', 'codeBlock']" />
```

**Reading block state (e.g. for an app-level status bar):**

```ts
readonly editor = viewChild.required(RichTextEditorComponent);
readonly blockLabel = computed(() => {
  const f = this.editor().activeFormats();
  if (f.has('heading1')) return 'H1';
  if (f.has('codeBlock')) return 'Code';
  return f.has('blockquote') ? 'Quote' : 'Text';
});
```

**Exported additions** (all from the `rich-text-editor` barrel):

```ts
// rich-text-editor.component.ts
markdownShortcuts = input<boolean>(true);          // new input, JSDoc'd (docs:regen picks it up)
activeFormats: Signal<Set<string>>;                // unchanged type; new members below

// sub/rich-text-toolbar.component.ts
export type ToolbarItem = … | 'textStyle';         // new union member
export const TEXT_STYLE_OPTIONS = ['paragraph', 'heading1', 'heading2', 'heading3'] as const;
export type TextStyleOption = (typeof TEXT_STYLE_OPTIONS)[number];

// rich-text-input-rules.ts (new support file)
export type BlockInputRuleKind = 'heading1' | 'heading2' | 'heading3' | 'bulletList' | 'orderedList'
  | 'blockquote' | 'taskUnchecked' | 'taskChecked' | 'horizontalRule' | 'codeBlock';
export interface BlockInputRuleMatch { kind: BlockInputRuleKind; markerLength: number; language?: string }
export type InlineInputRuleKind = 'strong' | 'em' | 'code';
export interface InlineInputRuleMatch { kind: InlineInputRuleKind; start: number; end: number; text: string }
export function matchBlockInputRule(textBeforeCaret: string, terminator: ' ' | '\n' | ''): BlockInputRuleMatch | null;
export function matchInlineInputRule(textBeforeCaret: string): InlineInputRuleMatch | null;
```

`activeFormats` member names (the complete vocabulary after this spec; the
toolbar's `isActive` map is generated from `TOOLBAR_BUTTONS` keys ∩ this
list):

| Set member | Meaning |
|---|---|
| `bold` `italic` `underline` `strikethrough` | unchanged (`queryCommandState`) |
| `code` | caret inside inline `<code>` (not inside `<pre>`) — **now actually set** |
| `bulletList` `orderedList` | unchanged detection; **now honoured by the toolbar** |
| `taskList` | unchanged |
| `paragraph` | closest block is `p`/`div` and none of heading/blockquote/pre/li applies |
| `heading1` `heading2` `heading3` | closest block is `h1`/`h2`/`h3` (`h4`–`h6` add nothing) |
| `blockquote` | inside `<blockquote>` |
| `codeBlock` | inside `<pre>` |
| `alignLeft` `alignCenter` `alignRight` | block's physical `text-align` (inline style, `align` attr, else `getComputedStyle`), mirrored by `isRtl()` (`left`→`alignLeft` in LTR / `alignRight` in RTL; `right` the converse; `center`→`alignCenter`; `start`/`end` resolve through `isRtl()`; `justify`/none → nothing) |
| `indent` | caret's `<li>` has `getListDepth ≥ 2` — data only, not a pressed button |

### D.2 Efficiency

- Rule check per input event: one `closestBlock` walk (≤ tree depth), one
  `textBeforeCaret` read of the caret's **text node** for inline rules
  (sliced to the last `INLINE_RULE_LOOKBEHIND = 200` chars) and the block's
  `textContent` **only for block rules and only when the caret text node's
  prefix is ≤ 8 chars** (every block marker is ≤ 7 chars: ```` ```xyz ````
  language words are capped at 16 by the regex, so the cap is 24). Budget:
  < 0.1 ms per keystroke on a 500 KB document; no whole-document walk is
  added — `onInput` already sanitizes the entire `innerHTML`, which dwarfs
  this.
- `updateActiveFormats` gains one ancestor walk (caret → editor root) that
  collects block, `code`, `pre`, `blockquote`, `li` depth and `text-align` in
  a single pass, replacing the separate `detectTaskListFormat` walk. Net:
  one walk fewer than today. `getComputedStyle` is called at most once, only
  when neither inline style nor `align` attribute is present.
- Toolbar: `isActive(item)` stays O(1) (a `Set.has` through a constant map);
  the select's `value` is a `computed` over `activeFormats()`.

### D.3 DX for the consuming developer

- **Learn:** nothing for the defaults. One input (`markdownShortcuts`) and one
  toolbar item id (`'textStyle'`) if they customise; the eleven rules are
  listed in the demo page and in `docs/rich-text-editor.md`.
- **Ignore:** `rich-text-input-rules.ts` (internal, but exported pure
  functions for anyone who wants to reuse the matcher in a custom slash
  command).
- **Types they touch:** `ToolbarItem` (gains `'textStyle'`),
  `DEFAULT_TOOLBAR_ITEMS` (changes), `RichTextLocale['toolbar']` (gains
  `textStyle` — a consumer who ships a custom full locale object gets a
  compile error naming the missing key; that is the intended pre-1.0
  behaviour, no optional-field hedging).
- **Holding it wrong:** an unknown `toolbarItems` entry already renders a
  bare id as tooltip and a blank icon (0.5); with the typed table it is a
  compile error. Passing `'textStyle'` to the floating toolbar is a no-op
  (that list is hardcoded). There are no runtime error messages to add.
- **Behavioural change to announce in the PR body:** default toolbar layout
  changes (select replaces four buttons); `activeFormats()` grows new
  members (additive); typing `# ` now formats — consumers who relied on
  literal `# ` text set `[markdownShortcuts]="false"`.

### D.4 Implementation design

#### D.4.1 Files

```text
packages/components/ui/rich-text-editor/
  rich-text-input-rules.ts            # NEW — pure matchers + constants (no Angular, no DOM)
  rich-text-input-rules.spec.ts       # NEW
  rich-text-editor.component.ts       # MODIFIED — markdownShortcuts input, applyInputRules(), Backspace revert,
                                      #            extended updateActiveFormats(), DEFAULT_TOOLBAR_ITEMS
  rich-text-editor.component.spec.ts  # MODIFIED — two new describe blocks
  rich-text-locales.ts                # MODIFIED — toolbar.textStyle in the interface + 10 dictionaries
  sub/rich-text-toolbar.component.ts  # MODIFIED — 'textStyle' item, TOOLBAR_BUTTONS row, TEXT_STYLE_OPTIONS,
                                      #            isActive map, textStyleValue computed, onTextStyleChange
  sub/rich-text-toolbar.component.html# MODIFIED — @else if (item === 'textStyle') branch
  sub/rich-text-toolbar.component.css # MODIFIED — coarse-pointer rule covers select
  sub/rich-text-toolbar.component.spec.ts
  rich-text-editor.stories.ts         # MODIFIED — 4 stories
e2e/harness/rich-text-editor/rich-text-editor.spec.ts   # MODIFIED — T-37…T-40
demo/src/app/demos/inputs/rich-text-editor-demo.component.ts (+ .locales.ts)  # MODIFIED — new section
docs/rich-text-editor.md              # MODIFIED — "Markdown shortcuts" + "Text style select" sections
packages/components/registry.json + packages/cli/src/registry/index.ts       # REGENERATED by sync-registry --fix
```

Registry: the new `rich-text-input-rules.ts` lands in
`rich-text-editor.files[]` via `npx tsx packages/cli/scripts/sync-registry.ts
--fix`; **no CLI publish** (component source + registry data only — verified
boundary in CLAUDE.md "When a CLI npm Publish Is Required"). Run `npm run
docs:regen` for the new input's API table.

#### D.4.2 `rich-text-input-rules.ts` (pure)

```ts
export const INLINE_RULE_LOOKBEHIND = 200;

const BLOCK_RULES: ReadonlyArray<{ kind: BlockInputRuleKind; pattern: RegExp; requiresTerminator: boolean }> = [
  { kind: 'heading1',       pattern: /^#$/,                requiresTerminator: true },
  { kind: 'heading2',       pattern: /^#{2}$/,             requiresTerminator: true },
  { kind: 'heading3',       pattern: /^#{3}$/,             requiresTerminator: true },
  { kind: 'bulletList',     pattern: /^[-*]$/,             requiresTerminator: true },
  { kind: 'orderedList',    pattern: /^\d{1,3}\.$/,        requiresTerminator: true },
  { kind: 'blockquote',     pattern: /^>$/,                requiresTerminator: true },
  { kind: 'taskUnchecked',  pattern: /^\[\]$/,             requiresTerminator: true },
  { kind: 'taskChecked',    pattern: /^\[[xX]\]$/,         requiresTerminator: true },
  { kind: 'horizontalRule', pattern: /^-{3}$/,             requiresTerminator: false },
  { kind: 'codeBlock',      pattern: /^`{3}(\w{0,16})$/,   requiresTerminator: true },
];
```

`matchBlockInputRule(textBeforeCaret, terminator)`:
- `terminator` is `' '` when the input that just landed was a space (the
  caller strips it: `textBeforeCaret` excludes the terminator), `'\n'` when
  called from the Enter keydown (only `codeBlock` accepts `'\n'`), `''` for
  any other input (only `horizontalRule` — `requiresTerminator: false` —
  can match).
- Returns `{ kind, markerLength: text.length + terminator.length, language }`
  or `null`. `\u00A0` is treated as a space before matching.

`matchInlineInputRule(textBeforeCaret)` runs on the last
`INLINE_RULE_LOOKBEHIND` characters, in this order, anchored at the end:
1. `strong`: `/\*\*(?=\S)([^*]*?\S)\*\*$/` → the match must be preceded by
   start-of-string or a non-`*` char.
2. `em`: `/(?<![*\w])\*(?=\S)([^*]*?\S)\*$/` and the text before the
   opening `*` must not end with `*` (rejects the inner star of `**bo*`).
3. `code`: `` /`([^`]+)`$/ ``.
Returns `{ kind, start, end, text }` with offsets relative to the sliced
string's origin in the full text node (the caller adds the slice base).

No Angular, no DOM, no `document` — the spec test imports nothing else.

#### D.4.3 The base: `applyInputRules()` in `onInput`

```ts
onInput(event: Event): void {
    const div = event.target as HTMLDivElement;
    const transformed = this.applyInputRules(event);           // NEW — before anything reads the DOM
    const html = this.sanitizer.sanitize(div.innerHTML).replaceAll('\u200B', '');
    … (unchanged: trigger text, caret, notifyInputObservers, htmlContent.set, onChange)
    if (transformed) {
        this.pushHistory();                                   // entry N+1: the transformed state
    } else if (!this.isUndoRedo) {
        this.scheduleDebouncedHistoryPush();
    }
    this.isUndoRedo = false;
}
```

`applyInputRules(event): boolean` (cognitive complexity ≤ 15 — split as
listed):

1. Guards (early returns): `!this.markdownShortcuts()`, `this.isUndoRedo`,
   `this.disabled() || this.readonly()`, `inputType` starts with `delete` /
   `history` / `format` or equals `insertCompositionText`
   (`(event as InputEvent).inputType ?? 'insertText'` — a test `Event` has
   none and is treated as `insertText`), no collapsed selection inside the
   editor.
2. `const ctx = this.inputRuleContext()` → `{ block, textNode, offset,
   blockPrefix }` where `block = closest block element of the caret`
   (`P`, `DIV`, `H1`–`H6`, `LI`, `TD`, `TH`, `PRE`, `BLOCKQUOTE`, `SUMMARY`,
   or the editor root itself when the caret is in a bare top-level text
   node), `textNode` = caret text node (or `null`), `offset`, and
   `blockPrefix` = the block's text before the caret (via a range from the
   block start to the caret, `\u200B` stripped) — computed lazily only when
   the caret text node prefix is ≤ 24 chars.
3. `tryBlockRule(ctx, terminator)`: eligible only when `block.tagName ∈ {P,
   DIV}` (or the editor root — then `wrapBareTextInParagraph` first) and
   `!block.closest('pre, li, td, th, summary')`. Terminator = `' '` when
   `inputType === 'insertText' && data === ' '` **or** (test path) the
   prefix ends with a space; else `''`. Strip the terminator, call
   `matchBlockInputRule`. On a match: `snapshotBeforeTransform()` (below),
   remove the first `markerLength` characters from the block (a range from
   the block start with the caret's text offsets — the marker always lives
   in the block's leading text), then dispatch on `kind`:
   - `heading1-3` → `replaceBlockTag(block, 'h1'|'h2'|'h3')`, caret at the
     block start (offset 0 of the first text node, or the element if empty
     → ensure `<br>` via `isEmptyBlock`).
   - `bulletList` / `orderedList` → `wrapBlockInList(block, 'ul'|'ol')`,
     caret at item start.
   - `blockquote` → `replaceBlockTag(block, 'blockquote')`.
   - `taskUnchecked` / `taskChecked` → build the same structure
     `insertTaskList` builds (extract that DOM construction into a private
     `createTaskListItem(checked)` helper reused by both), move the block's
     remaining children into the item's `<span>` (replacing the `\u00A0`
     when non-empty), set `data-checked` and `checkbox.checked`, replace the
     block, caret at span start.
   - `horizontalRule` → replace the block with `<hr>` + `<p><br></p>`, caret
     in the new `<p>` (do not use `insertHorizontalRule`, which inserts at
     the caret and pushes history on its own).
   - `codeBlock` → `<pre><code [data-language][class="language-…"]>` with the
     block's remaining text (or `\n` when empty, matching `insertCodeBlock`
     so `handleEnterInCodeBlock`'s exit rule works), replace the block, caret
     at code start.
   Record `this.lastInputRule = { block: <new element>, revertable: true }`
   and return `true`.
4. `tryInlineRule(ctx)`: eligible when `textNode` exists, the closest element
   ancestor chain up to the block contains no `code`, `pre`, `a`,
   `[data-mention]`, `[data-tag]`, `[data-action-click]`, `[data-action-hover]`
   (inline formatting elements `strong/b/em/i/u/s/span` without `data-*`
   attributes are fine), and the block is not `PRE`. Call
   `matchInlineInputRule(textNode.data.slice(0, offset))` with the slice
   base. On a match: `snapshotBeforeTransform()`, split the text node at
   `start` and `end`, replace the middle node with
   `<strong>`/`<em>`/`<code>` containing `match.text` (markers dropped),
   then insert a `\u200B` text node after the element and put the caret at
   offset 1 of it (the existing floating-toolbar idiom, L1458-1462; the
   `\u200B` is stripped by the sanitizer pass in `onInput`/`sync`). Record
   `lastInputRule`, return `true`.
5. `snapshotBeforeTransform()`: `this.flushPendingHistoryPush()` then
   `this.syncContentFromEditor()` + `this.pushHistory()` — this captures the
   DOM **with the markers** as entry N (dedup makes it free when the state is
   already the top entry, e.g. right after another command). Because
   `pushHistory` serializes the selection, undo lands the caret exactly where
   the user was.

History sequence for UC-11 (`hello`, Enter, `# `): debounced push of
`<p>hello</p><p><br></p>` may or may not have fired; `snapshotBeforeTransform`
flushes/pushes `<p>hello</p><p># </p>` as N; transform; `onInput` pushes
`<p>hello</p><h1><br></h1>` as N+1. One `undo` → N (`# ` back). Second `undo`
→ pre-`# ` content. Redo → N+1. ✔ exactly one step for the transform.

**Backspace revert** — in `onKeydown`, insert between the shortcut dispatch
and the `Escape` check:

```ts
if (event.key === 'Backspace' && this.revertLastInputRule()) { event.preventDefault(); return; }
this.lastInputRule = null;   // any other key ends the revert window
```

`revertLastInputRule()`: returns `false` unless `lastInputRule?.revertable`
and the caret is still inside `lastInputRule.block` (collapsed). Otherwise
calls `this.undo()` (which restores entry N — the literal markers — and its
serialized caret, sets `isUndoRedo`), clears `lastInputRule`, returns `true`.
Redo remains available, as it does after any undo. The revert window also
closes in `onInput` (start), `onBlur`, `onEditorMouseDown`, `onPaste`, and
in `onSelectionChange` when the selection is no longer collapsed inside the
recorded block.

**Enter for ```` ``` ````** — in `handleEnterKey`, before
`handleEnterInTaskList`: if `markdownShortcuts()` and the caret block is a
`P`/`DIV` whose text before the caret matches the code-block rule with
terminator `'\n'` (via `matchBlockInputRule(prefix, '\n')`) → run the same
code-block transform through a shared `applyBlockRule(ctx, match)` path
(snapshot → mutate → `syncContentFromEditor()` → `pushHistory()` →
`updateActiveFormats()`), `preventDefault`, return. Keydown-driven, so no
`onInput` follows — the push happens inside this path instead.

**Observers / slash / mentions:** because the transform runs before
`buildTriggerAwareText`, observers receive the post-transform text; the slash
menu closes on `# ` (no trigger), and `matchSlashTriggerInText` still sees
`/h1`. The mentions `#` trigger is never confused with `# ` (0.6). No addon
code changes; T-24 is the guard.

**`maxLength`:** transforms only remove characters; `onBeforeInput` budgets
against `textContent`, which is post-transform on the next keystroke (T-25).

#### D.4.4 Block-state detection

Replace the tail of `updateActiveFormats()`:

```ts
private updateActiveFormats(): void {
    const formats = new Set<string>();
    …existing four queryEditorCommandState inline checks + two list checks…
    this.detectBlockFormats(formats);       // NEW single walk (absorbs detectTaskListFormat)
    this.activeFormats.set(formats);
    …existing font/colour detection…
}
```

`detectBlockFormats(formats)` walks from the selection start (or the
`selectedImage()`) to the editor root once, collecting: `code` (inline
`CODE` not under `PRE`), `codeBlock` (`PRE`), `blockquote`, `taskList`
(`UL[data-task-list]`), `heading1-3` (`H1`–`H3`), the closest block for
`paragraph` (`P`/`DIV` when no heading/blockquote/pre/li was seen) and its
`text-align`, and `indent` (`LI` with `getListDepth ≥ 2`). Alignment mapping
is a private pure method on the component, `alignmentFormat(textAlign:
string, rtl: boolean): string | null` (it is toolbar state, not a markdown
rule, so it does not belong in `rich-text-input-rules.ts`). Keep each helper
≤ 15 cognitive complexity (`detectBlockFormats` delegates per tag to a
`Record<string, (el, formats) => void>` table).

The toolbar's `isActive(item)` becomes:

```ts
private static readonly PRESSABLE = new Set<ToolbarButtonItem>([
  'bold','italic','underline','strikethrough','code','taskList',
  'bulletList','orderedList','paragraph','heading1','heading2','heading3',
  'blockquote','codeBlock','alignLeft','alignCenter','alignRight',
]);
isActive(item: ToolbarItem): boolean {
  return RichTextToolbarComponent.PRESSABLE.has(item as ToolbarButtonItem) && this.activeFormats().has(item);
}
```

`undo`/`redo`/`clear`/`horizontalRule`/`indent`/`outdent`/`textStyle` never
report pressed. The `[attr.aria-pressed]` binding must be **omitted** (not
`false`) for non-pressable items so momentary buttons are not announced as
toggles: bind `[attr.aria-pressed]="isPressable(item) ? isActive(item) : null"`.
⚠️ This is a deliberate deviation from the plan's "indent … so buttons show
pressed state": `aria-pressed` on an action button is an a11y defect
(WAI-ARIA `button` pattern: `aria-pressed` only on toggle buttons). `indent`
stays available as data in `activeFormats()` (UC-18).

#### D.4.5 The Text style select

`ToolbarItem` gains `'textStyle'`; `TOOLBAR_BUTTONS.textStyle = { id:
'textStyle', label: 'Text style', localeKey: 'textStyle', icon: <the existing
paragraph glyph> }` — the row keeps the `Record` complete and the glyph is
used as the select's leading icon on `sm+` widths. Template:

```html
@if (item === 'separator') { … }
@else if (item === 'textStyle') {
  <label [class]="textStyleClasses()" data-slot="rich-text-toolbar-text-style-wrap">
    <span class="hidden sm:inline-flex" [innerHTML]="getIcon('textStyle')" aria-hidden="true"></span>
    <select
      data-slot="rich-text-toolbar-text-style"
      [attr.aria-label]="getTooltip('textStyle')"
      [title]="getTooltip('textStyle')"
      [disabled]="interactionDisabled()"
      [value]="textStyleValue()"
      (change)="onTextStyleChange($event)"
      (mousedown)="$event.stopPropagation()"
    >
      @for (option of textStyleOptions; track option) {
        <option [value]="option">{{ locale().toolbar[option] }}</option>
      }
    </select>
  </label>
} @else { …existing button… }
```

- `textStyleValue = computed<TextStyleOption>(() => TEXT_STYLE_OPTIONS.find(o => o !== 'paragraph' && this.activeFormats().has(o)) ?? 'paragraph')`.
- `onTextStyleChange(event)`: guard `interactionDisabled()`, read
  `(event.target as HTMLSelectElement).value`, validate it is in
  `TEXT_STYLE_OPTIONS`, `formatCommand.emit(value)`. The editor's existing
  `onFormatCommand` (L1289-1300) restores the saved selection (the select
  blurred the editor → `onBlur` saved the range, L1186-1190), runs
  `formatBlock`, refocuses and pushes one entry — nothing new in the editor
  for UC-20. The `<select>` gets `[value]` re-applied after the command
  because `activeFormats` updates through `applyMutation({
  updateActiveFormats: true })`.
- Classes: `h-8 rounded-md border-0 bg-transparent px-1.5 text-sm
  hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring
  disabled:opacity-50 appearance-none max-w-[7rem] sm:max-w-[9rem] truncate
  cursor-pointer` plus a chevron via `bg-[url(data:image/svg+xml;…)]
  bg-no-repeat bg-[right_0.25rem_center] pe-5` (inline data URI, no external
  asset); in RTL (`[dir]` already set on the toolbar container) use
  `bg-[left_0.25rem_center] ps-5` via `rtl:` variants.
- CSS: `:host select { min-height: 40px }` inside the existing `(pointer:
  coarse)` block; native select keeps the OS picker on phones (the reason a
  native control beats `ui-select` here).
- `DEFAULT_TOOLBAR_ITEMS` (component L141-157): replace
  `'paragraph', 'heading1', 'heading2', 'heading3'` with `'textStyle'`.
- Locale: add `textStyle: string` to `RichTextLocale['toolbar']` and to all
  ten dictionaries (`en` "Text style", `he` "סגנון טקסט", `ar` "نمط النص",
  `de` "Textstil", `fr` "Style de texte", `es` "Estilo de texto", `ja`
  "テキストスタイル", `zh` "文本样式", `ru` "Стиль текста", `pt` "Estilo de
  texto").

### D.5 Implementation options

**Option 1 — Rules in the base, wired into `onInput`/`onKeydown` (chosen for C1)**
Pros: runs before observers (correct slash/mention interplay); one-undo-step
and Backspace-revert reuse private history + engine methods with no new host
seams; zero deps; a single boolean opt-out; the pure matcher file keeps the
4.6k-line component from absorbing regexes and is unit-testable headlessly.
Cons: base grows by ~250 lines; the default behaviour changes for every
consumer (mitigated by the input and the PR note).

**Option 2 — `rich-text-editor/markdown-shortcuts` addon on the host**
Pros: opt-in, zero base growth, matches the "13 addons" story. Cons: needs
three new host seams (pre-observer transform hook, "snapshot-then-mutate"
transaction, keydown slot between interceptors and shortcuts) plus exposing
`replaceBlockTag`/`wrapBlockInList`/task-item construction — more base
surface than the feature; every consumer must install and attach it to get
behaviour they expect by default; the addon could still not guarantee its
interceptor ordering relative to the slash menu.

**Option 3 — `execCommand`-driven transforms (`formatBlock`, `insertUnorderedList`)**
Pros: least code. Cons: engine-dependent DOM (Chrome vs Firefox wrap
differently), untestable headlessly without extending the shim per rule, and
`insertUnorderedList` toggles rather than wraps — the base already moved the
slash engine off `execCommand` for these reasons (0.3).

**✅ Chosen for C1: Option 1**, for the reasons in §0.9.

**Text style control — Option A: native `<select>` (chosen)**
Pros: zero new dependencies (base stays at `deps = ['separator']`, 21 files);
native picker on iOS/Android is the best mobile UX for a 4-item choice (the
whole motivation); keyboard/a11y for free (accessible name via `aria-label`,
arrow keys, type-ahead); ~30 lines. Cons: option list styling is OS-owned
(acceptable: four short labels); needs the `appearance-none` + chevron
treatment to match the toolbar.

**Text style control — Option B: `ui-select`**
Pros: library look for the popup; the composition rule prefers package
components. Cons: adds `select` + `skeleton` + `spinner` to the base
install (registry: `select.dependencies = ['skeleton','spinner']`), i.e.
3 components / ~10 files on every editor install, contradicting the slim-base
decision recorded in the plan; custom listbox on phones is worse than the
native sheet; the toolbar would then have two focus-management models.

**Text style control — Option C: custom popover menu (Popover API, like the slash menu)**
Pros: zero deps and full styling. Cons: reimplements listbox a11y (roving
focus, type-ahead, `aria-activedescendant`) for four items; ~150 lines the
native control gives for free.

**✅ Chosen for B1: Option A**, because the feature exists to save mobile
width, and a native select is both the smallest and the best mobile control;
the composition rule is outweighed by the recorded slim-base decision.

### D.6 Stories and demo

`rich-text-editor.stories.ts` — add:

- `MarkdownShortcuts` — default editor, `docs.description.story` lists the
  eleven rules and the Backspace-revert.
- `MarkdownShortcutsOff` — `markdownShortcuts: false`.
- `TextStyleSelect` — default toolbar at a `viewport` of 375px (Storybook
  viewport parameter) showing no horizontal scroll.
- `ClassicHeadingButtons` — `toolbarItems: ['bold','italic','separator',
  'paragraph','heading1','heading2','heading3']`.
- `TextStyleRTL` — `locale: 'he'` (select chevron/padding mirrored).

Demo (`demo/src/app/demos/inputs/rich-text-editor-demo.component.ts`, after
the "minimal" section at L100-104): a "Markdown shortcuts & text style"
section with (1) a table of the rules, (2) an editor to try them, (3) the
opt-out snippet, (4) the classic-buttons snippet, (5) a note that `Backspace`
reverts. Strings go through `rich-text-editor-demo.locales.ts` like the
existing headings (`t().minimalHeading` etc.).

`docs/rich-text-editor.md`: append "Markdown shortcuts" (rule table, undo
semantics, opt-out, interplay with slash/mentions) and "Text style select"
(item id, default layout change, classic items).

### D.7 Risks

| Risk | Mitigation |
|---|---|
| Rule fires on an undo replay and re-transforms the restored `# ` | `isUndoRedo` guard first in `applyInputRules`; T-21 asserts the literal text survives undo |
| `pushHistory` dedup swallows the marker snapshot when identical to the last entry (e.g. two transforms in a row) | Dedup only fires when the html is byte-identical to the top entry; the marker state always differs from the previous transformed state. T-21 (two transforms) covers it |
| Backspace revert via `undo()` leaves `isUndoRedo = true` until the next input, skipping one debounced push | Same behaviour as the existing `Mod+Z` path (0.2); T-19 follows the revert with a typed character and asserts a history entry still lands after the debounce |
| Inline rule splits a text node the mentions addon is watching for `@` | Inline rules are skipped inside `[data-mention]`/`[data-tag]`; the mention popover matches at the caret's text node, which the split keeps intact after the caret (T-23, rte-mentions e2e) |
| Chrome keeps typing inside `<strong>` after the transform | `\u200B` trailing text node + caret at offset 1 (existing idiom L1458-1462); T-16 types after the transform |
| `queryCommandState` shim lacks `justify*` | Alignment read from the DOM (`style.textAlign` / `align` / computed), never from `queryCommandState` |
| `formatBlock` on a native select change runs before the editor's saved range is restored | `onFormatCommand` restores `savedRange` first (L1292); `onBlur` saves it when focus moves to the select (L1186-1190); T-32 blurs to the select before changing it |
| Removing four buttons from the default breaks consumers' visual tests | Called out in the PR body; the classic items remain valid (`UC-21`) |
| `RichTextLocale` gains a required key → consumers with custom locale objects fail to compile | Intended pre-1.0 behaviour (no optional hedging); the compile error names the key; README changelog line |
| Sonar S3776 on `applyInputRules` / `detectBlockFormats` | Designed as dispatch tables + ≤ 15-CC helpers (D.4.3/D.4.4); `npm run sonar` while iterating |
| Mobile IME composition fires block rules mid-composition | `insertCompositionText` excluded; rules fire on the committed `insertText` |

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-8 (`rich-text-input-rules.spec.ts`), T-9…T-25 (editor `markdown input rules` describe), T-26…T-28 (editor `block-state activeFormats`), T-29…T-34 (toolbar), T-35/T-36 layout, and the e2e T-37…T-40 skeletons; record pre-spec coverage numbers for the touched files | UC-1…UC-22 | ⬜ Not started | — | — | — |
| 2 | Implement `rich-text-input-rules.ts` (pure matchers, constants, types) — T-1…T-8 green | UC-1…UC-9 | ⬜ Not started | — | — | — |
| 3 | Base block rules: `markdownShortcuts` input, `applyInputRules` + `inputRuleContext` + `tryBlockRule` + `applyBlockRule` + `createTaskListItem` extraction, `onInput` history branch, Enter-terminated code fence — T-9…T-15, T-22, T-23, T-25 green | UC-1…UC-6, UC-12…UC-14 | ⬜ Not started | — | — | — |
| 4 | Base inline rules (`tryInlineRule`, node split, `\u200B` caret parking) + Backspace revert (`lastInputRule`, `revertLastInputRule`, window-closing hooks) — T-16…T-21, T-24 green; run `npm run e2e -- rte-slash-commands rte-mentions` | UC-7…UC-11, UC-13 | ⬜ Not started | — | — | — |
| 5 | Block-state detection: `detectBlockFormats` single walk (absorbs `detectTaskListFormat`), alignment mirroring, `indent`; toolbar `PRESSABLE` map + omitted `aria-pressed` on momentary buttons — T-26…T-29 green | UC-15…UC-18 | ⬜ Not started | — | — | — |
| 6 | Text style select: `'textStyle'` union member + `TOOLBAR_BUTTONS` row + `TEXT_STYLE_OPTIONS`, template branch, `textStyleValue`, `onTextStyleChange`, css coarse rule, `toolbar.textStyle` in the interface + 10 locales, `DEFAULT_TOOLBAR_ITEMS` change — T-30…T-36 green | UC-19…UC-22 | ⬜ Not started | — | — | — |
| 7 | Registry + docs: `sync-registry --fix` (new file), `npm run docs:regen` (new input), `docs/rich-text-editor.md` sections, README/changelog note on the default-toolbar change | UC-21, UC-22 | ⬜ Not started | — | — | — |
| 8 | Stories `MarkdownShortcuts`, `MarkdownShortcutsOff`, `TextStyleSelect`, `ClassicHeadingButtons`, `TextStyleRTL` + demo section + demo locales — T-41 green under `npm run test-storybook:a11y` | UC-19, UC-22 | ⬜ Not started | — | — | — |
| 9 | e2e: fill T-37…T-40 in `e2e/harness/rich-text-editor/rich-text-editor.spec.ts`; `npm run e2e -- rich-text-editor` green (base + every `rte-*`) | UC-1, UC-2, UC-4, UC-5, UC-7, UC-10, UC-11, UC-14, UC-19, UC-20 | ⬜ Not started | — | — | — |
| 10 | Final gates: `npm run lint`, full `npm run test-visual` (zero failures, pre-existing included), `npm run sonar:gate` clean on every changed file, review-gate ≥ 91; append accepted follow-ups (out-of-scope rules) to `specs/rich-text-editor.ideas.md` | all | ⬜ Not started | — | — | — |

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

_Append one entry per task as it completes (date, score, reviewer rationale,
follow-ups). Never edit or delete an earlier entry._

## Plan corrections recorded by this spec (⚠️, never rewrite the plan silently)

1. Toolbar pressed state: the base already reports `bulletList`/`orderedList`
   but the toolbar ignores them; the toolbar honours `code` but the base never
   sets it (§0.4).
2. Only slash-commands and mentions/tags consume `registerInputObserver`; the
   emoji addon has no typed trigger (§0.6).
3. The markdown service's `hasMarkdownSyntax`/`applyFormat`/`insertHeading`/
   `insertCodeBlock` are uncalled string-buffer helpers, not a live-rule seam
   (§0.7).
4. `indent`/`outdent` do not get `aria-pressed`; nesting is exposed as data
   only (§D.4.4).
5. C1 placement resolved: base, not addon (§0.9).
