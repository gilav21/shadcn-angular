import type { Observable } from 'rxjs';

/**
 * A user/entity candidate for the `@mention` popover. Return an array of these
 * from your `[uiRteMentionsSearch]` function. The popover displays `label` as
 * the primary text and `description` as secondary text; `avatar` renders as a
 * circular thumbnail, otherwise the first letter of `label` is shown.
 */
export interface MentionItem {
    /** Unique identifier. Falls back to `value` when omitted. */
    id?: string;
    /** Machine-friendly value (username/slug); stored in `data-mention`. */
    value: string;
    /** Human-readable display name (e.g. `"@Jane Doe"`). */
    label: string;
    /** Avatar image URL, rendered as a 24×24 circular thumbnail. */
    avatar?: string;
    /** Secondary text shown below the label (e.g. job title). */
    description?: string;
}

/**
 * A tag candidate for the `#tag` popover. Return an array of these from your
 * `[uiRteTagsSearch]` function. The popover shows a small colored dot next to
 * the `label`.
 */
export interface TagItem {
    /** Unique identifier. Falls back to `value` when omitted. */
    id?: string;
    /** Machine-friendly value (slug); stored in `data-tag`. */
    value: string;
    /** Human-readable tag name. */
    label: string;
    /** CSS color for the dot indicator; defaults to the theme accent. */
    color?: string;
}

/** Discriminator for entity types the editor can insert inline. */
export type RichTextEntityType = 'mention' | 'tag';

/**
 * How an inserted entity (mention or tag) is rendered.
 * - `'chip'` — styled inline `<span>` pill (default).
 * - `'link'` — `<a>` element (needs `urlTemplate`/`buildUrl`; falls back to chip).
 * - `'text'` — plain inline `<span>`; style via `className`.
 */
export type RichTextEntityRenderMode = 'chip' | 'link' | 'text';

/** Return type for entity search functions: array, Promise, or Observable. */
export type RichTextEntitySearchResult<T> = Observable<T[]> | Promise<T[]> | T[];

/**
 * A function that searches for entity candidates for the user's query text,
 * called on every keystroke after the trigger character (`@` or `#`).
 */
export type RichTextEntitySearchFn<T> = (query: string) => RichTextEntitySearchResult<T>;

/**
 * Context passed to `buildUrl`/`buildText` and used to resolve URL/text
 * templates. Its fields are also available as template tokens.
 */
export interface RichTextEntityRenderContext {
    /** Whether this is a `'mention'` (`@`) or `'tag'` (`#`). */
    type: RichTextEntityType;
    /** The trigger character that opened the popover. */
    trigger: '@' | '#';
    /** Unique id (`item.id ?? item.value`). */
    id: string;
    /** The raw `value` from the selected item. */
    value: string;
    /** The human-readable `label` from the selected item. */
    label: string;
    /** The text typed after the trigger when the item was selected. */
    query: string;
    /** The full selected item object. */
    item: MentionItem | TagItem;
    /** Alias for `id`, convenient in mention URL templates. */
    userId: string;
    /** Alias for `id`, convenient in tag URL templates. */
    tagId: string;
}

/**
 * Controls how an inserted mention or tag is rendered. Supply via
 * `[uiRteMentionsRender]` or `[uiRteTagsRender]`.
 */
export interface RichTextEntityRenderOptions {
    /** Rendering strategy. @default 'chip' */
    mode?: RichTextEntityRenderMode;
    /**
     * URL pattern with `@@token@@` or `:token` placeholders (`mode: 'link'`).
     * Tokens: `id`, `value`, `label`, `query`, `type`, `userId`, `tagId`.
     */
    urlTemplate?: string;
    /** Display-text pattern, same token syntax. Defaults to `trigger + label`. */
    textTemplate?: string;
    /** CSS class(es) applied to the rendered element (overrides the defaults). */
    className?: string;
    /** `target` for `<a>` (`mode: 'link'`). @default '_blank' */
    target?: string;
    /** `rel` for `<a>` (`mode: 'link'`). @default 'noopener noreferrer' */
    rel?: string;
    /** Dynamic URL builder; takes priority over `urlTemplate`. */
    buildUrl?: (context: RichTextEntityRenderContext) => string;
    /** Dynamic text builder; takes priority over `textTemplate`. */
    buildText?: (context: RichTextEntityRenderContext) => string;
}

/**
 * Event payload emitted via `(mentionInsert)` / `(tagInsert)` when an entity is
 * selected from the popover and inserted.
 */
export interface RichTextEntityInsertEvent {
    /** Whether this is a `'mention'` or `'tag'`. */
    type: RichTextEntityType;
    /** The trigger character. */
    trigger: '@' | '#';
    /** Unique identifier (`item.id ?? item.value`). */
    id: string;
    /** The raw `value` from the selected item. */
    value: string;
    /** The human-readable display name. */
    label: string;
    /** The search text typed when the selection was made. */
    query: string;
    /** The resolved URL, when rendered as a link. */
    url?: string;
    /** The inserted element's outer HTML. */
    html: string;
    /** The full selected item object. */
    item: MentionItem | TagItem;
}
