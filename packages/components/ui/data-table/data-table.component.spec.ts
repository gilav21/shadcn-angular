import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { DataTableComponent } from './data-table.component';
import { ColumnDef, PaginationState, FlattenedTreeRow, RowActionContext } from './data-table.types';
import { buildTreeFromFlat, computeAggregateValue } from './data-table.utils';
import type { DataTableLocale } from './data-table.locales';
import { dateFilterFn } from './sub/data-table-date-filter.component';
import { dateRangeFilterFn } from './sub/data-table-date-range-filter.component';
import { DateRange } from '../calendar';
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
        expect(rows).toHaveLength(6);
    });

    it('should filter data correctly', () => {
        component.onFilterChange('Alice');
        fixture.detectChanges();

        expect(component.processedData()).toHaveLength(1);
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
        expect(component.filteredData()).toHaveLength(0);
    });

    it('should use custom globalFilterFn when provided', () => {
        fixture.componentRef.setInput('globalFilterFn', (row: TestData, filter: string) => row.role.toLowerCase() === filter);
        fixture.detectChanges();

        component.onFilterChange('admin');
        fixture.detectChanges();

        expect(component.filteredData()).toHaveLength(2);
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

    it('should expose aria-sort state for header cells', () => {
        fixture.detectChanges();
        const nameCol = component.enhancedColumns().find(c => c.accessorKey === 'name')!;
        expect(component.getAriaSort(nameCol)).toBe('none');

        component.onSortChange('name', 'asc');
        expect(component.getAriaSort(nameCol)).toBe('ascending');

        component.onSortChange('name', 'desc');
        expect(component.getAriaSort(nameCol)).toBe('descending');
    });

    it('should not expose aria-sort for non-sortable columns', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID', enableSorting: false },
            { accessorKey: 'name', header: 'Name' },
        ]);
        fixture.detectChanges();

        const idCol = component.enhancedColumns().find(c => c.accessorKey === 'id')!;
        expect(component.getAriaSort(idCol)).toBeNull();
    });

    it('should announce sort changes to screen readers', () => {
        fixture.detectChanges();
        expect(component.srAnnouncement()).toBe('');

        component.onSortChange('name', 'asc');
        expect(component.srAnnouncement()).toContain('Name');
        expect(component.srAnnouncement()).toContain('ascending');

        component.onSortChange('name', null);
        expect(component.srAnnouncement()).toContain('Sorting removed');
    });

    it('should not announce when clearing an already-unsorted column', () => {
        fixture.detectChanges();
        expect(component.srAnnouncement()).toBe('');

        component.onSortChange('id', null);
        expect(component.srAnnouncement()).toBe('');
    });

    it('should announce filter result counts to screen readers', () => {
        vi.useFakeTimers();
        try {
            component.onFilterChange('Alice');
            vi.advanceTimersByTime(600);
            expect(component.srAnnouncement()).toContain('result');

            component.onFilterChange('');
            vi.advanceTimersByTime(600);
            expect(component.srAnnouncement()).toContain('Filter cleared');
        } finally {
            vi.useRealTimers();
        }
    });

    it('should debounce filter announcements during rapid typing', () => {
        vi.useFakeTimers();
        try {
            component.onFilterChange('A');
            component.onFilterChange('Al');
            component.onFilterChange('Ali');
            expect(component.srAnnouncement()).toBe('');

            vi.advanceTimersByTime(600);
            expect(component.srAnnouncement()).toContain('"Ali"');
        } finally {
            vi.useRealTimers();
        }
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

        expect(component.processedData()).toHaveLength(2);
        expect(component.processedData()[0].name).toBe('Alice'); // Sorted by default or insertion order? insertion order here.

        // Go to next page
        component.onPaginationChange({ pageIndex: 1, pageSize: 2 });
        fixture.detectChanges();

        expect(component.processedData()).toHaveLength(2);
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
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID', sticky: true, width: '50px' },
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        const enhancedStickyCol = component.enhancedColumns().find(c => c.accessorKey === 'id')!;

        const headerClass = component.getHeaderClass(enhancedStickyCol);
        expect(headerClass).toContain('z-30');
        expect(headerClass).toContain('sticky');

        const cellStyle = component.getCellStyle(enhancedStickyCol);
        expect(cellStyle['position']).toBe('sticky');
        expect(cellStyle['left']).toBe('0px');
    });

    it('should apply right pin styles correctly', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', pin: 'right' as const, width: '120px' },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        const enhancedRightCol = component.enhancedColumns().find(c => c.accessorKey === 'name')!;
        const rightPinnedStyle = component.getCellStyle(enhancedRightCol);
        expect(rightPinnedStyle['position']).toBe('sticky');
        expect(rightPinnedStyle['right']).toBe('0px');
    });

    it('should debounce filter changes when filterDebounce is set', async () => {
        fixture.componentRef.setInput('filterDebounce', 100);
        fixture.detectChanges();

        component.onFilterChange('test');
        expect(component.globalFilter()).toBe('');

        await new Promise(resolve => setTimeout(resolve, 150));
        expect(component.globalFilter()).toBe('test');
    });

    it('should not debounce filter when filterDebounce is 0', () => {
        fixture.componentRef.setInput('filterDebounce', 0);
        fixture.detectChanges();

        component.onFilterChange('instant');
        expect(component.globalFilter()).toBe('instant');
    });

    it('should expose scrollToRow method', () => {
        expect(typeof component.scrollToRow).toBe('function');
    });

    it('should expose scrollToColumn method', () => {
        expect(typeof component.scrollToColumn).toBe('function');
    });

    it('should expose scrollToCell method', () => {
        expect(typeof component.scrollToCell).toBe('function');
    });

    it('should navigate focus with arrow keys', () => {
        fixture.detectChanges();
        component.focusedCell.set({ rowIndex: 0, columnKey: 'id' });

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        component.onTableKeydown(event);
        expect(component.focusedCell()?.columnKey).toBe('name');

        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        component.onTableKeydown(downEvent);
        expect(component.focusedCell()?.rowIndex).toBe(1);
    });

    it('should navigate with Tab wrapping to next row', () => {
        fixture.detectChanges();
        component.focusedCell.set({ rowIndex: 0, columnKey: 'role' });

        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
        component.onTableKeydown(tabEvent);
        expect(component.focusedCell()?.rowIndex).toBe(1);
        expect(component.focusedCell()?.columnKey).toBe('id');
    });

    it('should navigate to first cell on Home', () => {
        fixture.detectChanges();
        component.focusedCell.set({ rowIndex: 2, columnKey: 'role' });

        const homeEvent = new KeyboardEvent('keydown', { key: 'Home', ctrlKey: true });
        component.onTableKeydown(homeEvent);
        expect(component.focusedCell()?.rowIndex).toBe(0);
        expect(component.focusedCell()?.columnKey).toBe('id');
    });

    it('should start editing on Enter when column is editable', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        component.focusedCell.set({ rowIndex: 0, columnKey: 'name' });
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
        component.onTableKeydown(enterEvent);
        expect(component.editingCell()).toEqual({ rowIndex: 0, columnKey: 'name' });
        expect(component.editValue()).toBe('Alice');
    });

    it('should not start editing when column is not editable', () => {
        fixture.detectChanges();
        component.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
        component.onTableKeydown(enterEvent);
        expect(component.editingCell()).toBeNull();
    });

    it('should commit edit and emit cellEdit event', () => {
        const editSpy = vi.fn();
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();
        component.cellEdit.subscribe(editSpy);

        component.startEditing(0, 'name');
        component.onEditValueChange('Alice Updated');
        component.commitEdit();

        expect(editSpy).toHaveBeenCalledWith(expect.objectContaining({
            oldValue: 'Alice',
            newValue: 'Alice Updated',
            rowIndex: 0,
        }));
        expect(component.editingCell()).toBeNull();
    });

    it('should cancel edit on Escape', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        component.startEditing(0, 'name');
        expect(component.editingCell()).not.toBeNull();

        component.cancelEdit();
        expect(component.editingCell()).toBeNull();
    });

    it('should reject edit and surface an error when validator returns false', () => {
        const editSpy = vi.fn();
        const errorSpy = vi.fn();
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true, editValidator: () => false },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();
        component.cellEdit.subscribe(editSpy);
        component.editError.subscribe(errorSpy);

        component.startEditing(0, 'name');
        component.onEditValueChange('Bad Value');
        component.commitEdit();

        expect(editSpy).not.toHaveBeenCalled();
        expect(component.editingCell()).not.toBeNull();
        expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
            value: 'Bad Value',
            rowIndex: 0,
            message: 'Invalid value',
        }));
        expect(component.cellEditError()?.message).toBe('Invalid value');
    });

    it('should surface the validator message when editValidator returns a string', () => {
        const errorSpy = vi.fn();
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true, editValidator: () => 'Name is too short' },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();
        component.editError.subscribe(errorSpy);

        component.startEditing(0, 'name');
        component.onEditValueChange('X');
        component.commitEdit();

        expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Name is too short' }));
        expect(component.cellEditError()?.message).toBe('Name is too short');
    });

    it('should render an inline error message when an edit is rejected', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true, editValidator: () => 'Bad name' },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        component.startEditing(0, 'name');
        component.onEditValueChange('whatever');
        component.commitEdit();
        fixture.detectChanges();

        const errorEl = fixture.nativeElement.querySelector('[data-slot="cell-edit-error"]');
        expect(errorEl).toBeTruthy();
        expect(errorEl?.textContent).toContain('Bad name');

        const input = fixture.nativeElement.querySelector('input[data-edit-input]');
        expect(input?.getAttribute('aria-invalid')).toBe('true');
        expect(errorEl?.getAttribute('id')).toBeTruthy();
        expect(input?.getAttribute('aria-describedby')).toBe(errorEl?.getAttribute('id'));
    });

    it('should not re-emit editError when committing the same rejected value', () => {
        const errorSpy = vi.fn();
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true, editValidator: () => false },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();
        component.editError.subscribe(errorSpy);

        component.startEditing(0, 'name');
        component.onEditValueChange('Bad Value');
        component.commitEdit();
        component.commitEdit();
        component.commitEdit();

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(component.editingCell()).not.toBeNull();
    });

    it('should clear the edit error when the edit value changes', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true, editValidator: (v: unknown) => v === 'ok' || 'Invalid' },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        component.startEditing(0, 'name');
        component.onEditValueChange('bad');
        component.commitEdit();
        expect(component.cellEditError()).not.toBeNull();

        component.onEditValueChange('still typing');
        expect(component.cellEditError()).toBeNull();
    });

    it('should apply the valueSetter result back into the table data on commit', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            {
                accessorKey: 'name', header: 'Name', editable: true,
                valueSetter: (row: TestData, val: unknown) => ({ ...row, name: String(val) }),
            },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        component.startEditing(0, 'name');
        component.onEditValueChange('Alice Renamed');
        component.commitEdit();

        expect(component.data()[0].name).toBe('Alice Renamed');
        expect(component.editingCell()).toBeNull();
    });

    it('should pin column via pinColumn method', () => {
        fixture.detectChanges();
        component.pinColumn('name', 'left');
        fixture.detectChanges();

        const nameCol = component.enhancedColumns().find(c => c.accessorKey === 'name');
        expect(nameCol?._pin).toBe('left');
    });

    it('should unpin column via pinColumn method', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', pin: 'left' as const },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        component.pinColumn('name', undefined);
        fixture.detectChanges();

        const nameCol = component.enhancedColumns().find(c => c.accessorKey === 'name');
        expect(nameCol?._pin).toBeUndefined();
    });

    it('should show all columns via showAllColumns', () => {
        fixture.detectChanges();
        component.setColumnVisibility('id', false);
        component.setColumnVisibility('role', false);
        fixture.detectChanges();

        expect(component.enhancedColumns().find(c => c.accessorKey === 'id')).toBeUndefined();

        component.showAllColumns();
        fixture.detectChanges();

        expect(component.enhancedColumns().find(c => c.accessorKey === 'id')).toBeDefined();
        expect(component.enhancedColumns().find(c => c.accessorKey === 'role')).toBeDefined();
    });

    it('should compute footer aggregate sum', () => {
        interface NumData { id: string; amount: number }
        const numFixture = TestBed.createComponent(DataTableComponent<NumData>);
        const numComponent = numFixture.componentInstance;
        numFixture.componentRef.setInput('data', [
            { id: '1', amount: 10 },
            { id: '2', amount: 20 },
            { id: '3', amount: 30 },
        ]);
        numFixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'amount', header: 'Amount', aggregateFn: 'sum' },
        ]);
        numFixture.componentRef.setInput('showFooter', true);
        numFixture.detectChanges();

        expect(numComponent.hasFooter()).toBe(true);
        expect(numComponent.footerValues().get('amount')).toBe('60');
    });

    it('should compute footer aggregate avg', () => {
        interface NumData { id: string; amount: number }
        const numFixture = TestBed.createComponent(DataTableComponent<NumData>);
        const numComponent = numFixture.componentInstance;
        numFixture.componentRef.setInput('data', [
            { id: '1', amount: 10 },
            { id: '2', amount: 20 },
        ]);
        numFixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'amount', header: 'Amount', aggregateFn: 'avg' },
        ]);
        numFixture.componentRef.setInput('showFooter', true);
        numFixture.detectChanges();

        expect(numComponent.footerValues().get('amount')).toBe('15');
    });

    it('should use custom footer function', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', footer: (rows: TestData[]) => `${rows.length} items` },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.componentRef.setInput('showFooter', true);
        fixture.detectChanges();

        expect(component.footerValues().get('name')).toBe('5 items');
    });

    it('should detect floating filters when enableFloatingFilters and columns have enableFiltering', () => {
        fixture.componentRef.setInput('enableFloatingFilters', true);
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', enableFiltering: true },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        expect(component.hasAnyFloatingFilter()).toBe(true);
    });

    it('should not detect floating filters when disabled', () => {
        fixture.componentRef.setInput('enableFloatingFilters', false);
        fixture.detectChanges();

        expect(component.enableFloatingFilters()).toBe(false);
    });

    it('should detect full-width rows', () => {
        fixture.componentRef.setInput('fullWidthRow', (row: TestData) => row.role === 'Admin');
        fixture.detectChanges();

        expect(component.isFullWidthRow(TEST_DATA[0])).toBe(true);
        expect(component.isFullWidthRow(TEST_DATA[1])).toBe(false);
    });

    it('should disable rows via isRowDisabled function', () => {
        fixture.componentRef.setInput('isRowDisabled', (row: TestData) => row.role === 'Admin');
        fixture.detectChanges();

        expect(component.isDisabled(TEST_DATA[0])).toBe(true);
        expect(component.isDisabled(TEST_DATA[1])).toBe(false);
        expect(component.isDisabled(TEST_DATA[3])).toBe(true);
    });

    it('should disable rows via disabledRowIds', () => {
        fixture.componentRef.setInput('disabledRowIds', ['2', '3']);
        fixture.detectChanges();

        expect(component.isDisabled(TEST_DATA[0])).toBe(false);
        expect(component.isDisabled(TEST_DATA[1])).toBe(true);
        expect(component.isDisabled(TEST_DATA[2])).toBe(true);
    });

    it('should disable rows via disabledRowIds Set', () => {
        fixture.componentRef.setInput('disabledRowIds', new Set(['1']));
        fixture.detectChanges();

        expect(component.isDisabled(TEST_DATA[0])).toBe(true);
        expect(component.isDisabled(TEST_DATA[1])).toBe(false);
    });

    it('should prevent selection of disabled rows via toggleRow', () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.componentRef.setInput('isRowDisabled', (row: TestData) => row.id === '1');
        fixture.detectChanges();

        component.toggleRow(TEST_DATA[0]);
        expect(component.isRowSelected(TEST_DATA[0])).toBe(false);

        component.toggleRow(TEST_DATA[1]);
        expect(component.isRowSelected(TEST_DATA[1])).toBe(true);
    });

    it('should skip disabled rows in toggleAll', () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.componentRef.setInput('isRowDisabled', (row: TestData) => row.id === '2');
        fixture.detectChanges();

        component.toggleAll();
        expect(component.isRowSelected(TEST_DATA[0])).toBe(true);
        expect(component.isRowSelected(TEST_DATA[1])).toBe(false);
        expect(component.isRowSelected(TEST_DATA[2])).toBe(true);
    });

    it('should not start editing on disabled rows', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.componentRef.setInput('isRowDisabled', (row: TestData) => row.id === '1');
        fixture.detectChanges();

        component.startEditing(0, 'name');
        expect(component.editingCell()).toBeNull();

        component.startEditing(1, 'name');
        expect(component.editingCell()).not.toBeNull();
    });

    it('should skip disabled rows during keyboard navigation', () => {
        fixture.componentRef.setInput('isRowDisabled', (row: TestData) => row.id === '2');
        fixture.detectChanges();

        component.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        component.onTableKeydown(downEvent);
        expect(component.focusedCell()?.rowIndex).toBe(2);
    });

    it('should emit rowReorder event on row drop', () => {
        const reorderSpy = vi.fn();
        fixture.componentRef.setInput('enableRowDrag', true);
        fixture.detectChanges();
        component.rowReorder.subscribe(reorderSpy);

        component.draggedRowId.set('1');
        (component as any).dragOverIndex.set(3);
        (component as any).dragOverPosition.set('above');
        component.onRowDrop({ preventDefault: () => {}, stopPropagation: () => {} } as any);

        expect(reorderSpy).toHaveBeenCalledWith(expect.objectContaining({
            fromIndex: 0,
            toIndex: 2,
        }));
    });

    it('should prevent dragging disabled rows', () => {
        fixture.componentRef.setInput('enableRowDrag', true);
        fixture.componentRef.setInput('isRowDisabled', (row: TestData) => row.id === '1');
        fixture.detectChanges();

        const event = { dataTransfer: { effectAllowed: '', setData: vi.fn() } } as any;
        component.onRowDragStart(event, TEST_DATA[0]);
        expect(component.draggedRowId()).toBeNull();

        component.onRowDragStart(event, TEST_DATA[1]);
        expect(component.draggedRowId()).toBe('2');
    });

    function cellEl(rowIndex: number, columnKey: string): HTMLElement {
        return fixture.debugElement.query(
            By.css(`[data-row-index="${rowIndex}"] [data-column="${columnKey}"]`),
        ).nativeElement as HTMLElement;
    }

    it('extends the cell range on shift + mousedown from the focused anchor', () => {
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.detectChanges();
        component.focusedCell.set({ rowIndex: 0, columnKey: 'id' });

        cellEl(2, 'role').dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }),
        );

        expect(component.cellRange()).toEqual({ startRow: 0, startCol: 'id', endRow: 2, endCol: 'role' });
        globalThis.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('selects a range by click-dragging without shift', () => {
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.detectChanges();

        cellEl(0, 'id').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
        const target = cellEl(2, 'name').getBoundingClientRect();
        globalThis.dispatchEvent(
            new MouseEvent('mousemove', { clientX: target.left + target.width / 2, clientY: target.top + target.height / 2 }),
        );

        expect(component.cellRange()).toEqual({ startRow: 0, startCol: 'id', endRow: 2, endCol: 'name' });
        globalThis.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('collapses a no-drag click to a plain focus (no range)', () => {
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.detectChanges();

        cellEl(1, 'name').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
        globalThis.dispatchEvent(new MouseEvent('mouseup'));

        expect(component.cellRange()).toBeNull();
        expect(component.focusedCell()).toEqual({ rowIndex: 1, columnKey: 'name' });
    });

    it('styles the active cell and range cells distinctly', () => {
        component.focusedCell.set({ rowIndex: 1, columnKey: 'name' });
        component.cellRange.set({ startRow: 1, startCol: 'name', endRow: 2, endCol: 'role' });
        expect(component.getCellClass({ accessorKey: 'name', _width: 'auto' } as any, 1)).toContain('ring-primary');
        expect(component.getCellClass({ accessorKey: 'role', _width: 'auto' } as any, 2)).toContain('bg-primary/15');
    });

    it('disables native text selection while range selection is enabled', () => {
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.detectChanges();
        const container = fixture.debugElement.query(By.css('[tabindex="0"].overflow-auto')).nativeElement as HTMLElement;
        expect(container.classList.contains('select-none')).toBe(true);
    });

    it('should detect cells in range', () => {
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.detectChanges();

        component.cellRange.set({ startRow: 0, startCol: 'id', endRow: 2, endCol: 'name' });
        expect(component.isCellInRange(1, 'id')).toBe(true);
        expect(component.isCellInRange(1, 'name')).toBe(true);
        expect(component.isCellInRange(1, 'role')).toBe(false);
        expect(component.isCellInRange(3, 'id')).toBe(false);
    });

    it('should clear cell range on Escape', () => {
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.detectChanges();

        component.cellRange.set({ startRow: 0, startCol: 'id', endRow: 2, endCol: 'name' });
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        component.onTableKeydown(escEvent);
        expect(component.cellRange()).toBeNull();
    });

    it('should expose getCellFlashClass method', () => {
        expect(typeof component.getCellFlashClass).toBe('function');
        expect(component.getCellFlashClass('1', 'name')).toBe('');
    });

    it('should auto-detect footer when columns have aggregateFn', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID', aggregateFn: 'count' },
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'role', header: 'Role' },
        ]);
        fixture.detectChanges();

        expect(component.hasFooter()).toBe(true);
        expect(component.footerValues().get('id')).toBe('5');
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
            expect(resizeHandles).toHaveLength(0);
        });

        it('should show resize handles when enableColumnResize is true', () => {
            fixture.componentRef.setInput('enableColumnResize', true);
            fixture.detectChanges();

            // Should have resize handles for columns (not selection column, not auto-width columns)
            const resizeHandles = fixture.debugElement.queryAll(By.css('[role="separator"]'));
            expect(resizeHandles.length).toBeGreaterThan(0);
        });

        it('should give the resize handle a wide touch hit area with a thin visual line', () => {
            fixture.componentRef.setInput('enableColumnResize', true);
            fixture.detectChanges();

            const handle = fixture.nativeElement.querySelector('[role="separator"]');
            expect(handle).toBeTruthy();
            expect(handle.className).toContain('w-4');
            expect(handle.className).toContain('touch-none');

            const visualLine = handle.querySelector('div');
            expect(visualLine).toBeTruthy();
            expect(visualLine.className).toContain('w-px');
        });

        it('should keep the resize handle highlighted for the whole drag', () => {
            fixture.componentRef.setInput('enableColumnResize', true);
            fixture.detectChanges();

            const nameCol = component.enhancedColumns().find(c => c.accessorKey === 'name');
            expect(nameCol).toBeTruthy();
            expect(component.isResizingColumn(nameCol!)).toBe(false);

            component.onResizeStart(new MouseEvent('mousedown', { clientX: 100 }), nameCol!);
            expect(component.isResizingColumn(nameCol!)).toBe(true);
            expect(component.resizeLineClass(nameCol!)).toContain('bg-primary/70');

            document.dispatchEvent(new MouseEvent('mouseup'));
            expect(component.isResizingColumn(nameCol!)).toBe(false);
        });

        it('should track column widths in signal', () => {
            fixture.componentRef.setInput('enableColumnResize', true);
            fixture.detectChanges();

            // Initially empty
            expect(Object.keys(component.columnWidths())).toHaveLength(0);

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

            expect(component.filteredData()).toHaveLength(1);
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

            expect(component.filteredData()).toHaveLength(2);
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
            expect(selected).toHaveLength(2);
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
            expect(component.selectedRows()).toHaveLength(3);
        });

        it('should clear all selection via clearSelection()', () => {
            component.selectRows(TEST_DATA);
            fixture.detectChanges();

            component.clearSelection();
            fixture.detectChanges();

            expect(component.selectedRows()).toHaveLength(0);
            expect(component.isAllSelected()).toBe(false);
        });

        it('should select all visible rows via selectAll()', () => {
            component.selectAll();
            fixture.detectChanges();

            expect(component.isAllSelected()).toBe(true);
            expect(component.selectedRows()).toHaveLength(TEST_DATA.length);
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
            expect(emitted.at(-1)).toEqual({ role: 'User' });
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

            expect(component.filteredData()).toHaveLength(1);
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

            expect(component.filteredData()).toHaveLength(TEST_DATA.length);
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
            expect(rows).toHaveLength(3);
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
            expect(rows).toHaveLength(9);
        });

        it('should collapse all sub-rows', () => {
            component.expandAllSubRows(-1);
            fixture.detectChanges();

            component.collapseAllSubRows();
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            expect(rows).toHaveLength(3);
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
            expect(rows).toHaveLength(9);
        });

        it('should keep all collapsed when subRowDefaultExpanded is 0', () => {
            fixture.componentRef.setInput('subRowDefaultExpanded', 0);
            fixture.detectChanges();

            const rows = component.processedTreeRows();
            expect(rows).toHaveLength(3);
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
            expect(rows).toHaveLength(3);
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
            expect(children).toHaveLength(2);
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
            const ctx = result['_subRowContext'] as Record<string, unknown>;
            expect(ctx['depth']).toBe(2);
            expect(ctx['parentId']).toBe('1-1');
            expect(ctx['isLeaf']).toBe(true);
            expect(ctx['path']).toEqual(['1', '1-1', '1-1-1']);
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

});

