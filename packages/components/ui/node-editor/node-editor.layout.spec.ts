// T-3 from `specs/node-editor-spec.md` §3.
import { describe, it, expect } from 'vitest';
import {
    NODE_HEADER_HEIGHT,
    NODE_MIN_HEIGHT,
    NODE_SUBTITLE_HEIGHT,
    PORT_LIST_PADDING,
    PORT_ROW_HEIGHT,
    nodeHeight,
    portAnchor,
    portListTop,
    portOffsetTop,
    portsOnSide,
    withDerivedHeights,
} from './node-editor.layout';
import type { EditorNode, NodePort } from './node-editor.types';

function port(id: string, direction: 'in' | 'out'): NodePort {
    return { id, direction, label: id };
}

function node(ports: NodePort[], extra: Partial<EditorNode> = {}): EditorNode {
    return {
        id: 'n',
        x: 0,
        y: 0,
        width: 180,
        height: 0,
        title: 'Node',
        ports,
        ...extra,
    };
}

describe('nodeHeight', () => {
    it('grows with the LARGER side, because the columns are parallel', () => {
        const threeIn = node([port('a', 'in'), port('b', 'in'), port('c', 'in')]);
        const threeInOneOut = node([...threeIn.ports, port('z', 'out')]);

        // If height summed the two sides, adding an output would make it taller.
        expect(nodeHeight(threeInOneOut)).toBe(nodeHeight(threeIn));
    });

    it('adds exactly one row per extra port on the tallest side', () => {
        const one = nodeHeight(node([port('a', 'in')]));
        const two = nodeHeight(node([port('a', 'in'), port('b', 'in')]));
        expect(two - one).toBe(PORT_ROW_HEIGHT);
    });

    it('reserves room for a subtitle only when there is one', () => {
        const ports = [port('a', 'in'), port('b', 'in')];
        expect(nodeHeight(node(ports, { subtitle: 'hi' })) - nodeHeight(node(ports)))
            .toBe(NODE_SUBTITLE_HEIGHT);
    });

    it('never collapses below the minimum, so a port-less node stays a target', () => {
        expect(nodeHeight(node([]))).toBe(NODE_MIN_HEIGHT);
    });
});

describe('portOffsetTop', () => {
    it('centres the first port in the first row below the header', () => {
        const n = node([port('a', 'in')]);
        expect(portOffsetTop(n, 'a')).toBe(
            NODE_HEADER_HEIGHT + PORT_LIST_PADDING + PORT_ROW_HEIGHT / 2,
        );
    });

    it('indexes within a side, not across all ports', () => {
        // 'out1' is the FIRST output, so it shares a row with the first input
        // even though it is declared third.
        const n = node([port('in1', 'in'), port('in2', 'in'), port('out1', 'out')]);
        expect(portOffsetTop(n, 'out1')).toBe(portOffsetTop(n, 'in1'));
    });

    it('returns null for a port the node does not have', () => {
        expect(portOffsetTop(node([port('a', 'in')]), 'nope')).toBeNull();
    });

    it('keeps every port inside the node it belongs to', () => {
        const n = node([
            port('i1', 'in'), port('i2', 'in'), port('i3', 'in'),
            port('o1', 'out'),
        ], { subtitle: 'with a subtitle' });
        const height = nodeHeight(n);

        for (const p of n.ports) {
            const top = portOffsetTop(n, p.id) as number;
            expect(top).toBeGreaterThan(portListTop(n) - 1);
            expect(top).toBeLessThan(height);
        }
    });
});

describe('portAnchor', () => {
    it('puts inputs on the left edge and outputs on the right', () => {
        const n = node([port('i', 'in'), port('o', 'out')], { width: 200 });
        expect(portAnchor(n, 'i')?.x).toBe(0);
        expect(portAnchor(n, 'o')?.x).toBe(200);
    });

    /**
     * The reason `layout.ts` exists as one module. The dot is placed by CSS
     * inside the card; the wire is painted on a canvas. Two derivations of the
     * same number drift, and the drift looks like a rendering artefact.
     */
    it('agrees with portOffsetTop for every port — the dot and the wire cannot drift', () => {
        const n = node([
            port('i1', 'in'), port('i2', 'in'),
            port('o1', 'out'), port('o2', 'out'), port('o3', 'out'),
        ], { subtitle: 'x' });

        for (const p of n.ports) {
            expect(portAnchor(n, p.id)?.y).toBe(portOffsetTop(n, p.id));
        }
    });

    it('is relative to the node origin, so it survives the node moving', () => {
        const ports = [port('o', 'out')];
        const here = node(ports, { x: 0, y: 0 });
        const there = node(ports, { x: 900, y: -400 });
        expect(portAnchor(there, 'o')).toEqual(portAnchor(here, 'o'));
    });

    it('returns null for an unknown port', () => {
        expect(portAnchor(node([]), 'nope')).toBeNull();
    });
});

describe('portsOnSide', () => {
    it('preserves declaration order within a side', () => {
        const n = node([port('a', 'in'), port('x', 'out'), port('b', 'in')]);
        expect(portsOnSide(n, 'in').map(p => p.id)).toEqual(['a', 'b']);
    });
});

describe('withDerivedHeights', () => {
    it('writes the derived height onto each node', () => {
        const [only] = withDerivedHeights([node([port('a', 'in')])]);
        expect(only.height).toBe(nodeHeight(only));
    });

    it('returns the SAME array when nothing changed', () => {
        const settled = withDerivedHeights([node([port('a', 'in')])]);
        // Referential equality matters: a fresh array every pass would
        // invalidate the engine's `items` input on every change detection.
        expect(withDerivedHeights(settled)).toBe(settled);
    });

    it('leaves untouched nodes referentially equal when one changes', () => {
        const stable = { ...node([port('a', 'in')], { id: 'stable' }) };
        const settledStable = withDerivedHeights([stable])[0];
        const next = withDerivedHeights([settledStable, node([], { id: 'fresh' })]);
        expect(next[0]).toBe(settledStable);
    });
});
