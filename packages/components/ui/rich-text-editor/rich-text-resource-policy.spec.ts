import { describe, expect, it } from 'vitest';
import {
    containsCssUrl,
    decodeCssEscapes,
    extractCssUrls,
    hostOf,
    isHostAllowed,
    isHostBearingUrl,
} from './index';

const TRUSTED = ['cdn.trusted.com'];

describe('isHostAllowed - bypass shapes', () => {
    // These are written FIRST and are the reason the matcher parses rather than
    // string-matches. Each one defeats a naive includes()/startsWith() check
    // while pointing somewhere the developer never allowed.

    it('rejects a trusted host placed in the userinfo position', () => {
        // The classic: everything before "@" is credentials, not a host. The
        // request goes to evil.com.
        expect(isHostAllowed('https://cdn.trusted.com@evil.com/a.png', TRUSTED)).toBe(false);
        expect(isHostAllowed('https://cdn.trusted.com:pass@evil.com/a.png', TRUSTED)).toBe(false);
    });

    it('rejects a trusted host used as a subdomain prefix of another', () => {
        expect(isHostAllowed('https://cdn.trusted.com.evil.com/a.png', TRUSTED)).toBe(false);
    });

    it('rejects a trusted host that appears only in the query or fragment', () => {
        expect(isHostAllowed('https://evil.com/?x=cdn.trusted.com', TRUSTED)).toBe(false);
        expect(isHostAllowed('https://evil.com#cdn.trusted.com', TRUSTED)).toBe(false);
        expect(isHostAllowed('https://evil.com/cdn.trusted.com/a.png', TRUSTED)).toBe(false);
    });

    it('accepts the trusted host regardless of case', () => {
        expect(isHostAllowed('https://CDN.TRUSTED.COM/a.png', TRUSTED)).toBe(true);
        expect(isHostAllowed('https://Cdn.Trusted.Com/a.png', TRUSTED)).toBe(true);
    });

    it('rejects a URL it cannot parse', () => {
        for (const url of ['', 'not a url', 'https://', '///a']) {
            expect(isHostAllowed(url, TRUSTED)).toBe(false);
        }
    });
});

describe('isHostAllowed - ordinary behaviour', () => {
    it('allows everything when no policy is configured', () => {
        // The default. An empty list means "no policy", never "deny all" -- and
        // there is deliberately no built-in provider list to fall back on.
        for (const url of ['https://anything.example/a.png', 'https://tracker.example/p?u=1']) {
            expect(isHostAllowed(url, [])).toBe(true);
        }
    });

    it('allows an exact host match', () => {
        expect(isHostAllowed('https://cdn.trusted.com/a.png', TRUSTED)).toBe(true);
        expect(isHostAllowed('https://cdn.trusted.com:8443/a.png', TRUSTED)).toBe(true);
    });

    it('rejects a host that is simply not listed', () => {
        expect(isHostAllowed('https://tracker.example/p.png', TRUSTED)).toBe(false);
    });

    it('matches a wildcard entry by label, not by suffix', () => {
        const hosts = ['*.assets.example'];
        expect(isHostAllowed('https://img.assets.example/a.png', hosts)).toBe(true);
        expect(isHostAllowed('https://a.b.assets.example/a.png', hosts)).toBe(true);

        // The suffix attack the label comparison exists to stop.
        expect(isHostAllowed('https://img.assets.example.evil.com/a.png', hosts)).toBe(false);
        // A bare wildcard does not match the apex; list it separately if wanted.
        expect(isHostAllowed('https://assets.example/a.png', hosts)).toBe(false);
        // And it must not match a host that merely ends with the same letters.
        expect(isHostAllowed('https://notassets.example/a.png', hosts)).toBe(false);
    });

    it('ignores whitespace and case in the allowlist entries themselves', () => {
        expect(isHostAllowed('https://cdn.trusted.com/a.png', ['  CDN.Trusted.com '])).toBe(true);
        expect(isHostAllowed('https://cdn.trusted.com/a.png', [''])).toBe(false);
    });
});

describe('isHostBearingUrl', () => {
    it('exempts data: URLs, which cannot contact anyone', () => {
        // This is how a Word paste carries its images; blocking them would break
        // that path for anyone who sets an allowlist.
        expect(isHostBearingUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(false);
        expect(isHostBearingUrl('DATA:image/png,%89PNG')).toBe(false);
    });

    it('exempts relative URLs, which are same-origin by definition', () => {
        for (const url of ['/a.png', './a.png', '../a.png', 'a.png']) {
            expect(isHostBearingUrl(url)).toBe(false);
        }
    });

    it('applies to absolute remote URLs', () => {
        expect(isHostBearingUrl('https://cdn.trusted.com/a.png')).toBe(true);
    });
});

describe('hostOf', () => {
    it('returns the lowercased hostname without userinfo or port', () => {
        expect(hostOf('https://User@CDN.Trusted.com:8443/a')).toBe('cdn.trusted.com');
    });

    it('returns null for an unparseable or relative URL', () => {
        expect(hostOf('/a.png')).toBeNull();
        expect(hostOf('nonsense')).toBeNull();
    });
});

describe('decodeCssEscapes', () => {
    it('resolves hex escapes to their characters', () => {
        // \75 is "u" -- this is the whole bypass in one line.
        expect(decodeCssEscapes(String.raw`\75rl(x)`)).toBe('url(x)');
        expect(decodeCssEscapes(String.raw`\000075rl(x)`)).toBe('url(x)');
        expect(decodeCssEscapes(String.raw`u\72 l(x)`)).toBe('url(x)');
        expect(decodeCssEscapes(String.raw`ur\6c(x)`)).toBe('url(x)');
    });

    it('leaves a value with no escapes untouched', () => {
        expect(decodeCssEscapes('color: red')).toBe('color: red');
    });
});

describe('extractCssUrls / containsCssUrl', () => {
    it('finds a url() however it is written', () => {
        const cases = [
            'url(https://cdn.trusted.com/a.png)',
            'url( https://cdn.trusted.com/a.png )',
            'url("https://cdn.trusted.com/a.png")',
            "url('https://cdn.trusted.com/a.png')",
            'URL(https://cdn.trusted.com/a.png)',
            'url/**/(https://cdn.trusted.com/a.png)',
            String.raw`\75rl(https://cdn.trusted.com/a.png)`,
        ];
        for (const value of cases) {
            expect(containsCssUrl(value)).toBe(true);
            expect(extractCssUrls(value)).toEqual(['https://cdn.trusted.com/a.png']);
        }
    });

    it('finds every url() in a multi-value declaration', () => {
        const value = 'url(https://a.example/1.png), url(https://b.example/2.png)';
        expect(extractCssUrls(value)).toEqual([
            'https://a.example/1.png',
            'https://b.example/2.png',
        ]);
    });

    it('reports nothing for a value with no url()', () => {
        for (const value of ['red', 'linear-gradient(red, blue)', '1pt solid #4472C4']) {
            expect(containsCssUrl(value)).toBe(false);
            expect(extractCssUrls(value)).toEqual([]);
        }
    });
});
