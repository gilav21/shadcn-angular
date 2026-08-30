// Filling nodes in from their type — and the one case where the type must NOT
// win: a node whose ports depend on its own state.
//
// A subgraph is why `portsFor` exists. Every node of that type owns a
// different inner graph, and the inner graph's boundary nodes ARE the outer
// ports, so copying `ports` off the definition onto every instance makes two
// subgraphs unable to disagree — which makes a subgraph the user built
// themselves impossible to express.
import { describe, it, expect } from 'vitest';
import { indexDefinitions, withMaterializedTypes } from './node-editor.materialize';
import type { NodePortDefinition, NodeTypeDefinition } from './node-editor.runtime.types';
import type { EditorNode } from './node-editor.types';

function node(id: string, type?: string): EditorNode {
    return { id, type, x: 0, y: 0, width: 180, height: 0 };
}

const STATIC: NodeTypeDefinition = {
    id: 'static',
    label: 'Static',
    accent: '#111111',
    ports: [{ id: 'in', direction: 'in', label: 'In' }],
};

describe('withMaterializedTypes', () => {
    it('copies ports, title and accent off the definition', () => {
        const [materialized] = withMaterializedTypes(
            [node('a', 'static')],
            indexDefinitions([STATIC]),
        );

        expect(materialized.ports).toEqual(STATIC.ports);
        expect(materialized.title).toBe('Static');
        expect(materialized.accent).toBe('#111111');
    });

    it('returns the SAME array when nothing changed', () => {
        const definitions = indexDefinitions([STATIC]);
        const first = withMaterializedTypes([node('a', 'static')], definitions);

        expect(withMaterializedTypes(first, definitions)).toBe(first);
    });

    it('leaves an untyped node alone', () => {
        const nodes = [node('a')];
        expect(withMaterializedTypes(nodes, indexDefinitions([STATIC]))).toBe(nodes);
    });

    describe('ports that come from the node, not the type', () => {
        // One array per state OBJECT, which is the contract `portsFor`
        // documents: the rendered list is compared by reference, so a fresh
        // array per call would re-mount every node on every pass.
        const portsByState = new WeakMap<object, readonly NodePortDefinition[]>();
        /** Typed, and one shared instance: the identity check below needs both. */
        const NO_PORTS: readonly NodePortDefinition[] = [];

        const DYNAMIC: NodeTypeDefinition = {
            id: 'dynamic',
            label: 'Dynamic',
            ports: [],
            portsFor: (state): readonly NodePortDefinition[] => {
                if (typeof state !== 'object' || state === null) return NO_PORTS;
                const cached = portsByState.get(state);
                if (cached) return cached;
                const ports: readonly NodePortDefinition[] = (
                    state as { ports: string[] }
                ).ports.map(id => ({ id, direction: 'in' as const, label: id }));
                portsByState.set(state, ports);
                return ports;
            },
        };

        const definitions = indexDefinitions([DYNAMIC]);

        it('asks the node for its ports rather than copying the definition', () => {
            const states = new Map<string, unknown>([['a', { ports: ['url', 'body'] }]]);

            const [materialized] = withMaterializedTypes(
                [node('a', 'dynamic')],
                definitions,
                id => states.get(String(id)),
            );

            expect(materialized.ports?.map(p => p.id)).toEqual(['url', 'body']);
        });

        it('gives two nodes of ONE type two different sets of ports', () => {
            const states = new Map<string, unknown>([
                ['a', { ports: ['url'] }],
                ['b', { ports: ['left', 'right'] }],
            ]);

            const [first, second] = withMaterializedTypes(
                [node('a', 'dynamic'), node('b', 'dynamic')],
                definitions,
                id => states.get(String(id)),
            );

            expect(first.ports?.map(p => p.id)).toEqual(['url']);
            expect(second.ports?.map(p => p.id)).toEqual(['left', 'right']);
        });

        it('falls back to the type when the node has no state yet', () => {
            const [materialized] = withMaterializedTypes(
                [node('a', 'dynamic')],
                definitions,
                () => undefined,
            );

            expect(materialized.ports).toEqual([]);
        });

        /*
         * The reason `portsFor` is documented as "must return the same array
         * for the same state". Without this the canvas re-mounts every node on
         * every change detection pass, which is the one thing the engine
         * exists to avoid — and nothing else in the suite would notice.
         */
        it('does not churn the node array while the state is unchanged', () => {
            const states = new Map<string, unknown>([['a', { ports: ['url'] }]]);
            const stateOf = (id: unknown): unknown => states.get(String(id));

            const first = withMaterializedTypes([node('a', 'dynamic')], definitions, stateOf);

            expect(withMaterializedTypes(first, definitions, stateOf)).toBe(first);
        });

        it('grows a port when the state gains one', () => {
            const states = new Map<string, unknown>([['a', { ports: ['url'] }]]);
            const stateOf = (id: unknown): unknown => states.get(String(id));

            const first = withMaterializedTypes([node('a', 'dynamic')], definitions, stateOf);
            states.set('a', { ports: ['url', 'method'] });
            const second = withMaterializedTypes(first, definitions, stateOf);

            expect(second).not.toBe(first);
            expect(second[0].ports?.map(p => p.id)).toEqual(['url', 'method']);
        });
    });
});

