import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import {
    SortableComponent,
    SortableItemComponent,
    SortableItemTemplateDirective,
    SortableHandleDirective,
} from './sortable.component';
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
});
