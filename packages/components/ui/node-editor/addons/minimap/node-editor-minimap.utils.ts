/**
 * The minimap's geometry, as pure functions.
 *
 * Separated from the component because "where does a world point land on the
 * minimap" is the part that is easy to get subtly wrong and impossible to
 * check by looking at a 160px thumbnail.
 */
import type { CanvasPoint, CanvasRect, EditorNode } from '../..';

/** Maps world coordinates onto minimap pixels. */
export interface MinimapTransform {
  readonly scale: number;
  /** Added AFTER scaling, to centre the content in the box. */
  readonly offsetX: number;
  readonly offsetY: number;
}

/** The box a set of nodes occupies, or `null` when there are none. */
export function contentBounds(nodes: readonly EditorNode[]): CanvasRect | null {
  if (nodes.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The union of the content and the viewport.
 *
 * Both, not just the content: pan away from every node and a content-only
 * minimap would show the graph filling the box while the viewport rectangle
 * sat off the edge — the one moment a minimap is most needed is the one it
 * would stop working.
 */
export function coverage(
  nodes: readonly EditorNode[],
  viewport: CanvasRect | null,
): CanvasRect | null {
  const content = contentBounds(nodes);
  if (!content) return viewport;
  if (!viewport) return content;

  const x = Math.min(content.x, viewport.x);
  const y = Math.min(content.y, viewport.y);
  return {
    x,
    y,
    width: Math.max(content.x + content.width, viewport.x + viewport.width) - x,
    height: Math.max(content.y + content.height, viewport.y + viewport.height) - y,
  };
}

/**
 * A transform fitting `area` into a `width` x `height` box, with padding.
 *
 * Uniform scale on both axes — a minimap that stretched to fill its box would
 * misrepresent the shape of the graph, which is the only thing it is for.
 */
export function fitTransform(
  area: CanvasRect | null,
  width: number,
  height: number,
  padding = 6,
): MinimapTransform {
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  if (!area || area.width <= 0 || area.height <= 0) {
    return { scale: 1, offsetX: padding, offsetY: padding };
  }

  const scale = Math.min(usableWidth / area.width, usableHeight / area.height);
  return {
    scale,
    offsetX: padding + (usableWidth - area.width * scale) / 2 - area.x * scale,
    offsetY: padding + (usableHeight - area.height * scale) / 2 - area.y * scale,
  };
}

/** World point to minimap pixel. */
export function toMinimap(point: CanvasPoint, transform: MinimapTransform): CanvasPoint {
  return {
    x: point.x * transform.scale + transform.offsetX,
    y: point.y * transform.scale + transform.offsetY,
  };
}

/** Minimap pixel back to world point — how a click navigates. */
export function toWorld(point: CanvasPoint, transform: MinimapTransform): CanvasPoint {
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale,
  };
}

/** A world rect projected onto the minimap. */
export function rectToMinimap(rect: CanvasRect, transform: MinimapTransform): CanvasRect {
  const origin = toMinimap({ x: rect.x, y: rect.y }, transform);
  return {
    x: origin.x,
    y: origin.y,
    width: rect.width * transform.scale,
    height: rect.height * transform.scale,
  };
}

/** Smallest on-screen size for the viewport rectangle, in minimap pixels. */
export const MIN_VIEWPORT_SIZE = 12;

/**
 * The viewport rectangle, never smaller than a grabbable size.
 *
 * Zoom far in on a large graph and the true rectangle becomes a couple of
 * pixels — visible, but impossible to grab, and worse on a touch screen where
 * the finger is the pointer. Enlarged about its own centre so it still points
 * at the right place.
 */
export function grabbableRect(rect: CanvasRect): CanvasRect {
  const width = Math.max(rect.width, MIN_VIEWPORT_SIZE);
  const height = Math.max(rect.height, MIN_VIEWPORT_SIZE);
  return {
    x: rect.x - (width - rect.width) / 2,
    y: rect.y - (height - rect.height) / 2,
    width,
    height,
  };
}
