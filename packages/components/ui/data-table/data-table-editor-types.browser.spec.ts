// The inline editors driven the way a user drives them: real keystrokes, real focus and blur. jsdom cannot produce a
// half-typed number (a number input reports validity.badInput only for text the user typed), so this is browser-only.
import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

interface Row { id: number; qty: number | null; tier: number; flag: boolean; tags: string[] }

const columns: ColumnDef<Row>[] = [
    {
        accessorKey: 'qty', header: 'Qty', editable: true, editType: 'number',
        editValidator: (value) => value !== 0 || 'Zero is not allowed',
        valueSetter: (row, value) => ({ ...row, qty: value as number | null }),
    },
    {
        accessorKey: 'flag', header: 'Flag', editable: true, editType: 'text',
        valueSetter: (row, value) => ({ ...row, flag: value === 'true' }),
    },
    {
        accessorKey: 'tags', header: 'Tags', editable: true, editType: 'text',
        valueSetter: (row, value) => ({ ...row, tags: String(value).split(',') }),
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
    readonly data: Row[] = [{ id: 1, qty: 5, tier: 1, flag: true, tags: ['a', 'b'] }];
}

async function openEditor(columnKey: 'qty' | 'tier' | 'flag' | 'tags') {
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

type Settle = () => Promise<void>;
type FieldTyper = (input: HTMLInputElement, settle: Settle) => Promise<void>;

// Real keystrokes arrive as separate events with a render in between. Under full-suite load the render can slip behind
// the next key, so the helpers below let every event render before the next one and keep each step independent of
// scheduler timing. That a render which does land late must not rewrite the typed text is its own case further down.
async function clearField(input: HTMLInputElement, settle: Settle) {
    await userEvent.clear(input);
    await settle();
}

/** Types plain printable characters one at a time; `{Enter}`-style descriptors go to `userEvent.keyboard` directly. */
async function typeKeys(keys: string, settle: Settle) {
    for (const key of keys) {
        await userEvent.keyboard(key);
        await settle();
    }
}

describe('number editor, driven by real keystrokes', () => {
    it.each([
        ['after clearing the field', async (input, settle) => { await clearField(input, settle); await typeKeys('-', settle); }],
        ['after selecting the digits', async (input, settle) => { input.select(); await typeKeys('-', settle); }],
        ['after a valid number was typed first', async (input, settle) => {
            await clearField(input, settle);
            await typeKeys('12e', settle);
        }],
    ] satisfies [string, FieldTyper][])('a field that holds a half-typed number refuses to commit, whichever way it got there: %s', async (...[, type]: [string, FieldTyper]) => {
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
        await clearField(input, settle);
        await typeKeys('12', settle);
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
        await clearField(input, settle);
        await typeKeys(typed, settle);

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
        await clearField(input, settle);
        await userEvent.keyboard(`${typed}{Enter}`); // as a typist sends it: no waiting for a render between the keys
        await settle();

        expect(edits).toEqual([expected]);
        expect(table.data()[0].qty).toBe(expected);
    });

    it.each([
        ['a typed number', '15'],
        ['a half-typed number', '-'],
    ])('shows the cell value again when startEditing re-opens the cell being edited, holding %s', async (...[, typed]: [string, string]) => {
        const { table, root, settle } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await clearField(input, settle);
        await typeKeys(typed, settle);

        table.startEditing(0, 'qty'); // the edit goes back to the cell's 5: the field has to show it
        await settle();

        expect(input.value, 'the field shows what Enter would commit').toBe('5');
        expect(input.validity.badInput, 'no half-typed text is left in the field').toBe(false);
    });

    it('shows the cell value again when startEditing re-opens a text editor, whatever type the value has', async () => {
        const { table, root, settle } = await openEditor('flag');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        expect(input.value, 'a boolean cell opens as its string form').toBe('true');
        await clearField(input, settle);
        await typeKeys('no', settle);

        table.startEditing(0, 'flag');
        await settle();

        expect(input.value).toBe('true');
    });

    it('shows the cell value when an edit is cancelled and the cell re-opened before the next render', async () => {
        const { table, root, settle } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await clearField(input, settle);
        await typeKeys('15', settle);

        table.cancelEdit(); // no render in between, so the field with the typed text is still mounted for the same cell
        table.startEditing(0, 'qty');
        await settle();

        expect(root.querySelector('input[data-edit-input]'), 'the same field stayed mounted').toBe(input);
        expect(input.value, 'the field shows what Enter would commit').toBe('5');
    });

    it('leaves the typed text alone when the field is double-clicked to select a word', async () => {
        const { table, edits, root, settle } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await clearField(input, settle);
        await typeKeys('15', settle);

        await userEvent.dblClick(input); // bubbles to the cell: it is already open, so nothing is reset
        await settle();
        await userEvent.keyboard('{Enter}');
        await settle();

        expect(edits).toEqual([15]);
        expect(table.data()[0].qty).toBe(15);
    });

    it('opens a text editor on an array cell as its items joined by commas', async () => {
        const { root } = await openEditor('tags');

        expect(root.querySelector<HTMLInputElement>('input[data-edit-input]')!.value).toBe('a,b');
    });

    it('does not pair a tap with one made before the cell was open', async () => {
        const { table, settle } = await openEditor('qty');
        const tap = () => table.onCellTouchEnd(new TouchEvent('touchend', { cancelable: true }), 0, columns[0]);
        table.cancelEdit();
        tap(); // a first tap on the closed cell
        table.startEditing(0, 'qty'); // it opens by another route (F2, say) and a tap on the open cell is ignored ...
        tap();
        table.cancelEdit(); // ... then it closes again within the double-tap window
        tap();
        await settle();

        expect(table.editingCell(), 'one tap after the tap that was ignored opens nothing').toBeNull();
    });

    it('still re-opens a select editor on a double-click, to recover after a rejected pick', async () => {
        const { root, settle, message } = await openEditor('tier');
        const select = root.querySelector<HTMLSelectElement>('select[data-edit-input]')!;
        await userEvent.selectOptions(select, 'Premium');
        await settle();
        expect(message()).toBe('Premium is full');

        await userEvent.dblClick(select);
        await settle();

        expect(message(), 'the edit is seeded from the cell again').toBeNull();
        expect(select.selectedOptions[0].textContent?.trim()).toBe('Basic');
    });

    it('leaves the typed text alone when the field is double-tapped on a touch screen', async () => {
        const { table, edits, root, settle } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await clearField(input, settle);
        await typeKeys('15', settle);

        table.onCellTouchEnd(new TouchEvent('touchend', { cancelable: true }), 0, columns[0]); // two taps on the open cell, within 300 ms
        table.onCellTouchEnd(new TouchEvent('touchend', { cancelable: true }), 0, columns[0]);
        await settle();
        await userEvent.keyboard('{Enter}');
        await settle();

        expect(edits).toEqual([15]);
    });

    it('keeps what is typed when the render of a key lands one key late, after the decimal point', async () => {
        const { table, edits, root, settle } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await clearField(input, settle);

        // The zoneless scheduler schedules each render with the global setTimeout and requestAnimationFrame, so faking
        // both holds renders back, and releasing them after "1." is what a busy main thread does: the render of "1"
        // then runs with the field showing "1." and must leave its text alone.
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
        try {
            await userEvent.keyboard('1.');
            await vi.advanceTimersByTimeAsync(50);
        } finally {
            vi.useRealTimers();
        }
        await userEvent.keyboard('25{Enter}');
        await settle();

        expect(edits).toEqual([1.25]);
        expect(table.data()[0].qty).toBe(1.25);
    });

    it('drops the validation message once the text is no longer the value it described', async () => {
        const { root, errors, settle, message } = await openEditor('qty');
        const input = root.querySelector<HTMLInputElement>('input[data-edit-input]')!;
        input.focus();
        await clearField(input, settle);
        await typeKeys('0', settle);
        await userEvent.keyboard('{Enter}');
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
        await clearField(input, settle);
        await typeKeys('12', settle);
        await userEvent.keyboard('{Enter}');
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
