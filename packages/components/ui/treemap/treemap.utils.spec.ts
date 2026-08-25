import { describe, it, expect } from 'vitest';
import { flattenLayout, layoutTreemap, nodeValue, squarify } from './treemap.utils';
import { TreemapNode, TreemapRect } from './treemap.types';

const RECT: TreemapRect = { x: 0, y: 0, width: 400, height: 300 };

const areaOf = (r: TreemapRect): number => r.width * r.height;

/**
 * Best (lowest) elapsed time across a few runs. Wall-clock timing on a loaded
 * machine is dominated by scheduling noise, and noise only ever ADDS time, so
 * the minimum is the closest estimate of the real cost — and the only form of
 * this assertion that does not flake.
 */
function bestOf(work: () => unknown, runs = 5): number {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        work();
        best = Math.min(best, performance.now() - start);
    }
    return best;
}
const aspect = (r: TreemapRect): number =>
    r.width === 0 || r.height === 0 ? 0 : Math.max(r.width / r.height, r.height / r.width);

describe('treemap utils', () => {
    describe('nodeValue', () => {
        it('uses a leaf’s own value', () => {
            expect(nodeValue({ label: 'a', value: 12 })).toBe(12);
        });

        it('sums a group’s children, ignoring the group’s own value', () => {
            expect(
                nodeValue({
                    label: 'g',
                    value: 999,
                    children: [{ label: 'a', value: 3 }, { label: 'b', value: 4 }],
                }),
            ).toBe(7);
        });

        it('sums recursively through several levels', () => {
            expect(
                nodeValue({
                    label: 'root',
                    children: [
                        { label: 'g', children: [{ label: 'a', value: 2 }, { label: 'b', value: 3 }] },
                        { label: 'c', value: 5 },
                    ],
                }),
            ).toBe(10);
        });

        it('treats a missing, negative or non-finite value as zero', () => {
            expect(nodeValue({ label: 'a' })).toBe(0);
            expect(nodeValue({ label: 'a', value: -5 })).toBe(0);
            expect(nodeValue({ label: 'a', value: Number.NaN })).toBe(0);
        });

        it('treats an empty children array as a leaf', () => {
            expect(nodeValue({ label: 'a', value: 4, children: [] })).toBe(4);
        });
    });

    describe('squarify', () => {
        // T-13: rect areas are proportional to values
        it('makes areas proportional to values', () => {
            const values = [6, 3, 2, 1];
            const rects = squarify(values, RECT);
            const total = values.reduce((a, b) => a + b, 0);
            const area = RECT.width * RECT.height;
            for (const [i, value] of values.entries()) {
                expect(areaOf(rects[i])).toBeCloseTo((value / total) * area, 4);
            }
        });

        it('returns rectangles parallel to the input, not sorted', () => {
            const rects = squarify([1, 9], RECT);
            expect(areaOf(rects[1])).toBeGreaterThan(areaOf(rects[0]));
        });

        it('fills the rectangle without overflowing it', () => {
            for (const r of squarify([6, 3, 2, 1, 1], RECT)) {
                expect(r.x).toBeGreaterThanOrEqual(RECT.x - 1e-6);
                expect(r.y).toBeGreaterThanOrEqual(RECT.y - 1e-6);
                expect(r.x + r.width).toBeLessThanOrEqual(RECT.x + RECT.width + 1e-6);
                expect(r.y + r.height).toBeLessThanOrEqual(RECT.y + RECT.height + 1e-6);
            }
        });

        it('covers the whole rectangle', () => {
            const rects = squarify([6, 3, 2, 1, 1], RECT);
            const covered = rects.reduce((sum, r) => sum + areaOf(r), 0);
            expect(covered).toBeCloseTo(RECT.width * RECT.height, 3);
        });

        // T-15: aspect ratios stay within squarified bounds
        it('keeps aspect ratios near square rather than producing slivers', () => {
            const values = [50, 30, 20, 12, 9, 7, 5, 4, 3, 2];
            const rects = squarify(values, RECT);
            for (const r of rects) expect(aspect(r)).toBeLessThan(5);
        });

        it('beats slice-and-dice on the worst aspect ratio', () => {
            const values = [50, 30, 20, 12, 9, 7, 5, 4, 3, 2];
            const squarified = Math.max(...squarify(values, RECT).map(aspect));
            const total = values.reduce((a, b) => a + b, 0);
            const sliceAndDice = Math.max(
                ...values.map(v => aspect({
                    x: 0, y: 0, width: (v / total) * RECT.width, height: RECT.height,
                })),
            );
            expect(squarified).toBeLessThan(sliceAndDice);
        });

        // §2.2 edge case — zero-value node
        it('gives a zero-value node a zero-size rectangle without distorting the rest', () => {
            const rects = squarify([5, 0, 5], RECT);
            expect(areaOf(rects[1])).toBe(0);
            expect(areaOf(rects[0])).toBeCloseTo(areaOf(rects[2]), 4);
            expect(areaOf(rects[0]) + areaOf(rects[2])).toBeCloseTo(
                RECT.width * RECT.height,
                3,
            );
        });

        it('treats negative and non-finite values as zero', () => {
            const rects = squarify([5, -3, Number.NaN, 5], RECT);
            expect(areaOf(rects[1])).toBe(0);
            expect(areaOf(rects[2])).toBe(0);
            expect(areaOf(rects[0]) + areaOf(rects[3])).toBeCloseTo(
                RECT.width * RECT.height,
                3,
            );
        });

        // §2.2 edge case — empty data
        it('returns no rectangles for no values', () => {
            expect(squarify([], RECT)).toEqual([]);
        });

        // §2.2 edge case — all values identical / single value
        it('gives a single value the whole rectangle', () => {
            const [r] = squarify([7], RECT);
            expect(r.width).toBeCloseTo(RECT.width, 6);
            expect(r.height).toBeCloseTo(RECT.height, 6);
        });

        it('splits identical values into equal areas', () => {
            const rects = squarify([4, 4, 4, 4], RECT);
            for (const r of rects) {
                expect(areaOf(r)).toBeCloseTo((RECT.width * RECT.height) / 4, 4);
            }
        });

        it('returns zero-size rectangles when every value is zero', () => {
            for (const r of squarify([0, 0, 0], RECT)) expect(areaOf(r)).toBe(0);
        });

        it('returns zero-size rectangles for a degenerate container', () => {
            for (const r of squarify([1, 2], { x: 0, y: 0, width: 0, height: 300 })) {
                expect(areaOf(r)).toBe(0);
            }
        });

        it('produces no NaN geometry for very large values', () => {
            for (const r of squarify([1e12, 2e12, 3e12], RECT)) {
                for (const n of [r.x, r.y, r.width, r.height]) {
                    expect(Number.isFinite(n)).toBe(true);
                }
            }
        });

        // Spec section 3.2: squarify of 1000 nodes under 8ms. Timed as the BEST of
        // several runs, not a single one — a single wall-clock sample on a loaded
        // machine measures the scheduler, not the algorithm, and would flake.
        it('squarifies 1000 nodes within the 8ms budget', () => {
            const values = Array.from({ length: 1000 }, (_, i) => 1000 - i);
            const rect = { x: 0, y: 0, width: 1200, height: 800 };
            expect(bestOf(() => squarify(values, rect))).toBeLessThan(8);
        });

        // Guards the complexity, which a wall-clock number alone cannot: squarify
        // is O(n log n), so doubling the input must not quadruple the work.
        it('scales sub-quadratically with the node count', () => {
            const rect = { x: 0, y: 0, width: 1200, height: 800 };
            const small = Array.from({ length: 1000 }, (_, i) => 1000 - i);
            const large = Array.from({ length: 2000 }, (_, i) => 2000 - i);

            const t1 = bestOf(() => squarify(small, rect));
            const t2 = bestOf(() => squarify(large, rect));

            expect(t2).toBeLessThan(Math.max(t1, 0.05) * 4);
        });
    });

    describe('layoutTreemap', () => {
        // T-14: nested children render nested rects
        it('nests children inside their parent’s rectangle', () => {
            const nodes: TreemapNode[] = [
                { label: 'g', children: [{ label: 'a', value: 3 }, { label: 'b', value: 1 }] },
                { label: 'c', value: 4 },
            ];
            const [group] = layoutTreemap(nodes, RECT, 2);
            expect(group.children).toHaveLength(2);
            for (const child of group.children) {
                expect(child.rect.x).toBeGreaterThanOrEqual(group.rect.x - 1e-6);
                expect(child.rect.y).toBeGreaterThanOrEqual(group.rect.y - 1e-6);
                expect(child.rect.x + child.rect.width)
                    .toBeLessThanOrEqual(group.rect.x + group.rect.width + 1e-6);
                expect(child.rect.y + child.rect.height)
                    .toBeLessThanOrEqual(group.rect.y + group.rect.height + 1e-6);
            }
        });

        it('sizes a group from the sum of its children', () => {
            const nodes: TreemapNode[] = [
                { label: 'g', children: [{ label: 'a', value: 3 }, { label: 'b', value: 1 }] },
                { label: 'c', value: 4 },
            ];
            const [group, leaf] = layoutTreemap(nodes, RECT, 0);
            expect(group.value).toBe(4);
            expect(areaOf(group.rect)).toBeCloseTo(areaOf(leaf.rect), 3);
        });

        it('insets each group so its border stays visible', () => {
            const nodes: TreemapNode[] = [
                { label: 'g', children: [{ label: 'a', value: 4 }] },
            ];
            const [group] = layoutTreemap(nodes, RECT, 6);
            const child = group.children[0];
            expect(child.rect.x).toBeGreaterThan(group.rect.x);
            expect(child.rect.width).toBeLessThan(group.rect.width);
        });

        it('assigns stable index paths and increasing depths', () => {
            const nodes: TreemapNode[] = [
                { label: 'g', children: [{ label: 'a', value: 1 }, { label: 'b', value: 1 }] },
            ];
            const [group] = layoutTreemap(nodes, RECT);
            expect(group.path).toBe('0');
            expect(group.depth).toBe(0);
            expect(group.children.map(c => c.path)).toEqual(['0/0', '0/1']);
            expect(group.children.every(c => c.depth === 1)).toBe(true);
        });

        it('gives a leaf no children', () => {
            expect(layoutTreemap([{ label: 'a', value: 1 }], RECT)[0].children).toEqual([]);
        });

        it('returns nothing for no nodes', () => {
            expect(layoutTreemap([], RECT)).toEqual([]);
        });
    });

    describe('flattenLayout', () => {
        it('lists parents before their children, depth first', () => {
            const nodes: TreemapNode[] = [
                { label: 'g', children: [{ label: 'a', value: 1 }, { label: 'b', value: 1 }] },
                { label: 'c', value: 2 },
            ];
            expect(flattenLayout(layoutTreemap(nodes, RECT)).map(n => n.path)).toEqual([
                '0', '0/0', '0/1', '1',
            ]);
        });

        it('returns nothing for an empty layout', () => {
            expect(flattenLayout([])).toEqual([]);
        });
    });
});
