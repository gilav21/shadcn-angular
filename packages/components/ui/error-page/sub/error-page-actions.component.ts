import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * ErrorPageActions — replaces the two default recovery buttons inside
 * `<ui-error-page>` with actions of your own.
 *
 * Projecting one removes the defaults entirely rather than rendering both, so
 * the page never shows your buttons alongside an orphaned pair that emits
 * outputs nobody is listening to. Because the defaults are gone, the
 * `goBack` / `goHome` outputs stop firing — wire your own handlers instead.
 *
 * ```html
 * <ui-error-page code="500">
 *   <ui-error-page-actions>
 *     <ui-button (clicked)="retry()">Try again</ui-button>
 *   </ui-error-page-actions>
 * </ui-error-page>
 * ```
 */
@Component({
    selector: 'ui-error-page-actions',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './error-page-actions.component.html',
    host: { class: 'contents' },
})
export class ErrorPageActionsComponent {
    /** Extra classes merged onto the actions row. */
    readonly class = input('');

    readonly classes = computed(() =>
        cn('flex w-full flex-wrap items-center justify-center gap-2', this.class()),
    );
}
