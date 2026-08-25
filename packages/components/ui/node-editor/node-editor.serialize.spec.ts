// RT-10 of `specs/node-editor-runtime-spec.md` — the versioned JSON format.
import { describe, it, expect } from 'vitest';
import {
    GRAPH_FORMAT_VERSION,
    GraphFormatError,
    deserializeGraph,
    findUnserializableState,
    serializeGraph,
} from './node-editor.serialize';
import type { EditorNode, NodeConnection } from './node-editor.types';

const NODES: EditorNode[] = [
    { id: 't1', type: 'text-input', x: 10, y: 20, width: 190, height: 88, title: 'Text input' },
    { id: 'b1', type: 'browser', x: 300, y: 20, width: 240, height: 88, title: 'Browser' },
];

const CONNECTIONS: NodeConnection[] = [
    { id: 'c1', source: 't1', sourcePort: 'text', target: 'b1', targetPort: 'url' },
];

const STATES = new Map<string, unknown>([['t1', { value: 'example.com' }]]);

describe('the document shape', () => {
    it('stamps the version, so a migration has somewhere to hook', () => {
        expect(serializeGraph(NODES, CONNECTIONS).version).toBe(GRAPH_FORMAT_VERSION);
    });

    it('writes an endpoint as a [node, port] pair', () => {
        const document = serializeGraph(NODES, CONNECTIONS);
        expect(document.connections[0].from).toEqual(['t1', 'text']);
        expect(document.connections[0].to).toEqual(['b1', 'url']);
    });

    /**
     * Height is DERIVED from the port count. Storing it would let a document
     * disagree with the card it describes, which puts every port anchor — and
     * therefore every edge endpoint — in the wrong place on load.
     */
    it('never writes height', () => {
        const document = serializeGraph(NODES, CONNECTIONS);
        expect(document.nodes[0]).not.toHaveProperty('height');
    });

    it('omits state entirely when a node has none', () => {
        const document = serializeGraph(NODES, CONNECTIONS);
        expect(document.nodes[1]).not.toHaveProperty('state');
    });

    it('carries state when there is some', () => {
        const document = serializeGraph(NODES, CONNECTIONS, STATES);
        expect(document.nodes[0].state).toEqual({ value: 'example.com' });
    });
});

describe('round trip', () => {
    it('preserves nodes, connections and state through JSON', () => {
        const text = JSON.stringify(serializeGraph(NODES, CONNECTIONS, STATES));
        const back = deserializeGraph(JSON.parse(text));

        expect(back.nodes.map(n => n.id)).toEqual(['t1', 'b1']);
        expect(back.nodes[0]).toMatchObject({ type: 'text-input', x: 10, y: 20, width: 190 });
        expect(back.connections).toEqual(CONNECTIONS);
        expect(back.states.get('t1')).toEqual({ value: 'example.com' });
    });

    it('rebuilds height as 0, for the editor to derive', () => {
        const back = deserializeGraph(serializeGraph(NODES, CONNECTIONS));
        expect(back.nodes[0].height).toBe(0);
    });

    it('is stable — serialising a round-tripped graph gives the same document', () => {
        const first = serializeGraph(NODES, CONNECTIONS, STATES);
        const back = deserializeGraph(first);
        const second = serializeGraph(back.nodes, back.connections, back.states);
        expect(second).toEqual(first);
    });

    it('preserves connection ORDER, which decides what a collect port receives', () => {
        const many: NodeConnection[] = [
            { id: 'x', source: 't1', sourcePort: 'text', target: 'b1', targetPort: 'items' },
            { id: 'y', source: 'b1', sourcePort: 'out', target: 'b1', targetPort: 'items' },
        ];
        const back = deserializeGraph(serializeGraph(NODES, many));
        expect(back.connections.map(c => c.id)).toEqual(['x', 'y']);
    });
});

describe('a document is data from disk, so it is validated', () => {
    it('rejects a non-object', () => {
        expect(() => deserializeGraph(null)).toThrow(GraphFormatError);
        expect(() => deserializeGraph('nope')).toThrow(GraphFormatError);
    });

    it('rejects a document with no version', () => {
        expect(() => deserializeGraph({ nodes: [], connections: [] }))
            .toThrow(/no version/);
    });

    it('rejects a document from a newer build, naming both versions', () => {
        expect(() => deserializeGraph({ version: 99, nodes: [], connections: [] }))
            .toThrow(/version 99/);
    });

    it('rejects missing arrays', () => {
        expect(() => deserializeGraph({ version: 1, nodes: [] }))
            .toThrow(/nodes.*connections/);
    });

    it('rejects a connection pointing at a node that is not there, naming it', () => {
        expect(() => deserializeGraph({
            version: 1,
            nodes: [{ id: 'a', x: 0, y: 0 }],
            connections: [{ id: 'dangling', from: ['a', 'out'], to: ['ghost', 'in'] }],
        })).toThrow(/dangling/);
    });

    it('accepts an older version, which is what the version field is for', () => {
        expect(() => deserializeGraph({ version: 1, nodes: [], connections: [] })).not.toThrow();
    });

    it('falls back to a sensible width and title', () => {
        const back = deserializeGraph({
            version: 1, nodes: [{ id: 'bare', x: 0, y: 0 }], connections: [],
        });
        expect(back.nodes[0].width).toBeGreaterThan(0);
        expect(back.nodes[0].title).toBe('bare');
    });
});

describe('state must survive the round trip', () => {
    /**
     * The failure this exists to prevent is silent: a Map becomes `{}` on
     * reload and the node comes back empty with no error anywhere.
     */
    it('names the node whose state would be lost', () => {
        const found = findUnserializableState(new Map([['t1', new Map([['a', 1]])]]));
        expect(found?.nodeId).toBe('t1');
    });

    it('passes plain JSON-safe state', () => {
        expect(findUnserializableState(STATES)).toBeNull();
    });

    it('passes an empty map', () => {
        expect(findUnserializableState(new Map())).toBeNull();
    });

    it('reports a circular structure rather than throwing', () => {
        const circular: Record<string, unknown> = {};
        circular['self'] = circular;
        expect(findUnserializableState(new Map([['n', circular]]))?.nodeId).toBe('n');
    });

    it('ignores nodes with no state at all', () => {
        expect(findUnserializableState(new Map([['n', undefined]]))).toBeNull();
    });
});
