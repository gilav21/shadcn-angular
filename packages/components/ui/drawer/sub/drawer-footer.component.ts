import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-drawer-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"drawer-footer"',
    },
})
export class DrawerFooterComponent {
    /**
     * Extra classes merged onto the host. The default `mt-auto` pins the footer
     * to the bottom of the drawer's flex column and children stack vertically —
     * pass `flex-row` for side-by-side action buttons.
     */
    class = input('');

    classes = computed(() => cn('mt-auto flex flex-col gap-2 p-4', this.class()));
}
