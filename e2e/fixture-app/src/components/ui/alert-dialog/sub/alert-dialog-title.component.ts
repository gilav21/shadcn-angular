import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-alert-dialog-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-lg font-semibold',
        '[attr.data-slot]': '"alert-dialog-title"',
    },
})
export class AlertDialogTitleComponent { }
