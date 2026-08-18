import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-timeline-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-content'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TimelineContentComponent {
    /** Extra utilities for the wrapper around the projected body (title, description, time, or anything custom), merged through `cn()` so they override the built-in `flex-1 pt-0.5` — the `flex-1` is what makes the content fill the row beside the dot, so replace it deliberately. */
    class = input('');

    classes = computed(() =>
        cn(
            'flex-1 pt-0.5',
            this.class()
        )
    );
}
