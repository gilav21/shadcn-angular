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
import { Observable, isObservable, of, Subject, firstValueFrom, from, catchError } from 'rxjs';
import { debounceTime, switchMap, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

interface HistoryEntry {
    html: string;
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
        [disabled]="disabled()"
        [readonly]="readonly()"
        [locale]="resolvedLocale()"
        (formatCommand)="onFormatCommand($event)"
        (linkInsert)="onLinkInsert($event)"
        (imageInsert)="onImageInsert($event)"
        (emojiInsert)="onEmojiInsert($event)"
        (colorSelect)="onColorSelect($event)"
        (fontSizeSelect)="onFontSizeSelect($event)"
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
            <ui-popover-content class="w-80 p-0" align="end" side="bottom" [restoreFocus]="false">
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
        (dragover)="onEditorDragOver($event)"
        (dragleave)="onEditorDragLeave($event)"
        (drop)="onEditorDrop($event)"
      ></div>

      @if (dragOver()) {
        <div class="absolute inset-0 pointer-events-none border-2 border-dashed border-primary/60 rounded-md bg-primary/5"></div>
      }

      @if (imageUploading()) {
        <div class="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div class="text-sm text-muted-foreground">{{ resolvedLocale().editor.uploadingImage }}</div>
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
          class="absolute z-50 w-72 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
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
          class="fixed z-50 bg-popover border rounded-lg shadow-lg p-4 w-80"
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

    private htmlContent = signal<string>('');
    activeFormats = signal<Set<string>>(new Set());
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
    historyPanelOpen = signal<boolean>(false);
    historyPreviewOpen = model<boolean>(false);
    historyBrowserOpen = model<boolean>(false);
    selectedHistoryIndex = signal<number | null>(null);
    lastAppliedHistoryIndex = signal<number | null>(null);
    private readonly historyVersion = signal<number>(0);

    private history: HistoryEntry[] = [];
    private historyIndex = -1;
    private isUndoRedo = false;
    private historyDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private shortcutHandle: ShortcutComponentHandle | null = null;
    private slashAnchorBlock: HTMLElement | null = null;
    private slashTriggerRange: Range | null = null;
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
            html: entry.html,
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
        if (target.tagName === 'IMG') {
            this.selectedImage.set(target as HTMLImageElement);
        } else {
            this.selectedImage.set(null);
        }
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
        ]);
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
        const html = this.sanitizer.sanitize(div.innerHTML).replace(/\u200B/g, '');

        const textContent = div.textContent ?? '';
        const triggerTextContent = this.buildTriggerAwareText(div.innerHTML);
        const selection = this.document.getSelection();
        const hasSelection = !!selection && selection.rangeCount > 0;
        const caretOffset = hasSelection
            ? this.getCaretOffset(div)
            : triggerTextContent.length;

        const textForSlash = triggerTextContent;
        if (!this.checkSlashCommandTrigger(textForSlash, caretOffset)) {
            this.checkMentionTrigger(textContent, caretOffset);
        } else {
            this.closeMentionPopover();
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
        if (this.slashCommandOpen()) {
            const slashKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab', ' ', 'Spacebar'];
            if (slashKeys.includes(event.key)) {
                event.preventDefault();
                this.onSlashCommandKeydown(event);
                return;
            }
        }

        if (this.mentionPopoverOpen() && this.mentionPopover) {
            const popoverKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
            if (popoverKeys.includes(event.key)) {
                event.preventDefault();
                this.mentionPopover.onKeydown(event);
                return;
            }
        }
        if (this.shortcutHandle?.dispatch(event)) {
            return;
        }

        if (event.key === 'Escape') {
            this.closeMentionPopover();
            this.closeSlashCommandPopover();
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
        this.flushPendingHistoryPush();

        if (this.disabled() || this.readonly()) {
            return;
        }

        const imageFile = Array.from(event.clipboardData?.files ?? []).find(file => file.type.startsWith('image/'));
        if (imageFile && this.images()) {
            await this.insertImageFile(imageFile);
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
            entries[entries.length - 1]?.focus();
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

        this.htmlContent.set(entry.html);
        if (this.editorDiv?.nativeElement) {
            this.editorDiv.nativeElement.innerHTML = entry.html;
        }
        this.restoreSerializedSelection(entry.selection);

        const outputValue = this.mode() === 'markdown'
            ? this.markdownService.toMarkdown(entry.html)
            : entry.html;
        this.onChange(outputValue);
        this.lastAppliedHistoryIndex.set(entryIndex);
        this.bumpHistoryVersion();
    }

    onFormatCommand(command: string): void {
        if (this.readonly() || this.disabled()) return;
        this.flushPendingHistoryPush();

        const mentionTargets = this.getMentionElementsInSelection();

        switch (command) {
            case 'bold':
                this.document.execCommand('bold', false);
                this.toggleMentionStyle(mentionTargets, 'fontWeight', 'bold', 'normal');
                break;
            case 'italic':
                this.document.execCommand('italic', false);
                this.toggleMentionStyle(mentionTargets, 'fontStyle', 'italic', 'normal');
                break;
            case 'underline':
                this.document.execCommand('underline', false);
                this.toggleMentionTextDecoration(mentionTargets, 'underline');
                break;
            case 'strikethrough':
                this.document.execCommand('strikeThrough', false);
                this.toggleMentionTextDecoration(mentionTargets, 'line-through');
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
                this.clearMentionStyles(mentionTargets);
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

        this.applyMutation({ focus: true, updateActiveFormats: true });

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
            this.document.execCommand('foreColor', false, event.color);
            this.setMentionStyle(mentionTargets, 'color', event.color);
        } else {
            if (!this.document.execCommand('hiliteColor', false, event.color)) {
                this.document.execCommand('backColor', false, event.color);
            }
            this.setMentionStyle(mentionTargets, 'backgroundColor', event.color);
        }

        this.applyMutation({ focus: true });
    }

    onFontSizeSelect(size: string): void {
        this.flushPendingHistoryPush();
        this.restoreSelection();

        const mentionTargets = this.getMentionElementsInSelection();

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
            const mentionMatch = beforeCursor.match(mentionTriggerPattern);
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
            const tagMatch = beforeCursor.match(tagTriggerPattern);
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
        const slashTriggerPattern = /(?:^|[\s([{\u200B\u00A0])\/([-\p{L}\p{N}_.]*)$/u;
        const slashMatch = beforeCursor.match(slashTriggerPattern)
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

    private matchSlashTriggerAtCaret(): RegExpMatchArray | null {
        const selection = this.document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }
        const range = selection.getRangeAt(0);
        if (range.startContainer.nodeType !== Node.TEXT_NODE) {
            return null;
        }

        const nodeText = (range.startContainer as Text).data.slice(0, range.startOffset);
        const nodePattern = /(?:^|[\s([{\u200B\u00A0])\/([-\p{L}\p{N}_.]*)$/u;
        return nodeText.match(nodePattern);
    }

    private matchSlashTriggerWithinCurrentBlock(): RegExpMatchArray | null {
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

        const blockPattern = /(?:^|[\s([{\u200B\u00A0])\/([-\p{L}\p{N}_.]*)$/u;

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
                const match = (candidate.textContent ?? '').match(blockPattern);
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
        return blockText.match(blockPattern);
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

        this.focusEditor();
        let selection = this.document.getSelection();

        if (!selection || selection.rangeCount === 0 || !editor.contains(selection.getRangeAt(0).startContainer)) {
            if (this.savedRange && editor.contains(this.savedRange.startContainer)) {
                selection = this.document.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(this.savedRange);
                }
            }
        }

        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const triggerLength = query.length + 1;
            const triggerStr = trigger + query;

            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                const textNode = range.startContainer as Text;
                const deleteStart = Math.max(0, range.startOffset - triggerLength);
                range.setStart(textNode, deleteStart);
            } else {
                const container = range.startContainer;
                const offset = range.startOffset;
                let resolved = false;

                if (offset > 0 && container.childNodes.length >= offset) {
                    let node: Node | null = container.childNodes[offset - 1];
                    while (node && !resolved) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            const text = node as Text;
                            if (text.data.endsWith(triggerStr)) {
                                range.setStart(text, text.length - triggerLength);
                                range.setEnd(text, text.length);
                                resolved = true;
                            }
                            break;
                        }
                        node = node.lastChild;
                    }
                }

                if (!resolved) {
                    const walker = this.document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
                    while (walker.nextNode()) {
                        const text = walker.currentNode as Text;
                        const idx = text.data.lastIndexOf(triggerStr);
                        if (idx !== -1) {
                            range.setStart(text, idx);
                            range.setEnd(text, idx + triggerStr.length);
                            break;
                        }
                    }
                }
            }
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
        const raw = options.buildUrl
            ? options.buildUrl(context)
            : options.urlTemplate
                ? this.resolveEntityTemplate(options.urlTemplate, context)
                : '';
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
            element.setAttribute('data-mention', context.value);
            element.setAttribute('data-mention-id', context.id);
        } else {
            element.setAttribute('data-tag', context.value);
            element.setAttribute('data-tag-id', context.id);
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
            .replace(/@@([a-zA-Z0-9_-]+)@@/g, (_match, token: string) => values[token] ?? '')
            .replace(/:([a-zA-Z][a-zA-Z0-9_-]*)/g, (_match, token: string) => values[token] ?? _match);
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
        const before = textNode.data.slice(0, originalOffset).replace(/\u200B/g, '').length;
        textNode.data = textNode.data.replace(/\u200B/g, '');

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
        return this.el.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement | null;
    }

    private syncContentFromEditor(): void {
        const editorElement = this.getEditorElement();
        if (editorElement) {
            const html = this.sanitizer.sanitize(editorElement.innerHTML).replace(/\u200B/g, '');
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
        const selected = list.querySelector(`[data-slash-index="${selectedIndex}"]`) as HTMLElement | null;
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
        if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
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
        if (!editor || !editor.contains(anchorBlock)) {
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
            editor.insertBefore(wrapper, node);
            wrapper.appendChild(node);
            return wrapper;
        }

        let current: Node | null = node;
        while (current && current.parentNode && current.parentNode !== editor) {
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
            let target: Text | null = null;
            const walker = this.document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
                const textNode = walker.currentNode as Text;
                if (textNode.data.includes('\u200B')) {
                    target = textNode;
                }
            }
            if (!target) {
                target = this.document.createTextNode('\u200B');
                if (block.firstChild) {
                    block.insertBefore(target, block.firstChild);
                } else {
                    block.appendChild(target);
                }
            }

            const range = this.document.createRange();
            range.setStart(target, target.length);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
        }

        let target: Node = block;
        while (target.lastChild) {
            target = target.lastChild;
        }

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
        const text = (block.textContent ?? '').replace(/\u200B/g, '').trim();
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
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n');
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

    private pushHistory(): void {
        const currentHtml = this.htmlContent();
        const lastEntry = this.history[this.history.length - 1];
        if (lastEntry && lastEntry.html === currentHtml) {
            return;
        }
        const previewData = this.buildHistoryPreview(currentHtml);

        const entry: HistoryEntry = {
            html: currentHtml,
            selection: this.captureSelection(),
            timestamp: Date.now(),
            preview: previewData.preview,
            previewLines: previewData.previewLines,
            lineCount: previewData.lineCount,
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
        this.bumpHistoryVersion();
    }

    private undo(): void {
        this.flushPendingHistoryPush();
        if (this.historyIndex > 0) {
            this.isUndoRedo = true;
            this.historyIndex--;
            const entry = this.history[this.historyIndex];
            this.htmlContent.set(entry.html);

            if (this.editorDiv?.nativeElement) {
                this.editorDiv.nativeElement.innerHTML = entry.html;
            }
            this.restoreSerializedSelection(entry.selection);

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(entry.html)
                : entry.html;
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
            this.htmlContent.set(entry.html);

            if (this.editorDiv?.nativeElement) {
                this.editorDiv.nativeElement.innerHTML = entry.html;
            }
            this.restoreSerializedSelection(entry.selection);

            const outputValue = this.mode() === 'markdown'
                ? this.markdownService.toMarkdown(entry.html)
                : entry.html;
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
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
            .replace(/<li[^>]*>/gi, '• ');
        const plain = this.sanitizer.stripTags(blockAware);
        const lines = plain
            .split('\n')
            .map(line => line.replace(/<\/?[^>]+>/g, '').replace(/\s+/g, ' ').trim())
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
            const firstAction = root.querySelector(selector) as HTMLElement | null;
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
            listContainer.querySelectorAll('[data-history-entry-action="true"]')
        ) as HTMLElement[];
    }

    private getHistoryListType(from: HTMLElement): 'popover' | 'dialog' | null {
        const listContainer = from.closest('[data-history-list]');
        const type = listContainer?.getAttribute('data-history-list');
        if (type === 'popover' || type === 'dialog') {
            return type;
        }
        return null;
    }

    private focusHistoryEntrySoon(listType: 'popover' | 'dialog', entryIndex: number): void {
        setTimeout(() => {
            const root = this.el.nativeElement as HTMLElement;
            const selector = `[data-history-list="${listType}"] [data-history-entry-index="${entryIndex}"]`;
            const target = root.querySelector(selector) as HTMLElement | null;
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
    }
}
