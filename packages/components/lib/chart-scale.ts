/**
 * Chart Scales
 * Continuous / time / band / size scale helpers for cartesian charts.
 *
 * Pure functions, no Angular. Built on `calculateAxisTicks` in
 * `chart.utils.ts`. The charts-expansion rule that it is "reused, never
 * modified" is superseded by specs/chart-scale-robustness-spec.md: the float
 * noise, lost maximum and runaway loops lived in it, so it is fixed in place.
 */

import { calculateAxisTicks, clampTickCount, extent } from './chart.utils';

export interface LinearScale {
    scale(value: number): number;
    invert(pixel: number): number;
    ticks(count?: number): number[];
}

export interface TimeScale {
    scale(value: number | Date): number;
    invert(pixel: number): number;
}

export interface BandScale {
    readonly step: number;
    readonly bandwidth: number;
    position(key: string): number | undefined;
}

export interface SizeScale {
    radius(value: number): number;
}

/** Normalize a temporal value (epoch-ms number or Date) to epoch milliseconds. */
export function toEpochMs(value: number | Date): number {
    return value instanceof Date ? value.getTime() : value;
}

/** Linear domain→pixel scale with inverse and nice ticks. */
export function linearScale(
    domain: [number, number],
    range: [number, number],
): LinearScale {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    const domainSpan = d1 - d0;
    const rangeSpan = r1 - r0;

    return {
        scale(value: number): number {
            if (domainSpan === 0) return r0;
            return r0 + ((value - d0) / domainSpan) * rangeSpan;
        },
        invert(pixel: number): number {
            if (rangeSpan === 0) return d0;
            return d0 + ((pixel - r0) / rangeSpan) * domainSpan;
        },
        /** Nice ticks clipped to the domain, so no gridline lands outside the plot. */
        ticks(count = 5): number[] {
            const lo = Math.min(d0, d1);
            const hi = Math.max(d0, d1);
            return calculateAxisTicks(lo, hi, count).filter(t => t >= lo && t <= hi);
        },
    };
}

const NICE_DOMAIN_MAX_ITERATIONS = 10;

/** A collapsed range padded by `|value|` (or 1), staying finite near `±MAX_VALUE`. */
function collapsedBounds(value: number): [number, number] {
    if (value === 0) return [-1, 1];
    const doubled = 2 * value;
    const far = Number.isFinite(doubled) ? doubled : value;
    return value > 0 ? [0, far] : [far, 0];
}

/** Finite ascending bounds: a non-finite bound takes the other's value, both non-finite give `[0, 1]`. */
function finiteBounds(min: number, max: number): [number, number] {
    const lo = Number.isFinite(min) ? min : max;
    const hi = Number.isFinite(max) ? max : min;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
    if (lo === hi) return collapsedBounds(lo);
    return lo < hi ? [lo, hi] : [hi, lo];
}

/**
 * Round a domain outward to nice human-friendly bounds.
 *
 * Always finite with `max > min`, and contains every finite input. A
 * non-finite bound is replaced by the other bound (both → `[0, 1]`), a
 * reversed range is swapped, and a collapsed one is padded by `|value|` (or 1)
 * before nicing. The domain is re-niced until
 * `calculateAxisTicks(d0, d1, count)` reproduces `[d0, d1]` — the fixed point
 * that makes `linearScale(domain).ticks(count)` start and end on its bounds.
 * The loop is capped at 10 passes; a domain returned at the cap still
 * contains the input but need not be a fixed point (never observed in
 * probes, which converge within 8).
 */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
    let domain = finiteBounds(min, max);
    for (let i = 0; i < NICE_DOMAIN_MAX_ITERATIONS; i++) {
        const ticks = calculateAxisTicks(domain[0], domain[1], count);
        const next: [number, number] = [ticks[0], ticks.at(-1) ?? ticks[0]];
        if (next[0] === domain[0] && next[1] === domain[1]) return domain;
        domain = next;
    }
    return domain;
}

/**
 * {@link niceDomain} over the finite `values` and zero: the domain of any chart
 * whose marks grow from a zero baseline (bars, areas). No finite value gives
 * `[-1, 1]`, so an all-zero or empty dataset still has an axis with ticks.
 */
export function zeroBasedDomain(values: Iterable<number | null | undefined>, count = 5): [number, number] {
    const [lo, hi] = extent(values) ?? [0, 0];
    return niceDomain(Math.min(0, lo), Math.max(0, hi), count);
}

/** Categorical band scale (evenly spaced bands with optional padding). */
export function bandScale(
    keys: string[],
    range: [number, number],
    paddingInner = 0,
    paddingOuter = 0,
): BandScale {
    const [r0, r1] = range;
    const n = keys.length;
    const divisor = Math.max(1, n - paddingInner + paddingOuter * 2);
    const step = (r1 - r0) / divisor;
    const bandwidth = step * (1 - paddingInner);
    const start = r0 + step * paddingOuter;
    const indexByKey = new Map(keys.map((key, index) => [key, index]));

    return {
        step,
        bandwidth,
        position(key: string): number | undefined {
            const index = indexByKey.get(key);
            return index === undefined ? undefined : start + index * step;
        },
    };
}

