import { describe, it, expect } from 'vitest';
import { computeStats, quantile, resolveGroupStats, OUTLIER_FENCE } from './boxplot.utils';
import { BoxplotStats } from './boxplot.types';

describe('boxplot utils', () => {
    describe('quantile', () => {
        it('interpolates linearly between the bracketing samples (type 7)', () => {
            const sorted = [1, 2, 3, 4];
            expect(quantile(sorted, 0.25)).toBeCloseTo(1.75, 10);
            expect(quantile(sorted, 0.5)).toBeCloseTo(2.5, 10);
            expect(quantile(sorted, 0.75)).toBeCloseTo(3.25, 10);
        });

        it('returns the exact sample when the quantile lands on one', () => {
            expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
            expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
            expect(quantile([1, 2, 3, 4, 5], 1)).toBe(5);
        });

        it('clamps p outside [0, 1]', () => {
            expect(quantile([1, 2, 3], -1)).toBe(1);
            expect(quantile([1, 2, 3], 4)).toBe(3);
        });

        it('returns the only sample for a single-element input', () => {
            expect(quantile([42], 0.25)).toBe(42);
        });

        it('returns NaN for an empty sample', () => {
            expect(Number.isNaN(quantile([], 0.5))).toBe(true);
        });
    });

    describe('computeStats', () => {
        // T-5: computes quartiles/median/whiskers from raw values
        it('computes quartiles, median and whiskers from raw values', () => {
            const stats = computeStats([1, 2, 3, 4, 5])!;
            expect(stats.q1).toBe(2);
            expect(stats.median).toBe(3);
            expect(stats.q3).toBe(4);
            expect(stats.min).toBe(1);
            expect(stats.max).toBe(5);
            expect(stats.outliers).toEqual([]);
        });

        it('does not need the input pre-sorted', () => {
            expect(computeStats([5, 1, 4, 2, 3])).toEqual(computeStats([1, 2, 3, 4, 5]));
        });

        // T-7: outliers beyond 1.5 IQR
        it('splits samples beyond 1.5 IQR into outliers and pulls the whisker back', () => {
            const stats = computeStats([1, 2, 3, 4, 100])!;
            expect(stats.q1).toBe(2);
            expect(stats.q3).toBe(4);
            expect(stats.outliers).toEqual([100]);
            expect(stats.max).toBe(4);
        });

        it('detects low outliers as well as high ones', () => {
            const stats = computeStats([-100, 1, 2, 3, 4])!;
            expect(stats.outliers).toEqual([-100]);
            expect(stats.min).toBe(1);
        });

        it('places the whisker on the most extreme sample still inside the fence', () => {
            const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 30];
            const stats = computeStats(values)!;
            const fence = stats.q3 + OUTLIER_FENCE * (stats.q3 - stats.q1);
            expect(stats.max).toBeLessThanOrEqual(fence);
            expect(stats.outliers.every(v => v > fence)).toBe(true);
        });

        // §2.2 edge case — empty data
        it('returns null for an empty sample', () => {
            expect(computeStats([])).toBeNull();
        });

        it('returns null when every sample is non-finite', () => {
            expect(computeStats([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
        });

        it('ignores non-finite samples', () => {
            expect(computeStats([1, Number.NaN, 2, 3, 4, 5])).toEqual(
                computeStats([1, 2, 3, 4, 5]),
            );
        });

        // §2.2 edge case — single data point
        it('collapses a single sample onto one value with no outliers', () => {
            const stats = computeStats([42])!;
            expect(stats).toEqual({ min: 42, q1: 42, median: 42, q3: 42, max: 42, outliers: [] });
        });

        // §2.2 edge case — zero variance / IQR of 0
        it('reports no outliers when the IQR is zero', () => {
            const stats = computeStats([7, 7, 7, 7])!;
            expect(stats.q1).toBe(7);
            expect(stats.q3).toBe(7);
            expect(stats.min).toBe(7);
            expect(stats.max).toBe(7);
            expect(stats.outliers).toEqual([]);
        });

        it('treats a lone deviating sample as an outlier when the IQR is zero', () => {
            const stats = computeStats([5, 5, 5, 5, 9])!;
            expect(stats.q3 - stats.q1).toBe(0);
            expect(stats.outliers).toEqual([9]);
            expect(stats.max).toBe(5);
        });

        // §2.2 edge case — negative values
        it('summarises an all-negative sample', () => {
            const stats = computeStats([-5, -4, -3, -2, -1])!;
            expect(stats.median).toBe(-3);
            expect(stats.min).toBe(-5);
            expect(stats.max).toBe(-1);
        });

        // §2.2 edge case — very large values
        it('summarises very large values without overflowing', () => {
            const stats = computeStats([1e12, 2e12, 3e12, 4e12, 5e12])!;
            expect(stats.median).toBe(3e12);
            expect(Number.isFinite(stats.min)).toBe(true);
            expect(Number.isFinite(stats.max)).toBe(true);
        });

        it('does not mutate the caller’s array', () => {
            const values = [5, 1, 3];
            computeStats(values);
            expect(values).toEqual([5, 1, 3]);
        });
    });

    describe('resolveGroupStats', () => {
        // T-6: pre-computed quartiles render identically to raw
        it('returns pre-computed stats verbatim', () => {
            const stats: BoxplotStats = {
                min: 1, q1: 2, median: 3, q3: 4, max: 5, outliers: [],
            };
            expect(resolveGroupStats({ label: 'A', stats })).toBe(stats);
        });

        it('agrees with the raw path for the same sample', () => {
            const values = [1, 2, 3, 4, 100];
            const fromValues = resolveGroupStats({ label: 'A', values });
            const fromStats = resolveGroupStats({ label: 'A', stats: computeStats(values)! });
            expect(fromValues).toEqual(fromStats);
        });

        it('prefers stats over values when both are supplied', () => {
            const stats: BoxplotStats = {
                min: 0, q1: 0, median: 0, q3: 0, max: 0, outliers: [],
            };
            expect(resolveGroupStats({ label: 'A', values: [1, 2, 3], stats })).toBe(stats);
        });

        it('returns null for a group with neither values nor stats', () => {
            expect(resolveGroupStats({ label: 'A' })).toBeNull();
            expect(resolveGroupStats({ label: 'A', values: [] })).toBeNull();
        });
    });
});
