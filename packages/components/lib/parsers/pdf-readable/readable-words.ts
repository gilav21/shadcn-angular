import type { PdfAnnotation, TextItem } from '../pdf-parser';
import type { BaselineShift, RunStyle, TextDirection, Word } from './readable-types';

/** Fraction of a space width a gap must reach to count as a word break. */
const SPACE_GAP_FACTOR = 0.45;
/** Gaps larger than this multiple of the font size never merge into one word. */
const HARD_BREAK_EM = 1.5;
/** Overlap tolerance: fonts with overestimated advances produce negative letter gaps. */
const NEGATIVE_GAP_EM = 0.45;
const DEFAULT_SPACE_EM = 0.25;
/** Percentile of the sorted gaps taken as the letter-tier baseline. */
const LETTER_TIER_PERCENTILE = 0.2;
/** Word-break offset above the letter-tier gap, in em. */
const WORD_MARGIN_EM = 0.15;
/** Minimum gap, in em, between the letter tier and the breaking gaps above it. */
const MIN_VALLEY_EM = 0.08;
const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u;
const STRONG_LTR_RE = /[A-Za-z\u00C0-\u024F]/u;
/** A word with no letters and no digits \u2014 punctuation/symbols only (a
 *  standalone ":" separator, brackets), whose bidi direction is resolved from
 *  its neighbours rather than its own content. */
const NEUTRAL_WORD_RE = /^[^\p{L}\p{N}]+$/u;

export interface WordBuildContext {
    readonly annotations: readonly PdfAnnotation[];
    /** Space-glyph advance in thousandths of an em for a font, or null when unknown. */
    readonly spaceAdvance: (fontName: string) => number | null;
}

/**
 * Builds words from one baseline cluster's glyph fragments (visual x order),
 * merging adjacent fragments and inserting word breaks at space-sized gaps.
 */
export function buildWords(items: readonly TextItem[], ctx: WordBuildContext): Word[] {
    const words: Word[] = [];
    const thresholds = segmentThresholds(items);
    let pendingSpace = false;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (isSpaceMarker(item)) {
            pendingSpace = true;
            continue;
        }
        pendingSpace = appendItem(words, item, ctx, pendingSpace, thresholds[i], items[i + 1]);
    }
    return words;
}

/**
 * The gap threshold for each item, measured within its own hard-break-delimited
 * run rather than across the whole baseline. A line often carries two
 * unrelated runs — an invoice's letterspaced tagline and, a hundred points
 * away, the tight display type of its number panel. Pooled, the tight run's
 * ~0 gaps sink the letter tier until no valley clears the minimum, the
 * threshold comes back null, and the fallback splits the tagline at every
 * letter. Measured per run, each finds its own valley.
 */
function segmentThresholds(items: readonly TextItem[]): Array<number | null> {
    const thresholds = new Array<number | null>(items.length).fill(null);
    let start = 0;
    for (let i = 1; i <= items.length; i++) {
        if (i < items.length && !breaksRun(items[i - 1], items[i])) continue;
        const threshold = bimodalGapThreshold(items.slice(start, i));
        thresholds.fill(threshold, start, i);
        start = i;
    }
    return thresholds;
}

/** A gap too wide to be word spacing — the boundary between two runs. */
function breaksRun(previous: TextItem, item: TextItem): boolean {
    return gapEm(previous, item) > HARD_BREAK_EM;
}

/**
 * Word-break gap threshold for one baseline cluster, or null when the gaps are
 * too uniform to separate letters from words. Letters cluster at the line's
 * lowest gap tier; a word break sits a margin above it. The baseline is a low
 * percentile rather than the median so a line dominated by word gaps — a table
 * row of short labels, where word gaps outnumber letter gaps — still anchors on
 * the letter tier instead of drifting up into the word tier and merging every
 * word. Works whether that tier is ~0 (normal fonts) or negative (per-glyph
 * PDFs whose advances overshoot). Hard-break-sized gaps are excluded so a
 * column jump cannot move the baseline. Gaps straddling a script-direction
 * boundary (RTL against Latin/digits) are excluded too: such a gap is a break
 * boundary, not a word or letter gap, so an embedded number beside RTL text
 * cannot inflate the valley and merge the genuine word gaps around it. The
 * threshold is returned only when a real valley of at least `MIN_VALLEY_EM`
 * separates the letter tier from the breaking gaps above it.
 */
