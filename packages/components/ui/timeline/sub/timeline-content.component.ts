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
    class = input('');

    classes = computed(() =>
        cn(
            'flex-1 pt-0.5',
            this.class()
        )
    );
}
