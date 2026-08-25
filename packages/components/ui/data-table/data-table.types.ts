import { TemplateRef, Type } from '@angular/core';

export type SortDirection = 'asc' | 'desc' | '' | null;

export interface SortState {
    column: string;
    direction: SortDirection;
}

export interface PaginationState {
    pageIndex: number;
    pageSize: number;
}

export interface ColumnResizeEvent {
    columnKey: string;
    oldWidth: string;
    newWidth: string;
}

export interface ColumnDef<T> {
    accessorKey: keyof T | string;
    accessorFn?: (row: T) => unknown;
    header: string;
    cell?: (row: T) => string;
    template?: TemplateRef<unknown>;
    headerTemplate?: TemplateRef<unknown>;
    component?: Type<unknown>;
    componentInputs?: (row: T) => Record<string, unknown>;
    componentOutputs?: (row: T) => Record<string, (event: unknown) => void>;
    enableSorting?: boolean;
    sortFn?: (a: T, b: T) => number;
    enableFiltering?: boolean;
    enableGlobalFilter?: boolean;
    filterFn?: (row: T, filterValue: unknown) => boolean;
    filterComponent?: Type<unknown>;
    filterComponentInputs?: Record<string, unknown> | (() => Record<string, unknown>);
    filterComponentOutputs?: Record<string, (event: unknown) => void>;
    sticky?: boolean;
    pin?: 'left' | 'right';
    width?: string;
    minWidth?: string;
    enableHiding?: boolean;
    enableReordering?: boolean;
    treeExpander?: boolean;
    _isTreeExpanderHost?: boolean;
    editable?: boolean;
    editComponent?: Type<unknown>;
    editTemplate?: TemplateRef<unknown>;
    /**
     * Which editor an inline edit opens. `date` uses the library's own
     * `ui-date-picker`, and writes back in whatever shape the cell already
     * held — an ISO string stays an ISO string.
     */
    editType?: 'text' | 'number' | 'select' | 'checkbox' | 'date';
    editOptions?: Array<{ label: string; value: unknown }>;
    valueSetter?: (row: T, newValue: unknown) => T;
    editValidator?: (value: unknown, row: T) => boolean | string;
    footer?: string | ((rows: T[]) => string);
    footerTemplate?: TemplateRef<unknown>;
    footerComponent?: Type<unknown>;
    aggregateFn?: AggregateFn;
    floatingFilter?: boolean;
    floatingFilterComponent?: Type<unknown>;
    floatingFilterTemplate?: TemplateRef<unknown>;
    enableCellFlash?: boolean;
    /** Conditional formatting: CSS classes applied when a predicate matches the cell value. */
    cellClassRules?: CellClassRule<T>[];
    /** Conditional formatting: inline styles derived from the cell value (e.g. text color). */
    cellStyleRules?: (value: unknown, row: T) => Record<string, string> | undefined;
    /** Heat-map background that interpolates `from`→`to` by where the value sits in `[min, max]`. */
    colorScale?: ColorScale;
    /** Inline horizontal bar whose width is the value's position in `[min, max]` (Excel data bars). */
    dataBar?: DataBar;
    /** Returns an icon to prefix the cell value, or `undefined` for none (Excel icon sets). */
    iconSet?: (value: unknown, row: T) => CellIcon | undefined;
}

export type AggregateFn = 'sum' | 'avg' | 'count' | 'min' | 'max' | ((values: unknown[]) => string);

export interface CellClassRule<T> {
    when: (value: unknown, row: T) => boolean;
    class: string;
}

export interface ColorScale {
    min: number;
    max: number;
    /** Color at `min` (CSS color). */
    from: string;
    /** Color at `max` (CSS color). */
    to: string;
}

export interface DataBar {
    min: number;
    max: number;
    /** Bar fill color (CSS color). */
    color: string;
    /** Track color behind the bar; defaults to transparent. */
    track?: string;
}

export interface CellIcon {
    /** A named icon from the `ui-icon` set (e.g. `'chevron-up'`). Takes precedence over `glyph`. */
    name?: string;
    /** A literal glyph/emoji string (e.g. `'▲'`, `'🏆'`). Used when `name` is not set. */
    glyph?: string;
    /** Extra CSS classes for the icon (e.g. color). */
    class?: string;
}

/** Resolved, value-aware formatting for a single cell. `null` when the column declares none. */
export interface ResolvedCellFormatting {
    class: string;
    style: Record<string, string>;
    /** `track` is `null` when the column declares no track (groove is not rendered). */
    dataBar: { width: string; color: string; track: string | null } | null;
    icon: CellIcon | null;
}

export interface EnhancedColumnDef<T> extends ColumnDef<T> {
    _stickyLeft?: number;
    _stickyRight?: number;
    _pin?: string;
    _width: string;
    _minWidth: string;
}

