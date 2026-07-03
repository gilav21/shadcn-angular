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

    // =========================================================================
    // MARKDOWN → HTML
    // =========================================================================

    /**
     * Convert Markdown to sanitized HTML.
     */
    toHtml(markdown: string): string {
        if (!markdown) return '';

        let html = markdown;

        // Normalize line endings
        html = html.replaceAll('\r\n', '\n');

        const protectedTags: string[] = [];
        html = this.protectRawTags(html, protectedTags);

        // Escape HTML entities in content (before processing)
        html = this.escapeHtmlInContent(html);

        // Process blocks first (order matters)
        html = this.parseCodeBlocks(html);
        html = this.parseToggleBlocks(html);
        html = this.parseBlockquotes(html);
        html = this.parseHeadings(html);
        html = this.parseLists(html);
        html = this.parseHorizontalRules(html);
        html = this.parseParagraphs(html);

        // Process inline elements
        html = this.parseImages(html);
        html = this.parseLinks(html);
        html = this.parseBoldItalic(html);
        html = this.parseStrikethrough(html);
        html = this.parseInlineCode(html);
        html = this.parseLineBreaks(html);

        html = this.restoreRawTags(html, protectedTags);

        // Final sanitization pass
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
    private protectRawTags(markdown: string, store: string[]): string {
        const cleaned = markdown.replaceAll(/[]/g, '');
        const push = (match: string): string => {
            const token = `${store.length}`;
            store.push(match);
            return token;
        };
        return cleaned
            .replaceAll(/<span\b[^>]{0,4096}>/gi, push)
            .replaceAll(/<\/span>/gi, push)
            .replaceAll(/<img\b[^>]{0,4096}\bdata-action-[\w-]{1,64}[^>]{0,4096}>/gi, push);
    }

    private restoreRawTags(html: string, store: string[]): string {
        return html.replaceAll(/(\d{1,9})/g, (_match, index: string) => store[Number(index)] ?? '');
    }

    /**
     * Escape HTML entities but preserve Markdown syntax.
     */
    private escapeHtmlInContent(text: string): string {
        // We need to be careful not to escape characters that are part of Markdown syntax
        // Only escape < and > that look like HTML tags
        return text
            .replaceAll(/<(?![\s\w*`~[\]!#-])/g, '&lt;')
            .replaceAll(/(?<![\s\w*`~[\]!#-])>/g, '&gt;');
    }

    /**
     * Parse fenced code blocks (``` or ~~~).
     */
    private parseCodeBlocks(html: string): string {
        // Fenced code blocks with optional language
        const fencedPattern = /```(\w*)\n([\s\S]*?)```/g;
        html = html.replaceAll(fencedPattern, (_, lang, code) => {
            const langAttr = lang ? ` data-language="${lang}" class="language-${lang}"` : '';
            const escapedCode = this.escapeHtml(code.trimEnd());
            return `<pre><code${langAttr}>${escapedCode}</code></pre>`;
        });

        // Also support ~~~ fences
        const tildeFencedPattern = /~~~(\w*)\n([\s\S]*?)~~~/g;
        html = html.replaceAll(tildeFencedPattern, (_, lang, code) => {
            const langAttr = lang ? ` data-language="${lang}" class="language-${lang}"` : '';
            const escapedCode = this.escapeHtml(code.trimEnd());
            return `<pre><code${langAttr}>${escapedCode}</code></pre>`;
        });

        return html;
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
                    result.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
                    blockquoteContent = [];
                    inBlockquote = false;
                }
                result.push(line);
            }
        }

        // Handle trailing blockquote
        if (inBlockquote) {
            result.push(`<blockquote>${blockquoteContent.join('<br>')}</blockquote>`);
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
                flushStack();
                result.push(line);
                continue;
            }

            const { indent, type, content } = parsed;

            while (stack.length > 0 && (stack.at(-1)?.indent ?? -1) >= indent) {
                stack.pop();
            }

            pushListItem(stack, rootLists, type, content, indent);
        }

        flushStack();
        return result.join('\n');
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
    private parseParagraphs(html: string): string {
        // Split by double newlines (paragraph breaks)
        const blocks = html.split(/\n\n+/);

        return blocks.map(block => {
            const trimmed = block.trim();

            // Skip if already wrapped in block element
            if (/^<(h[1-6]|ul|ol|li|blockquote|pre|div|p|hr|table)/i.test(trimmed)) {
                return trimmed;
            }

            // Skip empty blocks
            if (!trimmed) {
                return '';
            }

            return `<p>${trimmed}</p>`;
        }).filter(Boolean).join('\n');
    }

    /**
     * Parse images ![alt](src).
     */
    private parseImages(html: string): string {
        return html.replaceAll(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
            const safeSrc = this.sanitizer.sanitizeImageSrc(src);
            if (!safeSrc) return '';
            return `<img src="${safeSrc}" alt="${this.escapeHtml(alt)}">`;
        });
    }

    /**
     * Parse links [text](url).
     */
    private parseLinks(html: string): string {
        return html.replaceAll(/\[([^\]]{1,4096})\]\(([^)]{1,4096})\)/g, (_, text, url) => {
            const safeUrl = this.sanitizer.sanitizeUrl(url);
            if (!safeUrl) return text;
            return `<a href="${safeUrl}" rel="noopener noreferrer">${text}</a>`;
        });
    }

    /**
     * Parse bold and italic.
     * Order matters: process bold first to avoid conflicts.
     */
    private parseBoldItalic(html: string): string {
        // Bold + Italic: ***text*** or ___text___
        html = html.replaceAll(/(\*\*\*|___)(.+?)\1/g, '<strong><em>$2</em></strong>');

        // Bold: **text** or __text__
        html = html.replaceAll(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');

        // Italic: *text* or _text_ (but not mid-word underscores)
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
        // Two spaces at end of line = <br>
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

    // =========================================================================
    // HTML → MARKDOWN
    // =========================================================================

    /**
     * Convert HTML to Markdown.
     * Used for paste handling and output conversion.
     */
    toMarkdown(html: string): string {
        if (!html) return '';

        // First sanitize the HTML
        const cleanHtml = this.sanitizer.sanitize(html);

        // Parse into DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(cleanHtml, 'text/html');

        // Walk the DOM and convert
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
            contentParts.push(this.nodeToMarkdown(ch));
        }
        return `\n:::details ${summaryText}\n${contentParts.join('').trim()}\n:::\n`;
    }

    /**
     * Convert table element to Markdown table syntax.
     */
    private tableToMarkdown(table: HTMLElement): string {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        const lines: string[] = [];
        let headerProcessed = false;

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('th, td'));
            const cellContents = cells.map(cell => this.nodeToMarkdown(cell).trim().replaceAll('|', String.raw`\|`));

            lines.push('| ' + cellContents.join(' | ') + ' |');

            // Add header separator after first row of th cells
            if (!headerProcessed && row.querySelector('th')) {
                const separator = cells.map(() => '---').join(' | ');
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
            childParts.push(this.nodeToMarkdown(ch));
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

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

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

        // Check if selection is already formatted
        if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
            // Remove formatting
            const unformatted = selected.slice(marker.length, -marker.length);
            return {
                text: before + unformatted + after,
                selectionStart,
                selectionEnd: selectionEnd - marker.length * 2,
            };
        }

        // Check if surrounding text has formatting
        if (before.endsWith(marker) && after.startsWith(marker)) {
            // Remove formatting
            const newBefore = before.slice(0, -marker.length);
            const newAfter = after.slice(marker.length);
            return {
                text: newBefore + selected + newAfter,
                selectionStart: selectionStart - marker.length,
                selectionEnd: selectionEnd - marker.length,
            };
        }

        // Add formatting
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

        // Remove existing heading markers if present
        const withoutHeading = afterStart.replace(/^#{1,6}\s*/, '');

        // Add new heading
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
