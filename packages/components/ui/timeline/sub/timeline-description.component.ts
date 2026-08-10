import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-timeline-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <p [class]="classes()" [attr.data-slot]="'timeline-description'">
      <ng-content />
    </p>
  `,
    host: { class: 'contents' },
})
export class TimelineDescriptionComponent {
    /** Extra utilities for the description `p`, merged through `cn()` so they override its `mt-1 text-sm text-muted-foreground` — use it to change the gap to the {@link TimelineTitleComponent} above or to lift the muted colour. */
    class = input('');

    classes = computed(() =>
        cn(
            'mt-1 text-sm text-muted-foreground',
            this.class()
        )
    );
}
