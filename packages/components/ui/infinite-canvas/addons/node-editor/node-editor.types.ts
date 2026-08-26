/**
 * Value types for the node editor.
 *
 * Plain data with no Angular dependency, so layout, validation and the graph
 * helpers are unit tested directly rather than only through the component.
 */
import type { CanvasItem, CanvasPoint } from '../..';

/**
 * A node's identity.
 *
 * Named rather than spelled out at each use: it appears in the node, the
 * connection, the port reference and the selection, and a bare
 * `string | number` repeated that many times stops reading as one concept.
 */
export type NodeId = string | number;

/** Which side of a node a port lives on, and which way data flows through it. */
export type PortDirection = 'in' | 'out';

/** A named connection point on a node. */
export interface NodePort {
  id: string;
  direction: PortDirection;
  /** Shown beside the port dot, and used verbatim in every announcement. */
  label: string;
  /**
   * Free-form compatibility tag. A connection is allowed only between ports
   * with an equal `type`, or when either side omits it — so a graph that does
   * not care about types simply never sets one.
   */
  type?: string;
  /** An `'in'` port holds one connection unless this is `true`. */
  multiple?: boolean;
  disabled?: boolean;
}

/**
 * A node on the plane.
 *
 * Extends {@link CanvasItem} so the same array feeds the engine with no
 * mapping step. Authors set `x`, `y` and `width`; **`height` is derived** from
 * the port count by `nodeHeight()` and written back, because a hand-set height
 * that disagrees with the rendered card puts every port anchor in the wrong
 * place.
 */
export interface EditorNode extends CanvasItem {
  /**
   * Optional for the same reason `ports` is: a typed node takes its label from
   * its definition. Always populated by the time a node reaches rendering.
   */
  title?: string;
  subtitle?: string;
  /**
   * The node type's id, when this node is backed by a registered
   * {@link NodeTypeDefinition}. The editor then MATERIALISES `ports`, `title`
   * and `accent` from that definition, so the definition stays the single
   * source of truth and every consumer can still read `node.ports`.
   *
   * Omit it for a purely structural graph, which is what the editor was before
   * it had a runtime — that mode still works unchanged.
   */
  type?: string;
  /**
   * Optional only for authors: a typed node inherits its ports from its
   * definition. Always populated by the time a node reaches rendering.
   */
  ports?: readonly NodePort[];
  /** Any CSS colour, painted as the node's header accent. */
  accent?: string;
  /** Selectable, but neither movable nor deletable. */
  locked?: boolean;
}

/** An edge between one node's `out` port and another's `in` port. */
export interface NodeConnection {
  id: string;
  source: NodeId;
  sourcePort: string;
  target: NodeId;
  targetPort: string;
  /** Any CSS colour. Defaults to the editor's themed stroke. */
  color?: string;
}

/** One end of a prospective or existing connection. */
export interface PortRef {
  node: NodeId;
  port: string;
}

/** Why a connection was refused. Announced, surfaced, and asserted on. */
export type ConnectRejection =
  | 'unknown-node'
  | 'unknown-port'
  | 'same-node'
  | 'same-direction'
  | 'port-disabled'
  | 'type-mismatch'
  | 'duplicate'
  | 'occupied'
  | 'cycle';

/**
 * The outcome of {@link canConnect}.
 *
 * On success it reports the endpoints **normalised** so `source` is always the
 * `out` side, whichever way round the user dragged.
 */
export type ConnectResult =
  | { readonly ok: true; readonly source: PortRef; readonly target: PortRef }
  | { readonly ok: false; readonly reason: ConnectRejection };

/** A connection being dragged out, before it is committed or discarded. */
export interface PendingConnection {
  /** The fixed end — the port the drag started from. */
  readonly from: PortRef;
  /** The free end, in world coordinates. */
  readonly to: CanvasPoint;
  /** The port currently under the free end, if any. */
  readonly over: PortRef | null;
  /** Whether dropping right now would be accepted. */
  readonly valid: boolean;
  /**
   * The connection this drag detached, if it began by grabbing an existing
   * edge. Dropping in empty space deletes it rather than restoring it.
   */
  readonly detached: NodeConnection | null;
}

/** What the editor currently has selected. */
export interface EditorSelection {
  readonly nodes: readonly (NodeId)[];
  readonly connections: readonly string[];
}
