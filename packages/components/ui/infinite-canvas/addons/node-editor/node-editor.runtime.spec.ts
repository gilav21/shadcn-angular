// RT-2 … RT-10 of `specs/node-editor-runtime-spec.md`.
//
// These are the assertions the design spike proved before this code existed,
// now run against the production runtime. Every one of them is a COUNT rather
// than a wall-clock reading (§10 of the requirements spec): a count is exact,
// cannot flake on a loaded machine, and catches the regressions that actually
// destroy performance — an O(N) re-evaluation shows up as a number, never as a
// millisecond.
import { describe, it, expect, vi } from 'vitest';
import { NodeGraphRuntime } from './node-editor.runtime';
import type {
    NodeTypeDefinition,
    PortValues,
    RemoteRequest,
} from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';

// ---------------------------------------------------------------- fixtures

const SOURCE: NodeTypeDefinition = {
    id: 'source',
    label: 'Source',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    initialState: () => 'seed',
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

const COLLECTOR: NodeTypeDefinition = {
    id: 'collector',
    label: 'Collector',
    ports: [
        { id: 'items', direction: 'in', label: 'Items', multi: 'collect' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    compute: inputs => ({ out: (inputs['items'] as unknown[]).join(',') }),
};

const REMOTE: NodeTypeDefinition = {
    id: 'remote',
    label: 'Remote',
    remote: true,
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
};

const DEFS = [SOURCE, PASSTHROUGH, COLLECTOR, REMOTE];

function node(id: string, type: string): EditorNode {
    return { id, type, x: 0, y: 0, width: 180, height: 80, title: id, ports: [] };
}

function link(id: string, source: string, target: string, targetPort = 'in'): NodeConnection {
    return { id, source, sourcePort: 'out', target, targetPort };
}

/** A source feeding a chain of passthroughs. */
function chainRuntime(ids: readonly string[], extraDefs: NodeTypeDefinition[] = []): NodeGraphRuntime {
    const runtime = new NodeGraphRuntime();
    runtime.setDefinitions([...DEFS, ...extraDefs]);
    runtime.setGraph(
        ids.map((id, i) => node(id, i === 0 ? 'source' : 'passthrough')),
        ids.slice(1).map((id, i) => link(`c${i}`, ids[i], id)),
    );
    return runtime;
}

// ------------------------------------------------------------------- tests

describe('RT-2 incremental topological order', () => {
    it('does not reorder when nodes are created upstream-first', () => {
        const runtime = chainRuntime(['a', 'b', 'c', 'd']);
        expect(runtime.metrics.reorders).toBe(0);
    });

    it('reorders only the affected region when an edge inverts the order', () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        // `later` is added first, so the edge earlier -> later inverts it.
        runtime.setGraph([node('later', 'passthrough'), node('earlier', 'source')], []);
        runtime.setGraph(
            [node('later', 'passthrough'), node('earlier', 'source')],
            [link('c', 'earlier', 'later')],
        );
        expect(runtime.metrics.reorders).toBe(1);
    });

    it('never reorders on disconnect — removing an edge cannot invalidate an order', () => {
        const runtime = chainRuntime(['a', 'b', 'c']);
        const before = runtime.metrics.reorders;
        runtime.setGraph(
            ['a', 'b', 'c'].map((id, i) => node(id, i === 0 ? 'source' : 'passthrough')),
            [link('c1', 'b', 'c')],
        );
        expect(runtime.metrics.reorders).toBe(before);
    });
});

describe('RT-3 scoped re-evaluation and memoisation', () => {
    it('recomputes the changed node and its descendants, and nothing else', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(
            [node('a', 'source'), node('b', 'passthrough'), node('c', 'passthrough'),
             node('x', 'source'), node('y', 'passthrough')],
            [link('1', 'a', 'b'), link('2', 'b', 'c'), link('3', 'x', 'y')],
        );
        await runtime.run();

        runtime.resetMetrics();
        runtime.setState('a', 'changed');
        await runtime.run();

        expect(new Set(runtime.metrics.computed)).toEqual(new Set(['a', 'b', 'c']));
        expect(runtime.metrics.computed).not.toContain('x');
        expect(runtime.metrics.computed).not.toContain('y');
    });

    it('recomputes nothing at all when nothing changed', async () => {
        const runtime = chainRuntime(['a', 'b', 'c']);
        await runtime.run();

        runtime.resetMetrics();
        runtime.setState('a', 'seed');       // the value it already had
        await runtime.run();

        expect(runtime.metrics.computed).not.toContain('b');
        expect(runtime.metrics.computed).not.toContain('c');
    });

    /**
     * design §2.1, found by the spike and stronger than "only descendants".
     *
     * Propagation stops where OUTPUTS stop changing, so a wide subtree hanging
     * off a node that recomputes to the same value costs exactly one node.
     */
    it('stops propagating where an output stops changing', async () => {
        const runtime = chainRuntime(['a', 'b', 'c']);
        await runtime.run();

        runtime.resetMetrics();
        // `b` is a passthrough — its compute ignores state, so re-running it
        // produces an identical output and `c` has nothing to react to.
        runtime.setState('b', 'irrelevant');
        await runtime.run();

        expect(runtime.metrics.computed).toEqual(['b']);
    });

    /**
     * design §4 — the single easiest way to lose every memoisation in the
     * system. A collect port resolves to a NEW array each pass, so an identity
     * comparison would report a change every time.
     */
    it('still memoises through a collect port', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(
            [node('s1', 'source'), node('s2', 'source'), node('m', 'collector'), node('t', 'passthrough')],
            [
                { id: 'a', source: 's1', sourcePort: 'out', target: 'm', targetPort: 'items' },
                { id: 'b', source: 's2', sourcePort: 'out', target: 'm', targetPort: 'items' },
                link('c', 'm', 't'),
            ],
        );
        runtime.setState('s1', 'one');
        runtime.setState('s2', 'two');
        await runtime.run();
        expect(runtime.outputs('m')()['out']).toBe('one,two');

        runtime.resetMetrics();
        runtime.setState('s1', 'one');       // identical
        await runtime.run();

        expect(runtime.metrics.computed).not.toContain('m');
        expect(runtime.metrics.computed).not.toContain('t');
    });

    it('resolves a collect port in connection order', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(
            [node('s1', 'source'), node('s2', 'source'), node('m', 'collector')],
            [
                { id: 'a', source: 's1', sourcePort: 'out', target: 'm', targetPort: 'items' },
                { id: 'b', source: 's2', sourcePort: 'out', target: 'm', targetPort: 'items' },
            ],
        );
        runtime.setState('s1', 'first');
        runtime.setState('s2', 'second');
        await runtime.run();
        expect(runtime.outputs('m')()['out']).toBe('first,second');
    });

    it('walks a diamond tail once, not once per path', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(
            [node('top', 'source'), node('l', 'passthrough'), node('r', 'passthrough'), node('bottom', 'passthrough')],
            [link('1', 'top', 'l'), link('2', 'top', 'r'), link('3', 'l', 'bottom'), link('4', 'r', 'bottom')],
        );
        await runtime.run();

        runtime.resetMetrics();
        runtime.setState('top', 'next');
        await runtime.run();

        expect(runtime.metrics.computed.filter(n => n === 'bottom')).toHaveLength(1);
    });
});

