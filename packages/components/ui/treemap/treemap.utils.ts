/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000)
 *
 * Pure, framework-free helpers so the layout can be unit-tested directly and
 * memoised by the component independently of hover/selection state. Squarified
 * rather than slice-and-dice because sliver rectangles make a treemap useless:
 * labels cannot render and small values become invisible lines.
 */

import { TreemapLayoutNode, TreemapNode, TreemapRect } from './treemap.types';

/**
 * The magnitude a node's area is proportional to: the sum of its children when
 * it is a group, otherwise its own `value`. Negative and non-finite values
 * count as 0, so bad data shrinks a node rather than inverting the layout.
 */
export function nodeValue(node: TreemapNode): number {
    if (node.children && node.children.length > 0) {
        return node.children.reduce((sum, child) => sum + nodeValue(child), 0);
    }
    const value = node.value ?? 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function emptyRect(rect: TreemapRect): TreemapRect {
    return { x: rect.x, y: rect.y, width: 0, height: 0 };
}

function worstRatio(areas: readonly number[], side: number, extra: number): number {
    let sum = extra;
    let max = extra;
    let min = extra;
    for (const area of areas) {
        sum += area;
        if (area > max) max = area;
        if (area < min) min = area;
    }
    if (sum <= 0 || side <= 0 || min <= 0) return Number.POSITIVE_INFINITY;
    const s2 = sum * sum;
    const w2 = side * side;
    return Math.max((w2 * max) / s2, s2 / (w2 * min));
}

function placeRow(
    areas: readonly number[],
    indices: readonly number[],
    free: TreemapRect,
    out: TreemapRect[],
): TreemapRect {
    const sum = areas.reduce((a, b) => a + b, 0);
    const alongWidth = free.width < free.height;
    const thickness = alongWidth ? sum / free.width : sum / free.height;

    let offset = alongWidth ? free.x : free.y;
    for (const [i, area] of areas.entries()) {
        const extent = area / thickness;
        out[indices[i]] = alongWidth
            ? { x: offset, y: free.y, width: extent, height: thickness }
            : { x: free.x, y: offset, width: thickness, height: extent };
        offset += extent;
    }

    return alongWidth
        ? { x: free.x, y: free.y + thickness, width: free.width, height: free.height - thickness }
        : { x: free.x + thickness, y: free.y, width: free.width - thickness, height: free.height };
}

/**
 * Places one rectangle per value inside `rect`, keeping aspect ratios as close
 * to square as the greedy squarify heuristic allows. The returned array is
 * parallel to `values` — the algorithm sorts internally but restores the
 * caller's order.
 *
 * Values that are zero, negative or non-finite get a zero-size rectangle at
 * `rect`'s own origin — they are excluded from the row search entirely rather
 * than distorting the layout, so a zero-value node is representable. A degenerate `rect` (zero width or height) or an
 * all-zero `values` gives every entry a zero-size rectangle.
 */
export function squarify(values: readonly number[], rect: TreemapRect): TreemapRect[] {
    const out: TreemapRect[] = values.map(() => emptyRect(rect));
    if (values.length === 0) return out;

    const usable = values.map(v => (Number.isFinite(v) && v > 0 ? v : 0));
    const total = usable.reduce((a, b) => a + b, 0);
    if (total <= 0 || rect.width <= 0 || rect.height <= 0) return out;

    const area = rect.width * rect.height;
    const scaled = usable.map(v => (v / total) * area);
    const order = usable
        .map((_, i) => i)
        .filter(i => scaled[i] > 0)
        .sort((a, b) => scaled[b] - scaled[a]);

    let free: TreemapRect = { ...rect };
    let cursor = 0;

    while (cursor < order.length && free.width > 0 && free.height > 0) {
        const side = Math.min(free.width, free.height);
        const rowAreas: number[] = [];
        const rowIndices: number[] = [];
        let best = Number.POSITIVE_INFINITY;

        while (cursor < order.length) {
            const candidate = worstRatio(rowAreas, side, scaled[order[cursor]]);
            if (rowAreas.length > 0 && candidate > best) break;
            best = candidate;
            rowAreas.push(scaled[order[cursor]]);
            rowIndices.push(order[cursor]);
            cursor++;
        }

        free = placeRow(rowAreas, rowIndices, free, out);
    }

    return out;
}

function insetRect(rect: TreemapRect, padding: number): TreemapRect {
    const inset = Math.min(padding, rect.width / 2, rect.height / 2);
    return {
        x: rect.x + inset,
        y: rect.y + inset,
        width: Math.max(0, rect.width - inset * 2),
        height: Math.max(0, rect.height - inset * 2),
    };
}

function layoutLevel(
    nodes: readonly TreemapNode[],
    rect: TreemapRect,
    padding: number,
    depth: number,
    prefix: string,
): TreemapLayoutNode[] {
    const values = nodes.map(nodeValue);
    const rects = squarify(values, rect);

    return nodes.map((node, i) => {
        const path = prefix === '' ? String(i) : `${prefix}/${i}`;
        const own = rects[i];
        const children =
            node.children && node.children.length > 0
                ? layoutLevel(node.children, insetRect(own, padding), padding, depth + 1, path)
                : [];
        return { path, node, value: values[i], depth, rect: own, children };
    });
}

/**
 * Lays a whole hierarchy out inside `rect`, recursing into every node that has
 * children and insetting each group by `padding` so the group border stays
 * visible around its contents.
 */
export function layoutTreemap(
    nodes: readonly TreemapNode[],
    rect: TreemapRect,
    padding = 2,
): TreemapLayoutNode[] {
    return layoutLevel(nodes, rect, Math.max(0, padding), 0, '');
}

/** Depth-first flattening of a layout, parents before their children — the order the SVG draws in. */
export function flattenLayout(nodes: readonly TreemapLayoutNode[]): TreemapLayoutNode[] {
    return nodes.flatMap(node => [node, ...flattenLayout(node.children)]);
}
