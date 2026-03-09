import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { DataTableComponent } from './data-table.component';
import { ColumnDef, PaginationState, FlattenedTreeRow, RowActionContext } from './data-table.types';
import { ContextMenuItem } from '../context-menu.component';
import { buildTreeFromFlat } from './data-table.utils';
import { dateFilterFn, dateRangeFilterFn } from './data-table-date-filter.component';
import { DateRange } from '../calendar.component';
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

    it('should reset to first page when sorting changes', () => {
        component.paginationState.set({ pageIndex: 2, pageSize: 2 });
        fixture.detectChanges();

        component.onSortChange('name', 'asc');
        fixture.detectChanges();

        expect(component.paginationState().pageIndex).toBe(0);
    });

    it('should emit pageChange when sorting resets page index', () => {
        component.paginationState.set({ pageIndex: 1, pageSize: 2 });
        fixture.detectChanges();

        let emitted: PaginationState | null = null;
        component.pageChange.subscribe((state) => {
            emitted = state;
        });

        component.onSortChange('name', 'desc');
        fixture.detectChanges();

        expect(emitted).toEqual({ pageIndex: 0, pageSize: 2 });
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

    it('should reorder columns via drag and drop when enabled', () => {
        fixture.componentRef.setInput('enableColumnReorder', true);
        fixture.detectChanges();

        const dataTransfer = {
            effectAllowed: '',
            dropEffect: '',
            setData: vi.fn(),
            getData: vi.fn(() => 'role'),
        } as unknown as DataTransfer;

        const startEvent = { dataTransfer } as DragEvent;
        const dragOverEvent = {
            dataTransfer,
            clientX: 0,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            currentTarget: {
                getBoundingClientRect: () => ({ left: 100, width: 80 }),
            },
        } as unknown as DragEvent;
        const dropEvent = {
            dataTransfer,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent;

        component.onColumnDragStart(startEvent, TEST_COLUMNS[2]);
        component.onColumnDragOver(dragOverEvent, TEST_COLUMNS[0]);
        component.onColumnDrop(dropEvent, TEST_COLUMNS[0]);
        fixture.detectChanges();

        const keys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keys[0]).toBe('role');
        expect(component.draggedColumnKey()).toBeNull();
    });

    it('should place dragged column at drop target index regardless of cursor position', () => {
        fixture.componentRef.setInput('enableColumnReorder', true);
        fixture.detectChanges();

        const dataTransfer = {
            effectAllowed: '',
            dropEffect: '',
            setData: vi.fn(),
            getData: vi.fn(() => 'name'),
        } as unknown as DataTransfer;

        const startEvent = { dataTransfer } as DragEvent;
        const dropEventNearLeft = {
            dataTransfer,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent;
        component.onColumnDragStart(startEvent, TEST_COLUMNS[1]);
        component.onColumnDrop(dropEventNearLeft, TEST_COLUMNS[2]);
        fixture.detectChanges();

        const keysAfterFirstDrop = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keysAfterFirstDrop).toEqual(['id', 'role', 'name']);

        const dropEventNearRight = {
            dataTransfer,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent;

        component.columnOrder.set([]);
        fixture.detectChanges();
        component.onColumnDragStart(startEvent, TEST_COLUMNS[1]);
        component.onColumnDrop(dropEventNearRight, TEST_COLUMNS[2]);
        fixture.detectChanges();

        const keys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keys).toEqual(['id', 'role', 'name']);
    });

    it('should not shift one slot right when dragging a column left with near-center drop', () => {
        fixture.componentRef.setInput('enableColumnReorder', true);
        fixture.detectChanges();

        const dataTransfer = {
            effectAllowed: '',
            dropEffect: '',
            setData: vi.fn(),
            getData: vi.fn(() => 'role'),
        } as unknown as DataTransfer;

        const startEvent = { dataTransfer } as DragEvent;
        const dropEvent = {
            dataTransfer,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent;

        component.onColumnDragStart(startEvent, TEST_COLUMNS[2]);
        component.onColumnDrop(dropEvent, TEST_COLUMNS[1]);
        fixture.detectChanges();

        const keys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keys).toEqual(['id', 'role', 'name']);
    });

    it('should move adjacent column from left to right when dropped on next column', () => {
        fixture.componentRef.setInput('enableColumnReorder', true);
        fixture.detectChanges();

        const dataTransfer = {
            effectAllowed: '',
            dropEffect: '',
            setData: vi.fn(),
            getData: vi.fn(() => 'name'),
        } as unknown as DataTransfer;

        const startEvent = { dataTransfer } as DragEvent;
        const dropEvent = {
            dataTransfer,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent;

        component.onColumnDragStart(startEvent, TEST_COLUMNS[1]);
        component.onColumnDrop(dropEvent, TEST_COLUMNS[2]);
        fixture.detectChanges();

        const keys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keys).toEqual(['id', 'role', 'name']);
    });

    it('should move adjacent column from right to left when dropped on previous column', () => {
        fixture.componentRef.setInput('enableColumnReorder', true);
        fixture.detectChanges();

        const dataTransfer = {
            effectAllowed: '',
            dropEffect: '',
            setData: vi.fn(),
            getData: vi.fn(() => 'role'),
        } as unknown as DataTransfer;

        const startEvent = { dataTransfer } as DragEvent;
        const dropEvent = {
            dataTransfer,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent;

        component.onColumnDragStart(startEvent, TEST_COLUMNS[2]);
        component.onColumnDrop(dropEvent, TEST_COLUMNS[1]);
        fixture.detectChanges();

        const keys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keys).toEqual(['id', 'role', 'name']);
    });

    it('should reorder visible columns without hidden columns skewing drop target', () => {
        fixture.componentRef.setInput('enableColumnReorder', true);
        fixture.detectChanges();

        component.columnVisibility.set({ name: false });
        fixture.detectChanges();

        const dataTransfer = {
            effectAllowed: '',
            dropEffect: '',
            setData: vi.fn(),
            getData: vi.fn(() => 'role'),
        } as unknown as DataTransfer;

        const startEvent = { dataTransfer } as DragEvent;
        const dropEvent = {
            dataTransfer,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent;

        component.onColumnDragStart(startEvent, TEST_COLUMNS[2]);
        component.onColumnDrop(dropEvent, TEST_COLUMNS[0]);
        fixture.detectChanges();

        const visibleKeys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(visibleKeys).toEqual(['role', 'id']);
    });

    it('should not reorder columns via drag and drop when disabled', () => {
        fixture.componentRef.setInput('enableColumnReorder', false);
        fixture.detectChanges();

        const dataTransfer = {
            effectAllowed: '',
            dropEffect: '',
            setData: vi.fn(),
            getData: vi.fn(() => 'role'),
        } as unknown as DataTransfer;

        const startEvent = { dataTransfer } as DragEvent;
        const dropEvent = {
            dataTransfer,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent;

        component.onColumnDragStart(startEvent, TEST_COLUMNS[2]);
        component.onColumnDrop(dropEvent, TEST_COLUMNS[0]);
        fixture.detectChanges();

        const keys = component.enhancedColumns().map(col => String(col.accessorKey));
        expect(keys[0]).toBe('id');
        expect(component.columnOrder()).toEqual([]);
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

    it('should accept initial paginationState via input in server-side mode', () => {
        fixture.componentRef.setInput('localPagination', false);
        fixture.componentRef.setInput('total', 500);
        fixture.componentRef.setInput('paginationState', { pageIndex: 3, pageSize: 50 });
        fixture.detectChanges();

        expect(component.paginationState().pageIndex).toBe(3);
        expect(component.paginationState().pageSize).toBe(50);
    });

    it('should default pageSizeOptions to [10, 20, 30, 40, 50]', () => {
        expect(component.pageSizeOptions()).toEqual([10, 20, 30, 40, 50]);
    });

    it('should accept custom pageSizeOptions', () => {
        fixture.componentRef.setInput('pageSizeOptions', [25, 50, 100]);
        fixture.detectChanges();

        expect(component.pageSizeOptions()).toEqual([25, 50, 100]);
    });

    it('should default showPageSizeSelector to true', () => {
        expect(component.showPageSizeSelector()).toBe(true);
    });

    it('should accept showPageSizeSelector false', () => {
        fixture.componentRef.setInput('showPageSizeSelector', false);
        fixture.detectChanges();

        expect(component.showPageSizeSelector()).toBe(false);
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

    describe('Model initial state via setInput', () => {
        it('should accept initial sortState and reflect in sortedData', () => {
            fixture.componentRef.setInput('columns', [
                { accessorKey: 'id', header: 'ID' },
                { accessorKey: 'name', header: 'Name', enableSorting: true },
                { accessorKey: 'role', header: 'Role' },
            ]);
            fixture.componentRef.setInput('sortState', { column: 'name', direction: 'desc' as const });
            fixture.detectChanges();

            const data = component.sortedData();
            expect(data[0].name).toBe('Eve');
            expect(data[4].name).toBe('Alice');
        });

        it('should accept initial multiSortState with enableMultiSort', () => {
            fixture.componentRef.setInput('enableMultiSort', true);
            fixture.componentRef.setInput('columns', [
                { accessorKey: 'id', header: 'ID' },
                { accessorKey: 'name', header: 'Name', enableSorting: true },
                { accessorKey: 'role', header: 'Role', enableSorting: true },
            ]);
            fixture.componentRef.setInput('multiSortState', [
                { column: 'role', direction: 'asc' as const },
                { column: 'name', direction: 'desc' as const },
            ]);
            fixture.detectChanges();

            const data = component.sortedData();
            expect(data[0].name).toBe('David');
            expect(data[1].name).toBe('Alice');
        });

        it('should accept initial globalFilter and reflect in filteredData', () => {
            fixture.componentRef.setInput('globalFilter', 'Alice');
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(1);
            expect(component.filteredData()[0].name).toBe('Alice');
        });

        it('should accept initial columnFilters and reflect in filteredData', () => {
            fixture.componentRef.setInput('columns', [
                { accessorKey: 'id', header: 'ID' },
                { accessorKey: 'name', header: 'Name' },
                { accessorKey: 'role', header: 'Role', enableFiltering: true },
            ]);
            fixture.componentRef.setInput('columnFilters', { role: 'Admin' });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(2);
            expect(component.filteredData().every(row => row.role === 'Admin')).toBe(true);
        });

        it('should accept initial columnWidths and reflect in enhancedColumns', () => {
            fixture.componentRef.setInput('columnWidths', { name: '300px' });
            fixture.detectChanges();

            const nameCol = component.enhancedColumns().find(col => col.accessorKey === 'name');
            expect(nameCol?._width).toBe('300px');
        });
    });

    describe('Row Selection API', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('enableRowSelection', true);
            fixture.detectChanges();
        });

        it('should return correct T[] from selectedRows computed', () => {
            component.rowSelection.set({ '1': true, '3': true });
            fixture.detectChanges();

            const selected = component.selectedRows();
            expect(selected.length).toBe(2);
            expect(selected.map(r => r.name)).toEqual(['Alice', 'Charlie']);
        });

        it('should select rows via selectRows()', () => {
            component.selectRows([TEST_DATA[0], TEST_DATA[2]]);
            fixture.detectChanges();

            expect(component.isRowSelected(TEST_DATA[0])).toBe(true);
            expect(component.isRowSelected(TEST_DATA[2])).toBe(true);
            expect(component.isRowSelected(TEST_DATA[1])).toBe(false);
        });

        it('should deselect rows via unselectRows()', () => {
            component.selectRows(TEST_DATA);
            fixture.detectChanges();

            component.unselectRows([TEST_DATA[1], TEST_DATA[3]]);
            fixture.detectChanges();

            expect(component.isRowSelected(TEST_DATA[0])).toBe(true);
            expect(component.isRowSelected(TEST_DATA[1])).toBe(false);
            expect(component.isRowSelected(TEST_DATA[3])).toBe(false);
            expect(component.selectedRows().length).toBe(3);
        });

        it('should clear all selection via clearSelection()', () => {
            component.selectRows(TEST_DATA);
            fixture.detectChanges();

            component.clearSelection();
            fixture.detectChanges();

            expect(component.selectedRows().length).toBe(0);
            expect(component.isAllSelected()).toBe(false);
        });

        it('should select all visible rows via selectAll()', () => {
            component.selectAll();
            fixture.detectChanges();

            expect(component.isAllSelected()).toBe(true);
            expect(component.selectedRows().length).toBe(TEST_DATA.length);
        });
    });

    describe('Expand All / Collapse All', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('enableRowExpansion', true);
            fixture.detectChanges();
        });

        it('should return false from isAllExpanded when no rows are expanded', () => {
            expect(component.isAllExpanded()).toBe(false);
        });

        it('should return true from isAllExpanded when all filtered rows are expanded', () => {
            const getId = component.getRowId();
            const expanded: Record<string, boolean> = {};
            TEST_DATA.forEach(row => expanded[getId(row)] = true);
            component.expandedRows.set(expanded);
            fixture.detectChanges();

            expect(component.isAllExpanded()).toBe(true);
        });

        it('should return true from isExpansionIndeterminate when some rows are expanded', () => {
            const getId = component.getRowId();
            component.expandedRows.set({ [getId(TEST_DATA[0])]: true });
            fixture.detectChanges();

            expect(component.isExpansionIndeterminate()).toBe(true);
            expect(component.isAllExpanded()).toBe(false);
        });

        it('should expand all filtered rows via toggleAllExpanded', () => {
            component.toggleAllExpanded();
            fixture.detectChanges();

            expect(component.isAllExpanded()).toBe(true);
            TEST_DATA.forEach(row => {
                expect(component.isRowExpanded(row)).toBe(true);
            });
        });

        it('should collapse all filtered rows via toggleAllExpanded when all are expanded', () => {
            component.toggleAllExpanded(); // expand all
            fixture.detectChanges();
            expect(component.isAllExpanded()).toBe(true);

            component.toggleAllExpanded(); // collapse all
            fixture.detectChanges();
            expect(component.isAllExpanded()).toBe(false);
            TEST_DATA.forEach(row => {
                expect(component.isRowExpanded(row)).toBe(false);
            });
        });

        it('should only affect filtered rows when a filter is active', () => {
            component.onFilterChange('Admin'); // Alice + David
            fixture.detectChanges();

            component.toggleAllExpanded();
            fixture.detectChanges();

            expect(component.isAllExpanded()).toBe(true);
            expect(component.isRowExpanded(TEST_DATA[0])).toBe(true); // Alice (Admin)
            expect(component.isRowExpanded(TEST_DATA[3])).toBe(true); // David (Admin)
            expect(component.isRowExpanded(TEST_DATA[1])).toBe(false); // Bob (not in filter)
        });
    });

    describe('getFilterOutputs and column filter integration', () => {
        it('should wire filterChange output to onColumnFilterChange', () => {
            const col: ColumnDef<TestData> = {
                accessorKey: 'role',
                header: 'Role',
                enableFiltering: true,
            };

            const outputs = component.getFilterOutputs(col);
            expect(outputs['filterChange']).toBeDefined();

            outputs['filterChange']('Admin');
            fixture.detectChanges();

            expect(component.columnFilters()).toEqual({ role: 'Admin' });
        });

        it('should emit columnFiltersChange when a filter component fires', () => {
            const emitted: Record<string, unknown>[] = [];
            component.columnFilters.subscribe(val => emitted.push(val));

            component.onColumnFilterChange('role', 'User');
            fixture.detectChanges();

            expect(emitted.length).toBeGreaterThan(0);
            expect(emitted[emitted.length - 1]).toEqual({ role: 'User' });
        });

        it('should apply custom filterFn for column filters during local filtering', () => {
            const columns: ColumnDef<TestData>[] = [
                { accessorKey: 'id', header: 'ID' },
                { accessorKey: 'name', header: 'Name' },
                {
                    accessorKey: 'role',
                    header: 'Role',
                    enableFiltering: true,
                    filterFn: (_row: TestData, filterValue: unknown): boolean => {
                        const roles = filterValue as string[];
                        return roles.includes(_row.role);
                    },
                },
            ];

            fixture.componentRef.setInput('columns', columns);
            fixture.componentRef.setInput('columnFilters', { role: ['Manager'] });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(1);
            expect(component.filteredData()[0].name).toBe('Eve');
        });

        it('should not apply column filters locally when localFiltering is false', () => {
            const columns: ColumnDef<TestData>[] = [
                { accessorKey: 'id', header: 'ID' },
                { accessorKey: 'name', header: 'Name' },
                {
                    accessorKey: 'role',
                    header: 'Role',
                    enableFiltering: true,
                    filterFn: (_row: TestData, filterValue: unknown): boolean => {
                        const roles = filterValue as string[];
                        return roles.includes(_row.role);
                    },
                },
            ];

            fixture.componentRef.setInput('columns', columns);
            fixture.componentRef.setInput('localFiltering', false);
            fixture.componentRef.setInput('columnFilters', { role: ['Admin'] });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(TEST_DATA.length);
        });

        it('should merge custom filterComponentOutputs with filterChange', () => {
            const customHandler = vi.fn();
            const col: ColumnDef<TestData> = {
                accessorKey: 'role',
                header: 'Role',
                enableFiltering: true,
                filterComponentOutputs: { customOutput: customHandler },
            };

            const outputs = component.getFilterOutputs(col);
            expect(outputs['customOutput']).toBe(customHandler);
            expect(outputs['filterChange']).toBeDefined();
        });

        it('should reset pagination when column filter changes', () => {
            component.paginationState.set({ pageIndex: 3, pageSize: 10 });
            component.onColumnFilterChange('role', 'Admin');
            fixture.detectChanges();

            expect(component.paginationState().pageIndex).toBe(0);
        });

        it('should report active filter via isColumnFilterActive', () => {
            const col: ColumnDef<TestData> = {
                accessorKey: 'role',
                header: 'Role',
                enableFiltering: true,
            };

            expect(component.isColumnFilterActive(col)).toBe(false);

            component.onColumnFilterChange('role', 'Admin');
            fixture.detectChanges();

            expect(component.isColumnFilterActive(col)).toBe(true);
        });

        it('should report inactive filter for empty values', () => {
            const col: ColumnDef<TestData> = {
                accessorKey: 'role',
                header: 'Role',
                enableFiltering: true,
            };

            component.onColumnFilterChange('role', '');
            expect(component.isColumnFilterActive(col)).toBe(false);

            component.onColumnFilterChange('role', null);
            expect(component.isColumnFilterActive(col)).toBe(false);
        });

        it('should report inactive filter for empty DateRange', () => {
            const col: ColumnDef<TestData> = {
                accessorKey: 'role',
                header: 'Role',
                enableFiltering: true,
            };

            component.onColumnFilterChange('role', { start: null, end: null });
            expect(component.isColumnFilterActive(col)).toBe(false);

            component.onColumnFilterChange('role', { start: new Date(), end: null });
            expect(component.isColumnFilterActive(col)).toBe(true);
        });
    });

    describe('getFilterInputs', () => {
        it('should return static filterComponentInputs as-is', () => {
            const col: ColumnDef<TestData> = {
                accessorKey: 'role',
                header: 'Role',
                enableFiltering: true,
                filterComponentInputs: { placeholder: 'Filter roles...' },
            };

            const result = component.getFilterInputs(col);
            expect(result).toEqual({ placeholder: 'Filter roles...' });
        });

        it('should call filterComponentInputs when it is a function', () => {
            const col: ColumnDef<TestData> = {
                accessorKey: 'role',
                header: 'Role',
                enableFiltering: true,
                filterComponentInputs: () => ({ options: ['Admin', 'User'] }),
            };

            const result = component.getFilterInputs(col);
            expect(result).toEqual({ options: ['Admin', 'User'] });
        });

        it('should return empty object when filterComponentInputs is undefined', () => {
            const col: ColumnDef<TestData> = {
                accessorKey: 'role',
                header: 'Role',
                enableFiltering: true,
            };

            const result = component.getFilterInputs(col);
            expect(result).toEqual({});
        });

        it('should return updated values when function references a signal', () => {
            let currentOptions = ['Admin'];
            const col: ColumnDef<TestData> = {
                accessorKey: 'role',
                header: 'Role',
                enableFiltering: true,
                filterComponentInputs: () => ({ options: currentOptions }),
            };

            expect(component.getFilterInputs(col)).toEqual({ options: ['Admin'] });

            currentOptions = ['Admin', 'User', 'Manager'];
            expect(component.getFilterInputs(col)).toEqual({ options: ['Admin', 'User', 'Manager'] });
        });
    });
});

