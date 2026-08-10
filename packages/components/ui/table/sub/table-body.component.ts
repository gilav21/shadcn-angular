import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SkeletonComponent } from '../../skeleton';
import { TableRowComponent } from './table-row.component';
import { TableCellComponent } from './table-cell.component';

@Component({
    selector: 'ui-table-body',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [SkeletonComponent, TableRowComponent, TableCellComponent],
    template: `
        @if (skeleton()) {
            @for (row of skeletonRowItems(); track row) {
                <ui-table-row>
                    <ui-table-cell>
                        <ui-skeleton class="h-4 w-full rounded-md" />
                    </ui-table-cell>
                </ui-table-row>
            }
        } @else {
            <ng-content />
        }
    `,
    host: {
        class: 'flex flex-col flex-1',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-body"',
        'role': 'rowgroup'
    },
})
export class TableBodyComponent {
    /** Extra classes merged onto the body row group. */
    class = input('');
    /** Replaces the projected rows with {@link skeletonRows} single-cell placeholder rows while data loads. The header and footer keep rendering, so the table's chrome stays put. */
    readonly skeleton = input(false);
    /** How many placeholder rows the skeleton shows — match your usual page size so the table does not resize when the data lands. */
    readonly skeletonRows = input(5);

    readonly skeletonRowItems = computed(() =>
        Array.from({ length: this.skeletonRows() }, (_, i) => i)
    );

    classes = computed(() => cn('', this.class()));
}
