import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-timeline-connector',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="classes()" [attr.data-slot]="'timeline-connector'"></div>
  `,
    host: { class: 'contents' },
})
export class TimelineConnectorComponent {
    class = input('');

    classes = computed(() =>
        cn(
            'absolute top-6 h-[calc(100%-24px)] w-0.5 bg-border',
            this.class()
        )
    );
}
