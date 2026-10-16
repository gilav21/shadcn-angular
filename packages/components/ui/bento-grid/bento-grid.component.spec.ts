import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ComponentRef, input, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BentoGridComponent, DashboardItem } from './bento-grid.component';
import { BentoGridItemComponent } from './sub/bento-grid-item.component';

/** A dashboard widget of the kind consumers pass as `content`, fed through `inputs`. */
@Component({
    selector: 'test-kpi-widget',
    template: `<span data-testid="kpi-widget">{{ label() }}</span>`,
})
class KpiWidgetComponent {
    readonly label = input('');
}

/** Create a standalone, change-detected bento-grid fixture. */
function makeStandaloneGrid(): ComponentFixture<BentoGridComponent> {
    const f = TestBed.createComponent(BentoGridComponent);
    f.detectChanges();
    return f;
}

@Component({
    template: `
        <ui-bento-grid
            [items]="items()"
            [cols]="cols()"
            [rowHeight]="rowHeight()"
            [gap]="gap()"
            [showBorders]="showBorders()"
            [editable]="editable()"
            (itemsChange)="onItemsChange($event)"
            (selectionChange)="onSelectionChange($event)"
        />
    `,
    imports: [BentoGridComponent]
})
class BentoGridTestHostComponent {
    items = signal<DashboardItem[]>([
        { id: '1', x: 1, y: 1, cols: 2, rows: 1, content: 'Item 1' },
        { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: 'Item 2' },
        { id: '3', x: 1, y: 2, cols: 1, rows: 1, content: 'Item 3' },
    ]);
    cols = signal(4);
    rowHeight = signal('120px');
    gap = signal('1rem');
    showBorders = signal(true);
    editable = signal(false);

    lastItemsChange: DashboardItem[] | null = null;
    lastSelectionChange: string[] | null = null;

    onItemsChange(items: DashboardItem[]) {
        this.lastItemsChange = items;
    }

    onSelectionChange(ids: string[]) {
        this.lastSelectionChange = ids;
    }
}

type TouchPoint = { clientX: number; clientY: number };

function makeTouchEvent(type: string, points: TouchPoint[], target?: EventTarget): TouchEvent {
    const ev = new Event(type, { bubbles: true }) as unknown as TouchEvent;
    Object.defineProperty(ev, 'touches', { value: points, configurable: true });
    if (target) {
        Object.defineProperty(ev, 'target', { value: target, configurable: true });
    }
    return ev;
}

/** Pins an element's rect to a `width` x `height` box at the viewport origin. */
function mockRect(el: HTMLElement, width: number, height: number): void {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}),
    });
}

