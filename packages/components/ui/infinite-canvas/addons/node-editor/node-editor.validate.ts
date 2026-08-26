/**
 * Whether a connection may be made.
 *
 * ### Why this is a separate pure module
 *
 * There are two ways to connect two ports — dragging with a pointer, and
 * `Enter` on one port then `Enter` on another — and they run through entirely
 * different code paths. If each decided validity for itself they would drift,
 * and the failure mode is nasty: a keyboard user completing a connection the
 * mouse refuses, or refused one the mouse allows, with no way to tell which
 * behaviour is the intended one.
 *
 * So validity is decided here, once, and both paths ask.
 */
import { portsOf } from './node-editor.layout';
import type {
  NodeId,
  ConnectRejection,
  ConnectResult,
  EditorNode,
  NodeConnection,
  NodePort,
  PortRef,
} from './node-editor.types';

/** Everything `canConnect` needs to know about the graph. */
export interface GraphView {
  readonly nodes: readonly EditorNode[];
  readonly connections: readonly NodeConnection[];
  /**
   * When `false`, a connection that would close a directed cycle is refused.
   * Defaults to `true`: most graphs are not DAGs, and a DAG-only editor opts
   * in deliberately.
   */
  readonly allowCycles?: boolean;
}

/** A port reference looked up against the graph. */
type Resolution =
  | { readonly ok: true; readonly node: EditorNode; readonly port: NodePort }
  | { readonly ok: false; readonly reason: ConnectRejection };

function reject(reason: ConnectRejection): ConnectResult {
  return { ok: false, reason };
}

function resolve(nodes: readonly EditorNode[], ref: PortRef): Resolution {
  const node = nodes.find(candidate => candidate.id === ref.node);
  if (!node) return { ok: false, reason: 'unknown-node' };
  const port = portsOf(node).find(candidate => candidate.id === ref.port);
  if (!port) return { ok: false, reason: 'unknown-port' };
  return { ok: true, node, port };
}

/** True when the two ports' declared types are incompatible. */
function typesConflict(a: NodePort, b: NodePort): boolean {
  // An absent type means "compatible with anything", so only two *stated*
  // types can conflict.
  return a.type !== undefined && b.type !== undefined && a.type !== b.type;
}

function isDuplicate(
  connections: readonly NodeConnection[],
  out: PortRef,
  into: PortRef,
): boolean {
  return connections.some(
    connection =>
      connection.source === out.node &&
      connection.sourcePort === out.port &&
      connection.target === into.node &&
      connection.targetPort === into.port,
  );
}

function isOccupied(
  connections: readonly NodeConnection[],
  inPort: NodePort,
  into: PortRef,
): boolean {
  if (inPort.multiple) return false;
  return connections.some(
    connection => connection.target === into.node && connection.targetPort === into.port,
  );
}

/**
 * Whether `from` is already reachable from `to` by following existing
 * connections — in which case adding `to → from` would close a cycle.
 *
 * Iterative rather than recursive: a deep chain in a user-authored graph
 * should not be able to blow the stack.
 */
function reaches(
  connections: readonly NodeConnection[],
  start: NodeId,
  goal: NodeId,
): boolean {
  const stack: (NodeId)[] = [start];
  const seen = new Set<NodeId>();

  while (stack.length > 0) {
    const current = stack.pop() as NodeId;
    if (current === goal) return true;
    if (seen.has(current)) continue;
    seen.add(current);

    for (const connection of connections) {
      if (connection.source === current) stack.push(connection.target);
    }
  }
  return false;
}

/**
 * Whether two ports may be connected, and if so which way round.
 *
 * The endpoints may be given in either order — the user is as likely to drag
 * from an input back to an output — and a successful result reports them
 * normalised with the `out` side as `source`.
 */
export function canConnect(graph: GraphView, a: PortRef, b: PortRef): ConnectResult {
  const left = resolve(graph.nodes, a);
  if (!left.ok) return reject(left.reason);
  const right = resolve(graph.nodes, b);
  if (!right.ok) return reject(right.reason);

  if (left.node.id === right.node.id) return reject('same-node');
  if (left.port.direction === right.port.direction) return reject('same-direction');
  if (left.port.disabled || right.port.disabled) return reject('port-disabled');
  if (typesConflict(left.port, right.port)) return reject('type-mismatch');

  const [from, to] = left.port.direction === 'out' ? [left, right] : [right, left];
  const source: PortRef = { node: from.node.id, port: from.port.id };
  const target: PortRef = { node: to.node.id, port: to.port.id };

  if (isDuplicate(graph.connections, source, target)) return reject('duplicate');
  if (isOccupied(graph.connections, to.port, target)) return reject('occupied');

  const allowCycles = graph.allowCycles ?? true;
  if (!allowCycles && reaches(graph.connections, target.node, source.node)) {
    return reject('cycle');
  }

  return { ok: true, source, target };
}
