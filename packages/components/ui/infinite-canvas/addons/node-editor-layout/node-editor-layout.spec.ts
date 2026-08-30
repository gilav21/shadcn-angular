// Automatic layout — `specs/node-editor-addons-spec.md` §4.
//
// Every test here runs without a DOM, an editor or Angular, which is the
// point: nodes and edges in, positions out.
import { describe, it, expect } from 'vitest';
import { layoutGraph } from './node-editor-layout';
import type { EditorNode, NodeConnection, NodeId } from '../node-editor';

function node(id: string, w = 100, h = 50): EditorNode {
    return { id, x: 0, y: 0, width: w, height: h };
}

function link(id: string, from: string, to: string): NodeConnection {
    return { id, source: from, sourcePort: 'out', target: to, targetPort: 'in' };
}

/** Which layer a node landed in, inferred from its position along the flow. */
function layerIndex(
    positions: ReadonlyMap<NodeId, { x: number; y: number }>,
    id: NodeId,
    horizontal = true,
): number {
    const point = positions.get(id);
    if (!point) return -1;
    const values = [...positions.values()].map(p => (horizontal ? p.x : p.y));
    const distinct = [...new Set(values)].sort((a, b) => a - b);
    return distinct.indexOf(horizontal ? point.x : point.y);
}

describe('layers follow dependencies', () => {
    it('puts a chain in successive layers', () => {
        const nodes = ['a', 'b', 'c'].map(id => node(id));
        const positions = layoutGraph(nodes, [link('1', 'a', 'b'), link('2', 'b', 'c')]);

        expect(layerIndex(positions, 'a')).toBe(0);
        expect(layerIndex(positions, 'b')).toBe(1);
        expect(layerIndex(positions, 'c')).toBe(2);
    });

    it('puts independent roots in the SAME layer', () => {
        const nodes = ['a', 'b', 'sink'].map(id => node(id));
        const positions = layoutGraph(nodes, [link('1', 'a', 'sink'), link('2', 'b', 'sink')]);

        expect(positions.get('a')?.x).toBe(positions.get('b')?.x);
        expect(layerIndex(positions, 'sink')).toBe(1);
    });

    /**
     * Longest path, not shortest. A node sits after EVERYTHING it depends on,
     * which is what makes the layers read as stages rather than a ragged edge.
     */
    it('places a node after its deepest dependency, not its shallowest', () => {
        // a -> b -> c, and also a -> c. `c` belongs in layer 2, not layer 1.
        const nodes = ['a', 'b', 'c'].map(id => node(id));
        const positions = layoutGraph(nodes, [
            link('1', 'a', 'b'),
            link('2', 'b', 'c'),
            link('3', 'a', 'c'),
        ]);
        expect(layerIndex(positions, 'c')).toBe(2);
    });

    it('leaves an unconnected node in the first layer', () => {
        const positions = layoutGraph([node('a'), node('lonely')], []);
        expect(positions.get('a')?.x).toBe(positions.get('lonely')?.x);
    });
});

describe('direction', () => {
    it('LR advances along x', () => {
        const positions = layoutGraph([node('a'), node('b')], [link('1', 'a', 'b')], {
            direction: 'LR',
        });
        expect(positions.get('b')?.x).toBeGreaterThan(positions.get('a')?.x ?? 0);
        expect(positions.get('a')?.y).toBe(positions.get('b')?.y);
    });

    it('TB advances along y', () => {
        const positions = layoutGraph([node('a'), node('b')], [link('1', 'a', 'b')], {
            direction: 'TB',
        });
        expect(positions.get('b')?.y).toBeGreaterThan(positions.get('a')?.y ?? 0);
        expect(positions.get('a')?.x).toBe(positions.get('b')?.x);
    });
});

