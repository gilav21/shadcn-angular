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
    model,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DOCUMENT, DatePipe } from '@angular/common';
import { cn } from '../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { RichTextMarkdownService } from './rich-text-markdown.service';
import { RichTextPasteNormalizerService } from './rich-text-paste-normalizer.service';
import { Observable, isObservable, of, Subject, Subscription, firstValueFrom, from, catchError } from 'rxjs';
import { debounceTime, switchMap, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isValidImageDataUrl } from '../lib/image-validator';
import { RichTextToolbarComponent, ToolbarItem } from './rich-text-toolbar.component';
import { MentionItem, RichTextMentionPopoverComponent, TagItem } from './rich-text-mention.component';
import { RichTextImageResizerComponent } from './rich-text-image-resizer.component';
import { ButtonComponent } from './button.component';
import { PopoverComponent, PopoverTriggerComponent, PopoverContentComponent } from './popover.component';
import {
    DialogComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogDescriptionComponent,
    DialogFooterComponent,
} from './dialog.component';
import { ScrollAreaComponent } from './scroll-area.component';
import { ShortcutBindingService, ShortcutComponentHandle } from '../lib/shortcut-binding.service';
import {
    RichTextCommandRegistry,
    RichTextSlashCommand,
    RichTextSlashCommandAvailabilityContext,
    RichTextSlashCommandContext,
} from './rich-text-command-registry.service';
import { RichTextLocale, RICH_TEXT_LOCALES, interpolate } from './rich-text-locales';

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

/** Discriminator for entity types the editor can insert inline. */
export type RichTextEntityType = 'mention' | 'tag';

/**
 * How an inserted entity (mention or tag) is rendered in the editor.
 *
 * - `'chip'` — Styled inline `<span>` with a background color (default).
 *   Looks like a pill/badge. Not clickable.
 * - `'link'` — Rendered as an `<a>` element. Requires a URL via
 *   `urlTemplate` or `buildUrl` in {@link RichTextEntityRenderOptions}.
 *   Falls back to `'chip'` if no URL can be resolved.
 * - `'text'` — Plain inline `<span>` with no default styling.
 *   Use `className` in render options to add custom styles.
 */
export type RichTextEntityRenderMode = 'chip' | 'link' | 'text';

/**
 * Return type for entity search functions. The editor accepts any of:
 * - A synchronous array of results.
 * - A `Promise` that resolves to results.
 * - An RxJS `Observable` that emits results.
 *
 * @typeParam T - The item type ({@link MentionItem} or {@link TagItem}).
 */
export type RichTextEntitySearchResult<T> = Observable<T[]> | Promise<T[]> | T[];

/**
 * A function that searches for entity candidates based on the user's query text.
 * Called every time the user types after the trigger character (`@` or `#`).
 *
 * @typeParam T - The item type ({@link MentionItem} or {@link TagItem}).
 * @param query - The text the user has typed after the trigger character.
 *   For example, if the user types `@jane`, query will be `"jane"`.
 * @returns A synchronous array, Promise, or Observable of matching items.
 *
 * @example
 * ```ts
 * // Synchronous (for small static lists)
 * const search: RichTextEntitySearchFn<MentionItem> = (query) =>
 *   allUsers.filter(u => u.label.toLowerCase().includes(query.toLowerCase()));
 *
 * // Async with Observable (for API calls)
 * const search: RichTextEntitySearchFn<MentionItem> = (query) =>
 *   this.http.get<MentionItem[]>(`/api/users?q=${query}`);
 * ```
 */
export type RichTextEntitySearchFn<T> = (query: string) => RichTextEntitySearchResult<T>;

/**
 * Context object passed to `buildUrl` and `buildText` callbacks in
 * {@link RichTextEntityRenderOptions}, and used internally when resolving
 * URL/text templates. Contains everything known about the entity at the
 * moment it is inserted into the editor.
 *
 * All properties are also available as template tokens (see
 * {@link RichTextEntityRenderOptions.urlTemplate}).
 */
export interface RichTextEntityRenderContext {
    /** Whether this is a `'mention'` (`@`) or `'tag'` (`#`). */
    type: RichTextEntityType;

    /** The trigger character that opened the popover: `'@'` or `'#'`. */
    trigger: '@' | '#';

    /**
     * Unique identifier for the entity. Resolved as `item.id` if provided,
     * otherwise falls back to `item.value`.
     */
    id: string;

    /** The raw `value` field from the selected {@link MentionItem} or {@link TagItem}. */
    value: string;

    /** The human-readable `label` from the selected item (e.g. `"Jane Doe"`). */
    label: string;

    /** The text the user had typed after the trigger when they selected the item. */
    query: string;

    /** The full selected item object. Useful in `buildUrl`/`buildText` for accessing custom fields. */
    item: MentionItem | TagItem;

    /**
     * Alias for `id` — always populated regardless of entity type.
     * Convenient in URL templates for mentions: `/users/@@userId@@`.
     */
    userId: string;

    /**
     * Alias for `id` — always populated regardless of entity type.
     * Convenient in URL templates for tags: `/tags/@@tagId@@`.
     */
    tagId: string;
}

/**
 * Controls how an inserted mention or tag is rendered inside the editor.
 *
 * Supply this via the `[mentionRender]` or `[tagRender]` inputs on
 * `<ui-rich-text-editor>`.
 *
 * @example
 * ```html
 * <!-- Render mentions as clickable profile links -->
 * <ui-rich-text-editor
 *   [mentions]="true"
 *   [mentionSearch]="searchUsers"
 *   [mentionRender]="{
 *     mode: 'link',
 *     urlTemplate: '/users/:id',
 *     textTemplate: '@@label@@',
 *     target: '_blank'
 *   }"
 * />
 *
 * <!-- Render tags as plain colored text -->
 * <ui-rich-text-editor
 *   [tags]="true"
 *   [tagSearch]="searchTags"
 *   [tagRender]="{
 *     mode: 'text',
 *     className: 'text-blue-500 font-semibold'
 *   }"
 * />
 * ```
 */
export interface RichTextEntityRenderOptions {
    /**
     * The rendering strategy for inserted entities.
     *
     * - `'chip'` — Inline `<span>` styled as a pill/badge (default).
     * - `'link'` — Clickable `<a>` element. Requires `urlTemplate` or `buildUrl`.
     * - `'text'` — Plain `<span>` with no default styling.
     *
     * @default 'chip'
     */
    mode?: RichTextEntityRenderMode;

    /**
     * A URL pattern with placeholder tokens that are replaced at insert time.
     * Only used when `mode` is `'link'`.
     *
     * **Two token syntaxes are supported:**
     *
     * | Syntax | Example | Notes |
     * |--------|---------|-------|
     * | `@@token@@` | `@@id@@`, `@@label@@` | Double-at delimiters. Recommended for URLs to avoid confusion with path segments. |
     * | `:token` | `:id`, `:value` | Colon prefix (like Express routes). Unrecognised tokens are left as-is. |
     *
     * **Available tokens:** `id`, `value`, `label`, `query`, `type`, `userId`, `tagId`
     * (matching the fields on {@link RichTextEntityRenderContext}).
     *
     * @example
     * ```ts
     * // Mention profile link
     * urlTemplate: '/users/@@userId@@'
     *
     * // Tag page using colon syntax
     * urlTemplate: '/tags/:value'
     *
     * // External URL with label
     * urlTemplate: 'https://example.com/profiles/@@id@@'
     * ```
     */
    urlTemplate?: string;

    /**
     * A text pattern with placeholder tokens for the display text of the entity.
     * Uses the same token syntax as {@link urlTemplate} (`@@token@@` or `:token`).
     *
     * If omitted, the default display text is `trigger + label` (e.g. `"@Jane Doe"`).
     *
     * @example
     * ```ts
     * // Show just the label without the trigger
     * textTemplate: '@@label@@'
     *
     * // Custom format
     * textTemplate: '[@@label@@]'
     * ```
     */
    textTemplate?: string;

    /**
     * CSS class(es) applied to the rendered element.
     *
     * - For `'chip'` mode, overrides the default `bg-accent text-accent-foreground rounded px-1`.
     * - For `'link'` mode, overrides the default `bg-accent/20 text-primary rounded px-1 underline underline-offset-2`.
     * - For `'text'` mode, no default classes — only your custom classes are applied.
     */
    className?: string;

    /**
     * The `target` attribute for the `<a>` element. Only applies when `mode` is `'link'`.
     *
     * @default '_blank'
     */
    target?: string;

    /**
     * The `rel` attribute for the `<a>` element. Only applies when `mode` is `'link'`.
     *
     * @default 'noopener noreferrer'
     */
    rel?: string;

    /**
     * A callback that builds the URL dynamically. Takes priority over `urlTemplate`.
     * Only used when `mode` is `'link'`. If this returns an empty string, the entity
     * falls back to `'chip'` rendering.
     *
     * @param context - Full entity context with id, value, label, and the original item.
     * @returns The URL string. Will be sanitised before being set as `href`.
     *
     * @example
     * ```ts
     * buildUrl: (ctx) => ctx.item.id
     *   ? `/api/users/${ctx.item.id}`
     *   : `/search?q=${encodeURIComponent(ctx.value)}`
     * ```
     */
    buildUrl?: (context: RichTextEntityRenderContext) => string;

    /**
     * A callback that builds the display text dynamically. Takes priority over `textTemplate`.
     *
     * @param context - Full entity context.
     * @returns The text to display inside the rendered element.
     *
     * @example
     * ```ts
     * buildText: (ctx) => `${ctx.trigger}${ctx.label} (${ctx.item.description ?? ''})`
     * ```
     */
    buildText?: (context: RichTextEntityRenderContext) => string;
}

/**
 * Event payload emitted via `(mentionInsert)` or `(tagInsert)` when the user
 * selects an entity from the popover and it is inserted into the editor.
 *
 * Use this to react to insertions — for example, to notify a backend that a
 * user was mentioned, or to track which tags are referenced.
 *
 * @example
 * ```html
 * <ui-rich-text-editor
 *   [mentions]="true"
 *   [mentionSearch]="searchUsers"
 *   (mentionInsert)="onMention($event)"
 * />
 * ```
 * ```ts
 * onMention(event: RichTextEntityInsertEvent) {
 *   console.log(`Mentioned ${event.label} (id: ${event.id})`);
 *   this.notificationService.notifyUser(event.id);
 * }
 * ```
 */
export interface RichTextEntityInsertEvent {
    /** Whether this is a `'mention'` or `'tag'`. */
    type: RichTextEntityType;

    /** The trigger character: `'@'` for mentions, `'#'` for tags. */
    trigger: '@' | '#';

    /** Unique identifier (from `item.id ?? item.value`). */
    id: string;

    /** The raw `value` field from the selected item. */
    value: string;

    /** The human-readable display name from the selected item. */
    label: string;

    /** The search text the user had typed when they made the selection. */
    query: string;

    /** The resolved URL if `mode` was `'link'` and a URL could be built, otherwise `undefined`. */
    url?: string;

    /** The raw HTML that was inserted into the editor's content. */
    html: string;

    /** The full selected item, giving access to all original fields (avatar, color, etc.). */
    item: MentionItem | TagItem;
}

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
    'fontColor', 'backgroundColor', 'fontSize',
    'separator',
    'link', 'image', 'importFile', 'emoji',
    'separator',
    'table',
    'separator',
    'code', 'codeBlock',
    'separator',
    'horizontalRule',
    'separator',
    'clear',
];

/**
 * Creates the built-in slash commands (paragraph, headings, lists, quote, code, link, undo, redo)
 * using the provided locale strings. Called internally — you normally don't need this directly.
 */
