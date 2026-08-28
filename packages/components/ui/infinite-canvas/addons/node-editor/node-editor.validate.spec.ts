// T-4 from `specs/node-editor-spec.md` §4 — one case per ConnectRejection.
import { describe, it, expect } from 'vitest';
import { canConnect, indexGraph, type GraphView } from './node-editor.validate';
import type { ConnectRejection, EditorNode, NodeConnection, NodePort } from './node-editor.types';

function port(id: string, direction: 'in' | 'out', extra: Partial<NodePort> = {}): NodePort {
    return { id, direction, label: id, ...extra };
}

function node(id: string, ports: NodePort[]): EditorNode {
    return { id, x: 0, y: 0, width: 180, height: 80, title: id, ports };
}

/** A → B → C, each with one input and one output, nothing connected. */
function chainNodes(): EditorNode[] {
    return ['a', 'b', 'c'].map(id => node(id, [port('in', 'in'), port('out', 'out')]));
}

function graph(over: Partial<GraphView> = {}): GraphView {
    return { nodes: chainNodes(), connections: [], ...over };
}

function link(source: string, target: string): NodeConnection {
    return { id: `${source}->${target}`, source, sourcePort: 'out', target, targetPort: 'in' };
}

/** The rejection reason, or `'ok'`. Lets each case assert one value. */
function outcome(view: GraphView, a: [string, string], b: [string, string]): ConnectRejection | 'ok' {
    const result = canConnect(
        view,
        { node: a[0], port: a[1] },
        { node: b[0], port: b[1] },
    );
    return result.ok ? 'ok' : result.reason;
}

describe('canConnect accepts a valid pair', () => {
    it('connects an output to an input', () => {
        expect(outcome(graph(), ['a', 'out'], ['b', 'in'])).toBe('ok');
    });

    it('normalises the endpoints so source is always the output side', () => {
        // Dragged backwards, from the input to the output.
        const result = canConnect(
            graph(),
            { node: 'b', port: 'in' },
            { node: 'a', port: 'out' },
        );
        expect(result).toEqual({
            ok: true,
            source: { node: 'a', port: 'out' },
            target: { node: 'b', port: 'in' },
        });
    });

    it('accepts either order — dragging backwards is not a different rule', () => {
        expect(outcome(graph(), ['b', 'in'], ['a', 'out'])).toBe('ok');
    });
});

describe('canConnect rejects, with a reason for each rule', () => {
    it('unknown-node', () => {
        expect(outcome(graph(), ['ghost', 'out'], ['b', 'in'])).toBe('unknown-node');
    });

    it('unknown-port', () => {
        expect(outcome(graph(), ['a', 'nope'], ['b', 'in'])).toBe('unknown-port');
    });

    it('same-node', () => {
        expect(outcome(graph(), ['a', 'out'], ['a', 'in'])).toBe('same-node');
    });

    it('same-direction', () => {
        expect(outcome(graph(), ['a', 'out'], ['b', 'out'])).toBe('same-direction');
    });

    it('port-disabled', () => {
        const nodes = [
            node('a', [port('out', 'out', { disabled: true })]),
            node('b', [port('in', 'in')]),
        ];
        expect(outcome(graph({ nodes }), ['a', 'out'], ['b', 'in'])).toBe('port-disabled');
    });

    it('type-mismatch', () => {
        const nodes = [
            node('a', [port('out', 'out', { type: 'number' })]),
            node('b', [port('in', 'in', { type: 'string' })]),
        ];
        expect(outcome(graph({ nodes }), ['a', 'out'], ['b', 'in'])).toBe('type-mismatch');
    });

    it('duplicate', () => {
        const connections = [link('a', 'b')];
        expect(outcome(graph({ connections }), ['a', 'out'], ['b', 'in'])).toBe('duplicate');
    });

    it('occupied — a single-valued input already has an edge', () => {
        const connections = [link('a', 'b')];
        expect(outcome(graph({ connections }), ['c', 'out'], ['b', 'in'])).toBe('occupied');
    });

    it('cycle — only when the graph is declared acyclic', () => {
        const connections = [link('a', 'b'), link('b', 'c')];
        const view = graph({ connections, allowCycles: false });
        expect(outcome(view, ['c', 'out'], ['a', 'in'])).toBe('cycle');
    });
});

describe('type compatibility', () => {
    it('allows a typed port to meet an untyped one', () => {
        const nodes = [
            node('a', [port('out', 'out', { type: 'number' })]),
            node('b', [port('in', 'in')]),
        ];
        expect(outcome(graph({ nodes }), ['a', 'out'], ['b', 'in'])).toBe('ok');
    });

    it('allows two ports declaring the same type', () => {
        const nodes = [
            node('a', [port('out', 'out', { type: 'number' })]),
            node('b', [port('in', 'in', { type: 'number' })]),
        ];
        expect(outcome(graph({ nodes }), ['a', 'out'], ['b', 'in'])).toBe('ok');
    });
});

describe('input arity', () => {
    it('lets a multiple input take a second edge', () => {
        const nodes = [
            node('a', [port('out', 'out')]),
            node('b', [port('in', 'in', { multiple: true })]),
            node('c', [port('out', 'out')]),
        ];
        const connections = [link('a', 'b')];
        expect(outcome(graph({ nodes, connections }), ['c', 'out'], ['b', 'in'])).toBe('ok');
    });

    it('does not limit how many edges leave one output', () => {
        const connections = [link('a', 'b')];
        expect(outcome(graph({ connections }), ['a', 'out'], ['c', 'in'])).toBe('ok');
    });
});

