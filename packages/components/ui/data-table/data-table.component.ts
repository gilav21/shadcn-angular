import {
  Component,
  computed,
  effect,
  input,
  output,
  model,
  signal,
  viewChild,
  viewChildren,
  ChangeDetectionStrategy,
  Type,
  TemplateRef,
  ElementRef,
  inject,
  AfterViewInit,
  OnDestroy,
} from "@angular/core";
import { CommonModule, DOCUMENT } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { cn, isRtl } from "../../lib/utils";
import { CALENDAR_LOCALES, CalendarLocale } from "../calendar-locales";
import { generateXlsx } from "../../lib/parsers/xlsx";
import {
  TableComponent,
  TableHeaderComponent,
  TableBodyComponent,
  TableRowComponent,
  TableHeadComponent,
  TableCellComponent,
} from "../table.component";
import { InputComponent } from "../input.component";
import { CheckboxComponent } from "../checkbox.component";
import {
  PopoverComponent,
  PopoverTriggerComponent,
  PopoverContentComponent,
} from "../popover.component";
import { DataTableColumnHeaderComponent } from "./data-table-column-header.component";
import { DataTablePaginationComponent } from "./data-table-pagination.component";
import { UiComponentOutletDirective } from "../component-outlet.directive";
import {
  ContextMenuComponent,
  ContextMenuItem,
} from "../context-menu.component";
import { ButtonComponent } from "../button.component";
import { IconComponent } from "../icon.component";
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
  RowActionContext,
  VirtualAutoThreshold,
  CellEditEvent,
  EditingCell,
  RowReorderEvent,
  RowDragPosition,
  CellRange,
  CellFlashDirection,
  CellStyleColumn,
} from "./data-table.types";
import {
  computeRowRange,
  computeColumnRange,
  computeVariableRowRange,
  buildPrefixSums,
} from "./data-table.utils";
import { ComponentPoolService } from "./component-pool.service";

declare const ngDevMode: boolean | undefined;

const EMPTY_RECORD: Readonly<Record<string, never>> = Object.freeze({});

const DEFAULT_GET_ROW_ID = <T>(row: T): string => {
  const rec = row as Record<string, unknown>;
  return rec['id'] != null ? String(rec['id']) : String(JSON.stringify(row));
};

