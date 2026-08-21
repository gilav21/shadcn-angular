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
 */
@Component({
    selector: 'ui-result-detail',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="classes()" data-slot="result-detail">
            <ng-content />
        </div>
    `,
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
