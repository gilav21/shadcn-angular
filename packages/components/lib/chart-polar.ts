/**
 * Polar Chart Helpers
 * Radial point placement and polygon paths for radar charts.
 *
 * Pure functions, no Angular. Complements the existing polar helpers in
 * chart.utils.ts (polarToCartesian / describeArc) without modifying them.
 */

import { polarToCartesian } from './chart.utils';

/**
 * Place a radar vertex for `axisIndex` of `axisCount`, at a radius scaled by
 * `value / maxValue`. The first axis points straight up; axes are evenly
 * distributed clockwise.
 */
export function radarPoint(
    centerX: number,
    centerY: number,
    radius: number,
    axisIndex: number,
    axisCount: number,
    value: number,
    maxValue: number,
): { x: number; y: number } {
    const ratio = maxValue === 0 ? 0 : value / maxValue;
    const angle = -Math.PI / 2 + (axisIndex / axisCount) * Math.PI * 2;
    return polarToCartesian(centerX, centerY, radius * ratio, angle);
}

/** Build a closed SVG polygon path through the given points. */
export function polygonPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    const [first, ...rest] = points;
    const head = `M ${first.x} ${first.y}`;
    const body = rest.reduce((acc, p) => `${acc} L ${p.x} ${p.y}`, head);
    return `${body} Z`;
}
