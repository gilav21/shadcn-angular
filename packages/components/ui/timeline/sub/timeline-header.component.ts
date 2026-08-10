import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-timeline-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-header'">
      <ng-content />
    </div>
  `,
    host: { class: 'contents' },
})
export class TimelineHeaderComponent {
    /** Extra utilities for the narrow gutter column that holds the dot and connector, merged through `cn()` so they override its `flex flex-col items-center`. Projecting this component is also what switches the parent `ui-timeline-item` into custom mode and disables its simple-mode inputs. */
    class = input('');

    classes = computed(() =>
        cn(
            'flex flex-col items-center',
            this.class()
        )
    );
}
