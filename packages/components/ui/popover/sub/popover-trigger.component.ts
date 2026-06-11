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
    <span
      role="button"
      tabindex="0"
      (click)="onClick($event)"
      (keydown.enter)="onKeydown($event)"
      (keydown.space)="onKeydown($event)"
      [attr.data-slot]="'popover-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class PopoverTriggerComponent {
    private readonly popover = inject(POPOVER, { optional: true });

    onClick(event: MouseEvent): void {
        event.stopPropagation();
        this.popover?.toggle();
    }

    onKeydown(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.popover?.toggle();
    }
}
