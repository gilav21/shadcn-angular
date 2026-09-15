import {
  Component,
  ChangeDetectionStrategy,
  Injector,
  input,
  output,
  computed,
  inject,
  signal,
  ElementRef,
  type AfterViewInit,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgComponentOutlet } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { cn } from '../../../lib/utils';
import { SeparatorComponent } from '../../separator';
import { RichTextLocale, RICH_TEXT_LOCALES } from '../rich-text-locales';
import { RichTextToolbarViewContext, type RichTextToolbarSlot } from '../rich-text-editor.host';

/**
 * Identifier for a toolbar button or visual separator. Pass an array of these
 * to the `[toolbarItems]` input to customise which buttons appear and in what order.
 *
 * **Formatting:**
 * - `'bold'` / `'italic'` / `'underline'` / `'strikethrough'` — Inline formatting toggles.
 *
 * **Block type:**
 * - `'textStyle'` — A compact select offering Normal text / Heading 1-3. It
 *   both reflects and sets the caret's block type, and is in the default
 *   toolbar in place of the four buttons below (which remain available to list
 *   explicitly).
 * - `'paragraph'` — Reset to normal paragraph.
 * - `'heading1'` / `'heading2'` / `'heading3'` — Heading levels.
 * - `'bulletList'` / `'orderedList'` — List toggles.
 * - `'blockquote'` — Block quote toggle.
 *
 * **Code:**
 * - `'code'` — Inline code.
 * - `'codeBlock'` — Fenced code block.
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
 *   [toolbarItems]="['bold', 'italic', 'separator', 'underline']"
 * />
 * ```
 */
export type ToolbarItem =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'textStyle'
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
  | 'horizontalRule'
  | 'find';

/** Every toolbar item that renders a button — `ToolbarItem` minus the visual `'separator'`. */
export type ToolbarButtonItem = Exclude<ToolbarItem, 'separator'>;

/** One built-in toolbar button: its glyph, its label, and how it is localized. */
export interface ToolbarButton {
  /** The {@link ToolbarItem} this row describes; always equal to its key. */
  readonly id: ToolbarButtonItem;
  /** English label, used only when no locale supplies one. */
  readonly label: string;
  /** Key into {@link RichTextLocale.toolbar} for the localized label. */
  readonly localeKey: keyof RichTextLocale['toolbar'];
  /** Inline SVG glyph, trusted as-is — a literal in this file, never consumer input. */
  readonly icon: string;
  /** Keyboard shortcut appended to the tooltip in parentheses, where one exists. */
  readonly shortcut?: string;
}

/**
 * The single table behind every built-in toolbar button: glyph, label, locale
 * key and shortcut in one row. Because it is a
 * `Record<ToolbarButtonItem, ToolbarButton>`, adding a member to
 * {@link ToolbarItem} without adding its row is a compile error rather than a
 * button that renders blank with its raw id as the tooltip.
 *
 * Execution is deliberately NOT in here: the toolbar emits
 * {@link RichTextToolbarComponent.formatCommand} and the editor decides what a
 * command does, so this data never owns editor behaviour.
 */
