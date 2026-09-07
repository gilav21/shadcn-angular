import { Injectable, inject } from '@angular/core';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';

/**
 * A serializer an addon registers to control how specific spans become
 * markdown. Consulted before the built-in mention/tag handling.
 */
export interface MarkdownSpanSerializer {
    /** Return markdown / inline-HTML for this span, or null to pass to the next handler. */
    serialize(element: HTMLElement, innerMarkdown: string): string | null;
}

type ListType = 'ul' | 'ol' | 'task';

interface ListContext {
    type: ListType;
    items: string[];
    indent: number;
    children: (ListContext | undefined)[];
}

interface ParsedListLine {
    indent: number;
    type: ListType;
    content: string;
}

function parseListLine(line: string): ParsedListLine | null {
    const taskMatch = new RegExp(/^(\s*)[-*+]\s+\[([ xX])\]\s*(\S.*|)$/).exec(line);
    if (taskMatch) {
        const checked = taskMatch[2] !== ' ';
        return {
            indent: taskMatch[1].length,
            type: 'task',
            content: `[${checked ? 'x' : ' '}] ${taskMatch[3]}`,
        };
    }

    const ulMatch = new RegExp(/^(\s*)[-*+]\s+(\S.*|\s)$/).exec(line);
    if (ulMatch) {
        return { indent: ulMatch[1].length, type: 'ul', content: ulMatch[2] };
    }

    const olMatch = new RegExp(/^(\s*)\d+\.\s+(\S.*|\s)$/).exec(line);
    if (olMatch) {
        return { indent: olMatch[1].length, type: 'ol', content: olMatch[2] };
    }

    return null;
}

function pushListItem(
    stack: ListContext[],
    rootLists: ListContext[],
    type: ListType,
    content: string,
    indent: number,
): void {
    if (stack.length === 0) {
        const ctx: ListContext = { type, items: [content], indent, children: [] };
        rootLists.push(ctx);
        stack.push(ctx);
        return;
    }

    const parent = stack.at(-1);
    if (!parent) return;
    if (indent > parent.indent) {
        const child: ListContext = { type, items: [content], indent, children: [] };
        parent.children[parent.items.length - 1] = child;
        stack.push(child);
    } else {
        parent.items.push(content);
        parent.children.push(undefined);
    }
}

function buildListContextHtml(ctx: ListContext): string {
    const tag = ctx.type === 'task' ? 'ul' : ctx.type;
    const taskAttr = ctx.type === 'task' ? ' data-task-list' : '';
    const items = ctx.items.map((item, i) => {
        const child = ctx.children[i];
        const childHtml = child ? buildListContextHtml(child) : '';
        if (ctx.type === 'task') {
            const checked = item.startsWith('[x] ') || item.startsWith('[X] ');
            const text = item.replace(/^\[[ xX]\]\s*/, '');
            const checkedAttr = checked ? ' checked' : '';
            return `<li data-task data-checked="${checked}">`
                + `<input type="checkbox"${checkedAttr} /><span>${text}</span>${childHtml}</li>`;
        }
        return `<li>${item}${childHtml}</li>`;
    });
    return `<${tag}${taskAttr}>${items.join('')}</${tag}>`;
}

/**
 * Service for converting between Markdown and HTML.
 * Zero external dependencies - uses regex and DOM APIs.
 * 
 * Supports:
 * - Headings (# - ######)
 * - Bold (**text** or __text__)
 * - Italic (*text* or _text_)
 * - Strikethrough (~~text~~)
 * - Links [text](url)
 * - Images ![alt](src)
 * - Unordered lists (- or * or +)
 * - Ordered lists (1. 2. 3.)
 * - Blockquotes (>)
 * - Code blocks (``` or indented)
 * - Inline code (`code`)
 * - Horizontal rules (--- or ***)
 * - Line breaks
 */
/**
 * Link and image targets, allowing ONE level of balanced parentheses.
 *
 * Stopping at the first `)` truncated Wikipedia-style URLs — a mainstream
 * case, not adversarial input — leaving a broken link and dumping the rest of
 * the URL on the page as visible text.
 */
const MEDIA_TARGET_PATTERN = {
    image: /!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g,
    link: /\[([^\]]{1,4096})\]\(((?:[^()]|\([^()]*\)){1,4096})\)/g,
} as const;

/**
 * Marker standing in for a character with Markdown meaning while the emphasis
 * passes run. Those passes regex over the WHOLE string, attribute values
 * included, so a `*` in a query string became `<em>` and the link silently
 * pointed somewhere else. Private-use code points cannot occur in real input.
 */
const URL_SHIELD: ReadonlyArray<readonly [string, string]> = [
    ['*', '\uE100'],
    ['_', '\uE101'],
    ['`', '\uE102'],
    ['~', '\uE103'],
];

/**
 * Any HTML tag written in the source. Whether it SURVIVES is the sanitizer's
 * call, made in `escapeHtmlInContent`; protecting it here only keeps the
 * emphasis and inline-code passes from chewing on tag internals. Both halves of
 * a pair are matched so the escape pass cannot split them -- an earlier version
 * listed seven tags by hand, so `<b>x</b>` rendered a literal `</b>` and
 * corrupted permanently on round-trip.
 */
const PASSTHROUGH_TAG_PATTERN = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]{0,4096}>/g;