@Component({
  selector: "ui-data-table",
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
    ContextMenuComponent,
    ButtonComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ComponentPoolService],
  host: {
    class: "block h-full w-full",
  },
  template: `
    <!-- Reusable: cell content rendering (component/template/cell/default) -->
    <ng-template
      #cellContentTpl
      let-col
      let-row="row"
      let-treeRow="treeRow"
      let-recycle="recycle"
    >
      @if (col.component) {
        <div
          [uiComponentOutlet]="col.component"
          [inputs]="
            treeRow
              ? getSubRowComponentInputs(col, treeRow)
              : col.componentInputs
                ? col.componentInputs(row)
                : EMPTY_RECORD
          "
          [outputs]="
            col.componentOutputs ? col.componentOutputs(row) : EMPTY_RECORD
          "
          [recycle]="recycle"
        ></div>
      } @else if (col.template) {
        @if (treeRow) {
          <ng-container
            *ngTemplateOutlet="
              col.template;
              context: {
                $implicit: row,
                depth: treeRow.depth,
                parentRow: treeRow.parentRow,
                parentId: treeRow.parentId,
                path: treeRow.path,
                isLeaf: treeRow.isLeaf,
                childCount: treeRow.childCount,
              }
            "
          ></ng-container>
        } @else {
          <ng-container
            *ngTemplateOutlet="col.template; context: { $implicit: row }"
          ></ng-container>
        }
      } @else if (col.cell) {
        {{ col.cell(row) }}
      } @else {
        {{ getCellValue(row, col.accessorKey, col) }}
      }
    </ng-template>

    <!-- Reusable: full cell rendering (special columns + content) -->
    <ng-template
      #cellTpl
      let-col
      let-row="row"
      let-rowIndex="rowIndex"
      let-treeRow="treeRow"
      let-recycle="recycle"
    >
      @if (col.accessorKey === "_selection") {
        <ui-checkbox
          [checked]="isRowSelected(row)"
          [disabled]="isDisabled(row)"
          [indeterminate]="
            treeRow ? isSubRowSelectionIndeterminate(row) : false
          "
          (checkedChange)="treeRow ? toggleRowWithCascade(row) : toggleRow(row)"
          ariaLabel="Select row"
        />
      } @else if (col._isTreeExpanderHost && treeRow) {
        <div
          class="flex items-center gap-1 min-w-0"
          [style.padding-inline-start.px]="treeRow.depth * subRowIndentSize()"
        >
          @if (!treeRow.isLeaf) {
            <button
              type="button"
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              [attr.aria-label]="
                treeRow.isExpanded ? 'Collapse sub-rows' : 'Expand sub-rows'
              "
              (click)="toggleSubRowExpanded(treeRow.row, $event)"
            >
              <ui-icon
                [name]="isRtl() ? 'chevron-left' : 'chevron-right'"
                size="xs"
                class="transition-transform duration-200"
                [class.rotate-90]="treeRow.isExpanded && !isRtl()"
                [class.-rotate-90]="treeRow.isExpanded && isRtl()"
              />
            </button>
          } @else {
            <span class="inline-block h-6 w-6 shrink-0"></span>
          }
          <span class="truncate">
            <ng-container
              *ngTemplateOutlet="
                cellContentTpl;
                context: {
                  $implicit: col,
                  row: row,
                  treeRow: treeRow,
                  recycle: recycle,
                }
              "
            ></ng-container>
          </span>
        </div>
      } @else if (col.accessorKey === "_expander") {
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
          [attr.aria-label]="isRowExpanded(row) ? 'Collapse row' : 'Expand row'"
          [attr.aria-expanded]="isRowExpanded(row)"
          (click)="toggleRowExpanded(row, $event)"
        >
          @if (isRowExpanded(row)) {
            <ui-icon name="chevron-up" size="xs" />
          } @else {
            <ui-icon name="chevron-down" size="xs" />
          }
        </button>
      } @else if (col.accessorKey === "_actions") {
        @if (!isDisabled(row)) {
          <ui-button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            ariaLabel="Row actions"
            (click)="onActionsButtonClick($event, row, rowIndex)"
          >
            <ui-icon name="more-vertical" size="sm" />
          </ui-button>
        }
      } @else if (
        col.editable && isEditing(rowIndex, String(col.accessorKey))
      ) {
        <ng-container
          *ngTemplateOutlet="
            cellEditTpl;
            context: { $implicit: col, row: row, rowIndex: rowIndex }
          "
        ></ng-container>
      } @else {
        <ng-container
          *ngTemplateOutlet="
            cellContentTpl;
            context: {
              $implicit: col,
              row: row,
              treeRow: treeRow,
              recycle: recycle,
            }
          "
        ></ng-container>
      }
    </ng-template>

    <!-- Reusable: cell edit mode -->
    <ng-template #cellEditTpl let-col let-row="row" let-rowIndex="rowIndex">
      @if (col.editComponent) {
        <div
          [uiComponentOutlet]="col.editComponent"
          [inputs]="{ value: editValue(), row: row, column: col }"
          [outputs]="{
            valueChange: onEditValueChange.bind(this),
            commit: commitEdit.bind(this),
            cancel: cancelEdit.bind(this),
          }"
        ></div>
      } @else if (col.editTemplate) {
        <ng-container
          *ngTemplateOutlet="
            col.editTemplate;
            context: {
              $implicit: editValue(),
              row: row,
              column: col,
              setValue: onEditValueChange.bind(this),
              commit: commitEdit.bind(this),
              cancel: cancelEdit.bind(this),
            }
          "
        ></ng-container>
      } @else if (col.editType === "checkbox") {
        <ui-checkbox
          [checked]="!!editValue()"
          (checkedChange)="onEditValueChange($event); commitEdit()"
        />
      } @else if (col.editType === "select" && col.editOptions) {
        <select
          data-edit-input
          class="w-full h-full bg-background border-0 outline-none text-sm px-1"
          [value]="editValue()"
          (change)="onEditValueChange($any($event.target).value); commitEdit()"
          (keydown)="onEditKeydown($event)"
        >
          @for (opt of col.editOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      } @else {
        <input
          data-edit-input
          [type]="col.editType === 'number' ? 'number' : 'text'"
          class="w-full h-full bg-background border-0 outline-none text-sm px-1"
          [value]="editValue()"
          (input)="onEditValueChange($any($event.target).value)"
          (keydown)="onEditKeydown($event)"
          (blur)="editingCell() ? commitEdit() : null"
        />
      }
    </ng-template>

    <!-- Reusable: row detail/expansion panel -->
    <ng-template #rowDetailTpl let-row>
      @if (rowDetailTemplate()) {
        <ng-container
          *ngTemplateOutlet="
            rowDetailTemplate();
            context: { $implicit: row, row: row }
          "
        ></ng-container>
      } @else if (rowDetailComponent()) {
        <div
          [uiComponentOutlet]="rowDetailComponent()"
          [inputs]="getRowDetailComponentInputs(row)"
        ></div>
      } @else {
        <pre class="text-xs text-muted-foreground whitespace-pre-wrap">{{
          row | json
        }}</pre>
      }
    </ng-template>

    <!-- Reusable: empty state -->
    <ng-template #emptyStateTpl>
      <ui-table-row class="hover:bg-transparent justify-center w-full">
        <ui-table-cell
          class="h-48 sm:h-96 text-center w-full p-0 border-none justify-center"
        >
          @if (emptyStateComponent()) {
            <ng-container
              [uiComponentOutlet]="emptyStateComponent()"
              [inputs]="emptyStateComponentInputs()"
            ></ng-container>
          } @else {
            <div
              class="flex h-full flex-col items-center justify-center py-10 text-center text-muted-foreground w-full"
            >
              <ui-icon name="circle-off" size="xl" class="mb-4 opacity-20" />
              <p>{{ noResultsLabel() }}</p>
            </div>
          }
        </ui-table-cell>
      </ui-table-row>
    </ng-template>

    <div class="flex flex-col w-full h-full space-y-4">
      @if (showToolbar()) {
        <div class="flex flex-wrap items-center justify-between gap-2 flex-none">
          <div class="flex flex-1 items-center space-x-2">
            <ui-input
              [placeholder]="filterPlaceholder()"
              [ngModel]="globalFilter()"
              (ngModelChange)="onFilterChange($event)"
              class="h-8 w-full sm:w-[150px] lg:w-[250px]"
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
                  {{ columnsLabel() }}
                </button>
              </ui-popover-trigger>
              <ui-popover-content class="w-56 p-2">
                <div class="space-y-1">
                  @for (col of hideableColumns(); track col.accessorKey) {
                    <label
                      class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <ui-checkbox
                        [checked]="isColumnVisible(col.accessorKey)"
                        (checkedChange)="
                          setColumnVisibility(col.accessorKey, $event)
                        "
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

      <div
        #scrollContainer
        class="rounded-md border relative flex-1 min-h-0 overflow-auto w-full"
        [class.contain-strict]="isVirtualScrollActive()"
        [class.will-change-scroll]="isVirtualScrollActive()"
        (keydown)="onTableKeydown($event)"
        (click)="onTableClick()"
        (contextmenu)="onRowContextMenu($event)"
        (scroll)="isVirtualScrollActive() ? onVirtualScroll($event) : null"
        (dragover)="onContainerDragOver($event)"
        (drop)="onRowDrop($event)"
        tabindex="0"
      >
        @if (isLoaderVisible()) {
          <div
            class="absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
          >
            @if (loaderTemplate()) {
              <ng-container
                *ngTemplateOutlet="
                  loaderTemplate();
                  context: {
                    $implicit: loadingTrigger(),
                    trigger: loadingTrigger(),
                  }
                "
              ></ng-container>
            } @else if (loaderComponent()) {
              <ng-container
                [uiComponentOutlet]="loaderComponent()"
                [inputs]="resolvedLoaderComponentInputs()"
              ></ng-container>
            } @else {
              <div
                class="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground"
              >
                <span
                  class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
                ></span>
                <span>Loading...</span>
              </div>
            }
          </div>
        }
        @if (exporting()) {
          <div
            class="absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
          >
            <div
              class="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground"
            >
              <span
                class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
              ></span>
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
                  class="group/head"
                  [class.cursor-grab]="isColumnDraggable(col)"
                  [class.cursor-grabbing]="isDraggingColumn(col)"
                  [class.opacity-70]="isDraggingColumn(col)"
                  [class.relative]="isDropTargetColumn(col)"
                  [attr.data-column-id]="String(col.accessorKey)"
                  [attr.draggable]="isColumnDraggable(col) ? 'true' : null"
                  [style]="getHeaderCellStyle(col)"
                  (dragstart)="onColumnDragStart($event, col)"
                  (dragover)="onColumnDragOver($event, col)"
                  (drop)="onColumnDrop($event, col)"
                  (dragend)="onColumnDragEnd()"
                >
                  @if (isDropTargetColumn(col)) {
                    <div
                      class="pointer-events-none absolute inset-0 z-30 border-2 border-primary/70 bg-primary/10"
                    ></div>
                  }
                  <div class="flex items-center w-full h-full">
                    <div class="flex-1 min-w-0">
                      @if (col.accessorKey === "_selection") {
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
                            [attr.aria-label]="
                              isAllSubRowsExpanded()
                                ? 'Collapse all sub-rows'
                                : 'Expand all sub-rows'
                            "
                            (click)="
                              isAllSubRowsExpanded()
                                ? collapseAllSubRows()
                                : expandAllSubRows(-1)
                            "
                          >
                            @if (isAllSubRowsExpanded()) {
                              <ui-icon name="chevrons-up" size="xs" />
                            } @else {
                              <ui-icon name="chevrons-down" size="xs" />
                            }
                          </button>
                          @if (col.enableSorting !== false) {
                            <ui-data-table-column-header
                              [title]="col.header"
                              [column]="String(col.accessorKey)"
                              [direction]="getSortDirection(col.accessorKey)"
                              [sortIndex]="getSortIndex(col.accessorKey)"
                              (sortMeta)="
                                onSortChange(
                                  col.accessorKey,
                                  $event.direction,
                                  $event.multi
                                )
                              "
                            />
                          } @else {
                            <span>{{ col.header }}</span>
                          }
                        </div>
                      } @else if (col.accessorKey === "_expander") {
                        <button
                          type="button"
                          class="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                          [attr.aria-label]="
                            isAllExpanded()
                              ? 'Collapse all rows'
                              : 'Expand all rows'
                          "
                          (click)="toggleAllExpanded()"
                        >
                          @if (isAllExpanded()) {
                            <ui-icon name="chevrons-up" size="xs" />
                          } @else {
                            <ui-icon name="chevrons-down" size="xs" />
                          }
                        </button>
                      } @else if (col.accessorKey === "_actions") {
                        <span class="sr-only">Actions</span>
                      } @else if (col.headerTemplate) {
                        <ng-container
                          *ngTemplateOutlet="
                            col.headerTemplate;
                            context: { $implicit: col }
                          "
                        ></ng-container>
                      } @else if (col.enableSorting !== false) {
                        <div class="flex items-center gap-2">
                          <ui-data-table-column-header
                            [title]="col.header"
                            [column]="String(col.accessorKey)"
                            [direction]="getSortDirection(col.accessorKey)"
                            [sortIndex]="getSortIndex(col.accessorKey)"
                            (sortMeta)="
                              onSortChange(
                                col.accessorKey,
                                $event.direction,
                                $event.multi
                              )
                            "
                          />
                          @if (col.enableFiltering && col.filterComponent) {
                            <ui-popover [closeOnScroll]="true">
                              <ui-popover-trigger>
                                <button
                                  class="relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 w-8"
                                  [class.text-primary]="
                                    isColumnFilterActive(col)
                                  "
                                  [attr.aria-label]="'Filter ' + col.header"
                                >
                                  @if (isColumnFilterActive(col)) {
                                    <ui-icon
                                      name="filter"
                                      size="sm"
                                      weight="solid"
                                    />
                                  } @else {
                                    <ui-icon name="filter" size="sm" />
                                  }
                                </button>
                              </ui-popover-trigger>
                              <ui-popover-content
                                class="w-80 max-w-[calc(100vw-2rem)]"
                                strategy="fixed"
                                align="end"
                              >
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
                                  class="relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 w-8"
                                  [class.text-primary]="
                                    isColumnFilterActive(col)
                                  "
                                  [attr.aria-label]="'Filter ' + col.header"
                                >
                                  @if (isColumnFilterActive(col)) {
                                    <ui-icon
                                      name="filter"
                                      size="sm"
                                      weight="solid"
                                    />
                                  } @else {
                                    <ui-icon name="filter" size="sm" />
                                  }
                                </button>
                              </ui-popover-trigger>
                              <ui-popover-content
                                class="w-80 max-w-[calc(100vw-2rem)]"
                                strategy="fixed"
                                align="end"
                              >
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
                    @if (
                      enableColumnMenu() &&
                      col.accessorKey !== "_selection" &&
                      col.accessorKey !== "_expander" &&
                      col.accessorKey !== "_actions"
                    ) {
                      <button
                        type="button"
                        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 group-hover/head:opacity-100 touch-visible hover:bg-accent hover:text-accent-foreground transition-opacity"
                        [attr.aria-label]="'Column menu for ' + col.header"
                        (click)="onColumnMenuClick($event, col)"
                      >
                        <ui-icon name="more-vertical" size="xs" />
                      </button>
                    }
                  </div>
                  @if (
                    enableColumnResize() &&
                    col.accessorKey !== "_selection"
                  ) {
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
            @if (enableFloatingFilters() && hasAnyFloatingFilter()) {
              <ui-table-row class="border-0">
                @for (col of enhancedColumns(); track col.accessorKey) {
                  <ui-table-head
                    [style]="getHeaderCellStyle(col)"
                    class="sticky top-[var(--header-height,41px)] z-20 bg-muted/50 py-1 px-1 overflow-hidden"
                  >
                    @if (
                      col.floatingFilter !== false &&
                      col.accessorKey !== "_selection" &&
                      col.accessorKey !== "_expander" &&
                      col.accessorKey !== "_actions"
                    ) {
                      @if (col.floatingFilterComponent) {
                        <div
                          [uiComponentOutlet]="col.floatingFilterComponent"
                          [inputs]="getFilterInputs(col)"
                          [outputs]="getFilterOutputs(col)"
                        ></div>
                      } @else if (col.floatingFilterTemplate) {
                        <ng-container
                          *ngTemplateOutlet="
                            col.floatingFilterTemplate;
                            context: {
                              $implicit: col,
                              value: columnFilters()[String(col.accessorKey)],
                              change: getFloatingFilterChange(col),
                            }
                          "
                        ></ng-container>
                      } @else if (col.enableFiltering) {
                        <ui-input
                          class="h-7 text-xs"
                          [placeholder]="col.header"
                          [ngModel]="
                            columnFilters()[String(col.accessorKey)] || ''
                          "
                          (ngModelChange)="
                            onColumnFilterChange(col.accessorKey, $event)
                          "
                        />
                      }
                    }
                  </ui-table-head>
                }
                @if (!hasFlexibleColumns()) {
                  <ui-table-head
                    class="flex-1 pointer-events-none sticky top-[var(--header-height,41px)] z-20 bg-muted/50"
                  ></ui-table-head>
                }
              </ui-table-row>
            }
          </ui-table-header>
          <ui-table-body>
            @if (isVirtualScrollActive()) {
              <div
                [style.height.px]="virtualPaddingTop()"
                class="flex-shrink-0"
              ></div>
              @if (enableSubRows()) {
                @for (
                  treeRow of virtualVisibleTreeRows();
                  track getRowId()(treeRow.row);
                  let i = $index
                ) {
                  <ui-table-row
                    #virtualRow
                    [attr.data-state]="
                      isRowSelected(treeRow.row) ? 'selected' : null
                    "
                    [attr.data-disabled]="isDisabled(treeRow.row) || null"
                    [class.opacity-50]="isDisabled(treeRow.row)"
                    [attr.data-row-index]="getVirtualRowIndex(i)"
                    [attr.data-row-id]="getRowId()(treeRow.row)"
                    [attr.data-virtual-row-index]="getVirtualRowIndex(i)"
                    [attr.data-depth]="treeRow.depth"
                    [attr.aria-level]="treeRow.depth + 1"
                    [attr.aria-expanded]="
                      treeRow.isLeaf ? null : treeRow.isExpanded
                    "
                    [style.height.px]="
                      virtualVariableRowHeight() ? null : virtualRowHeight()
                    "
                    class="border-0"
                  >
                    @for (col of pinnedLeftColumns(); track col.accessorKey) {
                      <ui-table-cell
                        [class]="
                          getCellClass(
                            col,
                            getVirtualRowIndex(i),
                            treeRow.depth
                          )
                        "
                        [attr.data-column]="String(col.accessorKey)"
                        [style]="getTreeCellStyle(col, treeRow.depth)"
                        (click)="
                          onCellClick(getVirtualRowIndex(i), col, $event)
                        "
                        (dblclick)="
                          onCellDblClick(getVirtualRowIndex(i), col, $event)
                        "
                        (touchend)="
                          onCellTouchEnd($event, getVirtualRowIndex(i), col)
                        "
                      >
                        <ng-container
                          *ngTemplateOutlet="
                            cellTpl;
                            context: {
                              $implicit: col,
                              row: treeRow.row,
                              rowIndex: getVirtualRowIndex(i),
                              treeRow: treeRow,
                              recycle: virtualRecycleComponents(),
                            }
                          "
                        ></ng-container>
                      </ui-table-cell>
                    }
                    <div
                      [style.min-width.px]="virtualPaddingLeft()"
                      class="flex-shrink-0"
                    ></div>
                    @for (
                      col of virtualVisibleMiddleColumns();
                      track col.accessorKey
                    ) {
                      <ui-table-cell
                        [class]="
                          getCellClass(
                            col,
                            getVirtualRowIndex(i),
                            treeRow.depth
                          )
                        "
                        [attr.data-column]="String(col.accessorKey)"
                        [style]="getTreeCellStyle(col, treeRow.depth)"
                        (click)="
                          onCellClick(getVirtualRowIndex(i), col, $event)
                        "
                        (dblclick)="
                          onCellDblClick(getVirtualRowIndex(i), col, $event)
                        "
                        (touchend)="
                          onCellTouchEnd($event, getVirtualRowIndex(i), col)
                        "
                      >
                        <ng-container
                          *ngTemplateOutlet="
                            cellTpl;
                            context: {
                              $implicit: col,
                              row: treeRow.row,
                              rowIndex: getVirtualRowIndex(i),
                              treeRow: treeRow,
                              recycle: virtualRecycleComponents(),
                            }
                          "
                        ></ng-container>
                      </ui-table-cell>
                    }
                    <div
                      [style.min-width.px]="virtualPaddingRight()"
                      class="flex-shrink-0"
                    ></div>
                    @for (col of pinnedRightColumns(); track col.accessorKey) {
                      <ui-table-cell
                        [class]="
                          getCellClass(
                            col,
                            getVirtualRowIndex(i),
                            treeRow.depth
                          )
                        "
                        [attr.data-column]="String(col.accessorKey)"
                        [style]="getTreeCellStyle(col, treeRow.depth)"
                        (click)="
                          onCellClick(getVirtualRowIndex(i), col, $event)
                        "
                        (dblclick)="
                          onCellDblClick(getVirtualRowIndex(i), col, $event)
                        "
                        (touchend)="
                          onCellTouchEnd($event, getVirtualRowIndex(i), col)
                        "
                      >
                        <ng-container
                          *ngTemplateOutlet="
                            cellTpl;
                            context: {
                              $implicit: col,
                              row: treeRow.row,
                              rowIndex: getVirtualRowIndex(i),
                              treeRow: treeRow,
                              recycle: virtualRecycleComponents(),
                            }
                          "
                        ></ng-container>
                      </ui-table-cell>
                    }
                  </ui-table-row>
                }
              } @else {
                @for (
                  row of virtualVisibleRows();
                  track getRowId()(row);
                  let i = $index
                ) {
                  <ui-table-row
                    #virtualRow
                    [attr.data-state]="isRowSelected(row) ? 'selected' : null"
                    [attr.data-disabled]="isDisabled(row) || null"
                    [class.opacity-50]="isDisabled(row)"
                    [class.opacity-30]="isRowBeingDragged(row)"
                    [attr.data-row-index]="getVirtualRowIndex(i)"
                    [attr.data-row-id]="getRowId()(row)"
                    [attr.data-virtual-row-index]="getVirtualRowIndex(i)"
                    [attr.draggable]="enableRowDrag() && !isDisabled(row) ? 'true' : null"
                    (dragstart)="onRowDragStart($event, row)"
                    (dragover)="onRowDragOver($event, getVirtualRowIndex(i))"
                    (drop)="onRowDrop($event)"
                    (dragend)="onRowDragEnd()"
                    [style.height.px]="
                      virtualVariableRowHeight() ? null : virtualRowHeight()
                    "
                    class="border-0 relative"
                  >
                    @switch (getDropEdge(getVirtualRowIndex(i))) {
                      @case ('top') {
                        <div class="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 bg-primary shadow-[0_0_4px_0] shadow-primary"></div>
                      }
                      @case ('bottom') {
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-0.5 bg-primary shadow-[0_0_4px_0] shadow-primary"></div>
                      }
                      @case ('on') {
                        <div class="pointer-events-none absolute inset-0 z-30 border-2 border-primary/50 rounded-sm bg-primary/5"></div>
                      }
                    }
                    @for (col of pinnedLeftColumns(); track col.accessorKey) {
                      <ui-table-cell
                        [class]="getCellClass(col, getVirtualRowIndex(i))"
                        [attr.data-column]="String(col.accessorKey)"
                        [style]="getCellStyle(col)"
                        (click)="
                          onCellClick(getVirtualRowIndex(i), col, $event)
                        "
                        (dblclick)="
                          onCellDblClick(getVirtualRowIndex(i), col, $event)
                        "
                        (touchend)="
                          onCellTouchEnd($event, getVirtualRowIndex(i), col)
                        "
                      >
                        <ng-container
                          *ngTemplateOutlet="
                            cellTpl;
                            context: {
                              $implicit: col,
                              row: row,
                              rowIndex: getVirtualRowIndex(i),
                              treeRow: null,
                              recycle: virtualRecycleComponents(),
                            }
                          "
                        ></ng-container>
                      </ui-table-cell>
                    }
                    <div
                      [style.min-width.px]="virtualPaddingLeft()"
                      class="flex-shrink-0"
                    ></div>
                    @for (
                      col of virtualVisibleMiddleColumns();
                      track col.accessorKey
                    ) {
                      <ui-table-cell
                        [class]="getCellClass(col, getVirtualRowIndex(i))"
                        [attr.data-column]="String(col.accessorKey)"
                        [style]="getCellStyle(col)"
                        (click)="
                          onCellClick(getVirtualRowIndex(i), col, $event)
                        "
                        (dblclick)="
                          onCellDblClick(getVirtualRowIndex(i), col, $event)
                        "
                        (touchend)="
                          onCellTouchEnd($event, getVirtualRowIndex(i), col)
                        "
                      >
                        <ng-container
                          *ngTemplateOutlet="
                            cellTpl;
                            context: {
                              $implicit: col,
                              row: row,
                              rowIndex: getVirtualRowIndex(i),
                              treeRow: null,
                              recycle: virtualRecycleComponents(),
                            }
                          "
                        ></ng-container>
                      </ui-table-cell>
                    }
                    <div
                      [style.min-width.px]="virtualPaddingRight()"
                      class="flex-shrink-0"
                    ></div>
                    @for (col of pinnedRightColumns(); track col.accessorKey) {
                      <ui-table-cell
                        [class]="getCellClass(col, getVirtualRowIndex(i))"
                        [attr.data-column]="String(col.accessorKey)"
                        [style]="getCellStyle(col)"
                        (click)="
                          onCellClick(getVirtualRowIndex(i), col, $event)
                        "
                        (dblclick)="
                          onCellDblClick(getVirtualRowIndex(i), col, $event)
                        "
                        (touchend)="
                          onCellTouchEnd($event, getVirtualRowIndex(i), col)
                        "
                      >
                        <ng-container
                          *ngTemplateOutlet="
                            cellTpl;
                            context: {
                              $implicit: col,
                              row: row,
                              rowIndex: getVirtualRowIndex(i),
                              treeRow: null,
                              recycle: virtualRecycleComponents(),
                            }
                          "
                        ></ng-container>
                      </ui-table-cell>
                    }
                  </ui-table-row>
                  @if (enableRowExpansion() && isRowExpanded(row)) {
                    <ui-table-row class="border-0 bg-muted/20">
                      <ui-table-cell
                        class="flex-1 border-b"
                        style="min-width: 0; max-width: none; width: 100%; flex-basis: 100%;"
                      >
                        <ng-container
                          *ngTemplateOutlet="
                            rowDetailTpl;
                            context: { $implicit: row }
                          "
                        ></ng-container>
                      </ui-table-cell>
                    </ui-table-row>
                  }
                }
              }
              @if (virtualTotalRows() === 0) {
                <ng-container *ngTemplateOutlet="emptyStateTpl"></ng-container>
              }
              <div
                [style.height.px]="virtualPaddingBottom()"
                class="flex-shrink-0"
              ></div>
            } @else if (enableSubRows()) {
              @if (processedTreeRows().length > 0) {
                @for (
                  treeRow of processedTreeRows();
                  track getRowId()(treeRow.row);
                  let i = $index
                ) {
                  <ui-table-row
                    [attr.data-state]="isRowSelected(treeRow.row) ? 'selected' : null"
                    [attr.data-disabled]="isDisabled(treeRow.row) || null"
                    [class.opacity-50]="isDisabled(treeRow.row)"
                    [class.opacity-30]="isRowBeingDragged(treeRow.row)"
                    [class.ring-2]="isRowBeingDragged(treeRow.row)"
                    [class.ring-primary/30]="isRowBeingDragged(treeRow.row)"
                    [class.ring-inset]="isRowBeingDragged(treeRow.row)"
                    [class.bg-primary/5]="isRowBeingDragged(treeRow.row)"
                    [attr.data-row-index]="i"
                    [attr.data-row-id]="getRowId()(treeRow.row)"
                    [attr.data-depth]="treeRow.depth"
                    [attr.aria-level]="treeRow.depth + 1"
                    [attr.aria-expanded]="treeRow.isLeaf ? null : treeRow.isExpanded"
                    [attr.draggable]="enableRowDrag() && !isDisabled(treeRow.row) ? 'true' : null"
                    (dragstart)="onRowDragStart($event, treeRow.row)"
                    (dragover)="onRowDragOver($event, i)"
                    (drop)="onRowDrop($event)"
                    (dragend)="onRowDragEnd()"
                    class="border-0 relative"
                  >
                    @switch (getDropEdge(i)) {
                      @case ('top') {
                        <div class="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 bg-primary shadow-[0_0_4px_0] shadow-primary"></div>
                      }
                      @case ('bottom') {
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-0.5 bg-primary shadow-[0_0_4px_0] shadow-primary"></div>
                      }
                      @case ('on') {
                        <div class="pointer-events-none absolute inset-0 z-30 border-2 border-primary/50 rounded-sm bg-primary/5"></div>
                      }
                    }
                    @for (col of enhancedColumns(); track col.accessorKey) {
                      <ui-table-cell
                        [class]="getCellClass(col, i, treeRow.depth)"
                        [attr.data-column]="String(col.accessorKey)"
                        [style]="getTreeCellStyle(col, treeRow.depth)"
                        (click)="onCellClick(i, col, $event)"
                        (dblclick)="onCellDblClick(i, col, $event)"
                        (touchend)="onCellTouchEnd($event, i, col)"
                      >
                        <ng-container
                          *ngTemplateOutlet="
                            cellTpl;
                            context: {
                              $implicit: col,
                              row: treeRow.row,
                              rowIndex: i,
                              treeRow: treeRow,
                              recycle: false,
                            }
                          "
                        ></ng-container>
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
                      <ui-table-cell
                        class="flex-1 border-b"
                        style="min-width: 0; max-width: none; width: 100%; flex-basis: 100%;"
                      >
                        <ng-container
                          *ngTemplateOutlet="
                            rowDetailTpl;
                            context: { $implicit: treeRow.row }
                          "
                        ></ng-container>
                      </ui-table-cell>
                    </ui-table-row>
                  }
                }
              } @else {
                <ng-container *ngTemplateOutlet="emptyStateTpl"></ng-container>
              }
            } @else if (processedData().length > 0) {
              @for (
                row of (dragPreviewData() ?? processedData());
                track getRowId()(row);
                let i = $index
              ) {
                @if (isFullWidthRow(row)) {
                  <ui-table-row
                    [attr.data-state]="isRowSelected(row) ? 'selected' : null"
                    [attr.data-disabled]="isDisabled(row) || null"
                    [class.opacity-50]="isDisabled(row)"
                    [attr.data-row-index]="i"
                    [attr.data-row-id]="getRowId()(row)"
                    class="border-0"
                  >
                    <ui-table-cell
                      class="flex-1 border-b"
                      style="min-width: 0; max-width: none; width: 100%; flex-basis: 100%;"
                    >
                      @if (fullWidthRowTemplate()) {
                        <ng-container
                          *ngTemplateOutlet="
                            fullWidthRowTemplate();
                            context: { $implicit: row, index: i }
                          "
                        ></ng-container>
                      } @else if (fullWidthRowComponent()) {
                        <div
                          [uiComponentOutlet]="fullWidthRowComponent()"
                          [inputs]="{ row: row, index: i }"
                        ></div>
                      }
                    </ui-table-cell>
                  </ui-table-row>
                } @else {
                  <ui-table-row
                    [attr.data-state]="isRowSelected(row) ? 'selected' : null"
                    [attr.data-disabled]="isDisabled(row) || null"
                    [class.opacity-50]="isDisabled(row)"
                    [class.opacity-30]="isRowBeingDragged(row)"
                    [class.ring-2]="isRowBeingDragged(row)"
                    [class.ring-primary/30]="isRowBeingDragged(row)"
                    [class.ring-inset]="isRowBeingDragged(row)"
                    [class.bg-primary/5]="isRowBeingDragged(row)"
                    [attr.data-row-index]="i"
                    [attr.data-row-id]="getRowId()(row)"
                    [attr.draggable]="enableRowDrag() && !isDisabled(row) ? 'true' : null"
                    (dragstart)="onRowDragStart($event, row)"
                    (dragover)="onRowDragOver($event, i)"
                    (drop)="onRowDrop($event)"
                    (dragend)="onRowDragEnd()"
                    class="border-0"
                  >
                    @for (col of enhancedColumns(); track col.accessorKey) {
                      <ui-table-cell [class]="getCellClass(col, i)" [attr.data-column]="String(col.accessorKey)" [style]="getCellStyle(col)" (click)="onCellClick(i, col, $event)" (dblclick)="onCellDblClick(i, col, $event)" (touchend)="onCellTouchEnd($event, i, col)">
                        <ng-container *ngTemplateOutlet="cellTpl; context: { $implicit: col, row: row, rowIndex: i, treeRow: null, recycle: false }"></ng-container>
                      </ui-table-cell>
                    }
                    @if (!hasFlexibleColumns()) {
                      <ui-table-cell class="flex-1 pointer-events-none" [class]="getCellClass({ _width: 'auto' })"></ui-table-cell>
                    }
                  </ui-table-row>
                  @if (enableRowExpansion() && isRowExpanded(row)) {
                    <ui-table-row class="border-0 bg-muted/20">
                      <ui-table-cell class="flex-1 border-b" style="min-width: 0; max-width: none; width: 100%; flex-basis: 100%;">
                        <ng-container *ngTemplateOutlet="rowDetailTpl; context: { $implicit: row }"></ng-container>
                      </ui-table-cell>
                    </ui-table-row>
                  }
                }
              }
            } @else {
              <ng-container *ngTemplateOutlet="emptyStateTpl"></ng-container>
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
          @if (hasFooter()) {
            <div
              class="sticky bottom-0 z-20 bg-background border-t"
              data-slot="table-footer"
            >
              <ui-table-row>
                @for (col of enhancedColumns(); track col.accessorKey) {
                  <ui-table-cell
                    [style]="getCellStyle(col)"
                    class="whitespace-nowrap overflow-hidden text-ellipsis text-sm font-medium text-muted-foreground"
                  >
                    @if (col.footerComponent) {
                      <div
                        [uiComponentOutlet]="col.footerComponent"
                        [inputs]="{
                          column: col,
                          rows: filteredData(),
                          value:
                            footerValues().get(String(col.accessorKey)) || '',
                        }"
                      ></div>
                    } @else if (col.footerTemplate) {
                      <ng-container
                        *ngTemplateOutlet="
                          col.footerTemplate;
                          context: {
                            $implicit: col,
                            rows: filteredData(),
                            value:
                              footerValues().get(String(col.accessorKey)) || '',
                          }
                        "
                      ></ng-container>
                    } @else {
                      {{ footerValues().get(String(col.accessorKey)) || "" }}
                    }
                  </ui-table-cell>
                }
                @if (!hasFlexibleColumns()) {
                  <ui-table-cell
                    class="flex-1 pointer-events-none"
                  ></ui-table-cell>
                }
              </ui-table-row>
            </div>
          }
        </ui-table>
      </div>

      @if (showPagination()) {
        <ui-data-table-pagination
          class="flex-none"
          [total]="activeTotalItems()"
          [state]="paginationState()"
          [pageSizeOptions]="pageSizeOptions()"
          [showPageSizeSelector]="showPageSizeSelector()"
          [rowsPerPageLabel]="rowsPerPageLabel()"
          [pageLabel]="pageLabel()"
          [ofLabel]="ofLabel()"
          (paginationChange)="onPaginationChange($event)"
        />
      }
    </div>
    @if (rowActions()) {
      <ui-context-menu
        #rowActionsContextMenu
        [items]="activeContextMenuItems()"
      >
      </ui-context-menu>
    }
    @if (enableColumnMenu()) {
      <ui-context-menu #columnMenuContextMenu [items]="activeColumnMenuItems()">
      </ui-context-menu>
    }
  `,
})
export class DataTableComponent<T> implements AfterViewInit, OnDestroy {
  protected readonly EMPTY_RECORD = EMPTY_RECORD;
  private readonly _document = inject(DOCUMENT);
  private readonly _el = inject(ElementRef);
  isRtl() {
    return isRtl(this._el.nativeElement);
  }
  private _isRtlResize = false;

