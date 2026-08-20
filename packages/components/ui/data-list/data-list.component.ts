import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cn } from '../../lib/utils';

/** One label→value pair for {@link DataListComponent}'s simple mode. */
export interface DataListItem {
    label: string;
    value: string;
}

/** Layout of a {@link DataListComponent}: labels above values, or beside them. */
export type DataListOrientation = 'vertical' | 'horizontal';

/**
 * Read-only label→value description list — the counterpart to `table` for
 * detail panes, and the semantically correct answer to the two-column key/value
 * layouts people build out of `<table>`.
 *
 * Dual mode, per `.claude/CLAUDE.md`: pass {@link items} for the plain case, or
 * project `ui-data-list-item` children for arbitrary per-row content. Both may
 * be combined — generated rows render first, projected rows after.
 *
 * The output is a real `<dl>` with `<dt>`/`<dd>` children (UC-13). Every wrapper
 * between them is `display: contents` so the pairing survives to assistive tech
 * (risk R-4).
 */
@Component({
    selector: 'ui-data-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './data-list.component.html',
    host: {
        class: 'block',
        '[attr.data-orientation]': 'orientation()',
        '[attr.data-slot]': '"data-list"',
    },
})
export class DataListComponent {
    /** Simple mode rows. Rendered before any projected `ui-data-list-item`. */
    readonly items = input<readonly DataListItem[]>([]);
    /**
     * `'vertical'` stacks each value under its label. `'horizontal'` puts labels
     * beside values from the `sm` breakpoint up, and collapses back to stacked
     * below it so nothing is squeezed on a phone (UC-12).
     */
    readonly orientation = input<DataListOrientation>('vertical');
    /** Extra classes merged onto the inner `<dl>`. */
    readonly class = input('');

    protected readonly listClasses = computed(() =>
        cn(
            'grid grid-cols-1 text-sm',
            this.orientation() === 'horizontal'
                ? 'gap-x-4 gap-y-3 sm:grid-cols-[minmax(6rem,12rem)_1fr]'
                : 'gap-3',
            this.class()
        )
    );
}
