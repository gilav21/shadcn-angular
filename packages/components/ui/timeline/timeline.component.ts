import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-timeline',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline'">
      <ng-content />
    </div>
  `,
    host: { class: 'block' },
})
export class TimelineComponent {
    class = input('');
    orientation = input<'vertical' | 'horizontal'>('vertical');

    classes = computed(() =>
        cn(
            'relative',
            this.orientation() === 'vertical' ? 'flex flex-col' : 'flex flex-row',
            this.class()
        )
    );
}
