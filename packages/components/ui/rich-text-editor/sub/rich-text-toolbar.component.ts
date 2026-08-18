import {
  Component,
  ChangeDetectionStrategy,
  Injector,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgComponentOutlet } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { cn } from '../../../lib/utils';
import { SeparatorComponent } from '../../separator';
import { RichTextLocale, RICH_TEXT_LOCALES } from '../rich-text-locales';
import { RichTextCustomToolbarItem } from '../rich-text-editor.component';
import { RichTextToolbarViewContext, type RichTextToolbarSlot } from '../rich-text-editor.host';

/**
 * Identifier for a toolbar button or visual separator. Pass an array of these
 * to the `[toolbarItems]` input to customise which buttons appear and in what order.
 *
 * **Formatting:**
 * - `'bold'` / `'italic'` / `'underline'` / `'strikethrough'` — Inline formatting toggles.
 *
 * **Block type:**
 * - `'paragraph'` — Reset to normal paragraph.
 * - `'heading1'` / `'heading2'` / `'heading3'` — Heading levels.
 * - `'bulletList'` / `'orderedList'` — List toggles.
 * - `'blockquote'` — Block quote toggle.
 *
 * **Code:**
 * - `'code'` — Inline code.
 * - `'codeBlock'` — Fenced code block.
 *
 * **Insert:**
 * - `'link'` — Opens a link insertion dialog.
 *
 * **Styling:**
 * - `'alignLeft'` / `'alignCenter'` / `'alignRight'` — Text alignment.
 *
 * **History:**
 * - `'undo'` / `'redo'` — Undo/redo actions.
 *
 * **Utility:**
 * - `'clear'` — Remove all formatting from selected text.
 * - `'separator'` — Visual divider between button groups (renders as a line, not a button).
 *
 * @example
 * ```html
 * <!-- Minimal toolbar with just basic formatting -->
 * <ui-rich-text-editor
 *   [toolbarItems]="['bold', 'italic', 'separator', 'link']"
 * />
 * ```
 */
export type ToolbarItem =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'code'
  | 'codeBlock'
  | 'separator'
  | 'undo'
  | 'redo'
  | 'clear'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'indent'
  | 'outdent'
  | 'taskList'
  | 'horizontalRule';

