import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-dropdown-menu-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"dropdown-separator"',
    },
})
export class DropdownMenuSeparatorComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('-mx-1 my-1 h-px bg-border', this.class()));
}
