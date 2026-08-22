/**
 * Turning the editor's graph into what the engine draws, and the small
 * mutations the interactions need.
 *
 * The editor never paints an edge itself. It computes port anchors and hands
 * the engine a `CanvasEdge[]`; there is one edge renderer in the library and
 * this is what feeds it.
 */
import type { CanvasEdge } from '../infinite-canvas';
import { defaultMetrics, portAnchor, type PortMetrics } from './node-editor.layout';
import type { EditorNode, NodeConnection, NodeId, PortRef } from './node-editor.types';

/** Stroke width of a normal edge, in screen pixels. */
export const EDGE_WIDTH = 2;
/** Stroke width of a selected edge. */
export const EDGE_SELECTED_WIDTH = 3;
/** Dash pattern for the edge being dragged out. */
export const PENDING_DASH = [6, 4] as const;

/** Nodes keyed by id, for the anchor lookups below. */
export function indexNodes(
  nodes: readonly EditorNode[],
): ReadonlyMap<NodeId, EditorNode> {
  return new Map(nodes.map(node => [node.id, node]));
}

/**
 * Which connections touch each node.
 *
 * Dragging one node must re-anchor only the edges attached to it. Without this
 * index that is a scan of every connection per frame, which is fine at fifty
 * edges and is not fine at the scale the engine was built for.
 */
export function adjacency(
  connections: readonly NodeConnection[],
): ReadonlyMap<NodeId, readonly string[]> {
  const index = new Map<NodeId, string[]>();
  const add = (nodeId: NodeId, connectionId: string): void => {
    const list = index.get(nodeId);
    if (list) list.push(connectionId);
    else index.set(nodeId, [connectionId]);
  };

  for (const connection of connections) {
    add(connection.source, connection.id);
    // A self-connection is rejected by `canConnect`, but a caller may still
    // hand us one; listing it twice would re-anchor it twice, harmlessly.
    add(connection.target, connection.id);
  }
  return index;
}

/** The connection ids that must be re-anchored when these nodes move. */
export function touchedBy(
  index: ReadonlyMap<NodeId, readonly string[]>,
  nodeIds: Iterable<NodeId>,
): readonly string[] {
  const touched = new Set<string>();
  for (const nodeId of nodeIds) {
    for (const connectionId of index.get(nodeId) ?? []) touched.add(connectionId);
  }
  return [...touched];
}

/** How an edge should be styled for this render. */
export interface EdgeStyle {
  /** Ids of the selected connections. */
  readonly selected?: ReadonlySet<string>;
  /** Colour used when a connection declares none. */
  readonly defaultColor?: string;
  /** Colour used for the selected ones. */
  readonly selectedColor?: string;
  /** Port geometry; resolved from the device when omitted. */
  readonly metrics?: PortMetrics;
}

/**
 * The engine edges for a set of connections.
 *
 * A connection whose node or port no longer exists is **skipped**, not thrown
 * on: a graph mid-edit is routinely inconsistent for a frame, and an exception
 * on the render path would take the whole canvas down over a stale id.
 */
export function toCanvasEdges(
  nodes: readonly EditorNode[],
  connections: readonly NodeConnection[],
  style: EdgeStyle = {},
): CanvasEdge[] {
  const byId = indexNodes(nodes);
  const metrics = style.metrics ?? defaultMetrics();
  const edges: CanvasEdge[] = [];

  for (const connection of connections) {
    const source = byId.get(connection.source);
    const target = byId.get(connection.target);
    if (!source || !target) continue;

    const sourceAnchor = portAnchor(source, connection.sourcePort, metrics);
    const targetAnchor = portAnchor(target, connection.targetPort, metrics);
    if (!sourceAnchor || !targetAnchor) continue;

    const isSelected = style.selected?.has(connection.id) ?? false;
    edges.push({
      id: connection.id,
      source: connection.source,
      target: connection.target,
      sourceAnchor,
      targetAnchor,
      curve: 'bezier',
      color: connection.color ?? (isSelected ? style.selectedColor : style.defaultColor),
      width: isSelected ? EDGE_SELECTED_WIDTH : EDGE_WIDTH,
    });
  }
  return edges;
}

/** Whether two port references point at the same port. */
export function samePort(a: PortRef | null, b: PortRef | null): boolean {
  return a !== null && b !== null && a.node === b.node && a.port === b.port;
}

/** The connection landing on this `in` port, if any. */
export function connectionInto(
  connections: readonly NodeConnection[],
  ref: PortRef,
): NodeConnection | null {
  return (
    connections.find(
      connection => connection.target === ref.node && connection.targetPort === ref.port,
    ) ?? null
  );
}

/**
 * A connection id that does not collide with an existing one.
 *
 * Deliberately derived from the endpoints rather than random: it makes a graph
 * round-trip through JSON stably, and `Math.random()` in shipped component
 * source is a finding in this repo's security scan.
 */
export function connectionId(source: PortRef, target: PortRef): string {
  return `${source.node}:${source.port}->${target.node}:${target.port}`;
}

/** The graph with a connection added. */
export function addConnection(
  connections: readonly NodeConnection[],
  source: PortRef,
  target: PortRef,
): readonly NodeConnection[] {
  return [
    ...connections,
    {
      id: connectionId(source, target),
      source: source.node,
      sourcePort: source.port,
      target: target.node,
      targetPort: target.port,
    },
  ];
}

/** The graph with these connections removed. */
export function removeConnections(
  connections: readonly NodeConnection[],
  ids: Iterable<string>,
): readonly NodeConnection[] {
  const drop = new Set(ids);
  if (drop.size === 0) return connections;
  return connections.filter(connection => !drop.has(connection.id));
}

/**
 * The graph with these nodes removed, **and every connection touching them**.
 *
 * Leaving dangling connections behind would be invisible — `toCanvasEdges`
 * skips them — right up until the node id is reused and they reappear.
 */
export function removeNodes(
  nodes: readonly EditorNode[],
  connections: readonly NodeConnection[],
  ids: Iterable<NodeId>,
): { nodes: readonly EditorNode[]; connections: readonly NodeConnection[] } {
  const drop = new Set(ids);
  if (drop.size === 0) return { nodes, connections };

  const locked = new Set(
    nodes.filter(node => node.locked && drop.has(node.id)).map(node => node.id),
  );
  const removable = new Set([...drop].filter(id => !locked.has(id)));

  return {
    nodes: nodes.filter(node => !removable.has(node.id)),
    connections: connections.filter(
      connection => !removable.has(connection.source) && !removable.has(connection.target),
    ),
  };
}
