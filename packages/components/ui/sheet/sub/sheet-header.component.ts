import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'ui-sheet-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col space-y-2 text-center sm:ltr:text-left sm:rtl:text-right',
        '[attr.data-slot]': '"sheet-header"',
    },
})
export class SheetHeaderComponent { }
