import { rectsIntersect } from './infinite-canvas.transform';
import type { CanvasEdge, CanvasItem, CanvasRect, CanvasViewport } from './infinite-canvas.types';

/**
 * The edge layer: one `<canvas>`, one draw loop, zero DOM per edge.
 *
 * ### Why edges are canvas and not DOM
 *
 * Edges cannot be culled by endpoint — a long edge with *both* endpoints
 * off-screen still crosses the viewport — and they are also the thing there are
 * most of. Thousands of SVG paths would sink the frame budget.
 *
 * ### The world-space Path2D cache
 *
 * The *shape* of an edge does not change when you pan or zoom. So each edge's
 * `Path2D` is built once in **world** coordinates and cached; a frame then only
 * sets the transform and re-strokes. Pan and zoom rebuild **zero** paths, and
 * paths are rebuilt only when an endpoint actually moves.
 *
 * ### Batching
 *
 * `ctx.stroke()` per path is the bottleneck, not path construction. Edges are
 * grouped by `{color, width, dash}` and appended into one `Path2D` per style,
 * turning thousands of stroke calls into a handful.
 *
 * ### Hit testing
 *
 * `ctx.isPointInStroke()` against the cached world-space path gives exact edge
 * hit-testing for free — no bezier distance maths to write or get wrong.
 */

interface CachedEdge {
  edge: CanvasEdge;
  path: Path2D;
  /** World-space bounding box, used to cull before stroking. */
  bounds: CanvasRect;
  styleKey: string;
}

/** Extra world units added to an edge's AABB so thick strokes are not clipped. */
const AABB_PADDING = 2;
/** Screen-pixel radius within which a point counts as hitting an edge. */
const HIT_TOLERANCE_PX = 6;
const DEFAULT_EDGE_WIDTH = 1.5;
const DEFAULT_EDGE_COLOR = 'currentColor';

export class CanvasEdgeRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cache = new Map<string | number, CachedEdge>();

  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('infinite-canvas: 2D canvas context is unavailable');
    this.ctx = ctx;
  }

  /** Cached edges, whether or not they are currently visible. */
  get edgeCount(): number {
    return this.cache.size;
  }

  /**
   * Sizes the backing store for the device pixel ratio.
   *
   * `devicePixelRatio` appears nowhere else in this codebase, which is exactly
   * why it is handled here from day one: without it the canvas is rendered at
   * CSS resolution and upscaled, so every edge is visibly blurry on any HiDPI
   * display.
   */
  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = dpr > 0 && Number.isFinite(dpr) ? dpr : 1;

    this.canvas.width = Math.max(1, Math.round(cssWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * this.dpr));
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
  }

  /**
   * Rebuilds the world-space path cache. Call this when edges or item positions
   * change — **not** on pan or zoom, which reuse the cache untouched.
   */
  setEdges(edges: readonly CanvasEdge[], itemsById: ReadonlyMap<string | number, CanvasItem>): void {
    this.cache.clear();

    for (const edge of edges) {
      const source = itemsById.get(edge.source);
      const target = itemsById.get(edge.target);
      if (!source || !target) continue;
      this.cache.set(edge.id, buildCachedEdge(edge, centreOf(source), centreOf(target)));
    }
  }

  /** Drops every cached path. */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Draws every edge whose AABB intersects `worldRect`.
   *
   * Returns the number of stroke calls issued — the metric batching exists to
   * minimise, and what the batching test asserts on.
   */
  draw(viewport: CanvasViewport, worldRect: CanvasRect): number {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    if (this.cache.size === 0) return 0;

    const batches = this.collectVisible(worldRect);
    if (batches.size === 0) return 0;

    ctx.setTransform(
      viewport.zoom * dpr,
      0,
      0,
      viewport.zoom * dpr,
      viewport.x * dpr,
      viewport.y * dpr,
    );

    let strokes = 0;
    for (const batch of batches.values()) {
      ctx.strokeStyle = batch.color;
      // Divide by zoom so the on-screen width stays constant at any zoom level.
      ctx.lineWidth = batch.width / viewport.zoom;
      ctx.setLineDash(batch.dash.map(segment => segment / viewport.zoom));
      ctx.stroke(batch.path);
      strokes++;
    }

    ctx.setLineDash([]);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return strokes;
  }

  /**
   * The topmost edge within {@link HIT_TOLERANCE_PX} of a world point, or
   * `null`. Narrowed by AABB first, then resolved exactly against the cached
   * path via `isPointInStroke`.
   */
  hitTest(worldX: number, worldY: number, viewport: CanvasViewport): CanvasEdge | null {
    const { ctx } = this;
    const tolerance = HIT_TOLERANCE_PX / viewport.zoom;
    const probe: CanvasRect = {
      x: worldX - tolerance,
      y: worldY - tolerance,
      width: tolerance * 2,
      height: tolerance * 2,
    };

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    let hit: CanvasEdge | null = null;
    for (const cached of this.cache.values()) {
      if (!rectsIntersect(cached.bounds, probe)) continue;
      ctx.lineWidth = Math.max(tolerance * 2, (cached.edge.width ?? DEFAULT_EDGE_WIDTH) / viewport.zoom);
      if (ctx.isPointInStroke(cached.path, worldX, worldY)) hit = cached.edge;
    }

    ctx.restore();
    return hit;
  }

  /** Groups the visible edges into one `Path2D` per stroke style. */
  private collectVisible(worldRect: CanvasRect): Map<string, StyleBatch> {
    const batches = new Map<string, StyleBatch>();

    for (const cached of this.cache.values()) {
      if (!rectsIntersect(cached.bounds, worldRect)) continue;

      let batch = batches.get(cached.styleKey);
      if (!batch) {
        batch = {
          path: new Path2D(),
          color: cached.edge.color ?? DEFAULT_EDGE_COLOR,
          width: cached.edge.width ?? DEFAULT_EDGE_WIDTH,
          dash: cached.edge.dash ?? [],
        };
        batches.set(cached.styleKey, batch);
      }
      batch.path.addPath(cached.path);
    }
    return batches;
  }
}

interface StyleBatch {
  path: Path2D;
  color: string;
  width: number;
  dash: readonly number[];
}

function centreOf(item: CanvasItem): { x: number; y: number } {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

function buildCachedEdge(
  edge: CanvasEdge,
  from: { x: number; y: number },
  to: { x: number; y: number },
): CachedEdge {
  const path = new Path2D();
  path.moveTo(from.x, from.y);
  path.lineTo(to.x, to.y);

  return {
    edge,
    path,
    bounds: {
      x: Math.min(from.x, to.x) - AABB_PADDING,
      y: Math.min(from.y, to.y) - AABB_PADDING,
      width: Math.abs(to.x - from.x) + AABB_PADDING * 2,
      height: Math.abs(to.y - from.y) + AABB_PADDING * 2,
    },
    styleKey: `${edge.color ?? DEFAULT_EDGE_COLOR}|${edge.width ?? DEFAULT_EDGE_WIDTH}|${(edge.dash ?? []).join(',')}`,
  };
}
