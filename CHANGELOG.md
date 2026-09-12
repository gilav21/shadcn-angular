# Changelog

All notable changes to the **components** — what you get when you run
`npx @gilav21/shadcn-angular add <component>`.

Component and lib source is served live from `master`, so everything here
reaches you on merge with no npm publish. The CLI package keeps its own log in
[`packages/cli/CHANGELOG.md`](packages/cli/CHANGELOG.md), and the compiled
packages (`@gilav21/shadcn-angular-rte`, `-data-table`) ship on their own
release train.

Because the code lives in *your* project, an upgrade is opt-in per component:
`npx @gilav21/shadcn-angular diff <component>` shows what changed before you
take it, and `update` applies it. Breaking changes are also machine-readable —
the CLI reads them from the registry and prints the migration for the
components you actually have.

---

## Unreleased

Rich text editor: a consumer API, a read-only renderer, a privacy control for
remote images, and ~110 fixes from a 25-round adversarial audit.

### ⚠️ Breaking

- **Simpler names on the editor and the view.** The security inputs read as
  sentences now, and two pairs of knobs became one input each:

  | Before | Now |
  |---|---|
  | `[allowedResourceHosts]` | `[allowedImageHosts]` |
  | `[inheritResourcePolicy]` | gone — a component under a wrapper takes it unless it sets its own list |
  | `[uiRichTextResourcePolicy]="hosts"` | `[uiRichTextAllow]="{ imageHosts, linkSchemes }"` |
  | `(remoteResource)` (every reference, allowed or not) | `(imageBlocked)` (blocks only) |
  | `[showCount]` + `[showWordCount]` | `counter="characters" \| "words" \| "both"` |
  | `[historyLimit]`, `[historyDebounceMs]`, `[recordExternalWrites]` | `[history]="{ limit, debounceMs, recordExternalWrites }"` (`RichTextHistoryOptions`) |
  | `[uiRteImagesUploader]`, `[uiRteImagesAutoUpload]`, `[uiRteImagesSources]` | `[uiRteImagesUpload]="{ uploader, auto, sources }"` (`RichTextImagesUploadOptions`) |
  | `[uiRteImagesResize]`, `…Alignment`, `…DefaultWidth`, `…DefaultHeight`, `…DefaultAlignment`, `…MinWidth`, `…MaxWidth`, `…LockAspectRatio` | `[uiRteImagesLayout]="{ … }"` (`RichTextImagesLayoutOptions`) |
  | `[uiRte<Addon>Order]`, `[uiRte<Addon>Toolbar]`, `[uiRte<Addon>SlashCommand]`, `[uiRteHistoryButton]`, `[uiRteOutlineButton]` on colors, emoji, file-import, history, images, links, outline, tables, typography | `[uiRte<Addon>]="{ toolbar, slashCommand, order }"` — the enable attribute takes the options (`RichTextAddonOptions`) |

  Every option object has an exported type with documented defaults, so an
  IDE completes the fields. The editor also gains the view's `dir` input.

  **Migrating:** `npx @gilav21/shadcn-angular update` lists every place your
  own templates bind an old name, with file and line; `update --fix` rewrites
  them — renames, the object merges and the removed input — and tells you the
  one thing it cannot decide for you: a view that had `inheritResourcePolicy`
  off now inherits unless it sets its own list. Compiled-package users get the
  same table in this changelog and a build error naming each old binding.

**`[customToolbarItems]` stays, and now behaves.** A toolbar button is still
one object in an array — `{ id, icon, tooltip }` — and a click still emits
`(customToolbarAction)` with an editor ref. Two things changed underneath:
the ref's `insertText` / `insertHtml` go through the editor now, so the
insert lands in the model, fires the outputs and records a history entry
(before, undo would not step over it); and an item may carry its own
`onClick(ref)`, so a button that inserts a date is three lines with no
handler to wire:

```html
<ui-rich-text-editor [customToolbarItems]="[
  { id: 'stamp', icon: '📅', tooltip: 'Insert date', onClick: stamp }
]" />
```

The addon-host `toolbarSlots` path stays for addon authors; the data path is
built on it. Every other breaking entry the CLI reports for the rich text
editor — the addon extractions for images, links, tables, mentions, emoji,
colours, typography, slash-commands, history, file-import, AI and outline —
shipped in an earlier release and is unchanged here.

### ✨ New — `ui-rich-text-view`

A read-only renderer for what the editor produced — same sanitizer, same
markdown parser, same typography, no editor on the page.