interface TreeData {
    id: string;
    name: string;
    role: string;
    children?: TreeData[];
}

const TREE_DATA: TreeData[] = [
    {
        id: '1', name: 'Engineering', role: 'Department',
        children: [
            {
                id: '1-1', name: 'Frontend', role: 'Team',
                children: [
                    { id: '1-1-1', name: 'Alice', role: 'Developer' },
                    { id: '1-1-2', name: 'Bob', role: 'Developer' },
                ],
            },
            {
                id: '1-2', name: 'Backend', role: 'Team',
                children: [
                    { id: '1-2-1', name: 'Charlie', role: 'Developer' },
                ],
            },
        ],
    },
    {
        id: '2', name: 'Marketing', role: 'Department',
        children: [
            { id: '2-1', name: 'Diana', role: 'Manager' },
        ],
    },
    { id: '3', name: 'Finance', role: 'Department' },
];

const TREE_COLUMNS: ColumnDef<TreeData>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name', enableSorting: true },
    { accessorKey: 'role', header: 'Role' },
];

describe('DataTableComponent - Sub-Rows (Tree Data)', () => {
    let component: DataTableComponent<TreeData>;
    let fixture: ComponentFixture<DataTableComponent<TreeData>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataTableComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(DataTableComponent<TreeData>);
        component = fixture.componentInstance;

        fixture.componentRef.setInput('data', TREE_DATA);
        fixture.componentRef.setInput('columns', TREE_COLUMNS);
        fixture.componentRef.setInput('enableSubRows', true);
        fixture.componentRef.setInput('showPagination', false);
        fixture.componentRef.setInput('showToolbar', false);

        fixture.detectChanges();
    });

    describe('Tree Flattening and Visibility', () => {
        it('should show only root rows when all collapsed (default)', () => {
            const rows = component.processedTreeRows();
            expect(rows.length).toBe(3);
            expect(rows.map(r => r.row.id)).toEqual(['1', '2', '3']);
        });

        it('should show children when parent is expanded', () => {
            component.toggleSubRowExpanded(TREE_DATA[0]);
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const ids = rows.map(r => r.row.id);
            expect(ids).toContain('1-1');
            expect(ids).toContain('1-2');
            expect(ids).not.toContain('1-1-1');
        });

        it('should show grandchildren when both parent and child expanded', () => {
            component.expandSubRow(TREE_DATA[0]);
            component.expandSubRow(TREE_DATA[0].children![0]);
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const ids = rows.map(r => r.row.id);
            expect(ids).toContain('1-1-1');
            expect(ids).toContain('1-1-2');
        });

        it('should set correct depth on flattened rows', () => {
            component.expandSubRow(TREE_DATA[0]);
            component.expandSubRow(TREE_DATA[0].children![0]);
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const alice = rows.find(r => r.row.id === '1-1-1')!;
            expect(alice.depth).toBe(2);

            const frontend = rows.find(r => r.row.id === '1-1')!;
            expect(frontend.depth).toBe(1);

            const engineering = rows.find(r => r.row.id === '1')!;
            expect(engineering.depth).toBe(0);
        });

        it('should mark leaf rows correctly', () => {
            component.expandSubRow(TREE_DATA[0]);
            component.expandSubRow(TREE_DATA[0].children![0]);
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const alice = rows.find(r => r.row.id === '1-1-1')!;
            expect(alice.isLeaf).toBe(true);

            const frontend = rows.find(r => r.row.id === '1-1')!;
            expect(frontend.isLeaf).toBe(false);

            const finance = rows.find(r => r.row.id === '3')!;
            expect(finance.isLeaf).toBe(true);
        });

        it('should collapse children when parent is collapsed', () => {
            component.expandSubRow(TREE_DATA[0]);
            component.expandSubRow(TREE_DATA[0].children![0]);
            fixture.detectChanges();

            let rows = component.processedTreeRows();
            expect(rows.map(r => r.row.id)).toContain('1-1-1');

            component.collapseSubRow(TREE_DATA[0]);
            fixture.detectChanges();

            rows = component.processedTreeRows();
            expect(rows.map(r => r.row.id)).not.toContain('1-1');
            expect(rows.map(r => r.row.id)).not.toContain('1-1-1');
        });
    });

    describe('expandAllSubRows / collapseAllSubRows', () => {
        it('should expand all sub-rows', () => {
            component.expandAllSubRows(-1);
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            expect(rows.length).toBe(9);
        });

        it('should collapse all sub-rows', () => {
            component.expandAllSubRows(-1);
            fixture.detectChanges();

            component.collapseAllSubRows();
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            expect(rows.length).toBe(3);
        });

        it('should report isAllSubRowsExpanded correctly', () => {
            expect(component.isAllSubRowsExpanded()).toBe(false);

            component.expandAllSubRows(-1);
            fixture.detectChanges();

            expect(component.isAllSubRowsExpanded()).toBe(true);
        });
    });

    describe('subRowDefaultExpanded', () => {
        it('should expand to depth 1 when subRowDefaultExpanded is 1', () => {
            fixture.componentRef.setInput('subRowDefaultExpanded', 1);
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const ids = rows.map(r => r.row.id);
            expect(ids).toContain('1-1');
            expect(ids).toContain('1-2');
            expect(ids).toContain('2-1');
            expect(ids).not.toContain('1-1-1');
        });

        it('should expand all when subRowDefaultExpanded is -1', () => {
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            expect(rows.length).toBe(9);
        });

        it('should keep all collapsed when subRowDefaultExpanded is 0', () => {
            fixture.componentRef.setInput('subRowDefaultExpanded', 0);
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            expect(rows.length).toBe(3);
        });
    });

    describe('Selection Cascade', () => {
        beforeEach(() => {
            fixture.componentRef.setInput('enableRowSelection', true);
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            fixture.detectChanges();
        });

        it('should not cascade selection when mode is self', () => {
            fixture.componentRef.setInput('subRowSelectionMode', 'self');
            fixture.detectChanges();

            component.toggleRowWithCascade(TREE_DATA[0]);
            fixture.detectChanges();

            expect(component.isRowSelected(TREE_DATA[0])).toBe(true);
            expect(component.isRowSelected(TREE_DATA[0].children![0])).toBe(false);
        });

        it('should cascade to descendants when mode is descendants', () => {
            fixture.componentRef.setInput('subRowSelectionMode', 'descendants');
            fixture.detectChanges();

            component.toggleRowWithCascade(TREE_DATA[0]);
            fixture.detectChanges();

            expect(component.isRowSelected(TREE_DATA[0])).toBe(true);
            expect(component.isRowSelected(TREE_DATA[0].children![0])).toBe(true);
            expect(component.isRowSelected(TREE_DATA[0].children![0].children![0])).toBe(true);
            expect(component.isRowSelected(TREE_DATA[0].children![0].children![1])).toBe(true);
            expect(component.isRowSelected(TREE_DATA[0].children![1])).toBe(true);
            expect(component.isRowSelected(TREE_DATA[0].children![1].children![0])).toBe(true);
            expect(component.isRowSelected(TREE_DATA[1])).toBe(false);
        });

        it('should deselect descendants when parent is toggled off in descendants mode', () => {
            fixture.componentRef.setInput('subRowSelectionMode', 'descendants');
            fixture.detectChanges();

            component.toggleRowWithCascade(TREE_DATA[0]);
            fixture.detectChanges();
            expect(component.isRowSelected(TREE_DATA[0])).toBe(true);

            component.toggleRowWithCascade(TREE_DATA[0]);
            fixture.detectChanges();
            expect(component.isRowSelected(TREE_DATA[0])).toBe(false);
            expect(component.isRowSelected(TREE_DATA[0].children![0])).toBe(false);
            expect(component.isRowSelected(TREE_DATA[0].children![0].children![0])).toBe(false);
        });

        it('should show indeterminate when some descendants are selected', () => {
            fixture.componentRef.setInput('subRowSelectionMode', 'descendants');
            fixture.detectChanges();

            component.toggleRow(TREE_DATA[0].children![0].children![0]);
            fixture.detectChanges();

            expect(component.isSubRowSelectionIndeterminate(TREE_DATA[0])).toBe(true);
            expect(component.isSubRowSelectionIndeterminate(TREE_DATA[0].children![0])).toBe(true);
        });

        it('should not show indeterminate for leaf rows', () => {
            fixture.componentRef.setInput('subRowSelectionMode', 'descendants');
            fixture.detectChanges();

            expect(component.isSubRowSelectionIndeterminate(TREE_DATA[0].children![0].children![0])).toBe(false);
        });

        it('should bubble up parent selection when all children selected', () => {
            fixture.componentRef.setInput('subRowSelectionMode', 'descendants');
            fixture.detectChanges();

            component.toggleRowWithCascade(TREE_DATA[0].children![0].children![0]);
            component.toggleRowWithCascade(TREE_DATA[0].children![0].children![1]);
            fixture.detectChanges();

            expect(component.isRowSelected(TREE_DATA[0].children![0])).toBe(true);
        });
    });

    describe('Filtering Modes', () => {
        it('should keep parent when child matches (includeParentOnChildMatch)', () => {
            fixture.componentRef.setInput('subRowFilterMode', 'includeParentOnChildMatch');
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            fixture.detectChanges();

            component.onFilterChange('Alice');
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const ids = rows.map(r => r.row.id);
            expect(ids).toContain('1');
            expect(ids).toContain('1-1');
            expect(ids).toContain('1-1-1');
            expect(ids).not.toContain('1-1-2');
            expect(ids).not.toContain('1-2');
            expect(ids).not.toContain('2');
        });

        it('should filter parents only with excludeChildren mode', () => {
            fixture.componentRef.setInput('subRowFilterMode', 'excludeChildren');
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            fixture.detectChanges();

            component.onFilterChange('Engineering');
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const ids = rows.map(r => r.row.id);
            expect(ids).toContain('1');
            expect(ids).not.toContain('2');
        });

        it('should include all children when parent matches (includeChildren)', () => {
            fixture.componentRef.setInput('subRowFilterMode', 'includeChildren');
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            fixture.detectChanges();

            component.onFilterChange('Engineering');
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const ids = rows.map(r => r.row.id);
            expect(ids).toContain('1');
            expect(ids).toContain('1-1');
            expect(ids).toContain('1-2');
        });
    });

    describe('Sorting Within Groups', () => {
        it('should sort children within their parent group', () => {
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            fixture.detectChanges();

            component.onSortChange('name', 'desc');
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const rootNames = rows.filter(r => r.depth === 0).map(r => r.row.name);
            expect(rootNames[0]).toBe('Marketing');

            const frontendChildren = rows.filter(r => r.parentId === '1-1');
            expect(frontendChildren[0].row.name).toBe('Bob');
            expect(frontendChildren[1].row.name).toBe('Alice');
        });
    });

    describe('Coexistence with Detail Row Expansion', () => {
        it('should support both sub-row and detail-row expansion on same row', () => {
            fixture.componentRef.setInput('enableRowExpansion', true);
            fixture.componentRef.setInput('subRowDefaultExpanded', 0);
            fixture.detectChanges();

            component.expandSubRow(TREE_DATA[0]);
            component.toggleRowExpanded(TREE_DATA[0]);
            fixture.detectChanges();

            expect(component.isSubRowExpanded(TREE_DATA[0])).toBe(true);
            expect(component.isRowExpanded(TREE_DATA[0])).toBe(true);

            const rows = component.processedTreeRows();
            const ids = rows.map(r => r.row.id);
            expect(ids).toContain('1');
            expect(ids).toContain('1-1');
            expect(ids).toContain('1-2');
        });
    });

    describe('Pagination', () => {
        it('should paginate root rows only when subRowsPaginated is false', () => {
            fixture.componentRef.setInput('showPagination', true);
            fixture.componentRef.setInput('subRowsPaginated', false);
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            component.paginationState.set({ pageIndex: 0, pageSize: 2 });
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            const rootIds = rows.filter(r => r.depth === 0).map(r => r.row.id);
            expect(rootIds).toEqual(['1', '2']);
            expect(rows.find(r => r.row.id === '3')).toBeUndefined();
        });

        it('should paginate all visible rows when subRowsPaginated is true', () => {
            fixture.componentRef.setInput('showPagination', true);
            fixture.componentRef.setInput('subRowsPaginated', true);
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            component.paginationState.set({ pageIndex: 0, pageSize: 3 });
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            expect(rows.length).toBe(3);
        });

        it('should report correct activeTotalItems for root-only pagination', () => {
            fixture.componentRef.setInput('showPagination', true);
            fixture.componentRef.setInput('subRowsPaginated', false);
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            component.paginationState.set({ pageIndex: 0, pageSize: 10 });
            fixture.detectChanges();

            expect(component.activeTotalItems()).toBe(3);
        });

        it('should report correct activeTotalItems for all-visible pagination', () => {
            fixture.componentRef.setInput('showPagination', true);
            fixture.componentRef.setInput('subRowsPaginated', true);
            fixture.componentRef.setInput('subRowDefaultExpanded', -1);
            component.paginationState.set({ pageIndex: 0, pageSize: 10 });
            fixture.detectChanges();

            expect(component.activeTotalItems()).toBe(9);
        });
    });

    describe('API Methods', () => {
        it('should return correct depth via getRowDepth', () => {
            expect(component.getRowDepth(TREE_DATA[0])).toBe(0);
            expect(component.getRowDepth(TREE_DATA[0].children![0])).toBe(1);
            expect(component.getRowDepth(TREE_DATA[0].children![0].children![0])).toBe(2);
        });

        it('should return correct path via getRowPath', () => {
            expect(component.getRowPath('1-1-1')).toEqual(['1', '1-1', '1-1-1']);
            expect(component.getRowPath('1')).toEqual(['1']);
        });

        it('should return parent row via getParentRow', () => {
            const parent = component.getParentRow(TREE_DATA[0].children![0]);
            expect(parent).not.toBeNull();
            expect(parent!.id).toBe('1');
        });

        it('should return null for root row parent', () => {
            expect(component.getParentRow(TREE_DATA[0])).toBeNull();
        });

        it('should return child rows via getChildRows', () => {
            const children = component.getChildRows(TREE_DATA[0]);
            expect(children.length).toBe(2);
            expect(children[0].id).toBe('1-1');
        });

        it('should select children via selectChildren', () => {
            fixture.componentRef.setInput('enableRowSelection', true);
            fixture.detectChanges();

            component.selectChildren(TREE_DATA[0]);
            fixture.detectChanges();

            expect(component.isRowSelected(TREE_DATA[0].children![0])).toBe(true);
            expect(component.isRowSelected(TREE_DATA[0].children![0].children![0])).toBe(true);
            expect(component.isRowSelected(TREE_DATA[0])).toBe(false);
        });

        it('should deselect children via deselectChildren', () => {
            fixture.componentRef.setInput('enableRowSelection', true);
            fixture.detectChanges();

            component.selectChildren(TREE_DATA[0]);
            fixture.detectChanges();

            component.deselectChildren(TREE_DATA[0]);
            fixture.detectChanges();

            expect(component.isRowSelected(TREE_DATA[0].children![0])).toBe(false);
        });
    });

    describe('getSubRowComponentInputs', () => {
        it('should include _subRowContext in component inputs', () => {
            component.expandSubRow(TREE_DATA[0]);
            component.expandSubRow(TREE_DATA[0].children![0]);
            fixture.detectChanges();

            const treeRow: FlattenedTreeRow<TreeData> = {
                row: TREE_DATA[0].children![0].children![0],
                depth: 2,
                parentId: '1-1',
                parentRow: TREE_DATA[0].children![0],
                path: ['1', '1-1', '1-1-1'],
                isLeaf: true,
                childCount: 0,
                isExpanded: false,
            };

            const col: ColumnDef<TreeData> = {
                accessorKey: 'name',
                header: 'Name',
                componentInputs: (row) => ({ label: row.name }),
            };

            const result = component.getSubRowComponentInputs(col, treeRow);
            expect(result['label']).toBe('Alice');
            expect(result['_subRowContext']).toBeDefined();
            expect(result['_subRowContext'].depth).toBe(2);
            expect(result['_subRowContext'].parentId).toBe('1-1');
            expect(result['_subRowContext'].isLeaf).toBe(true);
            expect(result['_subRowContext'].path).toEqual(['1', '1-1', '1-1-1']);
        });
    });

    describe('enhancedColumns with sub-rows', () => {
        it('should mark first data column as tree expander host', () => {
            const cols = component.enhancedColumns();
            const hostCol = cols.find(c => c._isTreeExpanderHost);
            expect(hostCol).toBeTruthy();
            expect(hostCol!.accessorKey).toBe('id');
        });

        it('should mark user treeExpander column as tree expander host', () => {
            const customCols: ColumnDef<TreeData>[] = [
                { accessorKey: 'name', header: 'Name', treeExpander: true },
                { accessorKey: 'role', header: 'Role' },
            ];
            fixture.componentRef.setInput('columns', customCols);
            fixture.detectChanges();

            const cols = component.enhancedColumns();
            expect(cols.some(c => c.accessorKey === '_subRowExpander')).toBe(false);
            const hostCol = cols.find(c => c._isTreeExpanderHost);
            expect(hostCol).toBeTruthy();
            expect(hostCol!.accessorKey).toBe('name');
            expect(hostCol!.treeExpander).toBe(true);
        });
    });

    describe('Row Actions', () => {
        const rowActionsFn = (ctx: RowActionContext<TestData>): ContextMenuItem[] => [
            { label: 'View', click: () => {} },
            { type: 'separator' },
            { label: 'Delete', disabled: ctx.row.role === 'Admin', click: () => {} },
        ];

        it('should add _actions column when rowActions is provided', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.detectChanges();

            const cols = component.enhancedColumns();
            const actionsCol = cols.find(c => c.accessorKey === '_actions');
            expect(actionsCol).toBeTruthy();
            expect(actionsCol!.enableSorting).toBe(false);
            expect(actionsCol!.enableHiding).toBe(false);
        });

        it('should not add _actions column when rowActions is undefined', () => {
            fixture.detectChanges();

            const cols = component.enhancedColumns();
            const actionsCol = cols.find(c => c.accessorKey === '_actions');
            expect(actionsCol).toBeUndefined();
        });

        it('should hide _actions column when showRowActionsColumn is false', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.componentRef.setInput('showRowActionsColumn', false);
            fixture.detectChanges();

            const cols = component.enhancedColumns();
            const actionsCol = cols.find(c => c.accessorKey === '_actions');
            expect(actionsCol).toBeUndefined();
        });

        it('should resolve showActionsColumn to true by default when rowActions is set', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.detectChanges();

            expect(component.resolvedShowActionsColumn()).toBe(true);
        });

        it('should resolve showContextMenu to true by default when rowActions is set', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.detectChanges();

            expect(component.resolvedShowContextMenu()).toBe(true);
        });

        it('should resolve showActionsColumn to false when explicitly set', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.componentRef.setInput('showRowActionsColumn', false);
            fixture.detectChanges();

            expect(component.resolvedShowActionsColumn()).toBe(false);
        });

        it('should resolve showContextMenu to false when explicitly set', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.componentRef.setInput('showRowActionsContextMenu', false);
            fixture.detectChanges();

            expect(component.resolvedShowContextMenu()).toBe(false);
        });

        it('should build correct RowActionContext', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.componentRef.setInput('enableRowSelection', true);
            fixture.detectChanges();

            const actions = component.getRowActions(TEST_DATA[0], 0);
            expect(actions.length).toBe(3);
            expect(actions[0].label).toBe('View');
            expect(actions[1].type).toBe('separator');
            expect(actions[2].label).toBe('Delete');
            expect(actions[2].disabled).toBe(true);
        });

        it('should pass selected state in RowActionContext', () => {
            let capturedCtx: RowActionContext<TestData> | undefined;
            const capturingActions = (ctx: RowActionContext<TestData>): ContextMenuItem[] => {
                capturedCtx = ctx;
                return [{ label: 'Test' }];
            };

            fixture.componentRef.setInput('rowActions', capturingActions);
            fixture.componentRef.setInput('enableRowSelection', true);
            component.rowSelection.set({ '1': true });
            fixture.detectChanges();

            component.getRowActions(TEST_DATA[0], 0);
            expect(capturedCtx).toBeTruthy();
            expect(capturedCtx!.selected).toBe(true);
            expect(capturedCtx!.index).toBe(0);
            expect(capturedCtx!.row).toBe(TEST_DATA[0]);

            component.getRowActions(TEST_DATA[1], 1);
            expect(capturedCtx!.selected).toBe(false);
        });

        it('should render dropdown trigger buttons when actions column is enabled', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.detectChanges();

            const buttons = fixture.debugElement.queryAll(By.css('[aria-label="Row actions"]'));
            expect(buttons.length).toBeGreaterThan(0);
            expect(buttons.length).toBe(component.processedData().length);
        });

        it('should not render dropdown trigger buttons when showRowActionsColumn is false', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.componentRef.setInput('showRowActionsColumn', false);
            fixture.detectChanges();

            const buttons = fixture.debugElement.queryAll(By.css('[aria-label="Row actions"]'));
            expect(buttons.length).toBe(0);
        });

        it('should exclude _actions column from global filter columns', () => {
            fixture.componentRef.setInput('rowActions', rowActionsFn);
            fixture.detectChanges();

            component.onFilterChange('View');
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(0);
        });
    });
});

