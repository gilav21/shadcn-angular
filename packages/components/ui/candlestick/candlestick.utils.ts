/**
 * Candlestick helpers
 * Pure, framework-free functions so the OHLC handling can be unit-tested
 * directly and memoised by the component independently of layout.
 */

import { OhlcPoint } from './candlestick.types';

/**
 * Cheap ISO-8601 gate: a four-digit year and month, then only characters an ISO
 * date-time can contain. `Date.parse` still decides whether the value is a real
 * date — this only rejects the loose input V8 would otherwise accept, because
 * `Date.parse('Week 1')` returns a real timestamp rather than `NaN` and would
 * silently place a label-only period somewhere in year 1 on the time axis.
 */
const ISO_DATE = /^\d{4}-\d{2}[\d:.TZ +-]*$/;

/**
 * Epoch milliseconds for a period, or `NaN` when the value carries no date — a
 * plain label string such as `'Week 1'`. Callers use `Number.isFinite` on the
 * result to decide whether a point can sit on the continuous time axis.
 */
export function toTimestamp(date: Date | number | string): number {
    if (date instanceof Date) return date.getTime();
    if (typeof date === 'number') return Number.isFinite(date) ? date : Number.NaN;
    return ISO_DATE.test(date) ? Date.parse(date) : Number.NaN;
}

/**
 * Axis label for a period. A `Date`, an epoch-ms number and an ISO date string
 * are all formatted as a short local date; anything else — a label such as
 * `'Week 1'` — is used verbatim, so a non-temporal period never renders as
 * `Invalid Date`.
 */
export function formatPeriod(date: Date | number | string, locale = 'en-US'): string {
    const ts = toTimestamp(date);
    if (!Number.isFinite(ts)) return String(date);
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(ts);
}

/** Whether a period closed at or above its open — the rising (bullish) colour. A doji (`open === close`) counts as rising. */
export function isRising(point: OhlcPoint): boolean {
    return point.close >= point.open;
}

/**
 * Drops points whose four prices are not all finite, so a bad row cannot poison
 * the price domain with `NaN`. Order is preserved; the `date` is not validated
 * here because a label-only period is legal on the ordinal axis.
 */
export function normalizeOhlc(points: readonly OhlcPoint[]): OhlcPoint[] {
    return points.filter(
        p =>
            Number.isFinite(p.open) &&
            Number.isFinite(p.high) &&
            Number.isFinite(p.low) &&
            Number.isFinite(p.close),
    );
}

/**
 * The `[min, max]` price extent across every wick and body, or `null` for an
 * empty series. Derived from all four prices rather than just low/high, so a
 * row whose `low` is above its `open` still renders inside the plot.
 */
export function ohlcExtent(points: readonly OhlcPoint[]): [number, number] | null {
    if (points.length === 0) return null;

    // One pass, no intermediate array and no spread: `Math.min(...all)` would
    // pass four arguments per period and V8 throws `RangeError: Maximum call
    // stack size exceeded` around 100k arguments, so a long series would crash.
    let min = points[0].open;
    let max = points[0].open;
    for (const p of points) {
        for (const price of [p.open, p.high, p.low, p.close]) {
            if (price < min) min = price;
            if (price > max) max = price;
        }
    }
    return [min, max];
}
