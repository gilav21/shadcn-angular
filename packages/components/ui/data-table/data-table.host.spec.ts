import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddonSlotRegistry, DataTableAddonHost } from './data-table.host';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

let originalResizeObserver: typeof ResizeObserver | undefined;

beforeEach(() => {
  originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  if (originalResizeObserver) {
    globalThis.ResizeObserver = originalResizeObserver;
  } else {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  }
});

interface Slot {
  readonly id: string;
}

interface Row {
  id: string;
  name: string;
}

const ROWS: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

const COLUMNS: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name', enableSorting: true },
];

describe('AddonSlotRegistry', () => {
  it('starts empty', () => {
    const registry = new AddonSlotRegistry<Slot>();
    expect(registry.slots()).toEqual([]);
  });

  it('lists a registered slot', () => {
    const registry = new AddonSlotRegistry<Slot>();
    const slot: Slot = { id: 'a' };
    registry.register(slot);
    expect(registry.slots()).toEqual([slot]);
  });

  it('preserves registration order across multiple slots', () => {
    const registry = new AddonSlotRegistry<Slot>();
    const a: Slot = { id: 'a' };
    const b: Slot = { id: 'b' };
    registry.register(a);
    registry.register(b);
    expect(registry.slots()).toEqual([a, b]);
  });

  it('removes exactly the unregistered slot via the returned teardown', () => {
    const registry = new AddonSlotRegistry<Slot>();
    const a: Slot = { id: 'a' };
    const b: Slot = { id: 'b' };
    registry.register(a);
    const removeB = registry.register(b);
    removeB();
    expect(registry.slots()).toEqual([a]);
  });
});

describe('DataTableComponent as DataTableAddonHost', () => {
  let fixture: ComponentFixture<DataTableComponent<Row>>;
  let host: DataTableAddonHost<Row>;

  beforeEach(() => {
    fixture = TestBed.createComponent<DataTableComponent<Row>>(DataTableComponent);
    fixture.componentRef.setInput('data', ROWS);
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.detectChanges();
    host = fixture.debugElement.injector.get<DataTableAddonHost<Row>>(DataTableAddonHost);
  });

  it('provides itself as the DataTableAddonHost token', () => {
    expect(host).toBe(fixture.componentInstance);
  });

  it('reflects a registered cell-action slot and removes it on teardown', () => {
    const slot = { id: 'context-menu', onClick: () => undefined };
    expect(host.cellActionSlots()).toEqual([]);
    const remove = host.registerCellAction(slot);
    expect(host.cellActionSlots()).toEqual([slot]);
    remove();
    expect(host.cellActionSlots()).toEqual([]);
  });

  it('reflects a registered header-action slot', () => {
    const slot = { id: 'context-menu', onClick: () => undefined };
    host.registerHeaderAction(slot);
    expect(host.headerActionSlots()).toEqual([slot]);
  });

  it('exposes column pin state through getColumnPin/pinColumn', () => {
    expect(host.getColumnPin('name')).toBeUndefined();
    host.pinColumn('name', 'left');
    expect(host.getColumnPin('name')).toBe('left');
  });

  it('exposes columns, a rendered row, and the locale', () => {
    expect(host.enhancedColumns().length).toBeGreaterThan(0);
    expect(host.getRenderedRowAt(0)).toEqual(ROWS[0]);
    expect(typeof host.getLocale()).toBe('object');
  });

  it('returns undefined for an out-of-range rendered row', () => {
    expect(host.getRenderedRowAt(99)).toBeUndefined();
  });

  it('drives sort direction through onSortChange/getSortDirection', () => {
    expect(host.getSortDirection('name')).toBeNull();
    host.onSortChange('name', 'asc');
    expect(host.getSortDirection('name')).toBe('asc');
    host.onSortChange('name', null);
    expect(host.getSortDirection('name')).toBeNull();
  });

  it('reflects a registered header-action slot and removes it on teardown', () => {
    const slot = { id: 'sort-menu', onClick: () => undefined };
    const remove = host.registerHeaderAction(slot);
    expect(host.headerActionSlots()).toEqual([slot]);
    remove();
    expect(host.headerActionSlots()).toEqual([]);
  });

  it('unpins a column when pinned to undefined', () => {
    host.pinColumn('name', 'left');
    expect(host.getColumnPin('name')).toBe('left');
    host.pinColumn('name', undefined);
    expect(host.getColumnPin('name')).toBeUndefined();
  });

  it('toggles column visibility and restores every column via showAllColumns', () => {
    host.setColumnVisibility('name', false);
    expect(host.enhancedColumns().some((c) => String(c.accessorKey) === 'name')).toBe(false);
    host.showAllColumns();
    expect(host.enhancedColumns().some((c) => String(c.accessorKey) === 'name')).toBe(true);
  });

  it('builds a row-action context for a rendered row', () => {
    const context = host.getRowContext(ROWS[0], 0);
    expect(context).toMatchObject({ row: ROWS[0], index: 0, selected: false });
  });

  it('resolves a cell value via getCellValue', () => {
    expect(host.getCellValue(ROWS[0], 'name')).toBe('Alice');
  });

  it('shapes export data as a header row plus cell rows', () => {
    const grid = host.getExportData();
    expect(grid[0]).toEqual(['ID', 'Name']);
    expect(grid).toHaveLength(ROWS.length + 1);
  });

  it('exposes sorted and raw rows across the whole data set', () => {
    expect(host.getSortedRows()).toHaveLength(ROWS.length);
    expect(host.getRawRows()).toEqual(ROWS);
  });

  it('reports the active filter + sort query state', () => {
    host.onSortChange('name', 'desc');
    const query = host.queryState();
    expect(query.globalFilter).toBe('');
    expect(query.sort).toMatchObject({ column: 'name', direction: 'desc' });
  });

  it('shows and clears the busy overlay label', () => {
    expect(host.busyLabel()).toBeNull();
    host.setBusy('Exporting…');
    expect(host.busyLabel()).toBe('Exporting…');
    host.setBusy(null);
    expect(host.busyLabel()).toBeNull();
  });
});
