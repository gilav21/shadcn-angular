import {
    Component,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import { isTouchDevice } from '../../../lib/touch';
import { HoverCardComponent } from '../hover-card.component';

@Component({
    selector: 'ui-hover-card-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      tabindex="0"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (focus)="onMouseEnter()"
      (blur)="onMouseLeave()"
      (click)="onClick($event)"
      (keydown.enter)="onClick($event)"
      (keydown.space)="onClick($event)"
      [attr.data-slot]="'hover-card-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class HoverCardTriggerComponent {
    private readonly hoverCard = inject(HoverCardComponent, { optional: true });

    onMouseEnter(): void {
        if (isTouchDevice()) return;
        this.hoverCard?.show();
    }

    onMouseLeave(): void {
        if (isTouchDevice()) return;
        this.hoverCard?.hide();
    }

    onClick(event: Event): void {
        if (!isTouchDevice()) return;
        event.preventDefault();
        this.hoverCard?.toggle();
    }
}