describe('DataTableComponent - Addon host slots & context', () => {
    let component: DataTableComponent<TestData>;
    let fixture: ComponentFixture<DataTableComponent<TestData>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<TestData>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', TEST_DATA);
        fixture.componentRef.setInput('columns', TEST_COLUMNS);
        fixture.detectChanges();
    });

    function registerCellSlot(
        onClick: (event: Event, context: RowActionContext<TestData>) => void = () => {},
    ): void {
        component.registerCellAction({ id: 'context-menu', icon: 'more-vertical', ariaLabel: 'Row actions', onClick });
    }

    it('adds the _actions column when a cell action slot is registered', () => {
        registerCellSlot();
        fixture.detectChanges();

        const actionsCol = component.enhancedColumns().find(c => c.accessorKey === '_actions');
        expect(actionsCol).toBeTruthy();
        expect(actionsCol!.enableSorting).toBe(false);
        expect(actionsCol!.enableHiding).toBe(false);
    });

    it('omits the _actions column when no cell action slot is registered', () => {
        expect(component.enhancedColumns().find(c => c.accessorKey === '_actions')).toBeUndefined();
    });

    it('removes the _actions column when the slot is unregistered', () => {
        const remove = component.registerCellAction({ id: 'context-menu', onClick: () => {} });
        fixture.detectChanges();
        expect(component.enhancedColumns().find(c => c.accessorKey === '_actions')).toBeTruthy();

        remove();
        fixture.detectChanges();
        expect(component.enhancedColumns().find(c => c.accessorKey === '_actions')).toBeUndefined();
    });

    it('renders one ⋮ button per row for a registered cell slot', () => {
        registerCellSlot();
        fixture.detectChanges();

        const buttons = fixture.debugElement.queryAll(By.css('[aria-label="Row actions"]'));
        expect(buttons).toHaveLength(component.processedData().length);
    });

    it('invokes the slot onClick with the row context when a ⋮ button is clicked', () => {
        let captured: RowActionContext<TestData> | undefined;
        registerCellSlot((_event, context) => { captured = context; });
        fixture.detectChanges();

        fixture.debugElement.query(By.css('[aria-label="Row actions"]')).nativeElement.click();
        expect(captured?.row).toBe(component.processedData()[0]);
        expect(captured?.index).toBe(0);
    });

    it('keeps global filtering working with the _actions column present', () => {
        registerCellSlot();
        fixture.detectChanges();

        component.onFilterChange('Alice');
        fixture.detectChanges();
        expect(component.filteredData()).toHaveLength(1);
    });

    it('renders one ⋮ header button per data column for a registered header slot', () => {
        component.registerHeaderAction({ id: 'context-menu', icon: 'more-vertical', onClick: () => {} });
        fixture.detectChanges();

        const buttons = fixture.debugElement.queryAll(By.css('[aria-label^="Column menu for"]'));
        expect(buttons).toHaveLength(TEST_COLUMNS.length);
    });

    it('getRowContext reports the row, index, and selection state', () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        component.rowSelection.set({ '1': true });
        fixture.detectChanges();

        const ctx = component.getRowContext(TEST_DATA[0], 0);
        expect(ctx.row).toBe(TEST_DATA[0]);
        expect(ctx.index).toBe(0);
        expect(ctx.selected).toBe(true);
        expect(component.getRowContext(TEST_DATA[1], 1).selected).toBe(false);
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

        expect(tree).toHaveLength(2);
        expect(tree[0].name).toBe('Root A');
        expect(tree[0].children!).toHaveLength(2);
        expect(tree[0].children![0].children!).toHaveLength(1);
        expect(tree[0].children![0].children![0].name).toBe('Grandchild A1-1');
        expect(tree[1].children!).toHaveLength(1);
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

        expect(tree).toHaveLength(1);
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
            expect(component.filteredData()).toHaveLength(5);
        });

        it('should filter to exact date match', () => {
            fixture.componentRef.setInput('columnFilters', { createdAt: new Date(2024, 2, 15) });
            fixture.detectChanges();

            expect(component.filteredData()).toHaveLength(1);
            expect(component.filteredData()[0].name).toBe('Beta');
        });

        it('should return no rows when date does not match any row', () => {
            fixture.componentRef.setInput('columnFilters', { createdAt: new Date(2024, 0, 1) });
            fixture.detectChanges();

            expect(component.filteredData()).toHaveLength(0);
        });

        it('should show all rows when filter is cleared to null', () => {
            fixture.componentRef.setInput('columnFilters', { createdAt: new Date(2024, 2, 15) });
            fixture.detectChanges();
            expect(component.filteredData()).toHaveLength(1);

            fixture.componentRef.setInput('columnFilters', { createdAt: null });
            fixture.detectChanges();
            expect(component.filteredData()).toHaveLength(5);
        });

        it('should update filter via onColumnFilterChange', () => {
            component.onColumnFilterChange('createdAt', new Date(2024, 3, 1));
            fixture.detectChanges();

            expect(component.filteredData()).toHaveLength(1);
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
            expect(component.filteredData()).toHaveLength(5);
        });

        it('should filter rows within date range inclusively', () => {
            const range: DateRange = {
                start: new Date(2024, 2, 10),
                end: new Date(2024, 3, 10),
            };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData()).toHaveLength(2);
            expect(component.filteredData().map(r => r.name)).toEqual(['Beta', 'Gamma']);
        });

        it('should include boundary dates', () => {
            const range: DateRange = {
                start: new Date(2024, 2, 15),
                end: new Date(2024, 4, 1),
            };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData()).toHaveLength(4);
            expect(component.filteredData().map(r => r.name)).toEqual(['Beta', 'Gamma', 'Delta', 'Epsilon']);
        });

        it('should show all rows when range has null start and end', () => {
            const range: DateRange = { start: null, end: null };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData()).toHaveLength(5);
        });

        it('should filter with only start date (open-ended range)', () => {
            const range: DateRange = { start: new Date(2024, 3, 10), end: null };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData()).toHaveLength(2);
            expect(component.filteredData().map(r => r.name)).toEqual(['Delta', 'Epsilon']);
        });

        it('should filter with only end date (open-ended range)', () => {
            const range: DateRange = { start: null, end: new Date(2024, 2, 10) };
            fixture.componentRef.setInput('columnFilters', { createdAt: range });
            fixture.detectChanges();

            expect(component.filteredData()).toHaveLength(1);
            expect(component.filteredData()[0].name).toBe('Alpha');
        });

        it('should update filter via onColumnFilterChange', () => {
            const range: DateRange = {
                start: new Date(2024, 3, 1),
                end: new Date(2024, 3, 30),
            };
            component.onColumnFilterChange('createdAt', range);
            fixture.detectChanges();

            expect(component.filteredData()).toHaveLength(2);
            expect(component.filteredData().map(r => r.name)).toEqual(['Gamma', 'Delta']);
        });
    });
});

