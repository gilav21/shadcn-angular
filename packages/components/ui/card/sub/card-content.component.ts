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
    class = input('');

    readonly classes = computed(() => cn('px-[calc(1rem*var(--_d))] sm:px-6', this.class()));
}
