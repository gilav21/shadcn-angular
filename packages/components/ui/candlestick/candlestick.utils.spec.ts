import { describe, it, expect } from 'vitest';
import {
    formatPeriod,
    isRising,
    normalizeOhlc,
    ohlcExtent,
    toTimestamp,
} from './candlestick.utils';
import { OhlcPoint } from './candlestick.types';

const point = (over: Partial<OhlcPoint> = {}): OhlcPoint => ({
    date: '2026-01-05',
    open: 10,
    high: 12,
    low: 9,
    close: 11,
    ...over,
});

describe('candlestick utils', () => {
    describe('toTimestamp', () => {
        it('reads a Date', () => {
            const d = new Date(Date.UTC(2026, 0, 5));
            expect(toTimestamp(d)).toBe(d.getTime());
        });

        it('passes an epoch-ms number through', () => {
            expect(toTimestamp(1_767_571_200_000)).toBe(1_767_571_200_000);
        });

        it('parses an ISO date string', () => {
            expect(toTimestamp('2026-01-05')).toBe(Date.UTC(2026, 0, 5));
        });

        it('returns NaN for a label-only string', () => {
            expect(Number.isNaN(toTimestamp('Week 1'))).toBe(true);
        });

        it('returns NaN for loose date-ish text Date.parse would accept', () => {
            expect(Number.isNaN(toTimestamp('March 2026'))).toBe(true);
            expect(Number.isNaN(toTimestamp('Q1'))).toBe(true);
        });

        it('accepts an ISO date-time and a year-month', () => {
            expect(toTimestamp('2026-01-05T00:00:00Z')).toBe(Date.UTC(2026, 0, 5));
            expect(toTimestamp('2026-01')).toBe(Date.UTC(2026, 0, 1));
        });

        it('returns NaN for a non-finite number', () => {
            expect(Number.isNaN(toTimestamp(Number.POSITIVE_INFINITY))).toBe(true);
            expect(Number.isNaN(toTimestamp(Number.NaN))).toBe(true);
        });
    });

    describe('formatPeriod', () => {
        it('uses a non-temporal label string verbatim', () => {
            expect(formatPeriod('Week 1')).toBe('Week 1');
            expect(formatPeriod('March 2026')).toBe('March 2026');
        });

        it('formats an ISO date string rather than printing it raw', () => {
            expect(formatPeriod('2026-01-05', 'en-US')).toContain('Jan');
        });

        it('formats a Date as a short local date', () => {
            expect(formatPeriod(new Date(Date.UTC(2026, 0, 5, 12)), 'en-US')).toContain('Jan');
        });

        it('formats an epoch-ms number', () => {
            expect(formatPeriod(Date.UTC(2026, 0, 5, 12), 'en-US')).toContain('Jan');
        });

        it('does not render "Invalid Date" for an unparseable value', () => {
            expect(formatPeriod(Number.NaN)).toBe('NaN');
        });
    });

    describe('isRising', () => {
        it('is true when the close is above the open', () => {
            expect(isRising(point({ open: 10, close: 11 }))).toBe(true);
        });

        it('is false when the close is below the open', () => {
            expect(isRising(point({ open: 11, close: 10 }))).toBe(false);
        });

        // §2.2 edge case — doji
        it('treats a doji (open === close) as rising', () => {
            expect(isRising(point({ open: 10, close: 10 }))).toBe(true);
        });
    });

    describe('normalizeOhlc', () => {
        it('keeps rows whose four prices are all finite', () => {
            expect(normalizeOhlc([point(), point()])).toHaveLength(2);
        });

        it('drops rows with a non-finite price', () => {
            const bad = [
                point({ open: Number.NaN }),
                point({ high: Number.POSITIVE_INFINITY }),
                point({ low: Number.NaN }),
                point({ close: Number.NaN }),
                point(),
            ];
            expect(normalizeOhlc(bad)).toHaveLength(1);
        });

        it('keeps a label-only date, which is legal on the ordinal axis', () => {
            expect(normalizeOhlc([point({ date: 'Week 1' })])).toHaveLength(1);
        });

        it('preserves order', () => {
            const pts = [point({ open: 1 }), point({ open: 2 }), point({ open: 3 })];
            expect(normalizeOhlc(pts).map(p => p.open)).toEqual([1, 2, 3]);
        });

        it('returns an empty array for empty input', () => {
            expect(normalizeOhlc([])).toEqual([]);
        });
    });

    describe('ohlcExtent', () => {
        it('spans every price across every point', () => {
            expect(
                ohlcExtent([
                    point({ open: 10, high: 12, low: 9, close: 11 }),
                    point({ open: 11, high: 20, low: 4, close: 5 }),
                ]),
            ).toEqual([4, 20]);
        });

        it('includes open/close even when they fall outside low/high', () => {
            expect(ohlcExtent([point({ open: 30, high: 12, low: 9, close: 1 })])).toEqual([1, 30]);
        });

        it('returns null for an empty series', () => {
            expect(ohlcExtent([])).toBeNull();
        });

        // §2.2 edge case — single point / zero variance
        it('collapses to a single value for a flat series', () => {
            expect(ohlcExtent([point({ open: 5, high: 5, low: 5, close: 5 })])).toEqual([5, 5]);
        });

        // §2.2 edge case — negative values
        it('handles negative prices', () => {
            expect(ohlcExtent([point({ open: -2, high: -1, low: -8, close: -5 })])).toEqual([-8, -1]);
        });
    });
});
