/**
 * Candlestick types
 * Chart-local public types. They deliberately do NOT live in
 * `lib/chart.types.ts` — only a second consumer would justify promoting them.
 */

/** One OHLC period: the candle body spans open→close, the wick low→high. */
export interface OhlcPoint {
    /**
     * The period the candle covers. A `Date` or epoch-ms `number` is formatted
     * for the axis and can drive the continuous `'time'` axis; a plain `string`
     * is used verbatim as the label and is only placeable on the default
     * `'ordinal'` axis.
     */
    date: Date | number | string;
    /** Price at the start of the period — the bottom of a rising body, the top of a falling one. */
    open: number;
    /** Highest price in the period — the top of the wick. */
    high: number;
    /** Lowest price in the period — the bottom of the wick. */
    low: number;
    /** Price at the end of the period. `close >= open` renders as a rising candle. */
    close: number;
}

/**
 * How the horizontal axis places candles.
 *
 * - `'ordinal'` (default) puts one equal-width band per period **present in the
 *   data**, so weekends and holidays leave no blank space — what every
 *   financial charting tool does.
 * - `'time'` places candles on a continuous time scale, which is correct for
 *   genuinely continuous data but shows real gaps for missing periods.
 */
export type CandlestickAxisMode = 'ordinal' | 'time';
