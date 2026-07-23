import { describe, it, expect, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  DataTableContextMenuDirective,
  type DataTableHeaderContextMenuEvent,
} from './data-table-context-menu.directive';
import type { TableRowContextMenuEvent } from './table-context-menu.directive';
import { ContextMenuComponent } from './context-menu';
import { DataTableComponent } from './data-table';

interface Row {
  name: string;
}

interface DataTableStub {
  focusedCell: { set: (value: unknown) => void };
  getRenderedRowAt: (index: number) => Row | undefined;
  getRenderedTreeRowAt: (index: number) => unknown;
}

function createDataTableStub(): DataTableStub {
  return {
    focusedCell: { set: vi.fn() },
    getRenderedRowAt: vi.fn((index: number) => (index === 2 ? { name: 'RowA' } : undefined)),
    getRenderedTreeRowAt: vi.fn((index: number) =>
      index === 2
        ? {
            row: { name: 'RowA' },
            depth: 1,
            isLeaf: true,
            parentId: 'p',
            parentRow: { name: 'Parent' },
            path: ['p'],
            childCount: 0,
            isExpanded: true,
          }
        : undefined,
    ),
  };
}

const HOST_TEMPLATE = `
  <ui-data-table
    [uiDataTableContextMenu]="menu"
    [contextMenuDisabled]="disabled()"
    [contextMenuRowsOnly]="rowsOnly()"
    (rowContextMenu)="onRow($event)"
    (headerContextMenu)="onHeader($event)">
    <div data-slot="table-row" data-row-index="2" data-row-id="rA">
      <span data-slot="table-cell" data-column="name">RowA cell</span>
    </div>
    <div data-slot="table-row" data-row-id="rB">
      <span data-slot="table-cell" data-column="_selection">Sel</span>
    </div>
    <div data-slot="table-row">
      <span data-slot="table-cell">No column attr</span>
    </div>
    <div data-slot="table-row" data-row-index="3" data-row-id="rD">
      <span data-slot="table-cell" data-column="qty">Qty cell</span>
    </div>
    <div data-slot="table-head" data-column-id="col1">  Column One  </div>
    <div data-slot="table-head"></div>
    <div class="not-a-row-or-header"><span>Outside</span></div>
  </ui-data-table>
`;

@Component({
  selector: 'ui-dtcm-host',
  standalone: true,
  imports: [DataTableContextMenuDirective],
  template: HOST_TEMPLATE,
})
class TestHostComponent {
  readonly disabled = signal(false);
  readonly rowsOnly = signal(true);
  readonly menu = { show: vi.fn() } as unknown as ContextMenuComponent;
  readonly rowEvents: TableRowContextMenuEvent<unknown>[] = [];
  readonly headerEvents: DataTableHeaderContextMenuEvent[] = [];

  onRow(event: TableRowContextMenuEvent<unknown>): void {
    this.rowEvents.push(event);
  }

  onHeader(event: DataTableHeaderContextMenuEvent): void {
    this.headerEvents.push(event);
  }
}

@Component({
  selector: 'ui-dtcm-null-host',
  standalone: true,
  imports: [DataTableContextMenuDirective],
  template: HOST_TEMPLATE,
})
class TestHostNullMenuComponent {
  readonly disabled = signal(false);
  readonly rowsOnly = signal(true);
  readonly menu = null as unknown as ContextMenuComponent;
  readonly rowEvents: TableRowContextMenuEvent<unknown>[] = [];
  readonly headerEvents: DataTableHeaderContextMenuEvent[] = [];

  onRow(event: TableRowContextMenuEvent<unknown>): void {
    this.rowEvents.push(event);
  }

  onHeader(event: DataTableHeaderContextMenuEvent): void {
    this.headerEvents.push(event);
  }
}

function contextMenuEventAt(target: HTMLElement, x: number, y: number): MouseEvent {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
  return event;
}

function setupWithDataTable(): {
  fixture: ComponentFixture<TestHostComponent>;
  comp: TestHostComponent;
  tableEl: HTMLElement;
  dataTable: DataTableStub;
} {
  const dataTable = createDataTableStub();
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: [{ provide: DataTableComponent, useValue: dataTable }],
  });
  const fixture = TestBed.createComponent(TestHostComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  const tableEl = fixture.debugElement.query(By.directive(DataTableContextMenuDirective))
    .nativeElement as HTMLElement;
  return { fixture, comp, tableEl, dataTable };
}

