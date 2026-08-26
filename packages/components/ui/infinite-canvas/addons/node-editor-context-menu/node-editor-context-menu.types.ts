/**
 * What was right-clicked.
 *
 * A context menu is only worth having if its contents depend on where it was
 * opened, so the whole point of this addon is answering that question
 * precisely: not "the graph", but *this node*, *that port*, *that wire*, or
 * empty plane.
 */
import type { CanvasPoint, EditorNode, NodeConnection, NodeId, PortDirection } from '../node-editor';

/** Empty plane. The only target that can meaningfully offer "add a node". */
export interface CanvasContextTarget {
  readonly kind: 'canvas';
  /** Where the pointer was, in WORLD units — where a new node should land. */
  readonly at: CanvasPoint;
  readonly screen: CanvasPoint;
}

export interface NodeContextTarget {
  readonly kind: 'node';
  readonly nodeId: NodeId;
  /**
   * The node itself, so a menu can decide what to offer from what it IS —
   * "options per what you right click" means reading the node, not just its
   * id. A subgraph node offers "open"; a locked one offers neither move nor
   * delete.
   */
  readonly node: EditorNode;
  readonly at: CanvasPoint;
  readonly screen: CanvasPoint;
}

export interface PortContextTarget {
  readonly kind: 'port';
  readonly nodeId: NodeId;
  readonly portId: string;
  readonly direction: PortDirection;
  /** Connections landing on this port, so "disconnect" knows what it removes. */
  readonly connections: readonly NodeConnection[];
  readonly at: CanvasPoint;
  readonly screen: CanvasPoint;
}

export interface ConnectionContextTarget {
  readonly kind: 'connection';
  readonly connection: NodeConnection;
  readonly at: CanvasPoint;
  readonly screen: CanvasPoint;
}

export type NodeEditorContextTarget =
  | CanvasContextTarget
  | NodeContextTarget
  | PortContextTarget
  | ConnectionContextTarget;
