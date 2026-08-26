/**
 * A node type whose `compute` is another graph.
 *
 * ### Why this addon is the interesting one
 *
 * `specs/node-editor-runtime-design.md` §14.9 claims the runtime has no global
 * or singleton state, and this is the test of that claim: a subgraph node runs
 * a second `NodeGraphRuntime` *inside* the first one's evaluation. One shared
 * counter, one module-level cache, one `providedIn: 'root'` service anywhere in
 * the runtime and the inner graph would corrupt the outer one.
 *
 * It builds with **no change to the base at all** — no new input, no new
 * output, no new method. The claim held.
 *
 * ### The one cost, stated plainly
 *
 * The child runtime is created per evaluation and disposed afterwards, so the
 * inner graph does not memoise between outer runs. `ComputeContext` carries no
 * node identity, so a `compute` has nothing to key a per-instance child runtime
 * by. The alternatives were both worse than the cost:
 *
 * - A module-level `Map` keyed by some id is a singleton, which is the one
 *   thing this addon exists to prove unnecessary, and nothing would ever
 *   dispose it.
 * - Adding `nodeId` to `ComputeContext` is a base change, and an addon that
 *   needs one has failed the test it was written to run.
 *
 * So a subgraph evaluates as a pure function call: inputs in, graph runs,
 * outputs out. For a graph of a few dozen inner nodes that is the right
 * trade; if it ever stops being, `nodeId` on `ComputeContext` is the fix, and
 * it should be made deliberately rather than discovered.
 */
import {
  NodeGraphRuntime,
  type NodePortDefinition,
  type NodeTypeDefinition,
  type PortValues,
} from '../node-editor';
import {
  SUBGRAPH_INPUT_TYPE,
  SUBGRAPH_OUTPUT_TYPE,
  type SubgraphGraph,
  type SubgraphTypeOptions,
} from './node-editor-subgraph.types';

/**
 * The inner end of an outer input port.
 *
 * Its value is pushed in from outside before the inner graph runs, which is
 * why it has no `compute` of its own beyond echoing its state.
 */
export const SUBGRAPH_INPUT: NodeTypeDefinition<unknown> = {
  id: SUBGRAPH_INPUT_TYPE,
  label: 'Input',
  category: 'Boundary',
  accent: '#22c55e',
  ports: [{ id: 'value', direction: 'out', label: 'Value' }],
  compute: (_inputs, ctx) => ({ value: ctx.state }),
};

/**
 * The inner end of an outer output port.
 *
 * Deliberately has no `compute`: the outer node reads what ARRIVED at this
 * node's input. A compute that echoed it would be a second copy of the value
 * to keep in step for no gain.
 */
export const SUBGRAPH_OUTPUT: NodeTypeDefinition<unknown> = {
  id: SUBGRAPH_OUTPUT_TYPE,
  label: 'Output',
  category: 'Boundary',
  accent: '#6366f1',
  ports: [{ id: 'value', direction: 'in', label: 'Value' }],
};

/** Both boundary types, for registering with an editor that shows inner graphs. */
export const SUBGRAPH_BOUNDARY_TYPES: readonly NodeTypeDefinition[] = [
  SUBGRAPH_INPUT,
  SUBGRAPH_OUTPUT,
];

/**
 * The outer node's ports, derived from the boundary nodes inside it.
 *
 * A boundary node's **id is the port id**. Add an input boundary node called
 * `url` and the outer node grows an input port called `url`; delete it and the
 * port goes. Keeping them as one fact means they cannot disagree, which a
 * separate mapping table would eventually let them do.
 */
export function boundaryPorts(graph: SubgraphGraph): readonly NodePortDefinition[] {
  const memoised = PORTS_BY_GRAPH.get(graph);
  if (memoised) return memoised;

  const boundary = (type: string, direction: 'in' | 'out'): NodePortDefinition[] =>
    graph.nodes
      .filter(node => node.type === type)
      .map(node => ({
        id: String(node.id),
        direction,
        label: node.title ?? String(node.id),
      }));

  const ports = [
    ...boundary(SUBGRAPH_INPUT_TYPE, 'in'),
    ...boundary(SUBGRAPH_OUTPUT_TYPE, 'out'),
  ];
  PORTS_BY_GRAPH.set(graph, ports);
  return ports;
}

/**
 * One ports array per graph OBJECT, because the editor compares the rendered
 * node list by reference.
 *
 * `portsFor` is called on every change detection pass; returning a fresh array
 * each time would make every node look changed and re-mount the whole canvas —
 * the exact thing the engine exists to avoid. A graph is replaced wholesale
 * when it is edited, so identity is the correct cache key: a new graph object
 * means new ports, the same object means the same array.
 *
 * A `WeakMap` so a graph that is no longer referenced takes its entry with it.
 * This is a cache, not state: it holds nothing that two editors could disagree
 * about, so it does not reintroduce the singleton this addon avoids.
 */
const PORTS_BY_GRAPH = new WeakMap<SubgraphGraph, readonly NodePortDefinition[]>();

/** A graph with nothing in it — what a subgraph the user creates starts as. */
export const EMPTY_SUBGRAPH_GRAPH: SubgraphGraph = { nodes: [], connections: [] };

/**
 * A node's state read as a nested graph, or `null` if it is not one.
 *
 * Lets a consumer ask "can I descend into this node?" of the node itself
 * rather than against a hard-coded list of type ids — which is what made the
 * demo able to open exactly one subgraph type.
 */
