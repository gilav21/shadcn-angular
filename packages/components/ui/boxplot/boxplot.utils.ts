/**
 * Boxplot statistics
 * Pure, framework-free helpers so the quartile maths can be unit-tested
 * directly and memoised by the component independently of layout.
 */

import { BoxplotGroup, BoxplotStats } from './boxplot.types';

/** How far past the box, in IQRs, the whiskers may reach before a sample counts as an outlier. */
export const OUTLIER_FENCE = 1.5;

/**
 * Linear-interpolation quantile (the "type 7" definition used by NumPy, R's
 * default and d3), over an **already ascending** sample. `p` is clamped to
 * `[0, 1]`; an empty sample yields `NaN`.
 */
export function quantile(sorted: readonly number[], p: number): number {
    const n = sorted.length;
    if (n === 0) return Number.NaN;
    if (n === 1) return sorted[0];

    const clamped = Math.min(1, Math.max(0, p));
    const h = (n - 1) * clamped;
    const lo = Math.floor(h);
    const hi = Math.min(lo + 1, n - 1);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/**
 * Summarises a raw sample into quartiles, 1.5×IQR whisker ends and outliers.
 *
 * Returns `null` for a sample with no finite values — the caller skips the
 * group rather than drawing a degenerate box. A zero-variance sample gives an
 * IQR of 0, which collapses both fences onto the single value: the samples all
 * sit *on* the fences, so they stay inside the whiskers and none is reported as
 * an outlier.
 */
export function computeStats(values: readonly number[]): BoxplotStats | null {
    const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return null;

    const q1 = quantile(sorted, 0.25);
    const median = quantile(sorted, 0.5);
    const q3 = quantile(sorted, 0.75);
    const fence = OUTLIER_FENCE * (q3 - q1);
    const lowerFence = q1 - fence;
    const upperFence = q3 + fence;

    const inside = sorted.filter(v => v >= lowerFence && v <= upperFence);
    const outliers = sorted.filter(v => v < lowerFence || v > upperFence);

    return {
        min: inside[0] ?? q1,
        q1,
        median,
        q3,
        max: inside.at(-1) ?? q3,
        outliers,
    };
}

/**
 * The summary a group renders: its pre-computed {@link BoxplotGroup.stats} when
 * present, otherwise the summary of its raw {@link BoxplotGroup.values}. Returns
 * `null` when the group carries neither, so both API shapes converge on one
 * render path (T-6).
 */
export function resolveGroupStats(group: BoxplotGroup): BoxplotStats | null {
    if (group.stats) return group.stats;
    return computeStats(group.values ?? []);
}
