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

export interface VirtualItem {
  id: string | number;
  [key: string]: unknown;
}

export interface VirtualScrollState {
  windowStart: number;
  windowEnd: number;
  windowSize: number;
  totalItems: number;
  scrollProgress: number;
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
export class VirtualScrollComponent<T extends VirtualItem> implements AfterViewInit, OnDestroy {
  items = input<T[]>([]);
  minItemHeight = input<number>(50);
  buffer = input<number>(5);
  loading = input<boolean>(false);
  hasMore = input<boolean>(true);

  @ContentChild(VirtualItemDirective, { read: TemplateRef }) itemTemplateRef?: TemplateRef<{ $implicit: T; index: number }>;
  @ContentChild('loading', { read: TemplateRef }) customLoadingTemplate?: TemplateRef<unknown>;

  windowChange = output<{ start: number; end: number }>();
  scrollEnd = output<void>();
  scrollState = output<VirtualScrollState>();

  containerRef = viewChild<ElementRef<HTMLElement>>('container');
  itemElements = viewChildren('itemEl', { read: ElementRef });

  containerHeight = signal(0);
  scrollTop = signal(0);
  measurementVersion = signal(0);

  private readonly CHUNK_SIZE = 500;
  private readonly chunkCorrections = new Map<number, number>();
  private readonly itemHeights = new Map<number, number>();

  private readonly resizeObserver: ResizeObserver;
  private containerObserver?: ResizeObserver;
  private readonly ngZone = inject(NgZone);

  totalItems = computed(() => this.items().length);
  itemTemplate = computed(() => this.itemTemplateRef);
  loadingTemplate = computed(() => this.customLoadingTemplate);

  containerClasses = computed(() =>
    cn(
      'overflow-y-auto overflow-x-hidden relative h-full w-full contain-strict',
      'will-change-scroll'
    )
  );

  loadingClasses = computed(() =>
    cn('py-4 flex justify-center absolute bottom-0 left-0 right-0')
  );

