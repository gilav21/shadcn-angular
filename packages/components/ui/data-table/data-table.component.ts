import {
  Component,
  computed,
  effect,
  input,
  output,
  model,
  signal,
  ChangeDetectionStrategy,
  Type,
  TemplateRef,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { isRtl } from '../../lib/utils';
import { generateXlsx } from '../../lib/xlsx';
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
import { PopoverComponent, PopoverTriggerComponent, PopoverContentComponent } from '../popover.component';
import { DataTableColumnHeaderComponent } from './data-table-column-header.component';
import { DataTablePaginationComponent } from './data-table-pagination.component';
import { UiComponentOutletDirective } from '../component-outlet.directive';
import {
  ColumnDef,
  SortState,
  SortDirection,
  PaginationState,
  ColumnResizeEvent,
  DataTableColumnState,
  DataTableLoadingTrigger,
  DataTableLoadingVisibility,
  DataTableExportOptions,
} from './data-table.types';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-data-table',
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
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
    DataTableColumnHeaderComponent,
    DataTablePaginationComponent,
    UiComponentOutletDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
          @if (showColumnVisibilityToggle() && hideableColumns().length > 0) {
            <ui-popover>
              <ui-popover-trigger>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 h-8 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  aria-label="Toggle columns"
                >
                  Columns
                </button>
              </ui-popover-trigger>
              <ui-popover-content class="w-56 p-2">
                <div class="space-y-1">
                  @for (col of hideableColumns(); track col.accessorKey) {
                    <label class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
                      <ui-checkbox
                        [checked]="isColumnVisible(col.accessorKey)"
                        (checkedChange)="setColumnVisibility(col.accessorKey, $event)"
                        [ariaLabel]="'Toggle ' + col.header + ' column'"
                      />
                      <span>{{ col.header }}</span>
                    </label>
                  }
                </div>
              </ui-popover-content>
            </ui-popover>
          }
        </div>
      }

      <div class="rounded-md border relative flex-1 min-h-0 overflow-auto w-full" (keydown)="onTableKeydown($event)" (click)="onTableClick()" tabindex="0">
        @if (isLoaderVisible()) {
          <div class="absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
            @if (loaderTemplate()) {
              <ng-container
                *ngTemplateOutlet="loaderTemplate(); context: { $implicit: loadingTrigger(), trigger: loadingTrigger() }"
              ></ng-container>
            } @else if (loaderComponent()) {
              <ng-container
                [uiComponentOutlet]="loaderComponent()"
                [inputs]="resolvedLoaderComponentInputs()"
              ></ng-container>
            } @else {
              <div class="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"></span>
                <span>Loading...</span>
              </div>
            }
          </div>
        }
        @if (exporting()) {
          <div class="absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
            <div class="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
              <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"></span>
              <span>Exporting...</span>
            </div>
          </div>
        }
        <ui-table>
          <ui-table-header class="bg-background">
            <ui-table-row>
              @for (col of enhancedColumns(); track col.accessorKey) {
                <ui-table-head 
                  [class]="getHeaderClass(col)"
                  [class.overflow-visible]="col.enableFiltering && col.filterComponent"
                  [class.cursor-grab]="isColumnDraggable(col)"
                  [class.cursor-grabbing]="isDraggingColumn(col)"
                  [class.opacity-70]="isDraggingColumn(col)"
                  [class.relative]="isDropTargetColumn(col)"
                  [attr.data-column-id]="toString(col.accessorKey)"
                  [attr.draggable]="isColumnDraggable(col) ? 'true' : null"
                  [style]="getCellStyle(col, true)"
                  (dragstart)="onColumnDragStart($event, col)"
                  (dragover)="onColumnDragOver($event, col)"
                  (drop)="onColumnDrop($event, col)"
                  (dragend)="onColumnDragEnd()"
                >
                  @if (isDropTargetColumn(col)) {
                    <div class="pointer-events-none absolute inset-0 z-30 border-2 border-primary/70 bg-primary/10"></div>
                  }
                  <div class="flex items-center w-full h-full">
                    <div class="flex-1 min-w-0">
                      @if (col.accessorKey === '_selection') {
                        <ui-checkbox 
                          [checked]="isAllSelected()"
                          [indeterminate]="isIndeterminate()"
                          (checkedChange)="toggleAll()"
                          ariaLabel="Select all"
                        />
                      } @else if (col.accessorKey === '_expander') {
                        <span class="sr-only">Expand row</span>
                      } @else if (col.headerTemplate) {
                        <ng-container *ngTemplateOutlet="col.headerTemplate; context: { $implicit: col }"></ng-container>
                      } @else if (col.enableSorting !== false) {
                        <div class="flex items-center gap-2">
                          <ui-data-table-column-header
                            [title]="col.header"
                            [column]="toString(col.accessorKey)"
                            [direction]="getSortDirection(col.accessorKey)"
                            [sortIndex]="getSortIndex(col.accessorKey)"
                            (sortMeta)="onSortChange(col.accessorKey, $event.direction, $event.multi)"
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
                                  [uiComponentOutlet]="col.filterComponent" 
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
                                  [uiComponentOutlet]="col.filterComponent" 
                                  [inputs]="col.filterComponentInputs || {}"
                                  [outputs]="getFilterOutputs(col)"
                                ></div>
                              </ui-popover-content>
                            </ui-popover>
                          }
                        </div>
                      }
                    </div>
                  </div>
                  @if (enableColumnResize() && col.accessorKey !== '_selection' && col._width !== 'auto') {
                    <div 
                      class="absolute top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary/70 z-40 select-none"
                      [class.right-0]="!isRtl()"
                      [class.translate-x-1/2]="!isRtl()"
                      [class.left-0]="isRtl()"
                      [class.-translate-x-1/2]="isRtl()"
                      (mousedown)="onResizeStart($event, col)"
                      (touchstart)="onResizeTouchStart($event, col)"
                      role="separator"
                      [attr.aria-label]="'Resize ' + col.header + ' column'"
                    ></div>
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
              @for (row of processedData(); track getRowId()(row); let i = $index) {
                <ui-table-row 
                  [attr.data-state]="isRowSelected(row) ? 'selected' : null"
                  [attr.data-row-index]="i"
                  [attr.data-row-id]="getRowId()(row)"
                  class="border-0"
                >
                  @for (col of enhancedColumns(); track col.accessorKey) {
                    <ui-table-cell
                      [class]="getCellClass(col, i)"
                      [attr.data-column]="toString(col.accessorKey)"
                      [style]="getCellStyle(col)"
                      (click)="onCellClick(i, col, $event)"
                    >
                      @if (col.accessorKey === '_selection') {
                        <ui-checkbox 
                          [checked]="isRowSelected(row)"
                          (checkedChange)="toggleRow(row)"
                          ariaLabel="Select row"
                        />
                      } @else if (col.accessorKey === '_expander') {
                        <button
                          type="button"
                          class="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                          [attr.aria-label]="isRowExpanded(row) ? 'Collapse row' : 'Expand row'"
                          [attr.aria-expanded]="isRowExpanded(row)"
                          (click)="toggleRowExpanded(row, $event)"
                        >
                          @if (isRowExpanded(row)) {
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          }
                        </button>
                      } @else if (col.component) {
                        <div 
                          [uiComponentOutlet]="col.component" 
                          [inputs]="col.componentInputs ? col.componentInputs(row) : {}"
                          [outputs]="col.componentOutputs ? col.componentOutputs(row) : {}"
                        ></div>
                      } @else if (col.template) {
                        <ng-container *ngTemplateOutlet="col.template; context: { $implicit: row }"></ng-container>
                      } @else if (col.cell) {
                         {{ col.cell(row) }}
                      } @else {
                        {{ getCellValue(row, col.accessorKey, col) }}
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
                @if (enableRowExpansion() && isRowExpanded(row)) {
                  <ui-table-row class="border-0 bg-muted/20">
                    <ui-table-cell class="flex-1 border-b" style="min-width: 0; max-width: none; width: 100%; flex-basis: 100%;">
                      @if (rowDetailTemplate()) {
                        <ng-container
                          *ngTemplateOutlet="rowDetailTemplate(); context: { $implicit: row, row: row }"
                        ></ng-container>
                      } @else if (rowDetailComponent()) {
                        <div
                          [uiComponentOutlet]="rowDetailComponent()"
                          [inputs]="getRowDetailComponentInputs(row)"
                        ></div>
                      } @else {
                        <pre class="text-xs text-muted-foreground whitespace-pre-wrap">{{ row | json }}</pre>
                      }
                    </ui-table-cell>
                  </ui-table-row>
                }
              }
            } @else {
              <ui-table-row class="hover:bg-transparent justify-center w-full">
                <ui-table-cell class="h-96 text-center w-full p-0 border-none justify-center">
                  @if (emptyStateComponent()) {
                    <ng-container [uiComponentOutlet]="emptyStateComponent()" [inputs]="emptyStateComponentInputs()"></ng-container>
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
          [pageSizeOptions]="pageSizeOptions()"
          [showPageSizeSelector]="showPageSizeSelector()"
          (paginationChange)="onPaginationChange($event)"
        />
      }
    </div>
  `,
})
export class DataTableComponent<T> {
  private _document = inject(DOCUMENT);
  private _el = inject(ElementRef);
  isRtl() {
    return isRtl(this._el.nativeElement);
  }
  private _isRtlResize = false;

  data = input.required<T[]>();
  columns = input.required<ColumnDef<T>[]>();

  showToolbar = input(true);
  showColumnVisibilityToggle = input(true);
  showPagination = input(true);
  showRowBorders = input(true);
  showColumnBorders = input(true);

  localSorting = input(true);
  localPagination = input(true);
  localFiltering = input(true);
  loading = input(false);
  loadingVisibility = input<DataTableLoadingVisibility>({
    initial: true,
    pagination: true,
    sorting: true,
    filtering: true,
  });
  loaderTemplate = input<TemplateRef<unknown>>();
  loaderComponent = input<Type<unknown>>();
  loaderComponentInputs = input<Record<string, unknown>>({});
  globalFilterFn = input<((row: T, filterValue: string, columns: ColumnDef<T>[]) => boolean) | undefined>(undefined);
  enableMultiSort = input(false);
  maxMultiSortColumns = input(3);
  total = input(0);

  sortChange = output<SortState>();
  multiSortChange = output<SortState[]>();
  pageChange = output<PaginationState>();
  filterChange = output<string>();

  enableRowSelection = input(false);
  rowSelection = model<Record<string, boolean>>({});
  getRowId = input<(row: T) => string>((row: any) => row.id ?? String(JSON.stringify(row)));
  enableCopy = input(true);
  enableRowExpansion = input(false);
  expandedRows = model<Record<string, boolean>>({});
  rowDetailTemplate = input<TemplateRef<unknown>>();
  rowDetailComponent = input<Type<unknown>>();
  rowDetailComponentInputs = input<((row: T) => Record<string, unknown>) | undefined>(undefined);

  enableColumnResize = input(false);
  enableColumnReorder = input(false);
  columnResize = output<ColumnResizeEvent>();

  exportDataProvider = input<(() => Promise<T[]>) | undefined>(undefined);

  emptyStateComponent = input<Type<unknown>>();
  emptyStateComponentInputs = input<Record<string, unknown>>({});

  exporting = signal(false);
  globalFilter = signal('');
  columnFilters = signal<Record<string, any>>({});
  sortState = signal<SortState>({ column: '', direction: null });
  multiSortState = signal<SortState[]>([]);
  paginationState = model<PaginationState>({ pageIndex: 0, pageSize: 10 });
  pageSizeOptions = input<number[]>([10, 20, 30, 40, 50]);
  showPageSizeSelector = input(true);
  columnWidths = signal<Record<string, string>>({});
  columnVisibility = model<Record<string, boolean>>({});
  columnOrder = model<string[]>([]);
  loadingTrigger = signal<DataTableLoadingTrigger>('initial');
  focusedCell = signal<{ rowIndex: number; columnKey: string } | null>(null);
  draggedColumnKey = signal<string | null>(null);
  dropTargetColumnKey = signal<string | null>(null);
  isLoaderVisible = computed(() => this.loading() && this.shouldShowLoaderFor(this.loadingTrigger()));
  resolvedLoaderComponentInputs = computed(() => ({
    ...this.loaderComponentInputs(),
    trigger: this.loadingTrigger(),
  }));

  filteredData = computed(() => {
    let data = this.data();
    if (!this.localFiltering()) return data;

    const globalFilterValue = this.globalFilter().toLowerCase();
    if (globalFilterValue) {
      const columns = this.enhancedColumns().filter(col => col.accessorKey !== '_selection' && col.accessorKey !== '_expander');
      const globalFilterFn = this.globalFilterFn();
      if (globalFilterFn) {
        data = data.filter(row => globalFilterFn(row, globalFilterValue, columns));
      } else {
        const globallyFilterableColumns = columns.filter(col => col.enableGlobalFilter !== false);
        data = data.filter((row) =>
          globallyFilterableColumns.some((col) => {
            const value = this.getCellValue(row, col.accessorKey, col);
            return String(value).toLowerCase().includes(globalFilterValue);
          })
        );
      }
    }

    const colFilters = this.columnFilters();
    const columns = this.enhancedColumns();

    Object.keys(colFilters).forEach(columnKey => {
      const filterValue = colFilters[columnKey];
      if (this.isFilterValueEmpty(filterValue)) return;

      const column = columns.find(col => col.accessorKey === columnKey);
      if (!column || !column.enableFiltering) return;

      if (column.filterFn) {
        data = data.filter(row => column.filterFn!(row, filterValue));
      } else {
        data = data.filter(row => {
          const cellValue = this.getCellValue(row, columnKey, column);
          return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
        });
      }
    });

    return data;
  });

  sortedData = computed(() => {
    const data = [...this.filteredData()];
    if (!this.localSorting()) return data;

    const sorts = this.activeSorts();
    if (sorts.length === 0) return data;

    return data.sort((a, b) => {
      for (const sort of sorts) {
        const column = this.enhancedColumns().find(col => col.accessorKey === sort.column);
        if (!column || !sort.direction) {
          continue;
        }

        let result = 0;
        if (column.sortFn) {
          result = column.sortFn(a, b);
        } else {
          const aVal = this.getCellValue(a, sort.column, column);
          const bVal = this.getCellValue(b, sort.column, column);
          if (aVal < bVal) result = -1;
          if (aVal > bVal) result = 1;
        }

        if (result !== 0) {
          return sort.direction === 'asc' ? result : -result;
        }
      }

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
  private filteredRowIds = computed(() => this.filteredData().map(row => this.getRowId()(row)));
  private filteredSelectionCount = computed(() => {
    const selected = this.rowSelection();
    let count = 0;
    this.filteredRowIds().forEach(id => {
      if (selected[id]) {
        count += 1;
      }
    });
    return count;
  });

  constructor() {
    effect(() => {
      if (!this.localPagination()) {
        return;
      }

      const { pageIndex, pageSize } = this.paginationState();
      const sanitizedPageSize = pageSize > 0 ? pageSize : 10;
      const totalItems = this.filteredData().length;
      const maxPageIndex = Math.max(0, Math.ceil(totalItems / sanitizedPageSize) - 1);
      const clampedPageIndex = Math.min(maxPageIndex, Math.max(0, pageIndex));

      if (sanitizedPageSize !== pageSize || clampedPageIndex !== pageIndex) {
        this.paginationState.set({
          pageIndex: clampedPageIndex,
          pageSize: sanitizedPageSize,
        });
      }
    });
  }

  activeSorts = computed(() => {
    if (this.enableMultiSort()) {
      return this.multiSortState().filter(sort => !!sort.column && !!sort.direction);
    }

    const sort = this.sortState();
    if (!sort.column || !sort.direction) {
      return [];
    }
    return [sort];
  });

  getSortDirection(columnKey: string | keyof T): SortDirection {
    const activeSort = this.activeSorts().find(sort => sort.column === String(columnKey));
    return activeSort?.direction ?? null;
  }

  getSortIndex(columnKey: string | keyof T): number | null {
    if (!this.enableMultiSort()) {
      return null;
    }

    const index = this.activeSorts().findIndex(sort => sort.column === String(columnKey));
    return index === -1 ? null : index;
  }

  onSortChange(columnKey: string | keyof T, direction: SortDirection, multi = false) {
    this.loadingTrigger.set('sorting');
    const key = String(columnKey);
    const currentPagination = this.paginationState();
    const shouldResetPage = currentPagination.pageIndex !== 0;

    if (this.enableMultiSort() && multi) {
      const existing = this.multiSortState().filter(sort => sort.column !== key);
      const next = direction ? [...existing, { column: key, direction }] : existing;
      const maxColumns = Math.max(1, this.maxMultiSortColumns());
      const trimmed = next.slice(-maxColumns);
      const primary = trimmed[0] ?? { column: '', direction: null as SortDirection };

      this.multiSortState.set(trimmed);
      this.sortState.set(primary);
      this.multiSortChange.emit(trimmed);
      this.sortChange.emit(primary);
      if (shouldResetPage) {
        const nextPage = { ...currentPagination, pageIndex: 0 };
        this.paginationState.set(nextPage);
        this.pageChange.emit(nextPage);
      }
      return;
    }

    const newState = { column: key, direction };
    this.sortState.set(newState);
    this.sortChange.emit(newState);

    if (this.enableMultiSort()) {
      const next = direction ? [newState] : [];
      this.multiSortState.set(next);
      this.multiSortChange.emit(next);
    }

    if (shouldResetPage) {
      const nextPage = { ...currentPagination, pageIndex: 0 };
      this.paginationState.set(nextPage);
      this.pageChange.emit(nextPage);
    }
  }

  enhancedColumns = computed(() => {
    const cols = this.columns();
    const widths = this.columnWidths();
    const visibleCols = this.applyColumnOrder(cols.filter(col => this.isColumnVisible(col.accessorKey)));
    let computedCols = [...visibleCols];

    if (this.enableRowSelection()) {
      const selectionCol: ColumnDef<T> = {
        accessorKey: '_selection',
        header: '',
        sticky: true,
        width: '40px'
      };
      computedCols = [selectionCol, ...visibleCols];
    }

    if (this.enableRowExpansion()) {
      const expanderCol: ColumnDef<T> = {
        accessorKey: '_expander',
        header: '',
        sticky: true,
        width: '40px',
        enableSorting: false,
      };
      computedCols = [expanderCol, ...computedCols];
    }

    let currentLeft = 0;
    let currentRight = 0;
    const rightOffsets = new Map<number, number>();

    for (let i = computedCols.length - 1; i >= 0; i -= 1) {
      const col = computedCols[i];
      const key = String(col.accessorKey);
      const widthStr = widths[key] || col.width || '150px';
      const widthVal = parseInt(widthStr, 10) || 150;
      if (col.pin === 'right') {
        rightOffsets.set(i, currentRight);
        currentRight += widthVal;
      }
    }

    return computedCols.map((col, index) => {
      const isSticky = col.sticky === true;
      const isPinnedLeft = col.pin === 'left';
      const isPinnedRight = col.pin === 'right';
      const key = String(col.accessorKey);
      const widthStr = widths[key] || col.width || '150px';
      const widthVal = parseInt(widthStr, 10) || 150;
      const isStickyLeft = isSticky || isPinnedLeft;

      const columnData = {
        ...col,
        _stickyLeft: isStickyLeft ? currentLeft : undefined,
        _stickyRight: isPinnedRight ? rightOffsets.get(index) ?? 0 : undefined,
        _pin: isPinnedRight ? 'right' : isStickyLeft ? 'left' : undefined,
        _width: widthStr,
        _minWidth: col.minWidth || '50px'
      };

      if (isStickyLeft) {
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

  hideableColumns = computed(() =>
    this.columns().filter(col => col.accessorKey !== '_selection' && col.enableHiding !== false)
  );

  getHeaderClass(col: any) {
    return cn(
      'sticky top-0 bg-background shadow-sm whitespace-nowrap overflow-hidden text-ellipsis',
      col.sticky ? 'z-30' : 'z-20',
      this.showColumnBorders() && 'border-r',
      this.enableColumnResize() && col._width !== 'auto' && 'relative'
    );
  }

  getCellClass(col: any, rowIndex?: number) {
    const focused = this.focusedCell();
    const isFocused = rowIndex !== undefined && focused !== null
      && focused.rowIndex === rowIndex && focused.columnKey === String(col.accessorKey);
    return cn(
      'bg-background whitespace-nowrap overflow-hidden text-ellipsis',
      this.showRowBorders() && 'border-b',
      this.showColumnBorders() && 'border-r',
      isFocused && 'ring-1 ring-ring/40 ring-inset'
    );
  }

  getCellStyle(col: any, isHeader = false) {
    const width = col._width;
    const isAuto = width === 'auto';

    const style: any = {
      width: isAuto ? '0px' : width,
      minWidth: isAuto ? '0px' : width,
      maxWidth: isAuto ? 'none' : width,
      flexShrink: isAuto ? '1' : '0',
      flexGrow: isAuto ? '1' : '0',
      flexBasis: isAuto ? '0px' : 'auto'
    };

    if (col._pin === 'right') {
      style.position = 'sticky';
      style.right = `${col._stickyRight}px`;
      style.zIndex = isHeader ? '30' : '10';
    } else if (col.sticky || col._pin === 'left') {
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

  isRowExpanded(row: T): boolean {
    const id = this.getRowId()(row);
    return !!this.expandedRows()[id];
  }

  toggleRowExpanded(row: T, event?: Event) {
    event?.stopPropagation();
    const id = this.getRowId()(row);
    const current = this.expandedRows();
    const next = { ...current };
    if (next[id]) {
      delete next[id];
    } else {
      next[id] = true;
    }
    this.expandedRows.set(next);
  }

  getRowDetailComponentInputs(row: T): Record<string, unknown> {
    const resolver = this.rowDetailComponentInputs();
    return resolver ? resolver(row) : {};
  }

  toggleAll() {
    const selected = this.rowSelection();
    const visibleIds = this.filteredRowIds();

    if (this.isAllSelected()) {
      const remainingSelection = { ...selected };
      visibleIds.forEach(id => {
        delete remainingSelection[id];
      });
      this.rowSelection.set(remainingSelection);
    } else {
      const nextSelection = { ...selected };
      visibleIds.forEach(id => {
        nextSelection[id] = true;
      });
      this.rowSelection.set(nextSelection);
    }
  }

  isAllSelected = computed(() => {
    const visibleCount = this.filteredRowIds().length;
    if (visibleCount === 0) {
      return false;
    }
    return this.filteredSelectionCount() === visibleCount;
  });

  isIndeterminate = computed(() => {
    const count = this.filteredSelectionCount();
    const visibleCount = this.filteredRowIds().length;
    return count > 0 && count < visibleCount;
  });

  onPaginationChange(state: PaginationState) {
    this.loadingTrigger.set('pagination');
    const totalItems = this.localPagination() ? this.filteredData().length : this.total();
    const safePageSize = state.pageSize > 0 ? state.pageSize : this.paginationState().pageSize;
    const maxPageIndex = Math.max(0, Math.ceil(totalItems / safePageSize) - 1);
    const nextState = {
      pageIndex: Math.min(maxPageIndex, Math.max(0, state.pageIndex)),
      pageSize: safePageSize,
    };

    this.paginationState.set(nextState);
    this.pageChange.emit(nextState);
  }

  onFilterChange(value: string) {
    this.loadingTrigger.set('filtering');
    this.globalFilter.set(value);
    this.paginationState.update(state => ({ ...state, pageIndex: 0 }));
    this.filterChange.emit(value);
  }

  onColumnFilterChange(columnKey: string | keyof T, value: any) {
    this.loadingTrigger.set('filtering');
    this.columnFilters.update(filters => ({
      ...filters,
      [columnKey]: value
    }));
    this.paginationState.update(state => ({ ...state, pageIndex: 0 }));
  }

  isColumnVisible(columnKey: string | keyof T): boolean {
    return this.columnVisibility()[String(columnKey)] !== false;
  }

  setColumnVisibility(columnKey: string | keyof T, visible: boolean) {
    this.columnVisibility.update((current) => ({
      ...current,
      [String(columnKey)]: visible,
    }));
  }

  moveColumn(columnKey: string | keyof T, targetIndex: number) {
    const key = String(columnKey);
    const currentOrder = this.applyKeyOrder(this.columns().map(col => String(col.accessorKey)));
    const currentIndex = currentOrder.findIndex(item => item === key);
    if (currentIndex === -1) {
      return;
    }

    const boundedTarget = Math.max(0, Math.min(targetIndex, currentOrder.length - 1));
    const nextOrder = [...currentOrder];
    nextOrder.splice(currentIndex, 1);
    nextOrder.splice(boundedTarget, 0, key);
    this.columnOrder.set(nextOrder);
  }

  isColumnDraggable(col: ColumnDef<T>): boolean {
    return this.enableColumnReorder() && this.isColumnReorderable(col);
  }

  isDraggingColumn(col: ColumnDef<T>): boolean {
    return this.draggedColumnKey() === String(col.accessorKey);
  }

  isDropTargetColumn(col: ColumnDef<T>): boolean {
    return this.dropTargetColumnKey() === String(col.accessorKey);
  }

  onColumnDragStart(event: DragEvent, col: ColumnDef<T>) {
    if (!this.isColumnDraggable(col)) {
      return;
    }

    const key = String(col.accessorKey);
    this.draggedColumnKey.set(key);
    this.dropTargetColumnKey.set(null);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', key);
    }
  }

  onColumnDragOver(event: DragEvent, col: ColumnDef<T>) {
    if (!this.isColumnDraggable(col)) {
      return;
    }

    const targetKey = String(col.accessorKey);
    const sourceKey = this.draggedColumnKey() ?? event.dataTransfer?.getData('text/plain') ?? '';
    if (!sourceKey || sourceKey === targetKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.dropTargetColumnKey.set(targetKey);

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onColumnDrop(event: DragEvent, col: ColumnDef<T>) {
    if (!this.isColumnDraggable(col)) {
      this.clearColumnDragState();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const targetKey = String(col.accessorKey);
    const sourceKey = this.draggedColumnKey() ?? event.dataTransfer?.getData('text/plain') ?? '';
    if (!sourceKey || sourceKey === targetKey) {
      this.clearColumnDragState();
      return;
    }

    this.reorderColumnsByKeys(sourceKey, targetKey);
    this.clearColumnDragState();
  }

  onColumnDragEnd() {
    this.clearColumnDragState();
  }

  getColumnState(): DataTableColumnState[] {
    const widths = this.columnWidths();
    const visibility = this.columnVisibility();
    const order = this.applyKeyOrder(this.columns().map(col => String(col.accessorKey)));
    const orderIndex = new Map(order.map((key, index) => [key, index]));

    return this.columns().map((col) => {
      const key = String(col.accessorKey);
      return {
        columnKey: key,
        width: widths[key] ?? col.width,
        visible: visibility[key] !== false,
        pin: col.pin,
        order: orderIndex.get(key),
      };
    });
  }

  applyColumnState(states: DataTableColumnState[]) {
    if (!states || states.length === 0) {
      return;
    }

    const nextVisibility = { ...this.columnVisibility() };
    const nextWidths = { ...this.columnWidths() };
    const orderEntries: Array<{ key: string; order: number }> = [];

    states.forEach((state) => {
      const key = String(state.columnKey);
      if (state.visible !== undefined) {
        nextVisibility[key] = state.visible;
      }
      if (state.width) {
        nextWidths[key] = state.width;
      }
      if (state.order !== undefined) {
        orderEntries.push({ key, order: state.order });
      }
    });

    if (orderEntries.length > 0) {
      const sortedOrder = [...orderEntries]
        .sort((a, b) => a.order - b.order)
        .map((entry) => entry.key);
      this.columnOrder.set(sortedOrder);
    }

    this.columnVisibility.set(nextVisibility);
    this.columnWidths.set(nextWidths);
  }

  setLoadingTrigger(trigger: DataTableLoadingTrigger) {
    this.loadingTrigger.set(trigger);
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

  getCellValue(row: T, key: string | keyof T, column?: ColumnDef<T>): any {
    if (column?.accessorFn) {
      return column.accessorFn(row);
    }

    if (typeof key === 'string' && key.includes('.')) {
      return key.split('.').reduce<any>((value, segment) => {
        if (value === null || value === undefined) {
          return undefined;
        }
        return value[segment];
      }, row as any);
    }

    return (row as any)[key];
  }

  getCellStringValue(row: T, column: ColumnDef<T>): string {
    if (column.cell) {
      return column.cell(row);
    }
    const value = this.getCellValue(row, column.accessorKey, column);
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
      return value.toString();
    }
    return String(value);
  }

  getExportData(options?: DataTableExportOptions, customRows?: T[]): string[][] {
    const includeHeaders = options?.includeHeaders !== false;
    const onlyVisible = options?.onlyVisible !== false;
    const onlyFiltered = options?.onlyFiltered !== false;

    const columns = onlyVisible
      ? this.enhancedColumns().filter(col => col.accessorKey !== '_selection' && col.accessorKey !== '_expander')
      : this.columns().filter(col => col.accessorKey !== '_selection' && col.accessorKey !== '_expander');

    const rows = customRows ?? (onlyFiltered ? this.filteredData() : this.data());
    const result: string[][] = [];

    if (includeHeaders) {
      result.push(columns.map(col => col.header));
    }

    for (const row of rows) {
      result.push(columns.map(col => this.getCellStringValue(row, col)));
    }

    return result;
  }

  private async resolveExportRows(customData?: T[]): Promise<T[]> {
    if (customData) return customData;
    const provider = this.exportDataProvider();
    if (provider) return provider();
    return this.filteredData();
  }

  async exportToCsv(filename?: string, customData?: T[]): Promise<void> {
    this.exporting.set(true);
    try {
      const rows = await this.resolveExportRows(customData);
      const data = this.getExportData(undefined, rows);
      const csvContent = data.map(row =>
        row.map(cell => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
            return '"' + cell.replace(/"/g, '""') + '"';
          }
          return cell;
        }).join(',')
      ).join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, (filename || 'export') + '.csv');
    } finally {
      this.exporting.set(false);
    }
  }

  async exportToExcel(filename?: string, customData?: T[]): Promise<void> {
    this.exporting.set(true);
    try {
      const rows = await this.resolveExportRows(customData);
      const data = this.getExportData(undefined, rows);
      const xlsxBytes = generateXlsx(data, { boldFirstRow: true });
      const blob = new Blob([xlsxBytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      this.downloadBlob(blob, (filename || 'export') + '.xlsx');
    } finally {
      this.exporting.set(false);
    }
  }

  async copyCellToClipboard(): Promise<void> {
    if (!this.enableCopy()) return;
    const focused = this.focusedCell();
    if (!focused) return;
    const row = this.processedData()[focused.rowIndex];
    const col = this.enhancedColumns().find(c => String(c.accessorKey) === focused.columnKey);
    if (row && col) {
      await navigator.clipboard.writeText(this.getCellStringValue(row, col));
    }
  }

  async copyRowToClipboard(row: T): Promise<void> {
    if (!this.enableCopy()) return;
    const columns = this.enhancedColumns().filter(col => col.accessorKey !== '_selection' && col.accessorKey !== '_expander');
    const values = columns.map(col => this.getCellStringValue(row, col));
    await navigator.clipboard.writeText(values.join('\t'));
  }

  async copySelectedToClipboard(): Promise<void> {
    if (!this.enableCopy()) return;
    const columns = this.enhancedColumns().filter(col => col.accessorKey !== '_selection' && col.accessorKey !== '_expander');
    const selectedIds = this.rowSelection();
    const rows = this.filteredData().filter(row => selectedIds[this.getRowId()(row)]);
    if (rows.length === 0) return;

    const headerLine = columns.map(col => col.header).join('\t');
    const dataLines = rows.map(row => columns.map(col => this.getCellStringValue(row, col)).join('\t'));
    await navigator.clipboard.writeText([headerLine, ...dataLines].join('\n'));
  }

  async copyAllToClipboard(): Promise<void> {
    if (!this.enableCopy()) return;
    const data = this.getExportData();
    const text = data.map(row => row.join('\t')).join('\n');
    await navigator.clipboard.writeText(text);
  }

  onTableClick(): void {
    this.focusedCell.set(null);
  }

  onCellClick(rowIndex: number, col: ColumnDef<T>, event: Event): void {
    const key = String(col.accessorKey);
    if (key === '_selection' || key === '_expander') return;
    event.stopPropagation();
    this.focusedCell.set({ rowIndex, columnKey: key });
  }

  onTableKeydown(event: KeyboardEvent): void {
    if (!this.enableCopy()) return;
    const isCopy = (event.ctrlKey || event.metaKey) && event.key === 'c';
    if (!isCopy) return;

    const focused = this.focusedCell();
    if (focused) {
      const row = this.processedData()[focused.rowIndex];
      const col = this.enhancedColumns().find(c => String(c.accessorKey) === focused.columnKey);
      if (row && col) {
        event.preventDefault();
        const value = this.getCellStringValue(row, col);
        navigator.clipboard.writeText(value);
        return;
      }
    }

    const selectedIds = this.rowSelection();
    const hasSelection = Object.keys(selectedIds).some(id => selectedIds[id]);
    if (hasSelection) {
      event.preventDefault();
      this.copySelectedToClipboard();
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = this._document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    this._document.body.appendChild(a);
    a.click();
    this._document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private applyColumnOrder<U extends { accessorKey: string | keyof T }>(columns: U[]): U[] {
    const order = this.columnOrder();
    if (order.length === 0) {
      return columns;
    }

    const priority = new Map(order.map((key, index) => [key, index]));
    return [...columns].sort((a, b) => {
      const aIndex = priority.get(String(a.accessorKey));
      const bIndex = priority.get(String(b.accessorKey));
      if (aIndex === undefined && bIndex === undefined) return 0;
      if (aIndex === undefined) return 1;
      if (bIndex === undefined) return -1;
      return aIndex - bIndex;
    });
  }

  private applyKeyOrder(keys: string[]): string[] {
    const order = this.columnOrder();
    if (order.length === 0) {
      return keys;
    }

    const priority = new Map(order.map((key, index) => [key, index]));
    return [...keys].sort((a, b) => {
      const aIndex = priority.get(a);
      const bIndex = priority.get(b);
      if (aIndex === undefined && bIndex === undefined) return 0;
      if (aIndex === undefined) return 1;
      if (bIndex === undefined) return -1;
      return aIndex - bIndex;
    });
  }

  private reorderColumnsByKeys(sourceKey: string, targetKey: string) {
    const columnsByKey = new Map(this.columns().map(col => [String(col.accessorKey), col]));
    const baseOrder = this.applyKeyOrder(this.columns().map(col => String(col.accessorKey)));
    const visibleReorderable = baseOrder.filter((key) => {
      const col = columnsByKey.get(key);
      return !!col && this.isColumnReorderable(col) && this.isColumnVisible(key);
    });

    const sourceIndex = visibleReorderable.indexOf(sourceKey);
    const targetIndex = visibleReorderable.indexOf(targetKey);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    if (sourceIndex === targetIndex) {
      return;
    }

    const nextVisibleReorderable = visibleReorderable.filter(key => key !== sourceKey);
    const reducedTargetIndex = nextVisibleReorderable.indexOf(targetKey);
    const insertIndex = sourceIndex < targetIndex ? reducedTargetIndex + 1 : reducedTargetIndex;

    nextVisibleReorderable.splice(insertIndex, 0, sourceKey);

    const visibleReorderableSet = new Set(visibleReorderable);
    let cursor = 0;
    const mergedOrder = baseOrder.map((key) => {
      if (!visibleReorderableSet.has(key)) {
        return key;
      }

      const nextKey = nextVisibleReorderable[cursor];
      cursor += 1;
      return nextKey;
    });

    this.columnOrder.set(mergedOrder);
  }

  private isColumnReorderable(col: ColumnDef<T>): boolean {
    const key = String(col.accessorKey);
    if (key === '_selection' || key === '_expander') {
      return false;
    }
    return col.enableReordering !== false;
  }

  private clearColumnDragState() {
    this.draggedColumnKey.set(null);
    this.dropTargetColumnKey.set(null);
  }

  private shouldShowLoaderFor(trigger: DataTableLoadingTrigger): boolean {
    const visibility = this.loadingVisibility();
    if (trigger === 'pagination') return visibility.pagination !== false;
    if (trigger === 'sorting') return visibility.sorting !== false;
    if (trigger === 'filtering') return visibility.filtering !== false;
    return visibility.initial !== false;
  }

  getRenderedRowAt(index: number): T | undefined {
    return this.processedData()[index];
  }

  private resizingColumn: any = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  onResizeStart(event: MouseEvent, col: any) {
    event.preventDefault();
    event.stopPropagation();
    this.startResize(event.clientX, col);
  }

  onResizeTouchStart(event: TouchEvent, col: any) {
    if (event.touches.length === 1) {
      event.preventDefault();
      event.stopPropagation();
      this.startResize(event.touches[0].clientX, col);
    }
  }

  private startResize(clientX: number, col: any) {
    this.resizingColumn = col;
    this.resizeStartX = clientX;
    this.resizeStartWidth = parseInt(col._width, 10) || 150;
    this._isRtlResize = this.isRtl();

    const onMouseMove = (e: MouseEvent) => this.onResizeMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        this.onResizeMove(e.touches[0].clientX);
      }
    };

    const onEnd = () => {
      this.onResizeEnd();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  private onResizeMove(clientX: number) {
    if (!this.resizingColumn) return;

    const delta = clientX - this.resizeStartX;
    const effectiveDelta = this._isRtlResize ? -delta : delta;
    const minWidth = parseInt(this.resizingColumn._minWidth, 10) || 50;
    const newWidth = Math.max(minWidth, this.resizeStartWidth + effectiveDelta);
    const key = String(this.resizingColumn.accessorKey);

    this.columnWidths.update(widths => ({
      ...widths,
      [key]: `${newWidth}px`
    }));
  }

  private onResizeEnd() {
    if (this.resizingColumn) {
      const key = String(this.resizingColumn.accessorKey);
      const oldWidth = this.columnWidths()[key] || this.resizingColumn.width || '150px';
      const newWidth = this.columnWidths()[key] || oldWidth;

      this.columnResize.emit({
        columnKey: key,
        oldWidth,
        newWidth
      });

      this.resizingColumn = null;
    }
  }
}
