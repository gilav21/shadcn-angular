import {
    Component,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import { POPOVER } from '../popover.component';

@Component({
    selector: 'ui-popover-close',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'popover-close'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class PopoverCloseComponent {
    private readonly popover = inject(POPOVER, { optional: true });

    onClick() {
        this.popover?.hide();
    }
}