```html
<ui-rich-text-view [value]="post.body" />                <!-- markdown, default -->
<ui-rich-text-view mode="html" [value]="post.html" size="lg" dir="rtl" />
```

Install with `add rich-text-view`. It pulls in the editor base, because the
sanitizer and markdown parser are shared.

One behaviour worth knowing: task-list checkboxes render the state they were
authored with, but they are frozen — out of the tab order, and clicking one
will not toggle it.

### 🔒 Remote images and tracking

A remote image is a silent outbound request every viewer's browser makes on
render, so any host named in a pasted document learns who opened it and when.
The industry answer is to proxy through your own backend; this editor has none,
so it offers the next best thing — you name the hosts you already trust.

**Nothing changes unless you opt in.** The default is an empty list, which
means no policy and today's behaviour exactly.

```html
<!-- Name the hosts you trust, on the editor and the view -->
<ui-rich-text-editor [allowedImageHosts]="['cdn.acme.com', '*.assets.acme.com']" />
<ui-rich-text-view   [allowedImageHosts]="hosts" (imageBlocked)="log($event)" />

<!-- Or once, for a page full of views and editors -->
<div [uiRichTextAllow]="{ imageHosts, linkSchemes: ['acme-crm'] }">
  @for (post of posts; track post.id) {
    <ui-rich-text-view [value]="post.body" />
  }
</div>
```

- **Set it on the view too.** A policy on the editor governs what an *author*
  can insert; it is not stored in the saved document, and the request fires
  when content is **rendered**.
- **Blocked images are reversible, not lost.** The `<img>` keeps its `alt` and
  its position, gains `data-blocked-src` with the original URL, and renders as
  a labelled placeholder — in the editor and in the view alike. Allowing the
  host later restores it, in HTML mode as well as markdown, and without
  writing the value again: changing the list re-judges the document in place.
  Override the caption with `[blockedImageMessage]`; the view takes a `locale`
  for the default caption.
- **Judged under the policy from the very first render.** A value arriving
  through a reactive form is sanitized before any effect runs; the sanitizer
  now reads the live list at every pass rather than a copy pushed later, so
  that first pass can no longer run with no policy.
- **Matching is on the parsed hostname**, exact and case-insensitive.
  `*.acme.com` matches by label, so `cdn.acme.com.evil.com` never passes.
  Entries are normalised first, so `https://cdn.acme.com/`, `cdn.acme.com:8443`
  and an internationalised name all match the host they name.
- **Inline and relative URLs are always permitted** — a `data:` URL carries its
  payload with it and can contact nobody, and a relative one is same-origin by
  definition. This matters: `data:` is how a Word paste brings its images, so
  blocking it would break that path for anyone who sets a list.
- **CSS `url()` is stricter than `<img>`, on purpose.** With no list set, an
  `<img>` still loads from any https host and the list only *narrows* that; a
  `url()` is refused outright until you name hosts. Once a list exists the two
  converge on the same host check. The asymmetry is deliberate: a placed image
  is visible content a reader can see, while a CSS background beacon is
  invisible, and loosening the `url()` default would have opened that channel
  for every existing consumer on upgrade, with no code change on their side.
- **Every other CSS image function is refused**, whatever the list says.
  `image-set()` takes a bare string, so it named no `url()` for the check to
  see and a browser fetched it anyway (probed in headless Chrome). A style
  value may now call only functions known not to fetch, plus `url()`.
- **What it does not do:** an allowlist narrows exposure to a party you
  *named*. `cdn.acme.com/logo.png?viewer=bob` still identifies the reader. It
  is a tracking control layered on the XSS guard, not a replacement for it.

### 🐛 Fixed in the pre-merge review

- **Find & replace no longer deletes what sits beside the match.** Replacing
  a word removed any `<img>`, `<br>`, `<hr>` or checkbox in the same paragraph,
  and replacing with nothing removed the table cell, row, list item or heading
  the match was in. Only an inline wrapper the deletion itself emptied is
  removed now.
- **Escape inside a dialog closes the popover only.** A popover consumed the
  key on the document, after the dialog's own handler had already seen it, so
  one press closed both. It is consumed in the capture phase now.
- **Regex find rejects `(?<name>a+)+`** — the named-group spelling of the
  nested-quantifier shape the guard already refused.
- **Decompression ceilings cost what they say.** Every stream decoder now
  accumulates into a one-byte-per-byte buffer with a hard ceiling (64 MB per
  PDF stream) instead of a `number[]` that took several bytes per byte, and
  LZW throws at the ceiling like Flate instead of handing on a truncated
  stream.
