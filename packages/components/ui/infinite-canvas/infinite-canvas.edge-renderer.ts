import { rectsIntersect } from './infinite-canvas.transform';
import type {
  CanvasEdge,
  CanvasItem,
  CanvasPoint,
  CanvasRect,
  CanvasViewport,
} from './infinite-canvas.types';

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
  /** Built on first draw or hit test, never at load. See `pathOf`. */
  path: Path2D | null;
  /** World-space bounding box, used to cull before stroking. */
  bounds: CanvasRect;
  styleKey: string;
  /** The endpoints `path` was built from, so an unmoved edge can keep it. */
  from: CanvasPoint;
  to: CanvasPoint;
  /**
   * The item objects those endpoints were read from.
   *
   * Identity, not geometry: if the descriptor and both items are the same
   * objects as last time, nothing that feeds this path can have changed, and
   * the two anchor points need not be computed at all. Items are replaced
   * rather than mutated everywhere in this engine, which is what makes an
   * identity check sound here.
   */
  sourceItem: CanvasItem;
  targetItem: CanvasItem;
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
   * How many edges have had a `Path2D` built for them.
   *
   * Exposed so a test can prove the expensive half of an edge is NOT built
   * until it is drawn — the whole reason a hundred-thousand-edge board loads
   * at all. `edgeCount` counts what is known; this counts what was paid for.
   */
  get builtPathCount(): number {
    let built = 0;
    for (const cached of this.cache.values()) {
      if (cached.path) built++;
    }
    return built;
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
    const live = new Set<string | number>();

    for (const edge of edges) {
      const source = itemsById.get(edge.source);
      const target = itemsById.get(edge.target);
      if (!source || !target) continue;

      live.add(edge.id);

      /*
       * The cheapest question first: is anything different at all?
       *
       * The editor hands back the SAME descriptor object for a connection
       * whose endpoints did not move, so for 95,992 of 96,000 edges this is
       * three reference comparisons and nothing else - no anchor points
       * allocated, no fields compared. Only when one of the three differs is
       * it worth working out what actually changed.
       */
      const known = this.cache.get(edge.id);
      if (untouched(known, edge, source, target)) continue;

      const from = anchorOf(source, edge.sourceAnchor);
      const to = anchorOf(target, edge.targetAnchor);

      /*
       * Keep the path when nothing that shapes it moved.
       *
       * The editor hands us a freshly built edge list on every frame of a
       * drag, so the objects are always new — but the NUMBERS in them are
       * identical for every edge that did not move, and dragging one node
       * moves 8 edges out of 96,000. Rebuilding all of them meant discarding
       * 95,992 correct Path2Ds and constructing them again, which is the
       * single most expensive thing this class can be asked to do.
       */
      if (known && reusable(known, edge, from, to)) {
        known.edge = edge;
        known.sourceItem = source;
        known.targetItem = target;
        continue;
      }
      this.cache.set(edge.id, buildCachedEdge(edge, from, to, source, target));
    }

    // Deleting from a Map while iterating it is defined behaviour: an entry
    // removed before the walk reaches it is simply not visited. So no copy of
    // the key set is needed, and at 96,000 edges a copy is not free.
    for (const id of this.cache.keys()) {
      if (!live.has(id)) this.cache.delete(id);
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
      if (ctx.isPointInStroke(pathOf(cached), worldX, worldY)) hit = cached.edge;
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
      batch.path.addPath(pathOf(cached));
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

/**
 * Where an edge meets an item: the item's origin plus an optional world-space
 * offset, defaulting to its centre.
 *
 * The offset is relative rather than absolute precisely so a moving item drags
 * its edges with it — an absolute point would have to be recomputed by the
 * consumer on every drag frame, and would silently detach the first time one
 * was missed.
 */
function anchorOf(item: CanvasItem, offset?: CanvasPoint): CanvasPoint {
  if (!offset) return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
  return { x: item.x + offset.x, y: item.y + offset.y };
}

/**
 * Horizontal control-point reach for a bezier edge, as a fraction of the
 * endpoints' horizontal separation.
 */
const BEZIER_TENSION = 0.5;
/**
 * Floor on that reach, in world units. Without it two ports at nearly the same
 * x collapse to a straight vertical line, losing the visual cue that tells the
 * two directions apart.
 */
const BEZIER_MIN_REACH = 30;

/** Control-point offset for a horizontal-tangent cubic between two points. */
function bezierReach(from: CanvasPoint, to: CanvasPoint): number {
  return Math.max(Math.abs(to.x - from.x) * BEZIER_TENSION, BEZIER_MIN_REACH);
}

/**
 * Whether nothing that feeds this edge's path has changed since last time.
 *
 * Three reference comparisons, which is all it takes: the editor hands back
 * the SAME descriptor object for a connection whose endpoints did not move,
 * and items are replaced rather than mutated, so identity settles the question
 * without computing an anchor or comparing a field.
 */
function untouched(
  known: CachedEdge | undefined,
  edge: CanvasEdge,
  source: CanvasItem,
  target: CanvasItem,
): boolean {
  if (known === undefined) return false;
  return known.edge === edge && known.sourceItem === source && known.targetItem === target;
}

/** The style fields the batching key is built from. */
function styleKeyOf(edge: CanvasEdge): string {
  return `${edge.color ?? DEFAULT_EDGE_COLOR}|${edge.width ?? DEFAULT_EDGE_WIDTH}|${(edge.dash ?? []).join(',')}`;
}

/** Whether two dash patterns would stroke identically. */
function sameDash(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (a === b) return true;
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (!Object.is(left[i], right[i])) return false;
  }
  return true;
}

/**
 * Whether a cached path is still the right one for this edge.
 *
 * Compares the style FIELDS rather than the style key, deliberately. Building
 * the key is a template string over an array join, and doing that for every
 * edge on every frame just to decide not to rebuild it cost more than half of
 * what the cache saves — 96,000 throwaway strings a frame to avoid 96,000
 * Path2Ds. The key is still built once per edge, inside `buildCachedEdge`,
 * where it is actually used for batching.
 *
 * `Object.is` rather than `===` on the numbers: the question is literally "is
 * this the same value I built the path from", not "are these two floats near
 * enough", so a tolerance would be wrong as well as slower — a node moved by a
 * millionth of a unit genuinely needs its path rebuilt.
 */
function reusable(cached: CachedEdge, edge: CanvasEdge, from: CanvasPoint, to: CanvasPoint): boolean {
  const before = cached.edge;
  return (
    Object.is(cached.from.x, from.x) &&
    Object.is(cached.from.y, from.y) &&
    Object.is(cached.to.x, to.x) &&
    Object.is(cached.to.y, to.y) &&
    before.curve === edge.curve &&
    before.color === edge.color &&
    before.width === edge.width &&
    sameDash(before.dash, edge.dash)
  );
}

/** The cubic's control points, or null for a straight edge. */
function controlPoints(
  edge: CanvasEdge,
  from: CanvasPoint,
  to: CanvasPoint,
): { c1: CanvasPoint; c2: CanvasPoint } | null {
  if (edge.curve !== 'bezier') return null;
  const reach = bezierReach(from, to);
  return { c1: { x: from.x + reach, y: from.y }, c2: { x: to.x - reach, y: to.y } };
}

/**
 * The edge's world-space AABB.
 *
 * Must contain the CONTROL points, not just the endpoints. A cubic never
 * leaves its control hull, so hull bounds are always safe; the curve's true
 * extent is tighter, but culling an edge that is actually on screen is a
 * visible bug and a slightly loose AABB is not.
 *
 * Computed eagerly for every edge, because culling needs it - but it is only
 * arithmetic, which is the entire point of separating it from the path.
 */
interface Span {
  min: number;
  max: number;
}

function span(a: number, b: number): Span {
  return a < b ? { min: a, max: b } : { min: b, max: a };
}

function extend(into: Span, value: number): void {
  if (value < into.min) into.min = value;
  else if (value > into.max) into.max = value;
}

function boundsOfEdge(edge: CanvasEdge, from: CanvasPoint, to: CanvasPoint): CanvasRect {
  // Two small spans rather than two arrays gathered and spread through
  // Math.min/max. The arrays were nothing at fifty edges and were 192,000
  // allocations at ninety-six thousand, on the one pass that has to finish
  // before the board can be shown at all.
  const x = span(from.x, to.x);
  const y = span(from.y, to.y);

  const control = controlPoints(edge, from, to);
  if (control) {
    extend(x, control.c1.x);
    extend(x, control.c2.x);
    extend(y, control.c1.y);
    extend(y, control.c2.y);
  }

  return {
    x: x.min - AABB_PADDING,
    y: y.min - AABB_PADDING,
    width: x.max - x.min + AABB_PADDING * 2,
    height: y.max - y.min + AABB_PADDING * 2,
  };
}

/**
 * The edge's world-space `Path2D`, built on first use and kept after.
 *
 * A `Path2D` is a native object, and building one per edge in the GRAPH rather
 * than per edge on the SCREEN is what made a hundred-thousand-node board
 * unusable: 96,000 of them constructed in one blocking pass at load and held
 * for the lifetime of the page. A phone stopped responding on that frame, and
 * the JS heap figure never showed it because the cost is not on the JS heap.
 *
 * Only edges that are actually drawn or hit-tested get one now. A viewport
 * holds a few hundred, and panning reuses what it already built.
 */
function pathOf(cached: CachedEdge): Path2D {
  if (cached.path) return cached.path;

  const path = new Path2D();
  path.moveTo(cached.from.x, cached.from.y);

  const control = controlPoints(cached.edge, cached.from, cached.to);
  if (control) {
    path.bezierCurveTo(
      control.c1.x,
      control.c1.y,
      control.c2.x,
      control.c2.y,
      cached.to.x,
      cached.to.y,
    );
  } else {
    path.lineTo(cached.to.x, cached.to.y);
  }

  cached.path = path;
  return path;
}

function buildCachedEdge(
  edge: CanvasEdge,
  from: CanvasPoint,
  to: CanvasPoint,
  sourceItem: CanvasItem,
  targetItem: CanvasItem,
): CachedEdge {
  return {
    edge,
    path: null,
    bounds: boundsOfEdge(edge, from, to),
    styleKey: styleKeyOf(edge),
    from,
    to,
    sourceItem,
    targetItem,
  };
}
