import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'ui-sheet-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col-reverse sm:flex-row sm:justify-end sm:ltr:space-x-2 sm:rtl:space-x-reverse',
        '[attr.data-slot]': '"sheet-footer"',
    },
})
export class SheetFooterComponent { }