interface ToolbarButton {
  id: ToolbarItem;
  label: string;
  localeKey: keyof RichTextLocale['toolbar'];
  shortcut?: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { id: 'bold', label: 'Bold', localeKey: 'bold', shortcut: 'Ctrl+B' },
  { id: 'italic', label: 'Italic', localeKey: 'italic', shortcut: 'Ctrl+I' },
  { id: 'underline', label: 'Underline', localeKey: 'underline', shortcut: 'Ctrl+U' },
  { id: 'strikethrough', label: 'Strikethrough', localeKey: 'strikethrough' },
  { id: 'paragraph', label: 'Normal Text', localeKey: 'paragraph' },
  { id: 'heading1', label: 'Heading 1', localeKey: 'heading1' },
  { id: 'heading2', label: 'Heading 2', localeKey: 'heading2' },
  { id: 'heading3', label: 'Heading 3', localeKey: 'heading3' },
  { id: 'bulletList', label: 'Bullet List', localeKey: 'bulletList' },
  { id: 'orderedList', label: 'Numbered List', localeKey: 'orderedList' },
  { id: 'blockquote', label: 'Blockquote', localeKey: 'blockquote' },
  { id: 'code', label: 'Inline Code', localeKey: 'inlineCode' },
  { id: 'codeBlock', label: 'Code Block', localeKey: 'codeBlock' },
  { id: 'undo', label: 'Undo', localeKey: 'undo', shortcut: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', localeKey: 'redo', shortcut: 'Ctrl+Shift+Z' },
  { id: 'clear', label: 'Clear Formatting', localeKey: 'clearFormatting' },
  { id: 'alignLeft', label: 'Align Left', localeKey: 'alignLeft' },
  { id: 'alignCenter', label: 'Align Center', localeKey: 'alignCenter' },
  { id: 'alignRight', label: 'Align Right', localeKey: 'alignRight' },
  { id: 'indent', label: 'Increase Indent', localeKey: 'indent' },
  { id: 'outdent', label: 'Decrease Indent', localeKey: 'outdent' },
  { id: 'taskList', label: 'Task List', localeKey: 'taskList' },
  { id: 'horizontalRule', label: 'Horizontal Rule', localeKey: 'horizontalRule' },
];

const ICONS: Record<string, string> = {
  bold: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>`,
  italic: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`,
  underline: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>`,
  strikethrough: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>`,
  heading1: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>`,
  heading2: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>`,
  heading3: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>`,
  bulletList: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
  orderedList: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`,
  blockquote: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4z"/></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  codeBlock: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 9.5 8 12l2 2.5"/><path d="m14 9.5 2 2.5-2 2.5"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`,
  undo: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`,
  redo: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`,
  clear: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`,
  paragraph: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>`,
  alignLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>`,
  alignCenter: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>`,
  alignRight: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>`,
  indent: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 7 12 3 16"/><line x1="21" x2="11" y1="12" y2="12"/><line x1="21" x2="11" y1="6" y2="6"/><line x1="21" x2="11" y1="18" y2="18"/></svg>`,
  outdent: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 3 12 7 16"/><line x1="21" x2="11" y1="12" y2="12"/><line x1="21" x2="11" y1="6" y2="6"/><line x1="21" x2="11" y1="18" y2="18"/></svg>`,
  taskList: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>`,
  horizontalRule: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`,
};

@Component({
  selector: 'ui-rich-text-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SeparatorComponent,
    FormsModule,
    NgComponentOutlet,
  ],
  templateUrl: './rich-text-toolbar.component.html',
  styleUrl: './rich-text-toolbar.component.css',
  host: {
    class: 'block',
  },
})
export class RichTextToolbarComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * The built-in buttons to render, in order. `'separator'` entries render a
   * vertical rule instead of a button, so the same array controls both the
   * buttons and their grouping. The editor forwards its `[toolbarItems]` here
   * for the docked toolbar; the floating toolbar hardcodes a short list.
   */
  items = input<ToolbarItem[]>([
    'bold', 'italic', 'underline',
    'separator',
    'heading1', 'heading2',
    'separator',
    'bulletList', 'orderedList',
  ]);

  /**
   * Format names currently active at the caret (`'bold'`, `'italic'`,
   * `'underline'`, `'strikethrough'`, `'code'`, `'taskList'`), used to render
   * buttons pressed. Only those names are honoured — see {@link isActive}.
   * Also passed to each custom item's `isActive` predicate.
   */
  activeFormats = input<Set<string>>(new Set());

  /**
   * Compact rendering for the floating/bubble toolbar: tighter button padding,
   * no border or background on the container. The editor sets this only on the
   * floating instance. Also published to component slots through
   * {@link RichTextToolbarViewContext} so they can size themselves to match.
   */
  compact = input<boolean>(false);

  /** Extra classes merged onto the toolbar container (after the compact rules, so they win). */
  class = input<string>('');

  /** Disables every button and suppresses the click outputs. See {@link interactionDisabled}. */
  disabled = input<boolean>(false);

  /**
   * Same effect as {@link disabled} on this component — buttons render disabled
   * and no output fires. The editor normally hides the toolbar entirely in
   * read-only mode, so this is the belt-and-braces guard for direct use.
   */
  readonly = input<boolean>(false);

  /**
   * Locale supplying the button tooltips and the toolbar's `aria-label`. Its
   * `rtl` flag also mirrors the alignment/indent icons and tooltips, so
   * `'alignLeft'` shows the right-aligned glyph in an RTL locale.
   */
  locale = input<RichTextLocale>(RICH_TEXT_LOCALES['en']);

  /**
   * Emits the clicked {@link ToolbarItem} id. The toolbar owns no editor state:
   * the host is responsible for executing the command and feeding the result
   * back through {@link activeFormats}.
   */
  formatCommand = output<string>();

  /**
   * Consumer-defined buttons rendered after the built-in {@link items} and
   * before the addon slots. Each supplies its own inline SVG `icon`, which is
   * trusted as-is — see {@link getSafeIcon}.
   */
  customItems = input<RichTextCustomToolbarItem[]>([]);

  /** Emits the `id` of the clicked {@link customItems} entry. */
  customItemClick = output<string>();

  /**
   * Addon-contributed slots, normally passed straight from the editor's
   * `AddonSlotRegistry`. Rendered last, after built-ins and custom items, and
   * sorted by {@link orderedAddonSlots}. A slot with a `component` is rendered
   * through a component outlet; one with an `icon` renders as a button.
   */
  addonSlots = input<readonly RichTextToolbarSlot[]>([]);

  /**
   * Emits when an addon *button* slot is clicked, with the slot and the raw
   * DOM event (addons position popovers off the event target). Component slots
   * handle their own clicks and never emit this.
   */
  addonSlotClick = output<{ slot: RichTextToolbarSlot; event: Event }>();

  readonly orderedAddonSlots = computed(() =>
    [...this.addonSlots()].sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000)));

  private readonly injector = inject(Injector);
  private readonly viewContext: RichTextToolbarViewContext = {
    compact: this.compact,
  };
  /**
   * Per-slot injectors exposing the toolbar view context to component slots.
   * Cached by slot object identity (a registration never mutates), so other
   * addons registering/unregistering can't recreate this slot's component.
   */
  private readonly slotInjectorCache = new WeakMap<RichTextToolbarSlot, Injector>();

  /**
   * The injector used to render a component slot: the slot's own `injector`
   * (or the toolbar's) plus a {@link RichTextToolbarViewContext} provider.
   * Memoized per slot object, so re-rendering the `@for` over the slots never
   * destroys and recreates a slot component that did not itself change.
   */
  slotInjector(slot: RichTextToolbarSlot): Injector {
    let slotInjector = this.slotInjectorCache.get(slot);
    if (!slotInjector) {
      slotInjector = Injector.create({
        providers: [{ provide: RichTextToolbarViewContext, useValue: this.viewContext }],
        parent: slot.injector ?? this.injector,
      });
      this.slotInjectorCache.set(slot, slotInjector);
    }
    return slotInjector;
  }

  interactionDisabled = computed(() => this.disabled() || this.readonly());

  containerClasses = computed(() =>
    cn(
      'flex items-center flex-wrap gap-0.5 p-1 border-b bg-muted/30',
      'max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:scrollbar-hide',
      this.compact() && 'p-0.5 border-none bg-transparent',
      this.class()
    )
  );

  /**
   * Classes for a built-in button, including the pressed styling when
   * {@link isActive} reports the item active and the compact padding. Called
   * from the template for every item on each change detection pass.
   */
  buttonClasses(item: ToolbarItem): string {
    const active = this.isActive(item);
    return cn(
      'inline-flex items-center justify-center rounded-md p-1.5 text-sm font-medium transition-colors',
      'hover:bg-accent hover:text-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      active && 'bg-accent text-accent-foreground',
      this.compact() && 'p-1'
    );
  }

  /**
   * Classes for an addon button slot — the same look as a built-in button, but
   * the pressed state comes from the slot's own {@link addonSlotActive}
   * predicate rather than from {@link activeFormats}.
   */
  addonButtonClasses(slot: RichTextToolbarSlot): string {
    return cn(
      'inline-flex items-center justify-center rounded-md p-1.5 text-sm font-medium transition-colors',
      'hover:bg-accent hover:text-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      this.addonSlotActive(slot) && 'bg-accent text-accent-foreground',
      this.compact() && 'p-1'
    );
  }

  /**
   * Whether an addon button slot is enabled — the slot's optional `isEnabled`
   * predicate, defaulting to `true` when it omits one. Invoked from the
   * template on every change detection pass, so the predicate must stay cheap
   * (it is expected to be a signal read, which also makes it reactive).
   */
  addonSlotEnabled(slot: RichTextToolbarSlot): boolean {
    return slot.isEnabled ? slot.isEnabled() : true;
  }

  /**
   * Whether an addon button slot renders pressed — the slot's optional
   * `isActive` predicate, defaulting to `false`. Like {@link addonSlotEnabled}
   * it runs on every change detection pass and must stay cheap.
   */
  addonSlotActive(slot: RichTextToolbarSlot): boolean {
    return slot.isActive ? slot.isActive() : false;
  }

  /**
   * Whether a built-in button renders pressed (`aria-pressed`/`data-state`).
   * Only the inline toggles the host reports in {@link activeFormats} —
   * bold, italic, underline, strikethrough, code, taskList — can be active;
   * block, alignment, history and utility items always report `false`.
   */
  isActive(item: ToolbarItem): boolean {
    const formatMap: Record<string, string> = {
      bold: 'bold',
      italic: 'italic',
      underline: 'underline',
      strikethrough: 'strikethrough',
      code: 'code',
      taskList: 'taskList',
    };
    const format = formatMap[item];
    return format ? this.activeFormats().has(format) : false;
  }

  /**
   * The built-in glyph for an item, as `SafeHtml` for `[innerHTML]`. Icons come
   * from this file's own literal table (never from consumer input), so they are
   * trusted directly. Under an RTL {@link locale} the alignment and indent
   * glyphs are swapped so the icon points the way the command actually moves
   * the text; the command emitted is unchanged. Unknown items render nothing.
   */
  getIcon(item: ToolbarItem): SafeHtml {
    let key = item as string;
    if (this.locale().rtl) {
      if (item === 'alignLeft') key = 'alignRight';
      else if (item === 'alignRight') key = 'alignLeft';
      else if (item === 'indent') key = 'outdent';
      else if (item === 'outdent') key = 'indent';
    }
    const svg = ICONS[key] ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * The button's `title` — the localized label plus its keyboard shortcut in
   * parentheses where one exists. Mirrors the RTL label swap {@link getIcon}
   * does for alignment (indent/outdent keep their own labels). Falls back to
   * the raw item id for an item with no entry in the button table.
   */
  getTooltip(item: ToolbarItem): string {
    let lookupItem = item;
    if (this.locale().rtl) {
      if (item === 'alignLeft') lookupItem = 'alignRight';
      else if (item === 'alignRight') lookupItem = 'alignLeft';
    }
    const button = TOOLBAR_BUTTONS.find(b => b.id === lookupItem);
    if (!button) return item;
    const l = this.locale();
    const label = l ? l.toolbar[button.localeKey] : button.label;
    return button.shortcut ? `${label} (${button.shortcut})` : label;
  }

  /**
   * Emits {@link formatCommand} for a built-in button, unless
   * {@link interactionDisabled}. The buttons are already `[disabled]`; this
   * guard also covers a programmatic call.
   */
  onFormatClick(item: ToolbarItem): void {
    if (this.interactionDisabled()) return;
    this.formatCommand.emit(item);
  }

  /**
   * Emits {@link customItemClick} with the item's `id`, unless
   * {@link interactionDisabled}. The counterpart of {@link onFormatClick} for
   * {@link customItems}.
   */
  onCustomItemClick(id: string): void {
    if (this.interactionDisabled()) return;
    this.customItemClick.emit(id);
  }

  /**
   * Classes for a {@link customItems} button. The pressed state comes from the
   * item's optional `isActive(formats)` predicate, called with the current
   * {@link activeFormats} on every change detection pass, so keep it cheap.
   */
  customButtonClasses(item: RichTextCustomToolbarItem): string {
    const active = item.isActive ? item.isActive(this.activeFormats()) : false;
    return cn(
      'inline-flex items-center justify-center rounded-md p-1.5 text-sm font-medium transition-colors',
      'hover:bg-accent hover:text-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      active && 'bg-accent text-accent-foreground',
      this.compact() && 'p-1'
    );
  }

  /**
   * Marks caller-supplied icon markup safe for `[innerHTML]`, used for both
   * {@link customItems} and addon button slots. This **bypasses** Angular's
   * sanitizer rather than cleaning the markup: the trust boundary is the
   * application, which controls the custom items and the addons it installs.
   * Never feed it markup that came from editor content or a remote source.
   */
  getSafeIcon(svgHtml: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgHtml);
  }
}
