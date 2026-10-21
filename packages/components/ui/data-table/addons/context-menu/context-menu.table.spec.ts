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
 * the header row, a detail row, the footer and every group header are `table-row`s without a `data-row-index`.
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
  { id: '4', name: 'Di', grp: 'A' },
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
      [data]="rows" [columns]="columns" [groupBy]="groupBy()" [enableCellRangeSelection]="rangeSelection()"
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
  readonly rangeSelection = signal(false);
  readonly menu = { show: vi.fn() } as unknown as ContextMenuComponent;
  // The directive's row type cannot be inferred from the host <ui-data-table>, so events arrive as unknown.
  readonly rowEvents: DataTableRowContextMenuEvent<unknown>[] = [];
  readonly headerEvents: DataTableHeaderContextMenuEvent[] = [];
}

async function render(
  grouped = false,
  rangeSelection = false,
): Promise<{ host: TableHostComponent; root: HTMLElement; table: DataTableComponent<Row> }> {
  const fixture = TestBed.createComponent(TableHostComponent);
  fixture.componentInstance.groupBy.set(grouped ? 'grp' : undefined);
  fixture.componentInstance.rangeSelection.set(rangeSelection);
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

  // Grouping draws A: Alice, Bob, Di then B: Cy, while the data stays in source order, so the rendered index of
  // Di (2) and Cy (3) differs from their position in the data (3 and 2). The old directive reported row 0's data
  // for every grouped row.
  it('emits the grouped row that was right-clicked, indexed as drawn, and focuses its cell', async () => {
    const { host, root, table } = await render(true);

    rightClick(bodyCell(root, 2, 'name'));
    rightClick(bodyCell(root, 3, 'name'));

    expect(host.rowEvents.map(event => [event.row, event.index])).toEqual([[ROWS[3], 2], [ROWS[2], 3]]);
    expect(host.menu.show).toHaveBeenLastCalledWith(30, 40, ROWS[2]);
    expect(table.focusedCell()).toEqual({ rowIndex: 3, columnKey: 'name' });
  });

  it('leaves a group header to the browser', async () => {
    const { host, root } = await render(true);
    // The chevron button is where a right-click on a group header usually lands.
    const chevron = root.querySelector('[data-group-key] button') as HTMLElement;

    const event = rightClick(chevron);

    expect(host.rowEvents).toHaveLength(0);
    expect(host.menu.show).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  // The table's range handler and the directive both act on the same 500 ms hold. On a real table, with a real
  // touch sequence, the first hold on a cell must start a range and open nothing; once that cell is the
  // selection (a lone cell collapses to a focus when the finger lifts), the next hold opens the menu and
  // leaves the selection alone. Neither handler is stubbed, so this is where their agreement is tested.
  it('on a range-selection table the first hold selects and the next hold opens the menu', async () => {
    const { host, root, table } = await render(false, true);
    const cell = bodyCell(root, 1, 'name');
    const doc = document as Document & { elementFromPoint?: (x: number, y: number) => Element | null };
    const originalElementFromPoint = doc.elementFromPoint;
    doc.elementFromPoint = () => cell;
    const hold = (): void => {
      const touchStart = Object.assign(new Event('touchstart', { bubbles: true, cancelable: true }), {
        touches: [{ clientX: 30, clientY: 40 }],
      });
      cell.dispatchEvent(touchStart);
      vi.advanceTimersByTime(500);
    };
    vi.useFakeTimers();
    try {
      hold();
      expect(table.cellRange()).toEqual({ startRow: 1, startCol: 'name', endRow: 1, endCol: 'name' });
      expect(host.menu.show).not.toHaveBeenCalled();
      expect(host.rowEvents).toHaveLength(0);

      globalThis.dispatchEvent(new Event('touchend'));
      expect(table.cellRange()).toBeNull();
      expect(table.focusedCell()).toEqual({ rowIndex: 1, columnKey: 'name' });

      vi.advanceTimersByTime(1000);
      hold();
      expect(host.menu.show).toHaveBeenCalledTimes(1);
      expect(host.rowEvents.map(event => event.row)).toEqual([ROWS[1]]);
      expect(table.cellRange()).toBeNull();
    } finally {
      vi.useRealTimers();
      doc.elementFromPoint = originalElementFromPoint;
    }
  });
});
