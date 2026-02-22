import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    ElementRef,
    inject,
} from '@angular/core';
import { cn } from '../lib/utils';
import { prefersReducedMotion } from '../lib/utils';

@Component({
    selector: 'ui-wobble-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
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

    class = input('');
    intensity = input(15);
    perspective = input(1000);

    private rotateX = signal(0);
    private rotateY = signal(0);

    classes = computed(() => cn(
        'relative overflow-hidden rounded-xl transition-transform duration-200 ease-out',
        this.class()
    ));

    styles = computed(() => ({
        transform: `perspective(${this.perspective()}px) rotateX(${this.rotateX()}deg) rotateY(${this.rotateY()}deg)`,
    }));

    onMouseMove(event: MouseEvent) {
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

    onMouseLeave() {
        this.rotateX.set(0);
        this.rotateY.set(0);
    }
}