/** Private-use delimiters parking a fenced code block during the inline passes. */
/** A block whose first token is a parked raw tag: already markup, not prose. */
const RAW_TAG_ONLY_BLOCK = /^(\d{1,9})/;

/** Block-level tags: a parked one of these means the block is already markup. */
const BLOCK_LEVEL_TAG_PATTERN = /^<(?:p|div|h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td|hr|figure|details|summary)\b/i;

/** An indented line holding nothing but a parked code fence. */
const INDENTED_FENCE_TOKEN = /^\s+\d{1,9}\s*$/;

const CODE_FENCE_OPEN = '';
const CODE_FENCE_CLOSE = '';

/**
 * Tags the sanitizer removes together with everything inside them. They are
 * passed through the escape untouched so it is the sanitizer, not the reader,
 * that sees them.
 */
const CONTENT_BEARING_UNSAFE_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'title', 'textarea']);

@Injectable({ providedIn: 'root' })
export class RichTextMarkdownService {
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly spanSerializers: MarkdownSpanSerializer[] = [];

    /**
     * Register a span serializer consulted before the built-in mention/tag
     * handling in {@link toMarkdown}. Returns a teardown that unregisters it.
     */
    registerSpanSerializer(serializer: MarkdownSpanSerializer): () => void {
        this.spanSerializers.push(serializer);
        return () => {
            const i = this.spanSerializers.indexOf(serializer);
            if (i !== -1) this.spanSerializers.splice(i, 1);
        };
    }

    /**
     * Convert Markdown to sanitized HTML. Block constructs are parsed before
     * inline ones — the order of the passes below is load-bearing.
     */
    toHtml(markdown: string): string {
        if (!markdown) return '';

        let html = markdown;

        html = html.replaceAll('\r\n', '\n');

        // Fenced code is lifted out FIRST -- before raw-tag protection and
        // before any escaping. A fence is inert text by definition: what is
        // inside it must reach the reader as characters, never as markup. While
        // it stayed inline, protectRawTags lifted <span> out of fence bodies and
        // restored it live afterwards (so markup hidden in a fence became a real
        // element, forging data-mention identity claims), and the body was
        // escaped twice -- once by escapeHtmlInContent, once by parseCodeBlocks
        // -- rendering "</div>" as visible "&lt;/div&gt;".
        const protectedCode: string[] = [];
        html = this.protectCodeFences(html, protectedCode);

        const protectedTags: string[] = [];
        html = this.protectRawTags(html, protectedTags);

        html = this.escapeHtmlInContent(html);
        html = this.parseToggleBlocks(html);
        html = this.parseBlockquotes(html);
        html = this.parseHeadings(html);
        html = this.parseLists(html);
        // Before horizontal rules: a table's `| --- |` separator row would
        // otherwise be swallowed as an <hr>.
        html = this.parseTables(html);
        html = this.parseHorizontalRules(html);
        html = this.parseParagraphs(html, protectedTags);

        html = this.parseImages(html);
        html = this.parseLinks(html);
        html = this.parseBoldItalic(html);
        html = this.parseStrikethrough(html);
        html = this.parseInlineCode(html);
        html = this.parseLineBreaks(html);

        // After the emphasis passes, so the characters hidden in link and image
        // targets come back exactly as the author typed them.
        html = this.unshieldUrls(html);

        html = this.restoreRawTags(html, protectedTags);
        html = this.restoreCodeFences(html, protectedCode);

        return this.sanitizer.sanitize(html);
    }

    /**
     * Replace every raw `<span …>` / `</span>` tag and `data-action-*` image
     * tag with a placeholder token the markdown pipeline treats as opaque
     * text, so escaping and block parsing leave the tag intact while its inner
     * content is still processed. The restored tags are re-sanitized, so
     * protecting non-action spans (rare in markdown) is harmless. Any private-
     * use delimiter chars already in the input are stripped first so user
     * content can never spoof a token.
     */
    /**
     * Whether a tag written in the source is markup or prose about markup.
     *
     * An author writing "the <table> element has <tr> children" means those as
     * words; treating them as markup turned the sentence into a real table with
     * the prose swallowed into a cell. Real markup comes in matched pairs, so an
     * unpaired non-void tag is text.
     */
    private isMarkupTag(tagName: string, paired: ReadonlySet<string>): boolean {
        if (!this.sanitizer.isAllowedTag(tagName)) return false;
        const lower = tagName.toLowerCase();
        return paired.has(lower) || VOID_TAGS.has(lower);
    }

    private protectRawTags(markdown: string, store: string[]): string {
        const cleaned = markdown.replaceAll(/[]/g, '');
        const push = (match: string): string => {
            const token = `${store.length}`;
            store.push(match);
            return token;
        };
        return perBlock(cleaned, (block, paired) => block
            // Inline formatting tags Markdown has no syntax for (u, sub, sup,
            // mark...) are emitted verbatim by toMarkdown, so toHtml must return
            // them unchanged. Protecting the CLOSING tag matters as much as the
            // opening one: escapeHtmlInContent let "<u>" through (u matches \w)
            // but escaped "</u>" (/ does not), so every round-trip appended
            // another visible "</u>" and the damage compounded per save/load.
            .replaceAll(PASSTHROUGH_TAG_PATTERN, (match: string, tagName: string) =>
                this.isMarkupTag(tagName, paired) ? push(match) : match,
            )
            .replaceAll(/<span\b[^>]{0,4096}>/gi, push)
            .replaceAll(/<\/span>/gi, push)
            .replaceAll(/<img\b[^>]{0,4096}\bdata-action-[\w-]{1,64}[^>]{0,4096}>/gi, push));
    }

