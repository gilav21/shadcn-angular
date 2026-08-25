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

    /** How far the host moves toward the pointer, as a fraction of the distance between them. */
    uiMagneticStrength = input(0.3);
    /** Pointer distance in pixels within which the host starts being pulled. */
    uiMagneticRadius = input(200);
    /** Easing duration in milliseconds applied to the movement. */
    uiMagneticSmoothing = input(150);

    transform = signal('translate(0px, 0px)');

    private readonly mouseMoveHandler = (event: MouseEvent): void => {
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

    private readonly mouseLeaveHandler = (): void => {
        this.transform.set('translate(0px, 0px)');
    };

    constructor() {
        this.ngZone.runOutsideAngular(() => {
            const el = this.el.nativeElement as HTMLElement;
            el.addEventListener('mousemove', this.mouseMoveHandler, { passive: true });
            el.addEventListener('mouseleave', this.mouseLeaveHandler);
        });
    }

    ngOnDestroy(): void {
        const el = this.el.nativeElement as HTMLElement;
        el.removeEventListener('mousemove', this.mouseMoveHandler);
        el.removeEventListener('mouseleave', this.mouseLeaveHandler);
    }
}
