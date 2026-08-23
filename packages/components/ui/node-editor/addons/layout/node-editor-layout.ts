/**
 * Layered (Sugiyama) layout for a node graph.
 *
 * ### Why layered and not force-directed
 *
 * A force-directed layout produces a *different* arrangement every run. For a
 * workflow diagram that is disqualifying: the picture someone learned yesterday
 * is not the picture they get today, screenshots stop matching, and re-running
 * the layout feels like damage rather than tidying. Layered is deterministic —
 * the same graph always lays out the same way.
 *
 * It is also the right shape for the domain. A workflow *is* layers: things
 * that can run now, then things that depend on them.
 *
 * ### Why this is a pure function
 *
 * Nodes and edges in, positions out. No DOM, no Angular, no editor. It is the
 * cleanest illustration of the addon boundary in the suite, and it means the
 * same function could run on a server to lay out a graph nobody is looking at.
 */
import type { CanvasPoint, CanvasRect, EditorNode, NodeConnection, NodeId } from '../..';

export type LayoutDirection = 'LR' | 'TB';

export interface LayoutOptions {
  /** `LR` puts dependencies to the left; `TB` puts them above. */
  readonly direction?: LayoutDirection;
  /** Gap between layers, in world units. */
  readonly layerGap?: number;
  /** Gap between nodes within a layer. */
  readonly nodeGap?: number;
  /** Where the laid-out graph starts. */
  readonly origin?: CanvasPoint;
  /** Sweeps of the crossing-reduction pass. More is tidier and slower. */
  readonly sweeps?: number;
  /** Room left around a cluster's members, for the frame drawn around them. */
  readonly clusterPadding?: number;
  /**
   * Which cluster a node belongs to — a group frame, usually. `null` for none.
   *
   * A dependency layout and a spatial grouping pull in opposite directions: the
   * layout spreads a group's members across layers by what they depend on,
   * and then a frame re-fitted around them is a box big enough to swallow
   * every unrelated node that landed in between. Reported bluntly, and
   * correctly, as "the tidy does a really bad job".
   *
   * So a cluster is laid out as a UNIT: its members are arranged among
   * themselves, the whole block is treated as one node in the outer layout,
   * and the members are placed back inside it. Nothing that is not a member
   * can land in the middle of one, which is the guarantee that matters — a
   * tidy that quietly changes what a zone contains is worse than no tidy at
   * all.
   */
  readonly clusterOf?: (nodeId: NodeId) => string | null;
}

type ResolvedOptions = Required<LayoutOptions>;

const DEFAULTS: ResolvedOptions = {
  direction: 'LR' as LayoutDirection,
  layerGap: 80,
  nodeGap: 32,
  origin: { x: 0, y: 0 },
  sweeps: 4,
  clusterPadding: 40,
  clusterOf: () => null,
};

interface Edge {
  readonly from: NodeId;
  readonly to: NodeId;
}

/**
 * Edges with cycles broken, for layering purposes only.
 *
 * A cyclic graph has no layering at all, so back-edges are set aside — the
 * same thing `dot` does. They are ignored only for POSITIONING; the graph is
 * untouched and a cycle is still a cycle to the runtime.
 *
 * ### Why this needs a proper DFS and not a traversal index
 *
 * The tempting shortcut is to rank nodes by discovery order and call any edge
 * pointing "backwards" a cycle. That is wrong, and wrong on ordinary acyclic
 * graphs: with a→b, b→c and a→c, a depth-first walk can reach c before b, and
 * the shortcut then discards b→c — a perfectly forward edge — collapsing c
 * into the wrong layer. Found by the test for longest-path layering.
 *
 * A back edge is one pointing at a node still on the DFS stack. Nothing else.
 */
