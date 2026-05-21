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
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (focus)="onMouseEnter()"
      (blur)="onMouseLeave()"
      (click)="onClick($event)"
      [attr.data-slot]="'hover-card-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class HoverCardTriggerComponent {
    private readonly hoverCard = inject(HoverCardComponent, { optional: true });

    onMouseEnter() {
        if (isTouchDevice()) return;
        this.hoverCard?.show();
    }

    onMouseLeave() {
        if (isTouchDevice()) return;
        this.hoverCard?.hide();
    }

    onClick(event: MouseEvent) {
        if (!isTouchDevice()) return;
        event.preventDefault();
        this.hoverCard?.toggle();
    }
}
