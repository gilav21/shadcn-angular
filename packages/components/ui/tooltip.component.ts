import {
    Component,
    Directive,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    ElementRef,
    NgZone,
    OnDestroy,
    Renderer2,
    forwardRef,
} from '@angular/core';
import { cn } from '../lib/utils';
import { isTouchDevice } from '../lib/touch';

const TOUCH_AUTO_DISMISS_MS = 2500;

@Component({
    selector: 'ui-tooltip',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [forwardRef(() => TooltipContentComponent)],
    template: `
    <ng-content />
    @if (content()) {
      <ui-tooltip-content>{{ content() }}</ui-tooltip-content>
    }
  `,
    host: { class: 'relative inline-block' },
})
export class TooltipComponent {
    open = signal(false);
    content = input<string>('');
    side = input<'top' | 'right' | 'bottom' | 'left'>('top');
    delayDuration = input(200);

    show() {
        this.open.set(true);
    }

    hide() {
        this.open.set(false);
    }
}

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

@Component({
    selector: 'ui-tooltip-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (tooltip?.open()) {
      <div [class]="classes()" [attr.data-slot]="'tooltip-content'">
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class TooltipContentComponent {
    readonly tooltip = inject(TooltipComponent, { optional: true });
    class = input('');

    classes = computed(() => {
        const side = this.tooltip?.side() ?? 'top';
        const sideClasses = {
            top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
            bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
            left: 'right-full top-1/2 -translate-y-1/2 mr-2',
            right: 'left-full top-1/2 -translate-y-1/2 ml-2',
        };
        return cn(
            'absolute z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground',
            sideClasses[side],
            this.class()
        );
    });
}

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
