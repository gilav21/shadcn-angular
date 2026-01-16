import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { cn } from '../lib/utils';
import { ButtonComponent } from './button.component';
import { SeparatorComponent } from './separator.component';
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
import {
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectItemComponent,
} from './select.component';

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
  | 'alignRight';

interface ToolbarButton {
  id: ToolbarItem;
  label: string;
  shortcut?: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  { id: 'bold', label: 'Bold', shortcut: 'Ctrl+B' },
  { id: 'italic', label: 'Italic', shortcut: 'Ctrl+I' },
  { id: 'underline', label: 'Underline', shortcut: 'Ctrl+U' },
  { id: 'strikethrough', label: 'Strikethrough' },
  { id: 'paragraph', label: 'Normal Text' },
  { id: 'heading1', label: 'Heading 1' },
  { id: 'heading2', label: 'Heading 2' },
  { id: 'heading3', label: 'Heading 3' },
  { id: 'bulletList', label: 'Bullet List' },
  { id: 'orderedList', label: 'Numbered List' },
  { id: 'blockquote', label: 'Blockquote' },
  { id: 'code', label: 'Inline Code' },
  { id: 'codeBlock', label: 'Code Block' },
  { id: 'link', label: 'Insert Link', shortcut: 'Ctrl+K' },
  { id: 'image', label: 'Insert Image' },
  { id: 'emoji', label: 'Insert Emoji' },
  { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z' },
  { id: 'clear', label: 'Clear Formatting' },
  { id: 'fontColor', label: 'Text Color' },
  { id: 'backgroundColor', label: 'Background Color' },
  { id: 'fontSize', label: 'Font Size' },
  { id: 'alignLeft', label: 'Align Left' },
  { id: 'alignCenter', label: 'Align Center' },
  { id: 'alignRight', label: 'Align Right' },
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
  alignLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>`,
  alignCenter: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>`,
  alignRight: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>`,
};

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
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
    FormsModule,
  ],
  template: `
    <div 
      [class]="containerClasses()"
      role="toolbar"
      aria-label="Formatting options"
    >
      @for (item of items(); track $index) {
        @if (item === 'separator') {
          <ui-separator orientation="vertical" class="mx-1 h-6" />
        } @else if (item === 'link') {
          <ui-popover>
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
              >
                <span [innerHTML]="getIcon('link')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-80 p-4" align="start">
              <div class="space-y-3">
                <div>
                  <label class="text-sm font-medium mb-1 block">Link Text</label>
                  <input
                    #linkText
                    type="text"
                    placeholder="Display text"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label class="text-sm font-medium mb-1 block">URL</label>
                  <input
                    #linkUrl
                    type="url"
                    placeholder="https://example.com"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <ui-button 
                  size="sm" 
                  class="w-full"
                  (click)="onInsertLink(linkText.value, linkUrl.value)"
                >
                  Insert Link
                </ui-button>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'image') {
          <ui-popover>
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
              >
                <span [innerHTML]="getIcon('image')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-80 p-4" align="start">
              <div class="space-y-3">
                <div>
                  <label class="text-sm font-medium mb-1 block">Image URL</label>
                  <input
                    #imageSrc
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label class="text-sm font-medium mb-1 block">Alt Text</label>
                  <input
                    #imageAlt
                    type="text"
                    placeholder="Description of image"
                    class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <ui-button 
                  size="sm" 
                  class="w-full"
                  (click)="onInsertImage(imageSrc.value, imageAlt.value)"
                >
                  Insert Image
                </ui-button>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'emoji') {
          <ui-emoji-picker [closeOnSelect]="false" (emojiSelect)="onEmojiSelect($event)">
            <ui-emoji-picker-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
              >
                <span [innerHTML]="getIcon('emoji')"></span>
              </button>
            </ui-emoji-picker-trigger>
            <ui-emoji-picker-content />
          </ui-emoji-picker>
        } @else if (item === 'fontColor') {
          <ui-popover>
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
              >
                <span [innerHTML]="getIcon('fontColor')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-48 p-3" align="start">
              <div class="space-y-2">
                <label class="text-sm font-medium block">Text Color</label>
                <div class="grid grid-cols-8 gap-1">
                  @for (color of colorPalette; track color) {
                    <button
                      type="button"
                      class="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                      [style.background-color]="color"
                      [title]="color"
                      (click)="onColorSelect('fontColor', color)"
                    ></button>
                  }
                </div>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'fontSize') {
          <ui-popover>
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
              >
                <span [innerHTML]="getIcon('fontSize')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-40 p-3" align="start">
              <div class="space-y-3">
                <div>
                  <label class="text-sm font-medium block mb-1">Select Size</label>
                  <ui-select 
                    [ngModel]="'3'" 
                    (ngModelChange)="onFontSizeSelect($event)" 
                    class="w-full"
                  >
                    <ui-select-trigger class="h-9">
                      <ui-select-value placeholder="Select size" />
                    </ui-select-trigger>
                    <ui-select-content>
                      @for (size of fontSizeOptions; track size) {
                        <ui-select-item [value]="size.toString()">{{ size }}px</ui-select-item>
                      }
                    </ui-select-content>
                  </ui-select>
                </div>
                <div class="border-t pt-3">
                  <label class="text-sm font-medium block mb-1">Custom Size</label>
                  <div class="flex gap-2">
                    <input
                      #customSize
                      type="number"
                      min="6"
                      max="200"
                      placeholder="px"
                      class="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <button
                      type="button"
                      class="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                      (click)="onFontSizeSelect(customSize.value)"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else if (item === 'backgroundColor') {
          <ui-popover>
            <ui-popover-trigger>
              <button
                type="button"
                [class]="buttonClasses(item)"
                [title]="getTooltip(item)"
              >
                <span [innerHTML]="getIcon('backgroundColor')"></span>
              </button>
            </ui-popover-trigger>
            <ui-popover-content class="w-48 p-3" align="start">
              <div class="space-y-2">
                <label class="text-sm font-medium block">Highlight Color</label>
                <div class="grid grid-cols-8 gap-1">
                  @for (color of highlightPalette; track color) {
                    <button
                      type="button"
                      class="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                      [style.background-color]="color"
                      [title]="color"
                      (click)="onColorSelect('backgroundColor', color)"
                    ></button>
                  }
                </div>
              </div>
            </ui-popover-content>
          </ui-popover>
        } @else {
          <button
            type="button"
            [class]="buttonClasses(item)"
            [title]="getTooltip(item)"
            [attr.aria-pressed]="isActive(item)"
            [attr.data-state]="isActive(item) ? 'on' : 'off'"
            (click)="onFormatClick(item)"
          >
            <span [innerHTML]="getIcon(item)"></span>
          </button>
        }
      }
    </div>
  `,
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
  compact = input<boolean>(false);
  class = input<string>('');

  formatCommand = output<string>();
  linkInsert = output<{ text: string; url: string }>();
  imageInsert = output<{ alt: string; src: string }>();
  emojiInsert = output<string>();
  colorSelect = output<{ type: 'fontColor' | 'backgroundColor'; color: string }>();

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

  containerClasses = computed(() =>
    cn(
      'flex items-center flex-wrap gap-0.5 p-1 border-b bg-muted/30',
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
    };
    const format = formatMap[item];
    return format ? this.activeFormats().has(format) : false;
  }

  getIcon(item: ToolbarItem): SafeHtml {
    const svg = ICONS[item] ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  getTooltip(item: ToolbarItem): string {
    const button = TOOLBAR_BUTTONS.find(b => b.id === item);
    if (!button) return item;
    return button.shortcut ? `${button.label} (${button.shortcut})` : button.label;
  }

  onFormatClick(item: ToolbarItem): void {
    this.formatCommand.emit(item);
  }

  onInsertLink(text: string, url: string): void {
    if (url) {
      this.linkInsert.emit({ text: text || 'Link', url });
    }
  }

  onInsertImage(src: string, alt: string): void {
    if (src) {
      this.imageInsert.emit({ alt: alt || 'Image', src });
    }
  }

  onEmojiSelect(emoji: string): void {
    this.emojiInsert.emit(emoji);
  }

  onColorSelect(type: 'fontColor' | 'backgroundColor', color: string): void {
    this.colorSelect.emit({ type, color });
  }

  onFontSizeSelect(size: string): void {
    this.fontSizeSelect.emit(size);
  }
}
