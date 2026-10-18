import {
  Directive,
  input,
  output,
  inject,
  effect,
  afterNextRender,
  ElementRef,
  ViewContainerRef,
  DestroyRef,
  type ComponentRef,
} from '@angular/core';
import {
  DataTableAddonHost,
  type ColumnDef,
  type ColumnPin,
  type DataTableLocale,
  type RowActionContext,
  type SortDirection,
} from '../..';
import { ContextMenuComponent, type ContextMenuItem } from '../../../context-menu';
import { onContextGesture, type ContextGesture } from '../../../../lib/touch';
import { inheritThemeTokens } from '../../../../lib/theme-presets';
import type { DataTableHeaderContextMenuEvent, DataTableRowContextMenuEvent } from './context-menu.types';

/** Builds a consumer-provided row-action menu for a given row context. */
export type RowActionsFn<T> = (context: RowActionContext<T>) => ContextMenuItem[];

const SLOT_ID = 'context-menu';

/** Columns the table adds itself; a gesture on one of them does not move the grid focus. */
const TABLE_OWNED_COLUMNS: ReadonlySet<string> = new Set(['_selection', '_expander', '_actions']);

const ROW_SELECTOR = '[data-row-index]';
const HEADER_SELECTOR = '[data-slot="table-head"], [data-slot="data-table-header"], th';

/**
 * Opt-in context-menu addon for `<ui-data-table>`. Attaches via DI to the
 * `DataTableAddonHost` the base provides, contributes the ⋮ row/header buttons
 * through the host's generic slot registries — the base ships no context-menu code
 * or dependency. Reachable by mouse (`contextmenu`), keyboard (the context-menu
 * key), touch (long-press), and the ⋮ buttons. A long-press that the browser also
 * reports as a `contextmenu` (Android) opens the menu, and emits, once.
 *
 * Two modes, chosen by what you bind:
 *
 * - **Simple** — `[rowActions]` (and `[enableColumnMenu]`): the addon builds the
 *   menus itself and adds the ⋮ buttons. Emits {@link rowMenuOpen} / {@link columnMenuOpen}.
 * - **Custom** — `[contextMenu]`: the gestures open *your* `<ui-context-menu>`, with
 *   the row (or, with `[contextMenuRowsOnly]="false"`, the header) as its data. Emits
 *   {@link rowContextMenu} / {@link headerContextMenu}.
 *
 * With both bound, the gestures open your menu and the ⋮ buttons still open the
 * built one. With neither, the directive takes no gesture.
 *
 * While `enableCellRangeSelection` is on, a touch long-press opens your menu only on a
 * cell that is already selected (inside the range, or the focused cell with no range);
 * anywhere else the same hold starts a range, as it always did.
 */
@Directive({
  selector: '[uiDtContextMenu]',
  standalone: true,
})
export class DataTableContextMenuDirective<T = unknown> {
  private readonly host = inject<DataTableAddonHost<T>>(DataTableAddonHost);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly vcr = inject(ViewContainerRef);

  /** Consumer callback returning the menu items for a row. */
  readonly rowActions = input<RowActionsFn<T> | undefined>(undefined);
  /** Enable the per-column header menu (sort / pin / hide). */
  readonly enableColumnMenu = input(false);
  /**
   * Your own menu (custom mode). A right-click, the context-menu key or a long-press on a
   * row opens it at the pointer with the row as its data (the flattened tree row, with the
   * row merged in, when the table renders sub-rows).
   */
  readonly contextMenu = input<ContextMenuComponent | undefined>(undefined);
  /** Hands every context gesture on the table back to the browser. The ⋮ buttons are unaffected. */
  readonly contextMenuDisabled = input(false);
  /** Custom mode: leave the header alone. Set to `false` to open `contextMenu` on a column header too. */
  readonly contextMenuRowsOnly = input(true);

  /** Emitted when a row menu opens (with its context). */
  readonly rowMenuOpen = output<RowActionContext<T>>();
  /** Emitted when a column menu opens (with its column). */
  readonly columnMenuOpen = output<ColumnDef<T>>();
  /** Custom mode: the row a gesture opened `contextMenu` on. */
  readonly rowContextMenu = output<DataTableRowContextMenuEvent<T>>();
  /** Custom mode: the header a gesture opened `contextMenu` on (needs `contextMenuRowsOnly` false). */
  readonly headerContextMenu = output<DataTableHeaderContextMenuEvent>();

