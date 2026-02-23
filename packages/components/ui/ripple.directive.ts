import {
    Directive,
    ElementRef,
    OnDestroy,
    inject,
    input,
    Renderer2,
} from '@angular/core';
import { prefersReducedMotion } from '../lib/utils';

@Directive({
    selector: '[uiRipple]',
    host: {
        '[style.position]': 'uiRippleDisabled() ? null : "relative"',
        '[style.overflow]': 'uiRippleDisabled() ? null : "hidden"',
        '(click)': 'onRipple($event)',
    },
})
export class UiRippleDirective implements OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly renderer = inject(Renderer2);

    uiRippleColor = input('color-mix(in srgb, currentColor 35%, transparent)');
    uiRippleDuration = input(600);
    uiRippleDisabled = input(false);

    private activeRipples: HTMLSpanElement[] = [];

    onRipple(event: MouseEvent) {
        if (this.uiRippleDisabled() || prefersReducedMotion()) return;

        const host = this.el.nativeElement as HTMLElement;
        const rect = host.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const diameter = Math.max(rect.width, rect.height) * 2;

        const ripple = this.renderer.createElement('span') as HTMLSpanElement;
        this.renderer.setStyle(ripple, 'position', 'absolute');
        this.renderer.setStyle(ripple, 'width', `${diameter}px`);
        this.renderer.setStyle(ripple, 'height', `${diameter}px`);
        this.renderer.setStyle(ripple, 'left', `${x - diameter / 2}px`);
        this.renderer.setStyle(ripple, 'top', `${y - diameter / 2}px`);
        this.renderer.setStyle(ripple, 'borderRadius', '50%');
        this.renderer.setStyle(ripple, 'pointerEvents', 'none');
        this.renderer.setStyle(ripple, 'backgroundColor', this.uiRippleColor());
        this.renderer.appendChild(host, ripple);
        this.activeRipples.push(ripple);

        ripple.animate(
            [
                { transform: 'scale(0)', opacity: '1' },
                { transform: 'scale(1)', opacity: '0' },
            ],
            {
                duration: this.uiRippleDuration(),
                easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)',
                fill: 'forwards',
            }
        ).onfinish = () => {
            ripple.remove();
            const idx = this.activeRipples.indexOf(ripple);
            if (idx >= 0) this.activeRipples.splice(idx, 1);
        };
    }

    ngOnDestroy() {
        this.activeRipples.forEach(r => r.remove());
        this.activeRipples = [];
    }
}
