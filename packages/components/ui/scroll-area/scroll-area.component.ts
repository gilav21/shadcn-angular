import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { onPointerDrag } from '../../lib/touch';

@Component({
  selector: 'ui-scroll-area',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scroll-area.component.html',
  host: { class: 'contents' },
})
export class ScrollAreaComponent implements AfterViewInit, OnDestroy {
  class = input('');
  orientation = input<'vertical' | 'horizontal' | 'both'>('vertical');

  @ViewChild('viewport') viewportRef?: ElementRef<HTMLElement>;
  @ViewChild('scrollRoot') scrollRootRef?: ElementRef<HTMLElement>;

  private readonly scrollTop = signal(0);
  private readonly scrollLeft = signal(0);
  private readonly scrollHeight = signal(0);
  private readonly scrollWidth = signal(0);
  private readonly clientHeight = signal(0);
  private readonly clientWidth = signal(0);

  private resizeObserver?: ResizeObserver;
  private dragCleanup?: () => void;

  rootClasses = computed(() => cn('relative overflow-hidden', this.class()));

  viewportClasses = computed(() =>
    cn(
      'size-full rounded-[inherit] overflow-auto scrollbar-none',
      'focus-visible:ring-ring/50 transition-[color,box-shadow] outline-none focus-visible:ring-[3px]'
    )
  );

  verticalScrollbarClasses = computed(() =>
    cn(
      'absolute end-0 top-0 flex touch-none p-px transition-colors select-none',
      'h-full w-2.5 border-s border-s-transparent'
    )
  );

  horizontalScrollbarClasses = computed(() =>
    cn(
      'absolute bottom-0 left-0 flex touch-none p-px transition-colors select-none',
      'h-2.5 w-full flex-row border-t border-t-transparent'
    )
  );

  showVertical = computed(() => {
    const orientation = this.orientation();
    return (orientation === 'vertical' || orientation === 'both') &&
      this.scrollHeight() > this.clientHeight();
  });

  showHorizontal = computed(() => {
    const orientation = this.orientation();
    return (orientation === 'horizontal' || orientation === 'both') &&
      this.scrollWidth() > this.clientWidth();
  });

  thumbHeightPercent = computed(() => {
    const clientHeight = this.clientHeight();
    const scrollHeight = this.scrollHeight();
    if (scrollHeight === 0) return 100;
    return Math.max(10, (clientHeight / scrollHeight) * 100);
  });

  thumbWidthPercent = computed(() => {
    const clientWidth = this.clientWidth();
    const scrollWidth = this.scrollWidth();
    if (scrollWidth === 0) return 100;
    return Math.max(10, (clientWidth / scrollWidth) * 100);
  });

  scrollTopPercent = computed(() => {
    const scrollTop = this.scrollTop();
    const scrollHeight = this.scrollHeight();
    const clientHeight = this.clientHeight();
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll === 0) return 0;
    const thumbHeight = this.thumbHeightPercent();
    const trackPercent = 100 - thumbHeight;
    return (scrollTop / maxScroll) * trackPercent;
  });

  scrollLeftPercent = computed(() => {
    const scrollLeft = this.scrollLeft();
    const scrollWidth = this.scrollWidth();
    const clientWidth = this.clientWidth();
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll === 0) return 0;
    const thumbWidth = this.thumbWidthPercent();
    const trackPercent = 100 - thumbWidth;
    return (scrollLeft / maxScroll) * trackPercent;
  });

  ngAfterViewInit(): void {
    this.updateScrollMetrics();

    if (this.viewportRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateScrollMetrics();
      });
      this.resizeObserver.observe(this.viewportRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.dragCleanup?.();
  }

  onScroll(): void {
    this.updateScrollMetrics();
  }

  private updateScrollMetrics(): void {
    const viewport = this.viewportRef?.nativeElement;
    if (viewport) {
      this.scrollTop.set(viewport.scrollTop);
      this.scrollLeft.set(viewport.scrollLeft);
      this.scrollHeight.set(viewport.scrollHeight);
      this.scrollWidth.set(viewport.scrollWidth);
      this.clientHeight.set(viewport.clientHeight);
      this.clientWidth.set(viewport.clientWidth);
    }
  }

  onThumbDragStart(event: MouseEvent | TouchEvent, orientation: 'vertical' | 'horizontal'): void {
    event.preventDefault();
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) return;

    const { clientX: startX, clientY: startY } = this.getPointerCoords(event);
    const startScrollTop = viewport.scrollTop;
    const startScrollLeft = viewport.scrollLeft;

    this.dragCleanup = onPointerDrag(
      (clientX, clientY) => {
        if (orientation === 'vertical') {
          const deltaY = clientY - startY;
          const scrollRatio = viewport.scrollHeight / viewport.clientHeight;
          viewport.scrollTop = startScrollTop + deltaY * scrollRatio;
        } else {
          const deltaX = clientX - startX;
          const scrollRatio = viewport.scrollWidth / viewport.clientWidth;
          viewport.scrollLeft = startScrollLeft + deltaX * scrollRatio;
        }
      },
      () => {
        this.dragCleanup = undefined;
      },
    );
  }

  private getPointerCoords(event: MouseEvent | TouchEvent): { readonly clientX: number; readonly clientY: number } {
    if ('touches' in event && event.touches.length > 0) {
      return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    const mouseEvent = event as MouseEvent;
    return { clientX: mouseEvent.clientX, clientY: mouseEvent.clientY };
  }

  scrollToBottom(): void {
    const viewport = this.viewportRef?.nativeElement;
    if (viewport) {
      // Use requestAnimationFrame to ensure we scroll after layout updates
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight;
        this.scrollTop.set(viewport.scrollTop); // Update signal
      });
    }
  }
}
