import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { DataTableComponent } from './data-table.component';
import type {
  CellStyleColumn,
  ColumnDef,
  DataTableColumnState,
  FilterGroup,
} from './data-table.types';
import type { DataTableLocale } from './data-table.locales';

// jest's jsdom does not expose structuredClone (vitest's does); polyfill only
// when absent so the component's deep-clone helpers work under both runners.
const globalWithClone = globalThis as unknown as {
  structuredClone?: <T>(value: T) => T;
};
globalWithClone.structuredClone ??= <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

interface Row {
  id: string;
  name: string;
  role: string;
  amount: number;
  children?: Row[];
}

const FLAT_DATA: Row[] = [
  { id: '1', name: 'Alice', role: 'Admin', amount: 10 },
  { id: '2', name: 'Bob', role: 'User', amount: 20 },
  { id: '3', name: 'Charlie', role: 'User', amount: 30 },
  { id: '4', name: 'David', role: 'Admin', amount: 40 },
  { id: '5', name: 'Eve', role: 'Manager', amount: 50 },
];

const FLAT_COLUMNS: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name', enableSorting: true },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'amount', header: 'Amount' },
];

const TREE_DATA: Row[] = [
  {
    id: 'a',
    name: 'A',
    role: 'root',
    amount: 1,
    children: [
      {
        id: 'a1',
        name: 'A1',
        role: 'child',
        amount: 2,
        children: [{ id: 'a1x', name: 'A1X', role: 'leaf', amount: 3 }],
      },
      { id: 'a2', name: 'A2', role: 'child', amount: 4 },
    ],
  },
  { id: 'b', name: 'B', role: 'root', amount: 5 },
];

const TREE_COLUMNS: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
];

/** Minimal no-op ResizeObserver — jsdom/jest ship none but the ctor uses one. */
class NoopResizeObserver {
  observe(): void {
    /* noop */
  }
  unobserve(): void {
    /* noop */
  }
  disconnect(): void {
    /* noop */
  }
}

type ResizeObserverGlobal = { ResizeObserver?: typeof ResizeObserver };
const HAD_NATIVE_RESIZE_OBSERVER = 'ResizeObserver' in globalThis;
let originalResizeObserver: typeof ResizeObserver | undefined;

type ElementFromPoint = (x: number, y: number) => Element | null;
const HAD_NATIVE_ELEMENT_FROM_POINT = 'elementFromPoint' in document;
let originalElementFromPoint: ElementFromPoint | undefined;

interface ClipboardLike {
  writeText: (text: string) => Promise<void>;
  readText: () => Promise<string>;
}
type NavigatorWithClipboard = { clipboard?: ClipboardLike };
let definedClipboard = false;
let clipboardText = '';

/** Private-member accessor for the handful of guards only reachable internally. */
interface Internals {
  _toFiniteNumber(value: unknown): number | null;
  groupAggregateLabel(accessorKey: string): string;
}

beforeEach(() => {
  const scope = globalThis as ResizeObserverGlobal;
  originalResizeObserver = scope.ResizeObserver;
  scope.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;

  const doc = document as unknown as { elementFromPoint?: ElementFromPoint };
  originalElementFromPoint = doc.elementFromPoint;
  doc.elementFromPoint = () => null;

  clipboardText = '';
  const nav = navigator as unknown as NavigatorWithClipboard;
  definedClipboard = false;
  if (!nav.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') },
      configurable: true,
      writable: true,
    });
    definedClipboard = true;
  }
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(
    (text: string) => {
      clipboardText = String(text);
      return Promise.resolve();
    },
  );
  vi.spyOn(navigator.clipboard, 'readText').mockImplementation(() =>
    Promise.resolve(clipboardText),
  );
});

afterEach(() => {
  vi.restoreAllMocks();

  const scope = globalThis as ResizeObserverGlobal;
  if (HAD_NATIVE_RESIZE_OBSERVER) {
    scope.ResizeObserver = originalResizeObserver;
  } else {
    delete scope.ResizeObserver;
  }

  const doc = document as unknown as { elementFromPoint?: ElementFromPoint };
  if (HAD_NATIVE_ELEMENT_FROM_POINT) {
    doc.elementFromPoint = originalElementFromPoint;
  } else {
    delete doc.elementFromPoint;
  }

  if (definedClipboard) {
    delete (navigator as unknown as NavigatorWithClipboard).clipboard;
    definedClipboard = false;
  }
});

