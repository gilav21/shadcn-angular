import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { ContextMenuComponent } from './context-menu.component';

export interface ContextMenuEvent<T = any> {
  event: MouseEvent;
  item: T;
  index?: number;
}

/**
 * ContextMenuAttachDirective - Attach context menu to any element with data
 * 
 * Usage:
 * <ui-context-menu #rowContextMenu>
 *   <ui-context-menu-content>
 *     <ui-context-menu-item (click)="onEdit(contextMenuData)">Edit</ui-context-menu-item>
 *     <ui-context-menu-item (click)="onDelete(contextMenuData)">Delete</ui-context-menu-item>
 *   </ui-context-menu-content>
 * </ui-context-menu>
 * 
 * <div 
 *   *ngFor="let item of items; let i = index"
 *   [uiContextMenuAttach]="rowContextMenu"
 *   [contextMenuData]="{ item: item, index: i }"
 *   (contextMenuTriggered)="onContextMenu($event)"
 * >
 *   {{ item.name }}
 * </div>
 */
@Directive({
  selector: '[uiContextMenuAttach]',
  standalone: true,
})
export class ContextMenuAttachDirective<T = any> {
  private elementRef = inject(ElementRef);

  uiContextMenuAttach = input.required<ContextMenuComponent>();
  contextMenuData = input<T | null>(null);
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

    const data = this.contextMenuData();
    this.contextMenuTriggered.emit({
      event,
      item: data!,
    });

    contextMenu.show(event.clientX, event.clientY);
  }
}

/**
 * TreeContextMenuDirective - Specialized directive for Tree nodes
 * 
 * Usage:
 * <ui-context-menu #treeContextMenu>
 *   <ui-context-menu-content>
 *     <ui-context-menu-item (click)="onExpandNode(selectedTreeNode)">Expand</ui-context-menu-item>
 *     <ui-context-menu-item (click)="onCollapseNode(selectedTreeNode)">Collapse</ui-context-menu-item>
 *     <ui-context-menu-separator></ui-context-menu-separator>
 *     <ui-context-menu-item variant="destructive" (click)="onDeleteNode(selectedTreeNode)">Delete</ui-context-menu-item>
 *   </ui-context-menu-content>
 * </ui-context-menu>
 * 
 * <ui-tree 
 *   [data]="treeData"
 *   [uiTreeContextMenu]="treeContextMenu"
 *   (nodeContextMenu)="selectedTreeNode = $event"
 * >
 * </ui-tree>
 */
@Directive({
  selector: 'ui-tree[uiTreeContextMenu]',
  standalone: true,
})
export class TreeContextMenuDirective {
  uiTreeContextMenu = input.required<ContextMenuComponent>();
  contextMenuDisabled = input<boolean>(false);

  nodeContextMenu = output<{ node: any; event: MouseEvent }>();

  private treeElement = inject(ElementRef);

  constructor() {
    this.setupTreeContextMenu();
  }

  private setupTreeContextMenu() {
    const element = this.treeElement.nativeElement;

    element.addEventListener('contextmenu', (event: MouseEvent) => {
      if (this.contextMenuDisabled()) {
        return;
      }

      // Find the closest tree item
      const target = event.target as HTMLElement;
      const treeItem = target.closest('[data-slot="tree-item"]');

      if (treeItem) {
        event.preventDefault();
        event.stopPropagation();

        // Extract node data from the tree item
        const nodeData = this.extractNodeData(treeItem as HTMLElement);

        this.nodeContextMenu.emit({
          node: nodeData,
          event,
        });

        const contextMenu = this.uiTreeContextMenu();
        if (contextMenu) {
          contextMenu.show(event.clientX, event.clientY);
        }
      }
    });
  }

  private extractNodeData(element: HTMLElement): any {
    // Try to get data from data attributes
    const key = element.getAttribute('data-key');
    const expanded = element.getAttribute('data-expanded') === 'true';
    const selected = element.getAttribute('data-selected') === 'true';

    // Get label from nested tree-label
    const labelElement = element.querySelector('[data-slot="tree-label"]');
    const label = labelElement?.textContent?.trim() || '';

    return {
      key,
      label,
      expanded,
      selected,
      element,
    };
  }
}

/**
 * TableContextMenuDirective - Specialized directive for Table rows
 * 
 * Usage:
 * <ui-context-menu #tableContextMenu>
 *   <ui-context-menu-content>
 *     <ui-context-menu-item (click)="onEditRow(selectedTableRow)">Edit</ui-context-menu-item>
 *     <ui-context-menu-item (click)="onDuplicateRow(selectedTableRow)">Duplicate</ui-context-menu-item>
 *     <ui-context-menu-separator></ui-context-menu-separator>
 *     <ui-context-menu-item variant="destructive" (click)="onDeleteRow(selectedTableRow)">Delete</ui-context-menu-item>
 *   </ui-context-menu-content>
 * </ui-context-menu>
 * 
 * <table ui-table [uiTableContextMenu]="tableContextMenu" (rowContextMenu)="selectedTableRow = $event">
 *   ...
 * </table>
 */
