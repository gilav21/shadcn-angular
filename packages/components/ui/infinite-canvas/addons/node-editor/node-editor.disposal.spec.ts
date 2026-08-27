// What the runtime lets go of.
//
// A leak is a number that fails to come back down, and nothing else in a suite
// can see one — every other test here asserts what a graph COMPUTES, and a
// runtime quietly carrying every node it has ever shown computes exactly the
// right answers while doing it.
//
// So `metrics.retained` counts the nodes any per-node container still holds,
// and these are the two shapes that must return it: removing a node, and
// disposing the runtime. A subgraph builds a runtime per evaluation and throws
// it away, so the second one is paid on every run of every nested graph.
import { describe, it, expect } from 'vitest';
import { NodeGraphRuntime } from './node-editor.runtime';
import type { NodeTypeDefinition } from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';

const PASS: NodeTypeDefinition = {
    id: 'pass',
    label: 'Pass',
    ports: [
        { id: 'in', direction: 'in', label: 'In' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    initialState: () => 'seed',
    compute: (inputs, ctx) => ({ out: inputs['in'] ?? ctx.state }),
};

function node(id: string): EditorNode {
    return { id, type: 'pass', x: 0, y: 0, width: 180, height: 0 };
}

function chain(count: number): { nodes: EditorNode[]; connections: NodeConnection[] } {
    const nodes = Array.from({ length: count }, (_, i) => node(`n${i}`));
    const connections = nodes.slice(1).map((n, i) => ({
        id: `c${i}`,
        source: `n${i}`,
        sourcePort: 'out',
        target: n.id,
        targetPort: 'in',
    }));
    return { nodes, connections };
}

describe('the runtime lets go of a node it no longer has', () => {
    it('holds nothing before a graph is set', () => {
        const runtime = new NodeGraphRuntime();
        try {
            expect(runtime.metrics.retained).toBe(0);
        } finally {
            runtime.dispose();
        }
    });

    it('comes back to zero when the graph empties', async () => {
        const runtime = new NodeGraphRuntime();
        try {
            const { nodes, connections } = chain(25);
            runtime.setDefinitions([PASS]);
            runtime.setGraph(nodes, connections);
            await runtime.run();

            expect(runtime.metrics.retained).toBe(25);

            runtime.setGraph([], []);

            expect(runtime.metrics.retained).toBe(0);
        } finally {
            runtime.dispose();
        }
    });

    /*
     * The shape that actually happens: a graph edited for a while.
     *
     * Read-out signals were the one thing a removed node left behind, and
     * nothing collected them — five maps growing by one entry per node, for as
     * long as the editor lived.
     */
    it('does not accumulate across many rounds of adding and removing', async () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([PASS]);
            for (let round = 0; round < 20; round++) {
                const { nodes, connections } = chain(10);
                runtime.setGraph(nodes, connections);
                await runtime.run();
                runtime.setGraph([], []);
            }

            expect(runtime.metrics.retained).toBe(0);
        } finally {
            runtime.dispose();
        }
    });

    /** State written for a node that never arrives is still state being held. */
    it('releases a state written ahead of a node that never came', () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([PASS]);
            runtime.setState('never-added', { big: 'value' });

            expect(runtime.metrics.retained).toBe(1);

            runtime.dispose();

            expect(runtime.metrics.retained).toBe(0);
        } finally {
            runtime.dispose();
        }
    });
});

describe('a disposed runtime holds nothing', () => {
    it('releases every node, including its read-out signals', async () => {
        const runtime = new NodeGraphRuntime();
        const { nodes, connections } = chain(30);
        runtime.setDefinitions([PASS]);
        runtime.setGraph(nodes, connections);
        await runtime.run();
        expect(runtime.metrics.retained).toBe(30);

        runtime.dispose();

        expect(runtime.metrics.retained).toBe(0);
        expect(runtime.metrics.openIterators).toBe(0);
    });

    /*
     * The callbacks are the ones that hold a whole component.
     *
     * `onRunStarted = event => this.runStarted.emit(event)` closes over the
     * editor, so a runtime anyone still references keeps the component, its
     * template and its nodes alive behind it.
     */
    it('lets go of the lifecycle callbacks', () => {
        const runtime = new NodeGraphRuntime();
        runtime.onRunStarted = () => undefined;
        runtime.onNodeSettled = () => undefined;
        runtime.onRunFinished = () => undefined;
        runtime.executeRemote = async () => [];

        runtime.dispose();

        expect(runtime.onRunStarted).toBeNull();
        expect(runtime.onNodeSettled).toBeNull();
        expect(runtime.onRunFinished).toBeNull();
        expect(runtime.executeRemote).toBeNull();
    });

    it('is safe to dispose twice', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([PASS]);
        runtime.setGraph([node('a')], []);
        await runtime.run();

        runtime.dispose();

        expect(() => runtime.dispose()).not.toThrow();
        expect(runtime.metrics.retained).toBe(0);
    });

    /** A stream left open would keep its generator's `finally` from running. */
    it('closes an open stream', async () => {
        const STREAM: NodeTypeDefinition = {
            id: 'stream',
            label: 'Stream',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            compute: async function* () {
                let i = 0;
                while (i < 1000) yield { out: i++ };
            },
        };

        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([STREAM]);
        runtime.setGraph([{ ...node('s'), type: 'stream' }], []);
        await runtime.run();

        runtime.dispose();

        expect(runtime.metrics.openIterators).toBe(0);
        expect(runtime.metrics.retained).toBe(0);
    });
});

/*
 * A node removed while it was still owed work.
 *
 * `metrics.retained` covers the dirty set and the ready queue, but nothing
 * here ever put a removed node INTO them: every test above removes a node
 * that had already settled, so the two containers written on every settle —
 * the ones most likely to strand an id — were counted and never exercised.
 * Neutering their cleanup in `removeNode` left the whole file green.
 */
describe('the runtime lets go of a node removed mid-flight', () => {
    it('forgets a node deleted while it was dirty and unrun', () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([PASS]);
        const { nodes, connections } = chain(4);
        runtime.setGraph(nodes, connections);

        // Owed work, never run: the node is dirty and queued, not settled.
        runtime.setState('n0', 'changed');
        runtime.setGraph(nodes.slice(1), connections.slice(1));

        expect(runtime.metrics.retained).toBe(3);
        runtime.dispose();
    });

    it('forgets a node deleted between a change and the run that would settle it', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([PASS]);
        const { nodes, connections } = chain(4);
        runtime.setGraph(nodes, connections);
        await runtime.run();

        runtime.setState('n2', 'changed');
        runtime.setGraph(nodes.slice(0, 3), connections.slice(0, 2));
        await runtime.run();

        expect(runtime.metrics.retained).toBe(3);
        runtime.dispose();
        expect(runtime.metrics.retained).toBe(0);
    });
});