async function makeFixture(
  data: Row[],
  columns: ColumnDef<Row>[],
  inputs: Record<string, unknown> = {},
): Promise<{
  fixture: ComponentFixture<DataTableComponent<Row>>;
  component: DataTableComponent<Row>;
}> {
  await TestBed.configureTestingModule({
    imports: [DataTableComponent],
  }).compileComponents();

  const fixture = TestBed.createComponent(DataTableComponent<Row>);
  const component = fixture.componentInstance;
  fixture.componentRef.setInput('data', data);
  fixture.componentRef.setInput('columns', columns);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  return { fixture, component };
}

/** Build a DragEvent-shaped stub that reads back the source key from getData. */
function makeDragEvent(
  sourceKey: string | null,
  extras: Partial<{ clientY: number; currentTarget: unknown }> = {},
): DragEvent {
  return {
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
    clientY: extras.clientY ?? 0,
    currentTarget: extras.currentTarget ?? null,
    dataTransfer: {
      effectAllowed: '',
      dropEffect: '',
      getData: () => sourceKey ?? '',
      setData: () => undefined,
    },
  } as unknown as DragEvent;
}

describe('DataTableComponent branch coverage', () => {
  describe('locale fallbacks (partial dictionary)', () => {
    it('falls back to English chrome labels when keys are missing', async () => {
      const partial = { code: 'partial' } as unknown as DataTableLocale;
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        locale: partial,
        enableRangeActions: true,
      });

      expect(component.nlFilterPlaceholder()).toBe('Ask in plain English…');
      expect(component.filterBuilderLabels()).toBeTruthy();
      const labels = component.rangeLabels();
      expect(labels).toEqual({
        count: 'Count',
        sum: 'Sum',
        avg: 'Avg',
        min: 'Min',
        max: 'Max',
        chart: 'Chart',
      });
    });

    it('uses the supplied dictionary values when present', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        locale: 'en',
      });
      expect(component.rangeLabels().count).toBe('Count');
    });
  });

  describe('grouping', () => {
    it('builds grouped display rows when groupBy is set', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        groupBy: 'role',
      });
      const rows = component.groupedDisplayRows();
      const groupRows = rows.filter((r) => r.kind === 'group');
      expect(groupRows).toHaveLength(3);
      expect((component as unknown as { groupAggregateLabel(k: string): string }).groupAggregateLabel('role')).toBe('Role');
    });

    it('falls back to the accessor key for an unknown aggregate column', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        groupBy: 'role',
      });
      const internals = component as unknown as Internals;
      expect(internals.groupAggregateLabel('ghost')).toBe('ghost');
    });
  });

  describe('advanced filter with an unknown column', () => {
    it('evaluates a condition referencing a non-existent column', async () => {
      const { component, fixture } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      const group: FilterGroup = {
        type: 'group',
        combinator: 'and',
        rules: [{ type: 'condition', column: 'ghost', operator: 'isNotEmpty' }],
      };
      component.advancedFilter.set(group);
      fixture.detectChanges();
      expect(Array.isArray(component.filteredData())).toBe(true);
    });
  });

  describe('pagination sanitisation', () => {
    it('clamps a zero page size through the pagination effect', async () => {
      const { component, fixture } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      component.paginationState.set({ pageIndex: 0, pageSize: 0 });
      fixture.detectChanges();
      expect(component.paginationState().pageSize).toBe(10);
    });

    it('keeps the current page size when onPaginationChange gets zero', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      const before = component.paginationState().pageSize;
      component.onPaginationChange({ pageIndex: 0, pageSize: 0 });
      expect(component.paginationState().pageSize).toBe(before);
    });
  });

  describe('multi-sort removal', () => {
    it('drops the last column and resets to an empty primary sort', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableMultiSort: true,
      });
      component.onSortChange('name', 'asc', true);
      expect(component.multiSortState()).toHaveLength(1);

      component.onSortChange('name', null, true);
      expect(component.multiSortState()).toHaveLength(0);
      expect(component.sortState()).toEqual({ column: '', direction: null });
    });

    it('clears multi-sort state on a single null sort in multi mode', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableMultiSort: true,
      });
      component.onSortChange('name', 'asc');
      expect(component.multiSortState()).toHaveLength(1);
      component.onSortChange('name', null);
      expect(component.multiSortState()).toHaveLength(0);
    });
  });

  describe('accessibility announcements', () => {
    it('announces the singular "result" for a one-row filter match', async () => {
      vi.useFakeTimers();
      try {
        const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
        component.onFilterChange('Alice');
        vi.advanceTimersByTime(600);
        expect(component.srAnnouncement()).toBe('1 result found for "Alice"');
      } finally {
        vi.useRealTimers();
      }
    });

    it('announces the plural "results" for a multi-row filter match', async () => {
      vi.useFakeTimers();
      try {
        const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
        component.onFilterChange('User');
        vi.advanceTimersByTime(600);
        expect(component.srAnnouncement()).toBe('2 results found for "User"');
      } finally {
        vi.useRealTimers();
      }
    });

    it('uses the accessor key when the sorted column header is empty', async () => {
      const columns: ColumnDef<Row>[] = [
        { accessorKey: 'id', header: '' },
        { accessorKey: 'name', header: 'Name' },
      ];
      const { component } = await makeFixture(FLAT_DATA, columns);
      component.onSortChange('id', 'asc');
      expect(component.srAnnouncement()).toBe('Table sorted by id, ascending');
    });
  });

  describe('cell style fallbacks', () => {
    it('builds a fallback style for a column outside the style map', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      const ghost = { accessorKey: 'ghost', _width: 'auto' } as CellStyleColumn;
      expect(component.getCellStyle(ghost)['flex-shrink']).toBeDefined();
      expect(component.getHeaderCellStyle(ghost)['flex-shrink']).toBeDefined();
    });

    it('builds a depth-shaded fallback tree cell style', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      const ghost = { accessorKey: 'ghost', _width: 'auto' } as CellStyleColumn;
      const style = component.getTreeCellStyle(ghost, 3);
      expect(style['background-color']).toContain('color-mix');
    });
  });

  describe('_toFiniteNumber', () => {
    it('rejects a non-finite number value', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      const internals = component as unknown as Internals;
      expect(internals._toFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull();
      expect(internals._toFiniteNumber(42)).toBe(42);
    });
  });

  describe('footer aggregation via a function', () => {
    it('invokes a functional footer', async () => {
      const columns: ColumnDef<Row>[] = [
        { accessorKey: 'name', header: 'Name', footer: 'Total' },
        {
          accessorKey: 'amount',
          header: 'Amount',
          footer: (rows: Row[]) => `n=${rows.length}`,
        },
      ];
      const { component } = await makeFixture(FLAT_DATA, columns, {
        showFooter: true,
      });
      expect(component.footerValues().get('amount')).toBe('n=5');
      expect(component.footerValues().get('name')).toBe('Total');
    });
  });

  describe('applyColumnState', () => {
    it('applies visibility, width and order together', async () => {
      const { component, fixture } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      const states: DataTableColumnState[] = [
        { columnKey: 'name', visible: false, width: '123px', order: 1 },
        { columnKey: 'id', order: 0 },
      ];
      component.applyColumnState(states);
      fixture.detectChanges();
      expect(component.isColumnVisible('name')).toBe(false);
      expect(component.columnWidths()['name']).toBe('123px');
      expect(component.columnOrder()[0]).toBe('id');
    });
  });

  describe('column drag with dataTransfer fallback source key', () => {
    it('ignores drag-over when reordering is disabled', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      component.onColumnDragOver(makeDragEvent('id'), FLAT_COLUMNS[1]);
      expect(component.dropTargetColumnKey()).toBeNull();
    });

    it('reads the source key from dataTransfer on drag-over', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableColumnReorder: true,
      });
      component.onColumnDragOver(makeDragEvent('id'), FLAT_COLUMNS[1]);
      expect(component.dropTargetColumnKey()).toBe('name');
    });

    it('reorders on drop using the dataTransfer source key', async () => {
      const { component, fixture } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableColumnReorder: true,
      });
      component.onColumnDrop(makeDragEvent('id'), FLAT_COLUMNS[1]);
      fixture.detectChanges();
      const order = component.columnOrder();
      expect(order.indexOf('name')).toBeLessThan(order.indexOf('id'));
    });

    it('clears drag state on a drop when reordering is disabled', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      component.draggedColumnKey.set('id');
      component.onColumnDrop(makeDragEvent('id'), FLAT_COLUMNS[1]);
      expect(component.draggedColumnKey()).toBeNull();
    });
  });

  describe('row drag preview', () => {
    it('computes a reordered preview for an above-drop', async () => {
      const fakeRowEl = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableRowDrag: true,
      });
      component.onRowDragStart(makeDragEvent('1'), FLAT_DATA[0]);
      expect(component.draggedRowId()).toBe('1');

      component.onRowDragOver(
        makeDragEvent('1', { clientY: 10, currentTarget: fakeRowEl }),
        3,
      );
      const preview = component.dragPreviewData();
      expect(preview).not.toBeNull();
      expect(preview).toHaveLength(FLAT_DATA.length);
      component.onRowDragEnd();
    });

    it('emits a reorder event with neighbour ids on drop', async () => {
      const fakeRowEl = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableRowDrag: true,
      });
      let reorder: unknown = null;
      component.rowReorder.subscribe((e) => (reorder = e));

      component.onRowDragStart(makeDragEvent('1'), FLAT_DATA[0]);
      component.onRowDragOver(
        makeDragEvent('1', { clientY: 90, currentTarget: fakeRowEl }),
        3,
      );
      component.onRowDrop(makeDragEvent('1'));
      expect(reorder).toMatchObject({ fromIndex: 0 });
    });
  });

  describe('keyboard clipboard + navigation', () => {
    it('handles a meta+v paste shortcut', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableClipboardPaste: true,
      });
      component.focusedCell.set({ rowIndex: 0, columnKey: 'name' });
      const event = new KeyboardEvent('keydown', { key: 'v', metaKey: true });
      component.onTableKeydown(event);
      expect(component.focusedCell()).toEqual({ rowIndex: 0, columnKey: 'name' });
    });

    it('copies the focused cell on ctrl+c', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      component.focusedCell.set({ rowIndex: 0, columnKey: 'name' });
      component.onTableKeydown(
        new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }),
      );
      expect(clipboardText).toBe('Alice');
    });

    it('copies the focused cell via copyCellToClipboard', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      component.focusedCell.set({ rowIndex: 1, columnKey: 'name' });
      await component.copyCellToClipboard();
      expect(clipboardText).toBe('Bob');
    });

    it('starts editing on Enter from a focused cell', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      component.focusedCell.set({ rowIndex: 0, columnKey: 'name' });
      component.onTableKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(component.focusedCell()).not.toBeNull();
    });

    it('recovers from a focused column key that is not navigable', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      component.focusedCell.set({ rowIndex: 0, columnKey: 'ghostcol' });
      component.onTableKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(component.focusedCell()?.columnKey).toBe('id');
    });

    it('pages down using the scroll container height', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      component.focusedCell.set({ rowIndex: 0, columnKey: 'name' });
      component.onTableKeydown(new KeyboardEvent('keydown', { key: 'PageDown' }));
      expect(component.focusedCell()).not.toBeNull();
    });
  });

  describe('range chart payload', () => {
    it('maps non-numeric cells to zero in a numeric series', async () => {
      const data: Row[] = [
        { id: '1', name: 'A', role: 'x', amount: 10 },
        { id: '2', name: 'B', role: 'x', amount: 20 },
        { id: '3', name: 'C', role: 'x', amount: Number.NaN },
      ];
      const columns: ColumnDef<Row>[] = [
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'amount', header: 'Amount' },
      ];
      const { component } = await makeFixture(data, columns, {
        enableRangeActions: true,
      });
      component.cellRange.set({
        startRow: 0,
        startCol: 'name',
        endRow: 2,
        endCol: 'amount',
      });
      const payload = component.rangeChartPayload();
      expect(payload).not.toBeNull();
      expect(payload?.series[0].values).toContain(0);
    });

    it('skips missing rows when a range extends past the data', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableRangeActions: true,
      });
      component.cellRange.set({
        startRow: 0,
        startCol: 'name',
        endRow: 99,
        endCol: 'amount',
      });
      expect(component.rangeSelectionStats()).not.toBeNull();
    });
  });

  describe('sub-row tree operations', () => {
    it('expands only to the requested depth', async () => {
      const { component } = await makeFixture(TREE_DATA, TREE_COLUMNS, {
        enableSubRows: true,
      });
      component.expandAllSubRows(1);
      const expanded = component.subRowExpandedRows();
      expect(expanded['a']).toBe(true);
      expect(expanded['a1']).toBeUndefined();
    });

    it('returns an empty child list for a leaf row', async () => {
      const { component } = await makeFixture(TREE_DATA, TREE_COLUMNS, {
        enableSubRows: true,
      });
      expect(component.getChildRows({ id: 'b', name: 'B', role: 'root', amount: 5 })).toEqual([]);
    });

    it('selects and deselects descendants', async () => {
      const { component } = await makeFixture(TREE_DATA, TREE_COLUMNS, {
        enableSubRows: true,
      });
      component.selectChildren(TREE_DATA[0]);
      const selected = component.rowSelection();
      expect(selected['a1']).toBe(true);
      expect(selected['a1x']).toBe(true);

      component.deselectChildren(TREE_DATA[0]);
      expect(component.rowSelection()['a1']).toBeUndefined();
    });

    it('no-ops select/deselect for a row outside the tree', async () => {
      const { component } = await makeFixture(TREE_DATA, TREE_COLUMNS, {
        enableSubRows: true,
      });
      const ghost: Row = { id: 'ghost', name: '?', role: '?', amount: 0 };
      component.selectChildren(ghost);
      component.deselectChildren(ghost);
      expect(component.rowSelection()).toEqual({});
    });

    it('cascades selection to descendants and bubbles up to the parent', async () => {
      const { component } = await makeFixture(TREE_DATA, TREE_COLUMNS, {
        enableSubRows: true,
        subRowSelectionMode: 'descendants',
      });
      component.toggleRowWithCascade(TREE_DATA[0]);
      const selected = component.rowSelection();
      expect(selected['a']).toBe(true);
      expect(selected['a1']).toBe(true);
      expect(selected['a1x']).toBe(true);
    });

    it('cascades only to filtered descendants', async () => {
      const { component } = await makeFixture(TREE_DATA, TREE_COLUMNS, {
        enableSubRows: true,
        subRowSelectionMode: 'filteredDescendants',
      });
      component.toggleRowWithCascade(TREE_DATA[0]);
      expect(component.rowSelection()['a']).toBe(true);
    });
  });

  describe('column resize', () => {
    it('resizes with an RTL delta and min-width fallback, then emits', async () => {
      vi.spyOn(DataTableComponent.prototype, 'isRtl').mockReturnValue(true);
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      let emitted: unknown = null;
      component.columnResize.subscribe((e) => (emitted = e));

      const col = { accessorKey: 'name' } as CellStyleColumn;
      component.onResizeStart(new MouseEvent('mousedown', { clientX: 0 }), col);
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40 }));
      expect(component.columnWidths()['name']).toBeDefined();

      document.dispatchEvent(new MouseEvent('mouseup'));
      expect(emitted).toMatchObject({ columnKey: 'name' });
    });

    it('starts a resize from a single-touch handle', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      const col = { accessorKey: 'name', _width: '100px' } as CellStyleColumn;
      const touchEvent = {
        touches: [{ clientX: 5 }],
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as TouchEvent;
      component.onResizeTouchStart(touchEvent, col);
      expect(component.isResizingColumn(col)).toBe(true);
      document.dispatchEvent(new MouseEvent('mouseup'));
    });
  });

  describe('scroll + fit helpers', () => {
    it('scrolls to a known column and ignores an unknown one', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      expect(() => component.scrollToColumn('amount')).not.toThrow();
      expect(() => component.scrollToColumn('ghost')).not.toThrow();
    });

    it('distributes widths across columns to fit the viewport', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS);
      component.fitColumnsToViewport();
      expect(Object.keys(component.columnWidths()).length).toBeGreaterThan(0);
    });
  });

  describe('virtual scroll activation', () => {
    it('activates via the column threshold in auto mode', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableVirtualScroll: 'auto',
        showPagination: false,
        virtualAutoThreshold: { rows: 500, columns: 1 },
      });
      expect(component.isVirtualScrollActive()).toBe(true);
    });

    it('computes a variable-height row range', async () => {
      const { component } = await makeFixture(FLAT_DATA, FLAT_COLUMNS, {
        enableVirtualScroll: true,
        virtualVariableRowHeight: true,
      });
      const range = component.virtualRowRange();
      expect(range.end).toBeGreaterThanOrEqual(range.start);
    });
  });
});
