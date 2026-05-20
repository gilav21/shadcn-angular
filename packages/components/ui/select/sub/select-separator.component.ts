import {
    ChangeDetectionStrategy,
    Component,
} from '@angular/core';

@Component({
    selector: 'ui-select-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        class: 'bg-border pointer-events-none -mx-1 my-1 h-px',
        '[attr.data-slot]': '"select-separator"',
    },
})
export class SelectSeparatorComponent { }
