import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  output,
  viewChild,
  ElementRef,
  TemplateRef,
  AfterViewInit,
  OnDestroy,
  effect,
  ContentChild,
  Directive,
  inject,
  viewChildren,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { cn } from '../../lib/utils';
import { VirtualAxis } from './virtual-scroll.axis';

/**
 * Minimal shape virtual-scroll needs from a row. `id` is optional and used only
 * for stable tracking when present (`trackByFn` falls back to the render index
 * otherwise), so ANY object type satisfies it — a consumer's existing row type
 * does not need an `id` field or an index signature to be virtualized.
 */
export interface VirtualItem {
  id?: string | number;
}

export interface VirtualScrollState {
  windowStart: number;
  windowEnd: number;
  windowSize: number;
  totalItems: number;
  scrollProgress: number;
}

/**
 * Which axis (or axes) are virtualized.
 *
 * - `'vertical'` (default) — the original behaviour: `items` is a column of
 *   rows, windowed on Y.
 * - `'horizontal'` — `items` is a row of cells, windowed on X using
 *   {@link VirtualScrollComponent.minItemWidth}.
 * - `'both'` — `items` is a **flat row-major grid**; set
 *   {@link VirtualScrollComponent.columnCount} and both axes are windowed at
 *   once. The item template receives the cell, and `index` is the item's index
 *   in the flat array.
 */
export type VirtualScrollOrientation = 'vertical' | 'horizontal' | 'both';

/** One cell of the 2D window, with its place in the flat `items` array and in the grid. */
export interface VirtualCell<T> {
  readonly item: T;
  readonly index: number;
  readonly row: number;
  readonly column: number;
}

/** The rendered window on both axes — payload of `(cellWindowChange)`. */
export interface VirtualScrollWindow2D {
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly columnStart: number;
  readonly columnEnd: number;
}