    /**
     * Lift fenced code bodies out of the source before anything else touches
     * them, already converted to their final `<pre><code>` form. Restored after
     * every inline pass, so a fence is inert text: escaped exactly once, and
     * with no markup smuggled through it into the live document.
     */
    private protectCodeFences(markdown: string, store: string[]): string {
        // Strip our own delimiters from the input first, exactly as
        // protectRawTags does for its pair. Without this a document could carry
        // U+E110/U+E111 itself and forge a token: restoreCodeFences would expand
        // it, so a fence body the author wrote once rendered twice, and an
        // out-of-range index silently erased surrounding text.
        // The opening fence's own line prefix ("> " in a quote, indentation in
        // a list item) is captured and stripped from every body line, then kept
        // on the placeholder so the surrounding block still parses. Lifting the
        // fence before blockquote and list parsing baked those markers INTO the
        // code, and each round-trip added another level -- the same compounding
        // corruption the lift was introduced to stop, reintroduced for nesting.
        return markdown.replaceAll(CODE_FENCE_OPEN, '').replaceAll(CODE_FENCE_CLOSE, '').replaceAll(
            FENCE_PATTERN,
            (_match, prefix: string, _fence: string, lang: string, code: string) => {
                const langAttr = lang ? ` data-language="${lang}" class="language-${lang}"` : '';
                const token = `${prefix}${CODE_FENCE_OPEN}${store.length}${CODE_FENCE_CLOSE}`;
                const body = stripBlockPrefix(code, prefix);
                store.push(`<pre><code${langAttr}>${this.escapeHtml(body.trimEnd())}</code></pre>`);
                return token;
            },
        );
    }

    private restoreCodeFences(html: string, store: string[]): string {
        return html.replaceAll(/(\d{1,9})/g, (_match, index: string) => store[Number(index)] ?? '');
    }


    private restoreRawTags(html: string, store: string[]): string {
        return html.replaceAll(/(\d{1,9})/g, (_match, index: string) => store[Number(index)] ?? '');
    }

