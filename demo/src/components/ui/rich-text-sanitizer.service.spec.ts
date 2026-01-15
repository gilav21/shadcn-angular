import { TestBed } from '@angular/core/testing';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { beforeEach, describe, expect, it } from 'vitest';

describe('RichTextSanitizerService', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [RichTextSanitizerService],
        });
        service = TestBed.inject(RichTextSanitizerService);
    });

    describe('sanitize', () => {
        it('should return empty string for null/undefined', () => {
            expect(service.sanitize(null as unknown as string)).toBe('');
            expect(service.sanitize(undefined as unknown as string)).toBe('');
            expect(service.sanitize('')).toBe('');
        });

        it('should preserve allowed block elements', () => {
            const html = '<p>Hello</p><div>World</div><h1>Title</h1>';
            expect(service.sanitize(html)).toBe('<p>Hello</p><div>World</div><h1>Title</h1>');
        });

        it('should preserve inline formatting elements', () => {
            const html = '<strong>Bold</strong> <em>Italic</em> <u>Underline</u>';
            expect(service.sanitize(html)).toBe('<strong>Bold</strong> <em>Italic</em> <u>Underline</u>');
        });

        it('should preserve code blocks', () => {
            const html = '<pre><code>const x = 1;</code></pre>';
            expect(service.sanitize(html)).toBe('<pre><code>const x = 1;</code></pre>');
        });

        it('should preserve lists', () => {
            const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
            expect(service.sanitize(html)).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
        });
    });

    describe('XSS prevention - script injection', () => {
        it('should remove script tags completely', () => {
            const html = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
            const result = service.sanitize(html);
            expect(result).not.toContain('<script');
            expect(result).not.toContain('alert');
            expect(result).toContain('<p>Hello</p>');
            expect(result).toContain('<p>World</p>');
        });

        it('should remove inline script elements', () => {
            const html = '<script type="text/javascript">document.cookie</script>';
            expect(service.sanitize(html)).toBe('');
        });

        it('should remove scripts in attributes via event handlers', () => {
            const html = '<img src="x" onerror="alert(1)">';
            const result = service.sanitize(html);
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });
    });

    describe('XSS prevention - event handlers', () => {
        it('should remove onclick handlers', () => {
            const html = '<button onclick="evil()">Click</button>';
            const result = service.sanitize(html);
            expect(result).not.toContain('onclick');
        });

        it('should remove onmouseover handlers', () => {
            const html = '<div onmouseover="evil()">Hover</div>';
            const result = service.sanitize(html);
            expect(result).not.toContain('onmouseover');
        });

        it('should remove onload handlers from images', () => {
            const html = '<img src="valid.jpg" onload="evil()">';
            const result = service.sanitize(html);
            expect(result).not.toContain('onload');
        });

        it('should remove onerror handlers from images', () => {
            const html = '<img src="invalid" onerror="alert(document.cookie)">';
            const result = service.sanitize(html);
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });

        it('should remove onfocus/onblur handlers', () => {
            const html = '<input onfocus="evil()" onblur="evil2()">';
            const result = service.sanitize(html);
            expect(result).not.toContain('onfocus');
            expect(result).not.toContain('onblur');
        });
    });

    describe('XSS prevention - javascript: URLs', () => {
        it('should remove javascript: in href', () => {
            const html = '<a href="javascript:alert(1)">Click</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('javascript:');
        });

        it('should remove javascript: with whitespace variations', () => {
            const html = '<a href="  javascript:alert(1)">Click</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('javascript');
        });

        it('should remove javascript: in image src', () => {
            const html = '<img src="javascript:alert(1)">';
            const result = service.sanitize(html);
            expect(result).not.toContain('javascript:');
        });

        it('should remove vbscript: URLs', () => {
            const html = '<a href="vbscript:msgbox(1)">Click</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('vbscript');
        });
    });

    describe('XSS prevention - data: URLs', () => {
        it('should allow safe data:image URLs', () => {
            const html = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA">';
            const result = service.sanitize(html);
            expect(result).toContain('data:image/png');
        });

        it('should block data:text/html URLs', () => {
            const html = '<img src="data:text/html,<script>alert(1)</script>">';
            const result = service.sanitize(html);
            expect(result).not.toContain('data:text/html');
        });

        it('should block data: URLs in links', () => {
            const html = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('data:text/html');
        });
    });

    describe('image src sanitization', () => {
        it('should allow https image URLs', () => {
            const result = service.sanitizeImageSrc('https://example.com/image.jpg');
            expect(result).toBe('https://example.com/image.jpg');
        });

        it('should allow relative image URLs', () => {
            expect(service.sanitizeImageSrc('/images/photo.jpg')).toBe('/images/photo.jpg');
            expect(service.sanitizeImageSrc('./photo.jpg')).toBe('./photo.jpg');
            expect(service.sanitizeImageSrc('../photo.jpg')).toBe('../photo.jpg');
        });

        it('should block http image URLs (except localhost)', () => {
            expect(service.sanitizeImageSrc('http://evil.com/image.jpg')).toBeNull();
            expect(service.sanitizeImageSrc('http://localhost/image.jpg')).toBe('http://localhost/image.jpg');
        });

        it('should block javascript: in image src', () => {
            expect(service.sanitizeImageSrc('javascript:alert(1)')).toBeNull();
        });

        it('should allow data:image/png', () => {
            const src = 'data:image/png;base64,abc123';
            expect(service.sanitizeImageSrc(src)).toBe(src);
        });

        it('should allow data:image/jpeg', () => {
            const src = 'data:image/jpeg;base64,abc123';
            expect(service.sanitizeImageSrc(src)).toBe(src);
        });

        it('should allow data:image/gif', () => {
            const src = 'data:image/gif;base64,abc123';
            expect(service.sanitizeImageSrc(src)).toBe(src);
        });

        it('should allow data:image/webp', () => {
            const src = 'data:image/webp;base64,abc123';
            expect(service.sanitizeImageSrc(src)).toBe(src);
        });

        it('should allow data:image/svg+xml', () => {
            const src = 'data:image/svg+xml;base64,abc123';
            expect(service.sanitizeImageSrc(src)).toBe(src);
        });

        it('should block non-image data URLs', () => {
            expect(service.sanitizeImageSrc('data:text/html,<script>alert(1)</script>')).toBeNull();
            expect(service.sanitizeImageSrc('data:application/javascript,alert(1)')).toBeNull();
        });
    });

    describe('URL sanitization', () => {
        it('should allow safe URLs', () => {
            expect(service.sanitizeUrl('https://example.com')).toBe('https://example.com');
            expect(service.sanitizeUrl('http://example.com')).toBe('http://example.com');
            expect(service.sanitizeUrl('/path/to/page')).toBe('/path/to/page');
        });

        it('should block javascript URLs', () => {
            expect(service.sanitizeUrl('javascript:alert(1)')).toBeNull();
        });

        it('should block vbscript URLs', () => {
            expect(service.sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
        });
    });

    describe('link handling', () => {
        it('should preserve safe links', () => {
            const html = '<a href="https://example.com">Link</a>';
            const result = service.sanitize(html);
            expect(result).toContain('href="https://example.com"');
        });

        it('should add rel="noopener noreferrer" to links', () => {
            const html = '<a href="https://example.com">Link</a>';
            const result = service.sanitize(html);
            expect(result).toContain('rel="noopener noreferrer"');
        });

        it('should preserve target="_blank" only', () => {
            const html = '<a href="https://example.com" target="_blank">Link</a>';
            const result = service.sanitize(html);
            expect(result).toContain('target="_blank"');
        });

        it('should strip other target values', () => {
            const html = '<a href="https://example.com" target="_top">Link</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('target="_top"');
        });
    });

    describe('disallowed elements are unwrapped', () => {
        it('should unwrap style tags but preserve text', () => {
            const html = '<p>Hello <style>.evil{}</style>World</p>';
            const result = service.sanitize(html);
            expect(result).not.toContain('<style');
            expect(result).toContain('Hello');
            expect(result).toContain('World');
        });

        it('should unwrap custom/unknown elements', () => {
            const html = '<custom-element>Content</custom-element>';
            const result = service.sanitize(html);
            expect(result).not.toContain('custom-element');
            expect(result).toContain('Content');
        });

        it('should unwrap form elements', () => {
            const html = '<form action="/evil"><input type="text">Submit</form>';
            const result = service.sanitize(html);
            expect(result).not.toContain('<form');
            expect(result).not.toContain('<input');
            expect(result).toContain('Submit');
        });

        it('should unwrap iframe elements', () => {
            const html = '<iframe src="https://evil.com">Fallback</iframe>';
            const result = service.sanitize(html);
            expect(result).not.toContain('<iframe');
            expect(result).toContain('Fallback');
        });
    });

    describe('attribute sanitization', () => {
        it('should remove style attributes', () => {
            const html = '<p style="color: red">Text</p>';
            const result = service.sanitize(html);
            expect(result).not.toContain('style=');
        });

        it('should remove class attributes except allowed patterns', () => {
            const html = '<p class="evil-class custom-style">Text</p>';
            const result = service.sanitize(html);
            expect(result).not.toContain('evil-class');
        });

        it('should preserve language- class for code highlighting', () => {
            const html = '<code class="language-javascript">code</code>';
            const result = service.sanitize(html);
            expect(result).toContain('class="language-javascript"');
        });

        it('should preserve data-mention attributes', () => {
            const html = '<span data-mention="john" data-mention-id="123">@john</span>';
            const result = service.sanitize(html);
            expect(result).toContain('data-mention="john"');
            expect(result).toContain('data-mention-id="123"');
        });

        it('should preserve data-tag attributes', () => {
            const html = '<span data-tag="angular" data-tag-id="456">#angular</span>';
            const result = service.sanitize(html);
            expect(result).toContain('data-tag="angular"');
            expect(result).toContain('data-tag-id="456"');
        });
    });

    describe('table handling', () => {
        it('should preserve allowed table structure', () => {
            const html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>';
            const result = service.sanitize(html);
            expect(result).toContain('<table>');
            expect(result).toContain('<thead>');
            expect(result).toContain('<tbody>');
            expect(result).toContain('<tr>');
            expect(result).toContain('<th>');
            expect(result).toContain('<td>');
        });

        it('should preserve colspan/rowspan on cells', () => {
            const html = '<table><tr><td colspan="2" rowspan="3">Merged</td></tr></table>';
            const result = service.sanitize(html);
            expect(result).toContain('colspan="2"');
            expect(result).toContain('rowspan="3"');
        });
    });

    describe('stripTags', () => {
        it('should return plain text from HTML', () => {
            const html = '<p>Hello <strong>World</strong>!</p>';
            expect(service.stripTags(html)).toBe('Hello World!');
        });

        it('should handle empty input', () => {
            expect(service.stripTags('')).toBe('');
            expect(service.stripTags(null as unknown as string)).toBe('');
        });

        it('should handle nested elements', () => {
            const html = '<div><p>Line 1</p><p>Line 2</p></div>';
            expect(service.stripTags(html)).toBe('Line 1Line 2');
        });
    });

    describe('sanitizeToFragment', () => {
        it('should return a DocumentFragment', () => {
            const html = '<p>Hello</p>';
            const fragment = service.sanitizeToFragment(html);
            expect(fragment).toBeInstanceOf(DocumentFragment);
            expect(fragment.firstChild?.textContent).toBe('Hello');
        });
    });

    describe('complex XSS vectors', () => {
        it('should handle SVG XSS vectors', () => {
            const html = '<svg onload="alert(1)"><script>evil()</script></svg>';
            const result = service.sanitize(html);
            expect(result).not.toContain('onload');
            expect(result).not.toContain('<script');
            expect(result).not.toContain('alert');
        });

        it('should handle malformed HTML gracefully', () => {
            const html = '<p>Unclosed <b>tags <i>here';
            const result = service.sanitize(html);
            // Should not throw, should return valid HTML
            expect(result).toContain('Unclosed');
        });

        it('should handle HTML entities', () => {
            const html = '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>';
            const result = service.sanitize(html);
            expect(result).toContain('&lt;script&gt;');
            expect(result).not.toContain('<script>');
        });

        it('should handle URL encoding in javascript:', () => {
            const html = '<a href="java&#115;cript:alert(1)">XSS</a>';
            // After HTML parsing, entities are decoded
            const result = service.sanitize(html);
            expect(result).not.toContain('href="javascript:');
        });

        it('should handle mixed case javascript:', () => {
            const html = '<a href="JaVaScRiPt:alert(1)">XSS</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('javascript');
        });
    });
});
