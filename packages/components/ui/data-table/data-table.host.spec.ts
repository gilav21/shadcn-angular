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

interface TreeRow extends Row {
  children?: TreeRow[];
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

  it('exposes columns, the rendered row order, and the locale', () => {
    host.onSortChange('name', 'desc');
    expect(host.enhancedColumns().map((c) => c.accessorKey)).toEqual(['id', 'name']);
    expect(host.getRenderedRowAt(0)).toEqual(ROWS[1]);
    expect(host.getLocale().code).toBe('en');
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

  it('exposes sorted and raw rows across the whole data set', () => {
    host.onSortChange('name', 'desc');
    expect(host.getSortedRows().map((r) => r.name)).toEqual(['Bob', 'Alice']);
    expect(host.getRawRows()).toEqual(ROWS);
  });

  it('returns the flattened tree row at a rendered index, and undefined outside tree mode', () => {
    expect(host.getRenderedTreeRowAt(0)).toBeUndefined();

    const tree = TestBed.createComponent<DataTableComponent<TreeRow>>(DataTableComponent);
    tree.componentRef.setInput('data', [{ id: '1', name: 'Parent', children: [{ id: '2', name: 'Child' }] }]);
    tree.componentRef.setInput('columns', COLUMNS);
    tree.componentRef.setInput('enableSubRows', true);
    tree.detectChanges();
    const treeHost = tree.debugElement.injector.get<DataTableAddonHost<TreeRow>>(DataTableAddonHost);

    expect(treeHost.getRenderedTreeRowAt(0)).toMatchObject({
      row: { name: 'Parent' }, depth: 0, isLeaf: false, childCount: 1, isExpanded: false,
    });
    expect(treeHost.getRenderedTreeRowAt(5)).toBeUndefined();
  });

  it('moves the grid focus to a cell', () => {
    host.focusCell(1, 'name');
    expect(fixture.componentInstance.focusedCell()).toEqual({ rowIndex: 1, columnKey: 'name' });
  });

  it('reports whether cell range selection is on', () => {
    expect(host.isCellRangeSelectionEnabled()).toBe(false);
    fixture.componentRef.setInput('enableCellRangeSelection', true);
    expect(host.isCellRangeSelectionEnabled()).toBe(true);
  });

  it('answers whether a cell is selected: inside the range, or the focused cell when there is no range', () => {
    expect(host.isCellSelected(0, 'id')).toBe(false);

    // A lone hold or tap leaves a focused cell and no range (a 1x1 range collapses when the finger lifts).
    fixture.componentInstance.focusedCell.set({ rowIndex: 1, columnKey: 'name' });
    expect(host.isCellSelected(1, 'name')).toBe(true);
    expect(host.isCellSelected(0, 'id')).toBe(false);

    fixture.componentInstance.cellRange.set({ startRow: 1, startCol: 'name', endRow: 0, endCol: 'id' });
    expect(host.isCellSelected(0, 'id')).toBe(true);
    expect(host.isCellSelected(1, 'name')).toBe(true);
    expect(host.isCellSelected(2, 'name')).toBe(false);
    expect(host.isCellSelected(1, 'missing')).toBe(false);

    // With a range, the focus alone no longer counts outside it.
    fixture.componentInstance.focusedCell.set({ rowIndex: 2, columnKey: 'name' });
    expect(host.isCellSelected(2, 'name')).toBe(false);
  });

  it('shows and clears the busy overlay label', () => {
    expect(host.busyLabel()).toBeNull();
    host.setBusy('Exporting…');
    expect(host.busyLabel()).toBe('Exporting…');
    host.setBusy(null);
    expect(host.busyLabel()).toBeNull();
  });
});
