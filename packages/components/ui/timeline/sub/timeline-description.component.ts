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
    class = input('');

    classes = computed(() =>
        cn(
            'mt-1 text-sm text-muted-foreground',
            this.class()
        )
    );
}