export function buildDefaultSlashCommands(l: RichTextLocale['slashCommands']): RichTextSlashCommand[] {
    return [
        {
            id: 'format.paragraph',
            label: l.paragraph,
            description: l.paragraphDescription,
            keywords: ['text', 'normal'],
            order: 10,
            run: context => context.executeToolbarCommand('paragraph'),
        },
        {
            id: 'format.heading-1',
            label: l.heading1,
            description: l.heading1Description,
            keywords: ['h1', 'title'],
            order: 20,
            run: context => context.executeToolbarCommand('heading1'),
        },
        {
            id: 'format.heading-2',
            label: l.heading2,
            description: l.heading2Description,
            keywords: ['h2', 'subtitle'],
            order: 30,
            run: context => context.executeToolbarCommand('heading2'),
        },
        {
            id: 'format.heading-3',
            label: l.heading3,
            description: l.heading3Description,
            keywords: ['h3'],
            order: 40,
            run: context => context.executeToolbarCommand('heading3'),
        },
        {
            id: 'format.bullet-list',
            label: l.bulletList,
            description: l.bulletListDescription,
            keywords: ['list', 'ul', 'bl'],
            order: 50,
            run: context => context.executeToolbarCommand('bulletList'),
        },
        {
            id: 'format.numbered-list',
            label: l.numberedList,
            description: l.numberedListDescription,
            keywords: ['list', 'ol', 'nl'],
            order: 60,
            run: context => context.executeToolbarCommand('orderedList'),
        },
        {
            id: 'format.quote',
            label: l.blockQuote,
            description: l.blockQuoteDescription,
            keywords: ['blockquote', 'quote'],
            order: 70,
            run: context => context.executeToolbarCommand('blockquote'),
        },
        {
            id: 'format.inline-code',
            label: l.inlineCode,
            description: l.inlineCodeDescription,
            keywords: ['code'],
            order: 80,
            run: context => context.executeToolbarCommand('code'),
        },
        {
            id: 'format.code-block',
            label: l.codeBlock,
            description: l.codeBlockDescription,
            keywords: ['pre', 'snippet'],
            order: 90,
            run: context => context.executeToolbarCommand('codeBlock'),
        },
        {
            id: 'insert.link',
            label: l.link,
            description: l.linkDescription,
            keywords: ['url', 'anchor'],
            order: 100,
            run: context => context.showLinkDialog(),
        },
        {
            id: 'history.undo',
            label: l.undo,
            description: l.undoDescription,
            keywords: ['ctrl+z', 'revert'],
            order: 110,
            run: context => context.executeToolbarCommand('undo'),
        },
        {
            id: 'history.redo',
            label: l.redo,
            description: l.redoDescription,
            keywords: ['ctrl+y', 'ctrl+shift+z'],
            order: 120,
            run: context => context.executeToolbarCommand('redo'),
        },
        {
            id: 'insert.task-list',
            label: l.taskList,
            description: l.taskListDescription,
            keywords: ['checkbox', 'todo', 'task', 'checklist'],
            order: 65,
            run: context => context.executeToolbarCommand('taskList'),
        },
        {
            id: 'insert.toggle',
            label: l.toggle,
            description: l.toggleDescription,
            keywords: ['details', 'summary', 'collapse', 'expand', 'accordion'],
            order: 75,
            run: context => context.executeToolbarCommand('toggle'),
        },
        {
            id: 'insert.horizontal-rule',
            label: l.horizontalRule,
            description: l.horizontalRuleDescription,
            keywords: ['hr', 'divider', 'line', 'separator'],
            order: 95,
            run: context => context.executeToolbarCommand('horizontalRule'),
        },
    ];
}

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
        DatePipe,
        RichTextToolbarComponent,
        RichTextMentionPopoverComponent,
        RichTextImageResizerComponent,
        ButtonComponent,
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
        DialogComponent,
        DialogContentComponent,
        DialogHeaderComponent,
        DialogTitleComponent,
        DialogDescriptionComponent,
        DialogFooterComponent,
        ScrollAreaComponent,
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
        [currentFontSize]="currentFontSize()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [locale]="resolvedLocale()"
        (formatCommand)="onFormatCommand($event)"
        (linkInsert)="onLinkInsert($event)"
        (imageInsert)="onImageInsert($event)"
        (emojiInsert)="onEmojiInsert($event)"
        (colorSelect)="onColorSelect($event)"
        (fontSizeSelect)="onFontSizeSelect($event)"
        (tableInsert)="onTableInsert($event)"
        (fileImport)="onFileImport($event)"
        [customItems]="customToolbarItems()"
        (customItemClick)="onCustomToolbarAction($event)"
      />
    }

    <div [class]="editorContainerClasses()" [dir]="isRtl() ? 'rtl' : 'ltr'">
      @if (showHistoryPanel() && !readonly() && showHistoryButton()) {
        <div #historyShortcutAnchor class="absolute top-2 z-30 ltr:right-2 rtl:left-2">
          <ui-popover
            [open]="historyPanelOpen()"
            (openChange)="onHistoryPanelOpenChange($event)"
          >
            <ui-popover-trigger>
              <ui-button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 px-2.5 text-xs"
                [disabled]="disabled()"
                [attr.title]="'Ctrl/Cmd + Shift + H'"
                [attr.aria-label]="resolvedLocale().history.ariaOpen"
              >
                {{ interpolateLocale(resolvedLocale().history.button, { count: historyCount() }) }}
              </ui-button>
            </ui-popover-trigger>
            <ui-popover-content class="w-80 max-sm:w-[calc(100vw-2rem)] p-0" align="end" side="bottom" [restoreFocus]="false">
              <div class="flex items-center justify-between border-b px-3 py-2">
                <div class="text-sm font-medium">{{ resolvedLocale().history.title }}</div>
                <ui-button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0"
                  (click)="historyPanelOpen.set(false)"
                  [attr.aria-label]="resolvedLocale().history.ariaClose"
                >
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span class="sr-only">{{ resolvedLocale().history.close }}</span>
                </ui-button>
              </div>
              <ui-scroll-area [class]="'h-72 p-2'">
                <div class="space-y-1 pr-2" data-history-list="popover">
                  @for (entry of historyTimelineEntries(); track entry.index) {
                    <div
                      role="button"
                      tabindex="0"
                      class="w-full rounded-md border px-2 py-2 text-left transition-colors hover:bg-accent/60"
                      [class.bg-accent]="entry.active"
                      [class.border-primary/40]="entry.active"
                      [class.border-border]="!entry.active"
                      [attr.data-history-entry-action]="'true'"
                      [attr.data-history-entry-index]="entry.index"
                      [attr.aria-label]="interpolateLocale(resolvedLocale().history.ariaApply, { index: entry.index + 1 })"
                      (click)="onQuickApplyFromHistory(entry.index, $event)"
                      (keydown)="onHistoryEntryKeydown($event, entry.index)"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium">{{ interpolateLocale(resolvedLocale().history.revision, { index: entry.index + 1 }) }}</span>
                        <div class="flex items-center gap-2">
                          @if (lastAppliedHistoryIndex() === entry.index) {
                            <span class="text-[11px] text-primary/90 font-medium">{{ resolvedLocale().history.applied }}</span>
                          }
                          <span class="text-[11px] text-muted-foreground">{{ entry.timestamp | date:'HH:mm:ss' }}</span>
                          <ui-button
                            type="button"
                            variant="ghost"
                            size="sm"
                            class="h-6 px-2 text-[11px]"
                            (click)="openHistoryPreview(entry.index, $event)"
                          >
                            {{ resolvedLocale().history.preview }}
                          </ui-button>
                        </div>
                      </div>
                      <div class="mt-1 space-y-0.5">
                        @for (line of entry.previewLines; track $index) {
                          <p class="text-xs text-muted-foreground leading-4 truncate">{{ line }}</p>
                        }
                        @if (entry.lineCount > entry.previewLines.length) {
                          <p class="text-[11px] text-muted-foreground/80">{{ interpolateLocale(resolvedLocale().history.moreLines, { count: entry.lineCount - entry.previewLines.length }) }}</p>
                        }
                      </div>
                    </div>
                  }
                </div>
              </ui-scroll-area>
            </ui-popover-content>
          </ui-popover>
        </div>
      }

      <ui-dialog [(open)]="historyPreviewOpen">
        <ui-dialog-content class="max-w-3xl p-0 overflow-hidden">
          @if (selectedHistoryEntry(); as selected) {
            <ui-dialog-header class="px-5 pt-5 pb-3 border-b">
              <ui-dialog-title>{{ interpolateLocale(resolvedLocale().history.revision, { index: selected.index + 1 }) }}</ui-dialog-title>
              <ui-dialog-description>
                {{ interpolateLocale(resolvedLocale().history.capturedAt, { time: (selected.timestamp | date:'MMM d, y, HH:mm:ss') ?? '' }) }}
              </ui-dialog-description>
            </ui-dialog-header>

            <ui-scroll-area [class]="'h-[70vh] px-5 py-4'">
              <div class="space-y-4 pr-3">
                <div class="rounded-md border bg-muted/20">
                  <div class="px-3 py-2 border-b text-xs font-medium text-muted-foreground">{{ resolvedLocale().history.renderedPreview }}</div>
                  <div class="p-3 prose prose-sm dark:prose-invert max-w-none [&_*]:break-words" [innerHTML]="selected.html"></div>
                </div>

                <div class="rounded-md border">
                  <div class="px-3 py-2 border-b text-xs font-medium text-muted-foreground">{{ resolvedLocale().history.markdownSnapshot }}</div>
                  <pre class="p-3 text-xs whitespace-pre-wrap break-words">{{ selectedHistoryEntryMarkdown() }}</pre>
                </div>
              </div>
            </ui-scroll-area>

            <ui-dialog-footer class="px-5 py-4 border-t">
              <ui-button variant="outline" (click)="historyPreviewOpen.set(false)">{{ resolvedLocale().history.cancel }}</ui-button>
              <ui-button (click)="restoreFromHistoryPreview()">{{ resolvedLocale().history.restore }}</ui-button>
            </ui-dialog-footer>
          }
        </ui-dialog-content>
      </ui-dialog>

      <ui-dialog [(open)]="historyBrowserOpen">
        <ui-dialog-content class="max-w-xl p-0 overflow-hidden">
          <ui-dialog-header class="px-5 pt-5 pb-3 border-b">
            <ui-dialog-title>{{ resolvedLocale().history.title }}</ui-dialog-title>
            <ui-dialog-description>{{ resolvedLocale().history.browserDescription }}</ui-dialog-description>
          </ui-dialog-header>
          <ui-scroll-area [class]="'h-[60vh] px-4 py-3'">
            <div class="space-y-2 pr-2" data-history-list="dialog">
              @for (entry of historyTimelineEntries(); track entry.index) {
                <div
                  role="button"
                  tabindex="0"
                  class="w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent/60"
                  [class.bg-accent]="entry.active"
                  [class.border-primary/40]="entry.active"
                  [class.border-border]="!entry.active"
                  [attr.data-history-entry-action]="'true'"
                  [attr.data-history-entry-index]="entry.index"
                  [attr.aria-label]="interpolateLocale(resolvedLocale().history.ariaApply, { index: entry.index + 1 })"
                  (click)="onQuickApplyFromHistory(entry.index, $event)"
                  (keydown)="onHistoryEntryKeydown($event, entry.index)"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-medium">{{ interpolateLocale(resolvedLocale().history.revision, { index: entry.index + 1 }) }}</span>
                    <div class="flex items-center gap-2">
                      @if (lastAppliedHistoryIndex() === entry.index) {
                        <span class="text-[11px] text-primary/90 font-medium">{{ resolvedLocale().history.applied }}</span>
                      }
                      <span class="text-[11px] text-muted-foreground">{{ entry.timestamp | date:'HH:mm:ss' }}</span>
                      <ui-button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-6 px-2 text-[11px]"
                        (click)="openHistoryPreview(entry.index, $event)"
                      >
                        Preview
                      </ui-button>
                    </div>
                  </div>
                  <div class="mt-1 space-y-0.5">
                    @for (line of entry.previewLines; track $index) {
                      <p class="text-xs text-muted-foreground leading-4 truncate">{{ line }}</p>
                    }
                    @if (entry.lineCount > entry.previewLines.length) {
                      <p class="text-[11px] text-muted-foreground/80">{{ interpolateLocale(resolvedLocale().history.moreLines, { count: entry.lineCount - entry.previewLines.length }) }}</p>
                    }
                  </div>
                </div>
              }
            </div>
          </ui-scroll-area>
          <ui-dialog-footer class="px-5 py-4 border-t">
            <ui-button variant="outline" (click)="historyBrowserOpen.set(false)">{{ resolvedLocale().history.close }}</ui-button>
          </ui-dialog-footer>
        </ui-dialog-content>
      </ui-dialog>

      <div
        #editorDiv
        [attr.contenteditable]="!disabled() && !readonly()"
        [class]="editableClasses()"
        [attr.placeholder]="placeholder() || resolvedLocale().editor.placeholder"
        [attr.aria-label]="ariaLabel() || resolvedLocale().editor.ariaLabel"
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
        (mousemove)="onEditorMouseMove($event)"
        (mousedown)="onEditorMouseDown($event)"
        (contextmenu)="onEditorContextMenu($event)"
        (dragover)="onEditorDragOver($event)"
        (dragleave)="onEditorDragLeave($event)"
        (drop)="onEditorDrop($event)"
      ></div>

      @if (findReplaceVisible()) {
        <div class="absolute top-2 right-2 z-50 bg-popover border rounded-lg shadow-lg p-3 w-80 max-sm:w-[calc(100%-1rem)] max-sm:left-2 animate-in slide-in-from-top-2 fade-in-0"
             (keydown.escape)="closeFindReplace()"
             (keydown)="onFindReplaceKeydown($event)">
          <div class="flex items-center gap-1.5 mb-2">
            <input
              #findInput
              type="text"
              [placeholder]="resolvedLocale().findReplace.findPlaceholder"
              [value]="findQuery()"
              (input)="onFindQueryChange($any($event.target).value)"
              class="flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button type="button"
                    class="inline-flex items-center justify-center rounded-md p-1 text-xs font-medium transition-colors hover:bg-accent"
                    [class.bg-accent]="findCaseSensitive()"
                    [title]="resolvedLocale().findReplace.caseSensitive"
                    (click)="toggleFindCaseSensitive()">Aa</button>
          </div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-muted-foreground">
              {{ findMatches().length > 0 ? (findCurrentIndex() + 1) + '/' + findMatches().length : '0/0' }}
            </span>
            <div class="flex gap-1">
              <button type="button" class="inline-flex items-center justify-center rounded-md p-1 text-xs hover:bg-accent disabled:opacity-50" [disabled]="findMatches().length === 0" (click)="findPrevious()">&#x25B2;</button>
              <button type="button" class="inline-flex items-center justify-center rounded-md p-1 text-xs hover:bg-accent disabled:opacity-50" [disabled]="findMatches().length === 0" (click)="findNext()">&#x25BC;</button>
              <button type="button" class="inline-flex items-center justify-center rounded-md p-1 text-xs hover:bg-accent" (click)="closeFindReplace()">&#x2715;</button>
            </div>
          </div>
          @if (findShowReplace()) {
            <div class="flex items-center gap-1.5">
              <input
                type="text"
                [placeholder]="resolvedLocale().findReplace.replacePlaceholder"
                [value]="replaceText()"
                (input)="replaceText.set($any($event.target).value)"
                class="flex h-7 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <button type="button" class="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs hover:bg-accent whitespace-nowrap disabled:opacity-50" [disabled]="findMatches().length === 0" (click)="replaceSingle()">{{ resolvedLocale().findReplace.replace }}</button>
              <button type="button" class="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs hover:bg-accent whitespace-nowrap disabled:opacity-50" [disabled]="findMatches().length === 0" (click)="replaceAll()">{{ resolvedLocale().findReplace.replaceAll }}</button>
            </div>
          }
        </div>
      }

      @if (dragOver()) {
        <div class="absolute inset-0 pointer-events-none border-2 border-dashed border-primary/60 rounded-md bg-primary/5"></div>
      }

      @if (imageUploading()) {
        <div class="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div class="text-sm text-muted-foreground">{{ resolvedLocale().editor.uploadingImage }}</div>
        </div>
      }

      @if (fileImporting()) {
        <div class="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div class="text-sm text-muted-foreground">{{ resolvedLocale().editor.importingFile }}</div>
        </div>
      }

      @if (fileImportErrorMessage()) {
        <div class="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div class="text-sm text-destructive font-medium">{{ fileImportErrorMessage() }}</div>
        </div>
      }

      @for (entry of autoUploadErrorList(); track entry.id) {
        <div
          class="absolute z-20 flex flex-col items-center justify-center gap-1.5 rounded bg-destructive/10 border border-destructive/30 backdrop-blur-[1px]"
          [style.top.px]="entry.top"
          [style.left.px]="entry.left"
          [style.width.px]="entry.width"
          [style.height.px]="entry.height"
          contenteditable="false"
        >
          <svg class="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span class="text-xs text-destructive font-medium">{{ resolvedLocale().editor.autoUploadFailed }}</span>
          <div class="flex gap-1">
            <button
              type="button"
              class="text-xs px-2 py-0.5 rounded bg-background border border-border text-foreground hover:bg-accent transition-colors"
              (click)="retryAutoUpload(entry.id)"
            >
              {{ resolvedLocale().editor.autoUploadRetry }}
            </button>
            <button
              type="button"
              class="text-xs px-2 py-0.5 rounded bg-background border border-border text-foreground hover:bg-accent transition-colors"
              (click)="removeAutoUploadImage(entry.id)"
            >
              {{ resolvedLocale().editor.autoUploadRemove }}
            </button>
          </div>
        </div>
      }

      <ui-rich-text-image-resizer
          [target]="selectedImage()"
          [container]="editorDiv"
          [locale]="resolvedLocale()"
          (resizeEnd)="onImageResizeEnd()"
          (alignmentChange)="onImageAlignmentChange()"
          (imageRemove)="onImageRemove($event)"
      />


      @if (toolbar() === 'floating' && !readonly() && showFloatingToolbar()) {
        <div 
          class="fixed z-[9999] bg-popover border rounded-lg shadow-lg p-1"
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
            [locale]="resolvedLocale()"
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
          [locale]="resolvedLocale()"
          (itemSelect)="onMentionSelect($event)"
          (close)="closeMentionPopover()"
        />
      }

      @if (slashCommandOpen()) {
        <div
          class="absolute z-50 w-72 max-sm:w-[calc(100%-1rem)] rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          [style.left.px]="slashCommandPosition().x"
          [style.top.px]="slashCommandPosition().y"
          role="listbox"
          [attr.aria-label]="resolvedLocale().editor.slashCommandMenu"
        >
          @if (filteredSlashCommands().length === 0) {
            <div class="px-3 py-2 text-sm text-muted-foreground">{{ resolvedLocale().slashCommands.noResults }}</div>
          } @else {
            <div #slashCommandList class="max-h-56 overflow-y-auto p-1">
              @for (command of filteredSlashCommands(); track command.id; let i = $index) {
                <button
                  type="button"
                  class="w-full rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  [class.bg-accent]="i === slashCommandSelectedIndex()"
                  [class.text-accent-foreground]="i === slashCommandSelectedIndex()"
                  [attr.aria-selected]="i === slashCommandSelectedIndex()"
                  [attr.data-slash-index]="i"
                  role="option"
                  (mousedown)="$event.preventDefault()"
                  (mouseenter)="slashCommandSelectedIndex.set(i)"
                  (click)="onSlashCommandSelect(command)"
                >
                  <div class="text-sm font-medium">{{ command.label }}</div>
                  @if (command.description) {
                    <div class="text-xs text-muted-foreground">{{ command.description }}</div>
                  }
                </button>
              }
            </div>
          }
        </div>
      }

      @if (showLinkPopover()) {
        <div 
          class="fixed z-50 bg-popover border rounded-lg shadow-lg p-4 w-80 max-sm:w-[calc(100vw-2rem)] max-sm:max-w-80"
          [style.left.px]="linkPopoverPosition().x"
          [style.top.px]="linkPopoverPosition().y"
        >
          <div class="space-y-3">
            <div>
              <label class="text-sm font-medium mb-1 block">{{ resolvedLocale().link.text }}</label>
              <input
                #linkText
                type="text"
                [value]="selectedText()"
                [placeholder]="resolvedLocale().link.textPlaceholder"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label class="text-sm font-medium mb-1 block">{{ resolvedLocale().link.url }}</label>
              <input
                #linkUrl
                type="url"
                [placeholder]="resolvedLocale().link.urlPlaceholder"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div class="flex gap-2">
              <ui-button 
                size="sm" 
                class="flex-1"
                (click)="insertLinkFromPopover(linkText.value, linkUrl.value)"
              >
                {{ resolvedLocale().link.insert }}
              </ui-button>
              <ui-button
                variant="outline"
                size="sm"
                (click)="closeLinkPopover()"
              >
                {{ resolvedLocale().link.cancel }}
              </ui-button>
            </div>
          </div>
        </div>
      }

      @if (tableContextMenuOpen()) {
        <div
          #tableContextMenuRef
          class="fixed z-50 min-w-[180px] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          [style.left.px]="tableContextMenuPosition().x"
          [style.top.px]="tableContextMenuPosition().y"
          (mousedown)="$event.preventDefault()"
          (contextmenu)="onContextMenuOverlayContextMenu($event)"
        >
          <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" (click)="addTableRowAbove()">
            {{ resolvedLocale().table.addRowAbove }}
          </button>
          <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" (click)="addTableRowBelow()">
            {{ resolvedLocale().table.addRowBelow }}
          </button>
          <div class="my-1 h-px bg-border"></div>
          <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" (click)="addTableColumnLeft()">
            {{ resolvedLocale().table.addColumnLeft }}
          </button>
          <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" (click)="addTableColumnRight()">
            {{ resolvedLocale().table.addColumnRight }}
          </button>
          <div class="my-1 h-px bg-border"></div>
          <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" (click)="toggleTableHeaderRow()">
            {{ resolvedLocale().table.toggleHeaderRow }}
          </button>
          <div class="my-1 h-px bg-border"></div>
          @if (tableCellSelected().length >= 2) {
            <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" (click)="mergeCells()">
              {{ resolvedLocale().table.mergeCells }}
            </button>
          }
          @if (canSplitCell()) {
            <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" (click)="splitCell()">
              {{ resolvedLocale().table.splitCell }}
            </button>
          }
          @if (tableCellSelected().length >= 2 || canSplitCell()) {
            <div class="my-1 h-px bg-border"></div>
          }
          <div class="px-2 py-1.5">
            <div class="text-xs text-muted-foreground mb-1.5">{{ resolvedLocale().table.borders }}</div>
            <div class="flex items-center gap-1">
              <button type="button" class="flex items-center justify-center w-7 h-7 rounded border border-transparent hover:border-border hover:bg-accent" [title]="resolvedLocale().table.bordersAll" (click)="setTableBorders('all')">
                <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="1" y="1" width="18" height="18" /><line x1="10" y1="1" x2="10" y2="19" /><line x1="1" y1="10" x2="19" y2="10" />
                </svg>
              </button>
              <button type="button" class="flex items-center justify-center w-7 h-7 rounded border border-transparent hover:border-border hover:bg-accent" [title]="resolvedLocale().table.bordersNone" (click)="setTableBorders('none')">
                <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35">
                  <rect x="1" y="1" width="18" height="18" stroke-dasharray="2 2" /><line x1="10" y1="1" x2="10" y2="19" stroke-dasharray="2 2" /><line x1="1" y1="10" x2="19" y2="10" stroke-dasharray="2 2" />
                </svg>
              </button>
              <button type="button" class="flex items-center justify-center w-7 h-7 rounded border border-transparent hover:border-border hover:bg-accent" [title]="resolvedLocale().table.bordersOuter" (click)="setTableBorders('outer')">
                <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor">
                  <rect x="1" y="1" width="18" height="18" stroke-width="1.5" /><line x1="10" y1="1" x2="10" y2="19" stroke-width="1" opacity="0.25" stroke-dasharray="2 2" /><line x1="1" y1="10" x2="19" y2="10" stroke-width="1" opacity="0.25" stroke-dasharray="2 2" />
                </svg>
              </button>
              <button type="button" class="flex items-center justify-center w-7 h-7 rounded border border-transparent hover:border-border hover:bg-accent" [title]="resolvedLocale().table.bordersHorizontal" (click)="setTableBorders('horizontal')">
                <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor">
                  <line x1="1" y1="1" x2="19" y2="1" stroke-width="1.5" /><line x1="1" y1="10" x2="19" y2="10" stroke-width="1.5" /><line x1="1" y1="19" x2="19" y2="19" stroke-width="1.5" />
                </svg>
              </button>
            </div>
          </div>
          <div class="my-1 h-px bg-border"></div>
          <div class="px-2 py-1.5">
            <div class="text-xs text-muted-foreground mb-1.5">{{ resolvedLocale().table.cellAlignLeft }}</div>
            <div class="flex items-center gap-1" dir="ltr">
              <button type="button" class="flex items-center justify-center w-7 h-7 rounded border border-transparent hover:border-border hover:bg-accent" [title]="resolvedLocale().table.cellAlignLeft" (click)="setCellAlignment('left')">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>
              </button>
              <button type="button" class="flex items-center justify-center w-7 h-7 rounded border border-transparent hover:border-border hover:bg-accent" [title]="resolvedLocale().table.cellAlignCenter" (click)="setCellAlignment('center')">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>
              </button>
              <button type="button" class="flex items-center justify-center w-7 h-7 rounded border border-transparent hover:border-border hover:bg-accent" [title]="resolvedLocale().table.cellAlignRight" (click)="setCellAlignment('right')">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="px-2 py-1.5">
            <div class="text-xs text-muted-foreground mb-1.5">{{ resolvedLocale().table.cellColor }}</div>
            <div class="grid grid-cols-8 gap-0.5">
              @for (color of tableCellColors; track color) {
                <button type="button" class="w-4 h-4 rounded border border-border hover:scale-110 transition-transform" [style.background-color]="color" (click)="setCellColor(color)"></button>
              }
            </div>
          </div>
          <div class="my-1 h-px bg-border"></div>
          <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-destructive" (click)="deleteTableRow()">
            {{ resolvedLocale().table.deleteRow }}
          </button>
          <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-destructive" (click)="deleteTableColumn()">
            {{ resolvedLocale().table.deleteColumn }}
          </button>
          <button type="button" class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-destructive" (click)="deleteTable()">
            {{ resolvedLocale().table.deleteTable }}
          </button>
        </div>
      }
    </div>

    @if (showCount() || showWordCount()) {
      <div class="flex justify-end text-xs text-muted-foreground mt-1 px-1">
        @if (showCount()) {
          <span>{{ interpolateLocale(resolvedLocale().editor.characters, { count: characterCount() }) }}</span>
        }
        @if (showWordCount()) {
          <span [class.ml-3]="showCount()">{{ interpolateLocale(resolvedLocale().editor.words, { count: wordCount() }) }}</span>
        }
      </div>
    }
  `,
    host: {
        class: 'block',
    },
})
export class RichTextEditorComponent implements ControlValueAccessor, OnInit, AfterViewInit, OnDestroy {
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly markdownService = inject(RichTextMarkdownService);
    private readonly pasteNormalizer = inject(RichTextPasteNormalizerService);
    private readonly document = inject(DOCUMENT);
    private readonly el = inject(ElementRef);
    private readonly shortcutBindings = inject(ShortcutBindingService);
    private readonly commandRegistry = inject(RichTextCommandRegistry);

    @ViewChild('editorDiv') editorDiv?: ElementRef<HTMLDivElement>;
    @ViewChild('slashCommandList') slashCommandList?: ElementRef<HTMLDivElement>;
    @ViewChild('tableContextMenuRef') tableContextMenuRef?: ElementRef<HTMLDivElement>;
    @ViewChild(RichTextMentionPopoverComponent) mentionPopover?: RichTextMentionPopoverComponent;

    // ── Content & mode ────────────────────────────────────────────

    /** Output format: `'markdown'` converts to/from Markdown; `'html'` works with raw HTML. */
    mode = input<EditorMode>('markdown');

    // ── Appearance ──────────────────────────────────────────────

    /** Visual border/focus style. See {@link EditorVariant}. */
    variant = input<EditorVariant>('default');

    /** Text size preset for the editor content. See {@link EditorSize}. */
    size = input<EditorSize>('default');

    // ── Toolbar ─────────────────────────────────────────────────

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

    // ── Editor content area ─────────────────────────────────────

    /** Placeholder text shown when the editor is empty. Falls back to the locale default. */
    placeholder = input<string>('');

    /** CSS `min-height` for the editable area. Accepts any CSS length value. */
    minHeight = input<string>('120px');

    /** CSS `max-height` for the editable area (scrolls beyond this). Accepts any CSS length value. */
    maxHeight = input<string>('400px');

    /** Disables the editor entirely — no input, no toolbar, no interactions. */
    disabled = input<boolean>(false);

    /** Makes the editor non-editable but still selectable/copyable. Hides the toolbar. */
    readonly = input<boolean>(false);

    // ── Mentions (@) ────────────────────────────────────────────

    /** Enable the `@mention` feature. When `true`, typing `@` opens a search popover. */
    mentions = input<boolean>(false);

    /**
     * Search function called when the user types after `@`. Must return matching
     * {@link MentionItem}s as an array, Promise, or Observable.
     * @see {@link RichTextEntitySearchFn} for the full type and examples.
     */
    mentionSearch = input<RichTextEntitySearchFn<MentionItem>>(() => []);

    /**
     * Controls how selected mentions are rendered in the editor content.
     * @see {@link RichTextEntityRenderOptions} for all options, token syntax, and examples.
     */
    mentionRender = input<RichTextEntityRenderOptions>({ mode: 'chip' });

    // ── Tags (#) ────────────────────────────────────────────────

    /** Enable the `#tag` feature. When `true`, typing `#` opens a search popover. */
    tags = input<boolean>(false);

    /**
     * Search function called when the user types after `#`. Must return matching
     * {@link TagItem}s as an array, Promise, or Observable.
     * @see {@link RichTextEntitySearchFn} for the full type and examples.
     */
    tagSearch = input<RichTextEntitySearchFn<TagItem>>(() => []);

    /**
     * Controls how selected tags are rendered in the editor content.
     * @see {@link RichTextEntityRenderOptions} for all options, token syntax, and examples.
     */
    tagRender = input<RichTextEntityRenderOptions>({ mode: 'chip' });

    // ── Media & emoji ───────────────────────────────────────────

    /** Show the emoji picker button in the toolbar. */
    emojiPicker = input<boolean>(true);

    /** Enable image insertion (toolbar button, paste, drag-and-drop). */
    images = input<boolean>(true);

    /**
     * Custom upload handler for images. Receives the `File` and must return an
     * `Observable<string>` that emits the final image URL. If `undefined`, images
     * are inserted as base64 data URIs.
     *
     * @example
     * ```ts
     * imageUploader = (file: File) =>
     *   this.http.post<{ url: string }>('/api/upload', formData)
     *     .pipe(map(res => res.url));
     * ```
     */
    imageUploader = input<((file: File) => Observable<string>) | undefined>(undefined);

    /**
     * Automatically detect and upload base64 images inserted into the editor.
     * When enabled and `imageUploader` is provided, any base64 `data:image/*`
     * source is converted to a `File`, uploaded via the `imageUploader` callback,
     * and replaced with the returned URL. A skeleton shimmer is shown on the
     * image while the upload is in progress.
     */
    autoImageUpload = input<boolean>(false);

    /**
     * Which image source options to show in the image insertion dialog.
     * - `'all'` — Both file upload and URL input.
     * - `'upload'` — File upload only.
     * - `'url'` — URL input only.
     */
    imageSources = input<'all' | 'upload' | 'url'>('all');

    // ── Character & word count ──────────────────────────────────

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

    // ── Revision history ────────────────────────────────────────

    /** Maximum number of history snapshots to retain. Oldest entries are dropped when exceeded. */
    historyLimit = input<number>(100);

    /**
     * Debounce interval in milliseconds for capturing history snapshots.
     * A snapshot is saved after the user stops typing for this duration.
     */
    historyDebounceMs = input<number>(450);

    /** Enable the revision history feature (popover + preview dialog). */
    showHistoryPanel = input<boolean>(false);

    /** Show the "Revisions" button in the top-right corner. Only visible when `showHistoryPanel` is `true`. */
    showHistoryButton = input<boolean>(true);

    // ── Slash commands ──────────────────────────────────────────

    /** Enable the `/slash` command feature. When `true`, typing `/` opens a command menu. */
    enableSlashCommands = input<boolean>(true);

    /**
     * Additional custom slash commands to register alongside the built-in ones.
     * @see {@link RichTextSlashCommand} for the full interface and examples.
     */
    slashCommands = input<RichTextSlashCommand[]>([]);

    // ── Localisation ────────────────────────────────────────────

    /**
     * Language/locale for all editor UI strings. Pass a locale key (e.g. `'en'`)
     * to use a built-in locale, or pass a full {@link RichTextLocale} object for
     * custom translations.
     */
    locale = input<string | RichTextLocale>('en');

    // ── Styling & accessibility ─────────────────────────────────

    /** Additional CSS classes merged onto the editor's root container. */
    class = input<string>('');

    /** Custom `aria-label` for the editable content area. Falls back to the locale default. */
    ariaLabel = input<string | undefined>(undefined);

    /** ID of an element that describes the editor, set as `aria-describedby`. */
    ariaDescribedBy = input<string | undefined>(undefined);

    resolvedLocale = computed<RichTextLocale>(() => {
        const loc = this.locale();
        if (typeof loc === 'string') {
            return RICH_TEXT_LOCALES[loc] ?? RICH_TEXT_LOCALES['en'];
        }
        return loc;
    });

    isRtl = computed(() => !!this.resolvedLocale().rtl);

    localizedSlashCommands = computed(() =>
        buildDefaultSlashCommands(this.resolvedLocale().slashCommands)
    );

    // ── Outputs ──────────────────────────────────────────────────

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

    /** Emits when the editor gains focus. */
    focus = output<void>();

    /** Emits when the editor loses focus. */
    blur = output<void>();

    /** Emits the `File` object when an image upload begins. */
    imageUploadStart = output<File>();

    /** Emits the final image URL string when an image upload completes successfully. */
    imageUploadComplete = output<string>();

    /** Emits an error message string when an image upload fails. */
    imageUploadError = output<string>();

    /** Emits the final URL when a base64 auto-upload completes successfully. */
    autoImageUploadComplete = output<string>();

    /** Emits an error message when a base64 auto-upload fails. */
    autoImageUploadError = output<string>();

    /**
     * Emits when a mention is inserted into the editor.
     * @see {@link RichTextEntityInsertEvent} for the payload shape.
     */
    mentionInsert = output<RichTextEntityInsertEvent>();

    /**
     * Emits when a tag is inserted into the editor.
     * @see {@link RichTextEntityInsertEvent} for the payload shape.
     */
    tagInsert = output<RichTextEntityInsertEvent>();

    fileImportStart = output<File>();
    fileImportComplete = output<string>();
    fileImportError = output<string>();

    private readonly htmlContent = signal<string>('');
    activeFormats = signal<Set<string>>(new Set());
    currentFontSize = signal<string>('');
    showFloatingToolbar = signal<boolean>(false);
    floatingToolbarPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    readonly emptyFormats = new Set<string>();
    mentionPopoverOpen = signal<boolean>(false);
    mentionType = signal<'mention' | 'tag'>('mention');
    mentionQuery = signal<string>('');
    mentionPopoverPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    slashCommandOpen = signal<boolean>(false);
    slashQuery = signal<string>('');
    slashCommandPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    slashCommandSelectedIndex = signal<number>(0);
    private readonly mentionSearchQuery$ = new Subject<{ type: 'mention' | 'tag'; query: string }>();
    loadedMentionItems = signal<(MentionItem | TagItem)[]>([]);
    mentionLoading = signal<boolean>(false);
    selectedImage = signal<HTMLImageElement | null>(null);
    showLinkPopover = signal<boolean>(false);
    linkPopoverPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
    selectedText = signal<string>('');
    dragOver = signal<boolean>(false);
    imageUploading = signal<boolean>(false);
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

    private readonly autoUploadMap = new Map<string, { subscription: Subscription; dataUrl: string }>();
    private autoUploadObserver: MutationObserver | null = null;
    private autoUploadCounter = 0;
    private autoUploadMutating = false;
    autoUploadErrors = signal<Map<string, { dataUrl: string; imgElement: HTMLImageElement }>>(new Map());

    historyPanelOpen = signal<boolean>(false);
    historyPreviewOpen = model<boolean>(false);
    historyBrowserOpen = model<boolean>(false);
    selectedHistoryIndex = signal<number | null>(null);
    lastAppliedHistoryIndex = signal<number | null>(null);
    private readonly historyVersion = signal<number>(0);

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
    private slashAnchorBlock: HTMLElement | null = null;
    private slashTriggerRange: Range | null = null;
    private savedRange: Range | null = null;
    private _pendingLinkPositionHint: { x: number; y: number } | null = null;
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

    interpolateLocale(template: string, values: Record<string, string | number>): string {
        return interpolate(template, values);
    }

    filteredMentionItems = computed(() => {
        return this.loadedMentionItems().slice(0, 10);
    });

    filteredSlashCommands = computed(() => {
        const query = this.slashQuery().trim().toLowerCase();
        const availability: RichTextSlashCommandAvailabilityContext = {
            query: this.slashQuery(),
            disabled: this.disabled(),
            readonly: this.readonly(),
            hasSelection: !!this.selectedText(),
        };
        const merged = new Map<string, RichTextSlashCommand>();
        for (const command of this.localizedSlashCommands()) {
            merged.set(command.id, command);
        }
        for (const command of this.commandRegistry.listCommands()) {
            merged.set(command.id, command);
        }
        for (const command of this.slashCommands()) {
            merged.set(command.id, command);
        }

        const matchesQuery = (command: RichTextSlashCommand): boolean => {
            if (!query) {
                return true;
            }
            const haystack = [
                command.label,
                command.description ?? '',
                ...(command.keywords ?? []),
                ...(command.aliases ?? []),
            ].join(' ').toLowerCase();
            return haystack.includes(query);
        };

        return Array.from(merged.values())
            .filter(command => !command.when || command.when(availability))
            .filter(matchesQuery)
            .sort((a, b) => {
                const byOrder = (a.order ?? 9999) - (b.order ?? 9999);
                if (byOrder !== 0) {
                    return byOrder;
                }
                return a.label.localeCompare(b.label);
            })
            .slice(0, 10);
    });

    historyTimelineEntries = computed(() => {
        this.historyVersion();
        return this.history.map((entry, index) => ({
            index,
            timestamp: entry.timestamp,
            preview: entry.preview,
            previewLines: entry.previewLines,
            lineCount: entry.lineCount,
            active: index === this.historyIndex,
        })).reverse();
    });

    historyCount = computed(() => {
        this.historyVersion();
        return this.history.length;
    });

    selectedHistoryEntry = computed(() => {
        this.historyVersion();
        const index = this.selectedHistoryIndex();
        if (index === null || index < 0 || index >= this.history.length) {
            return null;
        }
        const entry = this.history[index];
        return {
            index,
            html: this.reconstructHtmlCached(index),
            timestamp: entry.timestamp,
            preview: entry.preview,
        };
    });

    selectedHistoryEntryMarkdown = computed(() => {
        const selected = this.selectedHistoryEntry();
        if (!selected) {
            return '';
        }
        return this.markdownService.toMarkdown(selected.html);
    });


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

    onImageResizeEnd(): void {
        this.flushPendingHistoryPush();
        this.syncContentFromEditor();
        this.pushHistory();
    }

    onImageAlignmentChange(): void {
        this.syncContentFromEditor();
        this.pushHistory();
    }

    onImageRemove(img: HTMLImageElement): void {
        img.remove();
        this.selectedImage.set(null);
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
                const searchFn = type === 'mention'
                    ? this.mentionSearch()
                    : this.tagSearch();
                const result = searchFn(query);

                if (isObservable(result)) {
                    return result;
                }

                if (result instanceof Promise) {
                    return from(result);
                }

                return of((result ?? []) as (MentionItem | TagItem)[]);
            }),
            catchError(() => of([] as (MentionItem | TagItem)[])),
            takeUntilDestroyed(),
        ).subscribe(items => {
            this.loadedMentionItems.set(items);
            this.mentionLoading.set(false);
        });

        effect(() => {
            const commands = this.filteredSlashCommands();
            const currentIndex = this.slashCommandSelectedIndex();
            if (commands.length === 0) {
                if (currentIndex !== 0) {
                    this.slashCommandSelectedIndex.set(0);
                }
                return;
            }
            if (currentIndex >= commands.length) {
                this.slashCommandSelectedIndex.set(commands.length - 1);
            }
        });

        effect(() => {
            if (!this.slashCommandOpen()) {
                return;
            }
            const commands = this.filteredSlashCommands();
            const currentIndex = this.slashCommandSelectedIndex();
            if (commands.length === 0 || currentIndex < 0 || currentIndex >= commands.length) {
                return;
            }
            queueMicrotask(() => this.scrollSelectedSlashCommandIntoView());
        });

        effect(() => {
            const visible = this.showFloatingToolbar();
            this.removeFloatingScrollListener();
            if (visible) {
                setTimeout(() => {
                    const handler = () => this.showFloatingToolbar.set(false);
                    globalThis.window.addEventListener('scroll', handler, { capture: true, passive: true });
                    this.floatingScrollCleanup = () => globalThis.window.removeEventListener('scroll', handler, { capture: true });
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

    ngOnInit() {
        this.shortcutHandle = this.shortcutBindings.registerComponent('rich-text-editor', [
            {
                actionId: 'rich-text.bold',
                description: 'Toggle bold',
                defaultShortcut: 'Mod+B',
                category: 'Formatting',
                when: () => !this.disabled() && !this.readonly(),
                handler: () => this.onFormatCommand('bold'),
            },
            {
                actionId: 'rich-text.italic',
                description: 'Toggle italic',
                defaultShortcut: 'Mod+I',
                category: 'Formatting',
                when: () => !this.disabled() && !this.readonly(),
                handler: () => this.onFormatCommand('italic'),
            },
            {
                actionId: 'rich-text.underline',
                description: 'Toggle underline',
                defaultShortcut: 'Mod+U',
                category: 'Formatting',
                when: () => !this.disabled() && !this.readonly(),
                handler: () => this.onFormatCommand('underline'),
            },
            {
                actionId: 'rich-text.link',
                description: 'Insert link',
                defaultShortcut: 'Mod+K',
                category: 'Insert',
                when: () => !this.disabled() && !this.readonly(),
                handler: () => this.showLinkDialog(),
            },
            {
                actionId: 'rich-text.undo',
                description: 'Undo',
                defaultShortcut: 'Mod+Z',
                category: 'History',
                when: () => !this.disabled() && !this.readonly(),
                handler: () => this.undo(),
            },
            {
                actionId: 'rich-text.redo',
                description: 'Redo',
                defaultShortcut: 'Mod+Shift+Z',
                category: 'History',
                when: () => !this.disabled() && !this.readonly(),
                handler: () => this.redo(),
            },
            {
                actionId: 'rich-text.redo.alt',
                description: 'Redo (alternate)',
                defaultShortcut: 'Mod+Y',
                category: 'History',
                when: () => !this.disabled() && !this.readonly(),
                handler: () => this.redo(),
            },
            {
                actionId: 'rich-text.history',
                description: 'Open revision history',
                defaultShortcut: 'Mod+Shift+H',
                category: 'History',
                when: () => !this.disabled() && !this.readonly() && this.showHistoryPanel(),
                handler: () => this.openHistoryFromShortcut(),
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
                when: () => !this.disabled() && !this.readonly(),
                handler: () => this.openFindReplace(true),
            },
        ]);
        this.pushHistory();
    }

    ngAfterViewInit() {
        if (this.editorDiv?.nativeElement) {
            this.editorDiv.nativeElement.innerHTML = this.htmlContent();
            this.enableTaskCheckboxes(this.editorDiv.nativeElement);
            this.setupAutoUploadObserver();
        }
    }

    private setupAutoUploadObserver(): void {
        const editor = this.editorDiv?.nativeElement;
        if (!editor) return;

        this.injectAutoUploadStyles();

        this.autoUploadObserver = new MutationObserver(() => {
            if (this.autoUploadMutating) return;
            this.scanForBase64Images();
        });

        this.autoUploadObserver.observe(editor, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src'],
        });

        this.scanForBase64Images();
    }

    private injectAutoUploadStyles(): void {
        const styleId = 'ui-rte-auto-upload-styles';
        if (this.document.getElementById(styleId)) return;

        const style = this.document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @keyframes ui-auto-upload-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            img[data-auto-upload-status="uploading"] {
                background: linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--muted-foreground) / 0.1) 50%, hsl(var(--muted)) 75%);
                background-size: 200% 100%;
                animation: ui-auto-upload-shimmer 1.5s ease-in-out infinite;
                border-radius: 0.375rem;
            }
            img[data-auto-upload-status="error"] {
                opacity: 0.4;
                border: 2px dashed hsl(var(--destructive));
                border-radius: 0.375rem;
            }
        `;
        this.document.head.appendChild(style);
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

        const textContent = div.textContent ?? '';
        const triggerTextContent = this.buildTriggerAwareText(div.innerHTML);
        const selection = this.document.getSelection();
        const hasSelection = !!selection && selection.rangeCount > 0;
        const caretOffset = hasSelection
            ? this.getCaretOffset(div)
            : triggerTextContent.length;

        const textForSlash = triggerTextContent;
        if (this.checkSlashCommandTrigger(textForSlash, caretOffset)) {
            this.closeMentionPopover();
        } else {
            this.checkMentionTrigger(textContent, caretOffset);
        }

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
        if (this.handleSlashCommandKey(event)) return;
        if (this.handleMentionPopoverKey(event)) return;
        if (this.shortcutHandle?.dispatch(event)) return;

        if (event.key === 'Escape') {
            this.closeMentionPopover();
            this.closeSlashCommandPopover();
            this.showFloatingToolbar.set(false);
        }

        if (event.key === 'Tab' && !this.mentionPopoverOpen() && !this.slashCommandOpen()) {
            this.handleTabKey(event);
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            this.handleEnterKey(event);
        }
    }

    private handleSlashCommandKey(event: KeyboardEvent): boolean {
        if (!this.slashCommandOpen()) return false;
        const slashKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab', ' ', 'Spacebar'];
        if (!slashKeys.includes(event.key)) return false;
        event.preventDefault();
        this.onSlashCommandKeydown(event);
        return true;
    }

    private handleMentionPopoverKey(event: KeyboardEvent): boolean {
        if (!this.mentionPopoverOpen() || !this.mentionPopover) return false;
        const popoverKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
        if (!popoverKeys.includes(event.key)) return false;
        event.preventDefault();
        this.mentionPopover.onKeydown(event);
        return true;
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

        const isAtEnd = range.startOffset >= (range.startContainer.textContent?.length || 0);
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
        const textNode = codeElement || preElement;
        const textContent = textNode.textContent || '';

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
        this.flushPendingHistoryPush();

        if (this.disabled() || this.readonly()) {
            return;
        }

        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain') ?? '';

        const imageFile = Array.from(event.clipboardData?.files ?? []).find(file => file.type.startsWith('image/'));
        if (imageFile && this.images()) {
            const source = this.pasteNormalizer.detectSource(html || null, text);
            if (source !== 'excel') {
                await this.insertImageFile(imageFile);
                return;
            }
        }

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





        const normalized = this.pasteNormalizer.normalize(html || null, text);
        this.insertHtml(normalized);
        this.pushHistory();
    }

    onEditorDragOver(event: DragEvent): void {
        if (!this.images() || (!this.canUseUploadSource() && !this.canUseUrlSource()) || this.disabled() || this.readonly()) {
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
        if (!this.images() || (!this.canUseUploadSource() && !this.canUseUrlSource()) || this.disabled() || this.readonly()) {
            return;
        }

        const imageFile = Array.from(event.dataTransfer?.files ?? []).find(file => file.type.startsWith('image/'));
        if (!imageFile) {
            return;
        }

        event.preventDefault();
        await this.insertImageFile(imageFile);
    }

    onFocus(): void {
        this.focus.emit();
    }

    onBlur(event?: FocusEvent): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }
        this.flushPendingHistoryPush();

        this.onTouched();
        this.blur.emit();
        this.closeSlashCommandPopover();

        if (this.showLinkPopover()) {
            return;
        }

        const relatedTarget = event?.relatedTarget as Node | null;
        if (relatedTarget && this.el.nativeElement.contains(relatedTarget)) {
            return;
        }

        setTimeout(() => {
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

    onHistoryPanelOpenChange(nextOpen: boolean): void {
        if (!nextOpen && this.historyPreviewOpen()) {
            this.historyPanelOpen.set(true);
            return;
        }
        if (nextOpen && (this.disabled() || this.readonly() || !this.showHistoryPanel())) {
            this.historyPanelOpen.set(false);
            return;
        }
        if (nextOpen) {
            this.flushPendingHistoryPush();
            this.focusFirstHistoryActionSoon('popover');
        }
        this.historyPanelOpen.set(nextOpen);
    }

    private openHistoryFromShortcut(): void {
        if (!this.showHistoryPanel() || this.disabled() || this.readonly()) {
            return;
        }
        this.flushPendingHistoryPush();
        if (this.showHistoryButton()) {
            this.onHistoryPanelOpenChange(true);
            return;
        }
        this.historyBrowserOpen.set(true);
        this.focusFirstHistoryActionSoon('dialog');
    }

    openHistoryPreview(entryIndex: number, event?: Event): void {
        event?.stopPropagation();
        if (entryIndex < 0 || entryIndex >= this.history.length) {
            return;
        }
        this.selectedHistoryIndex.set(entryIndex);
        this.historyBrowserOpen.set(false);
        this.historyPreviewOpen.set(true);
    }

    onQuickApplyFromHistory(entryIndex: number, event: Event): void {
        const target = event.currentTarget as HTMLElement | null;
        const listType = target ? this.getHistoryListType(target) : null;
        this.selectHistoryEntry(entryIndex);
        if (listType) {
            this.focusHistoryEntrySoon(listType, entryIndex);
        }
    }

    onHistoryEntryKeydown(event: KeyboardEvent, entryIndex: number): void {
        const current = event.currentTarget as HTMLElement | null;
        if (!current) {
            return;
        }
        const listType = this.getHistoryListType(current);

        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            this.selectHistoryEntry(entryIndex);
            if (listType) {
                this.focusHistoryEntrySoon(listType, entryIndex);
            }
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            if (listType === 'popover') {
                this.historyPanelOpen.set(false);
            } else if (listType === 'dialog') {
                this.historyBrowserOpen.set(false);
            }
            return;
        }

        const entries = this.getHistoryEntryElements(current);
        const currentIndex = entries.indexOf(current);
        if (currentIndex < 0) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            entries[Math.min(entries.length - 1, currentIndex + 1)]?.focus();
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            entries[Math.max(0, currentIndex - 1)]?.focus();
            return;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            entries[0]?.focus();
            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            entries.at(-1)?.focus();
        }
    }

    restoreFromHistoryPreview(): void {
        const index = this.selectedHistoryIndex();
        if (index === null) {
            return;
        }
        this.selectHistoryEntry(index);
        this.historyPreviewOpen.set(false);
    }

    selectHistoryEntry(entryIndex: number): void {
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
        this.lastAppliedHistoryIndex.set(entryIndex);
        this.bumpHistoryVersion();
    }

    onFormatCommand(command: string): void {
        if (this.readonly() || this.disabled()) return;
        this.restoreSelection();
        this.flushPendingHistoryPush();

        const mentionTargets = this.getMentionElementsInSelection();

        switch (command) {
            case 'bold':
                this.execEditorCommand('bold');
                this.toggleMentionStyle(mentionTargets, 'fontWeight', 'bold', 'normal');
                break;
            case 'italic':
                this.execEditorCommand('italic');
                this.toggleMentionStyle(mentionTargets, 'fontStyle', 'italic', 'normal');
                break;
            case 'underline':
                this.execEditorCommand('underline');
                this.toggleMentionTextDecoration(mentionTargets, 'underline');
                break;
            case 'strikethrough':
                this.execEditorCommand('strikeThrough');
                this.toggleMentionTextDecoration(mentionTargets, 'line-through');
                break;
            case 'heading1':
                this.execEditorCommand('formatBlock', '<h1>');
                break;
            case 'heading2':
                this.execEditorCommand('formatBlock', '<h2>');
                break;
            case 'heading3':
                this.execEditorCommand('formatBlock', '<h3>');
                break;
            case 'bulletList':
                this.execEditorCommand('insertUnorderedList');
                break;
            case 'orderedList':
                this.execEditorCommand('insertOrderedList');
                break;
            case 'blockquote':
                this.execEditorCommand('formatBlock', '<blockquote>');
                break;
            case 'code':
                this.wrapSelectionWithTag('code');
                break;
            case 'codeBlock':
                this.insertCodeBlock();
                break;
            case 'horizontalRule':
                this.insertHorizontalRule();
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'clear':
                this.execEditorCommand('removeFormat');
                this.clearMentionStyles(mentionTargets);
                break;
            case 'paragraph':
                this.execEditorCommand('formatBlock', '<p>');
                break;
            case 'alignLeft':
                this.execEditorCommand(this.isRtl() ? 'justifyRight' : 'justifyLeft');
                break;
            case 'alignCenter':
                this.execEditorCommand('justifyCenter');
                break;
            case 'alignRight':
                this.execEditorCommand(this.isRtl() ? 'justifyLeft' : 'justifyRight');
                break;
            case 'indent':
                this.indentListItem();
                break;
            case 'outdent':
                this.outdentListItem();
                break;
            case 'taskList':
                this.insertTaskList();
                break;
            case 'toggle':
                this.insertToggleBlock();
                break;
        }

        this.applyMutation({ focus: true, updateActiveFormats: true });
        this.collapseFloatingToolbarAfterFormat();
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
            formattedNode = formattedNode.parentNode!;
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

        if (command === 'clear') {
            this.execEditorCommand('removeFormat');
            selection.collapseToEnd();
        } else if (command === 'heading1' || command === 'heading2' || command === 'heading3') {
            const level = command.replace('heading', '');
            this.execEditorCommand('formatBlock', `<h${level}>`);
            selection.collapseToEnd();
        } else if (command === 'bulletList') {
            this.execEditorCommand('insertUnorderedList');
            selection.collapseToEnd();
        } else if (command === 'orderedList') {
            this.execEditorCommand('insertOrderedList');
            selection.collapseToEnd();
        }

        this.showFloatingToolbar.set(false);
        this.applyMutation({ focus: true });
    }

    onLinkInsert(data: { text: string; url: string }): void {
        this.flushPendingHistoryPush();
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
        this.flushPendingHistoryPush();
        if (this.imageSources() === 'upload') {
            this.imageUploadError.emit('Image URL insertion is disabled. Use upload source.');
            return;
        }
        this.restoreSelection();
        const safeSrc = this.sanitizer.sanitizeImageSrc(data.src);
        if (safeSrc) {
            this.insertImageAtSelection(safeSrc, data.alt);
            this.pushHistory();
            this.syncContentFromEditor();
        } else {
            this.imageUploadError.emit('Invalid image URL.');
        }
    }

    async onFileImport(file: File): Promise<void> {
        if (this.readonly() || this.disabled()) return;
        this.flushPendingHistoryPush();

        const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
        const isZip = header.length >= 4 &&
            header[0] === 0x50 && header[1] === 0x4B &&
            header[2] === 0x03 && header[3] === 0x04;
        const isPdf = header.length >= 5 &&
            header[0] === 0x25 && header[1] === 0x50 &&
            header[2] === 0x44 && header[3] === 0x46 &&
            header[4] === 0x2D;

        if (!isZip && !isPdf) {
            const msg = this.resolvedLocale().editor.importInvalidFile;
            this.fileImportError.emit(msg);
            this.showImportError(msg);
            return;
        }

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
        const { parseDocx } = await import('../lib/docx-parser');
        const { renderDocxForEditor } = await import('../lib/docx-to-editor-html');
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
        const { parsePdf } = await import('../lib/pdf-parser');
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

    onEmojiInsert(emoji: string): void {
        this.flushPendingHistoryPush();
        this.restoreSelection();
        this.insertText(emoji);
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }
    }

    onColorSelect(event: { type: 'fontColor' | 'backgroundColor'; color: string }): void {
        this.flushPendingHistoryPush();
        this.restoreSelection();

        const mentionTargets = this.getMentionElementsInSelection();

        if (event.type === 'fontColor') {
            this.execEditorCommand('foreColor', event.color);
            this.setMentionStyle(mentionTargets, 'color', event.color);
        } else {
            if (!this.execEditorCommand('hiliteColor', event.color)) {
                this.execEditorCommand('backColor', event.color);
            }
            this.setMentionStyle(mentionTargets, 'backgroundColor', event.color);
        }

        this.applyMutation({ focus: true });
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
        const mentionTriggerPattern = /(?:^|[\s([{])@([-\p{L}\p{N}_.]*)$/u;
        const tagTriggerPattern = /(?:^|[\s([{])#([-\p{L}\p{N}_.]*)$/u;

        if (this.mentions()) {
            const mentionMatch = mentionTriggerPattern.exec(beforeCursor);
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
            const tagMatch = tagTriggerPattern.exec(beforeCursor);
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

    private checkSlashCommandTrigger(text: string, cursorPosition: number): boolean {
        if (!this.enableSlashCommands() || this.disabled() || this.readonly()) {
            this.closeSlashCommandPopover();
            return false;
        }

        const beforeCursor = text.substring(0, cursorPosition);
        const slashTriggerPattern = /(?:^|[\s([{\u200B])\/([-\p{L}\p{N}_.]*)$/u;
        const slashMatch = slashTriggerPattern.exec(beforeCursor)
            ?? this.matchSlashTriggerAtCaret()
            ?? this.matchSlashTriggerWithinCurrentBlock();
        if (!slashMatch) {
            this.closeSlashCommandPopover();
            return false;
        }

        this.captureSlashTriggerRange();
        this.slashAnchorBlock = this.getClosestEditableBlockFromSelection();
        this.slashQuery.set(slashMatch[1]);
        this.slashCommandSelectedIndex.set(0);
        this.updateSlashCommandPopoverPosition();
        this.slashCommandOpen.set(true);
        return true;
    }

    private matchSlashTriggerAtCaret(): RegExpExecArray | null {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        const range = selection.getRangeAt(0);
        if (range.startContainer.nodeType !== Node.TEXT_NODE) {
            return null;
        }

        const nodeText = (range.startContainer as Text).data.slice(0, range.startOffset);
        const nodePattern = /(?:^|[\s([{\u200B])\/([-\p{L}\p{N}_.]*)$/u;
        return nodePattern.exec(nodeText);
    }

    private matchSlashTriggerWithinCurrentBlock(): RegExpExecArray | null {
        const selection = this.document.getSelection();
        const editor = this.getEditorElement();
        if (!selection || selection.rangeCount === 0 || !editor) {
            return null;
        }

        const range = selection.getRangeAt(0);
        if (!editor.contains(range.startContainer)) {
            return null;
        }

        const block = this.findClosestEditableBlockFromRange(range);
        if (!block) {
            return null;
        }

        const blockPattern = /(?:^|[\s([{\u200B])\/([-\p{L}\p{N}_.]*)$/u;

        // Chromium may report the caret container as the contenteditable root.
        // In that case, try nearby child blocks because startOffset can be unstable.
        if (range.startContainer === editor) {
            const candidateBlocks: HTMLElement[] = [];
            const pushCandidate = (node: Node | null | undefined) => {
                if (!node) {
                    return;
                }
                const candidate = this.findClosestEditableBlock(node);
                if (candidate && !candidateBlocks.includes(candidate)) {
                    candidateBlocks.push(candidate);
                }
            };

            pushCandidate(block);
            pushCandidate(editor.childNodes[range.startOffset] ?? null);
            pushCandidate(editor.childNodes[range.startOffset - 1] ?? null);
            pushCandidate(editor.lastChild);

            for (const candidate of candidateBlocks) {
                const match = blockPattern.exec(candidate.textContent ?? '');
                if (match) {
                    return match;
                }
            }
            return null;
        }

        const blockRange = this.document.createRange();
        blockRange.setStart(block, 0);
        blockRange.setEnd(range.startContainer, range.startOffset);
        const blockText = blockRange.toString();
        return blockPattern.exec(blockText);
    }

    onMentionSelect(item: MentionItem | TagItem): void {
        this.flushPendingHistoryPush();
        const type = this.mentionType();
        const trigger = type === 'mention' ? '@' : '#';
        const query = this.mentionQuery();
        const renderContext = this.buildEntityRenderContext(item, type, trigger, query);
        const renderResult = this.buildEntityInsertNode(renderContext);

        const editor = this.getEditorElement();
        if (!editor) return;

        const selection = this.resolveMentionSelection(editor);

        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const triggerLength = query.length + 1;
            const triggerStr = trigger + query;
            this.resolveMentionDeleteRange(range, triggerStr, triggerLength, editor);
            range.deleteContents();

            const trailingSpace = this.document.createTextNode('\u00A0');
            range.insertNode(trailingSpace);
            range.insertNode(renderResult.element);

            const newRange = this.document.createRange();
            newRange.setStart(trailingSpace, trailingSpace.length);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        this.syncContentFromEditor();
        const payload: RichTextEntityInsertEvent = {
            type,
            trigger,
            id: renderContext.id,
            value: renderContext.value,
            label: renderContext.label,
            query,
            url: renderResult.url,
            html: renderResult.element.outerHTML,
            item,
        };
        if (type === 'mention') {
            this.mentionInsert.emit(payload);
        } else {
            this.tagInsert.emit(payload);
        }
        this.closeMentionPopover();
        this.closeSlashCommandPopover();
        this.pushHistory();
        this.focusEditor();
    }

    private resolveMentionSelection(editor: HTMLElement): Selection | null {
        this.focusEditor();
        let selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).startContainer)) {
            return selection;
        }
        if (this.savedRange && editor.contains(this.savedRange.startContainer)) {
            selection = this.document.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(this.savedRange);
            }
        }
        return selection && selection.rangeCount > 0 ? selection : null;
    }

    private resolveMentionDeleteRange(range: Range, triggerStr: string, triggerLength: number, editor: HTMLElement): void {
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer as Text;
            const deleteStart = Math.max(0, range.startOffset - triggerLength);
            range.setStart(textNode, deleteStart);
            return;
        }

        if (this.resolveMentionRangeFromContainer(range, triggerStr, triggerLength)) {
            return;
        }
        this.resolveMentionRangeFromEditor(range, triggerStr, editor);
    }

    private resolveMentionRangeFromContainer(range: Range, triggerStr: string, triggerLength: number): boolean {
        const container = range.startContainer;
        const offset = range.startOffset;
        if (offset <= 0 || container.childNodes.length < offset) {
            return false;
        }

        let node: Node | null = container.childNodes[offset - 1];
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node as Text;
                if (!text.data.endsWith(triggerStr)) {
                    return false;
                }
                range.setStart(text, text.length - triggerLength);
                range.setEnd(text, text.length);
                return true;
            }
            node = node.lastChild;
        }
        return false;
    }

    private resolveMentionRangeFromEditor(range: Range, triggerStr: string, editor: HTMLElement): void {
        const walker = this.document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const text = walker.currentNode as Text;
            const idx = text.data.lastIndexOf(triggerStr);
            if (idx !== -1) {
                range.setStart(text, idx);
                range.setEnd(text, idx + triggerStr.length);
                return;
            }
        }
    }

    private buildEntityRenderContext(
        item: MentionItem | TagItem,
        type: RichTextEntityType,
        trigger: '@' | '#',
        query: string
    ): RichTextEntityRenderContext {
        const id = item.id ?? item.value;
        return {
            type,
            trigger,
            id,
            value: item.value,
            label: item.label,
            query,
            item,
            userId: id,
            tagId: id,
        };
    }

    private buildEntityInsertNode(context: RichTextEntityRenderContext): { element: HTMLElement; url?: string } {
        const options = context.type === 'mention' ? this.mentionRender() : this.tagRender();
        const mode = options.mode ?? 'chip';
        const text = this.resolveEntityText(context, options);
        const element = mode === 'link'
            ? this.createEntityLinkElement(context, text, options)
            : this.createEntitySpanElement(context, text, mode, options.className);
        const url = element.tagName === 'A' ? (element.getAttribute('href') ?? undefined) : undefined;
        return { element, url };
    }

    private resolveEntityText(context: RichTextEntityRenderContext, options: RichTextEntityRenderOptions): string {
        if (options.buildText) {
            return options.buildText(context);
        }
        if (options.textTemplate) {
            return this.resolveEntityTemplate(options.textTemplate, context);
        }
        return `${context.trigger}${context.label}`;
    }

    private resolveEntityUrl(context: RichTextEntityRenderContext, options: RichTextEntityRenderOptions): string | null {
        let raw = '';
        if (options.buildUrl) {
            raw = options.buildUrl(context);
        } else if (options.urlTemplate) {
            raw = this.resolveEntityTemplate(options.urlTemplate, context);
        }
        if (!raw) {
            return null;
        }
        const safeUrl = this.sanitizer.sanitizeUrl(raw);
        return safeUrl || null;
    }

    private createEntityLinkElement(
        context: RichTextEntityRenderContext,
        text: string,
        options: RichTextEntityRenderOptions
    ): HTMLElement {
        const safeUrl = this.resolveEntityUrl(context, options);
        if (!safeUrl) {
            return this.createEntitySpanElement(context, text, 'chip', options.className);
        }
        const link = this.document.createElement('a');
        this.applyEntityBaseAttributes(link, context);
        link.href = safeUrl;
        link.target = options.target ?? '_blank';
        link.rel = options.rel ?? 'noopener noreferrer';
        link.className = options.className ?? 'bg-accent/20 text-primary rounded px-1 underline underline-offset-2';
        link.textContent = text;
        return link;
    }

    private createEntitySpanElement(
        context: RichTextEntityRenderContext,
        text: string,
        mode: RichTextEntityRenderMode,
        customClassName?: string
    ): HTMLElement {
        const span = this.document.createElement('span');
        this.applyEntityBaseAttributes(span, context);
        if (mode === 'text') {
            span.className = customClassName ?? '';
        } else {
            span.className = customClassName ?? 'bg-accent text-accent-foreground rounded px-1';
        }
        span.textContent = text;
        return span;
    }

    private applyEntityBaseAttributes(element: HTMLElement, context: RichTextEntityRenderContext): void {
        element.setAttribute('contenteditable', 'false');
        if (context.type === 'mention') {
            element.dataset['mention'] = context.value;
            element.dataset['mentionId'] = context.id;
        } else {
            element.dataset['tag'] = context.value;
            element.dataset['tagId'] = context.id;
        }
    }

    private resolveEntityTemplate(template: string, context: RichTextEntityRenderContext): string {
        const values: Record<string, string> = {
            id: context.id,
            value: context.value,
            label: context.label,
            query: context.query,
            type: context.type,
            userId: context.userId,
            tagId: context.tagId,
        };

        return template
            .replaceAll(/@@([a-zA-Z0-9_-]+)@@/g, (_match, token: string) => values[token] ?? '')
            .replaceAll(/:([a-zA-Z][a-zA-Z0-9_-]*)/g, (_match, token: string) => values[token] ?? _match);
    }

    closeMentionPopover(): void {
        this.mentionPopoverOpen.set(false);
        this.mentionQuery.set('');
    }

    async onSlashCommandSelect(command: RichTextSlashCommand): Promise<void> {
        if (this.disabled() || this.readonly()) {
            return;
        }
        this.flushPendingHistoryPush();
        const selectionBeforeMutations = this.document.getSelection();
        if (selectionBeforeMutations && selectionBeforeMutations.rangeCount > 0) {
            const r = selectionBeforeMutations.getRangeAt(0);
            const rc = r.getBoundingClientRect();
            if (rc.width > 0 || rc.height > 0 || rc.top > 0 || rc.left > 0) {
                this._pendingLinkPositionHint = { x: rc.left, y: rc.bottom };
            }
        }
        const query = this.slashQuery();
        const resolvedSlashBlock = this.removeSlashTriggerText(query);
        const slashBlock = resolvedSlashBlock ?? this.getClosestEditableBlockForSlashCommand();
        if (resolvedSlashBlock) {
            this.slashAnchorBlock = resolvedSlashBlock;
        }
        if (slashBlock) {
            this.placeCaretAtEndOfBlock(slashBlock);
            this.removeCaretSentinelAtSelection();
        }
        this.closeSlashCommandPopover();

        const context: RichTextSlashCommandContext = {
            query,
            selectedText: this.selectedText(),
            executeToolbarCommand: (toolbarCommand: string) => this.executeToolbarCommandFromSlash(toolbarCommand, slashBlock),
            insertText: (text: string) => {
                this.insertText(text);
                this.pushHistory();
            },
            insertHtml: (html: string) => {
                this.insertHtml(html);
                this.pushHistory();
            },
            showLinkDialog: () => this.showLinkDialog(),
            focusEditor: () => this.focusEditor(),
        };

        await Promise.resolve(command.run(context));
        if (!this.isSelectionInsideEditor()) {
            this.focusEditor();
        }
    }

    private removeCaretSentinelAtSelection(): void {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);
        if (range.startContainer.nodeType !== Node.TEXT_NODE) {
            return;
        }

        const textNode = range.startContainer as Text;
        if (!textNode.data.includes('\u200B')) {
            return;
        }

        const originalOffset = range.startOffset;
        const before = textNode.data.slice(0, originalOffset).replaceAll('\u200B', '').length;
        textNode.data = textNode.data.replaceAll('\u200B', '');

        const newOffset = Math.min(before, textNode.data.length);
        const newRange = this.document.createRange();
        newRange.setStart(textNode, newOffset);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
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

    private showLinkDialog(): void {
        const selection = this.document.getSelection();
        this.selectedText.set(selection?.toString() || '');

        if (selection && selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }

        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const viewportWidth = this.document.defaultView?.innerWidth ?? 1024;
            const viewportHeight = this.document.defaultView?.innerHeight ?? 768;
            const width = 320;
            const height = 180;
            const rectIsEmpty = rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0;
            const sourceX = rectIsEmpty && this._pendingLinkPositionHint ? this._pendingLinkPositionHint.x : rect.left;
            const sourceY = rectIsEmpty && this._pendingLinkPositionHint ? this._pendingLinkPositionHint.y : rect.bottom;
            const x = Math.max(8, Math.min(sourceX, viewportWidth - width - 8));
            const y = Math.max(8, Math.min(sourceY + 8, viewportHeight - height - 8));
            this.linkPopoverPosition.set({ x, y });
        }
        this._pendingLinkPositionHint = null;

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

    private canUseUrlSource(): boolean {
        return this.imageSources() === 'all' || this.imageSources() === 'url';
    }

    private async insertImageFile(file: File): Promise<void> {
        const uploader = this.imageUploader();
        if (this.canUseUploadSource() && uploader) {
            await this.uploadImageFile(file);
            return;
        }

        if (this.canUseUrlSource()) {
            try {
                const fileDataUrl = await this.readFileAsDataUrl(file);
                const safeSrc = this.sanitizer.sanitizeImageSrc(fileDataUrl);
                if (!safeSrc) {
                    this.imageUploadError.emit('Pasted image is not allowed by sanitizer policy.');
                    return;
                }
                this.insertImageAtSelection(safeSrc, file.name);
                this.pushHistory();
                this.imageUploadComplete.emit(safeSrc);
                return;
            } catch {
                this.imageUploadError.emit('Could not read image file.');
            }
        }

        if (this.canUseUploadSource() && !uploader) {
            this.imageUploadError.emit('No imageUploader configured.');
        }
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
            this.insertImageAtSelection(safeSrc, file.name);
            this.pushHistory();
            this.imageUploadComplete.emit(safeSrc);
        } catch (error: any) {
            this.imageUploadError.emit(error?.message || 'Image upload failed.');
        } finally {
            this.imageUploading.set(false);
        }
    }

    private readFileAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => reject(new Error('Could not read image file.'));
            reader.readAsDataURL(file);
        });
    }

    private readonly TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    private dataUrlToFile(dataUrl: string, filename: string): File {
        const parts = dataUrl.split(',');
        const meta = parts[0];
        const base64 = parts[1];
        const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/png';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.codePointAt(i)!;
        }
        return new File([bytes], filename, { type: mime });
    }

    private scanForBase64Images(): void {
        if (!this.autoImageUpload() || !this.imageUploader() || this.disabled() || this.readonly()) {
            return;
        }
        const editor = this.getEditorElement();
        if (!editor) return;

        const images = editor.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src') ?? '';
            if (src.startsWith('data:image/') && img.dataset['autoUploadId'] === undefined) {
                this.processAutoUploadImage(img);
            }
        });
    }

    private processAutoUploadImage(img: HTMLImageElement): void {
        const uploader = this.imageUploader();
        if (!uploader) return;

        const uploadId = `auto-upload-${++this.autoUploadCounter}`;
        const dataUrl = img.getAttribute('src') ?? '';

        const width = img.naturalWidth || img.width || Number.parseInt(img.getAttribute('width') ?? '0', 10) || 200;
        const height = img.naturalHeight || img.height || Number.parseInt(img.getAttribute('height') ?? '0', 10) || 150;

        this.autoUploadMutating = true;
        img.dataset['autoUploadId'] = uploadId;
        img.dataset['autoUploadStatus'] = 'uploading';
        if (!img.getAttribute('width')) img.setAttribute('width', String(width));
        if (!img.getAttribute('height')) img.setAttribute('height', String(height));
        img.setAttribute('src', this.TRANSPARENT_PIXEL);
        this.autoUploadMutating = false;

        this.syncContentFromEditor();

        if (!isValidImageDataUrl(dataUrl)) {
            this.autoUploadMutating = true;
            delete img.dataset['autoUploadId'];
            delete img.dataset['autoUploadStatus'];
            img.setAttribute('src', this.TRANSPARENT_PIXEL);
            this.autoUploadMutating = false;
            this.syncContentFromEditor();
            this.autoImageUploadError.emit(this.resolvedLocale().editor.autoUploadNotImage);
            return;
        }

        const ext = (/data:image\/([\w+]+)/.exec(dataUrl)?.[1] ?? 'png').replace('+xml', '');
        const filename = `pasted-image-${uploadId}.${ext}`;
        const file = this.dataUrlToFile(dataUrl, filename);

        const subscription = from(firstValueFrom(uploader(file))).subscribe({
            next: (uploadedUrl) => {
                const safeSrc = this.sanitizer.sanitizeImageSrc(uploadedUrl);
                if (!safeSrc) {
                    this.handleAutoUploadError(uploadId, img, dataUrl, 'Uploaded image URL is not allowed by sanitizer policy.');
                    return;
                }
                this.autoUploadMutating = true;
                img.setAttribute('src', safeSrc);
                delete img.dataset['autoUploadId'];
                delete img.dataset['autoUploadStatus'];
                this.autoUploadMutating = false;

                this.autoUploadMap.delete(uploadId);
                this.syncContentFromEditor();
                this.pushHistory();
                this.autoImageUploadComplete.emit(safeSrc);
            },
            error: (err: unknown) => {
                const message = err instanceof Error ? err.message : 'Auto image upload failed.';
                this.handleAutoUploadError(uploadId, img, dataUrl, message);
            },
        });

        this.autoUploadMap.set(uploadId, { subscription, dataUrl });
    }

    private handleAutoUploadError(uploadId: string, img: HTMLImageElement, dataUrl: string, message: string): void {
        this.autoUploadMutating = true;
        img.dataset['autoUploadStatus'] = 'error';
        this.autoUploadMutating = false;

        this.autoUploadMap.delete(uploadId);
        const errors = new Map(this.autoUploadErrors());
        errors.set(uploadId, { dataUrl, imgElement: img });
        this.autoUploadErrors.set(errors);
        this.syncContentFromEditor();
        this.autoImageUploadError.emit(message);
    }

    retryAutoUpload(uploadId: string): void {
        const errors = new Map(this.autoUploadErrors());
        const entry = errors.get(uploadId);
        if (!entry) return;

        const img = entry.imgElement;
        if (!img.isConnected) {
            errors.delete(uploadId);
            this.autoUploadErrors.set(errors);
            return;
        }

        errors.delete(uploadId);
        this.autoUploadErrors.set(errors);

        this.autoUploadMutating = true;
        delete img.dataset['autoUploadId'];
        delete img.dataset['autoUploadStatus'];
        img.setAttribute('src', entry.dataUrl);
        this.autoUploadMutating = false;

        this.processAutoUploadImage(img);
    }

    removeAutoUploadImage(uploadId: string): void {
        const errors = new Map(this.autoUploadErrors());
        const entry = errors.get(uploadId);
        if (entry?.imgElement?.isConnected) {
            entry.imgElement.remove();
        }
        errors.delete(uploadId);
        this.autoUploadErrors.set(errors);

        const pending = this.autoUploadMap.get(uploadId);
        if (pending) {
            pending.subscription.unsubscribe();
            this.autoUploadMap.delete(uploadId);
        }

        this.syncContentFromEditor();
        this.pushHistory();
    }

    autoUploadErrorList = computed(() => {
        const errors = this.autoUploadErrors();
        const container = this.editorDiv?.nativeElement;
        if (!container || errors.size === 0) return [];

        const containerRect = container.getBoundingClientRect();
        const entries: Array<{ id: string; top: number; left: number; width: number; height: number }> = [];

        errors.forEach((entry, id) => {
            if (!entry.imgElement.isConnected) return;
            const imgRect = entry.imgElement.getBoundingClientRect();
            entries.push({
                id,
                top: imgRect.top - containerRect.top,
                left: imgRect.left - containerRect.left,
                width: Math.max(imgRect.width, 120),
                height: Math.max(imgRect.height, 80),
            });
        });

        return entries;
    });

    onTableInsert(event: { rows: number; cols: number }): void {
        this.restoreSelection();
        this.insertTable(event.rows, event.cols);
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
        const closeHandler = () => {
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
        if (!cell) {
            if (this.tableResizeCursor()) {
                this.tableResizeCursor.set(false);
                this.editorDiv!.nativeElement.style.cursor = '';
            }
            return;
        }
        const cellRect = cell.getBoundingClientRect();
        const colIndex = Array.from((cell.parentElement as HTMLTableRowElement).cells).indexOf(cell);
        const nearRightBorder = event.clientX >= cellRect.right - 4;
        const nearLeftBorder = event.clientX <= cellRect.left + 4 && colIndex > 0;
        if (nearRightBorder || nearLeftBorder) {
            this.tableResizeCursor.set(true);
            this.editorDiv!.nativeElement.style.cursor = 'col-resize';
        } else if (this.tableResizeCursor()) {
            this.tableResizeCursor.set(false);
            this.editorDiv!.nativeElement.style.cursor = '';
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
            for (let ci = 0; ci < grid[ri].length; ci++) {
                if (grid[ri][ci] === cell) {
                    return {
                        minRow: ri,
                        minCol: ci,
                        maxRow: ri + (cell.rowSpan || 1) - 1,
                        maxCol: ci + (cell.colSpan || 1) - 1,
                    };
                }
            }
        }
        return { minRow: 0, minCol: 0, maxRow: 0, maxCol: 0 };
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
        let bounds = { ...initial };
        let expanded = true;
        while (expanded) {
            expanded = false;
            for (let ri = bounds.minRow; ri <= bounds.maxRow; ri++) {
                for (let ci = bounds.minCol; ci <= bounds.maxCol; ci++) {
                    const cell = grid[ri]?.[ci];
                    if (cell && this.tryExpandBoundsForCell(grid, cell, bounds)) {
                        expanded = true;
                    }
                }
            }
        }
        return bounds;
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

    private insertTable(rows: number, cols: number): void {
        const headerCells = Array.from({ length: cols }, () => '<th><br></th>').join('');
        const bodyRow = '<tr>' + Array.from({ length: cols }, () => '<td><br></td>').join('') + '</tr>';
        const bodyRows = Array.from({ length: rows - 1 }, () => bodyRow).join('');
        const html = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`;
        this.insertHtml(html);
        this.pushHistory();
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
            const cellAbove = grid[insertAtRow - 1]?.[colIndex];
            const cellBelow = grid[insertAtRow]?.[colIndex];
            if (cellAbove && cellAbove === cellBelow && !processed.has(cellAbove)) {
                processed.add(cellAbove);
                cellAbove.rowSpan = (cellAbove.rowSpan || 1) + 1;
                return true;
            }
        }

        if (insertAtRow >= grid.length && insertAtRow > 0) {
            const cellAbove = grid[insertAtRow - 1]?.[colIndex];
            if (cellAbove && !processed.has(cellAbove)) {
                const aboveBounds = this.getCellGridBounds(grid, cellAbove);
                if (aboveBounds.maxRow >= grid.length - 1 && aboveBounds.minRow < grid.length - 1) {
                    processed.add(cellAbove);
                    cellAbove.rowSpan = (cellAbove.rowSpan || 1) + 1;
                    return true;
                }
            }
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
            const cellLeft = grid[rowIndex]?.[insertAtCol - 1];
            const cellRight = grid[rowIndex]?.[insertAtCol];
            if (cellLeft && cellLeft === cellRight && !processed.has(cellLeft)) {
                processed.add(cellLeft);
                cellLeft.colSpan = (cellLeft.colSpan || 1) + 1;
                return true;
            }
        } else if (insertAtCol >= numCols && insertAtCol > 0) {
            const cellLeft = grid[rowIndex]?.[insertAtCol - 1];
            if (cellLeft && !processed.has(cellLeft)) {
                const leftBounds = this.getCellGridBounds(grid, cellLeft);
                if (leftBounds.maxCol >= numCols - 1 && leftBounds.minCol < numCols - 1) {
                    processed.add(cellLeft);
                    cellLeft.colSpan = (cellLeft.colSpan || 1) + 1;
                    return true;
                }
            }
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

        let depth = 0;
        let parent: Node | null = li;
        while (parent && parent !== this.editorDiv?.nativeElement) {
            if (parent.nodeType === Node.ELEMENT_NODE &&
                ((parent as Element).tagName === 'UL' || (parent as Element).tagName === 'OL')) {
                depth++;
            }
            parent = parent.parentNode;
        }
        if (depth >= 6) return;

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

    private insertImageAtSelection(src: string, alt: string): void {
        const img = this.document.createElement('img');
        img.setAttribute('src', src);
        img.setAttribute('alt', alt || 'Image');

        const selection = this.document.getSelection();
        const editorElement = this.getEditorElement();
        if (!selection || selection.rangeCount === 0 || !editorElement) {
            editorElement?.appendChild(img);
            this.syncContentFromEditor();
            return;
        }

        const range = selection.getRangeAt(0);
        const anchorNode = range.commonAncestorContainer;
        if (!editorElement.contains(anchorNode)) {
            editorElement.appendChild(img);
            const newRange = this.document.createRange();
            newRange.setStartAfter(img);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            this.syncContentFromEditor();
            return;
        }

        range.deleteContents();
        range.insertNode(img);

        const newRange = this.document.createRange();
        newRange.setStartAfter(img);
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

    private setMentionStyle(elements: HTMLElement[], prop: 'color' | 'backgroundColor' | 'fontSize', value: string): void {
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

        if (this.queryEditorCommandState('bold')) formats.add('bold');
        if (this.queryEditorCommandState('italic')) formats.add('italic');
        if (this.queryEditorCommandState('underline')) formats.add('underline');
        if (this.queryEditorCommandState('strikeThrough')) formats.add('strikethrough');
        if (this.queryEditorCommandState('insertUnorderedList')) formats.add('bulletList');
        if (this.queryEditorCommandState('insertOrderedList')) formats.add('orderedList');

        this.detectTaskListFormat(formats);
        this.activeFormats.set(formats);
        this.detectCurrentFontSize();
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

    private detectCurrentFontSize(): void {
        const sel = this.document.getSelection();
        if (!sel || sel.rangeCount === 0) {
            return;
        }
        const range = sel.getRangeAt(0);
        let element = range.commonAncestorContainer;

        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement || element;
        }

        if (!(element instanceof HTMLElement)) {
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

    private updateSlashCommandPopoverPosition(): void {
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const editorRect = this.el.nativeElement.getBoundingClientRect();
            const maxX = Math.max(0, editorRect.width - 320);
            const maxY = Math.max(0, editorRect.height - 260);
            const x = Math.max(0, Math.min(rect.left - editorRect.left, maxX));
            const y = Math.max(0, Math.min(rect.bottom - editorRect.top + 8, maxY));

            this.slashCommandPosition.set({
                x,
                y,
            });
        }
    }

    private onSlashCommandKeydown(event: KeyboardEvent): void {
        const commands = this.filteredSlashCommands();
        if (commands.length === 0) {
            if (event.key === 'Escape' || event.key === 'Tab') {
                this.closeSlashCommandPopover();
            }
            return;
        }

        const currentIndex = this.slashCommandSelectedIndex();
        if (event.key === 'ArrowDown') {
            this.slashCommandSelectedIndex.set(Math.min(currentIndex + 1, commands.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            this.slashCommandSelectedIndex.set(Math.max(currentIndex - 1, 0));
            return;
        }
        if (event.key === 'Escape' || event.key === 'Tab') {
            this.closeSlashCommandPopover();
            return;
        }
        if (event.key === ' ' || event.key === 'Spacebar') {
            const selected = commands[currentIndex];
            if (selected) {
                void this.onSlashCommandSelect(selected);
            }
            return;
        }
        if (event.key === 'Enter') {
            const selected = commands[currentIndex];
            if (selected) {
                void this.onSlashCommandSelect(selected);
            }
        }
    }

    private scrollSelectedSlashCommandIntoView(): void {
        const list = this.slashCommandList?.nativeElement;
        if (!list) {
            return;
        }

        const selectedIndex = this.slashCommandSelectedIndex();
        const selected = list.querySelector<HTMLElement>(`[data-slash-index="${selectedIndex}"]`);
        if (!selected) {
            return;
        }

        const listTop = list.scrollTop;
        const listBottom = listTop + list.clientHeight;
        const itemTop = selected.offsetTop;
        const itemBottom = itemTop + selected.offsetHeight;

        if (itemTop < listTop || itemBottom > listBottom) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    private closeSlashCommandPopover(): void {
        this.slashCommandOpen.set(false);
        this.slashQuery.set('');
        this.slashCommandSelectedIndex.set(0);
        this.slashAnchorBlock = null;
        this.slashTriggerRange = null;
    }

    private removeSlashTriggerText(query: string): HTMLElement | null {
        const removedFromRange = this.removeSlashTriggerTextFromRange(query, this.slashTriggerRange);
        if (removedFromRange) {
            this.slashTriggerRange = null;
            return removedFromRange;
        }

        const removedFromCurrentAnchor = this.removeSlashTriggerTextFromAnchorBlock(query, this.getClosestEditableBlockForSlashCommand());
        if (removedFromCurrentAnchor) {
            return removedFromCurrentAnchor;
        }

        const removedFromStoredAnchor = this.removeSlashTriggerTextFromAnchorBlock(query, this.slashAnchorBlock);
        if (removedFromStoredAnchor) {
            return removedFromStoredAnchor;
        }

        const removedFromEditor = this.removeSlashTriggerTextFromEditor(query);
        if (removedFromEditor) {
            return removedFromEditor;
        }

        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);
        if (range.startContainer.nodeType !== Node.TEXT_NODE) {
            return null;
        }

        const triggerLength = query.length + 1;
        const textNode = range.startContainer as Text;
        const deleteStart = Math.max(0, range.startOffset - triggerLength);
        const triggerText = textNode.data.slice(deleteStart, range.startOffset);
        if (triggerText !== `/${query}`) {
            return null;
        }

        range.setStart(textNode, deleteStart);
        range.deleteContents();
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        this.syncContentFromEditor();
        return this.findClosestEditableBlock(textNode);
    }


    private removeSlashTriggerTextFromRange(query: string, range: Range | null): HTMLElement | null {
        if (range?.startContainer.nodeType !== Node.TEXT_NODE) {
            return null;
        }
        const selection = this.document.getSelection();
        if (!selection) {
            return null;
        }

        const workRange = range.cloneRange();
        const triggerLength = query.length + 1;
        const textNode = workRange.startContainer as Text;
        const deleteStart = Math.max(0, workRange.startOffset - triggerLength);
        const triggerText = textNode.data.slice(deleteStart, workRange.startOffset);
        if (triggerText !== `/${query}`) {
            return null;
        }

        workRange.setStart(textNode, deleteStart);
        workRange.deleteContents();
        workRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(workRange);
        this.syncContentFromEditor();
        return this.findClosestEditableBlock(textNode);
    }

    private removeSlashTriggerTextFromAnchorBlock(query: string, anchorBlock: HTMLElement | null): HTMLElement | null {
        if (!anchorBlock) {
            return null;
        }
        const editor = this.getEditorElement();
        if (!editor?.contains(anchorBlock)) {
            return null;
        }

        const walker = this.document.createTreeWalker(anchorBlock, NodeFilter.SHOW_TEXT);
        let candidateNode: Text | null = null;
        let candidateIndex = -1;
        const needle = `/${query}`;

        while (walker.nextNode()) {
            const textNode = walker.currentNode as Text;
            const index = textNode.data.lastIndexOf(needle);
            if (index >= 0) {
                candidateNode = textNode;
                candidateIndex = index;
            }
        }

        if (!candidateNode || candidateIndex < 0) {
            return null;
        }

        candidateNode.deleteData(candidateIndex, needle.length);
        const selection = this.document.getSelection();
        if (selection) {
            const range = this.document.createRange();
            range.setStart(candidateNode, candidateIndex);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        this.syncContentFromEditor();
        return anchorBlock;
    }

    private removeSlashTriggerTextFromEditor(query: string): HTMLElement | null {
        const editor = this.getEditorElement();
        if (!editor) {
            return null;
        }

        const walker = this.document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        let candidateNode: Text | null = null;
        let candidateIndex = -1;
        const needle = `/${query}`;

        while (walker.nextNode()) {
            const textNode = walker.currentNode as Text;
            const index = textNode.data.lastIndexOf(needle);
            if (index >= 0) {
                candidateNode = textNode;
                candidateIndex = index;
            }
        }

        if (!candidateNode || candidateIndex < 0) {
            return null;
        }

        candidateNode.deleteData(candidateIndex, needle.length);
        const selection = this.document.getSelection();
        if (selection) {
            const range = this.document.createRange();
            range.setStart(candidateNode, candidateIndex);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        this.syncContentFromEditor();
        return this.findClosestEditableBlock(candidateNode);
    }

    private getClosestEditableBlockForSlashCommand(): HTMLElement | null {
        const editor = this.getEditorElement();
        if (editor && this.slashAnchorBlock && editor.contains(this.slashAnchorBlock)) {
            return this.slashAnchorBlock;
        }
        const selection = this.document.getSelection();
        if (selection && selection.rangeCount > 0 && editor) {
            const range = selection.getRangeAt(0);
            if (editor.contains(range.startContainer)) {
                return this.findClosestEditableBlockFromRange(range);
            }
        }
        if (this.slashTriggerRange) {
            return this.findClosestEditableBlockFromRange(this.slashTriggerRange);
        }
        return null;
    }

    private getClosestEditableBlockFromSelection(): HTMLElement | null {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        return this.findClosestEditableBlockFromRange(selection.getRangeAt(0));
    }

    private findClosestEditableBlockFromRange(range: Range): HTMLElement | null {
        const editor = this.getEditorElement();
        if (!editor) {
            return null;
        }

        let node: Node = range.startContainer;
        if (node === editor) {
            const childCount = editor.childNodes.length;
            if (childCount > 0) {
                const index = Math.min(Math.max(range.startOffset - 1, 0), childCount - 1);
                node = editor.childNodes[index] ?? editor;
            }
        }

        return this.findClosestEditableBlock(node);
    }

    private findClosestEditableBlock(node: Node): HTMLElement | null {
        const editor = this.getEditorElement();
        if (!editor) {
            return null;
        }

        let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
        while (current && current !== editor) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const element = current as HTMLElement;
                const tagName = element.tagName;
                if (['P', 'DIV', 'H1', 'H2', 'H3', 'LI', 'BLOCKQUOTE', 'PRE'].includes(tagName)) {
                    return element;
                }
            }
            current = current.parentNode;
        }
        return this.resolveTopLevelEditorBlock(node, editor);
    }

    private resolveTopLevelEditorBlock(node: Node, editor: HTMLElement): HTMLElement | null {
        if (node.nodeType === Node.TEXT_NODE && node.parentNode === editor) {
            const wrapper = this.document.createElement('p');
            (node as ChildNode).before(wrapper);
            wrapper.appendChild(node);
            return wrapper;
        }

        let current: Node | null = node;
        while (current?.parentNode && current.parentNode !== editor) {
            current = current.parentNode;
        }

        if (current && current !== editor && current.nodeType === Node.ELEMENT_NODE) {
            return current as HTMLElement;
        }

        if (editor.childNodes.length === 0) {
            const paragraph = this.document.createElement('p');
            paragraph.appendChild(this.document.createElement('br'));
            editor.appendChild(paragraph);
            return paragraph;
        }

        const firstElementChild = Array.from(editor.childNodes).find(child => child.nodeType === Node.ELEMENT_NODE);
        if (firstElementChild) {
            return firstElementChild as HTMLElement;
        }
        return null;
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

    private executeToolbarCommandFromSlash(command: string, anchorBlock: HTMLElement | null): void {
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

    private captureSlashTriggerRange(): void {
        const selection = this.document.getSelection();
        const editor = this.getEditorElement();
        if (!selection || selection.rangeCount === 0 || !editor) {
            this.slashTriggerRange = null;
            return;
        }

        const range = selection.getRangeAt(0);
        if (!editor.contains(range.startContainer)) {
            this.slashTriggerRange = null;
            return;
        }
        this.slashTriggerRange = range.cloneRange();
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

    private flushPendingHistoryPush(): void {
        if (!this.historyDebounceTimer) {
            return;
        }
        clearTimeout(this.historyDebounceTimer);
        this.historyDebounceTimer = null;
        this.pushHistory();
    }

    private bumpHistoryVersion(): void {
        this.historyVersion.update(v => v + 1);
    }

    private buildHistoryPreview(html: string): { preview: string; previewLines: string[]; lineCount: number } {
        const blockAware = html
            .replaceAll(/<br\s*\/?>/gi, '\n')
            .replaceAll(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
            .replaceAll(/<li[^>]*>/gi, '• ');
        const plain = this.sanitizer.stripTags(blockAware);
        const lines = plain
            .split('\n')
            .map(line => line.replaceAll(/<\/?[^>]+>/g, '').replaceAll(/\s+/g, ' ').trim())
            .filter(Boolean);
        const safeLines = lines.length ? lines : ['(empty)'];
        return {
            preview: safeLines.join(' ').slice(0, 120),
            previewLines: safeLines.slice(0, 3),
            lineCount: safeLines.length,
        };
    }

    private focusFirstHistoryActionSoon(preferredList: 'popover' | 'dialog'): void {
        const tryFocus = (attempt: number) => {
            const root = this.el.nativeElement as HTMLElement;
            const selector = `[data-history-list="${preferredList}"] [data-history-entry-action="true"]`;
            const firstAction = root.querySelector<HTMLElement>(selector);
            if (firstAction) {
                firstAction.focus();
                return;
            }
            if (attempt < 4) {
                setTimeout(() => tryFocus(attempt + 1), 16);
            }
        };

        setTimeout(() => tryFocus(0), 24);
    }

    private getHistoryEntryElements(from: HTMLElement): HTMLElement[] {
        const listContainer = from.closest('[data-history-list]');
        if (!listContainer) {
            return [];
        }
        return Array.from(
            listContainer.querySelectorAll<HTMLElement>('[data-history-entry-action="true"]')
        );
    }

    private getHistoryListType(from: HTMLElement): 'popover' | 'dialog' | null {
        const listContainer = from.closest<HTMLElement>('[data-history-list]');
        const type = listContainer?.dataset['historyList'];
        if (type === 'popover' || type === 'dialog') {
            return type;
        }
        return null;
    }

    private focusHistoryEntrySoon(listType: 'popover' | 'dialog', entryIndex: number): void {
        setTimeout(() => {
            const root = this.el.nativeElement as HTMLElement;
            const selector = `[data-history-list="${listType}"] [data-history-entry-index="${entryIndex}"]`;
            const target = root.querySelector<HTMLElement>(selector);
            target?.focus();
        }, 0);
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
        if (this.autoUploadObserver) {
            this.autoUploadObserver.disconnect();
            this.autoUploadObserver = null;
        }
        this.autoUploadMap.forEach(entry => entry.subscription.unsubscribe());
        this.autoUploadMap.clear();
        this.autoUploadErrors.set(new Map());
        this.document.removeEventListener('mousemove', this.onTableResizeMoveBound);
        this.document.removeEventListener('mouseup', this.onTableResizeUpBound);
        this.closeTableContextMenu();
        this.removeFloatingScrollListener();
    }
}
