import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { isValidImageMagicBytes } from '../../lib/parsers/image-validator';
import { sanitizeSvg } from '../../lib/parsers/svg-sanitizer';

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
@Injectable({ providedIn: 'root' })
export class RichTextSanitizerService {
    private readonly document = inject(DOCUMENT);

    // Allowlisted elements - only these can appear in sanitized output
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

    // Allowlisted attributes per element
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

    // Allowed CSS properties for inline styles
    private readonly ALLOWED_STYLE_PROPERTIES = new Set([
        'color',
        'background-color',
        // The `background` shorthand is what document importers actually emit
        // (pdf-readable writes every fill as `background:<color>`). Without it
        // the fill is dropped while the text colour survives, so light text
        // that relied on a dark fill renders invisible. Values containing
        // `url(` / `expression(` / `javascript:` are still rejected below.
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

    // Allowed class patterns (for syntax highlighting)
    private readonly ALLOWED_CLASS_PATTERNS = [
        /^language-\w+$/,      // language-javascript, language-python, etc.
        /^hljs(-\w+)?$/,       // hljs, hljs-keyword, etc.
        /^token(-\w+)?$/,      // Prism.js tokens
    ];

    // Dangerous URL protocols to block
    private readonly DANGEROUS_PROTOCOLS = new Set([
        'javascript:',
        'vbscript:',
        'data:',  // Block data: except for images
    ]);

    // Event handler attributes pattern
    private readonly EVENT_HANDLER_PATTERN = /^on\w+$/i;

    // Attributes an addon rule may never target — the security boundary stays here.
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

    // Control, whitespace, and zero-width / bidi / format characters that
    // browsers ignore or normalize inside URLs; stripped before a URL scheme
    // is inspected so they cannot mask a dangerous protocol.
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

        // Parse HTML into DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Create a clean container
        const cleanContainer = this.document.createElement('div');

        // Process all child nodes of body
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

        for (const protocol of this.DANGEROUS_PROTOCOLS) {
            if (probe.startsWith(protocol)) {
                return protocol === 'data:' && this.isAllowedDataUrl(probe);
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
     * More restrictive: only allows https, relative, or safe data:image/*.
     * Protocol-relative URLs (`//host`) are rejected — they look relative but
     * load an arbitrary external host. Prefix checks run on a control-char
     * stripped copy so obfuscated forms are caught, while the original input
     * is returned so legitimate paths keep characters browsers resolve.
     */
    sanitizeImageSrc(src: string): string | null {
        if (!src || typeof src !== 'string') {
            return null;
        }

        const trimmed = src.trim();
        const probe = trimmed.replace(this.URL_STRIP_PATTERN, '');

        // Reject protocol-relative URLs that load an arbitrary external host
        if (probe.startsWith('//') || probe.startsWith('/\\')) {
            return null;
        }

        // Allow relative URLs
        if (probe.startsWith('/') || probe.startsWith('./') || probe.startsWith('../')) {
            return trimmed;
        }

        // Allow safe data:image/* URLs
        if (trimmed.toLowerCase().startsWith('data:image/')) {
            if (!this.isAllowedDataUrl(trimmed)) return null;
            if (trimmed.toLowerCase().startsWith('data:image/svg+xml')) {
                return this.sanitizeSvgDataUrl(trimmed);
            }
            return trimmed;
        }

        // Try to parse as URL
        try {
            const url = new URL(trimmed);

            // Only allow https (and http for localhost during development)
            if (url.protocol === 'https:') {
                return url.href;
            }

            // Allow http only for localhost (development)
            if (url.protocol === 'http:' && this.isLocalhostUrl(url)) {
                return url.href;
            }

            return null;
        } catch {
            // If URL parsing fails, reject
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

    // Tags that should be removed entirely (including content)
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
                // Text nodes are always safe
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
        if (markerIndex === -1) return true;

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
    sanitizeSvgDataUrl(url: string): string | null {
        const marker = ';base64,';
        const markerIndex = url.toLowerCase().indexOf(marker);
        if (markerIndex === -1) return null;

        const base64Data = url.substring(markerIndex + marker.length);
        if (!base64Data) return null;

        try {
            const svgString = atob(base64Data);
            const sanitized = sanitizeSvg(svgString);
            if (!sanitized) return null;
            return `data:image/svg+xml;base64,${btoa(sanitized)}`;
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

        // Parse the style string
        const declarations = styleValue.split(';').filter(Boolean);
        for (const declaration of declarations) {
            const colonIndex = declaration.indexOf(':');
            if (colonIndex === -1) continue;

            const property = declaration.substring(0, colonIndex).trim().toLowerCase();
            const value = declaration.substring(colonIndex + 1).trim();

            // Only allow whitelisted properties
            if (this.ALLOWED_STYLE_PROPERTIES.has(property) && value) {
                // Basic value sanitization - no url(), expression(), etc.
                const lowerValue = value.toLowerCase();
                if (!lowerValue.includes('url(') &&
                    !lowerValue.includes('expression(') &&
                    !lowerValue.includes('javascript:')) {
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
