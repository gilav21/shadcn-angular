import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    ElementRef,
    AfterViewInit,
    OnDestroy,
    inject,
    NgZone,
} from '@angular/core';
import { cn, prefersReducedMotion } from '../../lib/utils';

@Component({
    selector: 'ui-orbit',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './orbit.component.html',
    host: {
        '[class]': 'hostClasses()',
        '[attr.data-slot]': '"orbit"',
    },
})
export class OrbitComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    /**
     * Extra classes merged onto the host ring. The host is `absolute inset-0`
     * and click-through, so its positioning parent must be `relative`; projected
     * items re-enable pointer events themselves.
     */
    class = input('');
    /** Orbit radius in pixels, applied as a horizontal offset from the ring's centre before rotation. Not responsive — pick a value that fits the smallest container you support. */
    radius = input(100);
    /** Seconds for one full revolution. Read once when the Web Animation is created in `ngAfterViewInit`; changing it later does not retime the orbit. No animation is created at all when the user prefers reduced motion — items then rest at their starting angle. */
    duration = input(10);
    /** Seconds to wait before the orbit starts — give sibling orbits different values to spread items around the same ring. Also read only at init. */
    delay = input(0);
    /** Reverses the direction of travel (counter-clockwise). Handy for making concentric rings counter-rotate. Read only at init. */
    reverse = input(false);

    private animationRef?: Animation;

    hostClasses = computed(() => cn('absolute inset-0 pointer-events-none', this.class()));

    itemStyles = computed(() => ({
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) translateX(${this.radius()}px)`,
        pointerEvents: 'auto',
    }));

    ngAfterViewInit(): void {
        if (prefersReducedMotion()) return;

        const host = this.el.nativeElement as HTMLElement;

        this.ngZone.runOutsideAngular(() => {
            this.animationRef = host.animate(
                [
                    { transform: 'rotate(0deg)' },
                    { transform: 'rotate(360deg)' },
                ],
                {
                    duration: this.duration() * 1000,
                    iterations: Infinity,
                    easing: 'linear',
                    direction: this.reverse() ? 'reverse' : 'normal',
                    delay: this.delay() * 1000,
                }
            );
        });
    }

    ngOnDestroy(): void {
        this.animationRef?.cancel();
    }
}
