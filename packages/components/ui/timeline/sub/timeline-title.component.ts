import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-timeline-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <h4 [class]="classes()" [attr.data-slot]="'timeline-title'">
      <ng-content />
    </h4>
  `,
    host: { class: 'contents' },
})
export class TimelineTitleComponent {
    /** Extra utilities for the heading, merged through `cn()` so they override its `text-sm font-semibold leading-none`. The element is always an `h4`; wrap or replace this component if the surrounding document needs a different heading level. */
    class = input('');

    classes = computed(() =>
        cn(
            'text-sm font-semibold leading-none',
            this.class()
        )
    );
}
