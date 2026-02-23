import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    ElementRef,
    AfterViewInit,
    OnDestroy,
    inject,
    NgZone,
    output,
} from '@angular/core';
import { cn } from '../lib/utils';
import { prefersReducedMotion } from '../lib/utils';

@Component({
    selector: 'ui-blur-fade',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"blur-fade"',
    },
})
export class BlurFadeComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    class = input('');
    delay = input(0);
    duration = input(500);
    direction = input<'up' | 'down' | 'left' | 'right'>('up');
    inView = input(true);

    replay = output<void>();

    private isVisible = signal(false);
    private observer?: IntersectionObserver;
    private currentAnimation?: Animation;

    classes = computed(() => cn('block', this.class()));

    ngAfterViewInit() {
        const host = this.el.nativeElement as HTMLElement;
        host.style.opacity = '0';

        if (prefersReducedMotion()) {
            host.style.opacity = '1';
            return;
        }

        if (this.inView()) {
            this.ngZone.runOutsideAngular(() => {
                this.observer = new IntersectionObserver(
                    (entries) => {
                        if (entries[0].isIntersecting) {
                            this.playAnimation();
                            this.observer?.disconnect();
                        }
                    },
                    { threshold: 0.1 }
                );
                this.observer.observe(host);
            });
        } else {
            this.playAnimation();
        }
    }

    ngOnDestroy() {
        this.observer?.disconnect();
        this.currentAnimation?.cancel();
    }

    playAnimation() {
        const host = this.el.nativeElement as HTMLElement;
        const translate = this.getTranslateFrom();

        this.currentAnimation?.cancel();
        host.style.opacity = '0';

        this.currentAnimation = host.animate(
            [
                { opacity: 0, filter: 'blur(8px)', transform: translate },
                { opacity: 1, filter: 'blur(0)', transform: 'translate(0, 0)' },
            ],
            {
                duration: this.duration(),
                delay: this.delay(),
                easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)',
                fill: 'forwards',
            }
        );

        this.isVisible.set(true);
    }

    private getTranslateFrom(): string {
        const d = this.direction();
        if (d === 'up') return 'translateY(8px)';
        if (d === 'down') return 'translateY(-8px)';
        if (d === 'left') return 'translateX(8px)';
        return 'translateX(-8px)';
    }
}