export interface CellStyleColumn {
    accessorKey?: string | number | symbol;
    sticky?: boolean;
    _stickyLeft?: number;
    _stickyRight?: number;
    _pin?: string;
    _width: string;
    _minWidth?: string;
}

export interface CellEditEvent<T> {
    row: T;
    column: ColumnDef<T>;
    oldValue: unknown;
    newValue: unknown;
    rowIndex: number;
}

/** Emitted when an inline cell edit is rejected by the column's `editValidator`. */
export interface CellEditErrorEvent<T> {
    row: T;
    column: ColumnDef<T>;
    /** The rejected value the user attempted to commit. */
    value: unknown;
    rowIndex: number;
    /** Human-readable reason — the validator's returned string, or a default. */
    message: string;
}

export interface EditingCell {
    rowIndex: number;
    columnKey: string;
}

/** Inline validation error state for the cell currently being edited. */
export interface CellEditError {
    rowIndex: number;
    columnKey: string;
    /** The rejected value — used to suppress duplicate error emissions. */
    value: unknown;
    message: string;
}

export interface DataTableRowEvent<T> {
    row: T;
    index: number;
    event: MouseEvent;
}

export interface DataTableColumnState {
    columnKey: string;
    width?: string;
    visible?: boolean;
    pin?: 'left' | 'right';
    order?: number;
}

export type DataTableLoadingTrigger = 'initial' | 'pagination' | 'sorting' | 'filtering';

export interface DataTableLoadingVisibility {
    initial?: boolean;
    pagination?: boolean;
    sorting?: boolean;
    filtering?: boolean;
}

export interface DataTableState<T> {
    data: T[];
    sorting: SortState;
    pagination: PaginationState;
    globalFilter: string;
}

export interface DataTableExportOptions {
    includeHeaders?: boolean;
    onlyVisible?: boolean;
    onlyFiltered?: boolean;
}

/**
 * The current query state passed to a server-side `exportDataProvider` so it can
 * fetch ALL rows matching what the user sees — filtered and sorted, across every
 * page (not just the loaded page). Pagination is intentionally omitted: an
 * export returns the whole result set.
 */
export interface DataTableExportQuery {
    /** Global (search box) filter value. */
    globalFilter: string;
    /** Per-column filter values, keyed by `accessorKey`. */
    columnFilters: Record<string, unknown>;
    /** Primary sort. */
    sort: SortState;
    /** Full multi-column sort state (highest priority first); empty when unused. */
    sortStates: SortState[];
}

/**
 * Everything a server needs to answer one page of a data table.
 *
 * The mechanism for server-side mode has always been here — set `localSorting`,
 * `localPagination` and `localFiltering` to `false`, feed `data` and `total`,
 * and listen to `sortChange` / `pageChange` / `filterChange`. What was missing
 * was the *shape*: every consumer re-derived a request from six separate
 * inputs. This is that request, published once.
 *
 * It is deliberately the same vocabulary as {@link DataTableExportQuery}, which
 * is the same question asked without a page — an export returns the whole
 * result set.
 */
export interface DataTableQuery {
    /** Global (search box) filter value. */
    readonly globalFilter: string;
    /** Per-column filter values, keyed by `accessorKey`. */
    readonly columnFilters: Record<string, unknown>;
    /** Primary sort. */
    readonly sort: SortState;
    /** Full multi-column sort state (highest priority first); empty when unused. */
    readonly sortStates: readonly SortState[];
    /** The advanced filter tree, or `null` when the builder is unused. */
    readonly advancedFilter: FilterGroup | null;
    /** Which page, and how big. */
    readonly page: PaginationState;
}

/**
 * What a server answers a {@link DataTableQuery} with.
 *
 * `total` is the count of rows matching the filters across **every** page, not
 * the length of `rows` — it is what the pager needs to know how many pages
 * there are, and it is the single most common thing to get wrong when wiring
 * server-side mode by hand.
 */
export interface DataTableResult<T> {
    /** The rows for the requested page. */
    readonly rows: readonly T[];
    /** Total matching rows across all pages. */
    readonly total: number;
}

/** The schema version {@link DataTableViewState} is written at. */
export const DATA_TABLE_VIEW_STATE_VERSION = 1;

/**
 * Everything needed to restore what a user set up — a saved view.
 *
 * `DataTableColumnState` covers width, visibility, pinning and order, which is
 * the *layout*. A named view is more than a layout: someone who saved "My open
 * invoices" expects the sort and the filters back too, and the page they were
 * on.
 *
 * Versioned because the consumer persists this — localStorage, a preferences
 * row — so it outlives the build that wrote it by a long way. A bare array can
 * get away without a version; a growing object cannot, because a field added
 * later would otherwise be silently absent rather than detected.
 */
