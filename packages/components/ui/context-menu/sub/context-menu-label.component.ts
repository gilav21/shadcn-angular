import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-context-menu-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"context-menu-label"',
        '[attr.data-inset]': 'inset()',
    },
})
export class ContextMenuLabelComponent {
    /** Extra classes merged after the defaults on the host element; use it to re-colour or re-space a section heading. */
    class = input('');
    /** Adds `ps-8` start padding so the heading aligns with inset items below it; also reflected as `data-inset`. */
    inset = input(false);

    classes = computed(() => cn(
        'px-2 py-1.5 text-sm font-semibold text-foreground',
        this.inset() && 'ps-8',
        this.class()
    ));
}
