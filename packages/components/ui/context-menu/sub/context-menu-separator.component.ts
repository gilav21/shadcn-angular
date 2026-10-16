import {
    Component,
    ChangeDetectionStrategy,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-context-menu-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"context-menu-separator"',
    },
})
export class ContextMenuSeparatorComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('-mx-1 my-1 h-px bg-border', this.class()));
}