  readonly data = input.required<T[]>();
  /** @see columnHelper for a type-safe fluent builder API */
  readonly columns = input.required<ColumnDef<T>[]>();

  readonly showToolbar = input(true);
  readonly showColumnVisibilityToggle = input(true);
  readonly showPagination = input(true);
  readonly showRowBorders = input(true);
  readonly showColumnBorders = input(true);

  readonly localSorting = input(true);
  readonly localPagination = input(true);
  readonly localFiltering = input(true);
  readonly loading = input(false);
  readonly loadingVisibility = input<DataTableLoadingVisibility>({
    initial: true,
    pagination: true,
    sorting: true,
    filtering: true,
  });
  readonly loaderTemplate = input<TemplateRef<unknown>>();
  readonly loaderComponent = input<Type<unknown>>();
  readonly loaderComponentInputs = input<Record<string, unknown>>({});
  readonly globalFilterFn = input<
    | ((row: T, filterValue: string, columns: ColumnDef<T>[]) => boolean)
    | undefined
  >(undefined);
  readonly enableMultiSort = input(false);
  readonly maxMultiSortColumns = input(3);
  readonly total = input(0);

  readonly sortChange = output<SortState>();
  readonly multiSortChange = output<SortState[]>();
  readonly pageChange = output<PaginationState>();
  readonly filterChange = output<string>();

  readonly cellEdit = output<CellEditEvent<T>>();
  readonly editingCell = signal<EditingCell | null>(null);
  readonly editValue = signal<unknown>(null);

  readonly enableRowSelection = input(false);
  readonly rowSelection = model<Record<string, boolean>>({});
  readonly getRowId = input<(row: T) => string>(DEFAULT_GET_ROW_ID);
  readonly enableCopy = input(true);
  readonly isRowDisabled = input<((row: T) => boolean) | undefined>(undefined);
  readonly disabledRowIds = input<ReadonlySet<string> | readonly string[]>([]);
  readonly enableRowExpansion = input(false);
  readonly expandedRows = model<Record<string, boolean>>({});
  readonly rowDetailTemplate = input<TemplateRef<unknown>>();
  readonly rowDetailComponent = input<Type<unknown>>();
  readonly rowDetailComponentInputs = input<
    ((row: T) => Record<string, unknown>) | undefined
  >(undefined);

  readonly enableSubRows = input(false);
  readonly getChildren = input<(row: T) => T[] | undefined>((row: T) => (row as Record<string, unknown>)['children'] as T[] | undefined);
  readonly setChildren = input<(row: T, children: T[]) => T>(
    (row: T, children: T[]) => ({ ...row, children }),
  );
  readonly subRowDefaultExpanded = input(0);
  readonly subRowSelectionMode = input<SubRowSelectionMode>("self");
  readonly subRowFilterMode = input<SubRowFilterMode>("includeParentOnChildMatch");
  readonly enableSubRowSorting = input(true);
  readonly subRowIndentSize = input(20);
  readonly subRowsPaginated = input(false);
  readonly subRowExpandedRows = model<Record<string, boolean>>({});

  readonly enableColumnResize = input(false);
  readonly enableColumnReorder = input(false);
  readonly enableColumnMenu = input(false);
  readonly showFooter = input<boolean | "auto">("auto");
  readonly enableFloatingFilters = input(false);
  readonly enableRowDrag = input(false);
  readonly localReorder = input(true);
  readonly rowDragMode = input<'flat' | 'tree'>('flat');
  readonly rowDragAllowDrop = input<((dragRow: T, targetRow: T, position: RowDragPosition) => boolean) | undefined>(undefined);
  readonly rowReorder = output<RowReorderEvent<T>>();
  readonly enableCellFlash = input(false);
  readonly cellFlashDuration = input(500);
  readonly enableCellRangeSelection = input(false);
  readonly cellRange = signal<CellRange | null>(null);
  readonly columnResize = output<ColumnResizeEvent>();

  readonly exportDataProvider = input<(() => Promise<T[]>) | undefined>(undefined);

  readonly emptyStateComponent = input<Type<unknown>>();
  readonly emptyStateComponentInputs = input<Record<string, unknown>>({});
  readonly fullWidthRow = input<((row: T) => boolean) | undefined>(undefined);
  readonly fullWidthRowTemplate = input<TemplateRef<unknown>>();
  readonly fullWidthRowComponent = input<Type<unknown>>();

  readonly locale = input("en");
  readonly filterDebounce = input(0);

  /**
   * Controls how large datasets are handled.
   *
   * - `true`: Always use virtual scrolling (recommended for 500+ rows without pagination)
   * - `false`: Never use virtual scrolling, use pagination instead (default)
   * - `"auto"`: Automatically enable if rows > 500 or columns > 20
   *
   * Note: Virtual scroll and pagination are mutually exclusive.
   * When both are enabled, pagination takes precedence unless enableVirtualScroll is explicitly `true`.
   *
   * @default false
   */
  readonly enableVirtualScroll = input<boolean | "auto">(false);
  readonly virtualRowHeight = input(40);
  readonly virtualRowBuffer = input(5);
  readonly virtualColumnBuffer = input(3);
  readonly virtualVariableRowHeight = input(false);
  readonly virtualRecycleComponents = input(false);
  readonly virtualAutoThreshold = input<VirtualAutoThreshold>({
    rows: 500,
    columns: 20,
  });

  /**
   * Estimated width in pixels for 'auto' columns when using virtual scroll.
   * Virtual scroll requires pixel widths for calculations.
   * @default 150
   */
  readonly virtualAutoColumnWidth = input(150);

  private readonly componentPool = inject(ComponentPoolService);

  get recycleStats(): { recycled: number; created: number; poolSize: number } {
    return {
      recycled: this.componentPool.recycleCount,
      created: this.componentPool.createCount,
      poolSize: this.componentPool.poolSize,
    };
  }

  private readonly virtualScrollTop = signal(0);
  private readonly virtualScrollLeft = signal(0);
  private readonly viewportHeight = signal(0);
  private readonly viewportWidth = signal(0);
  private readonly rowHeightCache = new Map<number, number>();
  private readonly measurementVersion = signal(0);
  private suppressScrollEvents = false;
  private observedElements = new Set<Element>();
  private rafId = 0;
  private filterDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private viewportObserver?: ResizeObserver;
  private readonly rowResizeObserver?: ResizeObserver;

  readonly scrollContainerRef =
    viewChild<ElementRef<HTMLElement>>("scrollContainer");
  readonly virtualRowElements = viewChildren("virtualRow", {
    read: ElementRef,
  });

  readonly isVirtualScrollActive = computed(() => {
    const mode = this.enableVirtualScroll();

    if (mode === false) return false;

    if (this.localPagination() && this.showPagination()) {
      if (mode === "auto") return false;
    }

    if (mode === true) return true;

    const threshold = this.virtualAutoThreshold();
    const totalRows = this.virtualTotalRows();
    const nonPinnedColCount = this.scrollableColumns().length;
    return totalRows > threshold.rows || nonPinnedColCount > threshold.columns;
  });

  readonly virtualTotalRows = computed(() => {
    if (this.enableSubRows()) {
      return this.visibleTreeRows().length;
    }
    return this.sortedData().length;
  });

  readonly pinnedLeftColumns = computed(() => {
    return this.enhancedColumns().filter(
      (c) => c.sticky === true || c.pin === "left",
    );
  });

  readonly pinnedRightColumns = computed(() => {
    return this.enhancedColumns().filter((c) => c.pin === "right");
  });

  readonly scrollableColumns = computed(() => {
    return this.enhancedColumns().filter(
      (c) => !c.sticky && c.pin !== "left" && c.pin !== "right",
    );
  });

  private readonly scrollableColumnWidths = computed(() => {
    const cols = this.scrollableColumns();
    const widths = this.columnWidths();
    const autoWidth = this.virtualAutoColumnWidth();
    return cols.map((col) => {
      const key = String(col.accessorKey);
      const w = widths[key] || col._width || col.width || "auto";
      if (w === "auto") return autoWidth;
      return Number.parseInt(String(w), 10) || autoWidth;
    });
  });

  private readonly _prefixSums = computed(() => {
    if (!this.virtualVariableRowHeight()) return undefined;
    this.measurementVersion();
    const totalRows = this.virtualTotalRows();
    const defaultHeight = this.virtualRowHeight();
    return buildPrefixSums(
      (index: number) => this.rowHeightCache.get(index) ?? defaultHeight,
      totalRows,
    );
  });

  readonly virtualRowRange = computed(() => {
    if (!this.isVirtualScrollActive()) {
      const total = this.virtualTotalRows();
      return { start: 0, end: total, paddingTop: 0, paddingBottom: 0 };
    }
    const totalRows = this.virtualTotalRows();
    const buffer = this.virtualRowBuffer();

    if (this.virtualVariableRowHeight()) {
      const defaultHeight = this.virtualRowHeight();
      const getHeight = (index: number): number =>
        this.rowHeightCache.get(index) ?? defaultHeight;
      return computeVariableRowRange(
        this.virtualScrollTop(),
        this.viewportHeight(),
        getHeight,
        totalRows,
        buffer,
        this._prefixSums(),
      );
    }

    const rowHeight = this.virtualRowHeight();
    const range = computeRowRange(
      this.virtualScrollTop(),
      this.viewportHeight(),
      rowHeight,
      totalRows,
      buffer,
    );
    return {
      ...range,
      paddingTop: range.start * rowHeight,
      paddingBottom: (totalRows - range.end) * rowHeight,
    };
  });

  readonly virtualColumnRange = computed(() => {
    if (!this.isVirtualScrollActive()) {
      return {
        start: 0,
        end: this.scrollableColumns().length,
        paddingLeft: 0,
        paddingRight: 0,
      };
    }
    return computeColumnRange(
      this.virtualScrollLeft(),
      this.viewportWidth(),
      this.scrollableColumnWidths(),
      this.virtualColumnBuffer(),
    );
  });

  readonly virtualVisibleRows = computed((): T[] => {
    const { start, end } = this.virtualRowRange();
    return this.sortedData().slice(start, end);
  });

  readonly virtualVisibleTreeRows = computed((): FlattenedTreeRow<T>[] => {
    const { start, end } = this.virtualRowRange();
    return this.visibleTreeRows().slice(start, end);
  });

  readonly virtualVisibleMiddleColumns = computed(() => {
    const { start, end } = this.virtualColumnRange();
    return this.scrollableColumns().slice(start, end);
  });

  readonly virtualPaddingTop = computed(
    () => this.virtualRowRange().paddingTop,
  );

  readonly virtualPaddingBottom = computed(
    () => this.virtualRowRange().paddingBottom,
  );

  readonly virtualPaddingLeft = computed(
    () => this.virtualColumnRange().paddingLeft,
  );
  readonly virtualPaddingRight = computed(
    () => this.virtualColumnRange().paddingRight,
  );

  private readonly activeLocale = computed(
    (): CalendarLocale =>
      CALENDAR_LOCALES[this.locale()] ?? CALENDAR_LOCALES["en"],
  );
  readonly filterPlaceholder = computed(
    () => this.activeLocale().filterPlaceholder ?? "Filter...",
  );
  readonly columnsLabel = computed(
    () => this.activeLocale().columnsLabel ?? "Columns",
  );
  readonly noResultsLabel = computed(
    () => this.activeLocale().noResultsLabel ?? "No results found.",
  );
  readonly rowsPerPageLabel = computed(
    () => this.activeLocale().rowsPerPageLabel ?? "Rows per page",
  );
  readonly pageLabel = computed(() => this.activeLocale().pageLabel ?? "Page");
  readonly ofLabel = computed(() => this.activeLocale().ofLabel ?? "of");

