// RT-9 of `specs/node-editor-runtime-spec.md` — the undo command funnel.
import { describe, it, expect } from 'vitest';
import {
    COALESCE_MS,
    GraphHistory,
    apply,
    invert,
    type GraphCommand,
    type GraphSnapshot,
} from './node-editor.history';
import type { EditorNode, NodeConnection } from './node-editor.types';

function node(id: string, x = 0, y = 0): EditorNode {
    return { id, x, y, width: 190, height: 80, title: id, ports: [] };
}

function link(id: string, source: string, target: string): NodeConnection {
    return { id, source, sourcePort: 'out', target, targetPort: 'in' };
}

const GRAPH: GraphSnapshot = {
    nodes: [node('a'), node('b')],
    connections: [link('c1', 'a', 'b')],
};

/** Applying a command then its inverse must land exactly where it started. */
function roundTrip(graph: GraphSnapshot, command: GraphCommand): GraphSnapshot {
    return apply(apply(graph, command), invert(command));
}

describe('every command has a true inverse', () => {
    it('add-nodes', () => {
        const command: GraphCommand = { kind: 'add-nodes', nodes: [node('c')] };
        expect(roundTrip(GRAPH, command).nodes.map(n => n.id)).toEqual(['a', 'b']);
    });

    it('remove-nodes restores the node', () => {
        const command: GraphCommand = {
            kind: 'remove-nodes', nodes: [node('b')], connections: [link('c1', 'a', 'b')],
        };
        const back = roundTrip(GRAPH, command);
        expect(back.nodes.map(n => String(n.id)).sort((x, y) => x.localeCompare(y))).toEqual(['a', 'b']);
    });

    /**
     * Removing a node takes its edges with it, so the inverse has to bring
     * those back as well — and it does so ITSELF. An inverse that restored
     * only the node would make the caller responsible for the wiring, which
     * is exactly the knowledge a command funnel exists to remove.
     */
    it('remove-nodes round-trips its connections, not just its nodes', () => {
        const command: GraphCommand = {
            kind: 'remove-nodes', nodes: [node('b')], connections: [link('c1', 'a', 'b')],
        };
        const back = roundTrip(GRAPH, command);
        expect(back.connections.map(c => c.id)).toEqual(['c1']);
    });

    it('does not duplicate a connection that is already there', () => {
        const restore: GraphCommand = {
            kind: 'add-nodes', nodes: [], connections: [link('c1', 'a', 'b')],
        };
        expect(apply(GRAPH, restore).connections).toHaveLength(1);
    });

    it('move-nodes', () => {
        const command: GraphCommand = {
            kind: 'move-nodes', deltas: new Map([['a', { x: 40, y: -15 }]]),
        };
        const back = roundTrip(GRAPH, command);
        expect(back.nodes[0]).toMatchObject({ x: 0, y: 0 });
    });

    it('rewire, adding', () => {
        const command: GraphCommand = {
            kind: 'rewire', removed: [], added: [link('c2', 'b', 'a')],
        };
        expect(roundTrip(GRAPH, command).connections.map(c => c.id)).toEqual(['c1']);
    });

    it('rewire, removing', () => {
        const command: GraphCommand = {
            kind: 'rewire', removed: [link('c1', 'a', 'b')], added: [],
        };
        expect(roundTrip(GRAPH, command).connections.map(c => c.id)).toEqual(['c1']);
    });

    /*
     * The case the kind exists for: unplugging one wire and plugging in
     * another is ONE gesture, so it must be one entry that round-trips as a
     * unit rather than two the user has to undo twice.
     */
    it('rewire, replacing one wire with another', () => {
        const command: GraphCommand = {
            kind: 'rewire',
            removed: [link('c1', 'a', 'b')],
            added: [link('c2', 'b', 'a')],
        };
        expect(roundTrip(GRAPH, command).connections.map(c => c.id)).toEqual(['c1']);
    });

    /*
     * The same id on both halves — which `apply`'s ordering exists for.
     *
     * `connectionId` is derived from the endpoints, so unplugging a wire and
     * dropping it back on the port it came from produces a `rewire` whose
     * `removed` and `added` are the SAME id. Add before remove and the
     * addition is filtered as a duplicate, the removal then deletes it, and a
     * gesture that should be a no-op silently destroys the wire. Every other
     * rewire case here uses distinct ids and stays green under that ordering.
     */
    it('rewire with the same id on both halves keeps the wire', () => {
        const next = apply(GRAPH, {
            kind: 'rewire',
            removed: [link('c1', 'a', 'b')],
            added: [link('c1', 'a', 'b')],
        });
        expect(next.connections.map(c => c.id)).toEqual(['c1']);
    });

    it('set-state swaps before and after', () => {
        const command: GraphCommand = {
            kind: 'set-state', nodeId: 'a', before: 'old', after: 'new', at: 0,
        };
        const inverse = invert(command) as Extract<GraphCommand, { kind: 'set-state' }>;
        expect(inverse.before).toBe('new');
        expect(inverse.after).toBe('old');
    });
});

