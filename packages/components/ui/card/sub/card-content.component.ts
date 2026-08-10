import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-card-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './card-content.component.css',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-content"',
    },
})
export class CardContentComponent {
    /** Extra classes merged onto the body. It contributes no utilities of its own — spacing comes from the card's density CSS keyed on `data-slot="card-content"`. */
    class = input('');

    readonly classes = computed(() => cn(this.class()));
}
