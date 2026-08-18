import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * EmptyContent - Container for actions/buttons
 */
@Component({
    selector: 'ui-empty-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'empty-content'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class EmptyContentComponent {
    /** Extra classes merged onto the action area — it stacks its children vertically, so add `flex-row` here for a side-by-side pair of buttons. */
    class = input('');

    classes = computed(() => cn(
        'flex flex-col items-center gap-3',
        this.class()
    ));
}
