import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-card-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-footer"',
    },
})
export class CardFooterComponent {
    class = input('');

    classes = computed(() =>
        cn('flex items-center px-4 sm:px-6 [.border-t]:pt-6', this.class())
    );
}
