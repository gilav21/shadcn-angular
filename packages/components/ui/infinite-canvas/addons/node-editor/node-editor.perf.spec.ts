// RT-16 of `specs/node-editor-runtime-spec.md` §10.
//
// **Counts are enforced. Timings are logged and never fail the build.**
//
// That split is deliberate. A count is exact and cannot flake on a loaded
// machine; a millisecond on a busy Windows box is neither, and this repo has
// been bitten by timing gates flaking before. The counts also catch the
// regressions that actually destroy performance — an O(N) re-evaluation where
// it should be O(descendants) shows up as a number, never as a duration.
import { describe, it, expect, vi } from 'vitest';
import { NodeGraphRuntime } from './node-editor.runtime';
import type {
    NodeTypeDefinition,
    PortValues,
    RemoteRequest,
} from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';

const SOURCE: NodeTypeDefinition = {
    id: 'source',
    label: 'Source',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    initialState: () => 0,
    compute: (_inputs, ctx) => ({ out: ctx.state }),
};

const PASSTHROUGH: NodeTypeDefinition = {
    id: 'passthrough',
    label: 'Passthrough',
    ports: [
        { id: 'in', direction: 'in', label: 'In' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    compute: inputs => ({ out: inputs['in'] }),
};

const REMOTE: NodeTypeDefinition = {
    id: 'remote',
    label: 'Remote',
    remote: true,
    ports: [
        { id: 'in', direction: 'in', label: 'In' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
};

const COLLECTOR: NodeTypeDefinition = {
    id: 'collector',
    label: 'Collector',
    ports: [
        { id: 'items', direction: 'in', label: 'Items', multi: 'collect' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    compute: inputs => ({ out: (inputs['items'] as unknown[]).length }),
};

const DEFS = [SOURCE, PASSTHROUGH, REMOTE, COLLECTOR];

function node(id: string, type: string): EditorNode {
    return { id, type, x: 0, y: 0, width: 180, height: 80 };
}

/**
 * A wide graph: one source feeding `width` independent chains of `depth`.
 *
 * Wide rather than one long chain, because the property under test is that a
 * change touches only what depends on it — and a single chain cannot tell
 * "only descendants" apart from "everything".
 */
function buildGraph(width: number, depth: number): {
    nodes: EditorNode[];
    connections: NodeConnection[];
} {
    const nodes: EditorNode[] = [];
    const connections: NodeConnection[] = [];

    for (let branch = 0; branch < width; branch++) {
        nodes.push(node(`s${branch}`, 'source'));
        let previous = `s${branch}`;
        for (let level = 0; level < depth; level++) {
            const id = `n${branch}_${level}`;
            nodes.push(node(id, 'passthrough'));
            connections.push({
                id: `c${branch}_${level}`,
                source: previous,
                sourcePort: 'out',
                target: id,
                targetPort: 'in',
            });
            previous = id;
        }
    }
    return { nodes, connections };
}

function runtimeFor(width: number, depth: number): NodeGraphRuntime {
    const runtime = new NodeGraphRuntime();
    runtime.setDefinitions(DEFS);
    const { nodes, connections } = buildGraph(width, depth);
    runtime.setGraph(nodes, connections);
    return runtime;
}

/** Logged, never asserted on. */
function report(label: string, ms: number): void {
    // eslint-disable-next-line no-console -- the whole point of this file
    console.log(`[perf] ${label}: ${ms.toFixed(2)}ms`);
}

// =========================================================== ENFORCED: counts

describe('ENFORCED — a change costs only what depends on it', () => {
    it('recomputes one branch, not the whole graph', async () => {
        // 200 branches x 10 deep = 2,200 nodes.
        const runtime = runtimeFor(200, 10);
        await runtime.run();

        runtime.resetMetrics();
        runtime.setState('s7', 1);
        await runtime.run();

        // The changed source plus its ten descendants. Nothing else.
        expect(runtime.metrics.computed).toHaveLength(11);
        expect(runtime.metrics.computed.every(id => String(id).startsWith('s7') || String(id).startsWith('n7_'))).toBe(true);
    });

    it('recomputes NOTHING when nothing changed', async () => {
        const runtime = runtimeFor(50, 5);
        await runtime.run();

        runtime.resetMetrics();
        await runtime.run();

        expect(runtime.metrics.computed).toEqual([]);
    });

    it('recomputes nothing when a value is set to what it already was', async () => {
        const runtime = runtimeFor(50, 5);
        runtime.setState('s0', 42);
        await runtime.run();

        runtime.resetMetrics();
        runtime.setState('s0', 42);
        await runtime.run();

        // NOT even the source itself. Memoisation compares state as well as
        // inputs, so setting a value to the one it already holds is a complete
        // no-op rather than one wasted recompute — which is what makes a
        // controlled input safe to write on every keystroke.
        expect(runtime.metrics.computed).toEqual([]);
    });

    /**
     * design §4 — the single easiest way to lose every memoisation in the
     * system, because a collect port resolves to a fresh array every pass.
     */
    it('recomputes nothing through a COLLECT port when nothing changed', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        const nodes = [node('m', 'collector')];
        const connections: NodeConnection[] = [];
        for (let i = 0; i < 25; i++) {
            nodes.push(node(`s${i}`, 'source'));
            connections.push({
                id: `c${i}`, source: `s${i}`, sourcePort: 'out', target: 'm', targetPort: 'items',
            });
        }
        runtime.setGraph(nodes, connections);
        await runtime.run();

        runtime.resetMetrics();
        await runtime.run();

        expect(runtime.metrics.computed).toEqual([]);
    });
});

describe('ENFORCED — the topological order is maintained, not rebuilt', () => {
    it('never reorders when a graph is built upstream-first', () => {
        const runtime = runtimeFor(200, 10);
        expect(runtime.metrics.reorders).toBe(0);
    });

    it('never reorders on disconnect', () => {
        const runtime = runtimeFor(20, 5);
        const before = runtime.metrics.reorders;
        const { nodes, connections } = buildGraph(20, 5);
        runtime.setGraph(nodes, connections.slice(1));
        expect(runtime.metrics.reorders).toBe(before);
    });
});

describe('ENFORCED — remote work is batched', () => {
    it('sends 40 ready remote nodes in ONE call', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(
            Array.from({ length: 40 }, (_, i) => node(`r${i}`, 'remote')),
            [],
        );
        const executor = vi.fn(async (batch: readonly RemoteRequest[]) =>
            batch.map(r => ({ runId: r.runId, nodeId: r.nodeId, ok: true as const, outputs: {} as PortValues })),
        );
        runtime.executeRemote = executor;

        await runtime.run();

        expect(executor).toHaveBeenCalledTimes(1);
        expect(executor.mock.calls[0][0]).toHaveLength(40);
    });

    it('batches per LEVEL, because a level cannot start before the one above', async () => {
        // r0 -> r1 -> r2. Three levels, so three calls; batching cannot
        // collapse a dependency.
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(
            [node('r0', 'remote'), node('r1', 'remote'), node('r2', 'remote')],
            [
                { id: 'a', source: 'r0', sourcePort: 'out', target: 'r1', targetPort: 'in' },
                { id: 'b', source: 'r1', sourcePort: 'out', target: 'r2', targetPort: 'in' },
            ],
        );
        const executor = vi.fn(async (batch: readonly RemoteRequest[]) =>
            batch.map(r => ({ runId: r.runId, nodeId: r.nodeId, ok: true as const, outputs: { out: 1 } })),
        );
        runtime.executeRemote = executor;

        await runtime.run();
        expect(executor).toHaveBeenCalledTimes(3);
    });
});

describe('ENFORCED — streams do not leak', () => {
    it('leaves zero open iterators after the edge is disconnected', async () => {
        const streamer: NodeTypeDefinition = {
            id: 'streamer',
            label: 'Streamer',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            compute: () => (async function* () {
                while (true) {
                    yield { out: 1 };
                    await new Promise(resolve => setTimeout(resolve, 2));
                }
            })(),
        };
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([streamer, PASSTHROUGH]);
        const nodes = [node('s', 'streamer'), node('t', 'passthrough')];
        runtime.setGraph(nodes, [
            { id: 'e', source: 's', sourcePort: 'out', target: 't', targetPort: 'in' },
        ]);

        await runtime.run();
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(runtime.metrics.openIterators).toBe(1);

        runtime.setGraph(nodes, []);
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(runtime.metrics.openIterators).toBe(0);

        runtime.dispose();
    });

    it('leaves zero open iterators after dispose', async () => {
        const streamer: NodeTypeDefinition = {
            id: 'streamer',
            label: 'Streamer',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            compute: () => (async function* () {
                while (true) {
                    yield { out: 1 };
                    await new Promise(resolve => setTimeout(resolve, 2));
                }
            })(),
        };
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([streamer]);
        runtime.setGraph([node('s', 'streamer')], []);
        await runtime.run();
        await new Promise(resolve => setTimeout(resolve, 20));

        runtime.dispose();
        expect(runtime.metrics.openIterators).toBe(0);
    });
});

describe('ENFORCED — a full drain stays linear in the size of the graph', () => {
    /*
     * The claim that caused the freeze, as a NUMBER.
     *
     * Readiness used to be recomputed over the whole dirty set on every
     * settle. The dirty set starts at every node and sheds one per settle, so
     * a full drain was N^2/2: measured at 51, 190 and 770ms for 2,000, 4,000
     * and 8,000 nodes — four times the work for twice the graph — which
     * extrapolates to about two minutes of blocked main thread at a hundred
     * thousand nodes, and that is what the device testing reported.
     *
     * Reverting the fix is behaviourally identical and quadratically slower,
     * so every functional test stays green. Only a cost can catch it, and a
     * cost in MILLISECONDS on a loaded Windows box is a flake waiting to
     * happen — this repo has been bitten by timing gates before. So the
     * runtime counts the nodes it examines while deciding what is ready, and
     * the assertion is on the ratio: double the graph, and the work may
     * double and a bit, not square.
     */
    async function scansFor(width: number): Promise<number> {
        const runtime = runtimeFor(width, 3);
        runtime.resetMetrics();
        await runtime.run();
        const scans = runtime.metrics.readyScans;
        runtime.dispose();
        return scans;
    }

    it('counts something proportional to the graph in the first place', async () => {
        /*
         * A ratio between two readings of one counter is happy with a
         * counter that never moves: clamping it to a constant, or deleting an
         * increment, makes the gate below pass under the very regression it
         * guards. So the magnitude is pinned too — roughly one scan per node
         * per pass, within a wide band, and never zero.
         */
        const nodes = 250 * 4;
        const scans = await scansFor(250);

        expect(scans).toBeGreaterThan(nodes / 2);
        expect(scans).toBeLessThan(nodes * 8);
    });

    it('doubling the node count does not square the readiness work', async () => {
        const small = await scansFor(250);
        const large = await scansFor(500);

        /*
         * Linear would be 2x. Quadratic is 4x and climbs with every doubling.
         * The bound is 3x: loose enough that graph shape and the constant
         * factor cannot flake it, tight enough that N^2/2 cannot fit under it
         * — at these sizes the old code scanned roughly five hundred times
         * more than the new one.
         */
        expect(large).toBeLessThan(small * 3);

        /*
         * And it has to GROW. A ratio alone is satisfied by a counter that
         * never moves — clamping it to a constant makes small and large equal
         * and every assertion above pass, under the quadratic too. Linear is
         * exactly 2x here, so 1.5x is a floor no honest implementation can
         * miss and no frozen counter can reach.
         */
        expect(large).toBeGreaterThan(small * 1.5);
    });
});

describe('ENFORCED — building a graph dirties each node once', () => {
    /*
     * Every connection dirties its target's descendants. Doing that once per
     * connection re-walks the same nodes once per incoming edge, so the cost
     * is O(nodes x in-degree) rather than O(nodes) — and on a wide graph that
     * is most of what building it costs.
     *
     * A count, not a clock: this measurement swung eighty milliseconds between
     * identical runs on a quiet machine, which is more than the thing being
     * measured.
     */
    it('visits each node about once, not once per incoming edge', () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.resetMetrics();

        /*
         * A CHAIN, which is the shape that separates the two.
         *
         * A fan-out cannot: every target's descendant cone is just itself, so
         * walking per connection and walking once cost the same, and the first
         * version of this test passed with the regression in place. In a chain
         * each connection's target has the whole rest of the graph below it, so
         * per-connection walking is quadratic and batching is linear.
         */
        const nodes = [node('n0', 'source')];
        const connections = [];
        for (let i = 1; i < 500; i++) {
            nodes.push(node(`n${i}`, 'passthrough'));
            connections.push({
                id: `c${i}`,
                source: `n${i - 1}`,
                sourcePort: 'out',
                target: `n${i}`,
                targetPort: 'in',
            });
        }
        runtime.setGraph(nodes, connections);

        /*
         * 500 nodes, each dirtied by `addNode` and then reached once by the
         * batched walk: two visits each is the honest floor. Four times the
         * node count leaves room for that, and sits far below the quadratic —
         * walking per connection visits about 125,000.
         */
        expect(runtime.metrics.dirtyScans).toBeLessThan(nodes.length * 4);
        runtime.dispose();
    });
});

// ============================================================ LOGGED: timings

describe('LOGGED — wall clock, never enforced', () => {
    it('reports the cost of a first full run and of one keystroke', async () => {
        const runtime = runtimeFor(200, 10);      // 2,200 nodes

        const startFull = performance.now();
        await runtime.run();
        report('first full run (2,200 nodes)', performance.now() - startFull);

        // The claim the whole design rests on: the cost of one change is set
        // by its descendants, not by the size of the graph.
        const startOne = performance.now();
        runtime.setState('s3', 99);
        await runtime.run();
        report('one change, 10 descendants', performance.now() - startOne);

        const startNoop = performance.now();
        await runtime.run();
        report('no-op run', performance.now() - startNoop);

        // No assertion on any of the above. The counts elsewhere in this file
        // are what protect the behaviour.
        expect(runtime.metrics.computed.length).toBeGreaterThanOrEqual(0);
    });

    it('reports the cost of building a large graph', () => {
        const start = performance.now();
        const runtime = runtimeFor(500, 10);      // 5,500 nodes
        report('build 5,500 nodes', performance.now() - start);

        // Structural, and therefore safe to assert: building the graph must
        // not have needed a single reorder.
        expect(runtime.metrics.reorders).toBe(0);
    });
});
