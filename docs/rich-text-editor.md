# Rich Text Editor

The editor is a **base component plus opt-in addons**. The base is 12 files
and ships the editing engine: contenteditable management, the sanitizer, the
markdown round-trip, undo/redo history, find & replace, table *editing*, the
toolbar, and the `ControlValueAccessor`. Everything else — emoji, colours,
typography, links, table *insertion*, images, mentions, file-import, AI,
outline, slash-commands, revision history, actions — is an addon you attach as
a directive on the editor element.

- [Install](#install)
- [One import line](#one-import-line)
- [Imperative API](#imperative-api)
- [Form validators](#form-validators)
- [Rendering published content — `ui-rich-text-view`](#rendering-published-content--ui-rich-text-view)
- [The addon model](#the-addon-model)
- [Writing your own addon](#writing-your-own-addon)
- [The host contract](#the-host-contract)
- [Toolbar slots](#toolbar-slots)
- [Locale cascade](#locale-cascade)
- [Testing your addon](#testing-your-addon)
- [What is *not* an extension point](#what-is-not-an-extension-point)

---

## Install

```bash
# Base editor only — 12 files, one component dependency (separator).
npx @gilav21/shadcn-angular add rich-text-editor

# Base + one addon.
npx @gilav21/shadcn-angular apply rich-text-editor/emoji

# Base + every addon, plus the generated `addons/full` barrel.
npx @gilav21/shadcn-angular add rich-text-editor/full
```

`npx @gilav21/shadcn-angular why rich-text-editor` prints the file list and
every addon.

## One import line

With `rich-text-editor/full` installed, everything comes from one barrel:

```ts
import {
  RTE_FULL,
  RichTextEmojiDirective,
  RichTextTablesDirective,
} from '@/components/ui/rich-text-editor/addons/full';

@Component({
  imports: [RichTextEditorComponent, RTE_FULL],   // or a subset
})
```

```html
<!-- all thirteen at once -->
<ui-rich-text-editor uiRteFull [(ngModel)]="doc" />

<!-- or pick -->
<ui-rich-text-editor uiRteEmoji uiRteTables [(ngModel)]="doc" />
```

`addons/full/index.ts` is **generated** by `sync-registry`. It both imports
each sibling directive into `RTE_FULL` *and* re-exports it by name — Angular's
AOT reference emitter resolves a directive used through `imports: [RTE_FULL]`
via the array's own module, so dropping the re-export would fail a consumer
build with NG3004. A new addon joins both lists automatically.

**Types come from the owning addon's barrel**, not from `full` — the generated
barrel re-exports directive *classes* only:

```ts
import type { MentionItem, TagItem }
  from '@/components/ui/rich-text-editor/addons/mentions';
```

Importing a type from `addons/full` is a TS2305 "has no exported member".

A **partial install** (say three addons) has no `full` barrel by construction,
so those consumers import each addon's barrel — three honest lines. That is
inherent to the copy model: the base barrel can never re-export an addon,
because the file would not compile for anyone who installed the base without
it. `sync-registry` enforces that boundary as a hard error.

## Configuring the editor

Every option that has more than one knob is one input taking a typed object,
so an IDE completes the fields and the defaults are documented on the type.
Set only the fields you change.

```html
<ui-rich-text-editor
  counter="both"
  [history]="{ limit: 200, recordExternalWrites: true }"
  [allowedImageHosts]="['cdn.acme.com']"
  [allowedLinkSchemes]="['acme-crm']"
  dir="rtl" />
```

| Input | Type | Default | Notes |
|---|---|---|---|
| `mode` | `EditorMode` | `'markdown'` | `'markdown'` or `'html'`: what the editor emits. |
| `counter` | `CounterMode` | unset | `'characters'`, `'words'` or `'both'` below the editor. |
| `maxLength` | `number` | unset | Advisory character limit, shown and announced. |
| `history` | `RichTextHistoryOptions` | `{}` | `limit` (100), `debounceMs` (450), `recordExternalWrites` (false). |
| `findDebounceMs` | `number` | `150` | Quiet time before a find query runs. |
| `allowedImageHosts` | `string[]` | `[]` | Hosts images and CSS backgrounds may load from; empty means no policy. |
| `allowedLinkSchemes` | `string[]` | `[]` | Link schemes on top of `DEFAULT_LINK_SCHEMES`. |
| `blockedImageMessage` | `string` | unset | Caption on a blocked image; the locale's default otherwise. |
| `dir` | `TextDirection` | unset | `'ltr'`, `'rtl'` or `'auto'`; unset follows the locale. |
| `locale` | `LocaleInput<RichTextLocale>` | unset | A locale key or a full dictionary; addons inherit it. |

Addons follow the same rule. The images addon, for instance, takes
`[uiRteImagesUpload]` (`RichTextImagesUploadOptions`: `uploader`, `auto`,
`sources`) and `[uiRteImagesLayout]` (`RichTextImagesLayoutOptions`: `resize`,
`alignment`, `defaultWidth`, `defaultHeight`, `defaultAlignment`, `minWidth`,
`maxWidth`, `lockAspectRatio`). The option types are exported from the barrel
that owns the input.

The outputs: `htmlChange`, `markdownChange`, `wordCountChange`,
`historyChange`, `focused`, `blurred`, and `imageBlocked` for every remote
image the host policy refused.

### One attribute per addon

Every toolbar-contributing addon is switched on by its bare attribute and tuned
by the same attribute, as an object (`RichTextAddonOptions`):

```html
<ui-rich-text-editor uiRteImages />                              <!-- on, defaults -->
<ui-rich-text-editor [uiRteImages]="false" />                    <!-- off -->
<ui-rich-text-editor [uiRteImages]="{ toolbar: false }" />       <!-- paste and drop only -->
<ui-rich-text-editor [uiRteLinks]="{ order: 100, slashCommand: false }" />
<ui-rich-text-editor [uiRteHistory]="{ toolbar: false }" />      <!-- shortcut only, no corner button -->
```

`toolbar` (default `true`) contributes the button; `slashCommand` (default
`true`) registers the addon's `/command` where it has one; `order` sorts the
button among addon buttons, each addon carrying its own default. Fields you do
not name keep their defaults. The addon reads the resolved
`RichTextAddonState`, which adds `enabled`.

### Your own toolbar buttons

A button is data. Give it an `onClick` and there is nothing else to wire:

```ts
readonly items: RichTextCustomToolbarItem[] = [
  { id: 'stamp', icon: '📅', tooltip: "Insert today's date",
    onClick: (ref) => ref.insertText(new Date().toLocaleDateString()) },
  { id: 'sign', icon: SIGN_SVG, tooltip: 'Insert signature',
    onClick: (ref) => ref.insertHtml('<p><i>— Dana</i></p>') },
];
```

```html
<ui-rich-text-editor [customToolbarItems]="items" />
```

`icon` is inline SVG or a short text glyph; `order` sorts among your buttons
(built-ins always come first); `isActive(formats)` drives the pressed state.
The `RichTextEditorRef` a click receives has `insertText`, `insertHtml`,
`focus`, `getSelectedText` and `getHtmlContent`, and every write goes through
the editor, so it emits the outputs and records a history entry like a
built-in button. `(customToolbarAction)` fires for every click as well, for
a page that would rather handle all its buttons in one place. Addon authors
who need a popover or a component in the toolbar use the slot registry
described under "Writing your own addon"; the data path is built on it.

## Markdown shortcuts

Typing a recognised Markdown marker turns it into real formatting the moment it
is complete. This is on by default — no import, no addon, no configuration.

| Type | Get |
| --- | --- |
| `# ` / `## ` / `### ` | Heading 1 / 2 / 3 |
| `- ` or `* ` | Bullet list |
| `1. ` (1-3 digits) | Numbered list |
| `> ` | Blockquote (nests to 32 levels — see below) |
| `[] ` / `[x] ` | Task item, unchecked / checked |
| `---` | Horizontal rule |
| `` ``` `` then Space or Enter | Code block (`` ```ts `` sets the language) |
| `**bold**` | `<strong>` |
| `*italic*` | `<em>` |
| `` `code` `` | Inline `<code>` |

**Nested quotes, and where the shortcut stops.** Nesting is fully supported:
`>>` and `> > >` parse into nested blockquotes up to 32 levels deep, and they
round-trip through a save. A details block, a quote holding another and a
block inside a list item each add a level, and a sub-list does not; markdown
nested past 32 levels stays text when loaded. A save unwraps a details block or
quote nested 32 or more levels deep, counted the same way except that every
quote counts, keeping its words in order, so everything it writes loads back.

The *typing shortcut* is the one-level part. Each rule matches a single marker,
so `>` starts a quote while typing `>>` matches nothing and stays literal text.
To author a nested quote, write the markdown and load it, or paste it in.

**Undo semantics.** A transform is exactly one undo step. `Mod+Z` right after
typing `# ` gives you back the literal `# `, not the paragraph before it.

**Backspace reverts.** Pressing Backspace immediately after a transform — no
other key, click or blur in between — restores the literal characters, so a
marker can still be typed as text when that is what you meant. Any other action
closes that window and Backspace goes back to deleting.

**Turning it off.**

```html
<ui-rich-text-editor [markdownShortcuts]="false" />
```

Reach for this when your authors type Markdown markers they expect to stay
literal — a documentation tool whose content *is* Markdown source, say.

**What does not fire a rule.** A marker only counts when it is the whole text
before the caret, in a plain paragraph. Nothing happens inside a list item,
table cell, `<pre>`, `<summary>` or an existing heading; nothing happens
mid-IME-composition, on a deletion or during an undo replay; and the space that
completes a marker has to have been *typed*, so dropping or pasting `"- "`
leaves it as text. Inline rules additionally never fire inside code, a link or
a mention chip.

**Interplay with the slash and mentions addons.** The transform runs before
those addons are told about the keystroke, so they see the post-transform text.
`/h1` still opens the slash menu, `# ` still converts and leaves the menu
closed, and typing `@a` in a heading a rule just created opens the mention
popover as usual. The addons need no changes.

If you are writing an addon that consumes `registerInputObserver`, this is the
ordering guarantee you can rely on: the text you receive is what the document
actually contains, never a marker the editor is about to rewrite.

## Text style select

The default toolbar's block-type group is one `'textStyle'` select — Normal
text / Heading 1 / 2 / 3 — rather than four buttons. It both reflects the
caret's block and sets it. It changes paragraphs and headings only: with the
caret in a list item, a table cell, a disclosure's summary or a code block --
or in a paragraph inside any of them -- the line is left as it is, because a
heading inside any of those does not survive a Markdown save. See
[Block commands inside lists, tables and summaries](#block-commands-inside-lists-tables-and-summaries).

```html
<!-- default: the select -->
<ui-rich-text-editor />

<!-- the classic four buttons instead -->
<ui-rich-text-editor
  [toolbarItems]="['bold', 'italic', 'separator', 'paragraph', 'heading1', 'heading2', 'heading3']" />

<!-- the select alongside other block toggles -->
<ui-rich-text-editor [toolbarItems]="['textStyle', 'separator', 'bulletList', 'blockquote', 'codeBlock']" />
```

It is a native `<select>`, which keeps the base install at one dependency
(`separator`) and gives phones the OS picker — the reason the control exists
is to save toolbar width on a 320px screen, where four buttons were the biggest
fixed cost.

**Pressed state.** `activeFormats()` now reports the caret's block as well as
its inline formats, so `paragraph`, `heading1-3`, `blockquote`,
`codeBlock`, `code`, `bulletList`, `orderedList`, `taskList` and
`alignLeft/Center/Right` all render pressed when they apply. Read it directly
for an app-level status bar:

```ts
readonly editor = viewChild.required(RichTextEditorComponent);
readonly blockLabel = computed(() => {
  const f = this.editor().activeFormats();
  if (f.has('heading1')) return 'H1';
  if (f.has('codeBlock')) return 'Code';
  return f.has('blockquote') ? 'Quote' : 'Text';
});
```

`activeFormats()` also carries `'indent'` when the caret's list item is
nested two or more levels deep. The `indent` and `outdent` buttons never
render pressed, though — they are momentary actions, and WAI-ARIA reserves
`aria-pressed` for toggles, so those buttons omit the attribute entirely.

## Block commands inside lists, tables and summaries

A block command only builds a shape the saved Markdown can carry, so what it
does depends on where the caret's line sits. The toolbar, the slash menu and
the public `insertBlockAtCaret` all follow the same rules.

| Caret in | Heading / Normal text | Quote, Code block | Horizontal rule, table | Bullet, numbered, task list |
| --- | --- | --- | --- | --- |
| A paragraph or heading | Re-tags the line | Wraps the line | Goes after the line, or replaces it when empty | Wraps the line |
| A top-level list item | Nothing | Takes the item out; the list splits around the block | Splits the list after the item | Toggles or re-kinds that list |
| A nested list item, or an item holding several lines | Nothing | Nothing | Splits the list after the top-level item | Toggles or re-kinds its own list |
| A table cell | Nothing | Nothing | Goes after the table, or splits the list when the table is in a list item | Nothing |
| A disclosure's summary | Nothing | Nothing | Goes to the start of the details body | Nothing |
| A code block | Nothing | Quote wraps it; Code block unwraps it | Goes after it | Nothing |

When a list splits, both halves keep the list's kind -- a task list stays a
task list -- and a numbered list's second half continues the count with a
`start` attribute, which the sanitizer keeps and Markdown round-trips.

Turning a sub-list off moves its items after their top-level item when the
sub-list ends that item; deeper than that the command does nothing, because
the text would change order. *Task list* does nothing on a list whose items
hold a rule: a task row is one line of text and cannot keep it.

A list holds one kind of item. Outdenting a task row into a plain list, or a
join that promotes plain items into a task list, splits the list so every item
keeps its kind; a save writes an item by its list's kind, so a mixed list lost
checkboxes. Every item of a task list is read as a task row.

**What Markdown cannot hold.** A task row is one line of text: a quote,
paragraphs or a table pasted inside one are flattened into it, with a space at
each boundary, and a rule pasted inside a row is dropped. Content after a row's
nested list becomes the next row, so its words stay after the list's; what would
show nothing in a row there, such as a rule or an empty block, joins the row
above instead. A pipe-table cell is
one line too, so in `mode="markdown"` a rule inside a cell is saved as a line
break. HTML mode keeps the rule.

## Imperative API

Everything application code may call on the editor is one exported interface,
`RichTextEditorApi`. A `viewChild.required(RichTextEditorComponent)` satisfies
it, and a helper that only needs the API can take the interface and never
import the component class. Everything else public on the component is either
the addon-host contract or template plumbing, and is **not** covered here.

```ts
import {
  RichTextEditorComponent,
  richTextRequired,
  richTextMaxLength,
} from '@/components/ui/rich-text-editor';

@Component({
  imports: [RichTextEditorComponent, ReactiveFormsModule],
  template: `
    <ui-rich-text-editor mode="html" [formControl]="body" />
    <button type="button" (click)="editor().insertText('— Jane')">Sign</button>
    <button type="button" (click)="editor().format('bold')">B</button>
    <button type="button" [disabled]="!editor().canUndo()" (click)="editor().undo()">Undo</button>
    <button type="button" [disabled]="isEmpty()" (click)="send()">Send</button>
  `,
})
export class ComposeComponent {
  readonly editor = viewChild.required(RichTextEditorComponent);
  readonly body = new FormControl('', {
    nonNullable: true,
    validators: [richTextRequired(), richTextMaxLength(280)],
  });
  readonly isEmpty = computed(() => {
    this.editor().htmlOutput();
    return this.editor().isEmpty();
  });
}
```

| Member | What it does |
|---|---|
| `focus()` | Focuses the editable and restores the caret the user last had inside it, or places one at the end. No-op while disabled. |
| `insertText(text)` | Inserts plain text at the restored caret as **one** history entry, then focuses. No-op while readonly/disabled or for `''`. |
| `insertHtml(html)` | Same, for markup — sanitized first, so a `<script>` is dropped rather than inserted. No-op when nothing survives sanitization. |
| `format(command)` | Runs a toolbar command exactly as a click would. Takes `RichTextFormatCommand`, which excludes `'textStyle'`, `'find'`, `'undo'` and `'redo'` — passing one is a compile error. |
| `selection()` | Snapshot of the current selection or caret target. This is the selection API; there is no `getSelectionSnapshot`. |
| `isEmpty()` | `true` when there is no visible text and no image, rule or table — the same rule `richTextRequired()` applies. |
| `undo()` | Undo one step, mirroring `Ctrl`/`Cmd`+`Z`. Flushes a pending typing burst first. No-op at the start of the stack. |
| `redo()` | Redo one step. No-op at the end of the stack. |
| `setContent(value, options?)` | Programmatic write. Mode-aware, calls the form's `onChange`, and records one history entry unless you pass `{ recordHistory: false }`. |
| `markClean()` | Treat the current content as saved, so `isDirty()` reads false again. |
| `canUndo` | Signal — whether an undo step is available. |
| `canRedo` | Signal — whether a redo step is available. |
| `isDirty` | Signal — whether the content changed since the last form write or `markClean()`. |
| `htmlOutput` | Signal — the content as sanitized HTML, whatever the `mode`. |
| `markdownOutput` | Signal — the content as markdown, whatever the `mode`. |

Two things worth knowing:

- `insertText` and `insertHtml` restore the caret **the user last had in the
  editor** before inserting, so a page button that steals focus still lands the
  text where the reader left off. The addon-host `insertTextAtCaret` does not —
  it inserts at the page's *live* selection, which is why it is the wrong
  method for a button.
- `isEmpty()` parses the document on each call. In a template, wrap it in a
  `computed` that reads `htmlOutput()` first, as above, rather than calling it
  directly.

## Form validators

Angular's built-ins measure the *markup*, which is the wrong thing for a rich
text value: `Validators.required` passes an emptied HTML-mode editor (it emits
`<p><br></p>`), and `Validators.maxLength(280)` charges you for every
`<strong>` tag. These three measure the **visible text** instead, in either
mode — the syntax is detected, not configured, so the validator cannot disagree
with the editor about which mode it is in.

| Validator | Error shape |
|---|---|
| `richTextRequired()` | `{ required: true }` when there is no visible text and no image, rule or table. An image-only document passes. |
| `richTextMaxLength(n)` | `{ maxlength: { requiredLength, actualLength } }` — Angular's own shape, so `ui-field-auto-errors` renders it with no configuration. Line breaks and block boundaries are not characters. |
| `richTextMinWords(n)` | `{ minWords: { requiredWords, actualWords } }`. Block boundaries separate words, so two one-word paragraphs count as two. An empty value passes — only `required` reports emptiness. |

```html
<ui-field>
  <ui-field-label for="body">Post</ui-field-label>
  <ui-rich-text-editor id="body" mode="markdown" [formControl]="body" />
  <ui-field-auto-errors />
</ui-field>
```

The helpers behind them are exported too, when you need the measurement rather
than the validation: `richTextVisibleText(value)`, `richTextHasMedia(value)`
and `isRichTextEmpty(value)`. The last is the single rule the editor's
`isEmpty()` also uses, so a form's validity and a Send button's disabled state
can never disagree.

## Remote images and tracking

By default the editor accepts any `https://` image, which is what every
comparable editor does. Worth understanding before leaving it that way:

**A remote image is a silent outbound request.** Every viewer's browser fetches
it on render — no click, nothing visible to delete. So any host named in a
pasted document learns who opened it and when. A 1×1 transparent pixel is the
standard shape, and it reaches your documents through an ordinary paste from any
page.

The industry answer is to proxy the image through your own servers, as Gmail
does. This editor has no backend, so it offers the next best thing: you name the
hosts you already trust.

### Naming the hosts you trust

```html
<ui-rich-text-editor
  [allowedImageHosts]="['cdn.acme.com', '*.assets.acme.com']" />
```

Entries match the **parsed hostname**, exactly and case-insensitively. `*.`
matches subdomains by label — `*.assets.acme.com` covers `img.assets.acme.com`
but never `img.assets.acme.com.evil.com`. List the apex separately if you want
it too.

Write an entry however you write hosts: `https://cdn.acme.com/`,
`cdn.acme.com:8443`, `CDN.Acme.com` and an internationalised name all reduce to
the same hostname before matching, so none of them silently matches nothing.

**CSS `url()` is stricter than `<img>`, deliberately.** The two defaults are
not the same:

| | No policy set | Hosts named |
|---|---|---|
| `<img src>` | loads from any `https` host | listed hosts only |
| CSS `url()` | refused outright | listed hosts only |
| any other CSS image function | refused outright | refused outright |

The last row is what makes the second one honest. `image-set()` takes a bare
string, so `background: image-set("https://t/p.png" 1x)` names no `url()` and
a browser fetches it anyway; `image()`, `cross-fade()`, `src()`, `element()` and
`paint()` are the same family. A style value may therefore call only functions
known not to fetch — colours, `var()`, `calc()` and friends, gradients — plus
`url()`, which the host check judges.

So a policy *narrows* what images may load, but it is what *permits* a
background to load at all. Once a list exists the two run the same host check
and agree.

The asymmetry is the point. An `<img>` is visible content the author placed —
a reader can see it and delete it. A CSS background beacon is invisible, so it
cannot be noticed or removed the same way. Relaxing the `url()` default to
match images would have opened that channel for every existing consumer on
upgrade, with no code change on their side.

Always permitted, whatever the policy:

- **`data:` URLs** — they carry their payload inline and cannot contact anyone.
  This is how a Word paste brings its images, so blocking them would break that.
- **Relative URLs** (`/logo.png`, `./a.png`) — same-origin by definition.

### What a blocked image looks like

It does not disappear. The `<img>` keeps its `alt` and its place in the
document, gains `data-blocked-src` with the original URL, and renders as a muted
frame with a caption. `src` is never set, so nothing is fetched.

Because the original URL is retained, adding the host to the allowlist later
**restores the image** — the block is reversible, not lossy.

The caption is translated. Override it when you know something the editor
cannot — who to ask, or why a host is not allowed:

```html
<ui-rich-text-editor
  [allowedImageHosts]="hosts"
  [blockedImageMessage]="'Blocked — ask #it-help to allow this CDN'" />
```

The message is inserted as text, never as markup.

### Knowing what was blocked

`imageBlocked` fires once per remote image or CSS background the policy
refused, so a placeholder never appears without a record of why:

```html
<ui-rich-text-editor [allowedImageHosts]="hosts" (imageBlocked)="onBlocked($event)" />
```

```ts
onBlocked(e: ResourcePolicyDecision): void {
  // { url, host, kind: 'image' | 'background' }
  console.warn(`blocked ${e.kind} from ${e.host}`);
}
```

Nothing fires without a policy, because nothing is blocked. In dev mode each
block is also logged to the console.

### What this does not do

An allowlist narrows exposure to parties you have **named**. It does not remove
it: a trusted host can still identify the reader through the URL itself, e.g.
`https://cdn.acme.com/logo.png?viewer=bob`. Treat it as choosing who may see
your readers, not as preventing anyone from seeing them.

It is also **not** the XSS boundary. `javascript:`, `vbscript:`,
`data:text/html`, mislabelled SVG payloads and off-origin authority tricks are
refused by the sanitizer regardless of any allowlist, and always were. The host
policy only narrows what survives that.

Links have their own allowlist. An `href` keeps the web's schemes (`http`,
`https`, `mailto`, `tel`, `sms`, `ftp`, …) plus well-known application schemes
such as `slack`, `msteams`, `skype`, `zoommtg`, `whatsapp`, `tg`, `geo`, `webcal`,
`xmpp` and `sip`; the full list is exported as `DEFAULT_LINK_SCHEMES`. An
intranet with its own handler adds it on the editor and the view:

```html
<ui-rich-text-editor [allowedLinkSchemes]="['acme-crm']" />
<ui-rich-text-view   [allowedLinkSchemes]="['acme-crm']" [value]="doc" />
```

Schemes that run script or reach the machine (`javascript`, `data`, `file`, …)
are refused even if listed. A protocol-relative `//host/x` is kept, stored as
the explicit absolute URL it resolves to, so a reader can always see where a
link goes.

## Rendering published content — `ui-rich-text-view`

Showing what someone authored does not need an editor. `ui-rich-text-view`
renders the same string through the same sanitizer and the same markdown
parser, with the editor's exact typography:

```html
<!-- The same model, authored on the left and rendered on the right -->
<ui-rich-text-editor mode="html" [(ngModel)]="doc" />
<ui-rich-text-view  mode="html" [value]="doc" />

<!-- Markdown is the default, as it is for the editor -->
<ui-rich-text-view [value]="readme" />

<!-- Published content on a page with no editor at all -->
<ui-rich-text-view mode="html" [value]="post.html" size="lg" dir="rtl" class="px-4" />
```

| Input | Default | Notes |
|---|---|---|
| `value` | `''` | The document. The string the editor emits. |
| `mode` | `'markdown'` | `'markdown'` or `'html'`, matching the editor. |
| `size` | `'default'` | `'sm'` / `'lg'` apply the editor's text sizes. |
| `dir` | unset | Unset inherits the page direction. |
| `class` | `''` | Merged onto the content element. |
| `allowedImageHosts` | `[]` | Hosts images and backgrounds may load from. Empty means no policy. |
| `linkSchemes` | `[]` | Link schemes allowed on top of the built-in list. |
| `blockedImageMessage` | unset | Overrides the blocked-image caption. |
| `locale` | unset | Locale for the caption; falls through to the app-wide `UI_LOCALE_ID`. |

The view has the same `(imageBlocked)` output as the editor. It is the
surface readers see, so it is where a block matters most.

### The policy does not travel with the document

Set it here too. A policy on the **editor** governs what an author can insert;
it is not stored in the string they save. The tracking pixel fires when content
is **rendered**, and this component is what your readers see — so a view with no
policy loads every remote host the document names, whatever the editor allowed:

```html
<ui-rich-text-view [value]="post.body"
                   [allowedImageHosts]="['cdn.acme.com']" />
```

Everything above applies unchanged: same matching, same `data:`/relative
exemptions, same reversible `data-blocked-src` placeholder.

For a page rendering many views under one policy, put it on a wrapper rather
than repeating it and eventually missing one. Editors beneath the wrapper take
it the same way:

```html
<div [uiRichTextAllow]="{ imageHosts: ['cdn.acme.com', '*.assets.acme.com'], linkSchemes: ['acme-crm'] }">
  @for (post of posts; track post.id) {
    <ui-rich-text-view [value]="post.body" />
  }
</div>
```

A view or editor that sets its own `allowedImageHosts` or `linkSchemes` keeps that
list whole; the wrapper's is **never merged** in, so a strict view cannot be
widened by a looser ancestor.

It installs with `add rich-text-view`, which pulls in the editor base — the
sanitizer and the markdown parser are shared.

Task-list checkboxes are the one thing that behaves differently from the
editor: they render the state they were authored with, but they are frozen —
out of the tab order, and clicking one will not toggle it.

The typography both components share is exported as `RICH_TEXT_PROSE_CLASSES`,
if you are restyling. Note that these are ordinary Tailwind utilities, not
`@tailwindcss/typography` — the `prose` classes the editor used to carry were
no-ops, and are gone.

### Actions on a rendered page

The actions addon's runtime works on any container, so putting
`[uiRichTextActions]` on the view delivers click and hover actions for the
content inside it — with no editor on the page:

```html
<ui-rich-text-view
  mode="html"
  [value]="post.html"
  [uiRichTextActions]="{ 'open-pricing': openPricing }" />
```

**Placement matters.** The directive registers the sanitizer rules that keep
`data-action-*` attributes alive, and it does so in its constructor, before
children render. Put it on the view itself or on an ancestor in the same
template. A directive attached dynamically, after the content has already been
sanitized once, is too late and the attributes will already have been stripped.

## The addon model

An addon is a **standalone directive whose selector targets the editor
element**, e.g. `selector: 'ui-rich-text-editor[uiRteEmoji]'`. Putting the
attribute on the tag instantiates the directive in the editor's own injector,
so `inject(RichTextEditorAddonHost)` reaches *that* editor instance. There is
no module, no provider and no global registry: an addon affects exactly the
editors whose elements carry its attribute.

The dependency direction is one-way — **addons import the base, the base never
imports an addon.** That is what keeps the base install at 12 files.

The thirteen shipped addons are `actions`, `ai`, `colors`, `emoji`,
`file-import`, `history`, `images`, `links`, `mentions`, `outline`,
`slash-commands`, `tables` and `typography`; `full` is the generated composite
of all thirteen.

### A consumer-written addon is not a registry entry

Your own addon lives in **your app**, not in `packages/components`. It is not
installed by the CLI, does not appear in `why`, and is never touched by
`update`. The registry only knows about the addons this library ships.

## Writing your own addon

The whole contract in one file — inject the host, register a toolbar slot in
an `effect`, hand the teardown to `onCleanup`, and mutate the document only
through a host seam so the edit records history like any other:

```ts
import { Directive, effect, inject, input } from '@angular/core';
import { RichTextEditorAddonHost } from '@/components/ui/rich-text-editor';

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;

/**
 * Minimal addon: one toolbar button that inserts today's date at the caret.
 * Attach with `<ui-rich-text-editor uiRteInsertDate />`.
 *
 * This is the worked example from `docs/rich-text-editor.md` — the whole
 * extension contract in one file: inject the host, register a toolbar slot in
 * an `effect`, return the teardown through `onCleanup`, and mutate the document
 * only through a host seam so the edit records history like any other.
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
        tooltip: "Insert today's date",
        order: this.uiRteInsertDateOrder(),
        isEnabled: () => !this.host.readonly() && !this.host.isDisabled(),
        onClick: () => this.host.insertTextAtCaret(
          new Intl.DateTimeFormat(this.uiRteInsertDateLocale()).format(new Date()),
        ),
      }));
    });
  }
}
```

```html
<ui-rich-text-editor uiRteInsertDate [(ngModel)]="doc" />
```

Three rules make those ~40 lines correct:

1. **Register inside an `effect`, tear down through `onCleanup`.** The slot's
   `order` and any other input is a signal read, so the effect re-registers
   when one changes and the previous registration is removed first. Without
   `onCleanup` the slot outlives the directive.
2. **Predicates, not snapshots.** `isEnabled` / `isActive` are called on every
   change-detection pass and are expected to be signal reads, which is what
   makes them reactive. Keep them cheap; never do work in them.
3. **Mutate through a host seam.** `insertTextAtCaret`, `insertHtmlAtCaret`,
   `mutateContent`, `wrapSelection` and `applyInlineStyle` all go through the
   editor, so the change lands in the model, emits the outputs and records a
   history entry. Writing to `contentRoot` directly does none of that.

A live version of this directive runs on the **addons demo page** under
"Write your own addon".

## The host contract

`RichTextEditorAddonHost` is the abstract class the editor provides. Injecting
it is the entire supported surface — 39 members, grouped:

### Toolbar and commands

| Member | Purpose |
| --- | --- |
| `toolbarSlots: AddonSlotRegistry<RichTextToolbarSlot>` | This editor's toolbar slots. `register(slot)` returns a teardown. |
| `commands: RichTextCommandRegistry` | This editor's slash-command registry. |
| `globalCommands: RichTextCommandRegistry` | The app-wide registry; instance commands win on id collisions. |
| `builtinCommands: Signal<readonly RichTextSlashCommand[]>` | The slash commands the base itself contributes. |
| `executeToolbarCommandOnBlock(command, anchorBlock)` | Run a built-in toolbar command against a specific block. |
| `compact: Signal<boolean>` | Whether the hosting toolbar renders compact (floating). |

### Selection and mutation

| Member | Purpose |
| --- | --- |
| `selection(): RichTextSelectionSnapshot` | Reactive snapshot of the caret / selection. |
| `saveSelection()` / `restoreSelection()` | Park the selection across an overlay that steals focus. |
| `mutateContent(mutate)` | Mutate the document root inside one history + emit cycle. |
| `wrapSelection(build)` | Wrap the current selection in elements built by `build`. |
| `insertTextAtCaret(text)` | Insert plain text at the caret. |
| `insertHtmlAtCaret(html)` | Insert sanitized HTML at the caret. |
| `insertBlockAtCaret(html)` | Insert sanitized block markup (a table, a rule) after the caret's line, or in the place of an empty one, with the caret in its first cell or paragraph. |
| `insertTextFromOverlay(text)` | Insert from an overlay that took focus (restores the selection first). |
| `applyInlineStyle(style)` | Apply an inline style to the selection. |
| `selectionInlineStyle: Signal<RichTextSelectionInlineStyle>` | The inline style in force at the caret. |
| `commitContent()` | Flush the current DOM into the model and emit. |
| `contentRoot: HTMLElement` | The contenteditable element. Read it; mutate through the seams above. |
| `remainingLength()` | Characters the document can still take (`Infinity` when no `maxLength`, negative when already over), in the same grapheme units the counter shows. `mutateContent` bypasses the base's own limit checks, so ask before inserting anything sizeable. |
| `setActiveSuggestionPopup(popup)` | Announce an open suggestion list on the editable (`aria-expanded`/`aria-controls`/`aria-activedescendant`), or `null` to clear. Focus stays in the editable while a mention or slash menu is open, so the editable is what a screen reader reads. |
| `isDisabled: Signal<boolean>` / `readonly: Signal<boolean>` | Editor state for `isEnabled` predicates. Effective: `[disabled]` OR `control.disable()`. |
| `disabled: Signal<boolean>` | The `[disabled]` input alone. Guard on `isDisabled`, or your addon stays live under `control.disable()`. |

### The nine `register*` hooks

Each returns a teardown. Call them from an `effect` with `onCleanup`, exactly
like `toolbarSlots.register`.

| Hook | Fires for | Return `true` to |
| --- | --- | --- |
| `registerKeydownInterceptor(interceptor)` | every `keydown` on the editable | swallow the key |
| `registerPasteInterceptor(interceptor)` | every paste | take over the paste |
| `registerDropInterceptor(interceptor)` | every drop | take over the drop |
| `registerDropZonePredicate(predicate)` | a dragover | claim the drag as yours |
| `registerImageFileHandler(handler)` | an image file arriving by paste or drop | — (a handler, not a predicate) |
| `registerInputObserver(observer)` | text + caret offset after each input | — (an observer) |
| `registerLinkEditor(open)` | — | supply the link-editing UI the base delegates to |
| `registerShortcutAction(actionId, run, when?)` | a bound shortcut firing | — (an action) |
| `registerExclusivePopover(close)` | — | join the toolbar's single-open-panel group; call `notifyOpened()` when your panel opens and it closes every other one |

### Image routing

| Member | Purpose |
| --- | --- |
| `hasImageFileHandler: Signal<boolean>` | Whether any addon claimed image files. |
| `insertImageFile(file)` | Route a file to the registered handler; `false` when there is none. |
| `showLinkDialog(caretHint?)` | Ask the registered link editor to open. Inert without one. |

### History

| Member | Purpose |
| --- | --- |
| `historyVersion: Signal<number>` | Bumps on every history change — cheap to watch. |
| `historyEntries(): readonly RichTextHistoryEntrySnapshot[]` | The stack, for a revision UI. |
| `currentHistoryIndex(): number` | Where the stack currently sits. |
| `reconstructHistoryEntry(index)` | The `{ html, markdown }` of one entry. |
| `restoreHistoryEntry(index)` | Move the document to that entry. |
| `flushPendingHistoryPush()` | Land the debounced push before reading the stack. |

### Overlay

| Member | Purpose |
| --- | --- |
| `overlayAnchor: HTMLElement` | The element to position popovers against. |

## Toolbar slots

`RichTextToolbarSlot` renders either a **button** or a **component**:

```ts
interface RichTextToolbarSlot {
  readonly id: string;              // stable; also the `data-addon-slot` value
  readonly icon?: string;           // inline SVG — button slot
  readonly tooltip?: string;
  readonly order?: number;          // lower first; default appends
  readonly isEnabled?: () => boolean;
  readonly isActive?: () => boolean;
  readonly onClick?: (event: Event) => void;
  readonly component?: Type<unknown>;   // component slot; wins over the button fields
  readonly injector?: Injector;
}
```

A **button slot** (`icon` + `onClick`) is right for a one-shot action. A
**component slot** (`component`) is right when the button opens a popover or
owns state; it can `inject(RichTextToolbarViewContext, { optional: true })` to
read `compact` and match the floating toolbar's sizing.

Addon slots render after the built-in items, sorted by `order`, with the same
classes as a built-in button — including the `bg-accent text-accent-foreground`
active styling when `isActive()` returns true.

Built-in buttons are a separate, closed thing: they live in `TOOLBAR_BUTTONS`,
a `Record<ToolbarButtonItem, ToolbarButton>` keyed by the `ToolbarItem` union,
so adding one is a union member plus a row plus a case in the editor's
dispatch, and a missing row is a compile error. You do not need this unless you
are adding a *built-in* button to your own copy of the library.

## Locale cascade

An addon's strings resolve in this order:

1. its own `[uiRte<Name>Locale]` input, when set;
2. otherwise the editor's `[locale]` — a key, or the `code` of a locale object;
3. otherwise the app-wide `UI_LOCALE_ID` (`provideUiLocale('fr')`);
4. otherwise `'en'`.

So one binding localizes everything:

```html
<!-- The editor and all fourteen addons, in Hebrew, RTL -->
<ui-rich-text-editor mode="markdown" locale="he" uiRteFull />

<!-- …except this addon, which is pinned to English -->
<ui-rich-text-editor locale="he" uiRteFull uiRteEmojiLocale="en" />
```

Addon authors get this for free by using `createLocaleBindings` — there is
nothing to wire. The editor re-broadcasts its `locale` as `UI_LOCALE_ID`
through `provideComponentLocale` in its `providers` (not `viewProviders`,
because addon directives sit on the editor *element*), and
`createLocaleBindings` already checks the addon's own input before that token.

## Testing your addon

Mount the editor with your directive on the tag and drive the real thing:

```ts
@Component({
  imports: [RichTextEditorComponent, MyAddonDirective],
  template: `<ui-rich-text-editor mode="html" uiMyAddon />`,
})
class HostCmp {}
```

Then assert against the **slot registry**, not only the DOM:
`editor.toolbarSlots.slots()` is where registration and teardown are
observable. A destroyed fixture keeps its detached DOM, so a `querySelector`
would still find a button whose slot was correctly removed.
`demo/src/app/demos/inputs/rich-text-insert-date.directive.spec.ts` is the
worked example.

## What is *not* an extension point

- **The base barrel.** It never re-exports an addon, by design and by a
  `sync-registry` hard error.
- **`contentRoot` as a write target.** Reading it is fine; writing to it
  bypasses the model, the outputs and history.
- **Internal services.** `RichTextSanitizerService`, `RichTextMarkdownService`
  and `RichTextPasteNormalizerService` are exported so the component compiles
  in your project, not as a stable addon API.
