import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-dialog-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col space-y-1.5 text-center sm:text-left',
        '[attr.data-slot]': '"dialog-header"',
    },
})
export class DialogHeaderComponent { }
