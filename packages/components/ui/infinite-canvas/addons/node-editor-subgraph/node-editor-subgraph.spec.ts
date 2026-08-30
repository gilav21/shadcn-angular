// Nested graphs — `specs/node-editor-addons-spec.md` §7, tasks G1, G2, G5.
//
// This file is the test of `node-editor-runtime-design.md` §14.9: the runtime
// claims no global or singleton state, and here a second NodeGraphRuntime runs
// INSIDE the first one's evaluation. One shared counter, one module-level
// cache, one root-provided service and the inner graph corrupts the outer one.
//
// Note what is NOT imported here: nothing from the base but its public API. If
// this addon had needed a new input, output or method, the claim would have
// failed.
import { describe, it, expect } from 'vitest';
import {
    NodeGraphRuntime,
    type EditorNode,
    type NodeConnection,
    type NodeTypeDefinition,
} from '../node-editor';
import {
    SUBGRAPH_BOUNDARY_TYPES,
    asSubgraphGraph,
    boundaryPorts,
    emptySubgraphNodeType,
    subgraphNodeType,
} from './node-editor-subgraph';
import {
    SUBGRAPH_INPUT_TYPE,
    SUBGRAPH_OUTPUT_TYPE,
    type SubgraphGraph,
} from './node-editor-subgraph.types';

function node(id: string, type: string, title?: string): EditorNode {
    return { id, type, x: 0, y: 0, width: 180, height: 0, title };
}

