import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './svg-sanitizer';
import { assertInertMarkup, svgPolicy } from './inert-markup-fixtures';

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';

/** What the sanitizer is documented to keep, lowercased as the HTML parser reports names. */
const SVG_ELEMENTS: ReadonlySet<string> = new Set([
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'clippath',
    'mask', 'lineargradient', 'radialgradient', 'stop', 'title', 'desc', 'image',
]);
const SVG_ATTRIBUTES: ReadonlySet<string> = new Set([
    'viewbox', 'width', 'height', 'xmlns', 'fill', 'stroke', 'preserveaspectratio', 'transform', 'opacity', 'd',
    'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule',
    'clip-rule', 'x', 'y', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'dx', 'dy', 'font-size',
    'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'clippathunits', 'maskunits', 'gradientunits',
    'gradienttransform', 'fx', 'fy', 'offset', 'stop-color', 'stop-opacity', 'href',
]);
const SVG_POLICY = svgPolicy(SVG_ELEMENTS, SVG_ATTRIBUTES);

/** An attribute value as XML source that survives attribute-value normalisation (a literal tab would become a space). */
function xmlValue(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('\t', '&#9;')
        .replaceAll('\n', '&#10;')
        .replaceAll('\r', '&#13;');
}

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

describe('sanitizeSvg output parsed as HTML', () => {
    const rect = '<rect width="1" height="1"/>';
    const comment = '<!--><img src=x onerror=alert(1)>-->';
    const instruction = '<?x ><img src=x onerror=alert(2)>?>';
    const cdata = '<![CDATA[<img src=x onerror=alert(3)>]]>';

    const payloads: Record<string, string> = {
        'a comment': `<svg ${SVG_NS}>${comment}${rect}</svg>`,
        'a processing instruction': `<svg ${SVG_NS}>${instruction}${rect}</svg>`,
        'a CDATA section': `<svg ${SVG_NS}><text>${cdata}</text>${rect}</svg>`,
        'a comment two levels deep': `<svg ${SVG_NS}><g><g>${comment}${rect}</g></g></svg>`,
        'a processing instruction two levels deep': `<svg ${SVG_NS}><g><g>${instruction}${rect}</g></g></svg>`,
        'a CDATA section two levels deep': `<svg ${SVG_NS}><g><g><text>${cdata}</text></g></g></svg>`,
        'a comment inside text-bearing elements': `<svg ${SVG_NS}><title>a${comment}b</title><text>c${comment}d</text></svg>`,
    };

    it('is inert for comment, processing-instruction and CDATA payloads at any depth', () => {
        for (const [name, svg] of Object.entries(payloads)) {
            const output = sanitizeSvg(svg);
            expect(output, name).not.toBeNull();
            expect(assertInertMarkup(output!, SVG_POLICY), name).toEqual([]);
        }
    });

    it('keeps text around a removed comment and CDATA content as escaped text', () => {
        const parse = (svg: string): Document => new DOMParser().parseFromString(`<body>${sanitizeSvg(svg)}`, 'text/html');

        expect(parse(payloads['a comment inside text-bearing elements']).querySelector('title')?.textContent).toBe('ab');
        expect(parse(payloads['a CDATA section']).querySelector('text')?.textContent).toBe('<img src=x onerror=alert(3)>');
    });

    it('removes href values whose scheme is unsafe after the browser strips controls, whitespace and case', () => {
        const unsafe = [
            'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'VBSCRIPT:x', 'data:text/html,<script>1</script>',
            'DATA:image/svg+xml;base64,AAAA', '\tjavascript:alert(1)', ' javascript:alert(1)', 'java\nscript:alert(1)',
            'jav\tas\rcript:alert(1)', '\n\t vbscript:x',
        ];
        for (const href of unsafe) {
            const output = sanitizeSvg(`<svg ${SVG_NS}><image href="${xmlValue(href)}" width="1" height="1"/></svg>`);
            expect(assertInertMarkup(output!, SVG_POLICY), JSON.stringify(href)).toEqual([]);
        }
    });
});

describe('sanitizeSvg fidelity', () => {
    /** Every element with its attributes and trimmed text, in document order. */
    function inventory(svg: string): string[] {
        const lines: string[] = [];
        const walk = (element: Element, path: string): void => {
            const attributes = Array.from(element.attributes, (a) => `${a.name}=${a.value}`).sort((a, b) => a.localeCompare(b));
            lines.push(`${path}/${element.localName} [${attributes.join(' ')}]`);
            for (const node of Array.from(element.childNodes)) {
                if (node.nodeType === Node.ELEMENT_NODE) walk(node as Element, `${path}/${element.localName}`);
                else if (node.textContent?.trim()) lines.push(`${path}/${element.localName} text:${node.textContent.trim()}`);
            }
        };
        walk(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement, '');
        return lines;
    }

    it('keeps every allow-listed node and attribute of a real icon', () => {
        const icon = `<svg ${SVG_NS} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" preserveAspectRatio="xMidYMid meet">`
            + '<title>Chart</title><desc>A chart &amp; its legend</desc>'
            + '<defs><linearGradient id="g" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">'
            + '<stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f" stop-opacity="0.5"/></linearGradient>'
            + '<radialGradient id="r" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5"><stop offset="0" stop-color="#fff"/></radialGradient>'
            + '<clipPath id="c"><rect x="0" y="0" width="24" height="24" rx="2" ry="2"/></clipPath></defs>'
            + '<g transform="translate(1 1)" opacity="0.9" stroke="#333">'
            + '<path d="M3 3v18h18" stroke-linecap="round" stroke-linejoin="round" fill-rule="evenodd"/>'
            + '<circle cx="12" cy="12" r="4"/><ellipse cx="6" cy="6" rx="2" ry="1"/>'
            + '<line x1="0" y1="0" x2="5" y2="5"/><polyline points="1,1 2,2 3,1"/><polygon points="0,0 4,0 2,4"/></g>'
            + '<text x="2" y="20" dx="1" dy="1" font-size="4" font-family="sans-serif" font-weight="700" text-anchor="middle">Q1 <tspan fill="red">up</tspan> 5</text>'
            + '</svg>';

        const output = sanitizeSvg(icon);
        expect(inventory(output!)).toEqual(inventory(icon));
    });
});
