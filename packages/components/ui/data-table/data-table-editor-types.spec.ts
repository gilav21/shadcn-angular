// What the inline editors hand to the validator, the setter and (cellEdit): the type of the value, not a string.
import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

interface Row { id: number; name: string; qty: number | null; level: number; flag: boolean; plan: string; team?: unknown; code?: unknown }

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
    {
        accessorKey: 'code', header: 'Code', editable: true, editType: 'select',
        editOptions: [{ label: 'Number', value: 1 }, { label: 'Text', value: '1' }],
    },
    {
        accessorKey: 'team', header: 'Team', editable: true, editType: 'select',
        editOptions: [{ label: 'Red', value: { id: 1 } }, { label: 'Blue', value: { id: 2 } }],
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

async function edit(columnKey: string, cell: Partial<Row> = {}) {
    TestBed.resetTestingModule();
    setter.mockClear();
    validator.mockClear();
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    Object.assign(fixture.componentInstance.data[0], cell);
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

    it('a half-typed number ("-", "1e") is not a value: it keeps the last valid one and leaving the field does not delete the cell', async () => {
        const { input, table, edits, settle } = await edit('qty');
        // A number input in that state reports value '' with validity.badInput, which a script cannot produce by assigning value.
        Object.defineProperty(input!, 'validity', { value: { badInput: true } });
        input!.value = '';
        input!.dispatchEvent(new Event('input'));
        table.commitEdit();
        await settle();
        expect(edits).toEqual([]); // unchanged, not null
    });

    it('a decimal is committed as a number', async () => {
        const { input, table, edits, settle } = await edit('qty');
        input!.value = '1.25';
        input!.dispatchEvent(new Event('input'));
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

    it('a negative decimal being typed keeps its text and commits as a number', async () => {
        const { input, table, edits, settle } = await edit('qty');
        for (const text of ['-0', '-0.5']) {
            input!.value = text;
            input!.dispatchEvent(new Event('input'));
            await settle();
            expect(input!.value, text).toBe(text); // writing the parsed -0 back would have turned "-0" into "0"
        }
        table.commitEdit();
        await settle();
        expect(edits).toEqual([-0.5]);
    });

    it('a select whose cell matches no option shows blank, and every option stays choosable', async () => {
        const { select, edits, settle } = await edit('level', { level: 99 });
        expect(select!.value).toBe('');
        select!.selectedIndex = 1; // the first real option; with it pre-selected this would fire no change
        select!.dispatchEvent(new Event('change'));
        await settle();
        expect(edits).toEqual([1]);
    });

    it('a select matches an option whose value is the string form of the cell value', async () => {
        const { select } = await edit('level', { level: '2' as unknown as number });
        expect(select!.options[select!.selectedIndex].text).toBe('High');
    });

    it('object options are matched by identity, not by the same "[object Object]" string', async () => {
        const { select } = await edit('team', { team: { id: 3 } }); // not one of the options
        expect(select!.value).toBe(''); // the string form of every object is equal, so it would otherwise select "Red"
    });

    it('an exact option wins over one that only has the same string form', async () => {
        for (const [cell, label] of [[1, 'Number'], ['1', 'Text']] as const) {
            const { select } = await edit('code', { code: cell });
            expect(select!.options[select!.selectedIndex].text, String(typeof cell)).toBe(label);
        }
    });
});
