import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    ElementRef,
    inject,
    AfterViewInit,
    OnDestroy,
    ViewChild,
    signal,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-scroll-area',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div 
      [class]="rootClasses()" 
      [attr.data-slot]="'scroll-area'"
      #scrollRoot
    >
      <div 
        [class]="viewportClasses()"
        [attr.data-slot]="'scroll-area-viewport'"
        #viewport
        (scroll)="onScroll()"
      >
        <ng-content />
      </div>
      <!-- Vertical Scrollbar -->
      @if (showVertical()) {
        <div
          [class]="verticalScrollbarClasses()"
          [attr.data-slot]="'scroll-area-scrollbar'"
          [attr.data-orientation]="'vertical'"
        >
          <div
            class="bg-border relative flex-1 rounded-full"
            [attr.data-slot]="'scroll-area-thumb'"
            [style.height.%]="thumbHeightPercent()"
            [style.transform]="'translateY(' + scrollTopPercent() + '%)'"
            (mousedown)="onThumbMouseDown($event, 'vertical')"
          ></div>
        </div>
      }
      <!-- Horizontal Scrollbar -->
      @if (showHorizontal()) {
        <div
          [class]="horizontalScrollbarClasses()"
          [attr.data-slot]="'scroll-area-scrollbar'"
          [attr.data-orientation]="'horizontal'"
        >
          <div
            class="bg-border relative flex-1 rounded-full"
            [attr.data-slot]="'scroll-area-thumb'"
            [style.width.%]="thumbWidthPercent()"
            [style.transform]="'translateX(' + scrollLeftPercent() + '%)'"
            (mousedown)="onThumbMouseDown($event, 'horizontal')"
          ></div>
        </div>
      }
      <!-- Corner -->
      @if (showVertical() && showHorizontal()) {
        <div class="absolute right-0 bottom-0 w-2.5 h-2.5 bg-transparent"></div>
      }
    </div>
  `,
    host: { class: 'contents' },
})
export class ScrollAreaComponent implements AfterViewInit, OnDestroy {
    class = input('');
    orientation = input<'vertical' | 'horizontal' | 'both'>('vertical');

    @ViewChild('viewport') viewportRef?: ElementRef<HTMLElement>;
    @ViewChild('scrollRoot') scrollRootRef?: ElementRef<HTMLElement>;

    // Scroll state
    private scrollTop = signal(0);
    private scrollLeft = signal(0);
    private scrollHeight = signal(0);
    private scrollWidth = signal(0);
    private clientHeight = signal(0);
    private clientWidth = signal(0);

    private resizeObserver?: ResizeObserver;

    rootClasses = computed(() => cn('relative overflow-hidden', this.class()));

    viewportClasses = computed(() =>
        cn(
            'size-full rounded-[inherit] overflow-auto scrollbar-none',
            'focus-visible:ring-ring/50 transition-[color,box-shadow] outline-none focus-visible:ring-[3px]'
        )
    );

    verticalScrollbarClasses = computed(() =>
        cn(
            'absolute right-0 top-0 flex touch-none p-px transition-colors select-none',
            'h-full w-2.5 border-l border-l-transparent'
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

    ngAfterViewInit() {
        this.updateScrollMetrics();

        // Observe size changes
        if (this.viewportRef?.nativeElement) {
            this.resizeObserver = new ResizeObserver(() => {
                this.updateScrollMetrics();
            });
            this.resizeObserver.observe(this.viewportRef.nativeElement);
        }
    }

    ngOnDestroy() {
        this.resizeObserver?.disconnect();
    }

    onScroll() {
        this.updateScrollMetrics();
    }

    private updateScrollMetrics() {
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

    onThumbMouseDown(event: MouseEvent, orientation: 'vertical' | 'horizontal') {
        event.preventDefault();
        const viewport = this.viewportRef?.nativeElement;
        if (!viewport) return;

        const startY = event.clientY;
        const startX = event.clientX;
        const startScrollTop = viewport.scrollTop;
        const startScrollLeft = viewport.scrollLeft;

        const onMouseMove = (e: MouseEvent) => {
            if (orientation === 'vertical') {
                const deltaY = e.clientY - startY;
                const scrollRatio = viewport.scrollHeight / viewport.clientHeight;
                viewport.scrollTop = startScrollTop + deltaY * scrollRatio;
            } else {
                const deltaX = e.clientX - startX;
                const scrollRatio = viewport.scrollWidth / viewport.clientWidth;
                viewport.scrollLeft = startScrollLeft + deltaX * scrollRatio;
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
}
