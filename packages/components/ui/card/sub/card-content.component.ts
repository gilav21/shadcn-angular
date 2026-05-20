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
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-content"',
    },
})
export class CardContentComponent {
    class = input('');

    classes = computed(() => cn('px-4 sm:px-6', this.class()));
}
