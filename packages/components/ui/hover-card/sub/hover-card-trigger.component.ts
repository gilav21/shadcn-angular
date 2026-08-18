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

    /**
     * Opens the card after the hover delay. Also bound to `focus`, so keyboard
     * users get the card. Ignored on touch devices, where {@link onClick} owns
     * the interaction.
     */
    onMouseEnter(): void {
        if (isTouchDevice()) return;
        this.hoverCard?.show();
    }

    /**
     * Schedules the delayed close on pointer leave or blur, leaving time to move
     * onto the card itself. Ignored on touch devices.
     */
    onMouseLeave(): void {
        if (isTouchDevice()) return;
        this.hoverCard?.hide();
    }

    /**
     * Touch alternative to hover: on a touch device a tap (or Enter/Space)
     * toggles the card immediately and a tap outside closes it; on a pointer
     * device it is a no-op, since hover already opens it. `preventDefault()`
     * suppresses
     * the projected content's own default action, so do not wrap a link or
     * submit button you still need to activate on touch.
     */
    onClick(event: Event): void {
        if (!isTouchDevice()) return;
        event.preventDefault();
        this.hoverCard?.toggle();
    }
}
