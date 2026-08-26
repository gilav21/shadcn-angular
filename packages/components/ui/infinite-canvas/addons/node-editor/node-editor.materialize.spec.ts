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