@Directive({
  selector: 'table[uiTableContextMenu], [uiTable]',
  standalone: true,
})
export class TableContextMenuDirective {
  uiTableContextMenu = input<ContextMenuComponent | null>(null);
  contextMenuDisabled = input<boolean>(false);
  rowDataAttribute = input<string>('data-row');

  rowContextMenu = output<{ row: any; index: number; event: MouseEvent }>();
  cellContextMenu = output<{ row: any; column: string; index: number; event: MouseEvent }>();

  private tableElement = inject(ElementRef);

  constructor() {
    this.setupTableContextMenu();
  }

  private setupTableContextMenu() {
    const element = this.tableElement.nativeElement;

    element.addEventListener('contextmenu', (event: MouseEvent) => {
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
            contextMenu.show(event.clientX, event.clientY);
          }
        }
      }
    });
  }

  private extractRowData(rowElement: HTMLElement, cellElement: HTMLElement): { data: any; index: number; column: string } {
    // Get row index
    const indexAttr = rowElement.getAttribute('data-row-index') || rowElement.getAttribute('data-index');
    const index = indexAttr ? parseInt(indexAttr, 10) : 0;

    // Get row data from attribute
    const dataAttr = rowElement.getAttribute(this.rowDataAttribute());
    let data: any = {};

    if (dataAttr) {
      try {
        data = JSON.parse(dataAttr);
      } catch {
        data = { value: dataAttr };
      }
    }

    // Get column name
    const columnAttr = cellElement.getAttribute('data-column') || (cellElement as HTMLTableCellElement).cellIndex;
    const column = typeof columnAttr === 'string' ? columnAttr : `column_${columnAttr}`;

    return { data, index, column };
  }
}

/**
 * DataTableContextMenuDirective - Specialized directive for Data Table component
 * 
 * Usage:
 * <ui-data-table 
 *   [data]="tableData"
 *   [columns]="columns"
 *   [uiDataTableContextMenu]="tableContextMenu"
 *   (rowContextMenu)="onRowContextMenu($event)"
 * >
 * </ui-data-table>
 */
@Directive({
  selector: 'ui-data-table[uiDataTableContextMenu]',
  standalone: true,
})
export class DataTableContextMenuDirective {
  uiDataTableContextMenu = input.required<ContextMenuComponent>();
  contextMenuDisabled = input<boolean>(false);
  contextMenuRowsOnly = input<boolean>(true);

  rowContextMenu = output<{ row: any; index: number; event: MouseEvent }>();
  headerContextMenu = output<{ column: any; event: MouseEvent }>();

  private tableElement = inject(ElementRef);

  constructor() {
    this.setupDataTableContextMenu();
  }

  private setupDataTableContextMenu() {
    const element = this.tableElement.nativeElement;

    element.addEventListener('contextmenu', (event: MouseEvent) => {
      if (this.contextMenuDisabled()) {
        return;
      }

      const target = event.target as HTMLElement;

      // Check for row context menu
      const row = target.closest('[data-slot="data-table-row"], tr[data-row-index]');
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
          contextMenu.show(event.clientX, event.clientY);
        }
        return;
      }

      // Check for header context menu
      if (!this.contextMenuRowsOnly()) {
        const header = target.closest('[data-slot="data-table-header"], th');
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
            contextMenu.show(event.clientX, event.clientY);
          }
        }
      }
    });
  }

  private extractDataTableRow(rowElement: HTMLElement): { data: any; index: number } {
    const indexAttr = rowElement.getAttribute('data-row-index');
    const index = indexAttr ? parseInt(indexAttr, 10) : 0;

    // Try to get data from element
    const dataStr = rowElement.getAttribute('data-row');
    let data: any = {};

    if (dataStr) {
      try {
        data = JSON.parse(dataStr);
      } catch {
        // If can't parse, create simple object
        data = { id: dataStr };
      }
    }

    return { data, index };
  }

  private extractHeaderData(headerElement: HTMLElement): any {
    const columnId = headerElement.getAttribute('data-column-id');
    const columnName = headerElement.textContent?.trim() || '';

    return {
      id: columnId,
      name: columnName,
      element: headerElement,
    };
  }
}

// Export all directives
export const ContextMenuIntegrations = [
  ContextMenuAttachDirective,
  TreeContextMenuDirective,
  TableContextMenuDirective,
  DataTableContextMenuDirective,
];
