import {
    Directive,
    input,
    inject,
    ElementRef,
    NgZone,
    OnDestroy,
    Renderer2,
} from '@angular/core';
import { isTouchDevice } from '../../../lib/touch';
import { TOUCH_AUTO_DISMISS_MS } from '../tooltip.component';

@Directive({
    selector: '[uiTooltip]',
    host: {
        '(mouseenter)': 'onMouseEnter()',
        '(mouseleave)': 'onMouseLeave()',
        '(touchstart)': 'onTouchStart($event)',
    },
})
export class TooltipDirective implements OnDestroy {
    uiTooltip = input.required<string>();
    tooltipSide = input<'top' | 'bottom' | 'left' | 'right'>('top');
    tooltipDisabled = input(false);

    private readonly el = inject(ElementRef);
    private readonly renderer = inject(Renderer2);
    private readonly zone = inject(NgZone);
    private tooltipElement: HTMLElement | null = null;
    private delayTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private dismissTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private removeDismissListener: (() => void) | null = null;

    onMouseEnter() {
        if (this.tooltipDisabled() || isTouchDevice()) return;

        this.delayTimeoutId = setTimeout(() => {
            this.showTooltip();
        }, 200);
    }

    onMouseLeave() {
        if (isTouchDevice()) return;
        this.clearDelayTimeout();
        this.hideTooltip();
    }

    onTouchStart(event: TouchEvent) {
        if (this.tooltipDisabled() || !isTouchDevice()) return;
        event.preventDefault();
        this.toggleTouch();
    }

    private toggleTouch() {
        if (this.tooltipElement) {
            this.dismissTouch();
            return;
        }
        this.showTooltip();
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
            this.removeDismissListener = () => {
                document.removeEventListener('touchstart', handler);
            };
        });
    }

    private dismissTouch() {
        this.clearDismiss();
        this.hideTooltip();
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
        if (this.removeDismissListener) {
            this.removeDismissListener();
            this.removeDismissListener = null;
        }
    }

    private showTooltip() {
        if (this.tooltipElement) return;

        this.tooltipElement = this.renderer.createElement('div');
        const text = this.renderer.createText(this.uiTooltip());
        this.renderer.appendChild(this.tooltipElement, text);

        this.renderer.setAttribute(
            this.tooltipElement,
            'class',
            'fixed z-50 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground pointer-events-none'
        );

        this.renderer.appendChild(document.body, this.tooltipElement);

        const hostEl = this.el.nativeElement as HTMLElement;
        let targetEl = hostEl;
        if (getComputedStyle(hostEl).display === 'contents') {
            targetEl = (hostEl.firstElementChild as HTMLElement) || hostEl;
        }

        const hostRect = targetEl.getBoundingClientRect();
        const tooltipRect = this.tooltipElement!.getBoundingClientRect();

        let side = this.tooltipSide();

        const calculatePosition = (currentSide: string) => {
            let t = 0;
            let l = 0;
            switch (currentSide) {
                case 'top':
                    t = hostRect.top - tooltipRect.height - 8;
                    l = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
                    break;
                case 'bottom':
                    t = hostRect.bottom + 8;
                    l = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
                    break;
                case 'left':
                    t = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
                    l = hostRect.left - tooltipRect.width - 8;
                    break;
                case 'right':
                    t = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
                    l = hostRect.right + 8;
                    break;
            }
            return { top: t, left: l };
        };

        let pos = calculatePosition(side);

        const { innerWidth, innerHeight } = globalThis;

        if (side === 'top' && pos.top < 0) {
            side = 'bottom';
            pos = calculatePosition(side);
        } else if (side === 'bottom' && pos.top + tooltipRect.height > innerHeight) {
            side = 'top';
            pos = calculatePosition(side);
        }

        if (side === 'left' && pos.left < 0) {
            side = 'right';
            pos = calculatePosition(side);
        } else if (side === 'right' && pos.left + tooltipRect.width > innerWidth) {
            side = 'left';
            pos = calculatePosition(side);
        }

        pos.top = Math.max(8, Math.min(innerHeight - tooltipRect.height - 8, pos.top));
        pos.left = Math.max(8, Math.min(innerWidth - tooltipRect.width - 8, pos.left));

        this.renderer.setStyle(this.tooltipElement, 'top', `${pos.top}px`);
        this.renderer.setStyle(this.tooltipElement, 'left', `${pos.left}px`);
    }

    private hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.remove();
            this.tooltipElement = null;
        }
    }

    ngOnDestroy() {
        this.clearDelayTimeout();
        this.clearDismiss();
        this.hideTooltip();
    }
}
