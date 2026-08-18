import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SPEED_DIAL } from '../speed-dial.component';

@Component({
    selector: 'ui-speed-dial-mask',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (speedDial?.open()) {
      <div
        [class]="classes()"
        tabindex="0"
        role="button"
        [attr.aria-label]="'Close'"
        (click)="onClick()"
        (keydown.enter)="onClick()"
        (keydown.space)="onClick()"
        [attr.data-slot]="'speed-dial-mask'"
      ></div>
    }
  `,
    host: { class: 'contents' },
})
export class SpeedDialMaskComponent {
    readonly speedDial = inject(SPEED_DIAL, { optional: true });
    /**
     * Extra classes for the backdrop, merged after the defaults
     * (`fixed inset-0 z-40 bg-background/80 backdrop-blur-sm` plus a fade-in) —
     * use it to change the scrim colour/blur or drop it to a lower `z-` layer.
     * The element only exists while the parent speed dial is open.
     */
    class = input('');

    classes = computed(() =>
        cn(
            'fixed inset-0 z-40 bg-background/80 backdrop-blur-sm',
            'animate-in fade-in-0',
            this.class()
        )
    );

    /**
     * Dismisses the speed dial. Bound to the backdrop's click and its Enter/Space
     * keys — the mask is focusable with `role="button"` and an aria-label of
     * "Close", so it is the accessible dismiss affordance (there is no Escape
     * handler). Because the mask sits below the menu's `z-50` it only catches
     * clicks outside the items; the parent's document click listener would also
     * close the menu, so the mask's real job is the visible scrim and the
     * keyboard-reachable close.
     */
    onClick(): void {
        this.speedDial?.hide();
    }
}
