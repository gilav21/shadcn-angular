import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
    SortableHandleDirective,
    SORTABLE_LAND_EFFECTS,
    type SortableReorderEvent,
    type SortableDropRejectedEvent,
} from './sortable.component';
import { SortableGhostTemplateDirective } from './sub/sortable-ghost.directive';
import { SortablePlaceholderTemplateDirective } from './sub/sortable-placeholder.directive';
import { peersInGroup, groupSize, clearRegistry, type SortableRegistryEntry } from '../../lib/sortable-registry';
import { NgTemplateOutlet } from '@angular/common';

interface TestRow {
    id: number;
    name: string;
}

@Component({
    selector: 'app-test-host',
    standalone: true,
    imports: [
        SortableComponent,
        SortableItemComponent,
        SortableItemTemplateDirective,
        SortableHandleDirective,
        NgTemplateOutlet,
    ],
    template: `
        <ui-sortable
            [(items)]="rows"
            [orientation]="orientation()"
            [handleOnly]="handleOnly()"
            [disabled]="disabled()"
            [class]="extraClass()"
            (reorder)="lastReorder = $event"
        >
            <ng-template uiSortableItem let-row let-i="index">
                <ui-sortable-item [index]="i">
                    <span uiSortableHandle class="handle">⠿</span>
                    <span class="name">{{ $any(row).name }}</span>
                </ui-sortable-item>
            </ng-template>
        </ui-sortable>
    `,
})
class TestHostComponent {
    readonly rows = signal<TestRow[]>([
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
        { id: 3, name: 'Gamma' },
    ]);
    readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
    readonly handleOnly = signal(false);
    readonly disabled = signal(false);
    readonly extraClass = signal('');
    lastReorder: import('./sortable.types').SortableReorderEvent<TestRow> | null = null;
}

function getSortable<T>(fixture: ComponentFixture<TestHostComponent>): SortableComponent<T> {
    return fixture.debugElement
        .query(el => el.componentInstance instanceof SortableComponent)
        ?.componentInstance as SortableComponent<T>;
}

