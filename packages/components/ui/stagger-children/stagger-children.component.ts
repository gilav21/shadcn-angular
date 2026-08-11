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

    /**
     * Extra classes merged onto the `block` host. Note only the host's *direct*
     * element children are animated, so a layout wrapper added inside would
     * collapse the whole group into a single animated item.
     */
    class = input('');
    /** Milliseconds to wait, after the group scrolls into view, before the first child starts. Later children add {@link staggerDelay} on top of this. */
    delay = input(0);
    /** Duration of each individual child's fade/slide/deblur, in milliseconds. Independent of the stagger — the overall reveal lasts `delay + n * staggerDelay + duration`. */
    duration = input(400);
    /**
     * Direction the children travel *towards*: `'up'` starts them 20px low and
     * lifts them into place, `'left'` starts them 20px to the right, and so on.
     * Fixed 20px offset, not RTL-aware.
     */
    direction = input<'up' | 'down' | 'left' | 'right'>('up');
    /** Milliseconds added between consecutive children, producing the cascade. Set to 0 to reveal every child at once. */
    staggerDelay = input(80);

    classes = computed(() => cn('block', this.class()));

    private observer?: IntersectionObserver;
    private animations: Animation[] = [];

    ngAfterViewInit(): void {
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

    ngOnDestroy(): void {
        this.observer?.disconnect();
        this.animations.forEach(a => a.cancel());
    }

    /**
     * Replays the cascade on demand: hides the children again, cancels any
     * in-flight animations and restarts from the top. The automatic run is
     * one-shot (its IntersectionObserver disconnects after firing), so this is
     * how you re-trigger it — e.g. after the child list changes. Honours
     * `prefers-reduced-motion` exactly as the automatic run does: under that
     * preference every child is revealed at once and nothing animates.
     */
    playAnimation(): void {
        this.animations.forEach(a => a.cancel());
        this.animations = [];

        if (prefersReducedMotion()) {
            this.showChildren();
            return;
        }

        this.hideChildren();
        this.animateChildren();
    }

    private getTranslate(): { x: number; y: number } {
        const d = this.direction();
        if (d === 'up') return { x: 0, y: 20 };
        if (d === 'down') return { x: 0, y: -20 };
        if (d === 'left') return { x: 20, y: 0 };
        return { x: -20, y: 0 };
    }

    private hideChildren(): void {
        const children = (this.el.nativeElement as HTMLElement).children;
        for (const child of Array.from(children)) {
            (child as HTMLElement).style.opacity = '0';
        }
    }

    private showChildren(): void {
        const children = (this.el.nativeElement as HTMLElement).children;
        for (const child of Array.from(children)) {
            (child as HTMLElement).style.opacity = '1';
        }
    }

    private animateChildren(): void {
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
