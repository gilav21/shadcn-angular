import type {
  CanvasPoint,
  CanvasRect,
  CanvasSize,
  CanvasViewport,
  CanvasZoomLimits,
} from './infinite-canvas.types';

/**
 * Pure viewport maths for the infinite-canvas engine.
 *
 * Every function here is side-effect free and takes plain objects, so the whole
 * transform model is unit-testable without instantiating a component. The
 * component layer holds one mutable {@link CanvasViewport} and uses these
 * helpers to compute its next value.
 */

/** Far enough out that a 10,000-item graph fits on screen. */
export const DEFAULT_MIN_ZOOM = 0.05;
/** Far enough in that item text stays comfortably readable. */
export const DEFAULT_MAX_ZOOM = 8;
/** Breathing room left around the bounds by {@link fitView}, in screen pixels. */
export const DEFAULT_FIT_PADDING = 48;

/** The viewport used when there is nothing to look at. */
function identityViewport(): CanvasViewport {
  return { x: 0, y: 0, zoom: 1 };
}

/**
 * Clamps `zoom` into `limits`, treating a non-finite value as out of range on
 * whichever side is closer.
 *
 * The upper bound is applied first so that **inverted limits resolve to
 * `minZoom`** rather than to a value outside both bounds. A misconfigured input
 * can therefore never produce a `NaN` or out-of-range transform.
 */
export function clampZoom(zoom: number, limits: CanvasZoomLimits): number {
  const { minZoom, maxZoom } = limits;
  if (!Number.isFinite(zoom)) return zoom > 0 ? maxZoom : minZoom;
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}

/** `screen = world * zoom + pan`. */
export function worldToScreen(point: CanvasPoint, viewport: CanvasViewport): CanvasPoint {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}

/** The inverse of {@link worldToScreen}. */
export function screenToWorld(point: CanvasPoint, viewport: CanvasViewport): CanvasPoint {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

/**
 * Multiplies the zoom by `factor` while holding the world point currently under
 * `anchor` (a screen point) still. The pan is recomputed from the **clamped**
 * zoom, so hitting a limit does not drift the anchor.
 */
export function zoomAbout(
  viewport: CanvasViewport,
  factor: number,
  anchor: CanvasPoint,
  limits: CanvasZoomLimits,
): CanvasViewport {
  const zoom = clampZoom(viewport.zoom * factor, limits);
  const world = screenToWorld(anchor, viewport);
  return {
    x: anchor.x - world.x * zoom,
    y: anchor.y - world.y * zoom,
    zoom,
  };
}

/** Zooms to an absolute level about the centre of the viewport. */
export function zoomToLevel(
  viewport: CanvasViewport,
  zoom: number,
  size: CanvasSize,
  limits: CanvasZoomLimits,
): CanvasViewport {
  const anchor = { x: size.width / 2, y: size.height / 2 };
  const target = clampZoom(zoom, limits);
  return zoomAbout(viewport, target / viewport.zoom, anchor, limits);
}

/** Translates by a **screen-space** delta, leaving the zoom untouched. */
export function panBy(viewport: CanvasViewport, dx: number, dy: number): CanvasViewport {
  return { x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom };
}

/** Centres `worldPoint` in a viewport of `size`, keeping the current zoom. */
export function panTo(viewport: CanvasViewport, worldPoint: CanvasPoint, size: CanvasSize): CanvasViewport {
  return {
    x: size.width / 2 - worldPoint.x * viewport.zoom,
    y: size.height / 2 - worldPoint.y * viewport.zoom,
    zoom: viewport.zoom,
  };
}

/** The world-space rectangle currently covered by a viewport of `size`. */
export function visibleWorldRect(viewport: CanvasViewport, size: CanvasSize): CanvasRect {
  const topLeft = screenToWorld({ x: 0, y: 0 }, viewport);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: size.width / viewport.zoom,
    height: size.height / viewport.zoom,
  };
}

/** Grows a rectangle by `margin` on every side. */
export function inflateRect(rect: CanvasRect, margin: number): CanvasRect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}

/** Whether two rectangles overlap. Edge-touching counts as overlapping. */
export function rectsIntersect(a: CanvasRect, b: CanvasRect): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}

/** Whether `outer` fully contains `inner`. */
export function rectContains(outer: CanvasRect, inner: CanvasRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** The union of every rectangle, or `null` for an empty list. */
export function boundsOf(rects: readonly CanvasRect[]): CanvasRect | null {
  if (rects.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const rect of rects) {
    if (rect.x < minX) minX = rect.x;
    if (rect.y < minY) minY = rect.y;
    if (rect.x + rect.width > maxX) maxX = rect.x + rect.width;
    if (rect.y + rect.height > maxY) maxY = rect.y + rect.height;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export interface FitViewOptions extends CanvasZoomLimits {
  /** Screen-pixel gap left between the bounds and the container edge. */
  padding: number;
}

/**
 * Picks the scale that makes `bounds` fill `size` (minus `padding`) and centres
 * it. A degenerate bounds — zero items, a zero-size container, or every item at
 * the same coordinate — falls back to zoom 1 rather than dividing by zero.
 */
export function fitView(bounds: CanvasRect | null, size: CanvasSize, options: FitViewOptions): CanvasViewport {
  if (!bounds || size.width <= 0 || size.height <= 0) return identityViewport();

  const available = {
    width: Math.max(1, size.width - options.padding * 2),
    height: Math.max(1, size.height - options.padding * 2),
  };

  const zoom = clampZoom(fitScale(bounds, available), options);
  const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };

  return {
    x: size.width / 2 - centre.x * zoom,
    y: size.height / 2 - centre.y * zoom,
    zoom,
  };
}

/** The largest uniform scale fitting `bounds` into `available`; 1 if degenerate. */
function fitScale(bounds: CanvasRect, available: CanvasSize): number {
  const scaleX = bounds.width > 0 ? available.width / bounds.width : Number.POSITIVE_INFINITY;
  const scaleY = bounds.height > 0 ? available.height / bounds.height : Number.POSITIVE_INFINITY;
  const scale = Math.min(scaleX, scaleY);
  return Number.isFinite(scale) ? scale : 1;
}

/**
 * The composited transform for the zero-sized wrapper. `translate3d` (rather
 * than `translate`) is deliberate: it is what keeps the layer on the GPU.
 */
export function transformCss(viewport: CanvasViewport): string {
  return `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`;
}
