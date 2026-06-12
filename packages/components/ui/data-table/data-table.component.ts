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
import { cn, isRtl, stringifyValue } from "../../lib/utils";
import { createLocaleBindings, interpolate, provideComponentLocale, type LocaleInput } from "../../lib/i18n";
import { DATA_TABLE_LOCALES, type DataTableLocale } from "./data-table.locales";
import { generateXlsx } from "../../lib/parsers/xlsx";
import {
  TableComponent,
  TableHeaderComponent,
  TableBodyComponent,
  TableRowComponent,
  TableHeadComponent,
  TableCellComponent,
} from "../table";
import { InputComponent } from "../input";
import { CheckboxComponent } from "../checkbox";
import {
  PopoverComponent,
  PopoverTriggerComponent,
  PopoverContentComponent,
} from "../popover";
import { DataTableColumnHeaderComponent } from "./sub/data-table-column-header.component";
import { DataTablePaginationComponent } from "./sub/data-table-pagination.component";
import { UiComponentOutletDirective } from "../component-outlet.directive";
import {
  ContextMenuComponent,
  ContextMenuItem,
} from "../context-menu";
import { ButtonComponent } from "../button";
import { IconComponent } from "../icon";
import { SkeletonComponent } from "../skeleton";
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
  CellEditErrorEvent,
  EditingCell,
  CellEditError,
  RowReorderEvent,
  RowDragPosition,
  CellRange,
  CellFlashDirection,
  CellStyleColumn,
  GroupRow,
  DataTableDisplayRow,
} from "./data-table.types";
import {
  computeRowRange,
  computeColumnRange,
  computeVariableRowRange,
  buildPrefixSums,
  partitionIntoGroups,
} from "./data-table.utils";
import { ComponentPoolService } from "../../lib/component-pool.service";

const EMPTY_RECORD: Readonly<Record<string, never>> = Object.freeze({});

/** Per-instance counter for unique element ids (e.g. inline edit-error links). */
let dataTableUid = 0;

const DEFAULT_GET_ROW_ID = <T>(row: T): string => {
  const rec = row as Record<string, unknown>;
  const id = rec['id'];
  if (id == null) return JSON.stringify(row);
  return stringifyValue(id);
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
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    ComponentPoolService,
    provideComponentLocale(() => DataTableComponent),
  ],
  host: {
    class: "block h-full w-full",
    '[attr.dir]': 'dir()',
  },
  templateUrl: './data-table.component.html',
})
export class DataTableComponent<T> implements AfterViewInit, OnDestroy {
  protected readonly EMPTY_RECORD = EMPTY_RECORD;
  private readonly _document = inject(DOCUMENT);
  private readonly _el = inject(ElementRef);
  isRtl(): boolean {
    return isRtl(this._el.nativeElement);
  }
  private _isRtlResize = false;

  readonly data = model.required<T[]>();
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
  readonly skeleton = input(false);
  readonly skeletonRows = input(5);
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
  readonly editError = output<CellEditErrorEvent<T>>();
  readonly editingCell = signal<EditingCell | null>(null);
  readonly editValue = signal<unknown>(null);
  readonly cellEditError = signal<CellEditError | null>(null);
  /** Stable id for the inline edit-error message, linked via `aria-describedby`. */
  readonly cellEditErrorId = `ui-data-table-cell-edit-error-${dataTableUid++}`;

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

  /**
   * Group rows by this column accessorKey. Renders collapsible group headers
   * with per-group aggregation. Mutually exclusive with `enableSubRows` and
   * virtual scroll (ignored, with a console warning, when combined). In grouped
   * mode inline cell editing, cell-range selection, keyboard cell-nav, and row
   * drag are disabled.
   */
  readonly groupBy = input<string | undefined>();
  /** Per-group collapsed state, keyed by the stringified group value. */
  readonly collapsedGroups = model<Record<string, boolean>>({});
  /** When true, group header rows display per-column aggregate values. */
  readonly groupAggregates = input<boolean>(true);

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

  /**
   * Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when
   * not set. The DataTableLocale covers data-table chrome (filter
   * placeholder, columns menu, sort/pin actions, pagination labels,
   * etc.). Date filters embedded in the table still read from
   * `CalendarLocale` separately.
   */
  readonly locale = input<LocaleInput<DataTableLocale>>();
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
  private filterAnnounceTimer: ReturnType<typeof setTimeout> | undefined;
  private viewportObserver?: ResizeObserver;
  private readonly rowResizeObserver?: ResizeObserver;

  readonly scrollContainerRef =
    viewChild<ElementRef<HTMLElement>>("scrollContainer");
  readonly virtualRowElements = viewChildren("virtualRow", {
    read: ElementRef,
  });

  readonly skeletonRowsArray = computed(() => new Array(this.skeletonRows()));

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
      const w = widths[key] ?? col._width ?? col.width ?? "auto";
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

  private readonly i18n = createLocaleBindings(this.locale, DATA_TABLE_LOCALES);
  /**
   * Resolved DataTableLocale for the table chrome (column menu, filters,
   * pagination). Protected — internal template binding only; consumer
   * components should set their own `locale` input.
   */
  protected readonly t = this.i18n.t;
  /** `'rtl'` when the active locale is RTL, otherwise `null` — bind to `[attr.dir]`. */
  readonly dir = this.i18n.dir;

