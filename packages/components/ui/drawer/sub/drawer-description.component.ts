import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-drawer-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-muted-foreground text-sm',
        '[attr.data-slot]': '"drawer-description"',
    },
})
export class DrawerDescriptionComponent { }
