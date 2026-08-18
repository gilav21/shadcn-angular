import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-table-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'sticky top-0 z-20 bg-background flex-shrink-0',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-header"',
        'role': 'rowgroup'
    },
})
export class TableHeaderComponent {
    /** Extra classes merged onto the header row group. It is `sticky top-0` with an opaque background, so it stays visible while the body scrolls — raise `z-20` if it is overlapped by other layers. */
    class = input('');

    classes = computed(() => cn('', this.class()));
}
