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

// T-1 from `specs/node-editor-spec.md` §0 — anchored, curved edges.
//
// The node editor attaches edges to ports rather than item centres, and draws
// them as curves. Rather than teach the engine what a port is, the engine
// learned to take an offset and a curve style; these tests pin that contract,
// and pin that the old behaviour is still exactly what you get by default.
describe('T-1 — anchor offsets and curve style (node-editor prerequisite)', () => {
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

  /** An edge is present at this world point if hit-testing finds it. */
  function hitAt(x: number, y: number): string | number | undefined {
    return renderer.hitTest(x, y, IDENTITY)?.id;
  }

  describe('an edge with no anchors is unchanged', () => {
    it('still meets both items at their centres', () => {
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b' }], ITEMS);
      // Centres are (5,5) and (205,5), so the midpoint of the run is (105,5).
      expect(hitAt(105, 5)).toBe('e');
      // …and nothing runs along the items' top edge at y=0.
      expect(hitAt(105, -30)).toBeUndefined();
    });
  });

  describe('an anchor offsets the endpoint from the item origin', () => {
    it('draws from the offset point rather than the centre', () => {
      // Tall items, so the top edge and the centre are further apart than the
      // renderer's 6px hit tolerance — otherwise "not at the centre" is a
      // claim the hit test cannot actually distinguish.
      const tall = itemMap([
        { id: 'a', x: 0, y: 0, width: 10, height: 80 },
        { id: 'b', x: 200, y: 0, width: 10, height: 80 },
      ]);
      renderer.setEdges(
        [{
          id: 'e',
          source: 'a',
          target: 'b',
          // y:0 anchors both ends to the items' top edge, 40 units above the
          // centres a default edge would use.
          sourceAnchor: { x: 10, y: 0 },
          targetAnchor: { x: 0, y: 0 },
        }],
        tall,
      );
      expect(hitAt(105, 0)).toBe('e');
      expect(hitAt(105, 40)).toBeUndefined();
    });

    it('is relative to the origin, so moving the item moves the edge with it', () => {
      const edge: CanvasEdge = {
        id: 'e',
        source: 'a',
        target: 'b',
        sourceAnchor: { x: 10, y: 0 },
        targetAnchor: { x: 0, y: 0 },
      };
      const moved = itemMap([
        { id: 'a', x: 0, y: 100, width: 10, height: 10 },
        { id: 'b', x: 200, y: 100, width: 10, height: 10 },
      ]);
      renderer.setEdges([edge], moved);

      // The SAME edge object now runs 100 units lower, with no anchor edit.
      expect(hitAt(105, 100)).toBe('e');
      expect(hitAt(105, 0)).toBeUndefined();
    });
  });

  describe("curve: 'bezier' bows the edge out horizontally", () => {
    it('leaves the straight line the two endpoints would have formed', () => {
      // Endpoints at (5,5) and (205,205): a straight edge passes through
      // (105,105), a horizontal-tangent cubic does not.
      const diagonal = itemMap([
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 200, y: 200, width: 10, height: 10 },
      ]);
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b', curve: 'bezier' }], diagonal);

      // The midpoint of a symmetric horizontal-tangent cubic still sits at the
      // centre, but the quarter points are pulled toward the horizontal.
      expect(hitAt(55, 55)).toBeUndefined();
      expect(hitAt(105, 105)).toBe('e');
    });

    it('bounds the curve by its control hull, so a near-vertical edge is not culled', () => {
      // The worst case for a horizontal-tangent cubic: the endpoints are nearly
      // vertically aligned, so the curve bulges sideways well past BOTH of
      // them. Endpoint-only bounds would cull the bulge, and the visible part
      // of the edge would vanish when the endpoints scrolled off.
      const stacked = itemMap([
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 0, y: 200, width: 10, height: 10 },
      ]);
      renderer.setEdges([{ id: 'e', source: 'a', target: 'b', curve: 'bezier' }], stacked);

      // A viewport strictly to the RIGHT of both endpoints (x >= 20) contains
      // no endpoint at all, yet the curve's bulge crosses it.
      const rightOfBoth: CanvasRect = { x: 20, y: 0, width: 100, height: 210 };
      expect(renderer.draw(IDENTITY, rightOfBoth)).toBe(1);
    });
  });

  describe('anchors and curves compose with the existing batching', () => {
    it('still collapses same-styled edges into one stroke call', () => {
      renderer.setEdges(
        [
          { id: 'e1', source: 'a', target: 'b', curve: 'bezier' },
          { id: 'e2', source: 'a', target: 'b', curve: 'bezier', sourceAnchor: { x: 10, y: 2 } },
        ],
        ITEMS,
      );
      expect(renderer.draw(IDENTITY, VIEW)).toBe(1);
    });
  });
});

