import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-table-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col flex-shrink-0 bg-muted/50 border-t font-medium',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-footer"',
        'role': 'rowgroup'
    },
})
export class TableFooterComponent {
    class = input('');

    classes = computed(() => cn('', this.class()));
}
