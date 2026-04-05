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
    editType?: 'text' | 'number' | 'select' | 'checkbox';
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
}

export type AggregateFn = 'sum' | 'avg' | 'count' | 'min' | 'max' | ((values: unknown[]) => string);

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

export interface EditingCell {
    rowIndex: number;
    columnKey: string;
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
