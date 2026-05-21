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
    selector: 'ui-stagger-children',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './stagger-children.component.html',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"stagger-children"',
    },
})
export class StaggerChildrenComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    class = input('');
    delay = input(0);
    duration = input(400);
    direction = input<'up' | 'down' | 'left' | 'right'>('up');
    staggerDelay = input(80);

    classes = computed(() => cn('block', this.class()));

    private observer?: IntersectionObserver;
    private animations: Animation[] = [];

    ngAfterViewInit() {
        if (prefersReducedMotion()) return;

        this.hideChildren();

        this.ngZone.runOutsideAngular(() => {
            requestAnimationFrame(() => {
                this.observer = new IntersectionObserver(
                    (entries) => {
                        if (entries[0].isIntersecting) {
                            this.animateChildren();
                            this.observer?.disconnect();
                        }
                    },
                    { threshold: 0.1 }
                );
                this.observer.observe(this.el.nativeElement);
            });
        });
    }

    ngOnDestroy() {
        this.observer?.disconnect();
        this.animations.forEach(a => a.cancel());
    }

    playAnimation() {
        this.hideChildren();
        this.animations.forEach(a => a.cancel());
        this.animations = [];
        this.animateChildren();
    }

    private getTranslate(): { x: number; y: number } {
        const d = this.direction();
        if (d === 'up') return { x: 0, y: 20 };
        if (d === 'down') return { x: 0, y: -20 };
        if (d === 'left') return { x: 20, y: 0 };
        return { x: -20, y: 0 };
    }

    private hideChildren() {
        const children = (this.el.nativeElement as HTMLElement).children;
        for (const child of Array.from(children)) {
            (child as HTMLElement).style.opacity = '0';
        }
    }

    private animateChildren() {
        const children = (this.el.nativeElement as HTMLElement).children;
        const translate = this.getTranslate();

        for (let i = 0; i < children.length; i++) {
            const child = children[i] as HTMLElement;
            const totalDelay = this.delay() + i * this.staggerDelay();

            const anim = child.animate(
                [
                    {
                        opacity: 0,
                        transform: `translate(${translate.x}px, ${translate.y}px)`,
                        filter: 'blur(4px)',
                    },
                    {
                        opacity: 1,
                        transform: 'translate(0, 0)',
                        filter: 'blur(0)',
                    },
                ],
                {
                    duration: this.duration(),
                    delay: totalDelay,
                    easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)',
                    fill: 'forwards',
                }
            );
            this.animations.push(anim);
        }
    }
}
