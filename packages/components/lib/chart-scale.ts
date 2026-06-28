/**
 * Chart Scales
 * Continuous / time / band / size scale helpers for cartesian charts.
 *
 * Pure functions, no Angular. Additive to the existing chart utilities —
 * `calculateAxisTicks` in `chart.utils.ts` is reused, never modified.
 */

import { calculateAxisTicks } from './chart.utils';

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
        ticks(count = 5): number[] {
            return calculateAxisTicks(d0, d1, count);
        },
    };
}

/** Round a domain outward to nice human-friendly bounds. */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
    if (max <= min) {
        const pad = Math.abs(min) || 1;
        return [min - pad, min + pad];
    }
    const ticks = calculateAxisTicks(min, max, count);
    return [ticks[0], ticks[ticks.length - 1]];
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

/** Nice ascending tick timestamps spanning a time domain. */
export function niceTimeTicks(min: number, max: number, count = 5): number[] {
    if (max <= min) return [min];
    const interval = pickTimeInterval(max - min, count);
    const ticks: number[] = [];
    const first = Math.ceil(min / interval) * interval;
    for (let t = first; t <= max; t += interval) {
        ticks.push(t);
    }
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
