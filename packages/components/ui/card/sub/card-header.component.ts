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
    class = input('');

    classes = computed(() =>
        cn(
            '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-[calc(0.375rem*var(--_d))] px-[calc(1rem*var(--_d))] sm:px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
            this.class()
        )
    );
}
