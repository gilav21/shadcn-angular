import {
    Component,
    ChangeDetectionStrategy,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-dialog-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './dialog-footer.component.css',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"dialog-footer"',
    },
})
export class DialogFooterComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('flex flex-col-reverse sm:flex-row sm:justify-end', this.class()));
}
