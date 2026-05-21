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
    class = input('');

    classes = computed(() =>
        cn(
            'text-sm font-semibold leading-none',
            this.class()
        )
    );
}
