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
- **Breaking: Backspace at the start of a line joins the line above it on
  screen.** A row whose neighbour above has sub-items now joins the deepest of
  those sub-items, rather than skipping the sub-list to reach the item at the
  same level. Up and down are now exact mirrors of each other, which is how
  word processors behave. A join also never crosses into a table cell or a code
  block: prose joins to prose.
- **Breaking: block commands act on the caret's own line, and only where a
  save keeps the result.** With the caret inside a list item or a table cell
  they used to walk up to the whole list or table, so Code block turned every
  item of a list into one block. A later version built the block inside the
  item or the cell instead, which markdown cannot carry, and in a task row the
  next keypress moved it into the row's text. Now:
  - *Quote* and *Code block* on a top-level list item take that item out: the
    list splits around the new block, the item's sub-list follows it, and a
    numbered list's second half keeps counting. On a nested item, an item
    holding several lines, a table cell or a summary they do nothing. In a code
    block, Code block unwraps it and Quote wraps it.
  - *Horizontal rule* and inserted tables split a list the same way (an empty
    item the caret sat in is replaced), go after the table from inside a cell,
    and go to the start of the details body from a summary.
  - The list toggles do nothing in a table cell, a summary or a code block.
    Turning a sub-list off moves its items after their top-level item; two or
    more levels down it does nothing, since the text would change order. *Task
    list* does nothing on a list whose items hold a rule, which a task row, one
    line of text, cannot keep.
  - The slash menu runs the toolbar's own commands. It rebuilt blocks itself
    and disagreed with the toolbar: bullets on a bullet item did nothing, and a
    numbered list over task rows kept their checkboxes inside an `<ol>`, where
    a save dropped them.
  - A selection reaching from a paragraph into a list stops at the list's edge
    instead of pulling items out of it.
- **Headings and Normal text are applied by the editor, not the browser.**
  `formatBlock` applied the tag to whichever ancestor it chose, so a heading set
  inside a list item wrapped the entire list in the heading. Headings now change
  paragraphs and headings only: on a list item, a table cell, a disclosure's
  summary or a code block -- or a paragraph inside any of them -- the command
  leaves the line as it is, and so does the slash menu. A heading inside an item
  was tried first and could not survive a save, since markdown writes it as
  `- # Title` and reads it back as literal text.
- **Code block leaves a line with an image alone.** A code block holds text, so
  the command used to drop the image, and toggling back could not restore it.
- **Quote on a task row no longer freezes the page.** Content sync flattens a
  block inside a task row into the row's text, and flattening a block that held
  another block looped forever, so the tab hung. Pasted or imported rows holding
  such a block -- a quote holding paragraphs, a div around a list -- hit the
  same loop on load.
- **Turning bullets off keeps each sub-list under its own item.** Each sub-list
  was moved out ahead of the paragraph built from its parent, so the children
  appeared above the item they belonged to.
- **Turning a list off keeps an item that holds only an image.** Placing the
  caret in the new paragraph cleared any block without a text node, so an
  image-only bullet, numbered or task item came back as an empty paragraph.
- **An element holds a line of text or holds blocks, never both.** Content in
  an element that also held a block belonged to no line, so a block command
  given such an item reached out to the whole list and destroyed every line in
  it. The sanitizer gives that content a line of its own, and the editor no
  longer creates the shape.
- **Sanitized content reads back unchanged.** The sanitizer wrapped a rule, a
  stray list item, a summary or a span holding a paragraph in a `<p>`; the
  browser closed that paragraph early when reading the result back, so every
  pass -- each HTML-mode write, each `ui-rich-text-view` render -- added empty
  paragraphs, without end. An inline wrapper around a block now moves inside
  it, keeping its formatting; a stray item gets a list of its own and a stray
  summary becomes a paragraph.
- **Blocks flattened into a task row keep their words apart.** A row is one line
  of text, so pasted or imported blocks inside it are flattened, and two
  paragraphs or two cells used to fuse into one word. Each boundary is now a
  space, a code block's line breaks become spaces, and a rule pasted inside a
  row is dropped. The task list toggle flattens an item's quote or table the
  same way instead of putting the block inside the row.
- **A markdown save keeps what nested blocks hold.**
  - A rule under a list item was written back as the text `---`; a rule in a
    table cell now becomes a line break, the nearest thing a cell holds.
  - A details block inside a quote gained a quote level on every save, and a
    details block inside another lost its body.
  - A list item that opens with a code block, heading, table, rule or quote
    came back as literal markup, and a quote holding code inside a list item
    lost its code block.
  - Blank rows and trailing spaces in a quoted code block were deleted, and a
    details body's paragraphs merged into one on the second save.
  - A summary kept only its text, dropping links, images and emphasis.
  - Bold inside bold, italic inside italic, italic around bold at its edge and
    emphasis starting or ending with a space all saved with stray asterisks.
  - A numbered list that does not start at 1 restarted at 1.
- **Turning a list off keeps an item's code block or quote a block** instead of
  wrapping it in a paragraph the browser takes apart.
