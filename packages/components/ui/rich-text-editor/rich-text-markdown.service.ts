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

/** Private-use delimiters parking an inline code span; distinct from the fence pair so a lone span is not read as a block. */
const INLINE_CODE_OPEN = '';
const INLINE_CODE_CLOSE = '';

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
        // Inline code is lifted out with the fences and for the same reason: a
        // code span is inert text. parseInlineCode ran LAST, after the emphasis
        // and line-break passes had already rewritten its contents, so
        // documenting `<br>` or `<b>x</b>` corrupted it on the first save.
        const protectedInline: string[] = [];
        html = this.protectInlineCode(html, protectedInline);

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
        // BEFORE paragraphs are split. A hard break ending a paragraph is
        // written "  " + blank line, and parseParagraphs splits on the blank
        // line and trims the block -- so the two trailing spaces were gone
        // before this pass ever ran, and the break was silently dropped.
        html = this.parseLineBreaks(html);
        html = this.parseParagraphs(html, protectedTags);

        html = this.parseImages(html, protectedInline);
        html = this.parseLinks(html);
        html = this.parseBoldItalic(html);
        html = this.parseStrikethrough(html);

        // After the emphasis passes, so the characters hidden in link and image
        // targets come back exactly as the author typed them.
        html = this.unshieldUrls(html);

        html = this.restoreRawTags(html, protectedTags);
        html = this.restoreCodeFences(html, protectedCode);
        html = this.restoreInlineCode(html, protectedInline);

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
    private isMarkupTag(tagName: string, offset: number, paired: ReadonlySet<number>): boolean {
        if (!this.sanitizer.isAllowedTag(tagName)) return false;
        return paired.has(offset) || VOID_TAGS.has(tagName.toLowerCase());
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
            .replaceAll(PASSTHROUGH_TAG_PATTERN, (match: string, tagName: string, offset: number) =>
                this.isMarkupTag(tagName, offset, paired) ? push(match) : match,
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

    /**
     * Park inline code spans, already escaped, in the same store the fences use.
     *
     * Both are inert text, so both must sit out every pass that rewrites
     * content. Running `parseInlineCode` at the end instead meant the emphasis
     * and line-break passes had already been through the span's body.
     */
    private protectInlineCode(markdown: string, store: string[]): string {
        // Strip our own delimiters from the input first, exactly as the fence
        // and raw-tag stores do. Without it a document carrying U+E112/U+E113
        // could forge a token, and restoreInlineCode would expand it -- so a
        // span the author wrote once rendered twice. This is the same defect
        // that was fixed for fences and then reintroduced here.
        return markdown
            .replaceAll(INLINE_CODE_OPEN, '')
            .replaceAll(INLINE_CODE_CLOSE, '')
            .replaceAll(/`([^`\n]+)`/g, (_match, code: string) => {
                const token = `${INLINE_CODE_OPEN}${store.length}${INLINE_CODE_CLOSE}`;
                store.push(`<code>${this.escapeHtml(code)}</code>`);
                return token;
        });
    }

    private restoreInlineCode(html: string, store: string[]): string {
        return html.replaceAll(/(\d{1,9})/g, (_match, index: string) => store[Number(index)] ?? '');
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
            .replaceAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]{0,4096}>|</g, (match: string, tagName: string | undefined, offset: number) => {
                if (!tagName) return '&lt;';
                if (this.isMarkupTag(tagName, offset, paired)) {
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
    private buildBlockquote(lines: readonly string[], depth = 0): string {
        // A quoted line that is itself quoted opens a deeper level. Stripping a
        // single ">" and never recursing left the second marker as a literal
        // ">" character in the output, so nested quotes -- ordinary markdown --
        // simply did not work.
        //
        // The depth cap is not cosmetic: each level re-runs parseBlockquotes AND
        // parseLists over the remaining text, so the cost is exponential --
        // measured 1ms, 7ms, 204ms at depths 10, 20, 25. An 81-byte document of
        // 40 markers froze the tab, and it arrives from paste, file import and
        // <ui-rich-text-view [value]>. Past the cap the rest stays literal text,
        // which is what CommonMark implementations do.
        const nested = lines.some((line) => line.startsWith('> ') || line === '>');
        if (nested && depth < MAX_BLOCKQUOTE_DEPTH) {
            return `<blockquote>${this.parseBlockquotes(lines.join('\n'), depth + 1)}</blockquote>`;
        }
        if (nested) {
            return `<blockquote>${this.escapeHtml(lines.join('\n'))}</blockquote>`;
        }

        const listed = this.parseLists(lines.join('\n'));
        const body = listed.includes('<ul') || listed.includes('<ol')
            ? listed
            : lines.join('<br>');
        return `<blockquote>${body}</blockquote>`;
    }

    private parseBlockquotes(html: string, depth = 0): string {
        const lines = html.split('\n');
        const result: string[] = [];
        let inBlockquote = false;
        let blockquoteContent: string[] = [];

        for (const line of lines) {
            // The space after ">" is optional in CommonMark. Requiring it meant
            // ">> b" was not a quote line at all -- a nested quote written in
            // the tight form produced depth 1 instead of 2, and ">> b" alone
            // produced no blockquote whatsoever. The strip below already
            // tolerates both forms; only this test was too narrow.
            if (line.startsWith('>')) {
                inBlockquote = true;
                blockquoteContent.push(line.replace(/^>\s?/, ''));
            } else {
                if (inBlockquote) {
                    result.push(this.buildBlockquote(blockquoteContent, depth));
                    blockquoteContent = [];
                    inBlockquote = false;
                }
                result.push(line);
            }
        }

        if (inBlockquote) {
            result.push(this.buildBlockquote(blockquoteContent, depth));
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
        return trimmed.includes('|') && trimmed.replaceAll(String.raw`\|`, '').includes('|');
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

    private parseImages(html: string, inlineStore: readonly string[]): string {
        return html.replaceAll(MEDIA_TARGET_PATTERN.image, (_, alt, src) => {
            const safeSrc = this.sanitizer.sanitizeImageSrc(src);
            if (!safeSrc) return '';
            // An alt attribute is plain text: a parked code span restored in
            // there would land as the literal string "<code>x</code>". Resolve
            // it back to the text the author typed instead.
            const plainAlt = resolveInlineCodeText(alt, inlineStore);
            return `<img src="${this.shieldUrl(safeSrc)}" alt="${this.shieldUrl(this.escapeHtml(plainAlt))}">`;
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
     * Parse line breaks (two spaces + newline or explicit \n).
     */
    private parseLineBreaks(html: string): string {
        // Only a break FOLLOWED BY CONTENT on the next line. Two trailing
        // spaces before a blank line, a heading, a fence or the end of the
        // document are not a hard break: the block boundary already ends the
        // line, and inserting a <br> there strands it in an empty paragraph or
        // merges two paragraphs into one. Verified against fifteen shapes --
        // this is the only reading under which every other one is unchanged.
        return html.replaceAll(/ {2}\n(?=[^\n])/g, '<br>');
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
                return this.handlePreTag(element, element.closest('li') !== null);
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

    /**
     * A fence inside a list item is re-emitted INDENTED. Without it toMarkdown
     * flattened the fence to column zero, so on the next toHtml the parked
     * token no longer looked indented and the fence escaped its item -- the
     * one-pass fix held, the round-trip did not.
     */
    private handlePreTag(element: HTMLElement, inListItem = false): string {
        const lang = element.querySelector('code')?.dataset['language'] ?? '';
        const codeContent = element.textContent ?? '';
        const indent = inListItem ? '  ' : '';
        const body = codeContent
            .split('\n')
            .map((line) => indent + line)
            .join('\n');
        return `\n${indent}\`\`\`${lang}\n${body}\n${indent}\`\`\`\n`;
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
        // A quote's own line endings are not hard breaks. parseBlockquotes joins
        // its lines with <br>, so on the way back every multi-line quote gained
        // two trailing spaces per line -- "> a  " -- which is a HARD break in
        // markdown, and the document was no longer a round-trip fixed point.
        //
        // KNOWN LIMIT: a hard break the author deliberately typed INSIDE a quote
        // is indistinguishable from a soft one once parseBlockquotes has joined
        // them, so it is normalised away here too. Telling them apart needs the
        // join to stop conflating them, which is a change to that pass; between
        // losing a rare deliberate break and corrupting every ordinary quote on
        // every save, this is the better default.
        const quoteLines = inner.split('\n').map((line) => line.trimEnd()).filter(Boolean);
        // "> " with a space, so a nested quote emits "> > x" rather than
        // ">> x". parseBlockquotes strips one "> " per level and reads both,
        // but only the spaced form survives its own round trip -- the tight
        // form left the inner marker as literal text on re-import.
        return '\n' + quoteLines.map((line) => `> ${line}`).join('\n') + '\n';
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
    private padToWidth(contents: string[], cells: Element[], width: number, carried: Map<number, number>): string[] {
        const padded: string[] = [];
        // A column held by a rowspan above is occupied: emit a blank for it
        // before any of this row's own content.
        const takeCarried = (): void => {
            while (carried.has(padded.length)) {
                const left = carried.get(padded.length) ?? 0;
                if (left > 1) carried.set(padded.length, left - 1);
                else carried.delete(padded.length);
                padded.push('');
            }
        };
        takeCarried();
        // Bounded per ROW, not just per cell. Capping one cell at 1000 still let
        // 50 cells emit 50,000 columns: a 63 KB paste became 7.8 MB of markdown,
        // 124x amplification. The per-cell cap only covers the single-cell shape
        // the earlier test happened to use.
        const limit = Math.min(width, MAX_TABLE_COLUMNS);
        for (const [index, cell] of cells.entries()) {
            padded.push(contents[index]);
            takeCarried();
            const span = Number.parseInt(cell.getAttribute('colspan') ?? '1', 10);
            // Leave room for the cells still to come: a wide colspan used to
            // fill the row and every later cell was dropped, so padding blanks
            // were emitted in preference to the author's content.
            const room = limit - padded.length - (cells.length - index - 1);
            const extra = Math.max(0, Math.min(clampSpan(span) - 1, room));
            for (let i = 0; i < extra; i++) padded.push('');
        }
        // Padded UP only. A width derived from the widest row means nothing ever
        // needs cutting here, and cutting is what silently deleted a body row's
        // extra cells when the width came from row 0. The MAX_TABLE_COLUMNS
        // ceiling still applies through `limit`, which bounds pasted input.
        while (padded.length < limit) padded.push('');
        return padded;
    }

    /** A row's width in columns, counting each cell's colspan. */
    private columnSpan(row: HTMLElement): number {
        const total = Array.from(row.querySelectorAll(':scope > th, :scope > td')).reduce((sum, cell) => {
            const span = Number.parseInt(cell.getAttribute('colspan') ?? '1', 10);
            return sum + clampSpan(span);
        }, 0);
        // Same row bound as padToWidth, so the separator cannot be wider than
        // the rows it describes.
        return Math.min(total, MAX_TABLE_COLUMNS);
    }

    private tableToMarkdown(table: HTMLElement): string {
        // Scoped to THIS table. An unscoped descendant query pulled a nested
        // table's rows up as rows of the outer one, so they appeared both inside
        // their cell and again at the top level.
        const rows = Array.from(table.querySelectorAll<HTMLElement>(':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr'));
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
        // The WIDEST row decides the width, not row 0. Sizing from the first row
        // and truncating deleted every cell past it -- trading invalid GFM for
        // silent data loss -- and an empty first row made the width 0, so the
        // whole table serialized to nothing. Narrower rows are padded, which is
        // what markdown requires; none are cut.
        const columnCount = Math.min(
            rows.reduce((widest, row) => Math.max(widest, this.columnSpan(row)), 0),
            MAX_TABLE_COLUMNS,
        );

        // A whole-table budget, not just a per-row one. Capping each row still
        // let 5000 narrow rows emit 14 MB from 166 KB of pasted HTML -- 88x
        // sustained. The per-row cap does bound the wide-row shape (a 50x50
        // colspan grid is 2.5x now), but nothing bounded rows x columns.
        let cellBudget = MAX_TABLE_CELLS;
        let rowsEmitted = 0;
        const carried = new Map<number, number>();

        for (const row of rows) {
            if (cellBudget <= 0) break;
            const cells = Array.from(row.querySelectorAll(':scope > th, :scope > td'));
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
            // Columns still held by a rowspan from an earlier row are filled
            // before this row's own cells, so everything after one shifts right.
            // Without it a rowspan cell's neighbours moved a column LEFT: a
            // figure from one column was filed under another, and saving made
            // that permanent. Count-based tests all passed -- the cell count is
            // right, only the association is wrong.
            const paddedRow = this.padToWidth(cellContents, cells, columnCount, carried);
            trackRowspans(cells, carried);
            cellBudget -= paddedRow.length;
            lines.push('| ' + paddedRow.join(' | ') + ' |');
            rowsEmitted++;

            if (!headerProcessed) {
                const separator = new Array(Math.max(1, columnCount)).fill('---').join(' | ');
                lines.push('| ' + separator + ' |');
                headerProcessed = true;
            }
        }

        // A bound that destroys data has to say so. Breaking the loop silently
        // turned a 5000-row paste into 954 lines on save, with no marker and no
        // warning -- worse than the amplification it prevents.
        if (rowsEmitted < rows.length) {
            lines.push('| ' + TABLE_TRUNCATION_NOTICE + ' |'.repeat(Math.max(1, columnCount)));
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
/**
 * A cell's column span, bounded.
 *
 * The value was range-checked but never capped, and it arrives from paste --
 * the sanitizer keeps the attribute verbatim. A single colspan="99999" cell
 * expanded to roughly 900 KB of markdown, measured at 887x amplification, which
 * is a denial-of-service through ordinary clipboard content. HTML's own table
 * algorithm caps at 1000; no real document needs more.
 */
function clampSpan(span: number): number {
    if (!Number.isFinite(span) || span < 1) return 1;
    return Math.min(span, MAX_COLSPAN);
}

/** Total cells a table may emit, bounding many-narrow-rows amplification. */
/** Row appended when a table is cut short by the cell budget. */
const TABLE_TRUNCATION_NOTICE = '… table truncated';

/** How many rows a single cell may span, bounding pasted input. */
const MAX_TABLE_ROWSPAN = 1000;

const MAX_TABLE_CELLS = 20000;

/** Widest row a table may emit, bounding paste amplification. */
const MAX_TABLE_COLUMNS = 1000;

/** How deep nested blockquotes may nest before the rest is left as text. */
const MAX_BLOCKQUOTE_DEPTH = 32;

/** HTML's own limit for a column span. */
const MAX_COLSPAN = 1000;

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
    transform: (block: string, paired: ReadonlySet<number>) => string,
): string {
    return text
        .split(BLOCK_SEPARATOR)
        .map((part, index) => (index % 2 === 1 ? part : transform(part, pairedTagOffsets(part))))
        .join('');
}

/**
 * Byte offsets of the tags in `block` that form a matched open/close pair.
 *
 * Pairing is resolved by POSITION, with a stack, not by counting names. Name
 * counting could not tell the first `<b>` in "Use <b> to bold. Like <b>x</b>"
 * from the second: it saw one open and one close, called the name paired, and
 * promoted BOTH -- deleting the prose mention and fabricating a stray closing
 * tag. Only the opener a closer actually matches is markup.
 */
/**
 * Pop back to the nearest unclosed opener of `name` and return its offset, or
 * null when nothing matches. Unwinding discards openers left dangling inside
 * it, which is what a browser's own parser does.
 */
function takeMatchingOpener(stack: { name: string; index: number }[], name: string): number | null {
    for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].name !== name) continue;
        const index = stack[k].index;
        stack.length = k;
        return index;
    }
    return null;
}