  private rowMenu?: ComponentRef<ContextMenuComponent>;
  private columnMenu?: ComponentRef<ContextMenuComponent>;
  /**
   * Whether the cell under the last finger was selected when it went down. Read when the
   * hold fires: the table's own 500 ms range handler may already have re-anchored the range
   * onto that cell by then, and the answer must not depend on which of the two ran first.
   */
  private pressedCellSelected = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect((onCleanup) => {
      if (!this.rowActions()) return;
      onCleanup(
        this.host.registerCellAction({
          id: SLOT_ID,
          icon: 'more-vertical',
          ariaLabel: 'Row actions',
          onClick: (event, context) => this.openRowMenuFromButton(event, context),
        }),
      );
    });

    effect((onCleanup) => {
      if (!this.enableColumnMenu()) return;
      onCleanup(
        this.host.registerHeaderAction({
          id: SLOT_ID,
          icon: 'more-vertical',
          ariaLabel: 'Column menu',
          onClick: (event, column) => this.openColumnMenuFromButton(event, column),
        }),
      );
    });

    afterNextRender(() => {
      const element = this.el.nativeElement;
      const onPress = (event: TouchEvent): void => {
        this.pressedCellSelected = this.selectedCellAt(event.target);
      };
      const stopGestures = onContextGesture(element, (gesture) => this.openFromGesture(gesture));
      element.addEventListener('touchstart', onPress, { passive: true });
      destroyRef.onDestroy(() => {
        stopGestures();
        element.removeEventListener('touchstart', onPress);
      });
    });

