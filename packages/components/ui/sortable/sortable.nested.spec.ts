import { Component, signal, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    SortableComponent,
    SortableItemTemplateDirective,
} from './sortable.component';
import { SortableItemComponent } from './sub/sortable-item.component';
import type { SortableLocation, SortableReorderEvent } from './sortable.types';
import { clearRegistry, entryDepth, type SortableRegistryEntry } from '../../lib/sortable-registry';

/**
 * Feature specs for nested sortable lists (T-14). `sortable.component.spec.ts`
 * and `sortable.component.browser.spec.ts` are the untouched
 * backward-compatibility gate.
 */

interface Node { id: string; children: Node[] }

/**
 * An outline: a root list whose every item renders its own child list in the
 * same group, so an item can be dragged from the root into a child (or the
 * other way) exactly as a tree UI needs.
 */
@Component({
    imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
    template: `
        <ui-sortable
            [(items)]="roots"
            group="outline"
            listId="root"
            [landEffect]="landEffect()"
            (reorder)="events.push($event)"
        >
            <ng-template uiSortableItem let-node let-i="index">
                <ui-sortable-item [index]="i">
                    <span class="label">{{ $any(node).id }}</span>
                    <ui-sortable
                        [items]="$any(node).children"
                        group="outline"
                        [listId]="'child-' + $any(node).id"
                        (reorder)="events.push($event)"
                    >
                        <ng-template uiSortableItem let-child let-j="index">
                            <ui-sortable-item [index]="j">
                                <span class="label">{{ $any(child).id }}</span>
                            </ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                </ui-sortable-item>
            </ng-template>
        </ui-sortable>
    `,
})
class OutlineHostComponent {
    readonly roots = signal<Node[]>([
        { id: 'a', children: [{ id: 'a1', children: [] }] },
        { id: 'b', children: [{ id: 'b1', children: [] }] },
        { id: 'c', children: [{ id: 'c1', children: [] }] },
    ]);
    readonly events: SortableReorderEvent<unknown>[] = [];
    readonly landEffect = signal<(item: unknown, from: SortableLocation, to: SortableLocation) => string | null>(() => null);
    readonly sortables = viewChildren(SortableComponent);
}

describe('sortable-registry — entryDepth', () => {
    function entry(path?: readonly string[]): SortableRegistryEntry {
        return { listId: 'x', group: 'g', path } as unknown as SortableRegistryEntry;
    }

    it('treats an entry with no path as top level', () => {
        expect(entryDepth(entry())).toBe(1);
    });

    it('reports the path length as the depth', () => {
        expect(entryDepth(entry(['root']))).toBe(1);
        expect(entryDepth(entry(['root', 'child']))).toBe(2);
        expect(entryDepth(entry(['root', 'child', 'grandchild']))).toBe(3);
    });
});

