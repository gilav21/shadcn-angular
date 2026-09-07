/**
 * Counting and cutting text the way a reader sees it.
 */

/**
 * Number of user-perceived characters in a string.
 *
 * `String.prototype.length` counts UTF-16 code units, so a single emoji scores
 * 2 and a ZWJ sequence like the family emoji scores 11 — visibly wrong in a
 * counter, and wrong as a budget for `maxLength`. `Intl.Segmenter` groups by
 * grapheme cluster, which is what a reader calls "a character". It is present
 * in every browser this library supports; the fallback keeps the old behaviour
 * rather than throwing if it is ever missing.
 */
export function graphemeLength(text: string): number {
    if (!text) return 0;
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
        return text.length;
    }
    let count = 0;
    for (const _ of new Intl.Segmenter().segment(text)) count++;
    return count;
}

/**
 * The first `count` user-perceived characters of a string.
 *
 * `substring` cuts by UTF-16 code unit, so a truncation that lands between an
 * astral character's two halves leaves a lone surrogate behind — which renders
 * as a replacement glyph and is rejected outright by some JSON and database
 * layers downstream. Cutting on grapheme boundaries cannot split a character.
 */
export function truncateToGraphemes(text: string, count: number): string {
    if (count <= 0) return '';
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
        return text.substring(0, count);
    }
    let out = '';
    let taken = 0;
    for (const { segment } of new Intl.Segmenter().segment(text)) {
        if (taken >= count) break;
        out += segment;
        taken++;
    }
    return out;
}
