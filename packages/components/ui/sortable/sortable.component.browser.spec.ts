import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
} from './sortable.component';

interface TestRow {
    id: number;
    name: string;
}

/**
 * Browser-only sortable cases. These assert FLIP snap-back animation on a
 * *no-op* pointer drop, which requires the browser's real layout: the source
 * carries a CSS `transform: translate(...)` during the drag, and FLIP detects
 * the position change only because getBoundingClientRect() reflects that
 * transform. jsdom performs no layout, so a deterministic-rect stub cannot
 * reproduce it — this scenario is exercised in the real-browser leg instead.
 */
@Component({
    selector: 'app-browser-host',
    standalone: true,
    imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
    template: `
        <ui-sortable [(items)]="rows">
            <ng-template uiSortableItem let-row let-i="index">
                <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
            </ng-template>
        </ui-sortable>
    `,
})
class BrowserHost {
    readonly rows = signal<TestRow[]>([
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
        { id: 3, name: 'Gamma' },
    ]);
}

interface OutlineRow {
    id: string;
    name: string;
    children: TestRow[];
}

/**
 * A real nested outline with real layout. Every row hosts its own child list in
 * the same group, so the child's rect lies inside the parent's — the geometry
 * that makes the self-subtree drop possible in the first place.
 */
@Component({
    selector: 'app-nested-browser-host',
    standalone: true,
    imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective],
    template: `
        <ui-sortable
            [(items)]="roots"
            group="browser-outline"
            listId="root"
            (reorder)="reorders.push($event)"
        >
            <ng-template uiSortableItem let-node let-i="index">
                <ui-sortable-item [index]="i" style="display:block; width:260px;">
                    <span class="row-label" style="display:block; height:28px;">{{ $any(node).name }}</span>
                    <ui-sortable
                        style="display:block; min-height:32px; margin-inline-start:16px;"
                        [items]="$any(node).children"
                        group="browser-outline"
                        [listId]="'child-' + $any(node).id"
                    >
                        <ng-template uiSortableItem let-child let-j="index">
                            <ui-sortable-item [index]="j" style="display:block; height:24px;">{{ $any(child).name }}</ui-sortable-item>
                        </ng-template>
                    </ui-sortable>
                </ui-sortable-item>
            </ng-template>
        </ui-sortable>
    `,
})
class NestedBrowserHost {
    readonly roots = signal<OutlineRow[]>([
        { id: 'a', name: 'Discovery', children: [{ id: 11, name: 'Interviews' }] },
        { id: 'b', name: 'Design', children: [{ id: 21, name: 'Wireframes' }] },
        { id: 'c', name: 'Build', children: [{ id: 31, name: 'Scaffold' }] },
    ]);
    readonly reorders: unknown[] = [];
}

describe('SortableComponent (browser-only)', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [BrowserHost] }).compileComponents();
    });

    it('animates the source back to its origin on a no-op pointer drop (no net target change)', async () => {
        const f = TestBed.createComponent(BrowserHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        const sourceRect = items[0].getBoundingClientRect();
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');

        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: sourceRect.top + 5, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: sourceRect.top + 9 }));
        f.detectChanges();
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: sourceRect.top + 9 }));
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 30));
        f.detectChanges();

        expect(animateSpy).toHaveBeenCalled();
        animateSpy.mockRestore();
        document.body.removeChild(f.nativeElement);
    });
});

describe('SortableComponent nesting (browser-only, real pointer)', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [NestedBrowserHost] }).compileComponents();
    });

    /**
     * Driven end-to-end through mousedown -> mousemove -> mouseup against real
     * layout, with nothing stubbed. Two defects hid behind stubbed rects and
     * hand-set drag state — an unscoped item query that counted nested rows and
     * the ghost, and a cycle guard that therefore resolved the wrong element —
     * and a single real drag catches both.
     */
    it('does not swallow a row into its own child list on a real pointer drag', async () => {
        const f = TestBed.createComponent(NestedBrowserHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const host = f.componentInstance;
        const lastRow = host.roots()[2];
        const ownChildBefore = lastRow.children.length;

        const rootEl: HTMLElement = f.nativeElement.querySelector('[data-slot="sortable"]');
        const rootItems: HTMLElement[] = Array.from(
            rootEl.querySelectorAll<HTMLElement>('[data-slot="sortable-item"]')
        ).filter(el => el.closest('[data-slot="sortable"]') === rootEl);
        expect(rootItems).toHaveLength(3);

        // Drag the LAST row and release over its own child list.
        const dragged = rootItems[2];
        const ownChildList: HTMLElement = dragged.querySelector('[data-slot="sortable"]')!;
        const from = dragged.getBoundingClientRect();
        const onto = ownChildList.getBoundingClientRect();

        dragged.dispatchEvent(new MouseEvent('mousedown', {
            clientX: from.left + 5, clientY: from.top + 5, bubbles: true,
        }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', {
            clientX: onto.left + onto.width / 2, clientY: onto.top + onto.height / 2,
        }));
        f.detectChanges();
        globalThis.dispatchEvent(new MouseEvent('mouseup', {
            clientX: onto.left + onto.width / 2, clientY: onto.top + onto.height / 2,
        }));
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 30));
        f.detectChanges();

        // The row is still in the root list, and its own child list did not
        // gain it — no subtree detached itself from the tree.
        expect(host.roots()).toHaveLength(3);
        expect(host.roots().map(r => r.id).sort((x, y) => x.localeCompare(y))).toEqual(['a', 'b', 'c']);
        expect(lastRow.children).toHaveLength(ownChildBefore);
        document.body.removeChild(f.nativeElement);
    });
});
