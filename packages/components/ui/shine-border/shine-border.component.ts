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
    selector: 'ui-shine-border',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './shine-border.component.html',
    host: { class: 'contents' },
})
export class ShineBorderComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    /** Extra classes merged onto the `relative inline-block` wrapper — set the width here, since the wrapper otherwise shrinks to the projected content. */
    class = input('');
    /**
     * Stops of the conic gradient that forms the glowing rim. Because the
     * gradient is conic, the first and last colours meet, so repeating the first
     * colour at the end avoids a visible seam.
     */
    colors = input<string[]>(['#A07CFE', '#FE8FB5', '#FFBE7B']);
    /**
     * Seconds for the gradient to complete one full rotation. Read on every
     * frame, so it can be retimed live. When the user prefers reduced motion the
     * gradient is painted once at 0° and never animates.
     */
    duration = input(3);
    /** Rim thickness in pixels. Implemented as padding on the gradient wrapper, so it eats into the wrapper's box rather than growing it outward. */
    borderWidth = input(2);
    /** Outer corner radius in pixels. The inner content surface inherits it, so both corners stay concentric — set it to match the card you are wrapping. */
    borderRadius = input(8);

    private animationFrameId: number | null = null;
    private startTime = 0;

    wrapperClasses = computed(() => cn(
        'relative inline-block',
        this.class()
    ));

    innerClasses = computed(() =>
        'bg-background h-full w-full rounded-[inherit]'
    );

    ngAfterViewInit(): void {
        if (prefersReducedMotion()) {
            this.applyStaticGradient(0);
            return;
        }

        this.ngZone.runOutsideAngular(() => {
            this.startTime = performance.now();
            this.animate();
        });
    }

    ngOnDestroy(): void {
        if (this.animationFrameId != null) cancelAnimationFrame(this.animationFrameId);
    }

    private getWrapperEl(): HTMLElement | null {
        return (this.el.nativeElement as HTMLElement).querySelector('[data-slot="shine-border"]');
    }

    private applyStaticGradient(angleDeg: number): void {
        const wrapper = this.getWrapperEl();
        if (!wrapper) return;
        const colorsStr = this.colors().join(', ');
        wrapper.style.background = `conic-gradient(from ${angleDeg}deg, ${colorsStr})`;
        wrapper.style.padding = `${this.borderWidth()}px`;
        wrapper.style.borderRadius = `${this.borderRadius()}px`;
    }

    private readonly animate = (): void => {
        const elapsed = performance.now() - this.startTime;
        const durationMs = this.duration() * 1000;
        const angle = ((elapsed % durationMs) / durationMs) * 360;
        this.applyStaticGradient(angle);
        this.animationFrameId = requestAnimationFrame(this.animate);
    };
}