- **The markdown parser escapes its own attribute values**, so a quote in a
  relative link or image target cannot end the attribute early.
- **A CSS `url(//host/…)` is judged by its real host.** Parsed without a base
  it looked unparsable, unparsable read as "relative", and the reference
  walked past the allowlist unjudged. Every reference now resolves the way
  the browser resolves it, from the page.
- **The allow wrapper reaches editors too.** Its contract said "every editor
  and view beneath" and only the view honoured it.
- **Enter on a list item or quoted line that holds only an image** no longer
  deletes the image.
- **Enter leaves a blockquote, Shift+Enter adds a row inside it** — the same
  contract as a code block. An earlier fix had narrowed the exit to a blank
  last line, and nothing that opens a quote (`> `, the toolbar button, a slash
  command, the markdown parser) produced a line block at all, so every Enter
  opened another sibling quote and there was no way out. A quote's direct
  children are now always `<p>` lines: the editor builds them that way and
  the sanitizer regroups the bare shape older documents and pasted HTML
  carry. A quoted list, table or code block still owns its own Enter. The
  toolbar button is a real toggle (a second click lifts the quote).
- **Every toolbar button works on the first click.** From inside a focused
  editor a button needed two clicks: the toolbar rebuilt every icon on each
  change detection (a fresh `SafeHtml` per call), the mousedown blurred the
  editor and triggered one, and the SVG under the pointer was replaced before
  mouseup, so Chrome fired no click. Icons are now cached, so the glyph nodes
  stay put.
- **Every toolbar toggle now toggles, on real text.** A click-through of the
  whole toolbar in a browser found four that did not:
  - *Inline Code* wrapped the word but dropped the selection, so it never read
    as pressed and a second click added an empty `<code>` beside it. The text
    stays selected and the second click unwraps.
  - *Code Block* wrapped only the selected characters in a `<pre>` inside the
    paragraph and nested another on the next click. It now converts the
    caret's line blocks into one code block and back into paragraphs.
  - *Task List* inserted an empty item at the caret, deleting the selected
    text, and toggling it off left the bare checkbox in the paragraph. It now
    converts the current blocks keeping their text, switches to and from
    bullet/numbered lists cleanly, and goes back to paragraphs.
  - *Bullet* and *Numbered* lists were built by the browser INSIDE the
    paragraph (`<p><ul>…</ul></p>`). The editor builds them itself at the
    paragraph's level, one item per selected line, and toggles them back.
- **Bold no longer lights up inside a heading** for the weight the heading
  inherits; only bold formatting reads as pressed. A task list no longer
  lights the Bullet List button as well.
- **The toolbar Link button edits the link under the caret.** It seeded an
  empty form and inserted a second anchor inside the first; it now shows the
  link's text and URL with Update and Remove, also when the click-to-edit
  overlay had just been dismissed by the button press.
- **The click-to-edit link overlay opens only for clicks on the link.** A
  click in the blank space below a line parks the caret at the nearest text,
  so clicking anywhere in a link's column opened its editor; a pointer now
  has to land on the link's own box (a few pixels of slack), while a caret
  moved by the keyboard still opens it.
- **Arrow keys inside a toolbar panel stay in the panel.** The link and image
  panels render inside the toolbar's DOM, so an arrow press in their fields
  reached the toolbar's roving-tabindex handler, which read it as the first
  button's and pulled the focus back onto the toolbar; the panels' own
  buttons were also swept into the roving order and stamped `tabindex=-1`,
  dropping them from the Tab order. A key now moves the tab stop only when
  pressed on a toolbar control, and panel controls are left alone.
- **Table and Horizontal Rule go after the caret's line, whole.** Inserted
  mid-word they cut the word in two; the block now lands after the current
  line (or in the place of an empty one) with the caret in its first cell or
  the paragraph after the rule. Addons get this as `insertBlockAtCaret`.
- **Clear Formatting works with a caret, not only a selection.** With nothing
  selected the browser's `removeFormat` is a no-op, so from inside bold text
  the button did nothing and the next keystroke stayed bold. It now clears
  the formatted run around the caret (links and mention chips keep their
  element, minus styles) and leaves the caret where it was.
- **AI addon: accepting a draft respected the wrong limit.** A draft longer
  than the room left *after* it was refused, so most answers into a
  `maxLength` field were rejected while under the limit.
