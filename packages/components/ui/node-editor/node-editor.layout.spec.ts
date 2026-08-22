// T-3 from `specs/node-editor-spec.md` §3.
import { describe, it, expect } from 'vitest';
import {
    NODE_HEADER_HEIGHT,
    NODE_MIN_HEIGHT,
    NODE_SUBTITLE_HEIGHT,
    PORT_LIST_PADDING,
    POINTER_METRICS,
    TOUCH_METRICS,
    defaultMetrics,
    nodeHeight,
    portAnchor,
    portListTop,
    portOffsetTop,
    portsOnSide,
    withDerivedHeights,
} from './node-editor.layout';
import type { EditorNode, NodePort } from './node-editor.types';

/**
 * Every assertion passes metrics explicitly. Port row height is device-
 * dependent (44px on touch), so a test that relied on the default would assert
 * a different number on a touch-capable CI runner.
 */
const M = POINTER_METRICS;

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
        expect(nodeHeight(threeInOneOut, M)).toBe(nodeHeight(threeIn, M));
    });

    it('adds exactly one row per extra port on the tallest side', () => {
        const one = nodeHeight(node([port('a', 'in')]), M);
        const two = nodeHeight(node([port('a', 'in'), port('b', 'in')]), M);
        expect(two - one).toBe(M.rowHeight);
    });

    it('reserves room for a subtitle only when there is one', () => {
        const ports = [port('a', 'in'), port('b', 'in')];
        expect(nodeHeight(node(ports, { subtitle: 'hi' }), M) - nodeHeight(node(ports), M))
            .toBe(NODE_SUBTITLE_HEIGHT);
    });

    it('never collapses below the minimum, so a port-less node stays a target', () => {
        expect(nodeHeight(node([]), M)).toBe(NODE_MIN_HEIGHT);
    });
});

describe('portOffsetTop', () => {
    it('centres the first port in the first row below the header', () => {
        const n = node([port('a', 'in')]);
        expect(portOffsetTop(n, 'a', M)).toBe(
            NODE_HEADER_HEIGHT + PORT_LIST_PADDING + M.rowHeight / 2,
        );
    });

    it('indexes within a side, not across all ports', () => {
        // 'out1' is the FIRST output, so it shares a row with the first input
        // even though it is declared third.
        const n = node([port('in1', 'in'), port('in2', 'in'), port('out1', 'out')]);
        expect(portOffsetTop(n, 'out1', M)).toBe(portOffsetTop(n, 'in1', M));
    });

    it('returns null for a port the node does not have', () => {
        expect(portOffsetTop(node([port('a', 'in')]), 'nope', M)).toBeNull();
    });

    it('keeps every port inside the node it belongs to', () => {
        const n = node([
            port('i1', 'in'), port('i2', 'in'), port('i3', 'in'),
            port('o1', 'out'),
        ], { subtitle: 'with a subtitle' });
        const height = nodeHeight(n, M);

        for (const p of n.ports) {
            const top = portOffsetTop(n, p.id, M) as number;
            expect(top).toBeGreaterThan(portListTop(n) - 1);
            expect(top).toBeLessThan(height);
        }
    });
});

describe('portAnchor', () => {
    it('puts inputs on the left edge and outputs on the right', () => {
        const n = node([port('i', 'in'), port('o', 'out')], { width: 200 });
        expect(portAnchor(n, 'i', M)?.x).toBe(0);
        expect(portAnchor(n, 'o', M)?.x).toBe(200);
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
            expect(portAnchor(n, p.id, M)?.y).toBe(portOffsetTop(n, p.id, M));
        }
    });

    it('is relative to the node origin, so it survives the node moving', () => {
        const ports = [port('o', 'out')];
        const here = node(ports, { x: 0, y: 0 });
        const there = node(ports, { x: 900, y: -400 });
        expect(portAnchor(there, 'o', M)).toEqual(portAnchor(here, 'o', M));
    });

    it('returns null for an unknown port', () => {
        expect(portAnchor(node([]), 'nope', M)).toBeNull();
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
        const [only] = withDerivedHeights([node([port('a', 'in')])], M);
        expect(only.height).toBe(nodeHeight(only, M));
    });

    it('returns the SAME array when nothing changed', () => {
        const settled = withDerivedHeights([node([port('a', 'in')])], M);
        // Referential equality matters: a fresh array every pass would
        // invalidate the engine's `items` input on every change detection.
        expect(withDerivedHeights(settled, M)).toBe(settled);
    });

    it('leaves untouched nodes referentially equal when one changes', () => {
        const stable = { ...node([port('a', 'in')], { id: 'stable' }) };
        const settledStable = withDerivedHeights([stable], M)[0];
        const next = withDerivedHeights([settledStable, node([], { id: 'fresh' })], M);
        expect(next[0]).toBe(settledStable);
    });
});

describe('port metrics adapt the row height to the device', () => {
    it('gives a touch device a 44px row, the WCAG / HIG tap-target minimum', () => {
        // Enlarging only an invisible hit area would make adjacent ports steal
        // each other's taps; the ROW has to be that tall.
        expect(TOUCH_METRICS.rowHeight).toBeGreaterThanOrEqual(44);
    });

    it('makes a node taller on touch, so the ports still fit inside it', () => {
        const n = node([port('a', 'in'), port('b', 'in')]);
        expect(nodeHeight(n, TOUCH_METRICS)).toBeGreaterThan(nodeHeight(n, POINTER_METRICS));
    });

    it('keeps the dot and the wire in agreement under either metric', () => {
        const n = node([port('i', 'in'), port('o', 'out'), port('o2', 'out')]);
        for (const metrics of [POINTER_METRICS, TOUCH_METRICS]) {
            for (const p of n.ports) {
                expect(portAnchor(n, p.id, metrics)?.y).toBe(portOffsetTop(n, p.id, metrics));
            }
        }
    });

    it('resolves a real metric by default', () => {
        expect(defaultMetrics().rowHeight).toBeGreaterThan(0);
    });
});
