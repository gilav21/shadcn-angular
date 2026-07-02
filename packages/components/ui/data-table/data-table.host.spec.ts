import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddonSlotRegistry, DataTableAddonHost } from './data-table.host';
import { DataTableComponent } from './data-table.component';
import type { ColumnDef } from './data-table.types';

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
    expect(host.getLocale()).toBeTypeOf('object');
  });
});
