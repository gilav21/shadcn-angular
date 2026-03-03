import { TestBed } from '@angular/core/testing';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
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

    describe('XSS via Script Tags', () => {
        it('should remove <script> tags entirely', () => {
            const input = '<div>Safe<script>alert("XSS")</script></div>';
            expect(sanitize(input)).toBe('<div>Safe</div>');
        });

        it('should remove potentially obfuscated script tags', () => {
            const input = '<div><SCRIPT>alert(1)</SCRIPT></div>';
            expect(sanitize(input)).toBe('<div></div>');
        });
    });

    describe('XSS via Event Handlers', () => {
        it('should remove img onerror handler', () => {
            const input = '<img src=x onerror=alert(1)>';
            // Expect sanitizer to strip onerror but keep img if allowed, or strip img if valid src required
            // Our sanitizer allows img but only specific attrs
            const output = sanitize(input);
            expect(output).not.toContain('onerror');
            expect(output).not.toContain('alert(1)');
        });

        it('should remove onclick handlers from undefined tags', () => {
            const input = '<div onclick="alert(1)">Click me</div>';
            const output = sanitize(input);
            expect(output).not.toContain('onclick');
        });

        it('should remove mouseover handlers', () => {
            const input = '<b onmouseover=alert(1)>Hover me</b>';
            const output = sanitize(input);
            expect(output).not.toContain('onmouseover');
        });

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

        it('should sanitize vbscript: links', () => {
            const input = '<a href="vbscript:alert(1)">Link</a>';
            const output = sanitize(input);
            expect(output).not.toContain('vbscript:');
        });

        it('should allow data:image/svg+xml URLs with sanitized content', () => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
            const input = `<img src="data:image/svg+xml;base64,${btoa(svg)}">`;
            const output = sanitize(input);
            expect(output).toContain('data:image/svg+xml');
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

        it('should prevent expression() in style', () => {
            const input = '<div style="width: expression(alert(1))">Test</div>';
            const output = sanitize(input);
            expect(output).not.toContain('expression');
        });

        it('should allow safe styles', () => {
            const input = '<div style="color: red; font-size: 14px;">Safe</div>';
            const output = sanitize(input);
            expect(output).toContain('color: red');
            expect(output).toContain('font-size: 14px');
        });

        it('should prevent unknown properties (whitelist approach check)', () => {
            const input = '<div style="position: absolute; top: 0;">Test</div>';
            const output = sanitize(input);
            // If we only whitelisted color/bg/font, this should be stripped
            expect(output).not.toContain('position');
            expect(output).not.toContain('absolute');
        });
    });

    describe('Obfuscation & Tricky Vectors', () => {
        it('should handle iframe injections', () => {
            const input = '<iframe src="http://attacker.com"></iframe>';
            // If iframes not allowed, should be gone
            expect(sanitize(input)).not.toContain('<iframe');
        });

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

        it('should strip img with fake PNG base64 (EXE content)', () => {
            const exeBytes = String.fromCodePoint(0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00);
            const dataUrl = `data:image/png;base64,${btoa(exeBytes)}`;
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
            const output = sanitize(input);
            if (output.includes('data:image/svg+xml')) {
                const srcMatch = new RegExp(/src="([^"]+)"/).exec(output);
                if (srcMatch) {
                    const base64Part = srcMatch[1].split(',')[1];
                    const decoded = atob(base64Part);
                    expect(decoded).not.toContain('<script');
                    expect(decoded).not.toContain('alert');
                }
            }
        });

        it('should strip foreignObject from SVG data URL', () => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>';
            const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
            const input = `<img src="${dataUrl}">`;
            const output = sanitize(input);
            if (output.includes('data:image/svg+xml')) {
                const srcMatch = new RegExp(/src="([^"]+)"/).exec(output);
                if (srcMatch) {
                    const base64Part = srcMatch[1].split(',')[1];
                    const decoded = atob(base64Part);
                    expect(decoded).not.toContain('foreignObject');
                    expect(decoded).not.toContain('<script');
                }
            }
        });
    });
});
