// Collecting run records — `specs/node-editor-addons-spec.md` §5, task E1.
import { describe, it, expect } from 'vitest';
import { RunHistoryStore } from './node-editor-history.store';
import type { RunRecord, RunSink } from './node-editor-history.types';
import type {
    NodeSettledEvent,
    RunFinishedEvent,
    RunStartedEvent,
    SerializedGraph,
} from '../node-editor';

function graph(title = 'Source'): SerializedGraph {
    return {
        version: 1,
        nodes: [{ id: 'a', type: 'source', x: 0, y: 0, title }],
        connections: [],
    };
}

function started(runId: number): RunStartedEvent {
    return { runId, startedAt: 1_700_000_000_000, nodes: ['a'] };
}

function settled(overrides: Partial<NodeSettledEvent> = {}): NodeSettledEvent {
    return {
        runId: 1,
        nodeId: 'a',
        status: 'done',
        inputs: { in: 1 },
        outputs: { out: 2 },
        durationMs: 5,
        ...overrides,
    };
}

function finished(
    runId: number,
    nodes: readonly NodeSettledEvent[] = [settled({ runId })],
    status: 'done' | 'error' = 'done',
): RunFinishedEvent {
    return {
        runId,
        startedAt: 1_700_000_000_000,
        durationMs: 9,
        nodes,
        settledCount: nodes.length,
        durationTotalMs: nodes.reduce((sum, node) => sum + node.durationMs, 0),
        slowest: nodes.at(0) ?? null,
        status,
    };
}

describe('a run larger than the event cap', () => {
    /*
     * A hundred-thousand-node run would otherwise retain a settle event per
     * node, each holding a copy of that node's inputs and outputs. The array
     * is a capped PREFIX, so everything that has to be true of the whole run
     * travels beside it — and the panel's own readouts are built from those,
     * not from the array's length.
     */
    it('keeps the totals honest when the array is only a prefix', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());

        const kept = [settled({ runId: 1, nodeId: 'a', durationMs: 4 })];
        const record = store.finish({
            runId: 1,
            startedAt: 1_700_000_000_000,
            durationMs: 9,
            nodes: kept,
            // The run settled a thousand nodes; one of them is in `nodes`.
            settledCount: 1_000,
            durationTotalMs: 4_000,
            slowest: settled({ runId: 1, nodeId: 'slow', durationMs: 900 }),
            status: 'done',
        });

        expect(record.nodes).toHaveLength(1);
        expect(record.settledCount).toBe(1_000);
        expect(record.durationTotalMs).toBe(4_000);
        expect(record.slowest?.nodeId).toBe('slow');
    });
});

describe('collecting runs', () => {
    it('keeps a finished run', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        store.finish(finished(1));

        expect(store.runs()).toHaveLength(1);
        expect(store.runs()[0].id).toBe(1);
    });

    it('lists newest first, the way a log is read', () => {
        const store = new RunHistoryStore();
        for (const id of [1, 2, 3]) {
            store.begin(started(id), graph());
            store.finish(finished(id));
        }
        expect(store.runs().map(r => r.id)).toEqual([3, 2, 1]);
    });

    it('exposes the latest run without anyone indexing an array', () => {
        const store = new RunHistoryStore();
        store.begin(started(7), graph());
        store.finish(finished(7));
        expect(store.latest()?.id).toBe(7);
    });

    it('has no latest run before anything has run', () => {
        expect(new RunHistoryStore().latest()).toBeNull();
    });

    it('carries each node’s inputs, outputs and duration', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        const record = store.finish(finished(1));

        expect(record.nodes[0]).toMatchObject({
            nodeId: 'a',
            inputs: { in: 1 },
            outputs: { out: 2 },
            durationMs: 5,
        });
    });

    it('names a node the way it was titled, so an old run still reads as words', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph('Weather API'));
        expect(store.finish(finished(1)).nodes[0].title).toBe('Weather API');
    });

    it('falls back to the id when there was no title', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), null);
        expect(store.finish(finished(1)).nodes[0].title).toBe('a');
    });
});

describe('the graph is captured when the run STARTS', () => {
    /**
     * By the time anyone asks what a run did, the graph has usually been
     * edited. A snapshot taken at the end would be a picture of a different
     * graph than the one that produced the values beside it.
     */
    it('keeps the graph as it was at the start, not as it is at the end', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph('Before the edit'));
        const record = store.finish(finished(1));

        expect(record.graph?.nodes[0].title).toBe('Before the edit');
    });

    it('records a run that started before the store was listening', () => {
        const store = new RunHistoryStore();
        expect(store.finish(finished(1)).graph).toBeNull();
    });
});