    /**
     * Escape HTML entities but preserve Markdown syntax. Only `<`/`>` that look
     * like HTML tags are escaped, so characters carrying Markdown meaning survive.
     */
    private escapeHtmlInContent(text: string): string {

        return perBlock(text, (block, paired) => block
            .replaceAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]{0,4096}>|</g, (match, tagName?: string) => {
                if (!tagName) return '&lt;';
                const lower = tagName.toLowerCase();
                if (this.sanitizer.isAllowedTag(tagName) && (paired.has(lower) || VOID_TAGS.has(lower))) {
                    return match;
                }
                // Tags whose CONTENT must not survive are left intact so the
                // sanitizer removes the whole subtree. Escaping them here would
                // turn a stripped <script> body into visible page text -- safe
                // to look at, but the payload would still be sitting in the
                // user's document.
                if (CONTENT_BEARING_UNSAFE_TAGS.has(tagName.toLowerCase())) return match;
                return '&lt;' + match.slice(1);
            })
            // `^` alongside the lookbehind: at index 0 there is no preceding
            // character for the lookbehind to test, so a document that OPENS with
            // a blockquote had its ">" escaped to text before parseBlockquotes
            // ever ran — the first line rendered literally while later ones
            // quoted correctly.
            .replaceAll(/(?<!^)(?<![\s\w*`~[\]!#-])>/gm, '&gt;'));
    }

    /**
     * Parse blockquotes (> text).
     */
    private parseToggleBlocks(html: string): string {
        return html.replaceAll(/:::details[^\S\n]{1,4096}([^\n]{0,4096})\n([\s\S]{0,100000}?):::/g, (_match, title: string, content: string) => {
            const parsedContent = content.trim();
            return `<details open><summary>${title}</summary><p>${parsedContent}</p></details>`;
        });
    }

    /**
     * Wrap quoted lines, running the list parser over them first.
     *
     * The body used to be joined with `<br>` and never parsed, so a list inside
     * a quote stayed literal text -- and because `toMarkdown` then re-emitted it
     * as text with the `<br>` becoming trailing whitespace, the document grew
     * two characters on every save/load, forever. Quoted lists are ordinary
     * content; they get the ordinary treatment.
     */
    private buildBlockquote(lines: readonly string[]): string {
        const listed = this.parseLists(lines.join('\n'));
        const body = listed.includes('<ul') || listed.includes('<ol')
            ? listed
            : lines.join('<br>');
        return `<blockquote>${body}</blockquote>`;
    }

    private parseBlockquotes(html: string): string {
        const lines = html.split('\n');
        const result: string[] = [];
        let inBlockquote = false;
        let blockquoteContent: string[] = [];

        for (const line of lines) {
            if (line.startsWith('> ') || line === '>') {
                inBlockquote = true;
                blockquoteContent.push(line.replace(/^>\s?/, ''));
            } else {
                if (inBlockquote) {
                    result.push(this.buildBlockquote(blockquoteContent));
                    blockquoteContent = [];
                    inBlockquote = false;
                }
                result.push(line);
            }
        }

        if (inBlockquote) {
            result.push(this.buildBlockquote(blockquoteContent));
        }

        return result.join('\n');
    }

    /**
     * Parse headings (# - ######).
     */
    private parseHeadings(html: string): string {
        return html.replaceAll(/^(#{1,6})\s+(\S.*|\s)$/gm, (_, hashes, content) => {
            const level = hashes.length;
            return `<h${level}>${content}</h${level}>`;
        });
    }

    /**
     * Parse unordered and ordered lists.
     */
    private parseLists(html: string): string {
        const lines = html.split('\n');
        const result: string[] = [];

        const stack: ListContext[] = [];
        let rootLists: ListContext[] = [];

        const flushStack = (): void => {
            for (const ctx of rootLists) {
                result.push(buildListContextHtml(ctx));
            }
            rootLists = [];
            stack.length = 0;
        };

        for (const line of lines) {
            const parsed = parseListLine(line);

            if (!parsed) {
                // An indented parked code fence belongs to the item above it, not
                // to the document. Flushing here dropped the fence outside the
                // list and split the list around it.
                const openList = stack.at(-1);
                if (openList?.items.length && INDENTED_FENCE_TOKEN.test(line)) {
                    openList.items[openList.items.length - 1] += line.trim();
                    continue;
                }
                flushStack();
                result.push(line);
                continue;
            }

            const { indent, type, content } = parsed;

            // Pop only DEEPER levels. Popping the current one too (`>=`) threw
            // away the list a sibling belongs to, so every line started a fresh
            // one — an ordered list renumbered from 1 on every row, and a screen
            // reader announced "list, 1 item" over and over.
            while (stack.length > 0 && (stack.at(-1)?.indent ?? -1) > indent) {
                stack.pop();
            }
            // A same-indent line of a DIFFERENT kind (bullet after numbered) is
            // its own list, so that one context is replaced rather than appended.
            if (stack.at(-1)?.indent === indent && stack.at(-1)?.type !== type) {
                stack.pop();
            }

            pushListItem(stack, rootLists, type, content, indent);
        }

        flushStack();
        return result.join('\n');
    }

    /**
     * Parse GFM tables back into real table markup.
     *
     * `tableToMarkdown` has always emitted them, but nothing read them back —
     * so in markdown mode (the documented default) a save followed by a reload
     * turned every table into inert paragraph text that merely looked like a
     * table's source. A run needs a header row, a separator row of dashes, and
     * at least the header to be pipe-delimited; anything else is left alone so
     * a sentence containing a pipe stays a sentence.
     */
    private parseTables(html: string): string {
        const lines = html.split('\n');
        const out: string[] = [];

        let i = 0;
        while (i < lines.length) {
            const header = lines[i];
            const separator = lines[i + 1];
            if (!this.isTableRow(header) || !this.isTableSeparator(separator ?? '')) {
                out.push(header);
                i++;
                continue;
            }

            const bodyRows: string[][] = [];
            let cursor = i + 2;
            while (cursor < lines.length && this.isTableRow(lines[cursor])) {
                bodyRows.push(this.splitTableRow(lines[cursor]));
                cursor++;
            }

            out.push(this.buildTableHtml(this.splitTableRow(header), bodyRows));
            i = cursor;
        }

        return out.join('\n');
    }

    /** Assemble the table markup from its parsed header and body cells. */
    private buildTableHtml(headerCells: string[], bodyRows: string[][]): string {
        const cells = (row: string[], tag: 'th' | 'td'): string =>
            row.map(cell => '<' + tag + '>' + cell + '</' + tag + '>').join('');
        const head = '<thead><tr>' + cells(headerCells, 'th') + '</tr></thead>';
        const body = bodyRows.map(row => '<tr>' + cells(row, 'td') + '</tr>').join('');
        return '<table>' + head + '<tbody>' + body + '</tbody></table>';
    }

    /** A line that could be a table row: contains a pipe outside an escape. */
    private isTableRow(line: string): boolean {
        const trimmed = line.trim();
        return trimmed.includes('|') && trimmed.replaceAll('\\|', '').includes('|');
    }

    /** The `| --- | :--: |` row that makes the line above it a header. */
    private isTableSeparator(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
        return this.splitTableRow(trimmed).every(cell => /^:?-+:?$/.test(cell.trim()));
    }

    /** Cells of one row, honouring `\\|` escapes inside cell text. */
    private splitTableRow(line: string): string[] {
        const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
        const cells: string[] = [];
        let current = '';
        for (let i = 0; i < trimmed.length; i++) {
            const ch = trimmed[i];
            // A single backslash. The comparison was against a TWO-character
            // string that no single character can equal, so the escape never
            // fired: "x\|y" split into two cells and left the backslash
            // visible, giving a body row wider than its own header.
            if (ch === '\\' && trimmed[i + 1] === '|') {
                current += '|';
                i++;
                continue;
            }
            if (ch === '|') {
                cells.push(current.trim());
                current = '';
                continue;
            }
            current += ch;
        }
        cells.push(current.trim());
        return cells;
    }

    /**
     * Parse horizontal rules (---, ***, ___).
     */
    private parseHorizontalRules(html: string): string {
        return html.replaceAll(/^([-*_]){3,}\s*$/gm, '<hr>');
    }

    /**
     * Wrap remaining text in paragraphs.
     */
    /** Whether `block` opens with a parked tag that is block-level. */
    private startsWithParkedBlockTag(block: string, store: string[]): boolean {
        const match = RAW_TAG_ONLY_BLOCK.exec(block);
        if (!match) return false;
        const tag = store[Number(match[1])] ?? '';
        return BLOCK_LEVEL_TAG_PATTERN.test(tag);
    }

    private parseParagraphs(html: string, store: string[]): string {
        /** Split by double newlines (paragraph breaks) */
        const blocks = html.split(/\n\n+/);

        return blocks.map(block => {
            const trimmed = block.trim();

            if (/^<(h[1-6]|ul|ol|li|blockquote|pre|div|p|hr|table|details|figure)/i.test(trimmed)) {
                return trimmed;
            }

            // A parked code fence is a block, even though it currently looks
            // like a single placeholder character. Without this it gets wrapped
            // in a paragraph, and restoring the <pre> inside that <p> leaves a
            // stray empty <p></p> in the output.
            if (trimmed.startsWith(CODE_FENCE_OPEN)) {
                return trimmed;
            }

            // A block that OPENS with a parked block-level tag is markup the
            // author wrote directly -- "<p>Hello <b>World</b></p>" arrives as
            // tokens plus text, and wrapping it again produced
            // "<p></p><p>Hello…</p><p></p>". Inline-only content still gets its
            // paragraph, so "<b>x</b>" stays "<p><b>x</b></p>".
            if (this.startsWithParkedBlockTag(trimmed, store)) {
                return trimmed;
            }

            if (!trimmed) {
                return '';
            }

            return `<p>${trimmed}</p>`;
        }).filter(Boolean).join('\n');
    }

    /**
     * Parse images ![alt](src).
     */
    /** Hide Markdown-meaningful characters in a URL from the emphasis passes. */
    private shieldUrl(url: string): string {
        return URL_SHIELD.reduce((acc, [ch, code]) => acc.replaceAll(ch, code), url);
    }

    /** Restore the characters {@link shieldUrl} hid, once those passes are done. */
    private unshieldUrls(html: string): string {
        return URL_SHIELD.reduce((acc, [ch, code]) => acc.replaceAll(code, ch), html);
    }

    private parseImages(html: string): string {
        return html.replaceAll(MEDIA_TARGET_PATTERN.image, (_, alt, src) => {
            const safeSrc = this.sanitizer.sanitizeImageSrc(src);
            if (!safeSrc) return '';
            return `<img src="${this.shieldUrl(safeSrc)}" alt="${this.shieldUrl(this.escapeHtml(alt))}">`;
        });
    }

    /**
     * Parse links [text](url).
     */
    private parseLinks(html: string): string {
        return html.replaceAll(MEDIA_TARGET_PATTERN.link, (_, text, url) => {
            const safeUrl = this.sanitizer.sanitizeUrl(url);
            if (!safeUrl) return text;
            return `<a href="${this.shieldUrl(safeUrl)}" rel="noopener noreferrer">${text}</a>`;
        });
    }

    /**
     * Parse bold and italic, in this order so the longer delimiters win:
     *
     * 1. Bold + italic — `***text***` / `___text___`
     * 2. Bold — `**text**` / `__text__`
     * 3. Italic — `*text*` / `_text_`, ignoring mid-word underscores
     */
    private parseBoldItalic(html: string): string {
        html = html.replaceAll(/(\*\*\*|___)(.+?)\1/g, '<strong><em>$2</em></strong>');

        html = html.replaceAll(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');

        html = html.replaceAll(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
        html = html.replaceAll(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');

        return html;
    }

    /**
     * Parse strikethrough ~~text~~.
     */
    private parseStrikethrough(html: string): string {
        return html.replaceAll(/~~(.+?)~~/g, '<del>$1</del>');
    }

    /**
     * Parse inline code `code`.
     */
    private parseInlineCode(html: string): string {
        return html.replaceAll(/`([^`]+)`/g, '<code>$1</code>');
    }

    /**
     * Parse line breaks (two spaces + newline or explicit \n).
     */
    private parseLineBreaks(html: string): string {
        return html.replaceAll('  \n', '<br>\n');
    }

    /**
     * Escape HTML special characters.
     */
    private escapeHtml(text: string): string {
        return text
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    /**
     * Convert HTML to Markdown.
     * Used for paste handling and output conversion.
     */
    toMarkdown(html: string): string {
        if (!html) return '';

        /** First sanitize the HTML */
        const cleanHtml = this.sanitizer.sanitize(html);

        /** Parse into DOM */
        const parser = new DOMParser();
        const doc = parser.parseFromString(cleanHtml, 'text/html');

        return this.nodeToMarkdown(doc.body).trim();
    }

    /**
     * Recursively convert DOM node to Markdown.
     */
    private nodeToMarkdown(node: Node): string {
        const result: string[] = [];

        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                result.push(child.textContent ?? '');
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                result.push(this.elementToMarkdown(child as HTMLElement));
            }
        }

        return result.join('');
    }

    private elementToMarkdown(element: HTMLElement): string {
        const tagName = element.tagName.toLowerCase();
        const inner = this.nodeToMarkdown(element);

        const headingLevel = this.headingTagLevel(tagName);
        if (headingLevel > 0) {
            return `\n${'#'.repeat(headingLevel)} ${inner}\n`;
        }

        const inlineResult = this.inlineTagToMarkdown(tagName, inner, element);
        if (inlineResult !== null) return inlineResult;

        const blockResult = this.blockTagToMarkdown(tagName, inner, element);
        if (blockResult !== null) return blockResult;

        return inner;
    }

    private headingTagLevel(tagName: string): number {
        const match = /^h([1-6])$/.exec(tagName);
        return match ? Number(match[1]) : 0;
    }

    private inlineTagToMarkdown(tagName: string, inner: string, element: HTMLElement): string | null {
        switch (tagName) {
            case 'strong':
            case 'b':
                return `**${inner}**`;
            case 'em':
            case 'i':
                return `*${inner}*`;
            case 'del':
            case 's':
                return `~~${inner}~~`;
            case 'u':
                return `<u>${inner}</u>`;
            case 'code':
                return this.handleCodeTag(element, inner);
            case 'a':
                return this.handleAnchorTag(element, inner);
            case 'img':
                return this.handleImageTag(element);
            case 'span':
                return this.spanToMarkdown(element, inner);
            default:
                return null;
        }
    }

    private handleCodeTag(element: HTMLElement, inner: string): string {
        return element.parentElement?.tagName.toLowerCase() === 'pre' ? inner : `\`${inner}\``;
    }

    private handleAnchorTag(element: HTMLElement, inner: string): string {
        const href = element.getAttribute('href') ?? '';
        return `[${inner}](${href})`;
    }

    private handleImageTag(element: HTMLElement): string {
        const src = element.getAttribute('src') ?? '';
        const alt = element.getAttribute('alt') ?? '';
        return `![${alt}](${src})`;
    }

    private spanToMarkdown(element: HTMLElement, inner: string): string {
        for (const serializer of this.spanSerializers) {
            const out = serializer.serialize(element, inner);
            if (out !== null) return out;
        }
        if ('mention' in element.dataset) {
            return `@${element.dataset['mention']}`;
        }
        if ('tag' in element.dataset) {
            return `#${element.dataset['tag']}`;
        }
        return inner;
    }

    private blockTagToMarkdown(tagName: string, inner: string, element: HTMLElement): string | null {
        switch (tagName) {
            case 'pre':
                return this.handlePreTag(element);
            case 'ul':
                return this.handleUlTag(element);
            case 'ol':
                return this.handleOlTag(element);
            case 'li':
            case 'summary':
                return inner;
            case 'input':
                return '';
            case 'details':
                return this.detailsToMarkdown(element);
            case 'blockquote':
                return this.handleBlockquoteTag(inner);
            case 'p':
            case 'div':
                return `\n${inner}\n`;
            case 'br':
                return '  \n';
            case 'hr':
                return '\n---\n';
            case 'table':
                return '\n' + this.tableToMarkdown(element) + '\n';
            default:
                return null;
        }
    }

    private handlePreTag(element: HTMLElement): string {
        const lang = element.querySelector('code')?.dataset['language'] ?? '';
        const codeContent = element.textContent ?? '';
        return `\n\`\`\`${lang}\n${codeContent}\n\`\`\`\n`;
    }

    private handleUlTag(element: HTMLElement): string {
        const result: string[] = ['\n'];
        const isTask = 'taskList' in element.dataset;
        this.listToMarkdown(element, isTask ? 'task' : 'ul', '', result);
        return result.join('');
    }

    private handleOlTag(element: HTMLElement): string {
        const result: string[] = ['\n'];
        this.listToMarkdown(element, 'ol', '', result);
        return result.join('');
    }

    private handleBlockquoteTag(inner: string): string {
        const quoteLines = inner.split('\n').filter(Boolean);
        return '\n' + quoteLines.map(line => `> ${line}`).join('\n') + '\n';
    }

    private detailsToMarkdown(element: HTMLElement): string {
        const summaryEl = element.querySelector('summary');
        const summaryText = summaryEl?.textContent?.trim() ?? 'Toggle';
        const contentParts: string[] = [];
        for (const ch of Array.from(element.childNodes)) {
            if (ch.nodeType === Node.ELEMENT_NODE && (ch as Element).tagName === 'SUMMARY') continue;
            // A node, not its children — the same trap the list serializer fell
            // into: nodeToMarkdown walks a node's OWN children, so a bare text
            // node between blocks yielded nothing and its text vanished.
            contentParts.push(
                ch.nodeType === Node.TEXT_NODE
                    ? (ch.textContent ?? '')
                    : this.elementToMarkdown(ch as HTMLElement),
            );
        }
        return `\n:::details ${summaryText}\n${contentParts.map(part => part.trim()).filter(Boolean).join('\n')}\n:::\n`;
    }

    /**
     * Convert table element to Markdown table syntax.
     */
    /** Pad `contents` out to `width`, inserting blanks after each spanning cell. */
    private padToWidth(contents: string[], cells: Element[], width: number): string[] {
        const padded: string[] = [];
        cells.forEach((cell, index) => {
            padded.push(contents[index]);
            const span = Number.parseInt(cell.getAttribute('colspan') ?? '1', 10);
            const extra = Number.isFinite(span) && span > 1 ? span - 1 : 0;
            for (let i = 0; i < extra; i++) padded.push('');
        });
        while (padded.length < width) padded.push('');
        return padded;
    }

    /** A row's width in columns, counting each cell's colspan. */
    private columnSpan(row: HTMLElement): number {
        return Array.from(row.querySelectorAll('th, td')).reduce((total, cell) => {
            const span = Number.parseInt(cell.getAttribute('colspan') ?? '1', 10);
            return total + (Number.isFinite(span) && span > 0 ? span : 1);
        }, 0);
    }

    private tableToMarkdown(table: HTMLElement): string {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        const lines: string[] = [];
        let headerProcessed = false;

        // The FIRST row decides the column count, each cell counting its own
        // colspan -- markdown's separator describes the header, so a wider body
        // row must not stretch it (a 3-dash separator under a 2-column header is
        // invalid GFM). The separator previously appeared only when a row held a
        // <th>, so a headerless or colspan table emitted none -- and parseTables,
        // which requires header + separator, refused to read it back, leaving a
        // paragraph of literal pipe characters where the table had been.
        const columnCount = this.columnSpan(rows[0]);

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('th, td'));
            // Newlines inside a cell would split the row -- a one-row table came
            // back as two on reload -- so a <br> becomes the GFM in-cell break.
            const cellContents = cells.map(cell =>
                this.nodeToMarkdown(cell)
                    .trim()
                    .replaceAll('|', String.raw`\|`)
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .join('<br>'),
            );

            // A spanning cell contributes one label but several columns.
            // Markdown cannot express the span, so the row is padded to its
            // true width with empty cells: the header and separator then agree,
            // which keeps the output valid GFM and stable on re-import. Emitting
            // the label alone left a 1-cell header over a 2-dash separator, and
            // the next round-trip narrowed the separator to match, so the table
            // lost a column each cycle.
            lines.push('| ' + this.padToWidth(cellContents, cells, columnCount).join(' | ') + ' |');

            if (!headerProcessed) {
                const separator = new Array(Math.max(1, columnCount)).fill('---').join(' | ');
                lines.push('| ' + separator + ' |');
                headerProcessed = true;
            }
        }

        return lines.join('\n');
    }

