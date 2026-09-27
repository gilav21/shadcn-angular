// Saved views and date editing — `specs/data-table-contracts-spec.md` T-3, T-4.
//
// A view token is persisted by the consumer, so it outlives the build that
// wrote it. These tests care most about what happens to a token that no longer
// matches — refusing it outright, rather than applying the half that parses.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { DataTableComponent } from './data-table.component';
import { DatePickerComponent } from '../date-picker';
import {
    asEditableDate,
    toEditedDateValue,
    toLocalDateString,
} from './data-table.utils';
import type { CellEditEvent, ColumnDef, DataTableViewState, FilterGroup } from './data-table.types';

interface Row {
    id: number;
    name: string;
    due: string;
}

const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name', enableSorting: true },
    { accessorKey: 'due', header: 'Due', editable: true, editType: 'date' },
];

const DATA: Row[] = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    due: '2026-03-04',
}));

class NoopResizeObserver {
    observe(): void { /* noop */ }
    unobserve(): void { /* noop */ }
    disconnect(): void { /* noop */ }
}

describe('saved views', () => {
    @Component({
        standalone: true,
        imports: [DataTableComponent],
        template: `<ui-data-table [data]="data" [columns]="columns" [(globalFilter)]="globalFilter" />`,
    })
    class HostComponent {
        readonly data = DATA;
        readonly columns = COLUMNS;
        readonly globalFilter = signal('');
    }

    let fixture: ComponentFixture<HostComponent>;
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
        await settle();
    });

    afterEach(() => {
        fixture.destroy();
        if (original) globalThis.ResizeObserver = original;
        else delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    });

    /** Arrange a table the way a user would before saving a named view. */
    async function arrangeAView(): Promise<void> {
        const t = table();
        t.sortState.set({ column: 'name', direction: 'desc' });
        t.multiSortState.set([{ column: 'name', direction: 'desc' }]);
        t.columnFilters.set({ name: 'Person 1' });
        t.globalFilter.set('person');
        t.paginationState.set({ pageIndex: 2, pageSize: 10 });
        t.columnVisibility.set({ id: false });
        await settle();
    }

    /** UC-3: arrange, save, wander off, come back to exactly that. */
    it('restores everything it captured', async () => {
        await arrangeAView();
        const saved: DataTableViewState = JSON.parse(JSON.stringify(table().getViewState()));

        const t = table();
        t.sortState.set({ column: '', direction: null });
        t.multiSortState.set([]);
        t.columnFilters.set({});
        t.globalFilter.set('');
        t.paginationState.set({ pageIndex: 0, pageSize: 10 });
        t.columnVisibility.set({});
        await settle();

        expect(t.applyViewState(saved)).toBe(true);
        await settle();

        expect(t.sortState()).toEqual({ column: 'name', direction: 'desc' });
        expect(t.multiSortState()).toEqual([{ column: 'name', direction: 'desc' }]);
        expect(t.columnVisibility()['id']).toBe(false);
        expect(t.columnFilters()).toEqual({ name: 'Person 1' });
        expect(t.globalFilter()).toBe('person');
        expect(t.paginationState()).toEqual({ pageIndex: 2, pageSize: 10 });
    });

    /** UC-5: it is persisted as JSON, so it has to survive being JSON. */
    it('survives a JSON round trip unchanged', async () => {
        await arrangeAView();
        const view = table().getViewState();

        expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    });

    /*
     * R-3. A token outlives its shape, so the interesting case is the one that
     * no longer matches. Applying the half that parses leaves a table that is
     * nearly right, with no way for the user to tell which parts are stale —
     * which is worse than not restoring at all.
     */
    describe('a token it cannot read', () => {
        it('changes nothing at all when it refuses', async () => {
            await arrangeAView();
            const before = JSON.stringify(table().getViewState());

            const refused = table().applyViewState({
                ...table().getViewState(),
                version: 99,
                globalFilter: 'zzz',
                sort: { column: 'id', direction: 'asc' },
            });
            await settle();

            expect(refused).toBe(false);

            expect(JSON.stringify(table().getViewState())).toBe(before);
        });

        it('says no to null and undefined rather than throwing', () => {
            expect(table().applyViewState(null)).toBe(false);
            expect(table().applyViewState(undefined)).toBe(false);
        });
    });

    it('carries an advanced filter tree through the round trip', async () => {
        const tree: FilterGroup = {
            type: 'group',
            combinator: 'and',
            rules: [{ type: 'condition', column: 'name', operator: 'equals', value: 'Bob' }],
        };
        table().advancedFilter.set(tree);
        await settle();

        const saved: DataTableViewState = JSON.parse(JSON.stringify(table().getViewState()));
        table().advancedFilter.set(null);
        await settle();

        expect(table().applyViewState(saved)).toBe(true);
        expect(table().advancedFilter()).toEqual(tree);
    });
});

