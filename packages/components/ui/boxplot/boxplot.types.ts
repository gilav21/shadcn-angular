/**
 * Boxplot types
 * Chart-local public types. They deliberately do NOT live in
 * `lib/chart.types.ts` — only a second consumer would justify promoting them.
 */

/**
 * The five-number summary a single box draws, plus the points that fell outside
 * the whiskers. `min`/`max` are the **whisker ends** — the most extreme samples
 * still inside the 1.5×IQR fences — not the raw extremes of the sample, which
 * survive in {@link BoxplotStats.outliers}.
 */
export interface BoxplotStats {
    /** Lower whisker end: the smallest sample `>= q1 - 1.5 * IQR`. */
    min: number;
    /** First quartile — the lower edge of the box. */
    q1: number;
    /** Median — the line drawn inside the box. */
    median: number;
    /** Third quartile — the upper edge of the box. */
    q3: number;
    /** Upper whisker end: the largest sample `<= q3 + 1.5 * IQR`. */
    max: number;
    /** Samples beyond either fence, drawn as individual points. */
    outliers: number[];
}

/**
 * One box on the chart. Supply **either** a raw `values` sample — the component
 * computes the summary — **or** a pre-computed `stats`, which wins when both
 * are present. A group with neither (or with an empty `values`) is skipped.
 */
export interface BoxplotGroup {
    /** Category label drawn against the box on the category axis. */
    label: string;
    /** Raw observations. Non-finite entries are dropped before summarising. */
    values?: number[];
    /** Pre-computed summary, used verbatim instead of summarising {@link values}. */
    stats?: BoxplotStats;
    /** Overrides the palette colour picked from the group's index. */
    color?: string;
}
