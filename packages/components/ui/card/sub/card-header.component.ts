import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-card-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './card-header.component.css',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-header"',
    },
})
export class CardHeaderComponent {
    /** Extra classes merged onto the header grid. It reflows to two columns automatically when a `data-slot="card-action"` element is present, and adding `border-b` also adds the matching bottom padding. */
    class = input('');
    /** Draws a bottom divider; the existing `border-b` rule supplies the matching 1.5rem bottom padding. */
    readonly bordered = input(false);

    readonly classes = computed(() =>
        cn(
            '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
            this.bordered() && 'border-b',
            this.class()
        )
    );
}