@Directive({
  // `[virtualItem]` is a deprecated alias for `[uiVirtualItem]`: the selector
  // was renamed, and a bare rename silently breaks consumer templates still
  // using the old attribute (the directive stops matching, the list renders
  // zero rows, and Angular only emits an NG8113 *warning*). Keeping both bound
  // makes the rename non-breaking; `[virtualItem]` is slated for removal in a
  // future major.
  selector: '[uiVirtualItem],[virtualItem]',
  standalone: true,
})
export class VirtualItemDirective {
  /* eslint-disable @typescript-eslint/no-unused-vars -- dir and ctx required by Angular type-narrowing contract */
  static ngTemplateContextGuard<T>(
    dir: VirtualItemDirective,
    ctx: unknown
  ): ctx is { $implicit: T; index: number } {
    return true;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

/**
 * Runway Virtual Scroll - Variable Height & Anchor Support
 */
@Component({
  selector: 'ui-virtual-scroll',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './virtual-scroll.component.html',
  styleUrl: './virtual-scroll.component.css',
  host: { class: 'contents' },
})
export class VirtualScrollComponent<T extends object = VirtualItem> implements AfterViewInit, OnDestroy {
  /**
   * The full backing list. Only the visible window is rendered, so the array may
   * be very large; rows are keyed by an `id` property when present, so give items
   * stable ids to avoid re-creating DOM as the window moves.
   */
  items = input<T[]>([]);
  /**
   * Assumed height in pixels for rows that have not been measured yet. Rows are
   * measured once rendered and the estimate corrected, so this only needs to be
   * roughly right — but a badly wrong value makes the scrollbar jump as real
   * heights land.
   */
  minItemHeight = input<number>(50);
  /**
   * Assumed **width** in pixels for cells that have not been measured yet — the
   * horizontal counterpart of {@link minItemHeight}, and used only when
   * {@link orientation} is `'horizontal'` or `'both'`.
   */
  minItemWidth = input<number>(100);
  /**
   * Which axis (or axes) to virtualize. Defaults to `'vertical'`, which is
   * exactly the original behaviour. See {@link VirtualScrollOrientation}.
   */
  orientation = input<VirtualScrollOrientation>('vertical');
  /**
   * Number of columns when {@link orientation} is `'both'`: `items` is then read
   * as a flat row-major grid `rowCount = ceil(items.length / columnCount)`.
   * Ignored on the single-axis orientations. A value `< 1` collapses the grid to
   * a single column, so a forgotten binding degrades to a plain vertical list
   * rather than dividing by zero.
   */
  columnCount = input<number>(1);
  /** Extra rows rendered beyond each edge of the viewport. Higher values trade memory for fewer blank frames during fast scrolling. */
  buffer = input<number>(5);
  /** Shows the loading indicator at the bottom and suppresses further {@link scrollEnd} emissions, so a slow page load cannot trigger a second fetch. */
  loading = input<boolean>(false);
  /** Whether more pages exist. Set it to `false` at the end of the data and {@link scrollEnd} stops firing, along with the loading row. */
  hasMore = input<boolean>(true);

  @ContentChild(VirtualItemDirective, { read: TemplateRef }) itemTemplateRef?: TemplateRef<{ $implicit: T; index: number }>;
  @ContentChild('loading', { read: TemplateRef }) customLoadingTemplate?: TemplateRef<unknown>;

  /** Emitted whenever the rendered index window moves. The range includes the {@link buffer} rows, so it is wider than what is actually on screen. */
  windowChange = output<{ start: number; end: number }>();
  /**
   * Infinite-scroll trigger: emitted when the viewport reaches within two rows
   * of the end, and only while {@link hasMore} is true and {@link loading} is
   * false. Set `loading` synchronously in the handler, or it will fire again on
   * the next scroll frame.
   */
  scrollEnd = output<void>();
  /** Richer counterpart to {@link windowChange}: the same window plus its size, the total item count and scroll progress from 0 to 1 — enough to drive a custom scrollbar or position readout. */
  scrollState = output<VirtualScrollState>();
  /** Emitted in `'both'` mode whenever the 2D window moves. Never fires on the single-axis orientations. */
  readonly cellWindowChange = output<VirtualScrollWindow2D>();

  containerRef = viewChild<ElementRef<HTMLElement>>('container');
  itemElements = viewChildren('itemEl', { read: ElementRef });

  containerHeight = signal(0);
  containerWidth = signal(0);
  scrollTop = signal(0);
  scrollLeft = signal(0);
  measurementVersion = signal(0);

  private readonly CHUNK_SIZE = 500;
  private readonly rowAxis = new VirtualAxis(this.CHUNK_SIZE);
  private readonly columnAxis = new VirtualAxis(this.CHUNK_SIZE);

  private readonly resizeObserver: ResizeObserver;
  private containerObserver?: ResizeObserver;
  private readonly ngZone = inject(NgZone);

  totalItems = computed(() => this.items().length);
  itemTemplate = computed(() => this.itemTemplateRef);
  loadingTemplate = computed(() => this.customLoadingTemplate);

  /** `true` when both axes are windowed and `items` is read as a flat row-major grid. */
  readonly isGrid = computed(() => this.orientation() === 'both');
  /** `true` when the main axis is X — either `'horizontal'`, or the column axis of a grid. */
  readonly isHorizontal = computed(() => this.orientation() === 'horizontal');

  /** Columns in the grid; always `1` outside `'both'` mode, and never less than `1`. */
  readonly gridColumns = computed(() => (this.isGrid() ? Math.max(1, Math.trunc(this.columnCount())) : 1));
  /** Rows in the grid; equals the item count on the vertical axis outside `'both'` mode. */
  readonly gridRows = computed(() =>
    this.isGrid() ? Math.ceil(this.totalItems() / this.gridColumns()) : this.totalItems()
  );

  containerClasses = computed(() => {
    const base = 'relative h-full w-full contain-strict';
    const axis = this.orientation();
    if (axis === 'horizontal') return cn(`overflow-x-auto overflow-y-hidden ${base}`, 'will-change-scroll');
    if (axis === 'both') return cn(`overflow-auto ${base}`, 'will-change-scroll');
    return cn(`overflow-y-auto overflow-x-hidden ${base}`, 'will-change-scroll');
  });

  loadingClasses = computed(() =>
    cn('py-4 flex justify-center absolute bottom-0 left-0 right-0')
  );

  constructor() {
    this.resizeObserver = new ResizeObserver(entries => {
      this.ngZone.run(() => this.handleResizes(entries));
    });

    effect(() => {
      const { end } = this.viewportRange();
      const total = this.mainAxisCount();
      if (end >= total - 2 && !this.loading() && this.hasMore()) {
        this.scrollEnd.emit();
      }
    });

    effect(() => {
      const { start, end } = this.renderRange();
      this.windowChange.emit({ start, end });

      this.scrollState.emit({
        windowStart: start,
        windowEnd: end,
        windowSize: end - start,
        totalItems: this.totalItems(),
        scrollProgress: this.calculateScrollProgress()
      });
    });

    effect(() => {
      if (!this.isGrid()) return;
      const rows = this.renderRange();
      const columns = this.columnRenderRange();
      this.cellWindowChange.emit({
        rowStart: rows.start,
        rowEnd: rows.end,
        columnStart: columns.start,
        columnEnd: columns.end,
      });
    });

    effect((onCleanup) => {
      const els = this.itemElements();
      els.forEach(el => this.resizeObserver.observe(el.nativeElement));
      onCleanup(() => {
        this.resizeObserver.disconnect();
      });
    });
  }

  ngAfterViewInit(): void {
    const container = this.containerRef()?.nativeElement;
    if (container) {
      this.containerHeight.set(container.clientHeight);
      this.containerWidth.set(container.clientWidth);
      const onResize = (): void => {
        this.containerHeight.set(container.clientHeight);
        this.containerWidth.set(container.clientWidth);
      };
      this.containerObserver = new ResizeObserver(onResize);
      this.containerObserver.observe(container);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver.disconnect();
    this.containerObserver?.disconnect();
  }

  /** Viewport scroll handler; records the offset that drives which window is rendered. Bound in the template — it is the single input to the virtualization maths. */
  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.scrollTop.set(target.scrollTop);
    this.scrollLeft.set(target.scrollLeft);
  }

  /** The axis the main `viewportRange` / `renderRange` / padding computeds run on. */
  private mainAxis(): VirtualAxis {
    return this.isHorizontal() ? this.columnAxis : this.rowAxis;
  }

  private mainEstimate(): number {
    return this.isHorizontal() ? this.minItemWidth() : this.minItemHeight();
  }

  private mainAxisCount(): number {
    return this.isHorizontal() ? this.totalItems() : this.gridRows();
  }

  private mainScroll(): number {
    return this.isHorizontal() ? this.scrollLeft() : this.scrollTop();
  }

  private mainViewport(): number {
    return this.isHorizontal() ? this.containerWidth() : this.containerHeight();
  }

  private getOffsetForIndex(index: number): number {
    return this.mainAxis().offsetForIndex(index, this.mainEstimate());
  }

  private getIndexForOffset(scrollY: number): number {
    return this.mainAxis().indexForOffset(scrollY, this.mainEstimate(), this.mainAxisCount());
  }

  viewportRange = computed(() => {
    this.measurementVersion();
    return this.mainAxis().window(
      this.mainScroll(),
      this.mainViewport(),
      this.mainEstimate(),
      this.mainAxisCount()
    );
  });

  renderRange = computed(() => {
    const { start, end } = this.viewportRange();
    const total = this.mainAxisCount();
    const buf = this.buffer();

    const renderStart = Math.max(0, start - buf);
    const renderEnd = Math.min(total, end + buf);

    return { start: renderStart, end: renderEnd };
  });

  /**
   * Columns actually covering the viewport in `'both'` mode, WITHOUT the
   * buffer — the column-axis counterpart of {@link viewportRange}. Scroll
   * anchoring keys off this rather than off {@link columnRenderRange}, so a
   * buffered column sitting before the viewport is corrected on exactly the
   * same terms as its row-axis equivalent. With `buffer` at 0 the two coincide,
   * which is why the asymmetry was invisible until the thresholds were named
   * apart.
   */
  private readonly columnViewportRange = computed(() => {
    if (!this.isGrid()) return { start: 0, end: 1 };

    this.measurementVersion();
    return this.columnAxis.window(
      this.scrollLeft(),
      this.containerWidth(),
      this.minItemWidth(),
      this.gridColumns()
    );
  });

  /** Window of columns rendered in `'both'` mode. Collapses to `{ start: 0, end: 1 }` on the single-axis orientations. */
  readonly columnRenderRange = computed(() => {
    if (!this.isGrid()) return { start: 0, end: 1 };

    const { start, end } = this.columnViewportRange();
    const columns = this.gridColumns();
    const buf = this.buffer();
    return { start: Math.max(0, start - buf), end: Math.min(columns, end + buf) };
  });

  /**
   * The rendered window for the single-axis orientations.
   *
   * Empty in `'both'` mode on purpose: `renderRange()` there indexes ROWS, so
   * slicing the flat item array by it would return a run of cells that has
   * nothing to do with what is on screen. Read {@link visibleCellRows} for the
   * grid instead.
   */
  visibleItems = computed(() => {
    if (this.isGrid()) return [];
    const { start, end } = this.renderRange();
    const items = this.items();
    return items.slice(start, end).map((item, idx) => ({
      ...item,
      _virtualIndex: start + idx
    }));
  });

  /**
   * The 2D window as `VirtualCell` rows — one entry per rendered row, each
   * carrying only the rendered columns. Empty outside `'both'` mode. Trailing
   * cells of a ragged final row are omitted rather than padded with holes.
   */
  readonly visibleCellRows = computed((): { readonly row: number; readonly cells: VirtualCell<T>[] }[] => {
    if (!this.isGrid()) return [];

    const items = this.items();
    const columns = this.gridColumns();
    const rows = this.renderRange();
    const cols = this.columnRenderRange();
    const out: { row: number; cells: VirtualCell<T>[] }[] = [];

    for (let row = rows.start; row < rows.end; row++) {
      const cells: VirtualCell<T>[] = [];
      for (let column = cols.start; column < cols.end; column++) {
        const index = row * columns + column;
        const item = items[index];
        if (item === undefined) continue;
        cells.push({ item, index, row, column });
      }
      out.push({ row, cells });
    }
    return out;
  });

  paddingTop = computed(() => {
    if (this.isHorizontal()) return 0;
    this.measurementVersion();
    return this.rowAxis.offsetForIndex(this.renderRange().start, this.minItemHeight());
  });

  paddingBottom = computed(() => {
    if (this.isHorizontal()) return 0;
    this.measurementVersion();
    const estimate = this.minItemHeight();
    const total = this.rowAxis.totalSize(this.gridRows(), estimate);
    return Math.max(0, total - this.rowAxis.offsetForIndex(this.renderRange().end, estimate));
  });

  /** Leading spacer on the X axis. Zero unless the column axis is virtualized. */
  readonly paddingStart = computed(() => {
    this.measurementVersion();
    if (this.isHorizontal()) return this.columnAxis.offsetForIndex(this.renderRange().start, this.minItemWidth());
    if (this.isGrid()) return this.columnAxis.offsetForIndex(this.columnRenderRange().start, this.minItemWidth());
    return 0;
  });

  /** Trailing spacer on the X axis. Zero unless the column axis is virtualized. */
  readonly paddingEnd = computed(() => {
    this.measurementVersion();
    const estimate = this.minItemWidth();
    if (this.isHorizontal()) {
      const total = this.columnAxis.totalSize(this.totalItems(), estimate);
      return Math.max(0, total - this.columnAxis.offsetForIndex(this.renderRange().end, estimate));
    }
    if (this.isGrid()) {
      const total = this.columnAxis.totalSize(this.gridColumns(), estimate);
      return Math.max(0, total - this.columnAxis.offsetForIndex(this.columnRenderRange().end, estimate));
    }
    return 0;
  });

  private handleResizes(entries: ResizeObserverEntry[]): void {
    // Scroll anchoring: a row (or column) that grows ABOVE/BEFORE the viewport
    // would otherwise shove the content the user is reading. Both axes are
    // corrected, including in grid mode.
    const adjustment = { top: 0, left: 0 };
    // Both thresholds are the UNBUFFERED viewport start of their axis, so a
    // buffered row and a buffered column behave identically.
    const firstMain = this.viewportRange().start;
    const firstColumn = this.isGrid() ? this.columnViewportRange().start : 0;

    for (const entry of entries) {
      this.recordEntry(entry, firstMain, firstColumn, adjustment);
    }

    if (adjustment.top !== 0 || adjustment.left !== 0) {
      const container = this.containerRef()?.nativeElement;
      if (container) this.applyScrollAdjustment(container, adjustment);
    }

    this.measurementVersion.update(v => v + 1);
  }

  /** Folds one measurement into the right axis, accumulating any scroll correction it implies. */
  private recordEntry(
    entry: ResizeObserverEntry,
    firstMain: number,
    firstColumn: number,
    adjustment: { top: number; left: number },
  ): void {
    const el = entry.target as HTMLElement;
    const box = entry.borderBoxSize[0];

    if (this.isGrid()) {
      this.recordGridEntry(el, box, firstMain, firstColumn, adjustment);
      return;
    }

    const index = Number.parseInt(el.dataset['index'] ?? '-1', 10);
    if (index === -1) return;

    if (this.isHorizontal()) {
      const delta = this.columnAxis.record(index, box.inlineSize, this.minItemWidth());
      if (delta !== 0 && index < firstMain) adjustment.left += delta;
      return;
    }

    const delta = this.rowAxis.record(index, box.blockSize, this.minItemHeight());
    if (delta !== 0 && index < firstMain) adjustment.top += delta;
  }

  /**
   * A grid cell measures BOTH axes. Every cell of a row reports that row, so
   * `VirtualAxis.record` sees the first one as a change and the rest as noise —
   * the delta is counted once, not once per column.
   */
  private recordGridEntry(
    el: HTMLElement,
    box: ResizeObserverSize,
    firstRow: number,
    firstColumn: number,
    adjustment: { top: number; left: number },
  ): void {
    const row = Number.parseInt(el.dataset['row'] ?? '-1', 10);
    const column = Number.parseInt(el.dataset['column'] ?? '-1', 10);

    if (row !== -1) {
      const delta = this.rowAxis.record(row, box.blockSize, this.minItemHeight());
      if (delta !== 0 && row < firstRow) adjustment.top += delta;
    }
    if (column !== -1) {
      const delta = this.columnAxis.record(column, box.inlineSize, this.minItemWidth());
      if (delta !== 0 && column < firstColumn) adjustment.left += delta;
    }
  }

  private applyScrollAdjustment(container: HTMLElement, adjustment: { top: number; left: number }): void {
    if (adjustment.top !== 0) {
      container.scrollTop += adjustment.top;
      this.scrollTop.set(container.scrollTop);
    }
    if (adjustment.left !== 0) {
      container.scrollLeft += adjustment.left;
      this.scrollLeft.set(container.scrollLeft);
    }
  }

  /**
   * Jumps to an item by index, instantly and without smooth scrolling. The offset
   * is computed from measured heights where available and {@link minItemHeight}
   * elsewhere, so a jump far into unmeasured territory lands approximately and
   * settles once the rows there are measured.
   *
   * In `'horizontal'` mode it scrolls the X axis instead; in `'both'` mode
   * `index` is the **row**, and {@link scrollToCell} handles the column too.
   */
  scrollToIndex(index: number): void {
    const offset = this.getOffsetForIndex(index);
    const container = this.containerRef()?.nativeElement;
    if (!container) return;

    if (this.isHorizontal()) {
      container.scrollTo({ left: offset, behavior: 'instant' });
      this.scrollLeft.set(offset);
      return;
    }
    container.scrollTo({ top: offset, behavior: 'instant' });
    this.scrollTop.set(offset);
  }

  /** Jumps to a grid cell, scrolling both axes. Falls back to {@link scrollToIndex} outside `'both'` mode. */
  scrollToCell(row: number, column: number): void {
    if (!this.isGrid()) {
      this.scrollToIndex(row);
      return;
    }
    const container = this.containerRef()?.nativeElement;
    if (!container) return;

    const top = this.rowAxis.offsetForIndex(row, this.minItemHeight());
    const left = this.columnAxis.offsetForIndex(column, this.minItemWidth());
    container.scrollTo({ top, left, behavior: 'instant' });
    this.scrollTop.set(top);
    this.scrollLeft.set(left);
  }

  /** Jumps to the first item. Exact, since offset zero needs no height estimates. */
  scrollToTop(): void {
    this.scrollToIndex(0);
  }

  /**
   * Jumps to the end of the currently known content along the MAIN axis —
   * `scrollLeft` in `'horizontal'` mode, `scrollTop` otherwise. Because
   * unrendered rows are still estimated, this lands on the estimated end rather
   * than a guaranteed final row.
   */
  scrollToBottom(): void {
    const container = this.containerRef()?.nativeElement;
    if (!container) return;

    if (this.isHorizontal()) {
      container.scrollLeft = container.scrollWidth;
      this.scrollLeft.set(container.scrollLeft);
      return;
    }
    container.scrollTop = container.scrollHeight;
    this.scrollTop.set(container.scrollTop);
  }

  /**
   * Row identity for `@for`/`ngFor`. Prefers the item's own `id`, then the
   * internal `_virtualIndex`, and finally `0` — items with neither all collapse
   * onto the same key, so give large lists stable ids.
   */
  trackByFn(item: T & { id?: string | number; _virtualIndex?: number }): string | number {
    return item.id ?? item._virtualIndex ?? 0;
  }

  /** Cell identity for the `'both'` grid loop — the flat index, which is unique by construction. */
  trackByCell(_index: number, cell: VirtualCell<T>): number {
    return cell.index;
  }

  private calculateScrollProgress(): number {
    const container = this.containerRef()?.nativeElement;
    if (!container) return 0;
    if (this.isHorizontal()) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      if (scrollWidth <= clientWidth) return 0;
      return scrollLeft / (scrollWidth - clientWidth);
    }
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight <= clientHeight) return 0;
    return scrollTop / (scrollHeight - clientHeight);
  }
}
