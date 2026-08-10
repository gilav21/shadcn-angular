import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-timeline-time',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <time [class]="classes()" [attr.data-slot]="'timeline-time'">
      <ng-content />
    </time>
  `,
    host: { class: 'contents' },
})
export class TimelineTimeComponent {
    /** Extra utilities for the `time` element, merged through `cn()` so they override its `text-xs text-muted-foreground`. It renders inline with no `datetime` attribute — set one on the host yourself if the timestamp must be machine-readable. */
    class = input('');

    classes = computed(() =>
        cn(
            'text-xs text-muted-foreground',
            this.class()
        )
    );
}