const DOUBLE: NodeTypeDefinition = {
    id: 'double',
    label: 'Double',
    ports: [
        { id: 'in', direction: 'in', label: 'In' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    compute: inputs => ({ out: (inputs['in'] as number) * 2 }),
};

const ADD: NodeTypeDefinition = {
    id: 'add',
    label: 'Add',
    ports: [
        { id: 'a', direction: 'in', label: 'A' },
        { id: 'b', direction: 'in', label: 'B' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    compute: inputs => ({ out: (inputs['a'] as number) + (inputs['b'] as number) }),
};

const SOURCE: NodeTypeDefinition = {
    id: 'source',
    label: 'Source',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    initialState: () => 5,
    compute: (_inputs, ctx) => ({ out: ctx.state }),
};

/** in → double → out */
const DOUBLER_GRAPH: SubgraphGraph = {
    nodes: [
        node('n', SUBGRAPH_INPUT_TYPE, 'Number'),
        node('twice', 'double'),
        node('result', SUBGRAPH_OUTPUT_TYPE, 'Result'),
    ],
    connections: [
        { id: 'c1', source: 'n', sourcePort: 'value', target: 'twice', targetPort: 'in' },
        { id: 'c2', source: 'twice', sourcePort: 'out', target: 'result', targetPort: 'value' },
    ],
};

const DOUBLER = subgraphNodeType({
    id: 'doubler',
    label: 'Doubler',
    graph: DOUBLER_GRAPH,
    definitions: [DOUBLE],
});

/** Runs one outer graph containing a subgraph node, and returns its outputs. */
async function runOuter(
    types: readonly NodeTypeDefinition[],
    nodes: readonly EditorNode[],
    connections: readonly NodeConnection[],
    read: string,
): Promise<Record<string, unknown>> {
    const runtime = new NodeGraphRuntime();
    runtime.setDefinitions([SOURCE, ...types]);
    runtime.setGraph(nodes, connections);
    await runtime.run();
    const outputs = runtime.outputs(read)();
    runtime.dispose();
    return { ...outputs };
}

describe('a graph runs inside a graph', () => {
    it('feeds an outer input through the inner graph and back out', async () => {
        const outputs = await runOuter(
            [DOUBLER],
            [node('src', 'source'), node('sub', 'doubler')],
            [{ id: 'e1', source: 'src', sourcePort: 'out', target: 'sub', targetPort: 'n' }],
            'sub',
        );

        // 5 in, doubled inside, 10 out.
        expect(outputs['result']).toBe(10);
    });

    it('runs with no connection at all, rather than hanging', async () => {
        const outputs = await runOuter([DOUBLER], [node('sub', 'doubler')], [], 'sub');
        expect(outputs).toHaveProperty('result');
    });

    /**
     * The point of §14.9. Two levels means a runtime running inside a runtime
     * running inside a runtime — any shared counter, cache or service and the
     * innermost result comes back wrong.
     */
    it('nests two levels deep', async () => {
        const quadrupler = subgraphNodeType({
            id: 'quadrupler',
            label: 'Quadrupler',
            graph: {
                nodes: [
                    node('n', SUBGRAPH_INPUT_TYPE),
                    node('once', 'doubler'),
                    node('again', 'doubler'),
                    node('result', SUBGRAPH_OUTPUT_TYPE),
                ],
                connections: [
                    { id: 'a', source: 'n', sourcePort: 'value', target: 'once', targetPort: 'n' },
                    { id: 'b', source: 'once', sourcePort: 'result', target: 'again', targetPort: 'n' },
                    { id: 'c', source: 'again', sourcePort: 'result', target: 'result', targetPort: 'value' },
                ],
            },
            // The inner graph may itself contain subgraph nodes.
            definitions: [DOUBLER],
        });

        const outputs = await runOuter(
            [quadrupler],
            [node('src', 'source'), node('sub', 'quadrupler')],
            [{ id: 'e1', source: 'src', sourcePort: 'out', target: 'sub', targetPort: 'n' }],
            'sub',
        );

        expect(outputs['result']).toBe(20);
    });

    it('carries several inputs and several outputs', async () => {
        const sums = subgraphNodeType({
            id: 'sums',
            label: 'Sums',
            graph: {
                nodes: [
                    node('x', SUBGRAPH_INPUT_TYPE),
                    node('y', SUBGRAPH_INPUT_TYPE),
                    node('total', 'add'),
                    node('sum', SUBGRAPH_OUTPUT_TYPE),
                    node('echo', SUBGRAPH_OUTPUT_TYPE),
                ],
                connections: [
                    { id: 'a', source: 'x', sourcePort: 'value', target: 'total', targetPort: 'a' },
                    { id: 'b', source: 'y', sourcePort: 'value', target: 'total', targetPort: 'b' },
                    { id: 'c', source: 'total', sourcePort: 'out', target: 'sum', targetPort: 'value' },
                    { id: 'd', source: 'x', sourcePort: 'value', target: 'echo', targetPort: 'value' },
                ],
            },
            definitions: [ADD],
        });

        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([sums]);
        runtime.setGraph([node('sub', 'sums')], []);
        runtime.setState('sub', {
            ...sums.initialState?.(),
            states: { x: 3, y: 4 },
        });
        await runtime.run();

        // x and y arrive as saved inner state, since nothing is connected.
        expect(runtime.outputs('sub')()['sum']).toBe(7);
        expect(runtime.outputs('sub')()['echo']).toBe(3);
        runtime.dispose();
    });

    /**
     * Two nodes of the same subgraph type must not share a graph — editing
     * inside one would otherwise edit the other.
     */
    it('gives every instance its own copy of the graph', () => {
        const first = DOUBLER.initialState?.() as SubgraphGraph;
        const second = DOUBLER.initialState?.() as SubgraphGraph;

        expect(first).not.toBe(second);
        expect(first.nodes).not.toBe(second.nodes);
        expect(first).toEqual(second);
    });
});

describe('the outer node’s ports come from the boundary nodes', () => {
    /**
     * A boundary node's id IS the port id. One fact rather than two, so they
     * cannot disagree — which a separate mapping table would eventually let
     * them do.
     */
    it('derives an input port per input boundary node', () => {
        const ports = boundaryPorts(DOUBLER_GRAPH);
        expect(ports.filter(p => p.direction === 'in').map(p => p.id)).toEqual(['n']);
    });

    it('derives an output port per output boundary node', () => {
        const ports = boundaryPorts(DOUBLER_GRAPH);
        expect(ports.filter(p => p.direction === 'out').map(p => p.id)).toEqual(['result']);
    });

    it('labels a port with the boundary node’s title', () => {
        expect(boundaryPorts(DOUBLER_GRAPH).find(p => p.id === 'n')?.label).toBe('Number');
    });

    it('falls back to the id when a boundary node has no title', () => {
        const graph: SubgraphGraph = { nodes: [node('bare', SUBGRAPH_INPUT_TYPE)], connections: [] };
        expect(boundaryPorts(graph)[0].label).toBe('bare');
    });

    it('ignores ordinary nodes', () => {
        expect(boundaryPorts(DOUBLER_GRAPH)).toHaveLength(2);
    });

    it('has no ports at all for a graph with no boundary nodes', () => {
        expect(boundaryPorts({ nodes: [node('x', 'double')], connections: [] })).toEqual([]);
    });
});

describe('inner state', () => {
    /**
     * An input boundary node's saved state is a stale copy of whatever last
     * arrived. The value being passed in NOW has to win, or a subgraph would
     * keep answering with the number it saw the first time.
     */
    it('lets an incoming value beat the saved inner state', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([SOURCE, DOUBLER]);
        runtime.setGraph(
            [node('src', 'source'), node('sub', 'doubler')],
            [{ id: 'e1', source: 'src', sourcePort: 'out', target: 'sub', targetPort: 'n' }],
        );
        runtime.setState('sub', { ...DOUBLER_GRAPH, states: { n: 999 } });
        await runtime.run();

        expect(runtime.outputs('sub')()['result']).toBe(10);
        runtime.dispose();
    });

    it('uses the saved inner state when nothing is connected', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([DOUBLER]);
        runtime.setGraph([node('sub', 'doubler')], []);
        runtime.setState('sub', { ...DOUBLER_GRAPH, states: { n: 21 } });
        await runtime.run();

        expect(runtime.outputs('sub')()['result']).toBe(42);
        runtime.dispose();
    });
});

describe('the boundary types', () => {
    it('exports both, for an editor that shows inner graphs', () => {
        expect(SUBGRAPH_BOUNDARY_TYPES.map(t => t.id)).toEqual([
            SUBGRAPH_INPUT_TYPE,
            SUBGRAPH_OUTPUT_TYPE,
        ]);
    });

    /**
     * The outer node reads what ARRIVED at the output boundary. A compute that
     * echoed it would be a second copy of the value to keep in step, for
     * nothing.
     */
    it('gives the output boundary no compute of its own', () => {
        expect(SUBGRAPH_BOUNDARY_TYPES[1].compute).toBeUndefined();
    });
});

describe('serialisation', () => {
    /**
     * The node's state IS its graph, so a nested graph goes through JSON with
     * the document for free — state already does.
     */
    it('round-trips a nested graph through JSON', () => {
        const state = DOUBLER.initialState?.() as SubgraphGraph;
        const revived = JSON.parse(JSON.stringify(state)) as SubgraphGraph;

        expect(revived.nodes.map(n => n.id)).toEqual(['n', 'twice', 'result']);
        expect(boundaryPorts(revived).map(p => p.id)).toEqual(['n', 'result']);
    });
});

/*
 * Subgraphs the USER creates, rather than ones the app author shipped.
 *
 * The difference is where the ports come from. A type declared with a graph
 * can take its ports off the definition; a type that starts empty cannot,
 * because every node of it grows a different set. `portsFor` is the hook that
 * lets the instance answer instead of the type.
 */
describe('a subgraph that starts empty', () => {
    const EMPTY = emptySubgraphNodeType({
        id: 'blank',
        label: 'Subgraph',
        definitions: [DOUBLE],
    });

    it('starts with no ports at all', () => {
        expect(EMPTY.ports).toEqual([]);
    });

    it('starts with an empty graph as its state', () => {
        expect(EMPTY.initialState?.()).toEqual({ nodes: [], connections: [] });
    });

    it('gives each node its own graph, so editing one leaves the others alone', () => {
        expect(EMPTY.initialState?.()).not.toBe(EMPTY.initialState?.());
    });

    /** A boundary node's id is a port id — that is the whole port API. */
    it('grows an outer port when a boundary node is added inside', () => {
        const built: SubgraphGraph = {
            nodes: [
                node('url', SUBGRAPH_INPUT_TYPE, 'URL'),
                node('twice', 'double'),
                node('size', SUBGRAPH_OUTPUT_TYPE, 'Size'),
            ],
            connections: [],
        };

        expect(EMPTY.portsFor?.(built).map(p => ({ id: p.id, direction: p.direction }))).toEqual([
            { id: 'url', direction: 'in' },
            { id: 'size', direction: 'out' },
        ]);
    });

    it('reports no ports for a node whose graph is still empty', () => {
        expect(EMPTY.portsFor?.({ nodes: [], connections: [] })).toEqual([]);
    });

    it('reads ports off THIS node, so two instances can disagree', () => {
        const withInput: SubgraphGraph = {
            nodes: [node('a', SUBGRAPH_INPUT_TYPE, 'A')],
            connections: [],
        };
        const withOutput: SubgraphGraph = {
            nodes: [node('z', SUBGRAPH_OUTPUT_TYPE, 'Z')],
            connections: [],
        };

        expect(EMPTY.portsFor?.(withInput).map(p => p.id)).toEqual(['a']);
        expect(EMPTY.portsFor?.(withOutput).map(p => p.id)).toEqual(['z']);
    });

    /*
     * Load-bearing, and invisible everywhere else: the editor compares the
     * rendered node list BY REFERENCE. A fresh ports array per call makes every
     * node look changed on every change detection pass and re-mounts the whole
     * canvas — the one thing the engine exists to avoid. Nothing would fail; it
     * would just quietly stop being fast.
     */
    it('returns the SAME ports array for the same graph', () => {
        const graph: SubgraphGraph = {
            nodes: [node('a', SUBGRAPH_INPUT_TYPE, 'A')],
            connections: [],
        };

        expect(boundaryPorts(graph)).toBe(boundaryPorts(graph));
        expect(EMPTY.portsFor?.(graph)).toBe(EMPTY.portsFor?.(graph));
    });

    it('returns a new array once the graph is replaced', () => {
        const before: SubgraphGraph = { nodes: [], connections: [] };
        const after: SubgraphGraph = {
            nodes: [node('a', SUBGRAPH_INPUT_TYPE, 'A')],
            connections: [],
        };

        expect(boundaryPorts(after)).not.toBe(boundaryPorts(before));
    });

    it('falls back to the type when a node carries no graph at all', () => {
        expect(EMPTY.portsFor?.(undefined)).toEqual([]);
    });

    it('runs an empty graph without producing anything', async () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([EMPTY]);
            runtime.setGraph([node('sub', 'blank')], []);
            await runtime.run();

            expect(runtime.outputs('sub')()).toEqual({});
        } finally {
            runtime.dispose();
        }
    });
});

