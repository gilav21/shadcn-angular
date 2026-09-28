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
     * Direction of the rule. `'horizontal'` renders a 1px-tall line across the
     * container's full width; `'vertical'` a 1px-wide line down its full height,
     * which only shows up if the parent has a definite height (e.g. `h-*`) or
     * stretches its items. The host is a block box, so both work in plain block
     * flow as well as in flex layouts. Also mirrored to `aria-orientation`.
     */
    orientation = input<'horizontal' | 'vertical'>('horizontal');
    /**
     * Extra classes merged onto the host — the usual place to override the
     * `bg-border` colour, thickness, or add margins between sections.
     */
    class = input('');

    classes = computed(() =>
        cn(
            'block bg-border shrink-0',
            this.orientation() === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
            this.class()
        )
    );
}
