import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableComponent } from './data-table.component';
import { ColumnDef } from './data-table.types';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';

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
            imports: [DataTableComponent],
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
        const rows = fixture.debugElement.queryAll(By.css('ui-table-row[data-state]')); // data-rows have data-state attribute
        // Note: With default pagination size 10, all 5 rows should show
        // Selector needs to be specific to avoid header row
        const bodyRows = fixture.nativeElement.querySelectorAll('ui-table-body ui-table-row');
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
        component.toggleRow(row);
        expect(component.isRowSelected(row)).toBeTrue();
        expect(component.isAllSelected()).toBeFalse();
        expect(component.isIndeterminate()).toBeTrue();

        // Toggle all
        component.toggleAll(); // Selects all
        expect(component.isAllSelected()).toBeTrue();
        expect(component.isRowSelected(TEST_DATA[1])).toBeTrue();

        // Toggle all off
        component.toggleAll();
        expect(component.isAllSelected()).toBeFalse();
    });

    it('should apply sticky classes correctly', () => {
        const stickyCol = { accessorKey: 'id', header: 'ID', sticky: true, _stickyLeft: 0, _width: '50px' };

        // Header
        const headerClass = component.getStickyClass(stickyCol, 'header');
        expect(headerClass).toContain('z-30'); // Corner

        // Cell
        const cellClass = component.getStickyClass(stickyCol, 'cell');
        expect(cellClass).toContain('sticky');
        expect(cellClass).toContain('left-0'); // Actually styles set left, class sets sticky
    });
});
