import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { flattenIntoRowText, isInlineHoldingBlock, isNestedList, isPhrasing } from './rich-text-lines';
import { isValidImageMagicBytes } from '../../lib/parsers/image-validator';
import { sanitizeSvg } from '../../lib/parsers/svg-sanitizer';

import {
    containsCssUrl,
    decodeCssEscapes,
    extractCssUrls,
    hasUnsafeCssFunction,
    stripCssComments,
    isHostAllowed,
    isHostBearingUrl,
    remoteHostOf,
    type ResourcePolicyDecision,
} from './rich-text-resource-policy';
/**
 * A per-attribute rule an addon contributes to widen the sanitizer allow-list.
 * Locked attributes (`on*`, `href`, `src`, `style`, `class`) can never be
 * contributed — the security boundary stays centralized in this service.
 */
export interface SanitizerAttributeRule {
    /** `'*'` (any element) or a lowercase tag name. */
    tag: string;
    /** The attribute name this rule governs (lowercase). */
    attr: string;
    /** If set, this attribute is dropped unless the companion attribute survives. */
    requiresAttr?: string;
    /** Return the value to keep, or null to strip. Defaults to keeping as-is. */
    validate?: (value: string, element: HTMLElement) => string | null;
}

/**
 * Comprehensive HTML sanitization service for rich text editor.
 * Uses browser's DOMParser and TreeWalker for zero-dependency sanitization.
 * 
 * Security features:
 * - Allowlist-based element filtering
 * - Attribute sanitization per element type
 * - URL validation (blocks javascript:, vbscript:, data:)
 * - Event handler removal
 * - Deep DOM traversal and cleaning
 */
/**
 * URL schemes a link in editor content may use by default: the web's own,
 * plus well-known application schemes a browser hands straight to an installed
 * app (chat, calls, calendars, maps, source control). None of them can run
 * script in the page. Consumers add their own through
 * `[allowedLinkSchemes]` on the editor and the view.
 */
export const DEFAULT_LINK_SCHEMES: readonly string[] = [
    'http', 'https', 'mailto', 'tel', 'sms', 'ftp', 'ftps', 'sftp',
    'callto', 'sip', 'sips', 'facetime', 'facetime-audio',
    'xmpp', 'matrix', 'irc', 'ircs', 'news', 'nntp',
    'geo', 'maps', 'webcal', 'ssh', 'git',
    'slack', 'msteams', 'skype', 'zoommtg', 'zoomus', 'whatsapp', 'tg', 'signal', 'spotify', 'discord',
];

/**
 * Schemes no allowlist may re-admit: each one runs script, embeds a document,
 * or reaches the local machine, so listing it under `[allowedLinkSchemes]` is
 * a mistake the sanitizer refuses rather than honours.
 */
const FORBIDDEN_LINK_SCHEMES = new Set([
    'javascript', 'vbscript', 'data', 'blob', 'filesystem', 'file', 'about', 'view-source',
    'chrome', 'chrome-extension', 'moz-extension', 'ms-msdt', 'search-ms', 'ms-officecmd', 'res',
]);

const LINK_SCHEMES = new Set(DEFAULT_LINK_SCHEMES);

/** How many resource decisions may wait undrained before the oldest is dropped. */
const MAX_BUFFERED_DECISIONS = 256;



/**
 * Percent-decode a data: URL payload to raw BYTES.
 *
 * decodeURIComponent cannot be used here: it decodes to a UTF-8 STRING and
 * throws URIError on any byte sequence that is not valid UTF-8, which is every
 * binary image's magic number. Returns null only when a %XX escape is
 * malformed.
 */
function percentDecodeToBytes(payload: string): Uint8Array | null {
    const out: number[] = [];
    for (let i = 0; i < payload.length; i++) {
        const ch = payload[i];
        if (ch !== '%') {
            // Rejected, not truncated. Uint8Array silently takes a code point
            // mod 256, so a run of multi-byte characters (U+0189 U+010D ...)
            // collapsed into valid PNG magic bytes and a non-image data: URL
            // passed the content check. A genuine percent-encoded payload has
            // no code point above 0xFF -- that is what the escapes are for.
            // An astral character yields a value above 0xFF either way (a code
            // point of 0x1F600, or a lone surrogate of 0xD83D), so the guard
            // below rejects it before the two-code-unit width can matter.
            const code = payload.codePointAt(i) ?? 0;
            if (code > 0xFF) return null;
            out.push(code);
            continue;
        }
        const hex = payload.slice(i + 1, i + 3);
        if (!/^[0-9a-f]{2}$/i.test(hex)) return null;
        out.push(Number.parseInt(hex, 16));
        i += 2;
    }
    return new Uint8Array(out);
}

/** CSS functions and schemes that must never appear in a style value. */
/**
 * CSS constructs that execute or embed, and are never permitted whatever their
 * host. `url(` is deliberately NOT here: it is judged by the host policy in
 * `isStyleValueAllowed`, because a url() to an allowlisted host is legitimate
 * content while one to an unknown host is a tracking beacon.
 */
const UNSAFE_STYLE_TOKENS = ['expression(', 'javascript:', 'vbscript:', 'data:'];

/**
 * Elements that must hold a line of text or blocks, never both.
 *
 * Only tags this sanitizer actually keeps: a selector for a tag it strips
 * would never match, and reading like a rule it does not enforce.
 */
const STRAY_LINE_HOSTS = 'li, td, th, blockquote, div, summary, details';


/** Why a resource was allowed or refused, as a flat decision. */
function resourceReason(noPolicy: boolean, allowed: boolean): ResourcePolicyDecision['reason'] {
    if (noPolicy) return 'no-policy';
    return allowed ? 'allowlisted' : 'blocked';
}

/**
 * Whether a CSS declaration value is safe to keep.
 *
 * The test runs on the value as a BROWSER resolves it. Substring checks on the
 * raw text are not enough: CSS lets any identifier character be written as a
 * hex escape, so "\\75rl(https://x/p.png)" is the url() function to a browser
 * while spelling nothing a naive check looks for. That bypass survived the
 * whole paste pipeline and planted a live external-resource load -- a tracking
 * pixel firing for every later viewer of the document.
 *
 * Two layers, because one decoder is a thing to be wrong about:
 *   1. decode CSS hex escapes, then test;
 *   2. reject any value that still carries a backslash at all. Nothing in the
 *      allowlist -- colours, lengths, font names, alignments -- needs one, so
 *      refusing them costs nothing and closes whatever the decoder misses.
 */
function hasUnsafeStyleToken(value: string): boolean {
    // Escapes, comments and whitespace are all insignificant to a CSS
    // tokenizer, so they are resolved before the test: "\\65xpression(" and
    // "expression/**/(" and "expression (" are one construct.
    const normalized = decodeCssEscapes(stripCssComments(value.toLowerCase()))
        .replaceAll(/\s+/g, '');

    return UNSAFE_STYLE_TOKENS.some((token) => normalized.includes(token));
}

@Injectable({ providedIn: 'root' })
export class RichTextSanitizerService {
    private readonly document = inject(DOCUMENT);

