/**
 * The graph as a versioned JSON document.
 *
 * One format serves four jobs — save/load, the `executeRemote` payload shape,
 * undo snapshots, and e2e fixtures — which is the reason the base owns it
 * rather than leaving every consumer to invent one.
 *
 * `version` is present from v1 so a migration has somewhere to hook, rather
 * than being added in a hurry the first time the shape changes.
 */
import type { EditorNode, NodeConnection, NodeId } from './node-editor.types';

export const GRAPH_FORMAT_VERSION = 1;

/** One node, as stored. Geometry the editor derives is deliberately absent. */
export interface SerializedNode {
  readonly id: NodeId;
  readonly type?: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly title?: string;
  /** Per-node state. Must be JSON-safe — see {@link findUnserializableState}. */
  readonly state?: unknown;
}

/**
 * One connection, as stored.
 *
 * `from`/`to` are tuples rather than four flat fields: an endpoint is a single
 * concept, and the pair reads the way the graph does.
 */
export interface SerializedConnection {
  readonly id: string;
  readonly from: readonly [NodeId, string];
  readonly to: readonly [NodeId, string];
}

export interface SerializedGraph {
  readonly version: number;
  readonly nodes: readonly SerializedNode[];
  readonly connections: readonly SerializedConnection[];
}

/** What a deserialised document produces. */
export interface DeserializedGraph {
  readonly nodes: readonly EditorNode[];
  readonly connections: readonly NodeConnection[];
  readonly states: ReadonlyMap<NodeId, unknown>;
}

/** Width a node falls back to when the document does not carry one. */
const DEFAULT_WIDTH = 190;

/**
 * Serialise.
 *
 * `height` is never written: it is derived from the port count, and storing a
 * value that disagrees with the rendered card would put every port anchor in
 * the wrong place on load. Ports are not written either when the node has a
 * `type` — the definition owns them.
 */
export function serializeGraph(
  nodes: readonly EditorNode[],
  connections: readonly NodeConnection[],
  states: ReadonlyMap<NodeId, unknown> = new Map(),
): SerializedGraph {
  return {
    version: GRAPH_FORMAT_VERSION,
    nodes: nodes.map(node => {
      const state = states.get(node.id);
      return {
        id: node.id,
        ...(node.type === undefined ? {} : { type: node.type }),
        x: node.x,
        y: node.y,
        width: node.width,
        title: node.title,
        ...(state === undefined ? {} : { state }),
      };
    }),
    connections: connections.map(c => ({
      id: c.id,
      from: [c.source, c.sourcePort] as const,
      to: [c.target, c.targetPort] as const,
    })),
  };
}

/** Raised when a document cannot be read, saying which part and why. */
export class GraphFormatError extends Error {
  constructor(message: string) {
    super(`node-editor: ${message}`);
    this.name = 'GraphFormatError';
  }
}

/**
 * Deserialise.
 *
 * Validates rather than trusting: a graph document is data from disk or from
 * the network, and a malformed one should say what is wrong instead of
 * producing a half-built editor that fails later somewhere unrelated.
 */
export function deserializeGraph(input: unknown): DeserializedGraph {
  const document = input as Partial<SerializedGraph> | null;
  if (!document || typeof document !== 'object') {
    throw new GraphFormatError('graph document is not an object.');
  }
  if (typeof document.version !== 'number') {
    throw new GraphFormatError('graph document has no version.');
  }
  if (document.version > GRAPH_FORMAT_VERSION) {
    throw new GraphFormatError(
      `graph document is version ${document.version}, but this build reads up to ${GRAPH_FORMAT_VERSION}.`,
    );
  }
  if (!Array.isArray(document.nodes) || !Array.isArray(document.connections)) {
    throw new GraphFormatError('graph document must have `nodes` and `connections` arrays.');
  }

  const states = new Map<NodeId, unknown>();
  const nodes: EditorNode[] = document.nodes.map(node => {
    if (node.state !== undefined) states.set(node.id, node.state);
    return {
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      width: node.width ?? DEFAULT_WIDTH,
      // Derived on load from the port count, never read from the document.
      height: 0,
      title: node.title ?? String(node.id),
    };
  });

  const known = new Set(nodes.map(n => n.id));
  const connections: NodeConnection[] = document.connections.map(c => {
    if (!known.has(c.from[0]) || !known.has(c.to[0])) {
      throw new GraphFormatError(
        `connection “${c.id}” refers to a node that is not in the document.`,
      );
    }
    return {
      id: c.id,
      source: c.from[0],
      sourcePort: c.from[1],
      target: c.to[0],
      targetPort: c.to[1],
    };
  });

  return { nodes, connections, states };
}

/**
 * The first node whose state will not survive a round trip, or `null`.
 *
 * The contract says state must be JSON-safe. Checking it in development and
 * naming the node turns a silent data loss — a `Map` quietly becoming `{}` on
 * reload — into an error the author can act on.
 *
 * ### Why this walks the value instead of comparing round trips
 *
 * The obvious check, `JSON.stringify(x) !== JSON.stringify(roundTrip(x))`,
 * does not work, and fails on the very case it most needs to catch:
 * `JSON.stringify(new Map([['a', 1]]))` is `'{}'`, and so is the stringified
 * round trip, so the two compare EQUAL and the Map sails through. Found by the
 * test for it, which is the only reason this comment exists.
 */
export function findUnserializableState(
  states: ReadonlyMap<NodeId, unknown>,
): { nodeId: NodeId; reason: string } | null {
  for (const [nodeId, state] of states) {
    if (state === undefined) continue;
    const reason = describeUnserializable(state, '', new Set());
    if (reason !== null) return { nodeId, reason };
  }
  return null;
}

/** Describes the first JSON-unsafe value found, with its path, or `null`. */
function describeUnserializable(value: unknown, path: string, seen: Set<object>): string | null {
  const where = path === '' ? 'state' : `state${path}`;
  if (value === null) return null;

  return typeof value === 'object'
    ? describeObject(value as object, path, where, seen)
    : describePrimitive(value, where);
}

function describePrimitive(value: unknown, where: string): string | null {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return null;
    case 'number':
      // NaN and Infinity are both written as `null`, which is silent loss.
      return Number.isFinite(value) ? null : `${where} is ${String(value)}, which JSON writes as null`;
    case 'bigint':
      return `${where} is a BigInt, which JSON cannot write`;
    case 'function':
      return `${where} is a function`;
    case 'symbol':
      return `${where} is a symbol`;
    default:
      return `${where} is ${typeof value}`;
  }
}

function describeObject(
  object: object,
  path: string,
  where: string,
  seen: Set<object>,
): string | null {
  if (seen.has(object)) return `${where} is circular`;
  seen.add(object);

  if (Array.isArray(object)) return describeEntries(object.entries(), path, seen, true);

  // A plain object is the only other shape JSON preserves. A Date becomes a
  // string, a Map or Set becomes `{}`, and a class instance loses its
  // prototype — all of them silently.
  const prototype = Object.getPrototypeOf(object) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    return `${where} is a ${object.constructor?.name ?? 'non-plain object'}, which JSON cannot round-trip`;
  }
  return describeEntries(Object.entries(object), path, seen, false);
}

function describeEntries(
  entries: Iterable<readonly [PropertyKey, unknown]>,
  path: string,
  seen: Set<object>,
  indexed: boolean,
): string | null {
  for (const [key, item] of entries) {
    const childPath = indexed ? `${path}[${String(key)}]` : `${path}.${String(key)}`;
    const found = describeUnserializable(item, childPath, seen);
    if (found !== null) return found;
  }
  return null;
}
