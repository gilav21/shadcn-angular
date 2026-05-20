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
    class = input('');

    classes = computed(() =>
        cn(
            'flex flex-col items-center',
            this.class()
        )
    );
}
