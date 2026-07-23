import type { TextItem, TextLine } from '../pdf-parser';
import type { Line } from './readable-types';
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

/** Converts baseline clusters into the readable Line model (logical word order). */
export function linesFromClusters(
    clusters: readonly TextLine[],
    page: number,
    ctx: WordBuildContext,
): Line[] {
    const lines: Line[] = [];
    for (const cluster of clusters) {
        const line = lineFromCluster(cluster, page, ctx);
        if (line) lines.push(line);
    }
    return lines;
}

function lineFromCluster(cluster: TextLine, page: number, ctx: WordBuildContext): Line | null {
    const visualWords = buildWords(cluster.items, ctx);
    if (visualWords.length === 0) return null;
    const dir = detectDirection(visualWords);
    const words = toLogicalOrder(visualWords, dir);
    return {
        words,
        x: Math.min(...visualWords.map(w => w.x)),
        endX: Math.max(...visualWords.map(w => w.endX)),
        y: cluster.y,
        fontSize: dominantFontSize(cluster.items),
        dir,
        page,
    };
}

function dominantFontSize(items: readonly TextItem[]): number {
    const weights = new Map<number, number>();
    for (const item of items) {
        const size = Math.round(item.fontSize * 2) / 2;
        weights.set(size, (weights.get(size) ?? 0) + item.text.length);
    }
    let bestSize = items[0].fontSize;
    let bestWeight = -1;
    for (const [size, weight] of weights) {
        if (weight > bestWeight) {
            bestWeight = weight;
            bestSize = size;
        }
    }
    return bestSize;
}
