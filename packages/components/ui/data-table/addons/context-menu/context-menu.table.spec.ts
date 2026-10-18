import { describe, it, expect, vi } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DataTableComponent, type ColumnDef } from '../..';
import type { ContextMenuComponent } from '../../../context-menu';
import { DataTableContextMenuDirective } from './context-menu.directive';
import type { DataTableHeaderContextMenuEvent, DataTableRowContextMenuEvent } from './context-menu.types';

/**
 * The directive on a REAL `<ui-data-table>`. Its other spec hand-builds the DOM; that is how the old flat
 * directive passed its tests while a header right-click reported row 0 and a grouped row reported row 0:
 * the header row, a detail row, the footer and every grouped row are `table-row`s without a `data-row-index`.
 */

interface Row {
  id: string;
  name: string;
  grp: string;
}

const ROWS: Row[] = [
  { id: '1', name: 'Alice', grp: 'A' },
  { id: '2', name: 'Bob', grp: 'A' },
  { id: '3', name: 'Cy', grp: 'B' },
];

const COLUMNS: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
];

@Component({ selector: 'ui-test-detail', template: '<span id="detail-text">DETAIL</span>', changeDetection: ChangeDetectionStrategy.OnPush })
class DetailComponent {}

@Component({
  selector: 'ui-test-table-host',
  standalone: true,
  imports: [DataTableComponent, DataTableContextMenuDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-data-table
      [data]="rows" [columns]="columns" [groupBy]="groupBy()"
      [enableRowExpansion]="true" [expandedRows]="expanded" [rowDetailComponent]="detail" [showFooter]="true"
      uiDtContextMenu [contextMenu]="menu" [contextMenuRowsOnly]="false"
      (rowContextMenu)="rowEvents.push($event)" (headerContextMenu)="headerEvents.push($event)" />
  `,
})
class TableHostComponent {
  readonly rows = ROWS;
  readonly columns = COLUMNS;
  readonly detail = DetailComponent;
  readonly expanded: Record<string, boolean> = { '1': true };
  readonly groupBy = signal<string | undefined>(undefined);
  readonly menu = { show: vi.fn() } as unknown as ContextMenuComponent;
  readonly rowEvents: DataTableRowContextMenuEvent<Row>[] = [];
  readonly headerEvents: DataTableHeaderContextMenuEvent[] = [];
}

async function render(grouped = false): Promise<{ host: TableHostComponent; root: HTMLElement; table: DataTableComponent<Row> }> {
  const fixture = TestBed.createComponent(TableHostComponent);
  fixture.componentInstance.groupBy.set(grouped ? 'grp' : undefined);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    host: fixture.componentInstance,
    root: fixture.nativeElement as HTMLElement,
    table: fixture.debugElement.query(By.directive(DataTableComponent)).componentInstance as DataTableComponent<Row>,
  };
}

function rightClick(target: Element, x = 30, y = 40): MouseEvent {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y });
  target.dispatchEvent(event);
  return event;
}

const bodyCell = (root: HTMLElement, rowIndex: number, column: string): HTMLElement =>
  root.querySelector<HTMLElement>(`[data-row-index="${rowIndex}"] [data-column="${column}"]`) as HTMLElement;

describe('DataTableContextMenuDirective on a real data table', () => {
  it('emits the row that was right-clicked, with its rendered index, opens the bound menu with it and focuses the cell', async () => {
    const { host, root, table } = await render();

    rightClick(bodyCell(root, 1, 'name'));

    expect(host.rowEvents).toHaveLength(1);
    expect(host.rowEvents[0].row).toEqual(ROWS[1]);
    expect(host.rowEvents[0].index).toBe(1);
    expect(host.menu.show).toHaveBeenCalledWith(30, 40, ROWS[1]);
    expect(table.focusedCell()).toEqual({ rowIndex: 1, columnKey: 'name' });
  });

  it('emits the header, never row 0, for a header right-click', async () => {
    const { host, root } = await render();
    const header = root.querySelector<HTMLElement>('[data-column-id="name"]') as HTMLElement;

    rightClick(header, 5, 6);

    expect(host.rowEvents).toHaveLength(0);
    expect(host.headerEvents).toHaveLength(1);
    expect(host.headerEvents[0].column.id).toBe('name');
    expect(host.menu.show).toHaveBeenCalledWith(5, 6, host.headerEvents[0].column);
  });

  it('does not take a detail row or the footer for a row', async () => {
    const { host, root } = await render();

    const detail = rightClick(root.querySelector('#detail-text') as Element);
    const footer = rightClick(root.querySelector('[data-slot="table-footer"]') as Element);

    expect(host.rowEvents).toHaveLength(0);
    expect(host.headerEvents).toHaveLength(0);
    expect(host.menu.show).not.toHaveBeenCalled();
    expect(detail.defaultPrevented).toBe(false);
    expect(footer.defaultPrevented).toBe(false);
  });

  // A grouped table has no rendered row index (grouping partitions the sorted data), so rather than guess one
  // the gesture falls through to the browser. The old directive reported row 0's data for every grouped row.
  it('leaves a grouped row to the browser instead of reporting the wrong row', async () => {
    const { host, root } = await render(true);
    const groupedCells = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="table-cell"]'));
    expect(groupedCells.length).toBeGreaterThan(0);

    const events = groupedCells.map(cell => rightClick(cell));

    expect(host.rowEvents).toHaveLength(0);
    expect(host.menu.show).not.toHaveBeenCalled();
    expect(events.every(event => !event.defaultPrevented)).toBe(true);
  });
});
