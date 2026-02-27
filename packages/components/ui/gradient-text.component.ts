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
    selector: 'ui-gradient-text',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[style]': 'styles()',
        '[attr.data-slot]': '"gradient-text"',
    },
})
export class GradientTextComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    class = input('');
    colors = input<string[]>(['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4']);
    speed = input(3);
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

    ngAfterViewInit() {
        if (prefersReducedMotion()) return;
        this.ngZone.runOutsideAngular(() => {
            this.startTime = performance.now();
            this.animate();
        });
    }

    ngOnDestroy() {
        if (this.animationFrameId != null) cancelAnimationFrame(this.animationFrameId);
    }

    private readonly animate = () => {
        const elapsed = performance.now() - this.startTime;
        const duration = this.speed() * 1000;
        const progress = (elapsed % duration) / duration;
        const pos = Math.sin(progress * Math.PI * 2) * 50 + 50;
        const host = this.el.nativeElement as HTMLElement;
        host.style.backgroundPosition = `${pos}% 50%`;
        this.animationFrameId = requestAnimationFrame(this.animate);
    };
}
