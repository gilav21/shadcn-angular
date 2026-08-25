import {
  Component,
  computed,
  effect,
  afterRenderEffect,
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
  untracked,
  inject,
  forwardRef,
  AfterViewInit,
  OnDestroy,
} from "@angular/core";
import { CommonModule, DOCUMENT } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { cn, isRtl, stringifyValue } from "../../lib/utils";
import { onPointerDrag, onLongPress } from "../../lib/touch";
import { createLocaleBindings, interpolate, provideComponentLocale, type LocaleInput } from "../../lib/i18n";
import { DATA_TABLE_LOCALES, type DataTableLocale } from "./data-table.locales";
import {
  DataTableAddonHost,
  AddonSlotRegistry,
  type CellActionSlot,
  type HeaderActionSlot,
  type ColumnPin,
} from "./data-table.host";
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
import { DatePickerComponent } from "../date-picker";
import {
  PopoverComponent,
  PopoverTriggerComponent,
  PopoverContentComponent,
} from "../popover";
import { DataTableColumnHeaderComponent } from "./sub/data-table-column-header.component";
import { DataTablePaginationComponent } from "./sub/data-table-pagination.component";
import {
  DataTableFilterBuilderComponent,
  DEFAULT_FILTER_BUILDER_LABELS,
} from "./sub/data-table-filter-builder.component";
import { UiComponentOutletDirective } from "../component-outlet.directive";
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
  DataTableExportQuery,
  DataTableQuery,
  DataTableViewState,
  DATA_TABLE_VIEW_STATE_VERSION,
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
  ColorScale,
  ResolvedCellFormatting,
  RangeAggregateStats,
  RangeChartPayload,
  FillSeriesEvent,
  CellsPasteEvent,
  FilterGroup,
} from "./data-table.types";
import {
  computeRowRange,
  computeColumnRange,
  computeVariableRowRange,
  buildPrefixSums,
  partitionIntoGroups,
  computeAggregateValue,
  buildFillValues,
  parseClipboardGrid,
  parseNlFilterSpec,
  type NlFilterSpec,
  evaluateAdvancedFilter,
  asEditableDate,
  toEditedDateValue,
} from "./data-table.utils";
import { ComponentPoolService } from "../../lib/component-pool.service";
import { AiProvider, runAiTask } from "../../lib/ai";
import { lastValueFrom } from "rxjs";

const EMPTY_RECORD: Readonly<Record<string, never>> = Object.freeze({});

/** One reversible cell write captured for the edit-history (B3) stack. */
interface EditChange {
  rowId: string;
  columnKey: string;
  before: unknown;
  after: unknown;
}

/** Per-instance counter for unique element ids (e.g. inline edit-error links). */
let dataTableUid = 0;

const DEFAULT_GET_ROW_ID = <T>(row: T): string => {
  const rec = row as Record<string, unknown>;
  const id = rec['id'];
  if (id == null) return JSON.stringify(row);
  return stringifyValue(id);
};

/**
 * Whether two requests describe the same page of data.
 *
 * Compared field by field rather than with a deep clone or `JSON.stringify`:
 * `columnFilters` holds arbitrary consumer values, which may not be
 * serialisable, and this runs on every state change.
 */
