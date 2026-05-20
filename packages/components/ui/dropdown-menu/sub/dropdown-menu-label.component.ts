import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'ui-dropdown-menu-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'px-2 py-1.5 text-sm font-semibold',
        '[attr.data-slot]': '"dropdown-label"',
    },
})
export class DropdownMenuLabelComponent { }
