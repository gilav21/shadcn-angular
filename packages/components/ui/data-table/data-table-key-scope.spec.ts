// The scroller also holds the floating-filter row and the open cell editor, so its keydown handler sees keys typed
// into text controls. Those keys belong to the control: caret movement, Enter, Ctrl+Z/C/V must reach the browser.
// Every other control keeps the behaviour the grid had before: shortcuts and arrows still work from it.
import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

interface Row { id: number; name: string }

const columns: ColumnDef<Row>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name', editable: true, enableFiltering: true, valueSetter: (row, value) => ({ ...row, name: String(value) }) },
];

@Component({
    standalone: true,
    imports: [DataTableComponent],
    template: `<ui-data-table [data]="data" [columns]="columns" [enableFloatingFilters]="true" [enableEditHistory]="true" [enableRowSelection]="true"
        [paginationState]="{ pageIndex: 0, pageSize: 100 }" />`,
})
class Host {
    readonly table = viewChild.required(DataTableComponent<Row>);
    readonly columns = columns;
    readonly data: Row[] = [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }];
}

const KEYS: Array<{ key: string; ctrlKey?: boolean }> = [
    { key: 'ArrowLeft' }, { key: 'Home' }, { key: 'Enter' }, { key: 'F2' }, { key: 'Escape' },
    { key: 'z', ctrlKey: true }, { key: 'y', ctrlKey: true }, { key: 'c', ctrlKey: true }, { key: 'v', ctrlKey: true },
];

async function mount() {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const table = fixture.componentInstance.table();
    table.focusedCell.set({ rowIndex: 0, columnKey: 'name' });
    const press = (target: Element, init: { key: string; ctrlKey?: boolean }) => {
        const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        return event;
    };
    const pressedKeysPrevented = (target: Element, keys = KEYS) =>
        keys.filter((init) => press(target, init).defaultPrevented).map((init) => init.key);
    const cell = (row: number, column: string) => root.querySelector(`[data-row-index="${row}"] [data-column="${column}"]`)!;
    return { fixture, root, table, press, pressedKeysPrevented, cell };
}

