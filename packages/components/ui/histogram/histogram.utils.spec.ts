import { describe, it, expect } from 'vitest';
import { computeBinEdges, computeBins, sturgesBinCount } from './histogram.utils';

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

const totalCount = (bins: { count: number }[]): number =>
    bins.reduce((sum, b) => sum + b.count, 0);

/** Seeded PRNG (mulberry32) so a failing property prints a reproducible input. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SEED = 20261003;

/** One sample per class the binning treats differently, each drawn from the seeded PRNG. */
function sampleClasses(rng: () => number): [string, number[]][] {
    const draw = (n: number, f: () => number): number[] => Array.from({ length: n }, f);
    const twoDecimals = (lo: number, hi: number): number => Math.round((lo + rng() * (hi - lo)) * 100) / 100;
    return [
        ['narrow fractional (reported)', [1.97, 2.2, 2.4, 2.69]],
        ['narrow fractional', draw(40, () => twoDecimals(1.97, 2.69))],
        // Edges built as `lo + i·width` can end a hair below the domain's top.
        ['max on a nice bound', [0, 0.23, 0.46]],
        ...draw(5, () => twoDecimals(0.1, 1)).map((top): [string, number[]] =>
            ['narrow from zero', [0, ...draw(10, () => twoDecimals(0, top)), top]]),
        ['integer', draw(100, () => Math.round(rng() * 300))],
        ['negative', draw(60, () => -twoDecimals(0.01, 10))],
        ['mixed-sign', draw(60, () => twoDecimals(-10, 10))],
        ['all-equal', [7, 7, 7, 7]],
        ['single value', [42]],
        ['non-finite mixed in', [...draw(30, () => twoDecimals(0, 1)), Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]],
        ['large magnitude', [1e12, 1.5e12, 2e12]],
        ['200,000 samples', draw(200_000, () => twoDecimals(-50, 50))],
    ];
}

/** What, if anything, breaks the binning contract for one sample. */
function binningProblem(values: number[], finite: number[], binCount: number | undefined): string | undefined {
    const bins = computeBins(values, { binCount });
    // Sturges counts only the samples that can be binned.
    const expectedBins = binCount ?? sturgesBinCount(finite.length);
    if (bins.length !== expectedBins) return `${bins.length} bins, expected ${expectedBins}`;
    if (totalCount(bins) !== finite.length) {
        return `counts sum to ${totalCount(bins)} of ${finite.length}; edges ${bins[0]?.start}..${bins.at(-1)?.end}`;
    }
    if (bins.some(bin => !Number.isFinite(bin.start) || !Number.isFinite(bin.end) || bin.end <= bin.start)) return 'a bin is non-finite or empty-width';
    for (let i = 1; i < bins.length; i++) {
        if (bins[i].start !== bins[i - 1].end) return `gap between bins ${i - 1} and ${i}`;
    }
    // Each bin holds exactly the samples inside its own edges ([start, end),
    // the last one closed), so an out-of-range value cannot be clamped in.
    const lastIndex = bins.length - 1;
    const misplaced = bins.findIndex((bin, i) => bin.count !== finite.filter(v =>
        v >= bin.start && (v < bin.end || (i === lastIndex && v === bin.end))).length);
    return misplaced === -1 ? undefined : `bin ${misplaced} holds samples outside its edges`;
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

        // T-4 (UC-4, UC-8): every sample class, auto and explicit bin counts.
        it('computeBins counts every finite sample exactly once', () => {
            const rng = mulberry32(SEED);
            const violations: string[] = [];
            for (const [cls, values] of sampleClasses(rng)) {
                const finite = values.filter(v => Number.isFinite(v));
                for (const binCount of [undefined, 1, 3, 7, 50]) {
                    const problem = binningProblem(values, finite, binCount);
                    if (problem) violations.push(`${cls} (n=${values.length}, binCount=${binCount}): ${problem}`);
                }
            }
            expect(violations, `seed ${SEED}`).toEqual([]);
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

        it('returns no bins when every sample is non-finite', () => {
            expect(computeBins([Number.NaN, Number.NEGATIVE_INFINITY])).toEqual([]);
        });
    });
});
