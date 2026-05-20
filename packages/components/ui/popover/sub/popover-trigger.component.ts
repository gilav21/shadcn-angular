import {
    Component,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import { POPOVER } from '../popover.component';

@Component({
    selector: 'ui-popover-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick($event)" [attr.data-slot]="'popover-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class PopoverTriggerComponent {
    private readonly popover = inject(POPOVER, { optional: true });

    onClick(event: MouseEvent) {
        event.stopPropagation();
        this.popover?.toggle();
    }
}
