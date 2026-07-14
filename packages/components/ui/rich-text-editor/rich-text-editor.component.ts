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
    OnDestroy,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { RichTextMarkdownService } from './rich-text-markdown.service';
import { RichTextPasteNormalizerService } from './rich-text-paste-normalizer.service';
import { Subscription } from 'rxjs';
import { AiProvider, AiTask, runAiTask } from '../../lib/ai';
import { RichTextToolbarComponent, ToolbarItem } from './sub/rich-text-toolbar.component';
import { ButtonComponent } from '../button';
import { ScrollAreaComponent } from '../scroll-area';
import { ShortcutBindingService, ShortcutComponentHandle, ShortcutRegistration } from '../../lib/shortcut-binding.service';
import {
    RichTextCommandRegistry,
    RichTextSlashCommand,
} from './rich-text-command-registry.service';
import { AddonSlotRegistry } from '../../lib/addon-slots';
import {
    RichTextEditorAddonHost,
    type RichTextToolbarSlot,
    type RichTextSelectionSnapshot,
    type RichTextSelectionInlineStyle,
    type RichTextInlineStyle,
    type RichTextHistoryEntrySnapshot,
} from './rich-text-editor.host';
import { RichTextLocale, RICH_TEXT_LOCALES } from './rich-text-locales';
import { createLocaleBindings, interpolate, type LocaleInput } from '../../lib/i18n';

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

/**
 * Visual style variant for the editor border and focus treatment.
 *
 * - `'default'` ג€” Standard bordered input with focus ring.
 * - `'ghost'` ג€” No visible border until focused, useful for inline editing.
 */
export type EditorVariant = VariantProps<typeof editorVariants>['variant'];

/**
 * Text size preset for the editor content area.
 *
 * - `'default'` ג€” Base text size (`text-base`).
 * - `'sm'` ג€” Compact text (`text-sm`), good for comment boxes.
 * - `'lg'` ג€” Larger text (`text-lg`), good for article editing.
 */
export type EditorSize = VariantProps<typeof editorVariants>['size'];

/**
 * Determines the output format and internal handling of content.
 *
 * - `'markdown'` ג€” Editor accepts and emits Markdown. HTML is converted
 *   to/from Markdown transparently using the built-in converter.
 * - `'html'` ג€” Editor works directly with raw HTML. No Markdown conversion.
 *
 * @default 'markdown'
 */
export type EditorMode = 'markdown' | 'html';

/**
 * Controls where (or whether) the formatting toolbar appears.
 *
 * - `'top'` ג€” Fixed toolbar above the editor area.
 * - `'floating'` ג€” Appears near the text selection, like Medium/Notion.
 * - `'none'` ג€” No toolbar rendered. Use keyboard shortcuts or slash commands instead.
 *
 * @default 'top'
 */
export type ToolbarPosition = 'top' | 'floating' | 'none';

export interface RichTextCustomToolbarItem {
    id: string;
    icon: string;
    tooltip: string;
    order?: number;
    isActive?: (formats: Set<string>) => boolean;
}

export interface RichTextEditorRef {
    insertText(text: string): void;
    insertHtml(html: string): void;
    focus(): void;
    getSelectedText(): string;
    getHtmlContent(): string;
}

interface HistoryEntry {
    html: string;
    delta: string | null;
    keyframe: boolean;
    selection: SerializedSelection | null;
    timestamp: number;
    preview: string;
    previewLines: string[];
    lineCount: number;
}

interface SerializedSelection {
    startPath: number[];
    startOffset: number;
    endPath: number[];
    endOffset: number;
}

/** A single entry in the document outline (table of contents). */
export interface OutlineHeading {
    /** Heading level, 1-6, derived from the tag name (h1-h6). */
    level: number;
    /** Trimmed text content of the heading. */
    text: string;
    /** Zero-based position of the heading within the document's heading list. */
    index: number;
}

/** CSS selector matching every heading element used by the outline. */
const OUTLINE_HEADING_SELECTOR = 'h1,h2,h3,h4,h5,h6';

/** Gap (px) left above a heading when the outline scrolls it into view. */
const OUTLINE_SCROLL_MARGIN = 12;

/** Maps a heading element to an {@link OutlineHeading} entry. */
function toOutlineHeading(element: Element, index: number): OutlineHeading {
    const level = Number.parseInt(element.tagName.charAt(1), 10);
    return {
        level,
        text: (element.textContent ?? '').trim(),
        index,
    };
}

/**
 * The default toolbar layout used when `[toolbarItems]` is not provided.
 * Groups: formatting | block type | lists | alignment | colors/size | insert | code | clear.
 */
export const DEFAULT_TOOLBAR_ITEMS: ToolbarItem[] = [
    'bold', 'italic', 'underline',
    'separator',
    'paragraph', 'heading1', 'heading2', 'heading3',
    'separator',
    'bulletList', 'orderedList', 'taskList',
    'separator',
    'indent', 'outdent',
    'separator',
    'alignLeft', 'alignCenter', 'alignRight',
    'separator',
    'importFile',
    'separator',
    'code', 'codeBlock',
    'separator',
    'horizontalRule',
    'separator',
    'clear',
];

export const RICH_TEXT_SHORTCUT_DEFINITIONS = [
    { actionId: 'rich-text.bold', description: 'Toggle bold', defaultShortcut: 'Mod+B', category: 'Formatting' },
    { actionId: 'rich-text.italic', description: 'Toggle italic', defaultShortcut: 'Mod+I', category: 'Formatting' },
    { actionId: 'rich-text.underline', description: 'Toggle underline', defaultShortcut: 'Mod+U', category: 'Formatting' },
    { actionId: 'rich-text.link', description: 'Insert link', defaultShortcut: 'Mod+K', category: 'Insert' },
    { actionId: 'rich-text.undo', description: 'Undo', defaultShortcut: 'Mod+Z', category: 'History' },
    { actionId: 'rich-text.redo', description: 'Redo', defaultShortcut: 'Mod+Shift+Z', category: 'History' },
    { actionId: 'rich-text.redo.alt', description: 'Redo (alternate)', defaultShortcut: 'Mod+Y', category: 'History' },
    { actionId: 'rich-text.history', description: 'Open revision history', defaultShortcut: 'Mod+Shift+H', category: 'History' },
    { actionId: 'rich-text.find', description: 'Find in editor', defaultShortcut: 'Mod+F', category: 'Navigation' },
    { actionId: 'rich-text.find-replace', description: 'Find and replace', defaultShortcut: 'Mod+H', category: 'Navigation' },
];

@Component({
    selector: 'ui-rich-text-editor',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgTemplateOutlet,
        RichTextToolbarComponent,
        ButtonComponent,
        ScrollAreaComponent,
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => RichTextEditorComponent),
            multi: true,
        },
        {
            provide: RichTextEditorAddonHost,
            useExisting: forwardRef(() => RichTextEditorComponent),
        },
    ],
    templateUrl: './rich-text-editor.component.html',
    host: {
        class: 'block',
    },
})
export class RichTextEditorComponent extends RichTextEditorAddonHost implements ControlValueAccessor, OnInit, AfterViewInit, OnDestroy {
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly markdownService = inject(RichTextMarkdownService);
    private readonly pasteNormalizer = inject(RichTextPasteNormalizerService);
    private readonly document = inject(DOCUMENT);
    private readonly el = inject(ElementRef);
    private readonly shortcutBindings = inject(ShortcutBindingService);
    private readonly commandRegistry = inject(RichTextCommandRegistry);

    @ViewChild('editorDiv') editorDiv?: ElementRef<HTMLDivElement>;
    @ViewChild('editorContainer') editorContainer?: ElementRef<HTMLElement>;
    @ViewChild('tableContextMenuRef') tableContextMenuRef?: ElementRef<HTMLDivElement>;

    // ג”€ג”€ Content & mode ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    /** Output format: `'markdown'` converts to/from Markdown; `'html'` works with raw HTML. */
    mode = input<EditorMode>('markdown');

    // ג”€ג”€ Appearance ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    /** Visual border/focus style. See {@link EditorVariant}. */
    variant = input<EditorVariant>('default');

    /** Text size preset for the editor content. See {@link EditorSize}. */
    size = input<EditorSize>('default');

    // ג”€ג”€ Toolbar ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    /** Where to render the formatting toolbar. See {@link ToolbarPosition}. */
    toolbar = input<ToolbarPosition>('top');

    /**
     * Which toolbar buttons to show and in what order.
     * Use `'separator'` to insert visual dividers between groups.
     * @see {@link ToolbarItem} for the full list of available items.
     * @see {@link DEFAULT_TOOLBAR_ITEMS} for the default set.
     */
    toolbarItems = input<ToolbarItem[]>(DEFAULT_TOOLBAR_ITEMS);

    customToolbarItems = input<RichTextCustomToolbarItem[]>([]);
    customToolbarAction = output<{ id: string; ref: RichTextEditorRef }>();

    // ג”€ג”€ Editor content area ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    /** Placeholder text shown when the editor is empty. Falls back to the locale default. */
    placeholder = input<string>('');

    /** CSS `min-height` for the editable area. Accepts any CSS length value. */
    minHeight = input<string>('120px');

    /** CSS `max-height` for the editable area (scrolls beyond this). Accepts any CSS length value. */
    maxHeight = input<string>('400px');

    /** Disables the editor entirely ג€” no input, no toolbar, no interactions. */
    disabled = input<boolean>(false);

    /** Makes the editor non-editable but still selectable/copyable. Hides the toolbar. */
    readonly = input<boolean>(false);

    /**
     * Bring-your-own AI hook. When provided, an "✨ Ask AI" affordance appears on
     * text selection and via the `/ai` slash command; when omitted, no AI UI is
     * shown (graceful degradation). The provider receives
     * an {@link AiRequest} and returns text, a Promise, or an Observable (the
     * latter may stream progressive output).
     */
    aiProvider = input<AiProvider | undefined>(undefined);
    readonly hasAi = computed(() => this.aiProvider() !== undefined);
    /** Emitted when an AI task starts / completes / errors. */
    readonly aiRequest = output<{ task: AiTask; prompt?: string }>();
    readonly aiResult = output<string>();
    readonly aiError = output<string>();

    // ג”€ג”€ Character & word count ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    /** Show a character count below the editor. */
    showCount = input<boolean>(false);

    /** Show a word count below the editor. */
    showWordCount = input<boolean>(false);

    /**
     * Maximum character limit. When set, the character counter turns red
     * and the editor emits warnings when approaching/exceeding the limit.
     * Does **not** prevent typing ג€” it's advisory only.
     */
    maxLength = input<number | undefined>(undefined);

    // ג”€ג”€ Revision history ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    /** Maximum number of history snapshots to retain. Oldest entries are dropped when exceeded. */
    historyLimit = input<number>(100);

    /**
     * Debounce interval in milliseconds for capturing history snapshots.
     * A snapshot is saved after the user stops typing for this duration.
     */
    historyDebounceMs = input<number>(450);

    // ג”€ג”€ Localisation ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    /**
     * Language/locale for all editor UI strings. Pass a locale key (e.g. `'en'`)
     * to use a built-in locale, or pass a full {@link RichTextLocale} object for
     * custom translations.
     */
    locale = input<LocaleInput<RichTextLocale>>();

    // ג”€ג”€ Styling & accessibility ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    /** Additional CSS classes merged onto the editor's root container. */
    class = input<string>('');

    /** Custom `aria-label` for the editable content area. Falls back to the locale default. */
    ariaLabel = input<string | undefined>(undefined);

    /** ID of an element that describes the editor, set as `aria-describedby`. */
    ariaDescribedBy = input<string | undefined>(undefined);

    private readonly i18n = createLocaleBindings(this.locale, RICH_TEXT_LOCALES);
    readonly resolvedLocale = this.i18n.t;
    readonly isRtl = this.i18n.isRtl;
    readonly dir = this.i18n.dir;

    /**
     * Base-owned slash commands surfaced to the slash-commands addon through the
     * host: the document-outline command, plus the AI command when an
     * `aiProvider` is set. The rest of the built-in commands live in the addon.
     */
    readonly builtinCommands = computed<readonly RichTextSlashCommand[]>(() => {
        const commands = [this.buildOutlineSlashCommand()];
        if (this.hasAi()) {
            commands.push(this.buildAiSlashCommand());
        }
        return commands;
    });

    /** Builds the `/ai` slash command (only registered when an `aiProvider` is set). */
    private buildAiSlashCommand(): RichTextSlashCommand {
        const a = this.aiLabels();
        return {
            id: 'insert.ai',
            label: a.slash,
            description: a.slashDescription,
            keywords: ['ai', 'assist', 'rewrite', 'summarize', 'generate'],
            order: 5,
            run: () => this.openAiPanel(),
        };
    }

    /** Builds the `/outline` slash command, which opens the document outline docked. */
    private buildOutlineSlashCommand(): RichTextSlashCommand {
        const l = this.resolvedLocale().slashCommands;
        return {
            id: 'view.outline',
            label: l.outline,
            description: l.outlineDescription,
            keywords: ['outline', 'toc', 'headings', 'contents'],
            order: 125,
            run: () => this.openOutlineDocked(),
        };
    }

    // ג”€ג”€ Outputs ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

    /** Emits the current content as an HTML string after every change. */
    htmlChange = output<string>();

    /**
     * Emits the current content as a Markdown string after every change.
     * Only meaningful when `mode` is `'markdown'` ג€” in `'html'` mode,
     * the Markdown is reverse-converted from HTML and may not round-trip perfectly.
     */
    markdownChange = output<string>();

    /** Emits the current word count after every content change. Pair with `[showWordCount]`. */
    wordCountChange = output<number>();

    /** Emits when the editor gains focus. */
    focused = output<void>();

    /** Emits when the editor loses focus. */
    blurred = output<void>();

    fileImportStart = output<File>();
    fileImportComplete = output<string>();
    fileImportError = output<string>();

    private readonly htmlContent = signal<string>('');
    activeFormats = signal<Set<string>>(new Set());
    currentFontSize = signal<string>('');
    currentFontFamily = signal<string>('');
    readonly currentFontColor = signal<string>('');
    readonly currentBackgroundColor = signal<string>('');
    /** Inline style at the caret, exposed to the colors/typography addons as raw browser values. */
    readonly selectionInlineStyle = computed<RichTextSelectionInlineStyle>(() => ({
        color: this.currentFontColor(),
        backgroundColor: this.currentBackgroundColor(),
        fontSize: this.currentFontSize(),
        fontFamily: this.currentFontFamily(),
    }));
    showFloatingToolbar = signal<boolean>(false);
    floatingToolbarPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    readonly emptyFormats = new Set<string>();
    selectedImage = signal<HTMLImageElement | null>(null);
    selectedText = signal<string>('');
    dragOver = signal<boolean>(false);
    fileImporting = signal<boolean>(false);
    fileImportErrorMessage = signal('');
    tableContextMenuOpen = signal(false);
    tableContextMenuPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    private tableContextMenuTarget: HTMLTableCellElement | null = null;
    private tableContextMenuCloseHandler: (() => void) | null = null;
    private tableResizeState: {
        table: HTMLTableElement;
        colIndex: number;
        startX: number;
        startWidths: number[];
        tableWidth: number;
    } | null = null;
    private readonly tableResizeCursor = signal(false);
    private readonly onTableResizeMoveBound = this.onTableResizeMove.bind(this);
    private readonly onTableResizeUpBound = this.onTableResizeUp.bind(this);
    tableCellColors = [
        'transparent', '#ffffff', '#fef3c7', '#d9f99d', '#bbf7d0', '#a5f3fc', '#c7d2fe', '#fce7f3',
        '#fecaca', '#fed7aa', '#fde68a', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc',
    ];

    private tableCellSelecting = false;
    private tableCellSelectAnchor: HTMLTableCellElement | null = null;
    tableCellSelected = signal<HTMLTableCellElement[]>([]);
    private readonly onTableCellSelectMoveBound = this.onTableCellSelectMove.bind(this);
    private readonly onTableCellSelectUpBound = this.onTableCellSelectUp.bind(this);
    private readonly onTableCellTouchMoveBound = this.onTableCellTouchMove.bind(this);
    private readonly onTableCellTouchEndBound = this.onTableCellTouchEnd.bind(this);


    /** Whether the docked document-outline panel is open. */
    outlinePanelOpen = signal<boolean>(false);
    private readonly _historyVersion = signal<number>(0);
    /** Bumps on every history-stack change; read by the history addon (addon host surface). */
    readonly historyVersion = this._historyVersion.asReadonly();

    findReplaceVisible = signal(false);
    findQuery = signal('');
    replaceText = signal('');
    findCaseSensitive = signal(false);
    findMatches = signal<Range[]>([]);
    findCurrentIndex = signal(-1);
    findShowReplace = signal(false);
    private findHighlightElements: HTMLElement[] = [];