/** Area-proportional (sqrt) scale for bubble radii. */
export function sizeScale(
    domain: [number, number],
    radiusRange: [number, number],
): SizeScale {
    const [d0, d1] = domain;
    const [r0, r1] = radiusRange;
    const domainSpan = d1 - d0;

    return {
        radius(value: number): number {
            if (domainSpan === 0) return r0;
            const t = Math.max(0, Math.min(1, (value - d0) / domainSpan));
            return r0 + Math.sqrt(t) * (r1 - r0);
        },
    };
}

/** Time domain→pixel scale; accepts Date or epoch-ms inputs. */
export function timeScale(
    domain: [number | Date, number | Date],
    range: [number, number],
): TimeScale {
    const linear = linearScale([toEpochMs(domain[0]), toEpochMs(domain[1])], range);
    return {
        scale(value: number | Date): number {
            return linear.scale(toEpochMs(value));
        },
        invert(pixel: number): number {
            return linear.invert(pixel);
        },
    };
}

const TIME_INTERVALS_MS: readonly number[] = [
    1000, 5000, 15000, 30000,
    60_000, 300_000, 900_000, 1_800_000,
    3_600_000, 10_800_000, 21_600_000, 43_200_000,
    86_400_000, 172_800_000, 604_800_000,
    2_592_000_000, 7_776_000_000, 31_536_000_000,
];

function pickTimeInterval(rangeMs: number, count: number): number {
    const target = rangeMs / Math.max(1, count);
    let best = TIME_INTERVALS_MS[0];
    let bestDiff = Math.abs(best - target);
    for (const interval of TIME_INTERVALS_MS) {
        const diff = Math.abs(interval - target);
        if (diff < bestDiff) {
            best = interval;
            bestDiff = diff;
        }
    }
    return best;
}

const YEAR_MS = TIME_INTERVALS_MS.at(-1) ?? 31_536_000_000;

/**
 * The smallest interval at or above `best` that yields at most `maxTicks`
 * ticks over `rangeMs`; past the largest table entry, whole years.
 */
function cappedTimeInterval(best: number, rangeMs: number, maxTicks: number): number {
    const fits = (interval: number): boolean => Math.floor(rangeMs / interval) + 1 <= maxTicks;
    const listed = TIME_INTERVALS_MS.find(interval => interval >= best && fits(interval));
    return listed ?? YEAR_MS * Math.ceil(rangeMs / ((maxTicks - 1) * YEAR_MS));
}

/**
 * Nice ascending tick timestamps within a time domain: at most `2·count + 3`
 * of them (`count` floored and clamped to `[1, 50]`), widening the interval —
 * in whole years past the table — when the best one would exceed that.
 * Non-finite bounds give `[]` (both) or `[finiteBound]`; `max <= min` gives
 * `[min]`; a range that overflows (e.g. `±1e308`) or holds fewer than two
 * ticks gives `[min, max]`.
 */
export function niceTimeTicks(min: number, max: number, count = 5): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [min, max].filter(Number.isFinite);
    if (max <= min) return [min];
    const n = clampTickCount(count);
    const range = max - min;
    if (!Number.isFinite(range)) return [min, max];
    const interval = cappedTimeInterval(pickTimeInterval(range, n), range, 2 * n + 3);
    const first = Math.ceil(min / interval);
    const last = Math.floor(max / interval);
    const ticks = Array.from({ length: Math.max(0, last - first + 1) }, (_, k) => (first + k) * interval);
    return ticks.length > 1 ? ticks : [min, max];
}

interface Hsl {
    h: number;
    s: number;
    l: number;
}

const HSL_PATTERN = /hsl\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\s*\)/;

function parseHsl(color: string): Hsl {
    const match = HSL_PATTERN.exec(color);
    if (!match) return { h: 0, s: 0, l: 0 };
    return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}

function lerp(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
}

/** Sequential HSL color scale interpolating between two endpoint colors. */
export function sequentialColorScale(
    domain: [number, number],
    colors: [string, string],
): (value: number) => string {
    const [d0, d1] = domain;
    const span = d1 - d0;
    const from = parseHsl(colors[0]);
    const to = parseHsl(colors[1]);

    return (value: number): string => {
        const t = span === 0 ? 0 : (value - d0) / span;
        if (t <= 0) return colors[0];
        if (t >= 1) return colors[1];
        const h = lerp(from.h, to.h, t);
        const s = lerp(from.s, to.s, t);
        const l = lerp(from.l, to.l, t);
        return `hsl(${h}, ${s}%, ${l}%)`;
    };
}
