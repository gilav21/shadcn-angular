import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextMenuComponent } from './context-menu';
import {
  TableContextMenuDirective,
  TableRowContextMenuEvent,
  TableCellContextMenuEvent,
} from './table-context-menu.directive';

interface AliceRow {
  id: number;
  name: string;
}

@Component({
  template: `
    <ui-context-menu #menu></ui-context-menu>

    <table
      [uiTableContextMenu]="menuEnabled() ? menu : null"
      [contextMenuDisabled]="disabled()"
      [rowDataAttribute]="rowAttr()"
      (rowContextMenu)="onRow($event)"
      (cellContextMenu)="onCell($event)"
    >
      <tbody>
        <tr data-testid="row-a" data-row-index="5" data-row='{"id":1,"name":"Alice"}'>
          <td data-testid="td-cellindex">NoColumnAttr</td>
          <td data-testid="td-named" data-column="name">Alice</td>
        </tr>
        <tr data-testid="row-b" data-index="7" data-row="not-json(">
          <td data-testid="div-cell" data-slot="table-cell" data-column="col2">Cell</td>
        </tr>
        <tr data-testid="row-c">
          <td data-testid="div-cell-nodata" data-slot="table-cell" data-column="col3">NoIndexNoData</td>
        </tr>
        <tr data-testid="row-d" data-custom='{"id":9,"name":"Custom"}'>
          <td data-testid="td-custom" data-column="colX">CustomAttrRow</td>
        </tr>
        <tr data-testid="empty-row"></tr>
        <div data-testid="stray-cell" data-slot="table-cell" data-column="stray">Stray</div>
      </tbody>
    </table>

    <div uiTable [uiTableContextMenu]="menu" (rowContextMenu)="onAltRow($event)" (cellContextMenu)="onAltCell($event)">
      <div data-testid="alt-row" data-slot="table-row" data-row-index="2" data-row='{"alt":true}'>
        <div data-testid="alt-cell" data-slot="table-cell" data-column="c">Alt</div>
      </div>
    </div>
  `,
  imports: [ContextMenuComponent, TableContextMenuDirective],
})
class TableContextMenuHost {
  readonly disabled = signal(false);
  readonly menuEnabled = signal(true);
  readonly rowAttr = signal('data-row');

  readonly rowEvents: TableRowContextMenuEvent[] = [];
  readonly cellEvents: TableCellContextMenuEvent[] = [];
  readonly altRowEvents: TableRowContextMenuEvent[] = [];
  readonly altCellEvents: TableCellContextMenuEvent[] = [];

  onRow(event: TableRowContextMenuEvent): void {
    this.rowEvents.push(event);
  }

  onCell(event: TableCellContextMenuEvent): void {
    this.cellEvents.push(event);
  }

  onAltRow(event: TableRowContextMenuEvent): void {
    this.altRowEvents.push(event);
  }

  onAltCell(event: TableCellContextMenuEvent): void {
    this.altCellEvents.push(event);
  }
}

function fireContextMenu(el: Element, clientX = 111, clientY = 222): MouseEvent {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY });
  el.dispatchEvent(event);
  return event;
}

function query(fixture: ComponentFixture<TableContextMenuHost>, testId: string): HTMLElement {
  const el = fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  if (!el) {
    throw new Error(`missing test element: ${testId}`);
  }
  return el as HTMLElement;
}

