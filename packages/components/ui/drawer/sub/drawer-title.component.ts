import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-drawer-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-foreground font-semibold',
        '[attr.data-slot]': '"drawer-title"',
    },
})
export class DrawerTitleComponent { }