    private listToMarkdown(listEl: HTMLElement, type: ListType, indent: string, result: string[]): void {
        const items = Array.from(listEl.children);
        items.forEach((li, index) => {
            const { content, nestedList } = this.extractListItemContent(li);
            result.push(this.formatListItem(type, li as HTMLElement, content, indent, index));

            if (nestedList) {
                const nestedType = this.detectNestedListType(nestedList);
                this.listToMarkdown(nestedList, nestedType, indent + '  ', result);
            }
        });
    }

    private extractListItemContent(li: Element): { content: string; nestedList: HTMLElement | null } {
        const childParts: string[] = [];
        let nestedList: HTMLElement | null = null;
        for (const ch of Array.from(li.childNodes)) {
            if (ch.nodeType === Node.ELEMENT_NODE) {
                const tag = (ch as Element).tagName.toLowerCase();
                if (tag === 'ul' || tag === 'ol') {
                    nestedList = ch as HTMLElement;
                    continue;
                }
                if (tag === 'input') continue;
            }
            // A node, not its children: `nodeToMarkdown` walks a node's OWN
            // children, which is right for an element but yields nothing for the
            // bare text node a plain `<li>text</li>` holds — so every bullet's
            // text vanished from the saved markdown while the HTML looked fine.
            childParts.push(
                ch.nodeType === Node.TEXT_NODE
                    ? (ch.textContent ?? '')
                    : this.elementToMarkdown(ch as HTMLElement),
            );
        }
        return { content: childParts.join('').trim(), nestedList };
    }

