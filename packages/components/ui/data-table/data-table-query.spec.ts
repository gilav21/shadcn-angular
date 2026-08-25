// The server-side contract — `specs/data-table-contracts-spec.md` T-2, UC-2, R-5.
//
// The point of `query` is that a consumer stops reassembling a request from six
// separate outputs. So these tests assert the whole shape arrives, and — just
// as importantly — that it does not arrive when nothing changed, because each
// emission is a potential server round trip.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { DataTableComponent } from './data-table.component';
import type {
    ColumnDef,
    DataTableQuery,
    FilterGroup,
    PaginationState,
    SortState,
} from './data-table.types';

interface Row {
    id: number;
    name: string;
}

const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name', enableSorting: true },
];

/*
 * Enough rows for the pages these tests ask for to exist. With a short fixture
 * the table clamps an out-of-range `pageIndex` back to 0 — correctly, and the
 * query faithfully reports that as a second change, which looks like a double
 * emission until you read the page numbers.
 */
const DATA: Row[] = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: i === 1 ? 'Bob' : `Person ${i + 1}`,
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
      [data]="data"
      [columns]="columns"
      [(globalFilter)]="globalFilter"
      [(sortState)]="sortState"
      [(multiSortState)]="multiSortState"
      [(columnFilters)]="columnFilters"
      [(advancedFilter)]="advancedFilter"
      [(paginationState)]="paginationState"
      (query)="seen.push($event)"
    />
  `,
})
class HostComponent {
    readonly data = DATA;
    readonly columns = COLUMNS;
    readonly globalFilter = signal('');
    readonly sortState = signal<SortState>({ column: '', direction: null });
    readonly multiSortState = signal<SortState[]>([]);
    readonly columnFilters = signal<Record<string, unknown>>({});
    readonly advancedFilter = signal<FilterGroup | null>(null);
    readonly paginationState = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });
    readonly seen: DataTableQuery[] = [];
}

describe('the data-table server-side query contract', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;
    let original: typeof globalThis.ResizeObserver | undefined;

    const table = (): DataTableComponent<Row> =>
        fixture.debugElement.children[0].componentInstance as DataTableComponent<Row>;

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
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => {
        fixture.destroy();
        if (original) globalThis.ResizeObserver = original;
        else delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    });

    describe('what it reports', () => {
        /*
         * There is no change to report at construction, and an output that
         * emits while the component is being built fires before a consumer can
         * be ready for it. The first fetch comes from `currentQuery()`.
         */
        it('says nothing on init', () => {
            expect(host.seen).toEqual([]);
        });

        it('describes the current state without emitting, for the first fetch', () => {
            expect(table().currentQuery()).toEqual({
                globalFilter: '',
                columnFilters: {},
                sort: { column: '', direction: null },
                sortStates: [],
                advancedFilter: null,
                page: { pageIndex: 0, pageSize: 10 },
            });
            expect(host.seen).toEqual([]);
        });

        it('emits the whole request when the page changes, not just the page', async () => {
            host.paginationState.set({ pageIndex: 2, pageSize: 25 });
            await settle();

            expect(host.seen).toHaveLength(1);
            expect(host.seen[0]).toEqual({
                globalFilter: '',
                columnFilters: {},
                sort: { column: '', direction: null },
                sortStates: [],
                advancedFilter: null,
                page: { pageIndex: 2, pageSize: 25 },
            });
        });

        it('carries a sort', async () => {
            host.sortState.set({ column: 'name', direction: 'desc' });
            await settle();

            expect(host.seen.at(-1)?.sort).toEqual({ column: 'name', direction: 'desc' });
        });

        it('carries the multi-sort chain in priority order', async () => {
            host.multiSortState.set([
                { column: 'name', direction: 'asc' },
                { column: 'id', direction: 'desc' },
            ]);
            await settle();

            expect(host.seen.at(-1)?.sortStates.map(s => s.column)).toEqual(['name', 'id']);
        });

        it('carries the global filter', async () => {
            host.globalFilter.set('ali');
            await settle();

            expect(host.seen.at(-1)?.globalFilter).toBe('ali');
        });

        it('carries per-column filters', async () => {
            host.columnFilters.set({ name: 'Bob' });
            await settle();

            expect(host.seen.at(-1)?.columnFilters).toEqual({ name: 'Bob' });
        });

        it('carries the advanced filter tree', async () => {
            const tree: FilterGroup = {
                type: 'group',
                combinator: 'and',
                rules: [{ type: 'condition', column: 'name', operator: 'equals', value: 'Bob' }],
            };
            host.advancedFilter.set(tree);
            await settle();

            expect(host.seen.at(-1)?.advancedFilter).toEqual(tree);
        });
    });

    /*
     * R-5. Every emission is a round trip on a server-side table, so an
     * emission that reports no change is not a wasted tick — it is a duplicate
     * fetch. Several of these fields are `model()`s holding objects, so signal
     * identity alone would not catch a write of an equal-but-new object.
     */
    describe('what it does not report', () => {
        it('stays quiet when a value is rewritten unchanged', async () => {
            host.paginationState.set({ pageIndex: 1, pageSize: 10 });
            await settle();
            expect(host.seen).toHaveLength(1);

            host.paginationState.set({ pageIndex: 1, pageSize: 10 });
            await settle();

            expect(host.seen).toHaveLength(1);
        });

        it('stays quiet when an equal sort chain is rebuilt', async () => {
            host.multiSortState.set([{ column: 'name', direction: 'asc' }]);
            await settle();
            expect(host.seen).toHaveLength(1);

            host.multiSortState.set([{ column: 'name', direction: 'asc' }]);
            await settle();

            expect(host.seen).toHaveLength(1);
        });

        it('reports each genuine change once', async () => {
            host.globalFilter.set('a');
            await settle();
            host.globalFilter.set('al');
            await settle();
            host.globalFilter.set('ali');
            await settle();

            expect(host.seen.map(q => q.globalFilter)).toEqual(['a', 'al', 'ali']);
        });
    });

    describe('the shape itself', () => {
        /** UC-2: it is a request, so it has to survive being sent as one. */
        it('survives a JSON round trip', async () => {
            host.globalFilter.set('ali');
            host.sortState.set({ column: 'name', direction: 'asc' });
            await settle();

            const sent = host.seen.at(-1)!;
            expect(JSON.parse(JSON.stringify(sent))).toEqual(sent);
        });

        it('matches what currentQuery reports at the same moment', async () => {
            host.globalFilter.set('bob');
            await settle();

            expect(host.seen.at(-1)).toEqual(table().currentQuery());
        });
    });
});
