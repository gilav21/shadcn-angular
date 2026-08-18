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
    /**
     * Extra classes merged onto the slide. It is `basis-full` — one slide per
     * view — so override the basis to show several at once (e.g.
     * `basis-1/2 lg:basis-1/3`). The `ps-4`/`pt-4` gutter pairs with the track's
     * negative margin, so keep it when restyling.
     */
    class = input('');
    readonly carousel = inject(CAROUSEL);

    classes = computed(() => {
        const isHorizontal = this.carousel.orientation() === 'horizontal';
        return cn(
            'min-w-0 shrink-0 grow-0 basis-full',
            isHorizontal ? 'ps-4' : 'pt-4',
            'snap-start',
            this.class()
        );
    });
}