describe('SortableComponent — nested lists', () => {
    let fixture: ComponentFixture<OutlineHostComponent>;
    let host: OutlineHostComponent;

    beforeEach(async () => {
        clearRegistry();
        await TestBed.configureTestingModule({ imports: [OutlineHostComponent] }).compileComponents();
        fixture = TestBed.createComponent(OutlineHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        TestBed.resetTestingModule();
        clearRegistry();
    });

    function sortableFor(listId: string): SortableComponent<unknown> {
        const found = host.sortables().find(s => s.resolvedListId() === listId);
        if (!found) throw new Error(`no sortable with listId ${listId}`);
        return found as SortableComponent<unknown>;
    }

    it('gives a top-level list a single-element path', () => {
        expect(sortableFor('root').path()).toEqual(['root']);
        expect(sortableFor('root').depth()).toBe(1);
    });

    it('gives a nested list its full ancestry, outermost first', () => {
        expect(sortableFor('child-a').path()).toEqual(['root', 'child-a']);
        expect(sortableFor('child-a').depth()).toBe(2);
    });

    it('resolves the parent through the injector, so every child of the same root shares its prefix', () => {
        for (const id of ['child-a', 'child-b']) {
            expect(sortableFor(id).path()[0]).toBe('root');
        }
    });

    it('reports the path on both endpoints of a same-list reorder', () => {
        host.events.length = 0;
        const root = sortableFor('root');
        root['applyReorder'](0, 1, { clearDrag: false, emit: true });
        fixture.detectChanges();

        const event = host.events.at(-1);
        expect(event?.from).toMatchObject({ listId: 'root', index: 0, path: ['root'] });
        expect(event?.to).toMatchObject({ listId: 'root', index: 1, path: ['root'] });
    });

    it('reports the nested list own path when the reorder happens inside a child', () => {
        host.events.length = 0;
        const child = sortableFor('child-a');
        child['applyReorder'](0, 0, { clearDrag: false, emit: true });
        child.items.set(['x', 'y'] as unknown as never[]);
        fixture.detectChanges();
        child['applyReorder'](0, 1, { clearDrag: false, emit: true });

        const event = host.events.at(-1);
        expect(event?.from.path).toEqual(['root', 'child-a']);
        expect(event?.to.path).toEqual(['root', 'child-a']);
    });

    it('reports the path on the KEYBOARD cross-list hand-off, not just the pointer one', () => {
        host.events.length = 0;
        const root = sortableFor('root');

        // Row 1 hosts no child list, so child-b is a legal keyboard target.
        root['_liftedIndex'].set(1);
        root['keyboardCrossList'](1, 1);
        fixture.detectChanges();

        const event = host.events.at(-1);
        expect(event?.from.path).toEqual(['root']);
        expect(event?.to.path).toBeDefined();
        expect(event?.to.path?.[0]).toBe('root');
    });

    it('reports the path on landEffect endpoints as well', () => {
        const root = sortableFor('root');
        const seen: { from: readonly string[] | undefined; to: readonly string[] | undefined }[] = [];

        // landEffect receives two SortableLocations; both must carry the path.
        host.landEffect.set((_item, from, to) => {
            seen.push({ from: from.path, to: to.path });
            return null;
        });
        fixture.detectChanges();

        root['scheduleLandEffect'](0, 1, root.items()[0]);

        expect(seen).toEqual([{ from: ['root'], to: ['root'] }]);
    });

    it('reports the full path of BOTH lists when an item crosses into a nested list', () => {
        host.events.length = 0;
        const root = sortableFor('root');
        const child = sortableFor('child-a');

        root.startDrag(1, 0, 0);
        root['_hoverPeer'].set(child['registryEntry']);
        root['_hoverPeerTarget'].set(0);
        root['onDragEnd']();
        fixture.detectChanges();

        const event = host.events.at(-1);
        expect(event?.from).toMatchObject({ listId: 'root', index: 1, path: ['root'] });
        expect(event?.to).toMatchObject({ listId: 'child-a', index: 0, path: ['root', 'child-a'] });
    });

    it('picks the innermost list when nested rects overlap under the pointer', () => {
        const root = sortableFor('root');
        const child = sortableFor('child-a');

        const rootRect = { left: 0, right: 400, top: 0, bottom: 400 } as DOMRect;
        const childRect = { left: 50, right: 200, top: 50, bottom: 200 } as DOMRect;
        root['registryEntry'].element.getBoundingClientRect = (): DOMRect => rootRect;
        child['registryEntry'].element.getBoundingClientRect = (): DOMRect => childRect;

        const peerInsideChild = root['findHoverPeer'](100, 100);
        expect(peerInsideChild?.listId).toBe('child-a');
    });

    it('falls back to the outer list when the pointer is outside every inner rect', () => {
        const root = sortableFor('root');
        const child = sortableFor('child-a');
        const childB = sortableFor('child-b');

        child['registryEntry'].element.getBoundingClientRect = (): DOMRect =>
            ({ left: 50, right: 200, top: 50, bottom: 200 } as DOMRect);
        childB['registryEntry'].element.getBoundingClientRect = (): DOMRect =>
            ({ left: 50, right: 200, top: 250, bottom: 300 } as DOMRect);
        root['registryEntry'].element.getBoundingClientRect = (): DOMRect =>
            ({ left: 0, right: 400, top: 0, bottom: 400 } as DOMRect);

        const peer = child['findHoverPeer'](350, 350);
        expect(peer?.listId).toBe('root');
    });

    it('refuses to drop an item into a list nested inside that very item', () => {
        // The cycle case: an outline row hosts its own child list, so the
        // pointer sitting over that child makes it the DEEPEST hit. Dropping
        // there would remove the item from its parent and re-insert it into a
        // list it itself owns, detaching its own subtree from the tree.
        //
        // Driven through the real `startDrag` rather than by hand-setting
        // `_dragSource`: the dragged element is captured there, and the whole
        // class of bug this guards against lives in how that element is
        // resolved.
        const root = sortableFor('root');
        const ownChild = sortableFor('child-a');
        const otherChild = sortableFor('child-b');

        const wide = { left: 0, right: 400, top: 0, bottom: 400 } as DOMRect;
        root['registryEntry'].element.getBoundingClientRect = (): DOMRect => wide;
        ownChild['registryEntry'].element.getBoundingClientRect = (): DOMRect => wide;
        otherChild['registryEntry'].element.getBoundingClientRect = (): DOMRect => wide;

        // Row 0 hosts child-a; row 1 hosts child-b.
        root.startDrag(0, 0, 0);
        const hit = root['findHoverPeer'](10, 10);
        expect(hit?.listId).not.toBe('child-a');
        root['onDragEnd']();

        // Dragging row 1 instead, child-a is a perfectly good target again.
        root.startDrag(1, 0, 0);
        expect(root['findHoverPeer'](10, 10)?.listId).toBe('child-a');
        root['onDragEnd']();
    });

    it('counts only its OWN items, excluding nested lists and the ghost', () => {
        // The unscoped query returned 7 elements for 3 items on this very
        // fixture — every nested child plus the ghost — so every index derived
        // from it was off.
        const root = sortableFor('root');
        expect(root['collectItemElements']()).toHaveLength(3);
        expect(sortableFor('child-a')['collectItemElements']()).toHaveLength(1);

        root.startDrag(0, 0, 0);
        fixture.detectChanges();
        expect(root['collectItemElements']()).toHaveLength(3);
        root['onDragEnd']();
    });

    it('guards the cycle for EVERY row, not just row 0', () => {
        // Row 2 is where the old off-by-N hid: `collectItemElements()[2]`
        // resolved to the wrong element, `contains()` returned false, and the
        // item's own child list won the hit test.
        //
        // Asserting element IDENTITY, not just the hit result: with the
        // unscoped query the hit test still happened to avoid the named list
        // for the wrong reason, so only identity pins the bug down.
        const root = sortableFor('root');
        const wide = { left: 0, right: 400, top: 0, bottom: 400 } as DOMRect;
        for (const id of ['root', 'child-a', 'child-b', 'child-c']) {
            sortableFor(id)['registryEntry'].element.getBoundingClientRect = (): DOMRect => wide;
        }

        for (const [row, ownList] of [[0, 'child-a'], [1, 'child-b'], [2, 'child-c']] as const) {
            root.startDrag(row, 0, 0);

            const draggedEl = root['draggedItemElement']();
            const ownListEl = sortableFor(ownList)['registryEntry'].element;
            expect(draggedEl).not.toBeNull();
            expect(draggedEl?.contains(ownListEl)).toBe(true);
            expect(root['findHoverPeer'](10, 10)?.listId).not.toBe(ownList);

            root['onDragEnd']();
        }
    });

    it('skips a self-owned list on the keyboard hand-off too', () => {
        const root = sortableFor('root');
        const ownChild = sortableFor('child-a');

        // Row 0 is the one that HOSTS child-a.
        root['_liftedIndex'].set(0);
        root['keyboardCrossList'](0, 1);
        fixture.detectChanges();

        // It must not have landed in the list it owns. The guard SKIPS rather
        // than blocks, so it does land in the next eligible peer — what matters
        // is that the eligible peer is never its own child.
        expect(ownChild.items().map((c: unknown) => (c as Node).id)).toEqual(['a1']);
    });

    it('keeps depth ordering stable regardless of registration order', () => {
        const root = sortableFor('root');
        const child = sortableFor('child-a');
        const wide = { left: 0, right: 400, top: 0, bottom: 400 } as DOMRect;

        root['registryEntry'].element.getBoundingClientRect = (): DOMRect => wide;
        child['registryEntry'].element.getBoundingClientRect = (): DOMRect => wide;

        expect(root['findHoverPeer'](10, 10)?.listId).toBe('child-a');
        expect(child['findHoverPeer'](10, 10)?.listId).toBe('root');
    });
});

describe('SortableComponent — nesting deeper than three levels', () => {
    @Component({
        imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
        template: `
            <ui-sortable [(items)]="l1" group="deep" listId="L1">
                <ng-template uiSortableItem let-a let-i="index">
                    <ui-sortable-item [index]="i">
                        <ui-sortable [(items)]="l2" group="deep" listId="L2">
                            <ng-template uiSortableItem let-b let-j="index">
                                <ui-sortable-item [index]="j">
                                    <ui-sortable [(items)]="l3" group="deep" listId="L3">
                                        <ng-template uiSortableItem let-c let-k="index">
                                            <ui-sortable-item [index]="k">
                                                <ui-sortable [(items)]="l4" group="deep" listId="L4">
                                                    <ng-template uiSortableItem let-d let-m="index">
                                                        <ui-sortable-item [index]="m">{{ d }}</ui-sortable-item>
                                                    </ng-template>
                                                </ui-sortable>
                                            </ui-sortable-item>
                                        </ng-template>
                                    </ui-sortable>
                                </ui-sortable-item>
                            </ng-template>
                        </ui-sortable>
                    </ui-sortable-item>
                </ng-template>
            </ui-sortable>
        `,
    })
    class DeepHostComponent {
        readonly l1 = signal(['one']);
        readonly l2 = signal(['two']);
        readonly l3 = signal(['three']);
        readonly l4 = signal(['four']);
        readonly sortables = viewChildren(SortableComponent);
    }

    afterEach(() => {
        TestBed.resetTestingModule();
        clearRegistry();
    });

    it('builds a correct path four levels down', () => {
        clearRegistry();
        TestBed.configureTestingModule({ imports: [DeepHostComponent] });
        const fixture = TestBed.createComponent(DeepHostComponent);
        fixture.detectChanges();

        const paths = fixture.componentInstance.sortables().map(s => s.path());
        expect(paths).toContainEqual(['L1']);
        expect(paths).toContainEqual(['L1', 'L2']);
        expect(paths).toContainEqual(['L1', 'L2', 'L3']);
        expect(paths).toContainEqual(['L1', 'L2', 'L3', 'L4']);
    });
});
