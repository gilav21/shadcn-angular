import {
    Directive,
    input,
    computed,
} from '@angular/core';
import { cn } from '@/components/lib/utils';

@Directive({
    selector: 'thead[uiTableHeader], ui-table-header',
})
export class TableHeaderDirective {
    class = input('');

    classes = computed(() => cn('', this.class()));
}
