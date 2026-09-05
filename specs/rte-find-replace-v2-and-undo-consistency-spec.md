# Rich Text Editor — Find & Replace v2 + Undo Consistency

> **Status:** Approved design — ready for implementation
> **Date:** 2026-09-03
> **Plan items:** B2 (find & replace v2) · B6 (undo consistency)
> **Source plan:** `C:\Users\dasha\.claude\plans\look-at-the-richtext-snuggly-cook.md`
> Never delete resolved items — mark them fixed and append below.

> # 🛑 STOP — READ BEFORE ANY WORK
>
> **This spec depends on:** `rte-markdown-input-rules-and-block-toolbar-spec` ·
> `rte-dx-trio-and-base-e2e-spec`
>
> **Before writing any code, verify each prerequisite is complete** by checking
> its Completion Log — every task row must show a review score ≥ 91.
>
> **If any prerequisite is incomplete: STOP IMMEDIATELY. Do not start. Do not
> work around it. Do not implement the prerequisite yourself.** Alert the user
> that this spec is blocked, name the missing prerequisite, and end your turn.

Why these two: both prerequisites edit `rich-text-editor.component.ts` (the
same 4,670-line file this spec edits — serialize to avoid merge conflicts);
`rte-dx-trio-and-base-e2e-spec` creates the base e2e harness
`e2e/harness/rich-text-editor/` this spec extends and **deletes**
`customToolbarItems` / `customToolbarAction` / `RichTextEditorRef` (confirmed
by that spec's author on 2026-09-03), which removes one of B6's three mutation
paths; and it restructures the toolbar table (A8) that Task 5 adds one entry to.

---

## 0. Step-0 verification — what exists today (read before believing the plan)

All line numbers are for `packages/components/ui/rich-text-editor/` at commit
`17d09663` (master, 2026-09-03). Re-check them; the two prerequisite specs
will have shifted them.

### 0.1 Find & replace — the current implementation

| Fact | Evidence |
|---|---|
| State: `findReplaceVisible`, `findQuery`, `replaceText`, `findCaseSensitive`, `findMatches: signal<Range[]>`, `findCurrentIndex`, `findShowReplace`, `private findHighlightElements: HTMLElement[]` | `rich-text-editor.component.ts:411-418` |
| `openFindReplace(showReplace)` — sets flags, `requestAnimationFrame` → focuses `input[placeholder]` | `:3332-3339` |
| `closeFindReplace()` — clears highlights, query, replace text, matches, index; focuses the editor | `:3348-3356` |
| `onFindQueryChange(query)` → `performFind()` **synchronously on every keystroke, no debounce** | `:3366-3369` (the JSDoc at `:3358-3365` says so explicitly) |
| `performFind(preserveIndex=false)` — `TreeWalker(SHOW_TEXT)`, `indexOf` **within a single text node**; case folding by `toLowerCase()` | `:3381-3423` |
| `highlightFindMatches()` — **injects `<mark data-find-match>` elements into the content via `range.surroundContents(mark)`**; current match gets `data-find-current`; a match that spans elements throws and is silently skipped | `:3425-3444` |
| `clearFindHighlights()` — unwraps the marks + `parent.normalize()` | `:3446-3458` |
| `scrollToCurrentMatch()` — `mark[data-find-current].scrollIntoView` | `:3460-3463` |
| `findNext()` / `findPrevious()` — wrap-around, re-run `performFind(true)` | `:3471-3489` |
| `replaceSingle()` — re-finds, sets `textContent` of the current `<mark>`, unwraps, `syncContentFromEditor()` + `pushHistory()` | `:3500-3523` |
| `replaceAll()` — walks all marks back-to-front, `pushHistory()` once, re-finds | `:3533-3552` |
| `onFindReplaceKeydown` — `Enter` → next, `Shift+Enter` → previous | `:3561-3570` |
| Shortcuts: `Mod+F` → `openFindReplace(false)` (not gated), `Mod+H` → `openFindReplace(true)` gated on `canEdit` | `:696-710` |
| Panel template: absolutely positioned `top-2 right-2 w-80`, query input, `Aa` toggle, counter `n/m` or `0/0`, ▲ ▼ ✕ buttons **without accessible names**, replace row with Replace / Replace All | `rich-text-editor.component.html:48-92` |
| Locale keys: `findReplace.{find, findPlaceholder, replace, replacePlaceholder, replaceAll, caseSensitive, noResults, close}` in **10 locales** (en, he, ar, de, fr, es, ja, zh, ru, pt) | `rich-text-locales.ts:30-39` (interface), `:106`, `:177`, `:248`, `:318`, `:388`, `:458`, `:528`, `:598`, `:668`, `:738` |
| Placeholder convention for interpolated strings is `{name}` (`'{count} characters'`, `'{rows} x {cols} table'`) | `rich-text-locales.ts:130,144-145` |
| The sanitizer **allow-lists `mark`** | `rich-text-sanitizer.service.ts:45` |
| No toolbar item opens find — `ToolbarItem` union (`sub/rich-text-toolbar.component.ts:57-81`) has no `'find'`; the panel is reachable **only** via `Mod+F` / `Mod+H` | grep `find` in the toolbar file: no matches |
| Existing unit coverage: 11 tests in `describe('RichTextEditorComponent — find and replace')` — open, case-insensitive matches + mark count, clear on empty query, next/previous wrap, case toggle, no-editor no-op, no-match no-ops, replaceSingle, replaceAll, Enter/Shift+Enter, close resets | `rich-text-editor.component.spec.ts:2688-2813` |
| No story exercises find (grep `find` in `rich-text-editor.stories.ts`: none); no demo page mentions it (grep in `demo/src/app/demos/inputs/rich-text-editor-demo.component.ts`: none) | — |

**The real defect the plan under-describes.** Because the highlights are real
`<mark>` elements inside the contenteditable and `mark` is allow-listed by the
sanitizer, any model sync while the panel is open — typing (`onInput`
`:786-810`), a toolbar command (`applyMutation` `:3696-3708`), an addon
`mutateContent` — serializes the marks into `htmlContent`, `htmlChange`, the
form value and the next history entry. `replaceSingle` itself calls
`performFind()` (re-injecting marks) *before* mutating. The plan's phrase
"highlight-all via a temporary `<mark>` overlay" would keep exactly this bug.
This spec therefore replaces DOM-injected marks with a **non-content overlay**
(§D.4). See "Plan corrections" in §7.

### 0.2 History model

| Fact | Evidence |
|---|---|
| `HistoryEntry { html, delta, keyframe, selection, timestamp, preview, previewLines, lineCount }` | `:119-128` |
| `pushHistory()` — dedupes against the last reconstructed HTML, truncates redo tail, every 10th entry is a keyframe, otherwise a line-based delta; trims to `historyLimit` (min 10); calls `bumpHistoryVersion()` | `:4413-4459` |
| `undo()` / `redo()` are **private**; they flush the pending debounce, set `isUndoRedo`, write the DOM, restore the serialized selection, call `onChange`, bump the version | `:4461-4505` |
| `scheduleDebouncedHistoryPush()` uses `historyDebounceMs` (default 450, `:292`) ; `flushPendingHistoryPush()` is public (host surface) | `:4507-4526` |
| `historyVersion` read-only signal bumped on every stack change — the history addon's only reactive hook | `:407-409`, `:4555-4557`; consumed at `addons/history/rich-text-history-panel.component.ts:88` |
| `captureSelection()` / `restoreSerializedSelection()` — child-index paths from the editor root | `:4577-4620` |
| `ngOnInit` pushes the initial (empty) entry | `:608-611` |
| `restoreHistoryEntry(index)` (host surface) jumps without pushing | `:1246-1267` |

### 0.3 Mutation paths that skip history (B6)

| Path | Today | Evidence |
|---|---|---|
| `writeValue(value)` | Writes model + DOM; **no** `onChange`, **no** history entry — the JSDoc says "a programmatic `setValue` cannot be undone, and undo will jump back to the state before it" | `:729-755` |
| `insertTextFromOverlay(text)` | Flushes pending history, restores selection, `insertText` (which syncs the model), re-saves the caret — **no** `pushHistory` | `:1505-1531`; the JSDoc at `:1512-1513` admits it. **The host contract says the opposite**: `rich-text-editor.host.ts:145-151` documents it as "inserts as one history entry". Only consumer: `addons/emoji/rich-text-emoji.directive.ts:68` |
| `RichTextEditorRef.insertText/insertHtml` | Call the private `insertText`/`insertHtml` (`:3572-3619`), which sync but do not push | `:3311-3322`, JSDoc `:244-251`. **Deleted by `rte-dx-trio-and-base-e2e-spec`** (review Rec 16, `docs/reviews/rich-text-editor-review.md:517`) — nothing to do here |
| `insertTextAtCaret` / `insertHtmlAtCaret` (host surface) | **Already** push one entry each | `:1540-1549` |
| `mutateContent` / `wrapSelection` / `applyInlineStyle` (host surface) | Already push via `applyMutation({ pushHistory: true })` | `:3818-3839` |

There is no `setContent`, `isDirty`, `historyChange`, `recordHistory`, or
`recordExternalWrites` anywhere under `packages/components/ui/rich-text-editor`
(grep 2026-09-03). The only `historyChange` in the library is Kanban's
`historyChange = output<KanbanHistoryState>()` with
`KanbanHistoryState { canUndo: boolean; canRedo: boolean }`
(`ui/kanban/kanban.component.ts:113-116, 402`) — this spec mirrors that shape
for consistency.

### 0.4 Test legs, gates and tooling

- Unit specs run in two legs: vitest browser (`npm run test-visual`) and the
  portable jsdom leg (`npm run test:portable`, `vitest.portable.config.ts`).
  The spec file installs geometry/`execCommand`/`scrollIntoView` shims for the
  jsdom leg (`rich-text-editor.component.spec.ts:30-60`), so overlay geometry
  code must tolerate zero-size rects.
- `npm run docs:regen` regenerates the API tables from JSDoc; a new public
  input/output/method without it gets no docs (memory: API docs regen gotchas).
- e2e: the base harness `e2e/harness/rich-text-editor/` is created by
  `rte-dx-trio-and-base-e2e-spec`; this spec **extends** its spec file.
  Addon harnesses (`e2e/harness/rte-*`) are untouched.

---

## B. Product Manager section

### B.1 Business logic

**Find & replace v2.** The editor's find panel finds every occurrence of a
query across the document, including phrases that are broken by inline markup
(`the <b>cat</b> sat` matches "the cat sat"), shows a live "3 of 12" counter,
highlights every match with the current one emphasised, and steps between
matches with Enter / Shift+Enter or the arrow buttons. Highlights are a visual
overlay — they never enter the document, the form value, `htmlChange`, or the
undo history. Three toggles refine the search: match case (existing), whole
word, and regular expression; an invalid regex is reported inline instead of
throwing. Replace and Replace-all replace the matched text (keeping the
surrounding formatting); Replace-all is a single undo step. The search is
debounced so large documents stay responsive, and it re-runs automatically
when the document changes underneath the open panel. The panel works with the
keyboard, on touch (a toolbar button opens it), and in RTL locales.

**Undo consistency.** Every way content enters the editor becomes undoable in a
predictable way: a new public `setContent(value, { recordHistory })` method for
programmatic edits (recorded by default), an opt-in `recordExternalWrites`
input so form `setValue`/`patchValue` writes can be undone, and overlay-driven
inserts (emoji picker) record one entry. Consumers can react to the undo stack
through a `historyChange` output and `canUndo` / `canRedo` signals, and ask the
editor whether the document differs from what was last loaded via `isDirty()`
(with `markClean()` after a save).

### B.2 Why the customer wants this

- **Find misses phrases.** Any bolded/linked/coloured word breaks a match
  today (`:3381-3411` searches one text node at a time). The workaround is to
  search for one word at a time and eyeball the rest.
- **Highlights corrupt content.** Typing while the panel is open saves
  `<mark>` tags into the form value (§0.1). The workaround is to close the
  panel before every edit — or to ship `<mark>`s to the backend without
  noticing.
- **No whole-word / regex.** Renaming `cat` → `dog` also hits `category`. The
  workaround is Replace one-by-one, reading each hit.
- **Keyboard-only.** Touch users cannot open find at all (no toolbar item,
  §0.1). There is no workaround.
- **Undo skips programmatic writes.** After `form.setValue(draft)` or a
  `host.insertTextFromOverlay('🎉')`, `Ctrl+Z` jumps to a state the user never
  saw (or removes the emoji together with the previous typing burst). The
  workaround is to avoid `setValue` after first render, which breaks
  "load draft" and "restore version" flows.
- **No dirty / can-undo signals.** Apps that need "unsaved changes" prompts
  or their own undo buttons currently compare serialized HTML strings
  themselves and poll `historyVersion` (an addon-host surface, not a
  consumer API).

### B.3 Use cases = definition of done

Written from the consuming developer's point of view. Each is observable
without reading the source and atomic.

**Find & replace v2**

- **UC-1 — Cross-markup matching.** With content
  `<p>the <b>cat</b> sat on the <i>c</i>at mat</p>` and query `cat`, the
  counter shows `1 of 2` and both occurrences are highlighted.
- **UC-2 — Block boundary stops a match.** With `<p>cat</p><p>alog</p>` and
  query `catalog`, the counter shows `No results` (matches never cross block
  elements).
- **UC-3 — Debounced query.** Typing three characters within
  `findDebounceMs` runs the search once, after the last keystroke;
  `findDebounceMs="0"` searches synchronously.
- **UC-4 — Counter.** The counter reads `{current} of {total}` from the
  locale (`3 of 12`), `No results` when the query has no hits, and is empty
  when the query is empty; the counter is an `aria-live="polite"` region.
- **UC-5 — Highlight-all is an overlay.** With the panel open and matches
  highlighted, the editor DOM contains **no** `mark[data-find-match]`, the
  form value / `htmlChange` payload contains no `<mark`, and the number of
  history entries does not change when the query changes.
- **UC-6 — Typing with the panel open is safe.** Typing a character while
  matches are highlighted produces a form value without `<mark`, and the
  matches/counter refresh after the debounce to reflect the new text.
- **UC-7 — Whole-word toggle.** With `cat category concat` and query `cat`,
  whole-word ON gives `1 of 1`; OFF gives `1 of 3`. Whole-word is
  Unicode-aware: `שלום` inside `שלום עולם` is a whole word.
- **UC-8 — Regex toggle.** With regex ON, query `c.t` matches `cat` and `cot`
  in `cat cot cart`; the counter shows `1 of 2`.
- **UC-9 — Invalid regex is reported, not thrown.** With regex ON and query
  `(`, the counter shows the locale's `invalidRegex` text, the query input has
  `aria-invalid="true"`, no highlights are drawn, and nothing throws.
- **UC-10 — Zero-length regex matches are ignored.** With regex ON and query
  `a*`, the search terminates and reports only non-empty matches.
- **UC-11 — Regex replace supports groups.** With regex ON, query
  `(\w+)@(\w+)` and replacement `$2 at $1`, Replace turns `jane@acme` into
  `acme at jane`.
- **UC-12 — Replace keeps surrounding formatting.** With `<p>the <b>cat</b>
  sat</p>`, query `cat`, replacement `dog`, Replace yields `<p>the
  <b>dog</b> sat</p>`.
- **UC-13 — Replace across a markup boundary.** With `<p>the <b>ca</b>t
  sat</p>`, query `cat`, replacement `dog`, Replace yields text `the dog sat`
  (the replacement lands where the match started; the emptied `<b>` is
  removed).
- **UC-14 — Replace-all is one history entry.** With five matches and a
  pending un-flushed typing burst, Replace All adds **exactly one** history
  entry (the pending burst is flushed first, as its own entry); a single undo
  restores all five originals.
- **UC-15 — Replace single is one history entry** and advances the current
  index to the next remaining match instead of resetting to the first.
- **UC-16 — Navigation wraps and scrolls.** Enter / ▼ moves to the next
  match, Shift+Enter / ▲ to the previous, both wrapping; the current match is
  scrolled into the editor's visible area (the editor's `scrollTop` changes
  when the match is below the fold).
