// The run lifecycle — the base gap the run-history addon needed
// (`specs/node-editor-addons-spec.md` §0, §5).
//
// History is a stream of things that happened, so these are callbacks rather
// than signals: a signal holds only the latest, and an observer that missed a
// tick would silently lose a run. Everything asserted here is what a history
// record is made of — which node, what it saw, what it produced, how long.
import { describe, it, expect } from 'vitest';
import { NodeGraphRuntime } from './node-editor.runtime';
import type {
    NodeSettledEvent,
    NodeTypeDefinition,
    RunFinishedEvent,
    RunStartedEvent,
} from './node-editor.runtime.types';
import type { EditorNode, NodeConnection } from './node-editor.types';

const SOURCE: NodeTypeDefinition = {
    id: 'source',
    label: 'Source',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    initialState: () => 1,
    compute: (_inputs, ctx) => ({ out: ctx.state }),
};

const DOUBLE: NodeTypeDefinition = {
    id: 'double',
    label: 'Double',
    ports: [
        { id: 'in', direction: 'in', label: 'In' },
        { id: 'out', direction: 'out', label: 'Out' },
    ],
    compute: inputs => ({ out: (inputs['in'] as number) * 2 }),
};

const EXPLODES: NodeTypeDefinition = {
    id: 'explodes',
    label: 'Explodes',
    ports: [{ id: 'in', direction: 'in', label: 'In' }],
    compute: () => {
        throw new Error('nope');
    },
};

const SLOW: NodeTypeDefinition = {
    id: 'slow',
    label: 'Slow',
    ports: [{ id: 'out', direction: 'out', label: 'Out' }],
    compute: async () => {
        await new Promise(resolve => setTimeout(resolve, 12));
        return { out: 'late' };
    },
};

const DEFS = [SOURCE, DOUBLE, EXPLODES, SLOW];

function node(id: string, type: string): EditorNode {
    return { id, type, x: 0, y: 0, width: 180, height: 80, title: id, ports: [] };
}

function link(id: string, source: string, target: string): NodeConnection {
    return { id, source, sourcePort: 'out', target, targetPort: 'in' };
}

interface Recorder {
    readonly runtime: NodeGraphRuntime;
    readonly started: RunStartedEvent[];
    readonly settled: NodeSettledEvent[];
    readonly finished: RunFinishedEvent[];
}

function recording(
    nodes: readonly EditorNode[],
    connections: readonly NodeConnection[],
): Recorder {
    const runtime = new NodeGraphRuntime();
    const started: RunStartedEvent[] = [];
    const settled: NodeSettledEvent[] = [];
    const finished: RunFinishedEvent[] = [];
    runtime.onRunStarted = event => started.push(event);
    runtime.onNodeSettled = event => settled.push(event);
    runtime.onRunFinished = event => finished.push(event);
    runtime.setDefinitions(DEFS);
    runtime.setGraph(nodes, connections);
    return { runtime, started, settled, finished };
}

function chain(): Recorder {
    return recording([node('a', 'source'), node('b', 'double')], [link('c1', 'a', 'b')]);
}

describe('run boundaries', () => {
    it('brackets a run with started and finished', async () => {
        const r = chain();
        await r.runtime.run();

        expect(r.started).toHaveLength(1);
        expect(r.finished).toHaveLength(1);
        expect(r.finished[0].runId).toBe(r.started[0].runId);
    });

    /**
     * An idle editor calls `run()` on every keystroke, every state change and
     * every stream emission. If each of those opened a run, the history would
     * be mostly empty entries and the real ones impossible to find.
     */
    it('starts NO run when there is nothing to do', async () => {
        const r = chain();
        await r.runtime.run();
        r.started.length = 0;
        r.finished.length = 0;

        await r.runtime.run();
        expect(r.started).toEqual([]);
        expect(r.finished).toEqual([]);
    });

    /**
     * The editor calls `run()` from several places at once — an effect, a
     * state change, a stream. Three concurrent callers is still ONE thing the
     * user did, and must read as one run.
     */
    it('joins concurrent callers into one run rather than reporting three', async () => {
        const r = recording([node('a', 'slow'), node('b', 'double')], [link('c1', 'a', 'b')]);
        await Promise.all([r.runtime.run(), r.runtime.run(), r.runtime.run()]);

        expect(r.started).toHaveLength(1);
        expect(r.finished).toHaveLength(1);
    });

    it('numbers successive runs so they can be told apart', async () => {
        const r = chain();
        await r.runtime.run();
        r.runtime.setState('a', 5);
        await r.runtime.run();

        expect(r.started.map(s => s.runId)).toEqual([1, 2]);
    });

    it('says what was ready when it began', async () => {
        const r = chain();
        await r.runtime.run();
        expect(r.started[0].nodes).toEqual(['a']);
    });

    it('carries a wall-clock start, for display next to the record', async () => {
        const before = Date.now();
        const r = chain();
        await r.runtime.run();
        expect(r.started[0].startedAt).toBeGreaterThanOrEqual(before);
    });

    it('gives a stepped node a run of its own', async () => {
        const r = chain();
        await r.runtime.step();

        expect(r.finished).toHaveLength(1);
        expect(r.finished[0].nodes.map(n => n.nodeId)).toEqual(['a']);
    });
});

