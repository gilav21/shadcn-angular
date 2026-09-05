import type {
    MentionItem,
    TagItem,
    RichTextEntityRenderContext,
    RichTextEntityRenderMode,
    RichTextEntityRenderOptions,
    RichTextEntityType,
} from './rich-text-mentions.types';

/** A detected `@`/`#` trigger at the caret. */
export interface TriggerMatch {
    readonly type: RichTextEntityType;
    readonly query: string;
}

const MENTION_TRIGGER = /(?:^|[\s([{])@([-\p{L}\p{N}_.]*)$/u;
const TAG_TRIGGER = /(?:^|[\s([{])#([-\p{L}\p{N}_.]*)$/u;

/** The text immediately before a collapsed caret within its text node. */
function textBeforeCaret(doc: Document): string | null {
    const sel = doc.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
        return (node as Text).data.slice(0, range.startOffset);
    }
    return node.textContent?.slice(0, range.startOffset) ?? '';
}

/**
 * Detect a `@mention` or `#tag` trigger at the caret. Reads the caret's text
 * node directly (rather than a flattened editor string) so it stays correct
 * regardless of surrounding markup.
 */
export function detectTrigger(doc: Document, allowMention: boolean, allowTag: boolean): TriggerMatch | null {
    const before = textBeforeCaret(doc);
    if (before === null) return null;
    if (allowMention) {
        const m = MENTION_TRIGGER.exec(before);
        if (m) return { type: 'mention', query: m[1] };
    }
    if (allowTag) {
        const t = TAG_TRIGGER.exec(before);
        if (t) return { type: 'tag', query: t[1] };
    }
    return null;
}

/** Build the render context for a selected entity item. */
export function buildEntityRenderContext(
    item: MentionItem | TagItem,
    type: RichTextEntityType,
    trigger: '@' | '#',
    query: string,
): RichTextEntityRenderContext {
    const id = item.id ?? item.value;
    return { type, trigger, id, value: item.value, label: item.label, query, item, userId: id, tagId: id };
}

function resolveEntityTemplate(template: string, context: RichTextEntityRenderContext): string {
    const values: Record<string, string> = {
        id: context.id, value: context.value, label: context.label,
        query: context.query, type: context.type, userId: context.userId, tagId: context.tagId,
    };
    return template
        .replaceAll(/@@([a-zA-Z0-9_-]+)@@/g, (_m, token: string) => values[token] ?? '')
        .replaceAll(/:([a-zA-Z][a-zA-Z0-9_-]*)/g, (match, token: string) => values[token] ?? match);
}

function resolveEntityText(context: RichTextEntityRenderContext, options: RichTextEntityRenderOptions): string {
    if (options.buildText) return options.buildText(context);
    if (options.textTemplate) return resolveEntityTemplate(options.textTemplate, context);
    return `${context.trigger}${context.label}`;
}

function resolveEntityUrl(
    context: RichTextEntityRenderContext,
    options: RichTextEntityRenderOptions,
    sanitizeUrl: (url: string) => string | null,
): string | null {
    let raw = '';
    if (options.buildUrl) {
        raw = options.buildUrl(context);
    } else if (options.urlTemplate) {
        raw = resolveEntityTemplate(options.urlTemplate, context);
    }
    return raw ? sanitizeUrl(raw) : null;
}

function applyEntityBaseAttributes(element: HTMLElement, context: RichTextEntityRenderContext): void {
    element.setAttribute('contenteditable', 'false');
    if (context.type === 'mention') {
        element.dataset['mention'] = context.value;
        element.dataset['mentionId'] = context.id;
    } else {
        element.dataset['tag'] = context.value;
        element.dataset['tagId'] = context.id;
    }
}

function createEntitySpanElement(
    doc: Document,
    context: RichTextEntityRenderContext,
    text: string,
    mode: RichTextEntityRenderMode,
    customClassName?: string,
): HTMLElement {
    const span = doc.createElement('span');
    applyEntityBaseAttributes(span, context);
    span.className = mode === 'text'
        ? (customClassName ?? '')
        : (customClassName ?? 'bg-accent text-accent-foreground rounded px-1');
    span.textContent = text;
    return span;
}

function createEntityLinkElement(
    doc: Document,
    context: RichTextEntityRenderContext,
    text: string,
    options: RichTextEntityRenderOptions,
    sanitizeUrl: (url: string) => string | null,
): HTMLElement {
    const safeUrl = resolveEntityUrl(context, options, sanitizeUrl);
    if (!safeUrl) {
        return createEntitySpanElement(doc, context, text, 'chip', options.className);
    }
    const link = doc.createElement('a');
    applyEntityBaseAttributes(link, context);
    link.href = safeUrl;
    link.target = options.target ?? '_blank';
    link.rel = options.rel ?? 'noopener noreferrer';
    link.className = options.className ?? 'bg-accent/20 text-primary rounded px-1 underline underline-offset-2';
    link.textContent = text;
    return link;
}

/** Build the DOM node to insert for a selected entity, honoring the render mode. */
export function buildEntityInsertNode(
    doc: Document,
    context: RichTextEntityRenderContext,
    options: RichTextEntityRenderOptions,
    sanitizeUrl: (url: string) => string | null,
): { element: HTMLElement; url?: string } {
    const mode = options.mode ?? 'chip';
    const text = resolveEntityText(context, options);
    const element = mode === 'link'
        ? createEntityLinkElement(doc, context, text, options, sanitizeUrl)
        : createEntitySpanElement(doc, context, text, mode, options.className);
    const url = element.tagName === 'A' ? (element.getAttribute('href') ?? undefined) : undefined;
    return { element, url };
}

/**
 * Expand `range` to cover the `triggerStr` (`@query`/`#query`) that ends at the
 * caret, so it can be deleted before the entity node is inserted. Mirrors the
 * former base range-resolution across text/element boundaries.
 */
export function selectTriggerRange(doc: Document, range: Range, triggerStr: string, root: HTMLElement): void {
    const triggerLength = triggerStr.length;
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer as Text;
        range.setStart(textNode, Math.max(0, range.startOffset - triggerLength));
        return;
    }
    if (selectTriggerFromContainer(range, triggerStr, triggerLength)) return;
    selectTriggerFromEditor(doc, range, triggerStr, root);
}

function selectTriggerFromContainer(range: Range, triggerStr: string, triggerLength: number): boolean {
    const container = range.startContainer;
    const offset = range.startOffset;
    if (offset <= 0 || container.childNodes.length < offset) return false;
    let node: Node | null = container.childNodes[offset - 1];
    while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node as Text;
            if (!text.data.endsWith(triggerStr)) return false;
            range.setStart(text, text.length - triggerLength);
            range.setEnd(text, text.length);
            return true;
        }
        node = node.lastChild;
    }
    return false;
}

function selectTriggerFromEditor(doc: Document, range: Range, triggerStr: string, root: HTMLElement): void {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
