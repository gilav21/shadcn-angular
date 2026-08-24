// Signature strokes — `specs/form-controls-small-spec.md` T-4, UC-6, R-4.
import { describe, it, expect } from 'vitest';
import {
    MIN_POINT_DISTANCE,
    clampUnit,
    isEmpty,
    isFarEnough,
    normalisePoint,
    strokePath,
    strokesToSvg,
    type Stroke,
} from './signature-pad.strokes';

describe('normalising a position', () => {
    it('turns a position into a fraction of the pad', () => {
        expect(normalisePoint(50, 25, 100, 100)).toEqual({ x: 0.5, y: 0.25 });
    });

    /**
     * R-4: the point of normalising is that the same mark means the same thing
     * at any size, so the same position in two differently-sized pads has to
     * produce the same coordinate.
     */
    it('produces the same coordinate for the same relative position', () => {
        expect(normalisePoint(50, 50, 100, 100)).toEqual(normalisePoint(200, 200, 400, 400));
    });

    it('keeps a point that left the pad inside it', () => {
        expect(normalisePoint(150, -20, 100, 100)).toEqual({ x: 1, y: 0 });
    });

    /** A pad that has not been laid out yet has no coordinate space. */
    it('survives a pad with no size', () => {
        expect(normalisePoint(10, 10, 0, 0)).toEqual({ x: 0, y: 0 });
    });

    it('clamps to the unit range', () => {
        expect(clampUnit(-1)).toBe(0);
        expect(clampUnit(2)).toBe(1);
        expect(clampUnit(0.5)).toBe(0.5);
        expect(clampUnit(Number.NaN)).toBe(0);
    });
});

describe('thinning the points', () => {
    it('always keeps the first point of a stroke', () => {
        expect(isFarEnough(undefined, { x: 0.5, y: 0.5 })).toBe(true);
    });

    /** A pointer emits events far faster than a hand moves. */
    it('drops a point on top of the previous one', () => {
        expect(isFarEnough({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(false);
    });

    it('keeps a point that moved far enough', () => {
        const previous = { x: 0.5, y: 0.5 };
        const moved = { x: 0.5 + MIN_POINT_DISTANCE * 2, y: 0.5 };
        expect(isFarEnough(previous, moved)).toBe(true);
    });
});

describe('drawing a stroke', () => {
    it('draws nothing for no points', () => {
        expect(strokePath([], 100, 100)).toBe('');
    });

    /** A signature has dots in it: the dot of an i, a full stop. */
    it('draws a single point as a dot', () => {
        expect(strokePath([{ x: 0.5, y: 0.5 }], 100, 100)).toBe('M50,50L50,50');
    });

    it('draws two points as a line', () => {
        const stroke: Stroke = [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        ];
        expect(strokePath(stroke, 100, 100)).toBe('M0,0L100,100');
    });

    /**
     * Joining raw points with straight lines makes a hand-drawn line faceted,
     * because every corner lands on a sample. Curving through the midpoints
     * puts the samples on the curve instead.
     */
    it('curves through the midpoints', () => {
        const stroke: Stroke = [
            { x: 0, y: 0 },
            { x: 0.5, y: 0 },
            { x: 1, y: 0 },
        ];
        expect(strokePath(stroke, 100, 100)).toContain('Q50,0 75,0');
    });

    it('scales with the box it is drawn into', () => {
        const stroke: Stroke = [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        ];
        expect(strokePath(stroke, 200, 50)).toBe('M0,0L200,50');
    });

    it('rounds to two decimal places rather than emitting float noise', () => {
        const path = strokePath([{ x: 1 / 3, y: 1 / 3 }], 100, 100);
        expect(path).toBe('M33.33,33.33L33.33,33.33');
    });
});

describe('knowing whether anything was drawn', () => {
    it('is empty with no strokes', () => {
        expect(isEmpty([])).toBe(true);
    });

    it('is empty when every stroke is', () => {
        expect(isEmpty([[], []])).toBe(true);
    });

    it('is not empty once a point exists', () => {
        expect(isEmpty([[{ x: 0.5, y: 0.5 }]])).toBe(false);
    });
});

describe('the SVG form', () => {
    const stroke: Stroke = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
    ];

    it('draws one path per stroke', () => {
        const svg = strokesToSvg([stroke, stroke], 100, 100, '#000', 2);
        expect(svg.match(/<path/g)).toHaveLength(2);
    });

    it('skips strokes with nothing in them', () => {
        const svg = strokesToSvg([stroke, []], 100, 100, '#000', 2);
        expect(svg.match(/<path/g)).toHaveLength(1);
    });

    it('carries the pen through to the stroke attributes', () => {
        const svg = strokesToSvg([stroke], 100, 100, '#112233', 3);
        expect(svg).toContain('stroke="#112233"');
        expect(svg).toContain('stroke-width="3"');
        expect(svg).toContain('stroke-linecap="round"');
    });

    it('carries the size through to the viewBox', () => {
        expect(strokesToSvg([stroke], 300, 120, '#000', 2)).toContain('viewBox="0 0 300 120"');
    });

    it('is a parseable SVG document', () => {
        const svg = strokesToSvg([stroke], 100, 100, '#000', 2);
        const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');

        expect(parsed.querySelector('parsererror')).toBeNull();
        expect(parsed.documentElement.tagName).toBe('svg');
    });
});
