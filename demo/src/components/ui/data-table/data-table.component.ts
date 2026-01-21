import {
  Component,
  computed,
  input,
  output,
  model,
  signal,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  Type,
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
import { ButtonComponent } from '../button.component';
import { PopoverComponent, PopoverTriggerComponent, PopoverContentComponent } from '../popover.component';
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
    ButtonComponent,
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
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
                  [class.overflow-visible]="col.enableFiltering && col.filterComponent"
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
                    <div class="flex items-center gap-2">
                      <ui-data-table-column-header
                        [title]="col.header"
                        [column]="toString(col.accessorKey)"
                        [direction]="getSortDirection(col.accessorKey)"
                        (sort)="onSortChange(col.accessorKey, $event)"
                      />
                      @if (col.enableFiltering && col.filterComponent) {
                        <ui-popover>
                          <ui-popover-trigger>
                            <button 
                              class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 w-8"
                              [attr.aria-label]="'Filter ' + col.header"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-filter" aria-hidden="true">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                              </svg>
                            </button>
                          </ui-popover-trigger>
                          <ui-popover-content class="w-80">
                            <div 
                              [uiCellHost]="col.filterComponent" 
                              [inputs]="col.filterComponentInputs || {}"
                              [outputs]="getFilterOutputs(col)"
                            ></div>
                          </ui-popover-content>
                        </ui-popover>
                      }
                    </div>
                  } @else {
                    <div class="flex items-center gap-2">
                      <span>{{ col.header }}</span>
                      @if (col.enableFiltering && col.filterComponent) {
                        <ui-popover>
                          <ui-popover-trigger>
                            <button 
                              class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 w-8"
                              [attr.aria-label]="'Filter ' + col.header"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-filter" aria-hidden="true">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                              </svg>
                            </button>
                          </ui-popover-trigger>
                          <ui-popover-content class="w-80">
                            <div 
                              [uiCellHost]="col.filterComponent" 
                              [inputs]="col.filterComponentInputs || {}"
                              [outputs]="getFilterOutputs(col)"
                            ></div>
                          </ui-popover-content>
                        </ui-popover>
                      }
                    </div>
                  }
                </ui-table-head>
              }
              @if (!hasFlexibleColumns()) {
                <ui-table-head 
                  class="flex-1 pointer-events-none"
                  [class]="getHeaderClass({ _width: 'auto' })"
                ></ui-table-head>
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
                  @if (!hasFlexibleColumns()) {
                    <ui-table-cell 
                      class="flex-1 pointer-events-none"
                      [class]="getCellClass({ _width: 'auto' })"
                    ></ui-table-cell>
                  }
                </ui-table-row>
              }
            } @else {
              <ui-table-row class="hover:bg-transparent justify-center w-full">
                <ui-table-cell class="h-96 text-center w-full p-0 border-none justify-center">
                  @if (emptyStateComponent()) {
                    <ng-container [uiCellHost]="emptyStateComponent()" [inputs]="emptyStateComponentInputs()"></ng-container>
                  } @else {
                    <div class="flex h-full flex-col items-center justify-center py-10 text-center text-muted-foreground w-full">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-4 h-10 w-10 opacity-20">
                        <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                      </svg>
                      <p>No results found.</p>
                    </div>
                  }
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

  emptyStateComponent = input<Type<unknown>>();
  emptyStateComponentInputs = input<Record<string, unknown>>({});

  globalFilter = signal('');
  columnFilters = signal<Record<string, any>>({});
  sortState = signal<SortState>({ column: '', direction: null });
  paginationState = signal<PaginationState>({ pageIndex: 0, pageSize: 10 });

  filteredData = computed(() => {
    let data = this.data();
    if (!this.localFiltering()) return data;

    // Apply global filter
    const globalFilterValue = this.globalFilter().toLowerCase();
    if (globalFilterValue) {
      data = data.filter((row) =>
        Object.values(row as any).some((val) =>
          String(val).toLowerCase().includes(globalFilterValue)
        )
      );
    }

    // Apply column-specific filters
    const colFilters = this.columnFilters();
    const columns = this.enhancedColumns();

    Object.keys(colFilters).forEach(columnKey => {
      const filterValue = colFilters[columnKey];
      if (this.isFilterValueEmpty(filterValue)) return;

      const column = columns.find(col => col.accessorKey === columnKey);
      if (!column || !column.enableFiltering) return;

      if (column.filterFn) {
        // Use custom filter function
        data = data.filter(row => column.filterFn!(row, filterValue));
      } else {
        // Default filter: check if cell value includes filter value
        data = data.filter(row => {
          const cellValue = this.getCellValue(row, columnKey);
          return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
        });
      }
    });

    return data;
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

  hasColumnFilters = computed(() => {
    return this.enhancedColumns().some(col => col.enableFiltering);
  });

  hasFlexibleColumns = computed(() => {
    return this.enhancedColumns().some(col => col._width === 'auto');
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
    const width = col._width;
    const isAuto = width === 'auto';

    const style: any = {
      // For auto width, use flax-basis 0 to ensure equal distribution regardless of content
      width: isAuto ? '0px' : width,
      minWidth: isAuto ? '0px' : width,
      maxWidth: isAuto ? 'none' : width,
      flexShrink: isAuto ? '1' : '0',
      flexGrow: isAuto ? '1' : '0',
      flexBasis: isAuto ? '0px' : 'auto'
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

  onColumnFilterChange(columnKey: string | keyof T, value: any) {
    this.columnFilters.update(filters => ({
      ...filters,
      [columnKey]: value
    }));
  }

  getFilterOutputs(col: ColumnDef<T>): Record<string, (event: any) => void> {
    return {
      ...col.filterComponentOutputs,
      filterChange: (value: any) => this.onColumnFilterChange(col.accessorKey, value)
    };
  }

  private isFilterValueEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }

  toString(key: string | keyof T): string {
    return String(key);
  }

  getCellValue(row: T, key: string | keyof T): any {
    return (row as any)[key];
  }
}