export function bimodalGapThreshold(items: readonly TextItem[]): number | null {
    const gaps: number[] = [];
    for (let i = 1; i < items.length; i++) {
        if (directionFlips(items[i - 1].text, items[i].text)) continue;
        const gap = gapEm(items[i - 1], items[i]);
        if (gap <= HARD_BREAK_EM) gaps.push(gap);
    }
    if (gaps.length < 4) return null;
    gaps.sort((a, b) => a - b);
    const baseline = gaps[Math.floor(gaps.length * LETTER_TIER_PERCENTILE)];
    const threshold = baseline + WORD_MARGIN_EM;
    return hasValleyAt(gaps, threshold) ? threshold : null;
}

/**
 * A gap between two fragments as a fraction of the type it separates. Measuring
 * in em rather than pt is what lets one threshold serve a line that mixes
 * sizes: a masthead's 19pt title and the 9.5pt kicker beside it both break
 * words at 0.28em, but at 5.3pt and 2.6pt respectively — an absolute threshold
 * drawn between them merges every word of the smaller run.
 */
function gapEm(previous: TextItem, item: TextItem): number {
    return (item.x - previous.endX) / Math.max(previous.fontSize, item.fontSize, 1);
}

/** True when some gaps fall below `threshold` and the rest sit a clear valley above it. */
function hasValleyAt(sortedGaps: readonly number[], threshold: number): boolean {
    let maxBelow = -Infinity;
    let minAbove = Infinity;
    for (const gap of sortedGaps) {
        if (gap < threshold) maxBelow = Math.max(maxBelow, gap);
        else minAbove = Math.min(minAbove, gap);
    }
    if (maxBelow === -Infinity || minAbove === Infinity) return false;
    return minAbove - maxBelow >= MIN_VALLEY_EM;
}

function appendItem(
    words: Word[],
    item: TextItem,
    ctx: WordBuildContext,
    pendingSpace: boolean,
    bimodal: number | null,
    nextItem?: TextItem,
): boolean {
    const style = itemRunStyle(item, findLinkUri(item, ctx.annotations));
    const previous = words.at(-1);
    const gap = previous ? item.x - previous.endX : 0;
    const decision = previous
        ? classifyGap(gap, previous, item, ctx, bimodal, nextItem)
        : 'break';

    if (previous && decision !== 'break' && sameStyle(previous.style, style)) {
        const separator = decision === 'space' || pendingSpace ? ' ' : '';
        if (mergesRightToLeft(previous.text, item.text)) {
            previous.text = item.text + separator + previous.text;
        } else {
            previous.text += separator + item.text;
        }
        previous.endX = Math.max(previous.endX, item.endX);
        return false;
    }
    words.push({
        text: item.text,
        x: item.x,
        endX: item.endX,
        y: item.y,
        fontSize: item.fontSize,
        style,
        mcid: item.mcid,
        spaceBefore: pendingSpace || decision !== 'merge',
        hardBreak: previous !== undefined &&
            gap > Math.max(previous.fontSize, item.fontSize) * HARD_BREAK_EM,
    });
    return false;
}

type GapDecision = 'merge' | 'space' | 'break';

function classifyGap(
    gap: number,
    previous: Word,
    item: TextItem,
    ctx: WordBuildContext,
    bimodal: number | null,
    nextItem?: TextItem,
): GapDecision {
    const fontSize = Math.max(previous.fontSize, item.fontSize);
    if (gap > fontSize * HARD_BREAK_EM) return 'break';
    if (gap < -fontSize * NEGATIVE_GAP_EM) return 'break';
    if (directionFlips(previous.text, item.text)) return 'break';
    if (neutralBelongsToRtl(previous, item, nextItem)) return 'break';
    // A measured valley in this line's own gaps outranks the font's nominal
    // space advance. Letterspacing is often applied through glyph positioning
    // rather than Tc/Tw, so `knownSpaceWidth` cannot see it: on a tracked-out
    // masthead the nominal width stays ~0.24em while every letter gap is wider,
    // and each glyph becomes its own word ("A Q U A R T E R L Y"). The valley
    // is only reported when the gaps genuinely separate into two tiers, so
    // where it exists it is the stronger evidence.
    if (bimodal !== null) return gap / fontSize >= bimodal ? 'space' : 'merge';
    const known = knownSpaceWidth(item, ctx);
    if (known !== null) {
        const spaceWidth = known + Math.max(0, item.wordSpacing) + Math.max(0, item.charSpacing);
        return gap >= spaceWidth * SPACE_GAP_FACTOR ? 'space' : 'merge';
    }
    const spaceWidth = estimateSpaceWidth(item, ctx) +
        Math.max(0, item.wordSpacing) + Math.max(0, item.charSpacing);
    return gap >= spaceWidth * SPACE_GAP_FACTOR ? 'space' : 'merge';
}

