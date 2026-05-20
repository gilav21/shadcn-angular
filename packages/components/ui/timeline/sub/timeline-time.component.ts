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
    class = input('');

    classes = computed(() =>
        cn(
            'text-xs text-muted-foreground',
            this.class()
        )
    );
}