- **Enter on an empty nested task row steps it out one level,** as it does in a
  plain list. It used to leave the list from inside the parent row, building a
  paragraph there that the next keypress moved into the row's text.
- **Clear formatting inside a task row keeps the row's text in its row.** The
  row's text span was cleared as if it were formatting, leaving the text bare
  beside the checkbox.
- **A caret pushed out of a checkbox's spot lands at the end of the row's text,**
  not after its first text run.
- **Code block keeps a line break inside a line** as a new line of code. It
  joined the text on either side of the break into one word.
- **Tab and Shift+Tab keep rows in order under an item holding two sub-lists.**
  A row indented under an item, or carried under it by an outdent, went into
  the item's first sub-list of that tag, ahead of rows already in a later one,
  and an outdent could leave a plain item inside a task list until reload. It
  now goes after everything the item holds, in a list of its own kind, and a
  numbered row keeps counting past a list of another kind.
- **The slash menu acts on the line it was typed in.** On an item holding a
  sub-list, a table or a code block, the caret was put at the end of the
  nested block, so a list, quote or inline-code command acted on the sub-list's
  last item or did nothing, also when the item's own line was blank. A slash
  typed in a summary, a table cell or an h4-h6 heading acts there too; it acted
  on the details body, the table's last cell or the block around the heading.
- **A list holds one kind of item.** A save writes an item by its list's kind,
  so a task row outdented into a plain list, pasted into one or promoted there
  by a join saved as a plain bullet and lost its checkbox, and a plain item in a
  task list gained one. The editor and the sanitizer now split a list where its
  items change kind, keeping each item's kind and an ordered list's count; an
  item of a task list that arrives without `data-task` is a task row, as the
  markdown writer always read it.
- **Sanitizing parses in standards mode.** With no doctype the parser ran in
  quirks mode, where a table does not close an open paragraph, so a pasted
  `<p>a<table>` came apart only when the page read it back. A stray summary
  holding a paragraph no longer becomes a paragraph inside a paragraph, and a
  details block's summary is moved to the front, where a browser shows it.
- **Text that looks like markdown stays text.** "2024." or "-" alone on a line,
  ">50%", "---", "~~a~~", "~~~", ":::details", "[t](u)" and "[x] done" were
  read back as a list, a quote, a rule, strikethrough, a code block, a details
  block, a link or a task row. List item text was not escaped at all.
- **More markdown round-trip fixes:**
  - Emphasis inside a word (`un<em>believ</em>able`) is kept as the tag instead
    of turning into literal asterisks.
  - An empty heading no longer takes the paragraph after it as its text.
  - Bold or italic inside another inline element, such as a span, that touches
    a word is kept as its tag instead of turning into literal asterisks.
  - Bold ending in italic next to bold starting with italic no longer reads
    back as one scrambled run.
  - A newline inside text, as pasted or pretty-printed HTML has, is saved as the
    space it shows wherever markdown writes the text on one line: in a heading,
    a task row, a table cell, a summary or bold and italic. It ended the heading
    or the row, or left asterisks around quoted bold. Two line breaks in a row
    inside a heading or a task row are both kept.
  - Syntax split across inline elements stays text: `[see <b>this</b>](u)`,
    `[<span>x</span>] done` and `2024<span>.</span> x` came back as a link, a
    task row and a numbered list. Nested brackets, table-shaped lines such as
    `|---|---|`, and entity-shaped text such as `&lt;` are kept too.
  - Strikethrough inside strikethrough is saved as one run, not stray tildes.
  - A quoted table followed by text no longer leaves an empty paragraph after
    the quote, at the top level, in a list item or in a details block.
  - Two line breaks inside emphasis written as tags, or inside an underline,
    highlight or another tag markdown has no syntax for, no longer turn the
    tags into visible text.
  - Emphasis next to an empty span keeps its formatting.
  - A details block with only a summary no longer gains an empty paragraph.
  - A coloured or highlighted span holding a line break inside a quote stays
    one span; a quote's paragraph wrapped in a div settles; and a quoted code
    block keeps its indentation instead of losing a space on every save.
  - Code written as a tag keeps asterisks, backticks and backslashes as written,
    image alt text holding a newline, backticks or asterisks stays one image, and
    an empty link stays a link instead of its markdown appearing as text.
  - Content after a sub-list in a list item stays after it, in that item; it came
    back ahead of the sub-list or inside its last item.
  - A details block or quote indented under a numbered item, or under a bullet
    with extra spaces, reads back as a block of the item instead of text.
  - Details blocks and quotes nested deeper than markdown is read back are
    unwrapped when saved, keeping their words in order, so saves agree instead of
    turning the markers into visible text.
  - A list item holding thousands of details openers whose closers lie past it
    loads in milliseconds instead of seconds.
  - Turning a list into a task list, or loading a task row, keeps the content
    after a nested list after it, as the next row; it moved ahead of the list.
  - Loose text beside a block keeps the spaces between its words when it gets a
    paragraph of its own.
  - Outdenting the last item of a sub-list takes along what its parent item held
    after the sub-list, instead of leaving that above the item; a task row keeps
    the lists among it as its own sub-lists, and the rest becomes an item after
    the row. A break or an empty element after a nested list no longer adds an
    empty task row.
  - A code block in a quote inside a list item stays a code block of the quote;
    after a list in that quote it joined the list item's text on save.
  - A sub-list or a nested item's block inside a details block in a numbered item
    keeps its level through a save.
  - A link holding only a space or a break keeps it, so the words around the link
    no longer fuse; a break inside inline code is kept; and image alt text holding
    "<", "&" or a quote reads back unchanged.
  - A staircase of nested items each opening a details block loads in linear time.
  - Italic runs side by side stay italic; code written inside a heading or with
    a blank line keeps its spaces and newlines; a code block whose language is
    "c++" or "c#" stays a code block; an image whose alt text holds "]" stays an
    image.
  - A quote keeps its paragraphs apart beside a list, a heading or a code
    block, where two of them read back as one; a quoted line starting with "|"
    or the text after a quoted code block no longer gains an empty line; and a
    line break nested inside a quote stays a line break.
  - Text is saved as the page shows it: a span that carries nothing is dropped
    and its text joined with the text beside it, and blanks and newlines in the
    markup become the single space they show, so syntax split across spans
    (`~<span>~</span>~`, `&<span>lt;</span>`) and entity-looking text with no
    semicolon, such as `&copy`, stay text.
  - An unclosed `:::details` in a list item stays text in that item instead of
    pulling the rest of the document into it, or a later item or paragraph
    that happens to be followed by a closer; and details blocks nested past 32
    levels, counting the quotes and list items between them, stay text, so
    deeply nested input no longer stalls the page.
  - A quote holding inline code with a backtick run, or strikethrough starting
    with a tilde, no longer gains an empty line on every save; the paragraph
    after a table in a list item inside a quote is no longer read as its row.
  - A line break inside bold or italic in a quote is kept. In a quote that also
    held a block, the emphasis came back as literal asterisks.
  - A line break inside a heading, a summary, a task row or a list item's own
    line is kept, rather than ending the heading, scattering asterisks, or
    splitting the row or the item into paragraphs that changed on every save.
  - A details block inside a list item keeps its headings, quotes and lists; a
    details block with an empty summary survives inside a quote; a details block
    takes its own summary, not a nested one's; and one with no summary is saved
    without the invented title "Toggle".
  - A list item holding text and blocks no longer leaves an empty paragraph
    inside or after the list.
  - A paragraph after a quoted table is no longer read as a table row.
  - A numbered list keeps a start of 0 to 999999999; a start markdown cannot
    write back is dropped.
