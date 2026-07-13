import {
  Directive,
  ElementRef,
  OnDestroy,
  inject,
  input,
  output,
} from '@angular/core';
import { ContextMenuComponent } from './context-menu';
import { DataTableComponent } from './data-table';
import { TableRowContextMenuEvent } from './table-context-menu.directive';

export interface DataTableHeaderContextMenuEvent {
  column: { id: string | null; name: string; element: HTMLElement };
  event: MouseEvent;
}

/**
 * Attach a context menu to a `<ui-data-table>` element. Right-clicking a row
 * opens the provided {@link ContextMenuComponent} and emits
 * {@link TableRowContextMenuEvent}. Right-clicking a header (when
 * `contextMenuRowsOnly` is false) emits {@link DataTableHeaderContextMenuEvent}.
 */
@Directive({
  selector: 'ui-data-table[uiDataTableContextMenu]',
  standalone: true,
})
export class DataTableContextMenuDirective<T = unknown> implements OnDestroy {
  uiDataTableContextMenu = input.required<ContextMenuComponent>();
  contextMenuDisabled = input<boolean>(false);
  contextMenuRowsOnly = input<boolean>(true);

  rowContextMenu = output<TableRowContextMenuEvent<T>>();
  headerContextMenu = output<DataTableHeaderContextMenuEvent>();

  private readonly tableElement = inject(ElementRef<HTMLElement>);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly dataTable = inject<DataTableComponent<T> | null>(DataTableComponent as any, { optional: true });
  private readonly contextMenuListener = (event: MouseEvent): void => {
    if (this.contextMenuDisabled()) {
      return;
    }

    const target = event.target as HTMLElement;

    const row = target.closest('[data-slot="table-row"], [data-slot="data-table-row"], tr[data-row-index]');
    if (row) {
      event.preventDefault();
      event.stopPropagation();
      this.handleRowContextMenu(target, event, row as HTMLElement);
      return;
    }

    if (!this.contextMenuRowsOnly()) {
      const header = target.closest('[data-slot="table-head"], [data-slot="data-table-header"], th');
      if (header) {
        event.preventDefault();
        event.stopPropagation();
        this.handleHeaderContextMenu(event, header as HTMLElement);
      }
    }
  };

  constructor() {
    this.tableElement.nativeElement.addEventListener('contextmenu', this.contextMenuListener);
  }

  ngOnDestroy(): void {
    this.tableElement.nativeElement.removeEventListener('contextmenu', this.contextMenuListener);
  }

  private handleRowContextMenu(target: HTMLElement, event: MouseEvent, rowEl: HTMLElement): void {
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
      event,
      depth: treeRow?.depth,
      isLeaf: treeRow?.isLeaf,
      parentRow: treeRow?.parentRow,
    });

    const contextMenu = this.uiDataTableContextMenu();
    if (contextMenu) {
      const contextData = treeRow
        ? { ...treeRow, row: rowData.data }
        : rowData.data;
      contextMenu.show(event.clientX, event.clientY, contextData);
    }
  }

  private handleHeaderContextMenu(event: MouseEvent, headerEl: HTMLElement): void {
    const columnData = this.extractHeaderData(headerEl);

    this.headerContextMenu.emit({
      column: columnData,
      event,
    });

    const contextMenu = this.uiDataTableContextMenu();
    if (contextMenu) {
      contextMenu.show(event.clientX, event.clientY, columnData);
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