/*
 * Naming a port from inside.
 *
 * A boundary node's TITLE is the port's label and its ID is the port's id, and
 * they are deliberately not the same field. Renaming is how a port gets a name
 * a human wrote — and because the id is untouched, every connection already
 * made to that port survives it.
 */
describe('renaming a boundary node names its port', () => {
    const EMPTY = emptySubgraphNodeType({ id: 'blank', label: 'Subgraph', definitions: [] });

    /** What `renameNode` does to the node the editor holds. */
    function renamed(graph: SubgraphGraph, id: string, title: string): SubgraphGraph {
        return {
            ...graph,
            nodes: graph.nodes.map(n => (n.id === id ? { ...n, title } : n)),
        };
    }

    const built: SubgraphGraph = {
        nodes: [node('in-1', SUBGRAPH_INPUT_TYPE), node('out-1', SUBGRAPH_OUTPUT_TYPE)],
        connections: [],
    };

    it('falls back to the id, so a fresh port is at least addressable', () => {
        expect(boundaryPorts(built).map(p => p.label)).toEqual(['in-1', 'out-1']);
    });

    it('shows the name the user typed', () => {
        const withNames = renamed(renamed(built, 'in-1', 'URL'), 'out-1', 'Status');

        expect(boundaryPorts(withNames).map(p => p.label)).toEqual(['URL', 'Status']);
    });

    /** The point of keeping id and label apart. */
    it('leaves the port id alone, so connections survive the rename', () => {
        const before = boundaryPorts(built).map(p => p.id);
        const after = boundaryPorts(renamed(built, 'in-1', 'URL')).map(p => p.id);

        expect(after).toEqual(before);
        expect(after).toEqual(['in-1', 'out-1']);
    });

    it('reaches the outer node through portsFor, not just boundaryPorts', () => {
        const withName = renamed(built, 'in-1', 'URL');

        expect(EMPTY.portsFor?.(withName).map(p => ({ id: p.id, label: p.label }))).toEqual([
            { id: 'in-1', label: 'URL' },
            { id: 'out-1', label: 'out-1' },
        ]);
    });
});