    destroyRef.onDestroy(() => {
      this.rowMenu?.destroy();
      this.columnMenu?.destroy();
    });
  }

  /** Items for a row's action menu (empty when no `rowActions` is set). */
  buildRowMenuItems(context: RowActionContext<T>): ContextMenuItem[] {
    const fn = this.rowActions();
    return fn ? fn(context) : [];
  }

  /** Sort / pin / visibility items for a column's header menu. */
  buildColumnMenuItems(col: ColumnDef<T>): ContextMenuItem[] {
    const key = String(col.accessorKey);
    const currentSort = this.host.getSortDirection(key);
    const currentPin = this.host.getColumnPin(key) ?? col.pin;
    const t = this.host.getLocale();
    return [
      ...this.sortItems(key, col, currentSort, t),
      ...this.pinItems(key, currentPin, t),
      ...this.visibilityItems(key, col, t),
    ];
  }

  /** Whether the gesture was taken: by `contextMenu` if bound, else by the built row menu if `rowActions` is set. */
  private openFromGesture(gesture: ContextGesture): boolean {
    if (this.contextMenuDisabled()) return false;
    const menu = this.contextMenu();
    if (menu && this.holdBelongsToRangeSelection(gesture)) return false;

    const rowEl = gesture.target.closest<HTMLElement>(ROW_SELECTOR);
    if (rowEl) return menu ? this.openBoundRowMenu(menu, gesture, rowEl) : this.openBuiltRowMenu(gesture, rowEl);
    return menu ? this.openBoundHeaderMenu(menu, gesture) : false;
  }

  /** With range selection on, a touch hold is the table's unless it is on what is already selected. */
  private holdBelongsToRangeSelection(gesture: ContextGesture): boolean {
    return gesture.viaTouch && this.host.isCellRangeSelectionEnabled() && !this.pressedCellSelected;
  }

  private openBuiltRowMenu(gesture: ContextGesture, rowEl: HTMLElement): boolean {
    if (!this.rowActions()) return false;
    const index = rowIndexOf(rowEl);
    const row = this.host.getRenderedRowAt(index);
    if (row === undefined) return false;
    this.openRowMenu(gesture.clientX, gesture.clientY, this.host.getRowContext(row, index));
    return true;
  }

  private openBoundRowMenu(menu: ContextMenuComponent, gesture: ContextGesture, rowEl: HTMLElement): boolean {
    const index = rowIndexOf(rowEl);
    const row = this.host.getRenderedRowAt(index);
    if (row === undefined) return false;

    const cell = this.cellAt(gesture.target);
    if (cell && !TABLE_OWNED_COLUMNS.has(cell.columnKey)) this.host.focusCell(cell.rowIndex, cell.columnKey);

    const treeRow = this.host.getRenderedTreeRowAt(index);
    this.rowContextMenu.emit({
      row,
      index,
      event: gesture.source,
      depth: treeRow?.depth,
      isLeaf: treeRow?.isLeaf,
      parentRow: treeRow?.parentRow,
    });
    menu.show(gesture.clientX, gesture.clientY, treeRow ? { ...treeRow, row } : row);
    return true;
  }

  private openBoundHeaderMenu(menu: ContextMenuComponent, gesture: ContextGesture): boolean {
    if (this.contextMenuRowsOnly()) return false;
    const header = gesture.target.closest<HTMLElement>(HEADER_SELECTOR);
    if (!header) return false;

    const column = { id: header.dataset['columnId'] ?? null, name: header.textContent?.trim() ?? '', element: header };
    this.headerContextMenu.emit({ column, event: gesture.source });
    menu.show(gesture.clientX, gesture.clientY, column);
    return true;
  }

  /** The data cell under a target, or null when it is in no indexed row or no cell. */
  private cellAt(target: EventTarget | null): { rowIndex: number; columnKey: string } | null {
    const element = target instanceof Element ? target : null;
    const rowEl = element?.closest<HTMLElement>(ROW_SELECTOR);
    const columnKey = element?.closest<HTMLElement>('[data-column]')?.dataset['column'];
    if (!rowEl || !columnKey) return null;
    const rowIndex = rowIndexOf(rowEl);
    return Number.isNaN(rowIndex) ? null : { rowIndex, columnKey };
  }

  private selectedCellAt(target: EventTarget | null): boolean {
    const cell = this.cellAt(target);
    return cell !== null && this.host.isCellSelected(cell.rowIndex, cell.columnKey);
  }

  private openRowMenuFromButton(event: Event, context: RowActionContext<T>): void {
    const rect = buttonRect(event.target);
    this.openRowMenu(rect?.right ?? 0, rect?.bottom ?? 0, context);
  }

  private openColumnMenuFromButton(event: Event, column: ColumnDef<T>): void {
    const rect = buttonRect(event.target);
    this.openColumnMenu(rect?.left ?? 0, rect?.bottom ?? 0, column);
  }

  private openRowMenu(x: number, y: number, context: RowActionContext<T>): void {
    this.rowMenu ??= this.vcr.createComponent(ContextMenuComponent);
    // Reused across opens, so re-applied each time: the theme may have changed.
    inheritThemeTokens(this.vcr.element.nativeElement, this.rowMenu.location.nativeElement);
    this.rowMenu.setInput('items', this.buildRowMenuItems(context));
    this.rowMenu.instance.show(x, y, context);
    this.rowMenuOpen.emit(context);
  }

  private openColumnMenu(x: number, y: number, column: ColumnDef<T>): void {
    this.columnMenu ??= this.vcr.createComponent(ContextMenuComponent);
    inheritThemeTokens(this.vcr.element.nativeElement, this.columnMenu.location.nativeElement);
    this.columnMenu.setInput('items', this.buildColumnMenuItems(column));
    this.columnMenu.instance.show(x, y, { columnKey: String(column.accessorKey), column });
    this.columnMenuOpen.emit(column);
  }

  private sortItems(
    key: string,
    col: ColumnDef<T>,
    currentSort: SortDirection,
    t: DataTableLocale,
  ): ContextMenuItem[] {
    if (col.enableSorting === false) return [];
    const items: ContextMenuItem[] = [
      {
        label: t.sortAscending ?? 'Sort Ascending',
        icon: 'arrow-up',
        disabled: currentSort === 'asc',
        click: () => this.host.onSortChange(key, 'asc'),
      },
      {
        label: t.sortDescending ?? 'Sort Descending',
        icon: 'arrow-down',
        disabled: currentSort === 'desc',
        click: () => this.host.onSortChange(key, 'desc'),
      },
    ];
    if (currentSort) {
      items.push({ label: t.clearSort ?? 'Clear Sort', icon: 'x', click: () => this.host.onSortChange(key, null) });
    }
    items.push({ type: 'separator' });
    return items;
  }

  private pinItems(key: string, currentPin: ColumnPin, t: DataTableLocale): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    if (currentPin !== 'left') items.push({ label: t.pinLeft ?? 'Pin Left', icon: 'pin', click: () => this.host.pinColumn(key, 'left') });
    if (currentPin !== 'right') items.push({ label: t.pinRight ?? 'Pin Right', icon: 'pin', click: () => this.host.pinColumn(key, 'right') });
    if (currentPin) items.push({ label: t.unpin ?? 'Unpin', icon: 'pin-off', click: () => this.host.pinColumn(key, undefined) });
    items.push({ type: 'separator' });
    return items;
  }

  private visibilityItems(key: string, col: ColumnDef<T>, t: DataTableLocale): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    if (col.enableHiding !== false) {
      items.push({ label: t.hideColumn ?? 'Hide Column', icon: 'eye-off', click: () => this.host.setColumnVisibility(key, false) });
    }
    items.push({ label: t.showAllColumns ?? 'Show All Columns', icon: 'eye', click: () => this.host.showAllColumns() });
    return items;
  }
}

/** The rendered index a row element carries (NaN when it carries none). */
function rowIndexOf(rowEl: HTMLElement): number {
  return Number.parseInt(rowEl.dataset['rowIndex'] ?? '', 10);
}

/** The bounding rect of the button nearest an event target, if any. */
function buttonRect(target: EventTarget | null): DOMRect | undefined {
  const button = (target as HTMLElement | null)?.closest('button');
  return button?.getBoundingClientRect();
}
