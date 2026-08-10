import {
    Directive,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Directive({
    selector: 'thead[uiTableHeader], ui-table-header',
})
export class TableHeaderDirective {
    /** Extra classes for a header applied via the `uiTableHeader` attribute on a native `<thead>` — the escape hatch for consumers keeping real table markup instead of the flex-based `ui-table-header`. */
    class = input('');

    classes = computed(() => cn('', this.class()));
}
