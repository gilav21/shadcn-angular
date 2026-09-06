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
import { DOCUMENT } from '@angular/common';
import { cn } from '../../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { RichTextMarkdownService } from './rich-text-markdown.service';
import { RichTextPasteNormalizerService } from './rich-text-paste-normalizer.service';
import { RichTextToolbarComponent, ToolbarItem } from './sub/rich-text-toolbar.component';
import {
    buildFindIndex,
    compileFindRegex,
    offsetToPosition,
    type FindIndex,
} from './rich-text-find.utils';
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
import {
    matchBlockInputRule,
    matchInlineInputRule,
    type BlockInputRuleMatch,
} from './rich-text-input-rules';
import type { RichTextEditorApi, RichTextFormatCommand } from './rich-text-editor.api';
import { isRichTextEmpty } from './rich-text-editor.validators';
import { RICH_TEXT_PROSE_CLASSES } from './rich-text-prose';
import { createLocaleBindings, interpolate, provideComponentLocale, type LocaleInput } from '../../lib/i18n';

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
 * - `'default'` — Standard bordered input with focus ring.
 * - `'ghost'` — No visible border until focused, useful for inline editing.
 */
export type EditorVariant = VariantProps<typeof editorVariants>['variant'];

/**
 * Text size preset for the editor content area.
 *
 * - `'default'` — Base text size (`text-base`).
 * - `'sm'` — Compact text (`text-sm`), good for comment boxes.
 * - `'lg'` — Larger text (`text-lg`), good for article editing.
 */
export type EditorSize = VariantProps<typeof editorVariants>['size'];

/**
 * Determines the output format and internal handling of content.
 *
 * - `'markdown'` — Editor accepts and emits Markdown. HTML is converted
 *   to/from Markdown transparently using the built-in converter.
 * - `'html'` — Editor works directly with raw HTML. No Markdown conversion.
 *
 * @default 'markdown'
 */
export type EditorMode = 'markdown' | 'html';

/**
 * Controls where (or whether) the formatting toolbar appears.
 *
 * - `'top'` — Fixed toolbar above the editor area.
 * - `'floating'` — Appears near the text selection, like Medium/Notion.
 * - `'none'` — No toolbar rendered. Use keyboard shortcuts or slash commands instead.
 *
 * @default 'top'
 */
export type ToolbarPosition = 'top' | 'floating' | 'none';

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

/**
 * The default toolbar layout used when `[toolbarItems]` is not provided.
 * Groups: formatting | block type | lists | alignment | colors/size | insert | code | clear.
 *
 * Block type is one `'textStyle'` select rather than four buttons: on a 320px
 * phone the toolbar scrolls horizontally, and those four were its biggest fixed
 * cost. A consumer who prefers the buttons can still list
 * `'paragraph', 'heading1', 'heading2', 'heading3'` explicitly.
 */
/**
 * Upper bound on the highlight rectangles the find overlay paints at once.
 * Every match is still counted and navigable; beyond this many, only the
 * current match's rectangles are guaranteed to be drawn, which keeps a
 * thousands-of-matches query from spending its whole budget in layout.
 */
export const FIND_MAX_PAINTED_RECTS = 500;

/**
 * Upper bound on the matches one search collects. A query matching more than
 * this in a single document is a runaway pattern rather than a search anyone is
 * reading, and the cap keeps the pass bounded.
 */
const FIND_MAX_MATCHES = 10_000;

/** Options accepted by {@link RichTextEditorComponent.setContent}. */
export interface RichTextSetContentOptions {
    /** Push one history entry so the write can be undone. Default `true`. */
    recordHistory?: boolean;
}

/** The undo-stack state carried by {@link RichTextEditorComponent.historyChange}. */
export interface RichTextHistoryState {
    canUndo: boolean;
    canRedo: boolean;
}

export const DEFAULT_TOOLBAR_ITEMS: ToolbarItem[] = [
    'bold', 'italic', 'underline',
    'separator',
    'textStyle',
    'separator',
    'bulletList', 'orderedList', 'taskList',
    'separator',
    'indent', 'outdent',
    'separator',
    'alignLeft', 'alignCenter', 'alignRight',
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
        RichTextToolbarComponent,
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
        RichTextCommandRegistry,
        provideComponentLocale(() => RichTextEditorComponent),
    ],
    templateUrl: './rich-text-editor.component.html',
    host: {
        class: 'block',
    },
})
export class RichTextEditorComponent extends RichTextEditorAddonHost implements RichTextEditorApi, ControlValueAccessor, OnInit, AfterViewInit, OnDestroy {
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly markdownService = inject(RichTextMarkdownService);
    private readonly pasteNormalizer = inject(RichTextPasteNormalizerService);
    private readonly document = inject(DOCUMENT);
    private readonly el = inject(ElementRef);
    private readonly shortcutBindings = inject(ShortcutBindingService);
    private readonly commandRegistry = inject(RichTextCommandRegistry);
    private readonly rootCommandRegistry = inject(RichTextCommandRegistry, { skipSelf: true });

    @ViewChild('editorDiv') editorDiv?: ElementRef<HTMLDivElement>;
    @ViewChild('editorContainer') editorContainer?: ElementRef<HTMLElement>;
    @ViewChild('tableContextMenuRef') tableContextMenuRef?: ElementRef<HTMLDivElement>;


    /** Output format: `'markdown'` converts to/from Markdown; `'html'` works with raw HTML. */
    mode = input<EditorMode>('markdown');


    /** Visual border/focus style. See {@link EditorVariant}. */
    variant = input<EditorVariant>('default');

    /** Text size preset for the editor content. See {@link EditorSize}. */
    size = input<EditorSize>('default');


    /** Where to render the formatting toolbar. See {@link ToolbarPosition}. */
    toolbar = input<ToolbarPosition>('top');

    /**
     * Which toolbar buttons to show and in what order.
     * Use `'separator'` to insert visual dividers between groups.
     * @see {@link ToolbarItem} for the full list of available items.
     * @see {@link DEFAULT_TOOLBAR_ITEMS} for the default set.
     */
    toolbarItems = input<ToolbarItem[]>(DEFAULT_TOOLBAR_ITEMS);


    /** Placeholder text shown when the editor is empty. Falls back to the locale default. */
    placeholder = input<string>('');

    /** CSS `min-height` for the editable area. Accepts any CSS length value. */
    minHeight = input<string>('120px');

    /** CSS `max-height` for the editable area (scrolls beyond this). Accepts any CSS length value. */
    maxHeight = input<string>('400px');

    /**
     * Disables the editor entirely — no input, no toolbar, no interactions.
     * OR-ed with the form's own disabled state; see {@link isDisabled}.
     */
    disabled = input<boolean>(false);

    /** Makes the editor non-editable but still selectable/copyable. Hides the toolbar. */
    readonly = input<boolean>(false);

    /**
     * Whether a completed Markdown marker typed into the editor turns into real
     * formatting: `# ` / `## ` / `### ` into headings, `- ` / `* ` and `1. `
     * into lists, `> ` into a blockquote, `[] ` / `[x] ` into a task item,
     * `---` into a horizontal rule, ``` (optionally with a language, then Space
     * or Enter) into a code block, and `**bold**`, `*italic*`, `` `code` ``
     * into their inline elements.
     *
     * Each transform is exactly one undo step, and pressing Backspace
     * immediately afterwards puts the literal characters back — so a marker can
     * still be typed as text when that is what was meant.
     *
     * Set it to `false` for an editor whose authors type Markdown markers they
     * expect to stay literal.
     */
    markdownShortcuts = input<boolean>(true);

    /** Show a character count below the editor. */
    showCount = input<boolean>(false);

    /** Show a word count below the editor. */
    showWordCount = input<boolean>(false);

    /**
     * Maximum character limit. When set, the character counter turns red
     * and the editor emits warnings when approaching/exceeding the limit.
     * Does **not** prevent typing — it's advisory only.
     */
    maxLength = input<number | undefined>(undefined);


    /** Maximum number of history snapshots to retain. Oldest entries are dropped when exceeded. */
    historyLimit = input<number>(100);

    /**
     * Milliseconds of quiet before a changed find query is searched, so a burst
     * of keystrokes costs one pass over the document. `0` searches synchronously
     * on every keystroke.
     */
    findDebounceMs = input<number>(150);

    /**
     * Record a history entry for each `ControlValueAccessor` write, so a form's
     * `setValue` / `patchValue` can be undone. Off by default, matching the
     * long-standing behaviour that a programmatic write is not an edit.
     */
    recordExternalWrites = input<boolean>(false);

    /**
     * Debounce interval in milliseconds for capturing history snapshots.
     * A snapshot is saved after the user stops typing for this duration.
     */
    historyDebounceMs = input<number>(450);


    /**
     * Language/locale for all editor UI strings. Pass a locale key (e.g. `'en'`)
     * to use a built-in locale, or pass a full {@link RichTextLocale} object for
     * custom translations.
     *
     * Addon directives inherit it. The component re-broadcasts this input as
     * `UI_LOCALE_ID` through `provideComponentLocale` in `providers` — element
     * level, because addon directives sit on the editor's own element — so
     * `<ui-rich-text-editor locale="he" uiRteFull>` localizes all fourteen
     * addons from this one binding. An addon's own `[uiRte<Name>Locale]` still
     * wins where it is set, and with this input unset everything falls through
     * to the app-wide `UI_LOCALE_ID` as before.
     */
    locale = input<LocaleInput<RichTextLocale>>();


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
     * host. Now empty: every feature command (`/outline`, `/ai`, `/link`, …) is
     * registered by its own opt-in addon into {@link commands}. The seam is kept
     * (the slash-commands addon merges it) so the base can reclaim a built-in
     * command in future without a contract change.
     */
    readonly builtinCommands = computed<readonly RichTextSlashCommand[]>(() => []);


    /** Emits the current content as an HTML string after every change. */
    htmlChange = output<string>();

    /**
     * Emits the current content as a Markdown string after every change.
     * Only meaningful when `mode` is `'markdown'` — in `'html'` mode,
     * the Markdown is reverse-converted from HTML and may not round-trip perfectly.
     */
    markdownChange = output<string>();

    /** Emits the current word count after every content change. Pair with `[showWordCount]`. */
    wordCountChange = output<number>();

    /**
     * Emits the undo stack's state on every change to it — a push, undo, redo,
     * history restore or trim. Drive your own undo/redo buttons from it, or read
     * {@link canUndo} / {@link canRedo} directly.
     */
    historyChange = output<RichTextHistoryState>();

    /** Emits when the editor gains focus. */
    focused = output<void>();

    /** Emits when the editor loses focus. */
    blurred = output<void>();

    /**
     * Where a colour was last applied to a collapsed caret, while it is still
     * only a pending typing style. Gates {@link pendingTypingColor}. Anchored to
     * the caret position rather than a bare flag because merely closing the
     * colour popover fires a selection change while the pending style is still
     * live — the caret has to actually move (or take a typed character) before
     * the DOM becomes the source of truth again.
     */
    private caretColorAnchor: {
        node: Node;
        offset: number;
        color?: string;
        backgroundColor?: string;
    } | null = null;
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


    private readonly _historyVersion = signal<number>(0);
    /** Bumps on every history-stack change; read by the history addon (addon host surface). */
    readonly historyVersion = this._historyVersion.asReadonly();

    /** Whether an undo step is available — mirrors {@link historyChange}'s `canUndo`. */
    readonly canUndo = computed(() => {
        this.historyVersion();
        return this.historyIndex > 0;
    });
    /** Whether a redo step is available — mirrors {@link historyChange}'s `canRedo`. */
    readonly canRedo = computed(() => {
        this.historyVersion();
        return this.historyIndex < this.history.length - 1;
    });

    /**
     * The content as of the last {@link writeValue} or {@link markClean}, in the
     * shape {@link readContentFromEditor} produces — a DOM round-trip, so an
     * input event that changes nothing compares equal.
     */
    private readonly cleanHtml = signal('');
    /**
     * Whether the document differs from what was last loaded or marked clean.
     * Use it for unsaved-changes prompts; {@link markClean} resets it.
     */
    readonly isDirty = computed(() => this.htmlContent() !== this.cleanHtml());

    findReplaceVisible = signal(false);
    findQuery = signal('');
    replaceText = signal('');
    findCaseSensitive = signal(false);
    /**
     * Every match of the current query, in document order. Since the search runs
     * over the flattened document, a range may start and end in different text
     * nodes — a phrase broken by inline markup is one match, not none.
     */
    findMatches = signal<Range[]>([]);
    findCurrentIndex = signal(-1);
    findShowReplace = signal(false);
    /** Restrict matches to whole words, Unicode-aware. UI state, like {@link findCaseSensitive}. */
    readonly findWholeWord = signal(false);
    /** Treat the query as a regular expression. UI state, like {@link findCaseSensitive}. */
    readonly findUseRegex = signal(false);
    private readonly _findRegexError = signal(false);
    /** True while the current query cannot be compiled — an invalid pattern, or one over the length cap. */
    readonly findRegexError = this._findRegexError.asReadonly();
    /** How many matches the current query has; `findMatches().length`, as a signal. */
    readonly findMatchCount = computed(() => this.findMatches().length);
    /**
     * Whether the replace row is available: it is hidden whenever the editor
     * cannot be edited, so find still works in a readonly or disabled editor but
     * replace is never offered.
     */
    readonly showReplaceRow = computed(
        () => this.findShowReplace() && !this.readonly() && !this.isDisabled(),
    );
    /**
     * The localized match counter: `{current} of {total}`, the no-results string,
     * the invalid-expression string, or empty when there is no query.
     */
    readonly findCounterText = computed(() => {
        const locale = this.resolvedLocale().findReplace;
        if (!this.findQuery()) return '';
        if (this.findRegexError()) return locale.invalidRegex;
        const total = this.findMatchCount();
        if (total === 0) return locale.noResults;
        return locale.matchCounter
            .replace('{current}', String(this.findCurrentIndex() + 1))
            .replace('{total}', String(total));
    });
    private findDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private findOverlay: HTMLElement | null = null;
    private findRepaintHandle: number | null = null;
    private findResizeObserver: ResizeObserver | null = null;
    private findScrollHandler: (() => void) | null = null;

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
    private readonly imageFileHandler = signal<((file: File) => void) | null>(null);
    readonly hasImageFileHandler = computed(() => this.imageFileHandler() !== null);
    private readonly shortcutActions = new Map<string, { run: () => void; when?: () => boolean }>();
    private savedRange: Range | null = null;
    private linkEditorOpen: ((caretHint?: { x: number; y: number }) => void) | null = null;
    private onChange: (value: string) => void = () => { };
    private onTouched: () => void = () => { };

