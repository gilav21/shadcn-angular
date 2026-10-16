import {
    Component,
    ChangeDetectionStrategy,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-alert-dialog-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"alert-dialog-header"',
    },
})
export class AlertDialogHeaderComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('flex flex-col space-y-2 text-center sm:text-left rtl:text-right', this.class()));
}
