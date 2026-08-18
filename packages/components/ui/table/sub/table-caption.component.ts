import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-table-caption',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-caption"'
    },
})
export class TableCaptionComponent {
    /** Extra classes merged onto the caption. It is a flex sibling of the row groups, not a native `<caption>`, so its position in the markup is where it renders. */
    class = input('');

    classes = computed(() => cn('text-muted-foreground mt-4 text-sm', this.class()));
}