  constructor() {
    this.resizeObserver = new ResizeObserver(entries => {
      this.ngZone.run(() => this.handleResizes(entries));
    });

    effect(() => {
      const { end } = this.viewportRange();
      const total = this.totalItems();
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
      const onResize = (): void => {
        this.containerHeight.set(container.clientHeight);
      };
      this.containerObserver = new ResizeObserver(onResize);
      this.containerObserver.observe(container);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver.disconnect();
    this.containerObserver?.disconnect();
  }

  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.scrollTop.set(target.scrollTop);
  }

  private getChunkHeight(chunkIndex: number, lastChunkSize: number = this.CHUNK_SIZE): number {
    const correction = this.chunkCorrections.get(chunkIndex) ?? 0;
    return (lastChunkSize * this.minItemHeight()) + correction;
  }

  private getOffsetForIndex(index: number): number {
    const chunkIndex = Math.floor(index / this.CHUNK_SIZE);
    let offset = 0;

    for (let c = 0; c < chunkIndex; c++) {
      offset += this.getChunkHeight(c);
    }

    const startInChunk = chunkIndex * this.CHUNK_SIZE;
    for (let i = startInChunk; i < index; i++) {
      offset += this.itemHeights.get(i) ?? this.minItemHeight();
    }

    return offset;
  }

  private getIndexForOffset(scrollY: number): number {
    let offset = 0;
    let chunkIndex = 0;
    const total = this.totalItems();
    const maxChunks = Math.ceil(total / this.CHUNK_SIZE);

    while (chunkIndex < maxChunks) {
      const size = (chunkIndex === maxChunks - 1)
        ? total - (chunkIndex * this.CHUNK_SIZE)
        : this.CHUNK_SIZE;

      const chunkH = this.getChunkHeight(chunkIndex, size);
      if (offset + chunkH > scrollY) {
        break;
      }
      offset += chunkH;
      chunkIndex++;
    }

    let index = chunkIndex * this.CHUNK_SIZE;
    while (index < total) {
      const h = this.itemHeights.get(index) ?? this.minItemHeight();
      if (offset + h > scrollY) {
        return index;
      }
      offset += h;
      index++;
    }

    return Math.min(index, total - 1);
  }

  viewportRange = computed(() => {
    const sTop = this.scrollTop();
    const cHeight = this.containerHeight();

    this.measurementVersion();
    const total = this.totalItems();
    if (total === 0) return { start: 0, end: 0 };

    const start = this.getIndexForOffset(sTop);
    const endOffset = sTop + cHeight;
    let end = start;
    let currOffset = this.getOffsetForIndex(start);

    while (end < total && currOffset < endOffset) {
      const h = this.itemHeights.get(end) ?? this.minItemHeight();
      currOffset += h;
      end++;
    }

    return { start, end };
  });

  renderRange = computed(() => {
    const { start, end } = this.viewportRange();
    const total = this.totalItems();
    const buf = this.buffer();

    const renderStart = Math.max(0, start - buf);
    const renderEnd = Math.min(total, end + buf);

    return { start: renderStart, end: renderEnd };
  });

  visibleItems = computed(() => {
    const { start, end } = this.renderRange();
    const items = this.items();
    return items.slice(start, end).map((item, idx) => ({
      ...item,
      _virtualIndex: start + idx
    }));
  });

  paddingTop = computed(() => {
    return this.getOffsetForIndex(this.renderRange().start);
  });

  paddingBottom = computed(() => {
    const total = this.totalItems();
    const end = this.renderRange().end;

    const totalMin = total * this.minItemHeight();
    let totalCorrection = 0;
    this.chunkCorrections.forEach(c => totalCorrection += c);

    const totalHeight = totalMin + totalCorrection;
    const itemsEndOffset = this.getOffsetForIndex(end);

    return Math.max(0, totalHeight - itemsEndOffset);
  });

  private handleResizes(entries: ResizeObserverEntry[]): void {
    let scrollAdjustment = 0;
    const firstVisible = this.viewportRange().start;

    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      const index = Number.parseInt(el.dataset['index'] ?? '-1', 10);
      if (index === -1) continue;

      const newHeight = entry.borderBoxSize[0].blockSize;
      const oldHeight = this.itemHeights.get(index) ?? this.minItemHeight();
      const diff = newHeight - oldHeight;

      if (Math.abs(diff) < 0.5) continue;

      this.itemHeights.set(index, newHeight);

      const chunkIdx = Math.floor(index / this.CHUNK_SIZE);
      const currentCorrection = this.chunkCorrections.get(chunkIdx) ?? 0;
      this.chunkCorrections.set(chunkIdx, currentCorrection + diff);

      if (index < firstVisible) {
        scrollAdjustment += diff;
      }
    }

    if (scrollAdjustment !== 0) {
      const container = this.containerRef()?.nativeElement;
      if (container) {
        container.scrollTop += scrollAdjustment;
        this.scrollTop.set(container.scrollTop);
      }
    }

    this.measurementVersion.update(v => v + 1);
  }

  scrollToIndex(index: number): void {
    const offset = this.getOffsetForIndex(index);
    const container = this.containerRef()?.nativeElement;
    if (container) {
      container.scrollTo({ top: offset, behavior: 'instant' });
      this.scrollTop.set(offset);
    }
  }

  scrollToTop(): void {
    this.scrollToIndex(0);
  }

  scrollToBottom(): void {
    const container = this.containerRef()?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  trackByFn(item: T & { _virtualIndex?: number }): string | number {
    return item.id ?? item._virtualIndex;
  }

  private calculateScrollProgress(): number {
    const container = this.containerRef()?.nativeElement;
    if (!container) return 0;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight <= clientHeight) return 0;
    return scrollTop / (scrollHeight - clientHeight);
  }
}
