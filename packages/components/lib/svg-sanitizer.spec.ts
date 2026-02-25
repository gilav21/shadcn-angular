import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './svg-sanitizer';

describe('sanitizeSvg', () => {
    it('should preserve safe SVG with basic shapes', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="red"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).toContain('<rect');
        expect(result).toContain('fill="red"');
        expect(result).toContain('viewBox="0 0 100 100"');
    });

    it('should preserve circles', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="blue"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).toContain('<circle');
        expect(result).toContain('cx="50"');
    });

    it('should preserve paths', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M10 10 L90 90" stroke="black" stroke-width="2"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).toContain('<path');
        expect(result).toContain('d="M10 10 L90 90"');
    });

    it('should strip script tags', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script><rect width="10" height="10"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('<script');
        expect(result).not.toContain('alert');
        expect(result).toContain('<rect');
    });

    it('should strip foreignObject', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><div>XSS</div></body></foreignObject><rect width="10" height="10"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('foreignObject');
        expect(result).not.toContain('<body');
        expect(result).toContain('<rect');
    });

    it('should strip use elements', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><use href="http://evil.com/payload.svg#exploit"/><rect width="10" height="10"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('<use');
        expect(result).not.toContain('evil.com');
        expect(result).toContain('<rect');
    });

    it('should strip on* event handlers', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" onclick="alert(1)" onmouseover="hack()"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('onmouseover');
        expect(result).not.toContain('alert');
        expect(result).toContain('<rect');
    });

    it('should strip onload from svg element', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('onload');
        expect(result).not.toContain('alert');
    });

    it('should strip javascript: from href attributes', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><image href="javascript:alert(1)" width="10" height="10"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('javascript:');
    });

    it('should strip animate elements', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"><animate attributeName="width" to="100"/></rect></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('<animate');
    });

    it('should strip animateTransform elements', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"><animateTransform attributeName="transform" type="rotate"/></rect></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('animateTransform');
    });

    it('should strip set elements', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"><set attributeName="fill" to="red"/></rect></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('<set');
    });

    it('should preserve text and tspan elements', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20" font-size="14"><tspan fill="blue">Hello</tspan></text></svg>';
        const result = sanitizeSvg(svg);
        expect(result).toContain('<text');
        expect(result).toContain('<tspan');
        expect(result).toContain('Hello');
    });

    it('should preserve gradient definitions', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs></svg>';
        const result = sanitizeSvg(svg);
        expect(result).toContain('linearGradient');
        expect(result).toContain('<stop');
        expect(result).toContain('stop-color="red"');
    });

    it('should preserve clipPath and mask', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="clip1"><rect width="50" height="50"/></clipPath></defs></svg>';
        const result = sanitizeSvg(svg);
        expect(result).toContain('clipPath');
        expect(result).toContain('id="clip1"');
    });

    it('should preserve g elements with transform', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(10,10)"><rect width="10" height="10"/></g></svg>';
        const result = sanitizeSvg(svg);
        expect(result).toContain('<g');
        expect(result).toContain('transform="translate(10,10)"');
    });

    it('should strip iframe elements', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><iframe src="http://evil.com"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('<iframe');
        expect(result).not.toContain('evil.com');
    });

    it('should strip embed elements', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><embed src="http://evil.com/payload.swf"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('<embed');
    });

    it('should strip dangerous style values', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="background: url(javascript:alert(1))"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('javascript:');
    });

    it('should strip expression() in style', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="width: expression(alert(1))"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('expression');
    });

    it('should strip -moz-binding in style', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" style="-moz-binding: url(evil)"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('-moz-binding');
    });

    it('should return null for invalid XML', () => {
        expect(sanitizeSvg('not valid xml at all')).toBeNull();
    });

    it('should return null for non-SVG XML', () => {
        expect(sanitizeSvg('<?xml version="1.0"?><html><body>test</body></html>')).toBeNull();
    });

    it('should return null for empty string', () => {
        expect(sanitizeSvg('')).toBeNull();
    });

    it('should handle SVG with XML declaration', () => {
        const svg = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).toContain('<rect');
    });

    it('should strip unknown elements not in allowlist', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><custom-element data-foo="bar">text</custom-element><rect width="10" height="10"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('custom-element');
        expect(result).toContain('<rect');
    });

    it('should strip disallowed attributes', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" data-custom="value" tabindex="0"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).not.toContain('data-custom');
        expect(result).not.toContain('tabindex');
    });

    it('should preserve title and desc elements', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><title>My SVG</title><desc>A description</desc><rect width="10" height="10"/></svg>';
        const result = sanitizeSvg(svg);
        expect(result).toContain('<title');
        expect(result).toContain('My SVG');
        expect(result).toContain('<desc');
        expect(result).toContain('A description');
    });
});