describe('DataTableComponent - Row Grouping', () => {
    interface OrderData {
        id: string;
        status: string;
        amount: number;
    }

    const ORDER_DATA: OrderData[] = [
        { id: 'o1', status: 'pending', amount: 10 },
        { id: 'o2', status: 'shipped', amount: 20 },
        { id: 'o3', status: 'pending', amount: 30 },
        { id: 'o4', status: 'delivered', amount: 40 },
        { id: 'o5', status: 'shipped', amount: 50 },
    ];

    const ORDER_COLUMNS: ColumnDef<OrderData>[] = [
        { accessorKey: 'id', header: 'ID' },
        { accessorKey: 'status', header: 'Status' },
        { accessorKey: 'amount', header: 'Amount', aggregateFn: 'sum' },
    ];

    let fixture: ComponentFixture<DataTableComponent<OrderData>>;
    let component: DataTableComponent<OrderData>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataTableComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(DataTableComponent<OrderData>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', ORDER_DATA);
        fixture.componentRef.setInput('columns', ORDER_COLUMNS);
        fixture.componentRef.setInput('groupBy', 'status');
        fixture.detectChanges();
    });

    it('partitions rows into insertion-ordered groups', () => {
        const rows = component.groupedDisplayRows();
        const groupKeys = rows
            .filter((r) => r.kind === 'group')
            .map((r) => (r as { groupKey: string }).groupKey);
        expect(groupKeys).toEqual(['pending', 'shipped', 'delivered']);

        const pendingGroup = rows.find(
            (r) => r.kind === 'group' && r.groupKey === 'pending',
        ) as { count: number };
        expect(pendingGroup.count).toBe(2);
    });

    it('emits group header followed by its data rows', () => {
        const rows = component.groupedDisplayRows();
        expect(rows[0].kind).toBe('group');
        expect(rows[1].kind).toBe('data');
        expect(rows[2].kind).toBe('data');
        expect(rows[3].kind).toBe('group');
    });

    it('hides a collapsed group\'s data rows from the display list', () => {
        fixture.componentRef.setInput('collapsedGroups', { pending: true });
        fixture.detectChanges();

        const rows = component.groupedDisplayRows();
        const dataRowsForPending = rows.filter(
            (r) => r.kind === 'data' && r.row.status === 'pending',
        );
        expect(dataRowsForPending).toHaveLength(0);

        const pendingGroup = rows.find(
            (r) => r.kind === 'group' && r.groupKey === 'pending',
        ) as { collapsed: boolean };
        expect(pendingGroup.collapsed).toBe(true);
    });

    it('computes per-group aggregates correctly', () => {
        const rows = component.groupedDisplayRows();
        const shippedGroup = rows.find(
            (r) => r.kind === 'group' && r.groupKey === 'shipped',
        ) as { aggregates: Map<string, string> };
        expect(shippedGroup.aggregates.get('amount')).toBe('70');

        const pendingGroup = rows.find(
            (r) => r.kind === 'group' && r.groupKey === 'pending',
        ) as { aggregates: Map<string, string> };
        expect(pendingGroup.aggregates.get('amount')).toBe('40');
    });

    it('omits aggregates when groupAggregates is false', () => {
        fixture.componentRef.setInput('groupAggregates', false);
        fixture.detectChanges();

        const rows = component.groupedDisplayRows();
        const shippedGroup = rows.find(
            (r) => r.kind === 'group' && r.groupKey === 'shipped',
        ) as { aggregates: Map<string, string> };
        expect(shippedGroup.aggregates.size).toBe(0);
    });

    it('disables grouping and warns when combined with enableSubRows', () => {
        const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const globalScope = globalThis as { ngDevMode?: unknown };
        const previousDevMode = globalScope.ngDevMode;
        globalScope.ngDevMode = true;

        fixture.componentRef.setInput('enableSubRows', true);
        fixture.detectChanges();
        component.ngAfterViewInit();

        expect(component.groupingActive()).toBe(false);
        expect(component.groupedDisplayRows()).toHaveLength(0);
        expect(
            warnSpy.mock.calls.some((call) =>
                String(call[0]).includes('groupBy is set together with'),
            ),
        ).toBe(true);

        globalScope.ngDevMode = previousDevMode;
        warnSpy.mockRestore();
    });

    it('collapseAllGroups collapses every group, expandAllGroups clears state', () => {
        component.collapseAllGroups();
        fixture.detectChanges();
        expect(component.collapsedGroups()).toEqual({
            pending: true,
            shipped: true,
            delivered: true,
        });

        const collapsedRows = component.groupedDisplayRows();
        expect(collapsedRows.every((r) => r.kind === 'group')).toBe(true);

        component.expandAllGroups();
        fixture.detectChanges();
        expect(component.collapsedGroups()).toEqual({});
        expect(component.groupedDisplayRows()).toHaveLength(8);
    });

    it('paginator total reflects groupedDisplayRows length in grouped mode', () => {
        expect(component.activeTotalItems()).toBe(component.groupedDisplayRows().length);
        expect(component.activeTotalItems()).toBe(8);

        component.collapseAllGroups();
        fixture.detectChanges();
        expect(component.activeTotalItems()).toBe(3);
    });

    it('pagedGroupedDisplayRows slices by the current page', () => {
        fixture.componentRef.setInput('paginationState', { pageIndex: 0, pageSize: 3 });
        fixture.detectChanges();
        const page0 = component.pagedGroupedDisplayRows();
        expect(page0).toHaveLength(3);
        expect(page0[0].kind).toBe('group');
        expect((page0[0] as { groupKey: string }).groupKey).toBe('pending');
        expect((page0[1] as { row: OrderData }).row.id).toBe('o1');
        expect((page0[2] as { row: OrderData }).row.id).toBe('o3');

        fixture.componentRef.setInput('paginationState', { pageIndex: 1, pageSize: 3 });
        fixture.detectChanges();
        const page1 = component.pagedGroupedDisplayRows();
        expect(page1).toHaveLength(3);
        expect((page1[0] as { groupKey: string }).groupKey).toBe('shipped');
        expect((page1[1] as { row: OrderData }).row.id).toBe('o2');
        expect((page1[2] as { row: OrderData }).row.id).toBe('o5');

        fixture.componentRef.setInput('paginationState', { pageIndex: 2, pageSize: 3 });
        fixture.detectChanges();
        const page2 = component.pagedGroupedDisplayRows();
        expect(page2).toHaveLength(2);
        expect((page2[0] as { groupKey: string }).groupKey).toBe('delivered');
        expect((page2[1] as { row: OrderData }).row.id).toBe('o4');
    });
});

