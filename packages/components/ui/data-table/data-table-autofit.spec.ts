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

type RectFn = typeof Element.prototype.getBoundingClientRect;

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

describe('DataTableComponent column auto-fit (A8)', () => {
  let component: DataTableComponent<Row>;
  let fixture: ComponentFixture<DataTableComponent<Row>>;
  let hadResizeObserver: boolean;
  let originalRect: RectFn | undefined;

  beforeEach(async () => {
    hadResizeObserver = 'ResizeObserver' in globalThis;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;

    originalRect = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'getBoundingClientRect',
    )?.value as RectFn | undefined;
    Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
      const width = (this.textContent ?? '').length * 7;
      return {
        width,
        height: 16,
        top: 0,
        left: 0,
        right: width,
        bottom: 16,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };

    await TestBed.configureTestingModule({ imports: [DataTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(DataTableComponent<Row>);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', DATA);
    fixture.componentRef.setInput('columns', COLS);
    fixture.componentRef.setInput('enableColumnResize', true);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (originalRect) {
      Element.prototype.getBoundingClientRect = originalRect;
    } else {
      delete (Element.prototype as { getBoundingClientRect?: RectFn }).getBoundingClientRect;
    }
    if (!hadResizeObserver) {
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
    component.fitColumnsToViewport();
    const widths = component.columnWidths();
    expect(widths['id']).toEqual(widths['name']);
    expect(widths['name']).toEqual(widths['note']);
    expect(Number.parseInt(widths['id'], 10)).toBeGreaterThanOrEqual(50);
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
    const container = { scrollLeft: 0 } as HTMLElement;
    vi.spyOn(component, 'scrollContainerRef').mockReturnValue({ nativeElement: container } as never);
    component.scrollToColumn('does-not-exist');
    expect(container.scrollLeft).toBe(0);
    vi.restoreAllMocks();
  });

  it('onResizeMove is a no-op when nothing is being resized', () => {
    expect(() =>
      (component as unknown as { onResizeMove: (x: number) => void }).onResizeMove(50),
    ).not.toThrow();
  });
});
