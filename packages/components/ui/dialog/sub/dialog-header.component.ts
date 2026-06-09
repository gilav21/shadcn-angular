import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-dialog-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './dialog-header.component.css',
    host: {
        class: 'flex flex-col gap-1.5 text-center sm:text-left',
        '[attr.data-slot]': '"dialog-header"',
    },
})
export class DialogHeaderComponent { }
