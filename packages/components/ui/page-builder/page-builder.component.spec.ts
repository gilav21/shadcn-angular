import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageBuilderComponent } from './page-builder.component';
import { ComponentMeta, PageBuilderViewMode, PageData } from './page-builder.types';
import { By } from '@angular/platform-browser';
import { BentoGridComponent } from '../bento-grid.component';
import { Component } from '@angular/core';

@Component({
    template: '<div class="mock-widget">Mock Widget</div>',
    standalone: true
})
class MockWidgetComponent { }

describe('PageBuilderComponent', () => {
    let component: PageBuilderComponent;
    let fixture: ComponentFixture<PageBuilderComponent>;

    const mockComponents: ComponentMeta[] = [
        {
            id: 'mock-widget',
            name: 'Mock Widget',
            category: 'Test',
            icon: 'box',
            component: MockWidgetComponent,
            defaultCols: 2,
            defaultRows: 2
        }
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PageBuilderComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PageBuilderComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('components', mockComponents);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render sidebar with components', () => {
        const sidebar = fixture.debugElement.query(By.css('aside'));
        expect(sidebar).toBeTruthy();

        const category = sidebar.query(By.css('h3'));
        expect(category.nativeElement.textContent).toContain('Test');

        const widget = sidebar.query(By.css('[draggable="true"]'));
        expect(widget).toBeTruthy();
        expect(widget.nativeElement.textContent).toContain('Mock Widget');
    });

    it('should add item when calling addItem', () => {
        component.addItem(mockComponents[0]);
        fixture.detectChanges();

        expect(component.items().length).toBe(1);
        const item = component.items()[0];
        expect(item.content).toBe(MockWidgetComponent);
        expect(item.cols).toBe(2);
        expect(item.rows).toBe(2);
    });

    it('should update grid settings', () => {
        component.gridRowHeight.set('150px');
        fixture.detectChanges();

        expect(component.gridRowHeight()).toBe('150px');
        const bentoGrid = fixture.debugElement.query(By.directive(BentoGridComponent));
        expect(bentoGrid.componentInstance.rowHeight()).toBe('150px');
    });

    it('should handle selection', () => {
        component.addItem(mockComponents[0]);
        fixture.detectChanges();

        const item = component.items()[0];
        component.onSelectionChange([item.id]);
        fixture.detectChanges();

        expect(component.selectedItemId()).toBe(item.id);
    });

    it('should delete selected item', () => {
        component.addItem(mockComponents[0]);
        fixture.detectChanges();

        const item = component.items()[0];
        component.selectedItemId.set(item.id);
        fixture.detectChanges();

        component.onDeleteItem();
        fixture.detectChanges();

        expect(component.items().length).toBe(0);
        expect(component.selectedItemId()).toBeNull();
    });

    it('should default gridRowHeight to 20px and gridSquareCells to true', () => {
        expect(component.gridRowHeight()).toBe('20px');
        expect(component.gridSquareCells()).toBe(true);
    });

    it('should show the Save button by default and hide the Export button', () => {
        const saveBtn = fixture.debugElement.query(By.css('button[title="Save Layout"]'));
        const exportBtn = fixture.debugElement.query(By.css('button[title="Export Layout as File"]'));
        expect(saveBtn).toBeTruthy();
        expect(exportBtn).toBeNull();
    });

    it('should show the Export button when enableExport is true', () => {
        fixture.componentRef.setInput('enableExport', true);
        fixture.detectChanges();
        const exportBtn = fixture.debugElement.query(By.css('button[title="Export Layout as File"]'));
        expect(exportBtn).toBeTruthy();
    });

    it('should hide the Save button when enableSave is false', () => {
        fixture.componentRef.setInput('enableSave', false);
        fixture.detectChanges();
        const saveBtn = fixture.debugElement.query(By.css('button[title="Save Layout"]'));
        expect(saveBtn).toBeNull();
    });

    it('should emit (save) with the current layout when Save is clicked', () => {
        component.addItem(mockComponents[0]);
        fixture.detectChanges();

        let emitted: PageData | undefined;
        component.save.subscribe((payload: PageData) => { emitted = payload; });

        const saveBtn = fixture.debugElement.query(By.css('button[title="Save Layout"]'));
        saveBtn.nativeElement.click();

        expect(emitted).toBeDefined();
        expect(emitted!.items.length).toBe(1);
        expect(emitted!.items[0].componentId).toBe('mock-widget');
        expect(emitted!.grid.rowHeight).toBe('20px');
        expect(emitted!.grid.squareCells).toBe(true);
        expect(typeof emitted!.timestamp).toBe('string');
    });

    it('should emit (viewModeChange) when toggling view mode', () => {
        const emitted: PageBuilderViewMode[] = [];
        component.viewModeChange.subscribe((mode: PageBuilderViewMode) => emitted.push(mode));

        component.toggleViewMode();
        expect(component.viewMode()).toBe('preview');
        expect(emitted).toEqual(['preview']);

        component.toggleViewMode();
        expect(component.viewMode()).toBe('edit');
        expect(emitted).toEqual(['preview', 'edit']);
    });
});
