import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

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
    ]);

    // Allowlisted attributes per element
    private readonly ALLOWED_ATTRS: Record<string, Set<string>> = {
        'a': new Set(['href', 'title', 'target', 'rel']),
        'img': new Set(['src', 'alt', 'width', 'height', 'title']),
        'td': new Set(['colspan', 'rowspan']),
        'th': new Set(['colspan', 'rowspan', 'scope']),
        'pre': new Set(['data-language']),
        'code': new Set(['data-language', 'class']), // class for syntax highlighting
        '*': new Set(['data-mention', 'data-mention-id', 'data-tag', 'data-tag-id', 'style']),
    };

    // Allowed CSS properties for inline styles
    private readonly ALLOWED_STYLE_PROPERTIES = new Set([
        'color',
        'background-color',
        'text-align',
        'font-size',
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
            return this.isAllowedDataUrl(trimmed) ? trimmed : null;
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
                    // Create clean element
                    const cleanElement = this.document.createElement(tagName);

                    // Copy allowed attributes
                    this.sanitizeAttributes(element, cleanElement, tagName);

                    // Recursively process children
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

            // Block all event handlers
            if (this.EVENT_HANDLER_PATTERN.test(attrName)) {
                continue;
            }

            // Check if attribute is allowed
            const isAllowed =
                allowedForTag?.has(attrName) ||
                allowedGlobal?.has(attrName);

            if (!isAllowed) {
                continue;
            }

            // Special handling for href and src
            if (attrName === 'href') {
                const safeUrl = this.sanitizeUrl(attr.value);
                if (safeUrl) {
                    target.setAttribute('href', safeUrl);
                    // Force safe link behavior
                    target.setAttribute('rel', 'noopener noreferrer');
                }
                continue;
            }

            if (attrName === 'src') {
                const safeSrc = this.sanitizeImageSrc(attr.value);
                if (safeSrc) {
                    target.setAttribute('src', safeSrc);
                }
                continue;
            }

            // Special handling for class attribute
            if (attrName === 'class') {
                const safeClasses = this.sanitizeClasses(attr.value);
                if (safeClasses) {
                    target.setAttribute('class', safeClasses);
                }
                continue;
            }

            // Special handling for style attribute
            if (attrName === 'style') {
                const safeStyle = this.sanitizeStyle(attr.value);
                if (safeStyle) {
                    target.setAttribute('style', safeStyle);
                }
                continue;
            }

            // Special handling for target attribute (links)
            if (attrName === 'target') {
                // Only allow _blank
                if (attr.value === '_blank') {
                    target.setAttribute('target', '_blank');
                }
                continue;
            }

            // Copy other allowed attributes as-is
            target.setAttribute(attrName, attr.value);
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
     * Check if a data: URL is an allowed image type.
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
        return allowedMimeTypes.some(mime => lowerUrl.startsWith(mime));
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
