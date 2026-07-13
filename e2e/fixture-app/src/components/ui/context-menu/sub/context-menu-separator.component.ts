import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-context-menu-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        class: '-mx-1 my-1 h-px bg-border',
        '[attr.data-slot]': '"context-menu-separator"',
    },
})
export class ContextMenuSeparatorComponent { }