  readonly rowActions = input<
    ((context: RowActionContext<T>) => ContextMenuItem[]) | undefined
  >(undefined);
  readonly showRowActionsColumn = input<boolean | undefined>(undefined);
  readonly showRowActionsContextMenu = input<boolean | undefined>(undefined);

  readonly resolvedShowActionsColumn = computed(() => {
    const explicit = this.showRowActionsColumn();
    if (explicit !== undefined) return explicit;
    return !!this.rowActions();
  });

  readonly resolvedShowContextMenu = computed(() => {
    const explicit = this.showRowActionsContextMenu();
    if (explicit !== undefined) return explicit;
    return !!this.rowActions();
  });

  private readonly internalContextMenu = viewChild<ContextMenuComponent>(
    "rowActionsContextMenu",
  );
  readonly activeContextMenuItems = signal<ContextMenuItem[]>([]);

  private readonly columnMenuContextMenu = viewChild<ContextMenuComponent>(
    "columnMenuContextMenu",
  );
  readonly activeColumnMenuItems = signal<ContextMenuItem[]>([]);

  readonly columnPinOverrides = signal<
    Record<string, "left" | "right" | undefined>
  >({});
  readonly exporting = signal(false);
  readonly globalFilter = model("");
  readonly columnFilters = model<Record<string, unknown>>({});
  readonly sortState = model<SortState>({ column: "", direction: null });
  readonly multiSortState = model<SortState[]>([]);
  readonly paginationState = model<PaginationState>({ pageIndex: 0, pageSize: 10 });
  readonly pageSizeOptions = input<number[]>([10, 20, 30, 40, 50]);
  readonly showPageSizeSelector = input(true);
  readonly columnWidths = model<Record<string, string>>({});
  readonly columnVisibility = model<Record<string, boolean>>({});
  readonly columnOrder = model<string[]>([]);
  readonly loadingTrigger = signal<DataTableLoadingTrigger>("initial");
  readonly focusedCell = signal<{ rowIndex: number; columnKey: string } | null>(null);
  readonly draggedColumnKey = signal<string | null>(null);
  readonly dropTargetColumnKey = signal<string | null>(null);
  readonly isLoaderVisible = computed(
    () => this.loading() && this.shouldShowLoaderFor(this.loadingTrigger()),
  );
  readonly resolvedLoaderComponentInputs = computed(() => ({
    ...this.loaderComponentInputs(),
    trigger: this.loadingTrigger(),
  }));

  readonly filteredData = computed(() => {
    let data = this.data();
    if (!this.localFiltering()) return data;

    const globalFilterValue = this.globalFilter().toLowerCase();
    if (globalFilterValue) {
      data = this.applyGlobalFilterToData(data, globalFilterValue);
    }

    return this.applyColumnFiltersToData(data);
  });

  private applyGlobalFilterToData(data: T[], globalFilterValue: string): T[] {
    const columns = this.enhancedColumns().filter(
      (col) =>
        col.accessorKey !== "_selection" &&
        col.accessorKey !== "_expander" &&
        col.accessorKey !== "_actions",
    );
    const globalFilterFn = this.globalFilterFn();
    if (globalFilterFn) {
      return data.filter((row) =>
        globalFilterFn(row, globalFilterValue, columns),
      );
    }
    const globallyFilterableColumns = columns.filter(
      (col) => col.enableGlobalFilter !== false,
    );
    return data.filter((row) =>
      globallyFilterableColumns.some((col) => {
        const value = this.getCellValue(row, col.accessorKey, col);
        return String(value).toLowerCase().includes(globalFilterValue);
      }),
    );
  }

  private applyColumnFiltersToData(data: T[]): T[] {
    const colFilters = this.columnFilters();
    const columns = this.enhancedColumns();

    for (const columnKey of Object.keys(colFilters)) {
      const filterValue = colFilters[columnKey];
      if (this.isFilterValueEmpty(filterValue)) continue;

      const column = columns.find((col) => col.accessorKey === columnKey);
      if (!column?.enableFiltering) continue;

      if (column.filterFn) {
        data = data.filter((row) => column.filterFn!(row, filterValue));
      } else {
        data = data.filter((row) => {
          const cellValue = this.getCellValue(row, columnKey, column);
          return String(cellValue)
            .toLowerCase()
            .includes(String(filterValue).toLowerCase());
        });
      }
    }

    return data;
  }

  private readonly treeIndex = computed(() => {
    if (!this.enableSubRows()) {
      return {
        children: new Map<string, string[]>(),
        descendants: new Map<string, string[]>(),
        parent: new Map<string, string>(),
      };
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

    return {
      children: childrenMap,
      descendants: descendantsMap,
      parent: parentMap,
    };
  });

  readonly filteredTreeData = computed<T[]>(() => {
    if (!this.enableSubRows() || !this.localFiltering()) return this.data();

    const globalFilterValue = this.globalFilter().toLowerCase();
    const colFilters = this.columnFilters();
    const columns = this.enhancedColumns().filter(
      (col) =>
        col.accessorKey !== "_selection" &&
        col.accessorKey !== "_expander" &&
        col.accessorKey !== "_actions",
    );
    const hasGlobalFilter = !!globalFilterValue;
    const hasColumnFilters = Object.keys(colFilters).some(
      (k) => !this.isFilterValueEmpty(colFilters[k]),
    );

    if (!hasGlobalFilter && !hasColumnFilters) return this.data();

    const getChildrenFn = this.getChildren();
    const setChildrenFn = this.setChildren();
    const mode = this.subRowFilterMode();

    const matchesGlobal = (row: T): boolean => {
      const globalFilterFn = this.globalFilterFn();
      if (globalFilterFn) {
        return globalFilterFn(row, globalFilterValue, columns);
      }
      const globallyFilterable = columns.filter(
        (col) => col.enableGlobalFilter !== false,
      );
      return globallyFilterable.some((col) => {
        const value = this.getCellValue(row, col.accessorKey, col);
        return String(value).toLowerCase().includes(globalFilterValue);
      });
    };

    const matchesColumns = (row: T): boolean => {
      for (const columnKey of Object.keys(colFilters)) {
        const filterValue = colFilters[columnKey];
        if (this.isFilterValueEmpty(filterValue)) continue;
        const column = columns.find((col) => col.accessorKey === columnKey);
        if (!column?.enableFiltering) continue;
        if (column.filterFn) {
          if (!column.filterFn(row, filterValue)) return false;
        } else {
          const cellValue = this.getCellValue(row, columnKey, column);
          if (
            !String(cellValue)
              .toLowerCase()
              .includes(String(filterValue).toLowerCase())
          )
            return false;
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
      if (mode === "excludeChildren") return rows.filter(matchesRow);
      if (mode === "includeChildren") return filterIncludeChildren(rows);
      return filterIncludeParents(rows);
    };

    return filterTree(this.data());
  });

  readonly sortedTreeData = computed<T[]>(() => {
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
      return sorted.map((row) => {
        const children = getChildrenFn(row);
        if (children && children.length > 0) {
          return setChildrenFn(row, sortRows(children));
        }
        return row;
      });
    };

    return sortRows(data);
  });

  readonly visibleTreeRows = computed<FlattenedTreeRow<T>[]>(() => {
    if (!this.enableSubRows()) return [];
    return this.flattenTreeFull(this.sortedTreeData());
  });

  readonly sortedData = computed(() => {
    if (this.enableSubRows()) return [];
    const data = [...this.filteredData()];
    if (!this.localSorting()) return data;

    const sorts = this.activeSorts();
    if (sorts.length === 0) return data;

    return data.sort(this.buildSortComparator(sorts));
  });

  readonly processedData = computed(() => {
    if (this.enableSubRows()) {
      const visible = this.visibleTreeRows();
      if (!this.localPagination()) return visible.map((tr) => tr.row);

      if (this.subRowsPaginated()) {
        const { pageIndex, pageSize } = this.paginationState();
        const start = pageIndex * pageSize;
        return visible.slice(start, start + pageSize).map((tr) => tr.row);
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

  readonly processedTreeRows = computed<FlattenedTreeRow<T>[]>(() => {
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

  readonly activeTotalItems = computed(() => {
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
      return this.visibleTreeRows().map((tr) => this.getRowId()(tr.row));
    }
    return this.filteredData().map((row) => this.getRowId()(row));
  });

  readonly selectedRows = computed(() => {
    const selection = this.rowSelection();
    const getId = this.getRowId();
    return this.data().filter((row) => !!selection[getId(row)]);
  });

  private readonly previousCellValues = new Map<string, Map<string, unknown>>();
  readonly flashingCells = signal<Map<string, "up" | "down" | "changed">>(
    new Map(),
  );
  private readonly flashTimers: ReturnType<typeof setTimeout>[] = [];

  getCellFlashClass(rowId: string, columnKey: string): string {
    const flash = this.flashingCells().get(`${rowId}:${columnKey}`);
    if (!flash) return "";
    if (flash === "up")
      return "animate-[flash-up_0.5s_ease-out] bg-green-500/20";
    if (flash === "down")
      return "animate-[flash-down_0.5s_ease-out] bg-red-500/20";
    return "animate-[flash-changed_0.5s_ease-out] bg-yellow-500/20";
  }

  private diffCellValues(
    data: T[], columns: ColumnDef<T>[], getId: (row: T) => string
  ): Map<string, CellFlashDirection> {
    const prev = this.previousCellValues;
    const flashes = new Map<string, CellFlashDirection>();

    for (const row of data) {
      const rowId = getId(row);
      const prevRow = prev.get(rowId);
      if (!prevRow) continue;
      this.diffRowCells(row, rowId, columns, prevRow, flashes);
    }
    return flashes;
  }

  private diffRowCells(
    row: T, rowId: string, columns: ColumnDef<T>[],
    prevRow: Map<string, unknown>, flashes: Map<string, CellFlashDirection>
  ): void {
    for (const col of columns) {
      if (col.enableCellFlash === false) continue;
      const key = String(col.accessorKey);
      if (key.startsWith('_')) continue;

      const oldVal = prevRow.get(key);
      const newVal = this.resolveColumnValue(row, col, key);
      if (oldVal === newVal) continue;

      const cellKey = `${rowId}:${key}`;
      flashes.set(cellKey, this.classifyChange(oldVal, newVal));
    }
  }

  private classifyChange(oldVal: unknown, newVal: unknown): CellFlashDirection {
    const oldNum = Number(oldVal);
    const newNum = Number(newVal);
    if (Number.isFinite(oldNum) && Number.isFinite(newNum)) {
      return newNum > oldNum ? 'up' : 'down';
    }
    return 'changed';
  }

  private resolveColumnValue(row: T, col: ColumnDef<T>, key: string): unknown {
    return col.accessorFn ? col.accessorFn(row) : (row as Record<string, unknown>)[key];
  }

  private snapshotCellValues(data: T[], columns: ColumnDef<T>[], getId: (row: T) => string): void {
    this.previousCellValues.clear();
    for (const row of data) {
      const rowId = getId(row);
      const rowMap = new Map<string, unknown>();
      for (const col of columns) {
        const key = String(col.accessorKey);
        if (key.startsWith('_')) continue;
        rowMap.set(key, this.resolveColumnValue(row, col, key));
      }
      this.previousCellValues.set(rowId, rowMap);
    }
  }

  constructor() {
    effect(() => {
      if (!this.enableCellFlash()) return;
      const data = this.data();
      const getId = this.getRowId();
      const columns = this.columns();
      const duration = this.cellFlashDuration();

      const flashes = this.diffCellValues(data, columns, getId);
      this.snapshotCellValues(data, columns, getId);

      if (flashes.size > 0) {
        this.flashingCells.set(flashes);
        const timer = setTimeout(() => {
          this.flashingCells.set(new Map());
        }, duration);
        this.flashTimers.push(timer);
      }
    });

    effect(() => {
      if (!this.localPagination()) {
        return;
      }

      const { pageIndex, pageSize } = this.paginationState();
      const sanitizedPageSize = pageSize > 0 ? pageSize : 10;
      const totalItems = this.filteredData().length;
      const maxPageIndex = Math.max(
        0,
        Math.ceil(totalItems / sanitizedPageSize) - 1,
      );
      const clampedPageIndex = Math.min(maxPageIndex, Math.max(0, pageIndex));

      if (sanitizedPageSize !== pageSize || clampedPageIndex !== pageIndex) {
        this.paginationState.set({
          pageIndex: clampedPageIndex,
          pageSize: sanitizedPageSize,
        });
      }
    });

    this.rowResizeObserver = new ResizeObserver((entries) => {
      this.handleRowResizes(entries);
    });

    effect(() => {
      if (!this.isVirtualScrollActive() || !this.virtualVariableRowHeight())
        return;
      const els = this.virtualRowElements();
      const newSet = new Set(els.map((el) => el.nativeElement as Element));

      for (const el of this.observedElements) {
        if (!newSet.has(el)) {
          this.rowResizeObserver!.unobserve(el);
        }
      }
      for (const el of newSet) {
        if (!this.observedElements.has(el)) {
          this.rowResizeObserver!.observe(el);
        }
      }
      this.observedElements = newSet;
    });
  }

  ngAfterViewInit() {
    this.setupViewportObserver();
    this.validateConfiguration();
  }

  /**
   * Validates configuration and logs warnings for conflicting options in development mode.
   */
  private validateConfiguration(): void {
    if (typeof ngDevMode === 'undefined' || !ngDevMode) return;

    const warnings: string[] = [];

    if (
      this.localPagination() &&
      this.showPagination() &&
      this.enableVirtualScroll() === true
    ) {
      warnings.push(
        '[ui-data-table] Both pagination and enableVirtualScroll are enabled. ' +
          'These features are mutually exclusive. Virtual scroll will be used, ' +
          'and pagination controls will have no effect on virtual scrolling.'
      );
    }

    if (!this.localPagination() && this.total() === 0 && this.data().length > 0) {
      warnings.push(
        '[ui-data-table] Using server-side pagination (localPagination=false) ' +
          'without providing [total]. Pagination may not work correctly.'
      );
    }

    if (this.virtualVariableRowHeight() && !this.isVirtualScrollActive()) {
      warnings.push(
        '[ui-data-table] virtualVariableRowHeight is enabled but virtual scroll ' +
          'is not active. This option has no effect.'
      );
    }

    if (this.virtualRecycleComponents() && !this.isVirtualScrollActive()) {
      warnings.push(
        '[ui-data-table] virtualRecycleComponents is enabled but virtual scroll ' +
          'is not active. This option has no effect.'
      );
    }

    if (
      this.enableVirtualScroll() === 'auto' &&
      this.localPagination() &&
      this.showPagination()
    ) {
      warnings.push(
        '[ui-data-table] enableVirtualScroll="auto" has no effect when pagination is active. ' +
          'Set [showPagination]="false" or [localPagination]="false" for virtual scroll to auto-activate.'
      );
    }

    if (this.enableSubRows() && this.enableRowExpansion()) {
      warnings.push(
        '[ui-data-table] Both enableSubRows and enableRowExpansion are enabled. ' +
          'This creates two separate expander controls per row (tree toggle + detail panel). ' +
          'If this is unintentional, disable one of them.'
      );
    }

    const isDefaultGetRowId = this.getRowId() === DEFAULT_GET_ROW_ID;

    if (this.enableSubRows() && isDefaultGetRowId) {
      warnings.push(
        '[ui-data-table] enableSubRows is active with the default getRowId. ' +
          'The default uses JSON.stringify as fallback, which produces unstable IDs for tree data. ' +
          'Provide a custom [getRowId] function that returns a stable unique identifier.'
      );
    }

    if (this.enableCellFlash() && isDefaultGetRowId) {
      warnings.push(
        '[ui-data-table] enableCellFlash is active with the default getRowId. ' +
          'Cell flash detection requires stable row IDs across data updates. ' +
          'Provide a custom [getRowId] function.'
      );
    }

    const cols = this.columns();

    if (this.enableFloatingFilters() && !cols.some((c) => c.enableFiltering)) {
      warnings.push(
        '[ui-data-table] enableFloatingFilters is true but no columns have enableFiltering set. ' +
          'The floating filter row will be empty.'
      );
    }

    const editableCols = cols.filter((c) => c.editable && !c.valueSetter);
    if (editableCols.length > 0) {
      const keys = editableCols.map((c) => String(c.accessorKey)).join(', ');
      warnings.push(
        `[ui-data-table] Columns [${keys}] have editable=true but no valueSetter. ` +
          'Edits will directly mutate the row object. Provide a valueSetter for immutable updates.'
      );
    }

    const accessorKeys = cols.map((c) => String(c.accessorKey)).filter((k) => k !== 'undefined');
    const duplicates = accessorKeys.filter((k, i) => accessorKeys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      const unique = [...new Set(duplicates)];
      warnings.push(
        `[ui-data-table] Duplicate accessorKey values found: [${unique.join(', ')}]. ` +
          'Each column must have a unique accessorKey. Duplicates cause broken sorting, visibility, and width tracking.'
      );
    }

    const stickyAndPinned = cols.filter((c) => c.sticky && c.pin);
    if (stickyAndPinned.length > 0) {
      const keys = stickyAndPinned.map((c) => String(c.accessorKey)).join(', ');
      warnings.push(
        `[ui-data-table] Columns [${keys}] have both sticky and pin set. ` +
          'Use pin="left" instead of sticky=true. sticky is deprecated in favor of pin.'
      );
    }

    const multiRenderCols = cols.filter((c) => {
      const count = [c.cell, c.template, c.component].filter(Boolean).length;
      return count > 1;
    });
    if (multiRenderCols.length > 0) {
      const keys = multiRenderCols.map((c) => String(c.accessorKey)).join(', ');
      warnings.push(
        `[ui-data-table] Columns [${keys}] have multiple rendering strategies (cell/template/component). ` +
          'Only one will be used (priority: component > template > cell). Remove the unused ones.'
      );
    }

    for (const warning of warnings) {
      console.warn(warning);
    }
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.filterDebounceTimer);
    this.flashTimers.forEach((t) => clearTimeout(t));
    this._document.removeEventListener('wheel', this.dragWheelHandler, { capture: true } as EventListenerOptions);
    this._document.removeEventListener('drag', this.dragEventHandler);
    this.viewportObserver?.disconnect();
    this.rowResizeObserver?.disconnect();
  }

  private setupViewportObserver() {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;

    this.viewportHeight.set(container.clientHeight);
    this.viewportWidth.set(container.clientWidth);

    this.viewportObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        this.viewportHeight.set(el.clientHeight);
        this.viewportWidth.set(el.clientWidth);
      }
    });
    this.viewportObserver.observe(container);
  }

  onVirtualScroll(event: Event) {
    if (this.suppressScrollEvents) return;
    const el = event.target as HTMLElement;
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.virtualScrollTop.set(el.scrollTop);
      this.virtualScrollLeft.set(el.scrollLeft);
    });
  }

  private handleRowResizes(entries: ResizeObserverEntry[]) {
    let scrollAdjustment = 0;
    const firstVisible = this.virtualRowRange().start;

    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      const indexStr = el.dataset["virtualRowIndex"];
      if (indexStr === undefined) continue;

      const index = Number.parseInt(indexStr, 10);
      const newHeight = entry.borderBoxSize[0].blockSize;
      const oldHeight =
        this.rowHeightCache.get(index) ?? this.virtualRowHeight();
      const diff = newHeight - oldHeight;

      if (Math.abs(diff) < 0.5) continue;

      this.rowHeightCache.set(index, newHeight);

      if (index < firstVisible) {
        scrollAdjustment += diff;
      }
    }

    if (scrollAdjustment !== 0) {
      const container = this.scrollContainerRef()?.nativeElement;
      if (container) {
        this.suppressScrollEvents = true;
        container.scrollTop += scrollAdjustment;
        this.virtualScrollTop.set(container.scrollTop);
        requestAnimationFrame(() => {
          this.suppressScrollEvents = false;
        });
      }
    }

    this.measurementVersion.update((v) => v + 1);
  }