describe('DataTableComponent — i18n integration', () => {
    interface Row { id: number; name: string }
    const ROWS: Row[] = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    const COLS: ColumnDef<Row>[] = [
        { accessorKey: 'id', header: 'ID' },
        { accessorKey: 'name', header: 'Name' },
    ];

    async function setup(
        locale?: string | DataTableLocale,
        providerLocale?: string,
    ): Promise<ComponentFixture<DataTableComponent<Row>>> {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [DataTableComponent],
            providers: providerLocale ? [provideUiLocale(providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<Row>);
        fixture.componentRef.setInput('data', ROWS);
        fixture.componentRef.setInput('columns', COLS);
        if (locale !== undefined) fixture.componentRef.setInput('locale', locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults all chrome strings to English when no locale is configured', async () => {
        const fixture = await setup();
        const cmp = fixture.componentInstance;
        expect(cmp.filterPlaceholder()).toBe('Filter...');
        expect(cmp.columnsLabel()).toBe('Columns');
        expect(cmp.noResultsLabel()).toBe('No results found.');
        expect(cmp.rowsPerPageLabel()).toBe('Rows per page');
        expect(cmp.pageLabel()).toBe('Page');
        expect(cmp.ofLabel()).toBe('of');
        expect(cmp.toggleColumnAriaLabel('Name')).toBe('Toggle Name column');
        const host = fixture.nativeElement as HTMLElement;
        expect(host.hasAttribute('dir')).toBe(false);
    });

    it('localises chrome strings + sets dir="rtl" when locale="he"', async () => {
        const fixture = await setup('he');
        const cmp = fixture.componentInstance;
        expect(cmp.filterPlaceholder()).toBe('...סינון');
        expect(cmp.columnsLabel()).toBe('עמודות');
        expect(cmp.noResultsLabel()).toBe('לא נמצאו תוצאות.');
        expect(cmp.rowsPerPageLabel()).toBe('שורות בעמוד');
        expect(cmp.pageLabel()).toBe('עמוד');
        expect(cmp.ofLabel()).toBe('מתוך');
        expect(cmp.toggleColumnAriaLabel('שם')).toBe('החלף תצוגה של עמודת שם');
        const host = fixture.nativeElement as HTMLElement;
        expect(host.getAttribute('dir')).toBe('rtl');
    });

    it('accepts a fully custom DataTableLocale object as input', async () => {
        const custom: DataTableLocale = {
            code: 'xx', rtl: true,
            filterPlaceholder: 'XX_FILTER',
            columnsLabel: 'XX_COLUMNS',
            noResultsLabel: 'XX_NO_RESULTS',
            rowsPerPageLabel: 'XX_RPP',
            pageLabel: 'XX_PAGE',
            ofLabel: 'XX_OF',
            sortAscending: 'XX_SORT_ASC',
            sortDescending: 'XX_SORT_DESC',
            clearSort: 'XX_CLEAR',
            pinLeft: 'XX_PIN_L',
            pinRight: 'XX_PIN_R',
            unpin: 'XX_UNPIN',
            hideColumn: 'XX_HIDE',
            showAllColumns: 'XX_SHOW_ALL',
            toggleColumnAriaLabel: 'XX_TOGGLE {column}',
            toggleColumns: 'XX_TOGGLE_COLS',
            searchPlaceholder: 'XX_SEARCH',
            selectAllRows: 'XX_SELECT_ALL',
            clearAll: 'XX_CLEAR_ALL',
        };
        const fixture = await setup(custom);
        const cmp = fixture.componentInstance;
        expect(cmp.filterPlaceholder()).toBe('XX_FILTER');
        expect(cmp.toggleColumnAriaLabel('Name')).toBe('XX_TOGGLE Name');
        expect(fixture.nativeElement.getAttribute('dir')).toBe('rtl');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup(undefined, 'fr');
        const cmp = fixture.componentInstance;
        expect(cmp.filterPlaceholder()).toBe('Filtrer...');
        expect(cmp.columnsLabel()).toBe('Colonnes');
    });

    it('re-broadcasts its locale via UI_LOCALE_ID so embedded filter sub-components auto-localise', async () => {
        // The data-table provides `UI_LOCALE_ID` via provideComponentLocale,
        // so any descendant component that injects UI_LOCALE_ID (e.g.
        // ui-data-table-multiselect-filter, ui-data-table-date-filter,
        // ui-data-table-date-range-filter) sees the parent's locale
        // without each column needing to forward `filterComponentInputs.locale`.
        const { UI_LOCALE_ID } = await import('../../lib/i18n');
        const fixture = await setup('he');
        const childInjector = fixture.debugElement.injector;
        const broadcast = childInjector.get(UI_LOCALE_ID);
        expect(broadcast()).toBe('he');
    });

    it('renders English fallbacks when a custom DataTableLocale partial omits keys (no "undefined" strings reach the DOM)', async () => {
        // Consumers escape strict typing via `as DataTableLocale` casts or
        // dynamic translation sources. Per-field `??` fallbacks keep the
        // chrome usable even with a partial dictionary.
        const partial = { code: 'xx' } as unknown as DataTableLocale;
        const fixture = await setup(partial);
        const cmp = fixture.componentInstance;
        expect(cmp.filterPlaceholder()).toBe('Filter...');
        expect(cmp.columnsLabel()).toBe('Columns');
        expect(cmp.noResultsLabel()).toBe('No results found.');
        expect(cmp.rowsPerPageLabel()).toBe('Rows per page');
        expect(cmp.pageLabel()).toBe('Page');
        expect(cmp.ofLabel()).toBe('of');
        expect(cmp.toggleColumnsLabel()).toBe('Toggle columns');
        // toggleColumnAriaLabel must not throw on a missing template.
        expect(cmp.toggleColumnAriaLabel('Name')).toBe('Toggle Name column');
    });
});

// ---------------------------------------------------------------------------
// Coverage-extension suites
// ---------------------------------------------------------------------------

interface NumRow {
    id: string;
    name: string;
    score: number;
}

const NUM_DATA: NumRow[] = [
    { id: '1', name: 'Alice', score: 30 },
    { id: '2', name: 'Bob', score: 10 },
    { id: '3', name: 'Charlie', score: 50 },
    { id: '4', name: 'David', score: 20 },
    { id: '5', name: 'Eve', score: 40 },
];

const NUM_COLUMNS: ColumnDef<NumRow>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name', editable: true },
    { accessorKey: 'score', header: 'Score' },
];

async function makeNumTable(): Promise<{
    fixture: ComponentFixture<DataTableComponent<NumRow>>;
    component: DataTableComponent<NumRow>;
}> {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    const fixture = TestBed.createComponent(DataTableComponent<NumRow>);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('data', structuredClone(NUM_DATA));
    fixture.componentRef.setInput('columns', NUM_COLUMNS);
    fixture.detectChanges();
    return { fixture, component };
}

describe('DataTableComponent - Export & Clipboard', () => {
    let fixture: ComponentFixture<DataTableComponent<NumRow>>;
    let component: DataTableComponent<NumRow>;

    beforeEach(async () => {
        ({ fixture, component } = await makeNumTable());
    });

    it('builds export rows with headers and all visible data', () => {
        const data = component.getExportData();
        expect(data[0]).toEqual(['ID', 'Name', 'Score']);
        expect(data).toHaveLength(6); // header + 5 rows
        expect(data[1]).toEqual(['1', 'Alice', '30']);
    });

    it('omits headers when includeHeaders is false', () => {
        const data = component.getExportData({ includeHeaders: false });
        expect(data).toHaveLength(5);
        expect(data[0]).toEqual(['1', 'Alice', '30']);
    });

    it('exports only filtered rows by default', () => {
        component.onFilterChange('Alice');
        fixture.detectChanges();
        const data = component.getExportData();
        expect(data).toHaveLength(2); // header + Alice
        expect(data[1][1]).toBe('Alice');
    });

    it('exports unfiltered data when onlyFiltered is false', () => {
        component.onFilterChange('Alice');
        fixture.detectChanges();
        const data = component.getExportData({ onlyFiltered: false });
        expect(data).toHaveLength(6);
    });

    it('exports rows in the active sort order, not raw data order', () => {
        // raw order by score: Alice 30, Bob 10, Charlie 50, David 20, Eve 40
        component.onSortChange('score', 'asc');
        fixture.detectChanges();
        const names = component.getExportData({ includeHeaders: false }).map((r) => r[1]);
        expect(names).toEqual(['Bob', 'David', 'Alice', 'Eve', 'Charlie']);
    });

    it('exports the filtered AND sorted view together', () => {
        component.onFilterChange('e'); // Alice, Charlie, Eve (names containing "e")
        component.onSortChange('score', 'desc');
        fixture.detectChanges();
        const names = component.getExportData({ includeHeaders: false }).map((r) => r[1]);
        // filtered to e-names, then score desc: Charlie 50, Eve 40, Alice 30
        expect(names).toEqual(['Charlie', 'Eve', 'Alice']);
    });

    it('respects onlyVisible by dropping hidden columns', () => {
        component.setColumnVisibility('score', false);
        fixture.detectChanges();
        const data = component.getExportData({ onlyVisible: true });
        expect(data[0]).toEqual(['ID', 'Name']);
        const all = component.getExportData({ onlyVisible: false });
        expect(all[0]).toEqual(['ID', 'Name', 'Score']);
    });

    it('queryState reflects the live global filter and sort (export seam)', () => {
        component.onFilterChange('Alice');
        component.onSortChange('score', 'desc');
        fixture.detectChanges();
        const query = component.queryState();
        expect(query.globalFilter).toBe('Alice');
        expect(query.sort).toEqual({ column: 'score', direction: 'desc' });
        expect(query.columnFilters).toEqual({});
    });

    it('queryState carries per-column filters', () => {
        component.onColumnFilterChange('name', 'Bob');
        fixture.detectChanges();
        expect(component.queryState().columnFilters).toEqual({ name: 'Bob' });
    });

    it('setBusy toggles the generic busy-overlay label read by the template', () => {
        expect(component.busyLabel()).toBeNull();
        component.setBusy('Exporting…');
        expect(component.busyLabel()).toBe('Exporting…');
        component.setBusy(null);
        expect(component.busyLabel()).toBeNull();
    });

    it('copyRowToClipboard writes tab-separated cell values', async () => {
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        await component.copyRowToClipboard(NUM_DATA[0]);
        expect(writeText).toHaveBeenCalledWith('1\tAlice\t30');
        vi.unstubAllGlobals();
    });

    it('copyAllToClipboard writes header + every row', async () => {
        const writeText = vi.fn(async (_text: string) => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        await component.copyAllToClipboard();
        const text = writeText.mock.calls[0][0] as string;
        const lines = text.split('\n');
        expect(lines[0]).toBe('ID\tName\tScore');
        expect(lines).toHaveLength(6);
        vi.unstubAllGlobals();
    });

    it('copySelectedToClipboard writes only selected rows with header', async () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.detectChanges();
        component.rowSelection.set({ '2': true, '4': true });
        fixture.detectChanges();

        const writeText = vi.fn(async (_text: string) => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        await component.copySelectedToClipboard();
        const text = writeText.mock.calls[0][0] as string;
        const lines = text.split('\n');
        expect(lines[0]).toBe('ID\tName\tScore');
        expect(lines).toHaveLength(3); // header + Bob + David
        expect(lines[1]).toContain('Bob');
        expect(lines[2]).toContain('David');
        vi.unstubAllGlobals();
    });

    it('copySelectedToClipboard is a no-op when nothing is selected', async () => {
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        await component.copySelectedToClipboard();
        expect(writeText).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it('clipboard copy helpers are disabled when enableCopy is false', async () => {
        fixture.componentRef.setInput('enableCopy', false);
        fixture.detectChanges();
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        await component.copyRowToClipboard(NUM_DATA[0]);
        await component.copyAllToClipboard();
        await component.copySelectedToClipboard();
        expect(writeText).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it('copyCellToClipboard copies the focused cell value', async () => {
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        component.focusedCell.set({ rowIndex: 2, columnKey: 'name' });
        await component.copyCellToClipboard();
        expect(writeText).toHaveBeenCalledWith('Charlie');
        vi.unstubAllGlobals();
    });
});

describe('DataTableComponent - getCellStringValue', () => {
    let component: DataTableComponent<NumRow>;

    beforeEach(async () => {
        ({ component } = await makeNumTable());
    });

    it('uses the cell renderer when provided', () => {
        const col: ColumnDef<NumRow> = { accessorKey: 'score', header: 'Score', cell: (r) => `$${r.score}` };
        expect(component.getCellStringValue(NUM_DATA[0], col)).toBe('$30');
    });

    it('returns empty string for null/undefined values', () => {
        const col: ColumnDef<NumRow> = { accessorKey: 'missing' as keyof NumRow, header: 'X' };
        expect(component.getCellStringValue({ id: '9', name: 'N', score: 1 }, col)).toBe('');
    });

    it('serialises plain objects via JSON', () => {
        const col: ColumnDef<NumRow> = { accessorKey: 'name', header: 'N', accessorFn: () => ({ a: 1 }) };
        expect(component.getCellStringValue(NUM_DATA[0], col)).toBe('{"a":1}');
    });

    it('uses a custom toString on object values', () => {
        const col: ColumnDef<NumRow> = {
            accessorKey: 'name', header: 'N',
            accessorFn: () => ({ toString: () => 'CUSTOM' }),
        };
        expect(component.getCellStringValue(NUM_DATA[0], col)).toBe('CUSTOM');
    });
});

describe('DataTableComponent - Cell click / dblclick / touch editing', () => {
    let component: DataTableComponent<NumRow>;

    beforeEach(async () => {
        ({ component } = await makeNumTable());
    });

    it('onCellClick focuses the clicked cell', () => {
        const evt = { stopPropagation: vi.fn() } as unknown as Event;
        component.onCellClick(1, { accessorKey: 'name', header: 'Name' } as ColumnDef<NumRow>, evt);
        expect(component.focusedCell()).toEqual({ rowIndex: 1, columnKey: 'name' });
    });

    it('onCellClick ignores special columns', () => {
        const evt = { stopPropagation: vi.fn() } as unknown as Event;
        component.onCellClick(1, { accessorKey: '_selection', header: '' } as ColumnDef<NumRow>, evt);
        expect(component.focusedCell()).toBeNull();
    });

    it('onCellDblClick starts editing an editable cell', () => {
        const evt = { stopPropagation: vi.fn() } as unknown as Event;
        component.onCellDblClick(0, NUM_COLUMNS[1], evt);
        expect(component.editingCell()).toEqual({ rowIndex: 0, columnKey: 'name' });
    });

    it('double-tap on a cell starts editing; single tap does not', () => {
        const makeTouch = () => ({ preventDefault: vi.fn() } as unknown as TouchEvent);
        component.onCellTouchEnd(makeTouch(), 0, NUM_COLUMNS[1]);
        expect(component.editingCell()).toBeNull();
        // Second tap on the same cell within the delay window
        component.onCellTouchEnd(makeTouch(), 0, NUM_COLUMNS[1]);
        expect(component.editingCell()).toEqual({ rowIndex: 0, columnKey: 'name' });
    });

    it('onTableClick clears the focused cell', () => {
        component.focusedCell.set({ rowIndex: 1, columnKey: 'name' });
        component.onTableClick();
        expect(component.focusedCell()).toBeNull();
    });
});

describe('DataTableComponent - Keyboard navigation extras', () => {
    let fixture: ComponentFixture<DataTableComponent<NumRow>>;
    let component: DataTableComponent<NumRow>;

    beforeEach(async () => {
        ({ fixture, component } = await makeNumTable());
    });

    it('initialises focus on first ArrowDown when nothing is focused', () => {
        expect(component.focusedCell()).toBeNull();
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(component.focusedCell()).toEqual({ rowIndex: 0, columnKey: 'id' });
    });

    it('End moves to the last column of the row', () => {
        component.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'End' }));
        expect(component.focusedCell()?.columnKey).toBe('score');
    });

    it('Ctrl+End jumps to the last row last column', () => {
        component.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'End', ctrlKey: true }));
        expect(component.focusedCell()).toEqual({ rowIndex: 4, columnKey: 'score' });
    });

    it('Home (no ctrl) moves to first column, same row', () => {
        component.focusedCell.set({ rowIndex: 3, columnKey: 'score' });
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
        expect(component.focusedCell()).toEqual({ rowIndex: 3, columnKey: 'id' });
    });

    it('PageDown / PageUp move by a page', () => {
        component.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'PageDown' }));
        expect(component.focusedCell()?.rowIndex).toBe(4); // clamps to last row (5 rows)
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'PageUp' }));
        expect(component.focusedCell()?.rowIndex).toBe(0);
    });

    it('ArrowLeft clamps at the first column', () => {
        component.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(component.focusedCell()?.columnKey).toBe('id');
    });

    it('Shift+Tab wraps to previous row last column', () => {
        component.focusedCell.set({ rowIndex: 1, columnKey: 'id' });
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
        expect(component.focusedCell()).toEqual({ rowIndex: 0, columnKey: 'score' });
    });

    it('F2 starts editing the focused editable cell', () => {
        component.focusedCell.set({ rowIndex: 0, columnKey: 'name' });
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'F2' }));
        expect(component.editingCell()).toEqual({ rowIndex: 0, columnKey: 'name' });
    });

    it('Ctrl+C copies the focused cell to the clipboard', () => {
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        component.focusedCell.set({ rowIndex: 2, columnKey: 'name' });
        const evt = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true });
        component.onTableKeydown(evt);
        expect(writeText).toHaveBeenCalledWith('Charlie');
        vi.unstubAllGlobals();
    });

    it('Ctrl+C copies a selected cell range', async () => {
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.detectChanges();
        const writeText = vi.fn(async (_text: string) => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        component.cellRange.set({ startRow: 0, startCol: 'id', endRow: 1, endCol: 'name' });
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
        await Promise.resolve();
        const text = writeText.mock.calls[0][0] as string;
        expect(text).toBe('1\tAlice\n2\tBob');
        vi.unstubAllGlobals();
    });

    it('Ctrl+C falls back to selected rows when no cell is focused', async () => {
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.detectChanges();
        component.rowSelection.set({ '1': true });
        fixture.detectChanges();

        const writeText = vi.fn(async (_text: string) => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        component.onTableKeydown(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
        await Promise.resolve();
        expect(writeText).toHaveBeenCalled();
        const text = writeText.mock.calls[0][0] as string;
        expect(text).toContain('Alice');
        vi.unstubAllGlobals();
    });
});

describe('DataTableComponent - Inline edit keyboard flow', () => {
    let fixture: ComponentFixture<DataTableComponent<NumRow>>;
    let component: DataTableComponent<NumRow>;

    beforeEach(async () => {
        ({ fixture, component } = await makeNumTable());
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', editable: true, valueSetter: (r: NumRow, v: unknown) => ({ ...r, name: String(v) }) },
            { accessorKey: 'score', header: 'Score', editable: true, valueSetter: (r: NumRow, v: unknown) => ({ ...r, score: Number(v) }) },
        ]);
        fixture.detectChanges();
    });

    it('Enter commits the edit', () => {
        component.startEditing(0, 'name');
        component.onEditValueChange('Renamed');
        component.onEditKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(component.editingCell()).toBeNull();
        expect(component.data()[0].name).toBe('Renamed');
    });

    it('Escape cancels the edit', () => {
        component.startEditing(0, 'name');
        component.onEditValueChange('Throwaway');
        component.onEditKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(component.editingCell()).toBeNull();
        expect(component.data()[0].name).toBe('Alice');
    });

    it('Tab commits and advances editing into the next editable cell', () => {
        component.focusedCell.set({ rowIndex: 0, columnKey: 'name' });
        component.startEditing(0, 'name');
        component.onEditValueChange('Edited');
        component.onEditKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(component.data()[0].name).toBe('Edited');
        // focus advanced to score column, which is editable -> editing started
        expect(component.focusedCell()?.columnKey).toBe('score');
        expect(component.editingCell()).toEqual({ rowIndex: 0, columnKey: 'score' });
    });
});

