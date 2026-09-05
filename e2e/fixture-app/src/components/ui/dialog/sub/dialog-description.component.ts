import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-dialog-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-sm text-muted-foreground flex justify-start',
        '[attr.data-slot]': '"dialog-description"',
    },
})
export class DialogDescriptionComponent { }
