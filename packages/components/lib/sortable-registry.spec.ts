import { describe, it, expect, beforeEach } from 'vitest';
import {
    registerSortable,
    peersInGroup,
    groupSize,
    clearRegistry,
    type SortableRegistryEntry,
    type AcceptResult,
} from './sortable-registry';

function makeEntry(listId: string, group: string): SortableRegistryEntry {
    return {
        listId,
        group,
        element: document.createElement('div'),
        orientation: 'vertical',
        getItemRects: (): DOMRect[] => [],
        canAccept: (): AcceptResult => true,
        onForeignEnter: (): void => undefined,
        onForeignLeave: (): void => undefined,
        receiveItem: (): void => undefined,
        removeItem: (): void => undefined,
    };
}

describe('sortable-registry', () => {
    beforeEach(() => {
        clearRegistry();
    });

    it('registers an entry and finds it under its group', () => {
        const entry = makeEntry('a', 'g1');
        registerSortable(entry);

        expect(groupSize('g1')).toBe(1);
        expect(peersInGroup('g1')).toEqual([entry]);
    });

    it('returns an empty array when the group has no entries', () => {
        expect(peersInGroup('unknown')).toEqual([]);
        expect(groupSize('unknown')).toBe(0);
    });

    it('lists multiple peers under the same group', () => {
        const a = makeEntry('a', 'g1');
        const b = makeEntry('b', 'g1');
        const c = makeEntry('c', 'g1');
        registerSortable(a);
        registerSortable(b);
        registerSortable(c);

        const peers = peersInGroup('g1');
        expect(peers).toHaveLength(3);
        expect(new Set(peers)).toEqual(new Set([a, b, c]));
    });

    it('excludes the requested entry from peersInGroup', () => {
        const a = makeEntry('a', 'g1');
        const b = makeEntry('b', 'g1');
        registerSortable(a);
        registerSortable(b);

        expect(peersInGroup('g1', a)).toEqual([b]);
        expect(peersInGroup('g1', b)).toEqual([a]);
    });

    it('keeps groups isolated from one another', () => {
        const a = makeEntry('a', 'g1');
        const b = makeEntry('b', 'g2');
        registerSortable(a);
        registerSortable(b);

        expect(peersInGroup('g1')).toEqual([a]);
        expect(peersInGroup('g2')).toEqual([b]);
    });

    it('removes an entry when its unsubscribe is called', () => {
        const a = makeEntry('a', 'g1');
        const b = makeEntry('b', 'g1');
        const unsubA = registerSortable(a);
        registerSortable(b);

        unsubA();

        expect(groupSize('g1')).toBe(1);
        expect(peersInGroup('g1')).toEqual([b]);
    });

    it('drops the group entirely when its last entry unsubscribes', () => {
        const a = makeEntry('a', 'g1');
        const unsub = registerSortable(a);

        unsub();

        expect(groupSize('g1')).toBe(0);
        expect(peersInGroup('g1')).toEqual([]);
    });

    it('unsubscribe is idempotent', () => {
        const a = makeEntry('a', 'g1');
        const b = makeEntry('b', 'g1');
        const unsubA = registerSortable(a);
        registerSortable(b);

        unsubA();
        unsubA();

        expect(groupSize('g1')).toBe(1);
        expect(peersInGroup('g1')).toEqual([b]);
    });

    it('re-registering an already-registered entry is a no-op (Set semantics)', () => {
        const a = makeEntry('a', 'g1');
        registerSortable(a);
        registerSortable(a);

        expect(groupSize('g1')).toBe(1);
    });

    it('clearRegistry() drops all entries across all groups', () => {
        registerSortable(makeEntry('a', 'g1'));
        registerSortable(makeEntry('b', 'g2'));

        clearRegistry();

        expect(groupSize('g1')).toBe(0);
        expect(groupSize('g2')).toBe(0);
    });

    it('preserves entry references — peers are the same objects that were registered', () => {
        const a = makeEntry('a', 'g1');
        registerSortable(a);

        const [first] = peersInGroup('g1');
        expect(first).toBe(a);
        first.onForeignEnter({ id: 1 }, 'someOther');
    });
});
