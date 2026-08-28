// Group geometry — `specs/node-editor-addons-spec.md` §6, tasks F2 and F3.
//
// Every test here runs without a DOM, an editor or Angular: the rules that
// decide what belongs to a group are worth checking on their own rather than
// only through a drag.
import { describe, it, expect } from 'vitest';
import {
    GROUP_HEADER,
    GROUP_PADDING,
    MIN_GROUP_SIZE,
    byPaintOrder,
    contains,
    fitAround,
    membership,
    movedGroup,
    movedMembers,
    resizedGroup,
    titleBarOf,
} from './node-editor-groups.utils';
import type { NodeGroup } from './node-editor-groups.types';
import type { EditorNode } from '../node-editor';

function node(id: string, x: number, y: number, w = 100, h = 60): EditorNode {
    return { id, x, y, width: w, height: h };
}

function group(id: string, x: number, y: number, w: number, h: number): NodeGroup {
    return { id, title: id, x, y, width: w, height: h };
}

describe('membership is containment, not overlap', () => {
    /**
     * Overlap would make a node touching the corner of two groups a member of
     * both, so dragging either one would drag a node the user never put in it.
     */
    it('claims a node fully inside', () => {
        expect(contains(group('g', 0, 0, 400, 400), node('a', 50, 50))).toBe(true);
    });

    it('does NOT claim a node that merely overlaps the edge', () => {
        // Hangs 50 units off the right edge.
        expect(contains(group('g', 0, 0, 100, 400), node('a', 50, 50))).toBe(false);
    });

    it('claims a node touching the boundary exactly', () => {
        expect(contains(group('g', 0, 0, 100, 60), node('a', 0, 0))).toBe(true);
    });

    it('ignores a node entirely outside', () => {
        expect(contains(group('g', 0, 0, 100, 100), node('a', 500, 500))).toBe(false);
    });

    it('lists the members of every group', () => {
        const groups = [group('inner', 0, 0, 200, 200), group('far', 900, 900, 200, 200)];
        const nodes = [node('a', 20, 20), node('b', 920, 920)];

        const members = membership(groups, nodes);
        expect(members.get('inner')).toEqual(['a']);
        expect(members.get('far')).toEqual(['b']);
    });

    it('gives an empty list for a group containing nothing', () => {
        expect(membership([group('g', 0, 0, 100, 100)], [])!.get('g')).toEqual([]);
    });

    /**
     * Dragging the outer frame has to move everything drawn inside it. A node
     * that opted out because a tighter group also claimed it would be left
     * behind while the frame moved away from it.
     */
    it('puts a node in a nested group in BOTH', () => {
        const groups = [group('outer', 0, 0, 600, 600), group('inner', 40, 40, 200, 200)];
        const members = membership(groups, [node('a', 60, 60)]);

        expect(members.get('outer')).toEqual(['a']);
        expect(members.get('inner')).toEqual(['a']);
    });
});

describe('fitting a group around nodes', () => {
    it('surrounds them with padding', () => {
        const fitted = fitAround([node('a', 100, 100, 100, 60)]);
        expect(fitted?.x).toBe(100 - GROUP_PADDING);
        expect(fitted?.width).toBe(100 + GROUP_PADDING * 2);
    });

    it('leaves room at the top for the title', () => {
        const fitted = fitAround([node('a', 100, 100)]);
        expect(fitted?.y).toBe(100 - GROUP_PADDING - GROUP_HEADER);
    });

    it('spans every node it was given', () => {
        const fitted = fitAround([node('a', 0, 0, 100, 60), node('b', 400, 300, 100, 60)]);
        expect((fitted?.x ?? 0) + (fitted?.width ?? 0)).toBe(500 + GROUP_PADDING);
    });

    it('actually contains what it was fitted around', () => {
        const nodes = [node('a', 0, 0), node('b', 300, 200), node('c', -120, 90)];
        const fitted = fitAround(nodes) as NodeGroup;
        expect(nodes.every(n => contains(fitted, n))).toBe(true);
    });

    /**
     * A zero-sized rectangle at the origin is a group nobody can see and
     * nobody can grab.
     */
    it('is null for no nodes, not an invisible rectangle', () => {
        expect(fitAround([])).toBeNull();
    });

    it('is never smaller than the minimum, even around one tiny node', () => {
        const fitted = fitAround([node('a', 0, 0, 1, 1)]);
        expect(fitted?.width).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
        expect(fitted?.height).toBeGreaterThanOrEqual(MIN_GROUP_SIZE);
    });
});

