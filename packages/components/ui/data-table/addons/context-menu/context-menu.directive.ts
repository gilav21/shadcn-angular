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

/** Builds a consumer-provided row-action menu for a given row context. */
export type RowActionsFn<T> = (context: RowActionContext<T>) => ContextMenuItem[];

const SLOT_ID = 'context-menu';

/**
 * Opt-in context-menu addon for `<ui-data-table>`. Attaches via DI to the
 * `DataTableAddonHost` the base provides, contributes the ⋮ row/header buttons
 * through the host's generic slot registries, and renders menus itself
 * (imperative `ContextMenuComponent`) — the base ships no context-menu code or
 * dependency. Reachable by mouse (`contextmenu`), keyboard (the context-menu key), touch
 * (long-press), and the ⋮ buttons. A long-press that the browser also reports
 * as a `contextmenu` (Android) opens the menu, and emits, once.
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

  /** Emitted when a row menu opens (with its context). */
  readonly rowMenuOpen = output<RowActionContext<T>>();
  /** Emitted when a column menu opens (with its column). */
  readonly columnMenuOpen = output<ColumnDef<T>>();

  private rowMenu?: ComponentRef<ContextMenuComponent>;
  private columnMenu?: ComponentRef<ContextMenuComponent>;

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
      const teardown = onContextGesture(this.el.nativeElement, (gesture) => this.openRowMenuFromGesture(gesture));
      destroyRef.onDestroy(teardown);
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

  /** Whether the gesture landed on a rendered row of a table with `rowActions` and was taken. */
  private openRowMenuFromGesture(gesture: ContextGesture): boolean {
    if (!this.rowActions()) return false;
    const context = this.rowContextFromTarget(gesture.target);
    if (!context) return false;
    this.openRowMenu(gesture.clientX, gesture.clientY, context);
    return true;
  }

  private rowContextFromTarget(target: EventTarget | null): RowActionContext<T> | null {
    const rowEl = (target as HTMLElement | null)?.closest<HTMLElement>('[data-row-index]');
    if (!rowEl) return null;
    const index = Number.parseInt(rowEl.dataset['rowIndex'] ?? '0', 10);
    const row = this.host.getRenderedRowAt(index);
    return row ? this.host.getRowContext(row, index) : null;
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

/** The bounding rect of the button nearest an event target, if any. */
function buttonRect(target: EventTarget | null): DOMRect | undefined {
  const button = (target as HTMLElement | null)?.closest('button');
  return button?.getBoundingClientRect();
}
