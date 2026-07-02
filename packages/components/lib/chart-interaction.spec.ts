import { describe, it, expect } from 'vitest';
import {
    nearestPointX,
    nearestPoint2D,
    getClientPoint,
    pointerToSvg,
} from './chart-interaction';

describe('nearestPointX', () => {
    const points = [
        { x: 0, datum: 'a' },
        { x: 50, datum: 'b' },
        { x: 100, datum: 'c' },
    ];

    it('returns null for an empty set', () => {
        expect(nearestPointX(10, [])).toBeNull();
    });

    it('finds the point closest to the pointer x', () => {
        expect(nearestPointX(48, points)).toMatchObject({ index: 1, point: { datum: 'b' } });
    });

    it('clamps to the first point when the pointer is left of all points', () => {
        expect(nearestPointX(-20, points)?.index).toBe(0);
    });

    it('clamps to the last point when the pointer is right of all points', () => {
        expect(nearestPointX(200, points)?.index).toBe(2);
    });
});

describe('nearestPoint2D', () => {
    const points = [
        { x: 0, y: 0, datum: 'a' },
        { x: 10, y: 10, datum: 'b' },
        { x: 100, y: 100, datum: 'c' },
    ];

    it('returns null for an empty set', () => {
        expect(nearestPoint2D({ x: 1, y: 1 }, [])).toBeNull();
    });

    it('finds the euclidean-nearest point', () => {
        expect(nearestPoint2D({ x: 9, y: 11 }, points)).toMatchObject({ index: 1 });
    });
});

describe('getClientPoint', () => {
    it('reads clientX/clientY from a mouse event', () => {
        const evt = { clientX: 30, clientY: 40 } as MouseEvent;
        expect(getClientPoint(evt)).toEqual({ clientX: 30, clientY: 40 });
    });

    it('reads the first touch from a touch event', () => {
        const evt = { touches: [{ clientX: 7, clientY: 9 }] } as unknown as TouchEvent;
        expect(getClientPoint(evt)).toEqual({ clientX: 7, clientY: 9 });
    });

    it('falls back to changedTouches on touchend', () => {
        const evt = { touches: [], changedTouches: [{ clientX: 3, clientY: 5 }] } as unknown as TouchEvent;
        expect(getClientPoint(evt)).toEqual({ clientX: 3, clientY: 5 });
    });
});

describe('pointerToSvg', () => {
    function fakeSvg(rect: { left: number; top: number; width: number; height: number }, viewBoxW = 0, viewBoxH = 0): SVGSVGElement {
        return {
            getBoundingClientRect: () => rect,
            viewBox: { baseVal: { width: viewBoxW, height: viewBoxH } },
        } as unknown as SVGSVGElement;
    }

    it('subtracts the element offset when there is no viewBox', () => {
        const svg = fakeSvg({ left: 100, top: 50, width: 200, height: 100 });
        const evt = { clientX: 130, clientY: 70 } as MouseEvent;
        expect(pointerToSvg(evt, svg)).toEqual({ x: 30, y: 20 });
    });

    it('scales client coords into viewBox units', () => {
        const svg = fakeSvg({ left: 0, top: 0, width: 200, height: 100 }, 400, 200);
        const evt = { clientX: 100, clientY: 50 } as MouseEvent;
        expect(pointerToSvg(evt, svg)).toEqual({ x: 200, y: 100 });
    });
});
