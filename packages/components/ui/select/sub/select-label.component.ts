import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'ui-select-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-muted-foreground px-2 py-1.5 text-xs',
        '[attr.data-slot]': '"select-label"',
    },
})
export class SelectLabelComponent { }
