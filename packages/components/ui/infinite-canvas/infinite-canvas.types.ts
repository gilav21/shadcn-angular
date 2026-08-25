/**
 * Shared value types for the infinite-canvas engine.
 *
 * Everything here is a plain data interface with no Angular dependency, so the
 * pure modules (transform maths, spatial hash, edge renderer) can be unit
 * tested directly rather than only through the component.
 */

/** A point on the infinite plane, or on the screen — the caller decides which. */
export interface CanvasPoint {
  x: number;
  y: number;
}

/** An axis-aligned rectangle. `width`/`height` are never negative. */
export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pixel dimensions of the canvas host element. */
export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * The affine viewport transform: `screen = world * zoom + pan`.
 *
 * `x`/`y` are the pan in **screen** pixels. This object is mutated in place on
 * the hot path — never wrap it in a signal (see the engine's zoneless rule).
 */
export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

/** Inclusive zoom bounds. */
export interface CanvasZoomLimits {
  minZoom: number;
  maxZoom: number;
}

/**
 * A positioned item on the plane. The engine only needs an identity and a
 * world-space box; everything else about an item belongs to the consumer's
 * projected template.
 */
export interface CanvasItem {
  id: string | number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How an edge is drawn between its two resolved endpoints. */
export type CanvasEdgeCurve = 'line' | 'bezier';

/**
 * A connection between two items, drawn on the edge canvas.
 *
 * Endpoints default to the items' centres. A consumer that attaches edges to
 * something more specific than "the middle of the box" — a node editor's
 * ports, an org-chart's connector stubs — supplies {@link sourceAnchor} /
 * {@link targetAnchor} instead. The engine stays deliberately ignorant of what
 * those offsets *mean*: it takes a point, not a port.
 */
export interface CanvasEdge {
  id: string | number;
  source: string | number;
  target: string | number;
  /** Any CSS colour. Defaults to the engine's `--border`-derived stroke. */
  color?: string;
  /** On-screen width in CSS pixels; kept constant across zoom levels. */
  width?: number;
  /** `setLineDash` pattern in world units. */
  dash?: readonly number[];
  /**
   * World-space offset from the **source item's origin** — not an absolute
   * point, so the edge follows the item when it moves. Omitted means centre.
   */
  sourceAnchor?: CanvasPoint;
  /** World-space offset from the target item's origin. Omitted means centre. */
  targetAnchor?: CanvasPoint;
  /**
   * `'bezier'` draws a cubic with horizontal tangents, the convention every
   * node-graph UI uses. Defaults to `'line'`.
   */
  curve?: CanvasEdgeCurve;
}

/** What `hitTest()` found under a point, in the engine's defined z-order. */
export interface CanvasHit {
  kind: 'item' | 'edge';
  id: string | number;
}

/** Serialized engine state. `version` guards future format changes. */
export interface CanvasSnapshot {
  version: 1;
  viewport: CanvasViewport;
  items: CanvasItem[];
  edges: CanvasEdge[];
}
