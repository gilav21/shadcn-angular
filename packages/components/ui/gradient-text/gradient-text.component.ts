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
    selector: 'ui-gradient-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './gradient-text.component.html',
    host: {
        '[class]': 'classes()',
        '[style]': 'styles()',
        '[attr.data-slot]': '"gradient-text"',
    },
})
export class GradientTextComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    /**
     * Extra classes merged onto the host. Text colour utilities have no effect
     * here — the host sets `-webkit-text-fill-color: transparent` so the glyphs
     * are painted by the gradient background instead.
     */
    class = input('');
    /**
     * Gradient stops, in order, as any CSS colour strings. Distributed evenly
     * along {@link direction}; two or more entries are needed for a visible
     * blend. The gradient is sized to 200% so it can be panned by the
     * animation.
     */
    colors = input<string[]>(['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4']);
    /**
     * Seconds for one full back-and-forth sweep of the gradient. Read on every
     * animation frame, so changing it retimes the sweep live. Ignored when the
     * user prefers reduced motion — the gradient then stays static.
     */
    speed = input(3);
    /**
     * Axis of the `linear-gradient`. Note the animation always pans the
     * background horizontally (`X% 50%`), so `'to bottom'`/`'to top'` produce a
     * vertical gradient that shimmers rather than scrolls.
     */
    direction = input<'to right' | 'to left' | 'to bottom' | 'to top'>('to right');

    private animationFrameId: number | null = null;
    private startTime = 0;

    classes = computed(() => cn('inline-block', this.class()));

    styles = computed(() => {
        const gradient = `linear-gradient(${this.direction()}, ${this.colors().join(', ')})`;
        return {
            background: gradient,
            backgroundSize: '200% 200%',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
        };
    });

    ngAfterViewInit(): void {
        if (prefersReducedMotion()) return;
        this.ngZone.runOutsideAngular(() => {
            this.startTime = performance.now();
            this.animate();
        });
    }

    ngOnDestroy(): void {
        if (this.animationFrameId != null) cancelAnimationFrame(this.animationFrameId);
    }

    private readonly animate = (): void => {
        const elapsed = performance.now() - this.startTime;
        const duration = this.speed() * 1000;
        const progress = (elapsed % duration) / duration;
        const pos = Math.sin(progress * Math.PI * 2) * 50 + 50;
        const host = this.el.nativeElement as HTMLElement;
        host.style.backgroundPosition = `${pos}% 50%`;
        this.animationFrameId = requestAnimationFrame(this.animate);
    };
}
