import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * ResultDetail — the optional extra slot inside `<ui-result>`, for content too
 * bulky to sit in the actions row: a stack trace, a `<ui-code-block>`, a
 * summary table.
 *
 * `<ui-result>` selects it out of the default slot and renders it between the
 * description and the actions, so detail and buttons never share a region. Its
 * text is start-aligned rather than inheriting the panel's centring, because
 * centred code or tabular data is unreadable.
 *
 * **It opts out of the panel's live region.** `<ui-result>` is
 * `aria-live="polite"`, and live regions are inherited, so without
 * `aria-live="off"` here a screen reader would read an entire stack trace aloud
 * the moment the panel appeared. The content stays reachable by normal
 * navigation — it is simply not announced.
 */
@Component({
    selector: 'ui-result-detail',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './result-detail.component.html',
    host: { class: 'contents' },
})
export class ResultDetailComponent {
    /** Extra classes merged onto the detail panel. */
    readonly class = input('');

    readonly classes = computed(() =>
        cn(
            'w-full max-w-full overflow-x-auto rounded-md border bg-muted/40 p-3 text-start text-sm',
            this.class(),
        ),
    );
}
