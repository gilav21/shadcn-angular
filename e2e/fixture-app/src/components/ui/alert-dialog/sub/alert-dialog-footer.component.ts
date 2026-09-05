import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-alert-dialog-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-[10px]',
        '[attr.data-slot]': '"alert-dialog-footer"',
    },
})
export class AlertDialogFooterComponent { }
