import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

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
    /**
     * Direction of the rule. `'horizontal'` renders a 1px-tall full-width line;
     * `'vertical'` renders a 1px-wide full-height line, which only shows up if
     * the parent gives the host a height (e.g. a flex row with `h-*` or
     * `items-stretch`). Also mirrored to `aria-orientation`.
     */
    orientation = input<'horizontal' | 'vertical'>('horizontal');
    /**
     * Extra classes merged onto the host — the usual place to override the
     * `bg-border` colour, thickness, or add margins between sections.
     */
    class = input('');

    classes = computed(() =>
        cn(
            'bg-border shrink-0',
            this.orientation() === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
            this.class()
        )
    );
}
