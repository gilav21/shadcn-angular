import { describe, it, expect } from 'vitest';
import {
    computeRowRange,
    computeColumnRange,
    computeVariableRowRange,
    buildPrefixSums,
} from './data-table.utils';

describe('computeRowRange', () => {
    it('should return empty range for zero rows', () => {
        const result = computeRowRange(0, 500, 40, 0, 5);
        expect(result).toEqual({ start: 0, end: 0 });
    });

    it('should compute correct range at top of scroll', () => {
        const result = computeRowRange(0, 400, 40, 10000, 5);
        expect(result.start).toBe(0);
        expect(result.end).toBe(15);
    });

    it('should compute correct range at middle of scroll', () => {
        const result = computeRowRange(5000, 400, 40, 10000, 5);
        expect(result.start).toBe(120);
        expect(result.end).toBe(140);
    });

    it('should clamp end to totalRows', () => {
        const result = computeRowRange(39800, 400, 40, 1000, 5);
        expect(result.end).toBe(1000);
    });

    it('should clamp start to 0', () => {
        const result = computeRowRange(50, 400, 40, 10000, 5);
        expect(result.start).toBe(0);
    });

    it('should handle buffer correctly', () => {
        const result = computeRowRange(1000, 400, 40, 10000, 10);
        expect(result.start).toBe(15);
        expect(result.end).toBe(45);
    });

    it('should handle single row', () => {
        const result = computeRowRange(0, 400, 40, 1, 5);
        expect(result.start).toBe(0);
        expect(result.end).toBe(1);
    });
});

describe('computeColumnRange', () => {
    const widths = [100, 150, 200, 120, 80, 300, 100, 150, 200, 120];

    it('should return empty range for no columns', () => {
        const result = computeColumnRange(0, 800, [], 3);
        expect(result).toEqual({ start: 0, end: 0, paddingLeft: 0, paddingRight: 0 });
    });

    it('should compute range at scroll left = 0', () => {
        const result = computeColumnRange(0, 500, widths, 2);
        expect(result.start).toBe(0);
        expect(result.paddingLeft).toBe(0);
    });

    it('should compute range in middle with correct padding', () => {
        const result = computeColumnRange(400, 400, widths, 1);
        expect(result.paddingLeft).toBeGreaterThanOrEqual(0);
        expect(result.paddingRight).toBeGreaterThanOrEqual(0);
        expect(result.start).toBeLessThan(result.end);
    });

    it('should include buffer columns', () => {
        const result = computeColumnRange(300, 200, widths, 2);
        expect(result.start).toBeLessThanOrEqual(1);
    });

    it('should handle all columns visible', () => {
        const result = computeColumnRange(0, 5000, widths, 2);
        expect(result.start).toBe(0);
        expect(result.end).toBe(widths.length);
        expect(result.paddingLeft).toBe(0);
        expect(result.paddingRight).toBe(0);
    });

    it('places the window past the last column when scrolled beyond every column', () => {
        const result = computeColumnRange(100000, 500, widths, 0);
        expect(result.start).toBe(widths.length);
        expect(result.end).toBe(widths.length);
        expect(result.paddingRight).toBe(0);
    });

    it('should compute correct total width', () => {
        const result = computeColumnRange(0, 500, widths, 0);
        const totalWidth = widths.reduce((sum, w) => sum + w, 0);
        const visibleWidth = widths.slice(result.start, result.end).reduce((sum, w) => sum + w, 0);
        expect(result.paddingLeft + visibleWidth + result.paddingRight).toBe(totalWidth);
    });
});

describe('computeVariableRowRange', () => {
    const heights = [40, 100, 200, 50, 80, 1000, 40, 60, 300, 40];

    function getHeight(index: number): number {
        return heights[index] ?? 40;
    }

    it('should return empty range for zero rows', () => {
        const result = computeVariableRowRange(0, 500, getHeight, 0, 5);
        expect(result).toEqual({ start: 0, end: 0, paddingTop: 0, paddingBottom: 0 });
    });

    it('should compute range at top', () => {
        const result = computeVariableRowRange(0, 300, getHeight, 10, 2);
        expect(result.start).toBe(0);
        expect(result.paddingTop).toBe(0);
    });

    it('should compute correct padding', () => {
        const result = computeVariableRowRange(200, 300, getHeight, 10, 0);
        let expectedTop = 0;
        for (let i = 0; i < result.start; i++) {
            expectedTop += getHeight(i);
        }
        expect(result.paddingTop).toBe(expectedTop);
    });

    it('should handle large row heights (1000px)', () => {
        const result = computeVariableRowRange(370, 500, getHeight, 10, 1);
        expect(result.start).toBeLessThanOrEqual(5);
        expect(result.end).toBeGreaterThanOrEqual(5);
    });

    it('should preserve total height', () => {
        const result = computeVariableRowRange(100, 300, getHeight, 10, 2);
        const totalHeight = heights.reduce((sum, h) => sum + h, 0);
        let visibleHeight = 0;
        for (let i = result.start; i < result.end; i++) {
            visibleHeight += getHeight(i);
        }
        expect(result.paddingTop + visibleHeight + result.paddingBottom).toBe(totalHeight);
    });

    it('places the window past the last row when scrolled beyond every row', () => {
        const result = computeVariableRowRange(100000, 300, getHeight, heights.length, 0);
        expect(result.start).toBe(heights.length);
        expect(result.end).toBe(heights.length);
        expect(result.paddingBottom).toBe(0);
    });

    interface Range {
        start: number;
        end: number;
        paddingTop: number;
        paddingBottom: number;
    }

    function expectPrefixRange(
        scrollTop: number,
        viewportHeight: number,
        buffer: number,
        expected: Range,
    ): void {
        const prefixSums = buildPrefixSums(getHeight, heights.length);
        const result = computeVariableRowRange(scrollTop, viewportHeight, getHeight, heights.length, buffer, prefixSums);
        expect(result).toEqual(expected);
    }

    it('windows via prefix sums, extending the end row past a partially visible row', () => {
        expectPrefixRange(0, 300, 2, { start: 0, end: 5, paddingTop: 0, paddingBottom: 1440 });
        expectPrefixRange(200, 300, 1, { start: 1, end: 7, paddingTop: 40, paddingBottom: 400 });
    });

    it('windows via prefix sums without extending when the viewport ends on a row boundary', () => {
        expectPrefixRange(40, 300, 0, { start: 1, end: 3, paddingTop: 40, paddingBottom: 1570 });
    });
});

describe('buildPrefixSums', () => {
    it('builds a cumulative height table with a leading zero', () => {
        const heights = [40, 100, 200];
        const sums = buildPrefixSums((i) => heights[i], heights.length);
        expect(Array.from(sums)).toEqual([0, 40, 140, 340]);
    });
});
