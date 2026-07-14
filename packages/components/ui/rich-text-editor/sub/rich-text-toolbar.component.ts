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
  | 'horizontalRule'
  | 'outline';

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
  { id: 'outline', label: 'Document Outline', localeKey: 'outline' },
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
  outline: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/><path d="M21 12h.01"/><path d="M21 18h.01"/></svg>`,
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

  items = input<ToolbarItem[]>([
    'bold', 'italic', 'underline',
    'separator',
    'heading1', 'heading2',
    'separator',
    'bulletList', 'orderedList',
  ]);

  activeFormats = input<Set<string>>(new Set());
  compact = input<boolean>(false);
  class = input<string>('');
  disabled = input<boolean>(false);
  readonly = input<boolean>(false);
  locale = input<RichTextLocale>(RICH_TEXT_LOCALES['en']);

  formatCommand = output<string>();
  customItems = input<RichTextCustomToolbarItem[]>([]);
  customItemClick = output<string>();
  addonSlots = input<readonly RichTextToolbarSlot[]>([]);
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

  addonSlotEnabled(slot: RichTextToolbarSlot): boolean {
    return slot.isEnabled ? slot.isEnabled() : true;
  }

  addonSlotActive(slot: RichTextToolbarSlot): boolean {
    return slot.isActive ? slot.isActive() : false;
  }

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

  onFormatClick(item: ToolbarItem): void {
    if (this.interactionDisabled()) return;
    this.formatCommand.emit(item);
  }

  onCustomItemClick(id: string): void {
    if (this.interactionDisabled()) return;
    this.customItemClick.emit(id);
  }

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

  getSafeIcon(svgHtml: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgHtml);
  }
}