describe('RT-4 async runs and staleness', () => {
    function slow(delays: Record<string, number>): NodeTypeDefinition {
        return {
            id: 'slow',
            label: 'Slow',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            compute: async (_inputs, ctx) => {
                const value = ctx.state as string;
                await new Promise(resolve => setTimeout(resolve, delays[value] ?? 0));
                return { out: value };
            },
        };
    }

    /**
     * The drain is serialised, so two runs of the SAME node never overlap:
     * a change arriving mid-run leaves the node dirty, and the drain runs it
     * again once the first finishes. The newest state always wins, and no work
     * races anything.
     *
     * This is the behaviour that matters for the motivating example — type
     * fast, and the far end of the graph shows what you typed last.
     */
    it('always ends on the newest state, however slow the earlier run was', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([slow({ old: 45, new: 0 })]);
        runtime.setGraph([node('n', 'slow')], []);
        runtime.setState('n', 'old');

        const first = runtime.run();
        runtime.setState('n', 'new');
        const second = runtime.run();
        await Promise.all([first, second]);

        expect(runtime.outputs('n')()['out']).toBe('new');
    });

    it('does not drop work that arrives while a node is running', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([slow({ first: 30, second: 0 })]);
        runtime.setGraph([node('n', 'slow')], []);
        runtime.setState('n', 'first');

        const inFlight = runtime.run();
        // Settling the first run must not clear the dirtiness this created.
        runtime.setState('n', 'second');
        await inFlight;
        await runtime.run();

        expect(runtime.outputs('n')()['out']).toBe('second');
    });

    /**
     * Where staleness IS reachable: a backend answering out of order.
     *
     * The drain cannot serialise the network, so a reply carrying an old runId
     * can genuinely arrive after a newer one. The policy decides what happens.
     */
    describe('a remote reply carrying a stale runId', () => {
        function remoteRuntime(staleness?: NodeTypeDefinition['staleness']): NodeGraphRuntime {
            const definition: NodeTypeDefinition = {
                id: 'remote', label: 'Remote', remote: true, staleness,
                ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            };
            const runtime = new NodeGraphRuntime();
            runtime.setDefinitions([definition]);
            runtime.setGraph([node('r', 'remote')], []);
            return runtime;
        }

        /** Replies with a runId one older than the request's. */
        async function replyStale(batch: readonly RemoteRequest[]) {
            return batch.map(request => ({
                runId: request.runId - 1,
                nodeId: request.nodeId,
                ok: true as const,
                outputs: { out: 'stale' } as PortValues,
            }));
        }

        it('is discarded under the default cancel policy', async () => {
            const runtime = remoteRuntime();
            runtime.executeRemote = replyStale;
            await runtime.run();
            expect(runtime.outputs('r')()['out']).toBeUndefined();
        });

        it('is discarded under drop', async () => {
            const runtime = remoteRuntime('drop');
            runtime.executeRemote = replyStale;
            await runtime.run();
            expect(runtime.outputs('r')()['out']).toBeUndefined();
        });

        it('is APPLIED under apply — which is why that is opt-in', async () => {
            const runtime = remoteRuntime('apply');
            runtime.executeRemote = replyStale;
            await runtime.run();
            expect(runtime.outputs('r')()['out']).toBe('stale');
        });

        it('applies a reply whose runId is current', async () => {
            const runtime = remoteRuntime();
            runtime.executeRemote = async batch =>
                batch.map(r => ({ runId: r.runId, nodeId: r.nodeId, ok: true as const, outputs: { out: 'fresh' } }));
            await runtime.run();
            expect(runtime.outputs('r')()['out']).toBe('fresh');
        });
    });

    /** The other reachable overlap: a stream still running when a new run starts. */
    it('aborts a running stream when its node is re-run', async () => {
        const aborted: string[] = [];
        const definition: NodeTypeDefinition = {
            id: 'ticker',
            label: 'Ticker',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            compute: (_inputs, ctx) => {
                const label = ctx.state as string;
                ctx.signal.addEventListener('abort', () => aborted.push(label));
                return (async function* () {
                    while (true) {
                        yield { out: label };
                        await new Promise(resolve => setTimeout(resolve, 5));
                    }
                })();
            },
        };
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([definition]);
        runtime.setGraph([node('n', 'ticker')], []);

        runtime.setState('n', 'first');
        await runtime.run();
        await new Promise(resolve => setTimeout(resolve, 15));

        runtime.setState('n', 'second');
        await runtime.run();
        await new Promise(resolve => setTimeout(resolve, 15));

        expect(aborted).toContain('first');
        runtime.dispose();
    });

    it('records a thrown compute as an error rather than dying', async () => {
        const definition: NodeTypeDefinition = {
            id: 'boom',
            label: 'Boom',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            compute: () => { throw new Error('nope'); },
        };
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([definition]);
        runtime.setGraph([node('n', 'boom')], []);
        await runtime.run();

        expect(runtime.status('n')()).toBe('error');
        expect((runtime.error('n')() as Error).message).toBe('nope');
    });
});