function withoutBackEdges(nodes: readonly NodeId[], edges: readonly Edge[]): readonly Edge[] {
  const outgoing = new Map<NodeId, number[]>();
  for (const node of nodes) outgoing.set(node, []);
  edges.forEach((edge, index) => outgoing.get(edge.from)?.push(index));

  const OPEN = 1;
  const DONE = 2;
  const state = new Map<NodeId, number>();
  const back = new Set<number>();

  for (const root of nodes) {
    if (state.has(root)) continue;
    state.set(root, OPEN);
    const stack: { node: NodeId; next: number }[] = [{ node: root, next: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const candidates = outgoing.get(frame.node) ?? [];

      if (frame.next >= candidates.length) {
        state.set(frame.node, DONE);
        stack.pop();
        continue;
      }

      const index = candidates[frame.next++];
      const target = edges[index].to;
      const seen = state.get(target);
      if (seen === OPEN) back.add(index);          // still on the stack: a cycle
      else if (seen === undefined) {
        state.set(target, OPEN);
        stack.push({ node: target, next: 0 });
      }
    }
  }
  return edges.filter((_, index) => !back.has(index));
}

/**
 * Layer per node: the longest path from any root.
 *
 * Longest rather than shortest, so a node sits after everything it depends on
 * rather than as early as possible — which is what makes the layers read as
 * "stages" instead of a ragged edge.
 */
function assignLayers(
  nodes: readonly NodeId[],
  edges: readonly Edge[],
): ReadonlyMap<NodeId, number> {
  const incoming = new Map<NodeId, NodeId[]>();
  const outgoing = new Map<NodeId, NodeId[]>();
  for (const node of nodes) {
    incoming.set(node, []);
    outgoing.set(node, []);
  }
  for (const edge of edges) {
    incoming.get(edge.to)?.push(edge.from);
    outgoing.get(edge.from)?.push(edge.to);
  }

  const layer = new Map<NodeId, number>(nodes.map(node => [node, 0]));
  const pending = new Map<NodeId, number>(
    nodes.map(node => [node, incoming.get(node)?.length ?? 0]),
  );
  const queue = nodes.filter(node => (pending.get(node) ?? 0) === 0);

  let guard = 0;
  while (queue.length > 0) {
    if (++guard > nodes.length * 4 + 16) break;      // pathological input
    const node = queue.shift() as NodeId;
    for (const next of outgoing.get(node) ?? []) {
      layer.set(next, Math.max(layer.get(next) ?? 0, (layer.get(node) ?? 0) + 1));
      const left = (pending.get(next) ?? 1) - 1;
      pending.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  return layer;
}

/** The median of a node's neighbours' positions, or -1 when it has none. */
function medianOf(positions: readonly number[]): number {
  if (positions.length === 0) return -1;
  const sorted = [...positions].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Order within each layer, reducing crossings by the median heuristic.
 *
 * A node is placed near the median of the things it connects to in the
 * neighbouring layer, sweeping down then up a few times. It is a heuristic —
 * minimising crossings exactly is NP-hard — but a couple of sweeps removes
 * most of them, and the result is stable because the input order is.
 */
function orderLayers(
  layers: readonly NodeId[][],
  edges: readonly Edge[],
  sweeps: number,
): readonly NodeId[][] {
  const ordered = layers.map(layer => [...layer]);
  const upstream = new Map<NodeId, NodeId[]>();
  const downstream = new Map<NodeId, NodeId[]>();
  const push = (index: Map<NodeId, NodeId[]>, key: NodeId, value: NodeId): void => {
    const existing = index.get(key);
    if (existing) existing.push(value);
    else index.set(key, [value]);
  };
  for (const edge of edges) {
    push(upstream, edge.to, edge.from);
    push(downstream, edge.from, edge.to);
  }

  const positionsIn = (layer: readonly NodeId[]): Map<NodeId, number> =>
    new Map(layer.map((id, i) => [id, i]));

  for (let sweep = 0; sweep < sweeps; sweep++) {
    const downward = sweep % 2 === 0;
    const range = downward
      ? [...ordered.keys()].slice(1)
      : [...ordered.keys()].slice(0, -1).reverse();

    for (const index of range) {
      const reference = positionsIn(ordered[downward ? index - 1 : index + 1]);
      const neighbours = downward ? upstream : downstream;
      const medians = new Map<NodeId, number>(
        ordered[index].map(id => [
          id,
          medianOf((neighbours.get(id) ?? []).map(n => reference.get(n) ?? -1).filter(p => p >= 0)),
        ]),
      );
      // A node with no neighbour in the reference layer keeps its place, so
      // the layout stays stable rather than shuffling unrelated nodes.
      const original = positionsIn(ordered[index]);
      ordered[index].sort((a, b) => {
        const ma = medians.get(a) ?? -1;
        const mb = medians.get(b) ?? -1;
        if (ma < 0 && mb < 0) return (original.get(a) ?? 0) - (original.get(b) ?? 0);
        if (ma < 0) return -1;
        if (mb < 0) return 1;
        return ma === mb ? (original.get(a) ?? 0) - (original.get(b) ?? 0) : ma - mb;
      });
    }
  }
  return ordered;
}

/**
 * Positions for every node, laid out in layers.
 *
 * Deterministic: the same graph always produces the same result.
 */
export function layoutGraph(
  nodes: readonly EditorNode[],
  connections: readonly NodeConnection[],
  options: LayoutOptions = {},
): ReadonlyMap<NodeId, CanvasPoint> {
  const settings = { ...DEFAULTS, ...options };
  if (nodes.length === 0) return new Map();

  const clustered = groupsIn(nodes, settings.clusterOf);
  if (clustered.size > 0) return layoutClustered(nodes, connections, settings, clustered);

  return layoutFlat(nodes, connections, settings);
}

/** Members per cluster, in the order the nodes were given. */
function groupsIn(
  nodes: readonly EditorNode[],
  clusterOf: (nodeId: NodeId) => string | null,
): Map<string, EditorNode[]> {
  const groups = new Map<string, EditorNode[]>();
  for (const node of nodes) {
    const cluster = clusterOf(node.id);
    if (cluster === null) continue;
    const members = groups.get(cluster);
    if (members) members.push(node);
    else groups.set(cluster, [node]);
  }
  return groups;
}

/**
 * Lay out each cluster as a unit, then lay out those units.
 *
 * Three passes, and the order is the whole point:
 *
 * 1. Each cluster's members are arranged among themselves.
 * 2. Every cluster becomes ONE node the size of that arrangement, and the
 *    graph of clusters and loose nodes is laid out normally.
 * 3. Members are placed back inside their cluster's slot.
 *
 * Because a cluster occupies a rectangle of its own in step 2, no node from
 * outside it can be placed within that rectangle — so a frame drawn around
 * the members afterwards contains exactly the members it started with.
 * Arranging everything in one pass and re-fitting the frames afterwards is
 * what let a tidy silently add and remove nodes from a zone.
 */
function layoutClustered(
  nodes: readonly EditorNode[],
  connections: readonly NodeConnection[],
  settings: ResolvedOptions,
  groups: ReadonlyMap<string, EditorNode[]>,
): ReadonlyMap<NodeId, CanvasPoint> {
  const clusterOfNode = new Map<NodeId, string>();
  for (const [cluster, members] of groups) {
    for (const member of members) clusterOfNode.set(member.id, cluster);
  }
  const keyOf = (id: NodeId): NodeId => clusterOfNode.get(id) ?? id;

  // 1 — inside each cluster, at a local origin.
  const inner = new Map<string, ReadonlyMap<NodeId, CanvasPoint>>();
  const blocks: EditorNode[] = [];
  for (const [cluster, members] of groups) {
    const ids = new Set(members.map(member => member.id));
    const within = connections.filter(c => ids.has(c.source) && ids.has(c.target));
    const placed = layoutFlat(members, within, { ...settings, origin: { x: 0, y: 0 } });
    inner.set(cluster, placed);

    const box = boundsOf(members, placed);
    blocks.push({
      id: cluster,
      x: 0,
      y: 0,
      width: box.width + settings.clusterPadding * 2,
      height: box.height + settings.clusterPadding * 2,
    });
  }

  // 2 — the condensed graph: clusters as single nodes, plus everything loose.
  const loose = nodes.filter(node => !clusterOfNode.has(node.id));
  const condensed = layoutFlat(
    [...loose, ...blocks],
    connections
      .map(c => ({ ...c, source: keyOf(c.source), target: keyOf(c.target) }))
      .filter(c => c.source !== c.target),
    settings,
  );

  // 3 — members back inside their cluster's slot.
  const positions = new Map<NodeId, CanvasPoint>();
  for (const node of loose) {
    const at = condensed.get(node.id);
    if (at) positions.set(node.id, at);
  }
  for (const [cluster, members] of groups) {
    const slot = condensed.get(cluster);
    const placed = inner.get(cluster);
    if (slot && placed) {
      placeInside(members, placed, slot, settings.clusterPadding, positions);
    }
  }
  return positions;
}

/**
 * Shift a cluster's internal arrangement into the slot the outer layout gave
 * it.
 *
 * The sub-layout centres about its own origin and so has negative
 * coordinates; shifting by its own minimum puts it flush inside the slot.
 */
function placeInside(
  members: readonly EditorNode[],
  placed: ReadonlyMap<NodeId, CanvasPoint>,
  slot: CanvasPoint,
  padding: number,
  into: Map<NodeId, CanvasPoint>,
): void {
  const box = boundsOf(members, placed);
  for (const member of members) {
    const at = placed.get(member.id);
    if (!at) continue;
    into.set(member.id, {
      x: slot.x + padding + (at.x - box.x),
      y: slot.y + padding + (at.y - box.y),
    });
  }
}

/** The box a set of placed nodes occupies. */
function boundsOf(
  nodes: readonly EditorNode[],
  positions: ReadonlyMap<NodeId, CanvasPoint>,
): CanvasRect {
  const placed = nodes
    .map(node => ({ node, at: positions.get(node.id) }))
    .filter((entry): entry is { node: EditorNode; at: CanvasPoint } => entry.at !== undefined);
  if (placed.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const left = Math.min(...placed.map(e => e.at.x));
  const top = Math.min(...placed.map(e => e.at.y));
  const right = Math.max(...placed.map(e => e.at.x + e.node.width));
  const bottom = Math.max(...placed.map(e => e.at.y + e.node.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function layoutFlat(
  nodes: readonly EditorNode[],
  connections: readonly NodeConnection[],
  settings: ResolvedOptions,
): ReadonlyMap<NodeId, CanvasPoint> {
  const positions = new Map<NodeId, CanvasPoint>();
  if (nodes.length === 0) return positions;

  const ids = nodes.map(node => node.id);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const allEdges: Edge[] = connections
    .filter(c => byId.has(c.source) && byId.has(c.target) && c.source !== c.target)
    .map(c => ({ from: c.source, to: c.target }));

  const edges = withoutBackEdges(ids, allEdges);
  const layerOf = assignLayers(ids, edges);

  const depth = Math.max(0, ...ids.map(id => layerOf.get(id) ?? 0));
  const layers: NodeId[][] = Array.from({ length: depth + 1 }, () => []);
  for (const id of ids) layers[layerOf.get(id) ?? 0].push(id);

  const ordered = orderLayers(layers, edges, settings.sweeps);
  const horizontal = settings.direction === 'LR';

  // Along the flow: each layer starts after the widest node of the previous.
  let along = horizontal ? settings.origin.x : settings.origin.y;
  for (const layer of ordered) {
    const sizes = layer.map(id => byId.get(id) as EditorNode);
    const extent = Math.max(
      0,
      ...sizes.map(node => (horizontal ? node.width : node.height)),
    );

    // Across the flow: stack, then centre the layer about the origin so the
    // graph grows symmetrically instead of hanging off one edge.
    const total =
      sizes.reduce((sum, node) => sum + (horizontal ? node.height : node.width), 0) +
      settings.nodeGap * Math.max(0, layer.length - 1);
    let across = (horizontal ? settings.origin.y : settings.origin.x) - total / 2;

    for (const node of sizes) {
      positions.set(
        node.id,
        horizontal ? { x: along, y: across } : { x: across, y: along },
      );
      across += (horizontal ? node.height : node.width) + settings.nodeGap;
    }
    along += extent + settings.layerGap;
  }
  return positions;
}
