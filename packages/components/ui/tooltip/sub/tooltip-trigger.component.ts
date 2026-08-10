import {
    Component,
    ChangeDetectionStrategy,
    signal,
    inject,
    NgZone,
    OnDestroy,
} from '@angular/core';
import { isTouchDevice } from '../../../lib/touch';
import { TooltipComponent, TOUCH_AUTO_DISMISS_MS } from '../tooltip.component';

@Component({
    selector: 'ui-tooltip-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (touchstart)="onTouchStart($event)"
      (focus)="onFocus()"
      (blur)="onBlur()"
      [attr.data-slot]="'tooltip-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class TooltipTriggerComponent implements OnDestroy {
    private readonly tooltip = inject(TooltipComponent, { optional: true });
    private readonly zone = inject(NgZone);
    private delayTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private dismissTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private readonly removeDismissListener = signal<(() => void) | null>(null);

    /**
     * Starts the open timer, honouring the parent's `delayDuration`. Ignored on
     * touch devices, where the emulated mouseenter would double up with
     * {@link onTouchStart}.
     */
    onMouseEnter(): void {
        if (isTouchDevice()) return;
        const delay = this.tooltip?.delayDuration() ?? 200;
        this.delayTimeoutId = setTimeout(() => {
            this.tooltip?.show();
        }, delay);
    }

    /**
     * Cancels a pending open and hides the tooltip. Ignored on touch devices,
     * where dismissal is handled by {@link onTouchStart} instead.
     */
    onMouseLeave(): void {
        if (isTouchDevice()) return;
        this.clearDelayTimeout();
        this.tooltip?.hide();
    }

    /**
     * Touch alternative to hover: taps toggle the tooltip and an open tooltip
     * auto-dismisses after `TOUCH_AUTO_DISMISS_MS` or on the next touch anywhere
     * in the document. Calls `preventDefault()`, which suppresses the synthetic
     * click the browser would otherwise fire on the projected content.
     */
    onTouchStart(event: TouchEvent): void {
        if (!isTouchDevice()) return;
        event.preventDefault();
        this.toggleTouch();
    }

    /** Keyboard path: focusing the trigger shows the tooltip with no delay. */
    onFocus(): void {
        this.tooltip?.show();
    }

    /** Hides the tooltip when focus leaves the trigger. */
    onBlur(): void {
        this.tooltip?.hide();
    }

    ngOnDestroy(): void {
        this.clearDelayTimeout();
        this.clearDismiss();
    }

    private toggleTouch(): void {
        if (this.tooltip?.open()) {
            this.dismissTouch();
            return;
        }
        this.tooltip?.show();
        this.scheduleDismiss();
    }

    private scheduleDismiss(): void {
        this.clearDismiss();

        this.dismissTimeoutId = setTimeout(() => {
            this.dismissTouch();
        }, TOUCH_AUTO_DISMISS_MS);

        this.zone.runOutsideAngular(() => {
            const handler = (): void => {
                this.zone.run(() => this.dismissTouch());
            };
            document.addEventListener('touchstart', handler, { once: true });
            this.removeDismissListener.set(() => {
                document.removeEventListener('touchstart', handler);
            });
        });
    }

    private dismissTouch(): void {
        this.clearDismiss();
        this.tooltip?.hide();
    }

    private clearDelayTimeout(): void {
        if (this.delayTimeoutId) {
            clearTimeout(this.delayTimeoutId);
            this.delayTimeoutId = null;
        }
    }

    private clearDismiss(): void {
        if (this.dismissTimeoutId) {
            clearTimeout(this.dismissTimeoutId);
            this.dismissTimeoutId = null;
        }
        const removeListener = this.removeDismissListener();
        if (removeListener) {
            removeListener();
            this.removeDismissListener.set(null);
        }
    }
}
