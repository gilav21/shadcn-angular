import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    ContentChildren,
    QueryList,
    AfterContentInit,
    OnDestroy,
    ViewChild,
    HostListener,
} from '@angular/core';
import { cn } from '../lib/utils';

type CarouselOrientation = 'horizontal' | 'vertical';

@Component({
    selector: 'ui-carousel',
    changeDetection: ChangeDetectionStrategy.OnPush,
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
    class = input('');
    orientation = input<CarouselOrientation>('horizontal');
    rtl = input(false);

    @ViewChild('container', { static: true }) containerEl!: ElementRef<HTMLElement>;

    // Internal state
    canScrollPrev = signal(false);
    canScrollNext = signal(true);
    currentIndex = signal(0);

    private scrollContainer: HTMLElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private items: HTMLElement[] = [];

    classes = computed(() => cn(
        'relative',
        this.class()
    ));

    ngAfterContentInit() {
        // Find the scroll container after content is initialized
        setTimeout(() => {
            this.scrollContainer = this.containerEl.nativeElement.querySelector('[data-slot="carousel-content"]');
            if (this.scrollContainer) {
                this.scrollContainer.addEventListener('scroll', () => this.updateScrollState());
                this.updateScrollState();

                // Observe resize
                this.resizeObserver = new ResizeObserver(() => this.updateScrollState());
                this.resizeObserver.observe(this.scrollContainer);
            }
        }, 0);
    }

    ngOnDestroy() {
        this.resizeObserver?.disconnect();
    }

    updateScrollState() {
        if (!this.scrollContainer) return;

        const isHorizontal = this.orientation() === 'horizontal';
        const scrollPos = isHorizontal ? this.scrollContainer.scrollLeft : this.scrollContainer.scrollTop;
        const scrollSize = isHorizontal ? this.scrollContainer.scrollWidth : this.scrollContainer.scrollHeight;
        const clientSize = isHorizontal ? this.scrollContainer.clientWidth : this.scrollContainer.clientHeight;

        this.canScrollPrev.set(scrollPos > 1);
        this.canScrollNext.set(scrollPos < scrollSize - clientSize - 1);

        // Update current index based on scroll position
        const items = this.scrollContainer.querySelectorAll('[data-slot="carousel-item"]');
        if (items.length > 0) {
            const itemSize = isHorizontal ? (items[0] as HTMLElement).offsetWidth : (items[0] as HTMLElement).offsetHeight;
            if (itemSize > 0) {
                this.currentIndex.set(Math.round(scrollPos / itemSize));
            }
        }
    }

    scrollPrev() {
        if (!this.scrollContainer) return;

        const isHorizontal = this.orientation() === 'horizontal';
        const scrollAmount = isHorizontal ? this.scrollContainer.clientWidth : this.scrollContainer.clientHeight;

        this.scrollContainer.scrollBy({
            [isHorizontal ? 'left' : 'top']: -scrollAmount,
            behavior: 'smooth'
        });
    }

    scrollNext() {
        if (!this.scrollContainer) return;

        const isHorizontal = this.orientation() === 'horizontal';
        const scrollAmount = isHorizontal ? this.scrollContainer.clientWidth : this.scrollContainer.clientHeight;

        this.scrollContainer.scrollBy({
            [isHorizontal ? 'left' : 'top']: scrollAmount,
            behavior: 'smooth'
        });
    }

    scrollTo(index: number) {
        if (!this.scrollContainer) return;

        const items = this.scrollContainer.querySelectorAll('[data-slot="carousel-item"]');
        const item = items[index] as HTMLElement;
        if (item) {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
    }

    onKeydown(event: KeyboardEvent) {
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

@Component({
    selector: 'ui-carousel-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'carousel-content'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class CarouselContentComponent {
    class = input('');
    carousel = inject(CarouselComponent);

    classes = computed(() => {
        const isHorizontal = this.carousel.orientation() === 'horizontal';
        return cn(
            'flex',
            isHorizontal ? '-ml-4' : '-mt-4 flex-col',
            'overflow-hidden scroll-smooth snap-mandatory',
            isHorizontal ? 'snap-x' : 'snap-y',
            this.class()
        );
    });
}

@Component({
    selector: 'ui-carousel-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div 
      [class]="classes()" 
      [attr.data-slot]="'carousel-item'"
      role="group"
      aria-roledescription="slide"
    >
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class CarouselItemComponent {
    class = input('');
    carousel = inject(CarouselComponent);

    classes = computed(() => {
        const isHorizontal = this.carousel.orientation() === 'horizontal';
        return cn(
            'min-w-0 shrink-0 grow-0 basis-full',
            isHorizontal ? 'pl-4' : 'pt-4',
            'snap-start',
            this.class()
        );
    });
}

@Component({
    selector: 'ui-carousel-previous',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'carousel-previous'"
      [disabled]="isRtl() ? !carousel.canScrollNext() : !carousel.canScrollPrev()"
      (click)="onClick()"
      aria-label="Previous slide"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class]="iconClasses()">
        <path d="m15 18-6-6 6-6"/>
      </svg>
      <span class="sr-only">Previous slide</span>
    </button>
  `,
    host: { class: 'contents' },
})
export class CarouselPreviousComponent {
    class = input('');
    carousel = inject(CarouselComponent);

    isRtl = computed(() => this.carousel.rtl() && this.carousel.orientation() === 'horizontal');

    onClick() {
        // In RTL horizontal mode, previous button scrolls next (content flows right-to-left)
        if (this.isRtl()) {
            this.carousel.scrollNext();
        } else {
            this.carousel.scrollPrev();
        }
    }

    iconClasses = computed(() => cn(
        'h-4 w-4'
    ));

    classes = computed(() => {
        const isHorizontal = this.carousel.orientation() === 'horizontal';
        return cn(
            'absolute h-8 w-8 rounded-full',
            'inline-flex items-center justify-center',
            'border border-input bg-background shadow-sm',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            'transition-colors',
            isHorizontal
                ? '-left-12 top-1/2 -translate-y-1/2'
                : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
            this.class()
        );
    });
}

@Component({
    selector: 'ui-carousel-next',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'carousel-next'"
      [disabled]="isRtl() ? !carousel.canScrollPrev() : !carousel.canScrollNext()"
      (click)="onClick()"
      aria-label="Next slide"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class]="iconClasses()">
        <path d="m9 18 6-6-6-6"/>
      </svg>
      <span class="sr-only">Next slide</span>
    </button>
  `,
    host: { class: 'contents' },
})
export class CarouselNextComponent {
    class = input('');
    carousel = inject(CarouselComponent);

    isRtl = computed(() => this.carousel.rtl() && this.carousel.orientation() === 'horizontal');

    onClick() {
        // In RTL horizontal mode, next button scrolls prev (content flows right-to-left)
        if (this.isRtl()) {
            this.carousel.scrollPrev();
        } else {
            this.carousel.scrollNext();
        }
    }

    iconClasses = computed(() => cn(
        'h-4 w-4'
    ));

    classes = computed(() => {
        const isHorizontal = this.carousel.orientation() === 'horizontal';
        return cn(
            'absolute h-8 w-8 rounded-full',
            'inline-flex items-center justify-center',
            'border border-input bg-background shadow-sm',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            'transition-colors',
            isHorizontal
                ? '-right-12 top-1/2 -translate-y-1/2'
                : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
            this.class()
        );
    });
}