/**
 * A neutral fragment (a field colon) wedged between an LTR value and an RTL
 * label takes the RTL side per the UBA (a neutral between opposite-direction
 * runs resolves to the paragraph direction). Merging it into the LTR value
 * would strand the colon at the visual line end ("19011466 :"); breaking here
 * lets it start a word that the following RTL label absorbs ("מספר חשבונית :").
 */
function neutralBelongsToRtl(previous: Word, item: TextItem, nextItem?: TextItem): boolean {
    if (!NEUTRAL_WORD_RE.test(item.text.trim() || ' ')) return false;
    return isLtrRun(previous.text) && nextItem !== undefined && isRtlRun(nextItem.text);
}

/**
 * True when the two runs are of opposite strong direction — Hebrew/Arabic
 * against Latin or digits. Such a boundary must not merge into one word even
 * at a hairline gap: keeping them separate lets {@link toLogicalOrder} place an
 * embedded number after its RTL label ("מספר צרכן 25024809") instead of gluing
 * it in front ("25024809מספר צרכן").
 */
function directionFlips(previousText: string, incomingText: string): boolean {
    return (isRtlRun(previousText) && isLtrRun(incomingText)) ||
        (isLtrRun(previousText) && isRtlRun(incomingText));
}

function isRtlRun(text: string): boolean {
    return RTL_RE.test(text);
}

function isLtrRun(text: string): boolean {
    return !RTL_RE.test(text) && (STRONG_LTR_RE.test(text) || /\d/.test(text));
}

/** Space width in points, falling back to {@link DEFAULT_SPACE_EM} when the
 *  font declares no space advance. */
function estimateSpaceWidth(item: TextItem, ctx: WordBuildContext): number {
    const known = knownSpaceWidth(item, ctx);
    if (known !== null) return known;
    const scale = item.horizontalScaling > 0 ? item.horizontalScaling / 100 : 1;
    return DEFAULT_SPACE_EM * item.fontSize * scale;
}

/**
 * Width of the font's declared space glyph in points, or null when the font
 * declares no usable space advance. The declared (`/Widths`) advance is the
 * spec-exact word-break yardstick (ISO 32000 §9.4.4), so the caller prefers it
 * over the statistical {@link bimodalGapThreshold} fallback.
 */
function knownSpaceWidth(item: TextItem, ctx: WordBuildContext): number | null {
    const advance = ctx.spaceAdvance(item.fontName);
    if (advance === null || advance <= 0) return null;
    const scale = item.horizontalScaling > 0 ? item.horizontalScaling / 100 : 1;
    return (advance / 1000) * item.fontSize * scale;
}

/**
 * Fragments arrive in visual left-to-right order. For RTL script the
 * visually-left fragment is logically LATER, so an incoming RTL fragment is
 * prepended — this reassembles per-character Hebrew/Arabic PDFs into
 * logical-order words. Neutrals (punctuation) already collected into the word
 * count as RTL context so a leading "!" or "." does not strand itself inside
 * the word ("בהצלחה!" not "בהצלח!ה"). A strong-LTR predecessor (Latin) keeps
 * appending; digit/Latin boundaries never reach here — they break first.
 */
function mergesRightToLeft(previousText: string, incomingText: string): boolean {
    return RTL_RE.test(incomingText) && !STRONG_LTR_RE.test(previousText);
}

function isSpaceMarker(item: TextItem): boolean {
    return item.isSpaceOffset || item.text.trim().length === 0;
}

function itemRunStyle(item: TextItem, link: string): RunStyle {
    return {
        fontName: item.fontName,
        fontFamily: item.fontFamily,
        fontSize: item.fontSize,
        color: item.color,
        bold: item.bold,
        italic: item.italic,
        underline: false,
        baselineShift: baselineShiftOf(item),
        letterSpacing: item.charSpacing > 0.25 ? Math.round(item.charSpacing * 100) / 100 : 0,
        link,
    };
}

function baselineShiftOf(item: TextItem): BaselineShift {
    if (item.textRise > item.fontSize * 0.15) return 'sup';
    if (item.textRise < -item.fontSize * 0.15) return 'sub';
    return 'none';
}

export function sameStyle(a: RunStyle, b: RunStyle): boolean {
    return a.fontName === b.fontName &&
        Math.abs(a.fontSize - b.fontSize) < 0.25 &&
        a.color === b.color &&
        a.bold === b.bold &&
        a.italic === b.italic &&
        a.underline === b.underline &&
        a.baselineShift === b.baselineShift &&
        a.letterSpacing === b.letterSpacing &&
        a.link === b.link;
}

