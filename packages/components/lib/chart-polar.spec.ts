import { describe, it, expect } from 'vitest';
import { radarPoint, polygonPath } from './chart-polar';

describe('radarPoint', () => {
    it('places the first axis straight up from the center', () => {
        const p = radarPoint(100, 100, 50, 0, 4, 10, 10);
        expect(p.x).toBeCloseTo(100, 5);
        expect(p.y).toBeCloseTo(50, 5); // full value -> radius 50 above center
    });

    it('scales the radius by value / maxValue', () => {
        const full = radarPoint(0, 0, 100, 0, 4, 10, 10);
        const half = radarPoint(0, 0, 100, 0, 4, 5, 10);
        expect(Math.hypot(full.x, full.y)).toBeCloseTo(100, 5);
        expect(Math.hypot(half.x, half.y)).toBeCloseTo(50, 5);
    });

    it('distributes axes evenly around the circle', () => {
        // axis 1 of 4 is to the right (90 degrees clockwise from up)
        const p = radarPoint(0, 0, 50, 1, 4, 10, 10);
        expect(p.x).toBeCloseTo(50, 5);
        expect(p.y).toBeCloseTo(0, 5);
    });
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
