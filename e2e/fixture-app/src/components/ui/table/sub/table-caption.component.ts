import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '@/components/lib/utils';

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
    class = input('');

    classes = computed(() => cn('text-muted-foreground mt-4 text-sm', this.class()));
}