describe('data-table keydown scope', () => {
    afterEach(() => vi.restoreAllMocks());

    it('keys typed into a floating-filter input or a select are left to the control', async () => {
        const { root, table, cell, pressedKeysPrevented } = await mount();
        // With row selection on, the header's select-all checkbox is also an input outside the data rows.
        const scroller = root.querySelector('[data-row-index]')!.closest('[tabindex]')!;
        const filter = Array.from(scroller.querySelectorAll('input')).find((el) => el.type === 'text' && !el.closest('[data-row-index]'))!;
        expect(filter).toBeDefined(); // inside the scroller, so its keys really do reach the grid handler
        const targets = [filter, document.createElement('select'), document.createElement('div'), document.createElement('div')];
        targets[2].setAttribute('role', 'textbox');
        targets[3].contentEditable = 'true';
        cell(0, 'id').append(...targets.slice(1));
        for (const target of targets) expect(pressedKeysPrevented(target), target.outerHTML.slice(0, 40)).toEqual([]);
        expect(table.editingCell()).toBeNull();
    });

    it('keys typed into the open cell editor are left to the editor', async () => {
        const { fixture, root, table, pressedKeysPrevented } = await mount();
        table.startEditing(0, 'name');
        fixture.detectChanges();
        await fixture.whenStable();
        const editor = root.querySelector<HTMLInputElement>('[data-row-index] input[data-edit-input]')!;
        // Enter commits and Escape cancels: the editor's own keys, which also detach the input mid-sequence.
        expect(pressedKeysPrevented(editor, KEYS.filter((init) => init.key !== 'Enter' && init.key !== 'Escape'))).toEqual([]);
    });

    it('a grid embedded in a textbox of the host page still handles its keys', async () => {
        const { root, table, cell, press } = await mount();
        const wrapper = document.createElement('div');
        wrapper.setAttribute('role', 'textbox');
        document.body.append(wrapper);
        wrapper.append(root);
        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        press(cell(0, 'id'), { key: 'ArrowDown' });
        expect(table.focusedCell()).toEqual({ rowIndex: 1, columnKey: 'id' });
        wrapper.remove();
    });

    it('a key something below the grid already handled is not handled again', async () => {
        const { table, cell, press } = await mount();
        cell(0, 'id').addEventListener('keydown', (event) => event.preventDefault()); // what a nested grid or a control does
        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        press(cell(0, 'id'), { key: 'ArrowDown' });
        expect(table.focusedCell()).toEqual({ rowIndex: 0, columnKey: 'id' });
    });

    it('Enter from a cell opens the editor and stops there; from a cell that cannot be edited it is left alone', async () => {
        const { root, table, cell, press } = await mount();
        let reachedAncestor = false;
        root.addEventListener('keydown', () => {
            reachedAncestor = true;
        });
        press(cell(0, 'name'), { key: 'Enter' });
        expect(table.editingCell()).toEqual({ rowIndex: 0, columnKey: 'name' });
        expect(reachedAncestor).toBe(false);

        table.cancelEdit();
        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        const event = press(cell(0, 'id'), { key: 'Enter' });
        expect(table.editingCell()).toBeNull();
        expect(reachedAncestor).toBe(true);
        expect(event.defaultPrevented).toBe(false);
    });

    it('Enter and F2 from a header or cell button do not open the editor', async () => {
        const { root, table, cell, press } = await mount();
        const headerButton = root.querySelector('[data-slot="table-header"] button')!;
        const cellButton = document.createElement('button');
        cell(0, 'name').append(cellButton);
        for (const target of [headerButton, cellButton]) {
            press(target, { key: 'Enter' });
            press(target, { key: 'F2' });
        }
        expect(table.editingCell()).toBeNull();
    });

    it('a key from a control inside a cell does not move the focused cell, and Space stops at the cell', async () => {
        const { root, table, cell, press } = await mount();
        const button = document.createElement('button');
        cell(1, 'name').append(button);
        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        press(button, { key: 'Enter' });
        expect(table.focusedCell()).toEqual({ rowIndex: 0, columnKey: 'id' });

        let reachedAncestor = false;
        root.addEventListener('keydown', () => {
            reachedAncestor = true;
        });
        press(cell(0, 'name'), { key: ' ' });
        expect(reachedAncestor).toBe(false);
    });

    it('copying the selected rows works from the checkboxes and buttons a click leaves focus on', async () => {
        const { root, table, cell, press } = await mount();
        const written: string[] = [];
        vi.spyOn(navigator.clipboard, 'writeText').mockImplementation((text: string) => {
            written.push(text);
            return Promise.resolve();
        });
        table.focusedCell.set(null);
        table.rowSelection.set({ '1': true });
        const actionButton = document.createElement('button');
        cell(0, 'name').append(actionButton);
        const holders = [
            root.querySelector('[data-row-index="0"] [data-column="_selection"] input[type="checkbox"]')!,
            root.querySelector('[data-slot="table-header"] input[type="checkbox"]')!,
            actionButton,
        ];
        for (const holder of holders) {
            written.length = 0;
            press(holder, { key: 'c', ctrlKey: true });
            expect(written.join(''), holder.outerHTML.slice(0, 40)).toContain('Ann');
        }
    });

    it('arrows still enter the grid from a header control, and Escape still clears the cell range from it', async () => {
        const { root, table, press } = await mount();
        const headerButton = root.querySelector('[data-slot="table-header"] button')!;
        table.focusedCell.set(null);
        expect(press(headerButton, { key: 'ArrowDown' }).defaultPrevented).toBe(true);
        expect(table.focusedCell()).toEqual({ rowIndex: 0, columnKey: 'id' });

        table.cellRange.set({ startRow: 0, startCol: 'id', endRow: 1, endCol: 'name' });
        press(headerButton, { key: 'Escape' });
        expect(table.cellRange()).toBeNull();
    });
});
