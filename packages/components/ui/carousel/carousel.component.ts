import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    ElementRef,
    AfterContentInit,
    OnDestroy,
    ViewChild,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';

type CarouselOrientation = 'horizontal' | 'vertical';

export const CAROUSEL = new InjectionToken<CarouselComponent>('CAROUSEL');

@Component({
    selector: 'ui-carousel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: CAROUSEL, useExisting: forwardRef(() => CarouselComponent) }],
    template: `
    <div
      #container
      [class]="classes()"
      [attr.data-slot]="'carousel'"
      [attr.data-orientation]="orientation()"
      role="region"
      aria-roledescription="carousel"
      (keydown)="onKeydown($event)"
    >
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class CarouselComponent implements AfterContentInit, OnDestroy {
    /** Extra classes merged onto the `relative` root. Keep it positioned — the previous/next buttons are absolutely placed against it, and on desktop they sit just outside its edges. */
    class = input('');
    /**
     * Scroll axis. Also decides which arrow keys page the carousel and where the
     * previous/next buttons are placed (sides when horizontal, above and below —
     * rotated — when vertical). The horizontal form is RTL-aware: direction is
     * detected from the document and the buttons swap behaviour accordingly.
     */
    orientation = input<CarouselOrientation>('horizontal');
    private readonly rootEl = inject(ElementRef<HTMLElement>);

    rtl = signal(false);
    private readonly dirObserver: MutationObserver | null = null;

    @ViewChild('container', { static: true }) containerEl!: ElementRef<HTMLElement>;

    canScrollPrev = signal(false);
    canScrollNext = signal(true);
    currentIndex = signal(0);

    private scrollContainer: HTMLElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private scrollListener: (() => void) | null = null;
    private setupTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.updateRtlState();
        this.dirObserver = new MutationObserver(() => this.updateRtlState());
        this.dirObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['dir']
        });
    }

    private updateRtlState(): void {
        this.rtl.set(isRtl(this.rootEl?.nativeElement));
        this.updateScrollState();
    }

    classes = computed(() => cn(
        'relative',
        this.class()
    ));

    ngAfterContentInit(): void {
        this.setupTimer = setTimeout(() => {
            this.scrollContainer = this.containerEl.nativeElement.querySelector('[data-slot="carousel-content"]');
            if (this.scrollContainer) {
                this.scrollListener = () => this.updateScrollState();
                this.scrollContainer.addEventListener('scroll', this.scrollListener);

                this.resizeObserver = new ResizeObserver(() => this.updateScrollState());
                this.resizeObserver.observe(this.scrollContainer);
            }
            this.updateRtlState();
        }, 0);
    }

    ngOnDestroy(): void {
        if (this.setupTimer) {
            clearTimeout(this.setupTimer);
            this.setupTimer = null;
        }
        if (this.scrollContainer && this.scrollListener) {
            this.scrollContainer.removeEventListener('scroll', this.scrollListener);
        }
        this.scrollListener = null;
        this.resizeObserver?.disconnect();
        this.dirObserver?.disconnect();
    }

    /**
     * Recomputes `canScrollPrev`, `canScrollNext` and `currentIndex` from the
     * content element's live scroll metrics. Wired to the content's scroll and
     * resize events; call it manually after adding or removing slides outside
     * those triggers. `currentIndex` assumes uniformly sized slides, since it is
     * derived from the first slide's dimensions.
     */
    updateScrollState(): void {
        if (!this.scrollContainer) return;

        const isHorizontal = this.orientation() === 'horizontal';

        if (isHorizontal) {
            const scrollLeft = this.scrollContainer.scrollLeft;
            const scrollWidth = this.scrollContainer.scrollWidth;
            const clientWidth = this.scrollContainer.clientWidth;
            const maxScroll = scrollWidth - clientWidth;

            const normalizedScroll = Math.abs(scrollLeft);

            const atStart = normalizedScroll < 1;
            const atEnd = normalizedScroll >= maxScroll - 1;

            this.canScrollPrev.set(!atStart);
            this.canScrollNext.set(!atEnd);

            const items = this.scrollContainer.querySelectorAll('[data-slot="carousel-item"]');
            if (items.length > 0) {
                const itemWidth = (items[0] as HTMLElement).offsetWidth;
                if (itemWidth > 0) {
                    this.currentIndex.set(Math.round(normalizedScroll / itemWidth));
                }
            }
        } else {
            const scrollTop = this.scrollContainer.scrollTop;
            const scrollHeight = this.scrollContainer.scrollHeight;
            const clientHeight = this.scrollContainer.clientHeight;

            this.canScrollPrev.set(scrollTop > 1);
            this.canScrollNext.set(scrollTop < scrollHeight - clientHeight - 1);

            const items = this.scrollContainer.querySelectorAll('[data-slot="carousel-item"]');
            if (items.length > 0) {
                const itemHeight = (items[0] as HTMLElement).offsetHeight;
                if (itemHeight > 0) {
                    this.currentIndex.set(Math.round(scrollTop / itemHeight));
                }
            }
        }
    }

    /** Smooth-scrolls back by one full viewport of the content, flipping sign in RTL. A no-op before the content element has been located (one tick after content init). */
    scrollPrev(): void {
        if (!this.scrollContainer) return;

        const isHorizontal = this.orientation() === 'horizontal';
        const scrollAmount = isHorizontal ? this.scrollContainer.clientWidth : this.scrollContainer.clientHeight;
        const direction = (isHorizontal && this.rtl()) ? 1 : -1;

        this.scrollContainer.scrollBy({
            [isHorizontal ? 'left' : 'top']: scrollAmount * direction,
            behavior: 'smooth'
        });
    }

    /** Smooth-scrolls forward by one full viewport of the content, flipping sign in RTL. Pages by viewport, not by slide, so it moves several slides at once when they are narrower than the viewport. */
    scrollNext(): void {
        if (!this.scrollContainer) return;

        const isHorizontal = this.orientation() === 'horizontal';
        const scrollAmount = isHorizontal ? this.scrollContainer.clientWidth : this.scrollContainer.clientHeight;
        const direction = (isHorizontal && this.rtl()) ? -1 : 1;

        this.scrollContainer.scrollBy({
            [isHorizontal ? 'left' : 'top']: scrollAmount * direction,
            behavior: 'smooth'
        });
    }

    /** Smooth-scrolls a specific slide into view by its position in the DOM. Out-of-range indices are ignored. Use it to wire up dot indicators. */
    scrollTo(index: number): void {
        if (!this.scrollContainer) return;

        const items = this.scrollContainer.querySelectorAll('[data-slot="carousel-item"]');
        const item = items[index] as HTMLElement;
        if (item) {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
    }

    /** Keyboard paging on the carousel region: Left/Right when horizontal, Up/Down when vertical. The default is prevented so the keys page the carousel instead of scrolling the page. */
    onKeydown(event: KeyboardEvent): void {
        const isHorizontal = this.orientation() === 'horizontal';

        if ((isHorizontal && event.key === 'ArrowLeft') || (!isHorizontal && event.key === 'ArrowUp')) {
            event.preventDefault();
            this.scrollPrev();
        } else if ((isHorizontal && event.key === 'ArrowRight') || (!isHorizontal && event.key === 'ArrowDown')) {
            event.preventDefault();
            this.scrollNext();
        }
    }
}
