import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DataTableComponent } from './data-table.component';
import { ColumnDef, SortDirection } from './data-table.types';

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

    it('activates a sort header and a page button exactly once per Enter or Space press', async () => {
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<TestData>);
        fixture.componentRef.setInput('data', Array.from({ length: 35 }, (_, i) => ({ id: String(i + 1), name: `Person ${i + 1}`, role: 'User' })));
        fixture.componentRef.setInput('columns', TEST_COLUMNS);
        fixture.detectChanges();
        const sorts: SortDirection[] = [];
        const pages: number[] = [];
        fixture.componentInstance.sortChange.subscribe((s) => sorts.push(s.direction));
        fixture.componentInstance.pageChange.subscribe((p) => pages.push(p.pageIndex));
        const host = fixture.nativeElement as HTMLElement;
        const press = async (target: HTMLElement, key: string): Promise<void> => {
            target.focus();
            await userEvent.keyboard(key);
            fixture.detectChanges();
            await fixture.whenStable();
        };

        const sortButton = (): HTMLElement =>
            host.querySelectorAll<HTMLElement>('ui-data-table-column-header button')[1];
        await press(sortButton(), '{Enter}');
        await press(sortButton(), ' ');
        // the Space press starts from asc, so it must move exactly one step, to desc
        expect(sorts).toEqual(['asc', 'desc']);

        const nextPage = (): HTMLElement =>
            [...host.querySelectorAll<HTMLElement>('ui-data-table-pagination button')]
                .find((b) => b.textContent?.includes('Go to next page'))!;
        await press(nextPage(), '{Enter}');
        await press(nextPage(), ' ');
        expect(pages).toEqual([1, 2]);
    });

    it('outlines the cells a fill-handle drag previews with a dashed line, and only those', async () => {
        interface FillRow { id: string; n: number; label: string }
        await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
        const fixture = TestBed.createComponent(DataTableComponent<FillRow>);
        fixture.componentRef.setInput('data', [1, 2, 3, 4].map((n) => ({ id: String(n), n, label: `Item ${n}` })));
        fixture.componentRef.setInput('columns', [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'n', header: 'N' },
            { accessorKey: 'label', header: 'Label' },
        ] as ColumnDef<FillRow>[]);
        fixture.componentRef.setInput('enableFillHandle', true);
        fixture.detectChanges();
        fixture.componentInstance.focusedCell.set({ rowIndex: 0, columnKey: 'n' });
        fixture.detectChanges();
        await fixture.whenStable();

        const host = fixture.nativeElement as HTMLElement;
        const cell = (row: number, key: string): HTMLElement =>
            host.querySelector<HTMLElement>(`[data-row-index="${row}"] [data-column="${key}"]`)!;
        const target = cell(2, 'n').getBoundingClientRect();
        host.querySelector('[data-slot="fill-handle"]')!.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
        );
        document.dispatchEvent(new MouseEvent('mousemove', {
            clientX: target.left + target.width / 2,
            clientY: target.top + target.height / 2,
        }));
        fixture.detectChanges();

        const outline = (row: number, key: string): string => getComputedStyle(cell(row, key)).outlineStyle;
        try {
            expect([outline(1, 'n'), outline(2, 'n')]).toEqual(['dashed', 'dashed']);
            expect([outline(0, 'n'), outline(3, 'n'), outline(1, 'label')]).toEqual(['none', 'none', 'none']);
        } finally {
            document.dispatchEvent(new MouseEvent('mouseup'));
        }
    });
});
