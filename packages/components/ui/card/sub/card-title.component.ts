import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-card-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-title"',
    },
})
export class CardTitleComponent {
    /** Extra classes merged onto the title. Renders as a styled `<div>`, not a heading element — project your own `<h2>`/`<h3>` inside if the card must appear in the document outline. */
    class = input('');

    classes = computed(() => cn('leading-none font-semibold', this.class()));
}