- **The caret in a task row stays in the row's text.** The browser let it
  stop before or on the checkbox (ArrowUp from the row below landed there,
  sometimes needing a second press), so text typed there sat before the box
  and Backspace there deleted the box and merged the rows, baking the row's
  struck, muted rendering into inline styles on the surviving text. The caret
  is now confined to the text span; Backspace at the start of a row joins its
  text onto the row above (the first row becomes a paragraph) instead of
  dropping the text; Delete at the end pulls the next row's text in.
- **A checked task row strikes only its own text.** The rule sat on the
  whole row, so every row nested under a checked one rendered struck and
  muted whether it was done or not, in the editor and in `ui-rich-text-view`.
- **An empty table survives a block inserted from inside it.** The
  emptiness check searched an element's descendants, and a table is not its
  own descendant, so an all-empty table read as a blank line and inserting a
  second table or a rule from one of its cells replaced it. Silent content
  loss; an element that is itself a table, image, rule or input now counts as
  content.
- **A selection running past a link is new link text, not an edit.** The
  toolbar popover seeded only the part inside the link and, on submit, wrote
  that text into the anchor while the rest stayed in the paragraph, so
  "see docs now" became "see docs now now". Selections that reach past a link
  now insert, unwrapping the link markup they cover so no empty anchor is
  left behind.
- **Task rows always carry their text in a span.** The editor and the
  markdown parser built them that way but nothing enforced it, so rows from
  another producer (the PDF import path) or from consumer HTML lost the
  checked-row strike and gave the caret nowhere of its own to sit. The
  sanitizer now gives every task row the shape, for the editor and the view.
- **Backspace and Delete in task rows follow the line below, not the row
  kind.** Deleting at a row's end skipped a plain nested item, and could
  reach a task row two positions down and pull up an untouched line; joining
  onto a plain item put the text below that item's sublist. The item below a
  row is now the first item rendered after it, whatever kind it is, and a
  nested list is never part of a line's text.
- **Images and line breaks count as content in a task row.** A range renders
  them as no text, so a row starting with either read as empty and Backspace
  merged the rows instead of deleting the element.
- **Arrow keys step one line inside a wrapped task row.** The move was
  repeated whenever the caret stayed in the same row, which is exactly where
  a row wrapping over several lines stays.
- **The emoji panel is not part of the toolbar's arrow navigation.** Its
  panel is not a popover, so every emoji button became a toolbar tab stop and
  the arrows fought the picker's own grid.
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
