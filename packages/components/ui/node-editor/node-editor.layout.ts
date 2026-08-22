/**
 * Node geometry: how tall a node is, and where each of its ports sits.
 *
 * ### Why this is one module and not two
 *
 * A port is drawn twice: once as a dot positioned with CSS inside the node
 * card, and once as the endpoint of an edge painted on the engine's canvas.
 * Those are different rendering systems, and if each derived the port's
 * position independently they would eventually disagree — a sub-pixel drift
 * that looks like a rendering artefact and that nobody finds by reading code.
 *
 * So there is exactly one function that answers "where is this port", and both
 * the dot and the wire call it.
 */
import { isTouchDevice } from '../../lib/touch';
import type { CanvasPoint } from '../infinite-canvas';
import type { EditorNode, NodePort, PortDirection } from './node-editor.types';

/** Height of the node's title bar, in world units. */
export const NODE_HEADER_HEIGHT = 40;
/** Extra header height when the node has a subtitle. */
export const NODE_SUBTITLE_HEIGHT = 16;
/** Padding above the first port row and below the last. */
export const PORT_LIST_PADDING = 8;
/** Floor on a node's height, so a port-less node is still a usable target. */
export const NODE_MIN_HEIGHT = 56;
/** Default node width when an author does not set one. */
export const NODE_DEFAULT_WIDTH = 180;

/**
 * Tunable geometry — in practice, how tall a port row is.
 *
 * A port's tap target is its row. On a pointing device 24px is comfortable; on
 * a touch device CLAUDE.md §6 requires 44×44, and the only way to give a port
 * that much height *without adjacent ports' tap targets overlapping* is to
 * make the row itself that tall. Enlarging only the invisible hit area would
 * make neighbouring ports steal each other's taps, which is worse than a small
 * target because it fails unpredictably.
 *
 * It lives here rather than in CSS because the row height also determines
 * where the edge anchors — see this module's header.
 */
export interface PortMetrics {
  readonly rowHeight: number;
}

export const POINTER_METRICS: PortMetrics = { rowHeight: 24 };
/** 44px rows: WCAG 2.5.8 / Apple & Google HIG minimum tap target. */
export const TOUCH_METRICS: PortMetrics = { rowHeight: 44 };

/** The metrics for the current device. */
export function defaultMetrics(): PortMetrics {
  return isTouchDevice() ? TOUCH_METRICS : POINTER_METRICS;
}

/** The node's ports on one side, in declaration order. */
export function portsOnSide(
  node: Pick<EditorNode, 'ports'>,
  direction: PortDirection,
): readonly NodePort[] {
  return node.ports.filter(port => port.direction === direction);
}

/** Where the port rows begin, measured from the node's top edge. */
export function portListTop(node: Pick<EditorNode, 'subtitle'>): number {
  return (
    NODE_HEADER_HEIGHT + (node.subtitle ? NODE_SUBTITLE_HEIGHT : 0) + PORT_LIST_PADDING
  );
}

/**
 * A node's height, derived from its port count.
 *
 * Inputs and outputs stack in parallel columns, so the row count is the larger
 * of the two — not their sum.
 */
export function nodeHeight(
  node: Pick<EditorNode, 'ports' | 'subtitle'>,
  metrics: PortMetrics = defaultMetrics(),
): number {
  const rows = Math.max(
    portsOnSide(node, 'in').length,
    portsOnSide(node, 'out').length,
  );
  const content = portListTop(node) + rows * metrics.rowHeight + PORT_LIST_PADDING;
  return Math.max(NODE_MIN_HEIGHT, content);
}

/**
 * A port's vertical centre, measured from the node's top edge.
 *
 * `null` when the node has no such port — the caller decides whether that is a
 * skipped render or a dropped edge, and neither should be a thrown error on a
 * hot path.
 */
export function portOffsetTop(
  node: Pick<EditorNode, 'ports' | 'subtitle'>,
  portId: string,
  metrics: PortMetrics = defaultMetrics(),
): number | null {
  const port = node.ports.find(candidate => candidate.id === portId);
  if (!port) return null;

  const index = portsOnSide(node, port.direction).indexOf(port);
  return portListTop(node) + index * metrics.rowHeight + metrics.rowHeight / 2;
}

/**
 * A port's position as a world-space offset from the node's **origin**, which
 * is the form the engine's `sourceAnchor` / `targetAnchor` take.
 *
 * Relative, not absolute: a node being dragged moves its edges with it without
 * anyone recomputing anchors mid-drag.
 */
export function portAnchor(
  node: Pick<EditorNode, 'ports' | 'subtitle' | 'width'>,
  portId: string,
  metrics: PortMetrics = defaultMetrics(),
): CanvasPoint | null {
  const top = portOffsetTop(node, portId, metrics);
  if (top === null) return null;

  const port = node.ports.find(candidate => candidate.id === portId);
  // Inputs meet the left edge, outputs the right — the direction the bezier's
  // horizontal tangent then points is what makes flow readable at a glance.
  return { x: port?.direction === 'out' ? node.width : 0, y: top };
}

/** Every node's derived height applied, leaving untouched nodes referentially equal. */
export function withDerivedHeights(
  nodes: readonly EditorNode[],
  metrics: PortMetrics = defaultMetrics(),
): readonly EditorNode[] {
  let changed = false;
  const next = nodes.map(node => {
    const height = nodeHeight(node, metrics);
    if (height === node.height) return node;
    changed = true;
    return { ...node, height };
  });
  // Returning the same array when nothing moved keeps the engine's `items`
  // input from invalidating on every change-detection pass.
  return changed ? next : nodes;
}