    /**
     * The form's disabled state, written only by {@link setDisabledState}. Kept
     * separate from the {@link disabled} input so neither path overrides the
     * other — the effective state is {@link isDisabled}.
     */
    private readonly formDisabled = signal(false);

    /**
     * The effective disabled state: the {@link disabled} input OR the form's
     * own state. Every behavioural guard reads this, not the raw input.
     */
    readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

    editorContainerClasses = computed(() =>
        cn(
            editorVariants({ variant: this.variant(), size: this.size() }),
            this.isDisabled() && 'opacity-50 cursor-not-allowed',
            this.readonly() && 'bg-muted',
            this.class()
        )
    );

    editableClasses = computed(() =>
        cn(
            'w-full h-full overflow-auto p-3 outline-none',
            '[&:empty]:before:content-[attr(placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:pointer-events-none',
            '[&_*]:outline-none',
            RICH_TEXT_PROSE_CLASSES,
            '[&_img]:cursor-pointer',
            '[&_td.rte-cell-selected]:bg-primary/15 [&_th.rte-cell-selected]:bg-primary/25',
            '[&_summary]:outline-none',
            'disabled:cursor-not-allowed',
        )
    );

    readonly htmlOutput = computed(() => {
        return this.sanitizer.sanitize(this.htmlContent());
    });

