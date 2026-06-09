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
    class = input('');

    classes = computed(() => cn(
        'p-2 flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}