- **UC-17 — Keyboard in the replace row.** Enter in the replace input runs
  Replace; `Mod+Alt+Enter` anywhere in the panel runs Replace All; Escape
  closes.
- **UC-18 — Opening seeds the query from the selection.** With `sat` selected
  in the editor, `Mod+F` opens the panel with query `sat` already searched
  (`1 of 1`). Opening with a collapsed selection keeps the previous query.
- **UC-19 — Closing selects the current match.** With the current match on
  the second `cat`, Escape closes the panel and the editor's selection covers
  that `cat`, focus is in the editor.
- **UC-20 — Toolbar button for touch.** `toolbarItems` accepts `'find'`; the
  rendered button opens the panel (replace row shown when the editor is
  editable); it is not in `DEFAULT_TOOLBAR_ITEMS`.
- **UC-21 — RTL panel.** With `locale="he"` the panel is anchored at the
  logical inline-end (`inset-inline-end`), the toggles and buttons render in
  RTL order, and the counter reads the Hebrew `matchCounter` string.
- **UC-22 — Readonly editor.** In `readonly` mode `Mod+F` still opens find
  (existing), the replace row is hidden even when `openFindReplace(true)` is
  called, and Replace/Replace-all cannot be triggered.
- **UC-23 — Accessible names.** The ▲ ▼ ✕ buttons and the three toggles have
  locale-driven `aria-label`s; toggles expose `aria-pressed`.