describe('what settled', () => {
    it('reports every node that ran, in the order they finished', async () => {
        const r = chain();
        await r.runtime.run();
        expect(r.settled.map(s => s.nodeId)).toEqual(['a', 'b']);
    });

    /**
     * The whole point. "What did node X get on run #47" cannot be answered by
     * a status, so the event carries the values on both sides of the node.
     */
    it('carries the inputs it saw and the outputs it produced', async () => {
        const r = chain();
        await r.runtime.run();

        const doubled = r.settled.find(s => s.nodeId === 'b') as NodeSettledEvent;
        expect(doubled.inputs).toEqual({ in: 1 });
        expect(doubled.outputs).toEqual({ out: 2 });
    });

    it('snapshots the values, so a later run does not rewrite history', async () => {
        const r = chain();
        await r.runtime.run();
        const first = r.settled.find(s => s.nodeId === 'b') as NodeSettledEvent;

        r.runtime.setState('a', 10);
        await r.runtime.run();

        expect(first.outputs).toEqual({ out: 2 });
    });

    it('files each node under the run it belongs to', async () => {
        const r = chain();
        await r.runtime.run();
        r.runtime.setState('a', 3);
        await r.runtime.run();

        expect(r.settled.filter(s => s.runId === 1).map(s => s.nodeId)).toEqual(['a', 'b']);
        expect(r.settled.filter(s => s.runId === 2).map(s => s.nodeId)).toEqual(['a', 'b']);
    });

    it('measures how long each node took', async () => {
        const r = recording([node('s', 'slow')], []);
        await r.runtime.run();
        expect(r.settled[0].durationMs).toBeGreaterThan(0);
    });

    it('reports the error, not just that there was one', async () => {
        const r = recording(
            [node('a', 'source'), node('bad', 'explodes')],
            [link('c1', 'a', 'bad')],
        );
        await r.runtime.run();

        const failed = r.settled.find(s => s.nodeId === 'bad') as NodeSettledEvent;
        expect(failed.status).toBe('error');
        expect((failed.error as Error).message).toBe('nope');
    });

    it('leaves error undefined when nothing went wrong', async () => {
        const r = chain();
        await r.runtime.run();
        expect(r.settled.every(s => s.error === undefined)).toBe(true);
    });

    /**
     * A node re-dirtied mid-run has NOT settled — it goes back to stale and
     * the drain picks it up again. Reporting it would put a value in the
     * history that was never the node's final answer for that run.
     */
    it('does not report a node that was re-dirtied before it settled', async () => {
        const r = recording([node('s', 'slow')], []);
        const running = r.runtime.run();
        r.runtime.setState('s', 'changed');
        await running;

        expect(r.settled.filter(s => s.nodeId === 's').length).toBeGreaterThan(0);
        expect(r.settled.at(-1)?.status).toBe('done');
    });
});

describe('the finished run, as a record', () => {
    it('collects everything that settled inside it', async () => {
        const r = chain();
        await r.runtime.run();
        expect(r.finished[0].nodes.map(n => n.nodeId)).toEqual(['a', 'b']);
    });

    it('reports how long the whole pass took', async () => {
        const r = recording([node('s', 'slow')], []);
        await r.runtime.run();
        expect(r.finished[0].durationMs).toBeGreaterThan(0);
    });

    it('is an error run when any node in it errored', async () => {
        const r = recording(
            [node('a', 'source'), node('bad', 'explodes')],
            [link('c1', 'a', 'bad')],
        );
        await r.runtime.run();
        expect(r.finished[0].status).toBe('error');
    });

    it('is a done run when nothing errored', async () => {
        const r = chain();
        await r.runtime.run();
        expect(r.finished[0].status).toBe('done');
    });
});

describe('no observer', () => {
    it('runs perfectly well with nothing listening', async () => {
        const runtime = new NodeGraphRuntime();
        runtime.setDefinitions(DEFS);
        runtime.setGraph([node('a', 'source'), node('b', 'double')], [link('c1', 'a', 'b')]);
        await runtime.run();

        expect(runtime.outputs('b')()).toEqual({ out: 2 });
    });
});
