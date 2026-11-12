// The scroller also holds the floating-filter row and the open cell editor, so its keydown handler sees keys typed
// into text controls. Those keys belong to the control: caret movement, Enter, Ctrl+Z/C/V must reach the browser.
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { describe, it, expect } from 'vitest';
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
    const pressedKeysPrevented = (input: Element) =>
        KEYS.filter((init) => {
            const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
            input.dispatchEvent(event);
            return event.defaultPrevented;
        }).map((init) => init.key);
    return { fixture, root, table, pressedKeysPrevented };
}

describe('data-table keydown scope', () => {
    it('keys typed into a floating-filter input are left to the input', async () => {
        const { root, table, pressedKeysPrevented } = await mount();
        const filter = Array.from(root.querySelectorAll('input')).find((el) => !el.closest('[data-row-index]'))!;
        expect(pressedKeysPrevented(filter)).toEqual([]);
        expect(table.editingCell()).toBeNull();
    });

    it('keys typed into the open cell editor are left to the editor', async () => {
        const { fixture, root, table, pressedKeysPrevented } = await mount();
        table.startEditing(0, 'name');
        fixture.detectChanges();
        await fixture.whenStable();
        const editor = root.querySelector<HTMLInputElement>('[data-row-index] input[data-edit-input]')!;
        expect(pressedKeysPrevented(editor).filter((key) => key !== 'Enter')).toEqual([]);
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

    it('a control inside a cell keeps its own keys', async () => {
        const { root, table, pressedKeysPrevented } = await mount();
        const button = document.createElement('button');
        root.querySelector('[data-row-index="0"] [data-column="name"]')!.append(button);
        expect(pressedKeysPrevented(button)).toEqual([]);
        expect(table.editingCell()).toBeNull();
    });

    it('keys from a header control are not grid keys', async () => {
        const { root, pressedKeysPrevented } = await mount();
        const headerButton = root.querySelector('[data-slot="table-header"] button');
        expect(headerButton).not.toBeNull();
        expect(pressedKeysPrevented(headerButton!)).toEqual([]);
    });

    it('Enter on a cell that cannot be edited is not swallowed', async () => {
        const { root, table } = await mount();
        let reachedAncestor = false;
        root.addEventListener('keydown', () => (reachedAncestor = true));
        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        root.querySelector('[data-row-index="0"] [data-column="id"]')!
            .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(table.editingCell()).toBeNull();
        expect(reachedAncestor).toBe(true);
    });

    it('a grid nested in a cell is not this grid', async () => {
        const { root, table, pressedKeysPrevented } = await mount();
        const inner = document.createElement('div');
        inner.dataset['slot'] = 'table';
        const innerCell = document.createElement('div');
        innerCell.dataset['column'] = 'name';
        inner.append(innerCell);
        root.querySelector('[data-row-index="0"] [data-column="name"]')!.append(inner);
        expect(pressedKeysPrevented(innerCell)).toEqual([]);
        expect(table.editingCell()).toBeNull();
    });

    it('arrow keys still move from the row checkbox, but its Enter is not a grid key', async () => {
        const { root, table } = await mount();
        const checkbox = root.querySelector('[data-row-index="0"] [data-column="_selection"] button, [data-row-index="0"] [data-column="_selection"] input')!;
        const press = (key: string) => {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            checkbox.dispatchEvent(event);
            return event.defaultPrevented;
        };
        table.focusedCell.set({ rowIndex: 0, columnKey: 'id' });
        expect(press('ArrowDown')).toBe(true);
        expect(table.focusedCell()).toEqual({ rowIndex: 1, columnKey: 'id' });
        expect(press('Enter')).toBe(false);
    });
});
