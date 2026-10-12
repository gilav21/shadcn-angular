import { describe, expect, it } from 'vitest';
import { cssColor, cssFontFamily, escapeAttribute, imageDataUrl, safeLinkHref } from './markup-safety';
import { BREAKOUT, DECLARATION, TAG_BREAKOUT, UNSAFE_URLS } from './inert-markup-fixtures';

describe('cssColor', () => {
    it('accepts colour syntax and rejects anything that can end or add a declaration', () => {
        const accepted = ['#abc', '#abcd', '#aabbcc', '#aabbccdd', 'rgb(1, 2, 3)', 'rgba(1 2 3 / 50%)', 'hsl(120 50% 50%)', 'red'];
        for (const colour of accepted) expect(cssColor(colour)).toBe(colour);

        const rejected = [BREAKOUT, DECLARATION, 'red;x:y', 'url(x)', 'expression(1)', "'red'", '#fff;x:y', 'rgb(1,2,3);x:y', '', undefined];
        for (const value of rejected) expect(cssColor(value)).toBeUndefined();
    });
});

describe('cssFontFamily', () => {
    it('quotes the name, escapes quote and backslash, drops control characters', () => {
        expect(cssFontFamily('Times New Roman')).toBe("'Times New Roman'");
        expect(cssFontFamily(TAG_BREAKOUT)).toBe(String.raw`'X\'"><img src=x onerror=alert(1)>'`);
        expect(cssFontFamily(String.raw`A\B`)).toBe(String.raw`'A\\B'`);
        expect(cssFontFamily('a\u0000b\u007fc\nd')).toBe("'abcd'");
    });
});

describe('safeLinkHref', () => {
    it('keeps #fragments and absolute http/https/mailto, rejects every other scheme after browser normalisation', () => {
        expect(safeLinkHref('#bookmark-sec1')).toBe('#bookmark-sec1');
        expect(safeLinkHref('https://example.com/a')).toBe('https://example.com/a');
        expect(safeLinkHref('http://example.com/')).toBe('http://example.com/');
        expect(safeLinkHref('mailto:a@example.com')).toBe('mailto:a@example.com');
        expect(safeLinkHref('HTTPS://EXAMPLE.com/a b')).toBe('https://example.com/a%20b');

        for (const unsafe of [...UNSAFE_URLS, 'a/b', '//host/x', '\tjavascript:alert(1)', '']) {
            expect(safeLinkHref(unsafe)).toBeUndefined();
        }
    });
});

describe('imageDataUrl', () => {
    it('accepts a base64 image data URL and nothing else', () => {
        const png = 'data:image/png;base64,iVBORw0KGgo=';
        expect(imageDataUrl(png)).toBe(png);
        for (const value of ['data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml,<svg/>', 'javascript:alert(1)', `${png}" onerror="x`, '', undefined]) {
            expect(imageDataUrl(value)).toBeUndefined();
        }
    });
});

describe('escapeAttribute', () => {
    it('escapes everything that can end a double-quoted attribute or open a tag', () => {
        expect(escapeAttribute(`${BREAKOUT}<b>&`)).toBe('x&quot; onmouseover=&quot;alert(1)&lt;b&gt;&amp;');
    });
});