  getVirtualRowIndex(localIndex: number): number {
    return this.virtualRowRange().start + localIndex;
  }

  readonly activeSorts = computed(() => {
    if (this.enableMultiSort()) {
      return this.multiSortState().filter(
        (sort) => !!sort.column && !!sort.direction,
      );
    }

    const sort = this.sortState();
    if (!sort.column || !sort.direction) {
      return [];
    }
    return [sort];
  });

  private readonly _sortLookup = computed(() => {
    const map = new Map<
      string,
      { readonly direction: SortDirection; readonly index: number }
    >();
    const sorts = this.activeSorts();
    for (let i = 0; i < sorts.length; i++) {
      map.set(String(sorts[i].column), {
        direction: sorts[i].direction,
        index: i,
      });
    }
    return map;
  });

  getSortDirection(columnKey: string | keyof T): SortDirection {
    return this._sortLookup().get(String(columnKey))?.direction ?? null;
  }

  getSortIndex(columnKey: string | keyof T): number | null {
    if (!this.enableMultiSort()) {
      return null;
    }
    return this._sortLookup().get(String(columnKey))?.index ?? null;
  }

  onSortChange(
    columnKey: string | keyof T,
    direction: SortDirection,
    multi = false,
  ) {
    this.loadingTrigger.set("sorting");
    const key = String(columnKey);
    const currentPagination = this.paginationState();
    const shouldResetPage = currentPagination.pageIndex !== 0;

    if (this.enableMultiSort() && multi) {
      const existing = this.multiSortState().filter(
        (sort) => sort.column !== key,
      );
      const next = direction
        ? [...existing, { column: key, direction }]
        : existing;
      const maxColumns = Math.max(1, this.maxMultiSortColumns());
      const trimmed = next.slice(-maxColumns);
      const primary = trimmed[0] ?? {
        column: "",
        direction: null as SortDirection,
      };

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

  private addSpecialColumns(visibleCols: ColumnDef<T>[]): ColumnDef<T>[] {
    let result = [...visibleCols];

    if (this.enableRowSelection()) {
      result = [{ accessorKey: '_selection', header: '', sticky: true, width: '40px' }, ...result];
    }

    if (this.enableRowExpansion()) {
      result = [{ accessorKey: '_expander', header: '', sticky: true, width: '40px', enableSorting: false }, ...result];
    }

    if (this.resolvedShowActionsColumn()) {
      result = [...result, { accessorKey: '_actions', header: '', width: '50px', enableSorting: false, enableHiding: false, enableReordering: false }];
    }

    return result;
  }

  private assignTreeExpanderHost(cols: ColumnDef<T>[], allCols: ColumnDef<T>[]): void {
    if (!this.enableSubRows()) return;

    const hasUserTreeExpander = allCols.some(c => c.treeExpander);
    const targetIdx = hasUserTreeExpander
      ? cols.findIndex(c => c.treeExpander)
      : cols.findIndex(c => c.accessorKey !== '_selection' && c.accessorKey !== '_expander' && c.accessorKey !== '_actions');

    if (targetIdx !== -1) {
      cols[targetIdx] = { ...cols[targetIdx], _isTreeExpanderHost: true };
    }
  }

  readonly enhancedColumns = computed(() => {
    const cols = this.columns();
    const widths = this.columnWidths();
    const visibleCols = this.applyColumnOrder(
      cols.filter((col) => this.isColumnVisible(col.accessorKey)),
    );
    const computedCols = this.addSpecialColumns(visibleCols);
    this.assignTreeExpanderHost(computedCols, cols);

    let currentLeft = 0;
    let currentRight = 0;
    const rightOffsets = new Map<number, number>();

    const DEFAULT_PINNED_WIDTH = 150;

    for (let i = computedCols.length - 1; i >= 0; i -= 1) {
      const col = computedCols[i];
      const key = String(col.accessorKey);
      const widthStr = widths[key] ?? col.width;
      const widthVal = Number.parseInt(widthStr, 10) || DEFAULT_PINNED_WIDTH;
      if (col.pin === "right") {
        rightOffsets.set(i, currentRight);
        currentRight += widthVal;
      }
    }

    const pinOverrides = this.columnPinOverrides();
    return computedCols.map((col, index) => {
      const key = String(col.accessorKey);
      const resolvedPin = key in pinOverrides ? pinOverrides[key] : col.pin;
      const isSticky = col.sticky === true;
      const isPinnedLeft = resolvedPin === "left";
      const isPinnedRight = resolvedPin === "right";
      const isPinned = isPinnedLeft || isPinnedRight || isSticky;
      const widthStr = widths[key] || col.width || (isPinned ? `${DEFAULT_PINNED_WIDTH}px` : "auto");
      const widthVal = Number.parseInt(widthStr, 10) || DEFAULT_PINNED_WIDTH;
      const isStickyLeft = isSticky || isPinnedLeft;
      let pin: string | undefined;
      if (isPinnedRight) pin = "right";
      else if (isStickyLeft) pin = "left";

      const columnData = {
        ...col,
        _stickyLeft: isStickyLeft ? currentLeft : undefined,
        _stickyRight: isPinnedRight
          ? (rightOffsets.get(index) ?? 0)
          : undefined,
        _pin: pin,
        _width: widthStr,
        _minWidth: col.minWidth || "50px",
      };

      if (isStickyLeft) {
        currentLeft += widthVal;
      }

      return columnData;
    });
  });

  readonly treeExpanderColumn = computed(() => {
    if (!this.enableSubRows()) return null;
    return this.enhancedColumns().find((c) => c._isTreeExpanderHost) ?? null;
  });

  readonly hasColumnFilters = computed(() => {
    return this.enhancedColumns().some((col) => col.enableFiltering);
  });

  readonly hasFlexibleColumns = computed(() => {
    return this.enhancedColumns().some((col) => col._width === "auto");
  });

  readonly hideableColumns = computed(() =>
    this.columns().filter(
      (col) => col.accessorKey !== "_selection" && col.enableHiding !== false,
    ),
  );

  readonly hasAnyFloatingFilter = computed(() => {
    return this.enhancedColumns().some(
      (col) =>
        col.floatingFilter === true ||
        col.floatingFilterComponent ||
        col.floatingFilterTemplate ||
        (col.enableFiltering && col.floatingFilter !== false),
    );
  });

  getFloatingFilterChange(col: ColumnDef<T>): (value: unknown) => void {
    return (value: unknown) =>
      this.onColumnFilterChange(col.accessorKey, value);
  }

  isFullWidthRow(row: T): boolean {
    const fn = this.fullWidthRow();
    return fn ? fn(row) : false;
  }

  readonly normalizedCellRange = computed(() => {
    const range = this.cellRange();
    if (!range) return null;
    const colKeys = this.navigableColumnKeys();
    const startColIdx = colKeys.indexOf(range.startCol);
    const endColIdx = colKeys.indexOf(range.endCol);
    return {
      minRow: Math.min(range.startRow, range.endRow),
      maxRow: Math.max(range.startRow, range.endRow),
      minCol: Math.min(startColIdx, endColIdx),
      maxCol: Math.max(startColIdx, endColIdx),
    };
  });

  isCellInRange(rowIndex: number, columnKey: string): boolean {
    const range = this.normalizedCellRange();
    if (!range) return false;
    const colKeys = this.navigableColumnKeys();
    const colIdx = colKeys.indexOf(columnKey);
    return (
      rowIndex >= range.minRow &&
      rowIndex <= range.maxRow &&
      colIdx >= range.minCol &&
      colIdx <= range.maxCol
    );
  }

  readonly hasFooter = computed(() => {
    const mode = this.showFooter();
    if (mode === false) return false;
    if (mode === true) return true;
    return this.enhancedColumns().some(
      (col) =>
        col.footer ||
        col.aggregateFn ||
        col.footerTemplate ||
        col.footerComponent,
    );
  });

  readonly footerValues = computed(() => {
    if (!this.hasFooter()) return new Map<string, string>();
    const rows = this.filteredData();
    const map = new Map<string, string>();

    for (const col of this.enhancedColumns()) {
      const key = String(col.accessorKey);
      if (col.footer) {
        map.set(
          key,
          typeof col.footer === "function" ? col.footer(rows) : col.footer,
        );
      } else if (col.aggregateFn) {
        map.set(key, this.computeAggregate(rows, col));
      }
    }
    return map;
  });

  private readonly _baseCellClass = computed(() => ({
    normal: cn(
      "whitespace-nowrap overflow-hidden text-ellipsis",
      "bg-background",
      this.showRowBorders() && "border-b",
      this.showColumnBorders() && "border-r",
    ),
    tree: cn(
      "whitespace-nowrap overflow-hidden text-ellipsis",
      this.showRowBorders() && "border-b",
      this.showColumnBorders() && "border-r",
    ),
  }));

  private readonly _headerClassMap = computed(() => {
    const showColBorders = this.showColumnBorders();
    const enableResize = this.enableColumnResize();
    const map = new Map<string, string>();
    for (const col of this.enhancedColumns()) {
      map.set(
        String(col.accessorKey),
        cn(
          "sticky top-0 bg-background shadow-sm whitespace-nowrap overflow-hidden text-ellipsis",
          col.sticky ? "z-30" : "z-20",
          showColBorders && "border-r",
          enableResize && "relative",
        ),
      );
    }
    return map;
  });

  private readonly _fillerHeaderClass = computed(() =>
    cn(
      "sticky top-0 bg-background shadow-sm whitespace-nowrap overflow-hidden text-ellipsis",
      "z-20",
      this.showColumnBorders() && "border-r",
    ),
  );

  getHeaderClass(col: CellStyleColumn) {
    return (
      this._headerClassMap().get(String(col.accessorKey)) ??
      this._fillerHeaderClass()
    );
  }

  getCellClass(col: CellStyleColumn, rowIndex?: number, treeDepth?: number) {
    const base =
      treeDepth === undefined
        ? this._baseCellClass().normal
        : this._baseCellClass().tree;
    const key = String(col.accessorKey);
    const focused = this.focusedCell();
    if (
      rowIndex !== undefined &&
      focused !== null &&
      focused.rowIndex === rowIndex &&
      focused.columnKey === key
    ) {
      return base + " ring-1 ring-ring/40 ring-inset";
    }
    if (rowIndex !== undefined && this.isCellInRange(rowIndex, key)) {
      return base + " bg-primary/10";
    }
    return base;
  }

  private readonly _cellStyleMap = computed(() => {
    const map = new Map<string, Record<string, string>>();
    for (const col of this.enhancedColumns()) {
      map.set(String(col.accessorKey), this._buildCellStyle(col, false));
    }
    return map;
  });

  private readonly _headerCellStyleMap = computed(() => {
    const map = new Map<string, Record<string, string>>();
    for (const col of this.enhancedColumns()) {
      map.set(String(col.accessorKey), this._buildCellStyle(col, true));
    }
    return map;
  });

  private readonly _treeCellStyleCache = computed(() => {
    const maxDepth = 10;
    const map = new Map<string, Record<string, string>>();
    for (const col of this.enhancedColumns()) {
      const base = this._buildCellStyle(col, false);
      for (let d = 0; d <= maxDepth; d++) {
        const bg =
          d > 0
            ? `color-mix(in srgb, var(--border) ${Math.min(d * 20, 80)}%, var(--background))`
            : "var(--background)";
        map.set(`${String(col.accessorKey)}_${d}`, {
          ...base,
          "background-color": bg,
        });
      }
    }
    return map;
  });

  private _buildCellStyle(col: CellStyleColumn, isHeader: boolean): Record<string, string> {
    const width = col._width;
    const isAuto = width === "auto";
    const isSpecial = col.accessorKey === "_selection" || col.accessorKey === "_expander" || col.accessorKey === "_actions";
    const minColWidth = isSpecial ? "0px" : "80px";

    const style: Record<string, string> = {
      width: isAuto ? "0px" : width,
      "min-width": isAuto ? minColWidth : width,
      "max-width": isAuto ? "none" : width,
      "flex-shrink": isAuto ? "1" : "0",
      "flex-grow": isAuto ? "1" : "0",
      "flex-basis": isAuto ? "0px" : "auto",
    };

    if (col._pin === "right") {
      style["position"] = "sticky";
      style["right"] = `${col._stickyRight}px`;
      style["z-index"] = isHeader ? "30" : "10";
    } else if (col.sticky || col._pin === "left") {
      style["position"] = "sticky";
      style["left"] = `${col._stickyLeft}px`;
      style["z-index"] = isHeader ? "30" : "10";
    }

    if (isHeader) {
      style["position"] = "sticky";
      style["top"] = "0";
      style["z-index"] = col.sticky ? "30" : "20";
    }

    return style;
  }

  getHeaderCellStyle(col: CellStyleColumn) {
    return (
      this._headerCellStyleMap().get(String(col.accessorKey)) ??
      this._buildCellStyle(col, true)
    );
  }

  getCellStyle(col: CellStyleColumn) {
    return (
      this._cellStyleMap().get(String(col.accessorKey)) ??
      this._buildCellStyle(col, false)
    );
  }

  getTreeCellStyle(col: CellStyleColumn, depth: number) {
    const clampedDepth = Math.min(depth, 10);
    return (
      this._treeCellStyleCache().get(
        `${String(col.accessorKey)}_${clampedDepth}`,
      ) ?? this._buildTreeCellStyleFallback(col, depth)
    );
  }

  private _buildTreeCellStyleFallback(
    col: CellStyleColumn,
    depth: number,
  ): Record<string, string> {
    const base = this._buildCellStyle(col, false);
    const bg =
      depth > 0
        ? `color-mix(in srgb, var(--border) ${Math.min(depth * 20, 80)}%, var(--background))`
        : "var(--background)";
    return { ...base, "background-color": bg };
  }

  private readonly disabledRowIdSet = computed(() => {
    const ids = this.disabledRowIds();
    if (ids instanceof Set) return ids;
    return new Set(ids);
  });

  isDisabled(row: T): boolean {
    const fn = this.isRowDisabled();
    if (fn?.(row)) return true;
    const id = this.getRowId()(row);
    return this.disabledRowIdSet().has(id);
  }

  isRowSelected(row: T): boolean {
    const id = this.getRowId()(row);
    return !!this.rowSelection()[id];
  }

  toggleRow(row: T) {
    if (this.isDisabled(row)) return;
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

  readonly isAllExpanded = computed(() => {
    const ids = this.filteredRowIds();
    if (ids.length === 0) return false;
    const expanded = this.expandedRows();
    return ids.every((id) => !!expanded[id]);
  });

  readonly isExpansionIndeterminate = computed(() => {
    const ids = this.filteredRowIds();
    const expanded = this.expandedRows();
    const count = ids.filter((id) => !!expanded[id]).length;
    return count > 0 && count < ids.length;
  });

  toggleAllExpanded() {
    const ids = this.filteredRowIds();
    if (this.isAllExpanded()) {
      const next = { ...this.expandedRows() };
      ids.forEach((id) => delete next[id]);
      this.expandedRows.set(next);
    } else {
      const next = { ...this.expandedRows() };
      ids.forEach((id) => (next[id] = true));
      this.expandedRows.set(next);
    }
  }

  getRowDetailComponentInputs(row: T): Record<string, unknown> {
    const resolver = this.rowDetailComponentInputs();
    return resolver ? resolver(row) : {};
  }

  private readonly selectableRowIds = computed(() => {
    const ids = this.filteredRowIds();
    const disabledSet = this.disabledRowIdSet();
    const fn = this.isRowDisabled();
    if (disabledSet.size === 0 && !fn) return ids;

    const getId = this.getRowId();
    const allRows = this.enableSubRows()
      ? this.visibleTreeRows().map((tr) => tr.row)
      : this.filteredData();
    const rowById = new Map(allRows.map((row) => [getId(row), row]));

    return ids.filter((id) => {
      if (disabledSet.has(id)) return false;
      if (fn) {
        const row = rowById.get(id);
        if (row && fn(row)) return false;
      }
      return true;
    });
  });

  toggleAll() {
    const selected = this.rowSelection();
    const selectableIds = this.selectableRowIds();

    if (this.isAllSelected()) {
      const remainingSelection = { ...selected };
      selectableIds.forEach((id) => {
        delete remainingSelection[id];
      });
      this.rowSelection.set(remainingSelection);
    } else {
      const nextSelection = { ...selected };
      selectableIds.forEach((id) => {
        nextSelection[id] = true;
      });
      this.rowSelection.set(nextSelection);
    }
  }

  readonly isAllSelected = computed(() => {
    const selectableIds = this.selectableRowIds();
    if (selectableIds.length === 0) return false;
    const selected = this.rowSelection();
    return selectableIds.every((id) => !!selected[id]);
  });

  readonly isIndeterminate = computed(() => {
    const selectableIds = this.selectableRowIds();
    const selected = this.rowSelection();
    const count = selectableIds.filter((id) => !!selected[id]).length;
    const visibleCount = selectableIds.length;
    return count > 0 && count < visibleCount;
  });

  selectRows(rows: T[]) {
    const getId = this.getRowId();
    const next = { ...this.rowSelection() };
    rows.forEach((row) => (next[getId(row)] = true));
    this.rowSelection.set(next);
  }

  unselectRows(rows: T[]) {
    const getId = this.getRowId();
    const next = { ...this.rowSelection() };
    rows.forEach((row) => delete next[getId(row)]);
    this.rowSelection.set(next);
  }

  clearSelection() {
    this.rowSelection.set({});
  }

  selectAll() {
    const nextSelection = { ...this.rowSelection() };
    this.selectableRowIds().forEach((id) => {
      nextSelection[id] = true;
    });
    this.rowSelection.set(nextSelection);
  }

  onPaginationChange(state: PaginationState) {
    this.loadingTrigger.set("pagination");
    const totalItems = this.localPagination()
      ? this.filteredData().length
      : this.total();
    const safePageSize =
      state.pageSize > 0 ? state.pageSize : this.paginationState().pageSize;
    const maxPageIndex = Math.max(0, Math.ceil(totalItems / safePageSize) - 1);
    const nextState = {
      pageIndex: Math.min(maxPageIndex, Math.max(0, state.pageIndex)),
      pageSize: safePageSize,
    };

    this.paginationState.set(nextState);
    this.pageChange.emit(nextState);
  }

  onFilterChange(value: string) {
    this.loadingTrigger.set("filtering");
    const debounceMs = this.filterDebounce();

    if (debounceMs > 0) {
      clearTimeout(this.filterDebounceTimer);
      this.filterDebounceTimer = setTimeout(() => {
        this.applyGlobalFilter(value);
      }, debounceMs);
    } else {
      this.applyGlobalFilter(value);
    }
  }

  private applyGlobalFilter(value: string) {
    this.globalFilter.set(value);
    this.paginationState.update((state) => ({ ...state, pageIndex: 0 }));
    this.filterChange.emit(value);
  }

  onColumnFilterChange(columnKey: string | keyof T, value: unknown) {
    this.loadingTrigger.set("filtering");
    this.columnFilters.update((filters) => ({
      ...filters,
      [columnKey]: value,
    }));
    this.paginationState.update((state) => ({ ...state, pageIndex: 0 }));
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
    const currentOrder = this.applyKeyOrder(
      this.columns().map((col) => String(col.accessorKey)),
    );
    const currentIndex = currentOrder.indexOf(key);
    if (currentIndex === -1) {
      return;
    }

    const boundedTarget = Math.max(
      0,
      Math.min(targetIndex, currentOrder.length - 1),
    );
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
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", key);
    }
  }

  onColumnDragOver(event: DragEvent, col: ColumnDef<T>) {
    if (!this.isColumnDraggable(col)) {
      return;
    }

    const targetKey = String(col.accessorKey);
    const sourceKey =
      this.draggedColumnKey() ??
      event.dataTransfer?.getData("text/plain") ??
      "";
    if (!sourceKey || sourceKey === targetKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.dropTargetColumnKey.set(targetKey);

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
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
    const sourceKey =
      this.draggedColumnKey() ??
      event.dataTransfer?.getData("text/plain") ??
      "";
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
    const order = this.applyKeyOrder(
      this.columns().map((col) => String(col.accessorKey)),
    );
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
    if (typeof col.filterComponentInputs === "function") {
      return col.filterComponentInputs();
    }
    return col.filterComponentInputs || {};
  }

  getFilterOutputs(col: ColumnDef<T>): Record<string, (event: unknown) => void> {
    return {
      ...col.filterComponentOutputs,
      filterChange: (value: unknown) =>
        this.onColumnFilterChange(col.accessorKey, value),
    };
  }

  isColumnFilterActive(col: ColumnDef<T>): boolean {
    const value = this.columnFilters()[col.accessorKey as string];
    return !this.isFilterValueEmpty(value);
  }

  isFilterValueEmpty(value: unknown): boolean {
    if (value === undefined || value === null || value === "") return true;
    if (typeof value === "object" && "start" in value && "end" in value) {
      const range = value as { start: unknown; end: unknown };
      return range.start === null && range.end === null;
    }
    return false;
  }

  private compareByColumn(a: T, b: T, column: ColumnDef<T>): number {
    if (column.sortFn) return column.sortFn(a, b);
    const aVal = this.getCellValue(a, column.accessorKey, column) as string | number | boolean | null | undefined;
    const bVal = this.getCellValue(b, column.accessorKey, column) as string | number | boolean | null | undefined;
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return -1;
    if (bVal == null) return 1;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  }

  private buildSortComparator(sorts: SortState[]): (a: T, b: T) => number {
    return (a: T, b: T) => {
      for (const sort of sorts) {
        const column = this.enhancedColumns().find(
          (col) => col.accessorKey === sort.column,
        );
        if (!column || !sort.direction) continue;

        const result = this.compareByColumn(a, b, column);
        if (result !== 0) {
          return sort.direction === "asc" ? result : -result;
        }
      }
      return 0;
    };
  }

  protected readonly String = String;

  getCellValue(row: T, key: string | keyof T, column?: ColumnDef<T>): unknown {
    if (column?.accessorFn) {
      return column.accessorFn(row);
    }

    if (typeof key === "string" && key.includes(".")) {
      return key.split(".").reduce<unknown>((value, segment) => {
        if (value === null || value === undefined) {
          return undefined;
        }
        return (value as Record<string, unknown>)[segment];
      }, row as Record<string, unknown>);
    }

    return (row as Record<string, unknown>)[key as string];
  }

  getCellStringValue(row: T, column: ColumnDef<T>): string {
    if (column.cell) {
      return column.cell(row);
    }
    const value = this.getCellValue(row, column.accessorKey, column);
    if (value === null || value === undefined) return "";
    if (
      typeof value === "object" &&
      typeof value.toString === "function" &&
      value.toString !== Object.prototype.toString
    ) {
      return value.toString();
    }
    return String(value);
  }

  getExportData(
    options?: DataTableExportOptions,
    customRows?: T[],
  ): string[][] {
    const includeHeaders = options?.includeHeaders !== false;
    const onlyVisible = options?.onlyVisible !== false;
    const onlyFiltered = options?.onlyFiltered !== false;

    const columns = onlyVisible
      ? this.enhancedColumns().filter(
          (col) =>
            col.accessorKey !== "_selection" &&
            col.accessorKey !== "_expander" &&
            col.accessorKey !== "_actions",
        )
      : this.columns().filter(
          (col) =>
            col.accessorKey !== "_selection" &&
            col.accessorKey !== "_expander" &&
            col.accessorKey !== "_actions",
        );

    const rows =
      customRows ?? (onlyFiltered ? this.filteredData() : this.data());
    const result: string[][] = [];

    if (includeHeaders) {
      result.push(columns.map((col) => col.header));
    }

    for (const row of rows) {
      result.push(columns.map((col) => this.getCellStringValue(row, col)));
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
      const csvContent = data
        .map((row) =>
          row
            .map((cell) => {
              if (
                cell.includes(",") ||
                cell.includes('"') ||
                cell.includes("\n") ||
                cell.includes("\r")
              ) {
                return '"' + cell.replaceAll('"', '""') + '"';
              }
              return cell;
            })
            .join(","),
        )
        .join("\r\n");

      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      this.downloadBlob(blob, (filename || "export") + ".csv");
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
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      this.downloadBlob(blob, (filename || "export") + ".xlsx");
    } finally {
      this.exporting.set(false);
    }
  }

  async copyCellToClipboard(): Promise<void> {
    if (!this.enableCopy()) return;
    const focused = this.focusedCell();
    if (!focused) return;
    const row = this.processedData()[focused.rowIndex];
    const col = this.enhancedColumns().find(
      (c) => String(c.accessorKey) === focused.columnKey,
    );
    if (row && col) {
      await navigator.clipboard.writeText(this.getCellStringValue(row, col));
    }
  }

  async copyRowToClipboard(row: T): Promise<void> {
    if (!this.enableCopy()) return;
    const columns = this.enhancedColumns().filter(
      (col) =>
        col.accessorKey !== "_selection" &&
        col.accessorKey !== "_expander" &&
        col.accessorKey !== "_actions",
    );
    const values = columns.map((col) => this.getCellStringValue(row, col));
    await navigator.clipboard.writeText(values.join("\t"));
  }

  async copySelectedToClipboard(): Promise<void> {
    if (!this.enableCopy()) return;
    const columns = this.enhancedColumns().filter(
      (col) =>
        col.accessorKey !== "_selection" &&
        col.accessorKey !== "_expander" &&
        col.accessorKey !== "_actions",
    );
    const selectedIds = this.rowSelection();
    const rows = this.filteredData().filter(
      (row) => selectedIds[this.getRowId()(row)],
    );
    if (rows.length === 0) return;

    const headerLine = columns.map((col) => col.header).join("\t");
    const dataLines = rows.map((row) =>
      columns.map((col) => this.getCellStringValue(row, col)).join("\t"),
    );
    await navigator.clipboard.writeText([headerLine, ...dataLines].join("\n"));
  }

  async copyAllToClipboard(): Promise<void> {
    if (!this.enableCopy()) return;
    const data = this.getExportData();
    const text = data.map((row) => row.join("\t")).join("\n");
    await navigator.clipboard.writeText(text);
  }

  onTableClick(): void {
    this.focusedCell.set(null);
  }

  onCellClick(rowIndex: number, col: ColumnDef<T>, event: Event): void {
    const key = String(col.accessorKey);
    if (key === "_selection" || key === "_expander" || key === "_actions")
      return;
    event.stopPropagation();

    if (this.enableCellRangeSelection() && (event as MouseEvent).shiftKey) {
      const focused = this.focusedCell();
      if (focused) {
        this.cellRange.set({
          startRow: focused.rowIndex,
          startCol: focused.columnKey,
          endRow: rowIndex,
          endCol: key,
        });
        return;
      }
    }

    this.focusedCell.set({ rowIndex, columnKey: key });
    if (this.enableCellRangeSelection()) {
      this.cellRange.set(null);
    }
  }

  onCellDblClick(rowIndex: number, col: ColumnDef<T>, event: Event): void {
    const key = String(col.accessorKey);
    if (key === "_selection" || key === "_expander" || key === "_actions")
      return;
    event.stopPropagation();
    this.startEditing(rowIndex, key);
  }

  private readonly DOUBLE_TAP_MAX_DELAY = 300;
  private _lastTapTime = 0;
  private _lastTapRowIndex = -1;
  private _lastTapColumnKey = "";

  onCellTouchEnd(
    event: TouchEvent,
    rowIndex: number,
    col: ColumnDef<T>
  ): void {
    const key = String(col.accessorKey);
    if (key === "_selection" || key === "_expander" || key === "_actions")
      return;
    const now = Date.now();
    const isSameCell =
      this._lastTapRowIndex === rowIndex && this._lastTapColumnKey === key;
    if (isSameCell && now - this._lastTapTime < this.DOUBLE_TAP_MAX_DELAY) {
      event.preventDefault();
      this.startEditing(rowIndex, key);
      this._lastTapTime = 0;
      this._lastTapRowIndex = -1;
      this._lastTapColumnKey = "";
    } else {
      this._lastTapTime = now;
      this._lastTapRowIndex = rowIndex;
      this._lastTapColumnKey = key;
    }
  }

  private readonly navigableColumnKeys = computed(() => {
    return this.enhancedColumns()
      .filter(
        (c) =>
          c.accessorKey !== "_selection" &&
          c.accessorKey !== "_expander" &&
          c.accessorKey !== "_actions",
      )
      .map((c) => String(c.accessorKey));
  });

  private readonly totalVisibleRows = computed(() => {
    if (this.enableSubRows()) return this.processedTreeRows().length;
    return this.processedData().length;
  });

  onTableKeydown(event: KeyboardEvent): void {
    if (this.handleCopyKeydown(event)) return;
    this.handleNavigationKeydown(event);
  }

  private handleCopyKeydown(event: KeyboardEvent): boolean {
    if (!this.enableCopy()) return false;
    const isCopy = (event.ctrlKey || event.metaKey) && event.key === "c";
    if (!isCopy) return false;

    const range = this.normalizedCellRange();
    if (range) {
      event.preventDefault();
      this.copyCellRangeToClipboard();
      return true;
    }

    const focused = this.focusedCell();
    if (focused) {
      const row = this.processedData()[focused.rowIndex];
      const col = this.enhancedColumns().find(
        (c) => String(c.accessorKey) === focused.columnKey,
      );
      if (row && col) {
        event.preventDefault();
        navigator.clipboard.writeText(this.getCellStringValue(row, col));
        return true;
      }
    }

    const selectedIds = this.rowSelection();
    if (Object.keys(selectedIds).some((id) => selectedIds[id])) {
      event.preventDefault();
      this.copySelectedToClipboard();
      return true;
    }
    return false;
  }

  async copyCellRangeToClipboard(): Promise<void> {
    const range = this.normalizedCellRange();
    if (!range) return;

    const colKeys = this.navigableColumnKeys();
    const rangeCols = colKeys.slice(range.minCol, range.maxCol + 1);
    const data = this.processedData();
    const columns = this.enhancedColumns();

    const lines: string[] = [];
    for (let r = range.minRow; r <= range.maxRow; r++) {
      const row = data[r];
      if (!row) continue;
      const values = rangeCols.map((key) => {
        const col = columns.find((c) => String(c.accessorKey) === key);
        return col ? this.getCellStringValue(row, col) : "";
      });
      lines.push(values.join("\t"));
    }
    await navigator.clipboard.writeText(lines.join("\n"));
  }

  private computeNextCell(
    key: string, shiftKey: boolean, ctrlKey: boolean,
    rowIndex: number, colIndex: number, colKeys: string[], totalRows: number
  ): { row: number; col: number } {
    let nextRow = rowIndex;
    let nextCol = colIndex;

    switch (key) {
      case 'ArrowUp':
        return { row: this.findNextEnabledRow(rowIndex, -1, totalRows), col: nextCol };
      case 'ArrowDown':
        return { row: this.findNextEnabledRow(rowIndex, 1, totalRows), col: nextCol };
      case 'ArrowLeft':
        return { row: nextRow, col: Math.max(0, nextCol - 1) };
      case 'ArrowRight':
        return { row: nextRow, col: Math.min(colKeys.length - 1, nextCol + 1) };
      case 'Tab':
        return this.computeTabTarget(shiftKey, rowIndex, colIndex, colKeys, totalRows);
      case 'Home':
        return { row: ctrlKey ? 0 : nextRow, col: 0 };
      case 'End':
        return { row: ctrlKey ? totalRows - 1 : nextRow, col: colKeys.length - 1 };
      case 'PageUp':
        return { row: Math.max(0, rowIndex - this.getPageSize()), col: nextCol };
      case 'PageDown':
        return { row: Math.min(totalRows - 1, rowIndex + this.getPageSize()), col: nextCol };
      default:
        return { row: nextRow, col: nextCol };
    }
  }

  private computeTabTarget(
    shiftKey: boolean, rowIndex: number, colIndex: number, colKeys: string[], totalRows: number
  ): { row: number; col: number } {
    if (shiftKey) {
      if (colIndex > 0) return { row: rowIndex, col: colIndex - 1 };
      if (rowIndex > 0) return { row: rowIndex - 1, col: colKeys.length - 1 };
      return { row: rowIndex, col: colIndex };
    }
    if (colIndex < colKeys.length - 1) return { row: rowIndex, col: colIndex + 1 };
    if (rowIndex < totalRows - 1) return { row: rowIndex + 1, col: 0 };
    return { row: rowIndex, col: colIndex };
  }

  private getPageSize(): number {
    const container = this.scrollContainerRef()?.nativeElement;
    return container ? Math.floor(container.clientHeight / this.virtualRowHeight()) : 10;
  }

  private handleNavigationKeydown(event: KeyboardEvent): void {
    if (this.editingCell()) return;

    if (event.key === 'Escape' && this.cellRange()) {
      event.preventDefault();
      this.cellRange.set(null);
      return;
    }

    if (event.key === 'Enter' || event.key === 'F2') {
      const focused = this.focusedCell();
      if (focused) {
        event.preventDefault();
        this.startEditing(focused.rowIndex, focused.columnKey);
      }
      return;
    }

    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'PageUp', 'PageDown'];
    if (!navKeys.includes(event.key)) return;

    const colKeys = this.navigableColumnKeys();
    const totalRows = this.totalVisibleRows();
    if (colKeys.length === 0 || totalRows === 0) return;

    const focused = this.focusedCell();
    if (!focused) {
      if (event.key === 'ArrowDown' || event.key === 'Tab') {
        event.preventDefault();
        this.focusedCell.set({ rowIndex: 0, columnKey: colKeys[0] });
        this.ensureFocusedCellVisible();
      }
      return;
    }

    event.preventDefault();
    const colIndex = colKeys.indexOf(focused.columnKey);
    const safeColIndex = colIndex === -1 ? 0 : colIndex;
    const next = this.computeNextCell(
      event.key, event.shiftKey, event.ctrlKey || event.metaKey,
      focused.rowIndex, safeColIndex, colKeys, totalRows
    );

    this.focusedCell.set({ rowIndex: next.row, columnKey: colKeys[next.col] });
    this.ensureFocusedCellVisible();
  }

  private findNextEnabledRow(
    currentIndex: number,
    direction: 1 | -1,
    totalRows: number,
  ): number {
    const data = this.processedData();
    let next = currentIndex + direction;
    while (next >= 0 && next < totalRows) {
      const row = data[next];
      if (row && !this.isDisabled(row)) return next;
      next += direction;
    }
    return currentIndex;
  }

  private ensureFocusedCellVisible(): void {
    if (!this.isVirtualScrollActive()) return;
    const focused = this.focusedCell();
    if (!focused) return;
    this.scrollToRow(focused.rowIndex);
  }

  isEditing(rowIndex: number, columnKey: string): boolean {
    const editing = this.editingCell();
    return (
      editing !== null &&
      editing.rowIndex === rowIndex &&
      editing.columnKey === columnKey
    );
  }

  startEditing(rowIndex: number, columnKey: string): void {
    const col = this.enhancedColumns().find(
      (c) => String(c.accessorKey) === columnKey,
    );
    if (!col?.editable) return;

    const row = this.processedData()[rowIndex];
    if (!row) return;
    if (this.isDisabled(row)) return;

    const currentValue = this.getCellValue(row, col.accessorKey, col);
    this.editValue.set(currentValue);
    this.editingCell.set({ rowIndex, columnKey });
    this.focusEditInput();
  }

  private focusEditInput(): void {
    requestAnimationFrame(() => {
      const container = this._el.nativeElement as HTMLElement;
      const input = container.querySelector<HTMLElement>(
        'input[data-edit-input], select[data-edit-input]'
      );
      input?.focus();
    });
  }

  commitEdit(): void {
    const editing = this.editingCell();
    if (!editing) return;

    const col = this.enhancedColumns().find(
      (c) => String(c.accessorKey) === editing.columnKey,
    );
    const row = this.processedData()[editing.rowIndex];
    if (!col || !row) {
      this.cancelEdit();
      return;
    }

    const newValue = this.editValue();
    const oldValue = this.getCellValue(row, col.accessorKey, col);

    if (newValue === oldValue) {
      this.cancelEdit();
      return;
    }

    if (col.editValidator) {
      const result = col.editValidator(newValue, row);
      if (result !== true) {
        return;
      }
    }

    this.cellEdit.emit({
      row,
      column: col,
      oldValue,
      newValue,
      rowIndex: editing.rowIndex,
    });

    if (col.valueSetter) {
      const updatedRow = col.valueSetter(row, newValue);
      const data = [...this.data()];
      const dataIndex = data.findIndex(
        (r) => this.getRowId()(r) === this.getRowId()(row),
      );
      if (dataIndex !== -1) {
        data[dataIndex] = updatedRow;
      }
    }

    this.editingCell.set(null);
    this.refocusTable();
  }

  cancelEdit(): void {
    this.editingCell.set(null);
    this.editValue.set(null);
    this.refocusTable();
  }

  private refocusTable(): void {
    requestAnimationFrame(() => {
      this.scrollContainerRef()?.nativeElement?.focus();
    });
  }

  onEditValueChange(value: unknown): void {
    this.editValue.set(value);
  }

  onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelEdit();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.commitEdit();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      this.commitEdit();
      this.advanceEditToNextCell(event.shiftKey);
    }
  }

