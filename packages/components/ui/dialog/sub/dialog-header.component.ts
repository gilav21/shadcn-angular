import {
    Component,
    ChangeDetectionStrategy,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-dialog-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './dialog-header.component.css',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"dialog-header"',
    },
})
export class DialogHeaderComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('flex flex-col text-center sm:text-left', this.class()));
}