export interface DataTableViewState {
    /** Schema version; {@link DATA_TABLE_VIEW_STATE_VERSION} at the time of writing. */
    readonly version: number;
    /** Column layout — the same shape {@link DataTableColumnState} has always had. */
    readonly columns: DataTableColumnState[];
    /** Primary sort. */
    readonly sort: SortState;
    /** Multi-column sort chain, highest priority first. */
    readonly sortStates: SortState[];
    /** Per-column filter values, keyed by `accessorKey`. */
    readonly columnFilters: Record<string, unknown>;
    /** The advanced filter tree, or `null`. */
    readonly advancedFilter: FilterGroup | null;
    /** Global (search box) filter value. */
    readonly globalFilter: string;
    /** Which page, and how big. */
    readonly pagination: PaginationState;
}

export type FilterOperator =
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'startsWith'
    | 'endsWith'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'isEmpty'
    | 'isNotEmpty';

/** A single leaf condition in an advanced-filter tree. */
export interface FilterCondition {
    type: 'condition';
    column: string;
    operator: FilterOperator;
    value?: unknown;
}

/** An AND/OR group of conditions and nested groups. */
export interface FilterGroup {
    type: 'group';
    combinator: 'and' | 'or';
    rules: FilterRule[];
}

export type FilterRule = FilterCondition | FilterGroup;

export type SubRowSelectionMode = 'self' | 'descendants' | 'filteredDescendants';

export type SubRowFilterMode = 'includeChildren' | 'excludeChildren' | 'includeParentOnChildMatch';

export interface SubRowContext<T> {
    row: T;
    parentRow: T | null;
    parentId: string | null;
    depth: number;
    path: string[];
    isLeaf: boolean;
    childCount: number;
}

export interface FlattenedTreeRow<T> {
    row: T;
    depth: number;
    parentId: string | null;
    parentRow: T | null;
    path: string[];
    isLeaf: boolean;
    childCount: number;
    isExpanded: boolean;
}

export interface RowActionContext<T> {
    row: T;
    index: number;
    selected: boolean;
    depth?: number;
    isLeaf?: boolean;
    parentRow?: T | null;
    isExpanded?: boolean;
}

export type CellFlashDirection = 'up' | 'down' | 'changed';

export interface CellRange {
    startRow: number;
    startCol: string;
    endRow: number;
    endCol: string;
}

/** Live aggregate readout for the currently selected cell range. */
export interface RangeAggregateStats {
    /** Total cells in the range (all columns × rows). */
    count: number;
    /** How many of those cells held a finite number. */
    numericCount: number;
    sum: string;
    avg: string;
    min: string;
    max: string;
}

/** One numeric column of a range, as a chart series. */
export interface RangeChartSeries {
    name: string;
    values: number[];
}

/** The selected range reshaped for charting: row labels + one series per numeric column. */
export interface RangeChartPayload {
    categories: string[];
    series: RangeChartSeries[];
}

/** Emitted after a clipboard grid is pasted into cells. */
export interface CellsPasteEvent {
    /** Top-left target of the paste. */
    startRow: number;
    startColumn: string;
    /** Rows the paste spanned (some may have been out of range). */
    rowsAffected: number;
    /** Cells successfully written. */
    cellsApplied: number;
    /** Cells rejected by a column's `editValidator`. */
    cellsRejected: number;
}

/** Emitted after an Excel-style fill-handle drag applies values to new rows. */
export interface FillSeriesEvent {
    /** Source range the fill pattern was read from. */
    source: { minRow: number; maxRow: number };
    /** Rows that received filled values (inclusive). */
    filled: { startRow: number; endRow: number };
    /** Column keys that were filled (only those with a `valueSetter`). */
    columnKeys: string[];
}

export type RowDragPosition = 'above' | 'below' | 'on';

export interface RowReorderEvent<T> {
    row: T;
    targetRow: T;
    position: RowDragPosition;
    previousId: string | null;
    nextId: string | null;
    parentId?: string | null;
    fromIndex: number;
    toIndex: number;
}

export interface VirtualRenderRange {
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
}

export interface VirtualAutoThreshold {
    rows: number;
    columns: number;
}

export interface VirtualScrollState2D {
    rowStart: number;
    rowEnd: number;
    columnStart: number;
    columnEnd: number;
    totalRows: number;
    totalColumns: number;
    scrollTop: number;
    scrollLeft: number;
}

export interface GroupRow {
    kind: 'group';
    groupKey: string;
    groupValue: unknown;
    count: number;
    aggregates: Map<string, string>;
    collapsed: boolean;
}

export type DataTableDisplayRow<T> =
    | GroupRow
    | { kind: 'data'; row: T };
