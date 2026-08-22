// T-5 from `specs/node-editor-spec.md` §8.
import { describe, it, expect } from 'vitest';
import {
    EDGE_SELECTED_WIDTH,
    EDGE_WIDTH,
    addConnection,
    adjacency,
    connectionId,
    connectionInto,
    removeConnections,
    removeNodes,
    samePort,
    toCanvasEdges,
    touchedBy,
} from './node-editor.graph';
import { portAnchor } from './node-editor.layout';
import type { EditorNode, NodeConnection, NodePort } from './node-editor.types';

function port(id: string, direction: 'in' | 'out'): NodePort {
    return { id, direction, label: id };
}

function node(id: string, extra: Partial<EditorNode> = {}): EditorNode {
    return {
        id,
        x: 0,
        y: 0,
        width: 180,
        height: 80,
        title: id,
        ports: [port('in', 'in'), port('out', 'out')],
        ...extra,
    };
}

function link(source: string, target: string): NodeConnection {
    return { id: `${source}->${target}`, source, sourcePort: 'out', target, targetPort: 'in' };
}

const NODES = [node('a'), node('b'), node('c')];

describe('toCanvasEdges', () => {
    it('anchors each end at the port, not the node centre', () => {
        const [edge] = toCanvasEdges(NODES, [link('a', 'b')]);
        expect(edge.sourceAnchor).toEqual(portAnchor(NODES[0], 'out'));
        expect(edge.targetAnchor).toEqual(portAnchor(NODES[1], 'in'));
    });

    it('draws connections as beziers, the node-graph convention', () => {
        expect(toCanvasEdges(NODES, [link('a', 'b')])[0].curve).toBe('bezier');
    });

    it('carries the connection id through, so an edge hit maps back to a connection', () => {
        expect(toCanvasEdges(NODES, [link('a', 'b')])[0].id).toBe('a->b');
    });

    it('thickens and recolours the selected connections', () => {
        const edges = toCanvasEdges(NODES, [link('a', 'b'), link('b', 'c')], {
            selected: new Set(['a->b']),
            selectedColor: '#f00',
            defaultColor: '#999',
        });
        expect(edges[0].width).toBe(EDGE_SELECTED_WIDTH);
        expect(edges[0].color).toBe('#f00');
        expect(edges[1].width).toBe(EDGE_WIDTH);
        expect(edges[1].color).toBe('#999');
    });

    it("prefers a connection's own colour over the selection colour", () => {
        const own: NodeConnection = { ...link('a', 'b'), color: '#0f0' };
        const [edge] = toCanvasEdges(NODES, [own], { selected: new Set(['a->b']), selectedColor: '#f00' });
        expect(edge.color).toBe('#0f0');
    });

    describe('a graph mid-edit is inconsistent for a frame, and must not throw', () => {
        it('skips a connection whose node is gone', () => {
            expect(toCanvasEdges(NODES, [link('a', 'ghost')])).toEqual([]);
        });

        it('skips a connection whose port is gone', () => {
            const stale: NodeConnection = { ...link('a', 'b'), sourcePort: 'removed' };
            expect(toCanvasEdges(NODES, [stale])).toEqual([]);
        });

        it('still renders the connections either side of a broken one', () => {
            const edges = toCanvasEdges(NODES, [link('a', 'ghost'), link('a', 'b')]);
            expect(edges.map(e => e.id)).toEqual(['a->b']);
        });
    });
});

describe('adjacency and touchedBy', () => {
    it('lists a connection under both of its nodes', () => {
        const index = adjacency([link('a', 'b')]);
        expect(index.get('a')).toEqual(['a->b']);
        expect(index.get('b')).toEqual(['a->b']);
    });

    it('finds only the connections that a moving node touches', () => {
        // Dragging one node must not re-anchor the whole graph.
        const index = adjacency([link('a', 'b'), link('b', 'c')]);
        expect(touchedBy(index, ['a'])).toEqual(['a->b']);
    });

    it('de-duplicates when several moving nodes share a connection', () => {
        const index = adjacency([link('a', 'b'), link('b', 'c')]);
        expect([...touchedBy(index, ['a', 'b'])].sort((x, y) => x.localeCompare(y))).toEqual(['a->b', 'b->c']);
    });

    it('returns nothing for an unconnected node', () => {
        expect(touchedBy(adjacency([link('a', 'b')]), ['c'])).toEqual([]);
    });
});

