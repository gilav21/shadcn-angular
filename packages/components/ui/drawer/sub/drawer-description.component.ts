import {
    Component,
    ChangeDetectionStrategy,
    computed,
    input,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-drawer-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"drawer-description"',
    },
})
export class DrawerDescriptionComponent {
    /** Extra classes merged onto the element this component renders, after its built-in styling. */
    readonly class = input('');
    readonly classes = computed(() => cn('text-muted-foreground text-sm', this.class()));
}
