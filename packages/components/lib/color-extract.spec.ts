import { describe, it, expect } from 'vitest';
import { quantizePixels } from './color-extract';
import type { RGBA } from './color';

function mix(r: number, g: number, b: number, count: number): RGBA[] {
    return Array.from({ length: count }, () => ({ r, g, b, a: 1 }));
}

function nearest(palette: RGBA[], target: RGBA): RGBA {
    let best = palette[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const c of palette) {
        const d = (c.r - target.r) ** 2 + (c.g - target.g) ** 2 + (c.b - target.b) ** 2;
        if (d < bestDist) {
            bestDist = d;
            best = c;
        }
    }
    return best;
}

function rgbClose(a: RGBA, b: RGBA, tolerance: number): void {
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(tolerance);
}

describe('quantizePixels — median-cut', () => {
    it('returns 1 color for a single-color image', () => {
        const palette = quantizePixels(mix(200, 50, 50, 100), { count: 3, algorithm: 'median-cut' });
        expect(palette.length).toBeGreaterThanOrEqual(1);
        rgbClose(palette[0], { r: 200, g: 50, b: 50, a: 1 }, 5);
    });

    it('separates dominant colors from a 2-color mix', () => {
        const pixels = [
            ...mix(255, 0, 0, 100),
            ...mix(0, 0, 255, 100),
        ];
        const palette = quantizePixels(pixels, { count: 2, algorithm: 'median-cut' });
        expect(palette).toHaveLength(2);
        rgbClose(nearest(palette, { r: 255, g: 0, b: 0, a: 1 }), { r: 255, g: 0, b: 0, a: 1 }, 5);
        rgbClose(nearest(palette, { r: 0, g: 0, b: 255, a: 1 }), { r: 0, g: 0, b: 255, a: 1 }, 5);
    });

    it('returns up to `count` colors from a 3-color mix', () => {
        const pixels = [
            ...mix(255, 0, 0, 60),
            ...mix(0, 255, 0, 60),
            ...mix(0, 0, 255, 60),
        ];
        const palette = quantizePixels(pixels, { count: 3, algorithm: 'median-cut' });
        expect(palette).toHaveLength(3);
        rgbClose(nearest(palette, { r: 255, g: 0, b: 0, a: 1 }), { r: 255, g: 0, b: 0, a: 1 }, 5);
        rgbClose(nearest(palette, { r: 0, g: 255, b: 0, a: 1 }), { r: 0, g: 255, b: 0, a: 1 }, 5);
        rgbClose(nearest(palette, { r: 0, g: 0, b: 255, a: 1 }), { r: 0, g: 0, b: 255, a: 1 }, 5);
    });

    it('returns empty array for empty input', () => {
        expect(quantizePixels([], { count: 3 })).toEqual([]);
    });
});

describe('quantizePixels — k-means', () => {
    it('separates dominant colors from a 2-color mix', () => {
        const pixels = [
            ...mix(255, 0, 0, 200),
            ...mix(0, 0, 255, 200),
        ];
        const palette = quantizePixels(pixels, { count: 2, algorithm: 'k-means' });
        expect(palette).toHaveLength(2);
        rgbClose(nearest(palette, { r: 255, g: 0, b: 0, a: 1 }), { r: 255, g: 0, b: 0, a: 1 }, 10);
        rgbClose(nearest(palette, { r: 0, g: 0, b: 255, a: 1 }), { r: 0, g: 0, b: 255, a: 1 }, 10);
    });

    it('returns single average for count=1', () => {
        const palette = quantizePixels(mix(100, 100, 100, 50), { count: 1, algorithm: 'k-means' });
        expect(palette).toHaveLength(1);
        rgbClose(palette[0], { r: 100, g: 100, b: 100, a: 1 }, 5);
    });
});

describe('quantizePixels — ignoreBackground', () => {
    it('filters out near-white and near-black pixels', () => {
        const pixels = [
            ...mix(255, 255, 255, 1000),  // background
            ...mix(0, 0, 0, 1000),         // background
            ...mix(200, 100, 50, 100),    // foreground
        ];
        const palette = quantizePixels(pixels, { count: 1, algorithm: 'median-cut', ignoreBackground: true });
        rgbClose(palette[0], { r: 200, g: 100, b: 50, a: 1 }, 5);
    });
});
