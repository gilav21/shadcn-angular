// The minimap's geometry — `specs/node-editor-addons-spec.md` §3.
//
// Pure, because "where does a world point land on the map" is exactly the sort
// of thing that is easy to get subtly wrong and impossible to check by looking
// at a 140px thumbnail.
import { describe, it, expect } from 'vitest';
import {
    MIN_VIEWPORT_SIZE,
    contentBounds,
    coverage,
    fitTransform,
    grabbableRect,
    rectToMinimap,
    toMinimap,
    toWorld,
} from './node-editor-minimap.utils';
import type { EditorNode } from '../..';

function node(id: string, x: number, y: number, w = 100, h = 60): EditorNode {
    return { id, x, y, width: w, height: h };
}

describe('contentBounds', () => {
    it('is null with no nodes, so the caller decides what to show', () => {
        expect(contentBounds([])).toBeNull();
    });

    it('covers every node', () => {
        expect(contentBounds([node('a', 0, 0), node('b', 200, 100)]))
            .toEqual({ x: 0, y: 0, width: 300, height: 160 });
    });

    it('handles negative coordinates — the plane is infinite in both directions', () => {
        expect(contentBounds([node('a', -200, -100), node('b', 0, 0)]))
            .toEqual({ x: -200, y: -100, width: 300, height: 160 });
    });
});

describe('coverage — content AND viewport', () => {
    /**
     * The case this exists for: pan away from every node. A content-only
     * minimap would show the graph filling the box while the viewport sat off
     * the edge — losing the map at the exact moment it is most needed.
     */
    it('grows to include a viewport that has left the content', () => {
        const area = coverage([node('a', 0, 0)], { x: 1000, y: 800, width: 400, height: 300 });
        expect(area).toEqual({ x: 0, y: 0, width: 1400, height: 1100 });
    });

    it('is just the content when the viewport is inside it', () => {
        const area = coverage(
            [node('a', 0, 0, 1000, 1000)],
            { x: 100, y: 100, width: 200, height: 200 },
        );
        expect(area).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
    });

    it('falls back to the viewport for an empty graph', () => {
        const viewport = { x: 0, y: 0, width: 400, height: 300 };
        expect(coverage([], viewport)).toEqual(viewport);
    });

    it('is null when there is neither', () => {
        expect(coverage([], null)).toBeNull();
    });
});

describe('fitTransform', () => {
    /**
     * Uniform scale on both axes. Stretching to fill the box would
     * misrepresent the shape of the graph, which is the only thing a minimap
     * is for.
     */
    it('uses ONE scale for both axes', () => {
        const t = fitTransform({ x: 0, y: 0, width: 1000, height: 100 }, 200, 140, 0);
        // Width is the constraint: 200/1000 = 0.2, not 140/100 = 1.4.
        expect(t.scale).toBeCloseTo(0.2, 5);
    });

    it('centres the content in the box', () => {
        const t = fitTransform({ x: 0, y: 0, width: 100, height: 100 }, 200, 100, 0);
        const topLeft = toMinimap({ x: 0, y: 0 }, t);
        const bottomRight = toMinimap({ x: 100, y: 100 }, t);
        // Equal gaps left and right.
        expect(topLeft.x).toBeCloseTo(200 - bottomRight.x, 5);
    });

    it('honours padding, so a node on the edge is not clipped', () => {
        const t = fitTransform({ x: 0, y: 0, width: 100, height: 100 }, 120, 120, 10);
        expect(toMinimap({ x: 0, y: 0 }, t).x).toBeGreaterThanOrEqual(10);
        expect(toMinimap({ x: 100, y: 100 }, t).x).toBeLessThanOrEqual(110);
    });

    it('survives an empty area rather than dividing by zero', () => {
        const t = fitTransform(null, 200, 140);
        expect(Number.isFinite(t.scale)).toBe(true);
        expect(t.scale).toBeGreaterThan(0);
    });

    it('survives a zero-sized area', () => {
        const t = fitTransform({ x: 0, y: 0, width: 0, height: 0 }, 200, 140);
        expect(Number.isFinite(t.scale)).toBe(true);
    });
});

describe('toMinimap and toWorld are inverses', () => {
    /** They must be, or clicking the map navigates somewhere else. */
    it('round-trips a world point', () => {
        const t = fitTransform({ x: -100, y: 50, width: 800, height: 600 }, 200, 140);
        for (const point of [{ x: -100, y: 50 }, { x: 300, y: 200 }, { x: 700, y: 650 }]) {
            const back = toWorld(toMinimap(point, t), t);
            expect(back.x).toBeCloseTo(point.x, 4);
            expect(back.y).toBeCloseTo(point.y, 4);
        }
    });

    it('projects a rect', () => {
        const t = fitTransform({ x: 0, y: 0, width: 100, height: 100 }, 100, 100, 0);
        expect(rectToMinimap({ x: 10, y: 20, width: 30, height: 40 }, t))
            .toEqual({ x: 10, y: 20, width: 30, height: 40 });
    });
});

describe('grabbableRect', () => {
    /**
     * Zoom far into a large graph and the true viewport rectangle is a couple
     * of pixels — visible, but impossible to grab, and worse with a finger.
     */
    it('enlarges a rectangle that is too small to grab', () => {
        const box = grabbableRect({ x: 50, y: 50, width: 2, height: 1 });
        expect(box.width).toBe(MIN_VIEWPORT_SIZE);
        expect(box.height).toBe(MIN_VIEWPORT_SIZE);
    });

    it('grows about its own centre, so it still points at the right place', () => {
        const original = { x: 50, y: 50, width: 2, height: 2 };
        const box = grabbableRect(original);
        expect(box.x + box.width / 2).toBeCloseTo(original.x + original.width / 2, 5);
        expect(box.y + box.height / 2).toBeCloseTo(original.y + original.height / 2, 5);
    });

    it('leaves a rectangle that is already big enough alone', () => {
        const original = { x: 0, y: 0, width: 40, height: 30 };
        expect(grabbableRect(original)).toEqual(original);
    });

    it('is at least a WCAG-adjacent size, not a hairline', () => {
        expect(MIN_VIEWPORT_SIZE).toBeGreaterThanOrEqual(12);
    });
});
