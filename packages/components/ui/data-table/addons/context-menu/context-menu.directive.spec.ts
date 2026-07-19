import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  type RowActionContext,
  type SortDirection,
} from '../..';
import type { ContextMenuItem } from '../../../context-menu';

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

  enhancedColumns(): readonly ColumnDef<T>[] {
    return this.columns;
  }
  getRenderedRowAt(index: number): T | undefined {
    return this.rows[index];
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

  it('registers a cell-action slot when rowActions is provided', () => {
    const { comp, fixture } = setup(host);
    expect(host.cellActionSlots()).toHaveLength(0);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    expect(host.cellActionSlots()).toHaveLength(1);
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

  it('buildColumnMenuItems includes sort, pin, and visibility items', () => {
    const { directive } = setup(host);
    const items = directive.buildColumnMenuItems(SORTABLE);
    const labels = items.filter((i) => i.label).map((i) => i.label);
    expect(labels).toContain('Sort Ascending');
    expect(labels).toContain('Sort Descending');
    expect(labels).toContain('Pin Left');
    expect(labels).toContain('Pin Right');
    expect(labels).toContain('Hide Column');
    expect(labels).toContain('Show All Columns');
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

  it('never surfaces undefined labels when the host locale omits keys', () => {
    const { directive } = setup(host);
    const labels = directive.buildColumnMenuItems(SORTABLE).filter((i) => i.type !== 'separator').map((i) => i.label);
    expect(labels.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
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

  it('opens a row menu from the cell-action button positioned at its rect', () => {
    const { comp, fixture, directive } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    const button = document.createElement('button');
    const context: RowActionContext<Row> = { row: { id: '1', name: 'Alice' }, index: 0, selected: false };
    host.cellActionSlots()[0].onClick({ target: button } as unknown as Event, context);

    expect(emitted).toEqual([context]);
  });

  it('opens a row menu from a button click even when the target is not a button', () => {
    const { comp, fixture, directive } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    fixture.detectChanges();
    const emitted: RowActionContext<Row>[] = [];
    directive.rowMenuOpen.subscribe((ctx) => emitted.push(ctx));

    const context: RowActionContext<Row> = { row: { id: '1', name: 'Alice' }, index: 0, selected: false };
    host.cellActionSlots()[0].onClick({ target: document.createElement('span') } as unknown as Event, context);

    expect(emitted).toEqual([context]);
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

  it('cleans up open menus on destroy without throwing', () => {
    const { comp, fixture } = setup(host);
    comp.actions.set(() => [{ label: 'Edit' }]);
    comp.colMenu.set(true);
    fixture.detectChanges();
    const context: RowActionContext<Row> = { row: { id: '1', name: 'Alice' }, index: 0, selected: false };
    host.cellActionSlots()[0].onClick({ target: document.createElement('button') } as unknown as Event, context);
    host.headerActionSlots()[0].onClick({ target: document.createElement('button') } as unknown as Event, SORTABLE);
    expect(() => fixture.destroy()).not.toThrow();
  });
});