  // Chrome label computeds — each carries an English fallback so a consumer
  // who passes a partial custom DataTableLocale (via an `as` cast or
  // dynamic translation source) sees the prior baseline rather than the
  // literal string "undefined" reaching the template or pagination child.
  readonly filterPlaceholder = computed(() => this.t().filterPlaceholder ?? 'Filter...');
  readonly columnsLabel = computed(() => this.t().columnsLabel ?? 'Columns');
  readonly noResultsLabel = computed(() => this.t().noResultsLabel ?? 'No results found.');
  readonly rowsPerPageLabel = computed(() => this.t().rowsPerPageLabel ?? 'Rows per page');
  readonly pageLabel = computed(() => this.t().pageLabel ?? 'Page');
  readonly ofLabel = computed(() => this.t().ofLabel ?? 'of');
  readonly toggleColumnsLabel = computed(() => this.t().toggleColumns ?? 'Toggle columns');

  /**
   * Build the localised `Toggle X column` aria-label for the
   * column-visibility checkbox. Guards against a missing dictionary key
   * (which would otherwise crash `interpolate(undefined, …)`).
   */
  toggleColumnAriaLabel(columnHeader: string): string {
    const template = this.t().toggleColumnAriaLabel ?? 'Toggle {column} column';
    return interpolate(template, { column: columnHeader });
  }

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
  /** Visually-hidden live-region text announcing sort/filter changes to AT. */
  readonly srAnnouncement = signal("");
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
        const filterFn = column.filterFn;
        data = data.filter((row) => filterFn(row, filterValue));
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

