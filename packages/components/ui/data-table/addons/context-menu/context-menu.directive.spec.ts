import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DataTableContextMenuDirective, type RowActionsFn } from './context-menu.directive';
import {
  DataTableAddonHost,
  AddonSlotRegistry,
  type CellActionSlot,
  type HeaderActionSlot,
  type ColumnPin,
  type ColumnDef,
  type DataTableExportQuery,
  type DataTableLocale,
  type FlattenedTreeRow,
  type RowActionContext,
  type SortDirection,
} from '../..';
import { ContextMenuComponent, type ContextMenuItem } from '../../../context-menu';
import type { DataTableHeaderContextMenuEvent, DataTableRowContextMenuEvent } from './context-menu.types';

interface Row {
  id: string;
  name: string;
}

/** Minimal in-memory host that records mutating calls for assertions. */
class FakeHost<T> extends DataTableAddonHost<T> {
  private readonly cell = new AddonSlotRegistry<CellActionSlot<T>>();
  private readonly header = new AddonSlotRegistry<HeaderActionSlot<T>>();
  columns: ColumnDef<T>[] = [];
  rows: T[] = [];
  sort: Record<string, SortDirection> = {};
  pins: Record<string, ColumnPin> = {};
  locale: DataTableLocale = {} as DataTableLocale;
  readonly sortCalls: [string, SortDirection][] = [];
  readonly pinCalls: [string, ColumnPin][] = [];
  readonly visibilityCalls: [string, boolean][] = [];
  showAllCalls = 0;
  treeRows: Record<number, FlattenedTreeRow<T>> = {};
  readonly focusCalls: [number, string][] = [];
  rangeSelection = false;
  /** Which cells count as selected (the real table: inside its range, or the focused cell with no range). */
  selected: (rowIndex: number, columnKey: string) => boolean = () => false;

  enhancedColumns(): readonly ColumnDef<T>[] {
    return this.columns;
  }
  getRenderedRowAt(index: number): T | undefined {
    return this.rows[index];
  }
  getRenderedTreeRowAt(index: number): FlattenedTreeRow<T> | undefined {
    return this.treeRows[index];
  }
  focusCell(rowIndex: number, columnKey: string): void {
    this.focusCalls.push([rowIndex, columnKey]);
  }
  isCellRangeSelectionEnabled(): boolean {
    return this.rangeSelection;
  }
  isCellSelected(rowIndex: number, columnKey: string): boolean {
    return this.selected(rowIndex, columnKey);
  }
  getRowContext(row: T, index: number): RowActionContext<T> {
    return { row, index, selected: false };
  }
  getSortDirection(columnKey: string | keyof T): SortDirection {
    return this.sort[String(columnKey)] ?? null;
  }
  onSortChange(columnKey: string | keyof T, direction: SortDirection): void {
    this.sortCalls.push([String(columnKey), direction]);
  }
  pinColumn(columnKey: string, pin: ColumnPin): void {
    this.pinCalls.push([columnKey, pin]);
  }
  getColumnPin(columnKey: string): ColumnPin {
    return this.pins[columnKey];
  }
  setColumnVisibility(columnKey: string | keyof T, visible: boolean): void {
    this.visibilityCalls.push([String(columnKey), visible]);
  }
  showAllColumns(): void {
    this.showAllCalls += 1;
  }
  getLocale(): DataTableLocale {
    return this.locale;
  }
  registerCellAction(slot: CellActionSlot<T>): () => void {
    return this.cell.register(slot);
  }
  registerHeaderAction(slot: HeaderActionSlot<T>): () => void {
    return this.header.register(slot);
  }
  cellActionSlots(): readonly CellActionSlot<T>[] {
    return this.cell.slots();
  }
  headerActionSlots(): readonly HeaderActionSlot<T>[] {
    return this.header.slots();
  }
  getExportData(): string[][] {
    return [];
  }
  getSortedRows(): readonly T[] {
    return this.rows;
  }
  getRawRows(): readonly T[] {
    return this.rows;
  }
  getCellValue(row: T, key: string | keyof T): unknown {
    return (row as Record<string, unknown>)[String(key)];
  }
  queryState(): DataTableExportQuery {
    return { globalFilter: '', columnFilters: {}, sort: { column: '', direction: null }, sortStates: [] };
  }
  setBusy(): void {}
  busyLabel(): string | null {
    return null;
  }
}