    private history: HistoryEntry[] = [];
    private historyIndex = -1;
    private isUndoRedo = false;
    private historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private shortcutHandle: ShortcutComponentHandle | null = null;
    private readonly keydownInterceptors = new Set<(event: KeyboardEvent) => boolean>();
    private readonly inputObservers = new Set<(text: string, caretOffset: number) => void>();
    private readonly pasteInterceptors = new Set<(event: ClipboardEvent) => boolean>();
    private readonly dropInterceptors = new Set<(event: DragEvent) => boolean>();
    private readonly dropZonePredicates = new Set<(event: DragEvent) => boolean>();
    private readonly shortcutActions = new Map<string, { run: () => void; when?: () => boolean }>();
    private savedRange: Range | null = null;
    private linkEditorOpen: ((caretHint?: { x: number; y: number }) => void) | null = null;
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
            '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2',
            '[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2',
            '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1',
            '[&_ul]:list-disc [&_ul]:ps-6 [&_ul]:my-2',
            '[&_ol]:list-decimal [&_ol]:ps-6 [&_ol]:my-2',
            '[&_li]:my-1',
            '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:cursor-pointer [&_a]:font-medium hover:[&_a]:text-primary/80',
            '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
            '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto',
            '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
            '[&_img]:inline [&_img]:max-w-full [&_img]:h-auto [&_img]:my-0 [&_img]:mx-0 [&_img]:cursor-pointer',
            '[&_table]:border-collapse [&_table]:w-full [&_table]:my-2',
            '[&_td]:border [&_td]:border-border [&_td]:p-2 [&_td]:min-w-[60px]',
            '[&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_th]:font-semibold [&_th]:text-left',
            '[&_td.rte-cell-selected]:bg-primary/15 [&_th.rte-cell-selected]:bg-primary/25',
            // Nested list margin reset
            '[&_ul_ul]:my-0 [&_ol_ol]:my-0 [&_ul_ol]:my-0 [&_ol_ul]:my-0',
            // Task list styles
            '[&_ul[data-task-list]]:list-none [&_ul[data-task-list]]:ps-0 [&_ul[data-task-list]]:my-2',
            '[&_li_ul[data-task-list]]:ps-6 [&_li_ul[data-task-list]]:my-0',
            '[&_li[data-task]]:flex [&_li[data-task]]:flex-wrap [&_li[data-task]]:items-start [&_li[data-task]]:gap-2 [&_li[data-task]]:my-1',
            '[&_li[data-task]>ul]:w-full',
            '[&_li[data-task]_input[type=checkbox]]:mt-1 [&_li[data-task]_input[type=checkbox]]:h-4 [&_li[data-task]_input[type=checkbox]]:w-4 [&_li[data-task]_input[type=checkbox]]:cursor-pointer [&_li[data-task]_input[type=checkbox]]:accent-primary',
            '[&_li[data-task]_input[type=checkbox]]:shrink-0',
            '[&_li[data-task][data-checked=true]]:line-through [&_li[data-task][data-checked=true]]:text-muted-foreground',
            // Toggle/collapsible blocks
            '[&_details]:border [&_details]:border-border [&_details]:rounded-md [&_details]:my-2 [&_details]:overflow-hidden',
            '[&_summary]:bg-muted/40 [&_summary]:px-3 [&_summary]:py-2 [&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:outline-none',
            '[&_details>:not(summary)]:px-3 [&_details>:not(summary)]:py-2',
            '[&_hr]:border-t [&_hr]:border-border [&_hr]:my-4',
            'disabled:cursor-not-allowed',
            'transition-[padding] duration-150',
            this.outlinePanelOpen() ? 'md:ps-[calc(16rem+8px)] lg:ps-[calc(20rem+8px)]' : ''
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

    interpolateLocale(template: string, values: Record<string, string | number>): string {
        return interpolate(template, values);
    }

    /** Opens the docked document-outline panel. Used by the `/outline` slash command. */
    openOutlineDocked(): void {
        this.outlinePanelOpen.set(true);
    }

    /** Live table of contents derived from the editor's heading elements, in document order. */
    outlineHeadings = computed<OutlineHeading[]>(() => {
        this.htmlContent();
        const editor = this.editorDiv?.nativeElement;
        if (!editor) {
            return [];
        }
        return Array.from(editor.querySelectorAll(OUTLINE_HEADING_SELECTOR)).map((element, index) => toOutlineHeading(element, index));
    });

    /**
     * Smoothly scrolls the heading at the given outline index to the top of the
     * editor's own scroll container. Never calls `Element.scrollIntoView()`, so
     * it cannot scroll the page or any ancestor ג€” only the editor moves.
     * Read-only: never mutates editor content.
     */
    scrollHeadingIntoView(index: number): void {
        const editor = this.editorDiv?.nativeElement;
        if (!editor) {
            return;
        }
        const headings = editor.querySelectorAll<HTMLElement>(OUTLINE_HEADING_SELECTOR);
        const target = headings[index];
        if (!target) {
            return;
        }
        const delta = target.getBoundingClientRect().top - editor.getBoundingClientRect().top;
        editor.scrollBy({ top: delta - OUTLINE_SCROLL_MARGIN, behavior: 'smooth' });
    }