describe('RT-5 streams', () => {
    it('propagates every yield and tears the iterator down on disconnect', async () => {
        let closed = false;
        const streamer: NodeTypeDefinition = {
            id: 'streamer',
            label: 'Streamer',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            compute: () => (async function* () {
                try {
                    for (let i = 0; i < 1_000_000; i++) {
                        yield { out: i };
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }
                } finally {
                    closed = true;      // a real node closes its socket here
                }
            })(),
        };

        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([streamer, PASSTHROUGH]);
        const nodes = [node('s', 'streamer'), node('t', 'passthrough')];
        runtime.setGraph(nodes, [link('e', 's', 't')]);

        void runtime.run();
        await new Promise(resolve => setTimeout(resolve, 25));
        expect(runtime.metrics.openIterators).toBe(1);

        runtime.setGraph(nodes, []);        // disconnect
        await new Promise(resolve => setTimeout(resolve, 25));

        expect(closed).toBe(true);
        expect(runtime.metrics.openIterators).toBe(0);
    });

    it('leaves no iterator open after dispose', async () => {
        const streamer: NodeTypeDefinition = {
            id: 'streamer',
            label: 'Streamer',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            compute: () => (async function* () {
                while (true) {
                    yield { out: 1 };
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            })(),
        };
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([streamer]);
        runtime.setGraph([node('s', 'streamer')], []);
        void runtime.run();
        await new Promise(resolve => setTimeout(resolve, 20));

        runtime.dispose();
        expect(runtime.metrics.openIterators).toBe(0);
    });
});

describe('RT-6 cycles', () => {
    it('terminates on a cyclic graph and marks the loop', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(
            [node('a', 'source'), node('b', 'passthrough'), node('c', 'passthrough')],
            [link('1', 'a', 'b'), link('2', 'b', 'c'), link('3', 'c', 'b')],
        );

        await runtime.run();       // the assertion is that this RESOLVES

        expect(runtime.status('b')()).toBe('cycle');
        expect(runtime.status('c')()).toBe('cycle');
    });

    it('reports the cycle as a graph problem in plain language', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(
            [node('a', 'source'), node('b', 'passthrough')],
            [link('1', 'a', 'b'), link('2', 'b', 'a', 'in')],
        );
        await runtime.run();

        const cycle = runtime.problems().filter(p => p.kind === 'cycle');
        expect(cycle.length).toBeGreaterThan(0);
        expect(cycle[0].message).toContain('loop');
    });

    it('handles a self-edge', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph([node('solo', 'passthrough')], [link('s', 'solo', 'solo')]);
        await runtime.run();
        expect(runtime.status('solo')()).toBe('cycle');
    });
});

