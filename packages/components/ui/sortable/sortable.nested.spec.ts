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
        { id: 'c', children: [{ id: 'c1', children: [] }, { id: 'c2', children: [] }] },
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

    /** Pins a list's container rect so the hit test is deterministic in any runner. */
    function stubListRect(listId: string, rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>): void {
        const hostEl = fixture.debugElement
            .queryAll(d => d.componentInstance instanceof SortableComponent)
            .find(d => (d.componentInstance as SortableComponent<unknown>).resolvedListId() === listId)!
            .nativeElement as HTMLElement;
        const container = hostEl.querySelector<HTMLElement>('[data-slot="sortable"]')!;
        container.getBoundingClientRect = (): DOMRect => rect as DOMRect;
    }

    function key(k: string): KeyboardEvent {
        return new KeyboardEvent('keydown', { key: k });
    }

    it('reports the nested list own path when the reorder happens inside a child', () => {
        host.events.length = 0;
        const child = sortableFor('child-c');
        child.handleItemKeyDown(0, key(' '));
        child.handleItemKeyDown(0, key('ArrowDown'));

        expect(host.events).toHaveLength(1);
        expect(host.events[0].from).toMatchObject({ listId: 'child-c', index: 0, path: ['root', 'child-c'] });
        expect(host.events[0].to).toMatchObject({ listId: 'child-c', index: 1, path: ['root', 'child-c'] });
    });

    it('reports the path on the KEYBOARD cross-list hand-off, not just the pointer one', () => {
        host.events.length = 0;
        const root = sortableFor('root');

        // Row 1 hosts child-b, which the hand-off skips; any other list is a legal target.
        root.handleItemKeyDown(1, key(' '));
        root.handleItemKeyDown(1, key('Tab'));
        fixture.detectChanges();

        const event = host.events.at(-1);
        expect(event?.from).toMatchObject({ listId: 'root', index: 1, path: ['root'] });
        expect(event?.to.listId).toMatch(/^child-[ac]$/);
        expect(event?.to.path).toEqual(['root', event?.to.listId]);
    });

    it('reports the path on landEffect endpoints as well', () => {
        const root = sortableFor('root');
        const seen: { from: readonly string[] | undefined; to: readonly string[] | undefined }[] = [];

        host.landEffect.set((_item, from, to) => {
            seen.push({ from: from.path, to: to.path });
            return null;
        });
        fixture.detectChanges();

        root.handleItemKeyDown(0, key(' '));
        root.handleItemKeyDown(0, key('ArrowDown'));

        expect(seen).toEqual([{ from: ['root'], to: ['root'] }]);
    });

    it('reports the full path of BOTH lists when an item crosses into a nested list', () => {
        host.events.length = 0;
        const root = sortableFor('root');
        // Far above the real layout, so only the stubbed child-a contains the pointer.
        stubListRect('child-a', { left: 4900, right: 5100, top: -5100, bottom: -4900 });

        root.startDrag(1, 0, 0);
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5000, clientY: -5000 }));
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5000, clientY: -5000 }));
        fixture.detectChanges();

        const event = host.events.at(-1);
        expect(event?.from).toMatchObject({ listId: 'root', index: 1, path: ['root'] });
        expect(event?.to).toMatchObject({ listId: 'child-a', index: 0, path: ['root', 'child-a'] });
    });

    it('picks the innermost list when nested rects overlap under the pointer', () => {
        const source = sortableFor('child-c');
        stubListRect('root', { left: 0, right: 400, top: 0, bottom: 400 });
        stubListRect('child-a', { left: 50, right: 200, top: 50, bottom: 200 });
        stubListRect('child-b', { left: 50, right: 200, top: 250, bottom: 300 });

        // Both root and child-a contain the pointer; the nested one must win.
        source.startDrag(0, 0, 0);
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }));
        expect(source.hoverPeer()?.listId).toBe('child-a');
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 100 }));
    });

    it('falls back to the outer list when the pointer is outside every inner rect', () => {
        const child = sortableFor('child-a');
        stubListRect('root', { left: 0, right: 400, top: 0, bottom: 400 });
        stubListRect('child-a', { left: 50, right: 200, top: 50, bottom: 200 });
        stubListRect('child-b', { left: 50, right: 200, top: 250, bottom: 300 });
        stubListRect('child-c', { left: 50, right: 200, top: 310, bottom: 340 });

        child.startDrag(0, 0, 0);
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 350 }));
        expect(child.hoverPeer()?.listId).toBe('root');
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, clientY: 350 }));
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
        // The cycle: dropping a row into the child list it hosts would detach
        // its own subtree from the tree.
        //
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

        // The guard does not over-block: a row that does not own child-a can still drop into it.
        root.startDrag(1, 0, 0);
        expect(root['findHoverPeer'](10, 10)?.listId).toBe('child-a');
        root['onDragEnd']();
    });

    it('skips a self-owned list on the keyboard hand-off too', () => {
        const root = sortableFor('root');
        const ownChild = sortableFor('child-a');

        // Row 0 is the one that HOSTS child-a.
        root.handleItemKeyDown(0, key(' '));
        root.handleItemKeyDown(0, key('Tab'));
        fixture.detectChanges();

        // It must not have landed in the list it owns. The guard SKIPS rather
        // than blocks, so it does land in the next eligible peer — what matters
        // is that the eligible peer is never its own child.
        expect(ownChild.items().map((c: unknown) => (c as Node).id)).toEqual(['a1']);
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
        const depthOf = (id: string): number | undefined =>
            fixture.componentInstance.sortables().find(s => s.resolvedListId() === id)?.depth();
        expect(depthOf('L1')).toBe(1);
        expect(depthOf('L4')).toBe(4);
    });
});
