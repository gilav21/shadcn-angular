import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    ElementRef,
    inject,
} from '@angular/core';
import { cn, prefersReducedMotion } from '../../lib/utils';

@Component({
    selector: 'ui-wobble-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './wobble-card.component.html',
    host: {
        '[class]': 'classes()',
        '[style]': 'styles()',
        '[attr.data-slot]': '"wobble-card"',
        '(mousemove)': 'onMouseMove($event)',
        '(mouseleave)': 'onMouseLeave()',
    },
})
export class WobbleCardComponent {
    private readonly el = inject(ElementRef);

    /** Extra classes merged onto the host card — background, padding and shadow are yours to supply; the component only contributes the rounded, clipped, transformed shell. */
    class = input('');
    /**
     * Maximum tilt in degrees reached at the card's edges; the angle scales
     * linearly with pointer distance from the centre. Read live, so it can be
     * animated. Set to 0 to freeze the card flat while keeping the handlers.
     */
    intensity = input(15);
    /**
     * CSS `perspective` distance in pixels for the 3D tilt. Smaller values
     * exaggerate the effect, larger values flatten it — the tilt angle itself is
     * controlled by {@link intensity}.
     */
    perspective = input(1000);

    private readonly rotateX = signal(0);
    private readonly rotateY = signal(0);

    classes = computed(() => cn(
        'relative overflow-hidden rounded-xl transition-transform duration-200 ease-out',
        this.class()
    ));

    styles = computed(() => ({
        transform: `perspective(${this.perspective()}px) rotateX(${this.rotateX()}deg) rotateY(${this.rotateY()}deg)`,
    }));

    /**
     * Host `mousemove` handler — maps the pointer's offset from the card centre
     * onto the X/Y rotation. A no-op when the user prefers reduced motion, and
     * never fires on touch-only devices, where the card simply stays flat.
     */
    onMouseMove(event: MouseEvent): void {
        if (prefersReducedMotion()) return;

        const el = this.el.nativeElement as HTMLElement;
        const rect = el.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const intensity = this.intensity();
        this.rotateX.set(((y - centerY) / centerY) * -intensity);
        this.rotateY.set(((x - centerX) / centerX) * intensity);
    }

    /** Host `mouseleave` handler — returns the card to flat, easing back over the host's 200ms transition rather than snapping. */
    onMouseLeave(): void {
        this.rotateX.set(0);
        this.rotateY.set(0);
    }
}
