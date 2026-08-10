import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { createLocaleSelector, type LocaleInput } from '../../../lib/i18n';
import { CAROUSEL_LOCALES, type CarouselLocale } from '../carousel.locales';
import { CAROUSEL } from '../carousel.component';

@Component({
    selector: 'ui-carousel-next',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'carousel-next'"
      [disabled]="isDisabled()"
      (click)="onClick()"
      [attr.aria-label]="t().nextSlide"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [class]="iconClasses()">
        <path d="m9 18 6-6-6-6"/>
      </svg>
      <span class="sr-only">{{ t().nextSlide }}</span>
    </button>
  `,
    host: { class: 'contents' },
})
export class CarouselNextComponent {
    /** Extra classes merged onto the button. Its position is orientation-dependent (inset on mobile, outside the carousel from `sm` up), so override the inset utilities as a set. */
    readonly class = input('');
    readonly carousel = inject(CAROUSEL);

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CarouselLocale>>();
    protected readonly t = createLocaleSelector(this.locale, CAROUSEL_LOCALES);

    isRtl = computed(() => this.carousel.rtl() && this.carousel.orientation() === 'horizontal');

    isDisabled = computed(() =>
        this.isRtl() ? !this.carousel.canScrollPrev() : !this.carousel.canScrollNext()
    );

    /** Advances the carousel, calling the parent's `scrollPrev` instead when the layout is horizontal RTL — so "next" always means the next slide, not a fixed direction. */
    onClick(): void {
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
            'absolute h-8 w-8 rounded-full z-10',
            'inline-flex items-center justify-center',
            'border border-input bg-background/80 sm:bg-background shadow-sm backdrop-blur-sm sm:backdrop-blur-none',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            'transition-colors',
            isHorizontal
                ? 'right-2 sm:-right-12 top-1/2 -translate-y-1/2'
                : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
            this.class()
        );
    });
}