- **Mentions popover on plain HTTP.** Its listbox id came from
  `crypto.randomUUID()`, which exists only in secure contexts, so the popover
  threw before it opened on an intranet page.
- **Markdown**: `2024. A good year` is no longer re-read as an ordered list on
  reload; a literal `<b>` in prose stays text; prose directly under a heading,
  quote, table or list gets its paragraph; `* * *` is a rule, not a bullet.
- **Validators** treat a markdown document holding `<u>`, `<mark>`, `<sub>`,
  `<sup>`, `<small>`, `<ins>` or `<code>` as markdown, so its `**` markers are
  not counted as characters.
- **A stale "blocked by policy" marker** could be attributed to the next
  unsafe image; and an image carrying both `src` and `data-blocked-src` in
  the source now keeps only the judged `src`.
- Escape inside a dialog: the dialog now defers to an open popover inside it,
  instead of the popover intercepting the key before the focused control's
  own handler could run.

### 🎨 `init` template

- The light `--accent` token is darker (`0.97` → `0.922` lightness) for every
  base colour, so hovered and active items are actually visible. This is the
  file `init` writes into a **new** project; existing projects own their copy
  and are unchanged.

### ✨ New features on the editor

- **A consumer API** — `RichTextEditorApi` with `setContent`, `focus`,
  `format`, `insertHtml`, `insertText`, `isEmpty`, `selection`, `undo`, `redo`
  and `markClean`, plus dirty tracking and a `(historyChange)` output.
- **Markdown input rules** — a marker becomes real formatting the moment you
  finish typing it. Thirteen rules, the complete set: `# ` / `## ` / `### `,
  `- ` or `* `, `1. `, `> `, `[] ` / `[x] `, `---`, ```` ``` ```` (with an
  optional language), `**bold**`, `*italic*` and `` `code` ``. A transform is
  one undo step, and Backspace immediately after reverts it to the literal
  characters. On by default; `[markdownShortcuts]="false"` opts out. Full table
  in [the Markdown shortcuts docs](docs/rich-text-editor.md#markdown-shortcuts).

  Nested blockquotes work: `>>` and `> > >` parse to 32 levels, and several
  fixes below repair exactly that. The *typing shortcut* is the one-level part
  — it fires on a single `>`, so deeper nesting comes from markdown you paste
  or load rather than from typing extra markers.
- **Find & replace v2.** Highlights are drawn in a layer above the text
  instead of by wrapping matches in `<mark>` tags. That was a data bug, not a
  cosmetic one: typing with the find panel open used to save those tags into
  your document, the form value and the undo history. Also new — whole-word
  and regex toggles (an invalid pattern surfaces as `findRegexError` rather
  than throwing), a debounced query, an announced "3 of 12" counter, a `find`
  toolbar item for touch, and matches that survive inline markup splitting a
  phrase.
- **A Text style select**, now the toolbar default, with the caret's current
  block reported through `activeFormats`.
- **Spreadsheet-style table cell selection.**
- **A character limit** that is both shown and announced.
- **One `[locale]` binding localises every addon.**
- `[history]="{ limit, debounceMs, recordExternalWrites }"` and
  `[findDebounceMs]` for tuning.

### 🔐 Security fixes

Every one of these is in the sanitizer or a parser, so they apply to any
content your users can paste.

- A **backslash open-redirect** in link targets, plus a generalised off-origin
  authority check that also refuses `https:\host` and `https:///host`.
- **`data:` URLs validated by content**, not by their declared type —
  including payloads that only look like images once truncated. Every `data:`
  URL is refused as a *link* target.
- **CSS `url()` blocked however it is escaped** — `\75rl(`, comments, quoting.
  The previous substring test was the bypass.
- **SVG scrubbed by content** rather than by extension.
- A **decompression bomb** in file import, and a bounded `LZWDecode` in the PDF
  parser.
- **ReDoS**: find patterns that hang the tab, fence backtracking, and a
  quote-depth blind spot in the guard itself.
- **Link schemes allowlisted.** An `href` keeps only `http`, `https`,
  `mailto`, `tel`, `sms` and `ftp`; `blob:`, `file:`, `about:` and every
  `data:` are refused. Worth knowing: a custom scheme in existing content
  (`slack://`, `geo:`, `xmpp:`) is stripped on the first save. A protocol-
  relative link (`//host/x`) is kept, stored as the explicit absolute URL.
- Whether a string is a tag is now decided **by the sanitizer**, not by
  guessing at characters.

### 🐛 Bug fixes

