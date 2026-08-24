// ARIA grid semantics — `specs/data-table-contracts-spec.md` T-1, UC-1, UC-6.
//
// The point of `aria-rowcount` / `aria-rowindex` is the virtualized case: the
// DOM holds a window of rows out of a much larger set, so anything that counts
// DOM rows tells the user "row 3 of 30" and strands them. These tests therefore
// assert against a table whose DOM deliberately does not hold all its rows.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

interface Row {
    id: number;
    name: string;
    city: string;
}

const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'city', header: 'City' },
];

const rows = (count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `Person ${i + 1}`,
        city: `City ${i + 1}`,
    }));

class NoopResizeObserver {
    observe(): void { /* noop */ }
    unobserve(): void { /* noop */ }
    disconnect(): void { /* noop */ }
}

@Component({
    standalone: true,
    imports: [DataTableComponent],
    template: `
    <ui-data-table
      [data]="data()"
      [columns]="columns"
      [enableVirtualScroll]="virtual()"
      [virtualRowHeight]="40"
      [paginationState]="{ pageIndex: 0, pageSize: 10000 }"
    />
  `,
})
class HostComponent {
    readonly data = signal<Row[]>(rows(5));
    readonly columns = COLUMNS;
    readonly virtual = signal<boolean | 'auto'>(false);
}

describe('data-table grid semantics', () => {
    let fixture: ComponentFixture<HostComponent>;
    let original: typeof globalThis.ResizeObserver | undefined;

    const grid = (): HTMLElement =>
        fixture.nativeElement.querySelector('[data-slot="table"]');
    /** Rows a screen reader can actually reach — the layout spacer is hidden. */
    const bodyRows = (): HTMLElement[] => [
        ...fixture.nativeElement.querySelectorAll(
            '[data-slot="table-body"] [data-slot="table-row"]:not([aria-hidden="true"])',
        ),
    ];
    const allBodyRows = (): HTMLElement[] => [
        ...fixture.nativeElement.querySelectorAll(
            '[data-slot="table-body"] [data-slot="table-row"]',
        ),
    ];
    const headerRows = (): HTMLElement[] => [
        ...fixture.nativeElement.querySelectorAll(
            '[data-slot="table-header"] [data-slot="table-row"]',
        ),
    ];

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    beforeEach(async () => {
        original = globalThis.ResizeObserver;
        globalThis.ResizeObserver =
            NoopResizeObserver as unknown as typeof globalThis.ResizeObserver;

        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        await settle();
    });

    afterEach(() => {
        fixture.destroy();
        if (original) globalThis.ResizeObserver = original;
        else delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    });

    describe('the grid declares itself', () => {
        /*
         * `table` is a static grid of data; `grid` is the interactive widget.
         * The distinction is what tells assistive tech to stop treating arrow
         * keys as document navigation and hand them to the component — which
         * this one has wired to cell movement, selection and editing.
         */
        it('is a grid, not a static table', () => {
            expect(grid().getAttribute('role')).toBe('grid');
        });

        it('counts the header row in aria-rowcount', () => {
            // 5 data rows + 1 header row.
            expect(grid().getAttribute('aria-rowcount')).toBe('6');
        });

        it('publishes the column count', () => {
            expect(grid().getAttribute('aria-colcount')).toBe('3');
        });
    });

    describe('row numbering', () => {
        it('gives the header row index 1, so data starts at 2', () => {
            expect(headerRows()[0].getAttribute('aria-rowindex')).toBe('1');
            expect(bodyRows()[0].getAttribute('aria-rowindex')).toBe('2');
        });

        it('numbers every rendered row consecutively', () => {
            const indices = bodyRows().map(r => Number(r.getAttribute('aria-rowindex')));
            expect(indices).toEqual([2, 3, 4, 5, 6]);
        });

        /*
         * The body ends with a spacer row that stretches it to fill the
         * container. It holds no data and cannot be reached, so counting it
         * would put every index and both totals out by one — which is exactly
         * what happened before it was hidden.
         */
        it('leaves the layout spacer out of the grid entirely', () => {
            expect(allBodyRows()).toHaveLength(bodyRows().length + 1);

            const spacer = allBodyRows().at(-1)!;
            expect(spacer.getAttribute('aria-hidden')).toBe('true');
            expect(spacer.hasAttribute('aria-rowindex')).toBe(false);
        });

        it('renumbers when the data changes', async () => {
            fixture.componentInstance.data.set(rows(2));
            await settle();

            expect(grid().getAttribute('aria-rowcount')).toBe('3');
            expect(bodyRows().map(r => r.getAttribute('aria-rowindex'))).toEqual(['2', '3']);
        });
    });

    describe('cell numbering', () => {
        it('numbers the cells of a row from 1', () => {
            const cells = [...bodyRows()[0].children];
            expect(cells.map(c => c.getAttribute('aria-colindex'))).toEqual(['1', '2', '3']);
        });

        it('numbers the header cells too', () => {
            const cells = [...headerRows()[0].children];
            expect(cells.map(c => c.getAttribute('aria-colindex'))).toEqual(['1', '2', '3']);
        });
    });

    /*
     * The case the whole feature exists for. With 5,000 rows virtualized, the
     * DOM holds a few dozen; a count taken from the DOM would be wrong by three
     * orders of magnitude, and an index taken from DOM position would restart
     * at 1 every time the user scrolled.
     */
    describe('virtualized, where the DOM holds a window of the data', () => {
        beforeEach(async () => {
            fixture.componentInstance.data.set(rows(5000));
            fixture.componentInstance.virtual.set(true);
            await settle();
        });

        it('really does render only a window', () => {
            expect(bodyRows().length).toBeGreaterThan(0);
            expect(bodyRows().length).toBeLessThan(5000);
        });

        it('counts the whole dataset, not the rendered window', () => {
            expect(grid().getAttribute('aria-rowcount')).toBe('5001');
        });

        it('numbers rows by their absolute position, not their DOM position', () => {
            const indices = bodyRows().map(r => Number(r.getAttribute('aria-rowindex')));

            // Consecutive, and offset past the header row.
            expect(indices[0]).toBe(2);
            for (const [n, index] of indices.entries()) {
                expect(index).toBe(indices[0] + n);
            }
        });
    });
});
