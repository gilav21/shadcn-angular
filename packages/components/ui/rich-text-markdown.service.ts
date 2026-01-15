import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';

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
    private readonly document = inject(DOCUMENT);
    private readonly sanitizer = inject(RichTextSanitizerService);

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
        html = html.replace(/\r\n/g, '\n');

        // Escape HTML entities in content (before processing)
        html = this.escapeHtmlInContent(html);

        // Process blocks first (order matters)
        html = this.parseCodeBlocks(html);
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

        // Final sanitization pass
        return this.sanitizer.sanitize(html);
    }

    /**
     * Escape HTML entities but preserve Markdown syntax.
     */
    private escapeHtmlInContent(text: string): string {
        // We need to be careful not to escape characters that are part of Markdown syntax
        // Only escape < and > that look like HTML tags
        return text
            .replace(/<(?![\s\w*_`~\[\]!#-])/g, '&lt;')
            .replace(/(?<![\s\w*_`~\[\]!#-])>/g, '&gt;');
    }

    /**
     * Parse fenced code blocks (``` or ~~~).
     */
    private parseCodeBlocks(html: string): string {
        // Fenced code blocks with optional language
        const fencedPattern = /```(\w*)\n([\s\S]*?)```/g;
        html = html.replace(fencedPattern, (_, lang, code) => {
            const langAttr = lang ? ` data-language="${lang}" class="language-${lang}"` : '';
            const escapedCode = this.escapeHtml(code.trimEnd());
            return `<pre><code${langAttr}>${escapedCode}</code></pre>`;
        });

        // Also support ~~~ fences
        const tildeFencedPattern = /~~~(\w*)\n([\s\S]*?)~~~/g;
        html = html.replace(tildeFencedPattern, (_, lang, code) => {
            const langAttr = lang ? ` data-language="${lang}" class="language-${lang}"` : '';
            const escapedCode = this.escapeHtml(code.trimEnd());
            return `<pre><code${langAttr}>${escapedCode}</code></pre>`;
        });

        return html;
    }

    /**
     * Parse blockquotes (> text).
     */
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
        return html.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) => {
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
        let currentListType: 'ul' | 'ol' | null = null;
        let listItems: string[] = [];

        const flushList = () => {
            if (currentListType && listItems.length > 0) {
                const items = listItems.map(item => `<li>${item}</li>`).join('');
                result.push(`<${currentListType}>${items}</${currentListType}>`);
                listItems = [];
                currentListType = null;
            }
        };

        for (const line of lines) {
            // Unordered list: - or * or + at start
            const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
            if (ulMatch) {
                if (currentListType !== 'ul') {
                    flushList();
                    currentListType = 'ul';
                }
                listItems.push(ulMatch[1]);
                continue;
            }

            // Ordered list: 1. 2. 3. etc
            const olMatch = line.match(/^[\s]*(\d+)\.\s+(.+)$/);
            if (olMatch) {
                if (currentListType !== 'ol') {
                    flushList();
                    currentListType = 'ol';
                }
                listItems.push(olMatch[2]);
                continue;
            }

            // Not a list item
            flushList();
            result.push(line);
        }

        flushList();
        return result.join('\n');
    }

    /**
     * Parse horizontal rules (---, ***, ___).
     */
    private parseHorizontalRules(html: string): string {
        return html.replace(/^([-*_]){3,}\s*$/gm, '<hr>');
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
        return html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
            const safeSrc = this.sanitizer.sanitizeImageSrc(src);
            if (!safeSrc) return '';
            return `<img src="${safeSrc}" alt="${this.escapeHtml(alt)}">`;
        });
    }

    /**
     * Parse links [text](url).
     */
    private parseLinks(html: string): string {
        return html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
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
        html = html.replace(/(\*\*\*|___)(.+?)\1/g, '<strong><em>$2</em></strong>');

        // Bold: **text** or __text__
        html = html.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');

        // Italic: *text* or _text_ (but not mid-word underscores)
        html = html.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
        html = html.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');

        return html;
    }

    /**
     * Parse strikethrough ~~text~~.
     */
    private parseStrikethrough(html: string): string {
        return html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    }

    /**
     * Parse inline code `code`.
     */
    private parseInlineCode(html: string): string {
        return html.replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    /**
     * Parse line breaks (two spaces + newline or explicit \n).
     */
    private parseLineBreaks(html: string): string {
        // Two spaces at end of line = <br>
        return html.replace(/  \n/g, '<br>\n');
    }

    /**
     * Escape HTML special characters.
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
                const element = child as HTMLElement;
                const tagName = element.tagName.toLowerCase();
                const inner = this.nodeToMarkdown(element);

                switch (tagName) {
                    // Headings
                    case 'h1':
                        result.push(`\n# ${inner}\n`);
                        break;
                    case 'h2':
                        result.push(`\n## ${inner}\n`);
                        break;
                    case 'h3':
                        result.push(`\n### ${inner}\n`);
                        break;
                    case 'h4':
                        result.push(`\n#### ${inner}\n`);
                        break;
                    case 'h5':
                        result.push(`\n##### ${inner}\n`);
                        break;
                    case 'h6':
                        result.push(`\n###### ${inner}\n`);
                        break;

                    // Inline formatting
                    case 'strong':
                    case 'b':
                        result.push(`**${inner}**`);
                        break;
                    case 'em':
                    case 'i':
                        result.push(`*${inner}*`);
                        break;
                    case 'del':
                    case 's':
                        result.push(`~~${inner}~~`);
                        break;
                    case 'u':
                        // Markdown doesn't have underline, use HTML
                        result.push(`<u>${inner}</u>`);
                        break;

                    // Code
                    case 'code':
                        if (element.parentElement?.tagName.toLowerCase() === 'pre') {
                            result.push(inner);
                        } else {
                            result.push(`\`${inner}\``);
                        }
                        break;
                    case 'pre':
                        const lang = element.querySelector('code')?.getAttribute('data-language') ?? '';
                        const codeContent = element.textContent ?? '';
                        result.push(`\n\`\`\`${lang}\n${codeContent}\n\`\`\`\n`);
                        break;

                    // Links and images
                    case 'a':
                        const href = element.getAttribute('href') ?? '';
                        result.push(`[${inner}](${href})`);
                        break;
                    case 'img':
                        const src = element.getAttribute('src') ?? '';
                        const alt = element.getAttribute('alt') ?? '';
                        result.push(`![${alt}](${src})`);
                        break;

                    // Lists
                    case 'ul':
                        result.push('\n');
                        const ulItems = Array.from(element.children);
                        for (const li of ulItems) {
                            const liContent = this.nodeToMarkdown(li);
                            result.push(`- ${liContent.trim()}\n`);
                        }
                        break;
                    case 'ol':
                        result.push('\n');
                        const olItems = Array.from(element.children);
                        olItems.forEach((li, index) => {
                            const liContent = this.nodeToMarkdown(li);
                            result.push(`${index + 1}. ${liContent.trim()}\n`);
                        });
                        break;
                    case 'li':
                        // Handled by ul/ol
                        result.push(inner);
                        break;

                    // Block elements
                    case 'blockquote':
                        const quoteLines = inner.split('\n').filter(Boolean);
                        result.push('\n' + quoteLines.map(line => `> ${line}`).join('\n') + '\n');
                        break;
                    case 'p':
                        result.push(`\n${inner}\n`);
                        break;
                    case 'div':
                        result.push(`\n${inner}\n`);
                        break;
                    case 'br':
                        result.push('  \n');
                        break;
                    case 'hr':
                        result.push('\n---\n');
                        break;

                    // Mentions and tags
                    case 'span':
                        if (element.hasAttribute('data-mention')) {
                            const mention = element.getAttribute('data-mention');
                            result.push(`@${mention}`);
                        } else if (element.hasAttribute('data-tag')) {
                            const tag = element.getAttribute('data-tag');
                            result.push(`#${tag}`);
                        } else {
                            result.push(inner);
                        }
                        break;

                    // Tables - convert to simple format
                    case 'table':
                        result.push('\n' + this.tableToMarkdown(element) + '\n');
                        break;

                    // Default: just include content
                    default:
                        result.push(inner);
                }
            }
        }

        return result.join('');
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
            const cellContents = cells.map(cell => this.nodeToMarkdown(cell).trim().replace(/\|/g, '\\|'));

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
            /\[.+\]\(.+\)/,         // Links
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
