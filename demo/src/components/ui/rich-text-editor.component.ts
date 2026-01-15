import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    ViewChild,
    OnInit,
    OnDestroy,
    forwardRef,
    effect,
    AfterViewInit,
    DestroyRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { cn } from '../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { RichTextMarkdownService } from './rich-text-markdown.service';
import { Observable, isObservable, of, Subject } from 'rxjs';
import { debounceTime, switchMap, catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RichTextToolbarComponent, ToolbarItem } from './rich-text-toolbar.component';
import { MentionItem, RichTextMentionPopoverComponent, TagItem } from './rich-text-mention.component';
import { RichTextImageResizerComponent } from './rich-text-image-resizer.component';

// Editor variants using CVA
const editorVariants = cva(
    'relative w-full rounded-lg border bg-background text-base ring-offset-background transition-colors',
    {
        variants: {
            variant: {
                default: 'border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                ghost: 'border-transparent focus-within:border-input',
            },
            size: {
                default: '',
                sm: 'text-sm',
                lg: 'text-lg',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export type EditorVariant = VariantProps<typeof editorVariants>['variant'];
export type EditorSize = VariantProps<typeof editorVariants>['size'];
export type EditorMode = 'markdown' | 'html';
export type ToolbarPosition = 'top' | 'floating' | 'none';

// History entry for undo/redo
interface HistoryEntry {
    html: string;
    selectionStart: number;
    selectionEnd: number;
}

// Default toolbar items
export const DEFAULT_TOOLBAR_ITEMS: ToolbarItem[] = [
    'bold', 'italic', 'underline',
    'separator',
    'paragraph', 'heading1', 'heading2', 'heading3',
    'separator',
    'bulletList', 'orderedList',
    'separator',
    'alignLeft', 'alignCenter', 'alignRight',
    'separator',
    'fontColor', 'backgroundColor', 'fontSize',
    'separator',
    'link', 'image', 'emoji',
    'separator',
    'code', 'codeBlock',
    'separator',
    'clear',
];

@Component({
    selector: 'ui-rich-text-editor',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RichTextToolbarComponent, RichTextMentionPopoverComponent, RichTextImageResizerComponent],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => RichTextEditorComponent),
            multi: true,
        },
    ],
    template: `
    @if (toolbar() === 'top' && !readonly()) {
      <ui-rich-text-toolbar
        [items]="toolbarItems()"
        [activeFormats]="activeFormats()"
        (formatCommand)="onFormatCommand($event)"
        (linkInsert)="onLinkInsert($event)"
        (imageInsert)="onImageInsert($event)"
        (emojiInsert)="onEmojiInsert($event)"
        (colorSelect)="onColorSelect($event)"
        (fontSizeSelect)="onFontSizeSelect($event)"
      />
    }

    <div [class]="editorContainerClasses()">
      <!-- WYSIWYG Editor (contentEditable) for both modes -->
      <div
        #editorDiv
        [attr.contenteditable]="!disabled() && !readonly()"
        [class]="editableClasses()"
        [attr.placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel() || 'Rich text editor'"
        [attr.aria-describedby]="ariaDescribedBy()"
        [attr.data-slot]="'rich-text-editor'"
        [style.min-height]="minHeight()"
        [style.max-height]="maxHeight()"
        role="textbox"
        aria-multiline="true"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
        (paste)="onPaste($event)"
        (focus)="onFocus()"
        (blur)="onBlur()"
        (mouseup)="onSelectionChange()"
        (keyup)="onSelectionChange()"
        (click)="onEditorClick($event)"
      ></div>

      <ui-rich-text-image-resizer 
          [target]="selectedImage()" 
          [container]="editorDiv"
          (resizeEnd)="onImageResizeEnd()" 
      />


      <!-- Floating toolbar (shown on selection) -->
      @if (toolbar() === 'floating' && !readonly() && showFloatingToolbar()) {
        <div 
          class="fixed z-9999 bg-popover border rounded-lg shadow-lg p-1"
          [style.left.px]="floatingToolbarPosition().x"
          [style.top.px]="floatingToolbarPosition().y"
        >
          <ui-rich-text-toolbar
            [items]="['bold', 'italic', 'underline', 'separator', 'link', 'separator', 'clear']"
            [activeFormats]="emptyFormats"
            [compact]="true"
            (formatCommand)="onFloatingFormatCommand($event)"
            (linkInsert)="onLinkInsert($event)"
          />
        </div>
      }

      <!-- Mention/Tag popover -->
      @if (mentionPopoverOpen()) {
        <ui-rich-text-mention-popover
          [type]="mentionType()"
          [query]="mentionQuery()"
          [items]="filteredMentionItems()"
          [position]="mentionPopoverPosition()"
          (itemSelect)="onMentionSelect($event)"
          (close)="closeMentionPopover()"
        />
      }
    </div>

    <!-- Character/word count (optional) -->
    @if (showCount()) {
      <div class="flex justify-end text-xs text-muted-foreground mt-1 px-1">
        <span>{{ characterCount() }} characters</span>
      </div>
    }
  `,
    host: {
        class: 'block',
    },
})
export class RichTextEditorComponent implements ControlValueAccessor, OnInit, OnDestroy, AfterViewInit {
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly markdownService = inject(RichTextMarkdownService);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly document = inject(DOCUMENT);
    private readonly el = inject(ElementRef);

