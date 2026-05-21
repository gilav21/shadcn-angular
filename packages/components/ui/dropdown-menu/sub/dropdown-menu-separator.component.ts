import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'ui-dropdown-menu-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        class: '-mx-1 my-1 h-px bg-border',
        '[attr.data-slot]': '"dropdown-separator"',
    },
})
export class DropdownMenuSeparatorComponent { }
