import {
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  input,
  output,
} from '@angular/core';
import { ContextMenuComponent } from './context-menu.component';
import { DataTableComponent } from './data-table/data-table.component';

export interface ContextMenuEvent<T> {
  event: MouseEvent;
  item: T;
  index?: number;
}

export interface TreeContextMenuEvent<T = unknown> {
  node: T;
  event: MouseEvent;
}

export interface TableRowContextMenuEvent<T = unknown> {
  row: T;
  index: number;
  event: MouseEvent;
}

export interface TableCellContextMenuEvent<T = unknown> extends TableRowContextMenuEvent<T> {
  column: string;
}

export interface DataTableHeaderContextMenuEvent {
  column: { id: string | null; name: string; element: HTMLElement };
  event: MouseEvent;
}

/**
 * ContextMenuAttachDirective - Attach context menu to any element with data
 */
@Directive({
  selector: '[uiContextMenuAttach]',
  standalone: true,
})
export class ContextMenuAttachDirective<T> {
  uiContextMenuAttach = input.required<ContextMenuComponent>();
  contextMenuData = input.required<T>();
  disabled = input<boolean>(false);

  contextMenuTriggered = output<ContextMenuEvent<T>>();

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: MouseEvent) {
    if (this.disabled()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const contextMenu = this.uiContextMenuAttach();
    if (!contextMenu) return;

    this.contextMenuTriggered.emit({
      event,
      item: this.contextMenuData(),
    });

    contextMenu.show(event.clientX, event.clientY);
  }
}

/**
 * TreeContextMenuDirective - Specialized directive for Tree nodes
 */
@Directive({
  selector: 'ui-tree[uiTreeContextMenu]',
  standalone: true,
})
export class TreeContextMenuDirective<T = unknown> {
  uiTreeContextMenu = input.required<ContextMenuComponent>();
  contextMenuDisabled = input<boolean>(false);

  nodeContextMenu = output<TreeContextMenuEvent<T>>();

  private treeElement = inject(ElementRef<HTMLElement>);
  private readonly contextMenuListener = (event: MouseEvent) => {
    if (this.contextMenuDisabled()) {
      return;
    }

    const target = event.target as HTMLElement;
    const treeItem = target.closest('[data-slot="tree-item"]');

    if (treeItem) {
      event.preventDefault();
      event.stopPropagation();

      const nodeData = this.extractNodeData(treeItem as HTMLElement);

      this.nodeContextMenu.emit({
        node: nodeData,
        event,
      });

      const contextMenu = this.uiTreeContextMenu();
      if (contextMenu) {
        contextMenu.show(event.clientX, event.clientY, nodeData);
      }
    }
  };

  constructor() {
    this.setupTreeContextMenu();
  }

  private setupTreeContextMenu() {
    this.treeElement.nativeElement.addEventListener('contextmenu', this.contextMenuListener);
  }

  ngOnDestroy() {
    this.treeElement.nativeElement.removeEventListener('contextmenu', this.contextMenuListener);
  }

  private extractNodeData(element: HTMLElement): T {
    const key = element.getAttribute('data-key');
    const expanded = element.getAttribute('data-expanded') === 'true';
    const selected = element.getAttribute('data-selected') === 'true';

    const labelElement = element.querySelector('[data-slot="tree-label"]');
    const label = labelElement?.textContent?.trim() || '';

    return {
      key,
      label,
      expanded,
      selected,
      element,
    } as unknown as T;
  }
}

