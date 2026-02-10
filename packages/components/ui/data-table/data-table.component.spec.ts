import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, it, expect } from 'vitest';
import { DataTableComponent } from './data-table.component';
import { ColumnDef } from './data-table.types';
import { By } from '@angular/platform-browser';

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
        fixture.detectChanges();
        // Query for rows in the body
        const body = fixture.debugElement.query(By.css('[data-slot="table-body"]'));
        const rows = body.queryAll(By.css('[data-slot="table-row"]'));
        // 5 data rows + 1 spacer row
        expect(rows.length).toBe(6);
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
        expect(component.processedData()[0].name).toBe('Alice'); // Sorted by default or insertion order? insertion order here.

        // Go to next page
        component.onPaginationChange({ pageIndex: 1, pageSize: 2 });
        fixture.detectChanges();

        expect(component.processedData().length).toBe(2);
        expect(component.processedData()[0].name).toBe('Charlie');
    });

    it('should handle row selection', () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.detectChanges();

        const row = TEST_DATA[0];

        // Toggle one row
        // Toggle one row
        component.toggleRow(row);
        expect(component.isRowSelected(row)).toBe(true);
        expect(component.isAllSelected()).toBe(false);
        expect(component.isIndeterminate()).toBe(true);

        // Toggle all
        component.toggleAll(); // Selects all
        expect(component.isAllSelected()).toBe(true);
        expect(component.isRowSelected(TEST_DATA[1])).toBe(true);

        // Toggle all off
        component.toggleAll();
        expect(component.isAllSelected()).toBe(false);
    });

    it('should apply sticky classes correctly', () => {
        const stickyCol = { accessorKey: 'id', header: 'ID', sticky: true, _stickyLeft: 0, _width: '50px' };

        // Header
        const headerClass = component.getHeaderClass(stickyCol);
        expect(headerClass).toContain('z-30'); // Corner priority
        expect(headerClass).toContain('sticky');

        // Cell
        const cellStyle = component.getCellStyle(stickyCol);
        expect(cellStyle.position).toBe('sticky');
        expect(cellStyle.left).toBe('0px');
    });

    describe('Column Resizing', () => {
        it('should not show resize handles when enableColumnResize is false', () => {
            fixture.componentRef.setInput('enableColumnResize', false);
            fixture.detectChanges();

            const resizeHandles = fixture.debugElement.queryAll(By.css('[role="separator"]'));
            expect(resizeHandles.length).toBe(0);
        });

        it('should show resize handles when enableColumnResize is true', () => {
            fixture.componentRef.setInput('enableColumnResize', true);
            fixture.detectChanges();

            // Should have resize handles for columns (not selection column, not auto-width columns)
            const resizeHandles = fixture.debugElement.queryAll(By.css('[role="separator"]'));
            expect(resizeHandles.length).toBeGreaterThan(0);
        });

        it('should track column widths in signal', () => {
            fixture.componentRef.setInput('enableColumnResize', true);
            fixture.detectChanges();

            // Initially empty
            expect(Object.keys(component.columnWidths()).length).toBe(0);

            // Simulate width change
            component.columnWidths.set({ 'name': '250px' });
            fixture.detectChanges();

            expect(component.columnWidths()['name']).toBe('250px');
        });

        it('should use columnWidths signal in enhancedColumns', () => {
            fixture.componentRef.setInput('enableColumnResize', true);
            component.columnWidths.set({ 'name': '300px' });
            fixture.detectChanges();

            const nameColumn = component.enhancedColumns().find(col => col.accessorKey === 'name');
            expect(nameColumn?._width).toBe('300px');
        });

        it('should respect minWidth from column definition', () => {
            const colWithMinWidth: ColumnDef<TestData>[] = [
                { accessorKey: 'id', header: 'ID' },
                { accessorKey: 'name', header: 'Name', minWidth: '100px' },
                { accessorKey: 'role', header: 'Role' },
            ];
            fixture.componentRef.setInput('columns', colWithMinWidth);
            fixture.detectChanges();

            const nameColumn = component.enhancedColumns().find(col => col.accessorKey === 'name');
            expect(nameColumn?._minWidth).toBe('100px');
        });
    });
});
