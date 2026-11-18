// The inline editors driven the way a user drives them: real keystrokes, real focus and blur. jsdom cannot produce a
// half-typed number (a number input reports validity.badInput only for text the user typed), so this is browser-only.
import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

interface Row { id: number; qty: number | null; tier: number }

const columns: ColumnDef<Row>[] = [
    {
        accessorKey: 'qty', header: 'Qty', editable: true, editType: 'number',
        editValidator: (value) => value !== 0 || 'Zero is not allowed',
        valueSetter: (row, value) => ({ ...row, qty: value as number | null }),
    },
    {
        accessorKey: 'tier', header: 'Tier', editable: true, editType: 'select',
        editOptions: [{ label: 'Basic', value: 1 }, { label: 'Premium', value: 2 }],
        editValidator: (value) => value !== 2 || 'Premium is full',
        valueSetter: (row, value) => ({ ...row, tier: value as number }),
    },
];

@Component({
    standalone: true,
    imports: [DataTableComponent],
    template: `<ui-data-table [data]="data" [columns]="columns" [enableEditHistory]="true" [paginationState]="{ pageIndex: 0, pageSize: 100 }" />`,
})
class Host {
    readonly table = viewChild.required(DataTableComponent<Row>);
    readonly columns = columns;
    readonly data: Row[] = [{ id: 1, qty: 5, tier: 1 }];
}

async function openEditor(columnKey: 'qty' | 'tier') {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const table = fixture.componentInstance.table();
    const edits: unknown[] = [];
    const errors: string[] = [];
    table.cellEdit.subscribe((event) => edits.push(event.newValue));
    table.editError.subscribe((event) => errors.push(event.message));
    table.startEditing(0, columnKey);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const settle = async () => {
        fixture.detectChanges();
        await fixture.whenStable();
    };
    const message = () => root.querySelector('[data-slot="cell-edit-error"]')?.textContent?.trim() ?? null;
    return { table, edits, errors, root, settle, message };
}

describe('number editor, driven by real keystrokes', () => {
    it.each([
        ['after clearing the field', async (input: HTMLInputElement) => { await userEvent.clear(input); await userEvent.keyboard('-'); }],
        ['after selecting the digits', async (input: HTMLInputElement) => { input.select(); await userEvent.keyboard('-'); }],
        ['after a valid number was typed first', async (input: HTMLInputElement, settle: () => Promise<void>) => {
            await userEvent.clear(input);
            await userEvent.keyboard('12');
            await settle(); // the editor re-renders the valid text; a keystroke racing that render would be overwritten
            await userEvent.keyboard('e');
        }],
    ])('a field that holds a half-typed number refuses to commit, whichever way it got there: %s', async (...[, type]: [string, (input: HTMLInputElement, settle: () => Promise<void>) => Promise<void>]) => {
        const { table, edits, root, settle, message } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await type(input, settle);
        expect(input.validity.badInput, 'the field really holds half-typed text').toBe(true);

        input.blur();
        await settle();

        expect(edits).toEqual([]);
        expect(table.data()[0].qty).toBe(5);
        expect(message()).toBe('Enter a valid number');
        expect(table.editingCell(), 'the editor stays open so the text can be fixed').not.toBeNull();
    });

    it('commits the corrected number after a refused half-typed one', async () => {
        const { table, edits, root, settle, message } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await userEvent.clear(input);
        await userEvent.keyboard('12');
        await settle();
        await userEvent.keyboard('e{Enter}');
        await settle();
        expect(message()).toBe('Enter a valid number');

        await userEvent.keyboard('{Backspace}{Enter}');
        await settle();

        expect(edits).toEqual([12]);
        expect(table.data()[0].qty).toBe(12);
        expect(message()).toBeNull();
    });

    it.each([
        ['a half-typed number', '-', 'Enter a valid number'],
        ['a value the validator rejects', '0', 'Zero is not allowed'],
    ])('Tab does not move on from %s: the editor, its text and its message stay', async (...[, typed, expectedMessage]: [string, string, string]) => {
        const { table, edits, root, settle, message } = await openEditor('qty');
        table.focusedCell.set({ rowIndex: 0, columnKey: 'qty' }); // what clicking the cell does; Tab moves on from the focused cell
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await userEvent.clear(input);
        await userEvent.keyboard(typed);
        await settle();

        await userEvent.keyboard('{Tab}');
        await settle();

        expect(edits).toEqual([]);
        expect(table.editingCell()?.columnKey, 'still editing the same cell, not the next one').toBe('qty');
        expect(message()).toBe(expectedMessage);
        expect(root.querySelector('input[data-edit-input]')).toBe(input);
    });

    it.each([['-5', -5], ['-0.5', -0.5], ['1.25', 1.25]])('commits %s typed key by key through its half-typed states, on Enter', async (typed, expected) => {
        const { table, edits, root, settle } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await userEvent.clear(input);
        await userEvent.keyboard(`${typed}{Enter}`);
        await settle();

        expect(edits).toEqual([expected]);
        expect(table.data()[0].qty).toBe(expected);
    });

    it('drops the validation message once the text is no longer the value it described', async () => {
        const { root, errors, settle, message } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await userEvent.clear(input);
        await userEvent.keyboard('0{Enter}');
        await settle();
        expect(errors).toEqual(['Zero is not allowed']);
        expect(message()).toBe('Zero is not allowed');

        await userEvent.keyboard('-'); // '0-': half-typed straight from a rejected value, with no valid keystroke in between
        expect(input.validity.badInput).toBe(true);
        await settle();
        expect(message()).toBeNull();
    });

    it('undoes a committed number back to the number it was', async () => {
        const { table, root, settle } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await userEvent.clear(input);
        await userEvent.keyboard('12{Enter}');
        await settle();
        expect(table.data()[0].qty).toBe(12);

        table.undoEdit();
        await settle();
        expect(table.data()[0].qty).toBe(5);
    });
});

describe('select editor, driven by a real choice', () => {
    it('keeps the editor open on a rejected option, shows the reason and shows the option that was picked', async () => {
        const { table, edits, errors, root, settle } = await openEditor('tier');
        const select = root.querySelector<HTMLSelectElement>('select[data-edit-input]')!;

        await userEvent.selectOptions(select, 'Premium');
        await settle();

        expect(edits).toEqual([]);
        expect(errors).toEqual(['Premium is full']);
        expect(table.editingCell()).not.toBeNull();
        expect(select.selectedOptions[0].textContent?.trim()).toBe('Premium');
        expect(select.getAttribute('aria-invalid')).toBe('true');
        expect(table.data()[0].tier).toBe(1);
    });
});
