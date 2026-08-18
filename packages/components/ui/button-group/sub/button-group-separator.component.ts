import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * ButtonGroupSeparator - Visual separator within a button group
 */
@Component({
    selector: 'ui-button-group-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'button-group-separator'"
      [attr.data-orientation]="orientation()"
      role="separator"
    ></div>
  `,
    host: { class: 'contents' },
})
export class ButtonGroupSeparatorComponent {
    /** Extra classes merged onto the rule — override `bg-border` here for a stronger or coloured divider. */
    class = input('');
    /**
     * Orientation of the rule itself, not of the group: `'vertical'` (the
     * default) is a 1px-wide column for a horizontal button group, `'horizontal'`
     * a 1px-tall row for a vertical one. It stretches to the group's cross-axis
     * size via `self-stretch`.
     */
    orientation = input<'horizontal' | 'vertical'>('vertical');

    classes = computed(() => {
        const isVertical = this.orientation() === 'vertical';

        return cn(
            'bg-border shrink-0',
            isVertical ? 'w-px self-stretch' : 'h-px self-stretch',
            this.class()
        );
    });
}