- **UC-24 — Matches inside mention/tag chips are skipped** (`[data-mention]`,
  `[data-tag]` content is not searchable or replaceable).
- **UC-25 — Performance.** A document with 2,000 matches in ~500 KB of HTML
  completes one search (index + match + overlay) in under 200 ms in the
  Chromium leg, and draws at most `500` overlay rectangles (the rest are
  counted but not painted; the current match is always painted).

**Undo consistency**

- **UC-26 — `setContent` records by default.** After `setContent('<p>two</p>')`
  on a document showing `one`, `canUndo()` is true, undo shows `one`, redo
  shows `two`, and the form's `onChange` was called with the new value.
- **UC-27 — `setContent(..., { recordHistory: false })`** writes the content
  and calls `onChange` but leaves the history stack length unchanged.
- **UC-28 — `writeValue` default is unchanged.** `writeValue` never calls
  `onChange` and, with `recordExternalWrites` false (default), does not change
  the history stack length.
- **UC-29 — `recordExternalWrites`.** With `[recordExternalWrites]="true"`,
  `form.setValue('<p>draft</p>')` adds one history entry; undo restores the
  content the user saw before the write.
- **UC-30 — Overlay insert is undoable on its own.** After typing `hi`
  (flushed) and `insertTextFromOverlay('🎉')`, one undo removes only `🎉`.
- **UC-31 — `historyChange` output.** Emits `{ canUndo, canRedo }` on push,
  undo, redo, restore and trim; after the first push `canUndo` is true and
  `canRedo` false; after undo `canRedo` is true.
- **UC-32 — `canUndo()` / `canRedo()` signals** mirror the output values.
- **UC-33 — `isDirty()`.** False right after `writeValue`; false after an
  `input` event that changes nothing; true after typing; false again after
  undoing back to the loaded content; false after `markClean()`.
- **UC-34 — `setContent` does not reset `isDirty`;** `writeValue` does.
- **UC-35 — History docs are truthful.** The JSDoc on `writeValue`,
  `insertTextFromOverlay` (component and host) and the find methods describe
  the new behaviour; `npm run docs:regen` output includes `setContent`,
  `isDirty`, `markClean`, `canUndo`, `canRedo`, `historyChange`,
  `recordExternalWrites`, `findDebounceMs`.

### B.4 Explicitly out of scope

- Search across multiple editors, search inside `<img alt>`, attributes, or
  code-block tokens beyond their text.
- Persisting find options (case/word/regex) across component instances.
- A "find in selection" scope, fuzzy/diacritic-insensitive matching,
  multiline regex (`s`/`m` flags).
- Promoting `'find'` into `DEFAULT_TOOLBAR_ITEMS` — deferred to B4 (toolbar
  overflow menu), which owns default toolbar width on mobile.
- Making `undo()`/`redo()` public, `focus()`, `insertText()`, `format()` —
  Spec 4 (`consumer API pack`) owns the imperative API and **reuses**
  `setContent` from here.
- Autosave / draft recovery (C4), named snapshots (B11).
- Changing the history delta/keyframe model or the history addon UI.
- Using the CSS Custom Highlight API (recorded as a future upgrade, §D.4).
- Adding `ui-button` / `ui-input` to the panel — the base editor deliberately
  depends only on `separator`; the panel keeps native elements.

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them
> pass. Sabotage-verify every new test (memory: derive the break from the
> contract, never from the assertion).

### C.1 Traceability table