    @ViewChild('editorDiv') editorDiv?: ElementRef<HTMLDivElement>;
    @ViewChild(RichTextMentionPopoverComponent) mentionPopover?: RichTextMentionPopoverComponent;

    // === CONFIGURATION INPUTS ===

    /** Editor mode: 'markdown' stores Markdown internally, 'html' stores HTML */
    mode = input<EditorMode>('markdown');

    /** Visual variant */
    variant = input<EditorVariant>('default');

    /** Size variant */
    size = input<EditorSize>('default');

    /** Toolbar position: 'top' | 'floating' | 'none' */
    toolbar = input<ToolbarPosition>('top');

    /** Toolbar items to show */
    toolbarItems = input<ToolbarItem[]>(DEFAULT_TOOLBAR_ITEMS);

    /** Placeholder text */
    placeholder = input<string>('Write something...');

    /** Minimum height */
    minHeight = input<string>('120px');

    /** Maximum height */
    maxHeight = input<string>('400px');

    /** Disabled state */
    disabled = input<boolean>(false);

    /** Read-only mode */
    readonly = input<boolean>(false);

    /** Enable mentions (@user) */
    mentions = input<boolean>(false);

    /** Mention data source */
    mentionSource = input<Observable<MentionItem[]> | MentionItem[]>([]);

    /** Enable tags (#tag) */
    tags = input<boolean>(false);

    /** Tag data source */
    tagSource = input<Observable<TagItem[]> | TagItem[]>([]);

    /** Enable emoji picker */
    emojiPicker = input<boolean>(true);

    /** Enable images */
    images = input<boolean>(true);

    /** Image upload handler */
    imageUploader = input<((file: File) => Observable<string>) | undefined>(undefined);

    /** Allowed image sources */
    imageSources = input<'all' | 'upload' | 'url'>('all');

    /** Show character count */
    showCount = input<boolean>(false);

    /** Max length (characters) */
    maxLength = input<number | undefined>(undefined);

    /** Custom CSS classes */
    class = input<string>('');

    /** ARIA label */
    ariaLabel = input<string | undefined>(undefined);

    /** ARIA describedby */
    ariaDescribedBy = input<string | undefined>(undefined);

    // === OUTPUTS ===

    /** Emits sanitized HTML content */
    htmlChange = output<string>();

    /** Emits Markdown content */
    markdownChange = output<string>();

    /** Emits on focus */
    focus = output<void>();

    /** Emits on blur */
    blur = output<void>();

    // === INTERNAL STATE ===

    /** Internal HTML content (always HTML for WYSIWYG) */
    private htmlContent = signal<string>('');

    /** Currently active formats at cursor position */
    activeFormats = signal<Set<string>>(new Set());

