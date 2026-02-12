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

    it('should skip columns from global filter when enableGlobalFilter is false', () => {
        const cols: ColumnDef<TestData>[] = [
            { accessorKey: 'id', header: 'ID', enableGlobalFilter: false },
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'role', header: 'Role' },
        ];
        fixture.componentRef.setInput('columns', cols);
        fixture.detectChanges();

        component.onFilterChange('1'); // matches id only
        fixture.detectChanges();
        expect(component.filteredData().length).toBe(0);
    });

    it('should use custom globalFilterFn when provided', () => {
        fixture.componentRef.setInput('globalFilterFn', (row: TestData, filter: string) => row.role.toLowerCase() === filter);
        fixture.detectChanges();

        component.onFilterChange('admin');
        fixture.detectChanges();

        expect(component.filteredData().length).toBe(2);
        expect(component.filteredData()[0].name).toBe('Alice');
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

    it('should show loader on initial load by default', () => {
        fixture.componentRef.setInput('loading', true);
        fixture.detectChanges();

        expect(component.loadingTrigger()).toBe('initial');
        expect(component.isLoaderVisible()).toBe(true);
    });

    it('should hide loader for sorting when sorting trigger visibility is disabled', () => {
        fixture.componentRef.setInput('loading', true);
        fixture.componentRef.setInput('loadingVisibility', {
            initial: true,
            sorting: false,
            pagination: true,
            filtering: true,
        });
        fixture.detectChanges();

        component.onSortChange('name', 'asc');
        fixture.detectChanges();

        expect(component.loadingTrigger()).toBe('sorting');
        expect(component.isLoaderVisible()).toBe(false);
    });

    it('should show loader for pagination when enabled in loading visibility', () => {
        fixture.componentRef.setInput('loading', true);
        fixture.componentRef.setInput('loadingVisibility', {
            initial: false,
            sorting: false,
            pagination: true,
            filtering: false,
        });
        fixture.detectChanges();

        component.onPaginationChange({ pageIndex: 1, pageSize: 10 });
        fixture.detectChanges();

        expect(component.loadingTrigger()).toBe('pagination');
        expect(component.isLoaderVisible()).toBe(true);
    });

    it('should allow manual loader trigger override', () => {
        fixture.componentRef.setInput('loading', true);
        fixture.componentRef.setInput('loadingVisibility', {
            initial: false,
            sorting: true,
            pagination: false,
            filtering: false,
        });
        fixture.detectChanges();

        component.setLoadingTrigger('sorting');
        fixture.detectChanges();
        expect(component.isLoaderVisible()).toBe(true);

        component.setLoadingTrigger('pagination');
        fixture.detectChanges();
        expect(component.isLoaderVisible()).toBe(false);
    });

    it('should support multi-column sorting with shift behavior', () => {
        fixture.componentRef.setInput('enableMultiSort', true);
        fixture.detectChanges();

        component.onSortChange('role', 'asc');
        component.onSortChange('name', 'desc', true);
        fixture.detectChanges();

        const data = component.sortedData();
        expect(data[0].name).toBe('David');
        expect(data[1].name).toBe('Alice');
        expect(data[3].name).toBe('Charlie');
        expect(data[4].name).toBe('Bob');
        expect(component.getSortIndex('role')).toBe(0);
        expect(component.getSortIndex('name')).toBe(1);
    });

    it('should resolve nested values with dot-path accessor keys', () => {
        const row = { profile: { email: 'alice@example.com' } } as any;
        expect(component.getCellValue(row, 'profile.email')).toBe('alice@example.com');
    });

    it('should prefer accessorFn when provided', () => {
        const column: ColumnDef<TestData> = {
            accessorKey: 'name',
            header: 'Display Name',
            accessorFn: (row) => `${row.name} (${row.role})`,
        };
        expect(component.getCellValue(TEST_DATA[0], 'name', column)).toBe('Alice (Admin)');
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

    it('should not clamp server-side pagination to zero when localPagination is false', () => {
        fixture.componentRef.setInput('localPagination', false);
        fixture.componentRef.setInput('total', 100);
        fixture.detectChanges();

        let emittedPageIndex = -1;
        component.pageChange.subscribe((state) => {
            emittedPageIndex = state.pageIndex;
        });

        component.onPaginationChange({ pageIndex: 3, pageSize: 10 });
        fixture.detectChanges();

        expect(component.paginationState().pageIndex).toBe(3);
        expect(emittedPageIndex).toBe(3);
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

    it('should support row expansion state', () => {
        fixture.componentRef.setInput('enableRowExpansion', true);
        fixture.detectChanges();

        const row = TEST_DATA[0];
        expect(component.isRowExpanded(row)).toBe(false);

        component.toggleRowExpanded(row);
        fixture.detectChanges();
        expect(component.isRowExpanded(row)).toBe(true);

        component.toggleRowExpanded(row);
        fixture.detectChanges();
        expect(component.isRowExpanded(row)).toBe(false);
    });

    it('should resolve row detail component inputs safely', () => {
        const row = TEST_DATA[0];
        expect(component.getRowDetailComponentInputs(row)).toEqual({});

        fixture.componentRef.setInput('rowDetailComponentInputs', (value: TestData) => ({ id: value.id }));
        fixture.detectChanges();
        expect(component.getRowDetailComponentInputs(row)).toEqual({ id: '1' });
    });

    it('should preserve off-filter selection when toggling all on filtered rows', () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.detectChanges();

        component.toggleRow(TEST_DATA[0]); // Alice
        component.toggleRow(TEST_DATA[1]); // Bob
        fixture.detectChanges();

        component.onFilterChange('Admin'); // Alice + David
        fixture.detectChanges();

        component.toggleAll(); // Select all filtered rows only
        fixture.detectChanges();

        expect(component.isRowSelected(TEST_DATA[0])).toBe(true); // Alice
        expect(component.isRowSelected(TEST_DATA[1])).toBe(true); // Bob preserved
        expect(component.isRowSelected(TEST_DATA[3])).toBe(true); // David selected via filtered toggle all
    });

    it('should reset page to first page when filter changes', () => {
        component.paginationState.set({ pageIndex: 2, pageSize: 2 });
        fixture.detectChanges();

        component.onFilterChange('Alice');
        fixture.detectChanges();

        expect(component.paginationState().pageIndex).toBe(0);
    });

    it('should hide columns based on columnVisibility state', () => {
        component.columnVisibility.set({ role: false });
        fixture.detectChanges();

        const keys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keys).not.toContain('role');
        expect(keys).toContain('name');
    });

    it('should not include non-hideable columns in visibility menu model', () => {
        const customColumns: ColumnDef<TestData>[] = [
            { accessorKey: 'id', header: 'ID', enableHiding: false },
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'role', header: 'Role' },
        ];
        fixture.componentRef.setInput('columns', customColumns);
        fixture.detectChanges();

        const hideableKeys = component.hideableColumns().map(col => String(col.accessorKey));
        expect(hideableKeys).not.toContain('id');
        expect(hideableKeys).toContain('name');
        expect(hideableKeys).toContain('role');
    });

    it('should apply column order model to rendered columns', () => {
        component.columnOrder.set(['role', 'name', 'id']);
        fixture.detectChanges();

        const keys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keys[0]).toBe('role');
        expect(keys[1]).toBe('name');
    });

    it('should export and apply column state', () => {
        component.applyColumnState([
            { columnKey: 'role', order: 0, visible: true, width: '240px' },
            { columnKey: 'id', order: 1, visible: false },
            { columnKey: 'name', order: 2, visible: true },
        ]);
        fixture.detectChanges();

        const state = component.getColumnState();
        const idState = state.find(col => col.columnKey === 'id');
        const roleState = state.find(col => col.columnKey === 'role');
        expect(idState?.visible).toBe(false);
        expect(roleState?.width).toBe('240px');

        const keys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keys[0]).toBe('role');
        expect(keys).not.toContain('id');
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

    it('should apply right pin styles correctly', () => {
        const rightPinnedCol = { accessorKey: 'name', header: 'Name', pin: 'right', _pin: 'right', _stickyRight: 0, _width: '120px' };
        const rightPinnedStyle = component.getCellStyle(rightPinnedCol, true);
        expect(rightPinnedStyle.position).toBe('sticky');
        expect(rightPinnedStyle.right).toBe('0px');
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

        it('should compute right pin offsets for pinned columns', () => {
            const pinnedCols: ColumnDef<TestData>[] = [
                { accessorKey: 'id', header: 'ID', pin: 'right', width: '80px' },
                { accessorKey: 'name', header: 'Name', pin: 'right', width: '120px' },
                { accessorKey: 'role', header: 'Role', width: '150px' },
            ];
            fixture.componentRef.setInput('columns', pinnedCols);
            fixture.detectChanges();

            const cols = component.enhancedColumns();
            const idCol = cols.find(col => col.accessorKey === 'id');
            const nameCol = cols.find(col => col.accessorKey === 'name');
            expect(nameCol?._stickyRight).toBe(0);
            expect(idCol?._stickyRight).toBe(120);
        });

        it('should prepend expander column when row expansion is enabled', () => {
            fixture.componentRef.setInput('enableRowExpansion', true);
            fixture.detectChanges();

            const firstColumn = component.enhancedColumns()[0];
            expect(firstColumn.accessorKey).toBe('_expander');
        });

        it('should move columns using moveColumn API', () => {
            component.moveColumn('role', 0);
            fixture.detectChanges();

            const keys = component.enhancedColumns().map(col => String(col.accessorKey));
            expect(keys[0]).toBe('role');
        });
    });
});
