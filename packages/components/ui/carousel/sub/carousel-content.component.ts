import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CAROUSEL } from '../carousel.component';

@Component({
    selector: 'ui-carousel-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" tabindex="0" [attr.data-slot]="'carousel-content'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class CarouselContentComponent {
    /**
     * Extra classes merged onto the scrolling track. It is the element that
     * actually scrolls (with hidden scrollbars and mandatory snapping), and it
     * carries a negative start margin that cancels the slides' gutter — so change
     * `-ms-4`/`-mt-4` and the slides' padding together.
     */
    class = input('');
    readonly carousel = inject(CAROUSEL);

    classes = computed(() => {
        const isHorizontal = this.carousel.orientation() === 'horizontal';
        return cn(
            'flex',
            isHorizontal ? '-ms-4' : '-mt-4 flex-col',
            'scroll-smooth snap-mandatory scrollbar-hide',
            isHorizontal ? 'overflow-x-auto snap-x' : 'overflow-y-auto snap-y',
            this.class()
        );
    });
}