function findLinkUri(item: TextItem, annotations: readonly PdfAnnotation[]): string {
    if (annotations.length === 0) return '';
    const midX = (item.x + item.endX) / 2;
    for (const annotation of annotations) {
        if (annotation.page !== item.page) continue;
        const withinX = midX >= annotation.x && midX <= annotation.x + annotation.width;
        const withinY = item.y >= annotation.y - 2 && item.y <= annotation.y + annotation.height + 2;
        if (withinX && withinY) return annotation.uri;
    }
    return '';
}

export function strongRtlRatio(text: string): number {
    let rtl = 0;
    let strong = 0;
    for (const ch of text) {
        if (RTL_RE.test(ch)) {
            rtl++;
            strong++;
        } else if (STRONG_LTR_RE.test(ch)) {
            strong++;
        }
    }
    return strong === 0 ? 0 : rtl / strong;
}

export function detectDirection(words: readonly Word[]): TextDirection {
    const text = words.map(w => w.text).join(' ');
    return strongRtlRatio(text) > 0.3 ? 'rtl' : 'ltr';
}

/**
 * Converts visually-ordered (left→right) words to logical reading order.
 * For RTL lines the array is reversed, then each maximal run of LTR-only
 * words is restored to its original left→right order, and `spaceBefore`
 * flags are recomputed against each word's new logical predecessor.
 */
export function toLogicalOrder(words: Word[], dir: TextDirection): Word[] {
    if (dir === 'ltr' || words.length <= 1) return words;
    const visualSpaceBefore = new Map<Word, boolean>(words.map(w => [w, w.spaceBefore]));
    const reversed = [...words].reverse();
    restoreLtrRuns(reversed);
    recomputeLogicalSpaces(reversed, visualSpaceBefore);
    return reversed;
}

function recomputeLogicalSpaces(words: Word[], visualSpaceBefore: Map<Word, boolean>): void {
    for (let i = 1; i < words.length; i++) {
        const previous = words[i - 1];
        const current = words[i];
        const visuallyLater = previous.x <= current.x ? current : previous;
        current.spaceBefore = visualSpaceBefore.get(visuallyLater) ?? true;
    }
    words[0].spaceBefore = true;
}

function restoreLtrRuns(words: Word[]): void {
    const inLtrRun = ltrRunMembership(words);
    let runStart = -1;
    for (let i = 0; i <= words.length; i++) {
        const isLtr = i < words.length && inLtrRun[i];
        if (isLtr && runStart < 0) runStart = i;
        if (!isLtr && runStart >= 0) {
            reverseRange(words, runStart, i - 1);
            runStart = -1;
        }
    }
}

/**
 * Marks which words keep their visual left-to-right position when an RTL line
 * is reordered. A word with Latin letters or digits always qualifies. A
 * neutral-only word (punctuation/symbols — e.g. a standalone ":") qualifies
 * only when its nearest non-neutral neighbours on BOTH sides are LTR: per the
 * Unicode bidi neutral rules a neutral between two LTR runs takes LTR, but one
 * at the boundary with RTL (a field label's colon before a number) takes the
 * paragraph direction and must stay on the RTL side.
 */
function ltrRunMembership(words: readonly Word[]): boolean[] {
    const classes = words.map(wordBidiClass);
    return classes.map((cls, i) => {
        if (cls === 'ltr') return true;
        if (cls === 'rtl') return false;
        return nearestStrongIsLtr(classes, i, -1) && nearestStrongIsLtr(classes, i, 1);
    });
}

type BidiClass = 'ltr' | 'rtl' | 'neutral';

function wordBidiClass(word: Word): BidiClass {
    if (RTL_RE.test(word.text)) return 'rtl';
    return NEUTRAL_WORD_RE.test(word.text) ? 'neutral' : 'ltr';
}

/** Whether the nearest non-neutral word from `from` in `step` direction is LTR. */
function nearestStrongIsLtr(classes: readonly BidiClass[], from: number, step: number): boolean {
    for (let i = from + step; i >= 0 && i < classes.length; i += step) {
        if (classes[i] !== 'neutral') return classes[i] === 'ltr';
    }
    return false;
}

function reverseRange(words: Word[], start: number, end: number): void {
    for (let i = start, j = end; i < j; i++, j--) {
        [words[i], words[j]] = [words[j], words[i]];
    }
}
