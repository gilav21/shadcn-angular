import type { PdfAnnotation, TextItem } from '../pdf-parser';
import type { BaselineShift, RunStyle, TextDirection, Word } from './readable-types';

/** Fraction of a space width a gap must reach to count as a word break. */
const SPACE_GAP_FACTOR = 0.45;
/** Gaps larger than this multiple of the font size never merge into one word. */
const HARD_BREAK_EM = 1.5;
/** Overlap tolerance: fonts with overestimated advances produce negative letter gaps. */
const NEGATIVE_GAP_EM = 0.45;
const DEFAULT_SPACE_EM = 0.25;
/**
 * When a line's median inter-glyph gap drops below this fraction of the font
 * size the PDF was emitted glyph-by-glyph with overshooting advances (every
 * intra-word gap runs negative). Word breaks are then the small near-zero
 * outliers a fixed valley search misses.
 */
const PER_GLYPH_MEDIAN_EM = 0.08;
/** Word-break offset above the negative letter baseline for per-glyph PDFs. */
const PER_GLYPH_WORD_EM = 0.15;
const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u;
const STRONG_LTR_RE = /[A-Za-z\u00C0-\u024F]/u;

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
    const bimodal = bimodalGapThreshold(items);
    let pendingSpace = false;

    for (const item of items) {
        if (isSpaceMarker(item)) {
            pendingSpace = true;
            continue;
        }
        pendingSpace = appendItem(words, item, ctx, pendingSpace, bimodal);
    }
    return words;
}

/**
 * When a line's inter-fragment gaps form two clearly separated clusters
 * (letter gaps vs word gaps), returns the valley between them as the
 * word-break threshold. Works on the full distribution including NEGATIVE
 * gaps — fonts with overestimated advances put letter gaps below zero while
 * word gaps stay slightly positive. Hard-break-sized gaps are excluded so a
 * single column jump does not dominate the valley search.
 */
export function bimodalGapThreshold(items: readonly TextItem[]): number | null {
    const gaps: number[] = [];
    for (let i = 1; i < items.length; i++) {
        const gap = items[i].x - items[i - 1].endX;
        if (gap <= Math.max(items[i].fontSize, 1) * HARD_BREAK_EM) gaps.push(gap);
    }
    if (gaps.length < 4) return null;
    gaps.sort((a, b) => a - b);
    const fontSize = medianFontSize(items);
    const median = gaps[gaps.length >> 1];
    if (median < -PER_GLYPH_MEDIAN_EM * fontSize) {
        return median + PER_GLYPH_WORD_EM * fontSize;
    }
    return valleyBetweenClusters(gaps, fontSize);
}

function medianFontSize(items: readonly TextItem[]): number {
    const sizes = items.map(item => Math.max(item.fontSize, 1)).sort((a, b) => a - b);
    return sizes[sizes.length >> 1];
}

function valleyBetweenClusters(sortedGaps: number[], fontSize: number): number | null {
    let bestJump = 0;
    let valley = 0;
    let lowCount = 0;
    for (let i = 1; i < sortedGaps.length; i++) {
        const jump = sortedGaps[i] - sortedGaps[i - 1];
        if (jump > bestJump) {
            bestJump = jump;
            valley = (sortedGaps[i - 1] + sortedGaps[i]) / 2;
            lowCount = i;
        }
    }
    const highCount = sortedGaps.length - lowCount;
    const minJump = Math.max(1.5, fontSize * 0.12);
    return bestJump >= minJump && lowCount >= 2 && highCount >= 1 ? valley : null;
}

function appendItem(
    words: Word[],
    item: TextItem,
    ctx: WordBuildContext,
    pendingSpace: boolean,
    bimodal: number | null,
): boolean {
    const style = itemRunStyle(item, findLinkUri(item, ctx.annotations));
    const previous = words.at(-1);
    const gap = previous ? item.x - previous.endX : 0;
    const decision = previous ? classifyGap(gap, previous, item, ctx, bimodal) : 'break';

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
): GapDecision {
    const fontSize = Math.max(previous.fontSize, item.fontSize);
    if (gap > fontSize * HARD_BREAK_EM) return 'break';
    if (gap < -fontSize * NEGATIVE_GAP_EM) return 'break';
    if (bimodal !== null) return gap >= bimodal ? 'space' : 'merge';
    const spaceWidth = estimateSpaceWidth(item, ctx) +
        Math.max(0, item.wordSpacing) + Math.max(0, item.charSpacing);
    return gap >= spaceWidth * SPACE_GAP_FACTOR ? 'space' : 'merge';
}

function estimateSpaceWidth(item: TextItem, ctx: WordBuildContext): number {
    const scale = item.horizontalScaling > 0 ? item.horizontalScaling / 100 : 1;
    const advance = ctx.spaceAdvance(item.fontName);
    const em = advance !== null && advance > 0 ? advance / 1000 : DEFAULT_SPACE_EM;
    return em * item.fontSize * scale;
}

/**
 * Fragments arrive in visual left-to-right order. For RTL script the
 * visually-left fragment is logically LATER, so an RTL fragment merging into
 * an RTL word is prepended — this reassembles per-character Hebrew/Arabic
 * PDFs into logical-order words. Digits and Latin embed left-to-right and
 * keep appending.
 */
function mergesRightToLeft(previousText: string, incomingText: string): boolean {
    return RTL_RE.test(incomingText) && RTL_RE.test(previousText);
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
    let runStart = -1;
    for (let i = 0; i <= words.length; i++) {
        const isLtr = i < words.length && isLtrWord(words[i]);
        if (isLtr && runStart < 0) runStart = i;
        if (!isLtr && runStart >= 0) {
            reverseRange(words, runStart, i - 1);
            runStart = -1;
        }
    }
}

function isLtrWord(word: Word): boolean {
    return STRONG_LTR_RE.test(word.text) && !RTL_RE.test(word.text);
}

function reverseRange(words: Word[], start: number, end: number): void {
    for (let i = start, j = end; i < j; i++, j--) {
        [words[i], words[j]] = [words[j], words[i]];
    }
}
