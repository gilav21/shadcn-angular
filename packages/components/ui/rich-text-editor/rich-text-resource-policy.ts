/**
 * Host policy for remote resources referenced by editor content.
 *
 * This is a TRACKING control layered on top of the sanitizer's XSS guard, not a
 * replacement for it. A URL reaches these functions only after
 * `sanitizeImageSrc` / `isSafeStyleValue` has already rejected `javascript:`,
 * `vbscript:`, `data:text/html`, protocol-relative and backslash-authority
 * forms. What is added here is narrower: WHICH remote origin may be contacted.
 *
 * Why it matters: a remote image is a silent outbound request made by every
 * viewer's browser on render. Any host named in a pasted document therefore
 * learns who read it and when, with no affordance to click and nothing visible
 * to delete. A 1x1 transparent pixel is the standard shape.
 *
 * What it does NOT do: a trusted host can still identify the reader through the
 * URL itself (`https://cdn.example.com/logo.png?viewer=bob`). An allowlist
 * narrows exposure to a named party rather than removing it.
 */

/** A resource reference the policy has judged. */
export interface ResourcePolicyDecision {
    readonly url: string;
    readonly host: string;
    readonly kind: 'image' | 'background';
    readonly allowed: boolean;
    readonly reason: 'no-policy' | 'allowlisted' | 'blocked';
}

/**
 * Whether a URL's host is permitted by `allowedHosts`.
 *
 * An EMPTY list means "no policy" and allows everything -- that is the default,
 * and it preserves today's behaviour.
 *
 * The comparison is on the PARSED hostname, lowercased, matched exactly. It is
 * never a substring test on the raw URL, because five ordinary-looking forms
 * defeat one:
 *
 * | input                                | real host                 |
 * |--------------------------------------|---------------------------|
 * | `https://cdn.trusted.com@evil.com/a` | `evil.com` (userinfo)     |
 * | `https://cdn.trusted.com.evil.com/a` | `cdn.trusted.com.evil.com`|
 * | `https://evil.com/?x=cdn.trusted.com`| `evil.com` (query decoy)  |
 * | `https://evil.com#cdn.trusted.com`   | `evil.com` (fragment)     |
 * | `https://CDN.TRUSTED.COM/a`          | `cdn.trusted.com` (case)  |
 *
 * A wildcard entry (`*.trusted.com`) matches by LABEL. A bare `*.trusted.com`
 * deliberately does not match `trusted.com` itself -- list both if both are
 * wanted.
 *
 * Honest note on the label comparison: `endsWith('.trusted.com')` turns out to
 * be equivalent for every hostname, because the leading dot already enforces the
 * boundary that `endsWith('trusted.com')` would miss. I checked -- a sabotage
 * substituting endsWith did not fail any test, and no input separates them. The
 * labels are kept for being explicit about the rule rather than for extra
 * safety, and so a future edit to the entry syntax cannot silently reintroduce
 * a boundary-free suffix test.
 */
export function isHostAllowed(url: string, allowedHosts: readonly string[]): boolean {
    if (allowedHosts.length === 0) return true;

    const host = hostOf(url);
    if (host === null) return false;

    return allowedHosts.some((entry) => matchesHostEntry(host, normalizeHostEntry(entry)));
}

/**
 * An allowlist entry reduced to the hostname it names.
 *
 * Matching compares against `new URL(...).hostname`, which is lowercase,
 * port-less and punycode. An entry written the way people write hosts --
 * `https://cdn.acme.com/`, `cdn.acme.com:8443`, `CDN.Acme.com`, an IDN host --
 * therefore never matched, silently, and the developer saw every image from a
 * host they had just listed refused. Each entry is run through the same parser
 * so both sides speak the same form; a `*.` prefix is kept and applied to the
 * normalised remainder.
 */
export function normalizeHostEntry(entry: string): string {
    let host = entry.trim().toLowerCase();
    const wildcard = host.startsWith('*.');
    if (wildcard) host = host.slice(2);
    const parsed = hostOf(host.includes('://') ? host : `https://${host}`);
    if (parsed !== null && parsed !== '') host = parsed;
    return wildcard ? `*.${host}` : host;
}