    readonly markdownOutput = computed(() => {
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

    /**
     * Substitute `{name}` placeholders in a locale string with `values`. Exposed
     * for the template, which uses it for the counter strings
     * (`editor.characters` / `editor.words`, both `{count}`-parameterized).
     * Unknown placeholders are left as-is by the shared `interpolate` helper.
     */
    interpolateLocale(template: string, values: Record<string, string | number>): string {
        return interpolate(template, values);
    }


    /**
     * Template-bound `click` handler on the editable area. Two jobs: it tracks
     * the clicked `<img>` as the selected image (cleared on any other click),
     * which is what {@link selection} reports as `kind: 'image'` and what the
     * images addon anchors its resizer to; and it takes over a click on a task
     * list checkbox — the browser's own toggle is prevented so the checked state
     * lives on the `<li data-checked>` attribute (the model's source of truth)
     * rather than on the DOM-only `checked` property, and the toggle records a
     * history entry.
     */
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
        this.setupFindRefreshEffect();
    }

    /**
     * Re-run the open search whenever the document changes underneath it, so the
     * counter and highlights stay true while the user types. Driven by the model
     * signal rather than hooks in each mutation path, so no future mutation can
     * forget to refresh.
     */
    private setupFindRefreshEffect(): void {
        effect(() => {
            this.htmlContent();
            if (this.findReplaceVisible() && this.findQuery()) {
                this.scheduleFind({ preserveIndex: true });
            }
        });
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
        const canEdit = (): boolean => !this.isDisabled() && !this.readonly();
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

    /**
     * `ControlValueAccessor` — accept a new value from the form. Interprets it
     * per {@link mode}: Markdown is converted to HTML, HTML is sanitized. Writes
     * straight through to the contenteditable DOM, so it replaces whatever the
     * user was editing; task checkboxes in the incoming value are re-enabled and
     * their `checked` state re-read from the owning `<li data-checked>`.
     *
     * It does NOT call back into the form ({@link registerOnChange}) — the form
     * already knows the value it just wrote, and echoing it would loop. It does
     * however emit {@link htmlChange} / {@link markdownChange}, which are
     * effects over the content signal this sets and therefore fire for every
     * content change whatever its origin. `null`/`undefined` are treated as the
     * empty string.
     *
     * By default it records no history entry either, so a programmatic
     * `setValue` cannot be undone and undo jumps back to the state before it.
     * Set {@link recordExternalWrites} to make each form write undoable, or use
     * {@link setContent} for an edit your own code is making.
     *
     * Either way it resets the dirty baseline: the value the form just supplied
     * is by definition the saved one, so {@link isDirty} reads false after it.
     */
    writeValue(value: string): void {
        if (this.recordExternalWrites()) {
            this.flushPendingHistoryPush();
        }
        this.applyExternalHtml(value);
        if (this.recordExternalWrites()) {
            this.pushHistory();
        }
        this.markClean();
    }

    /**
     * Parse `value` per {@link mode}, write it to the model and straight through
     * to the contenteditable DOM, and re-enable its task checkboxes. Shared by
     * {@link writeValue} and {@link setContent}, which differ only in what they
     * do afterwards — the form callback, history and dirty baseline.
     */
    private applyExternalHtml(value: string): void {
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

    /**
     * Replace the editor's content programmatically, as an edit the code is
     * making — the counterpart to {@link writeValue}, which is the *form*
     * telling the editor what its value is.
     *
     * Unlike `writeValue` it calls back into the form, emits the content
     * outputs, and records one history entry so `Ctrl+Z` restores what the user
     * was looking at. Pass `{ recordHistory: false }` for a write that should
     * not be undoable — restoring a version, say. The caret is left collapsed at
     * the end of the new content. `null`/`undefined` become the empty string.
     *
     * Any in-flight typing burst is flushed as its own entry *before* the new
     * content lands, so a `setContent` arriving mid-sentence cannot swallow
     * what the user had just typed. (§D.5.12 of the spec lists the flush after
     * the write; that order loses the burst — see the spec's corrections.)
     *
     * It deliberately does NOT reset the dirty baseline: content the code
     * inserted is still an unsaved change. Use {@link markClean} after a save.
     *
     * @publicApi
     */
    setContent(value: string, options?: RichTextSetContentOptions): void {
        this.flushPendingHistoryPush();
        this.applyExternalHtml(value);
        this.placeCaretAtEnd();
        this.syncContentFromEditor();
        if (options?.recordHistory !== false) {
            this.pushHistory();
        }
    }

    /** Collapse the caret to the end of the editable's content. */
    private placeCaretAtEnd(): void {
        const editor = this.editorDiv?.nativeElement;
        if (!editor) return;
        const range = this.document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const selection = this.document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    /**
     * Treat the current content as saved: {@link isDirty} reads false again
     * until the next change. Call it after persisting the value.
     *
     * The baseline is read back out of the editable rather than taken from the
     * model, so content the browser normalised after the model was written
     * still compares equal. That read also refreshes the model from the DOM —
     * the two are being reconciled, which is the point of marking clean.
     *
     * @publicApi
     */
    markClean(): void {
        this.cleanHtml.set(this.readContentFromEditor() ?? this.htmlContent());
    }

    /**
     * Focus the editable and restore the caret the user last had inside it.
     *
     * `restoreSelection` alone returns early without focusing when the live
     * selection is already in the editor, so the focus call comes first and the
     * restore second — a page button that stole focus still lands the caret
     * back where the user left it.
     *
     * @publicApi
     */
    focus(): void {
        if (this.isDisabled()) return;
        this.focusEditor();
        // Deliberately the saved caret, not the live one: focusing an editable
        // makes the browser drop a default caret at its start, which would
        // otherwise be preferred and silently discard where the user was.
        this.restoreSelection({ preferLive: false });
    }

    /**
     * Insert plain text at the restored caret as one history entry, then focus
     * the editor — the method a page button next to the editor calls.
     *
     * No-op while readonly or disabled, and for the empty string (an empty
     * insert would otherwise record a history entry that undoes nothing).
     *
     * @publicApi
     */
    insertText(text: string): void {
        if (text === '' || !this.canEditContent()) return;
        this.insertAtRestoredCaret(() => this.insertTextNode(text));
    }

    /**
     * Insert HTML at the restored caret as one history entry, then focus the
     * editor. The markup goes through the editor's allow-list sanitizer, so a
     * `<script>` is dropped rather than inserted.
     *
     * No-op while readonly or disabled, and when nothing survives sanitization.
     * The single sanitize pass both answers that question and supplies the
     * markup that is inserted — deciding and inserting must not disagree.
     *
     * @publicApi
     */
    insertHtml(html: string): void {
        if (!this.canEditContent()) return;
        const sanitized = this.sanitizer.sanitize(html);
        if (sanitized === '') return;
        this.insertAtRestoredCaret(() => this.insertSanitizedHtml(sanitized));
    }

    /**
     * Run a toolbar command exactly as a toolbar click would. The narrow
     * {@link RichTextFormatCommand} type is the whole guard — there is no
     * runtime allow-list, because the union is the contract.
     *
     * @publicApi
     */
    format(command: RichTextFormatCommand): void {
        this.onFormatCommand(command);
    }

    /**
     * Whether the content may be edited right now — the guard the public
     * inserts share with the toolbar's own command path.
     */
    private canEditContent(): boolean {
        return !this.readonly() && !this.isDisabled();
    }

    /**
     * `true` when the document has no visible text and no image, rule or table.
     * Shares one rule with `richTextRequired()`, so a form's validity and a
     * "Send" button's disabled state can never disagree.
     *
     * Parses the document on each call, like `characterCount`. Bind it through
     * a `computed` over `htmlOutput()` rather than calling it in a template.
     *
     * @publicApi
     */
    isEmpty(): boolean {
        return isRichTextEmpty(this.htmlContent());
    }

    /**
     * `ControlValueAccessor` — store the form's change callback. It is invoked
     * with the {@link mode}-appropriate string (Markdown or HTML) on every model
     * update: typing, formatting commands, addon mutations, undo/redo and history
     * restore — but never from {@link writeValue}.
     */
    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    /**
     * `ControlValueAccessor` — store the touched callback. Fired from
     * {@link onBlur}, i.e. on every blur of the editable area, including one
     * caused by moving focus to the toolbar or an addon overlay.
     */
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    /**
     * `ControlValueAccessor` — adopt the form's disabled state, so a reactive
     * form's `control.disable()` / `enable()` (and `new FormControl({ value,
     * disabled: true })`) locks and unlocks the editor. Stored apart from the
     * {@link disabled} input so neither path overrides the other; the editor is
     * locked while either says so — see {@link isDisabled}.
     */
    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }

    /**
     * Template-bound `input` handler on the editable area — the typing path.
     * Sanitizes the DOM into the model (stripping the zero-width joiners the
     * floating toolbar leaves behind), publishes the trigger-aware text and caret
     * offset to addon input observers (see `registerInputObserver`) BEFORE the
     * model update so slash/mention triggers see the same values the base does,
     * calls the form's `onChange`, and schedules the debounced history push —
     * skipped for the one input event replaying an undo/redo, which must not
     * become a new entry.
     *
     * Swallowed while disabled or readonly: `contenteditable="false"` stops a
     * real keystroke, but a programmatic DOM mutation still raises `input`, and
     * a locked editor must never write that back into the form.
     */
    onInput(event: Event): void {
        if (this.isDisabled() || this.readonly()) return;

        const div = event.target as HTMLDivElement;
        this.lastInputRule = null;
        const transformed = this.applyInputRules(event);
        const html = this.sanitizer.sanitize(div.innerHTML).replaceAll('\u200B', '');

        const triggerTextContent = this.buildTriggerAwareText(div.innerHTML);
        const selection = this.document.getSelection();
        const hasSelection = !!selection && selection.rangeCount > 0;
        const caretOffset = hasSelection
            ? this.getCaretOffset(div)
            : triggerTextContent.length;

        this.notifyInputObservers(triggerTextContent, caretOffset);

        this.htmlContent.set(html);

        const outputValue = this.mode() === 'markdown'
            ? this.markdownService.toMarkdown(html)
            : html;
        this.onChange(outputValue);

        if (transformed) {
            this.pushHistory();
        } else if (!this.isUndoRedo) {
            this.scheduleDebouncedHistoryPush();
        }
        this.isUndoRedo = false;
    }

    /**
     * Template-bound `keydown` handler on the editable area, in strict priority
     * order:
     *
     * 1. Addon keydown interceptors (`registerKeydownInterceptor`) — the first
     *    one to return `true` consumes the event and nothing below runs.
     * 2. The registered shortcut bindings (`Mod+B/I/U`, `Mod+K`, `Mod+Z`,
     *    `Mod+Shift+Z` / `Mod+Y`, `Mod+Shift+H`, `Mod+F`, `Mod+H`), dispatched
     *    through `ShortcutBindingService` so the user's remappings apply. A
     *    matched binding calls `preventDefault` for us; the editing ones are
     *    gated on the editor being neither disabled nor readonly.
     * 3. `Escape` — hides the floating toolbar (not prevented; other handlers
     *    still see it).
     * 4. `Tab` — always prevented: indents/outdents the list item under the
     *    caret (`Shift+Tab` outdents), or inserts a literal tab outside a list,
     *    so focus never leaves the editor.
     * 5. `Enter` without Shift — the block-exit rules: continue or leave a task
     *    list, step from a `<summary>` into its `<details>` body, break out of an
     *    empty trailing `<details>` block, and newline-vs-exit inside a code
     *    block. Plain paragraphs fall through to the browser.
     */
    onKeydown(event: KeyboardEvent): void {
        if (this.dispatchKeydownInterceptors(event)) return;
        if (this.shortcutHandle?.dispatch(event)) return;

        if (event.key === 'Backspace' && this.revertLastInputRule()) {
            event.preventDefault();
            return;
        }
        this.lastInputRule = null;

        if (event.key === 'Backspace' && this.handleBackspaceInTaskList(event)) return;

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
            this.insertTextNode('\t');
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

        if (this.handleEnterOnCodeFence(event)) return;
        if (this.handleEnterInTaskList(event, selection)) return;
        if (this.handleEnterInSummary(event, range, selection)) return;
        if (this.handleEnterAtDetailsEnd(event, range, selection)) return;
        if (this.handleEnterInBlockquote(event, range, selection)) return;
        if (this.handleEnterInInlineCode(event, range, selection)) return;
        this.handleEnterInCodeBlock(event, range, selection);
    }

    /**
     * Break out of an inline `<code>` span on Enter, into a plain paragraph.
     *
     * The browser splits the enclosing paragraph on Enter and clones the inline
     * formatting into the new one, so pressing Enter inside inline code landed
     * the caret in a SECOND empty `<code>` — the span propagated forward and
     * there was no way to type unformatted text again. Blocks already exit on
     * Enter; inline code now matches, and `Shift+Enter` still gives a line
     * break that keeps the formatting.
     */
    private handleEnterInInlineCode(event: KeyboardEvent, range: Range, selection: Selection): boolean {
        const code = this.findAncestorByTag(range.startContainer, 'CODE');
        if (!code || this.findAncestorByTag(range.startContainer, 'PRE')) return false;

        const block = this.findBlockAncestor(code) ?? code.parentElement;
        if (!block) return false;

        event.preventDefault();

        const p = this.document.createElement('p');
        p.innerHTML = '<br>';
        block.parentNode?.insertBefore(p, block.nextSibling);
        this.setSelectionRange(selection, p, 0);

        this.syncContentFromEditor();
        this.pushHistory();
        return true;
    }

    /** The nearest block-level ancestor of `node` within the editable. */
    private findBlockAncestor(node: Node): HTMLElement | null {
        const blocks = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);
        let current: Node | null = node;
        while (current && current !== this.editorDiv?.nativeElement) {
            if (current.nodeType === Node.ELEMENT_NODE && blocks.has((current as Element).tagName)) {
                return current as HTMLElement;
            }
            current = current.parentNode;
        }
        return null;
    }

    /**
     * Opens a code block when Enter completes a ``` fence. Keydown-driven, so
     * no `input` event follows to push the history entry — this path syncs and
     * pushes for itself, the way every other command does.
     */
    private handleEnterOnCodeFence(event: KeyboardEvent): boolean {
        if (!this.markdownShortcuts() || this.isDisabled() || this.readonly()) return false;

        const context = this.inputRuleContext();
        if (!context) return false;
        if (context.blockPrefix.length > RichTextEditorComponent.MAX_BLOCK_MARKER_LENGTH) return false;

        const block = this.blockRuleTarget(context.block);
        if (!block) return false;

        const match = matchBlockInputRule(context.blockPrefix, '\n');
        if (!match) return false;

        event.preventDefault();
        this.snapshotBeforeTransform();
        this.removeLeadingCharacters(block, match.markerLength - 1);
        this.lastInputRule = { block: this.buildBlockForRule(block, match) };
        this.syncContentFromEditor();
        this.pushHistory();
        this.updateActiveFormats();
        return true;
    }

    /**
     * Backspace at the start of a task-list item removes that item, or unwraps
     * the list when it is the only one left.
     *
     * The browser cannot do this itself: an item is
     * `<li><input type="checkbox"><span>…</span></li>`, so the caret at offset 0
     * of the span has a non-editable `<input>` before it and the default
     * Backspace has nothing it is willing to delete — the key appeared dead.
     * Pressing ArrowLeft first moved the caret onto the checkbox, where the
     * default then deleted the whole row, which is the "buggy" behaviour that
     * made the key look intermittent.
     */
    private handleBackspaceInTaskList(event: KeyboardEvent): boolean {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        const range = selection.getRangeAt(0);
        if (!range.collapsed) return false;

        const taskLi = this.getParentTaskListItem();
        if (!taskLi) return false;

        const span = taskLi.querySelector('span');
        if (!span || !span.contains(range.startContainer)) return false;

        // Only at the very start of the row's text, allowing for the
        // zero-width anchor the task builder seeds an empty row with.
        const before = (range.startContainer.textContent ?? '').slice(0, range.startOffset);
        if (before.replaceAll('​', '').length > 0) return false;

        event.preventDefault();

        const list = taskLi.parentElement;
        const previous = taskLi.previousElementSibling as HTMLElement | null;
        taskLi.remove();

        if (list && list.children.length === 0) {
            const p = this.document.createElement('p');
            p.innerHTML = '<br>';
            list.parentNode?.insertBefore(p, list);
            list.remove();
            this.setSelectionRange(selection, p, 0);
        } else if (previous) {
            const target = previous.querySelector('span') ?? previous;
            this.placeCaretAtEndOf(target);
        }

        this.syncContentFromEditor();
        this.pushHistory();
        return true;
    }

    /** Put the caret after the last character of `element`. */
    private placeCaretAtEndOf(element: Element): void {
        const selection = this.document.getSelection();
        if (!selection) return;
        const target = this.emptyBlockCaretTarget(element as HTMLElement);
        const range = this.document.createRange();
        range.setStart(target, target.data.length);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
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

    /**
     * Leave a blockquote on Enter. `Shift+Enter` adds a line inside it and
     * never reaches here, so the two keys mean exactly one thing each.
     *
     * Before this there was no way out at all: every following line stayed
     * quoted and the only escape was deleting the quote. An empty-line
     * two-step was tried first and rejected — the browser's own handling
     * opened a SECOND sibling blockquote rather than a new line in the
     * existing one, which renders as two bordered quotes with a gap.
     */
    private handleEnterInBlockquote(event: KeyboardEvent, range: Range, selection: Selection): boolean {
        const quote = this.findAncestorByTag(range.startContainer, 'BLOCKQUOTE');
        if (!quote) return false;

        event.preventDefault();

        const p = this.document.createElement('p');
        p.innerHTML = '<br>';
        quote.parentNode?.insertBefore(p, quote.nextSibling);
        this.setSelectionRange(selection, p, 0);

        // An Enter pressed on a blank quoted line leaves that line behind.
        if (!quote.textContent?.replaceAll('​', '').trim()) {
            quote.remove();
        }

        this.syncContentFromEditor();
        this.pushHistory();
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

        // Enter always leaves the block; Shift+Enter is how you add a line
        // inside it, and it never reaches here. The old two-step (Enter opens a
        // blank line, a second Enter steps out) meant the exit had to detect
        // and then unpick that blank line, which is what flattened multi-line
        // blocks. One key, one meaning.
        this.exitCodeBlock(preElement, textNode, selection, this.trailingBreakIn(textNode));
        this.syncContentFromEditor();
        this.pushHistory();
    }

    /**
     * Leave a code block on the second Enter, dropping the trailing newline the
     * first one added.
     *
     * Trims that newline from the LAST text node rather than reassigning
     * Removes whichever blank line the first Enter left — a trailing `<br>`
     * (what `Shift+Enter` actually inserts) or a trailing `"\n"` — instead of
     * reassigning `textContent` on the whole block. That assignment replaced
     * every child with one text node, so a multi-line block collapsed into a
     * single line the moment the user pressed Enter twice to get out. Arrowing
     * out never reached this path, which is why only double-Enter showed it.
     */
    private exitCodeBlock(
        preElement: HTMLPreElement,
        textNode: Element | HTMLPreElement,
        selection: Selection,
        trailingBreak: HTMLBRElement | null,
    ): void {
        // Only tidy a blank line the user left behind with Shift+Enter; never
        // reassign `textContent` on the block, which replaces every child with
        // one text node and flattens a block whose lines are <br> elements.
        const last = this.lastTextNodeIn(textNode);
        if (last?.data.endsWith('\n') && !last.data.trim()) {
            last.remove();
        } else if (trailingBreak) {
            trailingBreak.remove();
        }

        const p = this.document.createElement('p');
        p.innerHTML = '<br>';
        preElement.parentNode?.insertBefore(p, preElement.nextSibling);
        this.setSelectionRange(selection, p, 0);
    }

    /** The block's last text node, or `null` when it holds none. */
    private lastTextNodeIn(root: Node): Text | null {
        const walker = this.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let last: Text | null = null;
        let node = walker.nextNode() as Text | null;
        while (node) {
            last = node;
            node = walker.nextNode() as Text | null;
        }
        return last;
    }

    /**
     * The `<br>` that ends the block, if the last meaningful child is one.
     *
     * `Shift+Enter` inserts a `<br>` rather than a `"\n"`, so a block built
     * that way carries no newline in `textContent` at all — the exit check
     * looked for one, never found it, and treated the second Enter as another
     * newline. Reassigning `textContent` to trim it then flattened every child
     * into a single text node, collapsing the block's lines into one.
     */
    private trailingBreakIn(root: Node): HTMLBRElement | null {
        const children = [...root.childNodes];
        for (let i = children.length - 1; i >= 0; i--) {
            const node = children[i];
            if (node.nodeType === Node.TEXT_NODE && !(node as Text).data.trim()) continue;
            return node.nodeName === 'BR' ? (node as HTMLBRElement) : null;
        }
        return null;
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

    /**
     * Template-bound `beforeinput` handler — the only place {@link maxLength} is
     * actually enforced on typing, by cancelling the insertion that would push
     * the plain-text length past the limit (a replaced selection counts as freed
     * budget). Inert when no `maxLength` is set, and never blocks deletions or
     * formatting commands, so an over-limit document can always be edited back
     * down. Pasting is budgeted separately inside {@link onPaste}.
     */
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

    /**
     * Template-bound `paste` handler. The native paste is ALWAYS cancelled first
     * — nothing reaches the DOM unfiltered — and any pending debounced history
     * push is flushed so the paste lands as its own undo step. Then, in order:
     * disabled/readonly swallow the paste; addon paste interceptors
     * (`registerPasteInterceptor`, e.g. the images addon claiming image files)
     * get a chance to consume it; {@link maxLength} truncates to the remaining
     * budget (inserting the truncation as plain text) or drops the paste when
     * there is none left; otherwise the `text/html` flavour — falling back to
     * `text/plain` — goes through the paste normalizer (which strips Word/Docs
     * cruft) and the sanitizer before insertion.
     */
    onPaste(event: ClipboardEvent): void {
        event.preventDefault();
        this.lastInputRule = null;
        this.flushPendingHistoryPush();

        if (this.isDisabled() || this.readonly()) {
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
        this.insertHtmlFragment(normalized);
        this.pushHistory();
    }

    /**
     * Enforce `maxLength` on a paste, returning `true` when the paste was fully
     * handled here. Measures against the plain-text (`text/plain`) clipboard
     * value rather than parsing the untrusted HTML — the over-limit path inserts
     * plain text anyway, so the HTML length would be the wrong budget.
     */
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

        if (text.length > remaining) {
            const truncated = text.substring(0, remaining);
            this.insertTextNode(truncated);
            this.pushHistory();
            return true;
        }
        return false;
    }
    /**
     * Template-bound `dragover` handler. Only a file drag is considered, and only
     * when some addon claims it via a registered drop-zone predicate
     * (`registerDropZonePredicate`) — the base itself accepts nothing. Claiming
     * the drag means calling `preventDefault` (without it the browser refuses the
     * drop) and raising {@link dragOver}, which drives the drop-zone highlight.
     */
    onEditorDragOver(event: DragEvent): void {
        if (this.isDisabled() || this.readonly()) return;

        const hasFiles = event.dataTransfer?.types?.includes('Files') ?? false;
        if (!hasFiles) return;

        const canAcceptAddon = this.dispatchDropZonePredicates(event);
        if (!canAcceptAddon) return;

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

    /**
     * Template-bound `dragleave` handler. Clears the {@link dragOver} highlight,
     * but ignores the leave events fired while the pointer crosses between
     * descendants of the editable area — only a `relatedTarget` outside it (or
     * none at all) counts as really leaving.
     */
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

    /**
     * Template-bound `drop` handler. Drops the {@link dragOver} highlight and
     * hands the event to the addon drop interceptors
     * (`registerDropInterceptor`); the first to return `true` owns the drop,
     * including its own `preventDefault` and insertion. The base inserts nothing
     * itself, so with no interceptor registered the drop falls through to the
     * browser's default handling.
     */
    async onEditorDrop(event: DragEvent): Promise<void> {
        this.dragOver.set(false);
        if (this.isDisabled() || this.readonly()) return;

        if (this.dispatchDropInterceptors(event)) {
            return;
        }
    }

    /** Template-bound `focus` handler; emits {@link focused}. Does not touch the selection. */
    onFocus(): void {
        this.focused.emit();
    }

    /**
     * Template-bound `blur` handler, and the reason a toolbar or overlay button
     * can still act on "the selection": it saves the live range as the restore
     * point {@link restoreSelection} (and every colour/font path) falls back to.
     * Also flushes the pending debounced history push so a blur closes the undo
     * step, marks the form control touched, and emits {@link blurred}.
     *
     * Focus moving to anything inside the component (toolbar button, addon
     * popover) leaves the floating toolbar up; otherwise it is hidden after a
     * short delay, re-checking `activeElement` so a click that lands back inside
     * does not flicker it away.
     */
    onBlur(event?: FocusEvent): void {
        this.lastInputRule = null;
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

    /**
     * Template-bound on both `mouseup` and `keyup` of the editable area — the
     * editor's "the caret may have moved" notification, not the DOM
     * `selectionchange` event. Re-detects the active formats the toolbar
     * highlights, releases a pending caret colour once the caret has actually
     * moved off its anchor (see `releaseCaretColor`), and republishes
     * {@link selectedText}.
     *
     * With `toolbar="floating"` it also drives that toolbar: shown immediately
     * for a non-empty selection, hidden on a delay for a collapsed one — the
     * delay re-reads the selection, because a click that is about to become a
     * drag reports collapsed for an instant.
     */
    onSelectionChange(): void {
        this.closeInputRuleRevertWindowIfMoved();
        this.updateActiveFormats();
        this.releaseCaretColor();
        const selection = this.document.getSelection();
        this.selectedText.set(selection?.toString() ?? '');
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

    /**
     * Apply one built-in toolbar command by id — the entry point the top toolbar
     * and the `Mod+B`/`Mod+I`/`Mod+U` shortcuts both go through, and the closest
     * thing to a programmatic formatting API.
     *
     * Accepts the inline (`bold`, `italic`, `underline`, `strikethrough`, `code`,
     * `clear`), block (`paragraph`, `heading1`–`3`, `blockquote`, `codeBlock`,
     * `horizontalRule`, `undo`, `redo`), alignment (`alignLeft`/`Center`/`Right`,
     * mirrored in RTL) and list (`bulletList`, `orderedList`, `taskList`,
     * `toggle`, `indent`, `outdent`) ids; an unknown id is silently ignored.
     *
     * No-op while disabled or readonly. Otherwise it restores the saved selection
     * first (so a click on the toolbar, which blurred the editor, still formats
     * the right text), flushes pending history so the command is its own undo
     * step, applies the matching style to any mention chips in range —
     * `execCommand` skips them — then syncs the model, refocuses the editor,
     * re-detects active formats and records one history entry. In floating-
     * toolbar mode it finally collapses the selection past the new formatting
     * node so typing continues outside it.
     */
    onFormatCommand(command: string): void {
        if (command === 'find') {
            this.openFindReplace(!this.readonly() && !this.isDisabled());
            return;
        }
        if (this.readonly() || this.isDisabled()) return;

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
            case 'indent': this.indentBlock(); return true;
            case 'outdent': this.outdentBlock(); return true;
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

    /**
     * The floating (bubble) toolbar's command entry point — a separate path from
     * {@link onFormatCommand}, not a wrapper around it. It works on the LIVE
     * selection only (there is one by definition when the bubble is up) and never
     * restores a saved range.
     *
     * For `bold`/`italic`/`underline`/`strikethrough` over non-empty text it wraps
     * the extracted range in a `<b>`/`<i>`/`<u>`/`<s>` element directly instead of
     * calling `execCommand`, then parks the caret in a zero-width space after the
     * wrapper so continued typing is unstyled (that `U+200B` is stripped from
     * the model on the next sync). Everything else — `clear`, `heading1`–`3`,
     * `bulletList`, `orderedList` — runs the browser command and collapses to the
     * end; other ids do nothing but still close the toolbar.
     *
     * Either way the bubble hides, the model is synced and one history entry is
     * recorded.
     */
    onFloatingFormatCommand(command: string): void {
        if (this.readonly() || this.isDisabled()) return;
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

    /**
     * Insert plain text at the saved caret on behalf of an overlay UI — an emoji
     * or symbol picker, a menu (addon host surface). Use this rather than
     * `insertTextAtCaret` whenever the click came from UI outside the editor: it
     * restores the in-editor selection first, re-saves the caret afterwards so
     * consecutive picks append instead of stacking at the same spot, and pins
     * `inputMode = 'none'` for ~100ms while focus returns, which stops the mobile
     * software keyboard from flashing open. It flushes any pending typing burst
     * as its own entry and then records one entry of its own, so a single undo
     * removes the insert and nothing else.
     */
    insertTextFromOverlay(text: string): void {
        this.insertAtRestoredCaret(() => this.insertTextNode(text));
    }

    /**
     * Run `insert` at the caret the user last had inside the editor, as one
     * history entry. Shared by {@link insertTextFromOverlay} and the public
     * {@link insertText} / {@link insertHtml}, because both face the same
     * problem: the click that triggered them already moved focus out of the
     * editor.
     *
     * The sequence is load-bearing. Any pending typing burst is flushed as its
     * own entry first, so the insert never merges into it. `inputMode` is
     * pinned to `'none'` for ~100ms while focus returns, which stops the mobile
     * software keyboard from flashing open. The caret is re-saved afterwards so
     * consecutive inserts append instead of stacking at the same spot.
     */
    private insertAtRestoredCaret(insert: () => void): void {
        this.flushPendingHistoryPush();
        const editor = this.editorDiv?.nativeElement;
        const prevInputMode = editor?.inputMode;
        if (editor) {
            editor.inputMode = 'none';
        }
        this.restoreSelection();
        insert();
        this.pushHistory();
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
        this.insertTextNode(text);
        this.pushHistory();
    }

    /** Insert sanitized HTML at the live caret as one history entry (addon host surface). */
    insertHtmlAtCaret(html: string): void {
        this.insertHtmlFragment(html);
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

    /** Register the addon that owns image files (addon host surface). */
    registerImageFileHandler(handler: (file: File) => void): () => void {
        this.imageFileHandler.set(handler);
        return () => {
            if (this.imageFileHandler() === handler) this.imageFileHandler.set(null);
        };
    }

    /** Route an image file through the owning addon (addon host surface). */
    insertImageFile(file: File): boolean {
        const handler = this.imageFileHandler();
        if (!handler) return false;
        handler(file);
        return true;
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

    /**
     * Publish the trigger-aware text and caret offset to registered observers.
     * Addons (slash-commands, mentions) subscribe here and run their own
     * trigger detection off the same values the base computes for its own.
     */
    private notifyInputObservers(text: string, caretOffset: number): void {
        for (const observer of this.inputObservers) {
            observer(text, caretOffset);
        }
    }

    /**
     * Apply a {@link RichTextInlineStyle} to the current (or last-saved)
     * selection — the addon host's single entry point for colour and typography
     * (addon host surface). Only the properties actually present are applied, and
     * each takes its own path: `color`/`backgroundColor` go through the caret-
     * aware colour routine (a no-op when there is no selection or caret in the
     * editor, and it deliberately does NOT refocus the editor, so an open picker
     * keeps its selection alive), while `fontSize` and `fontFamily` delegate to
     * {@link onFontSizeSelect} / {@link onFontFamilySelect}, which DO restore the
     * selection and refocus.
     *
     * Each applied property records its own history entry, so callers normally
     * send one property per call.
     */
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

    /**
     * Apply a text colour and/or highlight to the current selection or caret.
     *
     * Every step below is load-bearing; the ordering is not incidental:
     *
     * - **Both channels are re-issued together.** Restoring the selection
     *   disarms any pending typing style, so a colour picked moments earlier at
     *   this same caret would be silently discarded if only one channel were
     *   sent. The prior pending style is merged into `intent` first.
     * - **`styleWithCSS` is on** so the browser emits inline
     *   `color`/`background-color`, which the sanitizer keeps. Its default
     *   `<font color>` tag is stripped, which would apply the colour in the
     *   editor but lose it from the output.
     * - **`foreColor`/`hiliteColor` are issued back to back**, with nothing in
     *   between: anything that re-sets the selection disarms whichever landed
     *   first.
     * - **`styleWithCSS` stays on while a caret style is pending** — turning it
     *   off disarms the pending *text* colour (the highlight survives, the
     *   colour does not). {@link releaseCaretColor} restores it once the caret
     *   leaves and nothing is pending.
     * - **Mention chips take only the channel actually requested**; one merely
     *   carried over was already applied to them when it was chosen.
     * - **The editor is deliberately NOT focused.** `foreColor`/`hiliteColor`
     *   work on the range without focus and keep it selected. The colour picker
     *   lives in an open popover, so stealing focus back collapses the
     *   selection and leaves the next pick (or a drag) with no target — the
     *   reported "de-selects and stops changing" bug.
     * - **Active formats are re-detected** so the reflected colour matches what
     *   the next typed character will be; otherwise the toolbar lags a step
     *   behind the caret until the next mouseup/keyup. Reading the selection is
     *   focus-safe.
     */
    private applySelectionColor(color: string | undefined, backgroundColor: string | undefined): void {
        if (!this.hasColorTarget()) {
            return;
        }
        const prior = this.caretPendingStyle();
        const intent = {
            color: color ?? prior.color,
            backgroundColor: backgroundColor ?? prior.backgroundColor,
        };

        this.flushPendingHistoryPush();
        this.restoreColorTargetSelection();

        const mentionTargets = this.getMentionElementsInSelection();

        this.execEditorCommand('styleWithCSS', 'true');
        if (intent.color !== undefined) {
            this.execEditorCommand('foreColor', intent.color);
        }
        if (intent.backgroundColor !== undefined
            && !this.execEditorCommand('hiliteColor', intent.backgroundColor)) {
            this.execEditorCommand('backColor', intent.backgroundColor);
        }

        const caret = this.collapsedCaretAnchor();
        if (!caret) {
            this.execEditorCommand('styleWithCSS', 'false');
        }

        if (color !== undefined) this.setMentionStyle(mentionTargets, 'color', color);
        if (backgroundColor !== undefined) {
            this.setMentionStyle(mentionTargets, 'backgroundColor', backgroundColor);
        }

        this.caretColorAnchor = caret ? { ...caret, ...intent } : null;
        this.applyMutation({ focus: false, updateActiveFormats: true });
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

    /**
     * Set the font size of the current (or last-saved) selection. Accepts a bare
     * number-like string or an explicit CSS length — a value without `px` gets
     * `px` appended, so arbitrary sizes work, not just the seven `execCommand`
     * steps: it applies the throwaway `fontSize=7`, then rewrites every
     * `<font size="7">` it produced into a `<span style="font-size:…">` the
     * sanitizer keeps. Mention chips in range are styled directly, since the
     * browser command skips them.
     *
     * Restores the saved selection first (a size picker lives outside the editor)
     * and refocuses the editor afterwards, recording one history entry. Reached
     * from {@link applyInlineStyle} for typography addons.
     */
    onFontSizeSelect(size: string): void {
        this.flushPendingHistoryPush();
        this.restoreSelection();

        const mentionTargets = this.getMentionElementsInSelection();

        this.execEditorCommand('fontSize', '7');
        const styled: HTMLElement[] = [];
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
                styled.push(span);
            });
        }

        const sizeVal = size.endsWith('px') ? size : `${size}px`;
        this.setMentionStyle(mentionTargets, 'fontSize', sizeVal);

        this.syncContentFromEditor();
        this.reSaveLiveSelection(styled);
        this.pushHistory();
    }

    /**
     * Set the font family of the current (or last-saved) selection, `family`
     * being a CSS font-family value (e.g. `Georgia`). Mirrors
     * {@link onFontSizeSelect}: runs `fontName`, then rewrites the resulting
     * `<font face="…">` elements into `<span style="font-family:…">` so the
     * sanitizer keeps them, styles the mention chips the command skipped,
     * restores the selection beforehand, refocuses after, and records one history
     * entry. Reached from {@link applyInlineStyle}.
     */
    onFontFamilySelect(family: string): void {
        this.flushPendingHistoryPush();
        this.restoreSelection();

        const mentionTargets = this.getMentionElementsInSelection();

        this.execEditorCommand('fontName', family);

        const styled: HTMLElement[] = [];
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
                styled.push(span);
            }
        }

        this.setMentionStyle(mentionTargets, 'fontFamily', family);
        this.syncContentFromEditor();
        this.reSaveLiveSelection(styled);
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

    /**
     * Wrap the selection in `tagName`, leaving the caret where the user can
     * carry on typing.
     *
     * With text selected the caret goes after the new element, so typing
     * continues outside it — wrapping is finished. With a collapsed caret the
     * element is created EMPTY, and parking the caret after it made the block
     * unreachable: clicks and arrow keys could not enter a zero-length inline
     * element, so the toolbar's inline-code button produced a box nothing could
     * be typed into. There the caret goes inside, on a zero-width anchor,
     * because a browser will not place one in a truly empty element.
     */
    private wrapSelectionWithTag(tagName: string): void {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const wasCollapsed = range.collapsed;
        const element = this.document.createElement(tagName);
        element.appendChild(range.extractContents());
        range.insertNode(element);

        const newRange = this.document.createRange();
        if (wasCollapsed) {
            const anchor = this.document.createTextNode('​');
            element.appendChild(anchor);
            newRange.setStart(anchor, anchor.data.length);
        } else {
            newRange.setStartAfter(element);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
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
        this.insertHtmlFragment('<hr><p><br></p>');
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

    /**
     * Right-click handler bound on the open table context menu itself, so a
     * second right-click while the menu is up re-targets instead of doing
     * nothing. The menu is the topmost element at those coordinates, so it is
     * momentarily made `pointer-events: none` to hit-test the cell underneath;
     * landing on another cell in this editor moves the menu there, anything else
     * closes it.
     */
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

    /**
     * Template-bound `contextmenu` handler. Suppresses the browser menu only
     * inside a table in this editor and opens the table menu at the pointer,
     * remembering the cell as the target every table operation below acts on
     * ({@link mergeCells}, {@link addTableRowAbove}, …). Outside a table the
     * native menu is left alone. The menu is repositioned to stay in the viewport
     * and closes on the next click or contextmenu anywhere in the document.
     */
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

    /**
     * Template-bound `mousemove` handler; its only job is the column-resize
     * affordance. Within 4px of a cell's right edge — or its left edge, for any
     * column but the first — it switches the editable area's cursor to
     * `col-resize` and arms the flag {@link onEditorMouseDown} checks to start a
     * drag. Idle while a resize is already running, or when disabled/readonly.
     */
    onEditorMouseMove(event: MouseEvent): void {
        if (this.tableResizeState || this.readonly() || this.isDisabled()) return;
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

    /**
     * Template-bound `mousedown` handler, arbitrating the two table gestures.
     * A right-click only clears the cell selection when it lands outside it, so
     * the context menu can still act on a multi-cell selection. A left press on
     * an armed resize edge (see {@link onEditorMouseMove}) starts a column drag
     * — which pins the table to `table-layout: fixed` with explicit pixel widths
     * — and swallows the event. Otherwise it starts a cell-range selection from
     * the pressed cell, tracked on document `mousemove`/`mouseup` so the drag
     * survives leaving the table. See {@link onEditorTouchStart} for the touch
     * equivalent.
     */
    onEditorMouseDown(event: MouseEvent): void {
        this.lastInputRule = null;
        if (this.readonly() || this.isDisabled()) return;
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

    /**
     * Template-bound `touchstart` handler — the touch counterpart of
     * {@link onEditorMouseDown} for selecting a range of table cells by dragging.
     * The tracking `touchmove` listener is registered non-passive so it can
     * `preventDefault` and stop the page scrolling under the drag, but only once
     * the finger is over another cell of the same table. Column resizing has no
     * touch path.
     */
    onEditorTouchStart(event: TouchEvent): void {
        if (this.readonly() || this.isDisabled()) return;
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

    /**
     * Merge the currently selected table cells into their top-left one, growing
     * its `colspan`/`rowspan` to the selection's bounding rectangle and joining
     * the non-empty cells' HTML with spaces (an all-empty merge keeps a `<br>`).
     * The other cells are removed.
     *
     * Unlike the rest of the table methods this acts on the drag-selected cells,
     * not the context-menu target, and is a no-op with fewer than two selected.
     * The selection is cleared and one history entry recorded.
     */
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

    /**
     * Whether {@link splitCell} would do anything: true only while the table
     * context menu has a target cell that actually spans more than one row or
     * column. Bound in the template to disable the menu entry — read it before
     * offering split in any custom menu.
     */
    canSplitCell(): boolean {
        const target = this.tableContextMenuTarget;
        if (!target) return false;
        return (target.colSpan > 1 || target.rowSpan > 1);
    }

    /**
     * Undo a merge on the cell the table context menu targets: drop its
     * `colspan`/`rowspan` and refill the rectangle it covered with fresh empty
     * `<td>`/`<th>` cells (matching the row's section), inserted at the right
     * position in each row. The original cell keeps its content in the top-left
     * slot.
     *
     * No-op without a menu target or when {@link canSplitCell} is false. Clears
     * the cell selection and records one history entry.
     */
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

    /**
     * Insert an empty row directly above the row holding the table context
     * menu's target cell (above the whole span, for a row-spanning cell). Cells
     * that span across the insertion point are stretched by one row rather than
     * split. No-op without a menu target; closes the menu and records one history
     * entry. The new row inherits `<th>` cells only when it becomes row 0 of a
     * table that has a `<thead>`.
     */
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

    /**
     * Insert an empty row directly below the target cell's row — below the last
     * row it spans. Same rules as {@link addTableRowAbove}: spanning cells grow
     * instead of splitting, no-op without a context-menu target, one history
     * entry. A row appended past the end lands inside `<tbody>` when there is one.
     */
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

    /**
     * Insert an empty column on the visual left of the target cell's column.
     * "Left" is visual, not logical: in an RTL locale this inserts AFTER the
     * column in document order, so the menu item matches what the user sees.
     * Cells spanning the insertion point widen by one instead of splitting.
     * No-op without a context-menu target; one history entry.
     */
    addTableColumnLeft(): void {
        if (this.isRtl()) {
            this.insertTableColumn('after');
        } else {
            this.insertTableColumn('before');
        }
    }

    /**
     * Insert an empty column on the visual right of the target cell's column —
     * the RTL mirror of {@link addTableColumnLeft}, inserting BEFORE it in
     * document order when the locale is RTL. Same spanning, no-op and history
     * behaviour.
     */
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

    /**
     * Delete the row containing the table context menu's target cell. Deleting
     * the last remaining row removes the whole table instead. Cells that span
     * into the deleted row shrink by one and, when the deleted row was their
     * first, are re-homed into the following row at the right position so the
     * grid stays rectangular. Clears the menu target and records one history
     * entry; no-op without a target.
     */
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

    /**
     * Delete the column containing the table context menu's target cell —
     * removing the whole table when it was the only column. A cell straddling
     * the column loses one from its `colspan` instead of being removed. Clears
     * the menu target and records one history entry; no-op without a target.
     */
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

    /**
     * Remove the entire table the context menu's target cell belongs to. Not
     * confirmed — a single history entry is the only way back. No-op without a
     * menu target.
     */
    deleteTable(): void {
        this.closeTableContextMenu();
        const info = this.getTableCellInfo(this.tableContextMenuTarget);
        if (!info) return;
        info.table.remove();
        this.tableContextMenuTarget = null;
        this.applyMutation({ focus: true });
    }

    /**
     * Toggle the target cell's table between having a header row and not.
     * Promoting retags the first row's cells as `<th>` and moves the row into a
     * new `<thead>`; demoting retags them as `<td>` and moves the row back to the
     * top of `<tbody>` (creating one if the table had none), dropping the now
     * empty `<thead>`. Cell content is preserved, cell attributes are not — the
     * cells are replaced, not renamed. No-op without a context-menu target or on
     * an empty table; one history entry.
     */
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

    /**
     * Set the border style of the target cell's whole table (not just the cell):
     *
     * - `'all'` — clear every inline border override and fall back to the
     *   editor's default grid styling.
     * - `'none'` — `border: none` on every cell.
     * - `'outer'` — border only around the table's outer edge.
     * - `'horizontal'` — row separators only, no vertical rules.
     *
     * Written as inline styles (so they survive in the exported HTML), sampled
     * from the first cell's computed border colour to match the theme. No-op
     * without a context-menu target; one history entry.
     */
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

    /**
     * Set `text-align` on the single cell the table context menu targets — not
     * the row, column, or a multi-cell drag selection. The value is written
     * literally, so `'left'`/`'right'` are physical directions and do not mirror
     * in RTL. No-op without a menu target; one history entry.
     */
    setCellAlignment(align: 'left' | 'center' | 'right'): void {
        this.closeTableContextMenu();
        if (this.tableContextMenuTarget) {
            this.tableContextMenuTarget.style.textAlign = align;
            this.syncContentFromEditor();
            this.pushHistory();
        }
    }

    /**
     * Set the background colour of the single cell the table context menu
     * targets. `'transparent'` is special-cased to clear the inline style
     * altogether, restoring the theme's own cell background (a `<th>` keeps its
     * muted fill) rather than punching a transparent hole. Any CSS colour is
     * accepted; {@link tableCellColors} is only the swatch list the menu offers.
     * No-op without a menu target; one history entry.
     */
    setCellColor(color: string): void {
        const targets = this.cellColorTargets();
        this.closeTableContextMenu();
        if (targets.length === 0) return;

        for (const cell of targets) {
            cell.style.backgroundColor = color === 'transparent' ? '' : color;
        }
        this.syncContentFromEditor();
        this.pushHistory();
    }

    /**
     * The cells a colour applies to: every cell in an active multi-cell
     * selection, or the single right-clicked cell when there is none.
     *
     * Colouring only {@link tableContextMenuTarget} meant that selecting a
     * range and picking a colour filled just the one cell the menu opened on,
     * silently discarding the rest of the selection.
     */
    private cellColorTargets(): HTMLTableCellElement[] {
        const selected = this.tableCellSelected();
        if (selected.length > 0) return [...selected];
        return this.tableContextMenuTarget ? [this.tableContextMenuTarget] : [];
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

    /**
     * Indent the caret's block: nest a list item, or step a plain block right.
     *
     * The toolbar's Increase/Decrease Indent buttons used to call the list-only
     * path, so pressing them anywhere outside a list did nothing at all — no
     * markup change and no visible movement. Blocks now shift by a margin the
     * sanitizer already allows, capped so a document cannot be indented off the
     * edge of the page.
     */
    private indentBlock(): void {
        if (this.getParentListItem()) {
            this.indentListItem();
            return;
        }
        this.stepBlockIndent(RichTextEditorComponent.BLOCK_INDENT_STEP);
    }

    /** Outdent the caret's block — the inverse of {@link indentBlock}. */
    private outdentBlock(): void {
        if (this.getParentListItem()) {
            this.outdentListItem();
            return;
        }
        this.stepBlockIndent(-RichTextEditorComponent.BLOCK_INDENT_STEP);
    }

    /** Shift the caret's block by `deltaRem`, clamped to 0…MAX_BLOCK_INDENT_REM. */
    private stepBlockIndent(deltaRem: number): void {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const block = this.findBlockAncestor(selection.getRangeAt(0).startContainer);
        if (!block) return;

        const current = Number.parseFloat(block.style.marginLeft) || 0;
        const next = Math.min(
            RichTextEditorComponent.MAX_BLOCK_INDENT_REM,
            Math.max(0, current + deltaRem),
        );
        if (next === current) return;

        // `margin-left`, not the logical `margin-inline-start`: the sanitizer's
        // allow-list carries the physical property, so the logical one would be
        // stripped on the next sync and the indent would vanish.
        if (next === 0) block.style.removeProperty('margin-left');
        else block.style.marginLeft = `${next}rem`;

        this.applyMutation({ focus: true, updateActiveFormats: true });
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
        const caret = this.captureCaretOffsetIn(li);
        nestedList.appendChild(li);
        this.restoreCaretOffsetIn(li, caret);

        this.applyMutation({ focus: true, updateActiveFormats: true });
    }

    /**
     * The caret's character offset within `block`, measured across every text
     * node it contains, or `null` when the caret is elsewhere.
     *
     * Moving a list item re-parents the node the selection points at, which
     * silently drops the caret onto the editor container. Capturing an offset
     * before the move and reapplying it after keeps the caret where the user
     * left it, so a second `Tab` still finds a list item to indent instead of
     * falling through and inserting a literal tab.
     */
    private captureCaretOffsetIn(block: HTMLElement): number | null {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        if (!block.contains(range.startContainer)) return null;

        const walker = this.document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let offset = 0;
        let node = walker.nextNode() as Text | null;
        while (node) {
            if (node === range.startContainer) return offset + range.startOffset;
            offset += node.data.length;
            node = walker.nextNode() as Text | null;
        }
        return offset;
    }

    /** Re-place a caret captured by {@link captureCaretOffsetIn} after a move. */
    private restoreCaretOffsetIn(block: HTMLElement, offset: number | null): void {
        if (offset === null) return;
        const selection = this.document.getSelection();
        if (!selection) return;

        const walker = this.document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let remaining = offset;
        let node = walker.nextNode() as Text | null;
        let target: Text | null = null;
        while (node) {
            if (remaining <= node.data.length) { target = node; break; }
            remaining -= node.data.length;
            node = walker.nextNode() as Text | null;
        }
        if (!target) {
            target = this.emptyBlockCaretTarget(block);
            remaining = target.data.length;
        }

        const range = this.document.createRange();
        range.setStart(target, Math.min(remaining, target.data.length));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
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

        const caret = this.captureCaretOffsetIn(li);
        this.reparentFollowingSiblings(li, parentList);
        grandparentList.insertBefore(li, grandparentLi.nextSibling);

        if (!parentList.hasChildNodes() || parentList.children.length === 0) {
            parentList.remove();
        }
        this.restoreCaretOffsetIn(li, caret);

        this.applyMutation({ focus: true, updateActiveFormats: true });
    }

    /**
     * Move the items after `li` into a nested list beneath it, so outdenting
     * `li` carries them along instead of stranding them.
     *
     * Outdenting the FIRST of several siblings used to leave the rest in the
     * old list. That list then sat under the promoted item's former parent, so
     * on screen the *second* item appeared to be the one that moved — the row
     * the user had not put the caret on. Every list editor treats the items
     * below as children of the item being promoted; this does the same.
     */
    private reparentFollowingSiblings(li: HTMLElement, parentList: HTMLElement): void {
        const following: HTMLElement[] = [];
        let sibling = li.nextElementSibling;
        while (sibling) {
            const next = sibling.nextElementSibling;
            if (sibling.tagName === 'LI') following.push(sibling as HTMLElement);
            sibling = next;
        }
        if (following.length === 0) return;

        const listType = parentList.tagName === 'OL' ? 'ol' : 'ul';
        let nested = li.querySelector(`:scope > ${listType}`);
        if (!nested) {
            nested = this.document.createElement(listType);
            if (parentList.dataset['taskList'] !== undefined) {
                (nested as HTMLElement).dataset['taskList'] = '';
            }
            li.appendChild(nested);
        }
        for (const item of following) nested.appendChild(item);
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
        this.insertHtmlFragment(html);
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

    /**
     * Open the find panel and focus its query field, with the replace row
     * requested when `showReplace` is true — it is still hidden unless the editor
     * is editable ({@link showReplaceRow}). Bound to `Mod+F` (find) and `Mod+H`
     * (find and replace) — `Mod+H` is gated on the editor being editable,
     * `Mod+F` is not, so find works in a readonly editor.
     *
     * A non-empty, single-line selection seeds the query and is searched
     * immediately, ignoring {@link findDebounceMs} for that one run; a collapsed
     * selection leaves the previous query alone.
     */
    openFindReplace(showReplace: boolean): void {
        this.findShowReplace.set(showReplace);
        this.findReplaceVisible.set(true);
        const seed = this.selectedText().trim();
        if (seed && !seed.includes('\n')) {
            this.findQuery.set(seed);
            this.performFind({ preserveIndex: false });
        }
        requestAnimationFrame(() => {
            const el = (this.el.nativeElement as HTMLElement)
                .querySelector<HTMLInputElement>('[data-slot="rich-text-find-query"]');
            if (el) el.focus();
        });
    }

    /**
     * Close the find panel, selecting the match the user was on so the caret
     * lands where they were looking, then clearing the query, replacement text,
     * matches and highlights and returning focus to the editable area. Bound to
     * the panel's Escape key and its close button. The three search toggles are
     * deliberately NOT reset.
     */
    closeFindReplace(): void {
        const current = this.findMatches()[this.findCurrentIndex()]?.cloneRange();
        this.cancelPendingFind();
        this.clearFindHighlights();
        this.findReplaceVisible.set(false);
        this.findQuery.set('');
        this.replaceText.set('');
        this.findMatches.set([]);
        this.findCurrentIndex.set(-1);
        this._findRegexError.set(false);
        this.editorDiv?.nativeElement?.focus();
        this.selectRange(current);
    }

    /**
     * Put the editor's selection on `range`, if there is one. Called after
     * focusing the editable, never before: focusing a contenteditable collapses
     * the selection to its start, which would discard the range.
     */
    private selectRange(range: Range | undefined): void {
        if (!range) return;
        const selection = this.document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    /**
     * Update the search query and schedule the search. Runs after
     * {@link findDebounceMs} of quiet so a burst of keystrokes searches once;
     * with `findDebounceMs` at 0 it searches synchronously. Resets the current
     * match to the first hit; an empty query just clears the highlights.
     */
    onFindQueryChange(query: string): void {
        this.findQuery.set(query);
        this.scheduleFind({ preserveIndex: false });
    }

    /**
     * Flip case sensitivity (default off) and re-run the search against the
     * current query, resetting to the first match. The setting persists across
     * {@link closeFindReplace} for the lifetime of the component.
     */
    toggleFindCaseSensitive(): void {
        this.findCaseSensitive.update(v => !v);
        this.performFind({ preserveIndex: false });
    }

    /**
     * Flip whole-word matching (default off) and re-run the search. Word
     * boundaries are Unicode-aware, so it works for any script — `שלום` is a
     * whole word inside `שלום עולם`. Persists like {@link toggleFindCaseSensitive}.
     */
    toggleFindWholeWord(): void {
        this.findWholeWord.update(v => !v);
        this.performFind({ preserveIndex: false });
    }

    /**
     * Flip regular-expression mode (default off) and re-run the search. In regex
     * mode the query is a pattern rather than literal text, and `$1`-style group
     * references in the replacement are expanded. An uncompilable pattern sets
     * {@link findRegexError} instead of throwing. Persists like
     * {@link toggleFindCaseSensitive}.
     */
    toggleFindUseRegex(): void {
        this.findUseRegex.update(v => !v);
        this.performFind({ preserveIndex: false });
    }

    /** Drop any queued debounced search. */
    private cancelPendingFind(): void {
        if (this.findDebounceTimer !== null) {
            clearTimeout(this.findDebounceTimer);
            this.findDebounceTimer = null;
        }
    }

    /**
     * Queue a search, coalescing bursts within {@link findDebounceMs}. A debounce
     * of 0 runs it inline, which is what the unit suite and `findDebounceMs="0"`
     * consumers rely on for a synchronous search.
     */
    private scheduleFind(options: { preserveIndex: boolean }): void {
        this.cancelPendingFind();
        const delay = this.findDebounceMs();
        if (delay <= 0) {
            this.performFind(options);
            return;
        }
        this.findDebounceTimer = setTimeout(() => {
            this.findDebounceTimer = null;
            this.performFind(options);
        }, delay);
    }

    /**
     * Run the search: flatten the document, match the compiled query against it,
     * turn every match into a DOM range, then repaint the overlay. Splitting the
     * work across `buildFindIndex` / `collectMatches` / `updateFindState` keeps
     * each piece independently testable and under the complexity budget.
     */
    private performFind(options: { preserveIndex: boolean }): void {
        const editor = this.editorDiv?.nativeElement;
        const query = this.findQuery();
        if (!editor || !query) {
            this._findRegexError.set(false);
            this.updateFindState([], options);
            return;
        }

        const regex = compileFindRegex(query, {
            caseSensitive: this.findCaseSensitive(),
            wholeWord: this.findWholeWord(),
            useRegex: this.findUseRegex(),
        });
        if (!regex) {
            this._findRegexError.set(true);
            this.updateFindState([], options);
            return;
        }

        this._findRegexError.set(false);
        this.updateFindState(this.collectMatches(buildFindIndex(editor), regex), options);
    }

    /**
     * Walk `regex` over the flattened text, resolving each match to a live DOM
     * range. Zero-length matches are skipped — and the cursor advanced by a whole
     * code point — so a pattern like `a*` terminates instead of spinning.
     */
    private collectMatches(index: FindIndex, regex: RegExp): Range[] {
        const matches: Range[] = [];
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(index.text)) !== null) {
            if (match[0].length === 0) {
                const codePoint = index.text.codePointAt(regex.lastIndex);
                regex.lastIndex += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
                continue;
            }
            const range = this.rangeForMatch(index, match.index, match.index + match[0].length);
            if (range) matches.push(range);
            if (matches.length >= FIND_MAX_MATCHES) break;
        }
        return matches;
    }

    /** Build the DOM range covering `[start, end)` of the flattened text, if both ends resolve. */
    private rangeForMatch(index: FindIndex, start: number, end: number): Range | null {
        const from = offsetToPosition(index.segments, start);
        const to = offsetToPosition(index.segments, end, true);
        if (!from || !to) return null;
        const range = this.document.createRange();
        range.setStart(from.node, from.offset);
        range.setEnd(to.node, to.offset);
        return range;
    }

    /** Publish the new match list, clamp or reset the current index, and repaint. */
    private updateFindState(matches: Range[], options: { preserveIndex: boolean }): void {
        this.findMatches.set(matches);
        if (matches.length === 0) {
            this.findCurrentIndex.set(-1);
        } else if (options.preserveIndex) {
            this.findCurrentIndex.set(Math.min(Math.max(this.findCurrentIndex(), 0), matches.length - 1));
        } else {
            this.findCurrentIndex.set(0);
        }
        this.paintMatches();
        if (matches.length > 0) this.scrollToCurrentMatch();
    }

    /** The overlay layer, created on first paint as a sibling of the editable. */
    private ensureFindOverlay(): HTMLElement | null {
        if (this.findOverlay?.isConnected) return this.findOverlay;
        const container = this.editorContainer?.nativeElement;
        if (!container) return null;
        const overlay = this.document.createElement('div');
        overlay.dataset['slot'] = 'rich-text-find-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.className = 'absolute inset-0 pointer-events-none overflow-hidden z-40';
        container.appendChild(overlay);
        this.findOverlay = overlay;
        this.attachFindRepositionListeners();
        return overlay;
    }

    /**
     * Keep the overlay pinned to the text as the editable scrolls or resizes.
     * The rectangles are viewport-derived, so any layout shift invalidates them.
     */
    private attachFindRepositionListeners(): void {
        const editor = this.editorDiv?.nativeElement;
        if (!editor || this.findScrollHandler) return;
        const handler = (): void => this.requestFindRepaint();
        editor.addEventListener('scroll', handler, { passive: true });
        this.findScrollHandler = () => editor.removeEventListener('scroll', handler);
        if (typeof ResizeObserver !== 'undefined') {
            this.findResizeObserver = new ResizeObserver(handler);
            this.findResizeObserver.observe(editor);
        }
    }

    /** Coalesce repaint requests onto one animation frame. */
    private requestFindRepaint(): void {
        if (this.findRepaintHandle !== null) return;
        this.findRepaintHandle = requestAnimationFrame(() => {
            this.findRepaintHandle = null;
            this.paintMatches();
        });
    }

    /**
     * Draw one absolutely-positioned rectangle per client rect of every match.
     * The overlay is a sibling of the editable, never a child of the content, so
     * nothing here can reach `htmlContent`, the form value or the history — the
     * defect that injected `<mark>` elements used to cause.
     *
     * Geometry is requested only for rectangles that will actually be drawn:
     * `getClientRects()` forces layout, so asking for every match of a
     * thousands-of-matches query is precisely the cost
     * {@link FIND_MAX_PAINTED_RECTS} exists to avoid.
     */
    private paintMatches(): void {
        const matches = this.findMatches();
        if (matches.length === 0) {
            this.clearFindHighlights();
            return;
        }
        const overlay = this.ensureFindOverlay();
        const container = this.editorContainer?.nativeElement;
        if (!overlay || !container) return;

        const base = container.getBoundingClientRect();
        const currentIdx = this.findCurrentIndex();
        const painted: { rect: DOMRect; current: boolean }[] = [];
        for (const [i, range] of matches.entries()) {
            const isCurrent = i === currentIdx;
            if (!isCurrent && painted.length >= FIND_MAX_PAINTED_RECTS) continue;
            for (const rect of Array.from(range.getClientRects())) {
                painted.push({ rect, current: isCurrent });
            }
        }

        this.renderFindRects(overlay, painted, base, container);
    }

    /** Reconcile the overlay's rectangle elements against `painted`, reusing nodes. */
    private renderFindRects(
        overlay: HTMLElement,
        painted: readonly { rect: DOMRect; current: boolean }[],
        base: DOMRect,
        container: HTMLElement,
    ): void {
        const existing = Array.from(overlay.children) as HTMLElement[];
        for (let i = existing.length; i < painted.length; i++) {
            const el = this.document.createElement('div');
            el.dataset['findRect'] = '';
            el.className = 'absolute rounded-[2px]';
            overlay.appendChild(el);
        }
        const children = Array.from(overlay.children) as HTMLElement[];
        for (const [i, child] of children.entries()) {
            const entry = painted[i];
            if (!entry) {
                child.hidden = true;
                continue;
            }
            child.hidden = false;
            if (entry.current) {
                child.dataset['findCurrent'] = '';
            } else {
                delete child.dataset['findCurrent'];
            }
            child.style.backgroundColor = entry.current
                ? 'rgba(250, 204, 21, 0.7)'
                : 'rgba(250, 204, 21, 0.35)';
            child.style.left = `${entry.rect.left - base.left + container.scrollLeft}px`;
            child.style.top = `${entry.rect.top - base.top + container.scrollTop}px`;
            child.style.width = `${entry.rect.width}px`;
            child.style.height = `${entry.rect.height}px`;
        }
    }

    /** Remove every painted rectangle, leaving the (empty) overlay in place. */
    private clearFindHighlights(): void {
        if (this.findOverlay) this.findOverlay.replaceChildren();
    }

    /**
     * Bring the current match into the editable's visible area. Scrolls the
     * editable itself rather than calling `scrollIntoView`, so a match below the
     * fold never scrolls the whole page.
     */
    private scrollToCurrentMatch(): void {
        const editor = this.editorDiv?.nativeElement;
        const range = this.findMatches()[this.findCurrentIndex()];
        if (!editor || !range) return;
        const rect = range.getBoundingClientRect();
        const view = editor.getBoundingClientRect();
        if (rect.height === 0 && rect.width === 0) return;
        if (rect.top < view.top) {
            editor.scrollTop += rect.top - view.top;
        } else if (rect.bottom > view.bottom) {
            editor.scrollTop += rect.bottom - view.bottom;
        }
    }

    /**
     * Advance to the next match, wrapping around at the end, and scroll it into
     * view. No-op with no matches.
     */
    findNext(): void {
        const matches = this.findMatches();
        if (matches.length === 0) return;
        this.findCurrentIndex.set((this.findCurrentIndex() + 1) % matches.length);
        this.paintMatches();
        this.scrollToCurrentMatch();
    }

    /**
     * Step back to the previous match, wrapping around to the last one at the
     * start. Otherwise identical to {@link findNext}; reached from the panel's up
     * arrow and from `Shift+Enter` in the query field.
     */
    findPrevious(): void {
        const matches = this.findMatches();
        if (matches.length === 0) return;
        const idx = this.findCurrentIndex() - 1;
        this.findCurrentIndex.set(idx < 0 ? matches.length - 1 : idx);
        this.paintMatches();
        this.scrollToCurrentMatch();
    }

    /**
     * The text that replaces `matched`. In regex mode the pattern is re-applied
     * to the matched text so `$1`-style group references expand; otherwise the
     * replacement is inserted literally.
     */
    private replacementFor(matched: string): string {
        if (!this.findUseRegex()) return this.replaceText();
        const regex = compileFindRegex(this.findQuery(), {
            caseSensitive: this.findCaseSensitive(),
            wholeWord: this.findWholeWord(),
            useRegex: true,
        });
        if (!regex) return this.replaceText();
        return matched.replace(new RegExp(regex.source, regex.flags.replace('g', '')), this.replaceText());
    }

    /**
     * Swap one range's contents for `text`, keeping the formatting around it.
     * The replacement lands at the range's start, so a match spanning a markup
     * boundary reappears where it began; inline ancestors the deletion emptied
     * are then removed rather than left as invisible stubs.
     */
    private replaceRange(range: Range, text: string): void {
        const touched: Element[] = [];
        for (let node = range.commonAncestorContainer; node; node = node.parentNode as Node) {
            if (node === this.editorDiv?.nativeElement) break;
            if (node.nodeType === Node.ELEMENT_NODE) touched.push(node as Element);
        }
        const descendants = touched[0]
            ? Array.from(touched[0].querySelectorAll('*'))
            : [];

        range.deleteContents();
        if (text) range.insertNode(this.document.createTextNode(text));

        for (const el of [...descendants, ...touched]) {
            if (el.textContent === '' && !el.querySelector('img, br')) el.remove();
        }
    }

    /**
     * Replace the currently highlighted match, then re-run the search so the
     * counter and highlights reflect the new content, keeping the index so the
     * next call moves forward through the remaining matches. Records exactly one
     * history entry, flushing any pending typing burst as its own entry first.
     * No-op with no current match, or when the editor is not editable.
     */
    replaceSingle(): void {
        if (this.readonly() || this.isDisabled()) return;
        const range = this.findMatches()[this.findCurrentIndex()];
        if (!range) return;

        this.flushPendingHistoryPush();
        this.replaceRange(range, this.replacementFor(range.toString()));
        this.syncContentFromEditor();
        this.pushHistory();
        this.performFind({ preserveIndex: true });
    }

    /**
     * Replace every match of the current query in one pass, walking the matches
     * back to front so earlier replacements cannot invalidate later positions.
     * The whole sweep is a single history entry — one undo restores the document
     * — and any pending typing burst is flushed as its own entry first. No-op
     * when the editor is not editable.
     */
    replaceAll(): void {
        if (this.readonly() || this.isDisabled()) return;
        const matches = this.findMatches();
        if (matches.length === 0) return;

        this.flushPendingHistoryPush();
        for (const range of [...matches].reverse()) {
            this.replaceRange(range, this.replacementFor(range.toString()));
        }
        this.syncContentFromEditor();
        this.pushHistory();
        this.performFind({ preserveIndex: true });
    }

    /**
     * Keydown handler bound on the find panel container. `Mod+Alt+Enter` replaces
     * all; `Enter` in the replace input replaces the current match; `Enter`
     * elsewhere is {@link findNext} and `Shift+Enter` {@link findPrevious}. The
     * default is prevented so Enter in either text field never submits a
     * surrounding form. Escape is closed separately by the template's
     * `keydown.escape` binding.
     */
    onFindReplaceKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Enter') return;
        event.preventDefault();

        if (event.altKey && (event.ctrlKey || event.metaKey)) {
            this.replaceAll();
            return;
        }
        const target = event.target as HTMLElement | null;
        if (target?.dataset?.['slot'] === 'rich-text-find-replace') {
            this.replaceSingle();
            return;
        }
        if (event.shiftKey) {
            this.findPrevious();
        } else {
            this.findNext();
        }
    }

    private insertTextNode(text: string): void {
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

    private insertHtmlFragment(html: string): void {
        this.insertSanitizedHtml(this.sanitizer.sanitize(html));
    }

    /**
     * Insert already-sanitized markup at the live caret. Split out so a caller
     * that had to sanitize anyway — {@link insertHtml}, which sanitizes to
     * decide whether anything survives — can insert the result it already has
     * instead of paying for a second identical pass.
     */
    private insertSanitizedHtml(sanitized: string): void {
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
        const html = this.readContentFromEditor();
        if (html === null) return;

        const outputValue = this.mode() === 'markdown'
            ? this.markdownService.toMarkdown(html)
            : html;
        this.onChange(outputValue);
    }

    /**
     * Re-reads the editable DOM into {@link htmlContent} and returns the
     * sanitized html, WITHOUT notifying the form. Used where the model has to
     * be current for a history snapshot but the value is about to change again
     * \u2014 a Markdown input rule captures its pre-transform markers this way, and
     * telling the form about that intermediate state would emit twice for one
     * edit. Returns `null` when the editor element is not available.
     */
    private readContentFromEditor(): string | null {
        const editorElement = this.getEditorElement();
        if (!editorElement) return null;

        const html = this.sanitizer.sanitize(editorElement.innerHTML).replaceAll('\u200B', '');
        this.htmlContent.set(html);
        return html;
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

    /**
     * Re-capture the (still selected) range after a picker-driven mutation, so
     * a second choice from the same open picker applies to the same text.
     *
     * The font handlers used to end with {@link focusEditor}, which collapses
     * the selection: the first choice worked, then every later one in the same
     * open picker silently did nothing because there was no longer anything
     * selected to style. Colour picking already behaved correctly, which is why
     * only the font controls showed the bug.
     */
    private reSaveLiveSelection(spans?: readonly HTMLElement[]): void {
        const editor = this.editorDiv?.nativeElement;
        const selection = this.document.getSelection();
        if (!editor || !selection) return;

        // `execCommand` replaces the styled run with NEW nodes, so the range
        // that was live a moment ago points at detached ones. Re-select across
        // the spans the command just produced, keeping the same visible text
        // selected so a second pick from the still-open picker restyles it
        // instead of silently doing nothing.
        if (spans && spans.length > 0) {
            const range = this.document.createRange();
            range.setStartBefore(spans[0]);
            range.setEndAfter(spans[spans.length - 1]);
            selection.removeAllRanges();
            selection.addRange(range);
            this.savedRange = range.cloneRange();
            return;
        }

        if (selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.startContainer)) return;
        this.savedRange = range.cloneRange();
    }

    /** Registry of addon-contributed toolbar buttons (addon host surface). */
    readonly toolbarSlots = new AddonSlotRegistry<RichTextToolbarSlot>();

    /** This editor instance's slash-command registry (addon host surface). */
    get commands(): RichTextCommandRegistry {
        return this.commandRegistry;
    }

    /** The app-wide slash-command registry shared by every editor (addon host surface). */
    get globalCommands(): RichTextCommandRegistry {
        return this.rootCommandRegistry;
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

    /**
     * Restore the in-editor selection, trying three sources in order:
     *
     * 1. The live selection, if it is already inside the editor.
     * 2. An explicitly saved range, if it still lives in the editor.
     * 3. Otherwise the end of the editor content — covering an editor that was
     *    never focused, or a caret sitting in the toolbar or overlay UI (an
     *    addon picker's search field, say), so insertions always land in the
     *    text rather than nowhere.
     *
     * The live selection wins because `savedRange` is captured on blur, so it
     * holds a *collapsed* caret from the last time focus left. A keyboard
     * shortcut (`Mod+B`) runs while the editor still has focus and a real
     * selection: preferring the stale range there replaced the user's
     * selection with an empty one, `execCommand` became a no-op, and the
     * caret jumped to wherever they had last clicked away from — while the
     * toolbar toggle, computed separately, still flipped to "on". Toolbar
     * clicks are unaffected: the button blurs the editor first, so the live
     * selection is no longer inside it and step 2 applies as before.
     */
    restoreSelection(options?: { preferLive?: boolean }): void {
        const editor = this.editorDiv?.nativeElement;
        if (!editor) return;
        const selection = this.document.getSelection();
        if (!selection) return;
        if (
            options?.preferLive !== false &&
            selection.rangeCount > 0 &&
            editor.contains(selection.getRangeAt(0).startContainer)
        ) {
            return;
        }
        if (this.savedRange && editor.contains(this.savedRange.startContainer)) {
            this.focusEditor();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
            return;
        }
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

        this.detectBlockFormats(formats);
        this.activeFormats.set(formats);
        this.detectCurrentFontSize();
        this.detectCurrentFontFamily();
        this.detectCurrentColors();
    }

    /**
     * The tags that decide the caret's block type, and what each contributes.
     * A `CODE` only counts as inline code when no `PRE` was seen on the way up,
     * which is why the walk records what it has passed rather than matching the
     * first interesting ancestor and stopping.
     */
    private static readonly BLOCK_FORMAT_TAGS: Record<string, string> = {
        H1: 'heading1',
        H2: 'heading2',
        H3: 'heading3',
        BLOCKQUOTE: 'blockquote',
        PRE: 'codeBlock',
    };

    /**
     * Blocks whose presence means the caret is not in a plain paragraph, even
     * when a `P` or `DIV` wraps it — a paragraph inside a list item or a table
     * cell belongs to that structure, and the `paragraph` button must not claim
     * it.
     */
    private static readonly NON_PARAGRAPH_TAGS = new Set([
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'LI', 'TD', 'TH', 'SUMMARY',
    ]);

    /**
     * Adds every block-level format at the caret in ONE walk from the selection
     * to the editor root — block type, inline code, task list, alignment and
     * list nesting. It replaces the old task-list-only walk, so the detection is
     * strictly cheaper than before despite reporting far more.
     */
    private detectBlockFormats(formats: Set<string>): void {
        const editor = this.getEditorElement();
        const selection = this.document.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) return;

        const start = selection.getRangeAt(0).startContainer;
        if (!editor.contains(start)) return;

        const seen = this.walkBlockAncestors(start, editor, formats);

        if (seen.code && !seen.pre) formats.add('code');
        if (!seen.nonParagraph) formats.add('paragraph');
        this.addAlignmentFormat(seen.block, formats);
    }

    /**
     * Walks the caret's ancestors up to the editor root, adding each element's
     * own formats and reporting what the chain contained — the nearest block
     * (for alignment) and whether a `CODE`, a `PRE` or any non-paragraph
     * structure was passed, all of which take the whole chain to decide.
     */
    private walkBlockAncestors(
        start: Node,
        editor: HTMLElement,
        formats: Set<string>
    ): { block: HTMLElement | null; code: boolean; pre: boolean; nonParagraph: boolean } {
        let node: Node | null = start.nodeType === Node.TEXT_NODE ? start.parentNode : start;
        const seen = { block: null as HTMLElement | null, code: false, pre: false, nonParagraph: false };

        while (node && node !== editor) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                seen.block ??= this.blockForAlignment(element);
                seen.code ||= element.tagName === 'CODE';
                seen.pre ||= element.tagName === 'PRE';
                seen.nonParagraph ||= RichTextEditorComponent.NON_PARAGRAPH_TAGS.has(element.tagName);
                this.addTagFormats(element, formats);
            }
            node = node.parentNode;
        }
        return seen;
    }

    /** The formats one ancestor element contributes on the way to the root. */
    private addTagFormats(element: HTMLElement, formats: Set<string>): void {
        const tagFormat = RichTextEditorComponent.BLOCK_FORMAT_TAGS[element.tagName];
        if (tagFormat) formats.add(tagFormat);

        if (element.tagName === 'UL' && element.dataset['taskList'] !== undefined) {
            formats.add('taskList');
        }
        if (element.tagName === 'LI' && this.getListDepth(element) >= 2) {
            formats.add('indent');
        }
    }

    /** The nearest ancestor whose alignment applies to the caret, if any. */
    private blockForAlignment(element: HTMLElement): HTMLElement | null {
        const isBlock = RichTextEditorComponent.NON_PARAGRAPH_TAGS.has(element.tagName)
            || element.tagName === 'P'
            || element.tagName === 'DIV';
        return isBlock ? element : null;
    }

    /** Adds the caret block's alignment, mapped through the locale direction. */
    private addAlignmentFormat(block: HTMLElement | null, formats: Set<string>): void {
        if (!block) return;
        const textAlign = block.style.textAlign
            || block.getAttribute('align')
            || '';
        const format = this.alignmentFormat(textAlign, this.isRtl());
        if (format) formats.add(format);
    }

    /**
     * The toolbar item a physical or logical `text-align` value presses.
     *
     * `left`/`right` name physical sides of the page, so under an RTL locale
     * they press the opposite item — the one whose glyph and command the
     * toolbar has already mirrored, which is what makes a right-aligned Hebrew
     * paragraph light up the button that visually points right.
     * `start`/`end` are already direction-relative and so map straight through.
     * `justify` and an absent value press nothing.
     */
    private alignmentFormat(textAlign: string, rtl: boolean): string | null {
        switch (textAlign) {
            case 'center': return 'alignCenter';
            case 'left': return rtl ? 'alignRight' : 'alignLeft';
            case 'right': return rtl ? 'alignLeft' : 'alignRight';
            case 'start': return 'alignLeft';
            case 'end': return 'alignRight';
            default: return null;
        }
    }

    /**
     * The element the current selection sits in, or `null` when the selection is
     * outside this editor. Clicking inside an overlay the editor owns — the
     * colour picker's own labels, say — collapses the document selection into
     * that overlay; without the containment check the format detectors would
     * read the overlay's computed style and report the popover's colours as the
     * editor's. Returning `null` makes them keep the last in-editor state.
     */
    private selectedElement(): HTMLElement | null {
        const sel = this.document.getSelection();
        if (!sel || sel.rangeCount === 0) {
            return null;
        }
        let node: Node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentElement ?? node;
        }
        if (!this.editorDiv?.nativeElement?.contains(node)) {
            return null;
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
        this.currentFontColor.set(this.pendingTypingColor('foreColor') || computedStyle.color);
        this.currentBackgroundColor.set(
            this.pendingTypingColor('backColor') || computedStyle.backgroundColor,
        );
    }

    /**
     * The colour the next typed character will take at a collapsed caret, or
     * `''` when there is none. A colour command applied to a caret records a
     * *pending* typing style that the browser holds internally rather than in
     * the DOM, so computed style cannot see it and the toolbar would otherwise
     * reflect the old colour until the caret next moves.
     *
     * Only consulted while the caret still sits where a colour was applied to it
     * ({@link caretColorAnchor}): with nothing pending, `queryCommandValue`
     * reports the element's own colour — and for `backColor` that is the
     * editor's opaque background, which would otherwise read as a white
     * highlight on any theme whose background serializes as `rgb(...)`.
     */
    private pendingTypingColor(commandId: string): string {
        const pending = this.caretPendingStyle();
        return (commandId === 'foreColor' ? pending.color : pending.backgroundColor) ?? '';
    }

    /**
     * The colours the next typed character will take, or empty once the caret has
     * moved away from where they were chosen.
     *
     * Tracked here rather than read back with `queryCommandValue`, which reports
     * the last value handed to `execCommand` whether or not it is still armed —
     * it claimed a text colour was pending when the character typed immediately
     * after came out uncoloured. The editor knows what it applied.
     *
     * `anchor` is tested before the caret comparison so that "no colour applied
     * yet" stays a miss even when there is also no caret — comparing two
     * `undefined`s would otherwise read as a match.
     */
    private caretPendingStyle(): { color?: string; backgroundColor?: string } {
        const anchor = this.caretColorAnchor;
        const caret = this.collapsedCaretAnchor();
        if (!anchor || caret?.node !== anchor.node || caret?.offset !== anchor.offset) {
            return {};
        }
        return { color: anchor.color, backgroundColor: anchor.backgroundColor };
    }

    /**
     * Drop a pending colour once the caret has left it, and restore the default
     * `styleWithCSS` that `applySelectionColor` deliberately left on.
     */
    private releaseCaretColor(): void {
        if (!this.caretColorAnchor) return;
        const caret = this.collapsedCaretAnchor();
        if (caret?.node === this.caretColorAnchor.node
            && caret?.offset === this.caretColorAnchor.offset) {
            return;
        }
        this.caretColorAnchor = null;
        this.execEditorCommand('styleWithCSS', 'false');
    }

    /**
     * The current collapsed caret position, or `null` when the selection spans
     * content or sits outside the editor (a click in the colour popover collapses
     * it into the popover's own markup).
     */
    private collapsedCaretAnchor(): { node: Node; offset: number } | null {
        const selection = this.document.getSelection();
        const editor = this.editorDiv?.nativeElement;
        if (!selection?.isCollapsed || !selection.anchorNode || !editor?.contains(selection.anchorNode)) {
            return null;
        }
        return { node: selection.anchorNode, offset: selection.anchorOffset };
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

    /**
     * The tag names a block rule may transform. Anything else — a list item, a
     * table cell, a `<pre>`, a `<summary>`, an existing heading — is a block the
     * author already chose, so a marker typed into it stays literal text.
     */
    private static readonly INPUT_RULE_BLOCK_TAGS = new Set(['P', 'DIV']);

    /**
     * Ancestors that veto a block rule even when the caret's own block is a
     * plain paragraph, because the paragraph is nested inside a structure the
     * rule would otherwise tear apart.
     */
    private static readonly INPUT_RULE_FORBIDDEN_ANCESTORS = 'pre, li, td, th, summary';

    /**
     * Inline ancestors that veto an inline rule: the marker either already sits
     * in code (where Markdown is literal) or inside a chip another feature owns.
     */
    private static readonly INLINE_RULE_FORBIDDEN_ANCESTORS =
        'code, pre, a, [data-mention], [data-tag], [data-action-click], [data-action-hover]';

    /**
     * The longest block marker plus its terminator (```` ``` ```` + a 16-char
     * language + a space). A caret prefix longer than this cannot complete a
     * block rule, which is what keeps the check off the block's full text on
     * every keystroke of a long paragraph.
     */
    private static readonly MAX_BLOCK_MARKER_LENGTH = 24;

    /** One press of Increase/Decrease Indent, in rem. */
    private static readonly BLOCK_INDENT_STEP = 2;

    /** Ceiling for block indentation, so a document cannot be pushed off-page. */
    private static readonly MAX_BLOCK_INDENT_REM = 12;

    /**
     * `inputType` prefixes and values that never complete a Markdown marker:
     * deletions and history replays are not authoring, formatting commands have
     * already decided the block, and a composition is still open (the committed
     * `insertText` that follows is the one that counts).
     */
    private static readonly INPUT_RULE_IGNORED_TYPES = ['delete', 'history', 'format'];

    /**
     * Where the caret has to still be for the last transform to be revertable.
     * A block rule records the block it produced; an inline rule records that
     * element's PARENT, because the caret parks in a zero-width node beside the
     * new element rather than inside it. Backspace consults this to offer the
     * one-keystroke revert; any other key, input, click or blur clears it, so
     * the window is exactly the keystroke after the transform.
     */
    private lastInputRule: { block: HTMLElement } | null = null;

    /**
     * Applies a Markdown input rule to the caret's block or text, if the
     * characters that just landed completed one. Called at the top of
     * {@link onInput}, before the DOM is read for the model or handed to input
     * observers, so a slash or mention addon sees the post-transform text.
     *
     * Returns whether a transform happened — the caller turns that into a single
     * history entry instead of the usual debounced push.
     */
    private applyInputRules(event: Event): boolean {
        if (!this.markdownShortcuts() || this.isUndoRedo) return false;
        if (this.isDisabled() || this.readonly()) return false;

        const inputType = (event as InputEvent).inputType ?? 'insertText';
        if (this.isIgnoredInputType(inputType)) return false;

        const context = this.inputRuleContext();
        if (!context) return false;

        const terminator = this.blockRuleTerminator(context.blockPrefix, event);
        return this.tryBlockRule(context, terminator) || this.tryInlineRule(context);
    }

    /** Whether an `inputType` is one Markdown rules deliberately sit out. */
    private isIgnoredInputType(inputType: string): boolean {
        if (inputType === 'insertCompositionText') return true;
        return RichTextEditorComponent.INPUT_RULE_IGNORED_TYPES.some((prefix) =>
            inputType.startsWith(prefix)
        );
    }

    /**
     * The caret's position expressed the way the rules need it: the block it
     * sits in, its text node and offset, and the block's text before it.
     *
     * `null` whenever there is no collapsed caret inside this editor — a
     * selection replacement or a caret in another editor is never a rule.
     */
    private inputRuleContext(): {
        block: HTMLElement;
        textNode: Text | null;
        offset: number;
        blockPrefix: string;
    } | null {
        const editor = this.getEditorElement();
        const selection = this.document.getSelection();
        if (!editor || !selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;

        const range = selection.getRangeAt(0);
        if (!editor.contains(range.startContainer)) return null;

        const startNode = range.startContainer;
        const textNode = startNode.nodeType === Node.TEXT_NODE ? (startNode as Text) : null;
        const block = this.closestInputRuleBlock(startNode, editor);
        if (!block) return null;

        const prefixRange = this.document.createRange();
        prefixRange.setStart(block, 0);
        prefixRange.setEnd(range.startContainer, range.startOffset);
        const blockPrefix = prefixRange.toString().replaceAll('\u200B', '');

        return { block, textNode, offset: range.startOffset, blockPrefix };
    }

    /**
     * The element a rule would transform: the caret's nearest block-level
     * ancestor, or the editor root itself when the caret sits in a bare
     * top-level text node that no block wraps yet.
     */
    private closestInputRuleBlock(startNode: Node, editor: HTMLElement): HTMLElement | null {
        const start = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : (startNode as HTMLElement);
        if (!start) return null;
        const block = start.closest<HTMLElement>('p, div, h1, h2, h3, h4, h5, h6, li, td, th, pre, blockquote, summary');
        if (block && editor.contains(block) && block !== editor) return block;
        return editor;
    }

    /**
     * Applies a block rule when the caret's prefix is a complete marker and the
     * block is one a rule may claim. The marker is removed before the block is
     * rebuilt, so the transform leaves only the author's own text behind.
     */
    private tryBlockRule(
        context: { block: HTMLElement; blockPrefix: string },
        terminator: ' ' | ''
    ): boolean {
        if (context.blockPrefix.length > RichTextEditorComponent.MAX_BLOCK_MARKER_LENGTH) return false;

        const block = this.blockRuleTarget(context.block);
        if (!block) return false;

        const markerText = terminator === '' ? context.blockPrefix : context.blockPrefix.slice(0, -1);
        const match = matchBlockInputRule(markerText, terminator);
        if (!match) return false;

        this.snapshotBeforeTransform();
        this.removeLeadingCharacters(block, match.markerLength);
        const produced = this.buildBlockForRule(block, match);
        this.lastInputRule = { block: produced };
        return true;
    }

    /**
     * The element a block rule may rewrite, or `null` when the caret's block is
     * one the author already chose. A bare text node directly under the editor
     * is wrapped in a paragraph first, so the rules behave the same whether or
     * not the browser has created a block yet.
     */
    private blockRuleTarget(block: HTMLElement): HTMLElement | null {
        const editor = this.getEditorElement();
        if (editor && block === editor) return this.wrapBareTextInParagraph(editor);
        if (!RichTextEditorComponent.INPUT_RULE_BLOCK_TAGS.has(block.tagName)) return null;
        if (block.closest(RichTextEditorComponent.INPUT_RULE_FORBIDDEN_ANCESTORS)) return null;
        return block;
    }

    /**
     * Moves the editor's bare top-level nodes into a paragraph and restores the
     * caret inside it, returning that paragraph. Only reached when the browser
     * left typed characters unwrapped.
     */
    private wrapBareTextInParagraph(editor: HTMLElement): HTMLElement | null {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const { startContainer, startOffset } = selection.getRangeAt(0);

        const paragraph = this.document.createElement('p');
        while (editor.firstChild) {
            paragraph.appendChild(editor.firstChild);
        }
        editor.appendChild(paragraph);

        const restored = this.document.createRange();
        restored.setStart(startContainer, startOffset);
        restored.collapse(true);
        selection.removeAllRanges();
        selection.addRange(restored);
        return paragraph;
    }

    /**
     * Which character completed the marker: a space when the author just typed
     * one, and otherwise nothing — the empty terminator only `---` accepts.
     *
     * The space must have been *typed*, not merely end the prefix, so that
     * dropping or pasting `"- "` into a paragraph leaves it as literal text. An
     * event carrying no `data` is the synthetic one the tests raise, and counts
     * as a typed space when the prefix already ends in one.
     */
    private blockRuleTerminator(blockPrefix: string, event: Event): ' ' | '' {
        if (!/[ \u00A0]$/.test(blockPrefix)) return '';

        const input = event as InputEvent;
        if (input.inputType && input.inputType !== 'insertText') return '';
        return input.data == null || input.data === ' ' ? ' ' : '';
    }

    /** Deletes the first `count` characters of a block's text, marker included. */
    private removeLeadingCharacters(block: HTMLElement, count: number): void {
        let remaining = count;
        const walker = this.document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        while (remaining > 0 && walker.nextNode()) {
            const textNode = walker.currentNode as Text;
            const take = Math.min(remaining, textNode.data.length);
            textNode.deleteData(0, take);
            remaining -= take;
        }
    }

    /**
     * Rebuilds the block as the matched rule asks and leaves the caret where the
     * author would continue typing, returning the element the rule produced.
     */
    private buildBlockForRule(block: HTMLElement, match: BlockInputRuleMatch): HTMLElement {
        switch (match.kind) {
            case 'heading1':
            case 'heading2':
            case 'heading3':
                return this.finishBlockRule(this.replaceBlockTag(block, `h${match.kind.at(-1)}`));
            case 'bulletList':
                return this.finishBlockRule(this.wrapBlockInList(block, 'ul'));
            case 'orderedList':
                return this.finishBlockRule(this.wrapBlockInList(block, 'ol'));
            case 'blockquote':
                return this.finishBlockRule(this.replaceBlockTag(block, 'blockquote'));
            case 'taskUnchecked':
                return this.buildTaskBlock(block, false);
            case 'taskChecked':
                return this.buildTaskBlock(block, true);
            case 'horizontalRule':
                return this.buildHorizontalRuleBlock(block);
            default:
                return this.buildCodeBlockForRule(block, match.language ?? '');
        }
    }

    /** Places the caret at the start of a rule's new block and returns it. */
    private finishBlockRule(block: HTMLElement): HTMLElement {
        this.placeCaretAtStartOfBlock(block);
        return block;
    }

    /**
     * The text node at the start of a block for the caret to sit in: the
     * block's own first one when it has content — a code block's seeded newline
     * counts, and must survive so the Enter-to-exit rule can see it — otherwise
     * a zero-width anchor, because a real browser will not put a caret in a
     * zero-length text node or in a block holding only a `<br>`.
     */
    private emptyBlockCaretTarget(block: HTMLElement): Text {
        const walker = this.document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        const existing = walker.nextNode() as Text | null;
        if (existing?.data) return existing;

        if (existing) {
            existing.data = '\u200B';
            return existing;
        }

        block.innerHTML = '';
        return block.appendChild(this.document.createTextNode('\u200B')) as Text;
    }

    /**
     * Collapses the caret to where the author continues typing in a block a
     * rule just built — before the block's own text, or after the zero-width
     * anchor when the block has none, since a real browser will not type into
     * a zero-length text node.
     */
    private placeCaretAtStartOfBlock(block: HTMLElement): void {
        const selection = this.document.getSelection();
        if (!selection) return;

        const target = this.emptyBlockCaretTarget(block);
        const offset = this.isEmptyBlock(block) ? target.data.length : 0;

        const range = this.document.createRange();
        range.setStart(target, offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * Replaces the block with a task-list item carrying its remaining text,
     * built the same way {@link insertTaskList} builds one so both paths produce
     * the structure the sanitizer and the Enter rules already understand.
     */
    private buildTaskBlock(block: HTMLElement, checked: boolean): HTMLElement {
        const list = this.document.createElement('ul');
        list.dataset['taskList'] = '';
        const item = this.createTaskListItem(checked);
        const textSpan = item.querySelector('span') as HTMLElement;

        if (this.isEmptyBlock(block)) {
            textSpan.textContent = '\u200B';
        } else {
            textSpan.textContent = '';
            while (block.firstChild) {
                textSpan.appendChild(block.firstChild);
            }
        }

        list.appendChild(item);
        block.parentNode?.replaceChild(list, block);
        this.placeCaretAtStartOfBlock(textSpan);
        return item;
    }

    /**
     * One task-list item: the checkbox the reader toggles plus the span holding
     * its text, seeded with a non-breaking space so an empty item still has a
     * caret position.
     */
    private createTaskListItem(checked: boolean): HTMLElement {
        const item = this.document.createElement('li');
        item.dataset['task'] = '';
        item.dataset['checked'] = String(checked);
        const checkbox = this.document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        const textSpan = this.document.createElement('span');
        textSpan.appendChild(this.document.createTextNode(' '));
        item.appendChild(checkbox);
        item.appendChild(textSpan);
        return item;
    }

    /**
     * Replaces the block with a rule followed by the empty paragraph the author
     * carries on typing in. Built here rather than through
     * {@link insertHorizontalRule}, which inserts at the caret and pushes its
     * own history entry.
     */
    private buildHorizontalRuleBlock(block: HTMLElement): HTMLElement {
        const rule = this.document.createElement('hr');
        const paragraph = this.document.createElement('p');
        paragraph.innerHTML = '<br>';
        block.parentNode?.replaceChild(paragraph, block);
        paragraph.parentNode?.insertBefore(rule, paragraph);
        this.placeCaretAtStartOfBlock(paragraph);
        return paragraph;
    }

    /**
     * Replaces the block with a fenced code block holding whatever text
     * followed the fence, or a newline when it was empty — the same shape
     * {@link insertCodeBlock} produces, so the Enter-to-exit rule works in it.
     */
    private buildCodeBlockForRule(block: HTMLElement, language: string): HTMLElement {
        const pre = this.document.createElement('pre');
        const code = this.document.createElement('code');
        if (language) {
            code.dataset['language'] = language;
            code.className = `language-${language}`;
            pre.dataset['language'] = language;
        }
        code.textContent = block.textContent?.replaceAll('\u200B', '') || '\n';
        pre.appendChild(code);
        block.parentNode?.replaceChild(pre, block);
        this.placeCaretAtStartOfBlock(code);
        return code;
    }

    /**
     * Captures the pre-transform DOM — markers and all — as its own history
     * entry, so a single undo restores the literal characters the author typed
     * and the transform costs exactly one step.
     */
    private snapshotBeforeTransform(): void {
        this.flushPendingHistoryPush();
        this.readContentFromEditor();
        this.pushHistory();
    }

    /**
     * Applies an inline rule when the text before the caret ends in a completed
     * wrapper. The wrapper's markers are dropped, its body moves into the new
     * element, and the caret is parked in a zero-width text node after it so the
     * browser does not keep typing inside the new `<strong>`.
     */
    private tryInlineRule(context: { block: HTMLElement; textNode: Text | null; offset: number }): boolean {
        const { textNode, offset, block } = context;
        if (!textNode) return false;
        if (textNode.parentElement?.closest(RichTextEditorComponent.INLINE_RULE_FORBIDDEN_ANCESTORS)) {
            return false;
        }

        const match = matchInlineInputRule(textNode.data.slice(0, offset));
        if (!match) return false;

        this.snapshotBeforeTransform();

        const tail = textNode.splitText(match.start);
        tail.deleteData(0, match.end - match.start);

        const element = this.document.createElement(
            this.inlineRuleTagName(match.kind)
        );
        element.textContent = match.text;
        tail.parentNode?.insertBefore(element, tail);

        const caretNode = this.document.createTextNode('\u200B');
        tail.parentNode?.insertBefore(caretNode, tail);
        const selection = this.document.getSelection();
        if (selection) {
            const range = this.document.createRange();
            range.setStart(caretNode, 1);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        this.lastInputRule = { block: element.parentElement ?? block };
        return true;
    }

    /** The element an inline rule builds for a matched wrapper. */
    private inlineRuleTagName(kind: 'strong' | 'em' | 'code'): string {
        if (kind === 'strong') return 'strong';
        return kind === 'em' ? 'em' : 'code';
    }

    /**
     * Restores the literal characters of the transform that just ran, when
     * Backspace is the very next keystroke and the caret has not left the block
     * the rule produced. Reuses {@link undo}, so the revert lands the caret
     * where the author was and redo re-applies the transform.
     */
    private revertLastInputRule(): boolean {
        if (!this.caretIsInLastInputRuleBlock()) return false;

        this.undo();
        this.lastInputRule = null;
        return true;
    }

    /**
     * Whether the caret is still collapsed inside the element the last rule
     * produced — the condition that keeps the Backspace revert offered.
     */
    private caretIsInLastInputRuleBlock(): boolean {
        const recorded = this.lastInputRule;
        if (!recorded) return false;

        const selection = this.document.getSelection();
        return (
            !!selection &&
            selection.rangeCount > 0 &&
            selection.isCollapsed &&
            recorded.block.contains(selection.getRangeAt(0).startContainer)
        );
    }

    /**
     * Ends the Backspace-revert window once the caret has left the block the
     * rule produced — clicking elsewhere or selecting a range means the author
     * has moved on, and Backspace there must delete rather than undo.
     */
    private closeInputRuleRevertWindowIfMoved(): void {
        if (this.lastInputRule && !this.caretIsInLastInputRuleBlock()) {
            this.lastInputRule = null;
        }
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

    /**
     * Undo one step — mirrors `Ctrl`/`Cmd`+`Z`. Flushes a pending typing burst
     * first, so one call takes back the whole burst rather than half of it.
     * No-op at the start of the stack.
     *
     * @publicApi
     */
    undo(): void {
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

    /**
     * Redo one step — mirrors `Ctrl`+`Y` / `Ctrl`+`Shift`+`Z`. No-op at the end
     * of the stack.
     *
     * @publicApi
     */
    redo(): void {
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

    /**
     * The single choke point every history-stack change already passes through,
     * so {@link historyChange} rides along with the version bump rather than
     * needing its own call at each mutation site.
     */
    private bumpHistoryVersion(): void {
        this._historyVersion.update(v => v + 1);
        this.historyChange.emit({
            canUndo: this.historyIndex > 0,
            canRedo: this.historyIndex < this.history.length - 1,
        });
    }

    private buildHistoryPreview(html: string): { preview: string; previewLines: string[]; lineCount: number } {
        const blockAware = html
            .replaceAll(/<br\s*\/?>/gi, '\n')
            .replaceAll(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
            .replaceAll(/<li[^>]*>/gi, '• ');
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
        this.cancelPendingFind();
        if (this.findRepaintHandle !== null) {
            cancelAnimationFrame(this.findRepaintHandle);
            this.findRepaintHandle = null;
        }
        this.findResizeObserver?.disconnect();
        this.findResizeObserver = null;
        this.findScrollHandler?.();
        this.findScrollHandler = null;
        this.closeTableContextMenu();
        this.removeFloatingScrollListener();
    }
}
