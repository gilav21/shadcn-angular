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
    forwardRef,
    effect,
    AfterViewInit,
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

interface HistoryEntry {
    html: string;
    selectionStart: number;
    selectionEnd: number;
}

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
export class RichTextEditorComponent implements ControlValueAccessor, OnInit, AfterViewInit {
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly markdownService = inject(RichTextMarkdownService);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly document = inject(DOCUMENT);
    private readonly el = inject(ElementRef);

    @ViewChild('editorDiv') editorDiv?: ElementRef<HTMLDivElement>;
    @ViewChild(RichTextMentionPopoverComponent) mentionPopover?: RichTextMentionPopoverComponent;

    mode = input<EditorMode>('markdown');
    variant = input<EditorVariant>('default');
    size = input<EditorSize>('default');
    toolbar = input<ToolbarPosition>('top');
    toolbarItems = input<ToolbarItem[]>(DEFAULT_TOOLBAR_ITEMS);
    placeholder = input<string>('Write something...');
    minHeight = input<string>('120px');
    maxHeight = input<string>('400px');
    disabled = input<boolean>(false);
    readonly = input<boolean>(false);
    mentions = input<boolean>(false);
    mentionSource = input<Observable<MentionItem[]> | MentionItem[]>([]);
    tags = input<boolean>(false);
    tagSource = input<Observable<TagItem[]> | TagItem[]>([]);
    emojiPicker = input<boolean>(true);
    images = input<boolean>(true);
    imageUploader = input<((file: File) => Observable<string>) | undefined>(undefined);
    imageSources = input<'all' | 'upload' | 'url'>('all');
    showCount = input<boolean>(false);
    maxLength = input<number | undefined>(undefined);
    class = input<string>('');
    ariaLabel = input<string | undefined>(undefined);
    ariaDescribedBy = input<string | undefined>(undefined);

    htmlChange = output<string>();
    markdownChange = output<string>();
    focus = output<void>();
    blur = output<void>();

    private htmlContent = signal<string>('');
    activeFormats = signal<Set<string>>(new Set());
    showFloatingToolbar = signal<boolean>(false);
    floatingToolbarPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    readonly emptyFormats = new Set<string>();
    mentionPopoverOpen = signal<boolean>(false);
    mentionType = signal<'mention' | 'tag'>('mention');
    mentionQuery = signal<string>('');
    mentionPopoverPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    private readonly mentionSearchQuery$ = new Subject<{ type: 'mention' | 'tag'; query: string }>();
    loadedMentionItems = signal<(MentionItem | TagItem)[]>([]);
    mentionLoading = signal<boolean>(false);
    selectedImage = signal<HTMLImageElement | null>(null);

    private history: HistoryEntry[] = [];
    private historyIndex = -1;
    private isUndoRedo = false;
    private savedRange: Range | null = null;
    private onChange: (value: string) => void = () => { };
    private onTouched: () => void = () => { };

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

    htmlOutput = computed(() => {
        return this.sanitizer.sanitize(this.htmlContent());
    });

    markdownOutput = computed(() => {
        return this.markdownService.toMarkdown(this.htmlContent());
    });

    characterCount = computed(() => {
        return this.sanitizer.stripTags(this.htmlContent()).length;
    });

    filteredMentionItems = computed(() => {
        const query = this.mentionQuery().toLowerCase();
        const source = this.mentionType() === 'mention'
            ? this.mentionSource()
            : this.tagSource();

        if (isObservable(source)) {
            return this.loadedMentionItems();
        }

        const items = source as (MentionItem | TagItem)[];
        if (!query) return items.slice(0, 10);

        return items
            .filter(item =>
                item.label.toLowerCase().includes(query) ||
                item.value.toLowerCase().includes(query)
            )
            .slice(0, 10);
    });


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
        effect(() => {
            const html = this.htmlOutput();
            this.htmlChange.emit(html);
        });
        effect(() => {
            const md = this.markdownOutput();
            this.markdownChange.emit(md);
        });

