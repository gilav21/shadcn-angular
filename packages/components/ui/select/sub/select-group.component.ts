import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'ui-select-group',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': '"p-1 contents"',
        '[attr.role]': '"group"',
        '[attr.data-slot]': '"select-group"',
    },
})
export class SelectGroupComponent { }
