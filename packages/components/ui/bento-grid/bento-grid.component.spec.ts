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

    it('should display string content in items', () => {
        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items).toHaveLength(3);
        expect(items[0].nativeElement.textContent).toContain('Item 1');
        expect(items[1].nativeElement.textContent).toContain('Item 2');
        expect(items[2].nativeElement.textContent).toContain('Item 3');
    });

    it('should apply border class when showBorders is true', () => {
        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items[0].nativeElement.classList.contains('border')).toBe(true);
    });

    it('should not apply border class when showBorders and editable are both false', async () => {
        component.showBorders.set(false);
        component.editable.set(false);
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items[0].nativeElement.classList.contains('border')).toBe(false);
    });

    it('should set grid-auto-rows style from rowHeight input', () => {
        const gridEl = fixture.debugElement.query(By.css('.grid'));
        expect(gridEl.nativeElement.style.gridAutoRows).toBe('120px');
    });

    it('should set gap style from gap input', () => {
        const gridEl = fixture.debugElement.query(By.css('.grid'));
        expect(gridEl.nativeElement.style.gap).toBe('1rem');
    });

    describe('Selection toggle', () => {
        it('should deselect an item when toggleSelection is called again on a selected item', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', false);
            expect(grid.isSelected('1')).toBe(true);

            grid.toggleSelection('1', false);
            expect(grid.isSelected('1')).toBe(false);
        });

        it('should emit selectionChange when toggling selection', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', false);

            expect(component.lastSelectionChange).toEqual(['1']);
        });
    });

    describe('Multi-selection', () => {
        it('should replace selection when multi=false', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', false);
            expect(grid.isSelected('1')).toBe(true);

            grid.toggleSelection('2', false);
            expect(grid.isSelected('1')).toBe(false);
            expect(grid.isSelected('2')).toBe(true);
        });
    });

    describe('Clear selection', () => {
        it('should clear all selected items', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);
            expect(grid.isSelected('1')).toBe(true);
            expect(grid.isSelected('2')).toBe(true);

            grid.clearSelection();

            expect(grid.isSelected('1')).toBe(false);
            expect(grid.isSelected('2')).toBe(false);
        });

        it('should emit selectionChange with empty array when clearing', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.clearSelection();

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

    describe('areAdjacent', () => {
        it('should return true for horizontally touching items', () => {
            const grid = getGrid();
            const a: DashboardItem = { id: 'a', x: 1, y: 1, cols: 2, rows: 1, content: '' };
            const b: DashboardItem = { id: 'b', x: 3, y: 1, cols: 1, rows: 1, content: '' };

            expect(grid.areAdjacent(a, b)).toBe(true);
        });

        it('should return true for vertically touching items', () => {
            const grid = getGrid();
            const a: DashboardItem = { id: 'a', x: 1, y: 1, cols: 2, rows: 1, content: '' };
            const b: DashboardItem = { id: 'b', x: 1, y: 2, cols: 1, rows: 1, content: '' };

            expect(grid.areAdjacent(a, b)).toBe(true);
        });

        it('should return false for non-touching items', () => {
            const grid = getGrid();
            const a: DashboardItem = { id: 'a', x: 1, y: 1, cols: 1, rows: 1, content: '' };
            const b: DashboardItem = { id: 'b', x: 3, y: 3, cols: 1, rows: 1, content: '' };

            expect(grid.areAdjacent(a, b)).toBe(false);
        });

        it('should return false for diagonally touching items', () => {
            const grid = getGrid();
            const a: DashboardItem = { id: 'a', x: 1, y: 1, cols: 1, rows: 1, content: '' };
            const b: DashboardItem = { id: 'b', x: 2, y: 2, cols: 1, rows: 1, content: '' };

            expect(grid.areAdjacent(a, b)).toBe(false);
        });

        it('should return true when items share an edge (b is left of a)', () => {
            const grid = getGrid();
            const a: DashboardItem = { id: 'a', x: 3, y: 1, cols: 1, rows: 1, content: '' };
            const b: DashboardItem = { id: 'b', x: 1, y: 1, cols: 2, rows: 1, content: '' };

            expect(grid.areAdjacent(a, b)).toBe(true);
        });
    });

    describe('canMerge', () => {
        it('should return false when selected items are not adjacent', () => {
            component.editable.set(true);
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'Item 1' },
                { id: '2', x: 4, y: 4, cols: 1, rows: 1, content: 'Item 2' },
            ]);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);

            expect(grid.canMerge()).toBe(false);
        });
    });

    describe('mergeSelected', () => {
        it('should merge two adjacent items into one covering the bounding box', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);

            expect(grid.canMerge()).toBe(true);

            grid.mergeSelected();

            expect(component.lastItemsChange).toBeTruthy();
            const merged = component.lastItemsChange!;

            const mergedItem = merged.find(i => i.id === '1');
            expect(mergedItem).toBeTruthy();
            expect(mergedItem!.x).toBe(1);
            expect(mergedItem!.y).toBe(1);
            expect(mergedItem!.cols).toBe(3);
            expect(mergedItem!.rows).toBe(1);

            expect(merged.find(i => i.id === '2')).toBeUndefined();
        });

        it('should clear selection after merging', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);
            grid.mergeSelected();

            expect(grid.isSelected('1')).toBe(false);
            expect(grid.isSelected('2')).toBe(false);
        });

        it('should not merge when canMerge is false', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.mergeSelected();

            expect(component.lastItemsChange).toBeNull();
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

        it('should not split an item with cols < 2', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.splitItem('2', 'vertical');

            expect(component.lastItemsChange).toBeNull();
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

        it('should not split an item with rows < 2', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.splitItem('1', 'horizontal');

            expect(component.lastItemsChange).toBeNull();
        });
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

        it('should produce grid cells when editable', () => {
            component.editable.set(true);
            fixture.detectChanges();
            // 4 cols x (max(8, lowest item bottom 3) + 2 spare rows)
            expect(getGrid().gridCells()).toHaveLength(40);
        });

        it('should produce no grid cells when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            expect(getGrid().gridCells()).toHaveLength(0);
        });
    });

    describe('input transforms', () => {

        it('should transform numeric rowHeight to px', () => {
            const f = makeStandaloneGrid();
            f.componentRef.setInput('rowHeight', 200);
            f.detectChanges();
            expect(f.componentInstance.rowHeight()).toBe('200px');
        });

        it('should transform numeric-string gap to px', () => {
            const f = makeStandaloneGrid();
            f.componentRef.setInput('gap', '24');
            f.detectChanges();
            expect(f.componentInstance.gap()).toBe('24px');
        });

        it('should keep non-numeric rowHeight unchanged', () => {
            const f = makeStandaloneGrid();
            f.componentRef.setInput('rowHeight', '5rem');
            f.detectChanges();
            expect(f.componentInstance.rowHeight()).toBe('5rem');
        });

        it('should transform numeric columnWidth / borderRadius / itemPadding', () => {
            const f = makeStandaloneGrid();
            f.componentRef.setInput('columnWidth', 80);
            f.componentRef.setInput('borderRadius', 8);
            f.componentRef.setInput('itemPadding', 12);
            f.detectChanges();
            expect(f.componentInstance.columnWidth()).toBe('80px');
            expect(f.componentInstance.borderRadius()).toBe('8px');
            expect(f.componentInstance.itemPadding()).toBe('12px');
        });
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

        it('castMenuData should return null for nullish', () => {
            expect(getGrid().castMenuData(null)).toBeNull();
            expect(getGrid().castMenuData(undefined)).toBeNull();
        });

        it('isDragging reflects draggedItemId', () => {
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

        it('onContextMenu shows menu with item when editable', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const menu = fakeMenu();
            const item: DashboardItem = { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' };
            const ev = new MouseEvent('contextmenu', { clientX: 50, clientY: 60 });
            grid.onContextMenu(ev, item, menu as never);
            expect(menu.calls).toHaveLength(1);
            expect(menu.calls[0]).toEqual([50, 60, item]);
        });

        it('onContextMenu does nothing when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            const grid = getGrid();
            const menu = fakeMenu();
            const item: DashboardItem = { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' };
            grid.onContextMenu(new MouseEvent('contextmenu'), item, menu as never);
            expect(menu.calls).toHaveLength(0);
        });

        it('onContainerContextMenu shows empty-cell menu on free cell', () => {
            component.editable.set(true);
            component.items.set([]);
            fixture.detectChanges();
            const grid = getGrid();
            const menu = fakeMenu();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const ev = new MouseEvent('contextmenu', { clientX: 5, clientY: 5 });
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            Object.defineProperty(ev, 'target', { value: containerEl });
            grid.onContainerContextMenu(ev, menu as never);
            expect(menu.calls).toHaveLength(1);
            expect((menu.calls[0][2] as { type: string }).type).toBe('empty');
        });

        it('onContainerContextMenu ignores clicks on a bento-item', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const menu = fakeMenu();
            const itemEl = fixture.debugElement.query(By.css('.bento-item')).nativeElement as HTMLElement;
            const ev = new MouseEvent('contextmenu');
            Object.defineProperty(ev, 'target', { value: itemEl });
            grid.onContainerContextMenu(ev, menu as never);
            expect(menu.calls).toHaveLength(0);
        });

        it('onContainerContextMenu does nothing when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            const grid = getGrid();
            const menu = fakeMenu();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const ev = new MouseEvent('contextmenu');
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            Object.defineProperty(ev, 'target', { value: containerEl });
            grid.onContainerContextMenu(ev, menu as never);
            expect(menu.calls).toHaveLength(0);
        });

        it('onContainerContextMenu does not show menu over an occupied cell', () => {
            component.editable.set(true);
            component.items.set([
                { id: 'big', x: 1, y: 1, cols: 12, rows: 12, content: '' },
            ]);
            component.cols.set(12);
            fixture.detectChanges();
            const grid = getGrid();
            const menu = fakeMenu();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const rect = containerEl.getBoundingClientRect();
            const ev = new MouseEvent('contextmenu', { clientX: rect.left + 5, clientY: rect.top + 5 });
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            Object.defineProperty(ev, 'target', { value: containerEl });
            grid.onContainerContextMenu(ev, menu as never);
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

        it('onDragStart sets draggedItemId and dragOffset', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const itemEl = fixture.debugElement.query(By.css('.bento-item')).nativeElement as HTMLElement;
            const ev = makeDragEvent('dragstart', 100, 100);
            Object.defineProperty(ev, 'target', { value: itemEl });
            grid.onDragStart(ev, { id: '1', x: 1, y: 1, cols: 2, rows: 1, content: '' });
            expect(grid.draggedItemId()).toBe('1');
            expect(grid.dragOffset()).not.toBeNull();
            expect(ev.dataTransfer!.effectAllowed).toBe('move');
        });

        it('onDragStart does nothing when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = makeDragEvent('dragstart');
            Object.defineProperty(ev, 'target', { value: document.body });
            grid.onDragStart(ev, { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' });
            expect(grid.draggedItemId()).toBeNull();
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

        it('onDragOver sets dropEffect move when editable', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = makeDragEvent('dragover');
            grid.onDragOver(ev, { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' });
            expect(ev.dataTransfer!.dropEffect).toBe('move');
        });

        it('onDragOver does nothing when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = makeDragEvent('dragover');
            grid.onDragOver(ev, { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' });
            expect(ev.dataTransfer!.dropEffect).toBe('');
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

        it('onDrop handles external widget drop', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = dropEventWithData(JSON.stringify({ type: 'widget', id: 'w9' }));
            const externalDrops: { widgetId: string; targetId: string | null }[] = [];
            grid.externalDrop.subscribe(e => externalDrops.push(e));
            grid.onDrop(ev, { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: '' });
            expect(externalDrops).toHaveLength(1);
            expect(externalDrops[0].widgetId).toBe('w9');
            expect(externalDrops[0].targetId).toBe('2');
        });

        it('onDrop ignores invalid external JSON', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = dropEventWithData('{not json');
            const drops: unknown[] = [];
            grid.externalDrop.subscribe(e => drops.push(e));
            grid.onDrop(ev, { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: '' });
            expect(drops).toHaveLength(0);
        });

        it('onDrop does nothing when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('1');
            grid.onDrop(dropEventWithData(null), { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: '' });
            expect(component.lastItemsChange).toBeNull();
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

        it('onContainerDrop emits external widget drop with coords', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const rect = containerEl.getBoundingClientRect();
            const ev = dropEventWithData(JSON.stringify({ type: 'widget', id: 'wX' }), rect.left + 10, rect.top + 10);
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            const drops: { widgetId: string; targetId: string | null }[] = [];
            grid.externalDrop.subscribe(e => drops.push(e));
            grid.onContainerDrop(ev);
            expect(drops).toHaveLength(1);
            expect(drops[0].widgetId).toBe('wX');
            expect(drops[0].targetId).toBeNull();
        });

        it('onContainerDrop ignores invalid JSON', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const ev = dropEventWithData('bad', 10, 10);
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            const drops: unknown[] = [];
            grid.externalDrop.subscribe(e => drops.push(e));
            grid.onContainerDrop(ev);
            expect(drops).toHaveLength(0);
        });

        it('onContainerDrop does nothing when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('1');
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const ev = dropEventWithData(null);
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            grid.onContainerDrop(ev);
            expect(grid.draggedItemId()).toBe('1');
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

        it('onResizeStart sets resizing state and preview', () => {
            const grid = getGrid();
            const item = component.items()[0];
            startResize(grid, item, 'se');
            expect(grid.resizingItemId()).toBe('1');
            expect(grid.resizeDirection()).toBe('se');
            expect(grid.resizePreview()).toEqual({ id: '1', cols: 3, rows: 3, x: 2, y: 2 });
        });

        it('does nothing when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
            Object.defineProperty(ev, 'target', { value: document.body });
            grid.onResizeStart(ev, component.items()[0], 'se');
            expect(grid.resizingItemId()).toBeNull();
        });

        it('mousemove grows item to the south-east then commits on mouseup', () => {
            const grid = getGrid();
            const item = component.items()[0];
            startResize(grid, item, 'se');
            globalThis.window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 340 }));
            expect(grid.resizePreview()).toEqual({ id: '1', cols: 5, rows: 5, x: 2, y: 2 });
            globalThis.window.dispatchEvent(new MouseEvent('mouseup', { clientX: 300, clientY: 340 }));
            expect(grid.resizingItemId()).toBeNull();
            expect(grid.resizePreview()).toBeNull();
            expect(component.lastItemsChange).toEqual([
                { id: '1', x: 2, y: 2, cols: 5, rows: 5, content: 'Resizable' },
            ]);
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

        it('onTouchDragStart does nothing when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = makeTouchEvent('touchstart', [{ clientX: 10, clientY: 10 }], document.body);
            grid.onTouchDragStart(ev, component.items()[0]);
            expect(grid.draggedItemId()).toBeNull();
        });

        it('onTouchDragStart is ignored while resizing', () => {
            const grid = getGrid();
            grid.resizingItemId.set('1');
            const ev = makeTouchEvent('touchstart', [{ clientX: 10, clientY: 10 }], document.body);
            grid.onTouchDragStart(ev, component.items()[0]);
            expect(grid.draggedItemId()).toBeNull();
            grid.resizingItemId.set(null);
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

    describe('canMerge / mergeSelected — remaining paths', () => {
        it('returns false when a selected id is no longer present in items', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);
            component.items.set([
                { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: 'Item 1' },
            ]);
            fixture.detectChanges();
            expect(grid.canMerge()).toBe(false);
        });

        it('sorts vertically-stacked items by row before merging', () => {
            component.editable.set(true);
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

    describe('guard clauses', () => {
        it('deleteItem does nothing for an undefined id', () => {
            component.editable.set(true);
            fixture.detectChanges();
            getGrid().deleteItem(undefined);
            expect(component.lastItemsChange).toBeNull();
        });

        it('splitItem does nothing for an unknown id', () => {
            component.editable.set(true);
            fixture.detectChanges();
            getGrid().splitItem('does-not-exist', 'vertical');
            expect(component.lastItemsChange).toBeNull();
        });

        it('onContainerDragOver does nothing when not editable', () => {
            component.editable.set(false);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = new Event('dragover') as DragEvent;
            let prevented = false;
            Object.defineProperty(ev, 'preventDefault', { value: () => { prevented = true; } });
            grid.onContainerDragOver(ev);
            expect(prevented).toBe(false);
        });

        it('computeResizeDeltas returns raw direction with zero deltas when no initial state', () => {
            const result = priv(getGrid()).computeResizeDeltas(50, 60, 'se');
            expect(result).toEqual({ deltaX: 0, deltaY: 0, direction: 'se' });
        });

        it('computeResizePreview returns a unit preview when no initial state', () => {
            const result = priv(getGrid()).computeResizePreview('se', 100, 100);
            expect(result).toEqual({ cols: 1, rows: 1, x: 1, y: 1 });
        });

        it('commitResize returns early when there is no active resize', () => {
            const grid = getGrid();
            priv(grid).commitResize();
            expect(component.lastItemsChange).toBeNull();
        });
    });

    describe('internal drop edge cases', () => {
        it('ignores an internal drop whose dragged item is missing from items', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('ghost');
            grid.dropPreview.set({ x: 2, y: 2, cols: 1, rows: 1 });
            const ev = makeDrop(10, 10);
            Object.defineProperty(ev, 'stopPropagation', { value: () => undefined });
            grid.onDrop(ev, { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: '' });
            expect(component.lastItemsChange).toBeNull();
            expect(grid.draggedItemId()).toBeNull();
        });

        it('ignores an external drop with no payload', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const drops: unknown[] = [];
            grid.externalDrop.subscribe(e => drops.push(e));
            const ev = makeDrop(10, 10);
            Object.defineProperty(ev, 'stopPropagation', { value: () => undefined });
            grid.onDrop(ev, { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: '' });
            expect(drops).toHaveLength(0);
        });
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
        it('produces strips on all sides and keeps the largest fragment', () => {
            const p = priv(getGrid());
            const winner = { x: 2, y: 2, cols: 1, rows: 1 };
            const loser: DashboardItem = { id: 'l', x: 1, y: 1, cols: 3, rows: 3, content: '' };
            // All four strips have area 3; a tie goes to the last candidate, the right strip.
            expect(p.shrinkItem(winner, loser)).toEqual({ id: 'l', x: 3, y: 1, cols: 1, rows: 3, content: '' });
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
        const longPress = async (target: HTMLElement, clientX: number, clientY: number): Promise<void> => {
            target.dispatchEvent(makeTouchEvent('touchstart', [{ clientX, clientY }]));
            await new Promise(resolve => setTimeout(resolve, 600));
            globalThis.window.dispatchEvent(makeTouchEvent('touchend', []));
            target.dispatchEvent(makeTouchEvent('touchend', []));
        };

        it('opens the widget menu when a widget is held', async () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            const menu = priv(grid).menu()!;
            const show = vi.spyOn(menu, 'show').mockImplementation(() => undefined);

            const itemEl = fixture.debugElement.queryAll(By.css('.bento-item'))[1].nativeElement as HTMLElement;
            const rect = itemEl.getBoundingClientRect();
            await longPress(itemEl, rect.left + 3, rect.top + 3);

            expect(show).toHaveBeenCalledTimes(1);
            expect((show.mock.calls[0][2] as DashboardItem).id).toBe('2');
        });

        it('opens the add-here menu when a free cell is held', async () => {
            component.editable.set(true);
            component.items.set([]);
            fixture.detectChanges();

            const grid = getGrid();
            const menu = priv(grid).menu()!;
            const show = vi.spyOn(menu, 'show').mockImplementation(() => undefined);

            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const rect = containerEl.getBoundingClientRect();
            await longPress(containerEl, rect.left + 2, rect.top + 2);

            expect(show).toHaveBeenCalledTimes(1);
            expect((show.mock.calls[0][2] as { type: string }).type).toBe('empty');
        });

        it('does not open a menu while not editable', async () => {
            component.editable.set(false);
            fixture.detectChanges();

            const grid = getGrid();
            const menu = priv(grid).menu()!;
            const show = vi.spyOn(menu, 'show').mockImplementation(() => undefined);

            const itemEl = fixture.debugElement.queryAll(By.css('.bento-item'))[0].nativeElement as HTMLElement;
            const rect = itemEl.getBoundingClientRect();
            await longPress(itemEl, rect.left + 3, rect.top + 3);

            expect(show).not.toHaveBeenCalled();
        });
    });

    describe('onResizeStart guards', () => {
        it('returns when the event target is not inside a bento-item', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = new MouseEvent('mousedown', { clientX: 10, clientY: 10 });
            Object.defineProperty(ev, 'target', { value: document.body });
            grid.onResizeStart(ev, component.items()[0], 'se');
            expect(grid.resizingItemId()).toBeNull();
        });

        it('returns when the bento-item has no grid ancestor', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const detached = document.createElement('div');
            detached.className = 'bento-item';
            const ev = new MouseEvent('mousedown', { clientX: 10, clientY: 10 });
            Object.defineProperty(ev, 'target', { value: detached });
            grid.onResizeStart(ev, component.items()[0], 'se');
            expect(grid.resizingItemId()).toBeNull();
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

    describe('onDragOver / onContainerDragOver without dataTransfer', () => {
        it('onDragOver does not throw when dataTransfer is absent', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = new Event('dragover') as DragEvent;
            Object.defineProperty(ev, 'dataTransfer', { value: null });
            expect(() =>
                grid.onDragOver(ev, { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' }),
            ).not.toThrow();
        });

        it('onContainerDragOver does not throw when dataTransfer is absent', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const ev = new Event('dragover') as DragEvent;
            Object.defineProperty(ev, 'dataTransfer', { value: null });
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            expect(() => grid.onContainerDragOver(ev)).not.toThrow();
        });

        it('onContainerDragOver leaves dropPreview untouched when the dragged item is missing', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('ghost');
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const ev = new Event('dragover') as DragEvent;
            Object.defineProperty(ev, 'clientX', { value: 30 });
            Object.defineProperty(ev, 'clientY', { value: 40 });
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            Object.defineProperty(ev, 'dataTransfer', { value: { types: [], dropEffect: '' } });
            grid.onContainerDragOver(ev);
            expect(grid.dropPreview()).toBeNull();
        });
    });

    describe('handleInternalDrop with no preview', () => {
        it('clears drag state without emitting when dropPreview is null', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('1');
            grid.dropPreview.set(null);
            const ev = makeDrop(10, 10);
            Object.defineProperty(ev, 'stopPropagation', { value: () => undefined });
            grid.onDrop(ev, { id: '2', x: 3, y: 1, cols: 1, rows: 1, content: '' });
            expect(component.lastItemsChange).toBeNull();
            expect(grid.draggedItemId()).toBeNull();
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

        it('does nothing when the dragged item is missing from items', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('ghost');
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const ev = makeDrop(10, 10, containerEl);
            grid.onContainerDrop(ev);
            expect(component.lastItemsChange).toBeNull();
            expect(grid.draggedItemId()).toBeNull();
        });

        it('ignores external JSON that is not a widget payload', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const containerEl = fixture.debugElement.query(By.css('.grid')).nativeElement as HTMLElement;
            const ev = new Event('drop') as DragEvent;
            Object.defineProperty(ev, 'clientX', { value: 10 });
            Object.defineProperty(ev, 'clientY', { value: 10 });
            Object.defineProperty(ev, 'currentTarget', { value: containerEl });
            Object.defineProperty(ev, 'dataTransfer', {
                value: { dropEffect: '', getData: () => JSON.stringify({ type: 'not-widget' }) },
            });
            const drops: unknown[] = [];
            grid.externalDrop.subscribe(e => drops.push(e));
            grid.onContainerDrop(ev);
            expect(drops).toHaveLength(0);
        });
    });

    describe('shrinkItem — largest-fragment tie-break', () => {
        it('keeps the earlier candidate when it is strictly larger than the next one', () => {
            const p = priv(getGrid());
            const winner = { x: 2, y: 5, cols: 10, rows: 1 };
            const loser: DashboardItem = { id: 'l', x: 0, y: 0, cols: 3, rows: 10, content: '' };
            // Candidates: top 15, bottom 12, left 20. Top survives bottom, then left wins.
            expect(p.shrinkItem(winner, loser)).toEqual({ id: 'l', x: 0, y: 0, cols: 2, rows: 10, content: '' });
        });
    });

    describe('handleResizeEnd false branch', () => {
        it('does not commit when resizingItemId is set but there is no preview', () => {
            const grid = getGrid();
            grid.resizingItemId.set('1');
            grid.resizePreview.set(null);
            priv(grid).handleResizeEnd();
            expect(component.lastItemsChange).toBeNull();
            expect(grid.resizingItemId()).toBeNull();
        });
    });

    describe('flipResizeDirectionForRtl fallback', () => {
        it('falls back to the input direction for an unmapped value', () => {
            const result = priv(getGrid()).flipResizeDirectionForRtl('bogus');
            expect(result).toBe('bogus');
        });
    });

    describe('onDragStart / onTouchDragStart without a .bento-item ancestor', () => {
        it('onDragStart falls back to a zeroed rect when no bento-item is found', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = new Event('dragstart') as DragEvent;
            Object.defineProperty(ev, 'clientX', { value: 10 });
            Object.defineProperty(ev, 'clientY', { value: 10 });
            Object.defineProperty(ev, 'target', { value: document.body });
            Object.defineProperty(ev, 'dataTransfer', { value: { effectAllowed: '' } });
            grid.onDragStart(ev, { id: '1', x: 1, y: 1, cols: 1, rows: 1, content: '' });
            expect(grid.dragOffset()).toEqual({ x: 10, y: 10 });
        });

        it('onTouchDragStart falls back to a zeroed rect when no bento-item is found', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            const ev = makeTouchEvent('touchstart', [{ clientX: 15, clientY: 20 }], document.body);
            grid.onTouchDragStart(ev, component.items()[0]);
            expect(grid.dragOffset()).toEqual({ x: 15, y: 20 });
            globalThis.window.dispatchEvent(makeTouchEvent('touchend', []));
        });
    });

    describe('handleTouchDragEnd branches', () => {
        it('clears drag state without emitting when there is no drop preview', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('1');
            grid.dropPreview.set(null);
            priv(grid).handleTouchDragEnd();
            expect(component.lastItemsChange).toBeNull();
            expect(grid.draggedItemId()).toBeNull();
        });

        it('clears drag state without emitting when the dragged item is missing from items', () => {
            component.editable.set(true);
            fixture.detectChanges();
            const grid = getGrid();
            grid.draggedItemId.set('ghost');
            grid.dropPreview.set({ x: 1, y: 1, cols: 1, rows: 1 });
            priv(grid).handleTouchDragEnd();
            expect(component.lastItemsChange).toBeNull();
            expect(grid.draggedItemId()).toBeNull();
        });
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

    describe('commitResize false branch', () => {
        it('resets resize state without emitting when the resized item is missing from items', () => {
            const grid = getGrid();
            grid.resizingItemId.set('ghost');
            grid.resizePreview.set({ id: 'ghost', cols: 2, rows: 2, x: 1, y: 1 });
            priv(grid).commitResize();
            expect(component.lastItemsChange).toBeNull();
            expect(grid.resizingItemId()).toBeNull();
        });
    });
});

describe('BentoGridItemComponent', () => {
    let fixture: ComponentFixture<BentoGridItemComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BentoGridItemComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BentoGridItemComponent);
        fixture.detectChanges();
    });

    it('should apply grid-column span style', () => {
        fixture.componentRef.setInput('span', 2);
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.style.gridColumn).toBe('span 2');
    });

    it('should apply grid-row span style', () => {
        fixture.componentRef.setInput('rowSpan', 3);
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.style.gridRow).toBe('span 3');
    });
});
