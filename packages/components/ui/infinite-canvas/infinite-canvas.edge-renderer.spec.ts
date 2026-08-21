import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CanvasEdgeRenderer } from './infinite-canvas.edge-renderer';
import type { CanvasEdge, CanvasItem, CanvasRect, CanvasViewport } from './infinite-canvas.types';

const IDENTITY: CanvasViewport = { x: 0, y: 0, zoom: 1 };
const VIEW: CanvasRect = { x: 0, y: 0, width: 400, height: 300 };

function itemMap(items: CanvasItem[]): Map<string | number, CanvasItem> {
  return new Map(items.map(item => [item.id, item]));
}

/** Two 10x10 items whose centres sit at (5,5) and (205,5). */
const ITEMS = itemMap([
  { id: 'a', x: 0, y: 0, width: 10, height: 10 },
  { id: 'b', x: 200, y: 0, width: 10, height: 10 },
]);

describe('CanvasEdgeRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: CanvasEdgeRenderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    renderer = new CanvasEdgeRenderer(canvas);
    renderer.resize(400, 300, 1);
  });

  afterEach(() => {
    canvas.remove();
  });

  /** Reads back a pixel's alpha in DEVICE pixels. */
  function alphaAt(deviceX: number, deviceY: number): number {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    return ctx.getImageData(deviceX, deviceY, 1, 1).data[3];
  }

  describe('T-12 — the backing store is scaled by devicePixelRatio (UC-10)', () => {
    it('sizes the backing store in device pixels and the element in CSS pixels', () => {
      renderer.resize(400, 300, 2);

      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
      expect(canvas.style.width).toBe('400px');
      expect(canvas.style.height).toBe('300px');
    });

    it('handles a fractional ratio', () => {
      renderer.resize(400, 300, 1.5);
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(450);
    });

    it('falls back to 1 for a nonsensical ratio', () => {
      renderer.resize(400, 300, 0);
      expect(canvas.width).toBe(400);

      renderer.resize(400, 300, Number.NaN);
      expect(canvas.width).toBe(400);
    });

    it('never produces a zero-sized backing store', () => {
      renderer.resize(0, 0, 1);
      expect(canvas.width).toBeGreaterThanOrEqual(1);
      expect(canvas.height).toBeGreaterThanOrEqual(1);
    });

    it('draws at device resolution, so a DPR-2 stroke lands on device pixels', () => {
      renderer.resize(400, 300, 2);
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b', color: '#ff0000', width: 4 }], ITEMS);
      renderer.draw(IDENTITY, VIEW);

      // World y=5 at zoom 1, DPR 2 => device y=10.
      expect(alphaAt(200, 10)).toBeGreaterThan(0);
    });
  });

  describe('T-7 — an edge with both endpoints off-screen still draws (UC-6)', () => {
    it('draws a long edge that merely crosses the viewport', () => {
      const items = itemMap([
        { id: 'left', x: -5000, y: 100, width: 10, height: 10 },
        { id: 'right', x: 5000, y: 100, width: 10, height: 10 },
      ]);
      renderer.setEdges([{ id: 'e', source: 'left', target: 'right', color: '#ff0000', width: 6 }], items);

      const strokes = renderer.draw(IDENTITY, VIEW);

      expect(strokes).toBe(1);
      expect(alphaAt(200, 105)).toBeGreaterThan(0);
    });

    it('culls an edge whose whole AABB is outside the viewport', () => {
      const items = itemMap([
        { id: 'p', x: 9000, y: 9000, width: 10, height: 10 },
        { id: 'q', x: 9500, y: 9500, width: 10, height: 10 },
      ]);
      renderer.setEdges([{ id: 'e', source: 'p', target: 'q' }], items);

      expect(renderer.draw(IDENTITY, VIEW)).toBe(0);
    });

    it('draws nothing when there are no edges', () => {
      renderer.setEdges([], ITEMS);
      expect(renderer.draw(IDENTITY, VIEW)).toBe(0);
    });

    it('skips edges referencing an unknown item', () => {
      renderer.setEdges([{ id: 'dangling', source: 'a', target: 'nope' }], ITEMS);
      expect(renderer.edgeCount).toBe(0);
      expect(renderer.draw(IDENTITY, VIEW)).toBe(0);
    });

    it('clears the previous frame before drawing', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b', color: '#ff0000', width: 6 }], ITEMS);
      renderer.draw(IDENTITY, VIEW);
      expect(alphaAt(100, 5)).toBeGreaterThan(0);

      renderer.setEdges([], ITEMS);
      renderer.draw(IDENTITY, VIEW);
      expect(alphaAt(100, 5)).toBe(0);
    });
  });

  describe('world-space path cache and batching', () => {
    it('issues ONE stroke per style, not one per edge', () => {
      const items: CanvasItem[] = [];
      const edges: CanvasEdge[] = [];
      for (let i = 0; i < 60; i++) {
        items.push({ id: i, x: i * 5, y: 0, width: 4, height: 4 });
      }
      for (let i = 0; i < 59; i++) {
        edges.push({ id: `e${i}`, source: i, target: i + 1, color: i % 2 ? '#f00' : '#00f' });
      }
      renderer.setEdges(edges, itemMap(items));

      expect(renderer.edgeCount).toBe(59);
      expect(renderer.draw(IDENTITY, VIEW)).toBe(2);
    });

    it('separates batches by width and dash as well as colour', () => {
      const items = itemMap([
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 100, y: 0, width: 10, height: 10 },
        { id: 'c', x: 200, y: 0, width: 10, height: 10 },
      ]);
      renderer.setEdges(
        [
          { id: '1', source: 'a', target: 'b', color: '#f00', width: 1 },
          { id: '2', source: 'b', target: 'c', color: '#f00', width: 3 },
          { id: '3', source: 'a', target: 'c', color: '#f00', width: 1, dash: [4, 4] },
        ],
        items,
      );

      expect(renderer.draw(IDENTITY, VIEW)).toBe(3);
    });

    it('does NOT rebuild paths on pan or zoom — the cache survives untouched', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b' }], ITEMS);
      const before = renderer.edgeCount;

      renderer.draw({ x: -50, y: 20, zoom: 2 }, { x: 25, y: -10, width: 200, height: 150 });
      renderer.draw({ x: 300, y: -100, zoom: 0.4 }, { x: -750, y: 250, width: 1000, height: 750 });

      expect(renderer.edgeCount).toBe(before);
    });

    it('keeps the on-screen stroke width constant across zoom levels', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b', color: '#ff0000', width: 8 }], ITEMS);

      renderer.draw({ x: 0, y: 100, zoom: 4 }, { x: 0, y: -25, width: 100, height: 75 });
      const thickAtZoom4 = countOpaqueColumnPixels(canvas, 100);

      renderer.resize(400, 300, 1);
      renderer.draw({ x: 0, y: 100, zoom: 0.5 }, { x: 0, y: -200, width: 800, height: 600 });
      const thickAtZoomHalf = countOpaqueColumnPixels(canvas, 5);

      expect(thickAtZoom4).toBeGreaterThan(0);
      expect(Math.abs(thickAtZoom4 - thickAtZoomHalf)).toBeLessThanOrEqual(3);
    });

    it('honours a pan by drawing the edge at the panned position', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b', color: '#ff0000', width: 6 }], ITEMS);

      renderer.draw({ x: 0, y: 200, zoom: 1 }, { x: 0, y: -200, width: 400, height: 300 });

      expect(alphaAt(100, 205)).toBeGreaterThan(0);
      expect(alphaAt(100, 5)).toBe(0);
    });

    it('clear() drops the cache', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b' }], ITEMS);
      renderer.clear();
      expect(renderer.edgeCount).toBe(0);
    });
  });

  describe('T-11 — hit testing via the cached world-space path (UC-9)', () => {
    it('hits a point on the edge', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b' }], ITEMS);
      expect(renderer.hitTest(100, 5, IDENTITY)?.id).toBe('e');
    });

    it('misses a point well away from the edge', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b' }], ITEMS);
      expect(renderer.hitTest(100, 200, IDENTITY)).toBeNull();
    });

    it('hits within tolerance but not beyond it', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b' }], ITEMS);
      expect(renderer.hitTest(100, 8, IDENTITY)?.id).toBe('e');
      expect(renderer.hitTest(100, 60, IDENTITY)).toBeNull();
    });

    it('scales the tolerance with zoom so it stays constant on screen', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b' }], ITEMS);

      const zoomedIn: CanvasViewport = { x: 0, y: 0, zoom: 8 };
      expect(renderer.hitTest(100, 5.5, zoomedIn)?.id).toBe('e');
      expect(renderer.hitTest(100, 20, zoomedIn)).toBeNull();
    });

    it('returns the last matching edge when several overlap', () => {
      renderer.setEdges(
        [
          { id: 'under', source: 'a', target: 'b' },
          { id: 'over', source: 'a', target: 'b' },
        ],
        ITEMS,
      );
      expect(renderer.hitTest(100, 5, IDENTITY)?.id).toBe('over');
    });

    it('hits an edge whose endpoints are both off-screen', () => {
      const items = itemMap([
        { id: 'left', x: -5000, y: 100, width: 10, height: 10 },
        { id: 'right', x: 5000, y: 100, width: 10, height: 10 },
      ]);
      renderer.setEdges([{ id: 'e', source: 'left', target: 'right' }], items);

      expect(renderer.hitTest(0, 105, IDENTITY)?.id).toBe('e');
    });

    it('returns null with an empty cache', () => {
      expect(renderer.hitTest(0, 0, IDENTITY)).toBeNull();
    });
  });

  describe('construction', () => {
    it('throws a clear error when no 2D context is available', () => {
      const broken = document.createElement('canvas');
      broken.getContext = (): null => null;
      expect(() => new CanvasEdgeRenderer(broken)).toThrow(/2D canvas context/);
    });
  });
});

/** Counts non-transparent pixels down one device column — the stroke's thickness. */
function countOpaqueColumnPixels(canvas: HTMLCanvasElement, x: number): number {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const { data } = ctx.getImageData(x, 0, 1, canvas.height);

  let count = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) count++;
  }
  return count;
}
