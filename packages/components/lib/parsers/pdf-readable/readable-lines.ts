import type { TextItem, TextLine } from '../pdf-parser';
import type { Line, Word } from './readable-types';
import { buildWords, detectDirection, toLogicalOrder, type WordBuildContext } from './readable-words';

const MIN_Y_TOLERANCE = 2;
const Y_TOLERANCE_EM = 0.45;

/**
 * Clusters one page's text fragments into visual baseline lines
 * (top-to-bottom, fragments left-to-right). The returned shape is the
 * parser's TextLine so RTL fixes can be applied in place before word building.
 */
export function clusterIntoLineItems(items: readonly TextItem[]): TextLine[] {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) =>
        Math.abs(a.y - b.y) > lineTolerance(a, b) ? b.y - a.y : a.x - b.x);

    const clusters: TextLine[] = [];
    for (const item of sorted) {
        const line = clusters.at(-1);
        if (line && belongsToLine(item, line)) {
            line.items.push(item);
            line.minX = Math.min(line.minX, item.x);
        } else {
            clusters.push({ items: [item], y: item.y, minX: item.x });
        }
    }
    for (const cluster of clusters) cluster.items.sort((a, b) => a.x - b.x);
    return clusters;
}

function belongsToLine(item: TextItem, line: TextLine): boolean {
    const anchor = dominantItem(line.items);
    return Math.abs(item.y - line.y) <= lineTolerance(item, anchor);
}

function lineTolerance(a: TextItem, b: TextItem): number {
    return Math.max(MIN_Y_TOLERANCE, Math.max(a.fontSize, b.fontSize) * Y_TOLERANCE_EM);
}

function dominantItem(items: readonly TextItem[]): TextItem {
    let best = items[0];
    for (const item of items) {
        if (item.fontSize > best.fontSize) best = item;
    }
    return best;
}

/**
 * Converts baseline clusters into the readable Line model (logical word
 * order). Clusters containing column-sized visual gaps are split into one
 * Line per segment so the XY-cut can see inter-column valleys.
 */
export function linesFromClusters(
    clusters: readonly TextLine[],
    page: number,
    ctx: WordBuildContext,
): Line[] {
    const lines: Line[] = [];
    for (const cluster of clusters) {
        lines.push(...linesFromCluster(cluster, page, ctx));
    }
    return lines;
}

function linesFromCluster(cluster: TextLine, page: number, ctx: WordBuildContext): Line[] {
    const visualWords = buildWords(cluster.items, ctx);
    return splitAtHardBreaks(visualWords).map(segment =>
        lineFromSegment(segment, cluster.y, page));
}

function splitAtHardBreaks(words: readonly Word[]): Word[][] {
    const segments: Word[][] = [];
    for (const word of words) {
        const current = segments.at(-1);
        if (!current || word.hardBreak) {
            segments.push([word]);
        } else {
            current.push(word);
        }
    }
    return segments;
}

function lineFromSegment(segment: Word[], y: number, page: number): Line {
    const dir = detectDirection(segment);
    const words = toLogicalOrder(segment, dir);
    return {
        words,
        x: Math.min(...segment.map(w => w.x)),
        endX: Math.max(...segment.map(w => w.endX)),
        y,
        fontSize: dominantSegmentFontSize(segment),
        dir,
        page,
    };
}

function dominantSegmentFontSize(words: readonly Word[]): number {
    const weights = new Map<number, number>();
    for (const word of words) {
        const size = Math.round(word.fontSize * 2) / 2;
        weights.set(size, (weights.get(size) ?? 0) + word.text.length);
    }
    let bestSize = words[0].fontSize;
    let bestWeight = -1;
    for (const [size, weight] of weights) {
        if (weight > bestWeight) {
            bestWeight = weight;
            bestSize = size;
        }
    }
    return bestSize;
}