function sameQuery(a: DataTableQuery, b: DataTableQuery): boolean {
  const sameSort = (x: SortState, y: SortState): boolean =>
    x.column === y.column && x.direction === y.direction;

  return (
    a.globalFilter === b.globalFilter &&
    a.columnFilters === b.columnFilters &&
    a.advancedFilter === b.advancedFilter &&
    a.page.pageIndex === b.page.pageIndex &&
    a.page.pageSize === b.page.pageSize &&
    sameSort(a.sort, b.sort) &&
    a.sortStates.length === b.sortStates.length &&
    a.sortStates.every((sort, i) => sameSort(sort, b.sortStates[i]))
  );
}

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
    DatePickerComponent,
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
    DataTableColumnHeaderComponent,
    DataTablePaginationComponent,
    DataTableFilterBuilderComponent,
    UiComponentOutletDirective,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    ComponentPoolService,
    provideComponentLocale(() => DataTableComponent),
    { provide: DataTableAddonHost, useExisting: forwardRef(() => DataTableComponent) },
  ],
  host: {
    class: "block h-full w-full",
    '[attr.dir]': 'dir()',
  },
  templateUrl: './data-table.component.html',
})
export class DataTableComponent<T>
  implements AfterViewInit, OnDestroy, DataTableAddonHost<T>
{
  protected readonly EMPTY_RECORD = EMPTY_RECORD;
  private readonly _document = inject(DOCUMENT);
  private readonly _el = inject(ElementRef);
  /**
   * True when the host element's resolved writing direction is RTL. Read from
   * the live DOM (not the {@link locale} input), and used to mirror
   * direction-sensitive gestures such as column-resize deltas.
   */
  isRtl(): boolean {
    return isRtl(this._el.nativeElement);
  }
  private _isRtlResize = false;

  /**
   * The row array. A `model`, and the table *does* write back to it: inline
   * edits committed through a column `valueSetter`, fill-handle, paste and
   * undo/redo all emit a new array here, as does a row drag while
   * {@link localReorder} is on. Filtering, sorting and pagination never mutate
   * it — they derive views.
   */
  readonly data = model.required<T[]>();
  /** @see columnHelper for a type-safe fluent builder API */
  readonly columns = input.required<ColumnDef<T>[]>();

  /** Hides the whole toolbar row (global filter, advanced filter, columns menu) when false. */
  readonly showToolbar = input(true);
  /** Hides the columns popover in the toolbar; only shown when at least one column is hideable. */
  readonly showColumnVisibilityToggle = input(true);
  /**
   * Renders the pagination footer. Also acts as a mode switch: with
   * {@link localPagination} on, `enableVirtualScroll: "auto"` declines to
   * virtualize while pagination is showing.
   */
  readonly showPagination = input(true);
  /** Adds the horizontal rule under each row/header cell. Purely cosmetic. */
  readonly showRowBorders = input(true);
  /** Adds the vertical rule between cells. Purely cosmetic. */
  readonly showColumnBorders = input(true);

  /**
   * Sort the rows in the browser. Set false for server-side sorting: the header
   * still cycles and {@link sortChange} / {@link multiSortChange} still fire, but
   * the row order is left exactly as you supply it in {@link data}.
   */
  readonly localSorting = input(true);
  /**
   * Slice the rows in the browser. Set false for server-side paging: supply only
   * the current page in {@link data}, set {@link total} to the full row count,
   * and re-fetch from {@link pageChange}.
   */
  readonly localPagination = input(true);
  /**
   * Filter the rows in the browser — global filter, per-column filters and the
   * advanced filter tree all become no-ops when false. {@link filterChange} still
   * fires so you can filter server-side.
   */
  readonly localFiltering = input(true);
  /**
   * Shows the busy overlay above the (still rendered) table. Which triggers
   * actually surface it is filtered by {@link loadingVisibility}, so setting
   * this alone does not guarantee an overlay. Also blocks row drag.
   */
  readonly loading = input(false);
  /**
   * Replaces the entire table — toolbar, grid and footer — with placeholder
   * bars. This is the first-paint state, distinct from {@link loading}, which
   * overlays the real table.
   */
  readonly skeleton = input(false);
  /** Number of placeholder row bars drawn while {@link skeleton} is true. */
  readonly skeletonRows = input(5);
  /**
   * Per-trigger opt-out for the {@link loading} overlay: set a key to `false`
   * to keep the table quiet during e.g. sorting round-trips while still
   * showing the overlay on the initial load. Unset keys default to visible.
   */
  readonly loadingVisibility = input<DataTableLoadingVisibility>({
    initial: true,
    pagination: true,
    sorting: true,
    filtering: true,
  });
  /**
   * Custom content for the loading overlay. Receives the active
   * {@link DataTableLoadingTrigger} as both `$implicit` and `trigger`. Takes
   * precedence over {@link loaderComponent}; with neither, a default spinner
   * is rendered.
   */
  readonly loaderTemplate = input<TemplateRef<unknown>>();
  /**
   * Component rendered inside the loading overlay. Used only when
   * {@link loaderTemplate} is unset.
   */
  readonly loaderComponent = input<Type<unknown>>();
  /**
   * Inputs bound onto {@link loaderComponent}. The table always adds a
   * `trigger` input carrying the current {@link DataTableLoadingTrigger},
   * overwriting any `trigger` you pass here.
   */
  readonly loaderComponentInputs = input<Record<string, unknown>>({});
  /**
   * Replaces the built-in global-filter matcher (which lowercases each visible
   * cell's string value and tests `includes`). Receives the already-lowercased
   * filter text and the resolved columns. Only consulted while
   * {@link localFiltering} is true.
   */
  readonly globalFilterFn = input<
    | ((row: T, filterValue: string, columns: ColumnDef<T>[]) => boolean)
    | undefined
  >(undefined);
  /**
   * Lets shift-click stack multiple sort columns. While on, {@link sortState}
   * is no longer authoritative — read {@link multiSortState} /
   * {@link multiSortChange} instead.
   */
  readonly enableMultiSort = input(false);
  /**
   * Cap on the multi-sort chain; adding beyond it drops the oldest column.
   * Values below 1 are clamped to 1. Ignored unless {@link enableMultiSort}.
   */
  readonly maxMultiSortColumns = input(3);
  /**
   * Full row count on the server. Required — and only used — when
   * {@link localPagination} is false, where it drives the page count and the
   * "N of M" readouts; ignored otherwise, since the local row count is known.
   */
  readonly total = input(0);

  /**
   * The new single-sort state after a header activation (direction `null` means
   * the sort was cleared). Fires regardless of {@link localSorting} — handle it
   * to sort server-side.
   */
  readonly sortChange = output<SortState>();
  /**
   * The whole ordered sort chain, highest priority first, after a multi-sort
   * change. Only meaningful with {@link enableMultiSort}.
   */
  readonly multiSortChange = output<SortState[]>();
  /**
   * The requested page index/size. Fires for both local and server paging; with
   * {@link localPagination} false this is your cue to fetch the page.
   */
  readonly pageChange = output<PaginationState>();
  /**
   * The raw global-filter text, after {@link filterDebounce}. Fires even when
   * {@link localFiltering} is false, which is how you drive a server-side search.
   */
  readonly filterChange = output<string>();

  /**
   * The complete server request, emitted whenever any part of it changes.
   *
   * `sortChange` / `pageChange` / `filterChange` each report one fragment, so
   * wiring server-side mode from them means keeping your own copy of the other
   * five and reassembling a request on every callback. This emits the whole
   * {@link DataTableQuery} instead — one handler, one shape.
   *
   * It **reports state; it does not fetch**. A global filter changes on every
   * keystroke (after {@link filterDebounce}), so debounce or `switchMap` on
   * your side before hitting a server — the table cannot know how expensive
   * your endpoint is.
   *
   * It does not fire on init: there is no change to report yet, and an output
   * that emits during construction fires before a consumer can be ready. Read
   * {@link currentQuery} for the first fetch.
   */
  readonly query = output<DataTableQuery>();

  /**
   * A committed inline cell edit: row, column key, and old/new value. The table
   * has already written the value through the column's `valueSetter` into a new
   * {@link data} array by the time this fires — persist it, and revert `data`
   * yourself if the server rejects it.
   */
  readonly cellEdit = output<CellEditEvent<T>>();
  /**
   * A rejected inline edit (a column `validate` returned an error). The value is
   * *not* written and the editor stays open with the message shown inline.
   */
  readonly editError = output<CellEditErrorEvent<T>>();
  readonly editingCell = signal<EditingCell | null>(null);
  readonly editValue = signal<unknown>(null);
  readonly cellEditError = signal<CellEditError | null>(null);
  /** Stable id for the inline edit-error message, linked via `aria-describedby`. */
  readonly cellEditErrorId = `ui-data-table-cell-edit-error-${dataTableUid++}`;

  /** Adds the leading checkbox column and the header select-all checkbox. */
  readonly enableRowSelection = input(false);
  /**
   * Selection as an id → true map keyed by {@link getRowId}. Two-way: the table
   * writes a *new* object on every change. Ids of rows that are filtered out (or
   * no longer in {@link data}) are kept, so selection survives a filter — read it
   * back against your data rather than treating its size as "visible selected".
   */
  readonly rowSelection = model<Record<string, boolean>>({});
  /**
   * Stable identity for a row, used as the key of {@link rowSelection},
   * {@link expandedRows} and {@link subRowExpandedRows}. Defaults to the row's
   * `id` property, falling back to `JSON.stringify(row)` when absent — which
   * means edits change a row's identity and drop its selection. Supply a real
   * key whenever rows are editable.
   */
  readonly getRowId = input<(row: T) => string>(DEFAULT_GET_ROW_ID);
  /**
   * Enables the clipboard paths: `Ctrl/Cmd+C` and the
   * `copy*ToClipboard` methods, all of which return early when false. The
   * selection, expander and actions columns are never copied.
   */
  readonly enableCopy = input(true);
  /**
   * Marks rows non-interactive (no selection, no drag, no inline edit). Combined
   * with {@link disabledRowIds} — a row is disabled if either says so.
   */
  readonly isRowDisabled = input<((row: T) => boolean) | undefined>(undefined);
  /**
   * Disabled rows addressed by {@link getRowId}. Accepts a `Set` (used directly)
   * or an array (copied into a `Set`). See {@link isRowDisabled}.
   */
  readonly disabledRowIds = input<ReadonlySet<string> | readonly string[]>([]);
  /**
   * Adds the leading chevron column that reveals a detail row beneath each row.
   * This is master/detail — unrelated to {@link enableSubRows}, which renders a
   * hierarchy in the grid itself.
   */
  readonly enableRowExpansion = input(false);
  /** Which detail rows are open, keyed by {@link getRowId}. Two-way. */
  readonly expandedRows = model<Record<string, boolean>>({});
  /**
   * Detail-row content, receiving the row as `$implicit`/`row`. Takes precedence
   * over {@link rowDetailComponent}.
   */
  readonly rowDetailTemplate = input<TemplateRef<unknown>>();
  /** Component rendered in the detail row when {@link rowDetailTemplate} is unset. */
  readonly rowDetailComponent = input<Type<unknown>>();
  /**
   * Per-row inputs for {@link rowDetailComponent}. Called for each expanded row;
   * without it the component receives only a `row` input.
   */
  readonly rowDetailComponentInputs = input<
    ((row: T) => Record<string, unknown>) | undefined
  >(undefined);

  /**
   * Renders hierarchical data: rows are flattened into an indented tree with
   * expanders. Mutually exclusive with {@link groupBy}. Changes what most
   * row-level APIs operate on — the visible rows become tree rows.
   */
  readonly enableSubRows = input(false);
  /** Reads a row's children. Defaults to the row's `children` property. */
  readonly getChildren = input<(row: T) => T[] | undefined>((row: T) => (row as Record<string, unknown>)['children'] as T[] | undefined);
  /**
   * Returns a *new* row with the given children — the table never mutates a row
   * in place. Used when tree row-drag re-parents nodes; the default spreads the
   * row and replaces `children`.
   */
  readonly setChildren = input<(row: T, children: T[]) => T>(
    (row: T, children: T[]) => ({ ...row, children }),
  );
  /**
   * Depth expanded on first render (0 = only roots, 1 = roots plus their
   * children, …). It seeds {@link subRowExpandedRows}; explicit entries there win.
   */
  readonly subRowDefaultExpanded = input(0);
  /**
   * How a checkbox click propagates through the tree: `"self"` (default) touches
   * only the clicked row; the cascading modes also select descendants and derive
   * an indeterminate parent state.
   */
  readonly subRowSelectionMode = input<SubRowSelectionMode>("self");
  /**
   * What a filter match does to the hierarchy — by default a matching child
   * keeps its ancestors visible so it can still be reached.
   */
  readonly subRowFilterMode = input<SubRowFilterMode>("includeParentOnChildMatch");
  /**
   * Sorts children within their parent instead of leaving them in source order.
   * Requires {@link localSorting}; the tree shape is always preserved.
   */
  readonly enableSubRowSorting = input(true);
  /** Pixels of indent added per tree depth level in the first data column. */
  readonly subRowIndentSize = input(20);
  /**
   * Paginate over *visible* (flattened) tree rows rather than over root rows, so
   * expanding a node can push its siblings onto the next page.
   */
  readonly subRowsPaginated = input(false);
  /**
   * Which tree nodes are expanded, keyed by {@link getRowId}. Two-way, and
   * separate from {@link expandedRows} (which is master/detail).
   */
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

  /**
   * Adds a drag handle to each header's trailing edge (mouse and touch). Widths
   * are stored in the two-way {@link columnWidths} map keyed by accessor key and
   * override the column's declared width; {@link columnResize} reports each drop.
   */
  readonly enableColumnResize = input(false);
  /**
   * Lets headers be dragged to reorder columns, writing the new order into the
   * two-way {@link columnOrder}. Pinned/sticky columns keep their side
   * regardless of order.
   */
  readonly enableColumnReorder = input(false);
  /**
   * Footer row visibility. `"auto"` (default) shows it only when some column
   * declares a `footer`, `aggregateFn`, `footerTemplate` or `footerComponent`;
   * `true` forces an (otherwise empty) footer.
   */
  readonly showFooter = input<boolean | "auto">("auto");
  /**
   * Adds a second header row of per-column filter inputs. A column opts in with
   * `enableFiltering` or a floating filter template/component; if no column
   * does, the table warns and renders nothing. Values flow into
   * {@link columnFilters}.
   */
  readonly enableFloatingFilters = input(false);
  /**
   * Makes rows draggable (HTML5 drag-and-drop). Disabled rows and rows under a
   * {@link loading} overlay cannot be dragged.
   */
  readonly enableRowDrag = input(false);
  /**
   * Applies a completed drag to {@link data} automatically (the default): the
   * drop runs {@link reorderData} and writes the new array back before
   * {@link rowReorder} is emitted, so a handler reading `data()` already sees
   * the moved row. Set it to `false` for server-side or otherwise custom
   * reordering — the table then only emits the event and leaves `data` alone.
   */
  readonly localReorder = input(true);
  /**
   * `"flat"` (default) allows only above/below drops, and — in tree mode —
   * blocks drops across differing depths. `"tree"` adds an `"on"` position over
   * the middle of a row, which re-parents the dragged node via
   * {@link setChildren}.
   */
  readonly rowDragMode = input<'flat' | 'tree'>('flat');
  /**
   * Vetoes individual drops. Returning false suppresses the drop indicator and
   * the drop entirely for that target/position combination.
   */
  readonly rowDragAllowDrop = input<((dragRow: T, targetRow: T, position: RowDragPosition) => boolean) | undefined>(undefined);
  /**
   * A completed row drag: the moved row plus its source and target indices, in
   * the *rendered* (filtered/sorted/paged) order — map back to your source
   * collection before persisting.
   */
  readonly rowReorder = output<RowReorderEvent<T>>();
  /**
   * Briefly highlights cells whose value changed between two {@link data}
   * emissions — for live/streaming feeds. Requires a stable {@link getRowId};
   * with the default id function the table warns and skips flashing.
   */
  readonly enableCellFlash = input(false);
  /** Milliseconds a changed cell stays highlighted. See {@link enableCellFlash}. */
  readonly cellFlashDuration = input(500);
  /**
   * Enables Excel-style rectangular cell-range selection by dragging across
   * cells (also disables text selection in the grid). Prerequisite for
   * {@link enableRangeActions} and {@link enableFillHandle}, and it widens
   * `Ctrl/Cmd+C` to copy the whole range as TSV.
   */
  readonly enableCellRangeSelection = input(false);
  readonly cellRange = signal<CellRange | null>(null);
  /**
   * Show a contextual readout when a cell range is selected: live Sum / Avg /
   * Count of the selection, plus a "Chart" action. Requires
   * `enableCellRangeSelection`. Opt-in; off by default.
   */
  readonly enableRangeActions = input(false);
  /** Emitted when the user opens the range chart; carries the chart payload. */
  readonly rangeChartOpen = output<RangeChartPayload>();
  /**
   * Show an Excel-style fill handle at the corner of the focused cell / range.
   * Drag it down to fill the pattern into the rows below. Requires
   * `enableCellRangeSelection`. Only columns with a `valueSetter` are filled.
   */
  readonly enableFillHandle = input(false);
  /** Emitted after a fill-handle drag applies values to new rows. */
  readonly fillSeries = output<FillSeriesEvent>();
  /**
   * Allow pasting a clipboard grid (TSV/CSV) into cells starting at the focused
   * cell (`Ctrl/Cmd+V`). Only columns with a `valueSetter` are written.
   */
  readonly enableClipboardPaste = input(false);
  /** Emitted after a clipboard grid is pasted into cells. */
  readonly cellsPaste = output<CellsPasteEvent>();
  /**
   * Track inline edits, fills and pastes on an undo/redo stack
   * (`Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` / `Ctrl/Cmd+Shift+Z`). Undo re-applies the
   * inverse value through each column's `valueSetter` and re-emits `cellEdit`.
   */
  readonly enableEditHistory = input(false);
  /**
   * Fired after an undo has been applied (the inverse values are already written
   * to {@link data} and re-emitted as {@link cellEdit}). Requires
   * {@link enableEditHistory}.
   */
  readonly editUndo = output<void>();
  /** Fired after a redo has been applied. See {@link editUndo}. */
  readonly editRedo = output<void>();
  private readonly _undoStack = signal<EditChange[][]>([]);
  private readonly _redoStack = signal<EditChange[][]>([]);
  private _recordingChanges: EditChange[] | null = null;
  readonly canUndo = computed(() => this._undoStack().length > 0);
  readonly canRedo = computed(() => this._redoStack().length > 0);
  /**
   * A finished column resize: the column key and its new pixel width. The width
   * is already in {@link columnWidths}, so handle this only to persist it.
   */
  readonly columnResize = output<ColumnResizeEvent>();

  /**
   * Replaces the "No results found." placeholder shown when the *filtered* row
   * set is empty. It is not shown while {@link skeleton} or the loading overlay
   * is up.
   */
  readonly emptyStateComponent = input<Type<unknown>>();
  /** Inputs bound onto {@link emptyStateComponent}. */
  readonly emptyStateComponentInputs = input<Record<string, unknown>>({});
  /**
   * Marks rows that render as a single cell spanning the full table width
   * (section banners, ad slots, "load more" rows) instead of the normal column
   * grid. Such rows still occupy a row slot in selection and pagination.
   */
  readonly fullWidthRow = input<((row: T) => boolean) | undefined>(undefined);
  /**
   * Content for a {@link fullWidthRow}, receiving the row as `$implicit` and its
   * rendered `index`. Takes precedence over {@link fullWidthRowComponent}; with
   * neither, the full-width cell renders empty.
   */
  readonly fullWidthRowTemplate = input<TemplateRef<unknown>>();
  /** Component for a {@link fullWidthRow}; bound `row` and `index` inputs. */
  readonly fullWidthRowComponent = input<Type<unknown>>();

  /**
   * Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when
   * not set. The DataTableLocale covers data-table chrome (filter
   * placeholder, columns menu, sort/pin actions, pagination labels,
   * etc.). Date filters embedded in the table still read from
   * `CalendarLocale` separately.
   */
  readonly locale = input<LocaleInput<DataTableLocale>>();
  /**
   * Milliseconds to wait after typing before the global filter is applied and
   * {@link filterChange} emitted. 0 (default) applies on every keystroke. Only
   * the toolbar's global filter is debounced — column filters apply immediately.
   */
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
  /**
   * Row height in pixels assumed by the virtual-scroll maths, and the fallback
   * for unmeasured rows under {@link virtualVariableRowHeight}. If your CSS row
   * height differs, the scrollbar and the rows drift apart.
   */
  readonly virtualRowHeight = input(40);
  /** Extra rows rendered above and below the viewport to hide scroll tearing. */
  readonly virtualRowBuffer = input(5);
  /** Extra columns rendered either side of the viewport during horizontal virtualization. */
  readonly virtualColumnBuffer = input(3);
  /**
   * Measures each rendered row and uses prefix sums instead of a fixed row
   * height — needed for wrapping content, at the cost of a `ResizeObserver` per
   * row and re-measurement as rows scroll in.
   */
  readonly virtualVariableRowHeight = input(false);
  /**
   * Reuses cell component instances from a pool as rows scroll instead of
   * destroying and recreating them. Only safe for cell components with no
   * per-instance state outside their inputs. See {@link recycleStats}.
   */
  readonly virtualRecycleComponents = input(false);
  /**
   * The row/column counts above which `enableVirtualScroll: "auto"` switches
   * virtualization on. Ignored when {@link enableVirtualScroll} is an explicit
   * boolean.
   */
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


  readonly columnPinOverrides = signal<
    Record<string, "left" | "right" | undefined>
  >({});
  /**
   * Generic busy-overlay label an addon drives via {@link setBusy}; null when
   * idle. The base owns no label text — it only renders the neutral overlay.
   */
  private readonly _busyLabel = signal<string | null>(null);
  /** Visually-hidden live-region text announcing sort/filter changes to AT. */
  readonly srAnnouncement = signal("");
  /**
   * The toolbar's search text. Two-way, so setting it filters programmatically —
   * but writing it directly bypasses {@link filterDebounce}, the page-index
   * reset and the {@link filterChange} emission that {@link onFilterChange} does.
   */
  readonly globalFilter = model("");
  /**
   * Per-column filter values keyed by accessor key. A value is applied only if
   * the column declares `enableFiltering`; it then runs the column's `filterFn`,
   * or a case-insensitive substring match on the cell's string value. Empty
   * values (null/''/[]) are skipped, so clearing a filter means writing one of
   * those, not deleting the key.
   */
  readonly columnFilters = model<Record<string, unknown>>({});
  /**
   * Bring-your-own AI hook. Enables natural-language filtering
   * (`applyNaturalLanguageFilter`) and column AI-fill (`aiFillColumn`). Optional;
   * no provider → those methods no-op (graceful degradation).
   */
  readonly aiProvider = input<AiProvider | undefined>(undefined);
  readonly hasAi = computed(() => this.aiProvider() !== undefined);
  /** Emitted after a natural-language query is compiled into a filter. */
  readonly nlFilter = output<{ query: string; spec: NlFilterSpec }>();
  /** Emitted after an AI column-fill completes. */
  readonly aiFillComplete = output<{ columnKey: string; count: number }>();
  /** When true (and `aiProvider` is set), the toolbar shows a natural-language filter box. */
  readonly enableNlFilter = input(true);
  readonly aiFilterQuery = signal("");
  readonly aiFilterRunning = signal(false);
  readonly nlFilterPlaceholder = computed(
    () => this.t().nlFilterPlaceholder ?? "Ask in plain English…",
  );

  /** Run the toolbar's natural-language filter query through the provider. */
  async runAiFilter(): Promise<void> {
    const query = this.aiFilterQuery().trim();
    if (!query || this.aiFilterRunning()) return;
    this.aiFilterRunning.set(true);
    try {
      await this.applyNaturalLanguageFilter(query);
    } finally {
      this.aiFilterRunning.set(false);
    }
  }

  /** Advanced AND/OR filter tree (A5). Applied in addition to global/column filters. */
  readonly advancedFilter = model<FilterGroup | null>(null);
  /** Show the advanced-filter builder button in the toolbar. */
  readonly enableAdvancedFilter = input(false);
  /** Non-null filter group for the builder UI (an empty AND group when unset). */
  readonly advancedFilterGroup = computed<FilterGroup>(
    () => this.advancedFilter() ?? { type: "group", combinator: "and", rules: [] },
  );
  /** {key,header} pairs offered by the builder (the user-defined columns). */
  readonly filterBuilderColumns = computed(() =>
    this.columns().map((c) => ({ key: String(c.accessorKey), header: c.header })),
  );
  /** Localized strings for the builder (locale `advancedFilter` section over English defaults). */
  readonly filterBuilderLabels = computed(
    () => this.t().advancedFilter ?? DEFAULT_FILTER_BUILDER_LABELS,
  );
  /** Number of leaf conditions in the active advanced filter (for the toolbar badge). */
  readonly advancedFilterCount = computed(() => this._countConditions(this.advancedFilter()));

  private _countConditions(group: FilterGroup | null): number {
    if (!group) return 0;
    return group.rules.reduce(
      (sum, rule) => sum + (rule.type === "group" ? this._countConditions(rule) : 1),
      0,
    );
  }

  /**
   * Stores a tree edited in the builder popover and returns to page 0, so a
   * narrowing edit cannot strand the view on a page past the end — the same
   * reset the global and column filter paths perform.
   */
  onAdvancedFilterChange(group: FilterGroup): void {
    this.advancedFilter.set(group);
    this.paginationState.update((state) => ({ ...state, pageIndex: 0 }));
  }

  /** Drops the advanced filter entirely; the global and column filters are untouched. */
  clearAdvancedFilter(): void {
    this.advancedFilter.set(null);
  }
  /**
   * Current single-column sort. Two-way, so writing it sorts programmatically
   * (locally, when {@link localSorting}) — but unlike {@link onSortChange} it
   * emits no {@link sortChange} and does not touch {@link multiSortState}.
   */
  readonly sortState = model<SortState>({ column: "", direction: null });
  /**
   * The ordered multi-sort chain, highest priority first. Only consulted while
   * {@link enableMultiSort} is on; capped at {@link maxMultiSortColumns}.
   */
  readonly multiSortState = model<SortState[]>([]);
  /**
   * Current page index and size. Two-way: the table resets `pageIndex` to 0
   * whenever a filter changes, so don't assume it stays where you put it.
   */
  readonly paginationState = model<PaginationState>({ pageIndex: 0, pageSize: 10 });
  /** Choices offered in the footer's page-size select. */
  readonly pageSizeOptions = input<number[]>([10, 20, 30, 40, 50]);
  /** Hides the page-size select while keeping the page buttons. */
  readonly showPageSizeSelector = input(true);
  /**
   * Runtime column widths (CSS length strings) keyed by accessor key,
   * overriding each column's declared `width`. Written by
   * {@link enableColumnResize}; a good thing to persist and restore — see
   * {@link getColumnState} / {@link applyColumnState}.
   */
  readonly columnWidths = model<Record<string, string>>({});
  /**
   * Column visibility keyed by accessor key. Only `false` hides — a missing key
   * counts as visible, so hiding requires writing `false`, not deleting.
   */
  readonly columnVisibility = model<Record<string, boolean>>({});
  /**
   * Accessor keys in display order. Keys absent from this array keep their
   * declaration order after the listed ones, so a partial order is legal.
   * Pinned/sticky columns are still grouped to their side.
   */
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

    data = this.applyColumnFiltersToData(data);
    return this.applyAdvancedFilter(data);
  });

  private applyAdvancedFilter(data: T[]): T[] {
    const group = this.advancedFilter();
    if (!group || group.rules.length === 0) return data;
    const columns = this.enhancedColumns();
    return data.filter((row) =>
      evaluateAdvancedFilter(group, (column) => {
        const col = columns.find((c) => String(c.accessorKey) === column);
        return this.getCellValue(row, col?.accessorKey ?? column, col);
      }),
    );
  }

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

  /**
   * Animation classes for a cell that just changed — green for a numeric
   * increase, red for a decrease, yellow for any other change — or `''` when the
   * cell is not flashing. Requires {@link enableCellFlash}.
   */
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
    this.setupTouchRangeSelection();
  }

  private _longPressCleanup: (() => void) | null = null;

  /** Touch: long-press a cell to enter range-selection, then drag to extend. */
  private setupTouchRangeSelection(): void {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;
    this._longPressCleanup = onLongPress(container, (event) => {
      if (!this.enableCellRangeSelection() || this.editingCell() !== null) return;
      const touch = event.touches[0];
      if (!touch) return;
      const cell = this.cellFromElement(this._document.elementFromPoint(touch.clientX, touch.clientY));
      if (!cell) return;
      this.startRangeDrag(cell, false);
    });
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
    this._document.removeEventListener('mousemove', this._onFillMove);
    this._document.removeEventListener('mouseup', this._onFillEnd);
    this._document.removeEventListener('touchmove', this._onFillMove);
    this._document.removeEventListener('touchend', this._onFillEnd);
    this._rangeDragCleanup?.();
    this._longPressCleanup?.();
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

  /**
   * Scroll handler for the virtualized viewport. Coalesces to one
   * `requestAnimationFrame` per frame, and ignores events raised by the table's
   * own compensating scrolls (variable row heights, {@link scrollToRow}).
   * Bound by the template only while virtualization is active.
   */
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

  /**
   * Maps an index within the rendered window to the index in the full row set,
   * by adding the window's start offset. Use it whenever a template callback
   * hands you a `$index` under virtualization — raw `$index` is window-relative.
   */
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

  /**
   * The active direction for a column, or `null` when unsorted. Reads the
   * multi-sort chain when {@link enableMultiSort} is on and {@link sortState}
   * otherwise, so it is the right accessor in both modes.
   */
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

  /**
   * Zero-based position of a column in the multi-sort chain, used to render the
   * priority badge. Always `null` when {@link enableMultiSort} is off, even if
   * the column is sorted.
   */
  getSortIndex(columnKey: string | keyof T): number | null {
    if (!this.enableMultiSort()) {
      return null;
    }
    return this._sortLookup().get(String(columnKey))?.index ?? null;
  }

  /**
   * Applies a sort and emits it — the programmatic equivalent of clicking a
   * header, and the entry point addons use. `multi` (shift-click) appends to
   * the chain instead of replacing it, but only while {@link enableMultiSort}
   * is on; the chain is then trimmed to the newest {@link maxMultiSortColumns}.
   *
   * Always emits {@link sortChange} (and {@link multiSortChange} in multi mode)
   * and, if you were past page 0, resets the page and emits {@link pageChange}.
   * With {@link localSorting} false the rows are left untouched.
   */
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

    if (this.cellActionSlots().length > 0) {
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

  /**
   * Whether the floating-filter row actually renders a control for this column.
   * A cell that renders nothing is not a column header — announcing it as an
   * empty one is noise for screen-reader users (axe `empty-table-header`).
   */
  hasFloatingFilter(col: ColumnDef<T>): boolean {
    if (col.floatingFilter === false) return false;
    if (
      col.accessorKey === '_selection' ||
      col.accessorKey === '_expander' ||
      col.accessorKey === '_actions'
    ) {
      return false;
    }
    if (col.floatingFilterComponent) return true;
    if (col.floatingFilterTemplate) return true;
    return !!col.enableFiltering;
  }

  /**
   * Builds the change callback handed to a column's floating-filter
   * template/component. Calling it is equivalent to
   * {@link onColumnFilterChange} for that column — a new function identity per
   * call, so bind it in the template rather than comparing references.
   */
  getFloatingFilterChange(col: ColumnDef<T>): (value: unknown) => void {
    return (value: unknown) =>
      this.onColumnFilterChange(col.accessorKey, value);
  }

  /** Whether {@link fullWidthRow} claims this row; false when no predicate is set. */
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

  /**
   * Whether a cell falls inside the selected rectangle (drives its highlight).
   * `rowIndex` is the index in the rendered rows, and columns are compared by
   * position among the navigable (non-`_selection`/`_expander`/`_actions`)
   * columns, so a hidden or reordered column changes the answer.
   */
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

  /** Selected range reshaped per column: header + cell values, or null when no range. */
  private readonly rangeColumns = computed(() => {
    const range = this.normalizedCellRange();
    if (!range) return null;
    const keys = this.navigableColumnKeys().slice(range.minCol, range.maxCol + 1);
    const data = this.processedData();
    const columns = this.enhancedColumns();
    const result = keys.map((key) => {
      const col = columns.find((c) => String(c.accessorKey) === key);
      return { key, header: col?.header ?? key, col, values: [] as unknown[] };
    });
    for (let r = range.minRow; r <= range.maxRow; r++) {
      const row = data[r];
      if (!row) continue;
      for (const entry of result) {
        if (entry.col) {
          entry.values.push(this.getCellValue(row, entry.col.accessorKey, entry.col));
        }
      }
    }
    return result;
  });

  /** Live Sum / Avg / Count / Min / Max of the selected range; null unless a multi-cell range is active. */
  readonly rangeSelectionStats = computed<RangeAggregateStats | null>(() => {
    if (!this.enableRangeActions()) return null;
    const cols = this.rangeColumns();
    if (!cols) return null;
    const values = cols.flatMap((c) => c.values);
    if (values.length < 2) return null;
    const numericCount = values.map(Number).filter(Number.isFinite).length;
    return {
      count: values.length,
      numericCount,
      sum: computeAggregateValue(values, "sum"),
      avg: computeAggregateValue(values, "avg"),
      min: computeAggregateValue(values, "min"),
      max: computeAggregateValue(values, "max"),
    };
  });

  /** The selected range as chart data: first column → categories, numeric columns → series. */
  readonly rangeChartPayload = computed<RangeChartPayload | null>(() => {
    const cols = this.rangeColumns();
    if (!cols || cols.length === 0) return null;
    const rowCount = cols[0].values.length;
    if (rowCount === 0) return null;
    const numericCols = cols.filter((c) =>
      c.values.some((v) => Number.isFinite(Number(v))),
    );
    if (numericCols.length === 0) return null;
    const labelCol = cols.find((c) => !numericCols.includes(c));
    const categories = this._rangeCategories(labelCol?.values, rowCount);
    const series = numericCols.map((c) => ({
      name: c.header,
      values: c.values.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0)),
    }));
    return { categories, series };
  });

  private _rangeCategories(labelValues: unknown[] | undefined, rowCount: number): string[] {
    if (labelValues) {
      return labelValues.map((v) => stringifyValue(v));
    }
    return Array.from({ length: rowCount }, (_, i) => `Row ${i + 1}`);
  }

  /** Emit the chart payload for the selected range. No-op when it has no numeric data. */
  openRangeChart(): void {
    const payload = this.rangeChartPayload();
    if (!payload) return;
    this.rangeChartOpen.emit(payload);
  }

  /** The current fill source: the selected range, or the focused cell as a 1×1 range. */
  private fillSourceRange(): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
    const range = this.normalizedCellRange();
    if (range) return range;
    const focused = this.focusedCell();
    if (!focused) return null;
    const colIdx = this.navigableColumnKeys().indexOf(focused.columnKey);
    if (colIdx < 0) return null;
    return { minRow: focused.rowIndex, maxRow: focused.rowIndex, minCol: colIdx, maxCol: colIdx };
  }

  private fillColumn(key: string, source: { minRow: number; maxRow: number }, fillCount: number): boolean {
    const col = this.enhancedColumns().find((c) => String(c.accessorKey) === key);
    if (!col?.valueSetter) return false;
    const data = this.processedData();
    const sourceValues: unknown[] = [];
    for (let r = source.minRow; r <= source.maxRow; r++) {
      const row = data[r];
      if (row) sourceValues.push(this.getCellValue(row, col.accessorKey, col));
    }
    const fillValues = buildFillValues(sourceValues, fillCount);
    let applied = false;
    for (let i = 0; i < fillCount; i++) {
      const rowIndex = source.maxRow + 1 + i;
      const targetRow = this.processedData()[rowIndex];
      if (!targetRow) continue;
      const value = fillValues[i];
      if (this.validateEdit(col, targetRow, value, { rowIndex, columnKey: key })) {
        this.applyValueSetter(col, targetRow, value);
        applied = true;
      }
    }
    return applied;
  }

  /**
   * Excel-style fill: extend the source range/cell down to `targetEndRow`,
   * filling each column's pattern into the new rows. No-op when the target is
   * not below the source.
   */
  fillDownTo(targetEndRow: number): void {
    const source = this.fillSourceRange();
    if (!source || targetEndRow <= source.maxRow) return;
    const keys = this.navigableColumnKeys().slice(source.minCol, source.maxCol + 1);
    const fillCount = targetEndRow - source.maxRow;
    let filledKeys: string[] = [];
    this.runAsCommand(() => {
      filledKeys = keys.filter((key) => this.fillColumn(key, source, fillCount));
    });
    if (filledKeys.length === 0) return;
    this.cellRange.set({
      startRow: source.minRow,
      startCol: keys[0],
      endRow: targetEndRow,
      endCol: keys.at(-1) ?? keys[0],
    });
    this.fillSeries.emit({
      source: { minRow: source.minRow, maxRow: source.maxRow },
      filled: { startRow: source.maxRow + 1, endRow: targetEndRow },
      columnKeys: filledKeys,
    });
  }

  private coercePasteValue(raw: string, row: T, col: ColumnDef<T>): unknown {
    const current = this.getCellValue(row, col.accessorKey, col);
    if (typeof current === "number") {
      const num = Number(raw);
      return Number.isFinite(num) ? num : raw;
    }
    if (typeof current === "boolean") {
      return raw.toLowerCase() === "true";
    }
    return raw;
  }

  private pasteCell(rowIndex: number, key: string, raw: string): "applied" | "rejected" | "skipped" {
    const col = this.enhancedColumns().find((c) => String(c.accessorKey) === key);
    const targetRow = this.processedData()[rowIndex];
    if (!col?.valueSetter || !targetRow) return "skipped";
    const value = this.coercePasteValue(raw, targetRow, col);
    if (!this.validateEdit(col, targetRow, value, { rowIndex, columnKey: key })) {
      return "rejected";
    }
    this.applyValueSetter(col, targetRow, value);
    return "applied";
  }

  private pasteGridAt(startRow: number, startColumn: string, grid: string[][]): void {
    const keys = this.navigableColumnKeys();
    const startCol = keys.indexOf(startColumn);
    if (startCol < 0) return;
    let cellsApplied = 0;
    let cellsRejected = 0;
    this.runAsCommand(() => {
      grid.forEach((cells, r) => {
        cells.forEach((raw, c) => {
          if (startCol + c >= keys.length) return;
          const key = keys[startCol + c];
          const result = this.pasteCell(startRow + r, key, raw);
          if (result === "applied") cellsApplied++;
          else if (result === "rejected") cellsRejected++;
        });
      });
    });
    this.cellsPaste.emit({
      startRow,
      startColumn,
      rowsAffected: grid.length,
      cellsApplied,
      cellsRejected,
    });
  }

  private async pasteFromClipboard(startRow: number, startColumn: string): Promise<void> {
    const text = await navigator.clipboard.readText();
    const grid = parseClipboardGrid(text);
    if (grid.length > 0) this.pasteGridAt(startRow, startColumn, grid);
  }

  /** Which cell shows the fill handle: bottom-right of the range, or the focused cell. Null while editing. */
  private readonly fillHandleCell = computed<{ rowIndex: number; columnKey: string } | null>(() => {
    if (!this.enableFillHandle() || this.editingCell() !== null) return null;
    const range = this.normalizedCellRange();
    if (range) {
      const keys = this.navigableColumnKeys();
      return { rowIndex: range.maxRow, columnKey: keys[range.maxCol] };
    }
    return this.focusedCell();
  });

  /** Pixel position of the fill handle within the scroll container's content, or null when hidden. */
  readonly fillHandlePosition = signal<{ top: number; left: number } | null>(null);

  private computeFillHandlePosition(): { top: number; left: number } | null {
    const cell = this.fillHandleCell();
    if (!cell) return null;
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return null;
    const rowEl = container.querySelector(`[data-row-index="${cell.rowIndex}"]`);
    if (!rowEl) return null;
    const cellEl = Array.from(
      rowEl.querySelectorAll<HTMLElement>("[data-column]"),
    ).find((el) => el.dataset["column"] === cell.columnKey);
    if (!cellEl) return null;
    const containerRect = container.getBoundingClientRect();
    const rect = cellEl.getBoundingClientRect();
    const x = this.isRtl() ? rect.left : rect.right;
    return {
      top: rect.bottom - containerRect.top + container.scrollTop,
      left: x - containerRect.left + container.scrollLeft,
    };
  }

  // Re-position the single fill-handle overlay after each relevant render. Works
  // across the flat, virtual and tree paths since all expose data-row-index /
  // data-column; the virtual-visible signals are read so it tracks scroll.
  /**
   * Stamp the grid's position semantics onto the rendered rows and cells.
   *
   * `aria-rowcount` / `aria-rowindex` exist for exactly this component's
   * situation: the DOM holds a window of ~30 rows out of a dataset of any size,
   * so assistive tech that counts DOM rows announces "row 3 of 30" and the user
   * has no idea where they are. The count must therefore be the dataset's and
   * the index must be absolute.
   *
   * Done here rather than as template bindings because this template renders
   * rows from six different branches — virtual and non-virtual, flat, tree and
   * grouped — plus detail rows, full-width rows and group headers that occupy
   * real row positions without appearing in any row array. Numbering from the
   * DOM is the only way to stay consistent with what was actually rendered; a
   * per-branch binding would number the branches it knew about and silently
   * skip the rest.
   */
  private stampGridSemantics(): void {
    const grid = this._el.nativeElement.querySelector('[data-slot="table"]');
    if (!grid) return;

    /*
     * Spacer rows and filler header cells exist only to make the flex layout
     * fill its container. They are hidden from assistive tech, and counting
     * them would put every index and both totals out by one.
     */
    const isDecorative = (el: Element): boolean =>
      el.getAttribute('aria-hidden') === 'true' || el.getAttribute('role') === 'presentation';

    const rows = [...grid.querySelectorAll('[data-slot="table-row"]')].filter(
      row => !isDecorative(row),
    );
    const isHeaderRow = (row: Element): boolean =>
      row.closest('[data-slot="table-header"]') !== null;
    const headerRows = rows.filter(isHeaderRow).length;

    /*
     * Under virtualization the first rendered row is not row one; the scroller
     * says which absolute row it is. Everywhere else the DOM already holds the
     * whole set the grid represents.
     */
    const offset = this.isVirtualScrollActive() ? this.virtualRowRange().start : 0;

    /*
     * Column indices come from DOM order, which is the true visual order —
     * pinned-left, then centre, then pinned-right. That is only *absolute*
     * when every column is present, so when the middle columns are windowed
     * the index is left off rather than published wrong. A missing
     * `aria-colindex` is a gap; a wrong one sends the user to the wrong column.
     */
    const columnsWindowed =
      this.virtualVisibleMiddleColumns().length < this.scrollableColumns().length;

    let dataRow = 0;
    for (const [position, row] of rows.entries()) {
      const index = isHeaderRow(row)
        ? position + 1
        : headerRows + offset + ++dataRow;
      row.setAttribute('aria-rowindex', String(index));

      if (columnsWindowed) continue;
      const cells = [...row.children].filter(cell => !isDecorative(cell));
      for (const [column, cell] of cells.entries()) {
        cell.setAttribute('aria-colindex', String(column + 1));
      }
    }

    const dataRows = this.isVirtualScrollActive()
      ? this.virtualTotalRows()
      : rows.length - headerRows;
    grid.setAttribute('aria-rowcount', String(headerRows + dataRows));
    grid.setAttribute('aria-colcount', String(this.enhancedColumns().length));
  }

  private readonly _gridSemanticsEffect = afterRenderEffect(() => {
    // Re-stamp whenever the rendered window, the data or the columns move.
    this.virtualRowRange();
    this.processedData();
    this.enhancedColumns();
    this.virtualTotalRows();
    this.stampGridSemantics();
  });

  private readonly _fillHandlePositionEffect = afterRenderEffect(() => {
    this.fillHandleCell();
    this.data();
    this.virtualVisibleRows();
    this.virtualVisibleTreeRows();
    this.fillHandlePosition.set(
      this.enableFillHandle() ? this.computeFillHandlePosition() : null,
    );
  });

  private _fillSource: { minRow: number; maxRow: number; minCol: number; maxCol: number } | null = null;
  private readonly _fillPreviewEndRow = signal<number | null>(null);

  /**
   * Whether a cell is in the dashed preview band below the source range during
   * a fill-handle drag. Only rows *after* the source are ever previewed —
   * dragging upwards previews nothing.
   */
  isCellInFillPreview(rowIndex: number, columnKey: string): boolean {
    const source = this._fillSource;
    const end = this._fillPreviewEndRow();
    if (!source || end === null) return false;
    const colIdx = this.navigableColumnKeys().indexOf(columnKey);
    return (
      rowIndex > source.maxRow &&
      rowIndex <= end &&
      colIdx >= source.minCol &&
      colIdx <= source.maxCol
    );
  }

  /**
   * Begins a fill-handle drag (mouse or touch) from the current range or focused
   * cell, attaching document-level move/end listeners that track the pointer by
   * hit-testing rows. The values are written on release, through each column's
   * `valueSetter` only — columns without one are skipped. See
   * {@link enableFillHandle} and {@link fillSeries}.
   */
  onFillHandleStart(event: Event): void {
    this._fillSource = this.fillSourceRange();
    if (!this._fillSource) return;
    event.preventDefault();
    event.stopPropagation();
    this._fillPreviewEndRow.set(this._fillSource.maxRow);
    this._document.addEventListener("mousemove", this._onFillMove);
    this._document.addEventListener("mouseup", this._onFillEnd);
    this._document.addEventListener("touchmove", this._onFillMove, { passive: false });
    this._document.addEventListener("touchend", this._onFillEnd);
  }

  private readonly _onFillMove = (event: MouseEvent | TouchEvent): void => {
    const point = "touches" in event ? event.touches[0] : event;
    if (!point) return;
    if ("touches" in event) event.preventDefault();
    const target = this._document.elementFromPoint(point.clientX, point.clientY);
    const rowEl = target?.closest<HTMLElement>("[data-row-index]");
    const raw = rowEl?.dataset["rowIndex"];
    if (raw === undefined) return;
    const idx = Number(raw);
    if (Number.isFinite(idx)) this._fillPreviewEndRow.set(idx);
  };

  private readonly _onFillEnd = (): void => {
    this._document.removeEventListener("mousemove", this._onFillMove);
    this._document.removeEventListener("mouseup", this._onFillEnd);
    this._document.removeEventListener("touchmove", this._onFillMove);
    this._document.removeEventListener("touchend", this._onFillEnd);
    const end = this._fillPreviewEndRow();
    this._fillPreviewEndRow.set(null);
    this._fillSource = null;
    if (end !== null) this.fillDownTo(end);
  };

  /** Localized labels for the range readout (English fallback). */
  readonly rangeLabels = computed(() => {
    const l = this.t();
    return {
      count: l.rangeCount ?? "Count",
      sum: l.rangeSum ?? "Sum",
      avg: l.rangeAvg ?? "Avg",
      min: l.rangeMin ?? "Min",
      max: l.rangeMax ?? "Max",
      chart: l.rangeChart ?? "Chart",
    };
  });

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

  /**
   * Classes for a header cell (stickiness, pin shadow, borders), served from a
   * precomputed per-column map. A column not in the resolved set — the trailing
   * filler head — falls back to a generic sticky header class.
   */
  getHeaderClass(col: CellStyleColumn): string {
    return (
      this._headerClassMap().get(String(col.accessorKey)) ??
      this._fillerHeaderClass()
    );
  }

  /**
   * Classes for a body cell. Pass `rowIndex` (in rendered order) to get the
   * focus ring / range tint / fill-preview outline — omit it and you get only
   * the static base. Passing `treeDepth` selects the tree variant of that base;
   * the depth indent itself comes from {@link getTreeCellStyle}.
   */
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
      // Active/anchor cell: stays prominent even inside a tinted range.
      return base + " bg-background ring-2 ring-primary ring-inset relative z-10";
    }
    if (rowIndex !== undefined && this.isCellInRange(rowIndex, key)) {
      return base + " bg-primary/15";
    }
    if (rowIndex !== undefined && this.isCellInFillPreview(rowIndex, key)) {
      return base + " bg-primary/5 ring-1 ring-dashed ring-primary/40 ring-inset";
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

  /**
   * Inline style object for a header cell — width/flex plus the `left`/`right`
   * offset that stacks pinned columns. Cached per column; an unknown column is
   * computed on the fly.
   */
  getHeaderCellStyle(col: CellStyleColumn): Record<string, string> {
    return (
      this._headerCellStyleMap().get(String(col.accessorKey)) ??
      this._buildCellStyle(col, true)
    );
  }

  /**
   * Inline style object for a body cell — the {@link getHeaderCellStyle}
   * counterpart, reflecting the live {@link columnWidths} entry when the column
   * has been resized.
   */
  getCellStyle(col: CellStyleColumn): Record<string, string> {
    return (
      this._cellStyleMap().get(String(col.accessorKey)) ??
      this._buildCellStyle(col, false)
    );
  }

  /**
   * {@link getCellStyle} plus the depth-shaded background used in tree mode.
   * Shading saturates at depth 10 (the cache bound) and at 80% blend, so deeper
   * levels are visually identical.
   */
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

  /**
   * Whether a row is non-interactive — true if either {@link isRowDisabled}
   * says so or its id is in {@link disabledRowIds}. Blocks selection, drag and
   * inline editing, and greys the row.
   */
  isDisabled(row: T): boolean {
    const fn = this.isRowDisabled();
    if (fn?.(row)) return true;
    const id = this.getRowId()(row);
    return this.disabledRowIdSet().has(id);
  }

  /** Whether the row's {@link getRowId} is flagged in {@link rowSelection}. */
  isRowSelected(row: T): boolean {
    const id = this.getRowId()(row);
    return !!this.rowSelection()[id];
  }

  /**
   * Flips one row's selection, writing a new {@link rowSelection} object
   * (deselecting deletes the key rather than storing `false`). A disabled row is
   * ignored. Does not cascade to children — see {@link toggleRowWithCascade}.
   */
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

  /** Whether the row's master/detail panel is open ({@link enableRowExpansion}, not tree mode). */
  isRowExpanded(row: T): boolean {
    const id = this.getRowId()(row);
    return !!this.expandedRows()[id];
  }

  /**
   * Opens or closes a row's detail panel and stops propagation of the given
   * event so the chevron click does not also select or focus the row. Unlike
   * selection, this ignores {@link isDisabled}.
   */
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

  /**
   * Expands every currently *filtered* row's detail panel, or collapses them all
   * when they are already open. Rows hidden by the active filter are left as
   * they are, so the header checkbox reflects only the filtered set.
   */
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

  /**
   * Resolves the inputs for a row's {@link rowDetailComponent} via
   * {@link rowDetailComponentInputs}, or `{}` when no resolver is set (the
   * template then binds just the row).
   */
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

  /**
   * The header checkbox action: selects every selectable row in the *filtered*
   * set, or clears just those when all are already selected. Disabled rows and
   * rows hidden by the filter are never touched, so selections made under a
   * previous filter survive.
   */
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

  /**
   * Adds rows to the selection by {@link getRowId}, leaving existing entries
   * alone. Bypasses {@link isDisabled} — unlike {@link toggleRow}, this selects
   * disabled rows too.
   */
  selectRows(rows: T[]): void {
    const getId = this.getRowId();
    const next = { ...this.rowSelection() };
    rows.forEach((row) => (next[getId(row)] = true));
    this.rowSelection.set(next);
  }

  /** Removes the given rows' ids from the selection; ids not present are ignored. */
  unselectRows(rows: T[]): void {
    const getId = this.getRowId();
    const next = { ...this.rowSelection() };
    rows.forEach((row) => delete next[getId(row)]);
    this.rowSelection.set(next);
  }

  /**
   * Empties {@link rowSelection} outright — including ids of rows currently
   * filtered out, which {@link toggleAll} would have preserved.
   */
  clearSelection(): void {
    this.rowSelection.set({});
  }

  /**
   * Selects every selectable row in the filtered set without toggling: calling
   * it twice leaves the selection selected. Disabled rows are skipped.
   */
  selectAll(): void {
    const nextSelection = { ...this.rowSelection() };
    this.selectableRowIds().forEach((id) => {
      nextSelection[id] = true;
    });
    this.rowSelection.set(nextSelection);
  }

  /**
   * Applies a requested page state and emits {@link pageChange}. The index is
   * clamped to the last page — computed from the filtered row count locally, or
   * from {@link total} when {@link localPagination} is false — and a
   * non-positive page size is rejected in favour of the current one.
   */
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

  /**
   * The global-filter input handler: waits out {@link filterDebounce}, then sets
   * {@link globalFilter}, resets to page 0, emits {@link filterChange} and
   * announces the result count to screen readers.
   */
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

  /**
   * Sets one column's filter value and returns to page 0. Not debounced, and it
   * emits no output — {@link filterChange} carries the global filter only, so
   * for server-side filtering read {@link columnFilters} instead.
   */
  onColumnFilterChange(columnKey: string | keyof T, value: unknown): void {
    this.loadingTrigger.set("filtering");
    this.columnFilters.update((filters) => ({
      ...filters,
      [columnKey]: value,
    }));
    this.paginationState.update((state) => ({ ...state, pageIndex: 0 }));
  }

  /** Whether a column renders — true unless {@link columnVisibility} holds an explicit `false`. */
  isColumnVisible(columnKey: string | keyof T): boolean {
    return this.columnVisibility()[String(columnKey)] !== false;
  }

  /**
   * Shows or hides a column, writing into {@link columnVisibility}. Accepts any
   * key — an unknown one is simply stored and never consulted. Hidden columns
   * are still excluded from copy/export and from cell navigation.
   */
  setColumnVisibility(columnKey: string | keyof T, visible: boolean): void {
    this.columnVisibility.update((current) => ({
      ...current,
      [String(columnKey)]: visible,
    }));
  }

  /**
   * Moves a column to `targetIndex` in the current order and rewrites
   * {@link columnOrder} as a complete key list. The index is clamped to the
   * range, and an unknown key is a no-op. Works regardless of
   * {@link enableColumnReorder}, which only gates the drag UI.
   */
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

  /**
   * Whether this header can start a drag: {@link enableColumnReorder} must be on
   * and the column must be reorderable (the built-in `_selection`/`_expander`/
   * `_actions` columns and `enableReorder: false` columns are not).
   */
  isColumnDraggable(col: ColumnDef<T>): boolean {
    return this.enableColumnReorder() && this.isColumnReorderable(col);
  }

  /** Whether this column is the one currently being dragged (drives its ghost styling). */
  isDraggingColumn(col: ColumnDef<T>): boolean {
    return this.draggedColumnKey() === String(col.accessorKey);
  }

  /** Whether this column is the current drop target (drives the insertion indicator). */
  isDropTargetColumn(col: ColumnDef<T>): boolean {
    return this.dropTargetColumnKey() === String(col.accessorKey);
  }

  /**
   * Starts a header drag, recording the source key both in component state and
   * on the `dataTransfer` payload (some browsers only expose the latter on
   * drop). Silently ignored for a non-draggable column.
   */
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

  /**
   * Marks a header as the drop target while a column drag hovers it. Declines
   * (leaving the browser's "no drop" cursor) for a non-draggable target or when
   * the source and target are the same column.
   */
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

  /**
   * Completes a header drag by moving the source column to the target's
   * position and updating {@link columnOrder}; drag state is cleared on every
   * path, including the rejected ones. No output is emitted — observe
   * `columnOrder` to persist the new order.
   */
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

  /** Clears the drag/drop-target highlight when a header drag ends anywhere, including a cancel. */
  onColumnDragEnd(): void {
    this.clearColumnDragState();
  }

  /**
   * Snapshots per-column width, visibility, pin and order — the shape to persist
   * for a "my table layout" feature and replay through {@link applyColumnState}.
   * Widths, visibility and pin all fall back to each column's declaration when
   * no runtime override exists, so a {@link pinColumn} override round-trips
   * through {@link applyColumnState}.
   */
  getColumnState(): DataTableColumnState[] {
    const widths = this.columnWidths();
    const visibility = this.columnVisibility();
    const pins = this.columnPinOverrides();
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
        pin: key in pins ? pins[key] : col.pin,
        order: orderIndex.get(key),
      };
    });
  }

  /** The value being edited, read as a date for `editType: 'date'`. */
  editDateValue(): Date | null {
    return asEditableDate(this.editValue());
  }

  /**
   * Commit a date picked in a `editType: 'date'` cell.
   *
   * The shape is read from the value still in the editor — which is the cell's
   * original, because the picker commits on the first change — so a column
   * holding ISO strings keeps holding ISO strings. Changing a cell's type
   * behind the consumer's back is the failure mode here, not a wrong day.
   */
  onEditDateChange(picked: Date | null): void {
    const next = toEditedDateValue(picked, this.editValue());
    this.onEditValueChange(next);
    this.commitEdit();
  }

  /**
   * The whole view as one token: layout, sort, filters and page.
   *
   * {@link getColumnState} covers the layout, which is what a "reset my
   * columns" feature needs. This is what a *named view* needs — someone who
   * saved "My open invoices" expects the filters and the sort back, not just
   * the column widths.
   *
   * Persist it as JSON. It carries a {@link DATA_TABLE_VIEW_STATE_VERSION} so
   * that a token written by an older build is recognised rather than guessed
   * at.
   *
   * @publicApi
   */
  getViewState(): DataTableViewState {
    return {
      version: DATA_TABLE_VIEW_STATE_VERSION,
      columns: this.getColumnState(),
      sort: this.sortState(),
      sortStates: this.multiSortState(),
      columnFilters: this.columnFilters(),
      advancedFilter: this.advancedFilter(),
      globalFilter: this.globalFilter(),
      pagination: this.paginationState(),
    };
  }

  /**
   * Restore a {@link getViewState} token. Returns whether it was applied.
   *
   * A token from an unknown version is **refused outright** rather than
   * applied field by field. Half-restoring a saved view is worse than refusing
   * it: the user gets a table that is nearly right and has no way to tell which
   * parts are stale. The boolean is there so a consumer can drop a token it
   * can no longer read instead of failing silently.
   *
   * @publicApi
   */
  applyViewState(state: DataTableViewState | null | undefined): boolean {
    if (!state || state.version !== DATA_TABLE_VIEW_STATE_VERSION) return false;

    this.applyColumnState(state.columns);
    this.sortState.set(state.sort);
    this.multiSortState.set(state.sortStates);
    this.columnFilters.set(state.columnFilters);
    this.advancedFilter.set(state.advancedFilter);
    this.globalFilter.set(state.globalFilter);
    this.paginationState.set(state.pagination);
    return true;
  }

  /**
   * Restores a {@link getColumnState} snapshot into {@link columnVisibility},
   * {@link columnWidths}, {@link columnPinOverrides} and {@link columnOrder}.
   * Merges rather than replaces: columns missing from `states`, and fields left
   * out entirely, keep their current value, and an empty array is ignored. A
   * state carrying a `pin` key of `undefined` — as {@link getColumnState}
   * always does for an unpinned column — clears that column's pin.
   */
  applyColumnState(states: DataTableColumnState[]): void {
    if (!states || states.length === 0) {
      return;
    }

    const nextVisibility = { ...this.columnVisibility() };
    const nextWidths = { ...this.columnWidths() };
    const nextPins = { ...this.columnPinOverrides() };
    const orderEntries: Array<{ key: string; order: number }> = [];

    states.forEach((state) => {
      const key = String(state.columnKey);
      if (state.visible !== undefined) {
        nextVisibility[key] = state.visible;
      }
      if (state.width) {
        nextWidths[key] = state.width;
      }
      if ('pin' in state) {
        nextPins[key] = state.pin;
      }
      if (state.order !== undefined) {
        orderEntries.push({ key, order: state.order });
      }
    });

    this.columnPinOverrides.set(nextPins);

    if (orderEntries.length > 0) {
      const sortedOrder = [...orderEntries]
        .sort((a, b) => a.order - b.order)
        .map((entry) => entry.key);
      this.columnOrder.set(sortedOrder);
    }

    this.columnVisibility.set(nextVisibility);
    this.columnWidths.set(nextWidths);
  }

  /**
   * Declares what the current {@link loading} spell is for, so
   * {@link loadingVisibility} can suppress the overlay and the loader
   * template/component can react. The table sets it itself for sorting,
   * filtering and pagination; call it before flipping `loading` for your own
   * fetches.
   */
  setLoadingTrigger(trigger: DataTableLoadingTrigger): void {
    this.loadingTrigger.set(trigger);
  }

  /**
   * Resolves the inputs for a column's custom filter component, calling
   * `filterComponentInputs` when it is a factory so the values can be computed
   * per render. `{}` when the column declares none.
   */
  getFilterInputs(col: ColumnDef<T>): Record<string, unknown> {
    if (typeof col.filterComponentInputs === "function") {
      return col.filterComponentInputs();
    }
    return col.filterComponentInputs ?? {};
  }

  /**
   * Output handlers bound onto a column's custom filter component. The table's
   * own `filterChange` handler is appended last and therefore overrides any
   * `filterChange` in `filterComponentOutputs` — that is the wire that makes a
   * custom filter actually filter.
   */
  getFilterOutputs(col: ColumnDef<T>): Record<string, (event: unknown) => void> {
    return {
      ...col.filterComponentOutputs,
      filterChange: (value: unknown) =>
        this.onColumnFilterChange(col.accessorKey, value),
    };
  }

  /** Whether this column holds a non-empty filter value — drives the "filtered" header indicator. */
  isColumnFilterActive(col: ColumnDef<T>): boolean {
    const value = this.columnFilters()[col.accessorKey as string];
    return !this.isFilterValueEmpty(value);
  }

  /**
   * The "no filter" test used to skip column filters: `undefined`, `null`, `''`,
   * an empty array (an emptied multiselect), and a date range whose `start` and
   * `end` are both null.
   */
  isFilterValueEmpty(value: unknown): boolean {
    if (value === undefined || value === null || value === "") return true;
    if (Array.isArray(value)) return value.length === 0;
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

  /**
   * The raw (unformatted) value behind a cell — what sorting, filtering and
   * export all compare against. A column `accessorFn` wins outright; otherwise a
   * dotted `key` is walked as a path (`'user.name'`), returning `undefined` at
   * the first null/undefined link rather than throwing.
   */
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

  /**
   * Resolve value-aware conditional formatting for a cell. Returns `null` when
   * the column declares none, so unformatted cells render with zero overhead.
   */
  getCellFormatting(col: ColumnDef<T>, row: T): ResolvedCellFormatting | null {
    if (!this._hasConditionalFormatting(col)) {
      return null;
    }
    const value = this.getCellValue(row, col.accessorKey, col);
    return {
      class: this._resolveCellClassRules(col, value, row),
      style: this._resolveCellStyle(col, value, row),
      dataBar: this._resolveDataBar(col, value),
      icon: col.iconSet?.(value, row) ?? null,
    };
  }

  private _hasConditionalFormatting(col: ColumnDef<T>): boolean {
    return (
      col.cellClassRules !== undefined ||
      col.cellStyleRules !== undefined ||
      col.colorScale !== undefined ||
      col.dataBar !== undefined ||
      col.iconSet !== undefined
    );
  }

  private _resolveCellClassRules(col: ColumnDef<T>, value: unknown, row: T): string {
    if (!col.cellClassRules) {
      return "";
    }
    const out: string[] = [];
    for (const rule of col.cellClassRules) {
      if (rule.when(value, row)) {
        out.push(rule.class);
      }
    }
    return out.join(" ");
  }

  private _resolveCellStyle(col: ColumnDef<T>, value: unknown, row: T): Record<string, string> {
    const style = col.cellStyleRules?.(value, row) ?? {};
    if (!col.colorScale) {
      return style;
    }
    const bg = this._colorScaleBackground(col.colorScale, value);
    return bg ? { ...style, "background-color": bg } : style;
  }

  private _colorScaleBackground(scale: ColorScale, value: unknown): string | null {
    const num = this._toFiniteNumber(value);
    if (num === null) {
      return null;
    }
    const pct = this._positionPercent(num, scale.min, scale.max);
    return `color-mix(in srgb, ${scale.to} ${pct}%, ${scale.from})`;
  }

  private _resolveDataBar(
    col: ColumnDef<T>,
    value: unknown,
  ): { width: string; color: string; track: string | null } | null {
    if (!col.dataBar) {
      return null;
    }
    const num = this._toFiniteNumber(value);
    if (num === null) {
      return null;
    }
    const pct = this._positionPercent(num, col.dataBar.min, col.dataBar.max);
    return {
      width: `${pct}%`,
      color: col.dataBar.color,
      track: col.dataBar.track ?? null,
    };
  }

  private _toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
      const num = Number.parseFloat(value);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  }

  private _positionPercent(value: number, min: number, max: number): number {
    if (max === min) {
      return 0;
    }
    const pct = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  /**
   * The text form of a cell used for copy and export: the column's `cell`
   * formatter when present, else — for a column rendered by a `template` or
   * `component` — the text currently rendered in that cell, else the raw value
   * stringified (null/undefined become `''`, objects via a custom `toString` or
   * JSON). A templated row that is not in the DOM (another page, or scrolled out
   * of a virtualised viewport) has no rendered text to read and falls back to
   * the raw value.
   */
  getCellStringValue(row: T, column: ColumnDef<T>): string {
    if (column.cell) {
      return column.cell(row);
    }
    if (column.template || column.component) {
      const rendered = this.getRenderedCellText(row, column);
      if (rendered !== null) return rendered;
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

  private getRenderedCellText(row: T, column: ColumnDef<T>): string | null {
    const host = this._el.nativeElement as HTMLElement | undefined;
    if (typeof host?.querySelector !== "function") return null;

    const rowId = CSS.escape(String(this.getRowId()(row)));
    const key = CSS.escape(String(column.accessorKey));

    let cell: Element | null;
    try {
      cell = host.querySelector(`[data-row-id=${rowId}] [data-column=${key}]`);
    } catch {
      return null;
    }
    if (!cell) return null;

    return (cell.textContent ?? "").trim();
  }

  /**
   * Shapes the table into a `string[][]` grid (header row first) for copy and
   * for the export addon. Defaults to visible columns and filtered + sorted rows
   * across *all* pages — not just the current page — and always drops the
   * `_selection`/`_expander`/`_actions` columns. `customRows` overrides the row
   * source entirely (e.g. selection-only export), ignoring `onlyFiltered`.
   */
  getExportData(
    options?: DataTableExportOptions,
    customRows?: readonly T[],
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
      customRows ?? (onlyFiltered ? this.sortedData() : this.data());
    const result: string[][] = [];

    if (includeHeaders) {
      result.push(columns.map((col) => col.header));
    }

    for (const row of rows) {
      result.push(columns.map((col) => this.getCellStringValue(row, col)));
    }

    return result;
  }

  /** The filtered + sorted rows across every page (addon export seam). */
  getSortedRows(): readonly T[] {
    return this.sortedData();
  }

  /** The raw, unfiltered input rows (addon transform seam, e.g. pivot). */
  getRawRows(): readonly T[] {
    return this.data();
  }

  private _lastEmittedQuery: DataTableQuery | null = null;

  /**
   * Emit {@link query} whenever the request actually changes.
   *
   * Guarded on the *contents* rather than left to signal identity: several of
   * these are `model()`s holding objects, and a write of an equal-but-new
   * object would otherwise emit again — which on a server-side table is a
   * duplicate round trip, not a wasted tick.
   *
   * The first run is the initial state, so there is nothing to report yet; see
   * {@link currentQuery}.
   */
  private readonly _queryEmitter = effect(() => {
    const next = this.currentQuery();
    const previous = this._lastEmittedQuery;
    this._lastEmittedQuery = next;

    if (previous === null || sameQuery(previous, next)) return;
    untracked(() => this.query.emit(next));
  });

  /**
   * The request that describes what the table is showing right now.
   *
   * The companion to the {@link query} output, which only fires on a change:
   * this is how a consumer gets the *first* page without waiting for the user
   * to touch something.
   *
   * @publicApi
   */
  currentQuery(): DataTableQuery {
    return {
      globalFilter: this.globalFilter(),
      columnFilters: this.columnFilters(),
      sort: this.sortState(),
      sortStates: this.multiSortState(),
      advancedFilter: this.advancedFilter(),
      page: this.paginationState(),
    };
  }

  /** The active filter + sort query, for a server-side export provider. */
  queryState(): DataTableExportQuery {
    return {
      globalFilter: this.globalFilter(),
      columnFilters: this.columnFilters(),
      sort: this.sortState(),
      sortStates: this.multiSortState(),
    };
  }

  /** Show (non-null label) or clear (null) the generic busy overlay. */
  setBusy(label: string | null): void {
    this._busyLabel.set(label);
  }

  /** The active busy-overlay label, or null when idle. */
  busyLabel(): string | null {
    return this._busyLabel();
  }

  /**
   * Writes the focused cell's text to the system clipboard. A no-op without
   * {@link enableCopy} or when no cell is focused. Uses the async Clipboard API,
   * so it needs a secure context and can reject if permission is denied.
   */
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

  /**
   * Copies one row as a tab-separated line of its visible data columns, with no
   * header line. Requires {@link enableCopy}.
   */
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

  /**
   * Copies the selected rows as TSV with a header line. Draws from the filtered
   * + sorted rows across all pages, so selections on other pages are included;
   * writes nothing when the selection is empty.
   */
  async copySelectedToClipboard(): Promise<void> {
    if (!this.enableCopy()) return;
    const columns = this.enhancedColumns().filter(
      (col) =>
        col.accessorKey !== "_selection" &&
        col.accessorKey !== "_expander" &&
        col.accessorKey !== "_actions",
    );
    const selectedIds = this.rowSelection();
    const rows = this.sortedData().filter(
      (row) => selectedIds[this.getRowId()(row)],
    );
    if (rows.length === 0) return;

    const headerLine = columns.map((col) => col.header).join("\t");
    const dataLines = rows.map((row) =>
      columns.map((col) => this.getCellStringValue(row, col)).join("\t"),
    );
    await navigator.clipboard.writeText([headerLine, ...dataLines].join("\n"));
  }

  /**
   * Copies the whole table as TSV via {@link getExportData} — header row plus
   * every filtered row, ignoring both pagination and the current selection.
   */
  async copyAllToClipboard(): Promise<void> {
    if (!this.enableCopy()) return;
    const data = this.getExportData();
    const text = data.map((row) => row.join("\t")).join("\n");
    await navigator.clipboard.writeText(text);
  }

  /**
   * Clears the focused cell when a click lands on the table but outside any
   * data cell — cell clicks stop propagation before reaching it.
   */
  onTableClick(): void {
    this.focusedCell.set(null);
  }

  /**
   * Focuses a data cell (the anchor for keyboard nav, copy and the fill handle).
   * Clicks on the `_selection`/`_expander`/`_actions` columns are ignored so
   * their controls keep working. With {@link enableCellRangeSelection} the
   * pointer-drag handler owns focus and range, and this only backstops keyboard
   * focus.
   */
  onCellClick(rowIndex: number, col: ColumnDef<T>, event: Event): void {
    const key = String(col.accessorKey);
    if (key === "_selection" || key === "_expander" || key === "_actions")
      return;
    event.stopPropagation();
    // When range selection is on, focus + range are managed by the pointer-drag
    // handler (onTableMouseDown); a plain click just focuses here for keyboard.
    this.focusedCell.set({ rowIndex, columnKey: key });
  }

  private _rangeAnchor: { rowIndex: number; columnKey: string } | null = null;
  private _rangeDragCleanup: (() => void) | null = null;

  /** Resolve the cell (rowIndex + columnKey) under a DOM element, or null. */
  private cellFromElement(target: EventTarget | null): { rowIndex: number; columnKey: string } | null {
    const el = target instanceof Element ? target : null;
    const rowEl = el?.closest<HTMLElement>("[data-row-index]");
    const cellEl = el?.closest<HTMLElement>("[data-column]");
    const rawRow = rowEl?.dataset["rowIndex"];
    const columnKey = cellEl?.dataset["column"];
    if (rawRow === undefined || columnKey === undefined) return null;
    const rowIndex = Number(rawRow);
    if (!Number.isFinite(rowIndex)) return null;
    const special = columnKey === "_selection" || columnKey === "_expander" || columnKey === "_actions";
    return special ? null : { rowIndex, columnKey };
  }

  /** Delegated mousedown — starts a click-drag range selection (left button only). */
  onTableMouseDown(event: MouseEvent): void {
    if (!this.enableCellRangeSelection() || event.button !== 0) return;
    if (this.editingCell() !== null) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input,textarea,select,button,a,[data-slot='fill-handle']")) {
      return;
    }
    const cell = this.cellFromElement(target);
    if (!cell) return;
    event.preventDefault();
    this.startRangeDrag(cell, event.shiftKey);
  }

  private startRangeDrag(cell: { rowIndex: number; columnKey: string }, extend: boolean): void {
    this._document.getSelection()?.removeAllRanges();
    const focused = this.focusedCell();
    const anchor = extend && focused ? focused : cell;
    this._rangeAnchor = anchor;
    this.focusedCell.set(anchor);
    this.cellRange.set({
      startRow: anchor.rowIndex,
      startCol: anchor.columnKey,
      endRow: cell.rowIndex,
      endCol: cell.columnKey,
    });
    this._rangeDragCleanup?.();
    this._rangeDragCleanup = onPointerDrag(
      (x, y, ev) => {
        if ("touches" in ev) ev.preventDefault();
        this.onRangeDragMove(x, y);
      },
      () => this.onRangeDragEnd(),
    );
  }

  private onRangeDragMove(clientX: number, clientY: number): void {
    const anchor = this._rangeAnchor;
    if (!anchor) return;
    const cell = this.cellFromElement(this._document.elementFromPoint(clientX, clientY));
    if (!cell) return;
    this.cellRange.set({
      startRow: anchor.rowIndex,
      startCol: anchor.columnKey,
      endRow: cell.rowIndex,
      endCol: cell.columnKey,
    });
  }

  private onRangeDragEnd(): void {
    this._rangeDragCleanup = null;
    this._rangeAnchor = null;
    const range = this.cellRange();
    // A click with no drag (1×1 range) collapses to a plain focus.
    if (range && range.startRow === range.endRow && range.startCol === range.endCol) {
      this.cellRange.set(null);
    }
  }

  /**
   * Opens the inline editor for a cell (the mouse gesture; {@link onCellTouchEnd}
   * is the touch equivalent). Whether editing actually starts is decided by
   * {@link startEditing} — the column must be editable and the row enabled.
   */
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

  /**
   * Touch counterpart of {@link onCellDblClick}: two taps on the *same* cell
   * within 300ms open the inline editor. Tapping a different cell restarts the
   * sequence, so a fast tap across two cells never edits.
   */
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

  private handlePasteKeydown(event: KeyboardEvent): boolean {
    if (!this.enableClipboardPaste()) return false;
    const isPaste = (event.ctrlKey || event.metaKey) && event.key === "v";
    if (!isPaste || this.editingCell() !== null) return false;
    const focused = this.focusedCell();
    if (!focused) return false;
    event.preventDefault();
    void this.pasteFromClipboard(focused.rowIndex, focused.columnKey);
    return true;
  }

  private handleHistoryKeydown(event: KeyboardEvent): boolean {
    if (!this.enableEditHistory() || this.editingCell() !== null) return false;
    if (!event.ctrlKey && !event.metaKey) return false;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      this.undoEdit();
      return true;
    }
    if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      this.redoEdit();
      return true;
    }
    return false;
  }

  /**
   * The grid's single keydown entry point, tried in order: copy
   * (`Ctrl/Cmd+C` — range, else focused cell, else selected rows), paste
   * (`Ctrl/Cmd+V`), undo/redo (`Ctrl/Cmd+Z`/`Y`), then arrow/Home/End/Enter cell
   * navigation. Each stage is gated by its feature input, and the first one to
   * handle the event stops the chain.
   */
  onTableKeydown(event: KeyboardEvent): void {
    if (this.handleCopyKeydown(event)) return;
    if (this.handlePasteKeydown(event)) return;
    if (this.handleHistoryKeydown(event)) return;
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

  /**
   * Copies the selected rectangle as TSV — no header line, cells in rendered
   * column order, one line per row — which is the shape Excel and Sheets paste
   * back. No-op without a range. Unlike the other copy helpers this does not
   * check {@link enableCopy}; the keyboard path that reaches it already has.
   */
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

  /** Whether this exact cell is the one open in the inline editor (only ever one at a time). */
  isEditing(rowIndex: number, columnKey: string): boolean {
    const editing = this.editingCell();
    return (
      editing !== null &&
      editing.rowIndex === rowIndex &&
      editing.columnKey === columnKey
    );
  }

  /**
   * Opens the inline editor on a cell, seeding it with the cell's current value
   * and focusing the input on the next frame. Silently declines when the column
   * is not `editable`, the row index is out of range, or the row is
   * {@link isDisabled}. Any pending edit on another cell is replaced without
   * being committed.
   */
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

  /**
   * Validates and applies the pending edit. A value equal to the original just
   * cancels; a column `editValidator` rejection keeps the editor open, shows the
   * message and emits {@link editError} instead. On success {@link cellEdit} is
   * emitted and the column's `valueSetter` writes a new row into {@link data} —
   * a column without a `valueSetter` emits the event but changes nothing.
   * Recorded as one undo command when {@link enableEditHistory} is on.
   */
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
    this.runAsCommand(() => this.applyValueSetter(col, row, newValue));

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

    const getId = this.getRowId();
    const before = this.getCellValue(row, col.accessorKey, col);
    const updatedRow = col.valueSetter(row, newValue);
    const data = [...this.data()];
    const dataIndex = data.findIndex((r) => getId(r) === getId(row));
    if (dataIndex === -1) return;
    data[dataIndex] = updatedRow;
    this.data.set(data);
    this._recordingChanges?.push({
      rowId: getId(row),
      columnKey: String(col.accessorKey),
      before,
      after: newValue,
    });
  }

  /** Run `fn`, capturing every `applyValueSetter` write into one undo command. */
  private runAsCommand(fn: () => void): void {
    if (!this.enableEditHistory()) {
      fn();
      return;
    }
    const batch: EditChange[] = [];
    const previous = this._recordingChanges;
    this._recordingChanges = batch;
    try {
      fn();
    } finally {
      this._recordingChanges = previous;
    }
    if (batch.length > 0) {
      this._undoStack.update((stack) => [...stack, batch]);
      this._redoStack.set([]);
    }
  }

  /** Write a value by row id + column key and re-emit `cellEdit` (used by undo/redo). */
  private writeCellByKey(rowId: string, columnKey: string, value: unknown): void {
    const col = this.columns().find((c) => String(c.accessorKey) === columnKey);
    if (!col?.valueSetter) return;
    const getId = this.getRowId();
    const data = [...this.data()];
    const index = data.findIndex((r) => getId(r) === rowId);
    if (index === -1) return;
    const before = this.getCellValue(data[index], col.accessorKey, col);
    data[index] = col.valueSetter(data[index], value);
    this.data.set(data);
    this.cellEdit.emit({ row: data[index], column: col, oldValue: before, newValue: value, rowIndex: index });
  }

  /** Undo the most recent edit/fill/paste command (reverts each cell in reverse). */
  undoEdit(): void {
    const stack = this._undoStack();
    const command = stack.at(-1);
    if (!command) return;
    this._undoStack.update((s) => s.slice(0, -1));
    for (let i = command.length - 1; i >= 0; i--) {
      this.writeCellByKey(command[i].rowId, command[i].columnKey, command[i].before);
    }
    this._redoStack.update((s) => [...s, command]);
    this.editUndo.emit();
  }

  /** Redo the most recently undone command. */
  redoEdit(): void {
    const stack = this._redoStack();
    const command = stack.at(-1);
    if (!command) return;
    this._redoStack.update((s) => s.slice(0, -1));
    for (const change of command) {
      this.writeCellByKey(change.rowId, change.columnKey, change.after);
    }
    this._undoStack.update((s) => [...s, command]);
    this.editRedo.emit();
  }

  /**
   * Compile a natural-language query into filters via the AI provider and apply
   * them to `globalFilter` / `columnFilters`. The provider returns a JSON filter
   * spec; only known columns are honored. No-op without a provider or query.
   */
  async applyNaturalLanguageFilter(query: string): Promise<void> {
    const provider = this.aiProvider();
    if (!provider || !query.trim()) return;
    const columns = this.columns().map((c) => ({
      key: String(c.accessorKey),
      header: c.header,
    }));
    const raw = await lastValueFrom(
      runAiTask(provider, { task: "nl-filter", input: query, context: { columns } }),
    );
    const spec = parseNlFilterSpec(raw, columns.map((c) => c.key));
    this.nlFilter.emit({ query, spec });
    if (spec.globalFilter !== undefined) this.globalFilter.set(spec.globalFilter);
    if (spec.columnFilters) this.columnFilters.set(spec.columnFilters);
  }

  /**
   * Fill a column's cells from an AI prompt — one provider call per filtered row,
   * applied through the column's `valueSetter` (and `editValidator` if present).
   * No-op when there's no provider or the column has no `valueSetter`.
   */
  async aiFillColumn(columnKey: string, prompt: string): Promise<void> {
    const provider = this.aiProvider();
    const col = this.enhancedColumns().find((c) => String(c.accessorKey) === columnKey);
    if (!provider || !col?.valueSetter) return;
    const rows = this.filteredData();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const value = await lastValueFrom(
        runAiTask(provider, {
          task: "table-fill",
          input: JSON.stringify(row),
          prompt,
          context: { column: col.header },
        }),
      );
      if (this.validateEdit(col, row, value, { rowIndex: i, columnKey })) {
        this.applyValueSetter(col, row, value);
      }
    }
    this.aiFillComplete.emit({ columnKey, count: rows.length });
  }

  /**
   * Abandons the pending edit, clears any validation message and returns focus
   * to the grid so keyboard navigation resumes. The row keeps its original
   * value and no output is emitted.
   */
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

  /**
   * Stores the editor's in-progress value and clears any visible validation
   * message, so the error disappears as soon as the user types. Nothing is
   * written to the row until {@link commitEdit}.
   */
  onEditValueChange(value: unknown): void {
    this.editValue.set(value);
    this.cellEditError.set(null);
  }

  /**
   * Editor key handling: Escape cancels, Enter commits, and Tab commits then
   * moves to the next (Shift+Tab: previous) navigable cell, reopening the editor
   * there if that column is editable — the Excel-style "tab across a row" flow.
   * All three stop propagation so the grid's own navigation does not also run.
   */
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

  /**
   * Expands or collapses a tree node, stopping the event so the chevron does not
   * also focus or select the row. Writes an explicit `true`/`false` into
   * {@link subRowExpandedRows}, which pins the node against
   * {@link subRowDefaultExpanded}.
   */
  toggleSubRowExpanded(row: T, event?: Event): void {
    event?.stopPropagation();
    const id = this.getRowId()(row);
    const isCurrentlyExpanded = this.isSubRowExpanded(row);
    const next = { ...this.subRowExpandedRows() };
    next[id] = !isCurrentlyExpanded;
    this.subRowExpandedRows.set(next);
  }

  /** Expands one tree node, leaving its descendants' own state untouched. */
  expandSubRow(row: T): void {
    const id = this.getRowId()(row);
    this.subRowExpandedRows.update((current) => ({ ...current, [id]: true }));
  }

  /**
   * Collapses one tree node by storing an explicit `false`, which pins it closed
   * against {@link subRowDefaultExpanded}. Delete the node's
   * {@link subRowExpandedRows} entry yourself to hand it back to the default.
   */
  collapseSubRow(row: T): void {
    const id = this.getRowId()(row);
    this.subRowExpandedRows.update((current) => ({ ...current, [id]: false }));
  }

  /**
   * Whether a tree node shows its children: an explicit
   * {@link subRowExpandedRows} entry if there is one, otherwise the
   * {@link subRowDefaultExpanded} depth rule (`-1` means every level).
   */
  isSubRowExpanded(row: T): boolean {
    const id = this.getRowId()(row);
    const expanded = this.subRowExpandedRows();
    if (id in expanded) return expanded[id];
    const defaultExpanded = this.subRowDefaultExpanded();
    if (defaultExpanded === -1) return true;
    const depth = this.getRowDepth(row);
    return depth < defaultExpanded;
  }

  /**
   * Expands every node with children, or only those above `toDepth` (0-based,
   * exclusive) when given. Walks the *unfiltered* {@link data} and **replaces**
   * {@link subRowExpandedRows} wholesale, discarding any node you had explicitly
   * collapsed.
   */
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

  /**
   * Collapses the whole tree by pinning an explicit `false` on every node that
   * has children, so it wins over {@link subRowDefaultExpanded} (including
   * `-1`). Set {@link subRowExpandedRows} to `{}` yourself to hand every node
   * back to the default instead.
   */
  collapseAllSubRows(): void {
    const next: Record<string, boolean> = {};
    for (const id of this.parentRowIds()) {
      next[id] = false;
    }
    this.subRowExpandedRows.set(next);
  }

  private parentRowIds(): string[] {
    const getId = this.getRowId();
    const getChildrenFn = this.getChildren();
    const ids: string[] = [];

    const walk = (rows: T[]): void => {
      for (const row of rows) {
        const children = getChildrenFn(row);
        if (children && children.length > 0) {
          ids.push(getId(row));
          walk(children);
        }
      }
    };
    walk(this.data());
    return ids;
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

  /**
   * A row's nesting level (0 for a root), resolved from the parent index built
   * over {@link data}. Returns 0 for a row that is not part of the tree.
   */
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

  /**
   * The chain of {@link getRowId} values from the root down to `rowId`
   * (inclusive) — useful for breadcrumbs or for expanding a node's ancestors. A
   * root or unknown id yields just `[rowId]`.
   */
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

  /** The row's parent in the tree, or `null` for a root (or a row outside the tree). */
  getParentRow(row: T): T | null {
    const id = this.getRowId()(row);
    const index = this.treeIndex();
    const parentId = index.parent.get(id);
    if (parentId === undefined) return null;
    return this.findRowById(parentId);
  }

  /**
   * A row's direct children via {@link getChildren} (never grandchildren), or an
   * empty array. Unaffected by filtering and expansion state.
   */
  getChildRows(row: T): T[] {
    const getChildrenFn = this.getChildren();
    return getChildrenFn(row) ?? [];
  }

  /**
   * Selects every descendant of a row — the whole subtree, not just direct
   * children — without selecting the parent itself, and ignoring
   * {@link isDisabled} and the active filter.
   */
  selectChildren(parentRow: T): void {
    const id = this.getRowId()(parentRow);
    const index = this.treeIndex();
    const descendantIds = index.descendants.get(id) ?? [];
    const next = { ...this.rowSelection() };
    descendantIds.forEach((did) => (next[did] = true));
    this.rowSelection.set(next);
  }

  /** The inverse of {@link selectChildren}: clears the whole subtree, leaving the parent as-is. */
  deselectChildren(parentRow: T): void {
    const id = this.getRowId()(parentRow);
    const index = this.treeIndex();
    const descendantIds = index.descendants.get(id) ?? [];
    const next = { ...this.rowSelection() };
    descendantIds.forEach((did) => delete next[did]);
    this.rowSelection.set(next);
  }

  /**
   * The tree checkbox action. Under {@link subRowSelectionMode} `"self"` it is
   * just {@link toggleRow}; `"descendants"` mirrors the new state onto the whole
   * subtree, and `"filteredDescendants"` onto the visible part of it only.
   * Either way, ancestors are then recomputed so a fully-selected parent becomes
   * selected and a partly-selected one indeterminate. Disabled rows are ignored.
   */
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

  /**
   * Whether a node's checkbox should render indeterminate — some but not all of
   * its descendants are selected. Always false under
   * {@link subRowSelectionMode} `"self"`, where selection does not cascade.
   */
  isSubRowSelectionIndeterminate(row: T): boolean {
    return this._indeterminateRows().has(this.getRowId()(row));
  }

  /**
   * Inputs for a column's `cellComponent` in tree mode: the column's own
   * `componentInputs` plus a `_subRowContext` carrying depth, path, parent, leaf
   * flag and child count — so a cell component can draw its own indentation or
   * expander. The context key always wins over a same-named entry.
   */
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

  /**
   * The row at a *rendered* index — after filtering, sorting and paging — or
   * `undefined` when out of range. This is the index every cell/row callback
   * and event payload uses, so map through here rather than indexing
   * {@link data} directly.
   */
  getRenderedRowAt(index: number): T | undefined {
    return this.processedData()[index];
  }

  // ── Addon host contract (DataTableAddonHost) ───────────────────────────
  // Generic, addon-agnostic extension surface. The base provides itself as the
  // DataTableAddonHost token; addon directives reach these through DI without
  // the base ever importing an addon.
  private readonly _cellActions = new AddonSlotRegistry<CellActionSlot<T>>();
  private readonly _headerActions = new AddonSlotRegistry<HeaderActionSlot<T>>();

  /**
   * Adds an addon's ⋮ button to every row's action cell and returns a teardown
   * an addon directive should call on destroy. The base renders the button and
   * calls back with the row context; it never learns which addon registered it.
   */
  registerCellAction(slot: CellActionSlot<T>): () => void {
    return this._cellActions.register(slot);
  }

  /** The header-cell counterpart of {@link registerCellAction}; also returns a teardown. */
  registerHeaderAction(slot: HeaderActionSlot<T>): () => void {
    return this._headerActions.register(slot);
  }

  /** The registered row-action slots, in registration order — read by the base template. */
  cellActionSlots(): readonly CellActionSlot<T>[] {
    return this._cellActions.slots();
  }

  /** The registered header-action slots — read by the base template. */
  headerActionSlots(): readonly HeaderActionSlot<T>[] {
    return this._headerActions.slots();
  }

  /**
   * The runtime pin override for a column set via {@link pinColumn}, or
   * `undefined`. Deliberately *not* the column's declared `pin` — an unpinned
   * and a never-overridden column look the same here.
   */
  getColumnPin(columnKey: string): ColumnPin {
    return this.columnPinOverrides()[columnKey];
  }

  /**
   * Row metadata for an action callback: the row, its rendered index and
   * selection, plus depth/leaf/parent/expanded when {@link enableSubRows} is on.
   */
  getRowContext(row: T, index: number): RowActionContext<T> {
    return this.buildRowActionContext(row, index);
  }

  /**
   * The resolved locale dictionary, so an addon can label its own UI from the
   * table's {@link locale} instead of shipping its own strings.
   */
  getLocale(): DataTableLocale {
    return this.t();
  }

  /**
   * The flattened tree row at a rendered index — the tree-mode counterpart of
   * {@link getRenderedRowAt}, carrying depth, path and expansion alongside the
   * row. `undefined` outside tree mode or out of range.
   */
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

  /**
   * Pins a column to a side at runtime (`undefined` unpins), overriding the
   * column's declared `pin`/`sticky`. Pinned columns are grouped to their edge
   * regardless of {@link columnOrder}, and the override is not captured by
   * {@link getColumnState}.
   */
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
    return computeAggregateValue(values, fn);
  }

  /**
   * Makes every column visible by writing an explicit `true` for each. Merges
   * into {@link columnVisibility}, so entries for keys no longer in
   * {@link columns} are preserved untouched.
   */
  showAllColumns(): void {
    this.columnVisibility.update((current) => {
      const next = { ...current };
      for (const col of this.columns()) {
        next[String(col.accessorKey)] = true;
      }
      return next;
    });
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

  /**
   * Starts a row drag, stamping the row id on the `dataTransfer` payload and
   * attaching document-level wheel/drag listeners so the grid keeps
   * auto-scrolling while a drag is in flight (browsers suppress normal scrolling
   * then). Declines when {@link enableRowDrag} is off, the row is disabled, or
   * the table is {@link loading}.
   */
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

  /**
   * Tracks the hovered row during a row drag and decides the drop position from
   * the pointer's position within the row: above/below at the halves in `"flat"`
   * mode, above/on/below at the quarters in `"tree"` mode. Rejects the target
   * when the row is disabled, when a flat drag would cross tree depths, or when
   * {@link rowDragAllowDrop} vetoes it, and auto-scrolls near the edges.
   */
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

  /**
   * Catches a row drag hovering the scroll container's empty space below the
   * last row and retargets it to a drop *after* that row, so dragging to the
   * bottom of a short table still lands. Ignored unless a drag is in flight.
   */
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

  /**
   * Completes a row drag: while {@link localReorder} is on it applies the move
   * to {@link data} through {@link reorderData}, then emits {@link rowReorder}
   * with the moved row, the target row, the drop position and the neighbouring
   * row ids, and finally clears the drag state. With `localReorder` off nothing
   * moves — apply the event yourself through {@link reorderData}.
   */
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

    if (this.localReorder()) {
      this.data.set(this.reorderData(this.data(), reorderEvent));
    }

    this.rowReorder.emit(reorderEvent);
    this.clearRowDragState();
  }

  /**
   * Pure helper that returns a **new** array with a {@link rowReorder} event
   * applied — run for you on drop while {@link localReorder} is on, and the
   * intended handler body when it is off. Flat mode re-inserts next to `previousId`/`nextId`
   * (falling back to the end); tree mode removes the node from its parent and
   * re-inserts it above/below/inside the target via {@link setChildren}. Rows
   * are matched by {@link getRowId}, and an unknown moved row returns the input
   * array unchanged.
   */
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

  /**
   * Clears row-drag state and detaches the auto-scroll listeners when a drag
   * ends, including a cancelled one that never reached {@link onRowDrop}.
   */
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

  /** Whether this row is the one being dragged (drives its ghosted styling). */
  isRowBeingDragged(row: T): boolean {
    return this.draggedRowId() === this.getRowId()(row);
  }

  /**
   * Which drop indicator a rendered row should show: `'top'`/`'bottom'` for an
   * insertion line, `'on'` for a re-parent highlight in `"tree"`
   * {@link rowDragMode}, or `null` when this row is not the current target.
   */
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

  /**
   * Begins a mouse column resize from the header's drag handle, capturing the
   * start width and attaching document move/up listeners. The RTL delta is
   * inverted from the host's live direction, so the handle drags the way the
   * column visually grows.
   */
  onResizeStart(event: MouseEvent, col: CellStyleColumn): void {
    event.preventDefault();
    event.stopPropagation();
    this.startResize(event.clientX, col);
  }

  /**
   * Touch counterpart of {@link onResizeStart}. Single-finger only, so a
   * pinch-zoom over the header is left to the browser.
   */
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

  /**
   * Measure the widest *intrinsic* content (header + rendered cells) of a column.
   * Each cell's content is cloned into an off-screen `width:max-content` element
   * so the measurement is the natural content width — not the cell's stretched
   * width — which lets auto-fit both grow and shrink.
   */
  private measureColumnContent(columnKey: string): number {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return 0;
    const cells = Array.from(
      container.querySelectorAll<HTMLElement>("[data-column], [data-column-id]"),
    ).filter(
      (el) => el.dataset["column"] === columnKey || el.dataset["columnId"] === columnKey,
    );
    if (cells.length === 0) return 0;

    const measurer = this._document.createElement("div");
    measurer.style.cssText =
      "position:absolute;left:-99999px;top:0;visibility:hidden;white-space:nowrap;width:max-content;";
    this._document.body.appendChild(measurer);
    let max = 0;
    for (const cell of cells) {
      const style = globalThis.getComputedStyle(cell);
      measurer.style.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      measurer.innerHTML = cell.innerHTML;
      const width = measurer.getBoundingClientRect().width;
      if (width > max) max = width;
    }
    measurer.remove();
    return max;
  }

  /**
   * Resize a column to fit its widest content (Excel-style auto-fit). Measures
   * only rendered cells, so with virtual scroll it fits what's on screen.
   */
  autoSizeColumn(columnKey: string): void {
    const content = this.measureColumnContent(columnKey);
    if (content <= 0) return;
    const col = this.enhancedColumns().find((c) => String(c.accessorKey) === columnKey);
    const minWidth = Number.parseInt(col?._minWidth ?? "50", 10) || 50;
    const newWidth = `${Math.max(minWidth, Math.ceil(content) + 24)}px`;
    const oldWidth = this.columnWidths()[columnKey] ?? col?._width ?? "auto";
    this.columnWidths.update((widths) => ({ ...widths, [columnKey]: newWidth }));
    this.columnResize.emit({ columnKey, oldWidth, newWidth });
  }

  /** Auto-fit every (non-special) column to its content. */
  autoSizeAllColumns(): void {
    for (const key of this.navigableColumnKeys()) {
      this.autoSizeColumn(key);
    }
  }

  /** Distribute the visible width evenly across the (non-special) columns. */
  fitColumnsToViewport(): void {
    const container = this.scrollContainerRef()?.nativeElement;
    if (!container) return;
    const keys = this.navigableColumnKeys();
    if (keys.length === 0) return;
    const each = Math.max(50, Math.floor(container.clientWidth / keys.length));
    const next = { ...this.columnWidths() };
    for (const key of keys) {
      next[key] = `${each}px`;
    }
    this.columnWidths.set(next);
  }

  /** Double-click the resize handle → auto-fit that column. */
  onResizeDoubleClick(event: MouseEvent, col: CellStyleColumn): void {
    event.preventDefault();
    event.stopPropagation();
    this.autoSizeColumn(String(col.accessorKey));
  }

  /**
   * Scrolls a rendered row index to the top of the viewport, using the measured
   * prefix sums under {@link virtualVariableRowHeight} and
   * {@link virtualRowHeight} otherwise. Because the offset is computed rather
   * than looked up in the DOM, it is only accurate while virtualization is
   * active and the real row height matches `virtualRowHeight`. The index is not
   * clamped — an out-of-range value just pins the scroll at the end.
   */
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

  /**
   * Scrolls a column to the leading edge of the viewport by summing the widths
   * before it. Only scrollable columns count — a pinned or hidden column is not
   * found and the call is a no-op — and the offset ignores any pinned overlay,
   * so the target can sit partly beneath it.
   */
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

  /**
   * {@link scrollToRow} plus {@link scrollToColumn} in one call, bringing a cell
   * to the top-leading corner of the viewport. It does not focus the cell — set
   * {@link focusedCell} for that.
   */
  scrollToCell(rowIndex: number, columnKey: string): void {
    this.scrollToRow(rowIndex);
    this.scrollToColumn(columnKey);
  }
}