describe('BentoGridComponent', () => {
    let fixture: ComponentFixture<BentoGridTestHostComponent>;
    let component: BentoGridTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BentoGridTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BentoGridTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function getGrid(): BentoGridComponent {
        return fixture.debugElement.query(By.directive(BentoGridComponent)).componentInstance as BentoGridComponent;
    }

    it('renders each item with its content, applies rowHeight and gap, and drops the border only when showBorders and editable are both off', async () => {
        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items.map(i => i.nativeElement.textContent.trim())).toEqual(['Item 1', 'Item 2', 'Item 3']);
        expect(items[0].nativeElement.classList.contains('border')).toBe(true);

        const gridEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
        expect(gridEl.style.gridAutoRows).toBe('120px');
        expect(gridEl.style.gap).toBe('1rem');

        component.showBorders.set(false);
        fixture.detectChanges();
        await fixture.whenStable();
        expect(fixture.debugElement.queryAll(By.css('.bento-item'))[0].nativeElement.classList.contains('border')).toBe(false);
    });

    describe('Selection', () => {
        it('toggles an item and emits selectionChange, replaces the selection when multi=false, and clears it on demand', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', false);
            expect(grid.isSelected('1')).toBe(true);
            expect(component.lastSelectionChange).toEqual(['1']);

            grid.toggleSelection('1', false);
            expect(grid.isSelected('1')).toBe(false);

            grid.toggleSelection('1', false);
            grid.toggleSelection('2', false);
            expect(grid.isSelected('1')).toBe(false);
            expect(grid.isSelected('2')).toBe(true);

            grid.toggleSelection('1', true);
            expect(grid.isSelected('2')).toBe(true);
            expect(grid.isSelected('1')).toBe(true);

            grid.clearSelection();
            expect(grid.isSelected('1')).toBe(false);
            expect(grid.isSelected('2')).toBe(false);
            expect(component.lastSelectionChange).toEqual([]);
        });
    });

    describe('Selection disabled when not editable', () => {
        it('should not allow selection when editable is false', () => {
            component.editable.set(false);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', false);

            expect(grid.isSelected('1')).toBe(false);
        });

        it('should clear existing selection when editable changes to false', async () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);
            expect(grid.isSelected('1')).toBe(true);

            component.editable.set(false);
            fixture.detectChanges();
            await fixture.whenStable();

            expect(grid.isSelected('1')).toBe(false);
            expect(grid.isSelected('2')).toBe(false);
            expect(component.lastSelectionChange).toEqual([]);

            // An already-empty selection is not changed, so nothing is emitted.
            component.lastSelectionChange = null;
            component.editable.set(true);
            fixture.detectChanges();
            component.editable.set(false);
            fixture.detectChanges();
            await fixture.whenStable();

            expect(component.lastSelectionChange).toBeNull();
        });
    });

    it('areAdjacent is true only for items sharing an edge, from either side, never for gaps or diagonals', () => {
        const grid = getGrid();
        const at = (id: string, x: number, y: number, cols = 1): DashboardItem => ({ id, x, y, cols, rows: 1, content: '' });

        expect(grid.areAdjacent(at('a', 1, 1, 2), at('b', 3, 1))).toBe(true);
        expect(grid.areAdjacent(at('a', 1, 1, 2), at('b', 1, 2))).toBe(true);
        expect(grid.areAdjacent(at('a', 3, 1), at('b', 1, 1, 2))).toBe(true);
        expect(grid.areAdjacent(at('a', 1, 1), at('b', 3, 3))).toBe(false);
        expect(grid.areAdjacent(at('a', 1, 1), at('b', 2, 2))).toBe(false);
    });

    describe('canMerge / mergeSelected', () => {
        beforeEach(() => {
            component.editable.set(true);
            fixture.detectChanges();
        });

        it('canMerge is false when the selected items are not adjacent or one is no longer in items', () => {
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'Item 1' },
                { id: '2', x: 4, y: 4, cols: 1, rows: 1, content: 'Item 2' },
            ]);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);
            expect(grid.canMerge()).toBe(false);

            component.items.set([{ id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'Item 1' }]);
            fixture.detectChanges();
            expect(grid.canMerge()).toBe(false);
        });

        it('merges two adjacent items into their bounding box and clears the selection', () => {
            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);
            expect(grid.canMerge()).toBe(true);

            grid.mergeSelected();

            expect(component.lastItemsChange).toHaveLength(2);
            expect(component.lastItemsChange).toEqual(expect.arrayContaining([
                { id: '1', x: 1, y: 1, cols: 3, rows: 1, content: 'Item 1' },
                { id: '3', x: 1, y: 2, cols: 1, rows: 1, content: 'Item 3' },
            ]));
            expect(grid.isSelected('1')).toBe(false);
            expect(grid.isSelected('2')).toBe(false);
        });

        it('does not merge a single selected item', () => {
            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.mergeSelected();

            expect(component.lastItemsChange).toBeNull();
        });

        it('sorts vertically-stacked items by row before merging', () => {
            component.items.set([
                { id: 'bottom', x: 1, y: 2, cols: 1, rows: 1, content: 'B' },
                { id: 'top', x: 1, y: 1, cols: 1, rows: 1, content: 'T' },
            ]);
            fixture.detectChanges();
            const grid = getGrid();
            grid.toggleSelection('bottom', true);
            grid.toggleSelection('top', true);
            expect(grid.canMerge()).toBe(true);
            grid.mergeSelected();

            const merged = component.lastItemsChange!;
            expect(merged).toHaveLength(1);
            expect(merged[0].id).toBe('top');
            expect(merged[0].y).toBe(1);
            expect(merged[0].rows).toBe(2);
        });
    });

    describe('deleteItem', () => {
        it('should emit itemsChange without the deleted item', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const [first, , third] = component.items();

            const grid = getGrid();
            grid.deleteItem('2');

            expect(component.lastItemsChange).toEqual([first, third]);
        });
    });

    describe('splitItem vertical', () => {
        it('should split an item with cols >= 2 into two items side by side', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.splitItem('1', 'vertical');

            expect(component.lastItemsChange).toBeTruthy();
            const emittedItems = component.lastItemsChange!;

            const remaining = emittedItems.filter(i => i.id !== '2' && i.id !== '3');
            expect(remaining).toHaveLength(2);

            const original = remaining.find(i => i.id === '1');
            expect(original).toBeTruthy();
            expect(original!.cols).toBe(1);
            expect(original!.x).toBe(1);

            const newItem = remaining.find(i => i.id !== '1');
            expect(newItem).toBeTruthy();
            expect(newItem!.cols).toBe(1);
            expect(newItem!.x).toBe(2);
            expect(newItem!.y).toBe(1);
            expect(newItem!.rows).toBe(1);
        });
    });

    describe('splitItem horizontal', () => {
        it('should split an item with rows >= 2 into two items stacked vertically', () => {
            component.editable.set(true);
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 2, rows: 2, content: 'Item 1' },
            ]);
            fixture.detectChanges();

            const grid = getGrid();
            grid.splitItem('1', 'horizontal');

            expect(component.lastItemsChange).toBeTruthy();
            const emittedItems = component.lastItemsChange!;
            expect(emittedItems).toHaveLength(2);

            const original = emittedItems.find(i => i.id === '1');
            expect(original).toBeTruthy();
            expect(original!.rows).toBe(1);
            expect(original!.y).toBe(1);

            const newItem = emittedItems.find(i => i.id !== '1');
            expect(newItem).toBeTruthy();
            expect(newItem!.rows).toBe(1);
            expect(newItem!.y).toBe(2);
            expect(newItem!.cols).toBe(2);
        });
    });

    it('refuses to split an item that is too small along the split axis', () => {
        component.editable.set(true);
        fixture.detectChanges();

        const grid = getGrid();
        grid.splitItem('2', 'vertical');
        grid.splitItem('1', 'horizontal');

        expect(component.lastItemsChange).toBeNull();
    });

    describe('addItemAt', () => {
        it('should add a new item at a non-overlapping position', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.addItemAt(4, 2, 1, 1);

            expect(component.lastItemsChange).toBeTruthy();
            expect(component.lastItemsChange!).toHaveLength(4);

            const addedItem = component.lastItemsChange!.find(
                i => i.x === 4 && i.y === 2 && i.cols === 1 && i.rows === 1
            );
            expect(addedItem).toBeTruthy();
            expect(addedItem!.content).toBe('New Item');
        });

        it('should detect partial overlap and prevent addition', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.addItemAt(2, 1, 2, 1);

            expect(component.lastItemsChange).toBeNull();
        });
    });

    describe('computed signals & styles', () => {
        it('should compute gridTemplateColumns from cols', () => {
            component.cols.set(6);
            fixture.detectChanges();
            expect(getGrid().gridTemplateColumns()).toBe('repeat(6, minmax(0, 1fr))');
        });

        it('should build gridBackgroundSize for 1fr columns', () => {
            const size = getGrid().gridBackgroundSize();
            expect(size).toContain('/ 4)');
            expect(size).toContain('120px');
        });

        it('should build gridBackgroundSize for fixed column width', () => {
            const f = TestBed.createComponent(BentoGridComponent);
            f.componentRef.setInput('columnWidth', '100px');
            f.detectChanges();
            const size = f.componentInstance.gridBackgroundSize();
            expect(size).toContain('100px');
        });

        it('should apply the class input to the grid element', () => {
            const f = TestBed.createComponent(BentoGridComponent);
            f.componentRef.setInput('class', 'my-grid');
            f.detectChanges();
            const gridEl = f.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            expect(gridEl.classList).toContain('my-grid');
        });

        it('produces grid cells only when editable', () => {
            expect(getGrid().gridCells()).toHaveLength(0);
            component.editable.set(true);
            fixture.detectChanges();
            // 4 cols x (max(8, lowest item bottom 3) + 2 spare rows)
            expect(getGrid().gridCells()).toHaveLength(40);
        });
    });

    it('turns bare numbers and numeric strings into px and keeps values that already carry a unit, for every dimension input', () => {
        const f = makeStandaloneGrid();
        const grid = f.componentInstance;
        // Each input carries its own transform, so each needs all three classes of value.
        const inputs = {
            rowHeight: () => grid.rowHeight(),
            gap: () => grid.gap(),
            columnWidth: () => grid.columnWidth(),
            borderRadius: () => grid.borderRadius(),
            itemPadding: () => grid.itemPadding(),
        };
        for (const [name, read] of Object.entries(inputs)) {
            f.componentRef.setInput(name, 12);
            f.detectChanges();
            expect(read(), name + ' number').toBe('12px');

            f.componentRef.setInput(name, '24');
            f.detectChanges();
            expect(read(), name + ' numeric string').toBe('24px');

            f.componentRef.setInput(name, '3rem');
            f.detectChanges();
            expect(read(), name + ' unit string').toBe('3rem');
        }
    });

    describe('helper methods', () => {
        it('renders a component-typed widget through the outlet with its inputs and hands its ref to componentInit', () => {
            const f = TestBed.createComponent(BentoGridComponent);
            const inits: { id: string; ref: ComponentRef<unknown> }[] = [];
            f.componentInstance.componentInit.subscribe(e => inits.push(e));
            f.componentRef.setInput('items', [
                { id: 'kpi', x: 1, y: 1, cols: 1, rows: 1, content: KpiWidgetComponent, inputs: { label: 'Monthly Revenue' } },
                { id: 'note', x: 2, y: 1, cols: 1, rows: 1, content: 'Plain note' },
            ]);
            f.detectChanges();

            const widget = f.nativeElement.querySelector('[data-testid="kpi-widget"]') as HTMLElement;
            expect(widget.textContent).toBe('Monthly Revenue');
            expect(inits.map(e => e.id)).toEqual(['kpi']);
            expect(inits[0].ref.instance).toBeInstanceOf(KpiWidgetComponent);
            expect(f.nativeElement.textContent).toContain('Plain note');
        });

        it('castMenuData is null for nullish data, and isDragging follows draggedItemId', () => {
            expect(getGrid().castMenuData(null)).toBeNull();
            expect(getGrid().castMenuData(undefined)).toBeNull();

            const grid = getGrid();
            expect(grid.isDragging('1')).toBe(false);
            grid.draggedItemId.set('1');
            expect(grid.isDragging('1')).toBe(true);
        });
    });

    describe('context menu', () => {
        function fakeMenu(): { calls: unknown[][]; show: (...a: unknown[]) => void } {
            const calls: unknown[][] = [];
            return { calls, show: (...a: unknown[]) => { calls.push(a); } };
        }

        function containerContextMenu(menu: ReturnType<typeof fakeMenu>, clientX: number, clientY: number): void {
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const ev = new MouseEvent('contextmenu', { clientX, clientY });
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            Object.defineProperty(ev, 'target', { value: containerEl });
            getGrid().onContainerContextMenu(ev, menu as never);
        }

        it('onContextMenu shows the menu with the item, but only when editable', () => {
            const grid = getGrid();
            const menu = fakeMenu();
            const item: DashboardItem = { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' };

            grid.onContextMenu(new MouseEvent('contextmenu'), item, menu as never);
            expect(menu.calls).toHaveLength(0);

            component.editable.set(true);
            fixture.detectChanges();
            grid.onContextMenu(new MouseEvent('contextmenu', { clientX: 50, clientY: 60 }), item, menu as never);
            expect(menu.calls).toEqual([[50, 60, item]]);
        });

        it('onContainerContextMenu offers the add-here menu on a free cell only', () => {
            const menu = fakeMenu();
            containerContextMenu(menu, 5, 5);
            expect(menu.calls).toHaveLength(0);

            component.editable.set(true);
            component.items.set([]);
            fixture.detectChanges();
            containerContextMenu(menu, 5, 5);
            expect(menu.calls).toHaveLength(1);
            expect((menu.calls[0][2] as { type: string }).type).toBe('empty');
        });

        it('onContainerContextMenu ignores a click on a bento-item and one over an occupied cell', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const menu = fakeMenu();
            const itemEl = fixture.debugElement.query(By.css('.bento-item')).nativeElement as HTMLElement;
            const onItem = new MouseEvent('contextmenu');
            Object.defineProperty(onItem, 'target', { value: itemEl });
            getGrid().onContainerContextMenu(onItem, menu as never);
            expect(menu.calls).toHaveLength(0);

            component.items.set([{ id: 'big', x: 1, y: 1, cols: 12, rows: 12, content: '' }]);
            component.cols.set(12);
            fixture.detectChanges();
            const rect = fixture.debugElement.query(By.css('.grid')).nativeElement.getBoundingClientRect();
            containerContextMenu(menu, rect.left + 5, rect.top + 5);
            expect(menu.calls).toHaveLength(0);
        });
    });

    describe('drag start / end (HTML5)', () => {
        function makeDragEvent(type: string, x = 30, y = 40): DragEvent {
            const ev = new Event(type) as DragEvent;
            Object.defineProperty(ev, 'clientX', { value: x });
            Object.defineProperty(ev, 'clientY', { value: y });
            const dt = {
                effectAllowed: '',
                dropEffect: '',
                types: ['application/json'] as string[],
                _store: {} as Record<string, string>,
                setData(k: string, v: string) { this._store[k] = v; },
                getData(k: string) { return this._store[k] ?? ''; },
            };
            Object.defineProperty(ev, 'dataTransfer', { value: dt });
            return ev;
        }

        it('onDragStart records the dragged id and grab offset only when editable, falling back to a zeroed rect outside a bento-item', () => {
            const grid = getGrid();
            const notEditable = makeDragEvent('dragstart');
            Object.defineProperty(notEditable, 'target', { value: document.body });
            grid.onDragStart(notEditable, { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' });
            expect(grid.draggedItemId()).toBeNull();

            component.editable.set(true);
            fixture.detectChanges();
            const itemEl = fixture.debugElement.query(By.css('.bento-item')).nativeElement as HTMLElement;
            const ev = makeDragEvent('dragstart', 100, 100);
            Object.defineProperty(ev, 'target', { value: itemEl });
            grid.onDragStart(ev, { id: '1', x: 1, y: 1, cols: 2, rows: 1, content: '' });
            expect(grid.draggedItemId()).toBe('1');
            expect(grid.dragOffset()).not.toBeNull();
            expect(ev.dataTransfer!.effectAllowed).toBe('move');

            const orphan = makeDragEvent('dragstart', 10, 10);
            Object.defineProperty(orphan, 'target', { value: document.body });
            grid.onDragStart(orphan, { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' });
            expect(grid.dragOffset()).toEqual({ x: 10, y: 10 });
        });

        it('onDragEnd clears drag state', () => {
            const grid = getGrid();
            grid.draggedItemId.set('1');
            grid.dropPreview.set({ x: 1, y: 1, cols: 1, rows: 1 });
            grid.dragOffset.set({ x: 1, y: 1 });
            grid.onDragEnd(new Event('dragend') as DragEvent);
            expect(grid.draggedItemId()).toBeNull();
            expect(grid.dropPreview()).toBeNull();
            expect(grid.dragOffset()).toBeNull();
        });

        it('onDragOver sets dropEffect move only when editable, and tolerates a missing dataTransfer', () => {
            const grid = getGrid();
            const target: DashboardItem = { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' };
            const notEditable = makeDragEvent('dragover');
            grid.onDragOver(notEditable, target);
            expect(notEditable.dataTransfer!.dropEffect).toBe('');

            component.editable.set(true);
            fixture.detectChanges();
            const ev = makeDragEvent('dragover');
            grid.onDragOver(ev, target);
            expect(ev.dataTransfer!.dropEffect).toBe('move');

            const bare = new Event('dragover') as DragEvent;
            Object.defineProperty(bare, 'dataTransfer', { value: null });
            expect(() => grid.onDragOver(bare, target)).not.toThrow();
        });

        it('onContainerDragOver sets copy for external and updates dropPreview for internal', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;

            const extEv = makeDragEvent('dragover');
            Object.defineProperty(extEv, 'currentTarget', { value: containerEl });
            grid.onContainerDragOver(extEv);
            expect(extEv.dataTransfer!.dropEffect).toBe('copy');

            grid.draggedItemId.set('1');
            const intEv = makeDragEvent('dragover', 200, 200);
            Object.defineProperty(intEv.dataTransfer!, 'types', { value: ['text/plain'], configurable: true });
            Object.defineProperty(intEv, 'currentTarget', { value: containerEl });
            grid.onContainerDragOver(intEv);
            expect(intEv.dataTransfer!.dropEffect).toBe('move');
            expect(grid.dropPreview()).not.toBeNull();
        });

        it('onContainerDragOver leaves the drop preview alone when not editable, without dataTransfer, or for a missing dragged item', () => {
            const grid = getGrid();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const dragOver = (dataTransfer: unknown): { prevented: boolean } => {
                const ev = new Event('dragover') as DragEvent;
                const result = { prevented: false };
                Object.defineProperty(ev, 'preventDefault', { value: () => { result.prevented = true; } });
                Object.defineProperty(ev, 'clientX', { value: 30 });
                Object.defineProperty(ev, 'clientY', { value: 40 });
                Object.defineProperty(ev, 'currentTarget', { value: containerEl });
                Object.defineProperty(ev, 'dataTransfer', { value: dataTransfer });
                grid.onContainerDragOver(ev);
                return result;
            };

            expect(dragOver(null).prevented).toBe(false);

            component.editable.set(true);
            fixture.detectChanges();
            expect(() => dragOver(null)).not.toThrow();

            grid.draggedItemId.set('ghost');
            dragOver({ types: [], dropEffect: '' });
            expect(grid.dropPreview()).toBeNull();
        });
    });

    describe('drop handlers', () => {
        function dropEventWithData(data: string | null, x = 30, y = 40): DragEvent {
            const ev = new Event('drop') as DragEvent;
            Object.defineProperty(ev, 'clientX', { value: x });
            Object.defineProperty(ev, 'clientY', { value: y });
            const dt = {
                dropEffect: '',
                getData: () => data ?? '',
            };
            Object.defineProperty(ev, 'dataTransfer', { value: dt });
            return ev;
        }

        it('onDrop handles internal drop and emits moved items', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('1');
            grid.dropPreview.set({ x: 4, y: 3, cols: 2, rows: 1 });
            const ev = dropEventWithData(null);
            const target: DashboardItem = { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: '' };
            grid.onDrop(ev, target);
            expect(component.lastItemsChange).toBeTruthy();
            const moved = component.lastItemsChange!.find(i => i.id === '1');
            expect(moved!.x).toBe(4);
            expect(moved!.y).toBe(3);
            expect(grid.draggedItemId()).toBeNull();
        });

        it('onDrop emits an external widget drop, and ignores invalid JSON and an empty payload', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const externalDrops: { widgetId: string; targetId: string | null }[] = [];
            grid.externalDrop.subscribe(e => externalDrops.push(e));
            const target: DashboardItem = { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: '' };

            grid.onDrop(dropEventWithData('{not json'), target);
            grid.onDrop(dropEventWithData(null), target);
            expect(externalDrops).toHaveLength(0);

            grid.onDrop(dropEventWithData(JSON.stringify({ type: 'widget', id: 'w9' })), target);
            expect(externalDrops).toEqual([{ widgetId: 'w9', targetId: '2' }]);
        });

        it('onDrop commits nothing when not editable, when the dragged item is missing, or when there is no preview', () => {
            const grid = getGrid();
            const target: DashboardItem = { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: '' };
            grid.draggedItemId.set('1');
            grid.onDrop(dropEventWithData(null), target);
            expect(component.lastItemsChange).toBeNull();

            component.editable.set(true);
            fixture.detectChanges();
            grid.dropPreview.set({ x: 2, y: 2, cols: 1, rows: 1 });
            grid.draggedItemId.set('ghost');
            grid.onDrop(dropEventWithData(null), target);
            expect(component.lastItemsChange).toBeNull();
            expect(grid.draggedItemId()).toBeNull();

            grid.draggedItemId.set('1');
            grid.dropPreview.set(null);
            grid.onDrop(dropEventWithData(null), target);
            expect(component.lastItemsChange).toBeNull();
            expect(grid.draggedItemId()).toBeNull();
        });

        it('onContainerDrop moves a dragged item to a free cell', () => {
            component.editable.set(true);
            component.gap.set('0px');
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'a' },
            ]);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('1');
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            mockRect(containerEl, 400, 480);
            // 4 columns of 100px: x 395 is the last column.
            const ev = dropEventWithData(null, 395, 5);
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            grid.onContainerDrop(ev);
            expect(component.lastItemsChange).toEqual([{ id: '1', x: 4, y: 1, cols: 1, rows: 1, content: 'a' }]);
            expect(grid.draggedItemId()).toBeNull();
        });

        it('onContainerDrop emits an external widget drop with coords, and ignores invalid JSON and a non-widget payload', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const rect = containerEl.getBoundingClientRect();
            const drop = (data: string): void => {
                const ev = dropEventWithData(data, rect.left + 10, rect.top + 10);
                Object.defineProperty(ev, 'currentTarget', { value: containerEl });
                grid.onContainerDrop(ev);
            };
            const drops: { widgetId: string; targetId: string | null }[] = [];
            grid.externalDrop.subscribe(e => drops.push(e));

            drop('bad');
            drop(JSON.stringify({ type: 'not-widget' }));
            expect(drops).toHaveLength(0);

            drop(JSON.stringify({ type: 'widget', id: 'wX' }));
            expect(drops).toHaveLength(1);
            expect(drops[0]).toMatchObject({ widgetId: 'wX', targetId: null });
        });

        it('onContainerDrop does nothing when not editable or when the dragged item is missing', () => {
            const grid = getGrid();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const drop = (): void => {
                const ev = dropEventWithData(null);
                Object.defineProperty(ev, 'currentTarget', { value: containerEl });
                grid.onContainerDrop(ev);
            };
            grid.draggedItemId.set('1');
            drop();
            expect(grid.draggedItemId()).toBe('1');

            component.editable.set(true);
            fixture.detectChanges();
            grid.draggedItemId.set('ghost');
            drop();
            expect(component.lastItemsChange).toBeNull();
            expect(grid.draggedItemId()).toBeNull();
        });
    });

    describe('resize (mouse) — all directions', () => {
        function startResize(grid: BentoGridComponent, item: DashboardItem, dir: string): void {
            const itemEl = fixture.debugElement.queryAll(By.css('.bento-item'))
                .find(de => (de.nativeElement as HTMLElement).textContent?.includes(item.content as string))!
                .nativeElement as HTMLElement;
            const ev = new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true });
            Object.defineProperty(ev, 'target', { value: itemEl });
            grid.onResizeStart(ev, item, dir as never);
        }

        beforeEach(() => {
            component.editable.set(true);
            component.gap.set('0px');
            component.items.set([
                { id: '1', x: 2, y: 2, cols: 3, rows: 3, content: 'Resizable' },
            ]);
            component.cols.set(12);
            fixture.detectChanges();
            // 12 columns of 100px, rows of 120px (rowHeight), no gap.
            mockRect(fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement, 1200, 1200);
        });

        it('resizing state is set on start, the item grows south-east on mousemove, and mouseup commits it', () => {
            const grid = getGrid();
            const item = component.items()[0];
            startResize(grid, item, 'se');
            expect(grid.resizingItemId()).toBe('1');
            expect(grid.resizeDirection()).toBe('se');
            expect(grid.resizePreview()).toEqual({ id: '1', cols: 3, rows: 3, x: 2, y: 2 });

            globalThis.window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 340 }));
            expect(grid.resizePreview()).toEqual({ id: '1', cols: 5, rows: 5, x: 2, y: 2 });
            globalThis.window.dispatchEvent(new MouseEvent('mouseup', { clientX: 300, clientY: 340 }));
            expect(grid.resizingItemId()).toBeNull();
            expect(grid.resizePreview()).toBeNull();
            expect(component.lastItemsChange).toEqual([
                { id: '1', x: 2, y: 2, cols: 5, rows: 5, content: 'Resizable' },
            ]);
        });

        it('onResizeStart does nothing when not editable, outside a bento-item, or for an item with no grid ancestor', () => {
            const grid = getGrid();
            const start = (target: EventTarget): void => {
                const ev = new MouseEvent('mousedown', { clientX: 10, clientY: 10 });
                Object.defineProperty(ev, 'target', { value: target });
                grid.onResizeStart(ev, component.items()[0], 'se');
            };
            const detached = document.createElement('div');
            detached.className = 'bento-item';

            component.editable.set(false);
            fixture.detectChanges();
            start(document.body);
            expect(grid.resizingItemId()).toBeNull();

            component.editable.set(true);
            fixture.detectChanges();
            start(document.body);
            start(detached);
            expect(grid.resizingItemId()).toBeNull();
        });

        it.each([
            ['se', { cols: 4, rows: 4, x: 2, y: 2 }],
            ['sw', { cols: 2, rows: 4, x: 3, y: 2 }],
            ['ne', { cols: 4, rows: 2, x: 2, y: 3 }],
            ['nw', { cols: 2, rows: 2, x: 3, y: 3 }],
            ['e', { cols: 4, rows: 3, x: 2, y: 2 }],
            ['w', { cols: 2, rows: 3, x: 3, y: 2 }],
            ['s', { cols: 3, rows: 4, x: 2, y: 2 }],
            ['n', { cols: 3, rows: 2, x: 2, y: 3 }],
        ])('resizing from %s by one step right and down gives %o', (dir, expected) => {
            const grid = getGrid();
            startResize(grid, component.items()[0], dir);
            // One column step (100px) right and one row step (120px) down.
            globalThis.window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 220 }));
            expect(grid.resizePreview()).toEqual({ id: '1', ...expected });
            globalThis.window.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 220 }));
            expect(grid.resizingItemId()).toBeNull();
        });
    });

    describe('resize (touch)', () => {
        beforeEach(() => {
            component.editable.set(true);
            component.items.set([
                { id: '1', x: 2, y: 2, cols: 3, rows: 3, content: 'TouchResize' },
            ]);
            fixture.detectChanges();
        });

        it('onResizeStart works with a touch event', () => {
            const grid = getGrid();
            const itemEl = fixture.debugElement.query(By.css('.bento-item')).nativeElement as HTMLElement;
            const ev = makeTouchEvent('touchstart', [{ clientX: 90, clientY: 90 }], itemEl);
            grid.onResizeStart(ev, component.items()[0], 'se');
            expect(grid.resizingItemId()).toBe('1');
            globalThis.window.dispatchEvent(new MouseEvent('mouseup'));
        });
    });

    describe('touch drag', () => {
        beforeEach(() => {
            component.editable.set(true);
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'TouchDrag' },
            ]);
            fixture.detectChanges();
        });

        it('onTouchDragStart begins drag and moves preview, commits on touchend', () => {
            component.gap.set('0px');
            fixture.detectChanges();
            const grid = getGrid();
            const itemEl = fixture.debugElement.query(By.css('.bento-item')).nativeElement as HTMLElement;
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            mockRect(itemEl, 100, 120);
            mockRect(containerEl, 400, 480);
            const ev = makeTouchEvent('touchstart', [{ clientX: 5, clientY: 5 }], itemEl);
            grid.onTouchDragStart(ev, component.items()[0]);
            expect(grid.draggedItemId()).toBe('1');

            // Grabbed 5px into the card, so x 395 puts the card's left edge in column 4.
            globalThis.window.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 395, clientY: 5 }]));
            expect(grid.dropPreview()).toEqual({ x: 4, y: 1, cols: 1, rows: 1 });

            globalThis.window.dispatchEvent(makeTouchEvent('touchend', []));
            expect(component.lastItemsChange).toEqual([{ id: '1', x: 4, y: 1, cols: 1, rows: 1, content: 'TouchDrag' }]);
            expect(grid.draggedItemId()).toBeNull();
            expect(grid.dropPreview()).toBeNull();
        });

        it('onTouchDragStart does nothing when not editable or while resizing, and falls back to a zeroed rect outside a bento-item', () => {
            const grid = getGrid();
            const start = (): void => grid.onTouchDragStart(
                makeTouchEvent('touchstart', [{ clientX: 15, clientY: 20 }], document.body), component.items()[0]);

            component.editable.set(false);
            fixture.detectChanges();
            start();
            expect(grid.draggedItemId()).toBeNull();

            component.editable.set(true);
            fixture.detectChanges();
            grid.resizingItemId.set('1');
            start();
            expect(grid.draggedItemId()).toBeNull();
            grid.resizingItemId.set(null);

            start();
            expect(grid.dragOffset()).toEqual({ x: 15, y: 20 });
            globalThis.window.dispatchEvent(makeTouchEvent('touchend', []));
        });
    });

    describe('overlap resolution via resize commit', () => {
        it('shrinks a neighbouring item when the resized item overlaps it', () => {
            component.editable.set(true);
            component.gap.set('0px');
            component.items.set([
                { id: 'a', x: 1, y: 1, cols: 2, rows: 2, content: 'A' },
                { id: 'b', x: 3, y: 1, cols: 2, rows: 2, content: 'B' },
            ]);
            component.cols.set(12);
            fixture.detectChanges();
            const grid = getGrid();
            mockRect(fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement, 1200, 1200);
            const itemEl = fixture.debugElement.queryAll(By.css('.bento-item'))[0].nativeElement as HTMLElement;
            const ev = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
            Object.defineProperty(ev, 'target', { value: itemEl });
            grid.onResizeStart(ev, grid.items()[0], 'e');
            // One 100px column step east: 'a' now covers column 3, the left half of 'b'.
            globalThis.window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 100 }));
            globalThis.window.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 100 }));
            expect(component.lastItemsChange).toEqual([
                { id: 'a', x: 1, y: 1, cols: 3, rows: 2, content: 'A' },
                { id: 'b', x: 4, y: 1, cols: 1, rows: 2, content: 'B' },
            ]);
        });
    });

    interface GridInternals {
        parseCssDimension(value: string, referenceValue?: number): number;
        shrinkItem(
            winner: { x: number; y: number; cols: number; rows: number },
            loser: DashboardItem,
        ): DashboardItem | null;
        resolveOverlaps(
            items: DashboardItem[],
            updatedItem: { x: number; y: number; cols: number; rows: number },
            excludeId: string,
        ): DashboardItem[];
        handleResizeMove(clientX: number, clientY: number): void;
        computeResizeDeltas(
            clientX: number,
            clientY: number,
            rawDirection: string,
        ): { deltaX: number; deltaY: number; direction: string };
        computeResizePreview(
            direction: string,
            deltaX: number,
            deltaY: number,
        ): { cols: number; rows: number; x: number; y: number };
        getColWidth(containerWidth: number): number;
        getGridCoordinates(event: DragEvent | MouseEvent): { x: number; y: number };
        menu(): { show(x: number, y: number, data?: unknown): void } | undefined;
        handleTouchDragMove(clientX: number, clientY: number, item: DashboardItem): void;
        handleTouchDragEnd(): void;
        handleResizeEnd(): void;
        flipResizeDirectionForRtl(direction: string): string;
        commitResize(): void;
        initialResizeState: unknown;
    }

    function priv(grid: BentoGridComponent): GridInternals {
        return grid as unknown as GridInternals;
    }

    function hostEl(): HTMLElement {
        return fixture.debugElement.query(By.directive(BentoGridComponent)).nativeElement as HTMLElement;
    }

    function makeDrop(clientX: number, clientY: number, currentTarget?: EventTarget): DragEvent {
        const ev = new Event('drop') as DragEvent;
        Object.defineProperty(ev, 'clientX', { value: clientX });
        Object.defineProperty(ev, 'clientY', { value: clientY });
        Object.defineProperty(ev, 'dataTransfer', {
            value: { dropEffect: '', getData: () => '' },
        });
        if (currentTarget) {
            Object.defineProperty(ev, 'currentTarget', { value: currentTarget });
        }
        return ev;
    }

    describe('input transforms — remaining branches', () => {

        it('transforms numeric-string rowHeight and columnWidth to px', () => {
            const f = makeStandaloneGrid();
            f.componentRef.setInput('rowHeight', '150');
            f.componentRef.setInput('columnWidth', '90');
            f.detectChanges();
            expect(f.componentInstance.rowHeight()).toBe('150px');
            expect(f.componentInstance.columnWidth()).toBe('90px');
        });

        it('transforms numeric gap to px', () => {
            const f = makeStandaloneGrid();
            f.componentRef.setInput('gap', 20);
            f.detectChanges();
            expect(f.componentInstance.gap()).toBe('20px');
        });

        it('transforms numeric-string borderRadius/itemPadding and keeps unit strings', () => {
            const f = makeStandaloneGrid();
            f.componentRef.setInput('borderRadius', '10');
            f.componentRef.setInput('itemPadding', '8');
            f.detectChanges();
            expect(f.componentInstance.borderRadius()).toBe('10px');
            expect(f.componentInstance.itemPadding()).toBe('8px');

            f.componentRef.setInput('borderRadius', '2rem');
            f.componentRef.setInput('itemPadding', '3rem');
            f.detectChanges();
            expect(f.componentInstance.borderRadius()).toBe('2rem');
            expect(f.componentInstance.itemPadding()).toBe('3rem');
        });
    });

    describe('parseCssDimension units', () => {
        it('parses empty, non-numeric, em, %, and unitless values', () => {
            const p = priv(getGrid());
            expect(p.parseCssDimension('')).toBe(0);
            expect(p.parseCssDimension('auto')).toBe(0);
            expect(p.parseCssDimension('2em')).toBeGreaterThan(0);
            expect(p.parseCssDimension('10%', 200)).toBe(20);
            expect(p.parseCssDimension('10pt')).toBe(10);
        });
    });

    it('emits nothing for an undefined delete id or an unknown split id', () => {
        component.editable.set(true);
        fixture.detectChanges();
        getGrid().deleteItem(undefined);
        getGrid().splitItem('does-not-exist', 'vertical');
        expect(component.lastItemsChange).toBeNull();
    });

    it('resize helpers fall back safely when no resize is in flight', () => {
        const grid = getGrid();
        const p = priv(grid);
        expect(p.computeResizeDeltas(50, 60, 'se')).toEqual({ deltaX: 0, deltaY: 0, direction: 'se' });
        expect(p.computeResizePreview('se', 100, 100)).toEqual({ cols: 1, rows: 1, x: 1, y: 1 });
        expect(p.flipResizeDirectionForRtl('bogus')).toBe('bogus');

        p.commitResize();
        expect(component.lastItemsChange).toBeNull();

        grid.resizingItemId.set('1');
        grid.resizePreview.set(null);
        p.handleResizeEnd();
        expect(grid.resizingItemId()).toBeNull();

        grid.resizingItemId.set('ghost');
        grid.resizePreview.set({ id: 'ghost', cols: 2, rows: 2, x: 1, y: 1 });
        p.commitResize();
        expect(grid.resizingItemId()).toBeNull();
        expect(component.lastItemsChange).toBeNull();
    });

    describe('RTL coordinate mirroring', () => {
        it('mirrors drop coordinates and honours the drag offset in RTL', () => {
            component.editable.set(true);
            component.gap.set('0px');
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'a' },
            ]);
            fixture.detectChanges();
            hostEl().style.direction = 'rtl';
            const grid = getGrid();
            grid.draggedItemId.set('1');
            grid.dragOffset.set({ x: 5, y: 5 });
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            mockRect(containerEl, 400, 480);
            // 302 - 5 offset = 297, i.e. 103px from the right edge: column 2. LTR would give
            // column 3, and ignoring the offset column 1.
            grid.onContainerDrop(makeDrop(302, 50, containerEl));
            expect(component.lastItemsChange).toEqual([{ id: '1', x: 2, y: 1, cols: 1, rows: 1, content: 'a' }]);
            expect(grid.draggedItemId()).toBeNull();
        });

        it('flips the resize direction and mirrors deltas in RTL', () => {
            const grid = getGrid();
            hostEl().style.direction = 'rtl';
            priv(grid).initialResizeState = {
                x: 0, y: 0, w: 100, h: 100, cols: 2, rows: 2,
                itemX: 3, itemY: 3, colStep: 100, rowStep: 100,
            };
            const result = priv(grid).computeResizeDeltas(30, 40, 'ne');
            expect(result.deltaX).toBe(-30);
            expect(result.deltaY).toBe(40);
            expect(result.direction).toBe('nw');
        });

        it('mirrors touch-drag coordinates in RTL', () => {
            component.editable.set(true);
            component.gap.set('0px');
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'a' },
            ]);
            fixture.detectChanges();
            hostEl().style.direction = 'rtl';
            const grid = getGrid();
            mockRect(fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement, 400, 480);
            grid.dragOffset.set({ x: 3, y: 3 });
            // 80 - 3 = 77, i.e. 323px from the right edge: column 4 (LTR would be column 1).
            priv(grid).handleTouchDragMove(80, 40, component.items()[0]);
            expect(grid.dropPreview()).toEqual({ x: 4, y: 1, cols: 1, rows: 1 });
        });
    });

    describe('shrinkItem geometry', () => {
        it('produces strips on all sides and keeps the largest fragment, the later one on a tie', () => {
            const p = priv(getGrid());
            const tie = p.shrinkItem({ x: 2, y: 2, cols: 1, rows: 1 }, { id: 'l', x: 1, y: 1, cols: 3, rows: 3, content: '' });
            // All four strips have area 3; a tie goes to the last candidate, the right strip.
            expect(tie).toEqual({ id: 'l', x: 3, y: 1, cols: 1, rows: 3, content: '' });

            // Candidates: top 15, bottom 12, left 20. Top survives bottom, then left wins.
            const larger = p.shrinkItem({ x: 2, y: 5, cols: 10, rows: 1 }, { id: 'l', x: 0, y: 0, cols: 3, rows: 10, content: '' });
            expect(larger).toEqual({ id: 'l', x: 0, y: 0, cols: 2, rows: 10, content: '' });
        });

        it('keeps non-overlapping items via resolveOverlaps when shrink yields null (white-box: unreachable through the public API, the real shrinkItem returns the loser itself when nothing overlaps)', () => {
            const grid = getGrid();
            const p = priv(grid);
            const spy = vi.spyOn(p, 'shrinkItem').mockReturnValue(null);
            const items: DashboardItem[] = [
                { id: 'x', x: 1, y: 1, cols: 1, rows: 1, content: '' },
                { id: 'y', x: 6, y: 6, cols: 1, rows: 1, content: '' },
            ];
            const result = p.resolveOverlaps(items, { x: 1, y: 1, cols: 1, rows: 1 }, 'x');
            spy.mockRestore();
            expect(result).toEqual(items);
        });
    });

    describe('columnWidth drives the rendered tracks', () => {
        it('renders the fixed track width it hit-tests against', () => {
            const f = TestBed.createComponent(BentoGridComponent);
            f.componentRef.setInput('cols', 4);
            f.componentRef.setInput('columnWidth', '100px');
            f.componentRef.setInput('gap', '0px');
            f.detectChanges();

            expect(f.componentInstance.gridTemplateColumns()).toBe('repeat(4, 100px)');
            expect(f.componentInstance.gridStyles()['grid-template-columns']).toBe('repeat(4, 100px)');
            expect(priv(f.componentInstance).getColWidth(1000)).toBe(100);

            const gridEl = f.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            expect(gridEl.style.gridTemplateColumns).toBe('repeat(4, 100px)');
        });
    });

    describe('internal drop on empty canvas', () => {
        it('shrinks the neighbour the move overlaps instead of discarding it', () => {
            component.editable.set(true);
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'a' },
                { id: '2', x: 2, y: 1, cols: 2, rows: 1, content: 'b' },
            ]);
            fixture.detectChanges();

            const grid = getGrid();
            vi.spyOn(priv(grid), 'getGridCoordinates').mockReturnValue({ x: 2, y: 1 });
            grid.draggedItemId.set('1');

            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            grid.onContainerDrop(makeDrop(10, 10, containerEl));

            expect(component.lastItemsChange).toBeTruthy();
            const moved = component.lastItemsChange!.find(i => i.id === '1')!;
            expect(moved.x).toBe(2);
            const neighbour = component.lastItemsChange!.find(i => i.id === '2')!;
            expect(neighbour.x).toBe(3);
            expect(neighbour.cols).toBe(1);
        });
    });

    describe('long-press context menus (touch)', () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        const longPress = (target: HTMLElement, clientX: number, clientY: number): void => {
            target.dispatchEvent(makeTouchEvent('touchstart', [{ clientX, clientY }]));
            vi.advanceTimersByTime(600);
            globalThis.window.dispatchEvent(makeTouchEvent('touchend', []));
            target.dispatchEvent(makeTouchEvent('touchend', []));
        };

        it('opens the widget menu when a widget is held', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            const menu = priv(grid).menu()!;
            const show = vi.spyOn(menu, 'show').mockImplementation(() => undefined);

            const itemEl = fixture.debugElement.queryAll(By.css('.bento-item'))[1].nativeElement as HTMLElement;
            const rect = itemEl.getBoundingClientRect();
            longPress(itemEl, rect.left + 3, rect.top + 3);

            expect(show).toHaveBeenCalledTimes(1);
            expect((show.mock.calls[0][2] as DashboardItem).id).toBe('2');
        });

        it('opens the add-here menu when a free cell is held', () => {
            component.editable.set(true);
            component.items.set([]);
            fixture.detectChanges();

            const grid = getGrid();
            const menu = priv(grid).menu()!;
            const show = vi.spyOn(menu, 'show').mockImplementation(() => undefined);

            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const rect = containerEl.getBoundingClientRect();
            longPress(containerEl, rect.left + 2, rect.top + 2);

            expect(show).toHaveBeenCalledTimes(1);
            expect((show.mock.calls[0][2] as { type: string }).type).toBe('empty');
        });

        it('does not open a menu while not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();

            const grid = getGrid();
            const menu = priv(grid).menu()!;
            const show = vi.spyOn(menu, 'show').mockImplementation(() => undefined);

            const itemEl = fixture.debugElement.queryAll(By.css('.bento-item'))[0].nativeElement as HTMLElement;
            const rect = itemEl.getBoundingClientRect();
            longPress(itemEl, rect.left + 3, rect.top + 3);

            expect(show).not.toHaveBeenCalled();
        });
    });

    describe('handleTouchDragMove guard', () => {
        it('returns early when the grid container is not found', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const spy = vi.spyOn(hostEl(), 'querySelector').mockReturnValue(null);
            priv(grid).handleTouchDragMove(10, 10, component.items()[0]);
            spy.mockRestore();
            expect(grid.dropPreview()).toBeNull();
        });
    });

    describe('onContainerDrop overlap handling', () => {
        it('commits the move and evicts a neighbour that cannot shrink', () => {
            component.editable.set(true);
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'a' },
                { id: '2', x: 2, y: 1, cols: 1, rows: 1, content: 'b' },
            ]);
            component.cols.set(4);
            component.gap.set('0px');
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('1');
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const spy = vi.spyOn(containerEl, 'getBoundingClientRect').mockReturnValue({
                left: 0, top: 0, right: 400, bottom: 120, width: 400, height: 120, x: 0, y: 0, toJSON: () => ({}),
            });
            const ev = makeDrop(100 + 5, 5, containerEl);
            grid.onContainerDrop(ev);
            spy.mockRestore();
            expect(component.lastItemsChange).toEqual([
                { id: '1', x: 2, y: 1, cols: 1, rows: 1, content: 'a' },
            ]);
            expect(grid.draggedItemId()).toBeNull();
        });
    });

    it('a touch drag ends without emitting when there is no drop preview or the dragged item is missing', () => {
        component.editable.set(true);
        fixture.detectChanges();
        const grid = getGrid();
        grid.draggedItemId.set('1');
        grid.dropPreview.set(null);
        priv(grid).handleTouchDragEnd();
        expect(component.lastItemsChange).toBeNull();
        expect(grid.draggedItemId()).toBeNull();

        grid.draggedItemId.set('ghost');
        grid.dropPreview.set({ x: 1, y: 1, cols: 1, rows: 1 });
        priv(grid).handleTouchDragEnd();
        expect(component.lastItemsChange).toBeNull();
        expect(grid.draggedItemId()).toBeNull();
    });

    describe('getGridCoordinatesFromPoint without a drag offset', () => {
        it('uses the raw pointer coordinates when dragOffset is null', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            grid.dragOffset.set(null);
            priv(grid).handleTouchDragMove(10, 10, component.items()[0]);
            expect(grid.dropPreview()).not.toBeNull();
        });
    });
});

describe('BentoGridItemComponent', () => {
    it('applies the column and row spans as grid styles', async () => {
        await TestBed.configureTestingModule({ imports: [BentoGridItemComponent] }).compileComponents();
        const fixture = TestBed.createComponent(BentoGridItemComponent);
        fixture.componentRef.setInput('span', 2);
        fixture.componentRef.setInput('rowSpan', 3);
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div')).nativeElement as HTMLElement;
        expect(div.style.gridColumn).toBe('span 2');
        expect(div.style.gridRow).toBe('span 3');
    });
});
