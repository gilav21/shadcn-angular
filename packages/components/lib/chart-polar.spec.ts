import { describe, it, expect } from 'vitest';
import { radarPoint, polygonPath } from './chart-polar';

describe('radarPoint', () => {
    it('places the first axis straight up from the center', () => {
        const p = radarPoint(100, 100, 50, 0, 4, 10, [0, 10]);
        expect(p.x).toBeCloseTo(100, 5);
        expect(p.y).toBeCloseTo(50, 5); // full value -> radius 50 above center
    });

    it('scales the radius by value / maxValue', () => {
        const full = radarPoint(0, 0, 100, 0, 4, 10, [0, 10]);
        const half = radarPoint(0, 0, 100, 0, 4, 5, [0, 10]);
        expect(Math.hypot(full.x, full.y)).toBeCloseTo(100, 5);
        expect(Math.hypot(half.x, half.y)).toBeCloseTo(50, 5);
    });

    it('distributes axes evenly around the circle', () => {
        // axis 1 of 4 is to the right (90 degrees clockwise from up)
        const p = radarPoint(0, 0, 50, 1, 4, 10, [0, 10]);
        expect(p.x).toBeCloseTo(50, 5);
        expect(p.y).toBeCloseTo(0, 5);
    });
});

describe('radarPoint on its own axis', () => {
    const RADIUS = 100;
    const AXES = 5;
    const CASES: { label: string; value: number; lo: number; hi: number; distance: number }[] = [
        { label: 'inside the scale', value: 6, lo: 0, hi: 10, distance: 60 },
        { label: 'negative on a scale that starts below zero', value: -4, lo: -10, hi: 10, distance: 30 },
        { label: 'above the ring', value: 25, lo: 0, hi: 10, distance: 100 },
        { label: 'below the centre', value: -3, lo: 0, hi: 10, distance: 0 },
        { label: 'a scale of zero width', value: 5, lo: 5, hi: 5, distance: 0 },
        { label: 'fractional magnitudes', value: 3e-6, lo: -2e-6, hi: 8e-6, distance: 50 },
    ];

    for (const { label, value, lo, hi, distance } of CASES) {
        it(`keeps a vertex on its ray at R·(v-lo)/(hi-lo), clamped into the ring (${label})`, () => {
            for (let axis = 0; axis < AXES; axis++) {
                const p = radarPoint(200, 150, RADIUS, axis, AXES, value, [lo, hi]);
                const angle = -Math.PI / 2 + (axis / AXES) * Math.PI * 2;

                expect(p.x - 200).toBeCloseTo(distance * Math.cos(angle), 6);
                expect(p.y - 150).toBeCloseTo(distance * Math.sin(angle), 6);
            }
        });
    }
});

describe('polygonPath', () => {
    it('returns an empty string for no points', () => {
        expect(polygonPath([])).toBe('');
    });

    it('builds a closed path through the points', () => {
        const path = polygonPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]);
        expect(path.startsWith('M 0 0')).toBe(true);
        expect(path).toContain('L 10 0');
        expect(path).toContain('L 5 10');
        expect(path.trim().endsWith('Z')).toBe(true);
    });
});
