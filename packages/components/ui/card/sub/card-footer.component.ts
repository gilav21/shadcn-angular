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
    /** Extra classes merged onto the footer row. Add `border-t` to get a divider — the built-in `[.border-t]:pt-6` rule then supplies the matching top padding. */
    class = input('');

    readonly classes = computed(() =>
        cn('flex items-center [.border-t]:pt-6', this.class())
    );
}
