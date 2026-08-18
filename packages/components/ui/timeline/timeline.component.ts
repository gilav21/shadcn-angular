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
    /** Extra utilities for the timeline's own wrapper `div` (the flex container the items lay out in), merged through `cn()` so they win over the built-in `relative` / `flex` defaults. */
    class = input('');
    /**
     * Stacking direction of the projected items: `'vertical'` (default) lays the
     * wrapper out as `flex-col`, `'horizontal'` as `flex-row`.
     *
     * Only the container's flex direction changes — nothing is broadcast to the
     * children. {@link TimelineItemComponent} and
     * {@link TimelineConnectorComponent} keep their vertical geometry (the
     * connector stays a `w-0.5` full-height bar), so a horizontal timeline needs
     * per-part `class` overrides on the items and connectors.
     */
    orientation = input<'vertical' | 'horizontal'>('vertical');

    classes = computed(() =>
        cn(
            'relative',
            this.orientation() === 'vertical' ? 'flex flex-col' : 'flex flex-row',
            this.class()
        )
    );
}
