// The scroller also holds the floating-filter row and the open cell editor, so its keydown handler sees keys typed
// into text controls. Those keys belong to the control: caret movement, Enter, Ctrl+Z/C/V must reach the browser.
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
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
    template: `<ui-data-table [data]="data()" [columns]="columns" [enableFloatingFilters]="true" [enableEditHistory]="true" [enableRowSelection]="true" [paginationState]="{ pageIndex: 0, pageSize: 100 }" />`,
})
class Host {
    readonly table = viewChild.required(DataTableComponent<Row>);
    readonly columns = columns;
    readonly data = signal<Row[]>([{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }]);
}

const KEYS: Array<{ key: string; ctrlKey?: boolean }> = [
    { key: 'ArrowLeft' }, { key: 'Home' }, { key: 'Enter' }, { key: 'F2' },
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
    const pressedKeysPrevented = (input: Element, keys = KEYS) =>
        keys.filter((init) => {
            const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
            input.dispatchEvent(event);
            return event.defaultPrevented;
        }).map((init) => init.key);
    return { fixture, root, table, pressedKeysPrevented };
}

describe('data-table keydown scope', () => {
    afterEach(() => vi.restoreAllMocks());

    it('keys typed into a floating-filter input are left to the input', async () => {
        const { root, table, pressedKeysPrevented } = await mount();
        // With row selection on, the header's select-all checkbox is also an input outside the data rows.
        const filter = Array.from(root.querySelectorAll('input')).find((el) => el.type === 'text' && !el.closest('[data-row-index]'))!;
        expect(filter).toBeDefined();
        expect(pressedKeysPrevented(filter)).toEqual([]);
        expect(table.editingCell()).toBeNull();
    });

    it('keys typed into the open cell editor are left to the editor', async () => {
        const { fixture, root, table, pressedKeysPrevented } = await mount();
        table.startEditing(0, 'name');
        fixture.detectChanges();
        await fixture.whenStable();
        const editor = root.querySelector<HTMLInputElement>('[data-row-index] input[data-edit-input]')!;
        // Enter is the editor's own commit and would detach the input mid-sequence, so it is not in the list.
        expect(pressedKeysPrevented(editor, KEYS.filter((init) => init.key !== 'Enter'))).toEqual([]);
    });

    it('the grid handles Enter from a cell, and does not let it reach an ancestor handler', async () => {
        const { root, table } = await mount();
        let reachedAncestor = false;
        root.addEventListener('keydown', () => (reachedAncestor = true));
        const cell = root.querySelector('[data-row-index="0"] [data-column="name"]')!;
        cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(table.editingCell()).toEqual({ rowIndex: 0, columnKey: 'name' });
        expect(reachedAncestor).toBe(false);
    });

    it('a button in a header or in a cell keeps its navigation and activation keys', async () => {
        const { root, table, pressedKeysPrevented } = await mount();
        const headerButton = root.querySelector('[data-slot="table-header"] button')!;
        const cellButton = document.createElement('button');
        root.querySelector('[data-row-index="0"] [data-column="name"]')!.append(cellButton);
        const keys = [{ key: 'ArrowLeft' }, { key: 'ArrowDown' }, { key: 'Home' }, { key: 'Enter' }, { key: 'F2' }];
        expect(pressedKeysPrevented(headerButton, keys)).toEqual([]);
        expect(pressedKeysPrevented(cellButton, keys)).toEqual([]);
        expect(table.editingCell()).toBeNull();
    });

    it('Enter on a cell that cannot be edited is not swallowed', async () => {
        const { root, table } = await mount();
        let reachedAncestor = false;
        root.addEventListener('keydown', () => (reachedAncestor = true));
        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        root.querySelector('[data-row-index="0"] [data-column="id"]')!.dispatchEvent(event);
        expect(table.editingCell()).toBeNull();
        expect(reachedAncestor).toBe(true);
        expect(event.defaultPrevented).toBe(false);
    });

    it('a grid nested in a cell is not this grid', async () => {
        const { root, table, pressedKeysPrevented } = await mount();
        const inner = document.createElement('div');
        inner.dataset['slot'] = 'table';
        const innerCell = document.createElement('div');
        innerCell.dataset['column'] = 'name';
        inner.append(innerCell);
        root.querySelector('[data-row-index="0"] [data-column="name"]')!.append(inner);
        expect(pressedKeysPrevented(innerCell, KEYS.filter((init) => !init.ctrlKey))).toEqual([]);
        expect(table.editingCell()).toBeNull();
    });

    it('a key something below the grid already handled is not handled again', async () => {
        const { root, table } = await mount();
        const cell = root.querySelector('[data-row-index="0"] [data-column="id"]')!;
        cell.addEventListener('keydown', (event) => event.preventDefault()); // what a nested grid or a control does
        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        expect(table.focusedCell()).toEqual({ rowIndex: 0, columnKey: 'id' });
    });

    it('from the row checkbox, which keeps focus after a click, ArrowDown still enters the grid but its own Enter and Tab stay with it', async () => {
        const { root, table } = await mount();
        const checkbox = root.querySelector('[data-row-index="0"] [data-column="_selection"] input[type="checkbox"]')!;
        const press = (key: string) => {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            checkbox.dispatchEvent(event);
            return event.defaultPrevented;
        };
        table.focusedCell.set(null); // a click on the checkbox bubbles to the scroller, which clears it
        expect(press('ArrowDown')).toBe(true);
        expect(table.focusedCell()).toEqual({ rowIndex: 0, columnKey: 'id' });

        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' }); // mid-grid, where a leaked Tab would move on
        expect(press('Tab')).toBe(false);
        table.focusedCell.set({ rowIndex: 1, columnKey: 'name' }); // editable, so a leaked Enter would open its editor
        expect(press('Enter')).toBe(false);
        expect(table.editingCell()).toBeNull();
    });

    it('a text input hosted in the selection cell keeps its caret keys', async () => {
        const { root, table, pressedKeysPrevented } = await mount();
        const input = document.createElement('input');
        root.querySelector('[data-row-index="0"] [data-column="_selection"]')!.append(input);
        expect(pressedKeysPrevented(input)).toEqual([]);
        expect(table.editingCell()).toBeNull();
    });

    it('Space on a cell does not leak to an ancestor', async () => {
        const { root } = await mount();
        let reachedAncestor = false;
        root.addEventListener('keydown', () => (reachedAncestor = true));
        root.querySelector('[data-row-index="0"] [data-column="name"]')!
            .dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        expect(reachedAncestor).toBe(false);
    });

    it('copying the selected rows works from any control that does not edit text, such as the checkboxes a click leaves focus on', async () => {
        const { root, table } = await mount();
        const written: string[] = [];
        vi.spyOn(navigator.clipboard, 'writeText').mockImplementation((text: string) => {
            written.push(text);
            return Promise.resolve();
        });
        table.focusedCell.set(null);
        table.rowSelection.set({ '1': true });
        const actionButton = document.createElement('button');
        root.querySelector('[data-row-index="0"] [data-column="name"]')!.append(actionButton);
        const holders = [
            root.querySelector('[data-row-index="0"] [data-column="_selection"] input[type="checkbox"]')!,
            root.querySelector('[data-slot="table-header"] input[type="checkbox"]')!,
            actionButton,
        ];
        for (const holder of holders) {
            written.length = 0;
            holder.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }));
            expect(written.join(''), holder.outerHTML.slice(0, 40)).toContain('Ann');
        }
    });

    it('a table in consumer content ahead of the grid does not take over ownership', async () => {
        const { root, table } = await mount();
        const scroller = root.querySelector('[data-row-index]')!.closest('[tabindex]')!;
        const foreign = document.createElement('div');
        foreign.dataset['slot'] = 'table';
        scroller.prepend(foreign);
        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
        root.querySelector('[data-row-index="0"] [data-column="id"]')!.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(table.focusedCell()).toEqual({ rowIndex: 1, columnKey: 'id' });
    });
});
