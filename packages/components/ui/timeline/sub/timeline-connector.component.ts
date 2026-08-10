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
    /** Extra utilities for the connector bar itself, merged through `cn()` so they override its defaults — this is how you recolour it (it is `bg-border` by default), change its `w-0.5` thickness, or retune the `top-6` / `h-[calc(100%-24px)]` offsets that assume a 24px {@link TimelineDotComponent} above it. The bar is absolutely positioned, so its containing item must stay `relative`. */
    class = input('');

    classes = computed(() =>
        cn(
            'absolute top-6 h-[calc(100%-24px)] w-0.5 bg-border',
            this.class()
        )
    );
}
