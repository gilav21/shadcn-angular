import { describe, it, expect } from 'vitest';
import {
    linearScale,
    timeScale,
    bandScale,
    sizeScale,
    niceDomain,
    niceTimeTicks,
    sequentialColorScale,
    toEpochMs,
} from './chart-scale';

describe('linearScale', () => {
    it('maps the domain start/end to the range start/end', () => {
        const s = linearScale([0, 100], [0, 500]);
        expect(s.scale(0)).toBe(0);
        expect(s.scale(100)).toBe(500);
    });

    it('maps an interior value proportionally', () => {
        const s = linearScale([0, 100], [0, 500]);
        expect(s.scale(50)).toBe(250);
    });

    it('supports an inverted (descending) pixel range for y-axes', () => {
        const s = linearScale([0, 10], [200, 0]);
        expect(s.scale(0)).toBe(200);
        expect(s.scale(10)).toBe(0);
        expect(s.scale(5)).toBe(100);
    });

    it('inverts pixels back to domain values', () => {
        const s = linearScale([0, 100], [0, 500]);
        expect(s.invert(250)).toBe(50);
    });

    it('does not divide by zero on a degenerate domain', () => {
        const s = linearScale([5, 5], [0, 500]);
        expect(Number.isFinite(s.scale(5))).toBe(true);
    });

    it('produces nice ticks within the domain', () => {
        const s = linearScale([0, 100], [0, 500]);
        expect(s.ticks(5)).toEqual([0, 20, 40, 60, 80, 100]);
    });
});

describe('niceDomain', () => {
    it('rounds the domain outward to nice bounds', () => {
        expect(niceDomain(3, 97, 5)).toEqual([0, 100]);
    });

    it('keeps already-nice bounds unchanged', () => {
        expect(niceDomain(0, 100, 5)).toEqual([0, 100]);
    });

    it('handles a flat domain without collapsing to a single point', () => {
        const [min, max] = niceDomain(42, 42, 5);
        expect(max).toBeGreaterThan(min);
    });
});

describe('bandScale', () => {
    it('places evenly spaced bands with no padding', () => {
        const b = bandScale(['a', 'b', 'c'], [0, 300]);
        expect(b.bandwidth).toBeCloseTo(100, 5);
        expect(b.position('a')).toBeCloseTo(0, 5);
        expect(b.position('b')).toBeCloseTo(100, 5);
        expect(b.position('c')).toBeCloseTo(200, 5);
    });

    it('reduces bandwidth when inner padding is applied', () => {
        const b = bandScale(['a', 'b'], [0, 200], 0.5);
        expect(b.bandwidth).toBeLessThan(100);
    });

    it('returns undefined position for an unknown key', () => {
        const b = bandScale(['a'], [0, 100]);
        expect(b.position('z')).toBeUndefined();
    });
});

describe('sizeScale', () => {
    it('maps the domain extremes to the radius extremes', () => {
        const s = sizeScale([0, 100], [2, 20]);
        expect(s.radius(0)).toBeCloseTo(2, 5);
        expect(s.radius(100)).toBeCloseTo(20, 5);
    });

    it('uses a sqrt (area-proportional) mapping, not linear', () => {
        const s = sizeScale([0, 100], [0, 10]);
        // linear midpoint would be 5; sqrt makes 50 map above the linear midpoint
        expect(s.radius(50)).toBeGreaterThan(5);
    });
});

describe('toEpochMs', () => {
    it('passes through a number unchanged', () => {
        expect(toEpochMs(1719500000000)).toBe(1719500000000);
    });

    it('converts a Date to epoch milliseconds', () => {
        const d = new Date('2026-06-28T00:00:00.000Z');
        expect(toEpochMs(d)).toBe(d.getTime());
    });
});

describe('timeScale', () => {
    it('maps the time domain to the pixel range', () => {
        const start = new Date('2026-01-01T00:00:00Z').getTime();
        const end = new Date('2026-01-02T00:00:00Z').getTime();
        const s = timeScale([start, end], [0, 240]);
        expect(s.scale(start)).toBeCloseTo(0, 5);
        expect(s.scale(end)).toBeCloseTo(240, 5);
    });

    it('accepts Date inputs via toEpochMs at the boundary', () => {
        const start = new Date('2026-01-01T00:00:00Z');
        const end = new Date('2026-01-02T00:00:00Z');
        const s = timeScale([start, end], [0, 240]);
        expect(s.scale(new Date('2026-01-01T12:00:00Z'))).toBeCloseTo(120, 5);
    });
});

describe('niceTimeTicks', () => {
    it('returns ascending tick timestamps spanning the domain', () => {
        const start = new Date('2026-01-01T00:00:00Z').getTime();
        const end = new Date('2026-01-08T00:00:00Z').getTime();
        const ticks = niceTimeTicks(start, end, 7);
        expect(ticks.length).toBeGreaterThan(1);
        for (let i = 1; i < ticks.length; i++) {
            expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
        }
    });
});

describe('sequentialColorScale', () => {
    it('returns the endpoints at the domain bounds', () => {
        const c = sequentialColorScale([0, 100], ['hsl(200, 80%, 90%)', 'hsl(200, 80%, 30%)']);
        expect(c(0)).toBe('hsl(200, 80%, 90%)');
        expect(c(100)).toBe('hsl(200, 80%, 30%)');
    });

    it('interpolates to an intermediate color at the midpoint', () => {
        const c = sequentialColorScale([0, 100], ['hsl(200, 80%, 90%)', 'hsl(200, 80%, 30%)']);
        expect(c(50)).toBe('hsl(200, 80%, 60%)');
    });

    it('clamps values outside the domain to the endpoints', () => {
        const c = sequentialColorScale([0, 100], ['hsl(200, 80%, 90%)', 'hsl(200, 80%, 30%)']);
        expect(c(-50)).toBe('hsl(200, 80%, 90%)');
        expect(c(150)).toBe('hsl(200, 80%, 30%)');
    });
});