Unit tests live in `rich-text-editor.component.spec.ts`. Extend the existing
`describe('RichTextEditorComponent — find and replace')` (`:2688`) — set
`findDebounceMs` to `0` in its `beforeEach` so the 11 existing tests keep
their synchronous shape — and add the T-1…T-30 cases there. Add a new
`describe('RichTextEditorComponent — undo consistency')` for T-31…T-44.
Story tests are in `rich-text-editor.stories.ts`; e2e in
`e2e/harness/rich-text-editor/rich-text-editor.spec.ts`.

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `matches a phrase split by inline markup and counts it` | UC-1 | unit |
| T-2 | `does not match across block boundaries` | UC-2 | unit |
| T-3 | `debounces the query and searches once after the last keystroke` (fake timers, `findDebounceMs=100`) | UC-3 | unit |
| T-4 | `findDebounceMs=0 searches synchronously` | UC-3 | unit |
| T-5 | `counter renders "{current} of {total}", "No results", and empty` | UC-4 | unit |
| T-6 | `counter is an aria-live polite region` | UC-4, UC-23 | unit |
| T-7 | `highlights never enter the editor DOM, the form value or history` | UC-5 | unit |
| T-8 | `typing with the panel open keeps the form value mark-free and refreshes matches` | UC-6 | unit |
| T-9 | `whole-word toggle limits matches to whole words (ASCII)` | UC-7 | unit |
| T-10 | `whole-word is Unicode-aware (Hebrew)` | UC-7 | unit |
| T-11 | `regex toggle matches patterns` | UC-8 | unit |
| T-12 | `invalid regex sets findRegexError, aria-invalid, no highlights, no throw` | UC-9 | unit |
| T-13 | `zero-length regex matches are skipped and the search terminates` | UC-10 | unit |
| T-14 | `regex replace expands capture groups` | UC-11 | unit |
| T-15 | `replace keeps surrounding inline formatting` | UC-12 | unit |
| T-16 | `replace across a markup boundary lands at the match start and drops the emptied element` | UC-13 | unit |
| T-17 | `replaceAll flushes pending typing then records exactly one entry; one undo restores all` | UC-14 | unit |
| T-18 | `replaceSingle records one entry and advances to the next remaining match` | UC-15 | unit |
| T-19 | `findNext/findPrevious wrap and scroll the editor to the current match` (stub `getBoundingClientRect` below the fold; assert `scrollTop` changed) | UC-16 | unit |
| T-20 | `Enter in the replace input replaces; Mod+Alt+Enter replaces all; Escape closes` | UC-17 | unit |
| T-21 | `openFindReplace seeds the query from a non-empty selection and leaves it alone when collapsed` | UC-18 | unit |
| T-22 | `closeFindReplace selects the current match and focuses the editor` | UC-19 | unit |
| T-23 | `'find' toolbar item opens the panel (replace row when editable) and is absent from DEFAULT_TOOLBAR_ITEMS` | UC-20 | unit |
| T-24 | `RTL: panel anchors at inline-end and uses the Hebrew counter string` (assert computed `insetInlineEnd` / `right` in `dir=rtl`, not the class string — memory: layout tests assert style) | UC-21 | unit |
| T-25 | `readonly hides the replace row and ignores replace calls` | UC-22 | unit |
| T-26 | `toggle and nav buttons carry locale aria-labels and aria-pressed` | UC-23 | unit |
| T-27 | `matches inside mention/tag chips are neither counted nor replaced` | UC-24 | unit |
| T-28 | `2,000-match 500 KB document searches in < 200 ms and paints ≤ 500 overlay rects` (Chromium leg only; `performance.now()`; skip in jsdom via `typeof CSS.supports`-style guard on `navigator.userAgent.includes('jsdom')`) | UC-25 | perf |
| T-29 | `FindReplace story: panel open with matches passes axe` | UC-23, UC-4 | story a11y |
| T-30 | `e2e: Ctrl+F, type query, counter shows "1 of 2", Replace All, Ctrl+Z restores; HTML output has no <mark>` | UC-1, UC-4, UC-5, UC-14 | e2e |
| T-31 | `setContent records one entry by default, calls onChange, undo/redo round-trips` | UC-26 | unit |
| T-32 | `setContent with recordHistory:false calls onChange and leaves the stack length unchanged` | UC-27 | unit |
| T-33 | `writeValue default never calls onChange and does not change the stack length` | UC-28 | unit |
| T-34 | `recordExternalWrites=true makes writeValue push one entry; undo restores the previous content` | UC-29 | unit |
| T-35 | `insertTextFromOverlay records its own entry (one undo removes only the inserted text)` | UC-30 | unit |
| T-36 | `historyChange emits {canUndo,canRedo} on push, undo, redo, restoreHistoryEntry and trim` | UC-31 | unit |
| T-37 | `canUndo/canRedo signals mirror the output` | UC-32 | unit |
| T-38 | `isDirty is false after writeValue and after a no-op input event` | UC-33 | unit |
| T-39 | `isDirty is true after typing and false after undoing back to the loaded content` | UC-33 | unit |
| T-40 | `markClean resets isDirty` | UC-33 | unit |
| T-41 | `setContent does not reset isDirty; writeValue does` | UC-34 | unit |
| T-42 | `markdown mode: setContent parses markdown and onChange receives markdown` | UC-26 | unit |
| T-43 | `emoji addon: picking an emoji creates one history entry` (extend `addons/emoji/rich-text-emoji.directive.spec.ts`) | UC-30 | unit |
| T-44 | `e2e: emoji/overlay insert then Ctrl+Z removes only the insert; setContent from a page button is undoable` (harness demo gets a "Load draft" button calling `editor.setContent(...)`) | UC-26, UC-30 | e2e |
| T-45 | `docs:regen includes the new public members` (`npm run docs:regen && npm run docs:check` green — recorded as evidence in the log, not a spec test) | UC-35 | gate |

Every UC-1…UC-35 appears above.

### C.2 Test types

- **Unit** — both legs (`npm run test-visual`, `npm run test:portable`).
  Overlay geometry uses the spec's existing `makeRect` shims in jsdom.
- **Story + axe** — new `FindReplace` story (panel open via `play`, query
  pre-typed, replace row visible) and `FindReplaceRTL`; `npm run
  test-storybook:a11y`.
- **e2e** — extend the base harness spec created by
  `rte-dx-trio-and-base-e2e-spec` (do **not** scaffold — the folder exists).
  Add a "Load draft" button and an emoji-free overlay insert trigger to its
  demo component so T-44 has no addon dependency (call
  `editor.insertTextFromOverlay('★')` from a page button after saving the
  selection with `editor.saveSelection()`).
- **Perf** — T-28 is a measured assertion with a stated budget.

### C.3 Edge cases and failure modes the tests must cover

- Empty query, single-character query, query longer than the document.
- Query equal to the replacement (replace-all must terminate; counter re-runs
  and finds the same count).
- Replacement is empty (deletion) — cross-node deletion leaves no empty inline
  elements behind.
- Very large document (T-28); more matches than the paint cap.
- RTL (T-24) and mixed-direction text (Hebrew query in an English paragraph).
- Touch-only: the `'find'` toolbar item (T-23) is the touch path.
- `disabled` editor: `Mod+F` is not gated today (find works in readonly);
  keep that; `disabled` hides the toolbar so the toolbar path is unavailable.
- Regex: invalid pattern, zero-length matches, lookbehind with the `u` flag,
  query above the 256-char cap (treated as invalid with the same message).
- Editor view not yet available (`editorDiv` undefined) — every find method
  stays a no-op (extend the existing `:2753` test to the new methods).
- Component destroy with a pending find debounce — timer cleared, no
  post-destroy callbacks (`ngOnDestroy` `:4655`).
- History trim at `historyLimit` still emits `historyChange` (T-36).

### C.4 Coverage expectation