const SORTABLE: ColumnDef<Row> = { accessorKey: 'name', header: 'Name', enableSorting: true };

@Component({
  selector: 'ui-test-cm-host',
  standalone: true,
  imports: [DataTableContextMenuDirective],
  template: `
    <div uiDtContextMenu [rowActions]="actions()" [enableColumnMenu]="colMenu()">
      <div class="cm-row" data-row-index="0"><span class="cm-cell">Alice</span></div>
    </div>
  `,
})
class TestHostComponent {
  readonly actions = signal<RowActionsFn<Row> | undefined>(undefined);
  readonly colMenu = signal(false);
}

function setup(host: FakeHost<Row>): {
  fixture: ComponentFixture<TestHostComponent>;
  comp: TestHostComponent;
  directive: DataTableContextMenuDirective<Row>;
} {
  TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: [{ provide: DataTableAddonHost, useValue: host }],
  });
  const fixture = TestBed.createComponent(TestHostComponent);
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  const directive = fixture.debugElement
    .query(By.directive(DataTableContextMenuDirective))
    .injector.get<DataTableContextMenuDirective<Row>>(DataTableContextMenuDirective);
  return { fixture, comp, directive };
}

/** Popover methods live on a standalone proto shape so `delete` type-checks. */
interface PopoverProto {
  showPopover?: () => void;
  hidePopover?: () => void;
}

const FIXED_RECT: DOMRect = {
  x: 40,
  y: 60,
  top: 60,
  left: 40,
  right: 140,
  bottom: 100,
  width: 100,
  height: 40,
  toJSON: () => ({}),
};

/** The directive's host element (the `[uiDtContextMenu]` div). */
function directiveEl(fixture: ComponentFixture<TestHostComponent>): HTMLElement {
  return fixture.debugElement.query(By.directive(DataTableContextMenuDirective)).nativeElement as HTMLElement;
}

/** A touch-like event carrying a single touch point at (x, y). */
function touchStartAt(x: number, y: number): Event {
  const event = new Event('touchstart', { bubbles: true });
  Object.defineProperty(event, 'touches', { value: [{ clientX: x, clientY: y }] });
  return event;
}

const fakeMenu = (): ContextMenuComponent => ({ show: vi.fn() }) as unknown as ContextMenuComponent;

/**
 * A custom-mode host whose markup stands in for a real `<ui-data-table>` as far as a gesture can tell its parts
 * apart: the header row is itself a table-row and carries no data-row-index, neither does a detail row; only
 * data rows carry the index.
 */
@Component({
  selector: 'ui-test-cm-custom-host',
  standalone: true,
  imports: [DataTableContextMenuDirective],
  template: `
    <div uiDtContextMenu
      [contextMenu]="menu()" [contextMenuDisabled]="disabled()" [contextMenuRowsOnly]="rowsOnly()"
      [rowActions]="actions()"
      (rowContextMenu)="rowEvents.push($event)" (headerContextMenu)="headerEvents.push($event)"
      (rowMenuOpen)="builtOpens.push($event)">
      <div data-slot="table-row">
        <span data-slot="table-head" id="head-one" data-column-id="col1">  Column One  </span>
        <span data-slot="table-head" id="head-bare"></span>
      </div>
      <div data-slot="table-row" data-row-index="2" data-row-id="rA">
        <span data-slot="table-cell" id="cell-name" data-column="name">RowA</span>
        <span data-slot="table-cell" id="cell-selection" data-column="_selection">Sel</span>
        <span data-slot="table-cell" id="cell-expander" data-column="_expander">Exp</span>
      </div>
      <div data-slot="table-row" data-row-id="rD"><span id="detail-text">Detail</span></div>
      <div><span id="outside-text">Outside</span></div>
    </div>
  `,
})
class CustomHostComponent {
  readonly menu = signal<ContextMenuComponent | undefined>(fakeMenu());
  readonly disabled = signal(false);
  readonly rowsOnly = signal(true);
  readonly actions = signal<RowActionsFn<Row> | undefined>(undefined);
  readonly rowEvents: DataTableRowContextMenuEvent<Row>[] = [];
  readonly headerEvents: DataTableHeaderContextMenuEvent[] = [];
  readonly builtOpens: RowActionContext<Row>[] = [];
}