    private formatListItem(type: ListType, li: HTMLElement, content: string, indent: string, index: number): string {
        if (type === 'task') {
            const checked = li.dataset['checked'] === 'true';
            return `${indent}- [${checked ? 'x' : ' '}] ${content}\n`;
        }
        if (type === 'ol') {
            return `${indent}${index + 1}. ${content}\n`;
        }
        return `${indent}- ${content}\n`;
    }

    private detectNestedListType(nestedList: HTMLElement): ListType {
        if ('taskList' in nestedList.dataset) return 'task';
        if (nestedList.tagName.toLowerCase() === 'ol') return 'ol';
        return 'ul';
    }

    /**
     * Check if text contains Markdown syntax.
     */
    hasMarkdownSyntax(text: string): boolean {
        const patterns = [
            /^#{1,6}\s/m,           // Headings
            /\*\*[^*]+\*\*/,        // Bold
            /\*[^*]+\*/,            // Italic
            /~~[^~]+~~/,            // Strikethrough
            /\[[^\]]{1,4096}\]\([^)]{1,4096}\)/,  // Links
            /!\[.*\]\(.+\)/,        // Images
            /^[-*+]\s/m,            // Unordered list
            /^\d+\.\s/m,            // Ordered list
            /^>\s/m,                // Blockquote
            /```/,                  // Code fence
            /`[^`]+`/,              // Inline code
        ];

