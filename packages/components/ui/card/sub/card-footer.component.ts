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
    styleUrl: './card-footer.component.css',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"card-footer"',
    },
})
export class CardFooterComponent {
    class = input('');

    readonly classes = computed(() =>
        cn('flex items-center [.border-t]:pt-6', this.class())
    );
}
