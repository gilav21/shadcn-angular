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
import { cn , prefersReducedMotion } from '../lib/utils';

@Component({
    selector: 'ui-shine-border',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="wrapperClasses()" [attr.data-slot]="'shine-border'" #wrapper>
            <div [class]="innerClasses()">
                <ng-content />
            </div>
        </div>
    `,
    host: { class: 'contents' },
})
export class ShineBorderComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    class = input('');
    colors = input<string[]>(['#A07CFE', '#FE8FB5', '#FFBE7B']);
    duration = input(3);
    borderWidth = input(2);
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

    ngAfterViewInit() {
        if (prefersReducedMotion()) {
            this.applyStaticGradient(0);
            return;
        }

        this.ngZone.runOutsideAngular(() => {
            this.startTime = performance.now();
            this.animate();
        });
    }

    ngOnDestroy() {
        if (this.animationFrameId != null) cancelAnimationFrame(this.animationFrameId);
    }

    private getWrapperEl(): HTMLElement | null {
        return (this.el.nativeElement as HTMLElement).querySelector('[data-slot="shine-border"]');
    }

    private applyStaticGradient(angleDeg: number) {
        const wrapper = this.getWrapperEl();
        if (!wrapper) return;
        const colorsStr = this.colors().join(', ');
        wrapper.style.background = `conic-gradient(from ${angleDeg}deg, ${colorsStr})`;
        wrapper.style.padding = `${this.borderWidth()}px`;
        wrapper.style.borderRadius = `${this.borderRadius()}px`;
    }

    private readonly animate = () => {
        const elapsed = performance.now() - this.startTime;
        const durationMs = this.duration() * 1000;
        const angle = ((elapsed % durationMs) / durationMs) * 360;
        this.applyStaticGradient(angle);
        this.animationFrameId = requestAnimationFrame(this.animate);
    };
}
