/**
 * Chart colour scales.
 *
 * Kept apart from `chart-scale.ts`: this needs the colour parser in
 * `color.ts`, which the cartesian charts that only use numeric scales should
 * not have to ship.
 */

import { parseColor, rgbToHslExact, type HSL } from './color';

function toHsl(color: string): HSL | null {
    const rgba = parseColor(color);
    return rgba ? rgbToHslExact(rgba) : null;
}

/** Degrees wrapped into `[0, 360)`. */
function wrapHue(degrees: number): number {
    return ((degrees % 360) + 360) % 360;
}

/**
 * Hue to travel along between two endpoints, in degrees (`-180 < d <= 180`):
 * the shorter arc, and for exactly opposite hues the increasing one so the
 * ramp does not depend on which way the arithmetic happens to fall.
 */
function shorterArc(fromHue: number, toHue: number): number {
    const forward = wrapHue(toHue - fromHue);
    return forward > 180 ? forward - 360 : forward;
}

function blend(from: HSL, to: HSL, t: number): string {
    // A grey has no hue of its own; borrowing the other endpoint's keeps the
    // ramp from swinging through hues neither endpoint has.
    const fromHue = from.s === 0 ? to.h : from.h;
    const toHue = to.s === 0 ? from.h : to.h;
    const h = Math.round(wrapHue(fromHue + shorterArc(fromHue, toHue) * t)) % 360;
    const s = Math.round(from.s + (to.s - from.s) * t);
    const l = Math.round(from.l + (to.l - from.l) * t);
    return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Sequential colour scale interpolating in HSL between two endpoint colours.
 * The endpoints may be any colour `parseColor` accepts; hue follows the
 * shorter arc. Interior values are `hsl(h, s%, l%)` strings, the endpoints are
 * returned exactly as given, and when an endpoint cannot be parsed the nearer
 * endpoint string is returned instead of a computed colour.
 */
export function sequentialColorScale(
    domain: [number, number],
    colors: [string, string],
): (value: number) => string {
    const [d0, d1] = domain;
    const span = d1 - d0;
    const from = toHsl(colors[0]);
    const to = toHsl(colors[1]);

    return (value: number): string => {
        const t = span === 0 ? 0 : (value - d0) / span;
        if (t <= 0) return colors[0];
        if (t >= 1) return colors[1];
        if (!from || !to) return t < 0.5 ? colors[0] : colors[1];
        return blend(from, to, t);
    };
}
