import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { ColumnDef } from './data-table.types';
import { By } from '@angular/platform-browser';
import {
    LucideAngularModule,
    ArrowDown,
    ArrowUp,
    ChevronsUpDown,
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight
} from 'lucide-angular';

interface TestData {
    id: string;
    name: string;
    role: string;
}

const TEST_DATA: TestData[] = [
    { id: '1', name: 'Alice', role: 'Admin' },
    { id: '2', name: 'Bob', role: 'User' },
    { id: '3', name: 'Charlie', role: 'User' },
    { id: '4', name: 'David', role: 'Admin' },
    { id: '5', name: 'Eve', role: 'Manager' },
];

const TEST_COLUMNS: ColumnDef<TestData>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name', enableSorting: true },
    { accessorKey: 'role', header: 'Role' },
];

describe('DataTableComponent', () => {
    let component: DataTableComponent<TestData>;
    let fixture: ComponentFixture<DataTableComponent<TestData>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                DataTableComponent,
                LucideAngularModule.pick({
                    ArrowDown,
                    ArrowUp,
                    ChevronsUpDown,
                    ChevronsLeft,
                    ChevronLeft,
                    ChevronRight,
                    ChevronsRight
                })
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(DataTableComponent<TestData>);
        component = fixture.componentInstance;

        // Set required inputs
        fixture.componentRef.setInput('data', TEST_DATA);
        fixture.componentRef.setInput('columns', TEST_COLUMNS);

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render correct number of rows', () => {
        // Selector needs to be specific to avoid header row
        const bodyRows = fixture.debugElement.queryAll(By.css('ui-table-body ui-table-row'));
        expect(bodyRows.length).toBe(5);
    });

    it('should filter data correctly', () => {
        component.onFilterChange('Alice');
        fixture.detectChanges();

        expect(component.processedData().length).toBe(1);
        expect(component.processedData()[0].name).toBe('Alice');
    });

    it('should sort data correctly', () => {
        // Sort Ascending
        component.onSortChange('name', 'asc');
        fixture.detectChanges();

        const dataAsc = component.processedData();
        expect(dataAsc[0].name).toBe('Alice');
        expect(dataAsc[4].name).toBe('Eve');

        // Sort Descending
        component.onSortChange('name', 'desc');
        fixture.detectChanges();

        const dataDesc = component.processedData();
        expect(dataDesc[0].name).toBe('Eve');
        expect(dataDesc[4].name).toBe('Alice');
    });

    it('should paginate data correctly', () => {
        // Set page size to 2
        component.paginationState.set({ pageIndex: 0, pageSize: 2 });
        fixture.detectChanges();

        expect(component.processedData().length).toBe(2);
        expect(component.processedData()[0].name).toBe('Alice');

        // Go to next page
        component.onPaginationChange({ pageIndex: 1, pageSize: 2 });
        fixture.detectChanges();

        expect(component.processedData().length).toBe(2);
        expect(component.processedData()[0].name).toBe('Charlie');
    });

    it('should update rowSelection signal when toggled (Logic)', () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.detectChanges();

        const row = TEST_DATA[0];

        // Toggle on
        component.toggleRow(row);
        let selection = component.rowSelection();
        expect(selection['1']).toBeTrue();
        expect(component.isRowSelected(row)).toBeTrue();

        // Toggle off
        component.toggleRow(row);
        selection = component.rowSelection();
        expect(selection['1']).toBeUndefined();
        expect(component.isRowSelected(row)).toBeFalse();
    });

    it('should reflect row selection in view (View)', () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.detectChanges();

        const row = TEST_DATA[0];

        // Manually set selection to avoid any toggle side effects during this specific test
        component.rowSelection.set({ '1': true });
        fixture.detectChanges();

        expect(component.isRowSelected(row)).toBeTrue();

        // Verify checkbox state
        const checkboxEl = fixture.debugElement.query(By.css('ui-checkbox[ariaLabel="Select row"]'));
        expect(checkboxEl).toBeTruthy();
        if (checkboxEl) {
            expect(checkboxEl.componentInstance.checked()).toBeTrue();
        }
    });

    it('should handle row selection - all rows', () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.detectChanges();

        // Toggle all on
        component.toggleAll();
        // Check Logic only first?
        expect(component.isAllSelected()).toBeTrue();
        expect(component.isRowSelected(TEST_DATA[0])).toBeTrue();

        // View update
        fixture.detectChanges();
        expect(component.isRowSelected(TEST_DATA[4])).toBeTrue();

        // Toggle all off
        component.toggleAll();
        expect(component.isAllSelected()).toBeFalse();

        fixture.detectChanges();
        expect(component.isRowSelected(TEST_DATA[0])).toBeFalse();
    });

    it('should apply sticky styles correctly', () => {
        const stickyCol = { accessorKey: 'id', header: 'ID', sticky: true, _stickyLeft: 0, _width: '50px' };

        // Header
        const headerClass = component.getStickyClass(stickyCol, 'header');
        expect(headerClass).toContain('z-30');

        // Cell
        const cellClass = component.getStickyClass(stickyCol, 'cell');
        expect(cellClass).toContain('sticky');
        // Do NOT check left-0 in class for cell

        // Style check
        const style = component.getStickyStyle(stickyCol);
        expect(style['left']).toBe('0px');
        expect(style['width']).toBe('50px');
    });
});