describe('moving a group moves its members', () => {
    const frame = group('g', 0, 0, 400, 400);
    const nodes = [node('in', 50, 50), node('out', 900, 900)];

    it('reports where each member lands', () => {
        const moved = movedMembers(frame, nodes, { x: 100, y: 20 });
        expect(moved.get('in')).toEqual({ x: 150, y: 70 });
    });

    it('leaves nodes outside the group alone', () => {
        expect(movedMembers(frame, nodes, { x: 100, y: 20 }).has('out')).toBe(false);
    });

    /**
     * The editor owns node positions and routes them through the undo funnel.
     * Handing back a mutated array would put an untracked edit into the graph.
     */
    it('returns positions rather than mutating the nodes', () => {
        movedMembers(frame, nodes, { x: 100, y: 20 });
        expect(nodes[0]).toMatchObject({ x: 50, y: 50 });
    });

    it('moves the frame itself without changing anything else', () => {
        const moved = movedGroup({ ...frame, colour: '#f00' }, { x: 10, y: -5 });
        expect(moved).toMatchObject({ x: 10, y: -5, width: 400, colour: '#f00' });
    });
});

describe('resizing', () => {
    it('grows by the delta', () => {
        expect(resizedGroup(group('g', 0, 0, 200, 200), { x: 50, y: 30 })).toMatchObject({
            width: 250,
            height: 230,
        });
    });

    /**
     * A group collapsed to nothing is a group nobody can grab to un-collapse.
     */
    it('refuses to collapse below the minimum', () => {
        const squashed = resizedGroup(group('g', 0, 0, 200, 200), { x: -9999, y: -9999 });
        expect(squashed.width).toBe(MIN_GROUP_SIZE);
        expect(squashed.height).toBe(MIN_GROUP_SIZE);
    });
});

describe('paint order', () => {
    /**
     * A small group nested inside a big one has to paint on top of it, or it
     * is invisible and unclickable.
     */
    it('draws the largest first, so a nested group stays visible', () => {
        const groups = [group('small', 40, 40, 100, 100), group('big', 0, 0, 600, 600)];
        expect(byPaintOrder(groups).map(g => g.id)).toEqual(['big', 'small']);
    });

    it('keeps authored order for equal areas, so it is stable', () => {
        const groups = [group('a', 0, 0, 100, 100), group('b', 200, 0, 100, 100)];
        expect(byPaintOrder(groups).map(g => g.id)).toEqual(['a', 'b']);
    });

    it('does not mutate the array it was given', () => {
        const groups = [group('small', 0, 0, 10, 10), group('big', 0, 0, 600, 600)];
        byPaintOrder(groups);
        expect(groups[0].id).toBe('small');
    });
});

describe('the title bar', () => {
    it('spans the width of the group', () => {
        expect(titleBarOf(group('g', 10, 20, 300, 200))).toMatchObject({
            x: 10,
            y: 20,
            width: 300,
            height: GROUP_HEADER,
        });
    });

    it('never exceeds a group shorter than the bar itself', () => {
        expect(titleBarOf(group('g', 0, 0, 300, 10)).height).toBe(10);
    });
});

/*
 * `membership` answers by spatial index rather than by asking every group
 * about every node. That is only allowed to be faster — never different — so
 * the property under test is equivalence with the obvious implementation,
 * on boards built to hit the cases the index could plausibly get wrong.
 */
