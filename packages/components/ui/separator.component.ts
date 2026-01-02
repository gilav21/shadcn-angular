import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"separator"',
        '[attr.role]': '"separator"',
        '[attr.aria-orientation]': 'orientation()',
    },
})
export class SeparatorComponent {
    orientation = input<'horizontal' | 'vertical'>('horizontal');
    class = input('');

    classes = computed(() =>
        cn(
            'bg-border shrink-0',
            this.orientation() === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
            this.class()
        )
    );
}
