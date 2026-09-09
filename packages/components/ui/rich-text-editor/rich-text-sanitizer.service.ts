import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { isValidImageMagicBytes } from '../../lib/parsers/image-validator';
import { sanitizeSvg } from '../../lib/parsers/svg-sanitizer';

import {
    containsCssUrl,
    decodeCssEscapes,
    extractCssUrls,
    stripCssComments,
    hostOf,
    isHostAllowed,
    isHostBearingUrl,
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
/** URL schemes a link in editor content may use. */
const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'sms', 'ftp']);

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
        'img': new Set(['src', 'alt', 'width', 'height', 'title', 'data-align', 'data-auto-upload-id', 'data-auto-upload-status']),
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

    private findContributedRule(tagName: string, attrName: string): SanitizerAttributeRule | undefined {
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

        return this.normalizeStyleQuotes(cleanContainer.innerHTML);
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
        if (scheme && !LINK_SCHEMES.has(scheme)) {
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
        if (!this.isUrlSafe(url)) {
            return null;
        }
        return url;
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
    private allowedHosts: readonly string[] = [];

    /** Decisions made during the current pass, drained by the editor. */
    private readonly decisions: ResourcePolicyDecision[] = [];

    /** Replace the remote-host allowlist. Empty disables the policy. */
    setRemoteHostPolicy(hosts: readonly string[]): void {
        this.allowedHosts = [...hosts];
    }

    /** Take and clear the decisions recorded since the last drain. */
    drainResourceDecisions(): ResourcePolicyDecision[] {
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

        const allowed = isHostAllowed(url, this.allowedHosts);
        this.decisions.push({
            url,
            host: hostOf(url) ?? '',
            kind,
            allowed,
            reason: resourceReason(this.allowedHosts.length === 0, allowed),
        });
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

        const urls = extractCssUrls(value);
        if (urls.length === 0) return false;

        return urls.every((url) => this.judgeResource(url, 'background'));
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
                return this.judgeResource(url.href, 'image') ? url.href : null;
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

            this.applyAllowedAttribute(attrName, attr.value, target);
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

    private applyAllowedAttribute(attrName: string, value: string, target: HTMLElement): void {
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
                const safeSrc = this.sanitizeImageSrc(value);
                if (safeSrc) {
                    target.setAttribute('src', safeSrc);
                }
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
                if (value === 'rtl' || value === 'ltr' || value === 'auto') {
                    target.setAttribute('dir', value);
                }
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
            const svgString = isBase64 ? atob(payload) : decodeURIComponent(payload);
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
                if (this.isStyleValueAllowed(value)) {
                    safeStyles.push(`${property}: ${value}`);
                }
            }
        }

        return safeStyles.join('; ');
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
/** A single backslash, spelled by code point so no escaping is needed. */
const BACKSLASH = '\u005C';

function hasForeignAuthority(url: string): boolean {
    const colon = url.indexOf(':');
    const afterScheme = colon === -1 ? url : url.slice(colon + 1);

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
    if (colon === -1) return run >= 2;
    return run > 2;
}