  private treeIndex_walk(
    rows: T[],
    parentId: string | null,
    childrenMap: Map<string, string[]>,
    parentMap: Map<string, string>,
    getId: (row: T) => string,
    getChildrenFn: (row: T) => T[] | null | undefined,
  ): void {
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
        this.treeIndex_walk(kids, id, childrenMap, parentMap, getId, getChildrenFn);
      } else {
        childrenMap.set(id, []);
      }
    }
  }

  private treeIndex_getDescendants(
    id: string,
    childrenMap: Map<string, string[]>,
    descendantsMap: Map<string, string[]>,
  ): string[] {
    const cached = descendantsMap.get(id);
    if (cached !== undefined) return cached;
    const kids = childrenMap.get(id) ?? [];
    const all: string[] = [];
    for (const kid of kids) {
      all.push(kid, ...this.treeIndex_getDescendants(kid, childrenMap, descendantsMap));
    }
    descendantsMap.set(id, all);
    return all;
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

    this.treeIndex_walk(this.data(), null, childrenMap, parentMap, getId, getChildrenFn);

    for (const id of childrenMap.keys()) {
      this.treeIndex_getDescendants(id, childrenMap, descendantsMap);
    }

    return {
      children: childrenMap,
      descendants: descendantsMap,
      parent: parentMap,
    };
  });

  private filteredTree_matchesGlobal(
    row: T,
    globalFilterValue: string,
    columns: ColumnDef<T>[],
  ): boolean {
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
  }

  private filteredTree_matchesColumns(
    row: T,
    colFilters: Record<string, unknown>,
    columns: ColumnDef<T>[],
  ): boolean {
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
  }

  private filteredTree_matchesRow(
    row: T,
    ctx: { hasGlobalFilter: boolean; globalFilterValue: string; hasColumnFilters: boolean; colFilters: Record<string, unknown>; columns: ColumnDef<T>[] },
  ): boolean {
    if (ctx.hasGlobalFilter && !this.filteredTree_matchesGlobal(row, ctx.globalFilterValue, ctx.columns)) return false;
    if (ctx.hasColumnFilters && !this.filteredTree_matchesColumns(row, ctx.colFilters, ctx.columns)) return false;
    return true;
  }

  private filteredTree_pushChildMatch(
    result: T[],
    row: T,
    filteredKids: T[],
    setChildrenFn: (row: T, children: T[]) => T,
  ): void {
    if (filteredKids.length > 0) {
      result.push(setChildrenFn(row, filteredKids));
    }
  }

  private filteredTree_filterIncludeChildren(
    rows: T[],
    ctx: { hasGlobalFilter: boolean; globalFilterValue: string; hasColumnFilters: boolean; colFilters: Record<string, unknown>; columns: ColumnDef<T>[]; mode: string; getChildrenFn: (row: T) => T[] | null | undefined; setChildrenFn: (row: T, children: T[]) => T },
  ): T[] {
    const result: T[] = [];
    for (const row of rows) {
      if (this.filteredTree_matchesRow(row, ctx)) {
        result.push(row);
      } else {
        const children = ctx.getChildrenFn(row);
        if (children && children.length > 0) {
          const filteredKids = this.filteredTree_filterTree(children, ctx);
          this.filteredTree_pushChildMatch(result, row, filteredKids, ctx.setChildrenFn);
        }
      }
    }
    return result;
  }

  private filteredTree_filterIncludeParents(
    rows: T[],
    ctx: { hasGlobalFilter: boolean; globalFilterValue: string; hasColumnFilters: boolean; colFilters: Record<string, unknown>; columns: ColumnDef<T>[]; mode: string; getChildrenFn: (row: T) => T[] | null | undefined; setChildrenFn: (row: T, children: T[]) => T },
  ): T[] {
    const result: T[] = [];
    for (const row of rows) {
      const children = ctx.getChildrenFn(row);
      const selfMatches = this.filteredTree_matchesRow(row, ctx);

      if (children && children.length > 0) {
        const filteredKids = this.filteredTree_filterTree(children, ctx);
        if (selfMatches || filteredKids.length > 0) {
          result.push(ctx.setChildrenFn(row, filteredKids));
        }
      } else if (selfMatches) {
        result.push(row);
      }
    }
    return result;
  }

  private filteredTree_filterTree(
    rows: T[],
    ctx: { hasGlobalFilter: boolean; globalFilterValue: string; hasColumnFilters: boolean; colFilters: Record<string, unknown>; columns: ColumnDef<T>[]; mode: string; getChildrenFn: (row: T) => T[] | null | undefined; setChildrenFn: (row: T, children: T[]) => T },
  ): T[] {
    if (ctx.mode === "excludeChildren") {
      return rows.filter(r => this.filteredTree_matchesRow(r, ctx));
    }
    if (ctx.mode === "includeChildren") {
      return this.filteredTree_filterIncludeChildren(rows, ctx);
    }
    return this.filteredTree_filterIncludeParents(rows, ctx);
  }

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

    const ctx = {
      hasGlobalFilter,
      globalFilterValue,
      hasColumnFilters,
      colFilters,
      columns,
      mode: this.subRowFilterMode(),
      getChildrenFn: this.getChildren(),
      setChildrenFn: this.setChildren(),
    };

    return this.filteredTree_filterTree(this.data(), ctx);
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
    if (this.groupingActive()) {
      return this.localPagination()
        ? this.groupedDisplayRows().length
        : this.total();
    }
    if (this.enableSubRows()) {
      if (!this.localPagination()) return this.total();
      if (this.subRowsPaginated()) {
        return this.visibleTreeRows().length;
      }
      return this.sortedTreeData().length;
    }
    return this.localPagination() ? this.filteredData().length : this.total();
  });

  /**
   * True when grouping should drive rendering: a `groupBy` column is set and
   * neither tree mode nor virtual scroll is active.
   */
  readonly groupingActive = computed(
    () =>
      !!this.groupBy() &&
      !this.enableSubRows() &&
      !this.isVirtualScrollActive(),
  );

  private readonly groupByColumn = computed(() => {
    const key = this.groupBy();
    if (!key) return undefined;
    return this.enhancedColumns().find(
      (col) => String(col.accessorKey) === key,
    );
  });

  /**
   * Flat display list of group-header rows and their (non-collapsed) data
   * rows, partitioned from `sortedData()` in insertion order. Empty when
   * grouping is not active.
   */
  readonly groupedDisplayRows = computed<DataTableDisplayRow<T>[]>(() => {
    if (!this.groupingActive()) return [];
    const key = this.groupBy();
    if (!key) return [];

    const column = this.groupByColumn();
    const collapsedMap = this.collapsedGroups();
    const groups = partitionIntoGroups(this.sortedData(), (row) =>
      this.getCellValue(row, key, column),
    );

    const result: DataTableDisplayRow<T>[] = [];
    for (const group of groups) {
      const collapsed = collapsedMap[group.groupKey] === true;
      result.push(this.buildGroupRow(group.groupKey, group.groupValue, group.rows, collapsed));
      if (!collapsed) {
        for (const row of group.rows) {
          result.push({ kind: 'data', row });
        }
      }
    }
    return result;
  });

  private buildGroupRow(
    groupKey: string,
    groupValue: unknown,
    rows: T[],
    collapsed: boolean,
  ): GroupRow {
    const aggregates = new Map<string, string>();
    if (this.groupAggregates()) {
      for (const col of this.enhancedColumns()) {
        if (col.aggregateFn) {
          aggregates.set(String(col.accessorKey), this.computeAggregate(rows, col));
        }
      }
    }
    return {
      kind: 'group',
      groupKey,
      groupValue,
      count: rows.length,
      aggregates,
      collapsed,
    };
  }

  /**
   * `keyvalue` pipe comparator that preserves the Map's insertion order.
   * The group aggregates Map is built in `enhancedColumns()` order, so this
   * keeps the group-header aggregate chips aligned with the column order
   * instead of the pipe's default alphabetical key sort.
   */
  protected readonly keepGroupAggregateOrder = (): number => 0;

  /**
   * `groupedDisplayRows()` sliced for the current page when local pagination
   * is enabled. Group header rows count toward the page size.
   */
  readonly pagedGroupedDisplayRows = computed<DataTableDisplayRow<T>[]>(() => {
    const rows = this.groupedDisplayRows();
    if (!this.localPagination()) return rows;
    const { pageIndex, pageSize } = this.paginationState();
    const start = pageIndex * pageSize;
    return rows.slice(start, start + pageSize);
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

  private setupCellFlashEffect(): void {
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
  }

  private setupPaginationEffect(): void {
    effect(() => {
      if (!this.localPagination()) {
        return;
      }

      const { pageIndex, pageSize } = this.paginationState();
      const sanitizedPageSize = pageSize > 0 ? pageSize : 10;
      const totalItems = this.groupingActive()
        ? this.groupedDisplayRows().length
        : this.filteredData().length;
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
  }

  constructor() {
    this.setupCellFlashEffect();
    this.setupPaginationEffect();

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
          this.rowResizeObserver?.unobserve(el);
        }
      }
      for (const el of newSet) {
        if (!this.observedElements.has(el)) {
          this.rowResizeObserver?.observe(el);
        }
      }
      this.observedElements = newSet;
    });
  }

  ngAfterViewInit(): void {
    this.setupViewportObserver();
    this.validateConfiguration();
  }

  private checkPaginationVsVirtualScroll(warnings: string[]): void {
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
  }

  private checkServerPaginationTotal(warnings: string[]): void {
    if (!this.localPagination() && this.total() === 0 && this.data().length > 0) {
      warnings.push(
        '[ui-data-table] Using server-side pagination (localPagination=false) ' +
          'without providing [total]. Pagination may not work correctly.'
      );
    }
  }

  private checkVirtualVariableRowHeight(warnings: string[]): void {
    if (this.virtualVariableRowHeight() && !this.isVirtualScrollActive()) {
      warnings.push(
        '[ui-data-table] virtualVariableRowHeight is enabled but virtual scroll ' +
          'is not active. This option has no effect.'
      );
    }
  }

  private checkVirtualRecycleComponents(warnings: string[]): void {
    if (this.virtualRecycleComponents() && !this.isVirtualScrollActive()) {
      warnings.push(
        '[ui-data-table] virtualRecycleComponents is enabled but virtual scroll ' +
          'is not active. This option has no effect.'
      );
    }
  }

  private checkVirtualScrollAutoWithPagination(warnings: string[]): void {
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
  }

  private checkSubRowsWithExpansion(warnings: string[]): void {
    if (this.enableSubRows() && this.enableRowExpansion()) {
      warnings.push(
        '[ui-data-table] Both enableSubRows and enableRowExpansion are enabled. ' +
          'This creates two separate expander controls per row (tree toggle + detail panel). ' +
          'If this is unintentional, disable one of them.'
      );
    }
  }

  private checkGroupByConflicts(warnings: string[]): void {
    if (this.groupBy() && (this.enableSubRows() || this.isVirtualScrollActive())) {
      warnings.push(
        '[ui-data-table] groupBy is set together with enableSubRows or virtual scroll. ' +
          'Row grouping is mutually exclusive with these features and will be ignored.'
      );
    }
  }

  private checkSubRowsGetRowId(warnings: string[], isDefaultGetRowId: boolean): void {
    if (this.enableSubRows() && isDefaultGetRowId) {
      warnings.push(
        '[ui-data-table] enableSubRows is active with the default getRowId. ' +
          'The default uses JSON.stringify as fallback, which produces unstable IDs for tree data. ' +
          'Provide a custom [getRowId] function that returns a stable unique identifier.'
      );
    }
  }

  private checkCellFlashGetRowId(warnings: string[], isDefaultGetRowId: boolean): void {
    if (this.enableCellFlash() && isDefaultGetRowId) {
      warnings.push(
        '[ui-data-table] enableCellFlash is active with the default getRowId. ' +
          'Cell flash detection requires stable row IDs across data updates. ' +
          'Provide a custom [getRowId] function.'
      );
    }
  }

  private checkFloatingFiltersConfig(warnings: string[], cols: ColumnDef<T>[]): void {
    if (this.enableFloatingFilters() && !cols.some((c) => c.enableFiltering)) {
      warnings.push(
        '[ui-data-table] enableFloatingFilters is true but no columns have enableFiltering set. ' +
          'The floating filter row will be empty.'
      );
    }
  }

  private checkEditableColumnsHaveValueSetter(warnings: string[], cols: ColumnDef<T>[]): void {
    const editableCols = cols.filter((c) => c.editable && !c.valueSetter);
    if (editableCols.length > 0) {
      const keys = editableCols.map((c) => String(c.accessorKey)).join(', ');
      warnings.push(
        `[ui-data-table] Columns [${keys}] have editable=true but no valueSetter. ` +
          'Inline edits will emit (cellEdit) only and will not update the table data. ' +
          'Provide a valueSetter to apply edits immutably, or handle (cellEdit) yourself.'
      );
    }
  }

  private checkDuplicateAccessorKeys(warnings: string[], cols: ColumnDef<T>[]): void {
    const accessorKeys = cols.map((c) => String(c.accessorKey)).filter((k) => k !== 'undefined');
    const duplicates = accessorKeys.filter((k, i) => accessorKeys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      const unique = [...new Set(duplicates)];
      warnings.push(
        `[ui-data-table] Duplicate accessorKey values found: [${unique.join(', ')}]. ` +
          'Each column must have a unique accessorKey. Duplicates cause broken sorting, visibility, and width tracking.'
      );
    }
  }

  private checkStickyAndPinConflicts(warnings: string[], cols: ColumnDef<T>[]): void {
    const stickyAndPinned = cols.filter((c) => c.sticky && c.pin);
    if (stickyAndPinned.length > 0) {
      const keys = stickyAndPinned.map((c) => String(c.accessorKey)).join(', ');
      warnings.push(
        `[ui-data-table] Columns [${keys}] have both sticky and pin set. ` +
          'Use pin="left" instead of sticky=true. sticky is deprecated in favor of pin.'
      );
    }
  }

  private checkMultipleRenderStrategies(warnings: string[], cols: ColumnDef<T>[]): void {
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
  }

  /**
   * Validates configuration and logs warnings for conflicting options in development mode.
   */
  private validateConfiguration(): void {
    if (!(globalThis as { ngDevMode?: unknown }).ngDevMode) return;

    const warnings: string[] = [];
    const isDefaultGetRowId = this.getRowId() === DEFAULT_GET_ROW_ID;
    const cols = this.columns();

    this.checkPaginationVsVirtualScroll(warnings);
    this.checkServerPaginationTotal(warnings);
    this.checkVirtualVariableRowHeight(warnings);
    this.checkVirtualRecycleComponents(warnings);
    this.checkVirtualScrollAutoWithPagination(warnings);
    this.checkSubRowsWithExpansion(warnings);
    this.checkGroupByConflicts(warnings);
    this.checkSubRowsGetRowId(warnings, isDefaultGetRowId);
    this.checkCellFlashGetRowId(warnings, isDefaultGetRowId);
    this.checkFloatingFiltersConfig(warnings, cols);
    this.checkEditableColumnsHaveValueSetter(warnings, cols);
    this.checkDuplicateAccessorKeys(warnings, cols);
    this.checkStickyAndPinConflicts(warnings, cols);
    this.checkMultipleRenderStrategies(warnings, cols);

    for (const warning of warnings) {
      console.error(warning);
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.filterDebounceTimer);
    clearTimeout(this.filterAnnounceTimer);
    this.flashTimers.forEach((t) => clearTimeout(t));
    this._document.removeEventListener('wheel', this.dragWheelHandler, { capture: true });
    this._document.removeEventListener('drag', this.dragEventHandler);
    this.viewportObserver?.disconnect();
    this.rowResizeObserver?.disconnect();
  }

  private setupViewportObserver(): void {
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

  onVirtualScroll(event: Event): void {
    if (this.suppressScrollEvents) return;
    const el = event.target as HTMLElement;
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.virtualScrollTop.set(el.scrollTop);
      this.virtualScrollLeft.set(el.scrollLeft);
    });
  }

  private handleRowResizes(entries: ResizeObserverEntry[]): void {
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

  /** ARIA `aria-sort` value for a header cell — `null` for non-sortable columns. */
  getAriaSort(
    col: ColumnDef<T>,
  ): "ascending" | "descending" | "none" | null {
    const key = String(col.accessorKey);
    const isSpecialColumn =
      key === "_selection" || key === "_actions" || key === "_expander";
    if (isSpecialColumn || col.enableSorting === false) {
      return null;
    }
    const direction = this.getSortDirection(col.accessorKey);
    if (direction === "asc") return "ascending";
    if (direction === "desc") return "descending";
    return "none";
  }

  private columnHeaderLabel(columnKey: string): string {
    const col = this.enhancedColumns().find(
      (c) => String(c.accessorKey) === columnKey,
    );
    return col?.header || columnKey;
  }

  /**
   * Announces a sort change. Called before the sort state mutates, so
   * `getSortDirection` still reflects the previous state — used to skip a
   * spurious "removed" announcement when the column was not sorted.
   */
  private announceSortChange(columnKey: string, direction: SortDirection): void {
    const label = this.columnHeaderLabel(columnKey);
    if (direction === "asc") {
      this.srAnnouncement.set(`Table sorted by ${label}, ascending`);
    } else if (direction === "desc") {
      this.srAnnouncement.set(`Table sorted by ${label}, descending`);
    } else if (this.getSortDirection(columnKey) !== null) {
      this.srAnnouncement.set(`Sorting removed from ${label}`);
    }
  }

  private announceFilterChange(value: string): void {
    clearTimeout(this.filterAnnounceTimer);
    this.filterAnnounceTimer = setTimeout(() => {
      if (!value.trim()) {
        this.srAnnouncement.set("Filter cleared, showing all rows");
        return;
      }
      const count = this.filteredData().length;
      const noun = count === 1 ? "result" : "results";
      this.srAnnouncement.set(`${count} ${noun} found for "${value}"`);
    }, 500);
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
  ): void {
    this.loadingTrigger.set("sorting");
    const key = String(columnKey);
    this.announceSortChange(key, direction);
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

  private resolveColumnPinState(
    col: ColumnDef<T>,
    key: string,
    pinOverrides: Record<string, 'left' | 'right' | undefined>,
  ): { isPinnedLeft: boolean; isPinnedRight: boolean; isPinned: boolean; isStickyLeft: boolean; pin: string | undefined } {
    const resolvedPin = key in pinOverrides ? pinOverrides[key] : col.pin;
    const isSticky = col.sticky === true;
    const isPinnedLeft = resolvedPin === "left";
    const isPinnedRight = resolvedPin === "right";
    const isPinned = isPinnedLeft || isPinnedRight || isSticky;
    const isStickyLeft = isSticky || isPinnedLeft;
    let pin: string | undefined;
    if (isPinnedRight) pin = "right";
    else if (isStickyLeft) pin = "left";
    return { isPinnedLeft, isPinnedRight, isPinned, isStickyLeft, pin };
  }

  private buildEnhancedColumn(
    col: ColumnDef<T>,
    index: number,
    widths: Record<string, string>,
    pinOverrides: Record<string, 'left' | 'right' | undefined>,
    rightOffsets: Map<number, number>,
    currentLeft: number,
  ): { column: ColumnDef<T> & { _stickyLeft?: number; _stickyRight?: number; _pin?: string; _width: string; _minWidth: string }; nextLeft: number } {
    const DEFAULT_PINNED_WIDTH = 150;
    const key = String(col.accessorKey);
    const { isPinnedRight, isPinned, isStickyLeft, pin } = this.resolveColumnPinState(col, key, pinOverrides);
    const widthStr = widths[key] ?? col.width ?? (isPinned ? `${DEFAULT_PINNED_WIDTH}px` : "auto");
     
    const widthVal = Number.parseInt(widthStr, 10) || DEFAULT_PINNED_WIDTH;

    const column = {
      ...col,
      _stickyLeft: isStickyLeft ? currentLeft : undefined,
      _stickyRight: isPinnedRight ? (rightOffsets.get(index) ?? 0) : undefined,
      _pin: pin,
      _width: widthStr,
      _minWidth: col.minWidth ?? "50px",
    };

    return { column, nextLeft: isStickyLeft ? currentLeft + widthVal : currentLeft };
  }

  private computeRightOffsets(cols: ColumnDef<T>[], widths: Record<string, string>): Map<number, number> {
    const DEFAULT_PINNED_WIDTH = 150;
    let currentRight = 0;
    const rightOffsets = new Map<number, number>();
    for (let i = cols.length - 1; i >= 0; i -= 1) {
      const col = cols[i];
      const key = String(col.accessorKey);
      const widthStr = widths[key] ?? col.width;
      const widthVal = Number.parseInt(widthStr, 10) || DEFAULT_PINNED_WIDTH;
      if (col.pin === "right") {
        rightOffsets.set(i, currentRight);
        currentRight += widthVal;
      }
    }
    return rightOffsets;
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
    const rightOffsets = this.computeRightOffsets(computedCols, widths);

    const pinOverrides = this.columnPinOverrides();
    const result: ReturnType<typeof this.buildEnhancedColumn>['column'][] = [];
    for (const [index, col] of computedCols.entries()) {
      const { column, nextLeft } = this.buildEnhancedColumn(col, index, widths, pinOverrides, rightOffsets, currentLeft);
      currentLeft = nextLeft;
      result.push(column);
    }
    return result;
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

  getHeaderClass(col: CellStyleColumn): string {
    return (
      this._headerClassMap().get(String(col.accessorKey)) ??
      this._fillerHeaderClass()
    );
  }

  getCellClass(col: CellStyleColumn, rowIndex?: number, treeDepth?: number): string {
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

  private _applyPinStyle(style: Record<string, string>, col: CellStyleColumn, isHeader: boolean): void {
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
  }

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

    this._applyPinStyle(style, col, isHeader);

    return style;
  }

  getHeaderCellStyle(col: CellStyleColumn): Record<string, string> {
    return (
      this._headerCellStyleMap().get(String(col.accessorKey)) ??
      this._buildCellStyle(col, true)
    );
  }

  getCellStyle(col: CellStyleColumn): Record<string, string> {
    return (
      this._cellStyleMap().get(String(col.accessorKey)) ??
      this._buildCellStyle(col, false)
    );
  }

  getTreeCellStyle(col: CellStyleColumn, depth: number): Record<string, string> {
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

  toggleRow(row: T): void {
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

  toggleRowExpanded(row: T, event?: Event): void {
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

  toggleAllExpanded(): void {
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

  toggleAll(): void {
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

  selectRows(rows: T[]): void {
    const getId = this.getRowId();
    const next = { ...this.rowSelection() };
    rows.forEach((row) => (next[getId(row)] = true));
    this.rowSelection.set(next);
  }

  unselectRows(rows: T[]): void {
    const getId = this.getRowId();
    const next = { ...this.rowSelection() };
    rows.forEach((row) => delete next[getId(row)]);
    this.rowSelection.set(next);
  }

  clearSelection(): void {
    this.rowSelection.set({});
  }

  selectAll(): void {
    const nextSelection = { ...this.rowSelection() };
    this.selectableRowIds().forEach((id) => {
      nextSelection[id] = true;
    });
    this.rowSelection.set(nextSelection);
  }

  onPaginationChange(state: PaginationState): void {
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

  onFilterChange(value: string): void {
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

  private applyGlobalFilter(value: string): void {
    this.globalFilter.set(value);
    this.paginationState.update((state) => ({ ...state, pageIndex: 0 }));
    this.filterChange.emit(value);
    this.announceFilterChange(value);
  }

  onColumnFilterChange(columnKey: string | keyof T, value: unknown): void {
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

  setColumnVisibility(columnKey: string | keyof T, visible: boolean): void {
    this.columnVisibility.update((current) => ({
      ...current,
      [String(columnKey)]: visible,
    }));
  }

  moveColumn(columnKey: string | keyof T, targetIndex: number): void {
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

  onColumnDragStart(event: DragEvent, col: ColumnDef<T>): void {
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

  onColumnDragOver(event: DragEvent, col: ColumnDef<T>): void {
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

  onColumnDrop(event: DragEvent, col: ColumnDef<T>): void {
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

  onColumnDragEnd(): void {
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

  applyColumnState(states: DataTableColumnState[]): void {
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

  setLoadingTrigger(trigger: DataTableLoadingTrigger): void {
    this.loadingTrigger.set(trigger);
  }

  getFilterInputs(col: ColumnDef<T>): Record<string, unknown> {
    if (typeof col.filterComponentInputs === "function") {
      return col.filterComponentInputs();
    }
    return col.filterComponentInputs ?? {};
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
      return value.start === null && value.end === null;
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
    if (typeof value === "object") {
      const fn = (value as { toString?: unknown }).toString;
      if (typeof fn === "function" && fn !== Object.prototype.toString) {
        return (fn as () => string).call(value);
      }
      return JSON.stringify(value);
    }
    return stringifyValue(value);
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
    const nextRow = rowIndex;
    const nextCol = colIndex;

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
    this.cellEditError.set(null);
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

    if (!this.validateEdit(col, row, newValue, editing)) {
      return;
    }

    this.cellEditError.set(null);
    this.cellEdit.emit({
      row,
      column: col,
      oldValue,
      newValue,
      rowIndex: editing.rowIndex,
    });
    this.applyValueSetter(col, row, newValue);

    this.editingCell.set(null);
    this.refocusTable();
  }

  /**
   * Runs the column's `editValidator`. On rejection, records the inline error
   * state and emits `editError`. Returns `true` when the edit may proceed.
   */
  private validateEdit(
    col: ColumnDef<T>,
    row: T,
    newValue: unknown,
    editing: EditingCell,
  ): boolean {
    if (!col.editValidator) return true;

    const result = col.editValidator(newValue, row);
    if (result === true) return true;

    const existing = this.cellEditError();
    const alreadyReported =
      existing !== null &&
      existing.rowIndex === editing.rowIndex &&
      existing.columnKey === editing.columnKey &&
      existing.value === newValue;
    if (alreadyReported) return false;

    const message = typeof result === 'string' ? result : 'Invalid value';
    this.cellEditError.set({
      rowIndex: editing.rowIndex,
      columnKey: editing.columnKey,
      value: newValue,
      message,
    });
    this.editError.emit({
      row,
      column: col,
      value: newValue,
      rowIndex: editing.rowIndex,
      message,
    });
    return false;
  }

  /**
   * Writes a committed edit back into the table data using the column's
   * `valueSetter`. `data` is a model, so the resulting array is published
   * to consumers and reflected by the table.
   */
  private applyValueSetter(col: ColumnDef<T>, row: T, newValue: unknown): void {
    if (!col.valueSetter) return;

    const updatedRow = col.valueSetter(row, newValue);
    const data = [...this.data()];
    const getId = this.getRowId();
    const dataIndex = data.findIndex((r) => getId(r) === getId(row));
    if (dataIndex !== -1) {
      data[dataIndex] = updatedRow;
      this.data.set(data);
    }
  }

  cancelEdit(): void {
    this.editingCell.set(null);
    this.editValue.set(null);
    this.cellEditError.set(null);
    this.refocusTable();
  }

  /** Returns the inline validation message for a cell, or `null` if valid. */
  editErrorFor(rowIndex: number, col: ColumnDef<T>): string | null {
    const err = this.cellEditError();
    if (
      err?.rowIndex === rowIndex &&
      err?.columnKey === String(col.accessorKey)
    ) {
      return err.message;
    }
    return null;
  }

  private refocusTable(): void {
    requestAnimationFrame(() => {
      this.scrollContainerRef()?.nativeElement?.focus();
    });
  }

  onEditValueChange(value: unknown): void {
    this.editValue.set(value);
    this.cellEditError.set(null);
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

  toggleSubRowExpanded(row: T, event?: Event): void {
    event?.stopPropagation();
    const id = this.getRowId()(row);
    const isCurrentlyExpanded = this.isSubRowExpanded(row);
    const next = { ...this.subRowExpandedRows() };
    next[id] = !isCurrentlyExpanded;
    this.subRowExpandedRows.set(next);
  }

  expandSubRow(row: T): void {
    const id = this.getRowId()(row);
    this.subRowExpandedRows.update((current) => ({ ...current, [id]: true }));
  }

  collapseSubRow(row: T): void {
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

  expandAllSubRows(toDepth?: number): void {
    const getId = this.getRowId();
    const getChildrenFn = this.getChildren();
    const next: Record<string, boolean> = {};
    const targetDepth = toDepth ?? -1;

    const walk = (rows: T[], depth: number): void => {
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

  collapseAllSubRows(): void {
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

  selectChildren(parentRow: T): void {
    const id = this.getRowId()(parentRow);
    const index = this.treeIndex();
    const descendantIds = index.descendants.get(id) ?? [];
    const next = { ...this.rowSelection() };
    descendantIds.forEach((did) => (next[did] = true));
    this.rowSelection.set(next);
  }

  deselectChildren(parentRow: T): void {
    const id = this.getRowId()(parentRow);
    const index = this.treeIndex();
    const descendantIds = index.descendants.get(id) ?? [];
    const next = { ...this.rowSelection() };
    descendantIds.forEach((did) => delete next[did]);
    this.rowSelection.set(next);
  }

  toggleRowWithCascade(row: T): void {
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

  private bubbleUpSelection(rowId: string, selection: Record<string, boolean>): void {
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
    ): void => {
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

  private reorderColumnsByKeys(sourceKey: string, targetKey: string): void {
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

  private clearColumnDragState(): void {
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

  onActionsButtonClick(event: Event, row: T, index: number): void {
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
    const t = this.t();

    const sortItems = this.buildSortMenuItems(key, col, currentSort);
    const pinItems = this.buildPinMenuItems(key, currentPin);
    const visibilityItems: ContextMenuItem[] = [
      ...(col.enableHiding === false ? [] : [{ label: t.hideColumn ?? 'Hide Column', icon: 'eye-off', click: () => this.setColumnVisibility(key, false) }]),
      { label: t.showAllColumns ?? 'Show All Columns', icon: 'eye', click: () => this.showAllColumns() },
    ];

    return [...sortItems, ...pinItems, ...visibilityItems];
  }

  private buildSortMenuItems(key: string, col: ColumnDef<T>, currentSort: SortDirection): ContextMenuItem[] {
    if (col.enableSorting === false) return [];
    const t = this.t();
    const items: ContextMenuItem[] = [
      { label: t.sortAscending ?? 'Sort Ascending', icon: 'arrow-up', disabled: currentSort === 'asc', click: () => this.onSortChange(key, 'asc') },
      { label: t.sortDescending ?? 'Sort Descending', icon: 'arrow-down', disabled: currentSort === 'desc', click: () => this.onSortChange(key, 'desc') },
    ];
    if (currentSort) {
      items.push({ label: t.clearSort ?? 'Clear Sort', icon: 'x', click: () => this.onSortChange(key, null) });
    }
    items.push({ type: 'separator' });
    return items;
  }

  private buildPinMenuItems(key: string, currentPin: string | undefined): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    const t = this.t();
    if (currentPin !== 'left') items.push({ label: t.pinLeft ?? 'Pin Left', icon: 'pin', click: () => this.pinColumn(key, 'left') });
    if (currentPin !== 'right') items.push({ label: t.pinRight ?? 'Pin Right', icon: 'pin', click: () => this.pinColumn(key, 'right') });
    if (currentPin) items.push({ label: t.unpin ?? 'Unpin', icon: 'pin-off', click: () => this.pinColumn(key, undefined) });
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

  /** Expands every group, clearing all collapsed-group state. */
  expandAllGroups(): void {
    this.collapsedGroups.set({});
  }

  /** Collapses every group in the current grouped display list. */
  collapseAllGroups(): void {
    const next: Record<string, boolean> = {};
    for (const displayRow of this.groupedDisplayRows()) {
      if (displayRow.kind === 'group') {
        next[displayRow.groupKey] = true;
      }
    }
    this.collapsedGroups.set(next);
  }

  /** Toggles the collapsed state of a single group by its key. */
  toggleGroupCollapsed(groupKey: string): void {
    this.collapsedGroups.update((state) => ({
      ...state,
      [groupKey]: !state[groupKey],
    }));
  }

  protected isGroupRow(
    displayRow: DataTableDisplayRow<T>,
  ): displayRow is GroupRow {
    return displayRow.kind === 'group';
  }

  protected groupTrackBy(displayRow: DataTableDisplayRow<T>): string {
    return displayRow.kind === 'group'
      ? `g:${displayRow.groupKey}`
      : `r:${this.getRowId()(displayRow.row)}`;
  }

  protected groupRowValueLabel(group: GroupRow): string {
    const value = group.groupValue;
    if (value === null || value === undefined) return '';
    return stringifyValue(value);
  }

  protected groupAggregateLabel(accessorKey: string): string {
    const column = this.enhancedColumns().find(
      (col) => String(col.accessorKey) === accessorKey,
    );
    return column?.header ?? accessorKey;
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

  private readonly dragWheelHandler = (e: WheelEvent): void => {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;
    e.preventDefault();
    e.stopPropagation();
    container.scrollTop += e.deltaY;
    container.scrollLeft += e.deltaX;
  };

  private readonly dragEventHandler = (e: DragEvent): void => {
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

    this._document.addEventListener('wheel', this.dragWheelHandler, { capture: true, passive: false });
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

  private checkFlatTreeDragCompatibility(
    event: DragEvent,
    index: number,
    draggedId: string,
    getId: (row: T) => string,
    position: RowDragPosition,
  ): { blocked: boolean; position: RowDragPosition } {
    if (!this.enableSubRows() || this.rowDragMode() !== 'flat') {
      return { blocked: false, position };
    }
    const treeRows = this.processedTreeRows();
    const draggedTreeRow = treeRows.find(tr => getId(tr.row) === draggedId);
    const targetTreeRow = treeRows[index];
    if (draggedTreeRow && targetTreeRow && draggedTreeRow.depth !== targetTreeRow.depth) {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      this.dragOverIndex.set(-1);
      return { blocked: true, position };
    }
    return { blocked: false, position: position === 'on' ? 'below' : position };
  }

  onRowDragOver(event: DragEvent, index: number): void {
    const draggedId = this.draggedRowId();
    if (!this.enableRowDrag() || !draggedId) return;

    const row = this.processedData()[index];
    if (row && this.isDisabled(row)) return;

    const getId = this.getRowId();
    const rawPosition = this.computeDragPosition(event);
    const { blocked, position } = this.checkFlatTreeDragCompatibility(event, index, draggedId, getId, rawPosition);
    if (blocked) return;

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
    this._document.removeEventListener('wheel', this.dragWheelHandler, { capture: true });
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

  private readonly _resizingColumn = signal<CellStyleColumn | null>(null);
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private resizeOldWidth = "auto";

  onResizeStart(event: MouseEvent, col: CellStyleColumn): void {
    event.preventDefault();
    event.stopPropagation();
    this.startResize(event.clientX, col);
  }

  onResizeTouchStart(event: TouchEvent, col: CellStyleColumn): void {
    if (event.touches.length === 1) {
      event.preventDefault();
      event.stopPropagation();
      this.startResize(event.touches[0].clientX, col);
    }
  }

  /** True while the given column is actively being resized. */
  isResizingColumn(col: CellStyleColumn): boolean {
    const resizing = this._resizingColumn();
    return (
      resizing !== null &&
      String(resizing.accessorKey) === String(col.accessorKey)
    );
  }

  /** Classes for the resize handle's 1px visual line — solid while dragging. */
  resizeLineClass(col: CellStyleColumn): string {
    const base = "absolute inset-y-0 left-1/2 w-px -translate-x-1/2";
    if (this.isResizingColumn(col)) {
      return `${base} bg-primary/70`;
    }
    return `${base} bg-transparent group-hover/resize:bg-primary/50`;
  }

  private startResize(clientX: number, col: CellStyleColumn): void {
    const key = String(col.accessorKey);
    this._resizingColumn.set(col);
    this.resizeStartX = clientX;
    const actualWidth = this.getColumnActualWidth(key);
    this.resizeStartWidth = Number.parseInt(col._width, 10) || actualWidth || 150;
    this.resizeOldWidth = this.columnWidths()[key] ?? col._width ?? "auto";
    this._isRtlResize = this.isRtl();

    const onMouseMove = (e: MouseEvent): void => this.onResizeMove(e.clientX);
    const onTouchMove = (e: TouchEvent): void => {
      if (e.touches.length === 1) {
        e.preventDefault();
        this.onResizeMove(e.touches[0].clientX);
      }
    };

    const onEnd = (): void => {
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

  private onResizeMove(clientX: number): void {
    const resizing = this._resizingColumn();
    if (!resizing) return;

    const delta = clientX - this.resizeStartX;
    const effectiveDelta = this._isRtlResize ? -delta : delta;
    const minWidth = Number.parseInt(resizing._minWidth || "50", 10) || 50;
    const newWidth = Math.max(minWidth, this.resizeStartWidth + effectiveDelta);
    const key = String(resizing.accessorKey);

    this.columnWidths.update((widths) => ({
      ...widths,
      [key]: `${newWidth}px`,
    }));
  }

  private onResizeEnd(): void {
    const resizing = this._resizingColumn();
    if (resizing) {
      const key = String(resizing.accessorKey);
      const newWidth = this.columnWidths()[key] ?? this.resizeOldWidth;

      this.columnResize.emit({
        columnKey: key,
        oldWidth: this.resizeOldWidth,
        newWidth,
      });

      this._resizingColumn.set(null);
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
