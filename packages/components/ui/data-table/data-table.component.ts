import {
  Component,
  computed,
  input,
  output,
  model,
  signal,
  ChangeDetectionStrategy,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TableComponent,
  TableHeaderComponent,
  TableBodyComponent,
  TableRowComponent,
  TableHeadComponent,
  TableCellComponent
} from '../table.component';
import { InputComponent } from '../input.component';
import { CheckboxComponent } from '../checkbox.component';
import { DataTableColumnHeaderComponent } from './data-table-column-header.component';
import { DataTablePaginationComponent } from './data-table-pagination.component';
import { CellHostDirective } from './cell-host.directive';
import { ColumnDef, SortState, SortDirection, PaginationState } from './data-table.types';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-data-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableComponent,
    TableHeaderComponent,
    TableBodyComponent,
    TableRowComponent,
    TableHeadComponent,
    TableCellComponent,
    InputComponent,
    CheckboxComponent,
    DataTableColumnHeaderComponent,
    DataTablePaginationComponent,
    CellHostDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'block h-full w-full',
  },
  template: `
    <div class="flex flex-col w-full h-full space-y-4">
      @if (showToolbar()) {
        <div class="flex items-center justify-between flex-none">
          <div class="flex flex-1 items-center space-x-2">
            <ui-input
              placeholder="Filter..."
              [ngModel]="globalFilter()"
              (ngModelChange)="onFilterChange($event)"
              class="h-8 w-[150px] lg:w-[250px]"
            />
          </div>
        </div>
      }

      <div class="rounded-md border relative flex-1 min-h-0 overflow-auto w-full">
        <ui-table>
          <ui-table-header class="bg-background">
            <ui-table-row>
              @for (col of enhancedColumns(); track col.accessorKey) {
                <ui-table-head 
                  [class]="getHeaderClass(col)"
                  [style]="getCellStyle(col, true)"
                >
                  @if (col.accessorKey === '_selection') {
                    <ui-checkbox 
                      [checked]="isAllSelected()"
                      [indeterminate]="isIndeterminate()"
                      (checkedChange)="toggleAll()"
                      ariaLabel="Select all"
                    />
                  } @else if (col.headerTemplate) {
                    <ng-container *ngTemplateOutlet="col.headerTemplate; context: { $implicit: col }"></ng-container>
                  } @else if (col.enableSorting !== false) {
                    <ui-data-table-column-header
                      [title]="col.header"
                      [column]="toString(col.accessorKey)"
                      [direction]="getSortDirection(col.accessorKey)"
                      (sort)="onSortChange(col.accessorKey, $event)"
                    />
                  } @else {
                    {{ col.header }}
                  }
                </ui-table-head>
              }
            </ui-table-row>
          </ui-table-header>
          <ui-table-body>
            @if (processedData().length > 0) {
              @for (row of processedData(); track row) {
                <ui-table-row 
                  [attr.data-state]="isRowSelected(row) ? 'selected' : null"
                  class="border-0"
                >
                  @for (col of enhancedColumns(); track col.accessorKey) {
                    <ui-table-cell
                      [class]="getCellClass(col)"
                      [style]="getCellStyle(col)"
                    >
                      @if (col.accessorKey === '_selection') {
                        <ui-checkbox 
                          [checked]="isRowSelected(row)"
                          (checkedChange)="toggleRow(row)"
                          ariaLabel="Select row"
                        />
                      } @else if (col.component) {
                        <div 
                          [uiCellHost]="col.component" 
                          [inputs]="col.componentInputs ? col.componentInputs(row) : {}"
                          [outputs]="col.componentOutputs ? col.componentOutputs(row) : {}"
                        ></div>
                      } @else if (col.template) {
                        <ng-container *ngTemplateOutlet="col.template; context: { $implicit: row }"></ng-container>
                      } @else if (col.cell) {
                         {{ col.cell(row) }}
                      } @else {
                        {{ getCellValue(row, col.accessorKey) }}
                      }
                    </ui-table-cell>
                  }
                </ui-table-row>
              }
            } @else {
              <ui-table-row>
                <ui-table-cell [attr.colspan]="columns().length" class="h-24 text-center">
                  No results.
                </ui-table-cell>
              </ui-table-row>
            }
            <ui-table-row class="h-full">
              @for (col of enhancedColumns(); track col.accessorKey) {
                <ui-table-cell
                  [class]="getCellClass(col)"
                  [style]="getCellStyle(col)"
                  class="bg-background border-0 p-0"
                ></ui-table-cell>
              }
            </ui-table-row>
          </ui-table-body>
        </ui-table>
      </div>

      @if (showPagination()) {
        <ui-data-table-pagination
          class="flex-none"
          [total]="activeTotalItems()"
          [state]="paginationState()"
          (paginationChange)="onPaginationChange($event)"
        />
      }
    </div>
  `,
})
export class DataTableComponent<T> {
  data = input.required<T[]>();
  columns = input.required<ColumnDef<T>[]>();

  showToolbar = input(true);
  showPagination = input(true);
  showRowBorders = input(true);
  showColumnBorders = input(true);

  localSorting = input(true);
  localPagination = input(true);
  localFiltering = input(true);
  total = input(0);

