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
- [The addon model](#the-addon-model)
- [Writing your own addon](#writing-your-own-addon)
- [The host contract](#the-host-contract)
- [Toolbar slots](#toolbar-slots)
- [Localizing an addon](#localizing-an-addon)
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
| `isDisabled: Signal<boolean>` / `readonly: Signal<boolean>` | Editor state for `isEnabled` predicates. Effective: `[disabled]` OR `control.disable()`. |
| `disabled: Signal<boolean>` | The `[disabled]` input alone. Guard on `isDisabled`, or your addon stays live under `control.disable()`. |

### The eight `register*` hooks

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

## Localizing an addon

Addons resolve their own strings rather than reading the editor's `[locale]`,
so an addon can ship languages the base has not got. Use
`createLocaleBindings` from `lib/i18n`:

```ts
private readonly t = createLocaleBindings(
  this.uiMyAddonLocale,     // the addon's own [uiRte<Name>Locale] input
  MY_ADDON_LOCALES,         // Record<string, MyAddonLocale>
  MY_ADDON_LOCALES['en'],   // fallback
);
```

It falls back to the global `UI_LOCALE_ID` when the input is unset. Every
shipped addon follows this pattern — `addons/emoji` is the smallest example.

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
