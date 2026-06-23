import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, it, expect } from 'vitest';
import { DataTableComponent } from './data-table.component';
import { ColumnDef, ColumnResizeEvent } from './data-table.types';

interface Row {
  id: string;
  name: string;
  note: string;
}

const DATA: Row[] = [
  { id: '1', name: 'Al', note: 'short' },
  { id: '2', name: 'Bo', note: 'a considerably longer note that should widen the column' },
];

const COLS: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'note', header: 'Note' },
];

describe('DataTableComponent column auto-fit (A8)', () => {
  let component: DataTableComponent<Row>;
  let fixture: ComponentFixture<DataTableComponent<Row>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(DataTableComponent<Row>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', DATA);
    fixture.componentRef.setInput('columns', COLS);
    fixture.componentRef.setInput('enableColumnResize', true);
    fixture.detectChanges();
  });

  it('auto-sizes a column to a pixel width and emits columnResize', () => {
    let event: ColumnResizeEvent | null = null;
    component.columnResize.subscribe((e) => (event = e));

    component.autoSizeColumn('note');

    const width = component.columnWidths()['note'];
    expect(width).toMatch(/^\d+px$/);
    expect(Number.parseInt(width, 10)).toBeGreaterThan(50);
    expect(event).toMatchObject({ columnKey: 'note' });
  });

  it('fits a wide column wider than a short one', () => {
    component.autoSizeColumn('name');
    component.autoSizeColumn('note');
    const name = Number.parseInt(component.columnWidths()['name'], 10);
    const note = Number.parseInt(component.columnWidths()['note'], 10);
    expect(note).toBeGreaterThan(name);
  });

  it('auto-sizes every navigable column', () => {
    component.autoSizeAllColumns();
    const widths = component.columnWidths();
    expect(widths['id']).toMatch(/px$/);
    expect(widths['name']).toMatch(/px$/);
    expect(widths['note']).toMatch(/px$/);
  });

  it('distributes the viewport width evenly across columns', () => {
    component.fitColumnsToViewport();
    const widths = component.columnWidths();
    expect(widths['id']).toEqual(widths['name']);
    expect(widths['name']).toEqual(widths['note']);
    expect(Number.parseInt(widths['id'], 10)).toBeGreaterThanOrEqual(50);
  });
});