describe('RT-7 run and step', () => {
    it('advances exactly one node per step, in dependency order', async () => {
        const runtime = chainRuntime(['a', 'b', 'c']);

        await runtime.step();
        expect(runtime.metrics.computed).toEqual(['a']);
        await runtime.step();
        expect(runtime.metrics.computed).toEqual(['a', 'b']);
        await runtime.step();
        expect(runtime.metrics.computed).toEqual(['a', 'b', 'c']);
    });

    it('is a no-op once nothing is ready', async () => {
        const runtime = chainRuntime(['a', 'b']);
        await runtime.run();
        runtime.resetMetrics();
        await runtime.step();
        expect(runtime.metrics.computed).toEqual([]);
    });

    it('exposes what step() would pick next', async () => {
        const runtime = chainRuntime(['a', 'b']);
        expect(runtime.ready()).toEqual(['a']);
        await runtime.step();
        expect(runtime.ready()).toEqual(['b']);
    });
});

describe('RT-8 remote batching', () => {
    it('sends every ready remote node in ONE call', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph(
            Array.from({ length: 12 }, (_, i) => node(`r${i}`, 'remote')),
            [],
        );

        const executor = vi.fn(async (batch: readonly RemoteRequest[]) =>
            batch.map(request => ({
                runId: request.runId,
                nodeId: request.nodeId,
                ok: true as const,
                outputs: { out: request.nodeId } as PortValues,
            })),
        );
        runtime.executeRemote = executor;

        await runtime.run();

        expect(executor).toHaveBeenCalledTimes(1);
        expect(executor.mock.calls[0][0]).toHaveLength(12);
        expect(runtime.metrics.remoteCalls).toBe(1);
        expect(runtime.outputs('r7')()['out']).toBe('r7');
    });

    it('carries the node type, so a server can dispatch on it', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph([node('r', 'remote')], []);
        const executor = vi.fn(async (batch: readonly RemoteRequest[]) =>
            batch.map(r => ({ runId: r.runId, nodeId: r.nodeId, ok: true as const, outputs: {} })),
        );
        runtime.executeRemote = executor;
        await runtime.run();

        expect(executor.mock.calls[0][0][0].type).toBe('remote');
    });

    it('errors rather than hanging when no executor is bound', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph([node('r', 'remote')], []);
        await runtime.run();

        expect(runtime.status('r')()).toBe('error');
        expect(runtime.problems().some(p => p.kind === 'remote-without-executor')).toBe(true);
    });

    it('surfaces a per-node remote failure without failing the batch', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph([node('ok', 'remote'), node('bad', 'remote')], []);
        runtime.executeRemote = async batch =>
            batch.map(r =>
                r.nodeId === 'bad'
                    ? { runId: r.runId, nodeId: r.nodeId, ok: false as const, error: 'upstream 500' }
                    : { runId: r.runId, nodeId: r.nodeId, ok: true as const, outputs: { out: 1 } },
            );
        await runtime.run();

        expect(runtime.status('ok')()).toBe('done');
        expect(runtime.status('bad')()).toBe('error');
        expect(runtime.error('bad')()).toBe('upstream 500');
    });
});

