import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-select-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"select-separator"',
    },
})
export class SelectSeparatorComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('bg-border pointer-events-none -mx-1 my-1 h-px', this.class()));
}
