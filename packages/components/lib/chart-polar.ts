/**
 * Polar Chart Helpers
 * Radial point placement and polygon paths for radar charts.
 *
 * Pure functions, no Angular. Complements the existing polar helpers in
 * chart.utils.ts (polarToCartesian / describeArc) without modifying them.
 */

import { polarToCartesian } from './chart.utils';

/**
 * Place a radar vertex for `axisIndex` of `axisCount`, at the radius
 * `radius · (value − min) / (max − min)` for the `[min, max]` scale, clamped
 * into `[0, radius]` so the vertex always lies on its own axis ray between the
 * centre and the outer ring: a value below `min` sits at the centre, one above
 * `max` on the ring. A scale of zero width puts every vertex at the centre.
 * The first axis points straight up; axes are evenly distributed clockwise.
 */
export function radarPoint(
    centerX: number,
    centerY: number,
    radius: number,
    axisIndex: number,
    axisCount: number,
    value: number,
    [min, max]: readonly [min: number, max: number],
): { x: number; y: number } {
    const span = max - min;
    const ratio = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0;
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