describe('RT-9 graph problems', () => {
    it('reports a required input that is not connected', () => {
        const definition: NodeTypeDefinition = {
            id: 'needs',
            label: 'Needs',
            ports: [{ id: 'url', direction: 'in', label: 'URL', required: true }],
        };
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([definition]);
        runtime.setGraph([{ ...node('n', 'needs'), title: 'Browser' }], []);

        const problem = runtime.problems().find(p => p.kind === 'required-input-unconnected');
        expect(problem?.message).toContain('Browser');
        expect(problem?.message).toContain('URL');
    });

    it('reports an unregistered node type', () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph([{ ...node('n', 'nope'), title: 'Mystery' }], []);

        expect(runtime.problems().some(p => p.kind === 'unknown-type')).toBe(true);
    });

    it('clears a problem once it is resolved', async () => {
        const definition: NodeTypeDefinition = {
            id: 'needs',
            label: 'Needs',
            ports: [{ id: 'in', direction: 'in', label: 'In', required: true }],
        };
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([definition, SOURCE]);
        const nodes = [node('s', 'source'), node('n', 'needs')];
        runtime.setGraph(nodes, []);
        expect(runtime.problems()).toHaveLength(1);

        runtime.setGraph(nodes, [link('c', 's', 'n')]);
        await runtime.run();
        expect(runtime.problems()).toHaveLength(0);
    });
});

describe('RT-10 isolation — the subgraph seam', () => {
    /**
     * The runtime must carry no global state, or a nested graph would share it
     * with its parent. This is the test that keeps that door open.
     */
    it('keeps two instances completely separate', async () => {
        const one = chainRuntime(['a', 'b']);
        const two = chainRuntime(['a', 'b']);

        one.setState('a', 'ONE');
        two.setState('a', 'TWO');
        await Promise.all([one.run(), two.run()]);

        expect(one.outputs('b')()['out']).toBe('ONE');
        expect(two.outputs('b')()['out']).toBe('TWO');
    });

    it('lets a node own a child runtime — the subgraph shape', async () => {
        const subgraph: NodeTypeDefinition = {
            id: 'subgraph',
            label: 'Subgraph',
            ports: [{ id: 'out', direction: 'out', label: 'Out' }],
            compute: async () => {
                const inner = chainRuntime(['a', 'b']);
                inner.setState('a', 'from-inside');
                await inner.run();
                return { out: inner.outputs('b')()['out'] };
            },
        };
        const outer = new NodeGraphRuntime();
        outer.setDefinitions([subgraph]);
        outer.setGraph([node('sg', 'subgraph')], []);
        await outer.run();

        expect(outer.outputs('sg')()['out']).toBe('from-inside');
    });
});