**Round-tripping no longer loses content.** Saving and reloading used to drop
or mangle: colour, highlight and font; `mark` / `sub` / `sup` / `small` /
`ins`; code spans and backslash escapes; hard line breaks; empty list items;
the paragraph after a list or a rule; nested and tight (`>>`) blockquotes; GFM
tables; percent-encoded PNG and JPEG images; single-cell tables from Word
pastes; fences longer than three characters; and plain-text pastes, which were
being reflowed.

**Printing**

- **The document no longer prints truncated.** The editable area is a
  fixed-height scroll box, so Ctrl/Cmd+P printed only what fitted on screen —
  measured at 40 paragraphs, 59% of the content was silently missing from the
  page. There is no Print button; this fixes what your browser's own print and
  Save-as-PDF already do. The editor's first stylesheet lifts the height and
  overflow constraints for print, hides chrome that means nothing on paper
  (toolbar, find overlay, outline panel), and adds page-break hints for rows,
  images and headings. Every rule sits inside `@media print`, so nothing on
  screen changes.

**Editing**

- Redo no longer destroys text typed after an undo.
- Deleting across a table edge no longer eats the next block.
- Markdown lists no longer lose their text or split into one list per item.
- Tables size to their widest row instead of dropping cells; spanning cells
  pad correctly.
- Exiting a list produces a paragraph, not a browser-default `div`.
- A transformed block accepts typing again (the caret is anchored).
- Mention-select crash, stale table references, and popovers that stayed open
  when their content was replaced.

**Accessibility**

- The editor tells assistive tech what state it is in; combobox ARIA on
  suggestion popups; import status, the outline panel and emoji names are
  audible; the toolbar's roving tabindex actually roves; image resizing and the
  overlay buttons work from the keyboard; frozen task checkboxes stay in the
  accessibility tree.

**Touch and small screens**

- Table columns resize by touch; touch targets meet the 44×44 minimum; the
  outline panel becomes a full-width overlay below `md`.

**Performance**

- Each pasted subtree is converted once rather than repeatedly, which removes
  the quadratic walk that made large pastes slow enough to look hung.

### 📦 Compiled packages

`@gilav21/shadcn-angular-rte` and `@gilav21/shadcn-angular-data-table` are
built with ng-packagr from a registry closure, with `release:package` handling
everything up to `npm publish`.

They support **Angular 20 and 21**. The 21-only pin was dropped after
measuring: partial-Ivy `minVersion` across both packages tops out at 17.2.0,
and a real Angular 20.3.30 app installs the 21-toolchain-built tarball and
builds for production. Only the peer range had ever excluded 20.

### 🛠 CLI

- **`--preset`** installs a group of addons in one command.

  The rich text editor has 13 addons. Without a preset you install the base and
  then add them one at a time, which means knowing the names up front and
  deciding which of the 13 your case needs. A preset is a shortcut for the
  combinations people actually reach for together.

  **Grouped by the job you are doing**, not by anything cosmetic: `writing` is
  prose authoring, `media` is getting non-text content in, `styling` is surface
  appearance, `reporting` is getting data back out. Nothing a preset does is
  unavailable by hand — same addons, same result — it just saves the lookup,
  and records the intended groupings somewhere.

  Two things to know: `core` is deliberately empty, so "base only" is something
  you can state rather than infer from omitting the flag; and a preset is a
  starting point, not a mode — you can apply more addons afterwards. Three
  addons (`actions`, `mentions`, `ai`) sit outside the themed groups and come
  only with `everything`, or individually.

  The name resolves against the component you are adding:

  ```bash
  npx @gilav21/shadcn-angular add rich-text-editor --preset writing
  npx @gilav21/shadcn-angular add data-table --preset everything
  ```

  | Component | Preset | Pulls in |
  |---|---|---|
  | `rich-text-editor` | `core` | nothing — the base alone |
  | | `writing` | slash-commands, links, history, outline |
  | | `media` | images, tables, file-import |
  | | `styling` | colors, typography, emoji |
  | | `everything` | all 13 addons + `full` |
  | `data-table` | `core` | nothing — the base alone |
  | | `menus` | context-menu |
  | | `reporting` | export, pivot |
  | | `everything` | context-menu, export, pivot |

  An unknown name lists the valid ones for that component rather than failing
  blankly.
- The **install summary groups components by why each one is there** —
  requested, dependency, or addon.
- Install-time output explains what owning the code means.

---

## Earlier releases

Component changes before this entry are recorded in the CLI changelog, which
covered both until the two were split.
