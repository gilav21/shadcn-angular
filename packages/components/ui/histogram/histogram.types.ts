/**
 * Histogram types
 * Chart-local public types. They deliberately do NOT live in
 * `lib/chart.types.ts` — only a second consumer would justify promoting them.
 */

/** One bar of a histogram: a half-open value interval and how many samples fell in it. */
export interface HistogramBin {
    /** Inclusive lower edge of the interval. */
    start: number;
    /** Upper edge. Exclusive for every bin except the last, which includes it. */
    end: number;
    /** Number of finite samples that fell inside the interval. */
    count: number;
}

/** Binning strategy for {@link computeBins}. `binEdges` wins when both are given. */
export interface HistogramBinOptions {
    /**
     * How many equal-width bins to spread over the nice-rounded value domain.
     * Ignored when it is not a finite number `>= 1`, in which case Sturges'
     * rule picks the count from the sample size.
     */
    binCount?: number;
    /**
     * Explicit ascending bin boundaries — `n` edges produce `n - 1` bins.
     * Samples outside `[edges[0], edges.at(-1)]` are dropped. Ignored when
     * fewer than two usable edges are supplied.
     */
    binEdges?: number[];
}
