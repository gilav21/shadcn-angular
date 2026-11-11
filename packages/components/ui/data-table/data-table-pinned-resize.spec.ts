// Resize direction of a right-pinned column, measured on real layout. The pin setting alone cannot decide it:
// stuck to the viewport edge the column grows toward the start, but at its natural position (the table does not
// overflow) it grows toward the end.
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

interface Row { id: number; a: string; b: string; c: string }

@Component({
    standalone: true,
    imports: [DataTableComponent],
    template: `<div style="width:600px"><ui-data-table [data]="data" [columns]="columns()" [enableColumnResize]="true" [paginationState]="{ pageIndex: 0, pageSize: 100 }" /></div>`,
})
class Host {
    readonly table = viewChild.required(DataTableComponent<Row>);
    readonly data: Row[] = [{ id: 1, a: 'x', b: 'y', c: 'z' }];
    readonly columns = signal<ColumnDef<Row>[]>([]);
}

const columns = (middleWidth: string): ColumnDef<Row>[] => [
    { accessorKey: 'id', header: 'ID', width: '100px' },
    { accessorKey: 'a', header: 'A', width: middleWidth },
    { accessorKey: 'b', header: 'B', width: '100px' },
    { accessorKey: 'c', header: 'C', width: '150px', pin: 'right' },
];

async function dragPinnedColumn(middleWidth: string, dragBy: number) {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.columns.set(columns(middleWidth));
    fixture.detectChanges();
    await fixture.whenStable();
    const edges = () => {
        const rect = fixture.nativeElement.querySelector('[data-column-id="c"]').getBoundingClientRect();
        return { left: Math.round(rect.left), right: Math.round(rect.right) };
    };
    const before = edges();
    const col = fixture.componentInstance.table().enhancedColumns().find((c) => c.accessorKey === 'c')!;
    fixture.componentInstance.table().onResizeStart(new MouseEvent('mousedown', { clientX: 300 }), col);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 + dragBy }));
    document.dispatchEvent(new MouseEvent('mouseup'));
    fixture.detectChanges();
    await fixture.whenStable();
    return { before, after: edges() };
}

describe('data-table pinned column resize', () => {
    it('a right-pinned column stuck to the viewport edge widens when dragged toward the start', async () => {
        const { before, after } = await dragPinnedColumn('600px', -60);
        expect(after.right).toBe(before.right);
        expect(after.left).toBe(before.left - 60);
    });

    it('a right-pinned column in a table that does not overflow widens when dragged toward the end', async () => {
        const { before, after } = await dragPinnedColumn('50px', +60);
        expect(after.left).toBe(before.left);
        expect(after.right).toBe(before.right + 60);
    });
});