/**
 * TableContextMenuDirective - Specialized directive for Table rows
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

  private tableElement = inject(ElementRef<HTMLElement>);
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

        if (cell.tagName === 'TD' || cell.getAttribute('data-slot') === 'table-cell') {
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
    this.setupTableContextMenu();
  }

  private setupTableContextMenu() {
    this.tableElement.nativeElement.addEventListener('contextmenu', this.contextMenuListener);
  }

  ngOnDestroy() {
    this.tableElement.nativeElement.removeEventListener('contextmenu', this.contextMenuListener);
  }

  private extractRowData(rowElement: HTMLElement, cellElement: HTMLElement): { data: T; index: number; column: string } {
    const indexAttr = rowElement.getAttribute('data-row-index') || rowElement.getAttribute('data-index');
    const index = indexAttr ? parseInt(indexAttr, 10) : 0;

    const dataAttr = rowElement.getAttribute(this.rowDataAttribute());
    let data: T = {} as T;

    if (dataAttr) {
      try {
        data = JSON.parse(dataAttr);
      } catch {
        data = { value: dataAttr } as unknown as T;
      }
    }

    const columnAttr = cellElement.getAttribute('data-column') || (cellElement as HTMLTableCellElement).cellIndex.toString();
    const column = typeof columnAttr === 'string' ? columnAttr : `column_${columnAttr}`;

    return { data, index, column };
  }
}

/**
 * DataTableContextMenuDirective - Specialized directive for Data Table component
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

  private tableElement = inject(ElementRef<HTMLElement>);
  private dataTable = inject<DataTableComponent<T> | null>(DataTableComponent as any, { optional: true });
  private readonly contextMenuListener = (event: MouseEvent) => {
    if (this.contextMenuDisabled()) {
      return;
    }

    const target = event.target as HTMLElement;

    const row = target.closest('[data-slot="table-row"], [data-slot="data-table-row"], tr[data-row-index]');
    if (row) {
      event.preventDefault();
      event.stopPropagation();

      const rowData = this.extractDataTableRow(row as HTMLElement);

      this.rowContextMenu.emit({
        row: rowData.data,
        index: rowData.index,
        event,
      });

      const contextMenu = this.uiDataTableContextMenu();
      if (contextMenu) {
        contextMenu.show(event.clientX, event.clientY, rowData.data);
      }
      return;
    }

    if (!this.contextMenuRowsOnly()) {
      const header = target.closest('[data-slot="table-head"], [data-slot="data-table-header"], th');
      if (header) {
        event.preventDefault();
        event.stopPropagation();

        const columnData = this.extractHeaderData(header as HTMLElement);

        this.headerContextMenu.emit({
          column: columnData,
          event,
        });

        const contextMenu = this.uiDataTableContextMenu();
        if (contextMenu) {
          contextMenu.show(event.clientX, event.clientY, columnData);
        }
      }
    }
  };

  constructor() {
    this.setupDataTableContextMenu();
  }

  private setupDataTableContextMenu() {
    this.tableElement.nativeElement.addEventListener('contextmenu', this.contextMenuListener);
  }

  ngOnDestroy() {
    this.tableElement.nativeElement.removeEventListener('contextmenu', this.contextMenuListener);
  }

  private extractDataTableRow(rowElement: HTMLElement): { data: T; index: number } {
    const indexAttr = rowElement.getAttribute('data-row-index');
    const index = indexAttr ? parseInt(indexAttr, 10) : 0;

    const renderedRow = this.dataTable?.getRenderedRowAt(index);
    if (renderedRow !== undefined) {
      return { data: renderedRow, index };
    }

    const rowId = rowElement.getAttribute('data-row-id');
    const fallbackData = rowId ? ({ id: rowId } as unknown as T) : ({} as T);

    return { data: fallbackData, index };
  }

  private extractHeaderData(headerElement: HTMLElement): { id: string | null; name: string; element: HTMLElement } {
    const columnId = headerElement.getAttribute('data-column-id');
    const columnName = headerElement.textContent?.trim() || '';

    return {
      id: columnId,
      name: columnName,
      element: headerElement,
    };
  }
}

export const ContextMenuIntegrations = [
  ContextMenuAttachDirective,
  TreeContextMenuDirective,
  TableContextMenuDirective,
  DataTableContextMenuDirective,
];
