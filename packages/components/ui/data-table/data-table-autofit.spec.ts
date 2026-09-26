import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { DataTableComponent } from './data-table.component';
import { ColumnDef, ColumnResizeEvent } from './data-table.types';

interface Row {
  id: string;
  name: string;
  note: string;
}

const DATA: Row[] = [
  { id: '1', name: 'Al', note: 'short' },
  { id: '2', name: 'Bo', note: 'a considerably longer note that should widen the column' },
];

const COLS: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'note', header: 'Note' },
];

class FakeResizeObserver {
  observe(): void {
    /* jsdom has no ResizeObserver; noop stub */
  }
  unobserve(): void {
    /* noop */
  }
  disconnect(): void {
    /* noop */
  }
}

/** A text-proportional rect, so content width is measurable without a layout engine. */
function textRect(this: Element): DOMRect {
  const width = (this.textContent ?? '').length * 7;
  return { width, height: 16, top: 0, left: 0, right: width, bottom: 16, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
}

describe('DataTableComponent column auto-fit (A8)', () => {
  let component: DataTableComponent<Row>;
  let fixture: ComponentFixture<DataTableComponent<Row>>;
  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(async () => {
    originalResizeObserver = globalThis.ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;

    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(DataTableComponent<Row>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', DATA);
    fixture.componentRef.setInput('columns', COLS);
    fixture.componentRef.setInput('enableColumnResize', true);
    fixture.detectChanges();

    // Only the off-screen measurer is created after render; give that instance the stub.
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      const el = createElement(tag, options);
      el.getBoundingClientRect = textRect;
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    } else {
      delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });

  it('auto-sizes a column to a pixel width and emits columnResize', () => {
    let event: ColumnResizeEvent | null = null;
    component.columnResize.subscribe((e) => (event = e));

    component.autoSizeColumn('note');

    const width = component.columnWidths()['note'];
    expect(width).toMatch(/^\d+px$/);
    expect(Number.parseInt(width, 10)).toBeGreaterThan(50);
    expect(event).toMatchObject({ columnKey: 'note' });
  });

  it('fits a wide column wider than a short one', () => {
    component.autoSizeColumn('name');
    component.autoSizeColumn('note');
    const name = Number.parseInt(component.columnWidths()['name'], 10);
    const note = Number.parseInt(component.columnWidths()['note'], 10);
    expect(note).toBeGreaterThan(name);
  });

  it('shrinks a column that is wider than its content', () => {
    component.columnWidths.set({ name: '600px' });
    fixture.detectChanges();
    component.autoSizeColumn('name');
    expect(Number.parseInt(component.columnWidths()['name'], 10)).toBeLessThan(600);
  });

  it('auto-sizes every navigable column', () => {
    component.autoSizeAllColumns();
    const widths = component.columnWidths();
    expect(widths['id']).toMatch(/px$/);
    expect(widths['name']).toMatch(/px$/);
    expect(widths['note']).toMatch(/px$/);
  });

  it('distributes the viewport width evenly across columns', () => {
    const container = component.scrollContainerRef()!.nativeElement;
    Object.defineProperty(container, 'clientWidth', { value: 900, configurable: true });

    component.fitColumnsToViewport();

    expect(component.columnWidths()).toEqual({ id: '300px', name: '300px', note: '300px' });
  });

  it('autoSizeColumn/fitColumnsToViewport/scrollToRow/scrollToColumn are no-ops without a scroll container', () => {
    vi.spyOn(component, 'scrollContainerRef').mockReturnValue(undefined as never);
    const before = component.columnWidths();

    component.autoSizeColumn('note');
    expect(component.columnWidths()).toEqual(before);

    component.fitColumnsToViewport();
    expect(component.columnWidths()).toEqual(before);

    expect(() => component.scrollToRow(2)).not.toThrow();
    expect(() => component.scrollToColumn('note')).not.toThrow();
    vi.restoreAllMocks();
  });

  it('autoSizeColumn is a no-op when no matching cells are rendered for the column', () => {
    const before = component.columnWidths();
    component.autoSizeColumn('does-not-exist');
    expect(component.columnWidths()).toEqual(before);
  });

  it('scrollToColumn is a no-op for an unknown column key', () => {
    const container = component.scrollContainerRef()!.nativeElement;
    Object.defineProperty(container, 'scrollLeft', { value: 120, writable: true, configurable: true });

    component.scrollToColumn('does-not-exist');

    expect(container.scrollLeft).toBe(120);
  });

  it('onResizeMove is a no-op when nothing is being resized', () => {
    expect(() =>
      (component as unknown as { onResizeMove: (x: number) => void }).onResizeMove(50),
    ).not.toThrow();
  });
});