describe('buildTreeFromFlat', () => {
    interface FlatItem {
        id: string;
        parentId: string | null;
        name: string;
        children?: FlatItem[];
    }

    it('should build tree from flat array', () => {
        const flat: FlatItem[] = [
            { id: '1', parentId: null, name: 'Root A' },
            { id: '2', parentId: null, name: 'Root B' },
            { id: '1-1', parentId: '1', name: 'Child A1' },
            { id: '1-2', parentId: '1', name: 'Child A2' },
            { id: '2-1', parentId: '2', name: 'Child B1' },
            { id: '1-1-1', parentId: '1-1', name: 'Grandchild A1-1' },
        ];

        const tree = buildTreeFromFlat(
            flat,
            r => r.id,
            r => r.parentId,
            (r, children) => ({ ...r, children })
        );

        expect(tree.length).toBe(2);
        expect(tree[0].name).toBe('Root A');
        expect(tree[0].children!.length).toBe(2);
        expect(tree[0].children![0].children!.length).toBe(1);
        expect(tree[0].children![0].children![0].name).toBe('Grandchild A1-1');
        expect(tree[1].children!.length).toBe(1);
    });

    it('should return empty array for empty input', () => {
        const tree = buildTreeFromFlat<FlatItem>(
            [],
            r => r.id,
            r => r.parentId,
            (r, children) => ({ ...r, children })
        );
        expect(tree).toEqual([]);
    });

    it('should handle single root with no children', () => {
        const flat: FlatItem[] = [
            { id: '1', parentId: null, name: 'Alone' },
        ];

        const tree = buildTreeFromFlat(
            flat,
            r => r.id,
            r => r.parentId,
            (r, children) => ({ ...r, children })
        );

        expect(tree.length).toBe(1);
        expect(tree[0].name).toBe('Alone');
        expect(tree[0].children).toBeUndefined();
    });
});

