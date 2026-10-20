/**
 * Histogram binning
 * Pure, framework-free helpers so the statistics can be unit-tested directly
 * and memoised by the component independently of layout.
 */

import { niceDomain } from '../../lib/chart-scale';
import { extent } from '../../lib/chart.utils';
import { HistogramBin, HistogramBinOptions } from './histogram.types';

/**
 * Sturges' rule: `ceil(log2(n)) + 1` bins for a sample of `n`, floored at one
 * so an empty or single-value sample still yields a drawable bin.
 */
export function sturgesBinCount(sampleSize: number): number {
    if (sampleSize <= 1) return 1;
    return Math.max(1, Math.ceil(Math.log2(sampleSize)) + 1);
}

function finiteValues(values: readonly number[]): number[] {
    return values.filter(v => Number.isFinite(v));
}

function resolveBinCount(binCount: number | undefined, sampleSize: number): number {
    if (binCount !== undefined && Number.isFinite(binCount) && binCount >= 1) {
        return Math.floor(binCount);
    }
    return sturgesBinCount(sampleSize);
}

function usableEdges(binEdges: number[] | undefined): number[] | undefined {
    if (!binEdges) return undefined;
    const finite = finiteValues(binEdges);
    if (finite.length < 2) return undefined;
    const sorted = [...finite].sort((a, b) => a - b);
    // `.at(-1)` rather than `[length - 1]` (S7755). The `??` keeps the type
    // narrowed without a non-null assertion, which the lint config forbids;
    // the fallback is unreachable because `finite.length >= 2` above.
    const highest = sorted.at(-1) ?? sorted[0];
    return highest > sorted[0] ? sorted : undefined;
}

/**
 * Ascending bin boundaries for a sample: `binCount + 1` edges spread evenly
 * over the domain {@link niceDomain} rounds outward from the sample's extent,
 * so the first and last edge are round numbers rather than the raw min/max.
 *
 * Returns `[]` when no finite sample is left. Zero-variance samples (every
 * value identical, including a single value) still get a strictly positive
 * span — `niceDomain` pads a collapsed domain — so callers never divide by a
 * zero bin width.
 */
export function computeBinEdges(values: readonly number[], binCount?: number): number[] {
    const range = extent(values);
    if (!range) return [];

    const count = resolveBinCount(binCount, finiteValues(values).length);
    const [lo, hi] = niceDomain(range[0], range[1], count);
    const width = (hi - lo) / count;

    // The last edge is `hi` itself: `lo + count·width` can land an ulp below
    // it and drop the maximum sample from the last bin.
    return Array.from({ length: count + 1 }, (...[, i]) => (i === count ? hi : lo + i * width));
}

function edgesFor(values: readonly number[], options: HistogramBinOptions): number[] {
    return usableEdges(options.binEdges) ?? computeBinEdges(values, options.binCount);
}

function binIndexOf(value: number, edges: number[]): number {
    const last = edges.length - 2;
    if (value < edges[0] || value > edges[last + 1]) return -1;
    if (value === edges[last + 1]) return last;

    let low = 0;
    let high = last;
    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        if (edges[mid] <= value) low = mid;
        else high = mid - 1;
    }
    return low;
}

/**
 * Bins a raw sample into contiguous {@link HistogramBin}s.
 *
 * `options.binEdges` wins when it supplies two or more distinct finite edges;
 * otherwise `options.binCount` (or Sturges' rule) spreads equal-width bins over
 * the nice-rounded domain. Non-finite samples and samples outside the edges are
 * dropped, so the bin counts need not sum to `values.length`. Bins are
 * half-open `[start, end)` except the last, which includes its upper edge.
 */
export function computeBins(
    values: readonly number[],
    options: HistogramBinOptions = {},
): HistogramBin[] {
    const edges = edgesFor(values, options);
    if (edges.length < 2) return [];

    const counts = new Array<number>(edges.length - 1).fill(0);
    for (const value of finiteValues(values)) {
        const index = binIndexOf(value, edges);
        if (index >= 0) counts[index]++;
    }

    return counts.map((count, i) => ({ start: edges[i], end: edges[i + 1], count }));
}
