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
    portRowsHeight,
    portsOf,
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
        const threeInOneOut = node([...portsOf(threeIn), port('z', 'out')]);

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

        for (const p of portsOf(n)) {
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

        for (const p of portsOf(n)) {
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
            for (const p of portsOf(n)) {
                expect(portAnchor(n, p.id, metrics)?.y).toBe(portOffsetTop(n, p.id, metrics));
            }
        }
    });

    it('resolves a real metric by default', () => {
        expect(defaultMetrics().rowHeight).toBeGreaterThan(0);
    });
});

describe('a node with a view reserves room for it', () => {
    /**
     * The bug this guards against was visible in the first live demo: port
     * labels drawn straight over a text field and a value display. Ports are
     * absolutely positioned siblings of the card, so a body that starts at the
     * header's bottom edge renders underneath them.
     */
    it('grows by exactly the body height it was given', () => {
        const n = node([port('in', 'in'), port('out', 'out')]);
        expect(nodeHeight(n, M, 60) - nodeHeight(n, M, 0)).toBe(60);
    });

    it('places the port band between the header and the body', () => {
        const n = node([port('a', 'in'), port('b', 'in')]);
        // header + padding + band + body === total
        expect(portListTop(n) + portRowsHeight(n, M) + 60).toBe(nodeHeight(n, M, 60));
    });

    it('keeps every port inside the band, clear of the body', () => {
        const n = node([port('a', 'in'), port('b', 'in'), port('c', 'out')]);
        const bandEnd = portListTop(n) + portRowsHeight(n, M);
        for (const p of portsOf(n)) {
            expect(portOffsetTop(n, p.id, M) as number).toBeLessThan(bandEnd);
        }
    });

    it('costs nothing for a node with no view', () => {
        const n = node([port('a', 'in')]);
        expect(nodeHeight(n, M)).toBe(nodeHeight(n, M, 0));
    });
});

/*
 * Deriving a height filters the node's ports once per side, so doing it for
 * every node allocated two arrays per node on every pass that read the
 * rendered list — and a drag reads it every frame. The result depends only on
 * the node, the metrics and the body height, so it is remembered against all
 * three.
 */
describe('withDerivedHeights remembers what it derived', () => {
    function node(id: string, ports: NodePort[]): EditorNode {
        return { id, x: 0, y: 0, width: 180, height: 0, ports };
    }

    const PORTS: NodePort[] = [
        { id: 'in', direction: 'in', label: 'In' },
        { id: 'out', direction: 'out', label: 'Out' },
    ];

    it('gives an untouched node the identical object back', () => {
        const nodes = [node('a', PORTS), node('b', PORTS)];
        const first = withDerivedHeights(nodes);
        const second = withDerivedHeights(first);

        expect(second).toBe(first);
        expect(second[0]).toBe(first[0]);
    });

    it('still derives a height for a node it has not seen', () => {
        const [sized] = withDerivedHeights([node('a', PORTS)]);
        expect(sized.height).toBeGreaterThan(0);
    });

    it('re-derives when the ports changed, even at the same id', () => {
        const [one] = withDerivedHeights([node('a', PORTS)]);
        const many: NodePort[] = [
            ...PORTS,
            { id: 'x', direction: 'in', label: 'X' },
            { id: 'y', direction: 'in', label: 'Y' },
            { id: 'z', direction: 'in', label: 'Z' },
        ];
        const [more] = withDerivedHeights([node('a', many)]);

        expect(more.height).toBeGreaterThan(one.height);
    });

    it('re-derives when the body height changed but the node did not', () => {
        const nodes = [node('a', PORTS)];
        const [flat] = withDerivedHeights(nodes, defaultMetrics(), () => 0);
        const [tall] = withDerivedHeights(nodes, defaultMetrics(), () => 300);

        expect(tall.height).toBeGreaterThan(flat.height);
    });

    it('re-derives when the metrics changed but the node did not', () => {
        // Enough ports that the height clears NODE_MIN_HEIGHT, or both rows
        // clamp to the same floor and the comparison proves nothing.
        const many: NodePort[] = Array.from({ length: 8 }, (_, i) => ({
            id: `in${i}`,
            direction: 'in' as const,
            label: `In ${i}`,
        }));
        const nodes = [node('a', many)];

        const [pointer] = withDerivedHeights(nodes, POINTER_METRICS);
        const [touch] = withDerivedHeights(nodes, TOUCH_METRICS);

        expect(pointer.height).toBeGreaterThan(NODE_MIN_HEIGHT);
        expect(touch.height).toBeGreaterThan(pointer.height);
    });
});