    /** Floating toolbar state */
    showFloatingToolbar = signal<boolean>(false);
    floatingToolbarPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });

    /** Empty formats for floating toolbar (buttons are actions, not toggles) */
    readonly emptyFormats = new Set<string>();

    /** Mention popover state */
    mentionPopoverOpen = signal<boolean>(false);
    mentionType = signal<'mention' | 'tag'>('mention');
    mentionQuery = signal<string>('');
    mentionPopoverPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });

    /** Async mention/tag support */
    private readonly destroyRef = inject(DestroyRef);
    private readonly mentionSearchQuery$ = new Subject<{ type: 'mention' | 'tag'; query: string }>();
    loadedMentionItems = signal<(MentionItem | TagItem)[]>([]);
    mentionLoading = signal<boolean>(false);

    /** History for undo/redo */
    private history: HistoryEntry[] = [];
    private historyIndex = -1;
    private isUndoRedo = false;

    /** Saved selection for restoring after blur (e.g., emoji picker) */
    private savedRange: Range | null = null;

    /** ControlValueAccessor callbacks */
    private onChange: (value: string) => void = () => { };
    private onTouched: () => void = () => { };

    // === COMPUTED VALUES ===

    editorContainerClasses = computed(() =>
        cn(
            editorVariants({ variant: this.variant(), size: this.size() }),
            this.disabled() && 'opacity-50 cursor-not-allowed',
            this.readonly() && 'bg-muted',
            this.class()
        )
    );

    editableClasses = computed(() =>
        cn(
            'w-full h-full overflow-auto p-3 outline-none',
            '[&:empty]:before:content-[attr(placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:pointer-events-none',
            'prose prose-sm dark:prose-invert max-w-none',
            '[&_*]:outline-none',
            // Heading styling - explicit to ensure visibility
            '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2',
            '[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2',
            '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1',
            // List styling - explicit to ensure visibility
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2',
            '[&_li]:my-1',
            // Code styling
            '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
            '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto',
            '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
            'disabled:cursor-not-allowed'
        )
    );

    /** Get HTML output (always sanitized) */
    htmlOutput = computed(() => {
        return this.sanitizer.sanitize(this.htmlContent());
    });

    /** Get Markdown output */
    markdownOutput = computed(() => {
        return this.markdownService.toMarkdown(this.htmlContent());
    });

    /** Character count */
    characterCount = computed(() => {
        return this.sanitizer.stripTags(this.htmlContent()).length;
    });

    /** Filtered mention items based on query */
    filteredMentionItems = computed(() => {
        const query = this.mentionQuery().toLowerCase();
        const source = this.mentionType() === 'mention'
            ? this.mentionSource()
            : this.tagSource();

        // If source is Observable, use loadedMentionItems (populated by async subscription)
        if (isObservable(source)) {
            return this.loadedMentionItems();
        }

        // Static array: filter locally
        const items = source as (MentionItem | TagItem)[];
        if (!query) return items.slice(0, 10);

        return items
            .filter(item =>
                item.label.toLowerCase().includes(query) ||
                item.value.toLowerCase().includes(query)
            )
            .slice(0, 10);
    });

    /** Currently selected image for resizing */
    selectedImage = signal<HTMLImageElement | null>(null);

    onEditorClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (target.tagName === 'IMG') {
            this.selectedImage.set(target as HTMLImageElement);
        } else {
            this.selectedImage.set(null);
        }
    }

    onImageResizeEnd(): void {
        this.syncContentFromEditor();
        this.pushHistory();
    }

    constructor() {
        // Effect to emit HTML changes
        effect(() => {
            const html = this.htmlOutput();
            this.htmlChange.emit(html);
        });

        // Effect to emit Markdown changes
        effect(() => {
            const md = this.markdownOutput();
            this.markdownChange.emit(md);
        });

        // Async mention/tag search subscription
        this.mentionSearchQuery$.pipe(
            debounceTime(200),
            tap(() => this.mentionLoading.set(true)),
            switchMap(({ type, query }) => {
                const source = type === 'mention'
                    ? this.mentionSource()
                    : this.tagSource();

                if (!isObservable(source)) {
                    // Static array - filter locally
                    const items = source as (MentionItem | TagItem)[];
                    const filtered = query
                        ? items.filter(item =>
                            item.label.toLowerCase().includes(query.toLowerCase()) ||
                            item.value.toLowerCase().includes(query.toLowerCase())
                        )
                        : items;
                    return of(filtered.slice(0, 10));
                }

                // Observable source - the source should handle filtering based on query
                // We pass the query through and let the source handle it
                return (source as Observable<(MentionItem | TagItem)[]>).pipe(
                    catchError(() => of([] as (MentionItem | TagItem)[])),
                );
            }),
            takeUntilDestroyed(),
        ).subscribe(items => {
            this.loadedMentionItems.set(items);
            this.mentionLoading.set(false);
        });
    }

    ngOnInit() {
        this.pushHistory();
    }

    ngAfterViewInit() {
        // Initial sync
        if (this.editorDiv?.nativeElement) {
            this.editorDiv.nativeElement.innerHTML = this.htmlContent();
        }
    }

    ngOnDestroy() {
        // Cleanup
    }

    // === ControlValueAccessor ===

    writeValue(value: string): void {
        if (value === null || value === undefined) {
            value = '';
        }

        // If mode is markdown, convert to HTML for display
        if (this.mode() === 'markdown' && value) {
            this.htmlContent.set(this.markdownService.toHtml(value));
        } else {
            this.htmlContent.set(this.sanitizer.sanitize(value));
        }

        // Sync to editor
        if (this.editorDiv?.nativeElement) {
            this.editorDiv.nativeElement.innerHTML = this.htmlContent();
        }
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        // Handled via input()
    }

    // === EVENT HANDLERS ===

    onInput(event: Event): void {
        const div = event.target as HTMLDivElement;
        const html = this.sanitizer.sanitize(div.innerHTML);

        // Check for mention/tag triggers
        const textContent = div.textContent ?? '';
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            this.checkMentionTrigger(textContent, this.getCaretOffset(div));
        }

        this.htmlContent.set(html);

        // Emit value based on mode
        const outputValue = this.mode() === 'markdown'
            ? this.markdownService.toMarkdown(html)
            : html;
        this.onChange(outputValue);

        if (!this.isUndoRedo) {
            this.pushHistory();
        }
        this.isUndoRedo = false;
    }

    onKeydown(event: KeyboardEvent): void {
        // Forward keyboard events to mention popover when open
        if (this.mentionPopoverOpen() && this.mentionPopover) {
            const popoverKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
            if (popoverKeys.includes(event.key)) {
                event.preventDefault();
                this.mentionPopover.onKeydown(event);
                return;
            }
        }

        // Keyboard shortcuts
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 'b':
                    event.preventDefault();
                    this.onFormatCommand('bold');
                    break;
                case 'i':
                    event.preventDefault();
                    this.onFormatCommand('italic');
                    break;
                case 'u':
                    event.preventDefault();
                    this.onFormatCommand('underline');
                    break;
                case 'k':
                    event.preventDefault();
                    this.showLinkDialog();
                    break;
                case 'z':
                    event.preventDefault();
                    if (event.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    event.preventDefault();
                    this.redo();
                    break;
            }
        }

        // Escape to close popovers
        if (event.key === 'Escape') {
            this.closeMentionPopover();
            this.showFloatingToolbar.set(false);
        }

        // Tab key - insert tab character instead of moving focus
        if (event.key === 'Tab' && !this.mentionPopoverOpen()) {
            event.preventDefault();
            this.document.execCommand('insertText', false, '\t');
        }

        // Enter key - handle code blocks specially
        if (event.key === 'Enter' && !event.shiftKey) {
            const selection = this.document.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let node: Node | null = range.startContainer;

                // Check if we're in a pre/code block
                let preElement: HTMLPreElement | null = null;
                while (node && node !== this.editorDiv?.nativeElement) {
                    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'PRE') {
                        preElement = node as HTMLPreElement;
                        break;
                    }
                    node = node.parentNode;
                }

                // If in a pre block, handle Enter specially
                if (preElement) {
                    event.preventDefault();

                    const codeElement = preElement.querySelector('code');
                    const textNode = codeElement || preElement;
                    const textContent = textNode.textContent || '';

                    // Check if we should exit (text ends with newline, meaning user is on empty line)
                    if (textContent.endsWith('\n')) {
                        // Exit the code block - remove trailing newline and create paragraph after
                        textNode.textContent = textContent.slice(0, -1);

                        // Create a new paragraph after the pre block
                        const p = this.document.createElement('p');
                        p.innerHTML = '<br>';
                        preElement.parentNode?.insertBefore(p, preElement.nextSibling);

                        // Move cursor to the new paragraph
                        const newRange = this.document.createRange();
                        newRange.setStart(p, 0);
                        newRange.setEnd(p, 0);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    } else {
                        // Insert a newline character at cursor position
                        const textNodeToInsert = this.document.createTextNode('\n');
                        range.deleteContents();
                        range.insertNode(textNodeToInsert);

                        // Move cursor after the newline
                        const newRange = this.document.createRange();
                        newRange.setStartAfter(textNodeToInsert);
                        newRange.setEndAfter(textNodeToInsert);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }

                    this.syncContentFromEditor();
                    this.pushHistory();
                }
            }
        }
    }

    onPaste(event: ClipboardEvent): void {
        event.preventDefault();

        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain') ?? '';

        // Sanitize and insert
        const sanitized = this.sanitizer.sanitize(html || text);
        this.insertHtml(sanitized);
        this.pushHistory();
    }

    onFocus(): void {
        this.focus.emit();
    }

    onBlur(): void {
        // Save current selection before blur (needed for emoji picker, etc.)
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }

        this.onTouched();
        this.blur.emit();
        // Delay hiding to allow click on toolbar
        setTimeout(() => {
            this.showFloatingToolbar.set(false);
        }, 200);
    }

    onSelectionChange(): void {
        // Update active formats
        this.updateActiveFormats();

        // Show/hide floating toolbar based on selection
        const selection = this.document.getSelection();
        if (selection && !selection.isCollapsed && this.toolbar() === 'floating') {
            this.updateFloatingToolbarPosition();
            this.showFloatingToolbar.set(true);
        } else if (this.toolbar() === 'floating') {
            // Small delay to allow clicking toolbar buttons
            setTimeout(() => {
                const sel = this.document.getSelection();
                if (!sel || sel.isCollapsed) {
                    this.showFloatingToolbar.set(false);
                }
            }, 100);
        }
    }

    // === FORMAT COMMANDS ===

    onFormatCommand(command: string): void {
        if (this.readonly() || this.disabled()) return;

        switch (command) {
            case 'bold':
                this.document.execCommand('bold', false);
                break;
            case 'italic':
                this.document.execCommand('italic', false);
                break;
            case 'underline':
                this.document.execCommand('underline', false);
                break;
            case 'strikethrough':
                this.document.execCommand('strikeThrough', false);
                break;
            case 'heading1':
                this.document.execCommand('formatBlock', false, '<h1>');
                break;
            case 'heading2':
                this.document.execCommand('formatBlock', false, '<h2>');
                break;
            case 'heading3':
                this.document.execCommand('formatBlock', false, '<h3>');
                break;
            case 'bulletList':
                this.document.execCommand('insertUnorderedList', false);
                break;
            case 'orderedList':
                this.document.execCommand('insertOrderedList', false);
                break;
            case 'blockquote':
                this.document.execCommand('formatBlock', false, '<blockquote>');
                break;
            case 'code':
                this.wrapSelectionWithTag('code');
                break;
            case 'codeBlock':
                this.insertCodeBlock();
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'clear':
                this.document.execCommand('removeFormat', false);
                break;
            case 'paragraph':
                this.document.execCommand('formatBlock', false, '<p>');
                break;
            case 'alignLeft':
                this.document.execCommand('justifyLeft', false);
                break;
            case 'alignCenter':
                this.document.execCommand('justifyCenter', false);
                break;
            case 'alignRight':
                this.document.execCommand('justifyRight', false);
                break;
        }

        // Update content after command
        if (this.editorDiv?.nativeElement) {
            const html = this.sanitizer.sanitize(this.editorDiv.nativeElement.innerHTML);
            this.htmlContent.set(html);

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(html)
                : html;
            this.onChange(outputValue);
        }

        this.focusEditor();
        this.updateActiveFormats();
        this.pushHistory();

        // For floating toolbar: after applying format, move cursor outside the formatted element
        // This prevents the format from continuing when user starts typing new text
        if (this.toolbar() === 'floating') {
            const selection = this.document.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);

                // Collapse to end of selection first
                range.collapse(false);

                // Find the nearest inline formatting element (b, strong, i, em, u, etc.)
                let formattedNode = range.startContainer;
                while (formattedNode && formattedNode !== this.editorDiv?.nativeElement) {
                    if (formattedNode.nodeType === Node.ELEMENT_NODE) {
                        const tagName = (formattedNode as Element).tagName.toLowerCase();
                        if (['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code'].includes(tagName)) {
                            // Move cursor after this element
                            const newRange = this.document.createRange();
                            newRange.setStartAfter(formattedNode);
                            newRange.setEndAfter(formattedNode);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                            break;
                        }
                    }
                    formattedNode = formattedNode.parentNode!;
                }
            }
            this.showFloatingToolbar.set(false);
        }
    }

    /** Floating toolbar format command - applies once and closes toolbar (not a toggle) */
    onFloatingFormatCommand(command: string): void {
        if (this.readonly() || this.disabled()) return;

        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        // Tag mapping for inline formats
        const inlineTagMap: Record<string, string> = {
            bold: 'b',
            italic: 'i',
            underline: 'u',
            strikethrough: 's',
        };

        if (inlineTagMap[command] && selectedText) {
            // Manually wrap the selection with the tag
            const tag = inlineTagMap[command];
            const wrapper = this.document.createElement(tag);

            // Extract the selected content
            const fragment = range.extractContents();
            wrapper.appendChild(fragment);

            // Insert the wrapper
            range.insertNode(wrapper);

            // Insert an empty text node AFTER the wrapper to place cursor outside
            const spaceNode = this.document.createTextNode('\u200B'); // Zero-width space
            wrapper.parentNode?.insertBefore(spaceNode, wrapper.nextSibling);

            // Create range for cursor position BEFORE any focus changes
            const cursorRange = this.document.createRange();
            cursorRange.setStart(spaceNode, 1);
            cursorRange.setEnd(spaceNode, 1);

            // Sync content
            if (this.editorDiv?.nativeElement) {
                const html = this.sanitizer.sanitize(this.editorDiv.nativeElement.innerHTML);
                this.htmlContent.set(html);

                const outputValue = this.mode() === 'markdown'
                    ? this.markdownService.toMarkdown(html)
                    : html;
                this.onChange(outputValue);
            }

            this.showFloatingToolbar.set(false);

            // Focus first, then restore selection
            this.editorDiv?.nativeElement?.focus();
            selection.removeAllRanges();
            selection.addRange(cursorRange);

            this.pushHistory();
            return; // Early return for inline formats
        }

        if (command === 'clear') {
            this.document.execCommand('removeFormat', false);
            selection.collapseToEnd();
        } else if (command === 'heading1' || command === 'heading2' || command === 'heading3') {
            const level = command.replace('heading', '');
            this.document.execCommand('formatBlock', false, `<h${level}>`);
            selection.collapseToEnd();
        } else if (command === 'bulletList') {
            this.document.execCommand('insertUnorderedList', false);
            selection.collapseToEnd();
        } else if (command === 'orderedList') {
            this.document.execCommand('insertOrderedList', false);
            selection.collapseToEnd();
        }

        // Sync content for non-inline formats
        if (this.editorDiv?.nativeElement) {
            const html = this.sanitizer.sanitize(this.editorDiv.nativeElement.innerHTML);
            this.htmlContent.set(html);

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(html)
                : html;
            this.onChange(outputValue);
        }

        this.showFloatingToolbar.set(false);
        this.focusEditor();
        this.pushHistory();
    }

    onLinkInsert(data: { text: string; url: string }): void {
        const safeUrl = this.sanitizer.sanitizeUrl(data.url);
        if (safeUrl) {
            const selection = this.document.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();

                const link = this.document.createElement('a');
                link.href = safeUrl;
                link.rel = 'noopener noreferrer';
                link.textContent = data.text || safeUrl;
                range.insertNode(link);

                // Move cursor after link
                range.setStartAfter(link);
                range.setEndAfter(link);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            this.syncContentFromEditor();
            this.pushHistory();
        }
    }

    onImageInsert(data: { alt: string; src: string }): void {
        this.restoreSelection();
        const safeSrc = this.sanitizer.sanitizeImageSrc(data.src);
        if (safeSrc) {
            this.insertHtml(`<img src="${safeSrc}" alt="${data.alt}">`);
            this.pushHistory();
            this.syncContentFromEditor();
        }
    }

    onEmojiInsert(emoji: string): void {
        // Restore saved selection if we lost focus (e.g., clicking emoji picker)
        this.restoreSelection();
        this.insertText(emoji);
        // Save the new position for subsequent emoji insertions
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }
    }

    onColorSelect(event: { type: 'fontColor' | 'backgroundColor'; color: string }): void {
        // Restore saved selection if we lost focus
        this.restoreSelection();

        if (event.type === 'fontColor') {
            this.document.execCommand('foreColor', false, event.color);
        } else {
            // hiliteColor doesn't work in all browsers, use backColor as fallback
            if (!this.document.execCommand('hiliteColor', false, event.color)) {
                this.document.execCommand('backColor', false, event.color);
            }
        }

        // Update content after command
        if (this.editorDiv?.nativeElement) {
            const html = this.sanitizer.sanitize(this.editorDiv.nativeElement.innerHTML);
            this.htmlContent.set(html);

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(html)
                : html;
            this.onChange(outputValue);
        }

        this.focusEditor();
        this.pushHistory();
    }

    onFontSizeSelect(size: string): void {
        // Restore saved selection if we lost focus
        this.restoreSelection();

        // 1. Apply a unique font size (7 is the largest standard HTML size)
        this.document.execCommand('fontSize', false, '7');

        // 2. Find all <font size="7"> elements created by the command
        // Note: Browsers might nest them or apply to existing ones.
        // We scope this to the editor to avoid affecting outside elements.
        if (this.editorDiv?.nativeElement) {
            const fontElements = this.editorDiv.nativeElement.querySelectorAll('font[size="7"]');

            // 3. Convert them to spans with the custom pixel size
            fontElements.forEach((font: Element) => {
                const el = font as HTMLElement;
                // Create a span with the correct style
                const span = this.document.createElement('span');
                const sizeVal = size.endsWith('px') ? size : `${size}px`;
                span.style.fontSize = sizeVal;

                // Move children to span
                while (el.firstChild) {
                    span.appendChild(el.firstChild);
                }

                // Replace font with span
                el.parentNode?.replaceChild(span, el);
            });
        }

        // 4. Update content
        this.syncContentFromEditor();
        this.focusEditor();
        this.pushHistory();
    }

    // === MENTION/TAG HANDLING ===

    private getCaretOffset(element: HTMLElement): number {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return 0;

        const range = selection.getRangeAt(0).cloneRange();
        range.selectNodeContents(element);
        range.setEnd(selection.anchorNode!, selection.anchorOffset);
        return range.toString().length;
    }

    private checkMentionTrigger(text: string, cursorPosition: number): void {
        const beforeCursor = text.substring(0, cursorPosition);

        if (this.mentions()) {
            const mentionMatch = beforeCursor.match(/@(\w*)$/);
            if (mentionMatch) {
                this.mentionType.set('mention');
                this.mentionQuery.set(mentionMatch[1]);
                this.updateMentionPopoverPosition();
                this.mentionPopoverOpen.set(true);
                // Trigger async search
                this.mentionSearchQuery$.next({ type: 'mention', query: mentionMatch[1] });
                return;
            }
        }

        if (this.tags()) {
            const tagMatch = beforeCursor.match(/#(\w*)$/);
            if (tagMatch) {
                this.mentionType.set('tag');
                this.mentionQuery.set(tagMatch[1]);
                this.updateMentionPopoverPosition();
                this.mentionPopoverOpen.set(true);
                // Trigger async search
                this.mentionSearchQuery$.next({ type: 'tag', query: tagMatch[1] });
                return;
            }
        }

        this.closeMentionPopover();
    }

    onMentionSelect(item: MentionItem | TagItem): void {
        const trigger = this.mentionType() === 'mention' ? '@' : '#';
        const dataAttr = this.mentionType() === 'mention'
            ? `data-mention="${item.value}" data-mention-id="${item.id ?? item.value}"`
            : `data-tag="${item.value}" data-tag-id="${item.id ?? item.value}"`;

        // Delete the trigger + query text, then insert the mention span
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            // Move back to delete trigger + query
            const query = this.mentionQuery();
            for (let i = 0; i <= query.length; i++) {
                this.document.execCommand('delete', false);
            }

            this.insertHtml(`<span ${dataAttr} class="bg-accent text-accent-foreground rounded px-1">${trigger}${item.label}</span>&nbsp;`);
        }

        this.syncContentFromEditor();
        this.closeMentionPopover();
        this.pushHistory();
        this.focusEditor();
    }

    closeMentionPopover(): void {
        this.mentionPopoverOpen.set(false);
        this.mentionQuery.set('');
    }

    // === HELPER METHODS ===

    private wrapSelectionWithTag(tagName: string): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const element = this.document.createElement(tagName);
            range.surroundContents(element);
        }
    }

    private insertCodeBlock(): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const pre = this.document.createElement('pre');
            const code = this.document.createElement('code');
            code.textContent = selection.toString() || '\n';
            pre.appendChild(code);
            range.deleteContents();
            range.insertNode(pre);

            // Move cursor inside code block
            const newRange = this.document.createRange();
            newRange.selectNodeContents(code);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }

    private showLinkDialog(): void {
        const url = prompt('Enter URL:');
        if (url) {
            const selection = this.document.getSelection();
            const text = selection?.toString() || 'Link';
            this.onLinkInsert({ text, url });
        }
    }

    private insertText(text: string): void {
        this.document.execCommand('insertText', false, text);
        this.syncContentFromEditor();
    }

    private insertHtml(html: string): void {
        const sanitized = this.sanitizer.sanitize(html);
        this.document.execCommand('insertHTML', false, sanitized);
        this.syncContentFromEditor();
    }

    private syncContentFromEditor(): void {
        if (this.editorDiv?.nativeElement) {
            const html = this.sanitizer.sanitize(this.editorDiv.nativeElement.innerHTML);
            this.htmlContent.set(html);

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(html)
                : html;
            this.onChange(outputValue);
        }
    }

    private focusEditor(): void {
        this.editorDiv?.nativeElement?.focus();
    }

    private restoreSelection(): void {
        if (this.savedRange && this.editorDiv?.nativeElement) {
            this.focusEditor();
            const selection = this.document.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(this.savedRange);
            }
        }
    }

    private updateActiveFormats(): void {
        const formats = new Set<string>();

        if (this.document.queryCommandState('bold')) formats.add('bold');
        if (this.document.queryCommandState('italic')) formats.add('italic');
        if (this.document.queryCommandState('underline')) formats.add('underline');
        if (this.document.queryCommandState('strikeThrough')) formats.add('strikethrough');
        if (this.document.queryCommandState('insertUnorderedList')) formats.add('bulletList');
        if (this.document.queryCommandState('insertOrderedList')) formats.add('orderedList');

        this.activeFormats.set(formats);
    }

    private updateFloatingToolbarPosition(): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Position above the selection
            this.floatingToolbarPosition.set({
                x: rect.left + rect.width / 2 - 100, // Center toolbar
                y: rect.top - 45, // Above selection
            });
        }
    }

    private updateMentionPopoverPosition(): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const editorRect = this.el.nativeElement.getBoundingClientRect();

            this.mentionPopoverPosition.set({
                x: rect.left - editorRect.left,
                y: rect.bottom - editorRect.top + 5,
            });
        }
    }

    private getMentionSource(): MentionItem[] {
        const source = this.mentionSource();
        return Array.isArray(source) ? source : [];
    }

    private getTagSource(): TagItem[] {
        const source = this.tagSource();
        return Array.isArray(source) ? source : [];
    }

    // === UNDO/REDO ===

    private pushHistory(): void {
        const entry: HistoryEntry = {
            html: this.htmlContent(),
            selectionStart: 0,
            selectionEnd: 0,
        };

        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(entry);
        this.historyIndex = this.history.length - 1;

        if (this.history.length > 100) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    private undo(): void {
        if (this.historyIndex > 0) {
            this.isUndoRedo = true;
            this.historyIndex--;
            const entry = this.history[this.historyIndex];
            this.htmlContent.set(entry.html);

            if (this.editorDiv?.nativeElement) {
                this.editorDiv.nativeElement.innerHTML = entry.html;
            }

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(entry.html)
                : entry.html;
            this.onChange(outputValue);
        }
    }

    private redo(): void {
        if (this.historyIndex < this.history.length - 1) {
            this.isUndoRedo = true;
            this.historyIndex++;
            const entry = this.history[this.historyIndex];
            this.htmlContent.set(entry.html);

            if (this.editorDiv?.nativeElement) {
                this.editorDiv.nativeElement.innerHTML = entry.html;
            }

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(entry.html)
                : entry.html;
            this.onChange(outputValue);
        }
    }
}
