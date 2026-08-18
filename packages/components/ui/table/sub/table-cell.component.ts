import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-table-cell',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './table-cell.component.css',
    host: {
        class: 'flex items-center flex-shrink-0',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-cell"',
        'role': 'cell'
    },
})
export class TableCellComponent {
    /**
     * Extra classes merged onto the cell. Cells are `flex-1` by default, so all
     * columns share the width evenly — set an explicit `w-*`/`basis-*` here (and
     * the same on the matching `ui-table-head`) to size a column. A projected
     * `role="checkbox"` control already gets its padding and alignment trimmed.
     */
    class = input('');

    classes = computed(() => cn(
        'flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}
