/*
 * Task 1 scaffold: the signatures the specs compile against. Task 2 moves the
 * implementations in from the file viewer.
 */

const NOT_IMPLEMENTED = 'markup-safety: not implemented yet';

/** Hex, functional rgb()/rgba()/hsl()/hsla() with numeric arguments, or a bare keyword — else undefined. */
export function cssColor(_value: string | undefined): string | undefined {
    throw new Error(NOT_IMPLEMENTED);
}

/** A font name as one quoted CSS string ('…'), quote/backslash escaped, controls dropped. No generic fallback. */
export function cssFontFamily(_name: string): string {
    throw new Error(NOT_IMPLEMENTED);
}

/** An in-document #fragment, or an absolute http/https/mailto URL as the browser parses it — else undefined. */
export function safeLinkHref(_href: string): string | undefined {
    throw new Error(NOT_IMPLEMENTED);
}

/** A base64 image data URL — else undefined. */
export function imageDataUrl(_value: string | undefined): string | undefined {
    throw new Error(NOT_IMPLEMENTED);
}

/** HTML-escape a value for a double-quoted attribute (& " < >). */
export function escapeAttribute(_value: string): string {
    throw new Error(NOT_IMPLEMENTED);
}
