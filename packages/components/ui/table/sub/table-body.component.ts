import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-table-body',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col flex-1',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-body"',
        'role': 'rowgroup'
    },
})
export class TableBodyComponent {
    class = input('');

    classes = computed(() => cn('', this.class()));
}
