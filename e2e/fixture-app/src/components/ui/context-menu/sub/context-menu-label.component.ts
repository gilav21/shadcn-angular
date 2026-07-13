import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '@/components/lib/utils';

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
    class = input('');
    inset = input(false);

    classes = computed(() => cn(
        'px-2 py-1.5 text-sm font-semibold text-foreground',
        this.inset() && 'ps-8',
        this.class()
    ));
}