describe('asSubgraphGraph', () => {
    it('reads a graph back out of a node state', () => {
        const graph: SubgraphGraph = { nodes: [], connections: [] };
        expect(asSubgraphGraph(graph)).toBe(graph);
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a number', 5],
        ['a string', 'nodes'],
        ['an object with no connections', { nodes: [] }],
        ['an object with no nodes', { connections: [] }],
    ])('rejects %s', (_label, value) => {
        expect(asSubgraphGraph(value)).toBeNull();
    });
});

/*
 * A subgraph inside a subgraph.
 *
 * The outer type has to appear in its OWN inner-definitions list, which cannot
 * be written while it is still being constructed — so the only way to say it is
 * to push afterwards. That works only because `compute` reads the list per
 * evaluation instead of snapshotting it when the type was built.
 */
describe('a subgraph nested inside a subgraph', () => {
    it('evaluates an inner subgraph whose type was registered after the fact', async () => {
        const nestable: NodeTypeDefinition[] = [DOUBLE];
        const OUTER = emptySubgraphNodeType({
            id: 'outer',
            label: 'Outer',
            definitions: nestable,
        });
        nestable.push(OUTER);

        // An inner subgraph that doubles what it is given.
        const inner: SubgraphGraph = {
            nodes: [
                node('n', SUBGRAPH_INPUT_TYPE, 'N'),
                node('twice', 'double'),
                node('result', SUBGRAPH_OUTPUT_TYPE, 'Result'),
            ],
            connections: [
                { id: 'c1', source: 'n', sourcePort: 'value', target: 'twice', targetPort: 'in' },
                {
                    id: 'c2',
                    source: 'twice',
                    sourcePort: 'out',
                    target: 'result',
                    targetPort: 'value',
                },
            ],
        };

        // The outer graph holds that subgraph as one of ITS nodes.
        const outer: SubgraphGraph = {
            nodes: [
                node('n', SUBGRAPH_INPUT_TYPE, 'N'),
                node('nested', 'outer'),
                node('result', SUBGRAPH_OUTPUT_TYPE, 'Result'),
            ],
            connections: [
                { id: 'c1', source: 'n', sourcePort: 'value', target: 'nested', targetPort: 'n' },
                {
                    id: 'c2',
                    source: 'nested',
                    sourcePort: 'result',
                    target: 'result',
                    targetPort: 'value',
                },
            ],
            states: { nested: inner, n: 21 },
        };

        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([OUTER, ...SUBGRAPH_BOUNDARY_TYPES]);
            runtime.setGraph([node('sub', 'outer')], []);
            runtime.setState('sub', outer);
            await runtime.run();

            expect(runtime.outputs('sub')()['result']).toBe(42);
        } finally {
            runtime.dispose();
        }
    });
});
