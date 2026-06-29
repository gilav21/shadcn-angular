import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DataTableContextMenuDirective, type RowActionsFn } from './context-menu.directive';
import {
  DataTableAddonHost,
  AddonSlotRegistry,
  type CellActionSlot,
  type HeaderActionSlot,
  type ColumnPin,
  type ColumnDef,
  type RowActionContext,
  type SortDirection,
} from '../..';
import type { ContextMenuItem } from '../../../context-menu';
import type { DataTableLocale } from '../../data-table.locales';

interface Row {
  id: string;
  name: string;
}

/** Minimal in-memory host that records mutating calls for assertions. */
class FakeHost<T> extends DataTableAddonHost<T> {
  private readonly cell = new AddonSlotRegistry<CellActionSlot<T>>();
  private readonly header = new AddonSlotRegistry<HeaderActionSlot<T>>();
  columns: ColumnDef<T>[] = [];
  rows: T[] = [];
  sort: Record<string, SortDirection> = {};
  pins: Record<string, ColumnPin> = {};
  readonly sortCalls: [string, SortDirection][] = [];
  readonly pinCalls: [string, ColumnPin][] = [];
  readonly visibilityCalls: [string, boolean][] = [];
  showAllCalls = 0;

  enhancedColumns(): readonly ColumnDef<T>[] {
    return this.columns;
  }
  getRenderedRowAt(index: number): T | undefined {
    return this.rows[index];
  }
  getRowContext(row: T, index: number): RowActionContext<T> {
    return { row, index, selected: false };
  }
  getSortDirection(columnKey: string | keyof T): SortDirection {
    return this.sort[String(columnKey)] ?? null;
  }
  onSortChange(columnKey: string | keyof T, direction: SortDirection): void {
    this.sortCalls.push([String(columnKey), direction]);
  }
  pinColumn(columnKey: string, pin: ColumnPin): void {
    this.pinCalls.push([columnKey, pin]);
  }
  getColumnPin(columnKey: string): ColumnPin {
    return this.pins[columnKey];
  }
  setColumnVisibility(columnKey: string | keyof T, visible: boolean): void {
    this.visibilityCalls.push([String(columnKey), visible]);
  }
  showAllColumns(): void {
    this.showAllCalls += 1;
  }
  getLocale(): DataTableLocale {
    return {} as DataTableLocale;
  }
  registerCellAction(slot: CellActionSlot<T>): () => void {
    return this.cell.register(slot);
  }
  registerHeaderAction(slot: HeaderActionSlot<T>): () => void {
    return this.header.register(slot);
  }
  cellActionSlots(): readonly CellActionSlot<T>[] {
    return this.cell.slots();
  }
  headerActionSlots(): readonly HeaderActionSlot<T>[] {
    return this.header.slots();
  }
}

const SORTABLE: ColumnDef<Row> = { accessorKey: 'name', header: 'Name', enableSorting: true };

@Component({
  selector: 'ui-test-cm-host',
  standalone: true,
  imports: [DataTableContextMenuDirective],
  template: `<div uiDtContextMenu [rowActions]="actions()" [enableColumnMenu]="colMenu()"></div>`,
})
class TestHostComponent {
  readonly actions = signal<RowActionsFn<Row> | undefined>(undefined);
  readonly colMenu = signal(false);
}

function setup(host: FakeHost<Row>): {
  fixture: ComponentFixture<TestHostComponent>;
  comp: TestHostComponent;
  directive: DataTableContextMenuDirective<Row>;
} {
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: [{ provide: DataTableAddonHost, useValue: host }],
  });
  const fixture = TestBed.createComponent(TestHostComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  const directive = fixture.debugElement
    .query(By.directive(DataTableContextMenuDirective))
    .injector.get<DataTableContextMenuDirective<Row>>(DataTableContextMenuDirective);
  return { fixture, comp, directive };
}

describe('DataTableContextMenuDirective', () => {
  let host: FakeHost<Row>;

  beforeEach(() => {
    host = new FakeHost<Row>();
    host.columns = [SORTABLE];
    host.rows = [{ id: '1', name: 'Alice' }];
  });

  it('registers a cell-action slot when rowActions is provided', () => {
    const { comp, fixture } = setup(host);
    expect(host.cellActionSlots()).toHaveLength(0);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    expect(host.cellActionSlots()).toHaveLength(1);
  });

  it('removes the cell-action slot when rowActions is cleared', () => {
    const { comp, fixture } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    expect(host.cellActionSlots()).toHaveLength(1);
    comp.actions.set(undefined);
    fixture.detectChanges();
    expect(host.cellActionSlots()).toHaveLength(0);
  });

  it('registers a header-action slot only when enableColumnMenu is true', () => {
    const { comp, fixture } = setup(host);
    expect(host.headerActionSlots()).toHaveLength(0);
    comp.colMenu.set(true);
    fixture.detectChanges();
    expect(host.headerActionSlots()).toHaveLength(1);
  });

  it('buildRowMenuItems returns the consumer rowActions items for a context', () => {
    const { comp, fixture, directive } = setup(host);
    comp.actions.set((ctx) => [{ label: `Edit ${(ctx.row as Row).name}` }]);
    fixture.detectChanges();
    const items = directive.buildRowMenuItems(host.getRowContext({ id: '1', name: 'Alice' }, 0));
    expect(items).toEqual([{ label: 'Edit Alice' }]);
  });

  it('buildColumnMenuItems includes sort, pin, and visibility items', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    const labels = items.filter((i) => i.label).map((i) => i.label);
    expect(labels).toContain('Sort Ascending');
    expect(labels).toContain('Sort Descending');
    expect(labels).toContain('Pin Left');
    expect(labels).toContain('Pin Right');
    expect(labels).toContain('Hide Column');
    expect(labels).toContain('Show All Columns');
  });

  it('disables the active sort direction and wires sort clicks to the host', () => {
    host.sort = { name: 'asc' };
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    const asc = items.find((i) => i.label === 'Sort Ascending');
    expect(asc?.disabled).toBe(true);
    const desc = items.find((i) => i.label === 'Sort Descending') as ContextMenuItem;
    desc.click?.(desc);
    expect(host.sortCalls).toEqual([['name', 'desc']]);
  });

  it('omits sort items for a column with enableSorting:false', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems({ accessorKey: 'id', header: 'ID', enableSorting: false });
    const labels = items.map((i) => i.label);
    expect(labels).not.toContain('Sort Ascending');
  });

  it('wires pin-left and pin-right items to the host', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    (items.find((i) => i.label === 'Pin Left') as ContextMenuItem).click?.({});
    (items.find((i) => i.label === 'Pin Right') as ContextMenuItem).click?.({});
    expect(host.pinCalls).toEqual([['name', 'left'], ['name', 'right']]);
  });

  it('wires hide-column and show-all items to the host', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    (items.find((i) => i.label === 'Hide Column') as ContextMenuItem).click?.({});
    (items.find((i) => i.label === 'Show All Columns') as ContextMenuItem).click?.({});
    expect(host.visibilityCalls).toEqual([['name', false]]);
    expect(host.showAllCalls).toBe(1);
  });

  it('omits the hide item for a column with enableHiding:false', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems({ accessorKey: 'name', header: 'Name', enableHiding: false });
    expect(items.map((i) => i.label)).not.toContain('Hide Column');
  });

  it('wires the unpin item to the host when a column is pinned', () => {
    host.pins = { name: 'left' };
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    const unpin = items.find((i) => i.label === 'Unpin') as ContextMenuItem;
    unpin.click?.(unpin);
    expect(host.pinCalls).toEqual([['name', undefined]]);
  });
});