describe('the membership memo answers for the graph it was given', () => {
    /*
     * Dragging one node replaces one object out of a hundred thousand, so a
     * node that is the same OBJECT in the same position keeps its previous
     * answer instead of asking the index again. Positions are immutable — a
     * move replaces the node — so identity is proof nothing changed.
     *
     * The risk of any such memo is that it answers for the graph it was given
     * LAST. These are the two cases that catch that: a node that moved out,
     * and a node that moved in.
     */
    const groups = [group('g', 0, 0, 400, 400)];

    it('hands back the very same answer for the very same node list', () => {
        // Not merely equal — identical. Rebuilding a hundred-thousand-entry
        // map to reproduce the answer it already had was the cost the memo
        // was supposed to remove.
        const nodes = [node('a', 50, 50), node('b', 900, 900)];

        expect(membership(groups, nodes)).toBe(membership(groups, nodes));
    });

    it('lets go of a node that moved out of the group', () => {
        expect(membership(groups, [node('a', 50, 50)]).get('g')).toEqual(['a']);

        // A new array, and a new object for `a` — which is what a drag makes.
        expect(membership(groups, [node('a', 900, 900)]).get('g')).toEqual([]);
    });

    it('picks up a node that moved into the group', () => {
        expect(membership(groups, [node('b', 900, 900)]).get('g')).toEqual([]);
        expect(membership(groups, [node('b', 60, 60)]).get('g')).toEqual(['b']);
    });

    it('keeps the answer for the nodes that did not move', () => {
        const still = node('still', 20, 20);
        expect(membership(groups, [still, node('mover', 30, 30)]).get('g')).toEqual([
            'still',
            'mover',
        ]);

        // Same object for `still`, a new one for `mover`, now outside.
        expect(membership(groups, [still, node('mover', 900, 900)]).get('g')).toEqual(['still']);
    });
});

describe('membership matches an exhaustive scan', () => {
    function exhaustive(
        groups: readonly NodeGroup[],
        nodes: readonly EditorNode[],
    ): Map<string, readonly string[]> {
        const result = new Map<string, readonly string[]>();
        for (const g of groups) {
            result.set(
                g.id,
                nodes.filter(n => contains(g, n)).map(n => String(n.id)),
            );
        }
        return result;
    }

    function expectSame(groups: readonly NodeGroup[], nodes: readonly EditorNode[]): void {
        const actual = membership(groups, nodes);
        const expected = exhaustive(groups, nodes);
        const sorted = (keys: Iterable<string>): string[] =>
            [...keys].sort((a, b) => a.localeCompare(b));
        expect(sorted(actual.keys())).toEqual(sorted(expected.keys()));
        for (const [id, members] of expected) {
            expect(actual.get(id)?.map(String) ?? []).toEqual(members);
        }
    }

    it('agrees on a dense scatter of overlapping groups', () => {
        // Deterministic: a seeded LCG, so a failure is reproducible.
        let seed = 987654321;
        const rnd = (): number => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };

        const groups: NodeGroup[] = [];
        for (let i = 0; i < 60; i++) {
            groups.push(
                group(`g${i}`, rnd() * 2000, rnd() * 2000, 80 + rnd() * 700, 80 + rnd() * 700),
            );
        }
        const nodes: EditorNode[] = [];
        for (let i = 0; i < 400; i++) {
            nodes.push(node(`n${i}`, rnd() * 2200, rnd() * 2200, 40 + rnd() * 60, 30 + rnd() * 40));
        }

        expectSame(groups, nodes);
    });

    it('agrees when groups nest, so a node belongs to both', () => {
        const groups = [
            group('outer', 0, 0, 900, 900),
            group('middle', 50, 50, 500, 500),
            group('inner', 100, 100, 200, 200),
        ];
        const nodes = [node('deep', 120, 120), node('mid', 300, 300), node('far', 600, 600)];

        expectSame(groups, nodes);
        expect(membership(groups, nodes).get('outer')).toEqual(['deep', 'mid', 'far']);
        expect(membership(groups, nodes).get('inner')).toEqual(['deep']);
    });

    it('agrees on far-flung groups that share no cell', () => {
        const groups = [group('a', 0, 0, 200, 200), group('b', 500_000, 500_000, 200, 200)];
        const nodes = [node('near', 10, 10), node('far', 500_010, 500_010)];
        expectSame(groups, nodes);
    });

    it('keeps every group present, including the empty ones', () => {
        const groups = [group('empty', 0, 0, 50, 50), group('full', 0, 0, 900, 900)];
        const members = membership(groups, [node('n', 100, 100)]);
        expect(members.get('empty')).toEqual([]);
        expect(members.get('full')).toEqual(['n']);
    });

    it('survives degenerate input', () => {
        expect(membership([], [node('n', 0, 0)]).size).toBe(0);
        expect([...membership([group('g', 0, 0, 10, 10)], []).values()]).toEqual([[]]);
        // A zero-sized group would divide the cell size to nothing.
        expect(membership([group('z', 0, 0, 0, 0)], [node('n', 0, 0)]).get('z')).toEqual([]);
    });
});
