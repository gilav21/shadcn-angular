import { describe, it, expect } from 'vitest';
import { linePath, areaPath, bandAreaPath, stackSeries } from './chart-path';
import type { ChartSeries } from './chart.types';

describe('linePath', () => {
    it('returns an empty string for no points', () => {
        expect(linePath([], 'linear')).toBe('');
    });

    it('returns a single moveto for one point', () => {
        expect(linePath([{ x: 5, y: 10 }], 'linear')).toBe('M 5 10');
    });

    it('draws straight segments between linear points', () => {
        expect(linePath([{ x: 0, y: 0 }, { x: 10, y: 10 }], 'linear')).toBe('M 0 0 L 10 10');
    });

    it('emits cubic bezier commands for monotone curves', () => {
        const path = linePath([{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }], 'monotone');
        expect(path.startsWith('M 0 0')).toBe(true);
        expect(path).toContain('C');
    });

    it('emits stepped segments for step curves', () => {
        const path = linePath([{ x: 0, y: 0 }, { x: 10, y: 10 }], 'step');
        // step goes horizontally to the next x at the current y, then vertically
        expect(path).toContain('L 10 0');
        expect(path).toContain('L 10 10');
    });
});

describe('areaPath', () => {
    it('returns an empty string for no points', () => {
        expect(areaPath([], 100, 'linear')).toBe('');
    });

    it('closes the path back down to the baseline', () => {
        const path = areaPath([{ x: 0, y: 20 }, { x: 10, y: 30 }], 100, 'linear');
        expect(path.startsWith('M 0 20')).toBe(true);
        expect(path).toContain('100'); // baseline y appears
        expect(path.trim().endsWith('Z')).toBe(true);
    });
});

describe('bandAreaPath', () => {
    const upper = [{ x: 0, y: 10 }, { x: 10, y: 20 }];
    const lower = [{ x: 0, y: 40 }, { x: 10, y: 30 }];

    it('returns an empty string when there are no points', () => {
        expect(bandAreaPath([], [], 'linear')).toBe('');
    });

    it('starts at the first upper point and closes the band', () => {
        const path = bandAreaPath(upper, lower, 'linear');
        expect(path.startsWith('M 0 10')).toBe(true);
        expect(path.trim().endsWith('Z')).toBe(true);
    });

    it('traverses the lower edge in reverse to enclose the area', () => {
        const path = bandAreaPath(upper, lower, 'linear');
        // after the top edge it must reach the last lower point then walk back
        expect(path).toContain('L 10 30');
        expect(path).toContain('L 0 40');
    });
});

describe('stackSeries', () => {
    const series: ChartSeries[] = [
        { name: 'A', data: [{ name: 'q1', value: 10 }, { name: 'q2', value: 5 }] },
        { name: 'B', data: [{ name: 'q1', value: 20 }, { name: 'q2', value: 15 }] },
    ];

    it('stacks absolute values cumulatively per category', () => {
        const stacked = stackSeries(series, 'absolute');
        expect(stacked[0][0]).toMatchObject({ lower: 0, upper: 10 });
        expect(stacked[1][0]).toMatchObject({ lower: 10, upper: 30 });
        expect(stacked[0][1]).toMatchObject({ lower: 0, upper: 5 });
        expect(stacked[1][1]).toMatchObject({ lower: 5, upper: 20 });
    });

    it('normalizes to 100 per category in percent mode', () => {
        const stacked = stackSeries(series, 'percent');
        expect(stacked[1][0].upper).toBeCloseTo(100, 5);
        expect(stacked[0][0].upper).toBeCloseTo((10 / 30) * 100, 5);
    });

    it('preserves the original value alongside the band', () => {
        const stacked = stackSeries(series, 'absolute');
        expect(stacked[0][0].value).toBe(10);
        expect(stacked[0][0].name).toBe('q1');
    });
});
