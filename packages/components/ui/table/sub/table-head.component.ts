import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-table-head',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './table-head.component.css',
    host: {
        class: 'flex items-center flex-shrink-0',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-head"',
        'role': 'columnheader'
    },
})
export class TableHeadComponent {
    class = input('');

    classes = computed(() => cn(
        'text-foreground h-10 px-2 ltr:text-left rtl:text-right font-medium flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}
