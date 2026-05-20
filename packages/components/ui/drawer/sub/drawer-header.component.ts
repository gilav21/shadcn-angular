import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
    selector: 'ui-drawer-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"drawer-header"',
    },
})
export class DrawerHeaderComponent {
    class = input('');

    classes = computed(() => cn(
        'flex flex-col gap-1.5 p-4 text-center sm:ltr:text-left sm:rtl:text-right',
        this.class()
    ));
}
