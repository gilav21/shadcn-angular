import { TestBed } from '@angular/core/testing';
import { RichTextSanitizerService } from './rich-text-editor/rich-text-sanitizer.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('RichTextSanitizerService Security Audit', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [RichTextSanitizerService]
        });
        service = TestBed.inject(RichTextSanitizerService);
    });

    // Helper to bypass Angular's trustHTML for input, simulating raw input
    // In reality, calling sanitize() with string is what we test
    const sanitize = (html: string) => service.sanitize(html);

    /**
     * The decoded SVG a sanitized `<img>` still carries, or '' when the
     * sanitizer dropped the SVG source outright (also safe).
     */
    const svgImagePayload = (output: string): string => {
        if (!output.includes('data:image/svg+xml')) return '';
        const src = /src="([^"]+)"/.exec(output);
        expect(src).not.toBeNull();
        const url = src![1].replaceAll('&amp;', '&');
        const comma = url.indexOf(',');
        const data = url.slice(comma + 1);
        return url.slice(0, comma).endsWith(';base64') ? atob(data) : decodeURIComponent(data);
    };

    describe('XSS via Script Tags', () => {
        it('should remove potentially obfuscated script tags', () => {
            const input = '<div><SCRIPT>alert(1)</SCRIPT></div>';
            expect(sanitize(input)).toBe('<div></div>');
        });
    });

    describe('XSS via Event Handlers', () => {
        it('should remove handlers even with mixed case', () => {
            const input = '<div ONCLICK="alert(1)">Click me</div>';
            // Note: browser parser often enforces lowercase attributes, but specific sanitizers might see raw string
            const output = sanitize(input);
            expect(output).not.toContain('ONCLICK');
            expect(output).not.toContain('alert(1)');
        });
    });

    describe('XSS via URI Schemes', () => {
        it('should sanitize javascript: links', () => {
            const input = '<a href="javascript:alert(1)">Link</a>';
            const output = sanitize(input);
            // Expect href to be removed entirely since it returns null
            expect(output).not.toContain('javascript:alert(1)');
            expect(output).not.toContain('href');
        });

    });

    describe('XSS via CSS (Style Attribute)', () => {
        it('should prevent javascript in style attributes', () => {
            const input = '<div style="background-image: url(javascript:alert(1))">Test</div>';
            const output = sanitize(input);
            // Our custom style sanitizer should filter this
            expect(output).not.toContain('javascript:');
            // Or expect style to be stripped completely if invalid
        });

    });

    describe('Obfuscation & Tricky Vectors', () => {
        it('should handle object/embed tags', () => {
            const input = '<object data="evil.swf"></object>';
            expect(sanitize(input)).not.toContain('<object');
        });
    });

    describe('Base64 Image Magic Byte Validation', () => {
        it('should keep img with valid PNG base64 content', () => {
            const pngBytes = String.fromCodePoint(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00);
            const dataUrl = `data:image/png;base64,${btoa(pngBytes)}`;
            const input = `<img src="${dataUrl}">`;
            const output = sanitize(input);
            expect(output).toContain('data:image/png');
        });

        it('should strip img with fake PNG base64 (JavaScript content)', () => {
            const jsContent = 'const x = 1; function hack() {}';
            const dataUrl = `data:image/png;base64,${btoa(jsContent)}`;
            const input = `<img src="${dataUrl}">`;
            const output = sanitize(input);
            expect(output).not.toContain('base64');
        });

        it('should allow img with sanitized SVG data URL', () => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="red"/></svg>';
            const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
            const input = `<img src="${dataUrl}">`;
            const output = sanitize(input);
            expect(output).toContain('data:image/svg+xml');
            expect(output).toContain('base64');
        });

        it('should strip script from SVG data URL in img src', () => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script><rect width="10" height="10"/></svg>';
            const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
            const input = `<img src="${dataUrl}">`;
            const payload = svgImagePayload(sanitize(input));
            expect(payload).not.toContain('<script');
            expect(payload).not.toContain('alert');
        });

        it('should strip foreignObject from SVG data URL', () => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>';
            const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
            const input = `<img src="${dataUrl}">`;
            const payload = svgImagePayload(sanitize(input));
            expect(payload).not.toContain('foreignObject');
            expect(payload).not.toContain('<script');
        });
    });

    describe('XSS via Whitespace/Control-Char Obfuscated Schemes', () => {
        it('should strip javascript: links with an embedded tab', () => {
            const output = sanitize('<a href="java&#9;script:alert(1)">Link</a>');
            expect(output).not.toContain('href');
            expect(output).not.toContain('alert');
        });

        it('should strip javascript: links with an embedded newline', () => {
            const output = sanitize('<a href="java&#10;script:alert(1)">Link</a>');
            expect(output).not.toContain('href');
            expect(output).not.toContain('alert');
        });

        it('should strip javascript: links with an embedded carriage return', () => {
            const output = sanitize('<a href="java&#13;script:alert(1)">Link</a>');
            expect(output).not.toContain('href');
            expect(output).not.toContain('alert');
        });

        it('should strip javascript: links hidden with a zero-width space', () => {
            const output = sanitize('<a href="java&#8203;script:alert(1)">Link</a>');
            expect(output).not.toContain('href');
            expect(output).not.toContain('alert');
        });

        it('should strip javascript: links hidden with a soft hyphen', () => {
            const output = sanitize('<a href="java&#173;script:alert(1)">Link</a>');
            expect(output).not.toContain('href');
            expect(output).not.toContain('alert');
        });

        it('should strip javascript: links with a leading control character', () => {
            const output = sanitize('<a href="&#1;javascript:alert(1)">Link</a>');
            expect(output).not.toContain('href');
            expect(output).not.toContain('alert');
        });

        it('should strip vbscript: links with embedded whitespace', () => {
            const output = sanitize('<a href="vb&#9;script:alert(1)">Link</a>');
            expect(output).not.toContain('href');
            expect(output).not.toContain('vbscript');
        });

        it('should report obfuscated schemes as unsafe via isUrlSafe', () => {
            expect(service.isUrlSafe('java' + String.fromCodePoint(9) + 'script:alert(1)')).toBe(false);
            expect(service.isUrlSafe('java' + String.fromCodePoint(10) + 'script:alert(1)')).toBe(false);
            expect(service.isUrlSafe(String.fromCodePoint(1) + 'javascript:alert(1)')).toBe(false);
            expect(service.isUrlSafe('java' + String.fromCodePoint(0x200b) + 'script:alert(1)')).toBe(false);
        });
    });

    describe('Protocol-relative image sources', () => {
        it('should reject //host hidden behind whitespace', () => {
            const src = '/' + String.fromCodePoint(9) + '/evil.com/track.png';
            expect(service.sanitizeImageSrc(src)).toBeNull();
        });

        it('should strip <img> with a protocol-relative src', () => {
            const output = sanitize('<img src="//evil.com/track.png">');
            expect(output).not.toContain('evil.com');
        });
    });
});
