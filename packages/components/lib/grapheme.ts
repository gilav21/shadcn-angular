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
    const segmenter = graphemeSegmenter();
    if (!segmenter) return text.length;
    let count = 0;
    for (const _ of segmenter.segment(text)) count++;
    return count;
}

/**
 * One shared segmenter. Constructing `Intl.Segmenter` is the expensive part
 * (it loads locale data), and the editor counts the whole document on every
 * keystroke while `maxLength` is set.
 */
let sharedSegmenter: Intl.Segmenter | null | undefined;
function graphemeSegmenter(): Intl.Segmenter | null {
    if (sharedSegmenter === undefined) {
        sharedSegmenter = typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function'
            ? null
            : new Intl.Segmenter();
    }
    return sharedSegmenter;
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
    const segmenter = graphemeSegmenter();
    if (!segmenter) return text.substring(0, count);
    let out = '';
    let taken = 0;
    for (const { segment } of segmenter.segment(text)) {
        if (taken >= count) break;
        out += segment;
        taken++;
    }
    return out;
}
