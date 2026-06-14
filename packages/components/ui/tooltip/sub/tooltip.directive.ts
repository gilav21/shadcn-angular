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
        '(touchstart)': 'onTouchStart()',
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

    onMouseEnter(): void {
        if (this.tooltipDisabled() || isTouchDevice()) return;

        this.delayTimeoutId = setTimeout(() => {
            this.showTooltip();
        }, 200);
    }

    onMouseLeave(): void {
        if (isTouchDevice()) return;
        this.clearDelayTimeout();
        this.hideTooltip();
    }

    onTouchStart(): void {
        if (this.tooltipDisabled() || !isTouchDevice()) return;
        this.toggleTouch();
    }

    private toggleTouch(): void {
        if (this.tooltipElement) {
            this.dismissTouch();
            return;
        }
        this.showTooltip();
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
            this.removeDismissListener = () => {
                document.removeEventListener('touchstart', handler);
            };
        });
    }

    private dismissTouch(): void {
        this.clearDismiss();
        this.hideTooltip();
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
        if (this.removeDismissListener) {
            this.removeDismissListener();
            this.removeDismissListener = null;
        }
    }

    private showTooltip(): void {
        if (this.tooltipElement) return;

        const tooltipEl = this.createTooltipElement();
        this.tooltipElement = tooltipEl;

        const hostRect = this.resolveTargetElement().getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();
        const pos = this.computePosition(hostRect, tooltipRect);

        this.renderer.setStyle(tooltipEl, 'top', `${pos.top}px`);
        this.renderer.setStyle(tooltipEl, 'left', `${pos.left}px`);
    }

    private createTooltipElement(): HTMLElement {
        const tooltipEl: HTMLElement = this.renderer.createElement('div');
        const text = this.renderer.createText(this.uiTooltip());
        this.renderer.appendChild(tooltipEl, text);

        this.renderer.setAttribute(
            tooltipEl,
            'class',
            'fixed z-50 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground pointer-events-none'
        );

        this.renderer.appendChild(document.body, tooltipEl);
        return tooltipEl;
    }

    private resolveTargetElement(): HTMLElement {
        const hostEl = this.el.nativeElement as HTMLElement;
        if (getComputedStyle(hostEl).display === 'contents') {
            return (hostEl.firstElementChild as HTMLElement) ?? hostEl;
        }
        return hostEl;
    }

    private computePosition(hostRect: DOMRect, tooltipRect: DOMRect): { top: number; left: number } {
        const calculatePosition = (currentSide: string): { top: number; left: number } =>
            this.positionFor(currentSide, hostRect, tooltipRect);

        let side = this.tooltipSide();
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

        return {
            top: Math.max(8, Math.min(innerHeight - tooltipRect.height - 8, pos.top)),
            left: Math.max(8, Math.min(innerWidth - tooltipRect.width - 8, pos.left)),
        };
    }

    private positionFor(currentSide: string, hostRect: DOMRect, tooltipRect: DOMRect): { top: number; left: number } {
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
    }

    private hideTooltip(): void {
        if (this.tooltipElement) {
            this.tooltipElement.remove();
            this.tooltipElement = null;
        }
    }

    ngOnDestroy(): void {
        this.clearDelayTimeout();
        this.clearDismiss();
        this.hideTooltip();
    }
}