        return patterns.some(pattern => pattern.test(text));
    }

    /**
     * Apply a formatting command to a Markdown selection.
     * Returns the new text and cursor position.
     */
    applyFormat(
        text: string,
        selectionStart: number,
        selectionEnd: number,
        format: 'bold' | 'italic' | 'strikethrough' | 'code'
    ): { text: string; selectionStart: number; selectionEnd: number } {
        const before = text.substring(0, selectionStart);
        const selected = text.substring(selectionStart, selectionEnd);
        const after = text.substring(selectionEnd);

        const markers: Record<string, string> = {
            bold: '**',
            italic: '*',
            strikethrough: '~~',
            code: '`',
        };

        const marker = markers[format];

        if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
            /** Remove formatting */
            const unformatted = selected.slice(marker.length, -marker.length);
            return {
                text: before + unformatted + after,
                selectionStart,
                selectionEnd: selectionEnd - marker.length * 2,
            };
        }

        if (before.endsWith(marker) && after.startsWith(marker)) {
            /** Remove formatting */
            const newBefore = before.slice(0, -marker.length);
            const newAfter = after.slice(marker.length);
            return {
                text: newBefore + selected + newAfter,
                selectionStart: selectionStart - marker.length,
                selectionEnd: selectionEnd - marker.length,
            };
        }

        /** Add formatting */
        const formatted = marker + selected + marker;
        return {
            text: before + formatted + after,
            selectionStart: selectionStart + marker.length,
            selectionEnd: selectionEnd + marker.length,
        };
    }

    /**
     * Insert a link at the current position.
     */
    insertLink(
        text: string,
        position: number,
        linkText: string,
        url: string
    ): { text: string; position: number } {
        const safeUrl = this.sanitizer.sanitizeUrl(url);
        if (!safeUrl) {
            return { text, position };
        }

        const before = text.substring(0, position);
        const after = text.substring(position);
        const link = `[${linkText}](${safeUrl})`;

        return {
            text: before + link + after,
            position: position + link.length,
        };
    }

    /**
     * Insert an image at the current position.
     */
    insertImage(
        text: string,
        position: number,
        alt: string,
        src: string
    ): { text: string; position: number } {
        const safeSrc = this.sanitizer.sanitizeImageSrc(src);
        if (!safeSrc) {
            return { text, position };
        }

        const before = text.substring(0, position);
        const after = text.substring(position);
        const image = `![${alt}](${safeSrc})`;

        return {
            text: before + image + after,
            position: position + image.length,
        };
    }

    /**
     * Insert a heading at the line.
     */
    insertHeading(
        text: string,
        lineStart: number,
        level: 1 | 2 | 3 | 4 | 5 | 6
    ): string {
        const before = text.substring(0, lineStart);
        const afterStart = text.substring(lineStart);

        /** Remove existing heading markers if present */
        const withoutHeading = afterStart.replace(/^#{1,6}\s*/, '');

        /** Add new heading */
        const hashes = '#'.repeat(level);
        return before + hashes + ' ' + withoutHeading;
    }

    /**
     * Insert a code block.
     */
    insertCodeBlock(
        text: string,
        position: number,
        language?: string
    ): { text: string; position: number } {
        const before = text.substring(0, position);
        const after = text.substring(position);
        const lang = language ?? '';
        const block = `\n\`\`\`${lang}\n\n\`\`\`\n`;
        const cursorPosition = position + 4 + lang.length + 1; // After opening fence + newline

        return {
            text: before + block + after,
            position: cursorPosition,
        };
    }
}

