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

## Markdown shortcuts

Typing a recognised Markdown marker turns it into real formatting the moment it
is complete. This is on by default — no import, no addon, no configuration.

| Type | Get |
| --- | --- |
| `# ` / `## ` / `### ` | Heading 1 / 2 / 3 |
| `- ` or `* ` | Bullet list |
| `1. ` (1-3 digits) | Numbered list |
| `> ` | Blockquote |
| `[] ` / `[x] ` | Task item, unchecked / checked |
| `---` | Horizontal rule |
| `` ``` `` then Space or Enter | Code block (`` ```ts `` sets the language) |
| `**bold**` | `<strong>` |
| `*italic*` | `<em>` |
| `` `code` `` | Inline `<code>` |

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
caret's block and sets it.

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

It installs with `add rich-text-view`, which pulls the editor base for the two
services. Task-list checkboxes render the authored state but are frozen: out of
the tab order, and a click will not toggle them.

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
| `insertTextFromOverlay(text)` | Insert from an overlay that took focus (restores the selection first). |
| `applyInlineStyle(style)` | Apply an inline style to the selection. |
| `selectionInlineStyle: Signal<RichTextSelectionInlineStyle>` | The inline style in force at the caret. |
| `commitContent()` | Flush the current DOM into the model and emit. |
| `contentRoot: HTMLElement` | The contenteditable element. Read it; mutate through the seams above. |
| `remainingLength()` | Characters the document can still take (`Infinity` when no `maxLength`), in the same grapheme units the counter shows. `mutateContent` bypasses the base's own limit checks, so ask before inserting anything sizeable. |
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

- **`[customToolbarItems]` / `(customToolbarAction)` are gone.** They were a
  third way to add a toolbar button, and the weakest: their inserts updated the
  model but recorded no history entry, so undo would not step over them. Use a
  toolbar slot. `RichTextCustomToolbarItem` and `RichTextEditorRef` went with
  them; `npx @gilav21/shadcn-angular update rich-text-editor` prints the
  mapping.
- **The base barrel.** It never re-exports an addon, by design and by a
  `sync-registry` hard error.
- **`contentRoot` as a write target.** Reading it is fine; writing to it
  bypasses the model, the outputs and history.
- **Internal services.** `RichTextSanitizerService`, `RichTextMarkdownService`
  and `RichTextPasteNormalizerService` are exported so the component compiles
  in your project, not as a stable addon API.
