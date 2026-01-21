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

export interface ColumnDef<T> {
    accessorKey: keyof T | string;
    header: string;
    cell?: (row: T) => string;
    template?: TemplateRef<any>;
    headerTemplate?: TemplateRef<any>;
    component?: Type<any>;
    componentInputs?: (row: T) => Record<string, any>;
    componentOutputs?: (row: T) => Record<string, (event: any) => void>;
    enableSorting?: boolean;
    sticky?: boolean;
    width?: string;
}

export interface DataTableState<T> {
    data: T[];
    sorting: SortState;
    pagination: PaginationState;
    globalFilter: string;
}
