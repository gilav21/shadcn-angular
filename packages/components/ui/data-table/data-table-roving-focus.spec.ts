// The focused cell holds real DOM focus (roving tabindex): assistive tech announces it, the context-menu key
// targets it, and Tab leaves the grid from it. Measured on the real document.activeElement.
import { TestBed } from '@angular/core/testing';
import { Component, viewChild } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

interface Row { id: number; name: string; city: string }

const columns: ColumnDef<Row>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'city', header: 'City' },
];

@Component({
    standalone: true,
    imports: [DataTableComponent],
    template: `<button id="before">before</button>
        <ui-data-table [data]="data" [columns]="columns" [paginationState]="{ pageIndex: 0, pageSize: 100 }" />
        <button id="after">after</button>`,
})
class Host {
    readonly table = viewChild.required(DataTableComponent<Row>);
    readonly columns = columns;
    readonly data: Row[] = Array.from({ length: 5 }, (...[, i]) => ({ id: i + 1, name: `Person ${i + 1}`, city: `City ${i + 1}` }));
}

async function mount() {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const scroller = root.querySelector<HTMLElement>('[tabindex="0"]')!;
    const press = async (key: string, target: Element = document.activeElement!) => {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        fixture.detectChanges();
        await fixture.whenStable();
    };
    const active = () => {
        const el = document.activeElement as HTMLElement;
        return { row: el.closest<HTMLElement>('[data-row-index]')?.dataset['rowIndex'], column: el.dataset['column'] };
    };
    return { root, scroller, press, active };
}

describe('data-table roving focus', () => {
    it('arrow keys move DOM focus from cell to cell, and the focused cell is the only tab stop in the grid', async () => {
        const { root, scroller, press, active } = await mount();
        scroller.focus();
        await press('ArrowDown');
        expect(active()).toEqual({ row: '0', column: 'id' });
        await press('ArrowRight');
        await press('ArrowDown');
        expect(active()).toEqual({ row: '1', column: 'name' });

        const stops = Array.from(root.querySelectorAll<HTMLElement>('[tabindex]')).filter((el) => el.tabIndex >= 0 && el.closest('ui-data-table'));
        expect(stops).toEqual([document.activeElement]);
    });

    it('clicking a cell gives it DOM focus', async () => {
        const { root, scroller, active } = await mount();
        scroller.focus();
        root.querySelector<HTMLElement>('[data-row-index="2"] [data-column="city"]')!.click();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(active()).toEqual({ row: '2', column: 'city' });
    });
});