- `rich-text-editor.component.ts`: every new/changed function 100 % line and
  branch covered (the file's overall figure moves only upward).
- `rich-text-locales.ts`: no logic; new keys present in all 10 locales
  (a test iterates `RICH_TEXT_LOCALES` and asserts the seven new keys are
  non-empty strings).
- `sub/rich-text-toolbar.component.ts`: the `'find'` entry covered by T-23.
- `rich-text-editor.host.ts`: JSDoc only.

---

## D. Architecture section

### D.1 Usability — public API shape

**Simple mode (inputs only).** Nothing to configure; find/replace and undo work
out of the box.

```html
<ui-rich-text-editor [(ngModel)]="content" />
<!-- Ctrl/Cmd+F opens find, Ctrl/Cmd+H opens find & replace -->
```

**Touch / explicit toolbar button and tuning.**

```html
<ui-rich-text-editor
  [toolbarItems]="['bold', 'italic', 'separator', 'find']"
  [findDebounceMs]="100"
  [recordExternalWrites]="true"
  (historyChange)="history.set($event)"
  [(ngModel)]="content" />
```

**Programmatic content and dirty tracking.**

```ts
@ViewChild(RichTextEditorComponent) editor!: RichTextEditorComponent;

loadDraft(html: string): void {
  this.editor.setContent(html);                       // recorded — Ctrl+Z restores
}
restoreVersion(html: string): void {
  this.editor.setContent(html, { recordHistory: false });
}
async save(): Promise<void> {
  await this.api.save(this.content());
  this.editor.markClean();                            // isDirty() → false
}
canLeave = () => !this.editor.isDirty();
```

```html
<button [disabled]="!editor.canUndo()" (click)="…">Undo</button>
```

**New public surface (all on `RichTextEditorComponent`).**

```ts
/** Exported from the component file and the barrel. */
export interface RichTextHistoryState { canUndo: boolean; canRedo: boolean }
export interface RichTextSetContentOptions {
  /** Push one history entry so the write can be undone. Default `true`. */
  recordHistory?: boolean;
}
export type ToolbarItem = … | 'find';            // sub/rich-text-toolbar.component.ts

// inputs
findDebounceMs = input<number>(150);
recordExternalWrites = input<boolean>(false);
// outputs
historyChange = output<RichTextHistoryState>();
// signals
readonly canUndo: Signal<boolean>;
readonly canRedo: Signal<boolean>;
readonly isDirty: Signal<boolean>;
readonly findWholeWord: WritableSignal<boolean>;     // UI state, like findCaseSensitive
readonly findUseRegex: WritableSignal<boolean>;
readonly findRegexError: Signal<boolean>;
readonly findMatchCount: Signal<number>;             // findMatches().length
// methods
setContent(value: string, options?: RichTextSetContentOptions): void;
markClean(): void;
toggleFindWholeWord(): void;
toggleFindUseRegex(): void;
```

`findMatches` stays `signal<Range[]>` (addon-host-visible today, keep the
type); ranges may now start and end in different text nodes.

**Locale additions** (`RichTextLocale.findReplace`, all 10 locales):

| Key | en |
|---|---|
| `wholeWord` | `Whole word` |
| `useRegex` | `Regular expression` |
| `invalidRegex` | `Invalid expression` |
| `matchCounter` | `{current} of {total}` |
| `previous` | `Previous match` |
| `next` | `Next match` |
| `findToolbar` | `Find and replace` (toolbar tooltip) |

Hebrew: `מילה שלמה`, `ביטוי רגולרי`, `ביטוי לא תקין`, `{current} מתוך {total}`,
`התאמה קודמת`, `התאמה הבאה`, `חיפוש והחלפה`. The other eight locales get
natural translations by the implementing agent (no machine-placeholder
English).

### D.2 Efficiency

| Concern | Budget / approach |
|---|---|
| Search per query | One `TreeWalker` pass builds a **segment index** (`{ node: Text; start: number }[]` + one concatenated string with `\n` at block boundaries). Matching runs on the string with a single compiled `RegExp` (`g`, `u`, optional `i`). Budget: < 200 ms for 500 KB / 2,000 matches in Chromium (T-28). |
| Index reuse | The index is rebuilt on every `performFind` (content may have changed). No caching across content versions — simpler and correct; the debounce absorbs keystroke bursts. |
| Debounce | `findDebounceMs` default 150 ms; `0` = synchronous. Content changes while the panel is open re-run through the same scheduler. |
| Highlight painting | Overlay rectangles from `range.getClientRects()` relative to `editorContainer`; **cap 500 painted rects** (`FIND_MAX_PAINTED_RECTS`), current match always painted. Re-positioned on editor `scroll`, `ResizeObserver` on the editor, and after every search; painting is a single `innerHTML`-free DOM diff (reuse existing overlay `div`s, hide extras). |
| Regex safety | Query length cap 256; zero-length matches skipped (advance `lastIndex` by one code point); match-count cap 10,000 (stops the loop, counter shows the cap with `+`). JS regex has no timeout — catastrophic patterns are the user's own doing on their own document; documented. |
| History | Unchanged model. `setContent` pushes exactly one entry; `historyChange` emission piggybacks on the existing `bumpHistoryVersion()` choke point (no new traversal). `isDirty` is a `computed` string comparison of two already-materialised strings. |

### D.3 DX for the consuming developer

- **Learn:** `Ctrl/Cmd+F` / `Ctrl/Cmd+H`, the `'find'` toolbar item, three
  toggles. `setContent` vs `writeValue`: *`setContent` is an edit you make;
  `writeValue` is the form telling the editor what the value is.* `isDirty`
  compares against the last `writeValue`/`markClean`.
- **Ignore:** overlay internals, the segment index, regex flags.
- **Errors:** an invalid regex shows the localized `invalidRegex` text in the
  counter and marks the input `aria-invalid`; nothing is logged. `setContent`
  with a non-string coerces `null`/`undefined` to `''` (same as `writeValue`).
  `historyChange` never emits synchronously inside `writeValue` when
  `recordExternalWrites` is false (nothing changed).
- **Types they touch:** `RichTextHistoryState`, `RichTextSetContentOptions`,
  `ToolbarItem` (`'find'`).
- **Migration:** none — every existing public member keeps its signature.
  `findMatches()` ranges can now span text nodes (documented on the signal).

### D.4 Implementation options

#### Highlighting

**Option 1 — Keep injected `<mark>` elements, strip them before every sync**
Pros: smallest diff; `scrollIntoView` on an element is trivial.
Cons: every mutation path (`onInput`, `applyMutation`, `mutateContent`,
`syncContentFromEditor`, addon DOM edits, history selection paths) must
remember to strip; splitting text nodes shifts `captureSelection` child-index
paths and mention-chip detection; `surroundContents` still throws for
cross-element matches, so cross-markup highlight would need per-node
fragments. The class of bug in §0.1 stays one forgotten call away.

**Option 2 — CSS Custom Highlight API (`CSS.highlights`, `Highlight(range)`)**
Pros: zero DOM mutation; the browser paints ranges directly; cross-node
ranges are native.
Cons: Firefox shipped it in 140 (mid-2025) and Safari in 17.2 — consumers on
older browsers get no highlight; jsdom has no implementation, so the unit
suite needs a fake; the `::highlight()` pseudo needs a stylesheet reachable
from the content root (component styles are encapsulated; `::highlight`
inside a `:host` rule works but must be verified per browser).

**Option 3 — Positioned overlay layer from `Range.getClientRects()`**
Pros: zero DOM mutation of content (the overlay lives as a sibling of the
editable inside `#editorContainer`, `pointer-events:none`, `aria-hidden`);
works in every browser; deterministic in jsdom with the existing rect shims;
cross-node ranges just yield more rects; the same `Range` objects drive
replace, scroll and close-selection.
Cons: must re-position on scroll/resize/content change (a `scroll` listener on
the editable + one `ResizeObserver`); many matches mean many rects (capped).

**✅ Chosen: Option 3**, because the defining requirement is "never enters the
saved HTML or history" and only Options 2 and 3 satisfy it by construction;
Option 3 has no browser or test-leg gaps. Option 2 is recorded as the future
upgrade path once the library's browser floor allows it — the overlay module
is written behind a small `FindHighlighter` interface (`paint(ranges,
currentIndex)`, `clear()`, `reposition()`) so swapping it is local.

#### Undo for external writes

**Option A — `writeValue` resets the history to a single keyframe (document
load semantics)**
Pros: undo can never reach a pre-load state.
Cons: breaks the existing test corpus that uses `writeValue` as a content
setter between pushes (`spec:616-637`, `:3192-3213`, `:3215-3227`); wipes the
stack on every `patchValue`; changes today's documented behaviour.

**Option B — `writeValue` unchanged by default; `recordExternalWrites` input
pushes an entry; `setContent` for programmatic edits**
Pros: exactly what the plan asks (opt-in); no behaviour change for existing
consumers; `setContent` gives a name to "an edit made by code" that Spec 4
reuses.
Cons: with the default, the documented "undo jumps back over a setValue"
caveat remains — by choice, and it is now documented next to the opt-in.

**✅ Chosen: Option B.** Naming: an input (`recordExternalWrites`) rather than
a DI token or a `setContent`-only path, per the no-DI-config rule; the name
says *what* is recorded (external writes = CVA writes), not *how*.

#### Dirty tracking

**Option I — compare `htmlContent()` against the string passed to
`writeValue`**
Cons: the sanitized/normalized model string differs from the raw input
(`'hello'` → `'hello'` today, but `<p class=x>` → `<p>`), producing a false
dirty flag immediately.

**Option II — baseline is the sanitized DOM round-trip taken right after the
DOM write (`sanitize(editorDiv.innerHTML)`), i.e. what `onInput` would produce
for an unchanged document**
Pros: the first no-op input event compares equal (T-38); markdown mode is
covered because the comparison is on the HTML model in both cases.

**✅ Chosen: Option II.**

### D.5 Design details the implementing agent must follow

1. **Segment index.** `buildFindIndex(root): { text: string; segments: { node: Text; start: number }[] }`. Walk `SHOW_TEXT | SHOW_ELEMENT`; skip subtrees of `[data-mention], [data-tag], [contenteditable="false"]`; when leaving/entering an element whose `display` class is block-ish (`P, DIV, H1-H6, LI, BLOCKQUOTE, PRE, TD, TH, TR, SUMMARY, DETAILS, FIGCAPTION, HR, BR`) append `'\n'` to `text` (no segment). Text nodes append their `data` and one segment.
2. **Compile query.** `compileFindRegex(query, { caseSensitive, wholeWord, useRegex }): RegExp | null` — `null` on invalid pattern or `query.length > 256`. Non-regex queries are escaped with `replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')`; whole word wraps as `(?<![\p{L}\p{N}_])(?:…)(?![\p{L}\p{N}_])`; flags `gu` + `i` unless case-sensitive. Keep the function pure and file-local (top of the component file or `rich-text-find.utils.ts` in the folder — the latter is preferred to keep the component's line count flat and is the recommended location, exported for tests).
3. **Match → Range.** `offsetToPosition(segments, offset)` binary-searches the segment whose `start ≤ offset < start + length` (end offsets resolve to the segment containing `offset - 1`, position `+1`). `Range.setStart/End` on possibly different text nodes.
4. **Overlay.** A `div[data-slot="rich-text-find-overlay"]` appended once inside `#editorContainer` (`absolute inset-0 pointer-events-none overflow-hidden`, `aria-hidden="true"`), children `div[data-find-rect]` with `data-find-current` on the current match's rects; classes `absolute rounded-[2px] bg-yellow-300/40 dark:bg-yellow-400/30` and `bg-yellow-300/70` for current. Coordinates: `rect - containerRect + container.scroll*`. The editable is the scroller (`max-height`), so listen to its `scroll` (passive) and observe its size; reposition via `requestAnimationFrame` coalescing.
5. **Content-change re-run.** Constructor `effect(() => { this.htmlContent(); if (this.findReplaceVisible()) this.scheduleFind({ preserveIndex: true }); })` — signals only; no manual hooks in mutation paths.
6. **Replace.** For the current range: compute `replacement` (regex mode: `matchText.replace(new RegExp(source, flags without g), replaceText)` to expand `$n`; else `replaceText`); `range.deleteContents()`; insert a text node at `range.startContainer/startOffset`; then remove inline ancestors of the deleted span that became empty (`el.textContent === '' && !el.querySelector('img,br')`). `replaceAll` iterates matches **from last to first** so earlier offsets stay valid, inside one `flushPendingHistoryPush(); …; syncContentFromEditor(); pushHistory();` bracket. After replace, `performFind({ preserveIndex: true })` clamps the index to `min(idx, count-1)`.
7. **Keyboard.** `onFindReplaceKeydown` gains: `Mod+Alt+Enter` → `replaceAll()` (editable only); `Enter` when `event.target` is the replace input → `replaceSingle()`; existing Enter/Shift+Enter behaviour otherwise. Escape remains the template binding.
8. **Open/close.** `openFindReplace`: if `selectedText().trim()` is non-empty and contains no `\n`, `findQuery.set(it)` and run the search synchronously (ignore the debounce for this one seed). `closeFindReplace`: if a current match exists, select its Range before clearing; then existing behaviour. `findShowReplace` is forced false while `readonly() || disabled()` (a `computed` `showReplaceRow`).
9. **Toolbar.** Add `'find'` to `ToolbarItem`, one entry in the toolbar table in the shape `rte-dx-trio-and-base-e2e-spec` (A8) leaves it (icon: lucide `search`, tooltip `findReplace.findToolbar`), and `case 'find': this.openFindReplace(!this.readonly() && !this.disabled()); return true;` in the toolbar command switch (`:1348` area). Not added to `DEFAULT_TOOLBAR_ITEMS`; added to the `FullToolbar` story and the demo.
10. **Panel layout.** Replace `right-2` with `end-2` (logical) and `max-sm:left-2` with `max-sm:start-2`; keep `w-80 max-sm:w-[calc(100%-1rem)]`; toggles are `button[aria-pressed]` with `aria-label`s; buttons get `min-h-7 min-w-7` so the global `pointer: coarse` rule can pad them.
11. **History.** `bumpHistoryVersion()` also `this.historyChange.emit({ canUndo: this.historyIndex > 0, canRedo: this.historyIndex < this.history.length - 1 })`; `canUndo`/`canRedo` are `computed` over `historyVersion()` reading the same expressions. `isDirty = computed(() => this.htmlContent() !== this.cleanHtml())`; `cleanHtml` is set in `writeValue` (after the DOM write) and `markClean()`.
12. **`setContent`.** Shared private `applyExternalHtml(value)` does the mode parse + DOM write + `enableTaskCheckboxes` for both `writeValue` and `setContent`; `setContent` then places a collapsed caret at the end, `syncContentFromEditor()` (→ `onChange` + outputs), `flushPendingHistoryPush()`, and `pushHistory()` unless `recordHistory === false`. `writeValue` additionally: `if (this.recordExternalWrites()) { this.flushPendingHistoryPush(); this.pushHistory(); }` and resets `cleanHtml`.
13. **`insertTextFromOverlay`.** Append `this.pushHistory();` after the insert; update both JSDoc blocks (component `:1505-1514`, host `:145-151`).
14. **Cleanup.** `ngOnDestroy` clears the find debounce timer, disconnects the `ResizeObserver`, removes the scroll listener.
15. **Sonar.** No function over 15 cognitive complexity — `performFind` is split into `buildFindIndex`, `collectMatches`, `paintMatches`, `updateFindState`; regex escapes use `replaceAll`; all new members `readonly` where never reassigned; no boolean-switch parameters — `scheduleFind({ preserveIndex })` takes an options object.

### D.6 Risks

| Risk | Mitigation |
|---|---|
| Line numbers/shape drift after the two prerequisite specs (toolbar table, deleted ref) | §0 cites capabilities, not only lines; Task 2 starts by re-locating every cited symbol and noting the new lines in the log |
| Overlay drifts from text during typing (layout not settled) | Reposition on `rAF` after each search and on `scroll`/resize; the content-change effect re-runs the search after every model update |
| Cross-node `deleteContents` leaves empty inline wrappers | Explicit empty-inline cleanup (D.5 §6) + T-16 |
| Regex mode surprises (`$&`, `$1` in replacement) | Expansion is only in regex mode; documented in the toggle's tooltip and JSDoc |
| Existing 11 find tests break on the debounce | Their `beforeEach` sets `findDebounceMs=0` (Task 1) |
| `historyChange` emits during `ngOnInit`'s initial push before consumers subscribe | Angular `output()` emits are safe pre-subscription; T-36 asserts the first *observed* emission after subscription |
| `isDirty` false positives from browser DOM normalisation | Baseline is the DOM round-trip (D.4 Option II) + T-38 |
| Emoji addon tests counting history entries | T-43 extends that spec deliberately |
| Perf test flakiness | 200 ms budget with a 500 KB fixture built in code; Chromium leg only |

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-28 (extend the find `describe`, set `findDebounceMs=0` in its `beforeEach`, locale-keys test); confirm they fail | UC-1…UC-25 | ✅ Done | 2026-09-05 15:55 | 93 | Tests-first paid off twice: the T-19/T-24 first drafts passed against broken behaviour because the harness stubbed `Range` geometry to a fixed 10x10 rect in BOTH legs, and T-22 exposed a real focus/selection ordering bug. Check what the harness stubs before writing a geometry assertion. |
| 2 | `rich-text-find.utils.ts`: `buildFindIndex`, `compileFindRegex`, `offsetToPosition`; wire `performFind` to cross-node ranges, debounce (`findDebounceMs`), counter + `aria-live`, content-change effect, chip skipping | UC-1, UC-2, UC-3, UC-4, UC-6, UC-24 (T-1…T-6, T-8, T-27) | ✅ Done | 2026-09-05 15:55 | 93 | The flattened segment index made cross-markup matching and block-boundary stopping fall out of one design rather than two special cases. Profiling showed the search itself costs ~1.3 ms; the 200 ms budget is almost entirely browser layout. |
| 3 | Overlay highlighter (`FindHighlighter`, `data-slot="rich-text-find-overlay"`), remove `<mark>` injection, scroll-to-match on the editable, close-selects-current, open-seeds-from-selection, paint cap, perf pass | UC-5, UC-16, UC-18, UC-19, UC-25 (T-7, T-19, T-21, T-22, T-28) | ✅ Done | 2026-09-05 15:55 | 93 | The overlay satisfies UC-5 by construction — it is a sibling of the editable, so no future mutation path can leak highlights into the model. The paint cap only helps because geometry is requested lazily; asking every match for rects was the whole cost. |
| 4 | Whole-word + regex toggles, safe-regex handling, `findRegexError` + `aria-invalid`, regex group expansion in replace, 7 locale keys × 10 locales | UC-7…UC-11 (T-9…T-14) | ✅ Done | 2026-09-05 15:55 | 93 | Unicode look-arounds gave Hebrew whole-word support for free. The zero-length-match advance needs a code-point step, not a UTF-16 unit step — a unit step hangs the u-flag regex outright, which the added astral test now guards with an explicit timeout. |
| 5 | Range-based `replaceSingle`/`replaceAll` (flush → mutate → one entry), empty-inline cleanup, keyboard (`Mod+Alt+Enter`, Enter in replace input), readonly gating, `'find'` toolbar item, RTL logical positioning, aria-labels/`aria-pressed`, JSDoc rewrite of the find methods | UC-12…UC-15, UC-17, UC-20…UC-23 (T-15…T-18, T-20, T-23…T-26) | ✅ Done | 2026-09-05 15:55 | 93 | Gated on `isDisabled()` rather than the raw `disabled()` input, per the post-spec CVA change. Empty-inline cleanup after `deleteContents` is what makes a cross-markup replace look right instead of leaving invisible stubs. |
| 6 | Write failing tests T-31…T-43 (new `undo consistency` describe + emoji addon spec extension); confirm they fail | UC-26…UC-34 | ✅ Done | 2026-09-05 16:45 | 92 | Thirteen of fourteen failed on the missing API, which is the easy half. The instructive one was T-38: its first draft failed because dispatching an input event with no selection makes the editor wrap the content in a fresh block — a real edit, not the no-op the case needs. |
| 7 | `setContent` + `RichTextSetContentOptions`, `recordExternalWrites`, `insertTextFromOverlay` pushes; JSDoc for `writeValue`, `insertTextFromOverlay` (component + host) | UC-26…UC-30, UC-35 (T-31…T-35, T-42, T-43) | ✅ Done | 2026-09-05 16:45 | 92 | The review gate caught real data loss here: §D.5.12 flushes the pending typing burst AFTER the write, so `pushHistory` dedupes against the new content and the user's unsaved sentence disappears. Flushing first fixes it; T-31b and T-34b pin both affected paths. |
| 8 | `historyChange` + `RichTextHistoryState`, `canUndo`/`canRedo`, `isDirty`/`markClean`; barrel exports; `npm run docs:regen` + `docs:check` | UC-31…UC-35 (T-36…T-41, T-45) | ✅ Done | 2026-09-05 16:45 | 92 | Riding on `bumpHistoryVersion` meant no mutation site needed its own emit. T-38b had to be rewritten twice before it could actually distinguish the chosen dirty-baseline option from the rejected one — a passing test is not the same as a discriminating one. |
| 9 | Stories `FindReplace` + `FindReplaceRTL` (axe), `'find'` in `FullToolbar`; demo section "Find & replace, undo and dirty state" with copy-paste snippets (`'find'` item, `recordExternalWrites`, `setContent`, `isDirty`/`markClean`, `historyChange`) + demo locale strings (en/he) | UC-20, UC-23, T-29 | ⬜ Not started | — | — | — |
| 10 | Extend `e2e/harness/rich-text-editor/` demo + spec with T-30 and T-44; `npm run e2e -- rich-text-editor`; full gates (`test-visual`, `test:portable`, `lint`, `sonar:gate`); Completion Log | T-30, T-44, all | ⬜ Not started | — | — | — |

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

## 7. Plan corrections (⚠️ recorded, never rewritten)

- ⚠️ Plan survey: "no match counter, no highlight-all". **Both exist** — the
  template renders `n/m` (`rich-text-editor.component.html:70`) and every
  match is wrapped in a `<mark>` (`component.ts:3425-3444`). What is missing
  is the "of" wording/`aria-live`, and highlight-all that does **not** mutate
  content.
- ⚠️ Plan B2: "highlight-all via a temporary `<mark>` overlay". `<mark>`
  injection is the *current* implementation and the source of the
  model-pollution bug (sanitizer allow-lists `mark`,
  `rich-text-sanitizer.service.ts:45`). Chosen: a non-content overlay (D.4).
- ⚠️ Plan B2: "replace-all with a single history entry". `replaceAll` already
  pushes once (`:3550`); the gap is the missing `flushPendingHistoryPush()`
  before the mutation, which lets a pending typing burst merge into the
  replace entry (UC-14).
- ⚠️ Plan B6: "`RichTextEditorRef` inserts record entries". The ref is deleted
  by `rte-dx-trio-and-base-e2e-spec` (Rec 16). No work here.
- ⚠️ Host contract contradiction: `rich-text-editor.host.ts:145-151`
  documents `insertTextFromOverlay` as "inserts as one history entry"; the
  implementation (`component.ts:1512-1531`) records none. This spec makes the
  host doc true (UC-30).
- ⚠️ Not in the plan: the ▲ ▼ ✕ buttons have no accessible names
  (`.html:73-75`) and there is no non-keyboard way to open find (touch rule,
  CLAUDE.md §6). Both are in scope (UC-20, UC-23).
- ⚠️ **Harness defect found in Task 1 (not in the spec).** The spec file stubbed
  `Range.prototype.getBoundingClientRect` / `getClientRects` to a fixed
  `10x10` rect **unconditionally — in both legs**, unlike the Element shim
  right above it, which delegates to the native implementation when present.
  Since the chosen overlay (§D.4 Option 3) is positioned entirely from those
  rects, every geometry assertion (T-19, T-24, T-28) would have been vacuous
  in Chromium too. The stub now installs only where the native implementation
  is absent. Any future spec that asserts geometry in this file must check
  this first.
- ⚠️ **§D.5 §8 ordering is wrong.** It says `closeFindReplace` should "select
  its Range before clearing; then existing behaviour" — but existing behaviour
  ends with `editorDiv.focus()`, and focusing a contenteditable collapses the
  selection to its start, discarding the range. The selection must be restored
  **after** the focus call, not before. Proven in the jsdom leg, where T-22
  failed with a collapsed selection at the editor DIV while the match ranges
  were demonstrably still present.
- ⚠️ **UC-25's 200 ms budget is dominated by layout, not by search.** Measured
  on the spec's own 2,000-match / 500 KB fixture: `buildFindIndex` 0.4 ms,
  `collectMatches` 0.9 ms, `paintMatches` 2.3 ms — about 3.6 ms of work. The
  remaining ~195 ms of the first call is the browser's one-time reflow of the
  freshly written document, which is the cost of *loading* it. T-28 therefore
  settles layout (reads `scrollHeight`) before starting the clock; otherwise it
  measures `writeValue`, not the search.
- ⚠️ **Zero-length regex advance must step a whole code point.** §D.2 says
  "advance `lastIndex` by one code point" — this is load-bearing, not a
  nicety. Advancing one UTF-16 unit lands mid-surrogate and a `u`-flag regex
  then never terminates, so the failure mode is a hang, not a wrong count.
  The astral-text case added for it carries an explicit timeout so a
  regression fails fast instead of stalling the suite.
- ⚠️ **`'find'` needs a `toolbar` locale key, not just `findReplace`.**
  `TOOLBAR_BUTTONS[].localeKey` is typed `keyof RichTextLocale['toolbar']`, so
  the tooltip cannot point at `findReplace.findToolbar` as §D.5 §9 assumes.
  A `toolbar.find` key was added to all 10 locales alongside
  `findReplace.findToolbar`.
- ⚠️ **`onFormatCommand` returns early when readonly/disabled**, so the
  `'find'` case must be handled *before* that guard — otherwise the toolbar
  button is dead in exactly the readonly editor where §0.1 says find must
  still work (UC-22).

- ⚠️ **§D.5.12's `setContent` ordering loses data.** It specifies
  `syncContentFromEditor()` → `flushPendingHistoryPush()` → `pushHistory()`.
  By the time the flush runs, `applyExternalHtml` has already replaced
  `htmlContent`, so the pending typing entry is materialised against the NEW
  content and `pushHistory` dedupes it away — the user's in-flight sentence
  vanishes from the undo stack entirely. Reproduced: type `one typed`, call
  `setContent('<p>loaded</p>')`, and `Ctrl+Z` returns `one`, contradicting the
  method's own contract. **The flush must come first**, in `setContent` and in
  the `recordExternalWrites` path of `writeValue` alike (T-31b, T-34b).
- ⚠️ **UC-33's "no-op input event" needs a caret.** Dispatching `input` with no
  selection at all makes the editor's `wrapBareTextInParagraph` normalisation
  wrap the content in a fresh block (`<p>one</p>` → `<p><p>one</p></p>`), which
  is a real edit. T-38 places the caret inside the paragraph first.
- ⚠️ **`writeValue` DOES emit `htmlChange` / `markdownChange`.** Its JSDoc
  claimed otherwise; the outputs are effects over the content signal it sets,
  so they fire for every content change whatever its origin. Only the form
  callback is suppressed. Corrected, and covered by a test.
- ⚠️ **Option II is only observable through a DOM-only edit.** Because
  `writeValue` sanitizes before writing the DOM, its two candidate baselines
  cannot diverge on that path — a test written there passes under the rejected
  Option I too. T-38b appends a text node straight to the editable and asserts
  `markClean` picks it up, which does discriminate.

- ⚠️ Cross-spec: `setContent(value, { recordHistory })` is **defined here**;
  Spec 4 (`consumer API pack`) reuses it and owns `focus()`, `insertText()`,
  `insertHtml()`, `format()`, `getSelectionSnapshot()`, `isEmpty()` and any
  public `undo()`/`redo()`.

---

## 8. Completion Log

| Row | Date | Task | Reviewer score | Notes |
| --- | --- | --- | --- | --- |
| 1 | 2026-09-05 | Write failing tests T-1…T-28 + locale keys | 93 | Sabotage: 6 spec-derived breaks, all caught (block-boundary, `<mark>` re-injection, debounce, whole-word, chip skipping, replace-all flush); 2 permitted free changes stayed green. Reviewer ran 5 further sabotages of its own — all landed. |
| 2 | 2026-09-05 | Segment index, cross-node ranges, debounce, counter | 93 | Search measures ~1.3 ms on the 2,000-match fixture. |
| 3 | 2026-09-05 | Overlay highlighter, scroll, open/close, paint cap | 93 | UC-5 holds by construction: overlay is a sibling of the editable, not a child of the content. |
| 4 | 2026-09-05 | Whole-word + regex toggles, 7 locale keys × 10 locales | 93 | Zero-length advance must be per code point or the `u`-flag regex hangs. |
| 5 | 2026-09-05 | Range-based replace, keyboard, `'find'` item, RTL, a11y | 93 | Gates on `isDisabled()`, per the post-spec CVA change. |
| 6 | 2026-09-05 | Failing tests T-31…T-43 (undo consistency + emoji addon) | 92 | 14 cases; T-38 needed a caret before its input event to be a genuine no-op. |
| 7 | 2026-09-05 | `setContent`, `recordExternalWrites`, overlay-insert history | 92 | Review gate found real data loss in §D.5.12's flush ordering; fixed and pinned. |
| 8 | 2026-09-05 | `historyChange`, `canUndo`/`canRedo`, `isDirty`/`markClean` | 92 | Sabotage: 8 breaks caught (incl. Option I baseline); 1 permitted free change stayed green. |
