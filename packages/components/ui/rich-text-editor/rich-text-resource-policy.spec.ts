import { describe, expect, it } from 'vitest';
import {
    containsCssUrl,
    cssFunctionCalls,
    normalizeHostEntry,
    decodeCssEscapes,
    extractCssUrls,
    hasUnsafeCssFunction,
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

describe('cssFunctionCalls / hasUnsafeCssFunction', () => {
    it('lists every function a value calls, lowercased, prefix included', () => {
        expect(cssFunctionCalls('color: RGB(1,2,3); background: -webkit-image-set(url(a) 1x)'))
            .toEqual(['rgb', '-webkit-image-set', 'url']);
    });

    it('sees through escapes and comments, exactly like the url() extractor', () => {
        const B = String.fromCodePoint(0x5c);
        expect(cssFunctionCalls(B + '69mage-set("https://t/p.png" 1x)')).toEqual(['image-set']);
        expect(cssFunctionCalls('image-set/**/("https://t/p.png" 1x)')).toEqual(['image-set']);
    });

    it('does not read an identifier followed by a spaced paren as a call', () => {
        // To a CSS tokenizer "image-set (" is an ident and a block, not a
        // function, so the browser will not fetch it and neither do we count it.
        expect(cssFunctionCalls('image-set ("https://t/p.png" 1x)')).toEqual([]);
    });

    it('accepts the fetch-free functions and url()', () => {
        for (const value of [
            'rgb(1, 2, 3)', 'hsla(1, 2%, 3%, 0.5)', 'oklch(0.7 0.1 200)', 'color-mix(in oklab, red, blue)',
            'var(--x)', 'calc(100% - 2rem)', 'clamp(1rem, 2vw, 3rem)', 'min(1px, 2px)',
            'linear-gradient(red, blue)', 'repeating-radial-gradient(red, blue)',
            'url(https://cdn.trusted.com/a.png)', 'red',
        ]) {
            expect(hasUnsafeCssFunction(value), value).toBe(false);
        }
    });

    it('refuses every image-taking function that is not url()', () => {
        for (const value of [
            'image-set("https://tracker.example/p.png" 1x)',
            '-webkit-image-set(url("https://tracker.example/p.png") 1x)',
            'image-set(url("https://tracker.example/p.png") 1x)',
            'image("https://tracker.example/p.png")',
            'cross-fade(url(a.png), url(b.png), 50%)',
            'src("https://tracker.example/p.png")',
            'element(#target)',
            'paint(worklet)',
            'attr(data-x)',
            'linear-gradient(red, blue), image-set("https://t/p.png" 1x)',
        ]) {
            expect(hasUnsafeCssFunction(value), value).toBe(true);
        }
    });
});

describe('normalizeHostEntry (fine-comb review)', () => {
    it('reduces the forms people actually write to the parsed hostname', () => {
        // Every one of these used to match nothing, because the comparison is
        // against a lowercase, port-less, punycode hostname.
        expect(normalizeHostEntry('https://cdn.acme.com/')).toBe('cdn.acme.com');
        expect(normalizeHostEntry('http://cdn.acme.com/images')).toBe('cdn.acme.com');
        expect(normalizeHostEntry('cdn.acme.com:8443')).toBe('cdn.acme.com');
        expect(normalizeHostEntry('  CDN.Acme.COM ')).toBe('cdn.acme.com');
        expect(normalizeHostEntry('bücher.example')).toBe('xn--bcher-kva.example');
    });

    it('keeps a wildcard prefix and normalises what follows it', () => {
        expect(normalizeHostEntry('*.Assets.Acme.com:443')).toBe('*.assets.acme.com');
        expect(normalizeHostEntry('*.bücher.example')).toBe('*.xn--bcher-kva.example');
    });

    it('so an entry in any of those forms allows the host', () => {
        const url = 'https://cdn.acme.com/logo.png';
        for (const entry of ['https://cdn.acme.com', 'cdn.acme.com:8443', 'CDN.ACME.COM', 'https://CDN.acme.com:8443/x']) {
            expect(isHostAllowed(url, [entry]), entry).toBe(true);
        }
        expect(isHostAllowed('https://xn--bcher-kva.example/a.png', ['bücher.example'])).toBe(true);
        expect(isHostAllowed('https://img.assets.acme.com/a.png', ['*.assets.acme.com:443'])).toBe(true);
    });

    it('does not widen: a normalised entry still matches exactly', () => {
        expect(isHostAllowed('https://cdn.acme.com.evil.com/a.png', ['https://cdn.acme.com'])).toBe(false);
        expect(isHostAllowed('https://evil.com/?x=cdn.acme.com', ['cdn.acme.com:8443'])).toBe(false);
        expect(isHostAllowed('https://cdn.acme.com/a.png', ['https://cdn.acme.com@evil.com'])).toBe(false);
    });
});
