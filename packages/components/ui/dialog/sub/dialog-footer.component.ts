import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-dialog-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    styleUrl: './dialog-footer.component.css',
    host: {
        class: 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        '[attr.data-slot]': '"dialog-footer"',
    },
})
export class DialogFooterComponent { }
