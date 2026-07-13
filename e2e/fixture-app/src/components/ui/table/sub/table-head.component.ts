import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '@/components/lib/utils';

@Component({
    selector: 'ui-table-head',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './table-head.component.css',
    host: {
        class: 'flex items-center flex-shrink-0',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-head"',
        '[attr.role]': 'role()',
    },
})
export class TableHeadComponent {
    class = input('');

    /**
     * `presentation` for a purely decorative cell — the flex filler that pads the
     * header row out to full width carries no column, and announcing it as an
     * empty `columnheader` is noise for screen-reader users (axe
     * `empty-table-header`).
     */
    readonly role = input<'columnheader' | 'presentation'>('columnheader');

    classes = computed(() => cn(
        'text-foreground ltr:text-left rtl:text-right font-medium flex-1 [&:has([role=checkbox])]:ltr:pr-0 [&:has([role=checkbox])]:rtl:pl-0 [&>[role=checkbox]]:translate-y-[2px]',
        this.class()
    ));
}
