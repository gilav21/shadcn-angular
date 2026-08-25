// Navigating a nest of graphs — `specs/node-editor-addons-spec.md` §7, task G3.
import { describe, it, expect } from 'vitest';
import { SubgraphNavigator } from './node-editor-subgraph.navigator';
import type { SubgraphGraph } from './node-editor-subgraph.types';
import type { EditorNode } from '../..';

function graph(id: string): SubgraphGraph {
    return {
        nodes: [{ id, x: 0, y: 0, width: 180, height: 0 } as EditorNode],
        connections: [],
    };
}

describe('SubgraphNavigator', () => {
    it('starts at the root', () => {
        const nav = new SubgraphNavigator(graph('root'));
        expect(nav.depth()).toBe(0);
        expect(nav.current().nodeId).toBeNull();
        expect(nav.canLeave()).toBe(false);
    });

    it('names the root, so the breadcrumb has something to say', () => {
        expect(new SubgraphNavigator(graph('root'), 'Pipeline').path()[0].label).toBe('Pipeline');
    });

    describe('descending', () => {
        it('shows the graph it was handed', () => {
            const nav = new SubgraphNavigator(graph('root'));
            nav.enter('sub', 'Doubler', graph('inner'));

            expect(nav.depth()).toBe(1);
            expect(nav.current().graph.nodes[0].id).toBe('inner');
        });

        it('remembers the way back', () => {
            const nav = new SubgraphNavigator(graph('root'));
            nav.enter('sub', 'Doubler', graph('inner'));
            expect(nav.canLeave()).toBe(true);
        });

        it('builds a path root-first, in reading order', () => {
            const nav = new SubgraphNavigator(graph('root'), 'Main');
            nav.enter('a', 'Outer', graph('a'));
            nav.enter('b', 'Inner', graph('b'));

            expect(nav.path().map(f => f.label)).toEqual(['Main', 'Outer', 'Inner']);
        });

        it('nests as deep as asked', () => {
            const nav = new SubgraphNavigator(graph('root'));
            for (let i = 0; i < 5; i++) nav.enter(`n${i}`, `L${i}`, graph(`g${i}`));
            expect(nav.depth()).toBe(5);
        });
    });

    describe('coming back up', () => {
        /**
         * The caller writes the returned graph into the parent node's state.
         * The navigator does not, because it has no editor and no runtime —
         * and one that reached for either would stop being testable alone.
         */
        it('hands back the graph that was being edited', () => {
            const nav = new SubgraphNavigator(graph('root'));
            nav.enter('sub', 'Doubler', graph('inner'));

            const left = nav.leave();
            expect(left?.nodeId).toBe('sub');
            expect(left?.graph.nodes[0].id).toBe('inner');
            expect(nav.depth()).toBe(0);
        });

        it('refuses to leave the root, rather than emptying the stack', () => {
            const nav = new SubgraphNavigator(graph('root'));
            expect(nav.leave()).toBeNull();
            expect(nav.depth()).toBe(0);
        });

        it('jumps straight to a breadcrumb level', () => {
            const nav = new SubgraphNavigator(graph('root'), 'Main');
            nav.enter('a', 'Outer', graph('a'));
            nav.enter('b', 'Inner', graph('b'));

            nav.leaveTo(0);
            expect(nav.path().map(f => f.label)).toEqual(['Main']);
        });

        it('ignores a jump to where it already is', () => {
            const nav = new SubgraphNavigator(graph('root'));
            nav.enter('a', 'Outer', graph('a'));
            nav.leaveTo(1);
            expect(nav.depth()).toBe(1);
        });

        it('ignores an out-of-range jump rather than throwing', () => {
            const nav = new SubgraphNavigator(graph('root'));
            nav.enter('a', 'Outer', graph('a'));
            nav.leaveTo(-1);
            nav.leaveTo(99);
            expect(nav.depth()).toBe(1);
        });
    });

    describe('edits made while inside', () => {
        /**
         * The editor owns the nodes while they are on screen. Without this,
         * leaving a subgraph would carry the graph as it was on the way IN and
         * silently discard everything done inside it.
         */
        it('carries edits back up rather than discarding them', () => {
            const nav = new SubgraphNavigator(graph('root'));
            nav.enter('sub', 'Doubler', graph('inner'));

            nav.update({ nodes: [{ id: 'added', x: 0, y: 0, width: 1, height: 1 }], connections: [] });
            expect(nav.leave()?.graph.nodes[0].id).toBe('added');
        });

        it('updates only the level being shown', () => {
            const nav = new SubgraphNavigator(graph('root'));
            nav.enter('sub', 'Doubler', graph('inner'));
            nav.update({ nodes: [], connections: [] });

            expect(nav.path()[0].graph.nodes[0].id).toBe('root');
        });

        it('keeps the frame’s identity, so the breadcrumb does not flicker', () => {
            const nav = new SubgraphNavigator(graph('root'));
            nav.enter('sub', 'Doubler', graph('inner'));
            nav.update({ nodes: [], connections: [] });

            expect(nav.current().nodeId).toBe('sub');
            expect(nav.current().label).toBe('Doubler');
        });
    });

    /**
     * `providedIn: 'root'` would give the whole application one stack, and two
     * editors on a page would push each other's frames.
     */
    it('keeps two navigators completely separate', () => {
        const first = new SubgraphNavigator(graph('a'));
        const second = new SubgraphNavigator(graph('b'));
        first.enter('sub', 'Doubler', graph('inner'));

        expect(first.depth()).toBe(1);
        expect(second.depth()).toBe(0);
    });
});
