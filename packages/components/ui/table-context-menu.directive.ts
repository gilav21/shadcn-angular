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

export interface TableRowContextMenuEvent<T = unknown> {
  row: T;
  index: number;
  /** The `contextmenu` event of a right-click or the keyboard key, or the `touchstart` that began a long-press. */
  event: MouseEvent | TouchEvent;
  depth?: number;
  isLeaf?: boolean;
  parentRow?: T | null;
}

export interface TableCellContextMenuEvent<T = unknown> extends TableRowContextMenuEvent<T> {
  column: string;
}

/**
 * Attach a context menu to a `<table>` or `[uiTable]` element. Right-clicking
 * or long-pressing a table row or cell opens the provided
 * {@link ContextMenuComponent} and emits {@link TableRowContextMenuEvent} /
 * {@link TableCellContextMenuEvent}.
 */
@Directive({
  selector: 'table[uiTableContextMenu], [uiTable]',
  standalone: true,
})
export class TableContextMenuDirective<T = unknown> {
  /** The menu to open when a row or cell is right-clicked or long-pressed. */
  uiTableContextMenu = input<ContextMenuComponent | null>(null);
  /** Stops the table from opening the menu. */
  contextMenuDisabled = input<boolean>(false);
  /** Attribute the directive reads to work out which row was clicked. */
  rowDataAttribute = input<string>('data-row');

  /** Emits the row that was right-clicked or long-pressed. */
  rowContextMenu = output<TableRowContextMenuEvent<T>>();
  /** Emits the cell that was right-clicked or long-pressed. */
  cellContextMenu = output<TableCellContextMenuEvent<T>>();

  constructor() {
    const stop = onContextGesture(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement, (gesture) => this.open(gesture));
    inject(DestroyRef).onDestroy(stop);
  }

  /** Whether the gesture landed on a cell of a row and was taken. */
  private open(gesture: ContextGesture): boolean {
    if (this.contextMenuDisabled() || !this.uiTableContextMenu()) return false;

    const cell = gesture.target.closest<HTMLElement>('td, [data-slot="table-cell"]');
    const row = cell?.closest<HTMLElement>('tr, [data-slot="table-row"]');
    if (!cell || !row) return false;

    const rowData = this.extractRowData(row, cell);
    this.cellContextMenu.emit({ row: rowData.data, column: rowData.column, index: rowData.index, event: gesture.source });
    this.rowContextMenu.emit({ row: rowData.data, index: rowData.index, event: gesture.source });
    this.uiTableContextMenu()?.show(gesture.clientX, gesture.clientY, rowData.data);
    return true;
  }

  private extractRowData(rowElement: HTMLElement, cellElement: HTMLElement): { data: T; index: number; column: string } {
    const indexAttr = rowElement.dataset['rowIndex'] ?? rowElement.dataset['index'];
    const index = indexAttr ? Number.parseInt(indexAttr, 10) : 0;

    const dataAttr = rowElement.getAttribute(this.rowDataAttribute());
    let data: T = {} as T;

    if (dataAttr) {
      try {
        data = JSON.parse(dataAttr);
      } catch {
        data = { value: dataAttr } as unknown as T;
      }
    }

    const columnAttr = cellElement.dataset['column'] ?? (cellElement as HTMLTableCellElement).cellIndex.toString();
    const column = typeof columnAttr === 'string' ? columnAttr : `column_${columnAttr}`;

    return { data, index, column };
  }
}