  sortChange = output<SortState>();
  pageChange = output<PaginationState>();
  filterChange = output<string>();

  enableRowSelection = input(false);
  rowSelection = model<Record<string, boolean>>({});
  getRowId = input<(row: T) => string>((row: any) => row.id ?? String(JSON.stringify(row)));

  globalFilter = signal('');
  sortState = signal<SortState>({ column: '', direction: null });
  paginationState = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });

  filteredData = computed(() => {
    const data = this.data();
    if (!this.localFiltering()) return data;

    const filter = this.globalFilter().toLowerCase();
    if (!filter) return data;

    return data.filter((row) =>
      Object.values(row as any).some((val) =>
        String(val).toLowerCase().includes(filter)
      )
    );
  });

  sortedData = computed(() => {
    const data = [...this.filteredData()];
    if (!this.localSorting()) return data;

    const sort = this.sortState();
    if (!sort.direction || !sort.column) return data;

    const column = this.enhancedColumns().find(col => col.accessorKey === sort.column);

    return data.sort((a, b) => {
      if (column?.sortFn) {
        const result = column.sortFn(a, b);
        return sort.direction === 'asc' ? result : -result;
      }

      const aVal = this.getCellValue(a, sort.column);
      const bVal = this.getCellValue(b, sort.column);

      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  });

  processedData = computed(() => {
    const data = this.sortedData();
    if (!this.localPagination()) return data;

    const { pageIndex, pageSize } = this.paginationState();
    const start = pageIndex * pageSize;
    return data.slice(start, start + pageSize);
  });

  activeTotalItems = computed(() =>
    this.localPagination() ? this.filteredData().length : this.total()
  );

  getSortDirection(columnKey: string | keyof T): SortDirection {
    const sort = this.sortState();
    return sort.column === columnKey ? sort.direction : null;
  }

  onSortChange(columnKey: string | keyof T, direction: SortDirection) {
    const newState = { column: String(columnKey), direction };
    this.sortState.set(newState);
    this.sortChange.emit(newState);
  }

  enhancedColumns = computed(() => {
    const cols = this.columns();
    let computedCols = [...cols];

    if (this.enableRowSelection()) {
      const selectionCol: ColumnDef<T> = {
        accessorKey: '_selection',
        header: '',
        sticky: true,
        width: '40px'
      };
      computedCols = [selectionCol, ...cols];
    }

    let currentLeft = 0;
    return computedCols.map(col => {
      const isSticky = col.sticky === true;
      const widthStr = col.width || '150px';
      const widthVal = parseInt(widthStr, 10) || 150;

      const columnData = {
        ...col,
        _stickyLeft: isSticky ? currentLeft : undefined,
        _width: widthStr
      };

      if (isSticky) {
        currentLeft += widthVal;
      }

      return columnData;
    });
  });

  getHeaderClass(col: any) {
    return cn(
      'sticky top-0 bg-background shadow-sm',
      col.sticky ? 'z-30' : 'z-20',
      this.showColumnBorders() && 'border-r'
    );
  }

  getCellClass(col: any) {
    return cn(
      'bg-background',
      this.showRowBorders() && 'border-b',
      this.showColumnBorders() && 'border-r'
    );
  }

  getCellStyle(col: any, isHeader = false) {
    const style: any = {
      width: col._width,
      minWidth: col._width,
      maxWidth: col._width,
      flexShrink: '0',
      flexGrow: '0'
    };

    if (col.sticky) {
      style.position = 'sticky';
      style.left = `${col._stickyLeft}px`;
      style.zIndex = isHeader ? '30' : '10';
    }

    if (isHeader) {
      style.position = 'sticky';
      style.top = '0';
      style.zIndex = col.sticky ? '30' : '20';
    }

    return style;
  }

  isRowSelected(row: T): boolean {
    const id = this.getRowId()(row);
    return !!this.rowSelection()[id];
  }

  toggleRow(row: T) {
    const id = this.getRowId()(row);
    const current = this.rowSelection();
    const isSelected = !!current[id];

    const newSelection = { ...current };
    if (isSelected) {
      delete newSelection[id];
    } else {
      newSelection[id] = true;
    }
    this.rowSelection.set(newSelection);
  }

  toggleAll() {
    const data = this.filteredData();
    if (this.isAllSelected()) {
      this.rowSelection.set({});
    } else {
      const newSelection: Record<string, boolean> = {};
      data.forEach(row => {
        newSelection[this.getRowId()(row)] = true;
      });
      this.rowSelection.set(newSelection);
    }
  }

  private selectionCount = computed(() => Object.keys(this.rowSelection()).length);

  isAllSelected = computed(() => {
    const dataLength = this.filteredData().length;
    if (dataLength === 0) return false;
    return this.selectionCount() === dataLength;
  });

  isIndeterminate = computed(() => {
    const count = this.selectionCount();
    return count > 0 && count < this.filteredData().length;
  });

  onPaginationChange(state: PaginationState) {
    this.paginationState.set(state);
    this.pageChange.emit(state);
  }

  onFilterChange(value: string) {
    this.globalFilter.set(value);
    this.filterChange.emit(value);
  }

  toString(key: string | keyof T): string {
    return String(key);
  }

  getCellValue(row: T, key: string | keyof T): any {
    return (row as any)[key];
  }
}