  private advanceEditToNextCell(shiftKey: boolean): void {
    const colKeys = this.navigableColumnKeys();
    const editing = this.focusedCell();
    if (!editing) return;

    const colIndex = colKeys.indexOf(editing.columnKey);
    const totalRows = this.totalVisibleRows();
    const next = this.computeTabTarget(shiftKey, editing.rowIndex, colIndex, colKeys, totalRows);

    this.focusedCell.set({ rowIndex: next.row, columnKey: colKeys[next.col] });
    const nextCol = this.enhancedColumns().find(c => String(c.accessorKey) === colKeys[next.col]);
    if (nextCol?.editable) {
      this.startEditing(next.row, colKeys[next.col]);
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
    this.subRowExpandedRows.update((current) => ({ ...current, [id]: true }));
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

  readonly isAllSubRowsExpanded = computed(() => {
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
          const isExp =
            id in expanded
              ? expanded[id]
              : defaultExpanded === -1 || depth < defaultExpanded;
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
    descendantIds.forEach((did) => (next[did] = true));
    this.rowSelection.set(next);
  }

  deselectChildren(parentRow: T) {
    const id = this.getRowId()(parentRow);
    const index = this.treeIndex();
    const descendantIds = index.descendants.get(id) ?? [];
    const next = { ...this.rowSelection() };
    descendantIds.forEach((did) => delete next[did]);
    this.rowSelection.set(next);
  }

  toggleRowWithCascade(row: T) {
    if (this.isDisabled(row)) return;
    const mode = this.subRowSelectionMode();
    if (mode === "self") {
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

    if (mode === "descendants") {
      const descendantIds = index.descendants.get(id) ?? [];
      descendantIds.forEach((did) => {
        if (isSelected) {
          delete next[did];
        } else {
          next[did] = true;
        }
      });
    } else if (mode === "filteredDescendants") {
      const visibleIds = new Set(this.filteredRowIds());
      const descendantIds = index.descendants.get(id) ?? [];
      descendantIds.forEach((did) => {
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

  private readonly _indeterminateRows = computed(() => {
    const result = new Set<string>();
    if (this.subRowSelectionMode() === "self") return result;
    if (!this.enableSubRows()) return result;
    const index = this.treeIndex();
    const selected = this.rowSelection();
    for (const [id, descendantIds] of index.descendants) {
      if (descendantIds.length === 0) continue;
      let count = 0;
      for (const did of descendantIds) {
        if (selected[did]) count++;
      }
      if (count > 0 && count < descendantIds.length) {
        result.add(id);
      }
    }
    return result;
  });

  isSubRowSelectionIndeterminate(row: T): boolean {
    return this._indeterminateRows().has(this.getRowId()(row));
  }

  getSubRowComponentInputs(
    col: ColumnDef<T>,
    treeRow: FlattenedTreeRow<T>,
  ): Record<string, unknown> {
    const base = col.componentInputs
      ? col.componentInputs(treeRow.row)
      : EMPTY_RECORD;
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
      const allSelected = siblingIds.every((sid) => !!selection[sid]);
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

    const walk = (
      items: T[],
      depth: number,
      parentId: string | null,
      parentRow: T | null,
      path: string[],
    ) => {
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
    return this.flattenTreeFull(rootSlice).map((tr) => tr.row);
  }

  private flattenTreeRowsForPageFull(rootSlice: T[]): FlattenedTreeRow<T>[] {
    return this.flattenTreeFull(rootSlice);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = this._document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    this._document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private applyColumnOrder<U extends { accessorKey: string | keyof T }>(
    columns: U[],
  ): U[] {
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
    const columnsByKey = new Map(
      this.columns().map((col) => [String(col.accessorKey), col]),
    );
    const baseOrder = this.applyKeyOrder(
      this.columns().map((col) => String(col.accessorKey)),
    );
    const visibleReorderable = baseOrder.filter((key) => {
      const col = columnsByKey.get(key);
      return (
        !!col && this.isColumnReorderable(col) && this.isColumnVisible(key)
      );
    });

    const sourceIndex = visibleReorderable.indexOf(sourceKey);
    const targetIndex = visibleReorderable.indexOf(targetKey);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    if (sourceIndex === targetIndex) {
      return;
    }

    const nextVisibleReorderable = visibleReorderable.filter(
      (key) => key !== sourceKey,
    );
    const reducedTargetIndex = nextVisibleReorderable.indexOf(targetKey);
    const insertIndex =
      sourceIndex < targetIndex ? reducedTargetIndex + 1 : reducedTargetIndex;

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
    if (key === "_selection" || key === "_expander" || key === "_actions") {
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
    if (trigger === "pagination") return visibility.pagination !== false;
    if (trigger === "sorting") return visibility.sorting !== false;
    if (trigger === "filtering") return visibility.filtering !== false;
    return visibility.initial !== false;
  }

  getRenderedRowAt(index: number): T | undefined {
    return this.processedData()[index];
  }

  getRenderedTreeRowAt(index: number): FlattenedTreeRow<T> | undefined {
    return this.processedTreeRows()[index];
  }

  private buildRowActionContext(row: T, index: number): RowActionContext<T> {
    const selected = !!this.rowSelection()[this.getRowId()(row)];
    const context: RowActionContext<T> = { row, index, selected };

    if (this.enableSubRows()) {
      const treeRow = this.getRenderedTreeRowAt(index);
      if (treeRow) {
        context.depth = treeRow.depth;
        context.isLeaf = treeRow.isLeaf;
        context.parentRow = treeRow.parentRow;
        context.isExpanded = treeRow.isExpanded;
      }
    }

    return context;
  }

  getRowActions(row: T, index: number): ContextMenuItem[] {
    const actionsFn = this.rowActions();
    if (!actionsFn) return [];
    return actionsFn(this.buildRowActionContext(row, index));
  }

  onRowContextMenu(event: MouseEvent): void {
    const contextMenu = this.internalContextMenu();
    if (!this.resolvedShowContextMenu() || !contextMenu) return;

    const target = event.target as HTMLElement;
    const rowEl = target.closest<HTMLElement>("[data-row-index]");
    if (!rowEl) return;

    event.preventDefault();

    const index = Number.parseInt(rowEl.dataset["rowIndex"] ?? "0", 10);
    const row = this.getRenderedRowAt(index);
    if (!row) return;

    const actionsFn = this.rowActions();
    if (!actionsFn) return;

    const context = this.buildRowActionContext(row, index);
    this.activeContextMenuItems.set(actionsFn(context));
    contextMenu.show(event.clientX, event.clientY, context);
  }

  onActionsButtonClick(event: MouseEvent, row: T, index: number): void {
    event.stopPropagation();

    const contextMenu = this.internalContextMenu();
    if (!contextMenu) return;

    const actionsFn = this.rowActions();
    if (!actionsFn) return;

    const context = this.buildRowActionContext(row, index);
    this.activeContextMenuItems.set(actionsFn(context));

    const target = event.target as HTMLElement;
    const button = target.closest("button") ?? target;
    const rect = button.getBoundingClientRect();
    contextMenu.show(rect.right, rect.bottom, context);
  }

  onColumnMenuClick(event: MouseEvent, col: ColumnDef<T>): void {
    event.stopPropagation();
    const contextMenu = this.columnMenuContextMenu();
    if (!contextMenu) return;

    const key = String(col.accessorKey);
    const items = this.buildColumnMenuItems(col);
    this.activeColumnMenuItems.set(items);

    const target = event.target as HTMLElement;
    const button = target.closest("button") ?? target;
    const rect = button.getBoundingClientRect();
    contextMenu.show(rect.left, rect.bottom, { columnKey: key, column: col });
  }

  private buildColumnMenuItems(col: ColumnDef<T>): ContextMenuItem[] {
    const key = String(col.accessorKey);
    const currentSort = this.getSortDirection(key);
    const currentPin = this.columnPinOverrides()[key] ?? col.pin;

    const sortItems = this.buildSortMenuItems(key, col, currentSort);
    const pinItems = this.buildPinMenuItems(key, currentPin);
    const visibilityItems: ContextMenuItem[] = [
      ...(col.enableHiding === false ? [] : [{ label: 'Hide Column', icon: 'eye-off', click: () => this.setColumnVisibility(key, false) }]),
      { label: 'Show All Columns', icon: 'eye', click: () => this.showAllColumns() },
    ];

    return [...sortItems, ...pinItems, ...visibilityItems];
  }

  private buildSortMenuItems(key: string, col: ColumnDef<T>, currentSort: SortDirection): ContextMenuItem[] {
    if (col.enableSorting === false) return [];
    const items: ContextMenuItem[] = [
      { label: 'Sort Ascending', icon: 'arrow-up', disabled: currentSort === 'asc', click: () => this.onSortChange(key, 'asc') },
      { label: 'Sort Descending', icon: 'arrow-down', disabled: currentSort === 'desc', click: () => this.onSortChange(key, 'desc') },
    ];
    if (currentSort) {
      items.push({ label: 'Clear Sort', icon: 'x', click: () => this.onSortChange(key, null) });
    }
    items.push({ type: 'separator' });
    return items;
  }

  private buildPinMenuItems(key: string, currentPin: string | undefined): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    if (currentPin !== 'left') items.push({ label: 'Pin Left', icon: 'pin', click: () => this.pinColumn(key, 'left') });
    if (currentPin !== 'right') items.push({ label: 'Pin Right', icon: 'pin', click: () => this.pinColumn(key, 'right') });
    if (currentPin) items.push({ label: 'Unpin', icon: 'pin-off', click: () => this.pinColumn(key, undefined) });
    items.push({ type: 'separator' });
    return items;
  }

  pinColumn(columnKey: string, pin: "left" | "right" | undefined): void {
    this.columnPinOverrides.update((overrides) => ({
      ...overrides,
      [columnKey]: pin,
    }));
  }

  private computeAggregate(rows: T[], col: ColumnDef<T>): string {
    const fn = col.aggregateFn;
    if (!fn) return "";

    const values = rows.map((row) =>
      this.getCellValue(row, col.accessorKey, col),
    );

    if (typeof fn === "function") return fn(values);

    const nums = values.map(Number).filter(Number.isFinite);
    if (nums.length === 0 && fn !== "count") return "";

    switch (fn) {
      case "sum":
        return String(nums.reduce((a, b) => a + b, 0));
      case "avg":
        return String(
          Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) /
            100,
        );
      case "count":
        return String(rows.length);
      case "min":
        return String(Math.min(...nums));
      case "max":
        return String(Math.max(...nums));
      default:
        return "";
    }
  }

  showAllColumns(): void {
    const next: Record<string, boolean> = {};
    for (const col of this.columns()) {
      next[String(col.accessorKey)] = true;
    }
    this.columnVisibility.set(next);
  }

  readonly draggedRowId = signal<string | null>(null);
  private readonly dragOverIndex = signal<number | null>(null);
  private readonly dragOverPosition = signal<RowDragPosition>('below');

  readonly dragPreviewData = computed((): T[] | null => {
    const draggedId = this.draggedRowId();
    const overIdx = this.dragOverIndex();
    if (!draggedId || overIdx === null) return null;

    const getId = this.getRowId();
    const data = this.processedData();
    const fromIndex = data.findIndex(r => getId(r) === draggedId);
    if (fromIndex === -1) return null;

    const position = this.dragOverPosition();
    if (position === 'on') return null;
    let toIndex = position === 'above' ? overIdx : overIdx + 1;
    if (fromIndex < toIndex) toIndex -= 1;
    if (fromIndex === toIndex) return null;

    const result = [...data];
    const [moved] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, moved);
    return result;
  });

  private readonly dragWheelHandler = (e: WheelEvent) => {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;
    e.preventDefault();
    e.stopPropagation();
    container.scrollTop += e.deltaY;
    container.scrollLeft += e.deltaX;
  };

  private readonly dragEventHandler = (e: DragEvent) => {
    if (!this.draggedRowId()) return;
    this.handleDragAutoScroll(e.clientY);
  };

  onRowDragStart(event: DragEvent, row: T): void {
    if (!this.enableRowDrag() || this.isDisabled(row) || this.loading()) return;
    const id = this.getRowId()(row);
    this.draggedRowId.set(id);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }

    this._document.addEventListener('wheel', this.dragWheelHandler, { capture: true, passive: false } as AddEventListenerOptions);
    this._document.addEventListener('drag', this.dragEventHandler);
  }

  private dragAutoScrollId = 0;

  private computeDragPosition(event: DragEvent): RowDragPosition {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const relativeY = (event.clientY - rect.top) / rect.height;

    if (this.rowDragMode() === 'tree') {
      if (relativeY < 0.25) return 'above';
      if (relativeY > 0.75) return 'below';
      return 'on';
    }
    return relativeY < 0.5 ? 'above' : 'below';
  }

  onRowDragOver(event: DragEvent, index: number): void {
    if (!this.enableRowDrag() || !this.draggedRowId()) return;

    const row = this.processedData()[index];
    if (row && this.isDisabled(row)) return;

    let position = this.computeDragPosition(event);

    const draggedId = this.draggedRowId()!;
    const getId = this.getRowId();

    if (this.enableSubRows() && this.rowDragMode() === 'flat') {
      const treeRows = this.processedTreeRows();
      const draggedTreeRow = treeRows.find(tr => getId(tr.row) === draggedId);
      const targetTreeRow = treeRows[index];
      if (draggedTreeRow && targetTreeRow && draggedTreeRow.depth !== targetTreeRow.depth) {
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
        this.dragOverIndex.set(-1);
        return;
      }
      if (position === 'on') position = 'below';
    }

    const draggedRow = this.processedData().find(r => getId(r) === draggedId);
    const allowDropFn = this.rowDragAllowDrop();
    if (draggedRow && row && allowDropFn && !allowDropFn(draggedRow, row, position)) return;

    event.preventDefault();
    event.stopPropagation();

    this.dragOverIndex.set(index);
    this.dragOverPosition.set(position);

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    this.handleDragAutoScroll(event.clientY);
  }

  onContainerDragOver(event: DragEvent): void {
    if (!this.enableRowDrag() || !this.draggedRowId()) return;
    event.preventDefault();

    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;

    const lastIndex = this.processedData().length - 1;
    if (lastIndex < 0) return;

    const rows = container.querySelectorAll<HTMLElement>('[data-row-index]');
    if (rows.length === 0) return;
    const lastRow = rows[rows.length - 1];
    const lastRowRect = lastRow.getBoundingClientRect();

    if (event.clientY > lastRowRect.bottom) {
      this.dragOverIndex.set(lastIndex);
      this.dragOverPosition.set('below');
    }

    this.handleDragAutoScroll(event.clientY);
  }

  private handleDragAutoScroll(clientY: number): void {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const edgeZone = 40;
    const distFromTop = clientY - rect.top;
    const distFromBottom = rect.bottom - clientY;

    cancelAnimationFrame(this.dragAutoScrollId);

    if (distFromTop < edgeZone) {
      const speed = Math.max(2, Math.round((edgeZone - distFromTop) / 3));
      this.dragAutoScrollId = requestAnimationFrame(() => {
        container.scrollTop -= speed;
      });
    } else if (distFromBottom < edgeZone) {
      const speed = Math.max(2, Math.round((edgeZone - distFromBottom) / 3));
      this.dragAutoScrollId = requestAnimationFrame(() => {
        container.scrollTop += speed;
      });
    }
  }

  onRowDrop(event: DragEvent): void {
    if (!this.enableRowDrag()) {
      this.clearRowDragState();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const reorderEvent = this.buildRowReorderEvent();
    if (!reorderEvent) {
      this.clearRowDragState();
      return;
    }

    this.rowReorder.emit(reorderEvent);
    this.clearRowDragState();
  }

  reorderData(data: T[], event: RowReorderEvent<T>): T[] {
    if (this.enableSubRows()) {
      return this.reorderTreeData(data, event);
    }
    return this.reorderFlatData(data, event);
  }

  private reorderFlatData(data: T[], event: RowReorderEvent<T>): T[] {
    const result = [...data];
    const getId = this.getRowId();
    const fromIdx = result.findIndex(r => getId(r) === getId(event.row));
    if (fromIdx === -1) return data;

    const [moved] = result.splice(fromIdx, 1);

    let insertIdx: number;
    if (event.previousId) {
      insertIdx = result.findIndex(r => getId(r) === event.previousId) + 1;
    } else if (event.nextId) {
      insertIdx = result.findIndex(r => getId(r) === event.nextId);
      if (insertIdx === -1) insertIdx = result.length;
    } else {
      insertIdx = result.length;
    }

    result.splice(Math.max(0, insertIdx), 0, moved);
    return result;
  }

  private reorderTreeData(data: T[], event: RowReorderEvent<T>): T[] {
    const getId = this.getRowId();
    const getChildrenFn = this.getChildren();
    const setChildrenFn = this.setChildren();
    const rowId = getId(event.row);
    const targetId = getId(event.targetRow);

    const { remaining, removed } = this.removeFromTree(data, rowId, getId, getChildrenFn, setChildrenFn);
    if (!removed) return data;
    return this.insertIntoTree(remaining, removed, targetId, event.position, getId, getChildrenFn, setChildrenFn);
  }

  private removeFromTree(
    nodes: T[], rowId: string, getId: (r: T) => string,
    getChildrenFn: (r: T) => T[] | undefined, setChildrenFn: (r: T, c: T[]) => T
  ): { remaining: T[]; removed: T | null } {
    const idx = nodes.findIndex(n => getId(n) === rowId);
    if (idx !== -1) {
      return { remaining: [...nodes.slice(0, idx), ...nodes.slice(idx + 1)], removed: nodes[idx] };
    }
    for (let i = 0; i < nodes.length; i++) {
      const children = getChildrenFn(nodes[i]);
      if (children && children.length > 0) {
        const result = this.removeFromTree(children, rowId, getId, getChildrenFn, setChildrenFn);
        if (result.removed) {
          const updated = [...nodes];
          updated[i] = setChildrenFn(nodes[i], result.remaining);
          return { remaining: updated, removed: result.removed };
        }
      }
    }
    return { remaining: nodes, removed: null };
  }

  private insertIntoTree(
    nodes: T[], movedRow: T, targetId: string, position: RowDragPosition,
    getId: (r: T) => string, getChildrenFn: (r: T) => T[] | undefined, setChildrenFn: (r: T, c: T[]) => T
  ): T[] {
    if (position === 'on') {
      return nodes.map(n => {
        if (getId(n) === targetId) {
          return setChildrenFn(n, [...(getChildrenFn(n) ?? []), movedRow]);
        }
        const kids = getChildrenFn(n);
        return kids?.length ? setChildrenFn(n, this.insertIntoTree(kids, movedRow, targetId, position, getId, getChildrenFn, setChildrenFn)) : n;
      });
    }

    const result: T[] = [];
    for (const n of nodes) {
      if (getId(n) === targetId) {
        if (position === 'above') result.push(movedRow, n);
        else result.push(n, movedRow);
      } else {
        const kids = getChildrenFn(n);
        result.push(kids?.length ? setChildrenFn(n, this.insertIntoTree(kids, movedRow, targetId, position, getId, getChildrenFn, setChildrenFn)) : n);
      }
    }
    return result;
  }

  private buildRowReorderEvent(): RowReorderEvent<T> | null {
    const draggedId = this.draggedRowId();
    const overIdx = this.dragOverIndex();
    const position = this.dragOverPosition();
    if (!draggedId || overIdx === null) return null;

    const getId = this.getRowId();
    const data = this.processedData();
    const fromIndex = data.findIndex(r => getId(r) === draggedId);
    if (fromIndex === -1) return null;

    const targetRow = data[overIdx];
    if (!targetRow) return null;

    const toIndex = this.computeDropIndex(overIdx, fromIndex, position);
    const { previousId, nextId } = this.resolveDropNeighborIds(data, toIndex, fromIndex, getId);

    const result: RowReorderEvent<T> = {
      row: data[fromIndex],
      targetRow,
      position,
      previousId,
      nextId,
      fromIndex,
      toIndex: Math.max(0, toIndex),
    };

    if (position === 'on' && this.rowDragMode() === 'tree') {
      result.parentId = getId(targetRow);
    }

    return result;
  }

  private computeDropIndex(overIdx: number, fromIndex: number, position: RowDragPosition): number {
    let toIndex = position === 'above' ? overIdx : overIdx + 1;
    if (fromIndex < toIndex) toIndex -= 1;
    return toIndex;
  }

  private resolveDropNeighborIds(
    data: T[], toIndex: number, fromIndex: number, getId: (row: T) => string
  ): { previousId: string | null; nextId: string | null } {
    const prevIdx = toIndex > fromIndex ? toIndex : toIndex - 1;
    const nextIdx = toIndex >= fromIndex ? toIndex + 1 : toIndex;
    const previousRow = prevIdx >= 0 ? data[prevIdx] : null;
    const nextRow = nextIdx < data.length ? data[nextIdx] : null;
    return {
      previousId: previousRow ? getId(previousRow) : null,
      nextId: nextRow ? getId(nextRow) : null,
    };
  }

  onRowDragEnd(): void {
    this.clearRowDragState();
  }

  private clearRowDragState(): void {
    this.draggedRowId.set(null);
    this.dragOverIndex.set(null);
    cancelAnimationFrame(this.dragAutoScrollId);
    this._document.removeEventListener('wheel', this.dragWheelHandler, { capture: true } as EventListenerOptions);
    this._document.removeEventListener('drag', this.dragEventHandler);
  }

  isRowBeingDragged(row: T): boolean {
    return this.draggedRowId() === this.getRowId()(row);
  }

  getDropEdge(index: number): 'top' | 'bottom' | 'on' | null {
    const overIdx = this.dragOverIndex();
    if (overIdx === null || !this.draggedRowId()) return null;
    if (overIdx !== index) return null;
    const pos = this.dragOverPosition();
    if (pos === 'on') return 'on';
    return pos === 'above' ? 'top' : 'bottom';
  }

  private resizingColumn: CellStyleColumn | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private resizeOldWidth = "auto";

  onResizeStart(event: MouseEvent, col: CellStyleColumn) {
    event.preventDefault();
    event.stopPropagation();
    this.startResize(event.clientX, col);
  }

  onResizeTouchStart(event: TouchEvent, col: CellStyleColumn) {
    if (event.touches.length === 1) {
      event.preventDefault();
      event.stopPropagation();
      this.startResize(event.touches[0].clientX, col);
    }
  }

  private startResize(clientX: number, col: CellStyleColumn) {
    const key = String(col.accessorKey);
    this.resizingColumn = col;
    this.resizeStartX = clientX;
    const actualWidth = this.getColumnActualWidth(key);
    this.resizeStartWidth = Number.parseInt(col._width, 10) || actualWidth || 150;
    this.resizeOldWidth = this.columnWidths()[key] || col._width || "auto";
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
      this._document.removeEventListener("mousemove", onMouseMove);
      this._document.removeEventListener("mouseup", onEnd);
      this._document.removeEventListener("touchmove", onTouchMove);
      this._document.removeEventListener("touchend", onEnd);
      this._document.body.style.cursor = "";
      this._document.body.style.userSelect = "";
    };

    this._document.body.style.cursor = "col-resize";
    this._document.body.style.userSelect = "none";

    this._document.addEventListener("mousemove", onMouseMove);
    this._document.addEventListener("mouseup", onEnd);
    this._document.addEventListener("touchmove", onTouchMove, { passive: false });
    this._document.addEventListener("touchend", onEnd);
  }

  private onResizeMove(clientX: number) {
    if (!this.resizingColumn) return;

    const delta = clientX - this.resizeStartX;
    const effectiveDelta = this._isRtlResize ? -delta : delta;
    const minWidth = Number.parseInt(this.resizingColumn._minWidth || "50", 10) || 50;
    const newWidth = Math.max(minWidth, this.resizeStartWidth + effectiveDelta);
    const key = String(this.resizingColumn.accessorKey);

    this.columnWidths.update((widths) => ({
      ...widths,
      [key]: `${newWidth}px`,
    }));
  }

  private onResizeEnd() {
    if (this.resizingColumn) {
      const key = String(this.resizingColumn.accessorKey);
      const newWidth = this.columnWidths()[key] || this.resizeOldWidth;

      this.columnResize.emit({
        columnKey: key,
        oldWidth: this.resizeOldWidth,
        newWidth,
      });

      this.resizingColumn = null;
    }
  }

  /**
   * Gets the actual rendered width of a column in pixels.
   * Useful for auto columns that don't have a fixed width.
   */
  private getColumnActualWidth(columnKey: string): number | null {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return null;

    const headerCell = container.querySelector(
      `[data-column="${columnKey}"]`
    ) as HTMLElement | null;
    if (headerCell) {
      return headerCell.offsetWidth;
    }
    return null;
  }

  scrollToRow(index: number): void {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;

    if (this.virtualVariableRowHeight()) {
      const prefixSums = this._prefixSums();
      if (prefixSums && index < prefixSums.length) {
        container.scrollTop = prefixSums[index];
        return;
      }
    }

    container.scrollTop = index * this.virtualRowHeight();
  }

  scrollToColumn(columnKey: string): void {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;

    const cols = this.scrollableColumns();
    const widths = this.scrollableColumnWidths();
    const colIndex = cols.findIndex((c) => String(c.accessorKey) === columnKey);
    if (colIndex === -1) return;

    let offset = 0;
    for (let i = 0; i < colIndex; i++) {
      offset += widths[i];
    }

    container.scrollLeft = offset;
  }

  scrollToCell(rowIndex: number, columnKey: string): void {
    this.scrollToRow(rowIndex);
    this.scrollToColumn(columnKey);
  }
}
