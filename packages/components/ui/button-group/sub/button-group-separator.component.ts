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
    class = input('');
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
