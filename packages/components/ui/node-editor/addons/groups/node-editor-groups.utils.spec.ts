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
import type { EditorNode } from '../..';

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
