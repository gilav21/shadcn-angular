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
    /** Extra classes merged onto the row. It is `min-w-max`, so a row wider than the table drives the wrapper's horizontal scroll rather than squashing its cells. */
    class = input('');
    /** Marks the row as selected, applying `data-state="selected"` and its muted background. Purely visual — it does not manage a selection model or set `aria-selected`. */
    selected = input(false);

    classes = computed(() => cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted transition-colors',
        this.class()
    ));
}
