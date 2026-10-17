import {
    Component,
    ChangeDetectionStrategy,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-alert-dialog-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"alert-dialog-description"',
    },
})
export class AlertDialogDescriptionComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('text-sm text-muted-foreground', this.class()));
}