describe('editing a date cell', () => {
    describe('reading whatever shape the column keeps', () => {
        it('reads a Date', () => {
            const date = new Date(2026, 2, 4);
            expect(asEditableDate(date)).toBe(date);
        });

        /*
         * `new Date('2026-03-04')` is UTC midnight: the previous day anywhere
         * west of Greenwich, and 03:00 in UTC+3, where the day still looks
         * right. Local midnight holds in every timezone.
         */
        it('reads a date-only ISO string as local midnight of that day, and a date-time one as its instant', () => {
            const dateOnly = asEditableDate('2026-03-04');
            expect([dateOnly?.getFullYear(), dateOnly?.getMonth(), dateOnly?.getDate(), dateOnly?.getHours(), dateOnly?.getMinutes()])
                .toEqual([2026, 2, 4, 0, 0]);
            expect(asEditableDate('2026-03-04T10:30:00Z')?.getTime()).toBe(Date.UTC(2026, 2, 4, 10, 30));
        });

        it('reads an epoch number', () => {
            expect(asEditableDate(Date.UTC(2026, 2, 4))?.getUTCDate()).toBe(4);
        });

        /** "Invalid Date" renders as the literal text if it ever escapes. */
        it.each([['not a date'], ['2026-02-30'], [null], [undefined], [{}], [Number.NaN]])(
            'reads %j as nothing',
            value => {
                expect(asEditableDate(value)).toBeNull();
            },
        );

        it('reads an out-of-range Date as nothing', () => {
            expect(asEditableDate(new Date('nonsense'))).toBeNull();
        });
    });

    /*
     * R-4. The editor's job is to change the value, not its type: a column
     * holding ISO strings must keep holding ISO strings, or the consumer's
     * `valueSetter` and their backend both get a shape they never agreed to.
     */
    describe('writing back in the shape it found', () => {
        const picked = new Date(2026, 2, 4);

        it('keeps a string column on strings', () => {
            expect(toEditedDateValue(picked, '2026-01-01')).toBe('2026-03-04');
        });

        it('keeps a Date column on Dates', () => {
            expect(toEditedDateValue(picked, new Date(2026, 0, 1))).toBe(picked);
        });

        it('defaults an empty cell to a Date', () => {
            expect(toEditedDateValue(picked, null)).toBe(picked);
        });

        it('clears to null', () => {
            expect(toEditedDateValue(null, '2026-01-01')).toBeNull();
        });

        it('hands a date-only string back as the same day when it is re-picked unchanged', () => {
            expect(toEditedDateValue(asEditableDate('2026-03-04'), '2026-03-04')).toBe('2026-03-04');
        });
    });

    /*
     * `toISOString().slice(0, 10)` converts to UTC first, so a date picked in
     * the evening east of Greenwich comes back as the previous day: the cell
     * shows one date and the value holds another, invisibly, until someone in
     * the wrong timezone looks.
     */
    it('formats in the local calendar, not UTC', () => {
        const localMidnight = new Date(2026, 2, 4);
        const lateEvening = new Date(2026, 2, 4, 23, 30);
        expect(toLocalDateString(localMidnight)).toBe('2026-03-04');
        expect(toLocalDateString(lateEvening)).toBe('2026-03-04');
    });

    it('pads a single-digit month and day', () => {
        expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    describe('in the table', () => {
        let original: typeof globalThis.ResizeObserver | undefined;

        beforeEach(() => {
            original = globalThis.ResizeObserver;
            globalThis.ResizeObserver = NoopResizeObserver as unknown as typeof globalThis.ResizeObserver;
        });

        afterEach(() => {
            if (original) globalThis.ResizeObserver = original;
            else delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
        });

        it('opens a date picker on the cell and commits the picked day as the string the column holds', async () => {
            await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
            const fixture = TestBed.createComponent(DataTableComponent<Row>);
            fixture.componentRef.setInput('data', DATA.slice(0, 3));
            fixture.componentRef.setInput('columns', COLUMNS);
            fixture.detectChanges();
            const table = fixture.componentInstance;
            const edits: CellEditEvent<Row>[] = [];
            table.cellEdit.subscribe((edit) => edits.push(edit));

            table.startEditing(1, 'due');
            fixture.detectChanges();
            const picker = fixture.debugElement.query(By.directive(DatePickerComponent)).componentInstance as DatePickerComponent;
            expect(picker.date()?.getTime()).toBe(new Date(2026, 2, 4).getTime());

            picker.dateChange.emit(new Date(2026, 2, 10));
            fixture.detectChanges();

            expect(edits.map(({ rowIndex, oldValue, newValue }) => ({ rowIndex, oldValue, newValue })))
                .toEqual([{ rowIndex: 1, oldValue: '2026-03-04', newValue: '2026-03-10' }]);
            expect(table.editingCell()).toBeNull();
        });
    });
});