        this.mentionSearchQuery$.pipe(
            debounceTime(200),
            tap(() => this.mentionLoading.set(true)),
            switchMap(({ type, query }) => {
                const source = type === 'mention'
                    ? this.mentionSource()
                    : this.tagSource();

                if (!isObservable(source)) {
                    const items = source as (MentionItem | TagItem)[];
                    const filtered = query
                        ? items.filter(item =>
                            item.label.toLowerCase().includes(query.toLowerCase()) ||
                            item.value.toLowerCase().includes(query.toLowerCase())
                        )
                        : items;
                    return of(filtered.slice(0, 10));
                }

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
        if (this.editorDiv?.nativeElement) {
            this.editorDiv.nativeElement.innerHTML = this.htmlContent();
        }
    }

    writeValue(value: string): void {
        if (value === null || value === undefined) {
            value = '';
        }

        if (this.mode() === 'markdown' && value) {
            this.htmlContent.set(this.markdownService.toHtml(value));
        } else {
            this.htmlContent.set(this.sanitizer.sanitize(value));
        }

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

    onInput(event: Event): void {
        const div = event.target as HTMLDivElement;
        const html = this.sanitizer.sanitize(div.innerHTML);

        const textContent = div.textContent ?? '';
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            this.checkMentionTrigger(textContent, this.getCaretOffset(div));
        }

        this.htmlContent.set(html);

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
        if (this.mentionPopoverOpen() && this.mentionPopover) {
            const popoverKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
            if (popoverKeys.includes(event.key)) {
                event.preventDefault();
                this.mentionPopover.onKeydown(event);
                return;
            }
        }

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

        if (event.key === 'Escape') {
            this.closeMentionPopover();
            this.showFloatingToolbar.set(false);
        }

        if (event.key === 'Tab' && !this.mentionPopoverOpen()) {
            event.preventDefault();
            this.document.execCommand('insertText', false, '\t');
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            const selection = this.document.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let node: Node | null = range.startContainer;

                let preElement: HTMLPreElement | null = null;
                while (node && node !== this.editorDiv?.nativeElement) {
                    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'PRE') {
                        preElement = node as HTMLPreElement;
                        break;
                    }
                    node = node.parentNode;
                }

                if (preElement) {
                    event.preventDefault();

                    const codeElement = preElement.querySelector('code');
                    const textNode = codeElement || preElement;
                    const textContent = textNode.textContent || '';

                    if (textContent.endsWith('\n')) {
                        textNode.textContent = textContent.slice(0, -1);

                        const p = this.document.createElement('p');
                        p.innerHTML = '<br>';
                        preElement.parentNode?.insertBefore(p, preElement.nextSibling);

                        const newRange = this.document.createRange();
                        newRange.setStart(p, 0);
                        newRange.setEnd(p, 0);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    } else {
                        const textNodeToInsert = this.document.createTextNode('\n');
                        range.deleteContents();
                        range.insertNode(textNodeToInsert);

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

        const sanitized = this.sanitizer.sanitize(html || text);
        this.insertHtml(sanitized);
        this.pushHistory();
    }

    onFocus(): void {
        this.focus.emit();
    }

    onBlur(): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }

        this.onTouched();
        this.blur.emit();
        setTimeout(() => {
            this.showFloatingToolbar.set(false);
        }, 200);
    }

    onSelectionChange(): void {
        this.updateActiveFormats();

        const selection = this.document.getSelection();
        if (selection && !selection.isCollapsed && this.toolbar() === 'floating') {
            this.updateFloatingToolbarPosition();
            this.showFloatingToolbar.set(true);
        } else if (this.toolbar() === 'floating') {
            setTimeout(() => {
                const sel = this.document.getSelection();
                if (!sel || sel.isCollapsed) {
                    this.showFloatingToolbar.set(false);
                }
            }, 100);
        }
    }

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

        if (this.toolbar() === 'floating') {
            const selection = this.document.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);

                range.collapse(false);

                let formattedNode = range.startContainer;
                while (formattedNode && formattedNode !== this.editorDiv?.nativeElement) {
                    if (formattedNode.nodeType === Node.ELEMENT_NODE) {
                        const tagName = (formattedNode as Element).tagName.toLowerCase();
                        if (['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code'].includes(tagName)) {
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

    onFloatingFormatCommand(command: string): void {
        if (this.readonly() || this.disabled()) return;

        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        const inlineTagMap: Record<string, string> = {
            bold: 'b',
            italic: 'i',
            underline: 'u',
            strikethrough: 's',
        };

        if (inlineTagMap[command] && selectedText) {
            const tag = inlineTagMap[command];
            const wrapper = this.document.createElement(tag);

            const fragment = range.extractContents();
            wrapper.appendChild(fragment);

            range.insertNode(wrapper);

            const spaceNode = this.document.createTextNode('\u200B');
            wrapper.parentNode?.insertBefore(spaceNode, wrapper.nextSibling);

            const cursorRange = this.document.createRange();
            cursorRange.setStart(spaceNode, 1);
            cursorRange.setEnd(spaceNode, 1);

            if (this.editorDiv?.nativeElement) {
                const html = this.sanitizer.sanitize(this.editorDiv.nativeElement.innerHTML);
                this.htmlContent.set(html);

                const outputValue = this.mode() === 'markdown'
                    ? this.markdownService.toMarkdown(html)
                    : html;
                this.onChange(outputValue);
            }

            this.showFloatingToolbar.set(false);

            this.editorDiv?.nativeElement?.focus();
            selection.removeAllRanges();
            selection.addRange(cursorRange);

            this.pushHistory();
            return;
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
        this.restoreSelection();
        this.insertText(emoji);
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }
    }

    onColorSelect(event: { type: 'fontColor' | 'backgroundColor'; color: string }): void {
        this.restoreSelection();

        if (event.type === 'fontColor') {
            this.document.execCommand('foreColor', false, event.color);
        } else {
            if (!this.document.execCommand('hiliteColor', false, event.color)) {
                this.document.execCommand('backColor', false, event.color);
            }
        }

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
        this.restoreSelection();

        this.document.execCommand('fontSize', false, '7');

        if (this.editorDiv?.nativeElement) {
            const fontElements = this.editorDiv.nativeElement.querySelectorAll('font[size="7"]');

            fontElements.forEach((font: Element) => {
                const el = font as HTMLElement;
                const span = this.document.createElement('span');
                const sizeVal = size.endsWith('px') ? size : `${size}px`;
                span.style.fontSize = sizeVal;

                while (el.firstChild) {
                    span.appendChild(el.firstChild);
                }

                el.parentNode?.replaceChild(span, el);
            });
        }

        this.syncContentFromEditor();
        this.focusEditor();
        this.pushHistory();
    }

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

        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

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

            this.floatingToolbarPosition.set({
                x: rect.left + rect.width / 2 - 100,
                y: rect.top - 45,
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
