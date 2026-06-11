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
    <span
      role="button"
      tabindex="0"
      (click)="onClick()"
      (keydown.enter)="onClick()"
      (keydown.space)="onKeydownSpace($event)"
      [attr.data-slot]="'popover-close'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class PopoverCloseComponent {
    private readonly popover = inject(POPOVER, { optional: true });

    onClick(): void {
        this.popover?.hide();
    }

    onKeydownSpace(event: Event): void {
        event.preventDefault();
        this.onClick();
    }
}
