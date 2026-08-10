import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

/**
 * EmptyHeader - Container for icon, title, and description
 */
@Component({
    selector: 'ui-empty-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'empty-header'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class EmptyHeaderComponent {
    /** Extra classes merged onto the header group. Its `max-w-sm` is what keeps the title and description from stretching across a wide panel — raise it here for long copy. */
    class = input('');

    classes = computed(() => cn(
        'flex max-w-sm flex-col items-center gap-2 text-center',
        this.class()
    ));
}
