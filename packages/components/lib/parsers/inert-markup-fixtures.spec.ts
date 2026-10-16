import { describe, expect, it } from 'vitest';
import { BREAKOUT, DECLARATION, DOCX_POLICY, PDF_POLICY, assertInertMarkup, svgPolicy } from './inert-markup-fixtures';

/**
 * The helper decides whether every importer spec passes, so it has to be shown
 * to fail: a helper that returned an empty list for anything would turn those
 * specs into assertions that cannot fail.
 */
describe('assertInertMarkup', () => {
    it('accepts the markup an importer is allowed to emit', () => {
        const html = '<p style="text-align:justify;margin-top:4pt"><span style="color:#ff0000;font-family:\'Times New Roman\'">hi</span> '
            + '<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">link</a> <a href="#bookmark-1">here</a></p>'
            + '<table><tr><td style="border-top:1pt solid #000000;vertical-align:middle">c</td></tr></table>';

        expect(assertInertMarkup(html, DOCX_POLICY)).toEqual([]);
        expect(assertInertMarkup(html, PDF_POLICY)).toEqual([]);
    });

    it('reports an event handler, an unsafe link, a foreign element, a comment and an unknown attribute', () => {
        const cases: Array<[string, RegExp]> = [
            ['<p onclick="alert(1)">x</p>', /event handler attribute onclick/],
            ['<a href="javascript:alert(1)">x</a>', /unsafe href/],
            ['<img src="https://tracker.invalid/p.png">', /unsafe src/],
            ['<script>alert(1)</script>', /element not allowed: <script>/],
            ['<p>x<!--><img src=x onerror=alert(1)>--></p>', /comment node/],
            ['<p data-x="1">x</p>', /attribute not allowed: data-x/],
        ];
        for (const [html, expected] of cases) {
            expect(assertInertMarkup(html, DOCX_POLICY).join('\n'), html).toMatch(expected);
        }
    });

    it('reports a style that adds a declaration, an unknown property, or a value outside its property grammar', () => {
        const cases: Array<[string, RegExp]> = [
            [`<p style="color:${DECLARATION}">x</p>`, /property not allowed: background-image/],
            ['<p style="color:url(//t.invalid/x)">x</p>', /grammar/],
            ['<p style="color:red;background-image:url(//t.invalid/x)">x</p>', /property not allowed/],
            ['<p style="text-align:both">x</p>', /grammar/],
            ['<p style="border-top:1pt solid red;position:fixed">x</p>', /property not allowed: position:fixed/],
            [`<p style="font-family:${BREAKOUT}">x</p>`, /grammar/],
        ];
        for (const [html, expected] of cases) {
            expect(assertInertMarkup(html, DOCX_POLICY).join('\n'), html).toMatch(expected);
        }
    });

    it('does not split a declaration on a semicolon inside quotes or parentheses', () => {
        expect(assertInertMarkup('<p style="font-family:\'A;B\';color:rgb(1, 2, 3)">x</p>', DOCX_POLICY)).toEqual([]);
    });

    it('applies an SVG policy: no style attribute at all, and no href', () => {
        const policy = svgPolicy(new Set(['svg', 'image']), new Set(['href', 'width']));

        expect(assertInertMarkup('<svg><image width="1"></image></svg>', policy)).toEqual([]);
        expect(assertInertMarkup('<svg style="fill:red"></svg>', policy).join('\n')).toMatch(/style attribute not allowed/);
        expect(assertInertMarkup('<svg><image href="https://example.com/a.png"></image></svg>', policy).join('\n')).toMatch(/unsafe href/);
    });
});
