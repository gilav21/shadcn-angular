/*
 * Importers (DOCX, DOC, PPTX, PDF) build markup from values read out of a
 * document the user did not write. Each helper here makes one kind of such value
 * safe for the slot it lands in, so a caller either gets a value of the right
 * grammar or `undefined` and leaves the declaration, attribute or link out.
 *
 * "Escaped" is not enough for a CSS value: an escaped `red;background:url(…)` is
 * still two declarations. A value has to MATCH the grammar of its property.
 */

/** Hex, functional `rgb()/rgba()/hsl()/hsla()` with numeric arguments, or a bare keyword. */
const CSS_COLOR = /^(?:#[\da-f]{3,8}|(?:rgba?|hsla?)\([\d\s.,%/+-]*\)|[a-z]+)$/i;
const IMAGE_DATA_URL = /^data:image\/[\w.+-]+;base64,[\w+/=]*$/;
const SAFE_LINK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:']);

/**
 * A document colour when it is plain colour syntax, else `undefined`. The syntax
 * admits no `;`, quote or `url(`, so the value cannot add a declaration or fetch.
 */
export function cssColor(value: string | undefined): string | undefined {
    return value && CSS_COLOR.test(value) ? value : undefined;
}

/**
 * A document font name as one quoted CSS string, without a generic fallback (the
 * caller appends the fallback its context wants). Quotes and backslashes are
 * escaped and control characters dropped, because any of them could end the
 * string and let the name write further declarations.
 */
export function cssFontFamily(name: string): string {
    let quoted = '';
    for (const ch of name) {
        const code = ch.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f) continue;
        quoted += ch === '\\' || ch === "'" ? `\\${ch}` : ch;
    }
    return `'${quoted}'`;
}

/** The value when it is a base64 image data URL — the only image source the parsers produce — else `undefined`. */
export function imageDataUrl(value: string | undefined): string | undefined {
    return value && IMAGE_DATA_URL.test(value) ? value : undefined;
}

/**
 * A link target an importer may render: an in-document `#fragment`, or an absolute
 * http, https or mailto URL (returned as the browser will parse it, so the scheme
 * checked is the scheme followed). Anything else — `javascript:`, `data:`, relative
 * paths — yields `undefined` and the text renders unlinked.
 */
export function safeLinkHref(href: string): string | undefined {
    if (href.startsWith('#')) return href;
    try {
        const url = new URL(href);
        return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.href : undefined;
    } catch {
        // Not an absolute URL; relative targets are not rendered as links.
        return undefined;
    }
}

/** A value for a double-quoted HTML attribute: nothing in it can end the attribute or open a tag. */
export function escapeAttribute(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}
