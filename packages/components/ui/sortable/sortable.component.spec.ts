import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
    SortableHandleDirective,
} from './sortable.component';
import { SortableGhostTemplateDirective } from './sub/sortable-ghost.directive';
import { SortablePlaceholderTemplateDirective } from './sub/sortable-placeholder.directive';
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
    lastReorder: { from: number; to: number } | null = null;
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
        expect(host.lastReorder).toEqual({ from: 0, to: 1 });
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
        expect(host.lastReorder).toEqual({ from: 2, to: 1 });
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
        expect(host.lastReorder).toEqual({ from: 0, to: 1 });
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
