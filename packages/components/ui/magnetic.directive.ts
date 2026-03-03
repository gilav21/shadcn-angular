import {
    Directive,
    ElementRef,
    OnDestroy,
    inject,
    input,
    signal,
    NgZone,
} from '@angular/core';
import { prefersReducedMotion } from '../lib/utils';

@Directive({
    selector: '[uiMagnetic]',
    host: {
        '[style.transform]': 'transform()',
        '[style.transition]': '"transform " + uiMagneticSmoothing() + "ms ease-out"',
    },
})
export class UiMagneticDirective implements OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    uiMagneticStrength = input(0.3);
    uiMagneticRadius = input(200);
    uiMagneticSmoothing = input(150);

    transform = signal('translate(0px, 0px)');

    private readonly mouseMoveHandler = (event: MouseEvent) => {
        if (prefersReducedMotion()) return;

        const el = this.el.nativeElement as HTMLElement;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distX = event.clientX - centerX;
        const distY = event.clientY - centerY;
        const distance = Math.hypot(distX, distY);

        if (distance < this.uiMagneticRadius()) {
            const strength = this.uiMagneticStrength();
            const pullX = distX * strength;
            const pullY = distY * strength;
            this.transform.set(`translate(${pullX}px, ${pullY}px)`);
        } else {
            this.transform.set('translate(0px, 0px)');
        }
    };

    private readonly mouseLeaveHandler = () => {
        this.transform.set('translate(0px, 0px)');
    };

    constructor() {
        this.ngZone.runOutsideAngular(() => {
            const el = this.el.nativeElement as HTMLElement;
            el.addEventListener('mousemove', this.mouseMoveHandler, { passive: true });
            el.addEventListener('mouseleave', this.mouseLeaveHandler);
        });
    }

    ngOnDestroy() {
        const el = this.el.nativeElement as HTMLElement;
        el.removeEventListener('mousemove', this.mouseMoveHandler);
        el.removeEventListener('mouseleave', this.mouseLeaveHandler);
    }
}