describe('cycle detection', () => {
    it('permits a cycle by default — most graphs are not DAGs', () => {
        const connections = [link('a', 'b'), link('b', 'c')];
        expect(outcome(graph({ connections }), ['c', 'out'], ['a', 'in'])).toBe('ok');
    });

    it('still allows a diamond, which is acyclic', () => {
        // a→b, a→c, and now b→d and c→d: two paths, no cycle.
        const nodes = [
            ...chainNodes(),
            node('d', [port('in', 'in', { multiple: true }), port('out', 'out')]),
        ];
        const connections = [link('a', 'b'), link('a', 'c'), link('b', 'd')];
        const view = graph({ nodes, connections, allowCycles: false });
        expect(outcome(view, ['c', 'out'], ['d', 'in'])).toBe('ok');
    });

    it('rejects the shortest cycle, a→b then b→a', () => {
        const nodes = chainNodes();
        const connections = [link('a', 'b')];
        expect(outcome(graph({ nodes, connections, allowCycles: false }), ['b', 'out'], ['a', 'in']))
            .toBe('cycle');
    });

    it('terminates on a graph that already contains a cycle', () => {
        // Defensive: `allowCycles` may be turned on, edges made, then turned
        // off. A naive traversal would loop forever rather than answer.
        const connections = [link('a', 'b'), link('b', 'a')];
        const view = graph({ connections, allowCycles: false });
        expect(outcome(view, ['b', 'out'], ['c', 'in'])).toBe('ok');
    });

    it('handles a long chain without recursing', () => {
        const nodes = Array.from({ length: 2000 }, (_, i) =>
            node(`n${i}`, [port('in', 'in'), port('out', 'out')]),
        );
        const connections = Array.from({ length: 1999 }, (_, i) => link(`n${i}`, `n${i + 1}`));
        const view = graph({ nodes, connections, allowCycles: false });
        expect(outcome(view, ['n1999', 'out'], ['n0', 'in'])).toBe('cycle');
    });
});

/*
 * `canConnect` answers by scanning: every node for each endpoint, every
 * connection for a duplicate and for an occupied input, and — with cycles
 * disallowed — every connection again for each node on the reachability walk.
 *
 * That is fine for one question and ruinous for the question the editor
 * actually asks: which of these ports could this wire land on, once per port.
 * Measured unindexed at 1.12ms a call on a 100,000-node graph, and the sweep
 * used to make 400,000 of them — about seven minutes of frozen main thread for
 * one pointerdown.
 *
 * An index makes each answer a hash lookup. It is only allowed to be faster,
 * never different, so the property under test is that the two agree — on every
 * pair, in both directions, including every way a connection can be refused.
 */
describe('an indexed graph answers exactly as an unindexed one', () => {
    /** Every ordered pair of ports across the graph, both directions. */
    function everyPair(nodes: readonly EditorNode[]): [[string, string], [string, string]][] {
        const refs: [string, string][] = [];
        for (const n of nodes) {
            for (const p of n.ports ?? []) refs.push([String(n.id), p.id]);
        }
        const pairs: [[string, string], [string, string]][] = [];
        for (const a of refs) {
            for (const b of refs) pairs.push([a, b]);
        }
        return pairs;
    }

    function agreesOn(view: GraphView): void {
        const indexed: GraphView = { ...view, index: indexGraph(view.nodes, view.connections) };
        for (const [a, b] of everyPair(view.nodes)) {
            expect(outcome(indexed, a, b)).toBe(outcome(view, a, b));
        }
    }

    it('agrees on an empty graph', () => {
        agreesOn(graph());
    });

    it('agrees when a connection already exists', () => {
        agreesOn(graph({ connections: [link('a', 'b')] }));
    });

    it('agrees on an occupied single input', () => {
        const nodes = [
            node('a', [port('out', 'out')]),
            node('b', [port('out', 'out')]),
            node('c', [port('in', 'in')]),
        ];
        agreesOn({ nodes, connections: [link('a', 'c')] });
    });

    it('agrees on a multiple input, which is never occupied', () => {
        const nodes = [
            node('a', [port('out', 'out')]),
            node('b', [port('out', 'out')]),
            node('c', [port('in', 'in', { multiple: true })]),
        ];
        agreesOn({ nodes, connections: [link('a', 'c')] });
    });

    it('agrees about cycles when cycles are refused', () => {
        agreesOn({
            nodes: chainNodes(),
            connections: [link('a', 'b'), link('b', 'c')],
            allowCycles: false,
        });
    });

    it('agrees about a longer chain when cycles are refused', () => {
        const nodes = ['a', 'b', 'c', 'd', 'e'].map(id =>
            node(id, [port('in', 'in'), port('out', 'out')]),
        );
        agreesOn({
            nodes,
            connections: [link('a', 'b'), link('b', 'c'), link('c', 'd'), link('d', 'e')],
            allowCycles: false,
        });
    });

    it('agrees about typed ports', () => {
        const nodes = [
            node('a', [port('out', 'out', { type: 'text' })]),
            node('b', [port('in', 'in', { type: 'number' })]),
            node('c', [port('in', 'in', { type: 'text' })]),
        ];
        agreesOn({ nodes, connections: [] });
    });

    it('agrees about an unknown node or port', () => {
        const view = graph();
        const indexed: GraphView = { ...view, index: indexGraph(view.nodes, view.connections) };
        expect(outcome(indexed, ['ghost', 'out'], ['a', 'in'])).toBe(
            outcome(view, ['ghost', 'out'], ['a', 'in']),
        );
        expect(outcome(indexed, ['a', 'ghost'], ['b', 'in'])).toBe(
            outcome(view, ['a', 'ghost'], ['b', 'in']),
        );
    });
});