    /** Allowlisted elements - only these can appear in sanitized output */
    /**
     * Whether `tagName` survives {@link sanitize}. The markdown service asks so
     * it can decide whether a `<` in the source opens a real tag or is just a
     * less-than sign the author typed.
     */
    isAllowedTag(tagName: string): boolean {
        return this.ALLOWED_TAGS.has(tagName.toLowerCase());
    }

    private readonly ALLOWED_TAGS = new Set([
        // Block elements
        'p', 'div', 'br', 'hr',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        // Inline elements
        'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
        'sub', 'sup', 'small',
        'a', 'span',
        // Media (with strict attribute sanitization)
        'img',
        // Tables (for paste compatibility)
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
        'colgroup', 'col', 'caption',
        // Task lists
        'input',
        // Toggle/collapsible blocks
        'details', 'summary',
    ]);

    /** Allowlisted attributes per element */
    private readonly ALLOWED_ATTRS: Record<string, Set<string>> = {
        'a': new Set(['href', 'title', 'target', 'rel']),
        'img': new Set(['src', 'alt', 'width', 'height', 'title', 'data-align', 'data-auto-upload-id', 'data-auto-upload-status', 'data-blocked-src']),
        'td': new Set(['colspan', 'rowspan']),
        'th': new Set(['colspan', 'rowspan', 'scope']),
        'pre': new Set(['data-language']),
        'code': new Set(['data-language', 'class']),
        'input': new Set(['type', 'checked', 'disabled']),
        'ul': new Set(['data-task-list']),
        'li': new Set(['data-task', 'data-checked']),
        'details': new Set(['open']),
        'col': new Set(['span', 'width']),
        '*': new Set(['data-mention', 'data-mention-id', 'data-tag', 'data-tag-id', 'style', 'dir']),
    };

    /** Allowed CSS properties for inline styles */
    private readonly ALLOWED_STYLE_PROPERTIES = new Set([
        'color',
        'background-color',
        'background',
        'text-align',
        'font-size',
        // Dimensions for images
        'width', 'height',
        'min-width', 'max-width',
        'min-height', 'max-height',
        // Paste fidelity
        'font-weight',
        'font-style',
        'text-decoration',
        'vertical-align',
        'padding-left',
        'margin-left',
        'list-style-type',
        // Image alignment
        'display',
        'float',
        'margin',
        'margin-right',
        'margin-top',
        'margin-bottom',
        'table-layout',
        // Document import fidelity
        'font-family',
        'line-height',
        'text-indent',
        'letter-spacing',
        'font-variant',
        'text-transform',
        'text-decoration-style',
        'text-decoration-color',
        'word-spacing',
        // Borders (paragraphs, tables, cells)
        'border',
        'border-top',
        'border-bottom',
        'border-left',
        'border-right',
        'border-collapse',
        'border-spacing',
        // Longhand border properties (Word paste uses these)
        'border-width',
        'border-style',
        'border-color',
        // Padding (table cells, bordered paragraphs)
        'padding',
        'padding-top',
        'padding-bottom',
        'padding-right',
    ]);

    /** Allowed class patterns (for syntax highlighting) */
    private readonly ALLOWED_CLASS_PATTERNS = [
        /^language-\w+$/,      // language-javascript, language-python, etc.
        /^hljs(-\w+)?$/,       // hljs, hljs-keyword, etc.
        /^token(-\w+)?$/,      // Prism.js tokens
    ];

    /** Dangerous URL protocols to block */
    private readonly DANGEROUS_PROTOCOLS = new Set([
        'javascript:',
        'vbscript:',
        'data:',  // Block data: except for images
    ]);

    /** Event handler attributes pattern */
    private readonly EVENT_HANDLER_PATTERN = /^on\w+$/i;

    /** Attributes an addon rule may never target — the security boundary stays here. */
    private readonly LOCKED_ATTRS = new Set(['href', 'src', 'style', 'class']);
    private readonly contributedRules = new Map<string, { rule: SanitizerAttributeRule; count: number }>();

