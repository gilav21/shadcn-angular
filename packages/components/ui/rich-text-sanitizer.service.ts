import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { isValidImageMagicBytes } from '../lib/image-validator';
import { sanitizeSvg } from '../lib/svg-sanitizer';

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
        '*': new Set(['data-mention', 'data-mention-id', 'data-tag', 'data-tag-id', 'style']),
    };

    // Allowed CSS properties for inline styles
    private readonly ALLOWED_STYLE_PROPERTIES = new Set([
        'color',
        'background-color',
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

        return cleanContainer.innerHTML;
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
     * Check if a URL is safe (not javascript:, vbscript:, or suspicious data:)
     */
    isUrlSafe(url: string): boolean {
        if (!url || typeof url !== 'string') {
            return false;
        }

        const trimmed = url.trim().toLowerCase();

        // Check for dangerous protocols
        for (const protocol of this.DANGEROUS_PROTOCOLS) {
            if (trimmed.startsWith(protocol)) {
                // Exception: allow safe data:image/* URLs
                if (protocol === 'data:' && this.isAllowedDataUrl(trimmed)) {
                    return true;
                }
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
     * More restrictive: only allows https, relative, or safe data:image/*.
     */
    sanitizeImageSrc(src: string): string | null {
        if (!src || typeof src !== 'string') {
            return null;
        }

        const trimmed = src.trim();

        // Allow relative URLs
        if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
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
            if (url.protocol === 'http:' &&
                (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
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

    /**
     * Process nodes recursively, copying safe content to clean container.
     */
    private processNodes(source: Node, target: HTMLElement): void {
        for (const node of Array.from(source.childNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
                // Text nodes are always safe
                target.appendChild(this.document.createTextNode(node.textContent ?? ''));
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                const tagName = element.tagName.toLowerCase();

                if (this.ALLOWED_TAGS.has(tagName)) {
                    if (tagName === 'input' && element.getAttribute('type') !== 'checkbox') {
                        continue;
                    }

                    const cleanElement = this.document.createElement(tagName);

                    this.sanitizeAttributes(element, cleanElement, tagName);

                    this.processNodes(element, cleanElement);

                    target.appendChild(cleanElement);
                } else if (!this.TAGS_TO_REMOVE.has(tagName)) {
                    // Element not allowed but not dangerous - process children (unwrap)
                    // This preserves text content from harmless disallowed wrappers (e.g. invalid spans)
                    this.processNodes(element, target);
                }
                // If tag is in TAGS_TO_REMOVE, we simply skip it (drop it entirely)
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
                continue;
            }

            this.applyAllowedAttribute(attrName, attr.value, target);
        }
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
}