describe('SortableComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(host).toBeTruthy();
    });

    it('should render the container with data-slot="sortable"', () => {
        const el: HTMLElement = fixture.nativeElement.querySelector('[data-slot="sortable"]');
        expect(el).toBeTruthy();
    });

    it('should render one item per entry in items()', () => {
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(items.length).toBe(3);
    });

    it('should render data-slot="sortable-item" on each row', () => {
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items.forEach(item => expect(item.getAttribute('data-slot')).toBe('sortable-item'));
    });

    it('should apply custom class to the sortable container', () => {
        host.extraClass.set('my-custom');
        fixture.detectChanges();
        const el: HTMLElement = fixture.nativeElement.querySelector('[data-slot="sortable"]');
        expect(el.className).toContain('my-custom');
    });

    it('should render item names from the projected template', () => {
        const names: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.name');
        const texts = Array.from(names).map(n => n.textContent?.trim());
        expect(texts).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    it('should update items() and emit reorder on keyboard move (Space + ArrowDown)', () => {
        const sortable = getSortable<TestRow>(fixture);
        expect(sortable).toBeTruthy();

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');
        expect(host.rows()[1].name).toBe('Alpha');
        expect(host.lastReorder?.from.index).toBe(0);
        expect(host.lastReorder?.to.index).toBe(1);
        expect(host.lastReorder?.from.listId).toBe(host.lastReorder?.to.listId);
        expect(host.lastReorder?.item).toBeTruthy();
    });

    it('should not reorder when disabled', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);
        const before = host.rows().map(r => r.name);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();

        expect(host.rows().map(r => r.name)).toEqual(before);
        expect(host.lastReorder).toBeNull();
    });

    it('should cancel keyboard drag on Escape and restore original order', () => {
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');

        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Alpha');
        expect(host.rows()[1].name).toBe('Beta');
        expect(host.rows()[2].name).toBe('Gamma');
    });

    it('should move item up on ArrowUp in vertical orientation', () => {
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(2, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(2, new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        fixture.detectChanges();

        expect(host.rows()[1].name).toBe('Gamma');
        expect(host.rows()[2].name).toBe('Beta');
        expect(host.lastReorder?.from.index).toBe(2);
        expect(host.lastReorder?.to.index).toBe(1);
    });

    it('should use ArrowRight to move item in horizontal orientation', () => {
        host.orientation.set('horizontal');
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');
        expect(host.rows()[1].name).toBe('Alpha');
    });

    it('should use ArrowLeft to move item back in horizontal orientation', () => {
        host.orientation.set('horizontal');
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');
        expect(host.rows()[1].name).toBe('Alpha');
    });

    it('handleOnly prevents item body from starting drag', () => {
        host.handleOnly.set(true);
        fixture.detectChanges();

        const itemComps = fixture.debugElement
            .queryAll(el => el.componentInstance instanceof SortableItemComponent);
        const firstItem = itemComps[0]?.componentInstance as SortableItemComponent;

        const sortable = getSortable<TestRow>(fixture);

        firstItem.onMouseDown(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
        expect(sortable.dragSource()).toBeNull();
    });

    it('startDrag respects disabled flag', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);
        sortable.startDrag(0, 0, 0);
        expect(sortable.dragSource()).toBeNull();
    });

    it('orientation affects which arrow keys move items', () => {
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Alpha');
        expect(host.lastReorder).toBeNull();
    });

    it('should reorder via real keydown DOM events dispatched on the item element', () => {
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        fixture.detectChanges();

        expect(host.rows()[0].name).toBe('Beta');
        expect(host.rows()[1].name).toBe('Alpha');
        expect(host.lastReorder?.from.index).toBe(0);
        expect(host.lastReorder?.to.index).toBe(1);
        expect(host.lastReorder?.from.listId).toBe(host.lastReorder?.to.listId);
        expect(host.lastReorder?.item).toBeTruthy();
    });

    it('should start a drag on mousedown and clean up on mouseup via the DOM wiring', () => {
        const sortable = getSortable<TestRow>(fixture);
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 5, bubbles: true }));
        expect(sortable.dragSource()).toBe(0);

        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 40 }));
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 40 }));
        fixture.detectChanges();

        expect(sortable.dragSource()).toBeNull();
    });

    it('should not start a drag on mousedown when disabled', () => {
        host.disabled.set(true);
        fixture.detectChanges();

        const sortable = getSortable<TestRow>(fixture);
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 5, bubbles: true }));

        expect(sortable.dragSource()).toBeNull();
    });

    function flushTimers(): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    function attachAndSizeFixture(): void {
        document.body.appendChild(fixture.nativeElement);
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        for (const item of Array.from(items)) {
            item.style.display = 'block';
            item.style.height = '40px';
            item.style.width = '200px';
        }
        fixture.detectChanges();
    }

    function detachFixture(): void {
        if (fixture.nativeElement.parentNode === document.body) {
            document.body.removeChild(fixture.nativeElement);
        }
    }

    it('animates sibling items via element.animate() after a keyboard reorder', async () => {
        attachAndSizeFixture();
        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();
        await flushTimers();
        fixture.detectChanges();

        expect(animateSpy).toHaveBeenCalled();
        animateSpy.mockRestore();
        detachFixture();
    });

    it('projects uiSortableHeader content above the items', () => {
        @Component({
            selector: 'app-slot-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                NgTemplateOutlet,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <div uiSortableHeader data-testid="header">HEADER</div>
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">
                            <span class="name">{{ $any(row).name }}</span>
                        </ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class SlotHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
        }
        const f = TestBed.createComponent(SlotHost);
        f.detectChanges();
        const header: HTMLElement | null = f.nativeElement.querySelector('[data-testid="header"]');
        expect(header).not.toBeNull();
        expect(header?.textContent).toBe('HEADER');
    });

    it('projects uiSortableFooter content below the items', () => {
        @Component({
            selector: 'app-footer-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                NgTemplateOutlet,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                    <div uiSortableFooter data-testid="footer">FOOTER</div>
                </ui-sortable>
            `,
        })
        class FooterHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        const f = TestBed.createComponent(FooterHost);
        f.detectChanges();
        const footer: HTMLElement | null = f.nativeElement.querySelector('[data-testid="footer"]');
        expect(footer).not.toBeNull();
    });

    it('projects uiSortableEmpty only when items is empty', () => {
        @Component({
            selector: 'app-empty-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                NgTemplateOutlet,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <div uiSortableEmpty data-testid="empty">No items</div>
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class EmptyHost {
            readonly rows = signal<TestRow[]>([]);
        }
        const f = TestBed.createComponent(EmptyHost);
        f.detectChanges();
        expect(f.nativeElement.querySelector('[data-testid="empty"]')).not.toBeNull();

        f.componentInstance.rows.set([{ id: 1, name: 'A' }]);
        f.detectChanges();
        expect(f.nativeElement.querySelector('[data-testid="empty"]')).toBeNull();
    });

    it('renders a default translucent ghost at the projected drop position while dragging', () => {
        attachAndSizeFixture();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        items[2].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 95, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 10 }));
        fixture.detectChanges();

        const ghost: HTMLElement | null = fixture.nativeElement.querySelector('[data-slot="sortable-ghost"]');
        expect(ghost).not.toBeNull();
        expect(ghost?.className).toContain('opacity-60');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 10 }));
        detachFixture();
    });

    it('uses a custom uiSortableGhost template when provided, instead of the default ghost', () => {
        @Component({
            selector: 'app-ghost-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                SortableGhostTemplateDirective,
                NgTemplateOutlet,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                    <ng-template uiSortableGhost let-row>
                        <div data-testid="custom-ghost">Drop: {{ $any(row).name }}</div>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class GhostHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
                { id: 3, name: 'C' },
            ]);
        }
        const f = TestBed.createComponent(GhostHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items[2].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 95, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 10 }));
        f.detectChanges();

        const custom: HTMLElement | null = f.nativeElement.querySelector('[data-testid="custom-ghost"]');
        const defaultGhost: HTMLElement | null = f.nativeElement.querySelector('[data-slot="sortable-ghost"]');
        expect(custom).not.toBeNull();
        expect(custom?.textContent).toContain('C');
        expect(defaultGhost).toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 10 }));
        document.body.removeChild(f.nativeElement);
    });

    it('renders a default placeholder at the lift origin while dragging', () => {
        attachAndSizeFixture();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        items[0].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 10, bubbles: true }));
        fixture.detectChanges();

        const placeholder: HTMLElement | null = document.querySelector('[data-slot="sortable-placeholder"]');
        expect(placeholder).not.toBeNull();
        expect(placeholder?.className).toContain('border-dashed');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 10 }));
        fixture.detectChanges();
        expect(document.querySelector('[data-slot="sortable-placeholder"]')).toBeNull();
        detachFixture();
    });

    it('uses a custom uiSortablePlaceholder template when provided', () => {
        @Component({
            selector: 'app-placeholder-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                SortablePlaceholderTemplateDirective,
                NgTemplateOutlet,
            ],
            template: `
                <ui-sortable [(items)]="rows">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                    <ng-template uiSortablePlaceholder let-row>
                        <div data-testid="custom-placeholder">Was here: {{ $any(row).name }}</div>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class PlaceholderHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
                { id: 3, name: 'C' },
            ]);
        }
        const f = TestBed.createComponent(PlaceholderHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        items[1].dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 50, bubbles: true }));
        f.detectChanges();

        const custom: HTMLElement | null = document.querySelector('[data-testid="custom-placeholder"]');
        const defaultPlaceholder: HTMLElement | null = document.querySelector('[data-slot="sortable-placeholder"]');
        expect(custom).not.toBeNull();
        expect(custom?.textContent).toContain('B');
        expect(defaultPlaceholder).toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 50 }));
        document.body.removeChild(f.nativeElement);
    });

    it('applies lift effect (scale + rotate + shadow + z-50) to the source while dragging', () => {
        attachAndSizeFixture();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');

        const sourceEl = items[0];
        sourceEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 30 }));
        fixture.detectChanges();

        expect(sourceEl.className).toContain('z-50');
        expect(sourceEl.className).toContain('shadow-2xl');
        const transform = sourceEl.style.transform;
        expect(transform).toContain('translate');
        expect(transform).toContain('scale(1.02)');
        expect(transform).toContain('rotate(1.5deg)');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 5, clientY: 30 }));
        detachFixture();
    });

    it('shows cursor-grab on body-draggable items, hides it when handleOnly is set', () => {
        const sortable = getSortable<TestRow>(fixture);
        expect(sortable).toBeTruthy();
        const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(items[0].className).toContain('cursor-grab');

        host.handleOnly.set(true);
        fixture.detectChanges();
        const itemsAfter: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(itemsAfter[0].className).not.toContain('cursor-grab');
    });

    it('exports SORTABLE_LAND_EFFECTS with the four built-in class names', () => {
        expect(SORTABLE_LAND_EFFECTS.flash).toBe('ui-sortable-land-flash');
        expect(SORTABLE_LAND_EFFECTS.pulse).toBe('ui-sortable-land-pulse');
        expect(SORTABLE_LAND_EFFECTS.shake).toBe('ui-sortable-land-shake');
        expect(SORTABLE_LAND_EFFECTS.glow).toBe('ui-sortable-land-glow');
    });

    it('SORTABLE_LAND_EFFECTS is readonly (frozen-shape const)', () => {
        const keys = Object.keys(SORTABLE_LAND_EFFECTS).sort();
        expect(keys).toEqual(['flash', 'glow', 'pulse', 'shake']);
    });

    it('applies positionClass to each item wrapper, re-evaluating on reorder', () => {
        @Component({
            selector: 'app-pos-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                NgTemplateOutlet,
            ],
            template: `
                <ui-sortable [(items)]="rows" [positionClass]="posFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class PosHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
                { id: 3, name: 'C' },
            ]);
            readonly posFn = (_item: TestRow, i: number, total: number): string =>
                i === 0 ? 'pos-first' : i === total - 1 ? 'pos-last' : 'pos-middle';
        }
        const f = TestBed.createComponent(PosHost);
        f.detectChanges();

        const items: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(items[0].className).toContain('pos-first');
        expect(items[1].className).toContain('pos-middle');
        expect(items[2].className).toContain('pos-last');

        f.componentInstance.rows.update((rs) => [rs[2], rs[0], rs[1]]);
        f.detectChanges();

        const reorderedItems: NodeListOf<HTMLElement> = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]');
        expect(reorderedItems[0].textContent?.trim()).toBe('C');
        expect(reorderedItems[0].className).toContain('pos-first');
        expect(reorderedItems[2].textContent?.trim()).toBe('B');
        expect(reorderedItems[2].className).toContain('pos-last');
    });

    it('adds the landEffect class transiently to the landed item after a keyboard reorder', async () => {
        @Component({
            selector: 'app-land-host',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                NgTemplateOutlet,
            ],
            template: `
                <ui-sortable [(items)]="rows" [landEffect]="landFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class LandHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
            ]);
            readonly landFn = (): string => 'land-test-class';
        }
        const f = TestBed.createComponent(LandHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 10));
        f.detectChanges();

        const landed: HTMLElement | null = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')[1];
        expect(landed?.className).toContain('land-test-class');

        await new Promise<void>(r => setTimeout(r, 250));
        f.detectChanges();
        const after: HTMLElement | null = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')[1];
        expect(after?.className).not.toContain('land-test-class');

        document.body.removeChild(f.nativeElement);
    });

    it('landEffect returning null does not add any class', async () => {
        let calls = 0;
        @Component({
            selector: 'app-land-null',
            standalone: true,
            imports: [
                SortableComponent,
                SortableItemComponent,
                SortableItemTemplateDirective,
                NgTemplateOutlet,
            ],
            template: `
                <ui-sortable [(items)]="rows" [landEffect]="landFn">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class LandNullHost {
            readonly rows = signal<TestRow[]>([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
            ]);
            readonly landFn = (): string | null => { calls++; return null; };
        }
        const f = TestBed.createComponent(LandNullHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        f.detectChanges();
        await new Promise<void>(r => setTimeout(r, 20));
        f.detectChanges();

        const item: HTMLElement | null = f.nativeElement.querySelectorAll('[data-slot="sortable-item"]')[1];
        expect(item?.className ?? '').not.toMatch(/land-/);
        expect(calls).toBeGreaterThan(0);
        document.body.removeChild(f.nativeElement);
    });

    it('trackBy default returns the item itself (object identity)', () => {
        const sortable = getSortable<TestRow>(fixture);
        const trackFn = sortable.trackBy();
        const item: TestRow = { id: 99, name: 'X' };
        expect(trackFn(item, 0)).toBe(item);
    });

    it('registers with the group registry when [group] is non-empty', () => {
        clearRegistry();
        @Component({
            selector: 'app-grp-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective, NgTemplateOutlet],
            template: `
                <ui-sortable [(items)]="rows" group="my-grp" listId="A">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class GrpHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        const f = TestBed.createComponent(GrpHost);
        f.detectChanges();
        expect(groupSize('my-grp')).toBe(1);
        const peers = peersInGroup('my-grp');
        expect(peers[0].listId).toBe('A');
        expect(peers[0].group).toBe('my-grp');
        expect(peers[0].orientation).toBe('vertical');
    });

    it('does not register when [group] is empty (the default)', () => {
        clearRegistry();
        const sortable = getSortable<TestRow>(fixture);
        expect(sortable).toBeTruthy();
        expect(groupSize('')).toBe(0);
        expect(groupSize('any')).toBe(0);
    });

    it('unregisters on destroy', () => {
        clearRegistry();
        @Component({
            selector: 'app-destroy-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective, NgTemplateOutlet],
            template: `
                <ui-sortable [(items)]="rows" group="ephemeral">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class DestroyHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        const f = TestBed.createComponent(DestroyHost);
        f.detectChanges();
        expect(groupSize('ephemeral')).toBe(1);
        f.destroy();
        expect(groupSize('ephemeral')).toBe(0);
    });

    it('hit-tests cross-list peers and exposes hoverPeer + hoverPeerTarget', () => {
        clearRegistry();
        @Component({
            selector: 'app-cross-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective, NgTemplateOutlet],
            template: `
                <ui-sortable
                    [(items)]="left"
                    group="board"
                    listId="left"
                    style="display:block; position:fixed; left:0px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">L{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable
                    [(items)]="right"
                    group="board"
                    listId="right"
                    style="display:block; position:fixed; left:300px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">R{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class CrossHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
            readonly right = signal<TestRow[]>([{ id: 3, name: 'X' }, { id: 4, name: 'Y' }]);
        }

        const f = TestBed.createComponent(CrossHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();
        expect(peersInGroup('board')).toHaveLength(2);
        const leftS = f.debugElement.queryAll(el => el.componentInstance instanceof SortableComponent)
            .map(d => d.componentInstance as SortableComponent<TestRow>)
            .find(c => c.listId() === 'left')!;
        expect(leftS).toBeTruthy();

        const leftItems = f.nativeElement.querySelectorAll('ui-sortable')[0].querySelectorAll('[data-slot="sortable-item"]');
        (leftItems[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 50 }));
        f.detectChanges();

        expect(leftS.hoverPeer()?.listId).toBe('right');
        expect(leftS.hoverPeerTarget()).not.toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }));
        f.detectChanges();
        expect(leftS.hoverPeer()).toBeNull();

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 50 }));
        document.body.removeChild(f.nativeElement);
    });

    it('evaluateAccepts returns true by default', () => {
        const sortable = getSortable<TestRow>(fixture);
        expect(sortable.evaluateAccepts({ id: 1, name: 'A' }, { fromListId: 'x', toListId: '', toIndex: 0 })).toBe(true);
    });

    it('evaluateAccepts honors a boolean false input', () => {
        @Component({
            selector: 'app-acc-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective, NgTemplateOutlet],
            template: `
                <ui-sortable [(items)]="rows" [accepts]="false" group="acc1" listId="A">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class AccHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
        }
        const f = TestBed.createComponent(AccHost);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        expect(sortable.evaluateAccepts({ id: 99, name: 'X' }, { fromListId: 'x', toListId: '', toIndex: 0 })).toBe(false);
    });

    it('evaluateAccepts calls the predicate function with the right context and returns its result', () => {
        const captured: { item: TestRow; ctx: { fromListId: string; toListId: string; toIndex: number } }[] = [];
        @Component({
            selector: 'app-acc-fn-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective, NgTemplateOutlet],
            template: `
                <ui-sortable [(items)]="rows" [accepts]="acceptFn" listId="bb">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class AccFnHost {
            readonly rows = signal<TestRow[]>([{ id: 1, name: 'A' }]);
            readonly acceptFn = (item: TestRow, ctx: { fromListId: string; toListId: string; toIndex: number }): { ok: boolean; reason?: string } => {
                captured.push({ item, ctx });
                return { ok: false, reason: 'wip-limit' };
            };
        }
        const f = TestBed.createComponent(AccFnHost);
        f.detectChanges();
        const sortable = f.debugElement.query(el => el.componentInstance instanceof SortableComponent).componentInstance as SortableComponent<TestRow>;
        const res = sortable.evaluateAccepts({ id: 9, name: 'Z' }, { fromListId: 'src', toListId: '', toIndex: 2 });

        expect(res).toEqual({ ok: false, reason: 'wip-limit' });
        expect(captured).toHaveLength(1);
        expect(captured[0].item.name).toBe('Z');
        expect(captured[0].ctx.fromListId).toBe('src');
        expect(captured[0].ctx.toListId).toBe('bb');
        expect(captured[0].ctx.toIndex).toBe(2);
    });

    it('evaluateAccepts returns disabled-rejection when [disabled]=true', () => {
        host.disabled.set(true);
        fixture.detectChanges();
        const sortable = getSortable<TestRow>(fixture);
        const res = sortable.evaluateAccepts({ id: 1, name: 'A' }, { fromListId: 'x', toListId: '', toIndex: 0 });
        expect(res).toEqual({ ok: false, reason: 'disabled' });
    });

    it('cross-list drop: accepted moves the item between lists and emits reorder on the source with cross-list payload', () => {
        clearRegistry();
        let lastReorder: SortableReorderEvent<TestRow> | null = null;
        let entered = 0;
        let leftCount = 0;
        @Component({
            selector: 'app-cdrop-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective, NgTemplateOutlet],
            template: `
                <ui-sortable
                    [(items)]="left"
                    group="drop"
                    listId="L"
                    style="display:block; position:fixed; left:0px; top:0px; width:200px;"
                    (reorder)="capture($event)">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable
                    [(items)]="right"
                    group="drop"
                    listId="R"
                    style="display:block; position:fixed; left:300px; top:0px; width:200px;"
                    (itemEnter)="onEnter()"
                    (itemLeave)="onLeave()">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class CDropHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'L1' }, { id: 2, name: 'L2' }]);
            readonly right = signal<TestRow[]>([{ id: 3, name: 'R1' }]);
            capture(e: SortableReorderEvent<TestRow>): void { lastReorder = e; }
            onEnter(): void { entered++; }
            onLeave(): void { leftCount++; }
        }
        const f = TestBed.createComponent(CDropHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const leftItems = f.nativeElement.querySelectorAll('ui-sortable')[0].querySelectorAll('[data-slot="sortable-item"]');
        (leftItems[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 5 }));
        f.detectChanges();
        expect(entered).toBe(1);
        const rightSortableHost = f.nativeElement.querySelectorAll('ui-sortable')[1].querySelector('[data-slot="sortable"]');
        expect(rightSortableHost?.getAttribute('data-receiving')).toBe('true');

        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, clientY: 5 }));
        f.detectChanges();

        expect(f.componentInstance.left().map(r => r.name)).toEqual(['L2']);
        expect(f.componentInstance.right().map(r => r.name)).toContain('L1');
        expect(lastReorder).not.toBeNull();
        expect(lastReorder?.from.listId).toBe('L');
        expect(lastReorder?.to.listId).toBe('R');
        expect(lastReorder?.item.name).toBe('L1');
        expect(leftCount).toBe(1);

        document.body.removeChild(f.nativeElement);
    });

    it('cross-list drop: rejected leaves both lists unchanged and emits (dropRejected)', () => {
        clearRegistry();
        let rejected: SortableDropRejectedEvent<TestRow> | null = null;
        @Component({
            selector: 'app-rej-host',
            standalone: true,
            imports: [SortableComponent, SortableItemComponent, SortableItemTemplateDirective, NgTemplateOutlet],
            template: `
                <ui-sortable
                    [(items)]="left"
                    group="rej"
                    listId="L"
                    style="display:block; position:fixed; left:0px; top:0px; width:200px;"
                    (dropRejected)="capture($event)">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
                <ui-sortable
                    [(items)]="right"
                    group="rej"
                    listId="R"
                    [accepts]="rejectFn"
                    style="display:block; position:fixed; left:300px; top:0px; width:200px;">
                    <ng-template uiSortableItem let-row let-i="index">
                        <ui-sortable-item [index]="i" style="display:block; height:40px; width:200px;">{{ $any(row).name }}</ui-sortable-item>
                    </ng-template>
                </ui-sortable>
            `,
        })
        class RejHost {
            readonly left = signal<TestRow[]>([{ id: 1, name: 'L1' }]);
            readonly right = signal<TestRow[]>([{ id: 3, name: 'R1' }]);
            readonly rejectFn = (): { ok: boolean; reason?: string } => ({ ok: false, reason: 'wip-limit' });
            capture(e: SortableDropRejectedEvent<TestRow>): void { rejected = e; }
        }
        const f = TestBed.createComponent(RejHost);
        document.body.appendChild(f.nativeElement);
        f.detectChanges();

        const leftItems = f.nativeElement.querySelectorAll('ui-sortable')[0].querySelectorAll('[data-slot="sortable-item"]');
        (leftItems[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 10, bubbles: true }));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, clientY: 5 }));
        f.detectChanges();
        globalThis.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, clientY: 5 }));
        f.detectChanges();

        expect(f.componentInstance.left().map(r => r.name)).toEqual(['L1']);
        expect(f.componentInstance.right().map(r => r.name)).toEqual(['R1']);
        expect(rejected).not.toBeNull();
        expect(rejected?.reason).toBe('wip-limit');
        expect(rejected?.fromListId).toBe('L');
        expect(rejected?.toListId).toBe('R');

        document.body.removeChild(f.nativeElement);
    });

    it('animates after Escape-cancel restores order', async () => {
        attachAndSizeFixture();
        const sortable = getSortable<TestRow>(fixture);

        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: ' ' }));
        sortable.handleItemKeyDown(0, new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        fixture.detectChanges();
        await flushTimers();

        const animateSpy = vi.spyOn(HTMLElement.prototype, 'animate');
        sortable.handleItemKeyDown(1, new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        await flushTimers();

        expect(animateSpy).toHaveBeenCalled();
        animateSpy.mockRestore();
        detachFixture();
    });
});
