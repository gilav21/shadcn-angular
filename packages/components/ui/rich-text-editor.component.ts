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
import { cn } from '../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { RichTextMarkdownService } from './rich-text-markdown.service';
import { Observable, isObservable, of, Subject, firstValueFrom } from 'rxjs';
import { debounceTime, switchMap, catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RichTextToolbarComponent, ToolbarItem } from './rich-text-toolbar.component';
import { MentionItem, RichTextMentionPopoverComponent, TagItem } from './rich-text-mention.component';
import { RichTextImageResizerComponent } from './rich-text-image-resizer.component';
import { ButtonComponent } from './button.component';

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
    imports: [
        RichTextToolbarComponent,
        RichTextMentionPopoverComponent,
        RichTextImageResizerComponent,
        ButtonComponent,
    ],
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
        [selectedText]="selectedText()"
        [disabled]="disabled()"
        [readonly]="readonly()"
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
        (beforeinput)="onBeforeInput($event)"
        (keydown)="onKeydown($event)"
        (paste)="onPaste($event)"
        (focus)="onFocus()"
        (blur)="onBlur($event)"
        (mouseup)="onSelectionChange()"
        (keyup)="onSelectionChange()"
        (click)="onEditorClick($event)"
        (dragover)="onEditorDragOver($event)"
        (dragleave)="onEditorDragLeave($event)"
        (drop)="onEditorDrop($event)"
      ></div>

      @if (dragOver()) {
        <div class="absolute inset-0 pointer-events-none border-2 border-dashed border-primary/60 rounded-md bg-primary/5"></div>
      }

      @if (imageUploading()) {
        <div class="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div class="text-sm text-muted-foreground">Uploading image...</div>
        </div>
      }

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
            [selectedText]="selectedText()"
            [compact]="true"
            [disabled]="disabled()"
            [readonly]="readonly()"
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

      @if (showLinkPopover()) {
        <div 
          class="fixed z-50 bg-popover border rounded-lg shadow-lg p-4 w-80"
          [style.left.px]="linkPopoverPosition().x"
          [style.top.px]="linkPopoverPosition().y"
        >
          <div class="space-y-3">
            <div>
              <label class="text-sm font-medium mb-1 block">Link Text</label>
              <input
                #linkText
                type="text"
                [value]="selectedText()"
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
            <div class="flex gap-2">
              <ui-button 
                size="sm" 
                class="flex-1"
                (click)="insertLinkFromPopover(linkText.value, linkUrl.value)"
              >
                Insert Link
              </ui-button>
              <ui-button 
                variant="outline"
                size="sm" 
                (click)="closeLinkPopover()"
              >
                Cancel
              </ui-button>
            </div>
          </div>
        </div>
      }
    </div>

    @if (showCount() || showWordCount()) {
      <div class="flex justify-end text-xs text-muted-foreground mt-1 px-1">
        @if (showCount()) {
          <span>{{ characterCount() }} characters</span>
        }
        @if (showWordCount()) {
          <span [class.ml-3]="showCount()">{{ wordCount() }} words</span>
        }
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
    showWordCount = input<boolean>(false);
    maxLength = input<number | undefined>(undefined);
    historyLimit = input<number>(100);
    class = input<string>('');
    ariaLabel = input<string | undefined>(undefined);
    ariaDescribedBy = input<string | undefined>(undefined);

    htmlChange = output<string>();
    markdownChange = output<string>();
    wordCountChange = output<number>();
    focus = output<void>();
    blur = output<void>();
    imageUploadStart = output<File>();
    imageUploadComplete = output<string>();
    imageUploadError = output<string>();

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
    showLinkPopover = signal<boolean>(false);
    linkPopoverPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    selectedText = signal<string>('');
    dragOver = signal<boolean>(false);
    imageUploading = signal<boolean>(false);

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
            // Link styling
            '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:cursor-pointer [&_a]:font-medium hover:[&_a]:text-primary/80',
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

    wordCount = computed(() => {
        const text = this.sanitizer.stripTags(this.htmlContent()).trim();
        if (!text) return 0;
        return text.split(/\s+/).length;
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
        effect(() => {
            this.wordCountChange.emit(this.wordCount());
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
            this.insertText('\t');
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

    onBeforeInput(event: Event): void {
        const inputEvent = event as InputEvent;
        if (!this.maxLength() || inputEvent.inputType.startsWith('delete') || inputEvent.inputType.startsWith('format')) {
            return;
        }

        const max = this.maxLength()!;
        const currentText = this.editorDiv?.nativeElement.textContent || '';
        const selection = this.document.getSelection();
        const selectedLength = selection && !selection.isCollapsed
            ? selection.toString().length
            : 0;
        const insertedLength = inputEvent.data?.length ?? 0;
        const nextLength = currentText.length - selectedLength + insertedLength;

        if (nextLength > max) {
            event.preventDefault();
        }
    }

    async onPaste(event: ClipboardEvent): Promise<void> {
        event.preventDefault();

        if (this.disabled() || this.readonly()) {
            return;
        }

        const imageFile = Array.from(event.clipboardData?.files ?? []).find(file => file.type.startsWith('image/'));
        if (imageFile && this.images() && this.canUseUploadSource()) {
            await this.uploadImageFile(imageFile);
            return;
        }

        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain') ?? '';

        if (this.maxLength()) {
            const max = this.maxLength()!;
            const currentText = this.editorDiv?.nativeElement.textContent || '';
            const selectedLength = this.getSelectedTextLength();
            const remaining = max - (currentText.length - selectedLength);

            if (remaining <= 0) {
                return;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html || text, 'text/html');
            const pasteText = doc.body.textContent || '';

            if (pasteText.length > remaining) {
                const truncated = pasteText.substring(0, remaining);
                this.insertText(truncated);
                this.pushHistory();
                return;
            }
        }





        const sanitized = this.sanitizer.sanitize(html || text);
        this.insertHtml(sanitized);
        this.pushHistory();
    }

    onEditorDragOver(event: DragEvent): void {
        if (!this.images() || !this.canUseUploadSource() || this.disabled() || this.readonly()) {
            return;
        }
        const hasImage = Array.from(event.dataTransfer?.files ?? []).some(file => file.type.startsWith('image/'));
        if (!hasImage) {
            return;
        }
        event.preventDefault();
        this.dragOver.set(true);
    }

    onEditorDragLeave(event: DragEvent): void {
        if (!event.currentTarget) {
            this.dragOver.set(false);
            return;
        }
        const current = event.currentTarget as HTMLElement;
        const related = event.relatedTarget as Node | null;
        if (!related || !current.contains(related)) {
            this.dragOver.set(false);
        }
    }

    async onEditorDrop(event: DragEvent): Promise<void> {
        this.dragOver.set(false);
        if (!this.images() || !this.canUseUploadSource() || this.disabled() || this.readonly()) {
            return;
        }

        const imageFile = Array.from(event.dataTransfer?.files ?? []).find(file => file.type.startsWith('image/'));
        if (!imageFile) {
            return;
        }

        event.preventDefault();
        await this.uploadImageFile(imageFile);
    }

    onFocus(): void {
        this.focus.emit();
    }

    onBlur(event?: FocusEvent): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }

        this.onTouched();
        this.blur.emit();

        // Don't close floating toolbar if link popover is open
        if (this.showLinkPopover()) {
            return;
        }

        // Check regarding target to avoid timeouts
        const relatedTarget = event?.relatedTarget as Node | null;
        if (relatedTarget && this.el.nativeElement.contains(relatedTarget)) {
            return;
        }

        setTimeout(() => {
            // Only hide if link popover is still not open AND focus is outside the component
            if (!this.showLinkPopover()) {
                const activeElement = this.document.activeElement;
                const isInsideComponent = this.el.nativeElement.contains(activeElement);
                if (!isInsideComponent) {
                    this.showFloatingToolbar.set(false);
                }
            }
        }, 200);
    }

    onSelectionChange(): void {
        this.updateActiveFormats();
        const selection = this.document.getSelection();
        this.selectedText.set(selection?.toString() || '');
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
        this.restoreSelection();
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
        if (this.imageSources() === 'upload') {
            this.imageUploadError.emit('Image URL insertion is disabled. Use upload source.');
            return;
        }
        this.restoreSelection();
        const safeSrc = this.sanitizer.sanitizeImageSrc(data.src);
        if (safeSrc) {
            this.insertHtml(`<img src="${safeSrc}" alt="${data.alt}">`);
            this.pushHistory();
            this.syncContentFromEditor();
        } else {
            this.imageUploadError.emit('Invalid image URL.');
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

        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const query = this.mentionQuery();
            const triggerLength = query.length + 1;

            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                const textNode = range.startContainer as Text;
                const deleteStart = Math.max(0, range.startOffset - triggerLength);
                range.setStart(textNode, deleteStart);
            }
            range.deleteContents();

            const wrapper = this.document.createElement('span');
            wrapper.className = 'bg-accent text-accent-foreground rounded px-1';
            if (this.mentionType() === 'mention') {
                wrapper.setAttribute('data-mention', item.value);
                wrapper.setAttribute('data-mention-id', item.id ?? item.value);
            } else {
                wrapper.setAttribute('data-tag', item.value);
                wrapper.setAttribute('data-tag-id', item.id ?? item.value);
            }
            wrapper.textContent = `${trigger}${item.label}`;

            range.insertNode(this.document.createTextNode('\u00A0'));
            range.insertNode(wrapper);

            const newRange = this.document.createRange();
            newRange.setStartAfter(wrapper.nextSibling ?? wrapper);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
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
            const fragment = range.extractContents();
            element.appendChild(fragment);
            range.insertNode(element);

            const newRange = this.document.createRange();
            newRange.setStartAfter(element);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
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
        const selection = this.document.getSelection();
        this.selectedText.set(selection?.toString() || '');

        // Explicitly save the range for later restoration
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }

        // Position popover near cursor
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const viewportWidth = this.document.defaultView?.innerWidth ?? 1024;
            const viewportHeight = this.document.defaultView?.innerHeight ?? 768;
            const width = 320;
            const height = 180;
            const x = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
            const y = Math.max(8, Math.min(rect.bottom + 8, viewportHeight - height - 8));
            this.linkPopoverPosition.set({
                x,
                y,
            });
        }

        this.showLinkPopover.set(true);
    }

    insertLinkFromPopover(text: string, url: string): void {
        if (url) {
            this.onLinkInsert({ text: text || this.selectedText(), url });
        }
        this.closeLinkPopover();
    }

    closeLinkPopover(): void {
        this.showLinkPopover.set(false);
        this.selectedText.set('');
        this.focusEditor();
    }

    private getSelectedTextLength(): number {
        const selection = this.document.getSelection();
        if (selection && !selection.isCollapsed) {
            return selection.toString().length;
        }
        return 0;
    }

    private canUseUploadSource(): boolean {
        return this.imageSources() === 'all' || this.imageSources() === 'upload';
    }

    private async uploadImageFile(file: File): Promise<void> {
        const uploader = this.imageUploader();
        if (!uploader) {
            this.imageUploadError.emit('No imageUploader configured.');
            return;
        }

        this.imageUploading.set(true);
        this.imageUploadStart.emit(file);

        try {
            const uploadedUrl = await firstValueFrom(uploader(file));
            const safeSrc = this.sanitizer.sanitizeImageSrc(uploadedUrl);
            if (!safeSrc) {
                this.imageUploadError.emit('Uploaded image URL is not allowed by sanitizer policy.');
                return;
            }
            this.insertHtml(`<img src="${safeSrc}" alt="${file.name}">`);
            this.pushHistory();
            this.imageUploadComplete.emit(safeSrc);
        } catch (error: any) {
            this.imageUploadError.emit(error?.message || 'Image upload failed.');
        } finally {
            this.imageUploading.set(false);
        }
    }

    private insertText(text: string): void {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0 || !this.editorDiv?.nativeElement) {
            this.editorDiv?.nativeElement?.appendChild(this.document.createTextNode(text));
            this.syncContentFromEditor();
            return;
        }
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = this.document.createTextNode(text);
        range.insertNode(textNode);

        const newRange = this.document.createRange();
        newRange.setStartAfter(textNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        this.syncContentFromEditor();
    }

    private insertHtml(html: string): void {
        const sanitized = this.sanitizer.sanitize(html);
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0 || !this.editorDiv?.nativeElement) {
            this.editorDiv?.nativeElement?.insertAdjacentHTML('beforeend', sanitized);
            this.syncContentFromEditor();
            return;
        }
        const range = selection.getRangeAt(0);
        range.deleteContents();

        const template = this.document.createElement('template');
        template.innerHTML = sanitized;
        const fragment = template.content.cloneNode(true) as DocumentFragment;
        const lastInserted = fragment.lastChild;
        range.insertNode(fragment);

        const newRange = this.document.createRange();
        if (lastInserted) {
            newRange.setStartAfter(lastInserted);
        } else {
            newRange.setStart(range.endContainer, range.endOffset);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
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
            const width = 220;
            const viewportWidth = this.document.defaultView?.innerWidth ?? 1024;
            const x = Math.max(8, Math.min(rect.left + rect.width / 2 - 100, viewportWidth - width - 8));
            const y = Math.max(8, rect.top - 45);

            this.floatingToolbarPosition.set({
                x,
                y,
            });
        }
    }

    private updateMentionPopoverPosition(): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const editorRect = this.el.nativeElement.getBoundingClientRect();
            const maxX = Math.max(0, editorRect.width - 280);
            const maxY = Math.max(0, editorRect.height - 200);
            const x = Math.max(0, Math.min(rect.left - editorRect.left, maxX));
            const y = Math.max(0, Math.min(rect.bottom - editorRect.top + 5, maxY));

            this.mentionPopoverPosition.set({
                x,
                y,
            });
        }
    }

    private pushHistory(): void {
        const currentHtml = this.htmlContent();
        const lastEntry = this.history[this.history.length - 1];
        if (lastEntry && lastEntry.html === currentHtml) {
            return;
        }

        const entry: HistoryEntry = {
            html: currentHtml,
            selectionStart: 0,
            selectionEnd: 0,
        };

        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(entry);
        this.historyIndex = this.history.length - 1;

        const maxEntries = Math.max(10, this.historyLimit());
        if (this.history.length > maxEntries) {
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
