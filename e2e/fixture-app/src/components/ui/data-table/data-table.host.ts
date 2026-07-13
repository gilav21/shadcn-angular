import type {
  ColumnDef,
  DataTableExportOptions,
  DataTableExportQuery,
  RowActionContext,
  SortDirection,
} from './data-table.types';
import type { DataTableLocale } from './data-table.locales';

export { AddonSlotRegistry } from '@/components/lib/addon-slots';

/** A column pin position, or undefined for unpinned. */
export type ColumnPin = 'left' | 'right' | undefined;

/**
 * An addon-contributed ⋮ button rendered by the base in each data row's
 * action cell. The base renders the button (icon + aria-label) and invokes
 * `onClick` with the row's context; it never knows which addon registered it.
 */
export interface CellActionSlot<T = unknown> {
  /** Stable id (the registering addon's key, e.g. `context-menu`). */
  readonly id: string;
  readonly icon?: string;
  readonly ariaLabel?: string;
  readonly onClick: (event: Event, context: RowActionContext<T>) => void;
}

/**
 * An addon-contributed ⋮ button rendered by the base in each column header.
 */
export interface HeaderActionSlot<T = unknown> {
  readonly id: string;
  readonly icon?: string;
  readonly ariaLabel?: string;
  readonly onClick: (event: Event, column: ColumnDef<T>) => void;
}

/**
 * The stable extension surface a data-table addon directive reaches through DI
 * (`inject(DataTableAddonHost)`). `DataTableComponent` provides itself as this
 * token; the base never imports any addon. This is the one boundary that lets
 * the base's internals change without breaking installed addons.
 */
export abstract class DataTableAddonHost<T = unknown> {
  /** The resolved, ordered columns currently driving the table. */
  abstract enhancedColumns(): readonly ColumnDef<T>[];
  /** The row rendered at a visible row index, or undefined. */
  abstract getRenderedRowAt(index: number): T | undefined;
  /** Generic per-row metadata (selection + tree state) for an action context. */
  abstract getRowContext(row: T, index: number): RowActionContext<T>;
  /** Current sort direction for a column key. */
  abstract getSortDirection(columnKey: string | keyof T): SortDirection;
  /** Apply a sort to a column (`multi` extends a multi-sort). */
  abstract onSortChange(columnKey: string | keyof T, direction: SortDirection, multi?: boolean): void;
  /** Pin/unpin a column. */
  abstract pinColumn(columnKey: string, pin: ColumnPin): void;
  /** Current pin position for a column key. */
  abstract getColumnPin(columnKey: string): ColumnPin;
  /** Show/hide a column. */
  abstract setColumnVisibility(columnKey: string | keyof T, visible: boolean): void;
  /** Make every column visible. */
  abstract showAllColumns(): void;
  /** The active locale strings (for addon-rendered labels). */
  abstract getLocale(): DataTableLocale;

  /** Register a row-action ⋮ button; returns a teardown. */
  abstract registerCellAction(slot: CellActionSlot<T>): () => void;
  /** Register a header ⋮ button; returns a teardown. */
  abstract registerHeaderAction(slot: HeaderActionSlot<T>): () => void;
  /** The registered row-action slots (read by the base template). */
  abstract cellActionSlots(): readonly CellActionSlot<T>[];
  /** The registered header-action slots (read by the base template). */
  abstract headerActionSlots(): readonly HeaderActionSlot<T>[];

  /**
   * Shape the current rows into a `string[][]` grid (header row + cells), the
   * same view the base uses for copy. `rows` overrides the default source
   * (filtered + sorted). Consumed by the export addon and clipboard features.
   */
  abstract getExportData(options?: DataTableExportOptions, rows?: readonly T[]): string[][];
  /** The filtered + sorted rows across every page (not just the current page). */
  abstract getSortedRows(): readonly T[];
  /** The raw, unfiltered input rows (the `data` input), for transforms like pivot. */
  abstract getRawRows(): readonly T[];
  /** Resolve a cell's raw value for a row + column key (accessor or valueGetter). */
  abstract getCellValue(row: T, key: string | keyof T, column?: ColumnDef<T>): unknown;
  /** The active filter + sort query, for a server-side export provider. */
  abstract queryState(): DataTableExportQuery;
  /**
   * Show or clear the base's generic busy overlay. An addon passes its own
   * (localized) label to show it and `null` to hide it; the base owns no label.
   */
  abstract setBusy(label: string | null): void;
  /** The active busy-overlay label, or null when idle (read by the base template). */
  abstract busyLabel(): string | null;
}
