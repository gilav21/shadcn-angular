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
import { cn, isRtl } from '../../lib/utils';
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
  SubRowSelectionMode,
  SubRowFilterMode,
  FlattenedTreeRow,
  SubRowContext,
} from './data-table.types';
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
                  [attr.data-column-id]="String(col.accessorKey)"
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
                      } @else if (col._isTreeExpanderHost) {
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                            [attr.aria-label]="isAllSubRowsExpanded() ? 'Collapse all sub-rows' : 'Expand all sub-rows'"
                            (click)="isAllSubRowsExpanded() ? collapseAllSubRows() : expandAllSubRows(-1)"
                          >
                            @if (isAllSubRowsExpanded()) {
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="17 11 12 6 7 11"/>
                                <polyline points="17 18 12 13 7 18"/>
                              </svg>
                            } @else {
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="7 13 12 18 17 13"/>
                                <polyline points="7 6 12 11 17 6"/>
                              </svg>
                            }
                          </button>
                          @if (col.enableSorting !== false) {
                            <ui-data-table-column-header
                              [title]="col.header"
                              [column]="String(col.accessorKey)"
                              [direction]="getSortDirection(col.accessorKey)"
                              [sortIndex]="getSortIndex(col.accessorKey)"
                              (sortMeta)="onSortChange(col.accessorKey, $event.direction, $event.multi)"
                            />
                          } @else {
                            <span>{{ col.header }}</span>
                          }
                        </div>
                      } @else if (col.accessorKey === '_expander') {
                        <button
                          type="button"
                          class="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                          [attr.aria-label]="isAllExpanded() ? 'Collapse all rows' : 'Expand all rows'"
                          (click)="toggleAllExpanded()"
                        >
                          @if (isAllExpanded()) {
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="17 11 12 6 7 11"/>
                              <polyline points="17 18 12 13 7 18"/>
                            </svg>
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="7 13 12 18 17 13"/>
                              <polyline points="7 6 12 11 17 6"/>
                            </svg>
                          }
                        </button>
                      } @else if (col.headerTemplate) {
                        <ng-container *ngTemplateOutlet="col.headerTemplate; context: { $implicit: col }"></ng-container>
                      } @else if (col.enableSorting !== false) {
                        <div class="flex items-center gap-2">
                          <ui-data-table-column-header
                            [title]="col.header"
                            [column]="String(col.accessorKey)"
                            [direction]="getSortDirection(col.accessorKey)"
                            [sortIndex]="getSortIndex(col.accessorKey)"
                            (sortMeta)="onSortChange(col.accessorKey, $event.direction, $event.multi)"
                          />
                          @if (col.enableFiltering && col.filterComponent) {
                            <ui-popover [closeOnScroll]="true">
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
                              <ui-popover-content class="w-80" strategy="fixed" align="end">
                                <div
                                  [uiComponentOutlet]="col.filterComponent"
                                  [inputs]="getFilterInputs(col)"
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
                              <ui-popover-content class="w-80" strategy="fixed" align="end">
                                <div 
                                  [uiComponentOutlet]="col.filterComponent" 
                                  [inputs]="getFilterInputs(col)"
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
            @if (enableSubRows()) {
              @if (processedTreeRows().length > 0) {
                @for (treeRow of processedTreeRows(); track getRowId()(treeRow.row); let i = $index) {
                  <ui-table-row
                    [attr.data-state]="isRowSelected(treeRow.row) ? 'selected' : null"
                    [attr.data-row-index]="i"
                    [attr.data-row-id]="getRowId()(treeRow.row)"
                    [attr.data-depth]="treeRow.depth"
                    [attr.aria-level]="treeRow.depth + 1"
                    [attr.aria-expanded]="treeRow.isLeaf ? null : treeRow.isExpanded"
                    class="border-0"
                  >
                    @for (col of enhancedColumns(); track col.accessorKey) {
                      <ui-table-cell
                        [class]="getCellClass(col, i, treeRow.depth)"
                        [attr.data-column]="String(col.accessorKey)"
                        [style]="getTreeCellStyle(col, treeRow.depth)"
                        (click)="onCellClick(i, col, $event)"
                      >
                        @if (col.accessorKey === '_selection') {
                          <ui-checkbox
                            [checked]="isRowSelected(treeRow.row)"
                            [indeterminate]="isSubRowSelectionIndeterminate(treeRow.row)"
                            (checkedChange)="toggleRowWithCascade(treeRow.row)"
                            ariaLabel="Select row"
                          />
                        } @else if (col._isTreeExpanderHost) {
                          <div class="flex items-center gap-1 min-w-0" [style.padding-left.px]="treeRow.depth * subRowIndentSize()">
                            @if (!treeRow.isLeaf) {
                              <button
                                type="button"
                                class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                                [attr.aria-label]="treeRow.isExpanded ? 'Collapse sub-rows' : 'Expand sub-rows'"
                                (click)="toggleSubRowExpanded(treeRow.row, $event)"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform duration-200" [class.rotate-90]="treeRow.isExpanded">
                                  <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                              </button>
                            } @else {
                              <span class="inline-block h-6 w-6 shrink-0"></span>
                            }
                            <span class="truncate">
                              @if (col.component) {
                                <div
                                  [uiComponentOutlet]="col.component"
                                  [inputs]="getSubRowComponentInputs(col, treeRow)"
                                  [outputs]="col.componentOutputs ? col.componentOutputs(treeRow.row) : {}"
                                ></div>
                              } @else if (col.template) {
                                <ng-container *ngTemplateOutlet="col.template; context: { $implicit: treeRow.row, depth: treeRow.depth, parentRow: treeRow.parentRow, parentId: treeRow.parentId, path: treeRow.path, isLeaf: treeRow.isLeaf, childCount: treeRow.childCount }"></ng-container>
                              } @else if (col.cell) {
                                {{ col.cell(treeRow.row) }}
                              } @else {
                                {{ getCellValue(treeRow.row, col.accessorKey, col) }}
                              }
                            </span>
                          </div>
                        } @else if (col.accessorKey === '_expander') {
                          <button
                            type="button"
                            class="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                            [attr.aria-label]="isRowExpanded(treeRow.row) ? 'Collapse row' : 'Expand row'"
                            [attr.aria-expanded]="isRowExpanded(treeRow.row)"
                            (click)="toggleRowExpanded(treeRow.row, $event)"
                          >
                            @if (isRowExpanded(treeRow.row)) {
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
                            [inputs]="getSubRowComponentInputs(col, treeRow)"
                            [outputs]="col.componentOutputs ? col.componentOutputs(treeRow.row) : {}"
                          ></div>
                        } @else if (col.template) {
                          <ng-container *ngTemplateOutlet="col.template; context: { $implicit: treeRow.row, depth: treeRow.depth, parentRow: treeRow.parentRow, parentId: treeRow.parentId, path: treeRow.path, isLeaf: treeRow.isLeaf, childCount: treeRow.childCount }"></ng-container>
                        } @else if (col.cell) {
                           {{ col.cell(treeRow.row) }}
                        } @else {
                          {{ getCellValue(treeRow.row, col.accessorKey, col) }}
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
                  @if (enableRowExpansion() && isRowExpanded(treeRow.row)) {
                    <ui-table-row class="border-0 bg-muted/20">
                      <ui-table-cell class="flex-1 border-b" style="min-width: 0; max-width: none; width: 100%; flex-basis: 100%;">
                        @if (rowDetailTemplate()) {
                          <ng-container
                            *ngTemplateOutlet="rowDetailTemplate(); context: { $implicit: treeRow.row, row: treeRow.row }"
                          ></ng-container>
                        } @else if (rowDetailComponent()) {
                          <div
                            [uiComponentOutlet]="rowDetailComponent()"
                            [inputs]="getRowDetailComponentInputs(treeRow.row)"
                          ></div>
                        } @else {
                          <pre class="text-xs text-muted-foreground whitespace-pre-wrap">{{ treeRow.row | json }}</pre>
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
            } @else if (processedData().length > 0) {
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
                      [attr.data-column]="String(col.accessorKey)"
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
  private readonly _document = inject(DOCUMENT);
  private readonly _el = inject(ElementRef);
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

  enableSubRows = input(false);
  getChildren = input<(row: T) => T[] | undefined>((row: any) => row.children);
  setChildren = input<(row: T, children: T[]) => T>((row: any, children: any[]) => ({ ...row, children }));
  subRowDefaultExpanded = input(0);
  subRowSelectionMode = input<SubRowSelectionMode>('self');
  subRowFilterMode = input<SubRowFilterMode>('includeParentOnChildMatch');
  enableSubRowSorting = input(true);
  subRowIndentSize = input(20);
  subRowsPaginated = input(false);
  subRowExpandedRows = model<Record<string, boolean>>({});

  enableColumnResize = input(false);
  enableColumnReorder = input(false);
  columnResize = output<ColumnResizeEvent>();

  exportDataProvider = input<(() => Promise<T[]>) | undefined>(undefined);

  emptyStateComponent = input<Type<unknown>>();
  emptyStateComponentInputs = input<Record<string, unknown>>({});

  exporting = signal(false);
  globalFilter = model('');
  columnFilters = model<Record<string, any>>({});
  sortState = model<SortState>({ column: '', direction: null });
  multiSortState = model<SortState[]>([]);
  paginationState = model<PaginationState>({ pageIndex: 0, pageSize: 10 });
  pageSizeOptions = input<number[]>([10, 20, 30, 40, 50]);
  showPageSizeSelector = input(true);
  columnWidths = model<Record<string, string>>({});
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
      if (!column?.enableFiltering) return;

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

  private readonly treeIndex = computed(() => {
    if (!this.enableSubRows()) {
      return { children: new Map<string, string[]>(), descendants: new Map<string, string[]>(), parent: new Map<string, string>() };
    }
    const getId = this.getRowId();
    const getChildrenFn = this.getChildren();
    const childrenMap = new Map<string, string[]>();
    const descendantsMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();

    const walk = (rows: T[], parentId: string | null) => {
      for (const row of rows) {
        const id = getId(row);
        if (parentId !== null) {
          parentMap.set(id, parentId);
        }
        const kids = getChildrenFn(row);
        const kidIds: string[] = [];
        if (kids && kids.length > 0) {
          for (const kid of kids) {
            kidIds.push(getId(kid));
          }
          childrenMap.set(id, kidIds);
          walk(kids, id);
        } else {
          childrenMap.set(id, []);
        }
      }
    };
    walk(this.data(), null);

    const getDescendants = (id: string): string[] => {
      if (descendantsMap.has(id)) return descendantsMap.get(id)!;
      const kids = childrenMap.get(id) ?? [];
      const all: string[] = [];
      for (const kid of kids) {
        all.push(kid, ...getDescendants(kid));
      }
      descendantsMap.set(id, all);
      return all;
    };

    for (const id of childrenMap.keys()) {
      getDescendants(id);
    }

    return { children: childrenMap, descendants: descendantsMap, parent: parentMap };
  });

  filteredTreeData = computed<T[]>(() => {
    if (!this.enableSubRows() || !this.localFiltering()) return this.data();

    const globalFilterValue = this.globalFilter().toLowerCase();
    const colFilters = this.columnFilters();
    const columns = this.enhancedColumns().filter(col =>
      col.accessorKey !== '_selection' && col.accessorKey !== '_expander'
    );
    const hasGlobalFilter = !!globalFilterValue;
    const hasColumnFilters = Object.keys(colFilters).some(k => !this.isFilterValueEmpty(colFilters[k]));

    if (!hasGlobalFilter && !hasColumnFilters) return this.data();

    const getChildrenFn = this.getChildren();
    const setChildrenFn = this.setChildren();
    const mode = this.subRowFilterMode();

    const matchesGlobal = (row: T): boolean => {
      const globalFilterFn = this.globalFilterFn();
      if (globalFilterFn) {
        return globalFilterFn(row, globalFilterValue, columns);
      }
      const globallyFilterable = columns.filter(col => col.enableGlobalFilter !== false);
      return globallyFilterable.some(col => {
        const value = this.getCellValue(row, col.accessorKey, col);
        return String(value).toLowerCase().includes(globalFilterValue);
      });
    };

    const matchesColumns = (row: T): boolean => {
      for (const columnKey of Object.keys(colFilters)) {
        const filterValue = colFilters[columnKey];
        if (this.isFilterValueEmpty(filterValue)) continue;
        const column = columns.find(col => col.accessorKey === columnKey);
        if (!column?.enableFiltering) continue;
        if (column.filterFn) {
          if (!column.filterFn(row, filterValue)) return false;
        } else {
          const cellValue = this.getCellValue(row, columnKey, column);
          if (!String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase())) return false;
        }
      }
      return true;
    };

    const matchesRow = (row: T): boolean => {
      if (hasGlobalFilter && !matchesGlobal(row)) return false;
      if (hasColumnFilters && !matchesColumns(row)) return false;
      return true;
    };

    const filterIncludeChildren = (rows: T[]): T[] => {
      const result: T[] = [];
      for (const row of rows) {
        if (matchesRow(row)) {
          result.push(row);
        } else {
          const children = getChildrenFn(row);
          if (children && children.length > 0) {
            const filteredKids = filterTree(children);
            if (filteredKids.length > 0) {
              result.push(setChildrenFn(row, filteredKids));
            }
          }
        }
      }
      return result;
    };

    const filterIncludeParents = (rows: T[]): T[] => {
      const result: T[] = [];
      for (const row of rows) {
        const children = getChildrenFn(row);
        const selfMatches = matchesRow(row);

        if (children && children.length > 0) {
          const filteredKids = filterTree(children);
          if (selfMatches || filteredKids.length > 0) {
            result.push(setChildrenFn(row, filteredKids));
          }
        } else if (selfMatches) {
          result.push(row);
        }
      }
      return result;
    };

    const filterTree = (rows: T[]): T[] => {
      if (mode === 'excludeChildren') return rows.filter(matchesRow);
      if (mode === 'includeChildren') return filterIncludeChildren(rows);
      return filterIncludeParents(rows);
    };

    return filterTree(this.data());
  });

  sortedTreeData = computed<T[]>(() => {
    if (!this.enableSubRows()) return [];
    const data = this.filteredTreeData();
    if (!this.localSorting() || !this.enableSubRowSorting()) return data;

    const sorts = this.activeSorts();
    if (sorts.length === 0) return data;

    const getChildrenFn = this.getChildren();
    const setChildrenFn = this.setChildren();

    const compareFn = this.buildSortComparator(sorts);

    const sortRows = (rows: T[]): T[] => {
      const sorted = [...rows].sort(compareFn);
      return sorted.map(row => {
        const children = getChildrenFn(row);
        if (children && children.length > 0) {
          return setChildrenFn(row, sortRows(children));
        }
        return row;
      });
    };

    return sortRows(data);
  });

  visibleTreeRows = computed<FlattenedTreeRow<T>[]>(() => {
    if (!this.enableSubRows()) return [];
    return this.flattenTreeFull(this.sortedTreeData());
  });

  sortedData = computed(() => {
    if (this.enableSubRows()) return [];
    const data = [...this.filteredData()];
    if (!this.localSorting()) return data;

    const sorts = this.activeSorts();
    if (sorts.length === 0) return data;

    return data.sort(this.buildSortComparator(sorts));
  });

  processedData = computed(() => {
    if (this.enableSubRows()) {
      const visible = this.visibleTreeRows();
      if (!this.localPagination()) return visible.map(tr => tr.row);

      if (this.subRowsPaginated()) {
        const { pageIndex, pageSize } = this.paginationState();
        const start = pageIndex * pageSize;
        return visible.slice(start, start + pageSize).map(tr => tr.row);
      }

      const treeData = this.sortedTreeData();
      const { pageIndex, pageSize } = this.paginationState();
      const start = pageIndex * pageSize;
      const rootSlice = treeData.slice(start, start + pageSize);
      return this.flattenTreeRowsForPage(rootSlice);
    }

    const data = this.sortedData();
    if (!this.localPagination()) return data;

    const { pageIndex, pageSize } = this.paginationState();
    const start = pageIndex * pageSize;
    return data.slice(start, start + pageSize);
  });

  processedTreeRows = computed<FlattenedTreeRow<T>[]>(() => {
    if (!this.enableSubRows()) return [];
    const visible = this.visibleTreeRows();
    if (!this.localPagination()) return visible;

    if (this.subRowsPaginated()) {
      const { pageIndex, pageSize } = this.paginationState();
      const start = pageIndex * pageSize;
      return visible.slice(start, start + pageSize);
    }

    const treeData = this.sortedTreeData();
    const { pageIndex, pageSize } = this.paginationState();
    const start = pageIndex * pageSize;
    const rootSlice = treeData.slice(start, start + pageSize);
    return this.flattenTreeRowsForPageFull(rootSlice);
  });

  activeTotalItems = computed(() => {
    if (this.enableSubRows()) {
      if (!this.localPagination()) return this.total();
      if (this.subRowsPaginated()) {
        return this.visibleTreeRows().length;
      }
      return this.sortedTreeData().length;
    }
    return this.localPagination() ? this.filteredData().length : this.total();
  });

  private readonly filteredRowIds = computed(() => {
    if (this.enableSubRows()) {
      return this.visibleTreeRows().map(tr => this.getRowId()(tr.row));
    }
    return this.filteredData().map(row => this.getRowId()(row));
  });
  private readonly filteredSelectionCount = computed(() => {
    const selected = this.rowSelection();
    let count = 0;
    this.filteredRowIds().forEach(id => {
      if (selected[id]) {
        count += 1;
      }
    });
    return count;
  });

  selectedRows = computed(() => {
    const selection = this.rowSelection();
    const getId = this.getRowId();
    return this.data().filter(row => !!selection[getId(row)]);
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

    if (this.enableSubRows()) {
      const hasUserTreeExpander = cols.some(c => c.treeExpander);
      if (hasUserTreeExpander) {
        const treeIdx = computedCols.findIndex(c => c.treeExpander);
        if (treeIdx !== -1) {
          computedCols[treeIdx] = { ...computedCols[treeIdx], _isTreeExpanderHost: true };
        }
      } else {
        const firstDataIdx = computedCols.findIndex(c =>
          c.accessorKey !== '_selection' && c.accessorKey !== '_expander'
        );
        if (firstDataIdx !== -1) {
          computedCols[firstDataIdx] = { ...computedCols[firstDataIdx], _isTreeExpanderHost: true };
        }
      }
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
      const widthVal = Number.parseInt(widthStr, 10) || 150;
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
      const widthVal = Number.parseInt(widthStr, 10) || 150;
      const isStickyLeft = isSticky || isPinnedLeft;
      let pin: string | undefined;
      if (isPinnedRight) pin = 'right';
      else if (isStickyLeft) pin = 'left';

      const columnData = {
        ...col,
        _stickyLeft: isStickyLeft ? currentLeft : undefined,
        _stickyRight: isPinnedRight ? rightOffsets.get(index) ?? 0 : undefined,
        _pin: pin,
        _width: widthStr,
        _minWidth: col.minWidth || '50px'
      };

      if (isStickyLeft) {
        currentLeft += widthVal;
      }

      return columnData;
    });
  });

  treeExpanderColumn = computed(() => {
    if (!this.enableSubRows()) return null;
    return this.enhancedColumns().find(c => c._isTreeExpanderHost) ?? null;
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

  getCellClass(col: any, rowIndex?: number, treeDepth?: number) {
    const focused = this.focusedCell();
    const isFocused = rowIndex !== undefined && focused !== null
      && focused.rowIndex === rowIndex && focused.columnKey === String(col.accessorKey);
    return cn(
      'whitespace-nowrap overflow-hidden text-ellipsis',
      treeDepth === undefined && 'bg-background',
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

  getTreeCellStyle(col: any, depth: number) {
    const style = this.getCellStyle(col);
    if (depth > 0) {
      style['background-color'] = `color-mix(in srgb, var(--border) ${Math.min(depth * 20, 80)}%, var(--background))`;
    } else {
      style['background-color'] = 'var(--background)';
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

  isAllExpanded = computed(() => {
    const ids = this.filteredRowIds();
    if (ids.length === 0) return false;
    const expanded = this.expandedRows();
    return ids.every(id => !!expanded[id]);
  });

  isExpansionIndeterminate = computed(() => {
    const ids = this.filteredRowIds();
    const expanded = this.expandedRows();
    const count = ids.filter(id => !!expanded[id]).length;
    return count > 0 && count < ids.length;
  });

  toggleAllExpanded() {
    const ids = this.filteredRowIds();
    if (this.isAllExpanded()) {
      const next = { ...this.expandedRows() };
      ids.forEach(id => delete next[id]);
      this.expandedRows.set(next);
    } else {
      const next = { ...this.expandedRows() };
      ids.forEach(id => next[id] = true);
      this.expandedRows.set(next);
    }
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

  selectRows(rows: T[]) {
    const getId = this.getRowId();
    const next = { ...this.rowSelection() };
    rows.forEach(row => next[getId(row)] = true);
    this.rowSelection.set(next);
  }

  unselectRows(rows: T[]) {
    const getId = this.getRowId();
    const next = { ...this.rowSelection() };
    rows.forEach(row => delete next[getId(row)]);
    this.rowSelection.set(next);
  }

  clearSelection() {
    this.rowSelection.set({});
  }

  selectAll() {
    this.toggleAll();
  }

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
    const currentIndex = currentOrder.indexOf(key);
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

  getFilterInputs(col: ColumnDef<T>): Record<string, unknown> {
    if (typeof col.filterComponentInputs === 'function') {
      return col.filterComponentInputs();
    }
    return col.filterComponentInputs || {};
  }

  getFilterOutputs(col: ColumnDef<T>): Record<string, (event: any) => void> {
    return {
      ...col.filterComponentOutputs,
      filterChange: (value: any) => this.onColumnFilterChange(col.accessorKey, value)
    };
  }

  isFilterValueEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }

  private compareByColumn(a: T, b: T, column: ColumnDef<T>): number {
    if (column.sortFn) return column.sortFn(a, b);
    const aVal = this.getCellValue(a, column.accessorKey, column);
    const bVal = this.getCellValue(b, column.accessorKey, column);
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  }

  private buildSortComparator(sorts: SortState[]): (a: T, b: T) => number {
    return (a: T, b: T) => {
      for (const sort of sorts) {
        const column = this.enhancedColumns().find(col => col.accessorKey === sort.column);
        if (!column || !sort.direction) continue;

        const result = this.compareByColumn(a, b, column);
        if (result !== 0) {
          return sort.direction === 'asc' ? result : -result;
        }
      }
      return 0;
    };
  }

  protected readonly String = String;

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
            return '"' + cell.replaceAll('"', '""') + '"';
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

  toggleSubRowExpanded(row: T, event?: Event) {
    event?.stopPropagation();
    const id = this.getRowId()(row);
    const isCurrentlyExpanded = this.isSubRowExpanded(row);
    const next = { ...this.subRowExpandedRows() };
    next[id] = !isCurrentlyExpanded;
    this.subRowExpandedRows.set(next);
  }

  expandSubRow(row: T) {
    const id = this.getRowId()(row);
    this.subRowExpandedRows.update(current => ({ ...current, [id]: true }));
  }

  collapseSubRow(row: T) {
    const id = this.getRowId()(row);
    const current = this.subRowExpandedRows();
    const next = { ...current };
    delete next[id];
    this.subRowExpandedRows.set(next);
  }

  isSubRowExpanded(row: T): boolean {
    const id = this.getRowId()(row);
    const expanded = this.subRowExpandedRows();
    if (id in expanded) return expanded[id];
    const defaultExpanded = this.subRowDefaultExpanded();
    if (defaultExpanded === -1) return true;
    const depth = this.getRowDepth(row);
    return depth < defaultExpanded;
  }

  expandAllSubRows(toDepth?: number) {
    const getId = this.getRowId();
    const getChildrenFn = this.getChildren();
    const next: Record<string, boolean> = {};
    const targetDepth = toDepth ?? -1;

    const walk = (rows: T[], depth: number) => {
      for (const row of rows) {
        const children = getChildrenFn(row);
        if (children && children.length > 0) {
          if (targetDepth === -1 || depth < targetDepth) {
            next[getId(row)] = true;
          }
          walk(children, depth + 1);
        }
      }
    };
    walk(this.data(), 0);
    this.subRowExpandedRows.set(next);
  }

  collapseAllSubRows() {
    this.subRowExpandedRows.set({});
  }

  isAllSubRowsExpanded = computed(() => {
    if (!this.enableSubRows()) return false;
    const getId = this.getRowId();
    const getChildrenFn = this.getChildren();
    const expanded = this.subRowExpandedRows();
    const defaultExpanded = this.subRowDefaultExpanded();

    const check = (rows: T[], depth: number): boolean => {
      for (const row of rows) {
        const children = getChildrenFn(row);
        if (children && children.length > 0) {
          const id = getId(row);
          const isExp = id in expanded ? expanded[id] : (defaultExpanded === -1 || depth < defaultExpanded);
          if (!isExp) return false;
          if (!check(children, depth + 1)) return false;
        }
      }
      return true;
    };
    return check(this.data(), 0);
  });

  getRowDepth(row: T): number {
    const id = this.getRowId()(row);
    const index = this.treeIndex();
    let depth = 0;
    let currentId: string | undefined = index.parent.get(id);
    while (currentId !== undefined) {
      depth++;
      currentId = index.parent.get(currentId);
    }
    return depth;
  }

  getRowPath(rowId: string): string[] {
    const index = this.treeIndex();
    const path: string[] = [rowId];
    let currentId: string | undefined = index.parent.get(rowId);
    while (currentId !== undefined) {
      path.unshift(currentId);
      currentId = index.parent.get(currentId);
    }
    return path;
  }

  getParentRow(row: T): T | null {
    const id = this.getRowId()(row);
    const index = this.treeIndex();
    const parentId = index.parent.get(id);
    if (parentId === undefined) return null;
    return this.findRowById(parentId);
  }

  getChildRows(row: T): T[] {
    const getChildrenFn = this.getChildren();
    return getChildrenFn(row) ?? [];
  }

  selectChildren(parentRow: T) {
    const id = this.getRowId()(parentRow);
    const index = this.treeIndex();
    const descendantIds = index.descendants.get(id) ?? [];
    const next = { ...this.rowSelection() };
    descendantIds.forEach(did => next[did] = true);
    this.rowSelection.set(next);
  }

  deselectChildren(parentRow: T) {
    const id = this.getRowId()(parentRow);
    const index = this.treeIndex();
    const descendantIds = index.descendants.get(id) ?? [];
    const next = { ...this.rowSelection() };
    descendantIds.forEach(did => delete next[did]);
    this.rowSelection.set(next);
  }

  toggleRowWithCascade(row: T) {
    const mode = this.subRowSelectionMode();
    if (mode === 'self') {
      this.toggleRow(row);
      return;
    }

    const id = this.getRowId()(row);
    const isSelected = !!this.rowSelection()[id];
    const index = this.treeIndex();
    const next = { ...this.rowSelection() };

    if (isSelected) {
      delete next[id];
    } else {
      next[id] = true;
    }

    if (mode === 'descendants') {
      const descendantIds = index.descendants.get(id) ?? [];
      descendantIds.forEach(did => {
        if (isSelected) {
          delete next[did];
        } else {
          next[did] = true;
        }
      });
    } else if (mode === 'filteredDescendants') {
      const visibleIds = new Set(this.filteredRowIds());
      const descendantIds = index.descendants.get(id) ?? [];
      descendantIds.forEach(did => {
        if (!visibleIds.has(did)) return;
        if (isSelected) {
          delete next[did];
        } else {
          next[did] = true;
        }
      });
    }

    this.bubbleUpSelection(id, next);
    this.rowSelection.set(next);
  }

  isSubRowSelectionIndeterminate(row: T): boolean {
    if (this.subRowSelectionMode() === 'self') return false;
    const id = this.getRowId()(row);
    const index = this.treeIndex();
    const descendantIds = index.descendants.get(id) ?? [];
    if (descendantIds.length === 0) return false;

    const selected = this.rowSelection();
    let selectedCount = 0;
    for (const did of descendantIds) {
      if (selected[did]) selectedCount++;
    }
    return selectedCount > 0 && selectedCount < descendantIds.length;
  }

  getSubRowComponentInputs(col: ColumnDef<T>, treeRow: FlattenedTreeRow<T>): Record<string, any> {
    const base = col.componentInputs ? col.componentInputs(treeRow.row) : {};
    const context: SubRowContext<T> = {
      row: treeRow.row,
      parentRow: treeRow.parentRow,
      parentId: treeRow.parentId,
      depth: treeRow.depth,
      path: treeRow.path,
      isLeaf: treeRow.isLeaf,
      childCount: treeRow.childCount,
    };
    return { ...base, _subRowContext: context };
  }

  private bubbleUpSelection(rowId: string, selection: Record<string, boolean>) {
    const index = this.treeIndex();
    let parentId = index.parent.get(rowId);
    while (parentId !== undefined) {
      const siblingIds = index.children.get(parentId) ?? [];
      const allSelected = siblingIds.every(sid => !!selection[sid]);
      if (allSelected) {
        selection[parentId] = true;
      } else {
        delete selection[parentId];
      }
      parentId = index.parent.get(parentId);
    }
  }

  private findRowById(targetId: string): T | null {
    const getId = this.getRowId();
    const getChildrenFn = this.getChildren();

    const search = (rows: T[]): T | null => {
      for (const row of rows) {
        if (getId(row) === targetId) return row;
        const children = getChildrenFn(row);
        if (children && children.length > 0) {
          const found = search(children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.data());
  }

  private isNodeExpanded(id: string, depth: number): boolean {
    const expanded = this.subRowExpandedRows();
    if (id in expanded) return expanded[id];
    const defaultExpanded = this.subRowDefaultExpanded();
    if (defaultExpanded === -1) return true;
    return depth < defaultExpanded;
  }

  private flattenTreeFull(rows: T[]): FlattenedTreeRow<T>[] {
    const getId = this.getRowId();
    const getChildrenFn = this.getChildren();
    const result: FlattenedTreeRow<T>[] = [];

    const walk = (items: T[], depth: number, parentId: string | null, parentRow: T | null, path: string[]) => {
      for (const row of items) {
        const id = getId(row);
        const children = getChildrenFn(row) ?? [];
        const isLeaf = children.length === 0;
        const rowExpanded = !isLeaf && this.isNodeExpanded(id, depth);
        const rowPath = [...path, id];

        result.push({
          row,
          depth,
          parentId,
          parentRow,
          path: rowPath,
          isLeaf,
          childCount: children.length,
          isExpanded: rowExpanded,
        });

        if (rowExpanded && children.length > 0) {
          walk(children, depth + 1, id, row, rowPath);
        }
      }
    };
    walk(rows, 0, null, null, []);
    return result;
  }

  private flattenTreeRowsForPage(rootSlice: T[]): T[] {
    return this.flattenTreeFull(rootSlice).map(tr => tr.row);
  }

  private flattenTreeRowsForPageFull(rootSlice: T[]): FlattenedTreeRow<T>[] {
    return this.flattenTreeFull(rootSlice);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = this._document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    this._document.body.appendChild(a);
    a.click();
    a.remove();
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

  getRenderedTreeRowAt(index: number): FlattenedTreeRow<T> | undefined {
    return this.processedTreeRows()[index];
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
    this.resizeStartWidth = Number.parseInt(col._width, 10) || 150;
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
    const minWidth = Number.parseInt(this.resizingColumn._minWidth, 10) || 50;
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
