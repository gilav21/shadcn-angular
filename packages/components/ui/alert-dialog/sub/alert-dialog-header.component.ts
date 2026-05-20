import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-alert-dialog-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col space-y-2 text-center sm:text-left rtl:text-right',
        '[attr.data-slot]': '"alert-dialog-header"',
    },
})
export class AlertDialogHeaderComponent { }
