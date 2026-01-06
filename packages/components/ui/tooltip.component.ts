import {
    Component,
    Directive,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    ElementRef,
    OnDestroy,
    Renderer2,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-tooltip',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
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
      (focus)="onFocus()"
      (blur)="onBlur()"
      [attr.data-slot]="'tooltip-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class TooltipTriggerComponent {
    private tooltip = inject(TooltipComponent, { optional: true });
    private timeoutId: ReturnType<typeof setTimeout> | null = null;

    onMouseEnter() {
        const delay = this.tooltip?.delayDuration() ?? 200;
        this.timeoutId = setTimeout(() => {
            this.tooltip?.show();
        }, delay);
    }

    onMouseLeave() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.tooltip?.hide();
    }

    onFocus() {
        this.tooltip?.show();
    }

    onBlur() {
        this.tooltip?.hide();
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
    tooltip = inject(TooltipComponent, { optional: true });
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
    },
})
export class TooltipDirective implements OnDestroy {
    uiTooltip = input.required<string>();
    tooltipSide = input<'top' | 'bottom' | 'left' | 'right'>('top');

    private el = inject(ElementRef);
    private renderer = inject(Renderer2);
    private tooltipElement: HTMLElement | null = null;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;

    onMouseEnter() {
        this.timeoutId = setTimeout(() => {
            this.showTooltip();
        }, 200);
    }

    onMouseLeave() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.hideTooltip();
    }

    private showTooltip() {
        if (this.tooltipElement) return;

        this.tooltipElement = this.renderer.createElement('div');
        const text = this.renderer.createText(this.uiTooltip());
        this.renderer.appendChild(this.tooltipElement, text);

        this.renderer.setAttribute(
            this.tooltipElement,
            'class',
            'fixed z-[9999] whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground pointer-events-none'
        );

        // Append first so we can measure it
        this.renderer.appendChild(document.body, this.tooltipElement);

        const hostEl = this.el.nativeElement as HTMLElement;
        let targetEl = hostEl;
        if (getComputedStyle(hostEl).display === 'contents') {
            targetEl = (hostEl.firstElementChild as HTMLElement) || hostEl;
        }

        const hostRect = targetEl.getBoundingClientRect();
        const tooltipRect = this.tooltipElement!.getBoundingClientRect();

        let side = this.tooltipSide();

        // Calculate initial position to check for overflow
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

        // Check for overflow and flip if needed
        const { innerWidth, innerHeight } = window;

        // Check vertical overflow
        if (side === 'top' && pos.top < 0) {
            side = 'bottom';
            pos = calculatePosition(side);
        } else if (side === 'bottom' && pos.top + tooltipRect.height > innerHeight) {
            side = 'top';
            pos = calculatePosition(side);
        }

        // Check horizontal overflow
        if (side === 'left' && pos.left < 0) {
            side = 'right';
            pos = calculatePosition(side);
        } else if (side === 'right' && pos.left + tooltipRect.width > innerWidth) {
            side = 'left';
            pos = calculatePosition(side);
        }

        // Clamp to viewport if still overflowing (e.g. mobile)
        pos.top = Math.max(8, Math.min(innerHeight - tooltipRect.height - 8, pos.top));
        pos.left = Math.max(8, Math.min(innerWidth - tooltipRect.width - 8, pos.left));

        this.renderer.setStyle(this.tooltipElement, 'top', `${pos.top}px`);
        this.renderer.setStyle(this.tooltipElement, 'left', `${pos.left}px`);
    }

    private hideTooltip() {
        if (this.tooltipElement) {
            this.renderer.removeChild(document.body, this.tooltipElement);
            this.tooltipElement = null;
        }
    }

    ngOnDestroy() {
        this.hideTooltip();
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }
}
