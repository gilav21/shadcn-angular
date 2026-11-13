// What the inline editors hand to the validator, the setter and (cellEdit): the type of the value, not a string.
import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

interface Row { id: number; name: string; qty: number | null; level: number; flag: boolean; plan: string }

const setter = vi.fn((row: Row, value: unknown, key: keyof Row) => ({ ...row, [key]: value }));
const validator = vi.fn<(value: unknown, row: Row) => boolean>(() => true);

const columns: ColumnDef<Row>[] = [
    { accessorKey: 'name', header: 'Name', editable: true },
    { accessorKey: 'qty', header: 'Qty', editable: true, editType: 'number', editValidator: validator, valueSetter: (row, value) => setter(row, value, 'qty') },
    {
        accessorKey: 'level', header: 'Level', editable: true, editType: 'select',
        editOptions: [{ label: 'Low', value: 1 }, { label: 'High', value: 2 }],
        valueSetter: (row, value) => setter(row, value, 'level'),
    },
    {
        accessorKey: 'flag', header: 'Flag', editable: true, editType: 'select',
        editOptions: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
        valueSetter: (row, value) => setter(row, value, 'flag'),
    },
    {
        accessorKey: 'plan', header: 'Plan', editable: true, editType: 'select',
        editOptions: [{ label: 'Free', value: 'free' }, { label: 'Pro', value: 'pro' }],
        valueSetter: (row, value) => setter(row, value, 'plan'),
    },
];

@Component({
    standalone: true,
    imports: [DataTableComponent],
    template: `<ui-data-table [data]="data" [columns]="columns" [paginationState]="{ pageIndex: 0, pageSize: 100 }" />`,
})
class Host {
    readonly table = viewChild.required(DataTableComponent<Row>);
    readonly columns = columns;
    readonly data: Row[] = [{ id: 1, name: 'Ann', qty: 5, level: 1, flag: true, plan: 'free' }];
}

async function edit(columnKey: string) {
    TestBed.resetTestingModule();
    setter.mockClear();
    validator.mockClear();
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const table = fixture.componentInstance.table();
    const edits: unknown[] = [];
    table.cellEdit.subscribe((event) => edits.push(event.newValue));
    table.startEditing(0, columnKey);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement>('input[data-edit-input]');
    const select = root.querySelector<HTMLSelectElement>('select[data-edit-input]');
    const settle = async () => {
        fixture.detectChanges();
        await fixture.whenStable();
    };
    return { table, input, select, edits, settle };
}

describe('data-table editor value types', () => {
    it('a number editor reports a number to the validator, the setter and cellEdit, and null when cleared', async () => {
        const { input, table, edits, settle } = await edit('qty');
        input!.value = '12';
        input!.dispatchEvent(new Event('input'));
        expect(validator).not.toHaveBeenCalled();
        table.commitEdit();
        await settle();
        expect(validator).toHaveBeenCalledWith(12, expect.anything());
        expect(setter).toHaveBeenCalledWith(expect.anything(), 12, 'qty');
        expect(edits).toEqual([12]);

        const cleared = await edit('qty');
        cleared.input!.value = '';
        cleared.input!.dispatchEvent(new Event('input'));
        cleared.table.commitEdit();
        await cleared.settle();
        expect(cleared.edits).toEqual([null]);
    });

    it('committing a number editor with the digits it opened with is not a change', async () => {
        const { input, table, edits, settle } = await edit('qty');
        input!.value = '5';
        input!.dispatchEvent(new Event('input'));
        table.commitEdit();
        await settle();
        expect(edits).toEqual([]);
        expect(setter).not.toHaveBeenCalled();
    });

    it('a select reports the option value with its own type: number, boolean and string', async () => {
        for (const [key, index, expected] of [['level', 1, 2], ['flag', 1, false], ['plan', 1, 'pro']] as const) {
            const { select, edits, settle } = await edit(key);
            select!.selectedIndex = index;
            select!.dispatchEvent(new Event('change'));
            await settle();
            expect(edits, key).toEqual([expected]);
            expect(setter, key).toHaveBeenCalledWith(expect.anything(), expected, key);
        }
    });

    it('typing a minus sign over a number keeps the typed text and does not delete the cell', async () => {
        const { input, table, edits, settle } = await edit('qty');
        input!.focus();
        await userEvent.keyboard('{Control>}a{/Control}-');
        await settle();
        expect(input!.validity.badInput).toBe(true); // the "-" is still in the field, not wiped by a re-bind
        table.commitEdit();
        await settle();
        expect(edits).toEqual([]);
    });

    it('typing a decimal over a number keeps every keystroke and commits the number', async () => {
        const { input, table, edits, settle } = await edit('qty');
        input!.focus();
        await userEvent.keyboard('{Control>}a{/Control}1.25');
        await settle();
        expect(input!.value).toBe('1.25'); // a re-bind of the typed number would have turned '1.' into '1'
        table.commitEdit();
        await settle();
        expect(edits).toEqual([1.25]);
    });

    it('a select shows a null option as the current one', async () => {
        TestBed.resetTestingModule();
        const nullable: ColumnDef<Row>[] = [{
            accessorKey: 'plan', header: 'Plan', editable: true, editType: 'select',
            editOptions: [{ label: 'Free', value: 'free' }, { label: 'None', value: null }],
        }];
        @Component({
            standalone: true,
            imports: [DataTableComponent],
            template: `<ui-data-table [data]="data" [columns]="columns" [paginationState]="{ pageIndex: 0, pageSize: 100 }" />`,
        })
        class NullableHost {
            readonly table = viewChild.required(DataTableComponent<Row>);
            readonly columns = nullable;
            readonly data = [{ id: 1, name: 'Ann', qty: 5, level: 1, flag: true, plan: null }] as unknown as Row[];
        }
        await TestBed.configureTestingModule({ imports: [NullableHost] }).compileComponents();
        const fixture = TestBed.createComponent(NullableHost);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.componentInstance.table().startEditing(0, 'plan');
        fixture.detectChanges();
        await fixture.whenStable();
        const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('select[data-edit-input]')!;
        expect(select.selectedIndex).toBe(1);
    });
});
