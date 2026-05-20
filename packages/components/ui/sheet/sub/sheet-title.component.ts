import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'ui-sheet-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-lg font-semibold text-foreground',
        '[attr.data-slot]': '"sheet-title"',
    },
})
export class SheetTitleComponent { }
