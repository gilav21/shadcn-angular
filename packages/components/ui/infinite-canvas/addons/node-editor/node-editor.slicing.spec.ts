// Sliced evaluation — `specs/node-editor-sliced-evaluation-spec.md`.
//
// A drain resolves its awaits in microtasks, which do not let the browser
// paint, so every layer runs back to back in one block of main thread. These
// prove the drain can be cut into slices without losing work, running anything
// twice, or computing from a value an edit has already invalidated.
//
// Driven by `sliceMs = 0` — yield after every start — rather than by computes
// that burn wall-clock. A busy-loop-for-N-milliseconds test is the flake shape
// this repo has already been bitten by, and `sliceMs = 0` is deterministic,
// needs no clock, and still fails when the deadline check is removed.
import { describe, it, expect } from 'vitest';
import { NodeGraphRuntime } from './node-editor.runtime';
import type { NodeTypeDefinition } from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';

const SOURCE: NodeTypeDefinition = {
    id: 'source',
    label: 'Source',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    initialState: () => 1,
    compute: (_inputs, ctx) => ({ out: ctx.state }),
};

const PASS: NodeTypeDefinition = {
    id: 'pass',
    label: 'Pass',
    ports: [
        { id: 'in', direction: 'in', label: 'In' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    compute: inputs => ({ out: inputs['in'] }),
};

function node(id: string, type: string): EditorNode {
    return { id, type, x: 0, y: 0, width: 180, height: 80, title: id, ports: [] };
}

function link(id: string, source: string, target: string): NodeConnection {
    return { id, source, sourcePort: 'out', target, targetPort: 'in' };
}

/** A runtime that records what it computed, with a counting `yieldTo`. */
function sliced(nodes: readonly EditorNode[], connections: readonly NodeConnection[]) {
    const runtime = new NodeGraphRuntime();
    runtime.setDefinitions([SOURCE, PASS]);
    runtime.setGraph(nodes, connections);

    let yields = 0;
    runtime.sliceMs = 0;
    runtime.yieldTo = (): Promise<void> => {
        yields++;
        // A real macrotask, not `Promise.resolve()`: a microtask never lets
        // anything else run, so a test built on one proves nothing about the
        // gap the mechanism exists to create.
        return new Promise(resolve => setTimeout(resolve, 0));
    };

    return { runtime, yieldCount: (): number => yields };
}

/** One source feeding `width` independent nodes: a wide second layer. */
function fan(width: number): { nodes: EditorNode[]; connections: NodeConnection[] } {
    const nodes: EditorNode[] = [node('root', 'source')];
    const connections: NodeConnection[] = [];
    for (let i = 0; i < width; i++) {
        nodes.push(node(`n${i}`, 'pass'));
        connections.push(link(`c${i}`, 'root', `n${i}`));
    }
    return { nodes, connections };
}

/** A straight chain, so every layer holds exactly one node. */
function chain(depth: number): { nodes: EditorNode[]; connections: NodeConnection[] } {
    const nodes: EditorNode[] = [node('n0', 'source')];
    const connections: NodeConnection[] = [];
    for (let i = 1; i < depth; i++) {
        nodes.push(node(`n${i}`, 'pass'));
        connections.push(link(`c${i}`, `n${i - 1}`, `n${i}`));
    }
    return { nodes, connections };
}

describe('a drain that yields', () => {
    it('does not yield at all when nothing is configured', async () => {
        const { nodes, connections } = fan(8);
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([SOURCE, PASS]);
        runtime.setGraph(nodes, connections);

        await runtime.run();

        expect(runtime.metrics.computedTotal).toBe(9);
        runtime.dispose();
    });

    it('runs a whole small graph inside one slice', async () => {
        const { nodes, connections } = fan(4);
        const graph = sliced(nodes, connections);
        // The default budget: five trivial computes cannot spend 8ms.
        graph.runtime.sliceMs = 8;

        await graph.runtime.run();

        expect(graph.yieldCount()).toBe(0);
        expect(graph.runtime.metrics.computedTotal).toBe(5);
        graph.runtime.dispose();
    });

    it('yields when the budget is spent, and still runs everything', async () => {
        const { nodes, connections } = fan(6);
        const graph = sliced(nodes, connections);

        await graph.runtime.run();

        expect(graph.yieldCount()).toBeGreaterThan(0);
        expect(graph.runtime.metrics.computedTotal).toBe(7);
        graph.runtime.dispose();
    });

    it('carries the deadline ACROSS layers, not per layer', async () => {
        /*
         * `execute` runs once per layer, so a deadline scoped to it restarts
         * every layer — and a chain has one node per layer, so the budget
         * would never be reached and the drain would never yield. This graph
         * is that shape on purpose.
         */
        const { nodes, connections } = chain(6);
        const graph = sliced(nodes, connections);

        /*
         * A budget one layer cannot reach on its own, on a stubbed clock so
         * nothing here depends on wall time. Each reading advances 2ms and the
         * budget is 5ms: a deadline reset per layer is never reached, because
         * a layer is one node; a deadline that carries is reached every third
         * node. `sliceMs = 0` cannot tell the two apart — every check is
         * already past a zero budget — which is why this test needs its own
         * clock rather than the shared harness.
         */
        const real = performance.now.bind(performance);
        let fake = 1_000;
        performance.now = (): number => {
            fake += 2;
            return fake;
        };
        graph.runtime.sliceMs = 5;

        try {
            await graph.runtime.run();
        } finally {
            performance.now = real;
        }

        expect(graph.yieldCount()).toBeGreaterThan(0);
        expect(graph.runtime.metrics.computedTotal).toBe(6);
        graph.runtime.dispose();
    });

    it('keeps topological order across the gaps', async () => {
        const { nodes, connections } = chain(5);
        const graph = sliced(nodes, connections);

        await graph.runtime.run();

        // `computed` is in the order compute actually ran.
        expect([...graph.runtime.metrics.computed]).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
        graph.runtime.dispose();
    });
});

describe('what a gap lets happen', () => {
    it('does not start a node whose readiness was withdrawn during a yield', async () => {
        /*
         * The failure this guards is silent. A node started after an edit
         * re-dirtied it computes from a stale upstream, and because it
         * captures its version AFTER the bump, it settles clean — so nothing
         * ever recomputes it and the wrong value stays for ever.
         *
         * The yield dirties the source, which withdraws readiness from the
         * whole cone. Every fan node must therefore end up recomputed against
         * the NEW source value, not the old one.
         */
        const { nodes, connections } = fan(6);
        const graph = sliced(nodes, connections);

        /*
         * On the THIRD gap, not the first. By then the source has run and the
         * fan layer is part-started, so the withdrawal lands on siblings that
         * are queued but not yet begun — which is the only arrangement that
         * exercises the guard. Dirtying before the layer starts proves
         * nothing: the test passed with the guard removed.
         */
        let gaps = 0;
        graph.runtime.yieldTo = (): Promise<void> => {
            gaps++;
            if (gaps === 3) graph.runtime.setState('root', 99);
            return new Promise(resolve => setTimeout(resolve, 0));
        };

        await graph.runtime.run();

        for (let i = 0; i < 6; i++) {
            expect(graph.runtime.outputs(`n${i}`)()['out']).toBe(99);
        }
        graph.runtime.dispose();
    });

    it('does not execute a node removed during a yield', async () => {
        const { nodes, connections } = fan(6);
        const graph = sliced(nodes, connections);
        const settled: string[] = [];
        graph.runtime.onNodeSettled = event => settled.push(String(event.nodeId));

        let removed = false;
        graph.runtime.yieldTo = (): Promise<void> => {
            if (!removed) {
                removed = true;
                // The graph loses n5 mid-slice, exactly as an edit would.
                graph.runtime.setGraph(
                    nodes.filter(candidate => candidate.id !== 'n5'),
                    connections.filter(candidate => candidate.target !== 'n5'),
                );
            }
            return new Promise(resolve => setTimeout(resolve, 0));
        };

        await graph.runtime.run();

        // Never settled, so it never minted signals for an id nothing prunes,
        // and the run is not filed as an error because of a deleted node.
        expect(settled).not.toContain('n5');
        graph.runtime.dispose();
    });

    it('stops when the runtime is disposed mid-slice', async () => {
        const { nodes, connections } = fan(20);
        const graph = sliced(nodes, connections);

        graph.runtime.yieldTo = (): Promise<void> => {
            graph.runtime.dispose();
            return new Promise(resolve => setTimeout(resolve, 0));
        };

        await graph.runtime.run();

        expect(graph.runtime.metrics.computedTotal).toBeLessThan(21);
    });
});

describe('a hostile yieldTo cannot break the runtime', () => {
    it('treats one that throws as absent and finishes the drain', async () => {
        const { nodes, connections } = fan(6);
        const graph = sliced(nodes, connections);
        graph.runtime.yieldTo = (): Promise<void> => {
            throw new Error('the host exploded');
        };

        await expect(graph.runtime.run()).resolves.toBeUndefined();

        expect(graph.runtime.metrics.computedTotal).toBe(7);
        graph.runtime.dispose();
    });

    it('is not held hostage by one that never resolves', async () => {
        /*
         * A drain waiting on a promise that never settles holds `draining`,
         * and every later `run()` and `step()` awaits that — the whole runtime
         * wedges. Disposal has to be able to cut the wait.
         */
        const { nodes, connections } = fan(6);
        const graph = sliced(nodes, connections);
        graph.runtime.yieldTo = (): Promise<void> => new Promise<void>(() => undefined);

        const running = graph.runtime.run();
        await new Promise(resolve => setTimeout(resolve, 10));
        graph.runtime.dispose();

        await expect(running).resolves.toBeUndefined();
    }, 10_000);
});

describe('stopping a run', () => {
    it('ends the drain, files it as cancelled, and leaves the graph resumable', async () => {
        /*
         * Cancelling deliberately leaves the graph DIRTY so a later run
         * resumes — which is exactly why the loops need their own check.
         * Nothing has left `readySet`, so `runnableNow()` keeps returning the
         * same batch: without it, `drain()` and `run()` both spin, and since
         * awaiting an already-resolved async function is a microtask, the tab
         * freezes rather than erroring. A timeout here would be that bug.
         */
        const { nodes, connections } = fan(40);
        const graph = sliced(nodes, connections);

        const finished: string[] = [];
        graph.runtime.onRunFinished = event => finished.push(event.status);

        let gaps = 0;
        graph.runtime.yieldTo = (): Promise<void> => {
            gaps++;
            if (gaps === 3) graph.runtime.cancel();
            return new Promise(resolve => setTimeout(resolve, 0));
        };

        await graph.runtime.run();

        expect(finished).toEqual(['cancelled']);
        expect(graph.runtime.metrics.computedTotal).toBeLessThan(41);

        // Still work to do, and a second run picks it up where it stopped.
        expect(graph.runtime.ready().length).toBeGreaterThan(0);

        graph.runtime.yieldTo = null;
        await graph.runtime.run();
        expect(graph.runtime.ready()).toEqual([]);
        graph.runtime.dispose();
    }, 15_000);

    it('leaves no node stuck running', async () => {
        /*
         * Aborting a node mid-compute makes its `executeLocal` return without
         * settling, so without a reset it keeps `status: 'running'` for the
         * life of the page — a spinner that never stops and a node nothing
         * ever picks up again.
         */
        const { nodes, connections } = fan(40);
        const graph = sliced(nodes, connections);

        let gaps = 0;
        graph.runtime.yieldTo = (): Promise<void> => {
            gaps++;
            if (gaps === 3) graph.runtime.cancel();
            return new Promise(resolve => setTimeout(resolve, 0));
        };

        await graph.runtime.run();

        const running = [...nodes, { id: 'root' }].filter(
            candidate => graph.runtime.status(candidate.id)() === 'running',
        );
        expect(running).toEqual([]);
        graph.runtime.dispose();
    }, 15_000);
});
