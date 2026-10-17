import {
    Component,
    ChangeDetectionStrategy,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-context-menu-shortcut',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"context-menu-shortcut"',
    },
})
export class ContextMenuShortcutComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('ltr:ml-auto rtl:mr-auto text-xs tracking-widest text-muted-foreground', this.class()));
}
