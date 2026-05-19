import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { cn } from '../lib/utils';
import { ButtonComponent } from './button';
import { SeparatorComponent } from './separator';
import {
  PopoverComponent,
  PopoverTriggerComponent,
  PopoverContentComponent,
} from './popover.component';
import {
  EmojiPickerComponent,
  EmojiPickerTriggerComponent,
  EmojiPickerContentComponent,
} from './emoji-picker.component';
import { AutocompleteComponent } from './autocomplete.component';
import { RichTextLocale, RICH_TEXT_LOCALES } from './rich-text-locales';
import { RichTextCustomToolbarItem } from './rich-text-editor.component';

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
 * - `'image'` — Opens an image insertion dialog.
 * - `'emoji'` — Opens the emoji picker.
 *
 * **Styling:**
 * - `'fontColor'` — Text color picker.
 * - `'backgroundColor'` — Background highlight color picker.
 * - `'fontSize'` — Font size selector dropdown.
 * - `'fontFamily'` — Font family selector dropdown.
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
  | 'link'
  | 'image'
  | 'emoji'
  | 'separator'
  | 'undo'
  | 'redo'
  | 'clear'
  | 'fontColor'
  | 'backgroundColor'
  | 'fontSize'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'fontFamily'
  | 'table'
  | 'importFile'
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
  { id: 'link', label: 'Insert Link', localeKey: 'insertLink', shortcut: 'Ctrl+K' },
  { id: 'image', label: 'Insert Image', localeKey: 'insertImage' },
  { id: 'emoji', label: 'Insert Emoji', localeKey: 'insertEmoji' },
  { id: 'undo', label: 'Undo', localeKey: 'undo', shortcut: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', localeKey: 'redo', shortcut: 'Ctrl+Shift+Z' },
  { id: 'clear', label: 'Clear Formatting', localeKey: 'clearFormatting' },
  { id: 'fontColor', label: 'Text Color', localeKey: 'textColor' },
  { id: 'backgroundColor', label: 'Background Color', localeKey: 'backgroundColor' },
  { id: 'fontSize', label: 'Font Size', localeKey: 'fontSize' },
  { id: 'fontFamily', label: 'Font Family', localeKey: 'fontFamily' },
  { id: 'alignLeft', label: 'Align Left', localeKey: 'alignLeft' },
  { id: 'alignCenter', label: 'Align Center', localeKey: 'alignCenter' },
  { id: 'alignRight', label: 'Align Right', localeKey: 'alignRight' },
  { id: 'table', label: 'Insert Table', localeKey: 'insertTable' },
  { id: 'importFile', label: 'Import File', localeKey: 'importFile' },
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
  link: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  image: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
  emoji: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>`,
  undo: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`,
  redo: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`,
  clear: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`,
  paragraph: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>`,
  fontColor: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="m6 16 6-12 6 12"/><path d="M8 12h8"/></svg>`,
  backgroundColor: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>`,
  fontSize: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>`,
  fontFamily: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 14h-5"/><path d="M21 18h-5"/><path d="M17 14v8"/><path d="m3 16 4-8 4 8"/><path d="M4.5 14h5"/></svg>`,
  alignLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>`,
  alignCenter: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>`,
  alignRight: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>`,
  table: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 12h18"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
  importFile: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>`,
  indent: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8 7 12 3 16"/><line x1="21" x2="11" y1="12" y2="12"/><line x1="21" x2="11" y1="6" y2="6"/><line x1="21" x2="11" y1="18" y2="18"/></svg>`,
  outdent: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 3 12 7 16"/><line x1="21" x2="11" y1="12" y2="12"/><line x1="21" x2="11" y1="6" y2="6"/><line x1="21" x2="11" y1="18" y2="18"/></svg>`,
  taskList: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>`,
  horizontalRule: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`,
  outline: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/><path d="M21 12h.01"/><path d="M21 18h.01"/></svg>`,
};

/**
 * The default set of web-safe font families offered by the font family dropdown.
 * Pass a custom array via `[fontFamilyOptions]` on the toolbar (or `[fontFamilies]`
 * on the editor) to replace or extend this list.
 */
export const DEFAULT_FONT_FAMILIES: string[] = [
  'Arial',
  'Helvetica',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Times New Roman',
  'Georgia',
  'Garamond',
  'Courier New',
  'Lucida Console',
  'Comic Sans MS',
  'Impact',
];

/**
 * Controls whether custom font families replace or extend the built-in defaults.
 *
 * - `'append'`  — Custom fonts are added after {@link DEFAULT_FONT_FAMILIES}.
 * - `'replace'` — Only the custom fonts are shown; defaults are discarded.
 */
export type FontFamilyStrategy = 'append' | 'replace';

@Component({
  selector: 'ui-rich-text-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    SeparatorComponent,
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
    EmojiPickerComponent,
    EmojiPickerTriggerComponent,
    EmojiPickerContentComponent,
    AutocompleteComponent,
    FormsModule,
  ],
  template: `
    <div
      [class]="containerClasses()"
      role="toolbar"
      [attr.aria-label]="locale().editor.formattingOptions"
      [dir]="locale().rtl ? 'rtl' : 'ltr'"
    >
      @for (item of items(); track $index) {
        @if (item === 'separator') {
          <ui-separator orientation="vertical" class="mx-1 h-6" />
        } @else if (item === 'link') {
          <ui-popover [open]="openPopover() === 'link'" [closeOnScroll]="true" (openChange)="$event ? openPopoverPanel('link') : closePopoverPanel('link')">
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
                [disabled]="interactionDisabled()"
              >
                <span [innerHTML]="getIcon('link')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-80 max-sm:w-[calc(100vw-2rem)] p-4" align="start" strategy="fixed">
              <div class="space-y-3">
                <div>
                  <label class="text-sm font-medium mb-1 block">{{ locale().link.text }}</label>
                  <input
                    #linkText
                    type="text"
                    [value]="selectedText()"
                    [placeholder]="locale().link.textPlaceholder"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label class="text-sm font-medium mb-1 block">{{ locale().link.url }}</label>
                  <input
                    #linkUrl
                    type="url"
                    [placeholder]="locale().link.urlPlaceholder"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <ui-button
                  size="sm"
                  class="w-full"
                  [disabled]="interactionDisabled()"
                  (click)="onInsertLink(linkText.value, linkUrl.value)"
                >
                  {{ locale().link.insert }}
                </ui-button>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'image') {
          <ui-popover [open]="openPopover() === 'image'" [closeOnScroll]="true" (openChange)="$event ? openPopoverPanel('image') : closePopoverPanel('image')">
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
                [disabled]="interactionDisabled()"
              >
                <span [innerHTML]="getIcon('image')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-80 max-sm:w-[calc(100vw-2rem)] p-4" align="start" strategy="fixed">
              <div class="space-y-3">
                <div>
                  <label class="text-sm font-medium mb-1 block">{{ locale().image.url }}</label>
                  <input
                    #imageSrc
                    type="url"
                    [placeholder]="locale().image.urlPlaceholder"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label class="text-sm font-medium mb-1 block">{{ locale().image.altText }}</label>
                  <input
                    #imageAlt
                    type="text"
                    [placeholder]="locale().image.altTextPlaceholder"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <ui-button
                  size="sm"
                  class="w-full"
                  [disabled]="interactionDisabled()"
                  (click)="onInsertImage(imageSrc.value, imageAlt.value)"
                >
                  {{ locale().image.insert }}
                </ui-button>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'emoji') {
          <ui-emoji-picker [closeOnSelect]="false" [closeOnScroll]="true" (emojiSelect)="onEmojiSelect($event)">
            <ui-emoji-picker-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
                [disabled]="interactionDisabled()"
              >
                <span [innerHTML]="getIcon('emoji')"></span>
              </button>
            </ui-emoji-picker-trigger>
            <ui-emoji-picker-content strategy="fixed" />
          </ui-emoji-picker>
        } @else if (item === 'fontColor') {
          <ui-popover [open]="openPopover() === 'fontColor'" [closeOnScroll]="true" (openChange)="$event ? openPopoverPanel('fontColor') : closePopoverPanel('fontColor')">
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
                [disabled]="interactionDisabled()"
              >
                <span [innerHTML]="getIcon('fontColor')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-48 p-3" align="start" strategy="fixed">
              <div class="space-y-2">
                <label class="text-sm font-medium block">{{ locale().color.textColor }}</label>
                <div class="grid grid-cols-8 gap-1">
                  @for (color of colorPalette; track color) {
                    <button
                      type="button"
                      data-swatch
                      class="aspect-square w-5 rounded border border-border hover:scale-110 transition-transform"
                      [style.background-color]="color"
                      [title]="color"
                      [disabled]="interactionDisabled()"
                      (click)="onColorSelect('fontColor', color)"
                    ></button>
                  }
                </div>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'fontSize') {
          <ui-popover [open]="openPopover() === 'fontSize'" [closeOnScroll]="true" (openChange)="$event ? openPopoverPanel('fontSize') : closePopoverPanel('fontSize')">
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
                [disabled]="interactionDisabled()"
              >
                <span [innerHTML]="getIcon('fontSize')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-48 p-3" align="start" strategy="fixed">
              <div class="space-y-2">
                <label class="text-sm font-medium block">{{ locale().fontSize.selectSize }}</label>
                <ui-autocomplete
                  [(ngModel)]="selectedFontSize"
                  [options]="fontSizeOptionsWithPx()"
                  [placeholder]="locale().fontSize.selectSizePlaceholder"
                  [disabled]="interactionDisabled()"
                  [filter]="false"
                  (ngModelChange)="onFontSizeAutocompleteChange($event)"
                  class="w-full"
                />
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'fontFamily') {
          <ui-popover [open]="openPopover() === 'fontFamily'" [closeOnScroll]="true" (openChange)="$event ? openPopoverPanel('fontFamily') : closePopoverPanel('fontFamily')">
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
                [disabled]="interactionDisabled()"
              >
                <span [innerHTML]="getIcon('fontFamily')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-56 p-3" align="start" strategy="fixed">
              <div class="space-y-2">
                <label class="text-sm font-medium block">{{ locale().fontFamily.selectFamily }}</label>
                <ui-autocomplete
                  [(ngModel)]="selectedFontFamily"
                  [options]="fontFamilyOptions()"
                  [placeholder]="locale().fontFamily.selectFamilyPlaceholder"
                  [disabled]="interactionDisabled()"
                  [filter]="true"
                  (ngModelChange)="onFontFamilyAutocompleteChange($event)"
                  class="w-full"
                />
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'backgroundColor') {
          <ui-popover [open]="openPopover() === 'backgroundColor'" [closeOnScroll]="true" (openChange)="$event ? openPopoverPanel('backgroundColor') : closePopoverPanel('backgroundColor')">
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
                [disabled]="interactionDisabled()"
              >
                <span [innerHTML]="getIcon('backgroundColor')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-48 p-3" align="start" strategy="fixed">
              <div class="space-y-2">
                <label class="text-sm font-medium block">{{ locale().color.highlightColor }}</label>
                <div class="grid grid-cols-8 gap-1">
                  @for (color of highlightPalette; track color) {
                    <button
                      type="button"
                      data-swatch
                      class="aspect-square w-5 rounded border border-border hover:scale-110 transition-transform"
                      [style.background-color]="color"
                      [title]="color"
                      [disabled]="interactionDisabled()"
                      (click)="onColorSelect('backgroundColor', color)"
                    ></button>
                  }
                </div>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'table') {
          <ui-popover [open]="openPopover() === 'table'" [closeOnScroll]="true" (openChange)="$event ? openPopoverPanel('table') : closePopoverPanel('table')">
            <ui-popover-trigger>
              <button type="button" [class]="buttonClasses(item)" [title]="getTooltip(item)" [disabled]="interactionDisabled()">
                <span [innerHTML]="getIcon('table')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="p-3 max-sm:max-w-[calc(100vw-1rem)]" align="start" strategy="fixed">
              <div class="space-y-2">
                <div class="grid gap-0.5" style="grid-template-columns: repeat(8, 1fr)">
                  @for (row of [1,2,3,4,5,6,7,8]; track row) {
                    @for (col of [1,2,3,4,5,6,7,8]; track col) {
                      <button
                        type="button"
                        data-grid-cell
                        class="aspect-square w-5 border rounded-sm transition-colors"
                        [class.bg-primary]="row <= tableGridHoverRows() && col <= tableGridHoverCols()"
                        [class.border-primary]="row <= tableGridHoverRows() && col <= tableGridHoverCols()"
                        [class.border-border]="row > tableGridHoverRows() || col > tableGridHoverCols()"
                        [class.bg-background]="row > tableGridHoverRows() || col > tableGridHoverCols()"
                        (mouseenter)="tableGridHoverRows.set(row); tableGridHoverCols.set(col)"
                        (click)="onTableGridSelect(row, col)"
                      ></button>
                    }
                  }
                </div>
                <div class="text-xs text-center text-muted-foreground">
                  @if (tableGridHoverRows() > 0 && tableGridHoverCols() > 0) {
                    {{ tableGridHoverRows() }} x {{ tableGridHoverCols() }}
                  } @else {
                    {{ locale().table.insertTable }}
                  }
                </div>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'importFile') {
          <button
            type="button"
            [class]="buttonClasses(item)"
            [title]="getTooltip(item)"
            [disabled]="interactionDisabled()"
            (click)="fileInput.click()"
          >
            <span [innerHTML]="getIcon('importFile')"></span>
          </button>
          <input
            #fileInput
            type="file"
            accept=".pdf,.docx"
            class="hidden"
            (change)="onFileSelect($event)"
          />
        } @else {
          <button
            type="button"
            [class]="buttonClasses(item)"
            [title]="getTooltip(item)"
            [attr.aria-pressed]="isActive(item)"
            [attr.data-state]="isActive(item) ? 'on' : 'off'"
            [disabled]="interactionDisabled()"
            (click)="onFormatClick(item)"
          >
            <span [innerHTML]="getIcon(item)"></span>
          </button>
        }
      }
      @for (custom of customItems(); track custom.id) {
        <button
          type="button"
          [class]="customButtonClasses(custom)"
          [title]="custom.tooltip"
          [disabled]="interactionDisabled()"
          (click)="onCustomItemClick(custom.id)"
        >
          <span [innerHTML]="getSafeIcon(custom.icon)"></span>
        </button>
      }
    </div>
  `,
  styles: [`
    @media (pointer: coarse) {
      :host button:not([data-swatch]):not([data-grid-cell]) { min-height: 40px; min-width: 40px; }
    }
    :host { scrollbar-width: none; }
    :host::-webkit-scrollbar { display: none; }
  `],
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
    'separator',
    'link', 'image', 'emoji',
  ]);

  activeFormats = input<Set<string>>(new Set());
  selectedText = input<string>('');
  currentFontSize = input<string>('');
  currentFontFamily = input<string>('');
  fontFamilyOptions = input<string[]>(DEFAULT_FONT_FAMILIES);
  compact = input<boolean>(false);
  class = input<string>('');
  disabled = input<boolean>(false);
  readonly = input<boolean>(false);
  locale = input<RichTextLocale>(RICH_TEXT_LOCALES['en']);

  formatCommand = output<string>();
  linkInsert = output<{ text: string; url: string }>();
  imageInsert = output<{ alt: string; src: string }>();
  emojiInsert = output<string>();
  colorSelect = output<{ type: 'fontColor' | 'backgroundColor'; color: string }>();
  tableInsert = output<{ rows: number; cols: number }>();
  fileImport = output<File>();
  customItems = input<RichTextCustomToolbarItem[]>([]);
  customItemClick = output<string>();

  tableGridHoverRows = signal(0);
  tableGridHoverCols = signal(0);

  colorPalette = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
    '#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
    '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599',
  ];

  highlightPalette = [
    'transparent', '#ffffff', '#fef3c7', '#fef9c3', '#d9f99d', '#bbf7d0', '#a7f3d0', '#99f6e4',
    '#a5f3fc', '#bae6fd', '#c7d2fe', '#ddd6fe', '#f5d0fe', '#fce7f3', '#fed7aa', '#fecaca',
    '#fde68a', '#fef08a', '#d9f99d', '#bbf7d0', '#6ee7b7', '#5eead4', '#67e8f9', '#7dd3fc',
    '#a5b4fc', '#c4b5fd', '#e879f9', '#f472b6', '#fb923c', '#f87171', '#facc15', '#a3e635',
  ];

  fontSizeOptions = Array.from({ length: 33 }, (_, i) => 8 + i * 2);

  fontSizeSelect = output<string>();
  fontFamilySelect = output<string>();

  openPopover = signal<string | null>(null);
  selectedFontSize = signal<string>('');
  selectedFontFamily = signal<string>('');

  fontSizeOptionsWithPx = computed(() =>
    this.fontSizeOptions.map(size => `${size}px`)
  );

  interactionDisabled = computed(() => this.disabled() || this.readonly());

  containerClasses = computed(() =>
    cn(
      'flex items-center flex-wrap gap-0.5 p-1 border-b bg-muted/30',
      'max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:scrollbar-hide',
      this.compact() && 'p-0.5 border-none bg-transparent',
      this.class()
    )
  );

  buttonClasses(item: ToolbarItem) {
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

  onInsertLink(text: string, url: string): void {
    if (this.interactionDisabled()) return;
    if (url) {
      this.linkInsert.emit({ text: text || 'Link', url });
    }
  }

  onInsertImage(src: string, alt: string): void {
    if (this.interactionDisabled()) return;
    if (src) {
      this.imageInsert.emit({ alt: alt || 'Image', src });
    }
  }

  onEmojiSelect(emoji: string): void {
    if (this.interactionDisabled()) return;
    this.emojiInsert.emit(emoji);
  }

  onColorSelect(type: 'fontColor' | 'backgroundColor', color: string): void {
    if (this.interactionDisabled()) return;
    this.colorSelect.emit({ type, color });
  }

  onFontSizeSelect(size: string): void {
    if (this.interactionDisabled()) return;
    this.fontSizeSelect.emit(size);
  }

  openPopoverPanel(popoverId: string): void {
    this.openPopover.set(popoverId);
    if (popoverId === 'fontSize') {
      const currentSize = this.currentFontSize();
      if (currentSize) {
        this.selectedFontSize.set(`${currentSize}px`);
      }
    }
    if (popoverId === 'fontFamily') {
      const currentFamily = this.currentFontFamily();
      if (currentFamily) {
        this.selectedFontFamily.set(currentFamily);
      }
    }
  }

  closePopoverPanel(popoverId: string): void {
    if (this.openPopover() === popoverId) {
      this.openPopover.set(null);
    }
  }

  onTableGridSelect(rows: number, cols: number): void {
    if (this.interactionDisabled()) return;
    this.tableInsert.emit({ rows, cols });
    this.openPopover.set(null);
    this.tableGridHoverRows.set(0);
    this.tableGridHoverCols.set(0);
  }

  onFontSizeAutocompleteChange(value: string): void {
    if (this.interactionDisabled()) return;
    const numericValue = value.replaceAll(/[^\d]/g, '');
    if (numericValue && !Number.isNaN(Number(numericValue))) {
      this.fontSizeSelect.emit(numericValue);
      this.openPopover.set(null);
    }
  }

  onFontFamilyAutocompleteChange(value: string): void {
    if (this.interactionDisabled()) return;
    if (value) {
      this.fontFamilySelect.emit(value);
      this.openPopover.set(null);
    }
  }

  onFileSelect(event: Event): void {
    if (this.interactionDisabled()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileImport.emit(file);
      input.value = '';
    }
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