    /**
     * Register addon attribute rules. Ref-counted and additive; returns a teardown
     * that decrements each rule's count and removes it at zero. Throws if any rule
     * targets a locked or event-handler attribute.
     */
    registerAttributeRules(rules: SanitizerAttributeRule[]): () => void {
        for (const rule of rules) {
            const attr = rule.attr.toLowerCase();
            if (this.LOCKED_ATTRS.has(attr) || this.EVENT_HANDLER_PATTERN.test(attr)) {
                throw new Error(`Cannot contribute a sanitizer rule for locked attribute "${rule.attr}".`);
            }
        }
        for (const rule of rules) {
            const key = this.ruleKey(rule.tag, rule.attr);
            const existing = this.contributedRules.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                this.contributedRules.set(key, { rule, count: 1 });
            }
        }
        return () => {
            for (const rule of rules) {
                const key = this.ruleKey(rule.tag, rule.attr);
                const entry = this.contributedRules.get(key);
                if (!entry) continue;
                entry.count -= 1;
                if (entry.count <= 0) this.contributedRules.delete(key);
            }
        };
    }

    private ruleKey(tag: string, attr: string): string {
        return `${tag.toLowerCase()}|${attr.toLowerCase()}`;
    }

    /**
     * A contributed rule for this tag/attribute, from this instance or any
     * enclosing one.
     *
     * Walking up is safe because LOCKED_ATTRS refuses any rule for `href`,
     * `src`, `style` or `class`, so an inherited rule can only ever permit a
     * data-* or aria-* attribute -- nothing a browser fetches. The REMOTE HOST
     * POLICY is deliberately not inherited this way: that is per-instance
     * configuration, and a strict view must never widen to a looser ancestor.
     */
    private findContributedRule(tagName: string, attrName: string): SanitizerAttributeRule | undefined {
        const own = this.ownContributedRule(tagName, attrName);
        return own ?? this.parentSanitizer?.findContributedRule(tagName, attrName);
    }

    private ownContributedRule(tagName: string, attrName: string): SanitizerAttributeRule | undefined {
        return this.contributedRules.get(this.ruleKey(tagName, attrName))?.rule
            ?? this.contributedRules.get(this.ruleKey('*', attrName))?.rule;
    }

    private dropOrphanCompanionAttributes(root: HTMLElement): void {
        for (const { rule } of this.contributedRules.values()) {
            const requires = rule.requiresAttr;
            if (!requires) continue;
            for (const el of Array.from(root.querySelectorAll(`[${rule.attr}]`))) {
                if (!el.hasAttribute(requires)) {
                    el.removeAttribute(rule.attr);
                }
            }
        }
    }

    /**
     * Control, whitespace, and zero-width / bidi / format characters that
     * browsers ignore or normalize inside URLs; stripped before a URL scheme
     * is inspected so they cannot mask a dangerous protocol.
     */
    // eslint-disable-next-line no-control-regex
    private readonly URL_STRIP_PATTERN = /[\u0000-\u0020\u007f-\u00a0\u00ad\u1680\u2000-\u200f\u2028-\u202f\u205f\u2060-\u206f\u3000\ufeff\ufff9-\ufffb]/g;

    /**
     * Sanitize HTML string, removing all dangerous content.
     * Returns clean, safe HTML.
     */
    sanitize(html: string): string {
        if (!html || typeof html !== 'string') {
            return '';
        }

        /** Parse HTML into DOM */
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        /** Create a clean container */
        const cleanContainer = this.document.createElement('div');

        this.processNodes(doc.body, cleanContainer);
        this.dropOrphanCompanionAttributes(cleanContainer);
        this.pushInlineWrappersIntoBlocks(cleanContainer);
        this.liftBlocksOutOfLines(cleanContainer);
        this.adoptStrayItems(cleanContainer);
        this.normalizeQuoteLines(cleanContainer);
        this.normalizeTaskRows(cleanContainer);
        this.normalizeStrayLines(cleanContainer);

        return this.normalizeStyleQuotes(cleanContainer.innerHTML);
    }

    /**
     * An inline element never wraps a block.
     *
     * The parser keeps `<span><p>…</p></span>`, but nothing downstream can: the
     * line passes read the span as inline and wrapped it in a paragraph, which
     * the next read took apart, so the document gained an empty paragraph on
     * every pass. The wrapper moves inside instead, around each inline run, so
     * its formatting survives: `<b><p>x</p></b>` becomes `<p><b>x</b></p>`.
     */
    private pushInlineWrappersIntoBlocks(root: HTMLElement): void {
        for (const el of Array.from(root.querySelectorAll('*'))) {
            // `root` is detached, so `isConnected` is false for everything in
            // it; containment is what says an earlier move has not taken `el` out.
            if (!root.contains(el) || !isInlineHoldingBlock(el)) continue;
            for (const child of Array.from(el.childNodes)) this.wrapInlineRuns(child, el);
            el.replaceWith(...Array.from(el.childNodes));
        }
    }

    /** Wrap each inline piece of `node` in a copy of `wrapper`, descending through blocks. */
    private wrapInlineRuns(node: Node, wrapper: Element): void {
        // Blank formatting text and a row's checkbox are not content to format:
        // wrapping the checkbox would take it out of its row.
        if (node.nodeName === 'INPUT') return;
        if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() === '') return;
        if (isPhrasing(node)) {
            const copy = wrapper.cloneNode(false);
            node.parentNode?.insertBefore(copy, node);
            copy.appendChild(node);
            return;
        }
        for (const child of Array.from(node.childNodes)) this.wrapInlineRuns(child, wrapper);
    }

    /**
     * A heading holds inline content only.
     *
     * The parser closes an open `<p>` at any block, but not a heading:
     * `<h2>title<div>body</div></h2>` survives parsing, and a markdown heading
     * is one line, so the block had nowhere to go on save. Each block moves out
     * in place, and the inline runs around it keep the heading's tag.
     * Paragraphs need no such pass: the parser already guarantees them.
     */
    private liftBlocksOutOfLines(root: HTMLElement): void {
        for (const line of Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
            if (Array.from(line.childNodes).every(isPhrasing)) continue;
            line.replaceWith(...this.splitAroundBlocks(line));
        }
    }

    /** The line's inline runs, each in a copy of the line, with its blocks between them. */
    private splitAroundBlocks(line: Element): Node[] {
        const pieces: Node[] = [];
        let run: Element | null = null;
        for (const child of Array.from(line.childNodes)) {
            if (isPhrasing(child)) {
                run ??= line.cloneNode(false) as Element;
                run.appendChild(child);
                continue;
            }
            if (run && !this.showsNothing(run)) pieces.push(run);
            run = null;
            pieces.push(child);
        }
        if (run && !this.showsNothing(run)) pieces.push(run);
        return pieces;
    }

    /** Whether a piece of a split line is only the whitespace that sat between blocks. */
    private showsNothing(run: Element): boolean {
        return (run.textContent ?? '').trim() === '' && !run.querySelector('img, br, input');
    }

    /**
     * An item lives in a list, and a summary in a details block.
     *
     * `<blockquote><li>x</li></blockquote>` arrives from pasted HTML. The quote
     * pass wrapped the stray item in a paragraph, which the next read took
     * apart, adding an empty paragraph per pass. Adjacent stray items share one
     * new list; a stray summary becomes a paragraph.
     */
    private adoptStrayItems(root: HTMLElement): void {
        const adopted = new Set<Element>();
        for (const item of Array.from(root.querySelectorAll('li'))) {
            const parent = item.parentElement;
            if (!parent || isNestedList(parent)) continue;
            const before = this.previousContentSibling(item);
            let list = before && adopted.has(before) ? before : null;
            if (!list) {
                list = this.document.createElement('ul');
                if (item.dataset['task'] !== undefined) (list as HTMLElement).dataset['taskList'] = '';
                item.before(list);
                adopted.add(list);
            }
            list.appendChild(item);
        }
        for (const summary of Array.from(root.querySelectorAll('summary'))) {
            if (summary.parentElement?.nodeName === 'DETAILS') continue;
            const paragraph = this.document.createElement('p');
            paragraph.append(...Array.from(summary.childNodes));
            summary.replaceWith(paragraph);
        }
    }

    /** The previous sibling element, stepping over the blank text formatting leaves between elements. */
    private previousContentSibling(node: Node): Element | null {
        let current = node.previousSibling;
        while (current?.nodeType === Node.TEXT_NODE && (current.textContent ?? '').trim() === '') {
            current = current.previousSibling;
        }
        return current?.nodeType === Node.ELEMENT_NODE ? current as Element : null;
    }

    /**
     * A task row's text lives in a `<span>` after its checkbox.
     *
     * The editor builds rows that way and the markdown parser emits them that
     * way, but nothing enforced it, so a row from another producer (the PDF
     * import path emits `<li data-task><input>text</li>`) or from consumer
     * HTML carried its text bare. Every caret rule and the checked-row strike
     * key off that span, so such a row silently lost its strike and gave the
     * caret nowhere of its own to sit. Every row reaching the editor or the
     * view passes through here, so all of them have the shape.
     */
    private normalizeTaskRows(root: HTMLElement): void {
        for (const row of Array.from(root.querySelectorAll('li[data-task]'))) {
            const checkbox: ChildNode | null = row.querySelector(':scope > input[type="checkbox"]');
            const content = Array.from(row.childNodes)
                .filter((node) => node !== checkbox && !isNestedList(node));
            // A span holding a paragraph -- what a loose markdown task item
            // parses to -- no longer reaches here: the inline-wrapper pass has
            // already moved the paragraph out of it, so a lone span is inline.
            if (content.length === 1 && content[0].nodeName === 'SPAN') continue;
            const span = this.document.createElement('span');
            // A row's text is inline. A block among its content is flattened
            // into it rather than nested, or the row would own a line and the
            // block would own one too, and the same text would belong to both.
            flattenIntoRowText(content, span);
            // The row's own nested list renders under its text, so the span
            // goes before it.
            row.insertBefore(span, Array.from(row.childNodes).find((node) => isNestedList(node)) ?? null);
        }
    }

    /**
     * An element either holds a line of text or holds blocks, never both.
     *
     * `<li>text<blockquote>…</blockquote></li>` puts a visible line of text in
     * an element that is a container, so that text belongs to no line: every
     * caret and block rule keys off lines, and a block command given such an
     * item reached out to the whole list and destroyed it. The stray run gets a
     * paragraph of its own, where it already lives.
     */
    private normalizeStrayLines(root: HTMLElement): void {
        for (const el of Array.from(root.querySelectorAll(STRAY_LINE_HOSTS))) {
            if (!Array.from(el.children).some((child) => this.needsItsOwnLine(child, el))) continue;
            for (const run of this.strayRunsOf(el)) {
                const paragraph = this.document.createElement('p');
                run[0].before(paragraph);
                for (const node of run) paragraph.appendChild(node);
            }
        }
    }

    /**
     * Runs of inline content between the block children of `el`.
     *
     * A block ENDS a run and is never part of one. Letting a nested list stay
     * in the run — because the sub-list exception says it does not make its
     * item a container — moved the list into the new paragraph, producing a
     * `<ul>` inside a `<p>` and one more empty paragraph on every save.
     */
    private strayRunsOf(el: Element): ChildNode[][] {
        const runs: ChildNode[][] = [];
        let run: ChildNode[] = [];
        for (const node of Array.from(el.childNodes)) {
            if (!isPhrasing(node)) {
                if (run.length > 0) runs.push(run);
                run = [];
                continue;
            }
            if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() === '') continue;
            if (node.nodeName === 'INPUT') continue;
            run.push(node);
        }
        if (run.length > 0) runs.push(run);
        return runs;
    }

    /**
     * Whether a block child means its host's own text needs a line of its own.
     *
     * A list nested in an item does NOT: that item still shows its own line
     * above the sub-list, exactly as the line model has it, and wrapping its
     * text would make every nested row a container. This answers only whether
     * the host needs normalising; where runs break is a separate question, and
     * conflating the two moved a sub-list into a paragraph.
     */
    private needsItsOwnLine(node: Node, within: Element): boolean {
        if (isPhrasing(node)) return false;
        return !(within.nodeName === 'LI' && isNestedList(node));
    }

    /**
     * A blockquote's direct children are line blocks, never bare text.
     *
     * The editor's Enter rule leaves a quote only from a blank LINE block. A
     * quote arriving as `<blockquote>a<br>b</blockquote>` -- the markdown
     * parser's shape, and what older documents and pasted HTML carry -- had no
     * line for it to find, so Enter fell to the browser and opened a sibling
     * blockquote per keypress; the quote could not be escaped. Every quote
     * passes through here, so the editor sees one shape whatever produced it.
     * Bare and inline children are grouped into `<p>` lines, a `<br>` ends a
     * line, and block children pass through untouched.
     */
    private normalizeQuoteLines(root: HTMLElement): void {
        for (const quote of Array.from(root.querySelectorAll('blockquote'))) {
            const bare = Array.from(quote.childNodes).some((node) => !this.isQuoteLineBlock(node));
            if (!bare) continue;
            quote.replaceChildren(...this.groupQuoteLines(Array.from(quote.childNodes)));
        }
    }

    private groupQuoteLines(nodes: readonly Node[]): Node[] {
        const out: Node[] = [];
        let run: Node[] = [];
        const flush = (keepEmpty: boolean): void => {
            const line = this.quoteLineFrom(run, keepEmpty);
            if (line) out.push(line);
            run = [];
        };
        for (const node of nodes) {
            if (this.isQuoteLineBlock(node)) {
                flush(false);
                out.push(node);
            } else if ((node as Element).tagName === 'BR') {
                flush(true);
            } else {
                run.push(node);
            }
        }
        flush(false);
        return out;
    }

    /** A `<p>` for a run of inline nodes; a blank run is a line only when a `<br>` ended it. */
    private quoteLineFrom(run: readonly Node[], keepEmpty: boolean): HTMLElement | null {
        const blank = run.every((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() === '');
        if (blank && !keepEmpty) return null;
        const p = this.document.createElement('p');
        if (blank) {
            p.appendChild(this.document.createElement('br'));
        } else {
            p.append(...run);
            this.trimLineEdges(p);
        }
        return p;
    }

    /** Source formatting between blocks is not content; a rendered line never shows edge whitespace anyway. */
    private trimLineEdges(line: HTMLElement): void {
        const first = line.firstChild;
        if (first?.nodeType === Node.TEXT_NODE) first.textContent = (first.textContent ?? '').trimStart();
        const last = line.lastChild;
        if (last?.nodeType === Node.TEXT_NODE) last.textContent = (last.textContent ?? '').trimEnd();
    }

    private isQuoteLineBlock(node: Node): boolean {
        return node.nodeType === Node.ELEMENT_NODE && !isPhrasing(node);
    }

    /**
     * Sanitize HTML and return as DOM fragment.
     * Useful for direct insertion into contentEditable.
     */
    sanitizeToFragment(html: string): DocumentFragment {
        const sanitized = this.sanitize(html);
        const template = this.document.createElement('template');
        template.innerHTML = sanitized;
        return template.content.cloneNode(true) as DocumentFragment;
    }

    /**
     * Check if a URL is safe for use in an href/src attribute (not
     * javascript:, vbscript:, or a suspicious data: URL).
     *
     * Browsers ignore or strip whitespace, control, and zero-width / bidi
     * characters inside URLs while navigating, so a dangerous scheme can be
     * smuggled past a naive check by inserting them (e.g. a tab or zero-width
     * space inside `javascript:`). All such characters are removed before the
     * protocol is compared against the blocklist.
     */
    isUrlSafe(url: string): boolean {
        if (!url || typeof url !== 'string') {
            return false;
        }

        const probe = url.replace(this.URL_STRIP_PATTERN, '').toLowerCase();

        // A protocol-relative URL looks relative but loads an arbitrary external
        // host. Browsers normalize backslashes to forward slashes in the
        // authority position, so "/\host" and "\\host" reach the same place
        // as "//host" -- and the surviving anchor was decorated with
        // rel="noopener noreferrer", making an off-origin redirect read as a
        // vetted link. sanitizeImageSrc already guarded the backslash forms;
        // the href path did not.
        if (/^[\\/]{2}/.test(probe)) {
            return false;
        }

        // ...and the same check AFTER any scheme. "https:\\\\evil" was admitted by
        // the allowlist below (https is a fine scheme) and never came back here,
        // so a scheme-qualified backslash authority resolved off-origin exactly
        // like the schemeless form it sits beside.
        if (hasForeignAuthority(probe)) {
            return false;
        }

        // Allowlist, not blocklist. Naming the dangerous schemes meant anything
        // unnamed passed -- blob:, filesystem:, view-source:, about:, ws: and
        // file: all reached a live href. Only the schemes ordinary links use are
        // accepted; a URL with no scheme at all is relative, and fine.
        const scheme = /^([a-z][a-z0-9+.-]*):/.exec(probe)?.[1];
        if (scheme && !this.isLinkSchemeAllowed(scheme)) {
            return false;
        }

        for (const protocol of this.DANGEROUS_PROTOCOLS) {
            if (probe.startsWith(protocol)) {
                // Every data: URL is refused here. This is the href path, and no
                // legitimate link target is a data: URL, while
                // `data:image/svg+xml` was previously waved through
                // unconditionally by isAllowedDataUrl -- letting a link carry an
                // SVG document with an onload handler into the content. Image
                // sources keep their own, stricter route
                // (sanitizeImageSrc -> sanitizeSvgDataUrl), which scrubs the SVG
                // rather than trusting the MIME label.
                return false;
            }
        }

        return true;
    }

    /**
     * Sanitize a URL for href/src attributes.
     * Returns null if URL is unsafe.
     */
    sanitizeUrl(url: string): string | null {
        if (this.isUrlSafe(url)) return url;
        return this.canonicalOffOriginLink(url);
    }

    /**
     * A link written in a form that LOOKS relative but resolves off-origin --
     * `//host/x`, `/\\host/x`, `https:\\host/x` -- rewritten as the explicit
     * absolute URL the browser would reach, or null when it is unsafe.
     *
     * Dropping such links was a regression: an explicit `https://host/x` to
     * the same resource is allowed, so refusing the shorthand protected
     * nothing and deleted legitimate protocol-relative links from pasted
     * content. What the earlier fix was right about is that the shorthand
     * must not be STORED -- a reader cannot tell it is off-origin. Resolving
     * it, like `sanitizeImageSrc` already stores `url.href`, keeps the link
     * and makes its destination visible.
     */
    private canonicalOffOriginLink(url: string): string | null {
        const probe = url.replace(this.URL_STRIP_PATTERN, '').toLowerCase();
        if (!/^[\\/]{2}/.test(probe) && !hasForeignAuthority(probe)) return null;
        try {
            const resolved = new URL(url, this.document.baseURI);
            return this.isLinkSchemeAllowed(resolved.protocol.slice(0, -1)) ? resolved.href : null;
        } catch {
            return null;
        }
    }

    /**
     * Extra link schemes the consumer allows, read live like the host policy.
     * Empty by default; the built-in list is {@link DEFAULT_LINK_SCHEMES}.
     */
    private extraLinkSchemes: () => readonly string[] = () => [];

    /**
     * Widen the link-scheme allowlist. Accepts a reader so a component can hand
     * over its input signal, for the same reason `setRemoteHostPolicy` does.
     * A forbidden scheme (`javascript`, `data`, `file`, …) is ignored however
     * it is listed.
     */
    setLinkSchemePolicy(schemes: readonly string[] | (() => readonly string[])): void {
        if (typeof schemes === 'function') {
            this.extraLinkSchemes = schemes;
            return;
        }
        const copy = [...schemes];
        this.extraLinkSchemes = () => copy;
    }

    private isLinkSchemeAllowed(scheme: string): boolean {
        const lower = scheme.toLowerCase();
        if (FORBIDDEN_LINK_SCHEMES.has(lower)) return false;
        if (LINK_SCHEMES.has(lower)) return true;
        return this.extraLinkSchemes().some((extra) => extra.trim().toLowerCase().replace(/:$/, '') === lower);
    }

    /**
     * Sanitize image source URL.
     * More restrictive: only allows https, relative, or safe data:image/* —
     * plus http when the host is localhost, so local development still works.
     * Protocol-relative URLs (`//host`) are rejected — they look relative but
     * load an arbitrary external host. Prefix checks run on a control-char
     * stripped copy so obfuscated forms are caught, while the original input
     * is returned so legitimate paths keep characters browsers resolve.
     */

    /**
     * Hosts whose remote resources may be loaded. Empty means NO POLICY: every
     * host is allowed, which is the default and preserves prior behaviour.
     *
     * Plain state with a setter rather than a DI token, because the allowlist is
     * per-editor configuration and this project keeps configuration in the
     * developer's own files rather than behind an injection token. The editor
     * scopes this service per instance (see its `providers`) so two editors on a
     * page can hold different policies.
     */
    private allowedHosts: () => readonly string[] = () => [];

    /**
     * The sanitizer of the nearest enclosing injector, or null at the root.
     *
     * A component that provides its own sanitizer is invisible to anything
     * ABOVE it -- Angular's DI only flows downward -- so an addon directive on
     * an ancestor registers its rules on a different instance. Holding the link
     * lets a descendant consult upward for contributed rules, which is the only
     * way `[uiRichTextActions]` on an ancestor can keep working.
     *
     * `optional` terminates the chain at the root, so there is no cycle.
     */
    private readonly parentSanitizer = inject(RichTextSanitizerService, {
        skipSelf: true,
        optional: true,
    });

    /**
     * Decisions made during the current pass, drained by the editor or the
     * view. Bounded: a consumer that injects the ROOT service directly and
     * renders through `toHtml` never drains, and an unbounded buffer would grow
     * for the life of the app. Past the cap the oldest decision is dropped.
     */
    private readonly decisions: ResourcePolicyDecision[] = [];
    /** `kind + url` of every buffered decision, so the dedupe below is O(1). */
    private readonly decisionKeys = new Set<string>();

    /**
     * The URL of the most recent source refused by the HOST POLICY, as opposed
     * to one refused for being unsafe. Consumed immediately by the `src`
     * handler; a stale value cannot leak because that handler clears it.
     */
    private lastBlockedByPolicy: string | null = null;

    /**
     * Take the URL of the source the last `sanitizeImageSrc` call refused on
     * POLICY grounds, or null when it was refused as unsafe (or not at all).
     *
     * Reading clears it, so a caller cannot mistake a stale value for its own
     * result. Callers use it to keep a blocked image as a placeholder while
     * still dropping an unsafe one outright.
     */
    takeBlockedByPolicy(): string | null {
        const url = this.lastBlockedByPolicy;
        this.lastBlockedByPolicy = null;
        return url;
    }

    /**
     * Replace the remote-host allowlist. Empty disables the policy.
     *
     * Accepts a READER as well as a list. A component whose policy is an input
     * signal passes the signal itself, so every sanitize pass reads the current
     * value at the moment it runs. Pushing a copy from an effect looked
     * equivalent and was not: a reactive form writes its initial value from
     * `ngOnChanges`, before any effect has run, so the first sanitize of every
     * such document ran with no policy at all -- the tracker image got a real
     * `src`, the editor rendered it, and the request fired once per load. A
     * reader cannot be stale, so that ordering no longer exists.
     */
    setRemoteHostPolicy(hosts: readonly string[] | (() => readonly string[])): void {
        if (typeof hosts === 'function') {
            this.allowedHosts = hosts;
            return;
        }
        const copy = [...hosts];
        this.allowedHosts = () => copy;
    }

    /** Take and clear the decisions recorded since the last drain. */
    drainResourceDecisions(): ResourcePolicyDecision[] {
        this.decisionKeys.clear();
        return this.decisions.splice(0, this.decisions.length);
    }

    /**
     * Judge one remote reference, recording the decision either way.
     *
     * Allowed references are recorded too, with `reason: 'no-policy'` when
     * nothing is configured -- that is what lets a developer see their real
     * exposure before deciding whether to set an allowlist.
     */
    private judgeResource(url: string, kind: 'image' | 'background'): boolean {
        if (!isHostBearingUrl(url)) return true;

        const hosts = this.allowedHosts();
        const allowed = isHostAllowed(url, hosts);
        // One decision per distinct reference per drain. The markdown path
        // judges an image twice on purpose -- once when parsing `![]()` and
        // again when the final sanitize re-reads the placeholder's
        // `data-blocked-src` -- and a consumer counting exposure must not see
        // the same tracker reported twice for one document.
        const key = `${kind}\u0000${url}`;
        if (!this.decisionKeys.has(key)) {
            if (this.decisions.length >= MAX_BUFFERED_DECISIONS) {
                const oldest = this.decisions.shift();
                if (oldest) this.decisionKeys.delete(`${oldest.kind}\u0000${oldest.url}`);
            }
            this.decisionKeys.add(key);
            this.decisions.push({
                url,
                host: remoteHostOf(url) ?? '',
                kind,
                allowed,
                reason: resourceReason(hosts.length === 0, allowed),
            });
        }
        return allowed;
    }


    /**
     * Whether a CSS declaration value may be kept.
     *
     * Two stages, in this order:
     *   1. code constructs (expression(), javascript:, data:) are refused
     *      outright, after escapes and comments resolve;
     *   2. any url() is judged by HOST -- allowed when the allowlist permits it
     *      (or when no allowlist is set), stripped otherwise.
     *
     * A value carrying a backslash that is not a resolvable escape is refused:
     * nothing in the allowlist -- colours, lengths, font names, alignments --
     * needs one, so refusing costs nothing and closes whatever the decoder
     * misses.
     */
    private isStyleValueAllowed(value: string): boolean {
        if (hasUnsafeStyleToken(value)) return false;

        // An allowlist of functions, because judging `url()` alone judged one
        // spelling of "fetch an image": `image-set("https://t/p.png" 1x)` has
        // no `url(` in it and a browser fetches it all the same (probed in
        // headless Chrome). Anything not known to be fetch-free is refused,
        // whatever the host policy says.
        if (hasUnsafeCssFunction(value)) return false;

        if (!containsCssUrl(value)) {
            return !value.includes('\\');
        }

        // A value whose url() is written with escapes is refused even when the
        // host would be allowed. The policy agreed with the browser here, but
        // storing the obfuscated form means the document only stays safe while
        // this decoder and the browser's keep agreeing -- and that divergence is
        // exactly what the \75rl( bypass was. An author with a legitimate URL
        // has no reason to escape it.
        if (value.includes('\\')) return false;

        // With NO allowlist, a url() is refused -- as it always was. The
        // original ban was justified on the grounds that <img> lets a tracker
        // through anyway, so blocking backgrounds bought nothing. That was
        // wrong: an <img> is visible content the author placed and a reader can
        // see, while a CSS background beacon is invisible. Relaxing the default
        // opened a channel that was closed for every existing consumer, on
        // upgrade, with no code change -- the opposite of "the default is
        // unchanged".
        //
        // A url() is permitted only where a developer has named hosts, which is
        // a deliberate act with the trade-off in front of them.
        if (this.allowedHosts().length === 0) return false;

        const urls = extractCssUrls(value);
        if (urls.length === 0) return false;

        return urls.every((url) => this.judgeResource(url, 'background'));
    }


    /**
     * Set an image source, or mark it as blocked.
     *
     * A source refused by the HOST POLICY keeps its element and its original
     * URL, so the reader sees a labelled frame rather than a hole and the block
     * is reversible if the host is later allowed. An UNSAFE source
     * (javascript:, a mislabelled data: payload) is simply dropped -- that is
     * not content the author should be invited to restore. `src` is never set
     * in either case: nothing is fetched, which is the entire point.
     */
    private applyImageSrc(target: HTMLElement, value: string): void {
        this.lastBlockedByPolicy = null;
        const safeSrc = this.sanitizeImageSrc(value);
        if (safeSrc) {
            target.setAttribute('src', safeSrc);
            return;
        }
        const blocked = this.takeBlockedByPolicy();
        if (blocked !== null) {
            target.dataset['blockedSrc'] = blocked;
        }
    }

    /** Validate and, for SVG, scrub a `data:image/*` source. */
    private sanitizeDataImageSrc(trimmed: string): string | null {
            if (!this.isAllowedDataUrl(trimmed)) return null;
            // Scrub by CONTENT, not by the MIME label. The label is attacker-
            // controlled and the magic-byte check accepts SVG whatever it says,
            // so "data:image/png;base64,<svg onload=...>" used to skip scrubbing
            // altogether -- storing unsanitized, script-bearing markup in
            // content the library asserts is clean. Current browsers will not
            // render it as an <img>, but anything rendering that content another
            // way (object/embed/inline, or a server sniffing by content) would.
            if (this.declaresOrContainsSvg(trimmed)) {
                return this.sanitizeSvgDataUrl(trimmed);
            }
            return trimmed;
    }

    sanitizeImageSrc(src: string): string | null {
        // Cleared on ENTRY, so the marker only ever describes this call. It
        // used to be cleared only by the attribute path; a caller that judged a
        // URL and never took the marker (an addon's insert-by-URL, say) left it
        // set, and the next markdown image that was refused as UNSAFE was
        // attributed the stale blocked URL -- a placeholder for an image the
        // author never placed, which would load if that host were later allowed.
        this.lastBlockedByPolicy = null;
        if (!src || typeof src !== 'string') {
            return null;
        }

        const trimmed = src.trim();
        const probe = trimmed.replace(this.URL_STRIP_PATTERN, '');

        if (probe.startsWith('//') || hasForeignAuthority(probe)) {
            return null;
        }

        if (probe.startsWith('/') || probe.startsWith('./') || probe.startsWith('../')) {
            return trimmed;
        }

        if (trimmed.toLowerCase().startsWith('data:image/')) {
            return this.sanitizeDataImageSrc(trimmed);
        }

        try {
            const url = new URL(trimmed);

            if (url.protocol === 'https:') {
                if (this.judgeResource(url.href, 'image')) return url.href;
                // Distinguish a policy block from a safety rejection, so the
                // caller can keep the element for one and not the other. Set
                // here because this is the only branch that knows the URL was
                // otherwise acceptable.
                this.lastBlockedByPolicy = url.href;
                return null;
            }

            if (url.protocol === 'http:' && this.isLocalhostUrl(url)) {
                return url.href;
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Strip all HTML tags, returning only text content.
     * Useful for plain text extraction.
     */
    stripTags(html: string): string {
        if (!html || typeof html !== 'string') {
            return '';
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return doc.body.textContent ?? '';
    }

    /** Tags that should be removed entirely (including content) */
    private readonly TAGS_TO_REMOVE = new Set([
        'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template'
    ]);

    private processElementNode(element: HTMLElement, target: HTMLElement): void {
        const tagName = element.tagName.toLowerCase();
        if (this.ALLOWED_TAGS.has(tagName)) {
            if (tagName === 'input' && element.getAttribute('type') !== 'checkbox') {
                return;
            }
            const cleanElement = this.document.createElement(tagName);
            this.sanitizeAttributes(element, cleanElement, tagName);
            this.processNodes(element, cleanElement);
            target.appendChild(cleanElement);
        } else if (!this.TAGS_TO_REMOVE.has(tagName)) {
            this.processNodes(element, target);
        }
    }

    /**
     * Process nodes recursively, copying safe content to clean container.
     */
    private processNodes(source: Node, target: HTMLElement): void {
        for (const node of Array.from(source.childNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
                target.appendChild(this.document.createTextNode(node.textContent ?? ''));
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                this.processElementNode(node as HTMLElement, target);
            }
            // Ignore comments, processing instructions, etc.
        }
    }

    /**
     * Copy only allowed attributes from source to target element.
     */
    private sanitizeAttributes(
        source: HTMLElement,
        target: HTMLElement,
        tagName: string
    ): void {
        const allowedForTag = this.ALLOWED_ATTRS[tagName];
        const allowedGlobal = this.ALLOWED_ATTRS['*'];

        for (const attr of Array.from(source.attributes)) {
            const attrName = attr.name.toLowerCase();

            if (this.EVENT_HANDLER_PATTERN.test(attrName)) {
                continue;
            }

            const isAllowed =
                allowedForTag?.has(attrName) ||
                allowedGlobal?.has(attrName);

            if (!isAllowed) {
                this.applyContributedAttribute(tagName, attrName, attr.value, target);
                continue;
            }

            this.applyAllowedAttribute(attrName, attr.value, target, source);
        }
    }

    private applyContributedAttribute(
        tagName: string, attrName: string, value: string, target: HTMLElement,
    ): void {
        const rule = this.findContributedRule(tagName, attrName);
        if (!rule) return;
        const kept = rule.validate ? rule.validate(value, target) : value;
        if (kept === null) return;
        target.setAttribute(attrName, kept);
    }

    private applyAllowedAttribute(attrName: string, value: string, target: HTMLElement, source: HTMLElement): void {
        switch (attrName) {
            case 'href': {
                const safeUrl = this.sanitizeUrl(value);
                if (safeUrl) {
                    target.setAttribute('href', safeUrl);
                    target.setAttribute('rel', 'noopener noreferrer');
                }
                return;
            }
            case 'src': {
                this.applyImageSrc(target, value);
                return;
            }
            case 'data-blocked-src': {
                // Re-judged, never copied. A blocked image is saved WITHOUT a
                // `src` and WITH this marker, so on the HTML path this is the
                // only place the original URL comes back through -- and it goes
                // through the same gate a `src` does. Allowed now: it becomes
                // `src` and the marker is dropped, which is what makes the
                // block reversible in HTML mode as well as markdown. Still
                // blocked: the marker is re-applied. Unsafe: dropped outright,
                // so a hand-written `data-blocked-src="javascript:..."` never
                // rides along verbatim.
                // Judged by what the SOURCE carries, not by what has landed on
                // the target so far: with the marker written before `src` in
                // attribute order the target had no src yet, both were applied,
                // and a loading image wore a stale blocked marker.
                if (!source.hasAttribute('src')) this.applyImageSrc(target, value);
                return;
            }
            case 'class': {
                const safeClasses = this.sanitizeClasses(value);
                if (safeClasses) {
                    target.setAttribute('class', safeClasses);
                }
                return;
            }
            case 'style': {
                const safeStyle = this.sanitizeStyle(value);
                if (safeStyle) {
                    target.setAttribute('style', safeStyle);
                }
                return;
            }
            case 'target': {
                if (value === '_blank') {
                    target.setAttribute('target', '_blank');
                }
                return;
            }
            case 'dir': {
                if (isTextDirection(value)) target.setAttribute('dir', value);
                return;
            }
            default:
                target.setAttribute(attrName, value);
        }
    }

    /**
     * Sanitize class attribute, only allowing specific patterns.
     */
    private sanitizeClasses(classValue: string): string {
        const classes = classValue.split(/\s+/).filter(Boolean);
        const safeClasses = classes.filter(cls =>
            this.ALLOWED_CLASS_PATTERNS.some(pattern => pattern.test(cls))
        );
        return safeClasses.join(' ');
    }

    /**
     * Check if a data: URL is an allowed image type with magic byte validation.
     */
    private isAllowedDataUrl(url: string): boolean {
        const allowedMimeTypes = [
            'data:image/png',
            'data:image/jpeg',
            'data:image/jpg',
            'data:image/gif',
            'data:image/webp',
            'data:image/svg+xml',
        ];

        const lowerUrl = url.toLowerCase();
        if (!allowedMimeTypes.some(mime => lowerUrl.startsWith(mime))) {
            return false;
        }

        if (lowerUrl.startsWith('data:image/svg+xml')) {
            return true;
        }

        const marker = ';base64,';
        const markerIndex = lowerUrl.indexOf(marker);
        if (markerIndex === -1) {
            // A data: URL without ';base64,' carries a percent-encoded payload.
            // Returning true here skipped content validation entirely, so
            // 'data:image/png,<script>...' was kept verbatim while the SAME
            // bytes base64-encoded were rejected -- the encoding decided the
            // verdict, not the content. Every data:image/* payload is checked.
            const comma = url.indexOf(',');
            if (comma === -1) return false;
            // Decoded to BYTES, not text. decodeURIComponent yields a UTF-8
            // string and THROWS on any sequence that is not valid UTF-8 -- and
            // every binary image format has a high byte in its magic number
            // (PNG, ÿØ for JPEG), so it rejected every percent-encoded
            // raster image. GIF and WebP survived only because their magic bytes
            // happen to be ASCII. In a document that is not a refused paste, it
            // is deletion: the <img> kept its alt and lost its src.
            const bytes = percentDecodeToBytes(url.slice(comma + 1));
            return bytes !== null && isValidImageMagicBytes(bytes);
        }

        const base64Start = markerIndex + marker.length;
        const chunk = url.substring(base64Start, base64Start + 16);
        if (!chunk) return false;

        try {
            const decoded = atob(chunk);
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.codePointAt(i) ?? 0;
            }
            return isValidImageMagicBytes(bytes);
        } catch {
            return false;
        }
    }

    private isLocalhostUrl(url: URL): boolean {
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    }

    /**
     * Sanitize an SVG data URL by parsing and sanitizing the SVG content.
     */
    /**
     * Whether a `data:image/*` URL is SVG by label or by payload. Mislabelled
     * SVG must take the scrubbing path, so both are checked.
     */
    private declaresOrContainsSvg(url: string): boolean {
        if (url.toLowerCase().startsWith('data:image/svg+xml')) return true;

        const comma = url.indexOf(',');
        if (comma === -1) return false;
        const payload = url.slice(comma + 1);
        let decoded: string;
        if (/;base64/i.test(url.slice(0, comma))) {
            try {
                decoded = atob(payload);
            } catch {
                // Undecodable payloads are not usable images either; treat them
                // as suspect so they take the scrubbing path rather than passing.
                return true;
            }
        } else {
            // Byte-wise, for the same reason as isAllowedDataUrl:
            // decodeURIComponent throws on a PNG's or JPEG's high magic bytes,
            // and the catch above then treated every percent-encoded raster
            // image as suspect -- routing it into SVG scrubbing, which stripped
            // the src and deleted the image from the document.
            const bytes = percentDecodeToBytes(payload);
            if (bytes === null) return true;
            decoded = Array.from(bytes, (b) => String.fromCodePoint(b)).join('');
        }
        return /<\s*svg\b/i.test(decoded);
    }

    /** A percent-encoded payload as text, or null when an escape is malformed. */
    private percentDecodeToText(payload: string): string | null {
        const bytes = percentDecodeToBytes(payload);
        return bytes === null ? null : new TextDecoder().decode(bytes);
    }

    sanitizeSvgDataUrl(url: string): string | null {
        const comma = url.indexOf(',');
        if (comma === -1) return null;
        const payload = url.slice(comma + 1);
        if (!payload) return null;

        // Both encodings are handled. Bailing unless ";base64," was present
        // silently deleted every URL-encoded SVG -- an ordinary, spec-legal
        // inline image -- with no feedback to the author. Fail-closed, so never
        // a security hole, but a real content-loss bug.
        const isBase64 = /;base64/i.test(url.slice(0, comma));

        try {
            // Byte-wise, then decoded with replacement: `decodeURIComponent`
            // throws on any sequence that is not valid UTF-8, and the catch
            // below then dropped the whole image for one stray byte in an
            // otherwise ordinary SVG. A replacement character is scrubbed like
            // any other text.
            const svgString = isBase64 ? atob(payload) : this.percentDecodeToText(payload);
            if (svgString === null) return null;
            const sanitized = sanitizeSvg(svgString);
            if (!sanitized) return null;
            return isBase64
                ? `data:image/svg+xml;base64,${btoa(sanitized)}`
                : `data:image/svg+xml,${encodeURIComponent(sanitized)}`;
        } catch {
            return null;
        }
    }

    /**
     * Sanitize style attribute, only allowing specific CSS properties.
     */
    private sanitizeStyle(styleValue: string): string {
        if (!styleValue) return '';

        const safeStyles: string[] = [];

        /** Parse the style string */
        const declarations = styleValue.split(';').filter(Boolean);
        for (const declaration of declarations) {
            const colonIndex = declaration.indexOf(':');
            if (colonIndex === -1) continue;

            const property = declaration.substring(0, colonIndex).trim().toLowerCase();
            const value = declaration.substring(colonIndex + 1).trim();

            if (this.ALLOWED_STYLE_PROPERTIES.has(property) && value) {
                // Tested against the value a BROWSER resolves, not its raw
                // spelling. These were substring checks on attacker-controlled
                // text, and CSS lets any identifier character be written as a
                // hex escape -- so "\\75rl(...)" sailed past a check for "url("
                // and the browser then loaded it. A pasted document could plant
                // a persistent tracking pixel that fires for every later viewer.
                //
                // Both the raw value and the browser's own reading of it must
                // pass. The hand-written escape and comment decoders are one
                // line of defence; the browser's tokenizer is the authority on
                // what the value will actually mean, so the canonical form is
                // judged too. The RAW value is what is stored, so output does
                // not change shape (hex colours stay hex).
                const canonical = this.canonicalStyleValue(property, value);
                if (this.isStyleValueAllowed(value) && (canonical === null || this.isStyleValueAllowed(canonical))) {
                    safeStyles.push(`${property}: ${value}`);
                }
            }
        }

        return safeStyles.join('; ');
    }

    /**
     * A declaration's value as the browser serialises it after parsing, or
     * null when the browser rejects the declaration or cannot serialise the
     * property (some shorthands). Parsed through a constructed stylesheet that
     * is never adopted, so nothing is fetched or applied.
     */
    private canonicalStyleValue(property: string, value: string): string | null {
        if (typeof CSSStyleSheet !== 'function') return null;
        try {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(`x{${property}:${value.replaceAll('}', '')}}`);
            const rule = sheet.cssRules[0] as CSSStyleRule | undefined;
            const canonical = rule?.style.getPropertyValue(property) ?? '';
            return canonical === '' ? null : canonical;
        } catch {
            return null;
        }
    }

    /**
     * Replace &quot; entities with single quotes inside style attribute values.
     * Browsers serialize CSS quoted strings (e.g. font-family: "Comic Sans MS")
     * with double quotes, which become &quot; in innerHTML. This produces
     * valid but problematic HTML. Single quotes are equally valid in CSS and
     * don't require HTML entity encoding inside double-quoted attributes.
     */
    private normalizeStyleQuotes(html: string): string {
        return html.replaceAll(
            /style="([^"]*)"/g,
            (_match: string, styleContent: string) =>
                `style="${styleContent.replaceAll('&quot;', "'")}"`,
        );
    }
}

/**
 * Whether a URL reaches another origin through its authority component.
 *
 * Browsers accept far more than "//host": a backslash is normalized to a
 * slash, and any run of delimiters longer than the scheme's own "//" still
 * opens an authority. So "https:/host" with a backslash, and "https:///host",
 * both reach the same place as "https://host".
 *
 * An earlier version pattern-matched the first TWO characters against a short
 * list of shapes. That is the shape where the bug is absent -- a single
 * backslash and three slashes both slipped through, resolved off-origin, and
 * were decorated with rel="noopener noreferrer" so the link read as vetted.
 * Counting the delimiter run is the general rule.
 */
/** The three values `dir` accepts. */
function isTextDirection(value: string): boolean {
    return value === 'rtl' || value === 'ltr' || value === 'auto';
}

/** A single backslash, spelled by code point so no escaping is needed. */
const BACKSLASH = '\u005C';

function hasForeignAuthority(url: string): boolean {
    // Only a LEADING scheme separates an authority; splitting on the first
    // colon anywhere read `/search?q=file:///etc` -- a same-origin path with a
    // URL in its query -- as an `https:///`-style authority and dropped it.
    const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(url);
    const afterScheme = scheme ? url.slice(scheme[0].length) : url;

    let run = 0;
    let backslashes = 0;
    while (run < afterScheme.length && (afterScheme[run] === '/' || afterScheme[run] === BACKSLASH)) {
        if (afterScheme[run] === BACKSLASH) backslashes++;
        run++;
    }

    // Exactly "//" is the ordinary absolute form. Any backslash in the run, or
    // a longer run, is a delimiter shape browsers still resolve as an authority
    // while the naive checks did not: a single backslash and three slashes
    // both reach the host.
    if (backslashes > 0) return true;
    if (!scheme) return run >= 2;
    return run > 2;
}
