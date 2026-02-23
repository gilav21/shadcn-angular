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
import { cn, prefersReducedMotion } from '../lib/utils';

@Component({
    selector: 'ui-orbit',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="orbit-item" #item [style]="itemStyles()">
            <ng-content />
        </div>
    `,
    host: {
        '[class]': 'hostClasses()',
        '[attr.data-slot]': '"orbit"',
    },
})
export class OrbitComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    class = input('');
    radius = input(100);
    duration = input(10);
    delay = input(0);
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

    ngAfterViewInit() {
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

    ngOnDestroy() {
        this.animationRef?.cancel();
    }
}