describe('DataTableComponent - Aggregates (min/max/count/custom)', () => {
    let fixture: ComponentFixture<DataTableComponent<NumRow>>;
    let component: DataTableComponent<NumRow>;

    beforeEach(async () => {
        ({ fixture, component } = await makeNumTable());
    });

    it('computes min and max footer aggregates', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'score', header: 'Score', aggregateFn: 'min' },
        ]);
        fixture.componentRef.setInput('showFooter', true);
        fixture.detectChanges();
        expect(component.footerValues().get('score')).toBe('10');

        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'score', header: 'Score', aggregateFn: 'max' },
        ]);
        fixture.detectChanges();
        expect(component.footerValues().get('score')).toBe('50');
    });

    it('supports a custom aggregate function', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'score', header: 'Score', aggregateFn: (vals: unknown[]) => `n=${vals.length}` },
        ]);
        fixture.componentRef.setInput('showFooter', true);
        fixture.detectChanges();
        expect(component.footerValues().get('score')).toBe('n=5');
    });

    it('returns empty string for numeric aggregate over non-numeric values', () => {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name', aggregateFn: 'sum' },
        ]);
        fixture.componentRef.setInput('showFooter', true);
        fixture.detectChanges();
        expect(component.footerValues().get('name')).toBe('');
    });
});

describe('DataTableComponent - Cell flash', () => {
    let fixture: ComponentFixture<DataTableComponent<NumRow>>;
    let component: DataTableComponent<NumRow>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<NumRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', structuredClone(NUM_DATA));
        fixture.componentRef.setInput('columns', NUM_COLUMNS);
        fixture.componentRef.setInput('enableCellFlash', true);
        fixture.componentRef.setInput('getRowId', (r: NumRow) => r.id);
        fixture.detectChanges();
    });

    it('flashes "up" when a numeric value increases and "down" when it decreases', () => {
        const next = structuredClone(NUM_DATA);
        next[0] = { ...next[0], score: 999 }; // Alice 30 -> 999 (up)
        next[1] = { ...next[1], score: 1 };   // Bob 10 -> 1 (down)
        component.data.set(next);
        fixture.detectChanges();

        expect(component.getCellFlashClass('1', 'score')).toContain('flash-up');
        expect(component.getCellFlashClass('1', 'score')).toContain('green');
        expect(component.getCellFlashClass('2', 'score')).toContain('flash-down');
        expect(component.getCellFlashClass('2', 'score')).toContain('red');
    });

    it('flashes "changed" for non-numeric value changes', () => {
        const next = structuredClone(NUM_DATA);
        next[0] = { ...next[0], name: 'Alicia' };
        component.data.set(next);
        fixture.detectChanges();
        expect(component.getCellFlashClass('1', 'name')).toContain('flash-changed');
    });

    it('returns empty class for cells that did not change', () => {
        expect(component.getCellFlashClass('1', 'score')).toBe('');
    });
});

describe('DataTableComponent - Row drag reorder', () => {
    let fixture: ComponentFixture<DataTableComponent<NumRow>>;
    let component: DataTableComponent<NumRow>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<NumRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', structuredClone(NUM_DATA));
        fixture.componentRef.setInput('columns', NUM_COLUMNS);
        fixture.componentRef.setInput('enableRowDrag', true);
        fixture.componentRef.setInput('getRowId', (r: NumRow) => r.id);
        fixture.componentRef.setInput('showPagination', false);
        fixture.detectChanges();
    });

    function makeRowEl(top: number, height: number): HTMLElement {
        return {
            getBoundingClientRect: () => ({ top, height, bottom: top + height, left: 0, width: 100 }),
        } as unknown as HTMLElement;
    }

    it('onRowDragStart sets draggedRowId and dataTransfer payload', () => {
        const setData = vi.fn();
        const event = { dataTransfer: { effectAllowed: '', setData } } as unknown as DragEvent;
        component.onRowDragStart(event, NUM_DATA[0]);
        expect(component.draggedRowId()).toBe('1');
        expect(setData).toHaveBeenCalledWith('text/plain', '1');
    });

    it('onRowDragOver records drop index/position and isRowBeingDragged reflects state', () => {
        const setData = vi.fn();
        component.onRowDragStart({ dataTransfer: { effectAllowed: '', setData } } as unknown as DragEvent, NUM_DATA[0]);
        expect(component.isRowBeingDragged(NUM_DATA[0])).toBe(true);

        const overEvent = {
            currentTarget: makeRowEl(100, 40),
            clientY: 135, // > 0.5 of the row -> 'below'
            dataTransfer: { dropEffect: '' },
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent;
        component.onRowDragOver(overEvent, 2);
        expect(component.getDropEdge(2)).toBe('bottom');
    });

    it('computes a live drag-preview reorder of the data', () => {
        const setData = vi.fn();
        component.onRowDragStart({ dataTransfer: { effectAllowed: '', setData } } as unknown as DragEvent, NUM_DATA[0]);
        component.onRowDragOver({
            currentTarget: makeRowEl(100, 40),
            clientY: 135,
            dataTransfer: { dropEffect: '' },
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent, 2);

        const preview = component.dragPreviewData();
        expect(preview).not.toBeNull();
        // Alice moved below index 2 (Charlie) -> order: Bob, Charlie, Alice, David, Eve
        expect(preview!.map((r) => r.name)).toEqual(['Bob', 'Charlie', 'Alice', 'David', 'Eve']);
    });

    it('emits rowReorder with correct from/to indexes on drop', () => {
        const reorderSpy = vi.fn();
        component.rowReorder.subscribe(reorderSpy);

        const setData = vi.fn();
        component.onRowDragStart({ dataTransfer: { effectAllowed: '', setData } } as unknown as DragEvent, NUM_DATA[0]);
        component.onRowDragOver({
            currentTarget: makeRowEl(100, 40),
            clientY: 135,
            dataTransfer: { dropEffect: '' },
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as DragEvent, 2);
        component.onRowDrop({ preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as DragEvent);

        expect(reorderSpy).toHaveBeenCalledWith(expect.objectContaining({ fromIndex: 0, toIndex: 2 }));
        expect(component.draggedRowId()).toBeNull();
    });

    it('reorderData moves a flat row to the position implied by previousId', () => {
        const event = {
            row: NUM_DATA[0],
            targetRow: NUM_DATA[2],
            position: 'below' as const,
            previousId: '3',
            nextId: '4',
            fromIndex: 0,
            toIndex: 2,
        };
        const result = component.reorderData(structuredClone(NUM_DATA), event);
        expect(result.map((r) => r.name)).toEqual(['Bob', 'Charlie', 'Alice', 'David', 'Eve']);
    });

    it('onRowDragEnd / clearRowDragState clears drag signals', () => {
        const setData = vi.fn();
        component.onRowDragStart({ dataTransfer: { effectAllowed: '', setData } } as unknown as DragEvent, NUM_DATA[0]);
        component.onRowDragEnd();
        expect(component.draggedRowId()).toBeNull();
        expect(component.getDropEdge(0)).toBeNull();
    });

    it('does not start a drag for disabled rows', () => {
        fixture.componentRef.setInput('isRowDisabled', (r: NumRow) => r.id === '1');
        fixture.detectChanges();
        const setData = vi.fn();
        component.onRowDragStart({ dataTransfer: { effectAllowed: '', setData } } as unknown as DragEvent, NUM_DATA[0]);
        expect(component.draggedRowId()).toBeNull();
    });

    it('respects rowDragAllowDrop predicate to block a drop target', () => {
        fixture.componentRef.setInput('rowDragAllowDrop', () => false);
        fixture.detectChanges();
        const setData = vi.fn();
        component.onRowDragStart({ dataTransfer: { effectAllowed: '', setData } } as unknown as DragEvent, NUM_DATA[0]);
        const preventDefault = vi.fn();
        component.onRowDragOver({
            currentTarget: makeRowEl(100, 40),
            clientY: 135,
            dataTransfer: { dropEffect: '' },
            preventDefault,
            stopPropagation: vi.fn(),
        } as unknown as DragEvent, 2);
        // blocked -> dragOverIndex not set, no drop edge
        expect(component.getDropEdge(2)).toBeNull();
        expect(preventDefault).not.toHaveBeenCalled();
    });
});

describe('DataTableComponent - Tree row drag (tree mode)', () => {
    interface TNode { id: string; name: string; children?: TNode[] }
    const T_DATA: TNode[] = [
        { id: 'a', name: 'A', children: [{ id: 'a1', name: 'A1' }, { id: 'a2', name: 'A2' }] },
        { id: 'b', name: 'B' },
    ];
    const T_COLS: ColumnDef<TNode>[] = [
        { accessorKey: 'id', header: 'ID' },
        { accessorKey: 'name', header: 'Name' },
    ];

    let fixture: ComponentFixture<DataTableComponent<TNode>>;
    let component: DataTableComponent<TNode>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<TNode>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', structuredClone(T_DATA));
        fixture.componentRef.setInput('columns', T_COLS);
        fixture.componentRef.setInput('enableSubRows', true);
        fixture.componentRef.setInput('getRowId', (r: TNode) => r.id);
        fixture.componentRef.setInput('enableRowDrag', true);
        fixture.componentRef.setInput('rowDragMode', 'tree');
        fixture.componentRef.setInput('subRowDefaultExpanded', -1);
        fixture.componentRef.setInput('showPagination', false);
        fixture.detectChanges();
    });

    it('reorderData with position "on" nests the moved node as a child of the target', () => {
        const event = {
            row: T_DATA[1], // B
            targetRow: T_DATA[0], // A
            position: 'on' as const,
            previousId: null,
            nextId: null,
            fromIndex: 3,
            toIndex: 0,
        };
        const result = component.reorderData(structuredClone(T_DATA), event);
        const a = result.find((n) => n.id === 'a')!;
        expect(a.children!.map((c) => c.id)).toContain('b');
        expect(result.some((n) => n.id === 'b')).toBe(false);
    });

    it('reorderData with position "above" places the moved node before the target sibling', () => {
        const event = {
            row: T_DATA[1], // B
            targetRow: T_DATA[0].children![0], // A1
            position: 'above' as const,
            previousId: null,
            nextId: null,
            fromIndex: 3,
            toIndex: 1,
        };
        const result = component.reorderData(structuredClone(T_DATA), event);
        const a = result.find((n) => n.id === 'a')!;
        expect(a.children!.map((c) => c.id)).toEqual(['b', 'a1', 'a2']);
    });
});