describe('apply', () => {
    it('does not mutate the graph it was given', () => {
        const before = GRAPH.nodes.length;
        apply(GRAPH, { kind: 'add-nodes', nodes: [node('c')] });
        expect(GRAPH.nodes).toHaveLength(before);
    });

    it('removes a node and every connection touching it', () => {
        const next = apply(GRAPH, {
            kind: 'remove-nodes', nodes: [node('b')], connections: [],
        });
        expect(next.nodes.map(n => n.id)).toEqual(['a']);
        expect(next.connections).toEqual([]);
    });

    it('refuses to add a duplicate connection id', () => {
        const next = apply(GRAPH, { kind: 'rewire', removed: [], added: [link('c1', 'a', 'b')] });
        expect(next.connections).toHaveLength(1);
    });

    it('leaves the snapshot alone for set-state, which lives in the runtime', () => {
        const next = apply(GRAPH, { kind: 'set-state', nodeId: 'a', before: 1, after: 2, at: 0 });
        expect(next).toBe(GRAPH);
    });
});

describe('coalescing — the rules that make undo usable', () => {
    it('merges fast keystrokes on one node into a single entry', () => {
        const history = new GraphHistory();
        ['h', 'he', 'hel', 'hell', 'hello'].forEach((after, i) => {
            history.push({
                kind: 'set-state', nodeId: 'text',
                before: i === 0 ? '' : ['h', 'he', 'hel', 'hell'][i - 1],
                after, at: i * 50,
            });
        });

        expect(history.entries).toHaveLength(1);
        const entry = history.entries[0] as Extract<GraphCommand, { kind: 'set-state' }>;
        // Earliest before, latest after — so one undo returns to the start.
        expect(entry.before).toBe('');
        expect(entry.after).toBe('hello');
    });

    it('treats a pause as a checkpoint', () => {
        const history = new GraphHistory();
        history.push({ kind: 'set-state', nodeId: 't', before: '', after: 'a', at: 0 });
        history.push({ kind: 'set-state', nodeId: 't', before: 'a', after: 'ab', at: COALESCE_MS + 1 });
        expect(history.entries).toHaveLength(2);
    });

    it('does not merge across different nodes', () => {
        const history = new GraphHistory();
        history.push({ kind: 'set-state', nodeId: 'a', before: '', after: 'x', at: 0 });
        history.push({ kind: 'set-state', nodeId: 'b', before: '', after: 'y', at: 10 });
        expect(history.entries).toHaveLength(2);
    });

    it('does not merge a move into a state edit', () => {
        const history = new GraphHistory();
        history.push({ kind: 'set-state', nodeId: 'a', before: '', after: 'x', at: 0 });
        history.push({ kind: 'move-nodes', deltas: new Map([['a', { x: 1, y: 1 }]]) });
        expect(history.entries).toHaveLength(2);
    });

    /** A drag is one command, pushed on pointer-up — never one per frame. */
    it('records a whole drag as one entry', () => {
        const history = new GraphHistory();
        history.push({ kind: 'move-nodes', deltas: new Map([['a', { x: 90, y: 0 }]]) });
        expect(history.entries).toHaveLength(1);
    });
});

describe('undo and redo', () => {
    it('returns the inverse to apply, then the original to redo', () => {
        const history = new GraphHistory();
        history.push({ kind: 'add-nodes', nodes: [node('c')] });

        expect(history.canUndo).toBe(true);
        expect(history.undo()?.kind).toBe('remove-nodes');
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(true);
        expect(history.redo()?.kind).toBe('add-nodes');
    });

    it('returns null with nothing to undo or redo', () => {
        const history = new GraphHistory();
        expect(history.undo()).toBeNull();
        expect(history.redo()).toBeNull();
    });

    it('drops the redo branch once a new edit lands', () => {
        const history = new GraphHistory();
        history.push({ kind: 'add-nodes', nodes: [node('c')] });
        history.undo();
        expect(history.canRedo).toBe(true);

        history.push({ kind: 'add-nodes', nodes: [node('d')] });
        expect(history.canRedo).toBe(false);
    });

    it('survives a full undo/redo cycle back to the original graph', () => {
        const history = new GraphHistory();
        const command: GraphCommand = {
            kind: 'move-nodes', deltas: new Map([['a', { x: 50, y: 25 }]]),
        };
        history.push(command);

        const moved = apply(GRAPH, command);
        const undone = apply(moved, history.undo() as GraphCommand);
        expect(undone.nodes[0]).toMatchObject({ x: 0, y: 0 });

        const redone = apply(undone, history.redo() as GraphCommand);
        expect(redone.nodes[0]).toMatchObject({ x: 50, y: 25 });
    });
});

describe('history is bounded', () => {
    it('drops the oldest entry past the limit', () => {
        const history = new GraphHistory(3);
        for (let i = 0; i < 5; i++) {
            history.push({ kind: 'add-nodes', nodes: [node(`n${i}`)] });
        }
        expect(history.entries).toHaveLength(3);
        const first = history.entries[0] as Extract<GraphCommand, { kind: 'add-nodes' }>;
        expect(first.nodes[0].id).toBe('n2');
    });

    it('clears both stacks', () => {
        const history = new GraphHistory();
        history.push({ kind: 'add-nodes', nodes: [node('c')] });
        history.undo();
        history.clear();
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);
    });
});
