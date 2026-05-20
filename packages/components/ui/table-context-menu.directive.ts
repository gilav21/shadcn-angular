import {
  Directive,
  ElementRef,
  OnDestroy,
  inject,
  input,
  output,
} from '@angular/core';
import { ContextMenuComponent } from './context-menu';

export interface TableRowContextMenuEvent<T = unknown> {
  row: T;
  index: number;
  event: MouseEvent;
  depth?: number;
  isLeaf?: boolean;
  parentRow?: T | null;
}

export interface TableCellContextMenuEvent<T = unknown> extends TableRowContextMenuEvent<T> {
  column: string;
}

/**
 * Attach a context menu to a `<table>` or `[uiTable]` element. Right-clicking
 * a table row or cell opens the provided {@link ContextMenuComponent} and emits
 * {@link TableRowContextMenuEvent} / {@link TableCellContextMenuEvent}.
 */
@Directive({
  selector: 'table[uiTableContextMenu], [uiTable]',
  standalone: true,
})
export class TableContextMenuDirective<T = unknown> implements OnDestroy {
  uiTableContextMenu = input<ContextMenuComponent | null>(null);
  contextMenuDisabled = input<boolean>(false);
  rowDataAttribute = input<string>('data-row');

  rowContextMenu = output<TableRowContextMenuEvent<T>>();
  cellContextMenu = output<TableCellContextMenuEvent<T>>();

  private readonly tableElement = inject(ElementRef<HTMLElement>);
  private readonly contextMenuListener = (event: MouseEvent) => {
    if (this.contextMenuDisabled() || !this.uiTableContextMenu()) {
      return;
    }

    const target = event.target as HTMLElement;

    const cell = target.closest('td, [data-slot="table-cell"]');
    if (cell) {
      const row = cell.closest('tr, [data-slot="table-row"]');
      if (row) {
        event.preventDefault();
        event.stopPropagation();

        const rowData = this.extractRowData(row as HTMLElement, cell as HTMLElement);

        if (cell.tagName === 'TD' || (cell as HTMLElement).dataset['slot'] === 'table-cell') {
          this.cellContextMenu.emit({
            row: rowData.data,
            column: rowData.column,
            index: rowData.index,
            event,
          });
        }

        this.rowContextMenu.emit({
          row: rowData.data,
          index: rowData.index,
          event,
        });

        const contextMenu = this.uiTableContextMenu();
        if (contextMenu) {
          contextMenu.show(event.clientX, event.clientY, rowData.data);
        }
      }
    }
  };

  constructor() {
    this.tableElement.nativeElement.addEventListener('contextmenu', this.contextMenuListener);
  }

  ngOnDestroy() {
    this.tableElement.nativeElement.removeEventListener('contextmenu', this.contextMenuListener);
  }

  private extractRowData(rowElement: HTMLElement, cellElement: HTMLElement): { data: T; index: number; column: string } {
    const indexAttr = rowElement.dataset['rowIndex'] || rowElement.dataset['index'];
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

    const columnAttr = cellElement.dataset['column'] || (cellElement as HTMLTableCellElement).cellIndex.toString();
    const column = typeof columnAttr === 'string' ? columnAttr : `column_${columnAttr}`;

    return { data, index, column };
  }
}
