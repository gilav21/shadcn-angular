import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'ui-sheet-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-sm text-muted-foreground',
        '[attr.data-slot]': '"sheet-description"',
    },
})
export class SheetDescriptionComponent { }
