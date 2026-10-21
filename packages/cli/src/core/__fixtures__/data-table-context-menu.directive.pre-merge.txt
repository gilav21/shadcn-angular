import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { onContextGesture, type ContextGesture } from '../lib/touch';
import { ContextMenuComponent } from './context-menu';
import { DataTableComponent } from './data-table';
import { TableRowContextMenuEvent } from './table-context-menu.directive';

export interface DataTableHeaderContextMenuEvent {
  column: { id: string | null; name: string; element: HTMLElement };
  /** The `contextmenu` event of a right-click or the keyboard key, or the `touchstart` that began a long-press. */
  event: MouseEvent | TouchEvent;
}

/**
 * Attach a context menu to a `<ui-data-table>` element. Right-clicking or long-pressing a row
 * opens the provided {@link ContextMenuComponent} and emits
 * {@link TableRowContextMenuEvent}. Right-clicking a header (when
 * `contextMenuRowsOnly` is false) emits {@link DataTableHeaderContextMenuEvent}.
 */
@Directive({
  selector: 'ui-data-table[uiDataTableContextMenu]',
  standalone: true,
})
export class DataTableContextMenuDirective<T = unknown> {
  /** The menu to open when a row or header is right-clicked. */
  uiDataTableContextMenu = input.required<ContextMenuComponent>();
  /** Stops the table from opening the menu. */
  contextMenuDisabled = input<boolean>(false);
  /** Restrict the menu to body rows, leaving the header alone. */
  contextMenuRowsOnly = input<boolean>(true);

  /** Emits the row that was right-clicked. */
  rowContextMenu = output<TableRowContextMenuEvent<T>>();
  /** Emits the column header that was right-clicked. */
  headerContextMenu = output<DataTableHeaderContextMenuEvent>();

  private readonly tableElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dataTable = inject(DataTableComponent, { optional: true });

  constructor() {
    const stop = onContextGesture(this.tableElement, (gesture) => this.open(gesture));
    inject(DestroyRef).onDestroy(stop);
  }

  /** Whether the gesture landed on a row (or an allowed header) and was taken. */
  private open(gesture: ContextGesture): boolean {
    if (this.contextMenuDisabled()) return false;
    // A finger's hold on a cell starts a range selection in a table that has one (Android also reports it as a contextmenu); only a right-click or the key opens the menu there.
    if (gesture.viaTouch && this.dataTable?.enableCellRangeSelection()) return false;

    const target = gesture.target as HTMLElement;
    const row = target.closest<HTMLElement>('[data-slot="table-row"], [data-slot="data-table-row"], tr[data-row-index]');
    if (row) {
      this.handleRowContextMenu(target, gesture, row);
      return true;
    }

    if (this.contextMenuRowsOnly()) return false;
    const header = target.closest<HTMLElement>('[data-slot="table-head"], [data-slot="data-table-header"], th');
    if (!header) return false;
    this.handleHeaderContextMenu(gesture, header);
    return true;
  }

  private handleRowContextMenu(target: HTMLElement, gesture: ContextGesture, rowEl: HTMLElement): void {
    const rowData = this.extractDataTableRow(rowEl);

    const cell = target.closest<HTMLElement>('[data-slot="table-cell"], td');
    const columnKey = cell?.dataset['column'] ?? '';
    if (this.dataTable && columnKey && columnKey !== '_selection' && columnKey !== '_expander') {
      this.dataTable.focusedCell.set({ rowIndex: rowData.index, columnKey });
    }

    const treeRow = this.dataTable?.getRenderedTreeRowAt(rowData.index);

    this.rowContextMenu.emit({
      row: rowData.data,
      index: rowData.index,
      event: gesture.source,
      depth: treeRow?.depth,
      isLeaf: treeRow?.isLeaf,
      parentRow: treeRow?.parentRow,
    });

    const contextMenu = this.uiDataTableContextMenu();
    if (contextMenu) {
      const contextData = treeRow
        ? { ...treeRow, row: rowData.data }
        : rowData.data;
      contextMenu.show(gesture.clientX, gesture.clientY, contextData);
    }
  }

  private handleHeaderContextMenu(gesture: ContextGesture, headerEl: HTMLElement): void {
    const columnData = this.extractHeaderData(headerEl);

    this.headerContextMenu.emit({
      column: columnData,
      event: gesture.source,
    });

    const contextMenu = this.uiDataTableContextMenu();
    if (contextMenu) {
      contextMenu.show(gesture.clientX, gesture.clientY, columnData);
    }
  }

  private extractDataTableRow(rowElement: HTMLElement): { data: T; index: number } {
    const indexAttr = rowElement.dataset['rowIndex'];
    const index = indexAttr ? Number.parseInt(indexAttr, 10) : 0;

    const renderedRow = this.dataTable?.getRenderedRowAt(index);
    if (renderedRow !== undefined) {
      return { data: renderedRow, index };
    }

    const rowId = rowElement.dataset['rowId'];
    const fallbackData = rowId ? ({ id: rowId } as unknown as T) : ({} as T);

    return { data: fallbackData, index };
  }

  private extractHeaderData(headerElement: HTMLElement): { id: string | null; name: string; element: HTMLElement } {
    const columnId = headerElement.dataset['columnId'] ?? null;
    const columnName = headerElement.textContent?.trim() || '';

    return {
      id: columnId,
      name: columnName,
      element: headerElement,
    };
  }
}
