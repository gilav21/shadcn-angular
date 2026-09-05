import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-dialog-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-lg font-semibold leading-none tracking-tight flex justify-start',
        '[attr.data-slot]': '"dialog-title"',
    },
})
export class DialogTitleComponent { }