describe('errors', () => {
    /**
     * `JSON.stringify(new Error('boom'))` is `'{}'` — the message lives on the
     * prototype and does not survive. A history that keeps the object looks
     * right in a console and exports as an empty pair of braces.
     */
    it('keeps the MESSAGE, which is the part that survives JSON', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        const record = store.finish(
            finished(1, [settled({ status: 'error', error: new Error('boom') })], 'error'),
        );

        expect(record.nodes[0].error).toBe('boom');
        expect(JSON.parse(JSON.stringify(record)).nodes[0].error).toBe('boom');
    });

    it('handles a thrown string, which is legal and common', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        const record = store.finish(
            finished(1, [settled({ status: 'error', error: 'just a string' })], 'error'),
        );
        expect(record.nodes[0].error).toBe('just a string');
    });

    /**
     * What an HTTP layer usually rejects with. `String()` on a plain object
     * gives '[object Object]' — the exact information loss this whole field
     * exists to prevent.
     */
    it('describes a thrown plain object instead of saying [object Object]', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        const record = store.finish(
            finished(1, [settled({ status: 'error', error: { code: 502, why: 'upstream' } })], 'error'),
        );

        expect(record.nodes[0].error).toContain('502');
        expect(record.nodes[0].error).not.toContain('[object Object]');
    });

    it('survives a circular thrown object rather than losing the record', () => {
        const circular: Record<string, unknown> = { code: 1 };
        circular['self'] = circular;

        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        const record = store.finish(
            finished(1, [settled({ status: 'error', error: circular })], 'error'),
        );

        expect(record.nodes[0].error).toBe('Unserialisable error');
    });

    it('keeps a thrown number as itself', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        const record = store.finish(
            finished(1, [settled({ status: 'error', error: 404 })], 'error'),
        );
        expect(record.nodes[0].error).toBe('404');
    });

    it('leaves error absent when nothing went wrong', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        expect(store.finish(finished(1)).nodes[0].error).toBeUndefined();
    });
});

describe('bounded, because a stream produces a run per emission', () => {
    it('drops the oldest past the limit', () => {
        const store = new RunHistoryStore({ limit: 3 });
        for (const id of [1, 2, 3, 4, 5]) {
            store.begin(started(id), graph());
            store.finish(finished(id));
        }
        expect(store.runs().map(r => r.id)).toEqual([5, 4, 3]);
    });

    it('never accepts a limit of zero, which would keep nothing at all', () => {
        const store = new RunHistoryStore({ limit: 0 });
        store.begin(started(1), graph());
        store.finish(finished(1));
        expect(store.runs()).toHaveLength(1);
    });

    /**
     * An editor destroyed mid-run leaves a `begin` with no `finish`. Holding
     * its snapshot forever is the same leak in a quieter place.
     */
    it('does not hold snapshots for runs that never finished', () => {
        const store = new RunHistoryStore({ limit: 2 });
        for (let id = 1; id <= 10; id++) store.begin(started(id), graph());

        store.begin(started(11), graph('kept'));
        expect(store.finish(finished(11)).graph?.nodes[0].title).toBe('kept');
    });
});

describe('storage is the consumer’s', () => {
    it('forwards every run to a sink', () => {
        const kept: RunRecord[] = [];
        const sink: RunSink = {
            append(record) {
                kept.push(record);
            },
        };
        const store = new RunHistoryStore({ limit: 1, sink });

        for (const id of [1, 2, 3]) {
            store.begin(started(id), graph());
            store.finish(finished(id));
        }

        // Memory kept one; the sink saw all three. That is the point of it.
        expect(store.runs()).toHaveLength(1);
        expect(kept.map(r => r.id)).toEqual([1, 2, 3]);
    });

    it('works perfectly well with no sink at all', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        expect(() => store.finish(finished(1))).not.toThrow();
    });
});

describe('clearing', () => {
    it('discards every kept run', () => {
        const store = new RunHistoryStore();
        store.begin(started(1), graph());
        store.finish(finished(1));
        store.clear();
        expect(store.runs()).toEqual([]);
    });
});

describe('no shared state between stores', () => {
    /**
     * Two editors on a page — or a subgraph node owning a nested one — must
     * not interleave their runs into one unreadable list. The same
     * no-singleton rule the runtime is built on.
     */
    it('keeps two stores completely separate', () => {
        const first = new RunHistoryStore();
        const second = new RunHistoryStore();

        first.begin(started(1), graph());
        first.finish(finished(1));

        expect(first.runs()).toHaveLength(1);
        expect(second.runs()).toHaveLength(0);
    });
});
