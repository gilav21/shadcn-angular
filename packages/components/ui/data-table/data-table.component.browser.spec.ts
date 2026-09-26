import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { DataTableComponent } from './data-table.component';
import { ColumnDef } from './data-table.types';

interface TestData {
    id: string;
    name: string;
    role: string;
}

const TEST_DATA: TestData[] = [
    { id: '1', name: 'Alice', role: 'Admin' },
    { id: '2', name: 'Bob', role: 'User' },
];

const TEST_COLUMNS: ColumnDef<TestData>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'role', header: 'Role' },
];

/** Browser-only data-table cases: they read rendered geometry and resolved style, which jsdom cannot produce. */
describe('DataTableComponent (browser)', () => {
    it('gives the resize handle a wide touch hit area around a thin visual line', async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<TestData>);
        fixture.componentRef.setInput('data', TEST_DATA);
        fixture.componentRef.setInput('columns', TEST_COLUMNS);
        fixture.componentRef.setInput('enableColumnResize', true);
        fixture.detectChanges();

        const handle = fixture.nativeElement.querySelector('[role="separator"]') as HTMLElement;
        const line = handle.querySelector('div') as HTMLElement;

        expect(handle.getBoundingClientRect().width).toBeGreaterThanOrEqual(16);
        expect(getComputedStyle(handle).touchAction).toBe('none');
        expect(line.getBoundingClientRect().width).toBe(1);
    });

    it('centres the fill handle on the bottom-right corner of the selected range', async () => {
        interface FillRow { id: string; n: number; label: string }
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<FillRow>);
        fixture.componentRef.setInput('data', [
            { id: '1', n: 1, label: 'Item 1' },
            { id: '2', n: 2, label: 'Item 2' },
            { id: '3', n: 0, label: '' },
        ]);
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'n', header: 'N' },
            { accessorKey: 'label', header: 'Label' },
        ] as ColumnDef<FillRow>[]);
        fixture.componentRef.setInput('enableCellRangeSelection', true);
        fixture.componentRef.setInput('enableFillHandle', true);
        fixture.detectChanges();

        fixture.componentInstance.cellRange.set({ startRow: 0, startCol: 'n', endRow: 1, endCol: 'label' });
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        const corner = host.querySelector('[data-row-index="1"] [data-column="label"]')!.getBoundingClientRect();
        const handle = host.querySelector('[data-slot="fill-handle"]')!.getBoundingClientRect();
        // within the scroll container's 1px border; a neighbouring cell is tens of pixels away
        expect(Math.abs(handle.left + handle.width / 2 - corner.right)).toBeLessThanOrEqual(2);
        expect(Math.abs(handle.top + handle.height / 2 - corner.bottom)).toBeLessThanOrEqual(2);
    });
});
