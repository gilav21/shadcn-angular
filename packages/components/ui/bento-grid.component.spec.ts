import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { BentoGridComponent, BentoGridItemComponent, DashboardItem } from './bento-grid.component';

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

    function getGrid(): BentoGridComponent {
        return fixture.debugElement.query(By.directive(BentoGridComponent)).componentInstance as BentoGridComponent;
    }

    it('should create', () => {
        const grid = fixture.debugElement.query(By.directive(BentoGridComponent));
        expect(grid).toBeTruthy();
    });

    it('should render a grid element', () => {
        const gridEl = fixture.debugElement.query(By.css('.grid'));
        expect(gridEl).toBeTruthy();
    });

    it('should render items as bento-item elements', () => {
        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items.length).toBe(3);
    });

    it('should display string content in items', () => {
        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items[0].nativeElement.textContent).toContain('Item 1');
        expect(items[1].nativeElement.textContent).toContain('Item 2');
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

    it('should update items when input changes', async () => {
        component.items.set([
            { id: 'a', x: 1, y: 1, cols: 1, rows: 1, content: 'New Item' },
        ]);
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('.bento-item'));
        expect(items.length).toBe(1);
        expect(items[0].nativeElement.textContent).toContain('New Item');
    });

    describe('Selection toggle', () => {
        it('should select an item when toggleSelection is called and editable is true', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', false);

            expect(grid.isSelected('1')).toBe(true);
        });

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
        it('should support selecting multiple items with multi=true', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);

            expect(grid.isSelected('1')).toBe(true);
            expect(grid.isSelected('2')).toBe(true);
        });

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
        it('should return true when 2 adjacent items are selected', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);
            grid.toggleSelection('2', true);

            expect(grid.canMerge()).toBe(true);
        });

        it('should return false when fewer than 2 items are selected', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.toggleSelection('1', true);

            expect(grid.canMerge()).toBe(false);
        });

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

            const grid = getGrid();
            grid.deleteItem('2');

            expect(component.lastItemsChange).toBeTruthy();
            expect(component.lastItemsChange!.length).toBe(2);
            expect(component.lastItemsChange!.find(i => i.id === '2')).toBeUndefined();
        });

        it('should keep the other items unchanged after deletion', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.deleteItem('2');

            expect(component.lastItemsChange!.find(i => i.id === '1')).toBeTruthy();
            expect(component.lastItemsChange!.find(i => i.id === '3')).toBeTruthy();
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
            expect(remaining.length).toBe(2);

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
            expect(emittedItems.length).toBe(2);

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
            expect(component.lastItemsChange!.length).toBe(4);

            const addedItem = component.lastItemsChange!.find(
                i => i.x === 4 && i.y === 2 && i.cols === 1 && i.rows === 1
            );
            expect(addedItem).toBeTruthy();
            expect(addedItem!.content).toBe('New Item');
        });

        it('should not emit itemsChange when adding at an overlapping position', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.addItemAt(1, 1, 1, 1);

            expect(component.lastItemsChange).toBeNull();
        });

        it('should detect partial overlap and prevent addition', () => {
            component.editable.set(true);
            fixture.detectChanges();

            const grid = getGrid();
            grid.addItemAt(2, 1, 2, 1);

            expect(component.lastItemsChange).toBeNull();
        });
    });
});

describe('BentoGridItemComponent', () => {
    let fixture: ComponentFixture<BentoGridItemComponent>;
    let component: BentoGridItemComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BentoGridItemComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(BentoGridItemComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have default span of 1', () => {
        expect(component.span()).toBe(1);
    });

    it('should have default rowSpan of 1', () => {
        expect(component.rowSpan()).toBe(1);
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

    it('should apply base styling classes', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.className).toContain('rounded-xl');
        expect(div.nativeElement.className).toContain('border');
    });
});