export const TOOLBAR_BUTTONS: Record<ToolbarButtonItem, ToolbarButton> = {
  bold: { id: 'bold', label: 'Bold', localeKey: 'bold', shortcut: 'Ctrl+B', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>` },
  italic: { id: 'italic', label: 'Italic', localeKey: 'italic', shortcut: 'Ctrl+I', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>` },
  underline: { id: 'underline', label: 'Underline', localeKey: 'underline', shortcut: 'Ctrl+U', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>` },
  strikethrough: { id: 'strikethrough', label: 'Strikethrough', localeKey: 'strikethrough', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>` },
  textStyle: { id: 'textStyle', label: 'Text style', localeKey: 'textStyle', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>` },
  paragraph: { id: 'paragraph', label: 'Normal Text', localeKey: 'paragraph', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>` },
  heading1: { id: 'heading1', label: 'Heading 1', localeKey: 'heading1', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>` },
  heading2: { id: 'heading2', label: 'Heading 2', localeKey: 'heading2', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>` },
  heading3: { id: 'heading3', label: 'Heading 3', localeKey: 'heading3', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>` },
  bulletList: { id: 'bulletList', label: 'Bullet List', localeKey: 'bulletList', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>` },
  orderedList: { id: 'orderedList', label: 'Numbered List', localeKey: 'orderedList', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>` },
  blockquote: { id: 'blockquote', label: 'Blockquote', localeKey: 'blockquote', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4z"/></svg>` },
  code: { id: 'code', label: 'Inline Code', localeKey: 'inlineCode', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>` },
  codeBlock: { id: 'codeBlock', label: 'Code Block', localeKey: 'codeBlock', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 9.5 8 12l2 2.5"/><path d="m14 9.5 2 2.5-2 2.5"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>` },
  undo: { id: 'undo', label: 'Undo', localeKey: 'undo', shortcut: 'Ctrl+Z', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>` },
  redo: { id: 'redo', label: 'Redo', localeKey: 'redo', shortcut: 'Ctrl+Shift+Z', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>` },
  clear: { id: 'clear', label: 'Clear Formatting', localeKey: 'clearFormatting', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>` },
  alignLeft: { id: 'alignLeft', label: 'Align Left', localeKey: 'alignLeft', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>` },
  alignCenter: { id: 'alignCenter', label: 'Align Center', localeKey: 'alignCenter', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>` },
  alignRight: { id: 'alignRight', label: 'Align Right', localeKey: 'alignRight', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>` },
  indent: { id: 'indent', label: 'Increase Indent', localeKey: 'indent', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 7 12 3 16"/><line x1="21" x2="11" y1="12" y2="12"/><line x1="21" x2="11" y1="6" y2="6"/><line x1="21" x2="11" y1="18" y2="18"/></svg>` },
  outdent: { id: 'outdent', label: 'Decrease Indent', localeKey: 'outdent', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 3 12 7 16"/><line x1="21" x2="11" y1="12" y2="12"/><line x1="21" x2="11" y1="6" y2="6"/><line x1="21" x2="11" y1="18" y2="18"/></svg>` },
  taskList: { id: 'taskList', label: 'Task List', localeKey: 'taskList', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>` },
  horizontalRule: { id: 'horizontalRule', label: 'Horizontal Rule', localeKey: 'horizontalRule', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>` },
  find: { id: 'find', label: 'Find and replace', localeKey: 'find', shortcut: 'Ctrl+F', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>` },
};

/**
 * The block types the Text style select offers, in the order it lists them.
 * Deliberately short: a native picker is the right control for a four-item
 * choice on a phone, which is the whole reason this replaces four buttons.
 * `blockquote` and `codeBlock` keep their own toggle buttons.
 */
export const TEXT_STYLE_OPTIONS = ['paragraph', 'heading1', 'heading2', 'heading3'] as const;

/** One block type offered by the Text style select. */
export type TextStyleOption = (typeof TEXT_STYLE_OPTIONS)[number];

/** Shared look of every toolbar button, built-in and addon slot alike. */
const BUTTON_BASE_CLASSES =
  'inline-flex items-center justify-center rounded-md p-1.5 text-sm font-medium transition-colors '
  + 'hover:bg-accent hover:text-accent-foreground '
  + 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring '
  + 'disabled:pointer-events-none disabled:opacity-50';

/** Added to {@link BUTTON_BASE_CLASSES} when a button renders pressed. */
const BUTTON_ACTIVE_CLASSES = 'bg-accent text-accent-foreground';

/**
 * Icon mirroring for an RTL locale: the alignment and indent glyphs point the
 * way the command actually moves the text, so both pairs swap. The emitted
 * command is unchanged.
 */
function mirrorIcon(item: ToolbarButtonItem): ToolbarButtonItem {
  switch (item) {
    case 'alignLeft': return 'alignRight';
    case 'alignRight': return 'alignLeft';
    case 'indent': return 'outdent';
    case 'outdent': return 'indent';
    default: return item;
  }
}

/**
 * Label mirroring for an RTL locale — alignment only. `indent` / `outdent`
 * keep their own labels because those name the direction the text moves
 * ("Increase Indent"), not a side of the page.
 */
function mirrorLabel(item: ToolbarButtonItem): ToolbarButtonItem {
  switch (item) {
    case 'alignLeft': return 'alignRight';
    case 'alignRight': return 'alignLeft';
    default: return item;
  }
}

/** A panel an addon button opens inside the toolbar's DOM: its own focus scope, not part of the roving order. */
const HOSTED_PANEL = '[data-slot="popover-content"], [data-slot="emoji-picker-content"]';

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
    '(keydown)': 'onToolbarKeydown($event)',
    '(focusin)': 'onToolbarFocusIn($event)',
  },
})
export class RichTextToolbarComponent implements AfterViewInit {
  /**
   * Every item that is a toggle — one that names a state the caret can be in,
   * and therefore renders pressed when {@link activeFormats} reports it. The
   * names match the host's `activeFormats` vocabulary exactly, which is what
   * lets {@link isActive} be a single `Set.has` with no mapping table.
   */
  private static readonly PRESSABLE = new Set<ToolbarButtonItem>([
    'bold', 'italic', 'underline', 'strikethrough', 'code', 'taskList',
    'bulletList', 'orderedList', 'paragraph', 'heading1', 'heading2', 'heading3',
    'blockquote', 'codeBlock', 'alignLeft', 'alignCenter', 'alignRight',
  ]);

  private readonly sanitizer = inject(DomSanitizer);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Index of the button that currently holds the toolbar's single tab stop.
   *
   * A toolbar is ONE stop in the page's tab order — WAI-ARIA's toolbar pattern
   * moves between its controls with the arrow keys instead. Without this every
   * button was tabbable, so reaching the editor's content meant pressing Tab
   * past all 25 of them.
   */
  private readonly rovingIndex = signal(0);

  /**
   * The built-in buttons to render, in order. `'separator'` entries render a
   * vertical rule instead of a button, so the same array controls both the
   * buttons and their grouping. The editor forwards its `[toolbarItems]` here
   * for the docked toolbar; the floating toolbar hardcodes a short list.
   */
  readonly items = input<ToolbarItem[]>([
    'bold', 'italic', 'underline',
    'separator',
    'heading1', 'heading2',
    'separator',
    'bulletList', 'orderedList',
  ]);

  /**
   * Format names currently active at the caret, used to render buttons
   * pressed. A name is honoured when it matches a toggle item — every inline
   * format, block type, list type and alignment; see {@link isActive}. Names
   * the host reports for other purposes (`'indent'`, which carries list-nesting
   * depth) are carried but never rendered as a pressed state.
   */
  readonly activeFormats = input<Set<string>>(new Set());

  /**
   * Compact rendering for the floating/bubble toolbar: tighter button padding,
   * no border or background on the container. The editor sets this only on the
   * floating instance. Also published to component slots through
   * {@link RichTextToolbarViewContext} so they can size themselves to match.
   */
  readonly compact = input<boolean>(false);

  /** Extra classes merged onto the toolbar container (after the compact rules, so they win). */
  readonly class = input<string>('');

  /** Disables every button and suppresses the click outputs. See {@link interactionDisabled}. */
  readonly disabled = input<boolean>(false);

  /**
   * Same effect as {@link disabled} on this component — buttons render disabled
   * and no output fires. The editor normally hides the toolbar entirely in
   * read-only mode, so this is the belt-and-braces guard for direct use.
   */
  readonly readonly = input<boolean>(false);

  /**
   * Whether the Text style select can change the caret's line. The editor sets
   * it false where a heading is refused, and the select is disabled there
   * rather than accepting a pick nothing would honour.
   */
  readonly textStyleAvailable = input<boolean>(true);

  /**
   * Locale supplying the button tooltips and the toolbar's `aria-label`. Its
   * `rtl` flag also mirrors the alignment/indent icons and tooltips, so
   * `'alignLeft'` shows the right-aligned glyph in an RTL locale.
   */
  readonly locale = input<RichTextLocale>(RICH_TEXT_LOCALES['en']);

  /**
   * Emits the clicked {@link ToolbarItem} id. The toolbar owns no editor state:
   * the host is responsible for executing the command and feeding the result
   * back through {@link activeFormats}.
   */
  readonly formatCommand = output<string>();

  /**
   * Addon-contributed slots, normally passed straight from the editor's
   * `AddonSlotRegistry`. Rendered last, after built-ins and custom items, and
   * sorted by {@link orderedAddonSlots}. A slot with a `component` is rendered
   * through a component outlet; one with an `icon` renders as a button.
   */
  readonly addonSlots = input<readonly RichTextToolbarSlot[]>([]);

  /**
   * Emits when an addon *button* slot is clicked, with the slot and the raw
   * DOM event (addons position popovers off the event target). Component slots
   * handle their own clicks and never emit this.
   */
  readonly addonSlotClick = output<{ slot: RichTextToolbarSlot; event: Event }>();

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

  readonly interactionDisabled = computed(() => this.disabled() || this.readonly());

  /** The Text style select's disabled state: whatever disables the toolbar, plus a line no text style can change. */
  readonly textStyleDisabled = computed(() => this.interactionDisabled() || !this.textStyleAvailable());

  readonly containerClasses = computed(() =>
    cn(
      'flex items-center flex-wrap gap-0.5 p-1 border-b bg-muted/30',
      'max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:scrollbar-hide',
      this.compact() && 'p-0.5 border-none bg-transparent',
      this.class()
    )
  );

  /**
   * The look every toolbar button shares, memoized per {@link compact} change
   * instead of recomputed per button per change-detection pass. The two public
   * class helpers differ only in where their "active" flag comes from.
   */
  private readonly baseButtonClasses = computed(() =>
    cn(BUTTON_BASE_CLASSES, this.compact() && 'p-1'));

  /**
   * Classes for a built-in button, adding the pressed styling when
   * {@link isActive} reports the item active. Called from the template for
   * every item on each change detection pass.
   */
  buttonClasses(item: ToolbarItem): string {
    return cn(this.baseButtonClasses(), this.isActive(item) && BUTTON_ACTIVE_CLASSES);
  }

  /**
   * Classes for an addon button slot — the same look as a built-in button, but
   * the pressed state comes from the slot's own {@link addonSlotActive}
   * predicate rather than from {@link activeFormats}.
   */
  addonButtonClasses(slot: RichTextToolbarSlot): string {
    return cn(this.baseButtonClasses(), this.addonSlotActive(slot) && BUTTON_ACTIVE_CLASSES);
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
   * An item is pressable exactly when it names a state the caret can be *in* —
   * every inline toggle, block type, list type and alignment. The host reports
   * those under the same names in {@link activeFormats}, so the check is one
   * `Set.has` through this constant.
   */
  isActive(item: ToolbarItem): boolean {
    return this.isPressable(item) && this.activeFormats().has(item);
  }

  /**
   * Whether an item is a toggle at all. The momentary actions — `undo`,
   * `redo`, `clear`, `horizontalRule`, `indent`, `outdent` — do something once
   * rather than entering a state, so the template omits `aria-pressed` on them
   * entirely: WAI-ARIA's button pattern reserves that attribute for toggle
   * buttons, and announcing "Undo, not pressed" is wrong rather than merely
   * noisy. `indent` still travels in `activeFormats` as nesting data for
   * consumers; it just never renders pressed.
   */
  isPressable(item: ToolbarItem): boolean {
    return RichTextToolbarComponent.PRESSABLE.has(item as ToolbarButtonItem);
  }

  /**
   * The built-in glyph for an item, as `SafeHtml` for `[innerHTML]`. Icons come
   * from {@link TOOLBAR_BUTTONS} — this file's own literal table, never consumer
   * input — so they are trusted directly. Under an RTL {@link locale} the
   * alignment and indent glyphs are swapped so the icon points the way the
   * command actually moves the text; the command emitted is unchanged.
   * `'separator'` has no glyph and the template never asks it for one.
   */
  getIcon(item: ToolbarItem): SafeHtml {
    if (item === 'separator') return this.getSafeIcon('');
    const key = this.locale().rtl ? mirrorIcon(item) : item;
    return this.getSafeIcon(TOOLBAR_BUTTONS[key]?.icon ?? '');
  }

  /**
   * One `SafeHtml` per distinct markup, for the life of the toolbar.
   *
   * `bypassSecurityTrustHtml` returns a new wrapper each call, and Angular
   * compares `[innerHTML]` bindings by identity, so every change detection
   * re-rendered every glyph. A button click blurs the editor on mousedown,
   * that runs change detection, and the SVG under the pointer was replaced
   * before mouseup -- Chrome fires no click when the mousedown target has left
   * the document. Every toolbar button therefore needed two clicks from
   * inside the editor. Same-markup calls now return the same object, so the
   * glyph nodes stay put.
   */
  private readonly safeIcons = new Map<string, SafeHtml>();

  /**
   * The button's `title` — the localized label plus its keyboard shortcut in
   * parentheses where one exists. Mirrors the RTL swap for alignment only:
   * indent/outdent keep their own labels, which name the direction the text
   * moves rather than a side of the page.
   *
   * `toolbarItems` is consumer input, so a name outside the union can reach
   * here at runtime even though `tsc` rejects it. Such an item falls back to
   * its own name rather than throwing — the pre-typed-table behaviour.
   */
  getTooltip(item: ToolbarItem): string {
    if (item === 'separator') return '';
    const button = TOOLBAR_BUTTONS[this.locale().rtl ? mirrorLabel(item) : item];
    if (!button) return item;
    const label = this.locale().toolbar[button.localeKey];
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

  /** The block types the Text style select lists, for the template's `@for`. */
  readonly textStyleOptions = TEXT_STYLE_OPTIONS;

  /**
   * The option the Text style select shows for the caret's current block.
   * Anything that is not one of the three headings reads as `'paragraph'`,
   * which is also what the select shows for a blockquote or a list — those
   * have their own toggle buttons, and the select only ever claims to describe
   * the text style.
   */
  readonly textStyleValue = computed<TextStyleOption>(() => {
    const formats = this.activeFormats();
    return TEXT_STYLE_OPTIONS.find((option) => option !== 'paragraph' && formats.has(option))
      ?? 'paragraph';
  });

  /**
   * Emits {@link formatCommand} for the chosen block type. The ids are the same
   * as the four block buttons', so the editor needs no new command — choosing
   * "Heading 2" here and clicking the old H2 button take the identical path.
   * A value outside {@link TEXT_STYLE_OPTIONS} is ignored rather than
   * forwarded, so a tampered-with `<option>` cannot inject a command.
   */
  onTextStyleChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value as TextStyleOption;
    // The browser has already moved the select, and no binding moves it back:
    // each option's `selected` follows `textStyleValue()`, which changes only
    // when the editor's block does. A pick the editor refused left the select
    // showing a heading over normal text, on that line and every line after,
    // and picking the same heading again on a real paragraph fired no change
    // event at all. So the select goes back to the caret's actual block here,
    // and a pick that did apply moves it forward on the next change detection.
    const actual = this.textStyleValue();
    if (!this.textStyleDisabled() && TEXT_STYLE_OPTIONS.includes(value)) {
      this.formatCommand.emit(value);
    }
    select.value = actual;
  }

  /**
   * The select's look: a toolbar-height control with the native chevron
   * replaced by an inline data-URI one, so it matches the buttons beside it
   * without pulling in an asset. The chevron and its padding flip in RTL.
   */
  readonly textStyleClasses = computed(() =>
    cn(
      'inline-flex items-center gap-1 rounded-md px-1 text-sm font-medium transition-colors',
      'hover:bg-accent hover:text-accent-foreground',
      'has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50',
      this.compact() && 'px-0.5'
    )
  );

  /**
   * Marks caller-supplied icon markup safe for `[innerHTML]`, used for addon
   * button slots. This **bypasses** Angular's
   * sanitizer rather than cleaning the markup: the trust boundary is the
   * application, which controls the addons it installs.
   * Never feed it markup that came from editor content or a remote source.
   */
  getSafeIcon(svgHtml: string): SafeHtml {
    let safe = this.safeIcons.get(svgHtml);
    if (!safe) {
      safe = this.sanitizer.bypassSecurityTrustHtml(svgHtml);
      this.safeIcons.set(svgHtml, safe);
    }
    return safe;
  }

  /**
   * Every control the toolbar's roving tab stop cycles through, in visual
   * order: the built-in buttons, the text-style `select`, and every button an
   * addon contributes through a component slot.
   *
   * It is read from the DOM rather than derived from `items()` because addon
   * slots render their own templates through `ngComponentOutlet` — the toolbar
   * cannot know what they contain. The file input the import addon keeps in the
   * DOM is skipped: it is visually hidden and driven by its own button, so
   * landing on it would be a stop with nothing to see. So is every control
   * inside a panel an addon button opens (the link form, the image picker):
   * the panel lives in the toolbar's DOM but is its own focus scope, and
   * stamping its buttons `tabindex=-1` took them out of the Tab order.
   */
  private rovingStops(): HTMLElement[] {
    const toolbar = this.elementRef.nativeElement.querySelector('[role="toolbar"]');
    if (!toolbar) return [];
    return Array.from(
      toolbar.querySelectorAll<HTMLElement>('button, select'),
    ).filter(el => (el.offsetParent !== null || el.tagName === 'SELECT') && !el.closest(HOSTED_PANEL));
  }

  /**
   * Write the single tab stop onto the DOM.
   *
   * Imperative because half these controls belong to addon templates this
   * component does not own; a `[attr.tabindex]` binding can only reach the
   * built-in buttons, which is what left the select and every addon button as
   * extra tab stops.
   */
  private applyRovingTabIndex(stops: HTMLElement[] = this.rovingStops()): void {
    if (stops.length === 0) return;
    const active = Math.min(this.rovingIndex(), stops.length - 1);
    for (const [i, el] of stops.entries()) {
      const wanted = i === active ? 0 : -1;
      // Only write when it differs: this runs after every change-detection
      // pass, and an unconditional DOM write would dirty the view again.
      if (el.tabIndex !== wanted) el.tabIndex = wanted;
    }
  }

  /**
   * Arrow / Home / End move the tab stop, per the WAI-ARIA toolbar pattern.
   * Direction follows the reading order, so the arrow keys swap in RTL.
   *
   * The text-style `select` is a stop like any other. Letting the arrows change
   * its value instead would trap the user: they could arrow INTO the select but
   * never out of it. The value stays reachable by opening the list (Alt+Down,
   * Space, or a click) or by typing an option's first letter, which is how a
   * native select behaves inside every other toolbar that follows this pattern.
   *
   * Disabled buttons keep their slot rather than being skipped — the toolbar
   * disables everything at once, so there would be nowhere to land.
   *
   * Only a key pressed ON a stop moves it. A key from anywhere else in the
   * toolbar's DOM — the URL field of the link panel, say — belongs to that
   * control; treating it as the first stop's key yanked the focus out of the
   * field on every arrow press.
   */
  protected onToolbarKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const stops = this.rovingStops();
    const current = stops.indexOf(target as HTMLElement);
    if (current === -1) return;

    const forward = this.locale().rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = this.locale().rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: number | null = null;

    if (event.key === forward) next = (current + 1) % stops.length;
    else if (event.key === backward) next = (current - 1 + stops.length) % stops.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = stops.length - 1;

    if (next === null) return;
    event.preventDefault();
    this.rovingIndex.set(next);
    this.applyRovingTabIndex(stops);
    stops[next]?.focus();
  }

  /**
   * Adopt the tab stop the user actually clicked or tabbed into, so the next
   * arrow press continues from there rather than jumping back to wherever the
   * stop happened to be.
   */
  protected onToolbarFocusIn(event: FocusEvent): void {
    const stops = this.rovingStops();
    const index = stops.indexOf(event.target as HTMLElement);
    if (index === -1) return;
    this.rovingIndex.set(index);
    this.applyRovingTabIndex(stops);
  }

  /**
   * Keep the single tab stop written as the toolbar's controls come and go.
   *
   * Once after the first render, then on every DOM mutation inside the
   * toolbar (an addon slot rendering its button, an item list change). This
   * replaces an `AfterViewChecked` hook that re-queried the DOM and read
   * `offsetParent` -- a forced layout -- on every change-detection pass, which
   * is every caret move in the editor.
   */
  ngAfterViewInit(): void {
    this.applyRovingTabIndex();
    const toolbar = this.elementRef.nativeElement.querySelector('[role="toolbar"]');
    if (!toolbar || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(() => this.applyRovingTabIndex());
    observer.observe(toolbar, { childList: true, subtree: true });
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