describe('spacing', () => {
    it('honours the layer gap', () => {
        const nodes = [node('a', 100), node('b', 100)];
        const tight = layoutGraph(nodes, [link('1', 'a', 'b')], { layerGap: 10 });
        const loose = layoutGraph(nodes, [link('1', 'a', 'b')], { layerGap: 200 });
        expect((loose.get('b')?.x ?? 0) - (tight.get('b')?.x ?? 0)).toBe(190);
    });

    it('honours the node gap within a layer', () => {
        const nodes = [node('a', 100, 50), node('b', 100, 50), node('sink')];
        const positions = layoutGraph(
            nodes,
            [link('1', 'a', 'sink'), link('2', 'b', 'sink')],
            { nodeGap: 40 },
        );
        const gap = Math.abs((positions.get('b')?.y ?? 0) - (positions.get('a')?.y ?? 0));
        expect(gap).toBe(90);       // 50 tall + 40 gap
    });

    it('never overlaps two nodes in the same layer', () => {
        const nodes = Array.from({ length: 6 }, (_, i) => node(`n${i}`, 100, 60));
        nodes.push(node('sink'));
        const positions = layoutGraph(
            nodes,
            nodes.slice(0, 6).map((n, i) => link(`c${i}`, n.id as string, 'sink')),
            { nodeGap: 20 },
        );

        const ys = nodes.slice(0, 6)
            .map(n => positions.get(n.id)?.y ?? 0)
            .sort((a, b) => a - b);
        for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(60);
    });

    it('centres a layer about the origin rather than hanging it off one edge', () => {
        const nodes = [node('a', 100, 50), node('b', 100, 50), node('sink')];
        const positions = layoutGraph(
            nodes,
            [link('1', 'a', 'sink'), link('2', 'b', 'sink')],
            { origin: { x: 0, y: 0 }, nodeGap: 0 },
        );
        const centre = ((positions.get('a')?.y ?? 0) + (positions.get('b')?.y ?? 0) + 50) / 2;
        expect(centre).toBeCloseTo(0, 5);
    });

    it('starts at the origin it was given', () => {
        const positions = layoutGraph([node('a')], [], { origin: { x: 500, y: 300 } });
        expect(positions.get('a')?.x).toBe(500);
    });
});

describe('cycles', () => {
    /**
     * A cyclic graph has no layering at all, so back-edges are ignored FOR
     * POSITIONING — the same thing dot does. The graph itself is untouched and
     * the cycle is still a cycle to the runtime.
     */
    it('lays out a cyclic graph instead of hanging', () => {
        const nodes = ['a', 'b', 'c'].map(id => node(id));
        const positions = layoutGraph(nodes, [
            link('1', 'a', 'b'),
            link('2', 'b', 'c'),
            link('3', 'c', 'a'),
        ]);
        expect(positions.size).toBe(3);
        expect(layerIndex(positions, 'a')).toBe(0);
    });

    it('survives a self-edge', () => {
        const positions = layoutGraph([node('solo')], [link('s', 'solo', 'solo')]);
        expect(positions.size).toBe(1);
    });

    it('survives two nodes pointing at each other', () => {
        const positions = layoutGraph(
            [node('a'), node('b')],
            [link('1', 'a', 'b'), link('2', 'b', 'a')],
        );
        expect(positions.size).toBe(2);
    });
});

describe('robustness', () => {
    it('returns nothing for no nodes', () => {
        expect(layoutGraph([], []).size).toBe(0);
    });

    it('ignores a connection pointing at a node that is not there', () => {
        const positions = layoutGraph([node('a')], [link('1', 'a', 'ghost')]);
        expect(positions.size).toBe(1);
    });

    it('positions EVERY node, so nothing is left where it was', () => {
        const nodes = Array.from({ length: 30 }, (_, i) => node(`n${i}`));
        const connections = nodes.slice(1).map((n, i) => link(`c${i}`, `n${i}`, n.id as string));
        expect(layoutGraph(nodes, connections).size).toBe(30);
    });
});

describe('determinism — the reason this is not force-directed', () => {
    /**
     * A force-directed layout gives a different arrangement every run. For a
     * workflow diagram that is disqualifying: the picture someone learned
     * yesterday is not the one they get today, and re-running the layout feels
     * like damage rather than tidying.
     */
    it('produces identical positions for identical input', () => {
        const nodes = ['a', 'b', 'c', 'd'].map(id => node(id));
        const connections = [link('1', 'a', 'b'), link('2', 'a', 'c'), link('3', 'b', 'd')];

        const first = layoutGraph(nodes, connections);
        const second = layoutGraph(nodes, connections);
        expect([...second]).toEqual([...first]);
    });

    it('is stable when re-run on its own output', () => {
        const nodes = ['a', 'b', 'c'].map(id => node(id));
        const connections = [link('1', 'a', 'b'), link('2', 'b', 'c')];

        const first = layoutGraph(nodes, connections);
        const moved = nodes.map(n => ({ ...n, ...(first.get(n.id) as { x: number; y: number }) }));
        expect([...layoutGraph(moved, connections)]).toEqual([...first]);
    });
});