function pairedTagOffsets(block: string): ReadonlySet<number> {
    const paired = new Set<number>();
    const openStack: { name: string; index: number }[] = [];
    const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^<>]{0,4096}>/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(block)) !== null) {
        const name = match[2].toLowerCase();
        if (!match[1]) {
            openStack.push({ name, index: match.index });
            continue;
        }
        const opener = takeMatchingOpener(openStack, name);
        if (opener !== null) {
            paired.add(opener);
            paired.add(match.index);
        }
    }
    return paired;
}

/**
 * A fenced block, with whatever prefix opens its line. The prefix is the quote
 * markers and indentation that put the fence inside another block; body lines
 * repeat it and must have it removed before the code is read.
 *
 * The marker group is `(?:>[ 	]?)*`, NOT `(?:[ 	]*> ?)*`. The latter let the
 * inner and trailing whitespace runs match the same spaces, which backtracks
 * catastrophically on a run of quote markers: measured 59ms at depth 20, 385ms
 * at 26, doubling per level, so a 120-byte document froze the tab. Indentation
 * belongs to exactly one place -- after the markers -- so the two runs cannot
 * compete.
 */
const FENCE_PATTERN = /^((?:>[ \t]?)*[ \t]*)(```|~~~)(\w*)\n([\s\S]*?)^\1?\2/gm;

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
            // Indent is stripped whether or not quote markers preceded it: a
            // fence inside a list inside a quote carries both, and handling only
            // one left the list indentation baked into the code.
            const trailingIndent = prefix.length - prefix.trimEnd().length;
            const width = quoteDepth === 0 ? indent.length : trailingIndent;
            // Up to `width` leading spaces, not exactly that many: the quote
            // strip above already consumed the single space after each ">", so
            // an exact match never fired and the list indentation stayed baked
            // into the code.
            const leading = /^[ \t]*/.exec(rest)?.[0].length ?? 0;
            rest = rest.slice(Math.min(width, leading));
            return rest;
        })
        .join('\n');
}

/**
 * Record which columns each rowspan cell will still occupy in later rows.
 *
 * A rowspan cell holds its column for `rowspan - 1` further rows, so every cell
 * after it in those rows sits one column further right. Without this the
 * neighbours shifted left and data was filed under the wrong heading.
 */
function trackRowspans(cells: readonly Element[], carried: Map<number, number>): void {
    let column = 0;
    for (const cell of cells) {
        while (carried.has(column)) column++;
        const span = Number.parseInt(cell.getAttribute('rowspan') ?? '1', 10);
        const rows = Number.isFinite(span) && span > 1 ? Math.min(span, MAX_TABLE_ROWSPAN) : 1;
        if (rows > 1) carried.set(column, rows - 1);
        const cols = clampSpan(Number.parseInt(cell.getAttribute('colspan') ?? '1', 10));
        column += cols;
    }
}

/**
 * Replace parked inline-code tokens with the text they hold.
 *
 * Used where markup cannot go -- an `alt` attribute -- so a code span written in
 * alt text reads as its own characters rather than a literal
 * "&lt;code&gt;x&lt;/code&gt;".
 */
function resolveInlineCodeText(value: string, store: readonly string[]): string {
    return value.replaceAll(/(\d{1,9})/g, (_match, index: string) => {
        const parked = store[Number(index)] ?? '';
        return parked.replace(/^<code>/, '').replace(/<\/code>$/, '');
    });
}