/**
 * A URL's hostname, or null when it has none or cannot be parsed.
 *
 * Returns null -- not a host -- for a relative URL: callers treat those as
 * same-origin and skip the policy entirely, so they must not reach the
 * allowlist comparison at all.
 */
export function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
}

/**
 * Whether the policy applies to a URL at all.
 *
 * `data:` carries its payload inline and cannot contact anyone, and a relative
 * URL is same-origin by definition. Both bypass the host check -- `data:` in
 * particular is how a Word paste carries its images, so blocking it would break
 * that path for anyone who sets an allowlist.
 */
export function isHostBearingUrl(url: string): boolean {
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('data:')) return false;
    return hostOf(url) !== null;
}

function matchesHostEntry(host: string, entry: string): boolean {
    if (!entry) return false;
    if (!entry.startsWith('*.')) return host === entry;

    // Label-wise: "*.trusted.com" matches "cdn.trusted.com" but NOT
    // "cdn.trusted.com.evil.com", whose labels continue past the entry.
    const suffixLabels = entry.slice(2).split('.');
    const hostLabels = host.split('.');
    if (hostLabels.length <= suffixLabels.length) return false;

    const tail = hostLabels.slice(hostLabels.length - suffixLabels.length);
    return tail.every((label, i) => label === suffixLabels[i]);
}

/**
 * Every URL referenced by a CSS declaration value.
 *
 * Escapes and comments are resolved BEFORE matching, because the value is
 * attacker controlled and CSS is more permissive than it looks: bare, spaced,
 * single-quoted, double-quoted and comment-interrupted forms are all the same
 * function call, and any identifier character may be written as a hex escape
 * (`\75rl(` IS `url(`).
 *
 * This extractor is not new attack surface. BLOCKING a url() already requires
 * identifying one, and the escape bypass fixed in 73ca51cd existed precisely
 * because that identification was a substring test rather than parsing. Getting
 * it right strengthens the deny path whether or not any allowlist is set.
 */
export function extractCssUrls(value: string): string[] {
    const source = decodeCssEscapes(stripCssComments(value));
    const urls: string[] = [];
    const pattern = /url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)/gi;

    for (const match of source.matchAll(pattern)) {
        const raw = match[1] ?? match[2] ?? match[3] ?? '';
        if (raw) urls.push(raw.trim());
    }
    return urls;
}