describe('TableContextMenuDirective', () => {
  let fixture: ComponentFixture<TableContextMenuHost>;
  let host: TableContextMenuHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TableContextMenuHost] }).compileComponents();
    fixture = TestBed.createComponent(TableContextMenuHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (!fixture.componentRef.hostView.destroyed) {
      fixture.destroy();
    }
  });

  it('emits row + cell events with data-row-index and valid JSON row data, using cellIndex fallback for the column', () => {
    const cell = query(fixture, 'td-cellindex');
    fireContextMenu(cell, 10, 20);

    expect(host.rowEvents).toHaveLength(1);
    expect(host.cellEvents).toHaveLength(1);

    const rowEvent = host.rowEvents[0];
    const cellEvent = host.cellEvents[0];
    expect(rowEvent.index).toBe(5);
    expect((rowEvent.row as AliceRow).id).toBe(1);
    expect((rowEvent.row as AliceRow).name).toBe('Alice');
    expect(cellEvent.column).toBe('0');
    expect(cellEvent.event.clientX).toBe(10);
    expect(cellEvent.event.clientY).toBe(20);
  });

  it('reads the explicit data-column attribute when present', () => {
    const cell = query(fixture, 'td-named');
    fireContextMenu(cell);

    expect(host.cellEvents).toHaveLength(1);
    expect(host.cellEvents[0].column).toBe('name');
  });

  it('falls back to data-index when data-row-index is absent, and reads a non-td [data-slot="table-cell"] cell', () => {
    const cell = query(fixture, 'div-cell');
    fireContextMenu(cell);

    expect(host.rowEvents).toHaveLength(1);
    expect(host.cellEvents).toHaveLength(1);
    expect(host.rowEvents[0].index).toBe(7);
    expect(host.cellEvents[0].column).toBe('col2');
  });

  it('falls back to { value: dataAttr } when the data-row JSON is invalid', () => {
    const cell = query(fixture, 'div-cell');
    fireContextMenu(cell);

    expect(host.rowEvents[0].row).toEqual({ value: 'not-json(' });
  });

  it('defaults index to 0 and data to {} when no index/data attributes are present', () => {
    const cell = query(fixture, 'div-cell-nodata');
    fireContextMenu(cell);

    expect(host.rowEvents).toHaveLength(1);
    expect(host.rowEvents[0].index).toBe(0);
    expect(host.rowEvents[0].row).toEqual({});
  });

  it('reads row data from a custom rowDataAttribute', () => {
    host.rowAttr.set('data-custom');
    fixture.detectChanges();

    const cell = query(fixture, 'td-custom');
    fireContextMenu(cell);

    expect(host.rowEvents).toHaveLength(1);
    expect(host.rowEvents[0].row).toEqual({ id: 9, name: 'Custom' });
  });

  it('calls preventDefault/stopPropagation and opens the context menu at the click position with the row data', () => {
    const showSpy = vi.spyOn(ContextMenuComponent.prototype, 'show');

    const cell = query(fixture, 'td-named');
    const event = fireContextMenu(cell, 42, 84);

    expect(event.defaultPrevented).toBe(true);
    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(showSpy).toHaveBeenCalledWith(42, 84, { id: 1, name: 'Alice' });
  });

  it('does nothing when contextMenuDisabled is true', () => {
    host.disabled.set(true);
    fixture.detectChanges();

    const cell = query(fixture, 'td-named');
    const event = fireContextMenu(cell);

    expect(event.defaultPrevented).toBe(false);
    expect(host.rowEvents).toHaveLength(0);
    expect(host.cellEvents).toHaveLength(0);
  });

  it('does nothing when uiTableContextMenu is null', () => {
    host.menuEnabled.set(false);
    fixture.detectChanges();

    const cell = query(fixture, 'td-named');
    const event = fireContextMenu(cell);

    expect(event.defaultPrevented).toBe(false);
    expect(host.rowEvents).toHaveLength(0);
    expect(host.cellEvents).toHaveLength(0);
  });

  it('does nothing when the right-click target has no cell ancestor', () => {
    const emptyRow = query(fixture, 'empty-row');
    const event = fireContextMenu(emptyRow);

    expect(event.defaultPrevented).toBe(false);
    expect(host.rowEvents).toHaveLength(0);
    expect(host.cellEvents).toHaveLength(0);
  });

  it('does nothing when a matched cell has no row ancestor', () => {
    const stray = query(fixture, 'stray-cell');
    const event = fireContextMenu(stray);

    expect(event.defaultPrevented).toBe(false);
    expect(host.rowEvents).toHaveLength(0);
    expect(host.cellEvents).toHaveLength(0);
  });

  it('attaches via the [uiTable] selector on non-table elements and reads [data-slot="table-row"]/[data-slot="table-cell"]', () => {
    const cell = query(fixture, 'alt-cell');
    fireContextMenu(cell);

    expect(host.altRowEvents).toHaveLength(1);
    expect(host.altCellEvents).toHaveLength(1);
    expect(host.altRowEvents[0].index).toBe(2);
    expect(host.altRowEvents[0].row).toEqual({ alt: true });
    expect(host.altCellEvents[0].column).toBe('c');
  });

  it('removes the contextmenu listener on destroy', () => {
    const cell = query(fixture, 'td-named');
    fireContextMenu(cell);
    expect(host.rowEvents).toHaveLength(1);

    fixture.destroy();
    fireContextMenu(cell);

    expect(host.rowEvents).toHaveLength(1);
  });
});