export function asSubgraphGraph(state: unknown): SubgraphGraph | null {
  if (typeof state !== 'object' || state === null) return null;
  const candidate = state as Partial<SubgraphGraph>;
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.connections)) return null;
  return candidate as SubgraphGraph;
}

/** Ids of the inner nodes that carry values back out. */
function outputBoundaryIds(graph: SubgraphGraph): readonly string[] {
  return graph.nodes
    .filter(node => node.type === SUBGRAPH_OUTPUT_TYPE)
    .map(node => String(node.id));
}

/**
 * A node type backed by a nested graph.
 *
 * The node's **state is its graph**, so every instance owns its own copy and
 * editing one does not edit the others — and so a nested graph serialises with
 * the document for free, since state already does.
 */
export function subgraphNodeType(
  options: SubgraphTypeOptions,
): NodeTypeDefinition<SubgraphGraph, PortValues, PortValues> {
  return {
    id: options.id,
    label: options.label,
    category: options.category,
    accent: options.accent,
    ports: boundaryPorts(options.graph),
    // The ports belong to the INSTANCE, not the type: two nodes of this type
    // hold two different graphs, and each one's boundary nodes are its own
    // outer ports. Without this every instance would be forced to show the
    // ports of the graph the type was declared with, so adding an input
    // inside one subgraph would do nothing to the node on the outside — and a
    // subgraph the user built up from empty would have no ports at all, ever.
    portsFor: state => boundaryPorts(asSubgraphGraph(state) ?? options.graph),
    // Says on the card that this node has an inside, and makes double-click
    // descend into it — so opening a nested graph is a canvas gesture rather
    // than a button somewhere off it.
    openable: true,
    // Cloned, or every node of this type would share one graph object and
    // editing inside one would edit all of them.
    initialState: () => structuredClone(options.graph) as SubgraphGraph,

    async compute(inputs, ctx) {
      const graph = ctx.state ?? options.graph;
      /*
       * Read per evaluation, not once when the type was built.
       *
       * A subgraph inside a subgraph needs the outer type's own definition in
       * this list, which cannot be done while the outer type is still being
       * constructed — so the only way to express it is to push into the array
       * afterwards. Snapshotting here made that push invisible: the palette
       * would offer a nested subgraph and the runtime would then not know the
       * type, so the inner graph answered nothing.
       *
       * The cost is rebuilding a short array per run, next to constructing a
       * whole child runtime — which this already does.
       */
      const definitions = [...options.definitions, ...SUBGRAPH_BOUNDARY_TYPES];
      const runtime = new NodeGraphRuntime();
      try {
        runtime.setDefinitions(definitions);
        runtime.setGraph(graph.nodes, graph.connections);

        // Inner state first, then the incoming values on top: an input
        // boundary node's saved state is a stale copy of whatever last
        // arrived, and the value being passed in now must win.
        for (const [id, value] of Object.entries(graph.states ?? {})) {
          runtime.setState(id, value);
        }

        /*
         * An arriving `undefined` means nothing arrived, so the saved state
         * stands.
         *
         * `resolveInputs` puts a key on the map for EVERY input port —
         * unconnected ones get the port's `default`, which is `undefined` —
         * so the key being present says nothing about whether anything is
         * wired up. Writing it in regardless overwrote a subgraph's saved
         * inner values with undefined the moment a port was left unconnected,
         * and the graph answered NaN. Same rule the base already applies to
         * an unconnected port: absent means fall back.
         */
        for (const port of boundaryPorts(graph)) {
          if (port.direction !== 'in') continue;
          const arriving = inputs[port.id];
          if (arriving !== undefined) runtime.setState(port.id, arriving);
        }

        await runtime.run();
        if (ctx.signal.aborted) return {};

        const outputs: PortValues = {};
        for (const id of outputBoundaryIds(graph)) {
          outputs[id] = runtime.inputs(id)()['value'];
        }
        return outputs;
      } finally {
        // Always, including on abort: an inner graph with a stream would
        // otherwise keep its iterators open after the outer node moved on.
        runtime.dispose();
      }
    },
  };
}

/**
 * A subgraph type that starts empty — the one to put in the palette.
 *
 * This is what makes subgraphs something the USER creates rather than only
 * something the app author ships. Dropping one gives a node with no ports;
 * opening it shows an empty graph; adding a boundary node inside grows a port
 * on the outside, because a boundary node's id is a port id and `portsFor`
 * reads them from the instance's own graph.
 *
 * Nothing here is a special case of {@link subgraphNodeType} — it *is* one,
 * with an empty starting graph. A subgraph is a graph, including when it is
 * still empty.
 */
export function emptySubgraphNodeType(
  options: Omit<SubgraphTypeOptions, 'graph'>,
): NodeTypeDefinition<SubgraphGraph, PortValues, PortValues> {
  return subgraphNodeType({ ...options, graph: EMPTY_SUBGRAPH_GRAPH });
}

/**
 * A subgraph's inner state, read back out for saving.
 *
 * The runtime holds each inner node's state; this is what puts it into the
 * `SubgraphGraph` so a reopened document shows the values it had.
 */
export function captureStates(
  runtime: NodeGraphRuntime,
  graph: SubgraphGraph,
): Readonly<Record<string, unknown>> {
  const states: Record<string, unknown> = {};
  for (const node of graph.nodes) {
    const state = runtime.state(node.id)();
    if (state !== undefined) states[String(node.id)] = state;
  }
  return states;
}