/*
 * State written before its node arrives.
 *
 * `deserializeGraph` hands back `states` beside `nodes`, and swapping which
 * graph is on screen re-mounts a node that was removed while another one was
 * showing — so "set the state, then set the graph" is an order consumers reach
 * for. It used to be dropped on the floor twice over: `setState` returned early
 * for an id the runtime did not hold, and `addNode` then seeded
 * `initialState()` regardless. The graph came back with the right shape and the
 * wrong values, and nothing failed.
 */
/*
 * The connections index, which has to stay in step with the connections.
 *
 * Resolving a node's inputs and reporting its unconnected required ports both
 * ask "what lands here", and both read a Map grouped by target rather than
 * scanning every connection in the graph. That is a second copy of the truth,
 * and the failure it can have is going stale — answering from a wiring that no
 * longer exists, which no timing test would ever notice.
 */
describe('what lands on a node, after the wiring changes', () => {
    it('follows a connection being rewired to a different target', async () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions(DEFS);
            const nodes = [node('s', 'source'), node('a', 'passthrough'), node('b', 'passthrough')];
            runtime.setGraph(nodes, [
                { id: 'c', source: 's', sourcePort: 'out', target: 'a', targetPort: 'in' },
            ]);
            await runtime.run();
            expect(runtime.inputs('a')()['in']).toBe('seed');
            expect(runtime.inputs('b')()['in']).toBeUndefined();

            // The same connection id, pointing somewhere else.
            runtime.setGraph(nodes, [
                { id: 'c', source: 's', sourcePort: 'out', target: 'b', targetPort: 'in' },
            ]);
            await runtime.run();

            expect(runtime.inputs('b')()['in']).toBe('seed');
            expect(runtime.inputs('a')()['in']).toBeUndefined();
        } finally {
            runtime.dispose();
        }
    });

    it('forgets a connection that was removed', async () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions(DEFS);
            const nodes = [node('s', 'source'), node('a', 'passthrough')];
            runtime.setGraph(nodes, [
                { id: 'c', source: 's', sourcePort: 'out', target: 'a', targetPort: 'in' },
            ]);
            await runtime.run();
            expect(runtime.inputs('a')()['in']).toBe('seed');

            runtime.setGraph(nodes, []);
            await runtime.run();

            expect(runtime.inputs('a')()['in']).toBeUndefined();
        } finally {
            runtime.dispose();
        }
    });

    /** A required port reports as unconnected the moment its wire goes. */
    it('reports a required input again once its wire is gone', async () => {
        const NEEDS: NodeTypeDefinition = {
            id: 'needs',
            label: 'Needs',
            ports: [{ id: 'in', direction: 'in', label: 'In', required: true }],
        };
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([...DEFS, NEEDS]);
            const nodes = [node('s', 'source'), node('n', 'needs')];
            runtime.setGraph(nodes, [
                { id: 'c', source: 's', sourcePort: 'out', target: 'n', targetPort: 'in' },
            ]);
            expect(runtime.problems().filter(p => p.kind === 'required-input-unconnected')).toEqual([]);

            runtime.setGraph(nodes, []);

            expect(
                runtime.problems().filter(p => p.kind === 'required-input-unconnected'),
            ).toHaveLength(1);
        } finally {
            runtime.dispose();
        }
    });

    it('copes with a node nothing is wired to', () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions(DEFS);
            runtime.setGraph([node('lonely', 'passthrough')], []);

            expect(runtime.inputs('lonely')()['in']).toBeUndefined();
        } finally {
            runtime.dispose();
        }
    });
});