describe('DataTableComponent - Column resize drag', () => {
    let fixture: ComponentFixture<DataTableComponent<NumRow>>;
    let component: DataTableComponent<NumRow>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<NumRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', structuredClone(NUM_DATA));
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID', width: '100px', minWidth: '60px' },
            { accessorKey: 'name', header: 'Name', width: '200px' },
            { accessorKey: 'score', header: 'Score' },
        ]);
        fixture.componentRef.setInput('enableColumnResize', true);
        fixture.detectChanges();
    });

    it('mouse drag widens the column and emits columnResize on release', () => {
        const resizeSpy = vi.fn();
        component.columnResize.subscribe(resizeSpy);
        const idCol = component.enhancedColumns().find((c) => c.accessorKey === 'id')!;

        component.onResizeStart(new MouseEvent('mousedown', { clientX: 100 }), idCol);
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 160 })); // +60
        expect(component.columnWidths()['id']).toBe('160px');

        document.dispatchEvent(new MouseEvent('mouseup'));
        expect(resizeSpy).toHaveBeenCalledWith(expect.objectContaining({
            columnKey: 'id',
            newWidth: '160px',
        }));
        expect(component.isResizingColumn(idCol)).toBe(false);
    });

    it('clamps the column width to its minWidth', () => {
        const idCol = component.enhancedColumns().find((c) => c.accessorKey === 'id')!;
        component.onResizeStart(new MouseEvent('mousedown', { clientX: 100 }), idCol);
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 })); // -100 -> clamps
        expect(component.columnWidths()['id']).toBe('60px');
        document.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('touch drag resizes the column', () => {
        const nameCol = component.enhancedColumns().find((c) => c.accessorKey === 'name')!;
        const touchStart = {
            touches: [{ clientX: 100 }],
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as TouchEvent;
        component.onResizeTouchStart(touchStart, nameCol);
        expect(component.isResizingColumn(nameCol)).toBe(true);

        const move = new TouchEvent('touchmove');
        Object.defineProperty(move, 'touches', { value: [{ clientX: 250 }] });
        document.dispatchEvent(move);
        // name starts at 200px, delta = 250 - 100 = +150 -> 350px
        expect(component.columnWidths()['name']).toBe('350px');

        document.dispatchEvent(new TouchEvent('touchend'));
        expect(component.isResizingColumn(nameCol)).toBe(false);
    });

    it('resizeLineClass reflects active vs idle state', () => {
        const idCol = component.enhancedColumns().find((c) => c.accessorKey === 'id')!;
        expect(component.resizeLineClass(idCol)).toContain('bg-transparent');
        component.onResizeStart(new MouseEvent('mousedown', { clientX: 100 }), idCol);
        expect(component.resizeLineClass(idCol)).toContain('bg-primary/70');
        document.dispatchEvent(new MouseEvent('mouseup'));
    });
});