/*
 * "The definition stays the single source of truth: nothing here lets a node
 * disagree with its type. A node that already carries a field keeps it, so a
 * one-off title override is still possible without forking a type."
 *
 * That second sentence had no test at all: making the definition's label
 * overwrite an authored title left all 834 specs in this folder green, so the
 * only documented way to name one node differently from its type could have
 * been deleted without anything noticing.
 */
describe('an authored field survives its type', () => {
    it('keeps a title the node carries rather than taking the label', () => {
        const [materialized] = withMaterializedTypes(
            [{ ...node('a', 'static'), title: 'Customers' }],
            indexDefinitions([STATIC]),
        );
        expect(materialized.title).toBe('Customers');
    });

    it('keeps an accent the node carries rather than taking the type colour', () => {
        const [materialized] = withMaterializedTypes(
            [{ ...node('a', 'static'), accent: '#ff00ff' }],
            indexDefinitions([STATIC]),
        );
        expect(materialized.accent).toBe('#ff00ff');
    });

    it('falls back to the label for an empty title, which is not an override', () => {
        const [materialized] = withMaterializedTypes(
            [{ ...node('a', 'static'), title: '' }],
            indexDefinitions([STATIC]),
        );
        expect(materialized.title).toBe('Static');
    });

    it('leaves an authored node alone entirely, allocating nothing', () => {
        const authored = { ...node('a', 'static'), title: 'Customers', accent: '#ff00ff' };
        const definitions = indexDefinitions([STATIC]);
        const [first] = withMaterializedTypes([authored], definitions);
        const [second] = withMaterializedTypes([first], definitions);
        expect(second).toBe(first);
    });
});

/*
 * The regression gate for the materialisation cache.
 *
 * An authored node carries no ports, so materialising one always allocates —
 * every node, every pass. During a drag that is the whole list rebuilt to
 * relocate one card. The result depends only on the node object and its
 * definition, so it is remembered per node.
 *
 * Identity, not timings. The `portsFor` case is the one that must NOT be
 * cached, since its ports are a function of state rather than of the node.
 */
describe('materialisation is remembered per node', () => {
    it('returns the identical objects when handed the same nodes again', () => {
        const definitions = indexDefinitions([STATIC]);
        const nodes = [node('a', 'static'), node('b', 'static')];

        const first = withMaterializedTypes(nodes, definitions);
        const second = withMaterializedTypes(nodes, definitions);

        expect(second[0]).toBe(first[0]);
        expect(second[1]).toBe(first[1]);
    });

    it('keeps the nodes that follow a materialised one', () => {
        /*
         * The node needing work FIRST — the order nothing covered.
         *
         * The result array is allocated from the first divergence, so before
         * that point an unchanged node is simply not written, and with the
         * settled nodes at the front the copy never starts and dropping that
         * write is invisible. Reversed, every node after the first changed
         * one disappears from the graph.
         */
        const definitions = indexDefinitions([STATIC]);
        const settled = withMaterializedTypes([node('kept', 'static')], definitions)[0];

        const next = withMaterializedTypes([node('fresh', 'static'), settled], definitions);

        expect(next).toHaveLength(2);
        expect(next[1]).toBe(settled);
    });

    it('allocates only for the node that a drag replaced', () => {
        const definitions = indexDefinitions([STATIC]);
        const nodes = [node('a', 'static'), node('b', 'static'), node('c', 'static')];
        const first = withMaterializedTypes(nodes, definitions);

        const dragged = nodes.map(n => (n.id === 'b' ? { ...n, x: n.x + 40 } : n));
        const second = withMaterializedTypes(dragged, definitions);

        expect(second[0]).toBe(first[0]);
        expect(second[2]).toBe(first[2]);
        expect(second[1]).not.toBe(first[1]);
        expect(second[1].x).toBe(40);
    });

    it('does not let one definition table answer for another', () => {
        const nodes = [node('a', 'static')];
        const other: NodeTypeDefinition = { ...STATIC, label: 'Renamed' };

        expect(withMaterializedTypes(nodes, indexDefinitions([STATIC]))[0].title).toBe('Static');
        expect(withMaterializedTypes(nodes, indexDefinitions([other]))[0].title).toBe('Renamed');
    });
});