describe('state set before the node exists', () => {
    it('survives the node arriving afterwards', async () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([SOURCE]);
            runtime.setState('s', 'restored');
            runtime.setGraph([node('s', 'source')], []);
            await runtime.run();

            expect(runtime.state('s')()).toBe('restored');
            expect(runtime.outputs('s')()['out']).toBe('restored');
        } finally {
            runtime.dispose();
        }
    });

    it('still seeds initialState for a node nothing was written for', async () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([SOURCE]);
            runtime.setGraph([node('s', 'source')], []);
            await runtime.run();

            expect(runtime.state('s')()).toBe('seed');
        } finally {
            runtime.dispose();
        }
    });

    /** `undefined` is a state someone chose, not an absent one. */
    it('does not fall back to initialState for a deliberate undefined', () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([SOURCE]);
            runtime.setState('s', undefined);
            runtime.setGraph([node('s', 'source')], []);

            expect(runtime.state('s')()).toBeUndefined();
        } finally {
            runtime.dispose();
        }
    });

    /** Re-mounting the node a subgraph swap removed must bring its graph back. */
    it('restores state across a graph swap that removed the node', async () => {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([SOURCE]);
            runtime.setGraph([node('s', 'source')], []);
            runtime.setState('s', 'edited');

            // Another graph takes the screen — 's' is gone from the runtime.
            runtime.setGraph([], []);
            // The consumer writes back what it remembered, then remounts.
            runtime.setState('s', 'edited');
            runtime.setGraph([node('s', 'source')], []);
            await runtime.run();

            expect(runtime.state('s')()).toBe('edited');
        } finally {
            runtime.dispose();
        }
    });
});

/*
 * `setGraph` skips its whole diff when nothing it models has changed, because
 * the editor re-feeds it on every frame of a drag and a position is not part
 * of its model. The skip is only safe while the comparison is complete: each
 * field dropped from it is a change the runtime would stop noticing, silently.
 *
 * The two that ARE modelled are pinned below. `ports` is compared too but is
 * deliberately not pinned: the runtime resolves ports from the DEFINITION
 * (`portsFor(state)`, never `node.ports`), so removing that comparison breaks
 * nothing today - it is margin against the runtime one day reading the field,
 * and is documented as such rather than left looking load-bearing.
 */
describe('setGraph notices everything it models, and skips what it does not', () => {
    const ALPHA: NodeTypeDefinition = {
        id: 'alpha',
        label: 'Alpha',
        ports: [{ id: 'out', direction: 'out', label: 'Out' }],
        compute: () => ({ out: 'alpha' }),
    };

    const NEEDS: NodeTypeDefinition = {
        id: 'needs',
        label: 'Needs',
        ports: [
            { id: 'a', direction: 'in', label: 'A', required: true },
            { id: 'out', direction: 'out', label: 'Out' },
        ],
        compute: inputs => ({ out: inputs['a'] }),
    };

    function make(): NodeGraphRuntime {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions([ALPHA, NEEDS]);
        return runtime;
    }

    const box = { x: 0, y: 0, width: 180, height: 80 };

    /*
     * ONE array, reused. A fresh `[]` per call is a different reference, and
     * the shape check compares the connection list by reference first — so
     * passing a new one every time short-circuits before the node comparison
     * is reached, and these tests would pass with that comparison deleted.
     * They did, until this was hoisted.
     */
    const noEdges: NodeConnection[] = [];

    it('notices a type it no longer recognises', async () => {
        const runtime = make();
        runtime.setGraph([{ id: 'n', type: 'alpha', ...box }], noEdges);
        await runtime.run();
        expect(runtime.problems()).toEqual([]);

        // Same id, same everything else: only the type changed.
        runtime.setGraph([{ id: 'n', type: 'ghost', ...box }], noEdges);

        expect(runtime.problems().map(p => p.kind)).toContain('unknown-type');
        runtime.dispose();
    });

    it('notices a renamed node, because its problems are worded from the title', () => {
        const runtime = make();
        runtime.setGraph([{ id: 'n', type: 'needs', title: 'Before', ...box }], noEdges);
        expect(runtime.problems()[0].message).toContain('Before');

        runtime.setGraph([{ id: 'n', type: 'needs', title: 'After', ...box }], noEdges);

        expect(runtime.problems()[0].message).toContain('After');
        runtime.dispose();
    });

    it('ignores a position, which it does not model', async () => {
        const runtime = make();
        runtime.setGraph([{ id: 'n', type: 'alpha', ...box }], noEdges);
        await runtime.run();

        runtime.resetMetrics();
        // A drag frame: same graph, new objects, different coordinates.
        runtime.setGraph([{ id: 'n', type: 'alpha', ...box, x: 40, y: 90 }], noEdges);
        await runtime.run();

        expect(runtime.metrics.computed).toEqual([]);
        runtime.dispose();
    });
});
