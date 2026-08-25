import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * ErrorPageIllustration — replaces the default typographic status code inside
 * `<ui-error-page>` with artwork of your own.
 *
 * Projecting one removes the default entirely rather than rendering both, so
 * the page never shows a custom illustration and a stray `404` together.
 *
 * ```html
 * <ui-error-page code="404">
 *   <ui-error-page-illustration>
 *     <img src="/lost-astronaut.svg" alt="" />
 *   </ui-error-page-illustration>
 * </ui-error-page>
 * ```
 */
@Component({
    selector: 'ui-error-page-illustration',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './error-page-illustration.component.html',
    host: { class: 'contents' },
})
export class ErrorPageIllustrationComponent {
    /** Extra classes merged onto the illustration wrapper. */
    readonly class = input('');

    readonly classes = computed(() =>
        cn(
            'flex max-w-full items-center justify-center [&_img]:max-w-full [&_svg]:max-w-full',
            this.class(),
        ),
    );
}
