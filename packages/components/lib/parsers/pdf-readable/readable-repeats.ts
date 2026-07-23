import type { Line } from './readable-types';

const MARGIN_FRACTION = 0.08;
const MAX_REPEAT_TEXT_LENGTH = 80;
const REPEAT_PAGE_RATIO = 0.6;
const MIN_PAGES_FOR_REPEATS = 3;
const Y_BUCKET = 4;

/**
 * Removes running headers, footers and page numbers: margin-zone lines whose
 * digit-masked text repeats at the same vertical position on most pages,
 * plus bare page-number lines. Returns a filtered copy per page.
 */
export function suppressRepeatedLines(
    pagesLines: readonly Line[][],
    pageHeights: readonly number[],
): Line[][] {
    const pageCount = pagesLines.length;
    const repeatedKeys = pageCount >= MIN_PAGES_FOR_REPEATS
        ? findRepeatedKeys(pagesLines, pageHeights)
        : new Set<string>();

    return pagesLines.map((lines, pageIdx) => lines.filter(line => {
        if (!inMarginZone(line, pageHeights[pageIdx] ?? 0)) return true;
        if (pageCount >= 2 && isBarePageNumber(line)) return false;
        return !repeatedKeys.has(repeatKey(line));
    }));
}

function findRepeatedKeys(
    pagesLines: readonly Line[][],
    pageHeights: readonly number[],
): Set<string> {
    const pagesByKey = new Map<string, Set<number>>();
    for (let pageIdx = 0; pageIdx < pagesLines.length; pageIdx++) {
        for (const line of pagesLines[pageIdx]) {
            if (!inMarginZone(line, pageHeights[pageIdx] ?? 0)) continue;
            const key = repeatKey(line);
            const pages = pagesByKey.get(key) ?? new Set<number>();
            pages.add(pageIdx);
            pagesByKey.set(key, pages);
        }
    }
    const threshold = Math.max(MIN_PAGES_FOR_REPEATS, Math.ceil(pagesLines.length * REPEAT_PAGE_RATIO));
    const repeated = new Set<string>();
    for (const [key, pages] of pagesByKey) {
        if (pages.size >= threshold) repeated.add(key);
    }
    return repeated;
}

function inMarginZone(line: Line, pageHeight: number): boolean {
    if (pageHeight <= 0) return false;
    if (maskedText(line).length > MAX_REPEAT_TEXT_LENGTH) return false;
    return line.y >= pageHeight * (1 - MARGIN_FRACTION) || line.y <= pageHeight * MARGIN_FRACTION;
}

function repeatKey(line: Line): string {
    return `${Math.round(line.y / Y_BUCKET)}|${maskedText(line)}`;
}

function maskedText(line: Line): string {
    return line.words.map(w => w.text).join(' ')
        .toLowerCase()
        .replaceAll(/\d+/g, '#')
        .replaceAll(/\s+/g, ' ')
        .trim();
}

function isBarePageNumber(line: Line): boolean {
    const text = line.words.map(w => w.text).join(' ').trim();
    return /^[-–—]?\s*\d{1,4}\s*[-–—]?$/.test(text) ||
        /^page\s+\d{1,4}(\s+of\s+\d{1,4})?$/i.test(text);
}
