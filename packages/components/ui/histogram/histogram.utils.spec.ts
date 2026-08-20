import { describe, it, expect } from 'vitest';
import { computeBinEdges, computeBins, sturgesBinCount } from './histogram.utils';

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

const totalCount = (bins: { count: number }[]): number =>
    bins.reduce((sum, b) => sum + b.count, 0);

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

describe('histogram utils', () => {
    describe('sturgesBinCount', () => {
        it('derives a bin count from the sample size', () => {
            expect(sturgesBinCount(100)).toBe(8);
            expect(sturgesBinCount(8)).toBe(4);
        });

        it('never returns less than one bin', () => {
            expect(sturgesBinCount(1)).toBe(1);
            expect(sturgesBinCount(0)).toBe(1);
            expect(sturgesBinCount(-5)).toBe(1);
        });
    });

    describe('computeBinEdges', () => {
        // T-4: axis bounds are nice numbers
        it('rounds the domain outward to nice numbers rather than raw min/max', () => {
            const edges = computeBinEdges([3, 97]);
            expect(edges[0]).toBe(0);
            expect(edges.at(-1)).toBe(100);
        });

        it('returns binCount + 1 ascending edges', () => {
            const edges = computeBinEdges(range(100), 4);
            expect(edges).toHaveLength(5);
            for (let i = 1; i < edges.length; i++) {
                expect(edges[i]).toBeGreaterThan(edges[i - 1]);
            }
        });

        it('returns no edges for an empty sample', () => {
            expect(computeBinEdges([])).toEqual([]);
        });

        it('produces a non-degenerate domain for zero-variance data', () => {
            const edges = computeBinEdges([7, 7, 7, 7]);
            expect(edges.length).toBeGreaterThanOrEqual(2);
            expect(edges.at(-1)!).toBeGreaterThan(edges[0]);
            for (const edge of edges) expect(Number.isFinite(edge)).toBe(true);
        });
    });

    describe('computeBins', () => {
        // T-1: auto-bins raw values into sensible bins
        it('auto-bins raw values into sensible bins', () => {
            const bins = computeBins(range(100));
            expect(bins).toHaveLength(8);
            expect(bins[0].start).toBe(0);
            expect(bins.at(-1)!.end).toBe(100);
            expect(totalCount(bins)).toBe(100);
        });

        it('produces contiguous bins with no gaps or overlaps', () => {
            const bins = computeBins(range(50), { binCount: 5 });
            for (let i = 1; i < bins.length; i++) {
                expect(bins[i].start).toBeCloseTo(bins[i - 1].end, 10);
            }
        });

        // T-2: honours binCount and explicit binEdges
        it('honours an explicit binCount', () => {
            expect(computeBins(range(100), { binCount: 4 })).toHaveLength(4);
            expect(computeBins(range(100), { binCount: 20 })).toHaveLength(20);
        });

        it('honours explicit binEdges, last bin inclusive of its upper edge', () => {
            const bins = computeBins([1, 2, 3, 4, 5], { binEdges: [0, 2, 4, 6] });
            expect(bins.map(b => [b.start, b.end, b.count])).toEqual([
                [0, 2, 1],
                [2, 4, 2],
                [4, 6, 2],
            ]);
        });

        it('drops samples outside explicit binEdges', () => {
            const bins = computeBins([-1, 0.5, 10], { binEdges: [0, 2] });
            expect(totalCount(bins)).toBe(1);
        });

        it('prefers binEdges over binCount when both are given', () => {
            const bins = computeBins([1, 2, 3], { binCount: 9, binEdges: [0, 2, 4] });
            expect(bins).toHaveLength(2);
        });

        it('sorts unsorted binEdges instead of producing negative-width bins', () => {
            const bins = computeBins([1, 3], { binEdges: [4, 0, 2] });
            expect(bins.map(b => [b.start, b.end])).toEqual([[0, 2], [2, 4]]);
        });

        it('falls back to Sturges for a non-usable binCount', () => {
            const auto = computeBins(range(100)).length;
            expect(computeBins(range(100), { binCount: 0 })).toHaveLength(auto);
            expect(computeBins(range(100), { binCount: -3 })).toHaveLength(auto);
            expect(computeBins(range(100), { binCount: Number.NaN })).toHaveLength(auto);
        });

        it('falls back to auto binning for fewer than two usable edges', () => {
            expect(computeBins(range(100), { binEdges: [5] })).toHaveLength(8);
            expect(computeBins(range(100), { binEdges: [] })).toHaveLength(8);
        });

        // §2.2 edge case — empty data
        it('returns no bins for empty data', () => {
            expect(computeBins([])).toEqual([]);
        });

        // §2.2 edge case — single data point
        it('bins a single data point without producing NaN', () => {
            const bins = computeBins([42]);
            expect(totalCount(bins)).toBe(1);
            for (const bin of bins) {
                expect(Number.isFinite(bin.start)).toBe(true);
                expect(Number.isFinite(bin.end)).toBe(true);
                expect(bin.end).toBeGreaterThan(bin.start);
            }
        });

        // §2.2 edge case — zero variance must not divide by zero
        it('bins zero-variance data into one non-empty bin without dividing by zero', () => {
            const bins = computeBins([7, 7, 7, 7]);
            expect(totalCount(bins)).toBe(4);
            expect(bins.filter(b => b.count > 0)).toHaveLength(1);
            for (const bin of bins) {
                expect(Number.isFinite(bin.start)).toBe(true);
                expect(Number.isFinite(bin.end)).toBe(true);
                expect(bin.end).toBeGreaterThan(bin.start);
            }
        });

        // §2.2 edge case — negative values
        it('bins negative values', () => {
            const bins = computeBins([-10, -5, 0, 5, 10]);
            expect(totalCount(bins)).toBe(5);
            expect(bins[0].start).toBeLessThanOrEqual(-10);
            expect(bins.at(-1)!.end).toBeGreaterThanOrEqual(10);
        });

        // §2.2 edge case — very large values
        it('bins very large values without losing precision to Infinity', () => {
            const bins = computeBins([1e12, 1.5e12, 2e12]);
            expect(totalCount(bins)).toBe(3);
            for (const bin of bins) {
                expect(Number.isFinite(bin.start)).toBe(true);
                expect(Number.isFinite(bin.end)).toBe(true);
            }
        });

        it('ignores non-finite samples', () => {
            const bins = computeBins([1, 2, Number.NaN, Number.POSITIVE_INFINITY, 3]);
            expect(totalCount(bins)).toBe(3);
        });

        it('returns no bins when every sample is non-finite', () => {
            expect(computeBins([Number.NaN, Number.NEGATIVE_INFINITY])).toEqual([]);
        });

        // Spec section 3.2: 10,000 raw values binned under 16ms. Timed as the BEST
        // of several runs — see bestOf above.
        it('bins 10,000 values within the 16ms budget', () => {
            const values = Array.from({ length: 10_000 }, (_, i) => (i * 7919) % 1000);
            expect(bestOf(() => computeBins(values))).toBeLessThan(16);
        });

        // Guards the complexity: binning is O(n log bins), so ten times the
        // sample must not cost anything like a hundred times the work.
        it('scales linearly with the sample size', () => {
            const small = Array.from({ length: 10_000 }, (_, i) => (i * 7919) % 1000);
            const large = Array.from({ length: 100_000 }, (_, i) => (i * 7919) % 1000);

            const t1 = bestOf(() => computeBins(small));
            const t2 = bestOf(() => computeBins(large));

            expect(t2).toBeLessThan(Math.max(t1, 0.05) * 40);
        });

        // Regression: `Math.min(...values)` passes one argument per element and
        // V8 throws `RangeError: Maximum call stack size exceeded` past ~100k, so
        // the domain is computed in a single pass instead.
        it('bins a sample far larger than the argument-count limit', () => {
            const values = Array.from({ length: 200_000 }, (_, i) => i % 5000);
            const bins = computeBins(values);
            expect(totalCount(bins)).toBe(200_000);
            expect(Number.isFinite(bins[0].start)).toBe(true);
        });

        it('places the maximum sample in the last bin, not past it', () => {
            const bins = computeBins([0, 100], { binCount: 4 });
            expect(bins.at(-1)!.count).toBeGreaterThanOrEqual(1);
            expect(totalCount(bins)).toBe(2);
        });
    });
});
