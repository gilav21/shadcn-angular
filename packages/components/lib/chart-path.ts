/**
 * Chart Path Builders
 * SVG path string builders for line / area charts, plus stacking math.
 *
 * Pure functions, no Angular. Additive to the existing chart utilities.
 */

import type { ChartSeries, StackingMode } from './chart.types';

export interface Point {
    x: number;
    y: number;
}

export type CurveType = 'linear' | 'monotone' | 'step';

export interface StackBand {
    name: string;
    value: number;
    lower: number;
    upper: number;
}

function linearLine(points: Point[]): string {
    const [first, ...rest] = points;
    const head = `M ${first.x} ${first.y}`;
    return rest.reduce((acc, p) => `${acc} L ${p.x} ${p.y}`, head);
}

function stepLine(points: Point[]): string {
    const [first, ...rest] = points;
    let path = `M ${first.x} ${first.y}`;
    let prevY = first.y;
    for (const p of rest) {
        path += ` L ${p.x} ${prevY} L ${p.x} ${p.y}`;
        prevY = p.y;
    }
    return path;
}

function computeSlopes(points: Point[]): number[] {
    const slopes: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        slopes.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
    }
    return slopes;
}

function computeTangents(slopes: number[]): number[] {
    const n = slopes.length + 1;
    const tangents = new Array<number>(n);
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];
    for (let i = 1; i < n - 1; i++) {
        tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
    for (let i = 0; i < slopes.length; i++) {
        if (slopes[i] === 0) {
            tangents[i] = 0;
            tangents[i + 1] = 0;
        } else {
            const a = tangents[i] / slopes[i];
            const b = tangents[i + 1] / slopes[i];
            const h = Math.hypot(a, b);
            if (h > 3) {
                const tau = 3 / h;
                tangents[i] = tau * a * slopes[i];
                tangents[i + 1] = tau * b * slopes[i];
            }
        }
    }
    return tangents;
}

function monotoneLine(points: Point[]): string {
    if (points.length === 2) return linearLine(points);
    const tangents = computeTangents(computeSlopes(points));
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const dx = (p1.x - p0.x) / 3;
        const c1x = p0.x + dx;
        const c1y = p0.y + tangents[i] * dx;
        const c2x = p1.x - dx;
        const c2y = p1.y - tangents[i + 1] * dx;
        path += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p1.x} ${p1.y}`;
    }
    return path;
}

/**
 * Splits `items` into maximal runs of consecutive entries that satisfy `usable`.
 * A non-finite point never reaches an SVG attribute: it ends the current run,
 * which is how a missing value becomes a gap.
 */
function runsOf<T>(items: T[], usable: (item: T) => boolean): T[][] {
    const runs: T[][] = [];
    let current: T[] = [];
    for (const item of items) {
        if (usable(item)) {
            current.push(item);
        } else if (current.length > 0) {
            runs.push(current);
            current = [];
        }
    }
    if (current.length > 0) runs.push(current);
    return runs;
}

const isFinitePoint = (p: Point): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

function runLine(points: Point[], curve: CurveType): string {
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (curve === 'step') return stepLine(points);
    if (curve === 'monotone') return monotoneLine(points);
    return linearLine(points);
}

/**
 * Build an SVG path for a poly-line with the given curve interpolation. A
 * point with a non-finite coordinate breaks the line: each run of finite
 * points is its own sub-path.
 */
export function linePath(points: Point[], curve: CurveType = 'linear'): string {
    return runsOf(points, isFinitePoint).map(run => runLine(run, curve)).join(' ');
}

/** Build a closed SVG area path filled down to a baseline; each run of finite points closes separately. */
export function areaPath(points: Point[], baselineY: number, curve: CurveType = 'linear'): string {
    return runsOf(points, isFinitePoint)
        .map(run => `${runLine(run, curve)} L ${(run.at(-1) ?? run[0]).x} ${baselineY} L ${run[0].x} ${baselineY} Z`)
        .join(' ');
}

/**
 * Build a closed area path between an upper and lower poly-line (stacked area).
 * The upper edge uses the requested curve; the lower edge is traversed in
 * reverse with straight segments to enclose the band.
 */
export function bandAreaPath(upper: Point[], lower: Point[], curve: CurveType = 'linear'): string {
    const indices = Array.from({ length: Math.min(upper.length, lower.length) }, (_, i) => i);
    // A band breaks where either edge has a non-finite point.
    return runsOf(indices, i => isFinitePoint(upper[i]) && isFinitePoint(lower[i]))
        .map(run => {
            const top = runLine(run.map(i => upper[i]), curve);
            const lowerEdge = run.map(i => lower[i]).reverse().reduce((acc, p) => `${acc} L ${p.x} ${p.y}`, '');
            return `${top}${lowerEdge} Z`;
        })
        .join(' ');
}

/** A missing or non-finite value stacks as 0. */
export function finiteOrZero(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Compute cumulative stacking bands per series and category. */
export function stackSeries(series: ChartSeries[], mode: StackingMode = 'absolute'): StackBand[][] {
    const result: StackBand[][] = series.map(() => []);
    const categoryCount = series[0]?.data.length ?? 0;

    for (let c = 0; c < categoryCount; c++) {
        const total = series.reduce((sum, s) => sum + finiteOrZero(s.data[c]?.value), 0);
        const factor = mode === 'percent' && total !== 0 ? 100 / total : 1;
        let cumulative = 0;
        for (let s = 0; s < series.length; s++) {
            const point = series[s].data[c];
            const value = finiteOrZero(point?.value);
            result[s].push({
                name: point?.name ?? '',
                value,
                lower: cumulative * factor,
                upper: (cumulative + value) * factor,
            });
            cumulative += value;
        }
    }
    return result;
}