describe('DataTableContextMenuDirective', () => {
  let host: FakeHost<Row>;
  let originalRect: typeof Element.prototype.getBoundingClientRect;
  let originalResizeObserver: typeof globalThis.ResizeObserver | undefined;
  let originalMatchMedia: typeof globalThis.matchMedia | undefined;
  let popoverAdded = false;

  beforeEach(() => {
    host = new FakeHost<Row>();
    host.columns = [SORTABLE];
    host.rows = [{ id: '1', name: 'Alice' }];

    originalRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function stubRect(): DOMRect {
      return FIXED_RECT;
    };

    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof globalThis.ResizeObserver;

    originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof globalThis.matchMedia;

    const proto = HTMLElement.prototype as PopoverProto;
    if (!proto.showPopover) {
      proto.showPopover = () => {};
      proto.hidePopover = () => {};
      popoverAdded = true;
    }
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalRect;
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    }
    if (originalMatchMedia) {
      globalThis.matchMedia = originalMatchMedia;
    } else {
      delete (globalThis as { matchMedia?: unknown }).matchMedia;
    }
    if (popoverAdded) {
      const proto = HTMLElement.prototype as PopoverProto;
      delete proto.showPopover;
      delete proto.hidePopover;
      popoverAdded = false;
    }
  });

  it('removes the cell-action slot when rowActions is cleared', () => {
    const { comp, fixture } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    expect(host.cellActionSlots()).toHaveLength(1);
    comp.actions.set(undefined);
    fixture.detectChanges();
    expect(host.cellActionSlots()).toHaveLength(0);
  });

  it('registers a header-action slot only when enableColumnMenu is true', () => {
    const { comp, fixture } = setup(host);
    expect(host.headerActionSlots()).toHaveLength(0);
    comp.colMenu.set(true);
    fixture.detectChanges();
    expect(host.headerActionSlots()).toHaveLength(1);
  });

  it('buildRowMenuItems returns the consumer rowActions items for a context', () => {
    const { comp, fixture, directive } = setup(host);
    comp.actions.set((ctx) => [{ label: `Edit ${(ctx.row as Row).name}` }]);
    fixture.detectChanges();
    const items = directive.buildRowMenuItems(host.getRowContext({ id: '1', name: 'Alice' }, 0));
    expect(items).toEqual([{ label: 'Edit Alice' }]);
  });

  it('disables the active sort direction and wires sort clicks to the host', () => {
    host.sort = { name: 'asc' };
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    const asc = items.find((i) => i.label === 'Sort Ascending');
    expect(asc?.disabled).toBe(true);
    const desc = items.find((i) => i.label === 'Sort Descending') as ContextMenuItem;
    desc.click?.(desc);
    expect(host.sortCalls).toEqual([['name', 'desc']]);
  });

  it('localises column menu labels via the host locale', () => {
    host.locale = {
      sortAscending: 'מיון עולה',
      sortDescending: 'מיון יורד',
      pinLeft: 'הצמד לשמאל',
      pinRight: 'הצמד לימין',
      hideColumn: 'הסתר עמודה',
      showAllColumns: 'הצג את כל העמודות',
    } as DataTableLocale;
    const { directive } = setup(host);
    const labels = directive.buildColumnMenuItems(SORTABLE).map((i) => i.label);
    expect(labels).toContain('מיון עולה');
    expect(labels).toContain('הצמד לשמאל');
    expect(labels).toContain('הסתר עמודה');
    expect(labels).toContain('הצג את כל העמודות');
  });

  it('omits sort items for a column with enableSorting:false', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems({ accessorKey: 'id', header: 'ID', enableSorting: false });
    const labels = items.map((i) => i.label);
    expect(labels).not.toContain('Sort Ascending');
  });

  it('wires pin-left and pin-right items to the host', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    (items.find((i) => i.label === 'Pin Left') as ContextMenuItem).click?.({});
    (items.find((i) => i.label === 'Pin Right') as ContextMenuItem).click?.({});
    expect(host.pinCalls).toEqual([['name', 'left'], ['name', 'right']]);
  });

  it('wires hide-column and show-all items to the host', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    (items.find((i) => i.label === 'Hide Column') as ContextMenuItem).click?.({});
    (items.find((i) => i.label === 'Show All Columns') as ContextMenuItem).click?.({});
    expect(host.visibilityCalls).toEqual([['name', false]]);
    expect(host.showAllCalls).toBe(1);
  });

  it('omits the hide item for a column with enableHiding:false', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems({ accessorKey: 'name', header: 'Name', enableHiding: false });
    expect(items.map((i) => i.label)).not.toContain('Hide Column');
  });

  it('wires the unpin item to the host when a column is pinned', () => {
    host.pins = { name: 'left' };
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    const unpin = items.find((i) => i.label === 'Unpin') as ContextMenuItem;
    unpin.click?.(unpin);
    expect(host.pinCalls).toEqual([['name', undefined]]);
  });

  it('wires the sort-ascending item to the host', () => {
    const { directive } = setup(host);
    const asc = directive.buildColumnMenuItems(SORTABLE).find((i) => i.label === 'Sort Ascending') as ContextMenuItem;
    asc.click?.(asc);
    expect(host.sortCalls).toEqual([['name', 'asc']]);
  });

  it('adds a Clear Sort item wired to the host when a sort is active', () => {
    host.sort = { name: 'desc' };
    const { directive } = setup(host);
    const clear = directive.buildColumnMenuItems(SORTABLE).find((i) => i.label === 'Clear Sort') as ContextMenuItem;
    clear.click?.(clear);
    expect(host.sortCalls).toEqual([['name', null]]);
  });

  it('opens a row menu on right-click over a row and emits its context', () => {
    const { comp, fixture, directive } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    const cell = directiveEl(fixture).querySelector<HTMLElement>('.cm-cell');
    cell?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 12, clientY: 24 }));

    expect(emitted).toEqual([{ row: { id: '1', name: 'Alice' }, index: 0, selected: false }]);
  });

  // The menu is created through the directive's ViewContainerRef, which puts it
  // BESIDE the table host, not inside it, so it cannot inherit the preset. It is
  // also reused across opens, so a theme removed in between must not linger.
  it('carries the table theme onto the reused row menu on every open, and drops it once unthemed', (ctx) => {
    if (navigator.userAgent.includes('jsdom')) return ctx.skip();
    const { comp, fixture } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    const table = directiveEl(fixture);
    table.dataset['uiTheme'] = 'red';
    table.style.setProperty('--primary', 'rgb(9, 8, 7)');
    const openMenu = (): HTMLElement => {
      table.querySelector('.cm-cell')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
      const menuHost = document.querySelector<HTMLElement>('ui-context-menu');
      if (!menuHost) throw new Error('row menu not created');
      return menuHost;
    };

    const themedMenu = openMenu();
    expect(table.contains(themedMenu)).toBe(false);
    expect(themedMenu.style.getPropertyValue('--primary')).toBe('rgb(9, 8, 7)');
    expect(themedMenu.dataset['uiTheme']).toBe('red');

    delete table.dataset['uiTheme'];
    const reopened = openMenu();
    expect(reopened).toBe(themedMenu);
    expect(reopened.style.getPropertyValue('--primary')).toBe('');
    expect(reopened.hasAttribute('data-ui-theme')).toBe(false);
  });

  it('ignores right-click when no rowActions is configured', () => {
    const { fixture, directive } = setup(host);
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    const cell = directiveEl(fixture).querySelector<HTMLElement>('.cm-cell');
    cell?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(emitted).toHaveLength(0);
  });

  it('ignores right-click outside any row element', () => {
    const { comp, fixture, directive } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    directiveEl(fixture).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(emitted).toHaveLength(0);
  });

  it('ignores right-click when the row is not rendered', () => {
    host.rows = [];
    const { comp, fixture, directive } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    const cell = directiveEl(fixture).querySelector<HTMLElement>('.cm-cell');
    cell?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(emitted).toHaveLength(0);
  });

  it('opens a row menu on long-press over a row', async () => {
    const { comp, fixture, directive } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    vi.useFakeTimers();
    const cell = directiveEl(fixture).querySelector<HTMLElement>('.cm-cell');
    cell?.dispatchEvent(touchStartAt(30, 40));
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(emitted).toEqual([{ row: { id: '1', name: 'Alice' }, index: 0, selected: false }]);
  });

  // Android raises its own contextmenu for a held finger; iOS does not. The
  // table's row-menu output is analytics for consumers: one gesture, one emission.
  it('opens a row menu once when the platform echoes a contextmenu after the long-press', async () => {
    const { comp, fixture, directive } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    vi.useFakeTimers();
    const cell = directiveEl(fixture).querySelector<HTMLElement>('.cm-cell');
    cell?.dispatchEvent(touchStartAt(30, 40));
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(100);
    const echo = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 40 });
    cell?.dispatchEvent(echo);
    vi.useRealTimers();

    expect(emitted).toHaveLength(1);
    expect(echo.defaultPrevented).toBe(true);
  });

  it('ignores long-press when no rowActions is configured', async () => {
    const { fixture, directive } = setup(host);
    await fixture.whenStable();
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    vi.useFakeTimers();
    const cell = directiveEl(fixture).querySelector<HTMLElement>('.cm-cell');
    cell?.dispatchEvent(touchStartAt(0, 0));
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(emitted).toHaveLength(0);
  });

  it('opens a row menu from the cell-action button at its bottom-right corner, or at the origin with no button', () => {
    const { comp, fixture, directive } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    const button = document.createElement('button');
    const icon = document.createElement('span');
    button.appendChild(icon);
    const context: RowActionContext<Row> = { row: { id: '1', name: 'Alice' }, index: 0, selected: false };
    host.cellActionSlots()[0].onClick({ target: icon } as unknown as Event, context);
    fixture.detectChanges();

    const menu = fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance as ContextMenuComponent;
    expect(emitted).toEqual([context]);
    expect(menu.open()).toBe(true);
    expect(menu.position()).toEqual({ x: FIXED_RECT.right, y: FIXED_RECT.bottom });
    expect(menu.data()).toEqual(context);

    host.cellActionSlots()[0].onClick({ target: document.createElement('div') } as unknown as Event, context);
    expect(menu.position()).toEqual({ x: 0, y: 0 });
  });

  it('opens a column menu from the header-action button and emits its column', () => {
    const { comp, fixture, directive } = setup(host);
    comp.colMenu.set(true);
    fixture.detectChanges();
    const emitted: ColumnDef<Row>[] = [];
    directive.columnMenuOpen.subscribe((col) => emitted.push(col));

    const button = document.createElement('button');
    host.headerActionSlots()[0].onClick({ target: button } as unknown as Event, SORTABLE);

    expect(emitted).toEqual([SORTABLE]);
  });

  describe('with a contextMenu bound (custom mode)', () => {
    const ROW: Row = { id: 'r2', name: 'RowA' };

    async function setupCustom(configure?: (comp: CustomHostComponent) => void): Promise<{
      fixture: ComponentFixture<CustomHostComponent>;
      comp: CustomHostComponent;
      el: (id: string) => HTMLElement;
      shown: () => Mock;
    }> {
      host.rows = [{ id: 'r0', name: 'Zero' }, { id: 'r1', name: 'One' }, ROW];
      TestBed.configureTestingModule({
        imports: [CustomHostComponent],
        providers: [{ provide: DataTableAddonHost, useValue: host }],
      });
      const fixture = TestBed.createComponent(CustomHostComponent);
      configure?.(fixture.componentInstance);
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      return {
        fixture,
        comp: fixture.componentInstance,
        el: (id: string) => root.querySelector<HTMLElement>(`#${id}`) as HTMLElement,
        shown: () => (fixture.componentInstance.menu()?.show ?? vi.fn()) as unknown as Mock,
      };
    }

    const rightClick = (target: Element, x = 10, y = 20): MouseEvent => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y });
      target.dispatchEvent(event);
      return event;
    };

    /** A contextmenu typed by pointer, as Chromium raises it for a finger or a mouse. */
    const typedContextMenu = (pointerType: 'mouse' | 'touch', x: number, y: number): MouseEvent => {
      const init = { bubbles: true, cancelable: true, button: pointerType === 'mouse' ? 2 : 0, clientX: x, clientY: y };
      return typeof PointerEvent === 'undefined'
        ? new MouseEvent('contextmenu', init)
        : new PointerEvent('contextmenu', { ...init, pointerType });
    };

    /** A finger put down on `target`; the caller advances the fake clock (they are installed per test). */
    const touchDown = (target: Element, x: number, y: number): Event => {
      const event = touchStartAt(x, y);
      target.dispatchEvent(event);
      return event;
    };

    // UC-1
    it.each([
      {
        label: 'a tree row',
        tree: {
          row: ROW, depth: 1, parentId: 'p', parentRow: { id: 'p', name: 'Parent' },
          path: ['p'], isLeaf: true, childCount: 0, isExpanded: true,
        } as FlattenedTreeRow<Row>,
      },
      { label: 'a flat row', tree: undefined },
    ])('opens the bound menu and emits the row on a right-click of $label', async ({ tree }) => {
      if (tree) host.treeRows[2] = tree;
      const { comp, el, shown } = await setupCustom();

      rightClick(el('cell-name'), 10, 20);

      expect(comp.rowEvents).toHaveLength(1);
      const [emitted] = comp.rowEvents;
      expect(emitted.row).toEqual(ROW);
      expect(emitted.index).toBe(2);
      expect(emitted.depth).toBe(tree?.depth);
      expect(emitted.isLeaf).toBe(tree?.isLeaf);
      expect(emitted.parentRow).toEqual(tree?.parentRow);
      // In tree mode the menu gets the whole flattened row with the row merged in, as it always has.
      expect(shown()).toHaveBeenCalledWith(10, 20, tree ? { ...tree, row: ROW } : ROW);
    });

    // UC-2
    it('opens the bound menu at the finger and emits once what a right-click emits, even when the platform echoes a contextmenu', async () => {
      vi.useFakeTimers();
      try {
        const { comp, el, shown } = await setupCustom();
        rightClick(el('cell-name'), 10, 20);
        vi.advanceTimersByTime(1000);

        const touch = touchDown(el('cell-name'), 10, 20);
        vi.advanceTimersByTime(500);
        vi.advanceTimersByTime(100);
        const echo = rightClick(el('cell-name'), 10, 20);

        expect(comp.rowEvents).toHaveLength(2);
        expect({ ...comp.rowEvents[1], event: undefined }).toEqual({ ...comp.rowEvents[0], event: undefined });
        expect(comp.rowEvents[1].event).toBe(touch);
        expect(shown()).toHaveBeenCalledTimes(2);
        expect(echo.defaultPrevented).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    // UC-3, on the header row of a real table: it is a table-row too, and has no data-row-index.
    it('opens the bound menu with the header, not a row, on a header right-click when contextMenuRowsOnly is false', async () => {
      const { comp, el, shown } = await setupCustom(c => c.rowsOnly.set(false));

      rightClick(el('head-one'), 30, 40);

      expect(comp.rowEvents).toHaveLength(0);
      expect(comp.headerEvents).toEqual([{ column: { id: 'col1', name: 'Column One', element: el('head-one') }, event: expect.any(MouseEvent) }]);
      expect(shown()).toHaveBeenCalledWith(30, 40, { id: 'col1', name: 'Column One', element: el('head-one') });
    });

    it('gives a header without attributes a null id and an empty name, and opens on a header long-press too', async () => {
      vi.useFakeTimers();
      try {
        const { comp, el, shown } = await setupCustom(c => c.rowsOnly.set(false));

        touchDown(el('head-bare'), 7, 9);
        vi.advanceTimersByTime(500);

        expect(comp.headerEvents).toHaveLength(1);
        expect(comp.headerEvents[0].column).toEqual({ id: null, name: '', element: el('head-bare') });
        expect(shown()).toHaveBeenCalledWith(7, 9, comp.headerEvents[0].column);
      } finally {
        vi.useRealTimers();
      }
    });

    it('leaves a header right-click to the browser by default', async () => {
      const { comp, el, shown } = await setupCustom();

      const event = rightClick(el('head-one'));

      expect(comp.headerEvents).toHaveLength(0);
      expect(comp.rowEvents).toHaveLength(0);
      expect(shown()).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    // UC-4, simple mode: its long-press is untouched by range selection.
    it('simple mode: a long-press still opens the built menu while range selection is on', async () => {
      vi.useFakeTimers();
      try {
        host.rangeSelection = true;
        const { comp, el } = await setupCustom(c => {
          c.menu.set(undefined);
          c.actions.set(() => [{ label: 'Edit' }]);
        });

        touchDown(el('cell-name'), 10, 20);
        vi.advanceTimersByTime(500);

        expect(comp.builtOpens).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    // UC-4, custom mode.
    it('custom mode, range selection on: a long-press on a selected cell opens the menu', async () => {
      vi.useFakeTimers();
      try {
        host.rangeSelection = true;
        host.selected = (row, column) => row === 2 && column === 'name';
        const { comp, el, shown } = await setupCustom();

        touchDown(el('cell-name'), 10, 20);
        vi.advanceTimersByTime(500);

        expect(comp.rowEvents).toHaveLength(1);
        expect(shown()).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('custom mode, range selection on: a long-press on any other cell is left to range selection, and a right-click still opens', async () => {
      vi.useFakeTimers();
      try {
        host.rangeSelection = true;
        const { comp, el, shown } = await setupCustom();

        touchDown(el('cell-name'), 10, 20);
        vi.advanceTimersByTime(500);
        // Android reports the same hold as a contextmenu too: still the table's, not the menu's.
        vi.advanceTimersByTime(100);
        el('cell-name').dispatchEvent(typedContextMenu('touch', 10, 20));
        expect(comp.rowEvents).toHaveLength(0);
        expect(shown()).not.toHaveBeenCalled();

        vi.advanceTimersByTime(2000);
        el('cell-name').dispatchEvent(typedContextMenu('mouse', 10, 20));
        expect(comp.rowEvents).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('custom mode, range selection off: a long-press opens the menu everywhere', async () => {
      vi.useFakeTimers();
      try {
        const { comp, el } = await setupCustom();

        touchDown(el('cell-name'), 10, 20);
        vi.advanceTimersByTime(500);

        expect(comp.rowEvents).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    // T-19: the table's own 500 ms handler may re-anchor the range onto the pressed cell before this one fires.
    it('decides "selected" when the finger goes down, not when the hold fires', async () => {
      vi.useFakeTimers();
      try {
        host.rangeSelection = true;
        let rangeCoversCell = false;
        host.selected = (row, column) => rangeCoversCell && row === 2 && column === 'name';
        const { comp, el } = await setupCustom();

        touchDown(el('cell-name'), 10, 20);
        rangeCoversCell = true; // what the table's own handler does at 500 ms, if it fires first
        vi.advanceTimersByTime(500);

        expect(comp.rowEvents).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    // UC-5
    it('contextMenuDisabled releases every gesture on the table', async () => {
      vi.useFakeTimers();
      try {
        const { comp, el, shown } = await setupCustom(c => {
          c.disabled.set(true);
          c.rowsOnly.set(false);
        });

        const event = rightClick(el('cell-name'));
        rightClick(el('head-one'));
        vi.advanceTimersByTime(1000);
        touchDown(el('cell-name'), 1, 2);
        vi.advanceTimersByTime(500);

        expect(comp.rowEvents).toHaveLength(0);
        expect(comp.headerEvents).toHaveLength(0);
        expect(shown()).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('contextMenuDisabled also silences the built menu\'s gestures but not its ⋮ button', async () => {
      const { comp, el } = await setupCustom(c => {
        c.menu.set(undefined);
        c.actions.set(() => [{ label: 'Edit' }]);
        c.disabled.set(true);
      });

      rightClick(el('cell-name'));
      expect(comp.builtOpens).toHaveLength(0);

      const context: RowActionContext<Row> = { row: ROW, index: 2, selected: false };
      host.cellActionSlots()[0].onClick({ target: document.createElement('div') } as unknown as Event, context);
      expect(comp.builtOpens).toEqual([context]);
    });

    // UC-7
    it('with both a bound menu and rowActions, the bound menu owns the gestures and the ⋮ button opens the built menu', async () => {
      const { comp, el, shown } = await setupCustom(c => c.actions.set(() => [{ label: 'Edit' }]));

      rightClick(el('cell-name'));
      expect(shown()).toHaveBeenCalledTimes(1);
      expect(comp.builtOpens).toHaveLength(0);

      const context: RowActionContext<Row> = { row: ROW, index: 2, selected: false };
      host.cellActionSlots()[0].onClick({ target: document.createElement('div') } as unknown as Event, context);
      expect(comp.builtOpens).toEqual([context]);
      expect(shown()).toHaveBeenCalledTimes(1);
    });

    // UC-8
    it('with neither a bound menu nor rowActions, takes no gesture and registers no ⋮ button', async () => {
      const { comp, el } = await setupCustom(c => c.menu.set(undefined));

      const event = rightClick(el('cell-name'));

      expect(event.defaultPrevented).toBe(false);
      expect(comp.rowEvents).toHaveLength(0);
      expect(comp.builtOpens).toHaveLength(0);
      expect(host.cellActionSlots()).toHaveLength(0);
    });

    // UC-9
    it.each([
      { cell: 'cell-name', focused: [[2, 'name']] },
      { cell: 'cell-selection', focused: [] },
      { cell: 'cell-expander', focused: [] },
    ])('focuses the clicked cell only for a data column ($cell)', async ({ cell, focused }) => {
      const { comp, el } = await setupCustom();

      rightClick(el(cell));

      expect(comp.rowEvents).toHaveLength(1);
      expect(host.focusCalls).toEqual(focused);
    });

    // UC-1 / UC-6: only rows the table indexes are rows (T-11).
    it.each([
      { target: 'detail-text', what: 'a detail row' },
      { target: 'outside-text', what: 'a spot outside any row' },
    ])('does not take a right-click on $what as a row', async ({ target }) => {
      const { comp, el, shown } = await setupCustom(c => c.rowsOnly.set(false));

      const event = rightClick(el(target));

      expect(comp.rowEvents).toHaveLength(0);
      expect(comp.headerEvents).toHaveLength(0);
      expect(shown()).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('follows the bound menu when it is swapped or cleared', async () => {
      const { comp, el } = await setupCustom();
      const second = fakeMenu();

      comp.menu.set(second);
      rightClick(el('cell-name'), 3, 4);
      expect(second.show).toHaveBeenCalledTimes(1);

      comp.menu.set(undefined);
      const event = rightClick(el('cell-name'));
      expect(event.defaultPrevented).toBe(false);
      expect(second.show).toHaveBeenCalledTimes(1);
    });

    it('stops answering gestures once destroyed', async () => {
      const { comp, fixture, el, shown } = await setupCustom();
      const cell = el('cell-name');

      fixture.destroy();
      rightClick(cell);

      expect(comp.rowEvents).toHaveLength(0);
      expect(shown()).not.toHaveBeenCalled();
    });
  });
});
