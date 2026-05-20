import {
    Component,
    ChangeDetectionStrategy,
} from '@angular/core';

@Component({
    selector: 'ui-split-button-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'contents' },
})
export class SplitButtonMenuComponent { }