interface DateTestData {
    id: string;
    name: string;
    createdAt: string;
}

const DATE_TEST_DATA: DateTestData[] = [
    { id: '1', name: 'Alpha', createdAt: '2024-03-01T10:00:00Z' },
    { id: '2', name: 'Beta', createdAt: '2024-03-15T14:30:00Z' },
    { id: '3', name: 'Gamma', createdAt: '2024-04-01T09:00:00Z' },
    { id: '4', name: 'Delta', createdAt: '2024-04-15T16:45:00Z' },
    { id: '5', name: 'Epsilon', createdAt: '2024-05-01T08:00:00Z' },
];

describe('DataTableComponent - Date filter integration', () => {
    let component: DataTableComponent<DateTestData>;
    let fixture: ComponentFixture<DataTableComponent<DateTestData>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataTableComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(DataTableComponent<DateTestData>);
        component = fixture.componentInstance;
    });

    describe('single date filter (dateFilterFn)', () => {
        const columns: ColumnDef<DateTestData>[] = [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name' },
            {
                accessorKey: 'createdAt',
                header: 'Created',
                enableFiltering: true,
                filterFn: (row: DateTestData, filterValue: unknown): boolean =>
                    dateFilterFn(row, filterValue as Date | null, r => r.createdAt),
            },
        ];

        beforeEach(() => {
            fixture.componentRef.setInput('data', DATE_TEST_DATA);
            fixture.componentRef.setInput('columns', columns);
            fixture.detectChanges();
        });

        it('should show all rows when no date filter is set', () => {
            expect(component.filteredData().length).toBe(5);
        });

        it('should filter to exact date match', () => {
            fixture.componentRef.setInput('columnFilters', { createdAt: new Date(2024, 2, 15) });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(1);
            expect(component.filteredData()[0].name).toBe('Beta');
        });

        it('should return no rows when date does not match any row', () => {
            fixture.componentRef.setInput('columnFilters', { createdAt: new Date(2024, 0, 1) });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(0);
        });

        it('should show all rows when filter is cleared to null', () => {
            fixture.componentRef.setInput('columnFilters', { createdAt: new Date(2024, 2, 15) });
            fixture.detectChanges();
            expect(component.filteredData().length).toBe(1);

            fixture.componentRef.setInput('columnFilters', { createdAt: null });
            fixture.detectChanges();
            expect(component.filteredData().length).toBe(5);
        });

        it('should update filter via onColumnFilterChange', () => {
            component.onColumnFilterChange('createdAt', new Date(2024, 3, 1));
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(1);
            expect(component.filteredData()[0].name).toBe('Gamma');
        });
    });

    describe('date range filter (dateRangeFilterFn)', () => {
        const columns: ColumnDef<DateTestData>[] = [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name' },
            {
                accessorKey: 'createdAt',
                header: 'Created',
                enableFiltering: true,
                filterFn: (row: DateTestData, filterValue: unknown): boolean =>
                    dateRangeFilterFn(row, filterValue as DateRange | null, r => r.createdAt),
            },
        ];

        beforeEach(() => {
            fixture.componentRef.setInput('data', DATE_TEST_DATA);
            fixture.componentRef.setInput('columns', columns);
            fixture.detectChanges();
        });

        it('should show all rows when no range filter is set', () => {
            expect(component.filteredData().length).toBe(5);
        });

        it('should filter rows within date range inclusively', () => {
            const range: DateRange = {
                start: new Date(2024, 2, 10),
                end: new Date(2024, 3, 10),
            };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(2);
            expect(component.filteredData().map(r => r.name)).toEqual(['Beta', 'Gamma']);
        });

        it('should include boundary dates', () => {
            const range: DateRange = {
                start: new Date(2024, 2, 15),
                end: new Date(2024, 4, 1),
            };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(4);
            expect(component.filteredData().map(r => r.name)).toEqual(['Beta', 'Gamma', 'Delta', 'Epsilon']);
        });

        it('should show all rows when range has null start and end', () => {
            const range: DateRange = { start: null, end: null };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(5);
        });

        it('should filter with only start date (open-ended range)', () => {
            const range: DateRange = { start: new Date(2024, 3, 10), end: null };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(2);
            expect(component.filteredData().map(r => r.name)).toEqual(['Delta', 'Epsilon']);
        });

        it('should filter with only end date (open-ended range)', () => {
            const range: DateRange = { start: null, end: new Date(2024, 2, 10) };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(1);
            expect(component.filteredData()[0].name).toBe('Alpha');
        });

        it('should update filter via onColumnFilterChange', () => {
            const range: DateRange = {
                start: new Date(2024, 3, 1),
                end: new Date(2024, 3, 30),
            };
            component.onColumnFilterChange('createdAt', range);
            fixture.detectChanges();

            expect(component.filteredData().length).toBe(2);
            expect(component.filteredData().map(r => r.name)).toEqual(['Gamma', 'Delta']);
        });
    });
});