/** Whether a CSS value calls url() at all, after escapes and comments resolve. */
export function containsCssUrl(value: string): boolean {
    return /url\s*\(/i.test(decodeCssEscapes(stripCssComments(value)));
}

/**
 * CSS functions a style value may call. Every one of these computes a colour,
 * a length or a gradient from its arguments alone; none can name a remote
 * resource.
 *
 * `url()` is deliberately absent: it IS the fetching function, and it is judged
 * by host in the sanitizer rather than allowed or refused wholesale.
 */
const SAFE_CSS_FUNCTIONS = new Set([
    'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch',
    'color', 'color-mix', 'light-dark',
    'var', 'env', 'calc', 'min', 'max', 'clamp', 'round', 'mod', 'rem', 'abs', 'sign',
    'linear-gradient', 'radial-gradient', 'conic-gradient',
    'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient',
]);

/**
 * Every function a CSS value calls, lowercased, after escapes and comments
 * resolve. Vendor prefixes are part of the name (`-webkit-image-set`). No
 * whitespace is tolerated before the paren: to a CSS tokenizer `image-set (`
 * is an identifier followed by a block, not a function call.
 */
export function cssFunctionCalls(value: string): string[] {
    const source = decodeCssEscapes(stripCssComments(value));
    const names: string[] = [];
    for (let i = 0; i < source.length; i++) {
        if (source[i] !== '(') continue;
        let start = i;
        while (start > 0 && isCssIdentChar(source[start - 1])) start--;
        const name = source.slice(start, i);
        if (/^-?[a-z_]/i.test(name)) names.push(name.toLowerCase());
    }
    return names;
}

/** A character that can continue a CSS identifier. */
function isCssIdentChar(ch: string): boolean {
    return /[\w-]/.test(ch);
}

/**
 * Whether a CSS value calls a function that is neither `url()` nor known to be
 * fetch-free.
 *
 * Judging `url()` alone was a substring test on the one spelling the author
 * happened to know. CSS has other functions that take an image: `image-set()`
 * accepts a bare STRING, so `background: image-set("https://t/p.png" 1x)`
 * contains no `url(` at all -- and a headless Chrome probe confirmed it
 * resolves to `url()` in computed style and issues the request. `image()`,
 * `cross-fade()`, `src()`, `element()` and `paint()` are the same family.
 *
 * The rule is therefore an ALLOWLIST of functions, not a denylist of the ones
 * found so far: a value may call only what is known not to fetch, and `url()`,
 * which is judged separately by host.
 */
export function hasUnsafeCssFunction(value: string): boolean {
    return cssFunctionCalls(value).some((name) => name !== 'url' && !SAFE_CSS_FUNCTIONS.has(name));
}

/** Remove CSS comments, which a tokenizer ignores between any two tokens. */
export function stripCssComments(value: string): string {
    let out = value;
    let start = out.indexOf('/*');
    while (start !== -1) {
        const end = out.indexOf('*/', start + 2);
        out = end === -1 ? out.slice(0, start) : out.slice(0, start) + out.slice(end + 2);
        start = out.indexOf('/*');
    }
    return out;
}

/**
 * Resolve CSS hex escapes to the characters they denote.
 *
 * `\75` is `u`, so `\75rl(` is `url(`. An escape runs up to six hex digits and
 * is terminated by an optional single whitespace, which is consumed.
 */
export function decodeCssEscapes(value: string): string {
    if (!value.includes('\\')) return value;

    return value.replaceAll(/\\([0-9a-fA-F]{1,6})[ \t\n]?|\\(.)/g, (_match, hex: string | undefined, literal: string | undefined) => {
        if (hex !== undefined) {
            const code = Number.parseInt(hex, 16);
            return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : '';
        }
        return literal ?? '';
    });
}

/**
 * Something that declares a remote-host policy for the editors and views
 * beneath it in the DOM.
 *
 * Provided by `RichTextResourcePolicyDirective`, which a consumer puts on a
 * wrapper element. It is deliberately NOT provided by the editor or the view:
 * neither projects content, so neither can ever have one of the others as a DOM
 * descendant, and a provider on them could never be reached. A wrapper element
 * is what makes an enclosing policy expressible at all.
 *
 * Inheritance is opt-in per component, so an empty host list keeps exactly one
 * meaning -- no policy -- rather than becoming ambiguous between "none" and
 * "whatever encloses me".
 */
export abstract class RichTextResourcePolicyHost {
    /** The hosts this component permits. Empty means it sets no policy. */
    abstract readonly allowedResourceHosts: () => readonly string[];
}

/**
 * Caption every image the resource policy refused, in `root`.
 *
 * The sanitizer can mark the element but not translate, and CSS cannot read a
 * locale -- so the text is written here, into `data-blocked-label` for the
 * stylesheet's `::after` to render, and into `aria-label` so a screen reader
 * announces that something was withheld instead of skipping a captionless
 * image. Shared by the editor and the read-only view so the two surfaces cannot
 * drift: the view used to have no labelling at all and rendered a blocked image
 * as a broken-image glyph, while its docs promised the caption.
 *
 * `label` is set with `setAttribute`, never parsed as HTML: a message rendered
 * into a document is not a place to accept markup.
 */
export function labelBlockedImages(root: ParentNode, label: string): void {
    const blocked = root.querySelectorAll<HTMLImageElement>('img[data-blocked-src]');
    for (const img of Array.from(blocked)) {
        img.dataset['blockedLabel'] = label;
        img.setAttribute('role', 'img');
        const alt = img.getAttribute('alt');
        img.setAttribute('aria-label', alt ? `${alt} — ${label}` : label);
    }
}
