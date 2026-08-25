import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_ZOOM,
  DEFAULT_MIN_ZOOM,
  boundsOf,
  clampZoom,
  fitView,
  panBy,
  panTo,
  rectsIntersect,
  screenToWorld,
  transformCss,
  visibleWorldRect,
  worldToScreen,
  zoomAbout,
  zoomToLevel,
} from './infinite-canvas.transform';
import type { CanvasViewport } from './infinite-canvas.types';

const LIMITS = { minZoom: DEFAULT_MIN_ZOOM, maxZoom: DEFAULT_MAX_ZOOM };
const SIZE = { width: 200, height: 200 };

/** Round-trip helper: worldToScreen(screenToWorld(p)) must be p. */
function roundTrip(point: { x: number; y: number }, viewport: CanvasViewport): { x: number; y: number } {
  return worldToScreen(screenToWorld(point, viewport), viewport);
}

describe('infinite-canvas transform math (T-10)', () => {
  describe('worldToScreen / screenToWorld', () => {
    it('maps world to screen as world * zoom + pan', () => {
      const viewport: CanvasViewport = { x: 5, y: 7, zoom: 2 };
      expect(worldToScreen({ x: 10, y: 20 }, viewport)).toEqual({ x: 25, y: 47 });
    });

    it('maps screen back to world as (screen - pan) / zoom', () => {
      const viewport: CanvasViewport = { x: 5, y: 7, zoom: 2 };
      expect(screenToWorld({ x: 25, y: 47 }, viewport)).toEqual({ x: 10, y: 20 });
    });

    it('round-trips exactly at the identity viewport', () => {
      const viewport: CanvasViewport = { x: 0, y: 0, zoom: 1 };
      expect(roundTrip({ x: 123.5, y: -44.25 }, viewport)).toEqual({ x: 123.5, y: -44.25 });
    });

    it('round-trips at a fractional zoom with a negative pan', () => {
      const viewport: CanvasViewport = { x: -1234.5, y: 987.25, zoom: 0.37 };
      const result = roundTrip({ x: 42, y: -17 }, viewport);
      expect(result.x).toBeCloseTo(42, 6);
      expect(result.y).toBeCloseTo(-17, 6);
    });

    it('handles world coordinates far from the origin (float-precision edge case R-4)', () => {
      const viewport: CanvasViewport = { x: 0, y: 0, zoom: 1 };
      const far = { x: 1e7, y: -1e7 };
      const result = roundTrip(far, viewport);
      expect(result.x).toBeCloseTo(far.x, 1);
      expect(result.y).toBeCloseTo(far.y, 1);
    });
  });

  describe('clampZoom', () => {
    it('passes an in-range zoom through unchanged', () => {
      expect(clampZoom(1.5, LIMITS)).toBe(1.5);
    });

    it('clamps below the minimum', () => {
      expect(clampZoom(0.0001, LIMITS)).toBe(DEFAULT_MIN_ZOOM);
    });

    it('clamps above the maximum', () => {
      expect(clampZoom(1000, LIMITS)).toBe(DEFAULT_MAX_ZOOM);
    });

    it('falls back to the minimum for a non-finite zoom', () => {
      expect(clampZoom(Number.NaN, LIMITS)).toBe(DEFAULT_MIN_ZOOM);
      expect(clampZoom(Number.POSITIVE_INFINITY, LIMITS)).toBe(DEFAULT_MAX_ZOOM);
    });

    it('survives inverted limits by preferring the minimum', () => {
      expect(clampZoom(5, { minZoom: 4, maxZoom: 2 })).toBe(4);
    });
  });

  describe('zoomAbout', () => {
    it('keeps the world point under the anchor fixed on screen', () => {
      const before: CanvasViewport = { x: 0, y: 0, zoom: 1 };
      const anchor = { x: 100, y: 100 };
      const world = screenToWorld(anchor, before);

      const after = zoomAbout(before, 2, anchor, LIMITS);

      expect(after.zoom).toBe(2);
      const back = worldToScreen(world, after);
      expect(back.x).toBeCloseTo(anchor.x, 6);
      expect(back.y).toBeCloseTo(anchor.y, 6);
    });

    it('keeps the anchor fixed even when the factor is clamped at maxZoom', () => {
      const before: CanvasViewport = { x: 13, y: -7, zoom: 4 };
      const anchor = { x: 321, y: 55 };
      const world = screenToWorld(anchor, before);

      const after = zoomAbout(before, 1000, anchor, LIMITS);

      expect(after.zoom).toBe(DEFAULT_MAX_ZOOM);
      const back = worldToScreen(world, after);
      expect(back.x).toBeCloseTo(anchor.x, 6);
      expect(back.y).toBeCloseTo(anchor.y, 6);
    });

    it('keeps the anchor fixed even when the factor is clamped at minZoom', () => {
      const before: CanvasViewport = { x: 13, y: -7, zoom: 0.1 };
      const anchor = { x: 40, y: 400 };
      const world = screenToWorld(anchor, before);

      const after = zoomAbout(before, 1 / 1000, anchor, LIMITS);

      expect(after.zoom).toBe(DEFAULT_MIN_ZOOM);
      const back = worldToScreen(world, after);
      expect(back.x).toBeCloseTo(anchor.x, 6);
      expect(back.y).toBeCloseTo(anchor.y, 6);
    });

    it('does not mutate the input viewport', () => {
      const before: CanvasViewport = { x: 1, y: 2, zoom: 1 };
      zoomAbout(before, 2, { x: 0, y: 0 }, LIMITS);
      expect(before).toEqual({ x: 1, y: 2, zoom: 1 });
    });
  });

  describe('zoomToLevel', () => {
    it('zooms about the centre of the viewport', () => {
      const before: CanvasViewport = { x: 0, y: 0, zoom: 1 };
      const centre = { x: SIZE.width / 2, y: SIZE.height / 2 };
      const world = screenToWorld(centre, before);

      const after = zoomToLevel(before, 4, SIZE, LIMITS);

      expect(after.zoom).toBe(4);
      const back = worldToScreen(world, after);
      expect(back.x).toBeCloseTo(centre.x, 6);
      expect(back.y).toBeCloseTo(centre.y, 6);
    });

    it('clamps the requested level to the limits', () => {
      expect(zoomToLevel({ x: 0, y: 0, zoom: 1 }, 99, SIZE, LIMITS).zoom).toBe(DEFAULT_MAX_ZOOM);
      expect(zoomToLevel({ x: 0, y: 0, zoom: 1 }, 0, SIZE, LIMITS).zoom).toBe(DEFAULT_MIN_ZOOM);
    });
  });

  describe('panBy / panTo', () => {
    it('panBy shifts the pan by screen-space deltas and leaves zoom alone', () => {
      expect(panBy({ x: 10, y: 10, zoom: 3 }, -5, 7)).toEqual({ x: 5, y: 17, zoom: 3 });
    });

    it('panTo centres the given world point in the viewport', () => {
      const after = panTo({ x: 0, y: 0, zoom: 2 }, { x: 50, y: 50 }, SIZE);
      expect(after).toEqual({ x: 0, y: 0, zoom: 2 });

      const centre = worldToScreen({ x: 50, y: 50 }, after);
      expect(centre).toEqual({ x: SIZE.width / 2, y: SIZE.height / 2 });
    });

    it('panTo centres a point far from the origin', () => {
      const after = panTo({ x: 0, y: 0, zoom: 0.5 }, { x: -4000, y: 2500 }, SIZE);
      const centre = worldToScreen({ x: -4000, y: 2500 }, after);
      expect(centre.x).toBeCloseTo(SIZE.width / 2, 6);
      expect(centre.y).toBeCloseTo(SIZE.height / 2, 6);
    });
  });

  describe('visibleWorldRect', () => {
    it('returns the world rectangle covered by the viewport', () => {
      const rect = visibleWorldRect({ x: -100, y: -100, zoom: 2 }, SIZE);
      expect(rect).toEqual({ x: 50, y: 50, width: 100, height: 100 });
    });

    it('grows as zoom decreases', () => {
      const near = visibleWorldRect({ x: 0, y: 0, zoom: 2 }, SIZE);
      const far = visibleWorldRect({ x: 0, y: 0, zoom: 0.5 }, SIZE);
      expect(far.width).toBeGreaterThan(near.width);
      expect(far.height).toBeGreaterThan(near.height);
    });
  });

  describe('rectsIntersect', () => {
    it('detects overlap', () => {
      expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    });

    it('rejects disjoint rectangles', () => {
      expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 5, height: 5 })).toBe(false);
    });

    it('treats edge-touching rectangles as intersecting', () => {
      expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 })).toBe(true);
    });
  });

  describe('boundsOf', () => {
    it('returns null for an empty list (zero-items edge case)', () => {
      expect(boundsOf([])).toBeNull();
    });

    it('returns the single rectangle for a one-item list', () => {
      expect(boundsOf([{ x: 3, y: 4, width: 5, height: 6 }])).toEqual({ x: 3, y: 4, width: 5, height: 6 });
    });

    it('unions several rectangles including negative coordinates', () => {
      expect(
        boundsOf([
          { x: -10, y: 0, width: 10, height: 10 },
          { x: 40, y: -20, width: 10, height: 10 },
        ]),
      ).toEqual({ x: -10, y: -20, width: 60, height: 30 });
    });

    it('collapses to a zero-size rect when every item shares one coordinate', () => {
      expect(
        boundsOf([
          { x: 7, y: 7, width: 0, height: 0 },
          { x: 7, y: 7, width: 0, height: 0 },
        ]),
      ).toEqual({ x: 7, y: 7, width: 0, height: 0 });
    });
  });

  describe('fitView', () => {
    it('scales the bounds to fill the viewport and centres them', () => {
      const viewport = fitView({ x: 0, y: 0, width: 100, height: 100 }, SIZE, { padding: 0, ...LIMITS });
      expect(viewport.zoom).toBe(2);
      expect(viewport.x).toBe(0);
      expect(viewport.y).toBe(0);
    });

    it('honours padding', () => {
      const viewport = fitView({ x: 0, y: 0, width: 100, height: 100 }, SIZE, { padding: 20, ...LIMITS });
      expect(viewport.zoom).toBeCloseTo(1.6, 6);
      expect(viewport.x).toBeCloseTo(20, 6);
      expect(viewport.y).toBeCloseTo(20, 6);
    });

    it('uses the tighter of the two axes', () => {
      const viewport = fitView({ x: 0, y: 0, width: 400, height: 100 }, SIZE, { padding: 0, ...LIMITS });
      expect(viewport.zoom).toBeCloseTo(0.5, 6);
    });

    it('returns the identity viewport when there is nothing to fit', () => {
      expect(fitView(null, SIZE, { padding: 0, ...LIMITS })).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('centres a degenerate zero-size bounds at zoom 1 instead of dividing by zero', () => {
      const viewport = fitView({ x: 7, y: 7, width: 0, height: 0 }, SIZE, { padding: 0, ...LIMITS });
      expect(viewport.zoom).toBe(1);
      const centre = worldToScreen({ x: 7, y: 7 }, viewport);
      expect(centre.x).toBeCloseTo(SIZE.width / 2, 6);
      expect(centre.y).toBeCloseTo(SIZE.height / 2, 6);
    });

    it('clamps the fitted zoom to maxZoom for a tiny bounds', () => {
      const viewport = fitView({ x: 0, y: 0, width: 1, height: 1 }, SIZE, { padding: 0, ...LIMITS });
      expect(viewport.zoom).toBe(DEFAULT_MAX_ZOOM);
    });

    it('clamps the fitted zoom to minZoom for an enormous bounds', () => {
      const viewport = fitView({ x: 0, y: 0, width: 1e9, height: 1e9 }, SIZE, { padding: 0, ...LIMITS });
      expect(viewport.zoom).toBe(DEFAULT_MIN_ZOOM);
    });

    it('returns the identity viewport for a zero-size container', () => {
      const viewport = fitView({ x: 0, y: 0, width: 100, height: 100 }, { width: 0, height: 0 }, { padding: 0, ...LIMITS });
      expect(viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('does not produce a negative available size when padding exceeds the container', () => {
      const viewport = fitView({ x: 0, y: 0, width: 100, height: 100 }, SIZE, { padding: 500, ...LIMITS });
      expect(viewport.zoom).toBeGreaterThan(0);
      expect(Number.isFinite(viewport.x)).toBe(true);
      expect(Number.isFinite(viewport.y)).toBe(true);
    });
  });

  describe('transformCss', () => {
    it('emits a composited translate3d + scale with no layout-affecting units', () => {
      expect(transformCss({ x: 10.5, y: -20.25, zoom: 1.5 })).toBe('translate3d(10.5px, -20.25px, 0) scale(1.5)');
    });
  });
});