describe('clusters are laid out as a unit', () => {
    /**
     * The guarantee that matters. A dependency layout spreads a zone's
     * members across layers; re-fitting the frame around them afterwards
     * produced a box big enough to swallow whatever landed in between, so a
     * tidy quietly added and removed nodes from a zone. Reported as "it
     * adds/removes items from a zone, bad" — and it is worse than no tidy.
     */
    it('never lets a non-member land inside a cluster’s box', () => {
        const nodes = [
            node('a', 100, 60), node('b', 100, 60), node('c', 100, 60),
            node('loose1', 300, 260), node('loose2', 100, 60),
        ];
        const connections = [
            link('1', 'a', 'b'), link('2', 'b', 'c'),
            link('3', 'a', 'loose1'), link('4', 'loose1', 'loose2'),
            link('5', 'loose2', 'c'),
        ];
        const inZone = new Set(['a', 'b', 'c']);
        const positions = layoutGraph(nodes, connections, {
            clusterOf: id => (inZone.has(id as string) ? 'zone' : null),
        });

        const boxOf = (ids: readonly string[]) => {
            const placed = ids.map(id => ({ n: nodes.find(x => x.id === id)!, p: positions.get(id)! }));
            return {
                left: Math.min(...placed.map(e => e.p.x)),
                top: Math.min(...placed.map(e => e.p.y)),
                right: Math.max(...placed.map(e => e.p.x + e.n.width)),
                bottom: Math.max(...placed.map(e => e.p.y + e.n.height)),
            };
        };
        const zone = boxOf(['a', 'b', 'c']);

        for (const id of ['loose1', 'loose2']) {
            const n = nodes.find(x => x.id === id)!;
            const p = positions.get(id)!;
            const overlaps =
                p.x < zone.right && p.x + n.width > zone.left &&
                p.y < zone.bottom && p.y + n.height > zone.top;
            expect(overlaps, `${id} landed inside the zone`).toBe(false);
        }
    });

    it('still places every node exactly once', () => {
        const nodes = ['a', 'b', 'c', 'd'].map(id => node(id));
        const positions = layoutGraph(nodes, [link('1', 'a', 'b'), link('2', 'c', 'd')], {
            clusterOf: id => (id === 'a' || id === 'b' ? 'pair' : null),
        });
        expect(positions.size).toBe(4);
    });

    it('keeps dependency order inside a cluster', () => {
        const nodes = ['a', 'b', 'c'].map(id => node(id));
        const positions = layoutGraph(nodes, [link('1', 'a', 'b'), link('2', 'b', 'c')], {
            clusterOf: () => 'all',
        });
        expect(positions.get('a')!.x).toBeLessThan(positions.get('b')!.x);
        expect(positions.get('b')!.x).toBeLessThan(positions.get('c')!.x);
    });

    it('leaves an unclustered graph exactly as before', () => {
        const nodes = ['a', 'b'].map(id => node(id));
        const connections = [link('1', 'a', 'b')];
        expect([...layoutGraph(nodes, connections, { clusterOf: () => null })])
            .toEqual([...layoutGraph(nodes, connections)]);
    });

    it('is still deterministic with clusters', () => {
        const nodes = ['a', 'b', 'c'].map(id => node(id));
        const connections = [link('1', 'a', 'b'), link('2', 'b', 'c')];
        const opts = { clusterOf: (id: NodeId) => (id === 'a' ? 'one' : null) };
        expect([...layoutGraph(nodes, connections, opts)])
            .toEqual([...layoutGraph(nodes, connections, opts)]);
    });
});

describe('crossing reduction', () => {
    /**
     * The classic case: two sources feeding two sinks, wired across. A layout
     * that kept input order would cross the wires; the median heuristic should
     * pull each node next to what it connects to.
     */
    it('orders a layer by what its nodes connect to', () => {
        const nodes = ['a1', 'a2', 'b1', 'b2'].map(id => node(id));
        // a1 -> b2 and a2 -> b1: the second layer should end up reversed.
        const positions = layoutGraph(nodes, [link('1', 'a1', 'b2'), link('2', 'a2', 'b1')]);

        const a1 = positions.get('a1')?.y ?? 0;
        const a2 = positions.get('a2')?.y ?? 0;
        const b1 = positions.get('b1')?.y ?? 0;
        const b2 = positions.get('b2')?.y ?? 0;

        // Whichever way round the first layer sits, its partner sits the same
        // way in the second — that is what "no crossing" means here.
        expect(Math.sign(a1 - a2)).toBe(Math.sign(b2 - b1));
    });
});