/** Tags that legitimately stand alone, so they need no closing partner. */
/** Blank-line boundary between blocks, captured so joining restores the text. */
const BLOCK_SEPARATOR = /(\n\s*\n)/;

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'col']);

/**
 * Tag names that appear as a matched open/close pair in `text`.
 *
 * Used to tell markup from prose about markup: "<b>x</b>" is markup, while
 * "the <table> element" is a sentence. Counting rather than matching positions
 * is deliberate -- it is cheap, and a document with mismatched nesting is not
 * something this pass should try to repair.
 */
/**
 * Run `transform` over each block with only THAT block's paired tag names.
 *
 * An earlier version computed the sets per block and then unioned them into
 * one document-wide set, which threw the locality away again: a genuine
 * `<b>bold</b>` anywhere re-promoted every prose mention of `<b>` to markup and
 * the words were silently deleted. The set has to stay with its block all the
 * way to the point of use.
 */
function perBlock(
    text: string,
    transform: (block: string, paired: ReadonlySet<string>) => string,
): string {
    return text
        .split(BLOCK_SEPARATOR)
        .map((part, index) => (index % 2 === 1 ? part : transform(part, pairedTagNamesInBlock(part))))
        .join('');
}

function pairedTagNamesInBlock(block: string): ReadonlySet<string> {
    const opens = new Map<string, number>();
    const closes = new Map<string, number>();
    const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^<>]{0,4096}>/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(block)) !== null) {
        const bucket = match[1] ? closes : opens;
        const name = match[2].toLowerCase();
        bucket.set(name, (bucket.get(name) ?? 0) + 1);
    }
    const paired = new Set<string>();
    for (const [name, count] of opens) {
        if (count > 0 && (closes.get(name) ?? 0) > 0) paired.add(name);
    }
    return paired;
}

/**
 * A fenced block, with whatever prefix opens its line. The prefix is the quote
 * markers and indentation that put the fence inside another block; body lines
 * repeat it and must have it removed before the code is read.
 */
const FENCE_PATTERN = /^([ \t]*(?:> ?)*)(```|~~~)(\w*)\n([\s\S]*?)^\1?\2/gm;

/** Remove `prefix` (and any looser quote/indent form of it) from each line. */
function stripBlockPrefix(code: string, prefix: string): string {
    if (!prefix) return code;
    const quoteDepth = (prefix.match(/>/g) ?? []).length;
    const indent = /^[ \t]*/.exec(prefix)?.[0] ?? '';
    return code
        .split('\n')
        .map((line) => {
            let rest = line;
            for (let i = 0; i < quoteDepth; i++) {
                rest = rest.replace(/^[ \t]*> ?/, '');
            }
            if (quoteDepth === 0 && indent && rest.startsWith(indent)) {
                rest = rest.slice(indent.length);
            }
            return rest;
        })
        .join('\n');
}