describe('DataTableComponent - Virtual scroll', () => {
    interface VRow { id: number; name: string }
    const V_DATA: VRow[] = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Row ${i}` }));
    const V_COLS: ColumnDef<VRow>[] = [
        { accessorKey: 'id', header: 'ID', width: '120px' },
        { accessorKey: 'name', header: 'Name', width: '200px' },
    ];

    let fixture: ComponentFixture<DataTableComponent<VRow>>;
    let component: DataTableComponent<VRow>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<VRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', V_DATA);
        fixture.componentRef.setInput('columns', V_COLS);
        fixture.componentRef.setInput('enableVirtualScroll', true);
        fixture.componentRef.setInput('showPagination', false);
        fixture.componentRef.setInput('virtualRowHeight', 40);
        fixture.componentRef.setInput('getRowId', (r: VRow) => String(r.id));
        fixture.detectChanges();
    });

    it('activates virtual scroll and reports the full row count', () => {
        expect(component.isVirtualScrollActive()).toBe(true);
        expect(component.virtualTotalRows()).toBe(1000);
    });

    it('renders only a windowed slice of rows', () => {
        const visible = component.virtualVisibleRows();
        expect(visible.length).toBeLessThan(1000);
        expect(visible.length).toBeGreaterThan(0);
        expect(visible[0].id).toBe(0);
    });

    it('updates the visible window and padding after a scroll event', () => {
        // Drive the scroll computeds directly; avoid re-running template change
        // detection (the JSDOM-less viewport has height 0, which would trip
        // NG0100 on the padding style binding).
        (component as unknown as { viewportHeight: { set: (v: number) => void } }).viewportHeight.set(400);
        const scrollEl = { scrollTop: 4000, scrollLeft: 0 } as HTMLElement;
        const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        });
        component.onVirtualScroll({ target: scrollEl } as unknown as Event);
        rafSpy.mockRestore();

        const range = component.virtualRowRange();
        expect(range.start).toBeGreaterThan(50); // ~4000/40 = 100, minus buffer
        expect(range.paddingTop).toBe(range.start * 40);
        const visible = component.virtualVisibleRows();
        expect(visible[0].id).toBe(range.start);
    });

    it('getVirtualRowIndex offsets a local index by the window start', () => {
        (component as unknown as { viewportHeight: { set: (v: number) => void } }).viewportHeight.set(400);
        const scrollEl = { scrollTop: 2000, scrollLeft: 0 } as HTMLElement;
        const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        });
        component.onVirtualScroll({ target: scrollEl } as unknown as Event);
        rafSpy.mockRestore();
        const start = component.virtualRowRange().start;
        expect(component.getVirtualRowIndex(3)).toBe(start + 3);
    });

    it('"auto" mode activates virtual scroll past the row threshold without pagination', () => {
        fixture.componentRef.setInput('enableVirtualScroll', 'auto');
        fixture.detectChanges();
        expect(component.isVirtualScrollActive()).toBe(true);
    });

    it('"auto" mode stays off when pagination is active', () => {
        fixture.componentRef.setInput('enableVirtualScroll', 'auto');
        fixture.componentRef.setInput('showPagination', true);
        fixture.componentRef.setInput('localPagination', true);
        fixture.detectChanges();
        expect(component.isVirtualScrollActive()).toBe(false);
    });
});

describe('DataTableComponent - Configuration validation warnings', () => {
    interface Row { id: string; name: string }
    const ROWS: Row[] = [{ id: '1', name: 'A' }];

    async function setupWithDevMode(
        configure: (ref: ComponentFixture<DataTableComponent<Row>>) => void,
    ): Promise<string[]> {
        const errors: string[] = [];
        const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            errors.push(String(args[0]));
        });
        const scope = globalThis as { ngDevMode?: unknown };
        const prev = scope.ngDevMode;
        scope.ngDevMode = true;

        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<Row>);
        fixture.componentRef.setInput('data', ROWS);
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'name', header: 'Name' },
        ]);
        configure(fixture);
        fixture.detectChanges();
        fixture.componentInstance.ngAfterViewInit();

        scope.ngDevMode = prev;
        errSpy.mockRestore();
        return errors;
    }

    it('warns when pagination and virtual scroll are both enabled', async () => {
        const errors = await setupWithDevMode((f) => {
            f.componentRef.setInput('enableVirtualScroll', true);
            f.componentRef.setInput('showPagination', true);
            f.componentRef.setInput('localPagination', true);
        });
        expect(errors.some((e) => e.includes('mutually exclusive'))).toBe(true);
    });

    it('warns on server pagination without total', async () => {
        const errors = await setupWithDevMode((f) => {
            f.componentRef.setInput('localPagination', false);
        });
        expect(errors.some((e) => e.includes('without providing [total]'))).toBe(true);
    });

    it('warns when virtualVariableRowHeight is set but virtual scroll is inactive', async () => {
        const errors = await setupWithDevMode((f) => {
            f.componentRef.setInput('virtualVariableRowHeight', true);
        });
        expect(errors.some((e) => e.includes('virtualVariableRowHeight is enabled'))).toBe(true);
    });

    it('warns when editable columns lack a valueSetter', async () => {
        const errors = await setupWithDevMode((f) => {
            f.componentRef.setInput('columns', [
                { accessorKey: 'id', header: 'ID' },
                { accessorKey: 'name', header: 'Name', editable: true },
            ]);
        });
        expect(errors.some((e) => e.includes('editable=true but no valueSetter'))).toBe(true);
    });

    it('warns about duplicate accessor keys', async () => {
        const errors = await setupWithDevMode((f) => {
            f.componentRef.setInput('columns', [
                { accessorKey: 'id', header: 'ID' },
                { accessorKey: 'id', header: 'ID2' },
            ]);
        });
        expect(errors.some((e) => e.includes('Duplicate accessorKey'))).toBe(true);
    });

    it('warns about sticky + pin conflicts', async () => {
        const errors = await setupWithDevMode((f) => {
            f.componentRef.setInput('columns', [
                { accessorKey: 'id', header: 'ID', sticky: true, pin: 'left' as const },
                { accessorKey: 'name', header: 'Name' },
            ]);
        });
        expect(errors.some((e) => e.includes('both sticky and pin'))).toBe(true);
    });

    it('warns about multiple render strategies on a column', async () => {
        @Component({ selector: 'test-cell', standalone: true, template: 'x' })
        class TestCellComponent {}

        const errors = await setupWithDevMode((f) => {
            f.componentRef.setInput('columns', [
                { accessorKey: 'id', header: 'ID' },
                { accessorKey: 'name', header: 'Name', cell: () => 'x', component: TestCellComponent },
            ]);
        });
        expect(errors.some((e) => e.includes('multiple rendering strategies'))).toBe(true);
    });
});

describe('DataTableComponent - filteredDescendants cascade', () => {
    interface TNode { id: string; name: string; children?: TNode[] }
    const T_DATA: TNode[] = [
        {
            id: 'p', name: 'Parent',
            children: [
                { id: 'c1', name: 'Match Child' },
                { id: 'c2', name: 'Other Child' },
            ],
        },
    ];
    const T_COLS: ColumnDef<TNode>[] = [
        { accessorKey: 'id', header: 'ID' },
        { accessorKey: 'name', header: 'Name' },
    ];

    it('only cascades to filtered-visible descendants in filteredDescendants mode', async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<TNode>);
        const component = fixture.componentInstance;
        fixture.componentRef.setInput('data', structuredClone(T_DATA));
        fixture.componentRef.setInput('columns', T_COLS);
        fixture.componentRef.setInput('enableSubRows', true);
        fixture.componentRef.setInput('enableRowSelection', true);
        fixture.componentRef.setInput('getRowId', (r: TNode) => r.id);
        fixture.componentRef.setInput('subRowSelectionMode', 'filteredDescendants');
        fixture.componentRef.setInput('subRowFilterMode', 'includeParentOnChildMatch');
        fixture.componentRef.setInput('subRowDefaultExpanded', -1);
        fixture.componentRef.setInput('showPagination', false);
        fixture.detectChanges();

        component.onFilterChange('Match'); // only c1 visible (+ parent)
        fixture.detectChanges();

        component.toggleRowWithCascade(T_DATA[0]);
        fixture.detectChanges();

        expect(component.isRowSelected(T_DATA[0])).toBe(true);
        expect(component.isRowSelected(T_DATA[0].children![0])).toBe(true); // c1 visible
        expect(component.isRowSelected(T_DATA[0].children![1])).toBe(false); // c2 filtered out
    });
});

describe('DataTableComponent - scrollToColumn', () => {
    interface VRow { id: number }
    it('sets scrollLeft to the cumulative width of preceding scrollable columns', async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<VRow>);
        const component = fixture.componentInstance;
        fixture.componentRef.setInput('data', Array.from({ length: 600 }, (_, i) => ({ id: i })));
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'a', header: 'A', width: '100px' },
            { accessorKey: 'b', header: 'B', width: '150px' },
            { accessorKey: 'c', header: 'C', width: '200px' },
        ] as ColumnDef<VRow>[]);
        fixture.componentRef.setInput('enableVirtualScroll', true);
        fixture.componentRef.setInput('showPagination', false);
        fixture.detectChanges();

        const container = { scrollLeft: 0, scrollTop: 0 } as HTMLElement;
        vi.spyOn(component, 'scrollContainerRef').mockReturnValue({ nativeElement: container } as never);

        component.scrollToColumn('c');
        expect(container.scrollLeft).toBe(250); // 100 + 150
        vi.restoreAllMocks();
    });
});

describe('DataTableComponent - scroll-to helpers & container drag', () => {
    interface VRow { id: number; name: string }
    const V_DATA: VRow[] = Array.from({ length: 800 }, (_, i) => ({ id: i, name: `R${i}` }));
    const V_COLS: ColumnDef<VRow>[] = [
        { accessorKey: 'id', header: 'ID', width: '120px' },
        { accessorKey: 'name', header: 'Name', width: '200px' },
    ];

    let fixture: ComponentFixture<DataTableComponent<VRow>>;
    let component: DataTableComponent<VRow>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<VRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', V_DATA);
        fixture.componentRef.setInput('columns', V_COLS);
        fixture.componentRef.setInput('enableVirtualScroll', true);
        fixture.componentRef.setInput('showPagination', false);
        fixture.componentRef.setInput('virtualRowHeight', 40);
        fixture.componentRef.setInput('getRowId', (r: VRow) => String(r.id));
        fixture.detectChanges();
    });

    it('scrollToRow sets scrollTop to index * rowHeight', () => {
        const container = { scrollTop: 0, scrollLeft: 0 } as HTMLElement;
        vi.spyOn(component, 'scrollContainerRef').mockReturnValue({ nativeElement: container } as never);
        component.scrollToRow(10);
        expect(container.scrollTop).toBe(400); // 10 * 40
        vi.restoreAllMocks();
    });

    it('scrollToCell scrolls both axes', () => {
        const container = { scrollTop: 0, scrollLeft: 0 } as HTMLElement;
        vi.spyOn(component, 'scrollContainerRef').mockReturnValue({ nativeElement: container } as never);
        component.scrollToCell(5, 'name');
        expect(container.scrollTop).toBe(200); // 5 * 40
        expect(container.scrollLeft).toBe(120); // width of 'id'
        vi.restoreAllMocks();
    });

    it('onContainerDragOver extends the drop target to the last row past the bottom edge', () => {
        fixture.componentRef.setInput('enableRowDrag', true);
        fixture.detectChanges();

        const setData = vi.fn();
        component.onRowDragStart({ dataTransfer: { effectAllowed: '', setData } } as unknown as DragEvent, V_DATA[0]);

        const lastRow = { getBoundingClientRect: () => ({ bottom: 100 } as DOMRect) } as HTMLElement;
        const container = {
            scrollTop: 0,
            getBoundingClientRect: () => ({ top: 0, bottom: 500 } as DOMRect),
            querySelectorAll: () => [lastRow] as unknown as NodeListOf<HTMLElement>,
        } as unknown as HTMLElement;
        vi.spyOn(component, 'scrollContainerRef').mockReturnValue({ nativeElement: container } as never);
        const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);

        // onContainerDragOver targets the last index of the full processed data set.
        const lastIndex = component.processedData().length - 1;
        component.onContainerDragOver({ clientY: 200, preventDefault: vi.fn() } as unknown as DragEvent);
        expect(component.getDropEdge(lastIndex)).toBe('bottom');

        rafSpy.mockRestore();
        vi.restoreAllMocks();
    });
});

describe('DataTableComponent - variable row height virtual scroll', () => {
    interface VRow { id: number }
    let fixture: ComponentFixture<DataTableComponent<VRow>>;
    let component: DataTableComponent<VRow>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<VRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', Array.from({ length: 600 }, (_, i) => ({ id: i })));
        fixture.componentRef.setInput('columns', [{ accessorKey: 'id', header: 'ID', width: '120px' }] as ColumnDef<VRow>[]);
        fixture.componentRef.setInput('enableVirtualScroll', true);
        fixture.componentRef.setInput('virtualVariableRowHeight', true);
        fixture.componentRef.setInput('showPagination', false);
        fixture.componentRef.setInput('virtualRowHeight', 40);
        fixture.componentRef.setInput('getRowId', (r: VRow) => String(r.id));
        fixture.detectChanges();
    });

    it('produces a windowed range using the default per-row height estimate', () => {
        (component as unknown as { viewportHeight: { set: (v: number) => void } }).viewportHeight.set(400);
        const range = component.virtualRowRange();
        expect(range.start).toBe(0);
        expect(range.end).toBeGreaterThan(0);
        expect(range.end).toBeLessThan(600);
    });

    it('scrollToRow falls back to estimated offset when no measurement exists', () => {
        const container = { scrollTop: 0 } as HTMLElement;
        vi.spyOn(component, 'scrollContainerRef').mockReturnValue({ nativeElement: container } as never);
        component.scrollToRow(3);
        // prefix sums of default 40px heights -> index 3 = 120
        expect(container.scrollTop).toBe(120);
        vi.restoreAllMocks();
    });
});

describe('DataTableComponent - deep tree reorder removal', () => {
    interface TNode { id: string; name: string; children?: TNode[] }
    const T_DATA: TNode[] = [
        {
            id: 'a', name: 'A',
            children: [
                { id: 'a1', name: 'A1', children: [{ id: 'a1x', name: 'Deep' }] },
            ],
        },
        { id: 'b', name: 'B' },
    ];
    const T_COLS: ColumnDef<TNode>[] = [
        { accessorKey: 'id', header: 'ID' },
        { accessorKey: 'name', header: 'Name' },
    ];

    it('reorderData removes a deeply nested node and re-inserts it at root level', async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<TNode>);
        const component = fixture.componentInstance;
        fixture.componentRef.setInput('data', structuredClone(T_DATA));
        fixture.componentRef.setInput('columns', T_COLS);
        fixture.componentRef.setInput('enableSubRows', true);
        fixture.componentRef.setInput('getRowId', (r: TNode) => r.id);
        fixture.componentRef.setInput('enableRowDrag', true);
        fixture.componentRef.setInput('rowDragMode', 'tree');
        fixture.componentRef.setInput('subRowDefaultExpanded', -1);
        fixture.componentRef.setInput('showPagination', false);
        fixture.detectChanges();

        const event = {
            row: T_DATA[0].children![0].children![0], // 'a1x' deep node
            targetRow: T_DATA[1], // 'b'
            position: 'below' as const,
            previousId: null,
            nextId: null,
            fromIndex: 3,
            toIndex: 4,
        };
        const result = component.reorderData(structuredClone(T_DATA), event);
        // a1x removed from its deep position
        const a1 = result[0].children![0];
        expect(a1.children ?? []).toHaveLength(0);
        // a1x now sits after 'b' at root
        expect(result.map((n) => n.id)).toEqual(['a', 'b', 'a1x']);
    });
});

interface ScoreRow {
    id: string;
    name: string;
    score: number;
}

const SCORE_DATA: ScoreRow[] = [
    { id: '1', name: 'Alice', score: 0 },
    { id: '2', name: 'Bob', score: 50 },
    { id: '3', name: 'Charlie', score: 100 },
];

describe('DataTableComponent conditional formatting (A1)', () => {
    let component: DataTableComponent<ScoreRow>;
    let fixture: ComponentFixture<DataTableComponent<ScoreRow>>;

    function setColumns(scoreCol: Partial<ColumnDef<ScoreRow>>): void {
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'score', header: 'Score', ...scoreCol },
        ] as ColumnDef<ScoreRow>[]);
        fixture.detectChanges();
    }

    function scoreColumn(): ColumnDef<ScoreRow> {
        return component.columns().find((c) => c.accessorKey === 'score')!;
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataTableComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<ScoreRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', SCORE_DATA);
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'score', header: 'Score' },
        ] as ColumnDef<ScoreRow>[]);
        fixture.detectChanges();
    });

    it('returns null when the column declares no conditional formatting', () => {
        expect(component.getCellFormatting(scoreColumn(), SCORE_DATA[1])).toBeNull();
    });

    it('applies cellClassRules whose predicate matches and joins multiple', () => {
        setColumns({
            cellClassRules: [
                { when: (v) => (v as number) >= 50, class: 'text-green-600' },
                { when: (v) => (v as number) === 100, class: 'font-bold' },
                { when: (v) => (v as number) < 0, class: 'text-red-600' },
            ],
        });
        expect(component.getCellFormatting(scoreColumn(), SCORE_DATA[2])?.class).toBe(
            'text-green-600 font-bold',
        );
        expect(component.getCellFormatting(scoreColumn(), SCORE_DATA[0])?.class).toBe('');
    });

    it('returns the style object from cellStyleRules', () => {
        setColumns({
            cellStyleRules: (v) => ((v as number) > 75 ? { color: 'gold' } : undefined),
        });
        expect(component.getCellFormatting(scoreColumn(), SCORE_DATA[2])?.style).toEqual({
            color: 'gold',
        });
        expect(component.getCellFormatting(scoreColumn(), SCORE_DATA[0])?.style).toEqual({});
    });

    it('produces a color-mix background from colorScale based on value position', () => {
        setColumns({ colorScale: { min: 0, max: 100, from: 'white', to: 'red' } });
        const mid = component.getCellFormatting(scoreColumn(), SCORE_DATA[1])?.style[
            'background-color'
        ];
        expect(mid).toBe('color-mix(in srgb, red 50%, white)');
    });

    it('computes a clamped data bar width as a percentage', () => {
        setColumns({ dataBar: { min: 0, max: 100, color: 'steelblue' } });
        expect(component.getCellFormatting(scoreColumn(), SCORE_DATA[1])?.dataBar).toEqual({
            width: '50%',
            color: 'steelblue',
            track: null,
        });
        // value at/above max clamps to 100%
        expect(
            component.getCellFormatting(scoreColumn(), SCORE_DATA[2])?.dataBar?.width,
        ).toBe('100%');
    });

    it('resolves an icon from iconSet', () => {
        setColumns({
            iconSet: (v) => ((v as number) >= 100 ? { glyph: '🏆', class: 'text-amber-500' } : undefined),
        });
        expect(component.getCellFormatting(scoreColumn(), SCORE_DATA[2])?.icon).toEqual({
            glyph: '🏆',
            class: 'text-amber-500',
        });
        expect(component.getCellFormatting(scoreColumn(), SCORE_DATA[0])?.icon).toBeNull();
    });

    it('renders data bars in the DOM with the computed width', () => {
        setColumns({ dataBar: { min: 0, max: 100, color: 'steelblue' } });
        const bars = fixture.debugElement.queryAll(By.css('[data-slot="cell-data-bar"]'));
        expect(bars).toHaveLength(3);
        const widths = bars.map((b) => (b.nativeElement as HTMLElement).style.width);
        expect(widths).toEqual(['0%', '50%', '100%']);
    });

    it('renders a data-bar track only when track is set', () => {
        setColumns({ dataBar: { min: 0, max: 100, color: 'steelblue' } });
        expect(
            fixture.debugElement.queryAll(By.css('[data-slot="cell-data-bar-track"]')),
        ).toHaveLength(0);

        setColumns({ dataBar: { min: 0, max: 100, color: 'steelblue', track: '#eee' } });
        const tracks = fixture.debugElement.queryAll(By.css('[data-slot="cell-data-bar-track"]'));
        expect(tracks).toHaveLength(3);
        expect((tracks[0].nativeElement as HTMLElement).style.backgroundColor).toBeTruthy();
    });

    it('renders icon-set glyphs and conditional classes in the DOM', () => {
        setColumns({
            iconSet: (v) => ((v as number) >= 100 ? { glyph: '🏆' } : undefined),
            cellClassRules: [{ when: (v) => (v as number) >= 100, class: 'is-top' }],
        });
        const icons = fixture.debugElement.queryAll(By.css('span[data-slot="cell-icon"]'));
        expect(icons).toHaveLength(1);
        expect((icons[0].nativeElement as HTMLElement).textContent).toContain('🏆');
        const topCells = fixture.debugElement.queryAll(By.css('[data-slot="cell-formatted"].is-top'));
        expect(topCells).toHaveLength(1);
    });

    it('renders a named ui-icon when iconSet returns { name }', () => {
        setColumns({
            iconSet: (v) => ((v as number) >= 100 ? { name: 'chevron-up' } : undefined),
        });
        const namedIcons = fixture.debugElement.queryAll(By.css('ui-icon[data-slot="cell-icon"]'));
        expect(namedIcons).toHaveLength(1);
        // glyph branch must not also render
        const glyphSpans = fixture.debugElement.queryAll(By.css('span[data-slot="cell-icon"]'));
        expect(glyphSpans).toHaveLength(0);
    });

    it('does not wrap cells when the column declares no formatting', () => {
        const formatted = fixture.debugElement.queryAll(By.css('[data-slot="cell-formatted"]'));
        expect(formatted).toHaveLength(0);
    });
});

describe('computeAggregateValue (A2 util)', () => {
    it('sums, averages, min/max numeric values and ignores non-numeric', () => {
        const values = ['Alice', 10, 20, 'Bob', 30, 40];
        expect(computeAggregateValue(values, 'sum')).toBe('100');
        expect(computeAggregateValue(values, 'avg')).toBe('25');
        expect(computeAggregateValue(values, 'min')).toBe('10');
        expect(computeAggregateValue(values, 'max')).toBe('40');
    });

    it('counts every value (numeric or not)', () => {
        expect(computeAggregateValue(['Alice', 10, 20], 'count')).toBe('3');
    });

    it('returns empty string for numeric aggregates over no numbers', () => {
        expect(computeAggregateValue(['a', 'b'], 'sum')).toBe('');
    });

    it('rounds averages to two decimals', () => {
        expect(computeAggregateValue([1, 2], 'avg')).toBe('1.5');
        expect(computeAggregateValue([1, 1, 2], 'avg')).toBe('1.33');
    });

    it('supports a custom aggregate function', () => {
        expect(computeAggregateValue([1, 2, 3], (vals) => `n=${vals.length}`)).toBe('n=3');
    });
});

interface SalesRow {
    rep: string;
    q1: number;
    q2: number;
}

const SALES_DATA: SalesRow[] = [
    { rep: 'Alice', q1: 10, q2: 20 },
    { rep: 'Bob', q1: 30, q2: 40 },
];

const SALES_COLUMNS: ColumnDef<SalesRow>[] = [
    { accessorKey: 'rep', header: 'Rep' },
    { accessorKey: 'q1', header: 'Q1' },
    { accessorKey: 'q2', header: 'Q2' },
];

describe('DataTableComponent range-selection actions (A2)', () => {
    let component: DataTableComponent<SalesRow>;
    let fixture: ComponentFixture<DataTableComponent<SalesRow>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DataTableComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<SalesRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', SALES_DATA);
        fixture.componentRef.setInput('columns', SALES_COLUMNS);
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.componentRef.setInput('enableRangeActions', true);
        fixture.detectChanges();
    });

    it('computes live aggregates over a numeric range', () => {
        component.cellRange.set({ startRow: 0, startCol: 'q1', endRow: 1, endCol: 'q2' });
        const stats = component.rangeSelectionStats();
        expect(stats).toEqual({ count: 4, numericCount: 4, sum: '100', avg: '25', min: '10', max: '40' });
    });

    it('counts non-numeric cells but only aggregates numbers', () => {
        component.cellRange.set({ startRow: 0, startCol: 'rep', endRow: 1, endCol: 'q2' });
        const stats = component.rangeSelectionStats();
        expect(stats?.count).toBe(6);
        expect(stats?.numericCount).toBe(4);
        expect(stats?.sum).toBe('100');
    });

    it('is null when enableRangeActions is off', () => {
        fixture.componentRef.setInput('enableRangeActions', false);
        component.cellRange.set({ startRow: 0, startCol: 'q1', endRow: 1, endCol: 'q2' });
        expect(component.rangeSelectionStats()).toBeNull();
    });

    it('is null for a single-cell range', () => {
        component.cellRange.set({ startRow: 0, startCol: 'q1', endRow: 0, endCol: 'q1' });
        expect(component.rangeSelectionStats()).toBeNull();
    });

    it('builds a chart payload with numeric columns as series and a label column as categories', () => {
        component.cellRange.set({ startRow: 0, startCol: 'rep', endRow: 1, endCol: 'q2' });
        const payload = component.rangeChartPayload();
        expect(payload?.categories).toEqual(['Alice', 'Bob']);
        expect(payload?.series).toEqual([
            { name: 'Q1', values: [10, 30] },
            { name: 'Q2', values: [20, 40] },
        ]);
    });

    it('falls back to Row N categories when the range has no label column', () => {
        component.cellRange.set({ startRow: 0, startCol: 'q1', endRow: 1, endCol: 'q2' });
        expect(component.rangeChartPayload()?.categories).toEqual(['Row 1', 'Row 2']);
    });

    it('emits rangeChartOpen with the payload when openRangeChart is called', () => {
        component.cellRange.set({ startRow: 0, startCol: 'q1', endRow: 1, endCol: 'q2' });
        let emitted: unknown = null;
        component.rangeChartOpen.subscribe((p) => (emitted = p));
        component.openRangeChart();
        expect(emitted).toEqual(component.rangeChartPayload());
    });

    it('renders the readout bar with the live sum when a range is selected', () => {
        expect(fixture.debugElement.queryAll(By.css('[data-slot="range-actions"]'))).toHaveLength(0);
        component.cellRange.set({ startRow: 0, startCol: 'q1', endRow: 1, endCol: 'q2' });
        fixture.detectChanges();
        const bar = fixture.debugElement.query(By.css('[data-slot="range-actions"]'));
        expect(bar).toBeTruthy();
        expect((bar.nativeElement as HTMLElement).textContent).toContain('100');
    });
});

interface FillRow {
    id: string;
    n: number;
    label: string;
}

describe('DataTableComponent fill handle (B1)', () => {
    let component: DataTableComponent<FillRow>;
    let fixture: ComponentFixture<DataTableComponent<FillRow>>;
    let data: FillRow[];

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<FillRow>);
        component = fixture.componentInstance;
        data = [
            { id: '1', n: 1, label: 'Item 1' },
            { id: '2', n: 2, label: 'Item 2' },
            { id: '3', n: 0, label: '' },
            { id: '4', n: 0, label: '' },
        ];
        fixture.componentRef.setInput('data', data);
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'n', header: 'N', valueSetter: (row: FillRow, v: unknown) => ({ ...row, n: v as number }) },
            { accessorKey: 'label', header: 'Label', valueSetter: (row: FillRow, v: unknown) => ({ ...row, label: v as string }) },
        ] as ColumnDef<FillRow>[]);
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.componentRef.setInput('enableFillHandle', true);
        fixture.detectChanges();
    });

    it('fills a numeric series down from a selected range', () => {
        component.cellRange.set({ startRow: 0, startCol: 'n', endRow: 1, endCol: 'n' });
        component.fillDownTo(3);
        const rows = component.data();
        expect(rows.map((r) => r.n)).toEqual([1, 2, 3, 4]);
    });

    it('fills a trailing-number text series down', () => {
        component.cellRange.set({ startRow: 0, startCol: 'label', endRow: 1, endCol: 'label' });
        component.fillDownTo(3);
        expect(component.data().map((r) => r.label)).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
    });

    it('emits fillSeries with the filled rows and columns', () => {
        let event: unknown = null;
        component.fillSeries.subscribe((e) => (event = e));
        component.cellRange.set({ startRow: 0, startCol: 'n', endRow: 1, endCol: 'n' });
        component.fillDownTo(3);
        expect(event).toEqual({
            source: { minRow: 0, maxRow: 1 },
            filled: { startRow: 2, endRow: 3 },
            columnKeys: ['n'],
        });
    });

    it('is a no-op when the target row is not below the source', () => {
        component.cellRange.set({ startRow: 0, startCol: 'n', endRow: 1, endCol: 'n' });
        component.fillDownTo(1);
        expect(component.data().map((r) => r.n)).toEqual([1, 2, 0, 0]);
    });

    it('falls back to the focused cell as a 1×1 source when no range is selected', () => {
        component.focusedCell.set({ rowIndex: 0, columnKey: 'n' });
        component.fillDownTo(2);
        // single value repeats
        expect(component.data().map((r) => r.n)).toEqual([1, 1, 1, 0]);
    });

    it('computes a handle position for the focused cell (any render path)', () => {
        component.focusedCell.set({ rowIndex: 1, columnKey: 'n' });
        fixture.detectChanges();
        const pos = component['computeFillHandlePosition']();
        expect(pos).not.toBeNull();
        expect(typeof pos?.top).toBe('number');
        expect(typeof pos?.left).toBe('number');
    });

    it('has no handle position when nothing is focused or selected', () => {
        component.focusedCell.set(null);
        component.cellRange.set(null);
        fixture.detectChanges();
        expect(component['computeFillHandlePosition']()).toBeNull();
    });

    it('positions the overlay via the after-render effect end-to-end', async () => {
        component.focusedCell.set({ rowIndex: 1, columnKey: 'n' });
        fixture.detectChanges();
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        fixture.detectChanges();
        expect(component.fillHandlePosition()).not.toBeNull();
        expect(fixture.debugElement.queryAll(By.css('[data-slot="fill-handle"]'))).toHaveLength(1);
    });

    it('renders the overlay handle when a position is set, gated by enableFillHandle', () => {
        component.fillHandlePosition.set({ top: 12, left: 34 });
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.css('[data-slot="fill-handle"]'))).toHaveLength(1);

        fixture.componentRef.setInput('enableFillHandle', false);
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.css('[data-slot="fill-handle"]'))).toHaveLength(0);
    });

    it('marks fill-preview cells while dragging', () => {
        component.focusedCell.set({ rowIndex: 0, columnKey: 'n' });
        component.onFillHandleStart(new MouseEvent('mousedown'));
        expect(component.isCellInFillPreview(2, 'n')).toBe(false);
        // simulate the pointer reaching row 3 by reusing the public preview predicate
        component['_fillPreviewEndRow'].set(3);
        expect(component.isCellInFillPreview(2, 'n')).toBe(true);
        expect(component.isCellInFillPreview(2, 'label')).toBe(false);
        component['_onFillEnd']();
    });
});

describe('DataTableComponent smart paste (B2)', () => {
    let component: DataTableComponent<FillRow>;
    let fixture: ComponentFixture<DataTableComponent<FillRow>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<FillRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', [
            { id: '1', n: 0, label: '' },
            { id: '2', n: 0, label: '' },
            { id: '3', n: 0, label: '' },
        ]);
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            {
                accessorKey: 'n',
                header: 'N',
                valueSetter: (row: FillRow, v: unknown) => ({ ...row, n: v as number }),
                editValidator: (v: unknown) => (v as number) < 100 || 'too big',
            },
            { accessorKey: 'label', header: 'Label', valueSetter: (row: FillRow, v: unknown) => ({ ...row, label: v as string }) },
        ] as ColumnDef<FillRow>[]);
        fixture.componentRef.setInput('enableClipboardPaste', true);
        fixture.detectChanges();
    });

    it('writes a grid from the start cell across columns and rows, coercing numbers', () => {
        component['pasteGridAt'](0, 'n', [['10', 'a'], ['20', 'b']]);
        const rows = component.data();
        expect(rows[0]).toMatchObject({ n: 10, label: 'a' });
        expect(rows[1]).toMatchObject({ n: 20, label: 'b' });
        // numeric column received real numbers, not strings
        expect(typeof rows[0].n).toBe('number');
    });

    it('skips columns without a valueSetter and cells beyond the data', () => {
        // start at 'id' (no valueSetter) — that column is skipped, 'n' gets the 2nd value
        component['pasteGridAt'](0, 'id', [['x', '42']]);
        expect(component.data()[0]).toMatchObject({ id: '1', n: 42 });
    });

    it('rejects cells failing the editValidator and reports counts', () => {
        let event: { cellsApplied: number; cellsRejected: number } | null = null;
        component.cellsPaste.subscribe((e) => (event = e));
        component['pasteGridAt'](0, 'n', [['5'], ['999']]);
        expect(component.data().map((r) => r.n)).toEqual([5, 0, 0]);
        expect(event).toMatchObject({ cellsApplied: 1, cellsRejected: 1, rowsAffected: 2 });
    });
});

describe('DataTableComponent edit history (B3)', () => {
    let component: DataTableComponent<FillRow>;
    let fixture: ComponentFixture<DataTableComponent<FillRow>>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        fixture = TestBed.createComponent(DataTableComponent<FillRow>);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('data', [
            { id: '1', n: 1, label: 'Item 1' },
            { id: '2', n: 2, label: 'Item 2' },
            { id: '3', n: 0, label: '' },
            { id: '4', n: 0, label: '' },
        ]);
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'n', header: 'N', valueSetter: (row: FillRow, v: unknown) => ({ ...row, n: v as number }) },
            { accessorKey: 'label', header: 'Label', valueSetter: (row: FillRow, v: unknown) => ({ ...row, label: v as string }) },
        ] as ColumnDef<FillRow>[]);
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.componentRef.setInput('enableFillHandle', true);
        fixture.componentRef.setInput('enableEditHistory', true);
        fixture.detectChanges();
    });

    it('undoes and redoes a fill as one command', () => {
        component.cellRange.set({ startRow: 0, startCol: 'n', endRow: 1, endCol: 'n' });
        component.fillDownTo(3);
        expect(component.data().map((r) => r.n)).toEqual([1, 2, 3, 4]);

        component.undoEdit();
        expect(component.data().map((r) => r.n)).toEqual([1, 2, 0, 0]);

        component.redoEdit();
        expect(component.data().map((r) => r.n)).toEqual([1, 2, 3, 4]);
    });

    it('tracks canUndo / canRedo', () => {
        expect(component.canUndo()).toBe(false);
        component.cellRange.set({ startRow: 0, startCol: 'n', endRow: 1, endCol: 'n' });
        component.fillDownTo(3);
        expect(component.canUndo()).toBe(true);
        expect(component.canRedo()).toBe(false);
        component.undoEdit();
        expect(component.canUndo()).toBe(false);
        expect(component.canRedo()).toBe(true);
    });

    it('undoes an inline edit', () => {
        component.editingCell.set({ rowIndex: 0, columnKey: 'n' });
        component.editValue.set(99);
        component.commitEdit();
        expect(component.data()[0].n).toBe(99);
        component.undoEdit();
        expect(component.data()[0].n).toBe(1);
    });

    it('clears the redo stack when a new edit happens after an undo', () => {
        component.cellRange.set({ startRow: 0, startCol: 'n', endRow: 1, endCol: 'n' });
        component.fillDownTo(3);
        component.undoEdit();
        expect(component.canRedo()).toBe(true);
        // a fresh fill should drop the redo history
        component.cellRange.set({ startRow: 0, startCol: 'label', endRow: 1, endCol: 'label' });
        component.fillDownTo(3);
        expect(component.canRedo()).toBe(false);
    });

    it('does not record history when disabled', () => {
        fixture.componentRef.setInput('enableEditHistory', false);
        component.cellRange.set({ startRow: 0, startCol: 'n', endRow: 1, endCol: 'n' });
        component.fillDownTo(3);
        expect(component.canUndo()).toBe(false);
    });
});
