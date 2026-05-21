import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-table-row',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex w-full min-w-max flex-shrink-0',
        '[class]': 'classes()',
        '[attr.data-slot]': '"table-row"',
        '[attr.data-state]': 'selected() ? "selected" : null',
        'role': 'row'
    },
})
export class TableRowComponent {
    class = input('');
    selected = input(false);

    classes = computed(() => cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors',
        this.class()
    ));
}
