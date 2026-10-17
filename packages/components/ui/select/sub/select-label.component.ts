import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-select-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"select-label"',
    },
})
export class SelectLabelComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('text-muted-foreground px-2 py-1.5 text-xs', this.class()));
}
