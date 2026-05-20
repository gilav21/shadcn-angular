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

    onMouseEnter() {
        if (isTouchDevice()) return;
        const delay = this.tooltip?.delayDuration() ?? 200;
        this.delayTimeoutId = setTimeout(() => {
            this.tooltip?.show();
        }, delay);
    }

    onMouseLeave() {
        if (isTouchDevice()) return;
        this.clearDelayTimeout();
        this.tooltip?.hide();
    }

    onTouchStart(event: TouchEvent) {
        if (!isTouchDevice()) return;
        event.preventDefault();
        this.toggleTouch();
    }

    onFocus() {
        this.tooltip?.show();
    }

    onBlur() {
        this.tooltip?.hide();
    }

    ngOnDestroy() {
        this.clearDelayTimeout();
        this.clearDismiss();
    }

    private toggleTouch() {
        if (this.tooltip?.open()) {
            this.dismissTouch();
            return;
        }
        this.tooltip?.show();
        this.scheduleDismiss();
    }

    private scheduleDismiss() {
        this.clearDismiss();

        this.dismissTimeoutId = setTimeout(() => {
            this.dismissTouch();
        }, TOUCH_AUTO_DISMISS_MS);

        this.zone.runOutsideAngular(() => {
            const handler = () => {
                this.zone.run(() => this.dismissTouch());
            };
            document.addEventListener('touchstart', handler, { once: true });
            this.removeDismissListener.set(() => {
                document.removeEventListener('touchstart', handler);
            });
        });
    }

    private dismissTouch() {
        this.clearDismiss();
        this.tooltip?.hide();
    }

    private clearDelayTimeout() {
        if (this.delayTimeoutId) {
            clearTimeout(this.delayTimeoutId);
            this.delayTimeoutId = null;
        }
    }

    private clearDismiss() {
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