    /** Handles keyboard activation (Enter/Space) on an outline entry row. */
    onOutlineEntryKeydown(event: KeyboardEvent, index: number): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.scrollHeadingIntoView(index);
        }
    }

    onEditorClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        this.selectedImage.set(target.tagName === 'IMG' ? target as HTMLImageElement : null);

        if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
            this.handleTaskCheckboxClick(event, target as HTMLInputElement);
        }
    }

    private handleTaskCheckboxClick(event: MouseEvent, cb: HTMLInputElement): void {
        const li = cb.closest<HTMLElement>('li[data-task]');
        if (!li) return;

        event.preventDefault();
        const newChecked = li.dataset['checked'] !== 'true';
        li.dataset['checked'] = String(newChecked);
        if (newChecked) {
            cb.setAttribute('checked', '');
        } else {
            cb.removeAttribute('checked');
        }
        setTimeout(() => { cb.checked = newChecked; });
        this.placeCaretAfterTaskCheckbox(li);
        this.syncContentFromEditor();
        this.pushHistory();
    }

    private placeCaretAfterTaskCheckbox(li: HTMLElement): void {
        const textSpan = li.querySelector(':scope > span');
        if (!textSpan) return;
        const sel = this.document.getSelection();
        if (!sel) return;
        const r = this.document.createRange();
        r.selectNodeContents(textSpan);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
    }

    constructor() {
        super();
        this.setupOutputEffects();
        this.setupFloatingToolbarEffect();
    }

    private setupOutputEffects(): void {
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
    }

    private setupFloatingToolbarEffect(): void {
        effect(() => {
            const visible = this.showFloatingToolbar();
            this.removeFloatingScrollListener();
            if (visible) {
                setTimeout(() => {
                    const handler = (): void => { this.showFloatingToolbar.set(false); };
                    globalThis.window.addEventListener('scroll', handler, { capture: true, passive: true });
                    this.floatingScrollCleanup = (): void => { globalThis.window.removeEventListener('scroll', handler, { capture: true }); };
                }, 0);
            }
        });
    }

    private floatingScrollCleanup: (() => void) | null = null;

    private removeFloatingScrollListener(): void {
        if (this.floatingScrollCleanup) {
            this.floatingScrollCleanup();
            this.floatingScrollCleanup = null;
        }
    }

    ngOnInit(): void {
        this.shortcutHandle = this.shortcutBindings.registerComponent('rich-text-editor', this.buildShortcutBindings());
        this.pushHistory();
    }

    private buildInlineEditShortcuts(canEdit: () => boolean): ShortcutRegistration[] {
        return [
            {
                actionId: 'rich-text.bold',
                description: 'Toggle bold',
                defaultShortcut: 'Mod+B',
                category: 'Formatting',
                when: canEdit,
                handler: () => this.onFormatCommand('bold'),
            },
            {
                actionId: 'rich-text.italic',
                description: 'Toggle italic',
                defaultShortcut: 'Mod+I',
                category: 'Formatting',
                when: canEdit,
                handler: () => this.onFormatCommand('italic'),
            },
            {
                actionId: 'rich-text.underline',
                description: 'Toggle underline',
                defaultShortcut: 'Mod+U',
                category: 'Formatting',
                when: canEdit,
                handler: () => this.onFormatCommand('underline'),
            },
            {
                actionId: 'rich-text.link',
                description: 'Insert link',
                defaultShortcut: 'Mod+K',
                category: 'Insert',
                when: canEdit,
                handler: () => this.showLinkDialog(),
            },
        ];
    }

    private buildHistoryShortcuts(canEdit: () => boolean): ShortcutRegistration[] {
        return [
            {
                actionId: 'rich-text.undo',
                description: 'Undo',
                defaultShortcut: 'Mod+Z',
                category: 'History',
                when: canEdit,
                handler: () => this.undo(),
            },
            {
                actionId: 'rich-text.redo',
                description: 'Redo',
                defaultShortcut: 'Mod+Shift+Z',
                category: 'History',
                when: canEdit,
                handler: () => this.redo(),
            },
            {
                actionId: 'rich-text.redo.alt',
                description: 'Redo (alternate)',
                defaultShortcut: 'Mod+Y',
                category: 'History',
                when: canEdit,
                handler: () => this.redo(),
            },
        ];
    }

    private buildFormattingShortcuts(canEdit: () => boolean): ShortcutRegistration[] {
        return [
            ...this.buildInlineEditShortcuts(canEdit),
            ...this.buildHistoryShortcuts(canEdit),
        ];
    }

    private buildNavigationShortcuts(canEdit: () => boolean): ShortcutRegistration[] {
        return [
            {
                actionId: 'rich-text.history',
                description: 'Open revision history',
                defaultShortcut: 'Mod+Shift+H',
                category: 'History',
                when: () => canEdit() && this.canRunShortcutAction('rich-text.history'),
                handler: () => this.runShortcutAction('rich-text.history'),
            },
            {
                actionId: 'rich-text.find',
                description: 'Find in editor',
                defaultShortcut: 'Mod+F',
                category: 'Navigation',
                handler: () => this.openFindReplace(false),
            },
            {
                actionId: 'rich-text.find-replace',
                description: 'Find and replace',
                defaultShortcut: 'Mod+H',
                category: 'Navigation',
                when: canEdit,
                handler: () => this.openFindReplace(true),
            },
        ];
    }

    private buildShortcutBindings(): ShortcutRegistration[] {
        const canEdit = (): boolean => !this.disabled() && !this.readonly();
        return [
            ...this.buildFormattingShortcuts(canEdit),
            ...this.buildNavigationShortcuts(canEdit),
        ];
    }

    ngAfterViewInit(): void {
        if (this.editorDiv?.nativeElement) {
            this.editorDiv.nativeElement.innerHTML = this.htmlContent();
            this.enableTaskCheckboxes(this.editorDiv.nativeElement);
        }
    }

    writeValue(value: string): void {
        value ??= '';

        if (this.mode() === 'markdown' && value) {
            this.htmlContent.set(this.markdownService.toHtml(value));
        } else {
            this.htmlContent.set(this.sanitizer.sanitize(value));
        }

        if (this.editorDiv?.nativeElement) {
            this.editorDiv.nativeElement.innerHTML = this.htmlContent();
            this.enableTaskCheckboxes(this.editorDiv.nativeElement);
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
        const html = this.sanitizer.sanitize(div.innerHTML).replaceAll('\u200B', '');

        const triggerTextContent = this.buildTriggerAwareText(div.innerHTML);
        const selection = this.document.getSelection();
        const hasSelection = !!selection && selection.rangeCount > 0;
        const caretOffset = hasSelection
            ? this.getCaretOffset(div)
            : triggerTextContent.length;

        // Addons (e.g. slash-commands, mentions) observe the trigger-aware text
        // and run their own trigger detection.
        this.notifyInputObservers(triggerTextContent, caretOffset);

        this.htmlContent.set(html);

        const outputValue = this.mode() === 'markdown'
            ? this.markdownService.toMarkdown(html)
            : html;
        this.onChange(outputValue);

        if (!this.isUndoRedo) {
            this.scheduleDebouncedHistoryPush();
        }
        this.isUndoRedo = false;
    }

    onKeydown(event: KeyboardEvent): void {
        if (this.dispatchKeydownInterceptors(event)) return;
        if (this.shortcutHandle?.dispatch(event)) return;

        if (event.key === 'Escape') {
            this.showFloatingToolbar.set(false);
        }

        if (event.key === 'Tab') {
            this.handleTabKey(event);
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            this.handleEnterKey(event);
        }
    }

    private handleTabKey(event: KeyboardEvent): void {
        event.preventDefault();
        const listItem = this.getParentListItem();
        if (!listItem) {
            this.insertText('\t');
            return;
        }
        if (event.shiftKey) {
            this.outdentListItem();
        } else {
            this.indentListItem();
        }
    }

    private handleEnterKey(event: KeyboardEvent): void {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        if (this.handleEnterInTaskList(event, selection)) return;
        if (this.handleEnterInSummary(event, range, selection)) return;
        if (this.handleEnterAtDetailsEnd(event, range, selection)) return;
        this.handleEnterInCodeBlock(event, range, selection);
    }

    private handleEnterInTaskList(event: KeyboardEvent, selection: Selection): boolean {
        const taskLi = this.getParentTaskListItem();
        if (!taskLi) return false;

        event.preventDefault();
        const textContent = taskLi.textContent?.replaceAll(/[\s\u00A0]/g, '') || '';
        if (textContent) {
            this.insertNewTaskListItem(taskLi, selection);
        } else {
            this.exitTaskList(taskLi, selection);
        }
        this.syncContentFromEditor();
        this.pushHistory();
        return true;
    }

    private insertNewTaskListItem(taskLi: HTMLElement, selection: Selection): void {
        const newLi = this.document.createElement('li');
        newLi.dataset['task'] = '';
        newLi.dataset['checked'] = 'false';
        const checkbox = this.document.createElement('input');
        checkbox.type = 'checkbox';
        const textSpan = this.document.createElement('span');
        textSpan.appendChild(this.document.createTextNode('\u00A0'));
        newLi.appendChild(checkbox);
        newLi.appendChild(textSpan);
        taskLi.parentNode?.insertBefore(newLi, taskLi.nextSibling);
        this.setSelectionRange(selection, textSpan, 0);
    }

    private exitTaskList(taskLi: HTMLElement, selection: Selection): void {
        const parentList = taskLi.parentElement;
        const p = this.document.createElement('p');
        p.innerHTML = '<br>';
        parentList?.parentNode?.insertBefore(p, parentList.nextSibling);
        taskLi.remove();
        if (parentList && !parentList.hasChildNodes()) parentList.remove();
        this.setSelectionRange(selection, p, 0);
    }

    private handleEnterInSummary(event: KeyboardEvent, range: Range, selection: Selection): boolean {
        const summaryEl = this.findAncestorByTag(range.startContainer, 'SUMMARY');
        if (!summaryEl) return false;

        event.preventDefault();
        const details = summaryEl.parentElement;
        if (!details) return true;

        let contentEl = summaryEl.nextElementSibling;
        if (!contentEl) {
            contentEl = this.document.createElement('p');
            contentEl.innerHTML = '<br>';
            details.appendChild(contentEl);
        }
        this.setSelectionRange(selection, contentEl, 0);
        return true;
    }

    private handleEnterAtDetailsEnd(event: KeyboardEvent, range: Range, selection: Selection): boolean {
        const detailsEl = this.findAncestorByTag(range.startContainer, 'DETAILS');
        if (!detailsEl) return false;

        const lastChild = detailsEl.lastElementChild;
        if (!lastChild || lastChild.tagName === 'SUMMARY') return false;

        const isAtEnd = range.startOffset >= (range.startContainer.textContent?.length ?? 0);
        const isInLastChild = lastChild.contains(range.startContainer);
        if (!isAtEnd || !isInLastChild || lastChild.textContent?.trim()) return false;

        event.preventDefault();
        const p = this.document.createElement('p');
        p.innerHTML = '<br>';
        detailsEl.parentNode?.insertBefore(p, detailsEl.nextSibling);
        lastChild.remove();
        this.setSelectionRange(selection, p, 0);
        this.syncContentFromEditor();
        this.pushHistory();
        return true;
    }

    private handleEnterInCodeBlock(event: KeyboardEvent, range: Range, selection: Selection): void {
        const preElement = this.findAncestorByTag(range.startContainer, 'PRE') as HTMLPreElement | null;
        if (!preElement) return;

        event.preventDefault();
        const codeElement = preElement.querySelector('code');
        const textNode = codeElement ?? preElement;
        const textContent = textNode.textContent ?? '';

        if (textContent.endsWith('\n')) {
            this.exitCodeBlock(preElement, textNode, textContent, selection);
        } else {
            this.insertNewlineInCodeBlock(range, selection);
        }
        this.syncContentFromEditor();
        this.pushHistory();
    }

    private exitCodeBlock(preElement: HTMLPreElement, textNode: Element | HTMLPreElement, textContent: string, selection: Selection): void {
        textNode.textContent = textContent.slice(0, -1);
        const p = this.document.createElement('p');
        p.innerHTML = '<br>';
        preElement.parentNode?.insertBefore(p, preElement.nextSibling);
        this.setSelectionRange(selection, p, 0);
    }

    private insertNewlineInCodeBlock(range: Range, selection: Selection): void {
        const textNodeToInsert = this.document.createTextNode('\n');
        range.deleteContents();
        range.insertNode(textNodeToInsert);
        const newRange = this.document.createRange();
        newRange.setStartAfter(textNodeToInsert);
        newRange.setEndAfter(textNodeToInsert);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    private findAncestorByTag(startNode: Node, tagName: string): HTMLElement | null {
        let node: Node | null = startNode;
        while (node && node !== this.editorDiv?.nativeElement) {
            if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === tagName) {
                return node as HTMLElement;
            }
            node = node.parentNode;
        }
        return null;
    }

    private setSelectionRange(selection: Selection, node: Node | Element, offset: number): void {
        const newRange = this.document.createRange();
        newRange.setStart(node, offset);
        newRange.setEnd(node, offset);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    onBeforeInput(event: Event): void {
        const inputEvent = event as InputEvent;
        if (!this.maxLength() || inputEvent.inputType.startsWith('delete') || inputEvent.inputType.startsWith('format')) {
            return;
        }

        const max = this.maxLength() as number;
        const currentText = this.editorDiv?.nativeElement.textContent ?? '';
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

    onPaste(event: ClipboardEvent): void {
        event.preventDefault();
        this.flushPendingHistoryPush();

        if (this.disabled() || this.readonly()) {
            return;
        }

        for (const interceptor of this.pasteInterceptors) {
            if (interceptor(event)) {
                return;
            }
        }

        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain') ?? '';

        if (this.handlePasteMaxLength(text)) {
            return;
        }

        const normalized = this.pasteNormalizer.normalize(html ?? null, text);
        this.insertHtml(normalized);
        this.pushHistory();
    }

    private handlePasteMaxLength(text: string): boolean {
        if (!this.maxLength()) {
            return false;
        }
        const max = this.maxLength() as number;
        const currentText = this.editorDiv?.nativeElement.textContent ?? '';
        const selectedLength = this.getSelectedTextLength();
        const remaining = max - (currentText.length - selectedLength);

        if (remaining <= 0) {
            return true;
        }

        // Measure against the plain-text clipboard value (text/plain) — no need
        // to parse the untrusted HTML; the over-limit path inserts plain text.
        if (text.length > remaining) {
            const truncated = text.substring(0, remaining);
            this.insertText(truncated);
            this.pushHistory();
            return true;
        }
        return false;
    }
    onEditorDragOver(event: DragEvent): void {
        if (this.disabled() || this.readonly()) return;

        const hasFiles = event.dataTransfer?.types?.includes('Files') ?? false;
        if (!hasFiles) return;

        const canAcceptAddon = this.dispatchDropZonePredicates(event);
        const canAcceptDocument = this.canDropDocumentFile() && this.hasSupportedDocumentFile(event.dataTransfer);
        if (!canAcceptAddon && !canAcceptDocument) return;

        event.preventDefault();
        this.dragOver.set(true);
    }

    private dispatchDropZonePredicates(event: DragEvent): boolean {
        for (const predicate of this.dropZonePredicates) {
            if (predicate(event)) {
                return true;
            }
        }
        return false;
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
        if (this.disabled() || this.readonly()) return;

        if (this.dispatchDropInterceptors(event)) {
            return;
        }

        const files = Array.from(event.dataTransfer?.files ?? []);

        const documentFile = this.canDropDocumentFile()
            ? files.find(file => file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.pdf') || file.name.endsWith('.docx'))
            : undefined;
        if (documentFile) {
            event.preventDefault();
            await this.onFileImport(documentFile);
        }
    }

    onFocus(): void {
        this.focused.emit();
    }

    onBlur(event?: FocusEvent): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }
        this.flushPendingHistoryPush();

        this.onTouched();
        this.blurred.emit();

        const relatedTarget = event?.relatedTarget as Node | null;
        if (relatedTarget && this.el.nativeElement.contains(relatedTarget)) {
            return;
        }

        setTimeout(() => {
            const activeElement = this.document.activeElement;
            const isInsideComponent = this.el.nativeElement.contains(activeElement);
            if (!isInsideComponent) {
                this.showFloatingToolbar.set(false);
            }
        }, 200);
    }

    onSelectionChange(): void {
        this.updateActiveFormats();
        const selection = this.document.getSelection();
        this.selectedText.set(selection?.toString() ?? '');
        this.updateAiTrigger(selection);
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

    // ── AI assist ──
    readonly showAiTrigger = signal(false);
    readonly aiTriggerPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    readonly aiPanelOpen = signal(false);
    readonly aiPhase = signal<'menu' | 'loading' | 'review'>('menu');
    readonly aiPanelPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    readonly aiErrorMessage = signal<string | null>(null);
    readonly aiCustomPrompt = signal('');
    private static readonly DEFAULT_AI_LABELS = {
        trigger: '✨ Ask AI',
        slash: 'Ask AI',
        slashDescription: 'Rewrite, summarize, or generate with AI',
        rewrite: 'Improve writing',
        fixGrammar: 'Fix spelling & grammar',
        shorten: 'Make shorter',
        expand: 'Make longer',
        summarize: 'Summarize',
        continueWriting: 'Continue writing',
        promptPlaceholder: 'Ask AI to…',
        go: 'Go',
        generating: 'Generating…',
        accept: 'Accept',
        discard: 'Discard',
        retry: 'Try again',
        failed: 'AI request failed',
    };
    readonly aiLabels = computed(() => ({
        ...RichTextEditorComponent.DEFAULT_AI_LABELS,
        ...this.resolvedLocale().ai,
    }));
    readonly aiTasks = computed<{ task: AiTask; label: string }[]>(() => {
        const a = this.aiLabels();
        return [
            { task: 'rewrite', label: a.rewrite },
            { task: 'fix-grammar', label: a.fixGrammar },
            { task: 'shorten', label: a.shorten },
            { task: 'expand', label: a.expand },
            { task: 'summarize', label: a.summarize },
            { task: 'continue', label: a.continueWriting },
        ];
    });
    private aiSubscription: Subscription | null = null;
    private aiController: AbortController | null = null;
    private aiDraftEl: HTMLElement | null = null;
    private aiRange: Range | null = null;
    private aiSavedHtml = '';
    private aiSavedText = '';
    private aiContinueMode = false;

    private updateAiTrigger(selection: Selection | null): void {
        if (this.aiPanelOpen()) return;
        const active = !!selection && !selection.isCollapsed && this.hasAi() && !this.readonly() && !this.disabled();
        if (active && selection) {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            this.aiTriggerPosition.set({ x: rect.left, y: rect.top - 40 });
            this.showAiTrigger.set(true);
        } else {
            this.showAiTrigger.set(false);
        }
    }

    /** Open the AI menu, capturing the current selection (or caret for continue). */
    openAiPanel(): void {
        if (!this.hasAi()) return;
        this.captureAiSelection();
        this.aiErrorMessage.set(null);
        this.aiCustomPrompt.set('');
        this.aiPhase.set('menu');
        this.showAiTrigger.set(false);
        if (this.aiRange) {
            const rect = this.aiRange.getBoundingClientRect();
            this.aiPanelPosition.set({ x: Math.max(8, rect.left), y: rect.bottom + 8 });
        }
        this.aiPanelOpen.set(true);
    }

    private captureAiSelection(): void {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            this.aiRange = null;
            this.aiSavedText = '';
            this.aiSavedHtml = '';
            return;
        }
        const range = selection.getRangeAt(0);
        this.aiRange = range.cloneRange();
        if (range.collapsed) {
            this.aiSavedText = this.editorDiv?.nativeElement?.textContent ?? '';
            this.aiSavedHtml = '';
        } else {
            this.aiSavedText = selection.toString();
            const wrapper = this.document.createElement('div');
            wrapper.appendChild(range.cloneContents());
            this.aiSavedHtml = wrapper.innerHTML;
        }
    }

    /** Run a built-in AI task on the captured selection. */
    runAi(task: AiTask, prompt?: string): void {
        const provider = this.aiProvider();
        if (!provider || !this.aiRange) return;
        this.cancelAi();
        this.aiContinueMode = task === 'continue';
        this.beginAiDraft();
        if (this.aiDraftEl) this.streamAi(task, prompt);
    }

    /** Run the user's free-form prompt. */
    runCustomAi(): void {
        const prompt = this.aiCustomPrompt().trim();
        if (prompt) this.runAi('custom', prompt);
    }

    /** Re-run the last task into the existing draft. */
    retryAi(task: AiTask, prompt?: string): void {
        if (!this.aiDraftEl) {
            this.runAi(task, prompt);
            return;
        }
        this.cancelAi();
        this.aiDraftEl.textContent = '';
        this.streamAi(task, prompt);
    }

    private aiLastTask: AiTask = 'rewrite';
    private aiLastPrompt: string | undefined;

    /** Re-run whichever task produced the current draft. */
    retryLastAi(): void {
        this.retryAi(this.aiLastTask, this.aiLastPrompt);
    }

    private streamAi(task: AiTask, prompt?: string): void {
        const provider = this.aiProvider();
        if (!provider) return;
        this.aiLastTask = task;
        this.aiLastPrompt = prompt;
        this.aiRequest.emit({ task, prompt });
        this.aiErrorMessage.set(null);
        this.aiPhase.set('loading');
        this.aiController = new AbortController();
        this.aiSubscription = runAiTask(provider, {
            task,
            input: this.aiSavedText,
            prompt,
            signal: this.aiController.signal,
        }).subscribe({
            next: (text) => this.updateAiDraft(text),
            error: (err) => {
                const message = err instanceof Error ? err.message : this.aiLabels().failed;
                this.aiErrorMessage.set(message);
                this.aiError.emit(message);
                this.aiPhase.set('review');
            },
            complete: () => {
                this.aiResult.emit(this.aiDraftEl?.textContent ?? '');
                this.aiPhase.set('review');
            },
        });
    }

    private beginAiDraft(): void {
        const editor = this.editorDiv?.nativeElement;
        const selection = this.document.getSelection();
        if (!editor || !selection || !this.aiRange) return;
        editor.focus();
        selection.removeAllRanges();
        selection.addRange(this.aiRange);
        const range = selection.getRangeAt(0);
        if (this.aiContinueMode) {
            range.collapse(false);
        } else {
            range.deleteContents();
        }
        const span = this.document.createElement('span');
        span.dataset['aiDraft'] = '';
        span.className = 'rte-ai-draft bg-primary/10 rounded-sm';
        range.insertNode(span);
        this.aiDraftEl = span;
    }

    private updateAiDraft(text: string): void {
        if (this.aiDraftEl) this.aiDraftEl.textContent = text;
    }

    /** Keep the generated text, unwrapping the draft marker. */
    acceptAi(): void {
        const span = this.aiDraftEl;
        if (span?.parentNode) {
            const parent = span.parentNode;
            while (span.firstChild) parent.insertBefore(span.firstChild, span);
            span.remove();
        }
        this.finishAi();
        this.syncContentFromEditor();
    }

    /** Drop the draft and restore the original selection. */
    discardAi(): void {
        this.cancelAi();
        const span = this.aiDraftEl;
        if (span?.parentNode) {
            if (this.aiSavedHtml) {
                const template = this.document.createElement('template');
                template.innerHTML = this.sanitizer.sanitize(this.aiSavedHtml);
                span.parentNode.replaceChild(template.content.cloneNode(true), span);
            } else {
                span.remove();
            }
        }
        this.finishAi();
        this.syncContentFromEditor();
    }

    /** Close the AI menu without running anything (or discard an in-progress draft). */
    closeAiPanel(): void {
        if (this.aiDraftEl) {
            this.discardAi();
            return;
        }
        this.finishAi();
    }

    private cancelAi(): void {
        this.aiSubscription?.unsubscribe();
        this.aiSubscription = null;
        this.aiController?.abort();
        this.aiController = null;
    }

    private finishAi(): void {
        this.cancelAi();
        this.aiDraftEl = null;
        this.aiRange = null;
        this.aiSavedHtml = '';
        this.aiSavedText = '';
        this.aiPanelOpen.set(false);
        this.aiPhase.set('menu');
    }

    /**
     * Jump to a history entry without pushing a new one (addon host surface):
     * forward entries stay available for redo. Reconstructs and applies the
     * entry's content, restores its selection, and emits a change.
     */
    restoreHistoryEntry(entryIndex: number): void {
        if (entryIndex < 0 || entryIndex >= this.history.length) {
            return;
        }

        this.flushPendingHistoryPush();
        this.historyIndex = entryIndex;
        const entry = this.history[this.historyIndex];
        const html = this.reconstructHtmlCached(this.historyIndex);

        this.htmlContent.set(html);
        if (this.editorDiv?.nativeElement) {
            this.editorDiv.nativeElement.innerHTML = html;
        }
        this.restoreSerializedSelection(entry.selection);

        const outputValue = this.mode() === 'markdown'
            ? this.markdownService.toMarkdown(html)
            : html;
        this.onChange(outputValue);
        this.bumpHistoryVersion();
    }

    onFormatCommand(command: string): void {
        if (this.readonly() || this.disabled()) return;

        if (command === 'outline') {
            this.outlinePanelOpen.set(!this.outlinePanelOpen());
            return;
        }

        this.restoreSelection();
        this.flushPendingHistoryPush();

        const mentionTargets = this.getMentionElementsInSelection();
        this.executeFormatCommand(command, mentionTargets);

        this.applyMutation({ focus: true, updateActiveFormats: true });
        this.collapseFloatingToolbarAfterFormat();
    }

    private executeFormatCommand(command: string, mentionTargets: HTMLElement[]): void {
        if (this.executeInlineFormatCommand(command, mentionTargets)) return;
        if (this.executeBlockFormatCommand(command)) return;
        if (this.executeAlignFormatCommand(command)) return;
        this.executeListFormatCommand(command);
    }

    private executeInlineFormatCommand(command: string, mentionTargets: HTMLElement[]): boolean {
        switch (command) {
            case 'bold':
                this.execEditorCommand('bold');
                this.toggleMentionStyle(mentionTargets, 'fontWeight', 'bold', 'normal');
                return true;
            case 'italic':
                this.execEditorCommand('italic');
                this.toggleMentionStyle(mentionTargets, 'fontStyle', 'italic', 'normal');
                return true;
            case 'underline':
                this.execEditorCommand('underline');
                this.toggleMentionTextDecoration(mentionTargets, 'underline');
                return true;
            case 'strikethrough':
                this.execEditorCommand('strikeThrough');
                this.toggleMentionTextDecoration(mentionTargets, 'line-through');
                return true;
            case 'clear':
                this.execEditorCommand('removeFormat');
                this.clearMentionStyles(mentionTargets);
                return true;
            case 'code':
                this.wrapSelectionWithTag('code');
                return true;
            default:
                return false;
        }
    }

    private executeBlockFormatCommand(command: string): boolean {
        switch (command) {
            case 'heading1': this.execEditorCommand('formatBlock', '<h1>'); return true;
            case 'heading2': this.execEditorCommand('formatBlock', '<h2>'); return true;
            case 'heading3': this.execEditorCommand('formatBlock', '<h3>'); return true;
            case 'paragraph': this.execEditorCommand('formatBlock', '<p>'); return true;
            case 'blockquote': this.execEditorCommand('formatBlock', '<blockquote>'); return true;
            case 'codeBlock': this.insertCodeBlock(); return true;
            case 'horizontalRule': this.insertHorizontalRule(); return true;
            case 'undo': this.undo(); return true;
            case 'redo': this.redo(); return true;
            default: return false;
        }
    }

    private executeAlignFormatCommand(command: string): boolean {
        switch (command) {
            case 'alignLeft':
                this.execEditorCommand(this.isRtl() ? 'justifyRight' : 'justifyLeft');
                return true;
            case 'alignCenter':
                this.execEditorCommand('justifyCenter');
                return true;
            case 'alignRight':
                this.execEditorCommand(this.isRtl() ? 'justifyLeft' : 'justifyRight');
                return true;
            default:
                return false;
        }
    }

    private executeListFormatCommand(command: string): boolean {
        switch (command) {
            case 'bulletList': this.execEditorCommand('insertUnorderedList'); return true;
            case 'orderedList': this.execEditorCommand('insertOrderedList'); return true;
            case 'indent': this.indentListItem(); return true;
            case 'outdent': this.outdentListItem(); return true;
            case 'taskList': this.insertTaskList(); return true;
            case 'toggle': this.insertToggleBlock(); return true;
            default: return false;
        }
    }

    private collapseFloatingToolbarAfterFormat(): void {
        if (this.toolbar() !== 'floating') {
            return;
        }

        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.collapse(false);
            this.moveCaretPastFormattingNode(selection, range);
        }
        this.showFloatingToolbar.set(false);
    }

    private moveCaretPastFormattingNode(selection: Selection, range: Range): void {
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
            if (!formattedNode.parentNode) break;
            formattedNode = formattedNode.parentNode;
        }
    }

    onFloatingFormatCommand(command: string): void {
        if (this.readonly() || this.disabled()) return;
        this.flushPendingHistoryPush();

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

            this.syncContentFromEditor();

            this.showFloatingToolbar.set(false);

            this.editorDiv?.nativeElement?.focus();
            selection.removeAllRanges();
            selection.addRange(cursorRange);

            this.pushHistory();
            return;
        }

        this.applyFloatingBlockCommand(command, selection);

        this.showFloatingToolbar.set(false);
        this.applyMutation({ focus: true });
    }

    private applyFloatingBlockCommand(command: string, selection: Selection): void {
        if (command === 'clear') {
            this.execEditorCommand('removeFormat');
            selection.collapseToEnd();
            return;
        }
        if (command === 'heading1' || command === 'heading2' || command === 'heading3') {
            const level = command.replace('heading', '');
            this.execEditorCommand('formatBlock', `<h${level}>`);
            selection.collapseToEnd();
            return;
        }
        if (command === 'bulletList') {
            this.execEditorCommand('insertUnorderedList');
            selection.collapseToEnd();
            return;
        }
        if (command === 'orderedList') {
            this.execEditorCommand('insertOrderedList');
            selection.collapseToEnd();
        }
    }

    async onFileImport(file: File): Promise<void> {
        if (this.readonly() || this.disabled()) return;
        this.flushPendingHistoryPush();

        const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
        const isZip = this.isZipHeader(header);
        const isPdf = this.isPdfHeader(header);

        if (!isZip && !isPdf) {
            const msg = this.resolvedLocale().editor.importInvalidFile;
            this.fileImportError.emit(msg);
            this.showImportError(msg);
            return;
        }

        await this.runFileImport(file, isZip);
    }

    private isZipHeader(header: Uint8Array): boolean {
        return header.length >= 4 &&
            header[0] === 0x50 && header[1] === 0x4B &&
            header[2] === 0x03 && header[3] === 0x04;
    }

    private isPdfHeader(header: Uint8Array): boolean {
        return header.length >= 5 &&
            header[0] === 0x25 && header[1] === 0x50 &&
            header[2] === 0x44 && header[3] === 0x46 &&
            header[4] === 0x2D;
    }

    private async runFileImport(file: File, isZip: boolean): Promise<void> {
        this.fileImporting.set(true);
        this.fileImportStart.emit(file);

        try {
            if (isZip) {
                await this.importDocx(file);
            } else {
                await this.importPdf(file);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : this.resolvedLocale().editor.importFailed;
            this.fileImportError.emit(message);
            this.showImportError(message);
        } finally {
            this.fileImporting.set(false);
        }
    }

    private async importDocx(file: File): Promise<void> {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { parseDocx } = await import('../../lib/parsers/docx-parser');
        const { renderDocxForEditor } = await import('../../lib/parsers/docx-to-editor-html');
        const result = parseDocx(bytes);
        const html = renderDocxForEditor(result);
        if (!html.trim()) {
            const msg = this.resolvedLocale().editor.importFailed;
            this.fileImportError.emit(msg);
            this.showImportError(msg);
            return;
        }
        this.restoreSelection();
        this.insertHtml(html);
        this.pushHistory();
        this.fileImportComplete.emit(html);
    }

    private async importPdf(file: File): Promise<void> {
        const buffer = await file.arrayBuffer();
        const { parsePdf } = await import('../../lib/parsers/pdf-parser');
        const result = await parsePdf(buffer);
        if (!result.html.trim()) {
            const msg = this.resolvedLocale().editor.importFailed;
            this.fileImportError.emit(msg);
            this.showImportError(msg);
            return;
        }
        this.restoreSelection();
        this.insertHtml(result.html);
        this.pushHistory();
        this.fileImportComplete.emit(result.html);
    }

    private showImportError(message: string): void {
        this.fileImportErrorMessage.set(message);
        setTimeout(() => this.fileImportErrorMessage.set(''), 4000);
    }

    private canDropDocumentFile(): boolean {
        return this.toolbarItems().includes('importFile');
    }

    private hasSupportedDocumentFile(dataTransfer: DataTransfer | null): boolean {
        if (!dataTransfer?.items) return true;
        for (const item of Array.from(dataTransfer.items)) {
            if (item.kind !== 'file') continue;
            if (item.type === 'application/pdf' || item.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                return true;
            }
        }
        return false;
    }

    insertTextFromOverlay(text: string): void {
        this.flushPendingHistoryPush();
        const editor = this.editorDiv?.nativeElement;
        const prevInputMode = editor?.inputMode;
        if (editor) {
            editor.inputMode = 'none';
        }
        this.restoreSelection();
        this.insertText(text);
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }
        if (editor) {
            setTimeout(() => { editor.inputMode = prevInputMode ?? ''; }, 100);
        }
    }

    /** Commit addon DOM edits to the model + flush pending history (addon host surface). */
    commitContent(): void {
        this.syncContentFromEditor();
        this.flushPendingHistoryPush();
    }

    /** Insert plain text at the live caret as one history entry (addon host surface). */
    insertTextAtCaret(text: string): void {
        this.insertText(text);
        this.pushHistory();
    }

    /** Insert sanitized HTML at the live caret as one history entry (addon host surface). */
    insertHtmlAtCaret(html: string): void {
        this.insertHtml(html);
        this.pushHistory();
    }

    /** Register an addon keydown interceptor (addon host surface). */
    registerKeydownInterceptor(interceptor: (event: KeyboardEvent) => boolean): () => void {
        this.keydownInterceptors.add(interceptor);
        return () => this.keydownInterceptors.delete(interceptor);
    }

    /** Register an addon observer of the trigger-aware input text (addon host surface). */
    registerInputObserver(observer: (text: string, caretOffset: number) => void): () => void {
        this.inputObservers.add(observer);
        return () => this.inputObservers.delete(observer);
    }

    /** Register an addon paste interceptor (addon host surface). */
    registerPasteInterceptor(interceptor: (event: ClipboardEvent) => boolean): () => void {
        this.pasteInterceptors.add(interceptor);
        return () => this.pasteInterceptors.delete(interceptor);
    }

    /** Register an addon drop interceptor (addon host surface). */
    registerDropInterceptor(interceptor: (event: DragEvent) => boolean): () => void {
        this.dropInterceptors.add(interceptor);
        return () => this.dropInterceptors.delete(interceptor);
    }

    /** Register an addon drop-zone predicate (addon host surface). */
    registerDropZonePredicate(predicate: (event: DragEvent) => boolean): () => void {
        this.dropZonePredicates.add(predicate);
        return () => this.dropZonePredicates.delete(predicate);
    }

    private dispatchKeydownInterceptors(event: KeyboardEvent): boolean {
        for (const interceptor of this.keydownInterceptors) {
            if (interceptor(event)) {
                return true;
            }
        }
        return false;
    }

    private dispatchDropInterceptors(event: DragEvent): boolean {
        for (const interceptor of this.dropInterceptors) {
            if (interceptor(event)) {
                return true;
            }
        }
        return false;
    }

    private notifyInputObservers(text: string, caretOffset: number): void {
        for (const observer of this.inputObservers) {
            observer(text, caretOffset);
        }
    }

    applyInlineStyle(style: RichTextInlineStyle): void {
        if (style.color !== undefined || style.backgroundColor !== undefined) {
            this.applySelectionColor(style.color, style.backgroundColor);
        }
        if (style.fontSize !== undefined) {
            this.onFontSizeSelect(style.fontSize);
        }
        if (style.fontFamily !== undefined) {
            this.onFontFamilySelect(style.fontFamily);
        }
    }

    private applySelectionColor(color: string | undefined, backgroundColor: string | undefined): void {
        if (!this.hasColorTarget()) {
            return;
        }
        this.flushPendingHistoryPush();
        this.restoreColorTargetSelection();

        const mentionTargets = this.getMentionElementsInSelection();

        // Emit inline `color`/`background-color` styles — which the sanitizer keeps — instead
        // of the deprecated `<font color>` tag `foreColor` produces by default, which the
        // sanitizer strips, so the colour would apply in the editor but vanish from the output.
        this.execEditorCommand('styleWithCSS', 'true');
        if (color !== undefined) {
            this.execEditorCommand('foreColor', color);
            this.setMentionStyle(mentionTargets, 'color', color);
        }
        if (backgroundColor !== undefined) {
            if (!this.execEditorCommand('hiliteColor', backgroundColor)) {
                this.execEditorCommand('backColor', backgroundColor);
            }
            this.setMentionStyle(mentionTargets, 'backgroundColor', backgroundColor);
        }
        this.execEditorCommand('styleWithCSS', 'false');

        // `foreColor`/`hiliteColor` apply to the range without needing editor focus and
        // keep it selected. Do NOT focus the editor here: the colour picker lives in an
        // open popover, and stealing focus back collapses the selection so the next pick
        // (or a drag) has no target — the reported "de-selects and stops changing" bug.
        this.applyMutation({ focus: false });
    }

    /**
     * Set the selection a colour command applies to, WITHOUT focusing the editor.
     * Prefers a live non-collapsed range already in the editor (a drag/pick keeps the
     * document selection alive even while the picker popover holds focus); otherwise
     * falls back to the range saved when the editor was last blurred.
     */
    private restoreColorTargetSelection(): void {
        const editor = this.editorDiv?.nativeElement;
        const selection = this.document.getSelection();
        if (!editor || !selection) {
            return;
        }
        const live = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (live && !live.collapsed && editor.contains(live.startContainer)) {
            return;
        }
        if (this.savedRange && editor.contains(this.savedRange.startContainer)) {
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
        }
    }

    /**
     * True when there is a real selection/caret in the editor to apply a colour to.
     * A colour command with no target is a no-op, so `applyInlineStyle` skips it: a
     * colour picker (e.g. the colours addon) can emit an initial value with no
     * selection ever placed, which must NOT force-focus the editor and push an
     * empty model value.
     */
    private hasColorTarget(): boolean {
        const editor = this.editorDiv?.nativeElement;
        if (!editor) return false;
        if (this.savedRange && editor.contains(this.savedRange.startContainer)) return true;
        const sel = this.document.getSelection();
        return !!sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer);
    }

    onFontSizeSelect(size: string): void {
        this.flushPendingHistoryPush();
        this.restoreSelection();

        const mentionTargets = this.getMentionElementsInSelection();

        this.execEditorCommand('fontSize', '7');
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

        const sizeVal = size.endsWith('px') ? size : `${size}px`;
        this.setMentionStyle(mentionTargets, 'fontSize', sizeVal);

        this.syncContentFromEditor();
        this.focusEditor();
        this.pushHistory();
    }

    onFontFamilySelect(family: string): void {
        this.flushPendingHistoryPush();
        this.restoreSelection();

        const mentionTargets = this.getMentionElementsInSelection();

        this.execEditorCommand('fontName', family);

        if (this.editorDiv?.nativeElement) {
            const fontElements = this.editorDiv.nativeElement.querySelectorAll(`font[face="${CSS.escape(family)}"]`);
            for (const font of Array.from(fontElements)) {
                const el = font as HTMLElement;
                const span = this.document.createElement('span');
                span.style.fontFamily = family;
                while (el.firstChild) {
                    span.appendChild(el.firstChild);
                }
                el.parentNode?.replaceChild(span, el);
            }
        }

        this.setMentionStyle(mentionTargets, 'fontFamily', family);
        this.syncContentFromEditor();
        this.focusEditor();
        this.pushHistory();
    }

    private getCaretOffset(element: HTMLElement): number {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return 0;

        const range = selection.getRangeAt(0).cloneRange();
        range.selectNodeContents(element);
        if (!selection.anchorNode) return 0;
        range.setEnd(selection.anchorNode, selection.anchorOffset);
        return range.toString().length;
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

    private insertHorizontalRule(): void {
        this.insertHtml('<hr><p><br></p>');
        this.pushHistory();
    }

    /**
     * Open the link editor (addon host surface). Delegates to the editor
     * registered via {@link registerLinkEditor}; a no-op when no links addon is
     * present. `caretHint` positions it when the live caret rect is degenerate —
     * e.g. an addon consumed the trigger and collapsed the caret into an empty
     * block before calling this.
     */
    showLinkDialog(caretHint?: { x: number; y: number }): void {
        this.linkEditorOpen?.(caretHint);
    }

    /** Register the link editor {@link showLinkDialog} delegates to (addon host surface). */
    registerLinkEditor(open: (caretHint?: { x: number; y: number }) => void): () => void {
        this.linkEditorOpen = open;
        return () => {
            if (this.linkEditorOpen === open) {
                this.linkEditorOpen = null;
            }
        };
    }

    private getSelectedTextLength(): number {
        const selection = this.document.getSelection();
        if (selection && !selection.isCollapsed) {
            return selection.toString().length;
        }
        return 0;
    }

    private closeTableContextMenu(): void {
        this.tableContextMenuOpen.set(false);
        if (this.tableContextMenuCloseHandler) {
            this.document.removeEventListener('click', this.tableContextMenuCloseHandler);
            this.document.removeEventListener('contextmenu', this.tableContextMenuCloseHandler);
            this.tableContextMenuCloseHandler = null;
        }
    }

    private setupTableContextMenuCloseHandlers(): void {
        const closeHandler = (): void => {
            this.closeTableContextMenu();
        };
        this.tableContextMenuCloseHandler = closeHandler;
        setTimeout(() => {
            this.document.addEventListener('click', closeHandler);
            this.document.addEventListener('contextmenu', closeHandler);
        });
    }

    private adjustTableContextMenuPosition(): void {
        requestAnimationFrame(() => {
            const menu = this.tableContextMenuRef?.nativeElement;
            if (!menu) return;
            const rect = menu.getBoundingClientRect();
            let x = this.tableContextMenuPosition().x;
            let y = this.tableContextMenuPosition().y;
            if (rect.right > globalThis.innerWidth) {
                x = globalThis.innerWidth - rect.width - 8;
            }
            if (rect.bottom > globalThis.innerHeight) {
                y = globalThis.innerHeight - rect.height - 8;
            }
            this.tableContextMenuPosition.set({ x, y });
        });
    }

    onContextMenuOverlayContextMenu(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const menu = this.tableContextMenuRef?.nativeElement;
        if (menu) {
            menu.style.pointerEvents = 'none';
            const below = this.document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
            menu.style.pointerEvents = '';
            const cell = below?.closest<HTMLTableCellElement>('td, th');
            if (cell && this.editorDiv?.nativeElement.contains(cell)) {
                this.closeTableContextMenu();
                this.tableContextMenuTarget = cell;
                this.tableContextMenuPosition.set({ x: event.clientX, y: event.clientY });
                this.tableContextMenuOpen.set(true);
                this.adjustTableContextMenuPosition();
                this.setupTableContextMenuCloseHandlers();
                return;
            }
        }
        this.closeTableContextMenu();
    }

    onEditorContextMenu(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const table = target.closest('table');
        if (table && this.editorDiv?.nativeElement.contains(table)) {
            event.preventDefault();
        }
        const cell = target.closest<HTMLTableCellElement>('td, th');
        if (!cell || !this.editorDiv?.nativeElement.contains(cell)) {
            this.closeTableContextMenu();
            return;
        }

        this.closeTableContextMenu();

        event.stopPropagation();
        this.tableContextMenuTarget = cell;
        this.tableContextMenuPosition.set({ x: event.clientX, y: event.clientY });
        this.tableContextMenuOpen.set(true);

        this.adjustTableContextMenuPosition();
        this.setupTableContextMenuCloseHandlers();
    }

    onEditorMouseMove(event: MouseEvent): void {
        if (this.tableResizeState || this.readonly() || this.disabled()) return;
        const target = event.target as HTMLElement;
        const cell = target.closest<HTMLTableCellElement>('td, th');
        const editorEl = this.editorDiv?.nativeElement;
        if (!cell) {
            if (this.tableResizeCursor() && editorEl) {
                this.tableResizeCursor.set(false);
                editorEl.style.cursor = '';
            }
            return;
        }
        const cellRect = cell.getBoundingClientRect();
        const colIndex = Array.from((cell.parentElement as HTMLTableRowElement).cells).indexOf(cell);
        const nearRightBorder = event.clientX >= cellRect.right - 4;
        const nearLeftBorder = event.clientX <= cellRect.left + 4 && colIndex > 0;
        if (nearRightBorder || nearLeftBorder) {
            this.tableResizeCursor.set(true);
            if (editorEl) editorEl.style.cursor = 'col-resize';
        } else if (this.tableResizeCursor()) {
            this.tableResizeCursor.set(false);
            if (editorEl) editorEl.style.cursor = '';
        }
    }

    onEditorMouseDown(event: MouseEvent): void {
        if (this.readonly() || this.disabled()) return;
        const target = event.target as HTMLElement;
        const cell = target.closest<HTMLTableCellElement>('td, th');
        const isRightClick = event.button === 2;

        if (isRightClick) {
            if (!cell || !this.tableCellSelected().includes(cell)) {
                this.clearCellSelection();
            }
            return;
        }

        this.clearCellSelection();

        if (this.startTableResize(event, cell)) {
            return;
        }

        if (cell && this.editorDiv?.nativeElement.contains(cell)) {
            this.tableCellSelecting = true;
            this.tableCellSelectAnchor = cell;
            this.document.addEventListener('mousemove', this.onTableCellSelectMoveBound);
            this.document.addEventListener('mouseup', this.onTableCellSelectUpBound);
        }
    }

    private startTableResize(event: MouseEvent, cell: HTMLTableCellElement | null): boolean {
        if (!this.tableResizeCursor() || !cell) {
            return false;
        }
        const table = cell.closest<HTMLTableElement>('table');
        if (!table) {
            return false;
        }
        const resizeColIndex = this.getResizeColumnIndex(cell, event.clientX);
        event.preventDefault();
        event.stopPropagation();
        const firstRow = table.rows[0];
        if (!firstRow) {
            return true;
        }

        const widths = Array.from(firstRow.cells).map(c => c.getBoundingClientRect().width);
        const tableWidth = table.getBoundingClientRect().width;
        table.style.tableLayout = 'fixed';
        table.style.width = `${tableWidth}px`;
        for (const [index, tableCell] of Array.from(firstRow.cells).entries()) {
            tableCell.style.width = `${widths[index]}px`;
        }

        this.tableResizeState = {
            table,
            colIndex: resizeColIndex,
            startX: event.clientX,
            startWidths: widths,
            tableWidth,
        };
        this.document.addEventListener('mousemove', this.onTableResizeMoveBound);
        this.document.addEventListener('mouseup', this.onTableResizeUpBound);
        return true;
    }

    private getResizeColumnIndex(cell: HTMLTableCellElement, clientX: number): number {
        const row = cell.parentElement as HTMLTableRowElement;
        const cellRect = cell.getBoundingClientRect();
        const colIndex = Array.from(row.cells).indexOf(cell);
        const nearLeftBorder = clientX <= cellRect.left + 4 && colIndex > 0;
        return nearLeftBorder ? colIndex - 1 : colIndex;
    }

    private onTableResizeMove(event: MouseEvent): void {
        if (!this.tableResizeState) return;
        const { table, colIndex, startX, startWidths } = this.tableResizeState;
        const delta = event.clientX - startX;
        const firstRow = table.rows[0];
        if (!firstRow) return;

        const newLeftWidth = Math.max(60, startWidths[colIndex] + delta);
        const nextColIndex = colIndex + 1;
        if (nextColIndex < startWidths.length) {
            const newRightWidth = Math.max(60, startWidths[nextColIndex] - delta);
            firstRow.cells[colIndex].style.width = `${newLeftWidth}px`;
            firstRow.cells[nextColIndex].style.width = `${newRightWidth}px`;
        } else {
            firstRow.cells[colIndex].style.width = `${newLeftWidth}px`;
            table.style.width = `${this.tableResizeState.tableWidth + delta}px`;
        }
    }

    private onTableResizeUp(): void {
        this.tableResizeState = null;
        this.tableResizeCursor.set(false);
        if (this.editorDiv) {
            this.editorDiv.nativeElement.style.cursor = '';
        }
        this.document.removeEventListener('mousemove', this.onTableResizeMoveBound);
        this.document.removeEventListener('mouseup', this.onTableResizeUpBound);
        this.applyMutation({ focus: false });
    }

    private onTableCellSelectMove(event: MouseEvent): void {
        if (!this.tableCellSelecting || !this.tableCellSelectAnchor) return;
        const target = this.document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        if (!target) return;
        const cell = target.closest<HTMLTableCellElement>('td, th');
        if (!cell) return;
        const anchorTable = this.tableCellSelectAnchor.closest('table');
        if (!anchorTable || cell.closest('table') !== anchorTable) return;
        this.updateCellSelection(this.tableCellSelectAnchor, cell);
    }

    private onTableCellSelectUp(): void {
        this.tableCellSelecting = false;
        this.document.removeEventListener('mousemove', this.onTableCellSelectMoveBound);
        this.document.removeEventListener('mouseup', this.onTableCellSelectUpBound);
    }

    onEditorTouchStart(event: TouchEvent): void {
        if (this.readonly() || this.disabled()) return;
        const target = event.target as HTMLElement;
        const cell = target.closest<HTMLTableCellElement>('td, th');

        if (cell && this.editorDiv?.nativeElement.contains(cell)) {
            this.clearCellSelection();
            this.tableCellSelecting = true;
            this.tableCellSelectAnchor = cell;
            this.document.addEventListener('touchmove', this.onTableCellTouchMoveBound, { passive: false });
            this.document.addEventListener('touchend', this.onTableCellTouchEndBound);
        }
    }

    private onTableCellTouchMove(event: TouchEvent): void {
        if (!this.tableCellSelecting || !this.tableCellSelectAnchor) return;
        const touch = event.touches[0];
        const target = this.document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
        if (!target) return;
        const cell = target.closest<HTMLTableCellElement>('td, th');
        if (!cell) return;
        const anchorTable = this.tableCellSelectAnchor.closest('table');
        if (!anchorTable || cell.closest('table') !== anchorTable) return;
        event.preventDefault();
        this.updateCellSelection(this.tableCellSelectAnchor, cell);
    }

    private onTableCellTouchEnd(): void {
        this.tableCellSelecting = false;
        this.document.removeEventListener('touchmove', this.onTableCellTouchMoveBound);
        this.document.removeEventListener('touchend', this.onTableCellTouchEndBound);
    }

    private clearCellSelection(): void {
        for (const cell of this.tableCellSelected()) {
            cell.classList.remove('rte-cell-selected');
        }
        this.tableCellSelected.set([]);
    }

    private buildCellGrid(table: HTMLTableElement): (HTMLTableCellElement | null)[][] {
        const rows = Array.from(table.querySelectorAll('tr'));
        const maxCols = rows.reduce((max, row) => Math.max(max, this.getTotalRowColSpan(row)), 0);

        const grid: (HTMLTableCellElement | null)[][] = rows.map(() => new Array(maxCols).fill(null));
        for (const [ri, row] of rows.entries()) {
            this.fillCellGridRow(grid, rows.length, maxCols, ri, row);
        }
        return grid;
    }

    private getTotalRowColSpan(row: HTMLTableRowElement): number {
        let count = 0;
        for (const cell of Array.from(row.cells)) {
            count += cell.colSpan;
        }
        return count;
    }

    private fillCellGridRow(
        grid: (HTMLTableCellElement | null)[][],
        rowCount: number,
        maxCols: number,
        rowIndex: number,
        row: HTMLTableRowElement
    ): void {
        let colIndex = 0;
        for (const cell of Array.from(row.cells)) {
            colIndex = this.findNextAvailableColumn(grid, rowIndex, colIndex, maxCols);
            if (colIndex >= maxCols) {
                return;
            }
            colIndex = this.placeCellInGrid(grid, cell, rowIndex, colIndex, rowCount, maxCols);
        }
    }

    private findNextAvailableColumn(
        grid: (HTMLTableCellElement | null)[][],
        rowIndex: number,
        startColIndex: number,
        maxCols: number
    ): number {
        let colIndex = startColIndex;
        while (colIndex < maxCols && grid[rowIndex][colIndex] !== null) {
            colIndex++;
        }
        return colIndex;
    }

    private placeCellInGrid(
        grid: (HTMLTableCellElement | null)[][],
        cell: HTMLTableCellElement,
        rowIndex: number,
        colIndex: number,
        rowCount: number,
        maxCols: number
    ): number {
        const rowSpan = cell.rowSpan || 1;
        const colSpan = cell.colSpan || 1;
        for (let dr = 0; dr < rowSpan; dr++) {
            for (let dc = 0; dc < colSpan; dc++) {
                if (this.isGridPositionInBounds(rowIndex + dr, colIndex + dc, rowCount, maxCols)) {
                    grid[rowIndex + dr][colIndex + dc] = cell;
                }
            }
        }
        return colIndex + colSpan;
    }

    private isGridPositionInBounds(rowIndex: number, colIndex: number, rowCount: number, maxCols: number): boolean {
        return rowIndex < rowCount && colIndex < maxCols;
    }

    private getCellGridBounds(grid: (HTMLTableCellElement | null)[][], cell: HTMLTableCellElement): { minRow: number; minCol: number; maxRow: number; maxCol: number } {
        for (let ri = 0; ri < grid.length; ri++) {
            const found = this.findCellInRow(grid[ri], cell, ri);
            if (found) return found;
        }
        return { minRow: 0, minCol: 0, maxRow: 0, maxCol: 0 };
    }

    private findCellInRow(
        row: (HTMLTableCellElement | null)[],
        cell: HTMLTableCellElement,
        ri: number
    ): { minRow: number; minCol: number; maxRow: number; maxCol: number } | null {
        for (let ci = 0; ci < row.length; ci++) {
            if (row[ci] === cell) {
                return {
                    minRow: ri,
                    minCol: ci,
                    maxRow: ri + (cell.rowSpan || 1) - 1,
                    maxCol: ci + (cell.colSpan || 1) - 1,
                };
            }
        }
        return null;
    }

    private updateCellSelection(anchor: HTMLTableCellElement, current: HTMLTableCellElement): void {
        const table = anchor.closest<HTMLTableElement>('table');
        if (!table) return;

        const grid = this.buildCellGrid(table);
        const aBounds = this.getCellGridBounds(grid, anchor);
        const cBounds = this.getCellGridBounds(grid, current);

        const bounds = this.expandSelectionBounds(grid, {
            minRow: Math.min(aBounds.minRow, cBounds.minRow),
            maxRow: Math.max(aBounds.maxRow, cBounds.maxRow),
            minCol: Math.min(aBounds.minCol, cBounds.minCol),
            maxCol: Math.max(aBounds.maxCol, cBounds.maxCol),
        });
        const cells = this.collectCellsInBounds(grid, bounds);

        this.clearCellSelection();
        const selected = Array.from(cells.values());
        if (selected.length > 1) {
            for (const cell of selected) {
                cell.classList.add('rte-cell-selected');
            }
            this.tableCellSelected.set(selected);
        }
    }

    private expandSelectionBounds(
        grid: (HTMLTableCellElement | null)[][],
        initial: { minRow: number; maxRow: number; minCol: number; maxCol: number }
    ): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
        const bounds = { ...initial };
        let expanded = true;
        while (expanded) {
            expanded = this.expandBoundsOnce(grid, bounds);
        }
        return bounds;
    }

    private expandBoundsOnce(
        grid: (HTMLTableCellElement | null)[][],
        bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }
    ): boolean {
        let changed = false;
        for (let ri = bounds.minRow; ri <= bounds.maxRow; ri++) {
            for (let ci = bounds.minCol; ci <= bounds.maxCol; ci++) {
                const cell = grid[ri]?.[ci];
                if (cell && this.tryExpandBoundsForCell(grid, cell, bounds)) {
                    changed = true;
                }
            }
        }
        return changed;
    }

    private tryExpandBoundsForCell(
        grid: (HTMLTableCellElement | null)[][],
        cell: HTMLTableCellElement,
        bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }
    ): boolean {
        const currentBounds = this.getCellGridBounds(grid, cell);
        return this.applyExpandedBounds(bounds, currentBounds);
    }

    private applyExpandedBounds(
        bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number },
        currentBounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }
    ): boolean {
        let changed = false;
        if (currentBounds.minRow < bounds.minRow) { bounds.minRow = currentBounds.minRow; changed = true; }
        if (currentBounds.maxRow > bounds.maxRow) { bounds.maxRow = currentBounds.maxRow; changed = true; }
        if (currentBounds.minCol < bounds.minCol) { bounds.minCol = currentBounds.minCol; changed = true; }
        if (currentBounds.maxCol > bounds.maxCol) { bounds.maxCol = currentBounds.maxCol; changed = true; }
        return changed;
    }

    private collectCellsInBounds(
        grid: (HTMLTableCellElement | null)[][],
        bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }
    ): Set<HTMLTableCellElement> {
        const cells = new Set<HTMLTableCellElement>();
        for (let ri = bounds.minRow; ri <= bounds.maxRow; ri++) {
            for (let ci = bounds.minCol; ci <= bounds.maxCol; ci++) {
                const cell = grid[ri]?.[ci];
                if (cell) {
                    cells.add(cell);
                }
            }
        }
        return cells;
    }

    mergeCells(): void {
        this.closeTableContextMenu();
        const selected = this.tableCellSelected();
        if (selected.length < 2) return;

        const table = selected[0].closest<HTMLTableElement>('table');
        if (!table) return;

        const grid = this.buildCellGrid(table);
        const bounds = this.getSelectionBounds(grid, selected);
        const topLeftCell = grid[bounds.minRow]?.[bounds.minCol];
        if (!topLeftCell) return;

        const { contentParts, processedCells } = this.getMergeContent(grid, bounds);
        topLeftCell.colSpan = bounds.maxCol - bounds.minCol + 1;
        topLeftCell.rowSpan = bounds.maxRow - bounds.minRow + 1;
        topLeftCell.innerHTML = contentParts.length > 0 ? contentParts.join(' ') : '<br>';

        for (const c of processedCells) {
            if (c !== topLeftCell) {
                c.remove();
            }
        }

        this.clearCellSelection();
        this.applyMutation({ focus: true });
    }

    private getSelectionBounds(
        grid: (HTMLTableCellElement | null)[][],
        selected: HTMLTableCellElement[]
    ): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
        let minRow = Infinity;
        let maxRow = -1;
        let minCol = Infinity;
        let maxCol = -1;
        for (const cell of selected) {
            const bounds = this.getCellGridBounds(grid, cell);
            minRow = Math.min(minRow, bounds.minRow);
            maxRow = Math.max(maxRow, bounds.maxRow);
            minCol = Math.min(minCol, bounds.minCol);
            maxCol = Math.max(maxCol, bounds.maxCol);
        }
        return { minRow, maxRow, minCol, maxCol };
    }

    private getMergeContent(
        grid: (HTMLTableCellElement | null)[][],
        bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }
    ): { contentParts: string[]; processedCells: Set<HTMLTableCellElement> } {
        const contentParts: string[] = [];
        const processedCells = new Set<HTMLTableCellElement>();
        for (let ri = bounds.minRow; ri <= bounds.maxRow; ri++) {
            for (let ci = bounds.minCol; ci <= bounds.maxCol; ci++) {
                const cell = grid[ri]?.[ci];
                if (!cell || processedCells.has(cell)) {
                    continue;
                }
                processedCells.add(cell);
                const text = cell.textContent?.trim() ?? '';
                if (text) {
                    contentParts.push(cell.innerHTML);
                }
            }
        }
        return { contentParts, processedCells };
    }

    canSplitCell(): boolean {
        const target = this.tableContextMenuTarget;
        if (!target) return false;
        return (target.colSpan > 1 || target.rowSpan > 1);
    }

    splitCell(): void {
        this.closeTableContextMenu();
        const target = this.tableContextMenuTarget;
        if (!target) return;
        const rs = target.rowSpan || 1;
        const cs = target.colSpan || 1;
        if (rs <= 1 && cs <= 1) return;

        const table = target.closest<HTMLTableElement>('table');
        if (!table) return;
        const grid = this.buildCellGrid(table);
        const bounds = this.getCellGridBounds(grid, target);

        target.removeAttribute('colspan');
        target.removeAttribute('rowspan');

        const rows = Array.from(table.querySelectorAll('tr'));
        for (let ri = bounds.minRow; ri <= bounds.maxRow; ri++) {
            const row = rows[ri];
            if (!row) continue;
            this.splitCellsInRow(row, ri, bounds, grid, target);
        }

        this.clearCellSelection();
        this.applyMutation({ focus: true });
    }

    private splitCellsInRow(
        row: HTMLTableRowElement,
        ri: number,
        bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number },
        grid: (HTMLTableCellElement | null)[][],
        target: HTMLTableCellElement,
    ): void {
        for (let ci = bounds.minCol; ci <= bounds.maxCol; ci++) {
            if (ri === bounds.minRow && ci === bounds.minCol) continue;
            const isHeader = row.closest('thead') !== null;
            const newCell = this.document.createElement(isHeader ? 'th' : 'td');
            newCell.innerHTML = '<br>';

            const refNode = this.findRefNodeInRow(grid, ri, ci + 1, target, row);
            if (refNode) {
                refNode.before(newCell);
            } else {
                row.appendChild(newCell);
            }
        }
    }

    private findRefNodeInRow(
        grid: (HTMLTableCellElement | null)[][],
        ri: number,
        startCol: number,
        excludeCell: HTMLTableCellElement,
        row: HTMLTableRowElement,
    ): HTMLTableCellElement | null {
        for (let searchCol = startCol; searchCol < grid[ri].length; searchCol++) {
            const candidate = grid[ri][searchCol];
            if (candidate && candidate !== excludeCell && candidate.parentElement === row) {
                return candidate;
            }
        }
        return null;
    }

    private getTableCellInfo(target: HTMLTableCellElement | null): { cell: HTMLTableCellElement; row: HTMLTableRowElement; table: HTMLTableElement; colIndex: number; rowIndex: number } | null {
        const cell = target;
        if (!cell) return null;
        const row = cell.closest<HTMLTableRowElement>('tr');
        const table = cell.closest<HTMLTableElement>('table');
        if (!row || !table) return null;
        const colIndex = Array.from(row.cells).indexOf(cell);
        const allRows = Array.from(table.querySelectorAll('tr'));
        const rowIndex = allRows.indexOf(row);
        return { cell, row, table, colIndex, rowIndex };
    }

    addTableRowAbove(): void {
        this.closeTableContextMenu();
        const info = this.getTableCellInfo(this.tableContextMenuTarget);
        if (!info) return;
        const grid = this.buildCellGrid(info.table);
        const bounds = this.getCellGridBounds(grid, info.cell);
        const insertAtRow = bounds.minRow;
        this.insertTableRowAt(info.table, grid, insertAtRow);
        this.applyMutation({ focus: true });
    }

    addTableRowBelow(): void {
        this.closeTableContextMenu();
        const info = this.getTableCellInfo(this.tableContextMenuTarget);
        if (!info) return;
        const grid = this.buildCellGrid(info.table);
        const bounds = this.getCellGridBounds(grid, info.cell);
        const insertAtRow = bounds.maxRow + 1;
        this.insertTableRowAt(info.table, grid, insertAtRow);
        this.applyMutation({ focus: true });
    }

    private insertTableRowAt(table: HTMLTableElement, grid: (HTMLTableCellElement | null)[][], insertAtRow: number): void {
        const rows = Array.from(table.querySelectorAll('tr'));
        const numCols = grid[0]?.length ?? 0;
        const isHeader = insertAtRow === 0 && table.querySelector('thead') !== null;
        const newRow = this.document.createElement('tr');

        const processed = new Set<HTMLTableCellElement>();
        for (let ci = 0; ci < numCols; ci++) {
            if (this.expandRowSpanForInsertedRow(grid, insertAtRow, ci, processed)) continue;
            if (this.isProcessedReferenceCell(grid, insertAtRow, ci, processed)) continue;

            const newCell = this.document.createElement(isHeader ? 'th' : 'td');
            newCell.innerHTML = '<br>';
            newRow.appendChild(newCell);
        }

        if (insertAtRow >= rows.length) {
            const parent = table.querySelector('tbody') ?? table;
            parent.appendChild(newRow);
        } else {
            const refRow = rows[insertAtRow];
            refRow.parentNode?.insertBefore(newRow, refRow);
        }
    }

    private expandRowSpanForInsertedRow(
        grid: (HTMLTableCellElement | null)[][],
        insertAtRow: number,
        colIndex: number,
        processed: Set<HTMLTableCellElement>
    ): boolean {
        if (insertAtRow > 0 && insertAtRow < grid.length) {
            return this.expandMidRowSpan(grid, insertAtRow, colIndex, processed);
        }
        if (insertAtRow >= grid.length && insertAtRow > 0) {
            return this.expandTailRowSpan(grid, insertAtRow, colIndex, processed);
        }
        return false;
    }

    private expandMidRowSpan(
        grid: (HTMLTableCellElement | null)[][],
        insertAtRow: number,
        colIndex: number,
        processed: Set<HTMLTableCellElement>
    ): boolean {
        const cellAbove = grid[insertAtRow - 1]?.[colIndex];
        const cellBelow = grid[insertAtRow]?.[colIndex];
        if (cellAbove && cellAbove === cellBelow && !processed.has(cellAbove)) {
            processed.add(cellAbove);
            cellAbove.rowSpan = (cellAbove.rowSpan || 1) + 1;
            return true;
        }
        return false;
    }

    private expandTailRowSpan(
        grid: (HTMLTableCellElement | null)[][],
        insertAtRow: number,
        colIndex: number,
        processed: Set<HTMLTableCellElement>
    ): boolean {
        const cellAbove = grid[insertAtRow - 1]?.[colIndex];
        if (!cellAbove || processed.has(cellAbove)) return false;
        const aboveBounds = this.getCellGridBounds(grid, cellAbove);
        if (aboveBounds.maxRow >= grid.length - 1 && aboveBounds.minRow < grid.length - 1) {
            processed.add(cellAbove);
            cellAbove.rowSpan = (cellAbove.rowSpan || 1) + 1;
            return true;
        }
        return false;
    }

    private isProcessedReferenceCell(
        grid: (HTMLTableCellElement | null)[][],
        insertAtRow: number,
        colIndex: number,
        processed: Set<HTMLTableCellElement>
    ): boolean {
        const refRow = insertAtRow > 0 ? insertAtRow - 1 : 0;
        const refCell = grid[refRow]?.[colIndex];
        return !!refCell && processed.has(refCell);
    }

    addTableColumnLeft(): void {
        if (this.isRtl()) {
            this.insertTableColumn('after');
        } else {
            this.insertTableColumn('before');
        }
    }

    addTableColumnRight(): void {
        if (this.isRtl()) {
            this.insertTableColumn('before');
        } else {
            this.insertTableColumn('after');
        }
    }

    private insertTableColumn(position: 'before' | 'after'): void {
        this.closeTableContextMenu();
        const info = this.getTableCellInfo(this.tableContextMenuTarget);
        if (!info) return;

        const grid = this.buildCellGrid(info.table);
        const cellBounds = this.getCellGridBounds(grid, info.cell);
        const insertAtCol = position === 'before' ? cellBounds.minCol : cellBounds.maxCol + 1;
        const rows = Array.from(info.table.querySelectorAll('tr'));
        const numCols = grid[0]?.length ?? 0;

        const processed = new Set<HTMLTableCellElement>();
        for (let ri = 0; ri < grid.length; ri++) {
            if (this.expandColSpanForInsertedColumn(grid, insertAtCol, numCols, ri, processed)) continue;
            if (this.isProcessedReferenceColumnCell(grid, insertAtCol, ri, processed)) continue;

            const row = rows[ri];
            if (!row) continue;
            const isHeader = row.closest('thead') !== null;
            const newCell = this.document.createElement(isHeader ? 'th' : 'td');
            newCell.innerHTML = '<br>';

            const refCell = this.findColumnInsertReferenceCell(grid, row, ri, insertAtCol, numCols);
            if (refCell) {
                refCell.before(newCell);
            } else {
                row.appendChild(newCell);
            }
        }
        this.applyMutation({ focus: true });
    }

    private expandColSpanForInsertedColumn(
        grid: (HTMLTableCellElement | null)[][],
        insertAtCol: number,
        numCols: number,
        rowIndex: number,
        processed: Set<HTMLTableCellElement>
    ): boolean {
        if (insertAtCol > 0 && insertAtCol < numCols) {
            return this.expandMidColSpan(grid, insertAtCol, rowIndex, processed);
        }
        if (insertAtCol >= numCols && insertAtCol > 0) {
            return this.expandTailColSpan(grid, insertAtCol, numCols, rowIndex, processed);
        }
        return false;
    }

    private expandMidColSpan(
        grid: (HTMLTableCellElement | null)[][],
        insertAtCol: number,
        rowIndex: number,
        processed: Set<HTMLTableCellElement>
    ): boolean {
        const cellLeft = grid[rowIndex]?.[insertAtCol - 1];
        const cellRight = grid[rowIndex]?.[insertAtCol];
        if (cellLeft && cellLeft === cellRight && !processed.has(cellLeft)) {
            processed.add(cellLeft);
            cellLeft.colSpan = (cellLeft.colSpan || 1) + 1;
            return true;
        }
        return false;
    }

    private expandTailColSpan(
        grid: (HTMLTableCellElement | null)[][],
        insertAtCol: number,
        numCols: number,
        rowIndex: number,
        processed: Set<HTMLTableCellElement>
    ): boolean {
        const cellLeft = grid[rowIndex]?.[insertAtCol - 1];
        if (!cellLeft || processed.has(cellLeft)) return false;
        const leftBounds = this.getCellGridBounds(grid, cellLeft);
        if (leftBounds.maxCol >= numCols - 1 && leftBounds.minCol < numCols - 1) {
            processed.add(cellLeft);
            cellLeft.colSpan = (cellLeft.colSpan || 1) + 1;
            return true;
        }
        return false;
    }

    private isProcessedReferenceColumnCell(
        grid: (HTMLTableCellElement | null)[][],
        insertAtCol: number,
        rowIndex: number,
        processed: Set<HTMLTableCellElement>
    ): boolean {
        const refCol = insertAtCol > 0 ? insertAtCol - 1 : 0;
        const refCell = grid[rowIndex]?.[refCol];
        return !!refCell && processed.has(refCell);
    }

    private findColumnInsertReferenceCell(
        grid: (HTMLTableCellElement | null)[][],
        row: HTMLTableRowElement,
        rowIndex: number,
        insertAtCol: number,
        numCols: number
    ): HTMLTableCellElement | null {
        for (let searchCol = insertAtCol; searchCol < numCols; searchCol++) {
            const candidate = grid[rowIndex]?.[searchCol];
            if (candidate?.parentElement !== row) {
                continue;
            }
            const candidateBounds = this.getCellGridBounds(grid, candidate);
            if (candidateBounds.minCol >= insertAtCol) {
                return candidate;
            }
        }
        return null;
    }

    deleteTableRow(): void {
        this.closeTableContextMenu();
        const info = this.getTableCellInfo(this.tableContextMenuTarget);
        if (!info) return;
        const allRows = Array.from(info.table.querySelectorAll('tr'));
        if (allRows.length <= 1) {
            info.table.remove();
        } else {
            this.removeTableRow(info.table, info.cell, allRows);
        }
        this.tableContextMenuTarget = null;
        this.applyMutation({ focus: true });
    }

    private removeTableRow(table: HTMLTableElement, cell: HTMLTableCellElement, allRows: HTMLTableRowElement[]): void {
        const grid = this.buildCellGrid(table);
        const bounds = this.getCellGridBounds(grid, cell);
        const rowToDelete = bounds.minRow;
        const numCols = grid[0]?.length ?? 0;
        const processed = new Set<HTMLTableCellElement>();

        for (let ci = 0; ci < numCols; ci++) {
            const currentCell = grid[rowToDelete]?.[ci];
            if (!currentCell || processed.has(currentCell)) {
                continue;
            }
            processed.add(currentCell);
            this.adjustCellForDeletedRow(grid, allRows, rowToDelete, ci, numCols, currentCell);
        }
        allRows[rowToDelete].remove();
    }

    private adjustCellForDeletedRow(
        grid: (HTMLTableCellElement | null)[][],
        allRows: HTMLTableRowElement[],
        rowToDelete: number,
        colIndex: number,
        numCols: number,
        cell: HTMLTableCellElement
    ): void {
        const cellBounds = this.getCellGridBounds(grid, cell);
        if (cellBounds.minRow >= rowToDelete && cellBounds.maxRow <= rowToDelete) {
            return;
        }
        cell.rowSpan = Math.max(1, (cell.rowSpan || 1) - 1);
        if (cellBounds.minRow === rowToDelete && rowToDelete + 1 < allRows.length) {
            const nextRow = allRows[rowToDelete + 1];
            const inserted = this.insertCellBeforeNextNeighbor(grid, rowToDelete, colIndex, numCols, cell, nextRow);
            if (!inserted) {
                nextRow.appendChild(cell);
            }
        }
    }

    private insertCellBeforeNextNeighbor(
        grid: (HTMLTableCellElement | null)[][],
        rowToDelete: number,
        colIndex: number,
        numCols: number,
        cell: HTMLTableCellElement,
        nextRow: HTMLTableRowElement
    ): boolean {
        for (let searchCol = colIndex + (cell.colSpan || 1); searchCol < numCols; searchCol++) {
            const neighbor = grid[rowToDelete + 1]?.[searchCol];
            if (!neighbor || neighbor === cell || neighbor.parentElement !== nextRow) {
                continue;
            }
            const neighborBounds = this.getCellGridBounds(grid, neighbor);
            if (neighborBounds.minRow === rowToDelete + 1) {
                neighbor.before(cell);
                return true;
            }
        }
        return false;
    }

    deleteTableColumn(): void {
        this.closeTableContextMenu();
        const info = this.getTableCellInfo(this.tableContextMenuTarget);
        if (!info) return;

        const grid = this.buildCellGrid(info.table);
        const numCols = grid[0]?.length ?? 0;
        if (numCols <= 1) {
            info.table.remove();
        } else {
            const bounds = this.getCellGridBounds(grid, info.cell);
            const colToDelete = bounds.minCol;

            const processed = new Set<HTMLTableCellElement>();
            for (const gridRow of grid) {
                const cell = gridRow?.[colToDelete];
                if (!cell || processed.has(cell)) continue;
                processed.add(cell);
                const cellBounds = this.getCellGridBounds(grid, cell);
                if (cellBounds.minCol < colToDelete || cellBounds.maxCol > colToDelete) {
                    cell.colSpan = Math.max(1, (cell.colSpan || 1) - 1);
                } else {
                    cell.remove();
                }
            }
        }
        this.tableContextMenuTarget = null;
        this.applyMutation({ focus: true });
    }

    deleteTable(): void {
        this.closeTableContextMenu();
        const info = this.getTableCellInfo(this.tableContextMenuTarget);
        if (!info) return;
        info.table.remove();
        this.tableContextMenuTarget = null;
        this.applyMutation({ focus: true });
    }

    toggleTableHeaderRow(): void {
        this.closeTableContextMenu();
        const info = this.getTableCellInfo(this.tableContextMenuTarget);
        if (!info) return;
        const firstRow = info.table.querySelector('tr');
        if (!firstRow) return;
        const thead = info.table.querySelector('thead');
        if (thead) {
            const existingTbody = info.table.querySelector('tbody');
            const tbody = existingTbody ?? this.document.createElement('tbody');
            if (!existingTbody) {
                info.table.appendChild(tbody);
            }
            const cells = Array.from(firstRow.cells);
            for (const cell of cells) {
                const td = this.document.createElement('td');
                td.innerHTML = cell.innerHTML;
                cell.replaceWith(td);
            }
            tbody.insertBefore(firstRow, tbody.firstChild);
            if (thead.children.length === 0) thead.remove();
        } else {
            const newThead = this.document.createElement('thead');
            const cells = Array.from(firstRow.cells);
            for (const cell of cells) {
                const th = this.document.createElement('th');
                th.innerHTML = cell.innerHTML;
                cell.replaceWith(th);
            }
            newThead.appendChild(firstRow);
            info.table.insertBefore(newThead, info.table.firstChild);
        }
        this.applyMutation({ focus: true });
    }

    setTableBorders(style: 'all' | 'none' | 'outer' | 'horizontal'): void {
        this.closeTableContextMenu();
        const info = this.getTableCellInfo(this.tableContextMenuTarget);
        if (!info) return;

        const table = info.table;
        const cells = Array.from(table.querySelectorAll<HTMLElement>('td, th'));
        const rows = Array.from(table.querySelectorAll('tr'));

        const borderColor = cells.length > 0
            ? getComputedStyle(cells[0]).borderTopColor
            : 'currentColor';
        const borderVal = `1px solid ${borderColor}`;

        this.clearTableBorders(table, cells);

        switch (style) {
            case 'all':
                break;
            case 'none':
                this.setBorderStyleNone(cells);
                break;
            case 'outer':
                this.applyOuterTableBorders(rows, borderVal);
                break;
            case 'horizontal':
                this.applyHorizontalTableBorders(rows, borderVal);
                break;
        }

        this.applyMutation({ focus: true });
    }

    private clearTableBorders(table: HTMLTableElement, cells: HTMLElement[]): void {
        table.style.border = '';
        for (const cell of cells) {
            cell.style.border = '';
            cell.style.borderTop = '';
            cell.style.borderBottom = '';
            cell.style.borderLeft = '';
            cell.style.borderRight = '';
        }
    }

    private setBorderStyleNone(cells: HTMLElement[]): void {
        for (const cell of cells) {
            cell.style.border = 'none';
        }
    }

    private applyOuterTableBorders(rows: HTMLTableRowElement[], borderVal: string): void {
        for (const [ri, row] of rows.entries()) {
            const rowCells = Array.from(row.cells);
            for (const [ci, cell] of rowCells.entries()) {
                cell.style.borderTop = ri === 0 ? borderVal : 'none';
                cell.style.borderBottom = ri === rows.length - 1 ? borderVal : 'none';
                cell.style.borderLeft = ci === 0 ? borderVal : 'none';
                cell.style.borderRight = ci === rowCells.length - 1 ? borderVal : 'none';
            }
        }
    }

    private applyHorizontalTableBorders(rows: HTMLTableRowElement[], borderVal: string): void {
        for (const [ri, row] of rows.entries()) {
            for (const cell of Array.from(row.cells)) {
                cell.style.borderLeft = 'none';
                cell.style.borderRight = 'none';
                cell.style.borderTop = ri === 0 ? borderVal : 'none';
                cell.style.borderBottom = ri < rows.length - 1 ? borderVal : 'none';
            }
        }
    }

    setCellAlignment(align: 'left' | 'center' | 'right'): void {
        this.closeTableContextMenu();
        if (this.tableContextMenuTarget) {
            this.tableContextMenuTarget.style.textAlign = align;
            this.syncContentFromEditor();
            this.pushHistory();
        }
    }

    setCellColor(color: string): void {
        this.closeTableContextMenu();
        if (this.tableContextMenuTarget) {
            this.tableContextMenuTarget.style.backgroundColor = color === 'transparent' ? '' : color;
            this.syncContentFromEditor();
            this.pushHistory();
        }
    }

    private getParentListItem(): HTMLElement | null {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        let node: Node | null = selection.getRangeAt(0).startContainer;
        while (node && node !== this.editorDiv?.nativeElement) {
            if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'LI') {
                return node as HTMLElement;
            }
            node = node.parentNode;
        }
        return null;
    }

    private getParentTaskListItem(): HTMLElement | null {
        const li = this.getParentListItem();
        if (li?.dataset['task'] !== undefined) return li;
        return null;
    }

    private enableTaskCheckboxes(container: HTMLElement): void {
        container.querySelectorAll<HTMLInputElement>('li[data-task] input[type="checkbox"]').forEach(cb => {
            cb.removeAttribute('disabled');
            const li = cb.closest<HTMLElement>('li[data-task]');
            if (li) {
                cb.checked = li.dataset['checked'] === 'true';
            }
        });
    }

    private indentListItem(): void {
        const li = this.getParentListItem();
        if (!li) return;

        if (this.getListDepth(li) >= 6) return;

        const prevLi = li.previousElementSibling;
        if (prevLi?.tagName !== 'LI') return;

        const parentList = li.parentElement;
        const listType = parentList?.tagName === 'OL' ? 'ol' : 'ul';
        let nestedList = prevLi.querySelector(`:scope > ${listType}`);
        if (!nestedList) {
            nestedList = this.document.createElement(listType);
            if (parentList?.dataset['taskList'] !== undefined) {
                (nestedList as HTMLElement).dataset['taskList'] = '';
            }
            prevLi.appendChild(nestedList);
        }
        nestedList.appendChild(li);

        this.applyMutation({ focus: true, updateActiveFormats: true });
    }

    private getListDepth(li: HTMLElement): number {
        let depth = 0;
        let parent: Node | null = li;
        while (parent && parent !== this.editorDiv?.nativeElement) {
            if (parent.nodeType === Node.ELEMENT_NODE &&
                ((parent as Element).tagName === 'UL' || (parent as Element).tagName === 'OL')) {
                depth++;
            }
            parent = parent.parentNode;
        }
        return depth;
    }

    private outdentListItem(): void {
        const li = this.getParentListItem();
        if (!li) return;

        const parentList = li.parentElement;
        if (!parentList || (parentList.tagName !== 'UL' && parentList.tagName !== 'OL')) return;

        const grandparentLi = parentList.parentElement;
        if (grandparentLi?.tagName !== 'LI') return;

        const grandparentList = grandparentLi.parentElement;
        if (!grandparentList) return;

        grandparentList.insertBefore(li, grandparentLi.nextSibling);

        if (!parentList.hasChildNodes() || parentList.children.length === 0) {
            parentList.remove();
        }

        this.applyMutation({ focus: true, updateActiveFormats: true });
    }

    private insertTaskList(): void {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        let node: Node | null = selection.getRangeAt(0).startContainer;
        while (node && node !== this.editorDiv?.nativeElement) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el.closest('ul[data-task-list]')) {
                    this.execEditorCommand('insertUnorderedList');
                    return;
                }
            }
            node = node.parentNode;
        }

        const ul = this.document.createElement('ul');
        ul.dataset['taskList'] = '';
        const li = this.document.createElement('li');
        li.dataset['task'] = '';
        li.dataset['checked'] = 'false';
        const checkbox = this.document.createElement('input');
        checkbox.type = 'checkbox';
        const textSpan = this.document.createElement('span');
        textSpan.appendChild(this.document.createTextNode('\u00A0'));
        li.appendChild(checkbox);
        li.appendChild(textSpan);
        ul.appendChild(li);

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(ul);

        const newRange = this.document.createRange();
        newRange.setStart(textSpan, 0);
        newRange.setEnd(textSpan, 0);
        selection.removeAllRanges();
        selection.addRange(newRange);
        this.syncContentFromEditor();
        this.pushHistory();
    }

    private insertToggleBlock(): void {
        const html = '<details open><summary>Toggle title</summary><p>Content here...</p></details>';
        this.insertHtml(html);
        this.pushHistory();

        const editor = this.editorDiv?.nativeElement;
        if (editor) {
            const summaries = Array.from(editor.querySelectorAll('summary'));
            const lastSummary = summaries.at(-1);
            if (lastSummary) {
                const selection = this.document.getSelection();
                if (selection) {
                    const range = this.document.createRange();
                    range.selectNodeContents(lastSummary);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        }
    }

    onCustomToolbarAction(id: string): void {
        this.customToolbarAction.emit({
            id,
            ref: {
                insertText: (text: string) => this.insertText(text),
                insertHtml: (html: string) => this.insertHtml(html),
                focus: () => this.editorDiv?.nativeElement?.focus(),
                getSelectedText: () => this.selectedText(),
                getHtmlContent: () => this.htmlContent(),
            },
        });
    }

    openFindReplace(showReplace: boolean): void {
        this.findShowReplace.set(showReplace);
        this.findReplaceVisible.set(true);
        requestAnimationFrame(() => {
            const el = (this.el.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[placeholder]');
            if (el) el.focus();
        });
    }

    closeFindReplace(): void {
        this.clearFindHighlights();
        this.findReplaceVisible.set(false);
        this.findQuery.set('');
        this.replaceText.set('');
        this.findMatches.set([]);
        this.findCurrentIndex.set(-1);
        this.editorDiv?.nativeElement?.focus();
    }

    onFindQueryChange(query: string): void {
        this.findQuery.set(query);
        this.performFind();
    }

    toggleFindCaseSensitive(): void {
        this.findCaseSensitive.set(!this.findCaseSensitive());
        this.performFind();
    }

    private performFind(preserveIndex = false): void {
        this.clearFindHighlights();
        const query = this.findQuery();
        if (!query) {
            this.findMatches.set([]);
            this.findCurrentIndex.set(-1);
            return;
        }

        const editor = this.editorDiv?.nativeElement;
        if (!editor) return;

        const caseSensitive = this.findCaseSensitive();
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        const matches: Range[] = [];

        const walker = this.document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        let textNode: Text | null;
        while ((textNode = walker.nextNode() as Text | null)) {
            const text = caseSensitive ? textNode.textContent ?? '' : (textNode.textContent ?? '').toLowerCase();
            let startIndex = 0;
            while (startIndex < text.length) {
                const idx = text.indexOf(searchQuery, startIndex);
                if (idx === -1) break;
                const range = this.document.createRange();
                range.setStart(textNode, idx);
                range.setEnd(textNode, idx + query.length);
                matches.push(range);
                startIndex = idx + query.length;
            }
        }

        this.findMatches.set(matches);
        if (matches.length > 0) {
            if (!preserveIndex) {
                this.findCurrentIndex.set(0);
            }
            this.highlightFindMatches();
            this.scrollToCurrentMatch();
        } else {
            this.findCurrentIndex.set(-1);
        }
    }

    private highlightFindMatches(): void {
        this.clearFindHighlights();
        const matches = this.findMatches();
        const currentIdx = this.findCurrentIndex();

        for (let i = 0; i < matches.length; i++) {
            try {
                const range = matches[i];
                const mark = this.document.createElement('mark');
                mark.dataset['findMatch'] = '';
                mark.style.backgroundColor = i === currentIdx ? 'rgba(250, 204, 21, 0.7)' : 'rgba(250, 204, 21, 0.3)';
                mark.style.borderRadius = '2px';
                if (i === currentIdx) mark.dataset['findCurrent'] = '';
                range.surroundContents(mark);
                this.findHighlightElements.push(mark);
            } catch {
                // Range may span multiple elements; skip
            }
        }
    }

    private clearFindHighlights(): void {
        for (const mark of this.findHighlightElements) {
            const parent = mark.parentNode;
            if (parent) {
                while (mark.firstChild) {
                    parent.insertBefore(mark.firstChild, mark);
                }
                mark.remove();
                parent.normalize();
            }
        }
        this.findHighlightElements = [];
    }

    private scrollToCurrentMatch(): void {
        const current = (this.el.nativeElement as HTMLElement).querySelector<HTMLElement>('mark[data-find-current]');
        if (current) current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    findNext(): void {
        const matches = this.findMatches();
        if (matches.length === 0) return;
        this.findCurrentIndex.set((this.findCurrentIndex() + 1) % matches.length);
        this.performFind(true);
    }

    findPrevious(): void {
        const matches = this.findMatches();
        if (matches.length === 0) return;
        const idx = this.findCurrentIndex() - 1;
        this.findCurrentIndex.set(idx < 0 ? matches.length - 1 : idx);
        this.performFind(true);
    }

    replaceSingle(): void {
        const matches = this.findMatches();
        const idx = this.findCurrentIndex();
        if (matches.length === 0 || idx < 0) return;

        this.clearFindHighlights();
        this.performFind();

        const currentMark = (this.el.nativeElement as HTMLElement).querySelector<HTMLElement>('mark[data-find-current]');
        if (currentMark) {
            currentMark.textContent = this.replaceText();
            const parent = currentMark.parentNode;
            if (parent) {
                while (currentMark.firstChild) parent.insertBefore(currentMark.firstChild, currentMark);
                currentMark.remove();
                parent.normalize();
            }
        }
        this.findHighlightElements = this.findHighlightElements.filter(el => el !== currentMark);
        this.clearFindHighlights();
        this.syncContentFromEditor();
        this.pushHistory();
        this.performFind();
    }

    replaceAll(): void {
        this.clearFindHighlights();
        this.performFind();

        const marks = Array.from((this.el.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('mark[data-find-match]'));
        marks.reverse();
        for (const mark of marks) {
            mark.textContent = this.replaceText();
            const parent = mark.parentNode;
            if (parent) {
                while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
                mark.remove();
                parent.normalize();
            }
        }
        this.findHighlightElements = [];
        this.syncContentFromEditor();
        this.pushHistory();
        this.performFind();
    }

    onFindReplaceKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            if (event.shiftKey) {
                this.findPrevious();
            } else {
                this.findNext();
            }
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

    private getEditorElement(): HTMLDivElement | null {
        if (this.editorDiv?.nativeElement) {
            return this.editorDiv.nativeElement;
        }
        return (this.el.nativeElement as HTMLElement).querySelector<HTMLDivElement>('[data-slot="rich-text-editor"]');
    }

    private syncContentFromEditor(): void {
        const editorElement = this.getEditorElement();
        if (editorElement) {
            const html = this.sanitizer.sanitize(editorElement.innerHTML).replaceAll('\u200B', '');
            this.htmlContent.set(html);

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(html)
                : html;
            this.onChange(outputValue);
        }
    }

    private getMentionElementsInSelection(): HTMLElement[] {
        const editor = this.getEditorElement();
        const selection = this.document.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) return [];

        const range = selection.getRangeAt(0);
        if (!editor.contains(range.startContainer)) return [];

        const mentionElements = editor.querySelectorAll<HTMLElement>('[data-mention], [data-tag]');
        const result: HTMLElement[] = [];

        mentionElements.forEach(el => {
            if (selection.containsNode(el, true)) {
                result.push(el);
            }
        });

        return result;
    }

    private toggleMentionStyle(elements: HTMLElement[], prop: 'fontWeight' | 'fontStyle', onValue: string, offValue: string): void {
        for (const el of elements) {
            el.style[prop] = el.style[prop] === onValue ? offValue : onValue;
        }
    }

    private toggleMentionTextDecoration(elements: HTMLElement[], decoration: string): void {
        for (const el of elements) {
            const current = el.style.textDecoration || '';
            if (current.includes(decoration)) {
                el.style.textDecoration = current.replace(decoration, '').trim() || '';
            } else {
                el.style.textDecoration = (current + ' ' + decoration).trim();
            }
        }
    }

    private setMentionStyle(elements: HTMLElement[], prop: 'color' | 'backgroundColor' | 'fontSize' | 'fontFamily', value: string): void {
        for (const el of elements) {
            el.style[prop] = value;
        }
    }

    private clearMentionStyles(elements: HTMLElement[]): void {
        for (const el of elements) {
            el.style.fontWeight = '';
            el.style.fontStyle = '';
            el.style.textDecoration = '';
            el.style.color = '';
            el.style.backgroundColor = '';
            el.style.fontSize = '';
            el.style.fontFamily = '';
        }
    }

    private applyMutation(options?: { focus?: boolean; updateActiveFormats?: boolean; pushHistory?: boolean }): void {
        this.flushPendingHistoryPush();
        this.syncContentFromEditor();
        if (options?.updateActiveFormats) {
            this.updateActiveFormats();
        }
        if (options?.focus) {
            this.focusEditor();
        }
        if (options?.pushHistory !== false) {
            this.pushHistory();
        }
    }

    private execEditorCommand(commandId: string, value?: string): boolean {
        const doc = this.document as unknown as {
            execCommand?: (id: string, showUI?: boolean, commandValue?: string) => boolean;
        };
        return doc.execCommand?.(commandId, false, value) ?? false;
    }

    private queryEditorCommandState(commandId: string): boolean {
        const doc = this.document as unknown as { queryCommandState?: (id: string) => boolean };
        return doc.queryCommandState?.(commandId) ?? false;
    }

    private focusEditor(): void {
        this.editorDiv?.nativeElement?.focus();
    }

    /** Registry of addon-contributed toolbar buttons (addon host surface). */
    readonly toolbarSlots = new AddonSlotRegistry<RichTextToolbarSlot>();

    /** The editor's slash-command registry (addon host surface). */
    get commands(): RichTextCommandRegistry {
        return this.commandRegistry;
    }

    /** The contenteditable content root (addon host surface). */
    get contentRoot(): HTMLElement {
        return this.editorDiv?.nativeElement as HTMLElement;
    }

    /** The editor's positioned (relative) container element (addon host surface). */
    get overlayAnchor(): HTMLElement {
        return this.editorContainer?.nativeElement ?? this.contentRoot;
    }

    /**
     * Bind an action to a known shortcut definition (addon host surface). The
     * base ships no handler for these; the shortcut stays inert until an addon
     * registers the action here.
     */
    registerShortcutAction(actionId: string, run: () => void, when?: () => boolean): () => void {
        const entry = { run, when };
        this.shortcutActions.set(actionId, entry);
        return () => {
            if (this.shortcutActions.get(actionId) === entry) {
                this.shortcutActions.delete(actionId);
            }
        };
    }

    private canRunShortcutAction(actionId: string): boolean {
        const entry = this.shortcutActions.get(actionId);
        return !!entry && (!entry.when || entry.when());
    }

    private runShortcutAction(actionId: string): void {
        this.shortcutActions.get(actionId)?.run();
    }

    /** Snapshot the current selection / caret target for an addon. */
    selection(): RichTextSelectionSnapshot {
        const editor = this.editorDiv?.nativeElement;
        const sel = this.document.getSelection();
        const empty: RichTextSelectionSnapshot = {
            kind: 'none', text: '', range: null, imageElement: null, closestWithAttrs: () => null,
        };
        if (!editor || !sel || sel.rangeCount === 0) return empty;
        const range = sel.getRangeAt(0);
        if (!editor.contains(range.startContainer)) return empty;
        const focusedImage = this.selectedImage();
        if (focusedImage) {
            return {
                kind: 'image', text: '', range: range.cloneRange(), imageElement: focusedImage,
                closestWithAttrs: (attrs) => this.closestElementWithAttrs(focusedImage, attrs, editor),
            };
        }
        const text = range.toString();
        return {
            kind: text.length > 0 ? 'text' : 'none',
            text, range: range.cloneRange(), imageElement: null,
            closestWithAttrs: (attrs) => this.closestElementWithAttrs(range.startContainer, attrs, editor),
        };
    }

    private closestElementWithAttrs(node: Node | null, attrs: readonly string[], boundary: HTMLElement): HTMLElement | null {
        let el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
        while (el && boundary.contains(el)) {
            if (attrs.some((a) => el?.hasAttribute(a))) return el;
            el = el.parentElement;
        }
        return null;
    }

    /** Persist the current in-editor selection (addon host surface). */
    saveSelection(): void {
        const sel = this.document.getSelection();
        const editor = this.editorDiv?.nativeElement;
        if (sel && editor && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).startContainer)) {
            this.savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    /** Run an addon mutation inside the editor transaction (history + emit). */
    mutateContent(mutate: (root: HTMLElement) => void): void {
        const editor = this.editorDiv?.nativeElement;
        if (!editor) return;
        mutate(editor);
        this.applyMutation({ pushHistory: true });
    }

    /** Wrap the saved text selection in the built element (addon host surface). */
    wrapSelection(build: () => HTMLElement): HTMLElement[] {
        this.restoreSelection();
        const sel = this.document.getSelection();
        const editor = this.editorDiv?.nativeElement;
        if (!sel || sel.rangeCount === 0 || !editor) return [];
        const range = sel.getRangeAt(0);
        const wrapper = build();
        try {
            range.surroundContents(wrapper);
        } catch {
            wrapper.appendChild(range.extractContents());
            range.insertNode(wrapper);
        }
        this.applyMutation({ pushHistory: true });
        return [wrapper];
    }

    /** Handle a click on an addon-contributed toolbar slot. */
    onAddonSlotClick(payload: { slot: RichTextToolbarSlot; event: Event }): void {
        payload.slot.onClick?.(payload.event);
    }

    restoreSelection(): void {
        const editor = this.editorDiv?.nativeElement;
        if (!editor) return;
        const selection = this.document.getSelection();
        if (!selection) return;
        // 1. Prefer an explicitly saved range that still lives in the editor.
        if (this.savedRange && editor.contains(this.savedRange.startContainer)) {
            this.focusEditor();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
            return;
        }
        // 2. Keep the current selection if it is already inside the editor.
        if (selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).startContainer)) {
            return;
        }
        // 3. Otherwise (editor never focused, or the caret is in the toolbar /
        //    overlay UI, e.g. an addon picker's search field) drop the caret at the end of the editor content
        //    so insertions always land in the text.
        this.focusEditor();
        const range = this.document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    private updateActiveFormats(): void {
        const formats = new Set<string>();

        if (this.queryEditorCommandState('bold')) formats.add('bold');
        if (this.queryEditorCommandState('italic')) formats.add('italic');
        if (this.queryEditorCommandState('underline')) formats.add('underline');
        if (this.queryEditorCommandState('strikeThrough')) formats.add('strikethrough');
        if (this.queryEditorCommandState('insertUnorderedList')) formats.add('bulletList');
        if (this.queryEditorCommandState('insertOrderedList')) formats.add('orderedList');

        this.detectTaskListFormat(formats);
        this.activeFormats.set(formats);
        this.detectCurrentFontSize();
        this.detectCurrentFontFamily();
        this.detectCurrentColors();
    }

    private detectTaskListFormat(formats: Set<string>): void {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }
        let el: Node | null = selection.getRangeAt(0).startContainer;
        while (el && el !== this.editorDiv?.nativeElement) {
            if (el.nodeType === Node.ELEMENT_NODE && (el as Element).closest('ul[data-task-list]')) {
                formats.add('taskList');
                break;
            }
            el = el.parentNode;
        }
    }

    private selectedElement(): HTMLElement | null {
        const sel = this.document.getSelection();
        if (!sel || sel.rangeCount === 0) {
            return null;
        }
        let node: Node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement ?? node;
        }
        return node instanceof HTMLElement ? node : null;
    }

    private detectCurrentFontSize(): void {
        const element = this.selectedElement();
        if (!element) {
            return;
        }
        const computedStyle = this.document.defaultView?.getComputedStyle(element);
        if (!computedStyle) {
            return;
        }
        const fontSize = computedStyle.fontSize;
        const numericSize = Number.parseInt(fontSize, 10);
        if (!Number.isNaN(numericSize)) {
            this.currentFontSize.set(numericSize.toString());
        }
    }

    private detectCurrentFontFamily(): void {
        const element = this.selectedElement();
        if (!element) {
            return;
        }
        const computedStyle = this.document.defaultView?.getComputedStyle(element);
        if (!computedStyle) {
            return;
        }
        const fontFamily = computedStyle.fontFamily;
        if (fontFamily) {
            const cleaned = fontFamily.split(',')[0].trim().replaceAll(/^["']|["']$/g, '');
            this.currentFontFamily.set(cleaned);
        }
    }

    private detectCurrentColors(): void {
        const element = this.selectedElement();
        const view = this.document.defaultView;
        if (!element || !view) {
            return;
        }
        const computedStyle = view.getComputedStyle(element);
        this.currentFontColor.set(computedStyle.color);
        this.currentBackgroundColor.set(computedStyle.backgroundColor);
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

    private placeCaretAtEndOfBlock(block: HTMLElement): void {
        const selection = this.document.getSelection();
        if (!selection) {
            return;
        }

        if (this.isEmptyBlock(block)) {
            const target = this.ensureZeroWidthTextNode(block);
            this.setSelectionAtTextEnd(selection, target);
            return;
        }

        const target = this.getDeepestLastNode(block);
        this.setSelectionAtNodeEnd(selection, target);
    }

    private ensureZeroWidthTextNode(block: HTMLElement): Text {
        let target: Text | null = null;
        const walker = this.document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const textNode = walker.currentNode as Text;
            if (textNode.data.includes('\u200B')) {
                target = textNode;
            }
        }
        if (target) {
            return target;
        }
        target = this.document.createTextNode('\u200B');
        if (block.firstChild) {
            block.insertBefore(target, block.firstChild);
        } else {
            block.appendChild(target);
        }
        return target;
    }

    private getDeepestLastNode(block: HTMLElement): Node {
        let target: Node = block;
        while (target.lastChild) {
            target = target.lastChild;
        }
        return target;
    }

    private setSelectionAtTextEnd(selection: Selection, textNode: Text): void {
        const range = this.document.createRange();
        range.setStart(textNode, textNode.length);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    private setSelectionAtNodeEnd(selection: Selection, target: Node): void {
        const range = this.document.createRange();
        if (target.nodeType === Node.TEXT_NODE) {
            const text = target as Text;
            range.setStart(text, text.length);
        } else {
            range.setStartAfter(target);
        }
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * Apply a built-in toolbar command to a specific block (addon host surface):
     * the block-transform engine used by the slash-commands addon.
     */
    executeToolbarCommandOnBlock(command: string, anchorBlock: HTMLElement | null): void {
        if (command === 'code') {
            this.insertInlineCodeFromSlash(anchorBlock);
            return;
        }

        const transformed = anchorBlock ? this.transformBlockForSlashCommand(anchorBlock, command) : null;
        if (transformed) {
            this.placeCaretAtEndOfBlock(transformed);
            this.applyMutation({ updateActiveFormats: true });
            return;
        }

        if (anchorBlock) {
            this.placeCaretAtEndOfBlock(anchorBlock);
        }
        this.onFormatCommand(command);
    }

    private transformBlockForSlashCommand(anchorBlock: HTMLElement, command: string): HTMLElement | null {
        const editor = this.getEditorElement();
        if (!editor || !editor.contains(anchorBlock) || anchorBlock === editor) {
            return null;
        }

        if (command === 'bulletList') {
            return this.wrapBlockInList(anchorBlock, 'ul');
        }
        if (command === 'orderedList') {
            return this.wrapBlockInList(anchorBlock, 'ol');
        }

        const tagMap: Record<string, string> = {
            paragraph: 'p',
            heading1: 'h1',
            heading2: 'h2',
            heading3: 'h3',
            blockquote: 'blockquote',
        };
        const nextTag = tagMap[command];
        if (!nextTag) {
            return null;
        }
        return this.replaceBlockTag(anchorBlock, nextTag);
    }

    private insertInlineCodeFromSlash(anchorBlock: HTMLElement | null): void {
        if (anchorBlock) {
            this.placeCaretAtEndOfBlock(anchorBlock);
        }
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);
        const code = this.document.createElement('code');
        const textNode = this.document.createTextNode('\u200B');
        const trailingNode = this.document.createTextNode('\u200B');
        code.appendChild(textNode);
        range.deleteContents();
        range.insertNode(trailingNode);
        range.insertNode(code);

        const newRange = this.document.createRange();
        newRange.setStart(textNode, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        this.syncContentFromEditor();
        this.updateActiveFormats();
        this.pushHistory();
    }

    private replaceBlockTag(block: HTMLElement, targetTagName: string): HTMLElement {
        const normalized = targetTagName.toUpperCase();
        if (block.tagName === normalized) {
            return block;
        }

        const replacement = this.document.createElement(targetTagName);
        while (block.firstChild) {
            replacement.appendChild(block.firstChild);
        }
        block.parentNode?.replaceChild(replacement, block);
        return replacement;
    }

    private wrapBlockInList(block: HTMLElement, listTagName: 'ul' | 'ol'): HTMLElement {
        if (block.tagName === 'LI') {
            const parentList = block.parentElement;
            if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL') && parentList.tagName.toLowerCase() !== listTagName) {
                const replacementList = this.document.createElement(listTagName);
                while (parentList.firstChild) {
                    replacementList.appendChild(parentList.firstChild);
                }
                parentList.parentNode?.replaceChild(replacementList, parentList);
            }
            return block;
        }

        const list = this.document.createElement(listTagName);
        const item = this.document.createElement('li');
        while (block.firstChild) {
            item.appendChild(block.firstChild);
        }
        if (this.isEmptyBlock(item)) {
            item.innerHTML = '<br>';
        }
        list.appendChild(item);
        block.parentNode?.replaceChild(list, block);
        return item;
    }

    private isEmptyBlock(block: HTMLElement): boolean {
        const text = (block.textContent ?? '').replaceAll('\u200B', '').trim();
        if (text.length > 0) {
            return false;
        }
        const nonEmptyElement = Array.from(block.children).find(child => child.tagName !== 'BR');
        return !nonEmptyElement;
    }

    private buildTriggerAwareText(html: string): string {
        const blockAware = html
            .replaceAll(/<br\s*\/?>/gi, '\n')
            .replaceAll(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n');
        return this.sanitizer.stripTags(blockAware);
    }

    private isSelectionInsideEditor(): boolean {
        const selection = this.document.getSelection();
        const editor = this.getEditorElement();
        if (!selection || selection.rangeCount === 0 || !editor) {
            return false;
        }
        const range = selection.getRangeAt(0);
        return editor.contains(range.startContainer) && editor.contains(range.endContainer);
    }

    private computeDelta(prev: string, current: string): string {
        const prevLines = prev.split('\n');
        const curLines = current.split('\n');
        const ops: string[] = [];
        let pi = 0;
        let ci = 0;
        while (pi < prevLines.length && ci < curLines.length) {
            if (prevLines[pi] === curLines[ci]) {
                ops.push('=' + pi);
                pi++;
                ci++;
                continue;
            }
            const { foundPrev, foundCur } = this.findDeltaLookahead(prevLines, curLines, pi, ci);
            if (foundCur !== -1 && (foundPrev === -1 || (foundCur - ci) <= (foundPrev - pi))) {
                this.pushAddedOps(ops, curLines, ci, foundCur);
                ops.push('=' + pi);
                pi++;
                ci = foundCur + 1;
                continue;
            }
            if (foundPrev === -1) {
                ops.push('-' + pi, '+' + curLines[ci]);
                pi++;
                ci++;
                continue;
            }
            this.pushRemovedOps(ops, pi, foundPrev);
            ops.push('=' + foundPrev);
            pi = foundPrev + 1;
            ci++;
        }
        while (pi < prevLines.length) {
            ops.push('-' + pi);
            pi++;
        }
        while (ci < curLines.length) {
            ops.push('+' + curLines[ci]);
            ci++;
        }
        return ops.join('\x01');
    }

    private findDeltaLookahead(
        prevLines: string[],
        curLines: string[],
        prevIndex: number,
        currentIndex: number
    ): { foundPrev: number; foundCur: number } {
        let foundPrev = -1;
        let foundCur = -1;
        for (let look = 1; look <= 5; look++) {
            if (foundCur === -1 && currentIndex + look < curLines.length && prevLines[prevIndex] === curLines[currentIndex + look]) {
                foundCur = currentIndex + look;
            }
            if (foundPrev === -1 && prevIndex + look < prevLines.length && prevLines[prevIndex + look] === curLines[currentIndex]) {
                foundPrev = prevIndex + look;
            }
            if (foundCur !== -1 || foundPrev !== -1) {
                break;
            }
        }
        return { foundPrev, foundCur };
    }

    private pushAddedOps(ops: string[], curLines: string[], start: number, end: number): void {
        for (let i = start; i < end; i++) {
            ops.push('+' + curLines[i]);
        }
    }

    private pushRemovedOps(ops: string[], start: number, end: number): void {
        for (let i = start; i < end; i++) {
            ops.push('-' + i);
        }
    }

    private applyDelta(base: string, delta: string): string {
        if (!delta) return base;
        const baseLines = base.split('\n');
        const ops = delta.split('\x01');
        const result: string[] = [];
        for (const op of ops) {
            if (!op) continue;
            const type = op[0];
            const value = op.substring(1);
            if (type === '=') {
                const idx = Number.parseInt(value, 10);
                if (idx >= 0 && idx < baseLines.length) {
                    result.push(baseLines[idx]);
                }
            } else if (type === '+') {
                result.push(value);
            }
        }
        return result.join('\n');
    }

    private reconstructHtml(index: number): string {
        const entry = this.history[index];
        if (entry.keyframe) {
            return entry.html;
        }
        let keyframeIdx = index;
        while (keyframeIdx >= 0 && !this.history[keyframeIdx].keyframe) {
            keyframeIdx--;
        }
        if (keyframeIdx < 0) {
            return entry.html;
        }
        let html = this.history[keyframeIdx].html;
        for (let i = keyframeIdx + 1; i <= index; i++) {
            const e = this.history[i];
            if (e.keyframe) {
                html = e.html;
            } else if (e.delta) {
                html = this.applyDelta(html, e.delta);
            } else {
                html = e.html;
            }
        }
        return html;
    }

    private lastReconstructedIndex = -1;
    private lastReconstructedHtml = '';

    private reconstructHtmlCached(index: number): string {
        if (this.lastReconstructedIndex === index && this.lastReconstructedHtml) {
            return this.lastReconstructedHtml;
        }
        const html = this.reconstructHtml(index);
        this.lastReconstructedIndex = index;
        this.lastReconstructedHtml = html;
        return html;
    }

    private pushHistory(): void {
        const currentHtml = this.htmlContent();
        const lastEntry = this.history.at(-1);
        const lastHtml = lastEntry ? this.reconstructHtmlCached(this.history.length - 1) : '';
        if (lastEntry && lastHtml === currentHtml) {
            return;
        }
        const previewData = this.buildHistoryPreview(currentHtml);

        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        const isKeyframe = !lastEntry || this.history.length % 10 === 0;
        const delta = (!isKeyframe && lastEntry)
            ? this.computeDelta(lastHtml, currentHtml)
            : null;

        const entry: HistoryEntry = {
            html: isKeyframe ? currentHtml : '',
            delta,
            keyframe: isKeyframe,
            selection: this.captureSelection(),
            timestamp: Date.now(),
            preview: previewData.preview,
            previewLines: previewData.previewLines,
            lineCount: previewData.lineCount,
        };

        this.history.push(entry);
        this.historyIndex = this.history.length - 1;
        this.lastReconstructedIndex = this.historyIndex;
        this.lastReconstructedHtml = currentHtml;

        const maxEntries = Math.max(10, this.historyLimit());
        if (this.history.length > maxEntries) {
            if (!this.history[0].keyframe && this.history.length > 1) {
                this.history[1].html = this.reconstructHtml(1);
                this.history[1].keyframe = true;
                this.history[1].delta = null;
            }
            this.history.shift();
            this.historyIndex--;
            this.lastReconstructedIndex--;
        }
        this.bumpHistoryVersion();
    }

    private undo(): void {
        this.flushPendingHistoryPush();
        if (this.historyIndex > 0) {
            this.isUndoRedo = true;
            this.historyIndex--;
            const entry = this.history[this.historyIndex];
            const html = this.reconstructHtmlCached(this.historyIndex);
            this.htmlContent.set(html);

            if (this.editorDiv?.nativeElement) {
                this.editorDiv.nativeElement.innerHTML = html;
                this.enableTaskCheckboxes(this.editorDiv.nativeElement);
            }
            this.restoreSerializedSelection(entry.selection);

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(html)
                : html;
            this.onChange(outputValue);
            this.bumpHistoryVersion();
        }
    }

    private redo(): void {
        this.flushPendingHistoryPush();
        if (this.historyIndex < this.history.length - 1) {
            this.isUndoRedo = true;
            this.historyIndex++;
            const entry = this.history[this.historyIndex];
            const html = this.reconstructHtmlCached(this.historyIndex);
            this.htmlContent.set(html);

            if (this.editorDiv?.nativeElement) {
                this.editorDiv.nativeElement.innerHTML = html;
                this.enableTaskCheckboxes(this.editorDiv.nativeElement);
            }
            this.restoreSerializedSelection(entry.selection);

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(html)
                : html;
            this.onChange(outputValue);
            this.bumpHistoryVersion();
        }
    }

    private scheduleDebouncedHistoryPush(): void {
        const delay = Math.max(0, this.historyDebounceMs());
        if (this.historyDebounceTimer) {
            clearTimeout(this.historyDebounceTimer);
        }
        this.historyDebounceTimer = setTimeout(() => {
            this.historyDebounceTimer = null;
            this.pushHistory();
        }, delay);
    }

    /** Flush any pending debounced history push as one entry (addon host surface). */
    flushPendingHistoryPush(): void {
        if (!this.historyDebounceTimer) {
            return;
        }
        clearTimeout(this.historyDebounceTimer);
        this.historyDebounceTimer = null;
        this.pushHistory();
    }

    /** Read-only projection of the history stack, oldest first (addon host surface). */
    historyEntries(): readonly RichTextHistoryEntrySnapshot[] {
        this.historyVersion();
        return this.history.map((entry, index) => ({
            index,
            timestamp: entry.timestamp,
            preview: entry.preview,
            previewLines: entry.previewLines,
            lineCount: entry.lineCount,
        }));
    }

    /** Index of the entry the editor currently reflects (addon host surface). */
    currentHistoryIndex(): number {
        this.historyVersion();
        return this.historyIndex;
    }

    /** Reconstruct a history entry's HTML + Markdown (addon host surface). */
    reconstructHistoryEntry(index: number): { html: string; markdown: string } | null {
        if (index < 0 || index >= this.history.length) {
            return null;
        }
        const html = this.reconstructHtmlCached(index);
        return { html, markdown: this.markdownService.toMarkdown(html) };
    }

    private bumpHistoryVersion(): void {
        this._historyVersion.update(v => v + 1);
    }

    private buildHistoryPreview(html: string): { preview: string; previewLines: string[]; lineCount: number } {
        const blockAware = html
            .replaceAll(/<br\s*\/?>/gi, '\n')
            .replaceAll(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
            .replaceAll(/<li[^>]*>/gi, 'ג€¢ ');
        const plain = this.sanitizer.stripTags(blockAware);
        const lines = plain
            .split('\n')
            .map(line => line.replaceAll(/<\/?[^>]{1,4096}>/g, '').replaceAll(/\s{1,4096}/g, ' ').trim())
            .filter(Boolean);
        const safeLines = lines.length ? lines : ['(empty)'];
        return {
            preview: safeLines.join(' ').slice(0, 120),
            previewLines: safeLines.slice(0, 3),
            lineCount: safeLines.length,
        };
    }

    private captureSelection(): SerializedSelection | null {
        const editor = this.getEditorElement();
        const selection = this.document.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);
        if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
            return null;
        }

        return {
            startPath: this.getNodePath(editor, range.startContainer),
            startOffset: range.startOffset,
            endPath: this.getNodePath(editor, range.endContainer),
            endOffset: range.endOffset,
        };
    }

    private restoreSerializedSelection(serialized: SerializedSelection | null): void {
        if (!serialized) {
            return;
        }
        const editor = this.getEditorElement();
        const selection = this.document.getSelection();
        if (!editor || !selection) {
            return;
        }

        const startNode = this.resolveNodePath(editor, serialized.startPath);
        const endNode = this.resolveNodePath(editor, serialized.endPath);
        if (!startNode || !endNode) {
            return;
        }

        const startOffset = this.clampNodeOffset(startNode, serialized.startOffset);
        const endOffset = this.clampNodeOffset(endNode, serialized.endOffset);
        const range = this.document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    private getNodePath(root: Node, node: Node): number[] {
        const path: number[] = [];
        let current: Node | null = node;
        while (current && current !== root) {
            const parentNode: Node | null = current.parentNode;
            if (!parentNode) {
                return [];
            }
            path.unshift(Array.prototype.indexOf.call(parentNode.childNodes, current));
            current = parentNode;
        }
        return path;
    }

    private resolveNodePath(root: Node, path: number[]): Node | null {
        let current: Node = root;
        for (const index of path) {
            const next = current.childNodes.item(index);
            if (!next) {
                return null;
            }
            current = next;
        }
        return current;
    }

    private clampNodeOffset(node: Node, desiredOffset: number): number {
        if (node.nodeType === Node.TEXT_NODE) {
            return Math.max(0, Math.min(desiredOffset, node.textContent?.length ?? 0));
        }
        return Math.max(0, Math.min(desiredOffset, node.childNodes.length));
    }

    ngOnDestroy(): void {
        this.cancelAi();
        this.shortcutHandle?.unregister();
        this.shortcutHandle = null;
        if (this.historyDebounceTimer) {
            clearTimeout(this.historyDebounceTimer);
            this.historyDebounceTimer = null;
        }
        this.document.removeEventListener('mousemove', this.onTableResizeMoveBound);
        this.document.removeEventListener('mouseup', this.onTableResizeUpBound);
        this.document.removeEventListener('touchmove', this.onTableCellTouchMoveBound);
        this.document.removeEventListener('touchend', this.onTableCellTouchEndBound);
        this.closeTableContextMenu();
        this.removeFloatingScrollListener();
    }
}