describe('connectionId', () => {
    it('is derived from the endpoints, so a graph round-trips stably', () => {
        const a = connectionId({ node: 'a', port: 'out' }, { node: 'b', port: 'in' });
        const b = connectionId({ node: 'a', port: 'out' }, { node: 'b', port: 'in' });
        expect(a).toBe(b);
    });

    it('distinguishes different ports on the same pair of nodes', () => {
        expect(connectionId({ node: 'a', port: 'o1' }, { node: 'b', port: 'in' }))
            .not.toBe(connectionId({ node: 'a', port: 'o2' }, { node: 'b', port: 'in' }));
    });
});

describe('addConnection', () => {
    it('appends a connection with the resolved endpoints', () => {
        const next = addConnection([], { node: 'a', port: 'out' }, { node: 'b', port: 'in' });
        expect(next).toEqual([
            { id: 'a:out->b:in', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
        ]);
    });

    it('does not mutate the array it was given', () => {
        const before: readonly NodeConnection[] = [];
        addConnection(before, { node: 'a', port: 'out' }, { node: 'b', port: 'in' });
        expect(before).toEqual([]);
    });
});

describe('removeConnections', () => {
    it('drops the named connections', () => {
        const next = removeConnections([link('a', 'b'), link('b', 'c')], ['a->b']);
        expect(next.map(c => c.id)).toEqual(['b->c']);
    });

    it('returns the same array when nothing is removed', () => {
        const before = [link('a', 'b')];
        expect(removeConnections(before, [])).toBe(before);
    });
});

describe('removeNodes', () => {
    it('removes the node and every connection touching it', () => {
        const result = removeNodes(NODES, [link('a', 'b'), link('b', 'c')], ['b']);
        expect(result.nodes.map(n => n.id)).toEqual(['a', 'c']);
        // Both connections touched b, so both go — leaving one behind would be
        // invisible until the id was reused.
        expect(result.connections).toEqual([]);
    });

    it('keeps a locked node, and its connections with it', () => {
        const nodes = [node('a'), node('b', { locked: true })];
        const result = removeNodes(nodes, [link('a', 'b')], ['b']);
        expect(result.nodes.map(n => n.id)).toEqual(['a', 'b']);
        expect(result.connections).toHaveLength(1);
    });

    it('removes the unlocked ones when a locked node is in the same selection', () => {
        const nodes = [node('a'), node('b', { locked: true })];
        const result = removeNodes(nodes, [], ['a', 'b']);
        expect(result.nodes.map(n => n.id)).toEqual(['b']);
    });

    it('returns the same arrays when nothing is removed', () => {
        const connections = [link('a', 'b')];
        const result = removeNodes(NODES, connections, []);
        expect(result.nodes).toBe(NODES);
        expect(result.connections).toBe(connections);
    });
});

describe('samePort', () => {
    it('matches on both node and port', () => {
        expect(samePort({ node: 'a', port: 'in' }, { node: 'a', port: 'in' })).toBe(true);
        expect(samePort({ node: 'a', port: 'in' }, { node: 'a', port: 'out' })).toBe(false);
        expect(samePort({ node: 'a', port: 'in' }, { node: 'b', port: 'in' })).toBe(false);
    });

    it('treats null as matching nothing, including another null', () => {
        expect(samePort(null, null)).toBe(false);
        expect(samePort({ node: 'a', port: 'in' }, null)).toBe(false);
    });
});

describe('connectionInto', () => {
    it('finds the connection landing on an input port', () => {
        const found = connectionInto([link('a', 'b')], { node: 'b', port: 'in' });
        expect(found?.id).toBe('a->b');
    });

    it('returns null when the port is free', () => {
        expect(connectionInto([link('a', 'b')], { node: 'c', port: 'in' })).toBeNull();
    });

    it('does not match the SOURCE end — only edges arriving here can be detached', () => {
        expect(connectionInto([link('a', 'b')], { node: 'a', port: 'out' })).toBeNull();
    });
});