/*
 * `setEdges` keeps the Path2D of any edge whose endpoints and style are
 * unchanged, because the editor hands it a freshly built edge list on every
 * frame of a drag. Reuse that is even slightly too eager draws a stale edge.
 *
 * These assert through `hitTest`, which resolves against the CACHED path with
 * `isPointInStroke`. Probing rendered pixels was tried first and was useless:
 * the colour and width are re-read from the refreshed edge at draw time, so a
 * stale path still painted the right colour in the right place often enough
 * to pass. Making reuse unconditional was verified to fail these.
 */
describe('setEdges reuses paths only when nothing that shapes them changed', () => {
  let canvas: HTMLCanvasElement;
  let renderer: CanvasEdgeRenderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    renderer = new CanvasEdgeRenderer(canvas);
    renderer.resize(400, 300, 1);
  });

  afterEach(() => canvas.remove());

  const edge = (over: Partial<CanvasEdge> = {}): CanvasEdge => ({
    id: 'e',
    source: 'a',
    target: 'b',
    curve: 'line',
    width: 2,
    ...over,
  });

  /** 'b' dropped 100 world units, so the edge slopes through (105, 55). */
  const DROPPED = itemMap([
    { id: 'a', x: 0, y: 0, width: 10, height: 10 },
    { id: 'b', x: 200, y: 100, width: 10, height: 10 },
  ]);

  it('re-anchors the cached path when an endpoint item moves', () => {
    renderer.setEdges([edge()], ITEMS);
    expect(renderer.hitTest(105, 5, IDENTITY)?.id).toBe('e');
    expect(renderer.hitTest(105, 55, IDENTITY)).toBeNull();

    renderer.setEdges([edge()], DROPPED);
    expect(renderer.hitTest(105, 55, IDENTITY)?.id).toBe('e');
    expect(renderer.hitTest(105, 5, IDENTITY)).toBeNull();
  });

  it('re-anchors when the port offset moves but the item does not', () => {
    renderer.setEdges([edge()], ITEMS);
    expect(renderer.hitTest(105, 5, IDENTITY)?.id).toBe('e');

    renderer.setEdges([edge({ targetAnchor: { x: 5, y: 105 } })], ITEMS);
    expect(renderer.hitTest(105, 55, IDENTITY)?.id).toBe('e');
  });

  it('keeps the path when nothing moved at all', () => {
    renderer.setEdges([edge()], ITEMS);
    renderer.setEdges([edge()], itemMap([...ITEMS.values()].map(item => ({ ...item }))));
    expect(renderer.hitTest(105, 5, IDENTITY)?.id).toBe('e');
    expect(renderer.edgeCount).toBe(1);
  });

  it('forgets an edge that left the list', () => {
    renderer.setEdges([edge({ id: 'e1' }), edge({ id: 'e2' })], ITEMS);
    expect(renderer.edgeCount).toBe(2);
    renderer.setEdges([edge({ id: 'e1' })], ITEMS);
    expect(renderer.edgeCount).toBe(1);
  });

  it('drops an edge whose item vanished, and restores it when it returns', () => {
    renderer.setEdges([edge()], ITEMS);
    expect(renderer.edgeCount).toBe(1);

    renderer.setEdges([edge()], itemMap([{ id: 'a', x: 0, y: 0, width: 10, height: 10 }]));
    expect(renderer.edgeCount).toBe(0);

    renderer.setEdges([edge()], ITEMS);
    expect(renderer.hitTest(105, 5, IDENTITY)?.id).toBe('e');
  });
});

/*
 * The regression gate for the path cache.
 *
 * Reverting `setEdges` to "clear and rebuild everything" would discard every
 * correct path on every frame of a drag and break no other test.
 *
 * Counted through `builtPathCount` rather than by patching the `Path2D`
 * constructor. The constructor count was the right instrument until paths went
 * lazy; after that it measured `setEdges`, which correctly builds nothing, and
 * so reported zero for a healthy renderer. What the cache actually promises is
 * that a path SURVIVES a frame in which its edge did not move, and survival is
 * what this asks about.
 */
