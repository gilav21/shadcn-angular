import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-alert-dialog-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-sm text-muted-foreground',
        '[attr.data-slot]': '"alert-dialog-description"',
    },
})
export class AlertDialogDescriptionComponent { }
