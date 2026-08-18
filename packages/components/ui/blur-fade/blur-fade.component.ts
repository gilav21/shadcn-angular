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
import { cn, prefersReducedMotion } from '../../lib/utils';

@Component({
    selector: 'ui-blur-fade',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './blur-fade.component.html',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"blur-fade"',
    },
})
export class BlurFadeComponent implements AfterViewInit, OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly ngZone = inject(NgZone);

    /** Extra classes merged onto the `block` host, which is the element actually animated — the projected content moves with it. */
    class = input('');
    /** Milliseconds to wait before the reveal begins, counted from the moment it is triggered. Give siblings increasing values to stagger a group by hand. */
    delay = input(0);
    /** Length of the fade/blur/slide in milliseconds. Skipped entirely when the user prefers reduced motion — the content is then shown immediately at full opacity. */
    duration = input(500);
    /** Direction the content travels *towards* over a fixed 8px: `'up'` starts 8px low and rises. Physical, not logical — it does not flip in RTL. */
    direction = input<'up' | 'down' | 'left' | 'right'>('up');
    /**
     * When true (the default) the reveal waits until the host is ~10% visible in
     * the viewport, then fires once and stops observing. Set it to `false` to
     * play immediately on init instead — useful inside an already-visible
     * container or a modal.
     */
    inView = input(true);

    /**
     * Emitted whenever {@link playAnimation} restarts a reveal that has already
     * run once. The first reveal — automatic or manual — is not a replay and
     * stays silent, so a counter bound here reports repeats only.
     */
    replay = output<void>();

    private readonly isVisible = signal(false);
    private observer?: IntersectionObserver;
    private currentAnimation?: Animation;

    classes = computed(() => cn('block', this.class()));

    ngAfterViewInit(): void {
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

    ngOnDestroy(): void {
        this.observer?.disconnect();
        this.currentAnimation?.cancel();
    }

    /**
     * Runs the reveal from the start, cancelling any in-flight animation. This
     * is the only way to replay it, since the automatic in-view trigger
     * disconnects its observer after the first run. Emits {@link replay} when it
     * restarts an already-revealed element. Unlike that automatic path it does
     * not check the reduced-motion preference, so gate the call yourself if that
     * matters.
     */
    playAnimation(): void {
        const isReplay = this.isVisible();
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

        if (isReplay) {
            this.replay.emit();
        }
    }

    private getTranslateFrom(): string {
        const d = this.direction();
        if (d === 'up') return 'translateY(8px)';
        if (d === 'down') return 'translateY(-8px)';
        if (d === 'left') return 'translateX(8px)';
        return 'translateX(-8px)';
    }
}