describe('setEdges keeps the paths whose edges did not move', () => {
  let canvas: HTMLCanvasElement;
  let renderer: CanvasEdgeRenderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    renderer = new CanvasEdgeRenderer(canvas);
    renderer.resize(400, 300, 1);
  });

  afterEach(() => canvas.remove());

  /** A fan of `count` edges from one hub, all inside one viewport. */
  function fan(count: number): { edges: CanvasEdge[]; items: Map<string | number, CanvasItem> } {
    const items: CanvasItem[] = [{ id: 'hub', x: 0, y: 0, width: 10, height: 10 }];
    const edges: CanvasEdge[] = [];
    for (let i = 0; i < count; i++) {
      items.push({ id: `n${i}`, x: 100 + i * 10, y: 50, width: 10, height: 10 });
      edges.push({ id: `e${i}`, source: 'hub', target: `n${i}`, curve: 'line' });
    }
    return { edges, items: itemMap(items) };
  }

  const WHOLE: CanvasRect = { x: -100, y: -100, width: 800, height: 600 };

  /** Draws once so every visible edge has a path, then reports the count. */
  function warm(edges: CanvasEdge[], items: Map<string | number, CanvasItem>): number {
    renderer.setEdges(edges, items);
    renderer.draw(IDENTITY, WHOLE);
    return renderer.builtPathCount;
  }

  it('keeps every path when nothing moved', () => {
    const { edges, items } = fan(20);
    expect(warm(edges, items)).toBe(20);

    renderer.setEdges(edges, items);
    expect(renderer.builtPathCount).toBe(20);
  });

  it('discards one path when one leaf moves, not twenty', () => {
    const { edges, items } = fan(20);
    expect(warm(edges, items)).toBe(20);

    const moved = new Map(items);
    moved.set('n7', { id: 'n7', x: 240, y: 500, width: 10, height: 10 });
    renderer.setEdges(edges, moved);

    expect(renderer.builtPathCount).toBe(19);
  });

  it('discards every path when the shared hub moves, because every edge moved', () => {
    const { edges, items } = fan(20);
    expect(warm(edges, items)).toBe(20);

    const moved = new Map(items);
    moved.set('hub', { id: 'hub', x: 0, y: 400, width: 10, height: 10 });
    renderer.setEdges(edges, moved);

    expect(renderer.builtPathCount).toBe(0);
  });
});


/*
 * The regression gate for lazy paths.
 *
 * A `Path2D` is a native object. Building one per edge in the GRAPH rather
 * than per edge on the SCREEN is what made a 100,000-node board freeze a
 * phone: 96,000 of them built in one blocking pass before anything could be
 * shown, and held for the life of the page. Its cost never appeared in the JS
 * heap, because that is not where it lives.
 *
 * Counting built paths is exact and cannot flake.
 */
describe('setEdges builds no path until an edge is actually drawn', () => {
  let canvas: HTMLCanvasElement;
  let renderer: CanvasEdgeRenderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    renderer = new CanvasEdgeRenderer(canvas);
    renderer.resize(400, 300, 1);
  });

  afterEach(() => canvas.remove());

  /** `count` edges spread far apart, so a viewport can only hold a few. */
  function spread(count: number): {
    edges: CanvasEdge[];
    items: Map<string | number, CanvasItem>;
  } {
    const items: CanvasItem[] = [];
    const edges: CanvasEdge[] = [];
    for (let i = 0; i < count; i++) {
      items.push({ id: `a${i}`, x: i * 5000, y: 0, width: 10, height: 10 });
      items.push({ id: `b${i}`, x: i * 5000 + 100, y: 0, width: 10, height: 10 });
      edges.push({ id: `e${i}`, source: `a${i}`, target: `b${i}`, curve: 'bezier' });
    }
    return { edges, items: itemMap(items) };
  }

  it('knows every edge and has built no path at all', () => {
    const { edges, items } = spread(200);
    renderer.setEdges(edges, items);

    expect(renderer.edgeCount).toBe(200);
    expect(renderer.builtPathCount).toBe(0);
  });

  it('builds only the paths a drawn viewport needed', () => {
    const { edges, items } = spread(200);
    renderer.setEdges(edges, items);

    // A viewport over the first edge only.
    renderer.draw(IDENTITY, { x: -50, y: -50, width: 300, height: 300 });

    expect(renderer.builtPathCount).toBe(1);
    expect(renderer.edgeCount).toBe(200);
  });

  it('keeps a path it already built when the viewport returns to it', () => {
    const { edges, items } = spread(200);
    renderer.setEdges(edges, items);

    renderer.draw(IDENTITY, { x: -50, y: -50, width: 300, height: 300 });
    renderer.draw(IDENTITY, { x: 4950, y: -50, width: 300, height: 300 });
    renderer.draw(IDENTITY, { x: -50, y: -50, width: 300, height: 300 });

    // Two viewports visited, two paths built — not three.
    expect(renderer.builtPathCount).toBe(2);
  });

  it('builds a path for a hit test, because that needs the real curve', () => {
    const { edges, items } = spread(200);
    renderer.setEdges(edges, items);
    expect(renderer.builtPathCount).toBe(0);

    renderer.hitTest(55, 5, IDENTITY);
    expect(renderer.builtPathCount).toBeGreaterThan(0);
  });

  it('drops the built path when the edge actually moves', () => {
    const { edges, items } = spread(3);
    renderer.setEdges(edges, items);
    renderer.draw(IDENTITY, { x: -50, y: -50, width: 300, height: 300 });
    expect(renderer.builtPathCount).toBe(1);

    const moved = new Map(items);
    moved.set('b0', { id: 'b0', x: 100, y: 900, width: 10, height: 10 });
    renderer.setEdges(edges, moved);

    // Rebuilt from scratch, so nothing is carrying the old shape.
    expect(renderer.builtPathCount).toBe(0);
  });
});
