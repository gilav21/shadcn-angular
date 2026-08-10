import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CollapsibleComponent } from '../collapsible.component';

@Component({
    selector: 'ui-collapsible-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (collapsible?.open()) {
      <div
        [class]="classes()"
        [attr.data-state]="collapsible?.open() ? 'open' : 'closed'"
        [attr.data-slot]="'collapsible-content'"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class CollapsibleContentComponent {
    readonly collapsible = inject(CollapsibleComponent, { optional: true });
    /**
     * Extra classes merged onto the panel, after the base `overflow-hidden`. The panel is
     * removed from the DOM while closed, so height-transition classes have nothing to animate
     * from — use it for padding and layout instead.
     */
    class = input('');

    classes = computed(() =>
        cn('overflow-hidden', this.class())
    );
}
