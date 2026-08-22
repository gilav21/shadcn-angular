// T-4 from `specs/node-editor-spec.md` §4 — one case per ConnectRejection.
import { describe, it, expect } from 'vitest';
import { canConnect, type GraphView } from './node-editor.validate';
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