function setupWithoutDataTable(): {
  fixture: ComponentFixture<TestHostComponent>;
  comp: TestHostComponent;
  tableEl: HTMLElement;
} {
  TestBed.configureTestingModule({ imports: [TestHostComponent] });
  const fixture = TestBed.createComponent(TestHostComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  const tableEl = fixture.debugElement.query(By.directive(DataTableContextMenuDirective))
    .nativeElement as HTMLElement;
  return { fixture, comp, tableEl };
}

function setupWithNullMenu(): {
  fixture: ComponentFixture<TestHostNullMenuComponent>;
  comp: TestHostNullMenuComponent;
  tableEl: HTMLElement;
  dataTable: DataTableStub;
} {
  const dataTable = createDataTableStub();
  TestBed.configureTestingModule({
    imports: [TestHostNullMenuComponent],
    providers: [{ provide: DataTableComponent, useValue: dataTable }],
  });
  const fixture = TestBed.createComponent(TestHostNullMenuComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  const tableEl = fixture.debugElement.query(By.directive(DataTableContextMenuDirective))
    .nativeElement as HTMLElement;
  return { fixture, comp, tableEl, dataTable };
}

describe('DataTableContextMenuDirective', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits row data with tree metadata and opens the menu when the row is rendered by the data table', () => {
    const { comp, tableEl, dataTable } = setupWithDataTable();
    const rowA = tableEl.querySelector<HTMLElement>('[data-row-id="rA"]') as HTMLElement;
    const cell = rowA.querySelector('[data-column="name"]') as HTMLElement;

    contextMenuEventAt(cell, 10, 20);

    expect(comp.rowEvents).toHaveLength(1);
    const [emitted] = comp.rowEvents;
    expect(emitted.row).toEqual({ name: 'RowA' });
    expect(emitted.index).toBe(2);
    expect(emitted.depth).toBe(1);
    expect(emitted.isLeaf).toBe(true);
    expect(emitted.parentRow).toEqual({ name: 'Parent' });
    expect(dataTable.focusedCell.set).toHaveBeenCalledWith({ rowIndex: 2, columnKey: 'name' });
    expect(comp.menu.show).toHaveBeenCalledWith(
      10,
      20,
      expect.objectContaining({ row: { name: 'RowA' }, depth: 1, isLeaf: true }),
    );
  });

  it('does not focus the cell when the column key is the selection column', () => {
    const { comp, tableEl, dataTable } = setupWithDataTable();
    const rowB = tableEl.querySelector<HTMLElement>('[data-row-id="rB"]') as HTMLElement;
    const cell = rowB.querySelector('[data-column="_selection"]') as HTMLElement;

    contextMenuEventAt(cell, 1, 1);

    expect(comp.rowEvents).toHaveLength(1);
    expect(comp.rowEvents[0].row).toEqual({ id: 'rB' });
    expect(comp.rowEvents[0].depth).toBeUndefined();
    expect(comp.rowEvents[0].isLeaf).toBeUndefined();
    expect(dataTable.focusedCell.set).not.toHaveBeenCalled();
    expect(comp.menu.show).toHaveBeenCalledWith(1, 1, { id: 'rB' });
  });

  it('falls back to an empty row and index 0 when there is no data-row-index/data-row-id and no cell column', () => {
    const { comp, tableEl, dataTable } = setupWithDataTable();
    const rows = tableEl.querySelectorAll<HTMLElement>('[data-slot="table-row"]');
    const rowC = rows[2];
    const cell = rowC.querySelector('span') as HTMLElement;

    contextMenuEventAt(cell, 2, 2);

    expect(comp.rowEvents).toHaveLength(1);
    expect(comp.rowEvents[0].row).toEqual({});
    expect(comp.rowEvents[0].index).toBe(0);
    expect(dataTable.focusedCell.set).not.toHaveBeenCalled();
  });

  it('does not touch focusedCell for the expander column even when the data table is present', () => {
    const { tableEl, dataTable } = setupWithDataTable();
    const rows = tableEl.querySelectorAll<HTMLElement>('[data-slot="table-row"]');
    const expanderRow = rows[0];
    const expanderCell = document.createElement('span');
    expanderCell.dataset['slot'] = 'table-cell';
    expanderCell.dataset['column'] = '_expander';
    expanderRow.appendChild(expanderCell);

    contextMenuEventAt(expanderCell, 3, 3);

    expect(dataTable.focusedCell.set).not.toHaveBeenCalled();
  });

  it('falls back to row id data when the data table has no rendered row at that index', () => {
    const { comp, tableEl } = setupWithoutDataTable();
    const rowA = tableEl.querySelector<HTMLElement>('[data-row-id="rA"]') as HTMLElement;
    const cell = rowA.querySelector('[data-column="name"]') as HTMLElement;

    contextMenuEventAt(cell, 4, 4);

    expect(comp.rowEvents).toHaveLength(1);
    expect(comp.rowEvents[0].row).toEqual({ id: 'rA' });
    expect(comp.rowEvents[0].depth).toBeUndefined();
    expect(comp.rowEvents[0].parentRow).toBeUndefined();
    expect(comp.menu.show).toHaveBeenCalledWith(4, 4, { id: 'rA' });
  });

  it('prevents default and stops propagation for a row right-click', () => {
    const { tableEl } = setupWithDataTable();
    const rowA = tableEl.querySelector<HTMLElement>('[data-row-id="rA"]') as HTMLElement;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    rowA.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the context menu is disabled', () => {
    const { comp, tableEl, fixture } = setupWithDataTable();
    comp.disabled.set(true);
    fixture.detectChanges();
    const rowA = tableEl.querySelector<HTMLElement>('[data-row-id="rA"]') as HTMLElement;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    rowA.dispatchEvent(event);

    expect(comp.rowEvents).toHaveLength(0);
    expect(comp.menu.show).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignores header right-clicks when contextMenuRowsOnly is true (default)', () => {
    const { comp, tableEl } = setupWithDataTable();
    const header = tableEl.querySelector<HTMLElement>('[data-column-id="col1"]') as HTMLElement;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    header.dispatchEvent(event);

    expect(comp.headerEvents).toHaveLength(0);
    expect(comp.menu.show).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('emits header data with trimmed column name and opens the menu when rowsOnly is disabled', () => {
    const { comp, tableEl, fixture } = setupWithDataTable();
    comp.rowsOnly.set(false);
    fixture.detectChanges();
    const header = tableEl.querySelector<HTMLElement>('[data-column-id="col1"]') as HTMLElement;

    contextMenuEventAt(header, 30, 40);

    expect(comp.headerEvents).toHaveLength(1);
    const [emitted] = comp.headerEvents;
    expect(emitted.column).toEqual({ id: 'col1', name: 'Column One', element: header });
    expect(comp.menu.show).toHaveBeenCalledWith(30, 40, {
      id: 'col1',
      name: 'Column One',
      element: header,
    });
  });

  it('defaults column id to null and name to empty string when attributes/text are absent', () => {
    const { comp, tableEl, fixture } = setupWithDataTable();
    comp.rowsOnly.set(false);
    fixture.detectChanges();
    const headers = tableEl.querySelectorAll<HTMLElement>('[data-slot="table-head"]');
    const bareHeader = headers[1];

    contextMenuEventAt(bareHeader, 5, 6);

    expect(comp.headerEvents).toHaveLength(1);
    expect(comp.headerEvents[0].column).toEqual({ id: null, name: '', element: bareHeader });
  });

  it('does not open the menu for a header right-click when the menu input is falsy', () => {
    const { comp, tableEl, fixture } = setupWithNullMenu();
    comp.rowsOnly.set(false);
    fixture.detectChanges();
    const header = tableEl.querySelector<HTMLElement>('[data-column-id="col1"]') as HTMLElement;

    expect(() => contextMenuEventAt(header, 1, 1)).not.toThrow();
    expect(comp.headerEvents).toHaveLength(1);
  });

  it('does not open the menu for a row right-click when the menu input is falsy', () => {
    const { comp, tableEl } = setupWithNullMenu();
    const rowA = tableEl.querySelector<HTMLElement>('[data-row-id="rA"]') as HTMLElement;
    const cell = rowA.querySelector('[data-column="name"]') as HTMLElement;

    expect(() => contextMenuEventAt(cell, 1, 1)).not.toThrow();
    expect(comp.rowEvents).toHaveLength(1);
  });

  it('is a no-op when right-clicking outside any row or header even with rowsOnly disabled', () => {
    const { comp, tableEl, fixture } = setupWithDataTable();
    comp.rowsOnly.set(false);
    fixture.detectChanges();
    const outside = tableEl.querySelector<HTMLElement>('.not-a-row-or-header span') as HTMLElement;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    outside.dispatchEvent(event);

    expect(comp.rowEvents).toHaveLength(0);
    expect(comp.headerEvents).toHaveLength(0);
    expect(comp.menu.show).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('removes the contextmenu listener on destroy', () => {
    const { comp, fixture, tableEl } = setupWithDataTable();
    const rowA = tableEl.querySelector<HTMLElement>('[data-row-id="rA"]') as HTMLElement;

    fixture.destroy();
    contextMenuEventAt(rowA, 1, 2);

    expect(comp.rowEvents).toHaveLength(0);
    expect(comp.menu.show).not.toHaveBeenCalled();
  });
});
