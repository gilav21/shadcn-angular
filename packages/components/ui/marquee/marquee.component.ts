import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    ElementRef,
    AfterViewInit,
    OnDestroy,
    ViewChild,
    inject,
    NgZone,
} from '@angular/core';
import { cn, prefersReducedMotion } from '../../lib/utils';

@Component({
    selector: 'ui-marquee',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './marquee.component.html',
    host: { class: 'block' },
})
export class MarqueeComponent implements AfterViewInit, OnDestroy {
    private readonly ngZone = inject(NgZone);

    /** Extra classes merged onto the clipping viewport. For a vertical {@link direction} give it a bounded height here, otherwise there is nothing to scroll within. */
    class = input('');
    /**
     * Travel direction. `'up'`/`'down'` also switch the track and its content to
     * a column layout. The values are physical, not logical, so `'left'` does
     * not flip in RTL. Read once when the animation is built.
     */
    direction = input<'left' | 'right' | 'up' | 'down'>('left');
    /**
     * Seconds for one full loop — i.e. the time to scroll past a single copy of
     * the content, not a fixed pixel rate. More content therefore moves faster
     * at the same value. Read once at setup.
     */
    speed = input(20);
    /**
     * Pauses the scroll while the pointer is over the marquee. Also wired to
     * `touchstart`/`touchend`, so on touch devices — which have no hover state —
     * it pauses for the duration of a press instead.
     */
    pauseOnHover = input(false);
    /**
     * Pixel gap between items, and between the content and its duplicate. It is
     * folded into the loop distance, so the seam stays invisible; changing it
     * after setup would desynchronise the loop.
     */
    gap = input(16);

    @ViewChild('track') trackRef!: ElementRef<HTMLElement>;
    @ViewChild('segment') segmentRef!: ElementRef<HTMLElement>;

    classes = computed(() => cn('overflow-hidden', this.class()));

    private animation?: Animation;

    ngAfterViewInit(): void {
        if (prefersReducedMotion()) return;

        this.ngZone.runOutsideAngular(() => {
            requestAnimationFrame(() => this.setupAnimation());
        });
    }

    ngOnDestroy(): void {
        this.animation?.cancel();
    }

    /** Pointer-enter / touch-start handler — pauses the loop when {@link pauseOnHover} is set, and is a no-op otherwise. */
    onMouseEnter(): void {
        if (this.pauseOnHover() && this.animation) {
            this.animation.pause();
        }
    }

    /** Pointer-leave / touch-end handler — resumes from where {@link onMouseEnter} paused, so the loop never jumps. */
    onMouseLeave(): void {
        if (this.pauseOnHover() && this.animation) {
            this.animation.play();
        }
    }

    private setupAnimation(): void {
        const track = this.trackRef?.nativeElement;
        const segment = this.segmentRef?.nativeElement;
        if (!track || !segment) return;

        const clone = segment.cloneNode(true) as HTMLElement;
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);

        const dir = this.direction();
        const isVertical = dir === 'up' || dir === 'down';
        const isReverse = dir === 'right' || dir === 'down';

        track.style.display = 'flex';
        track.style.width = isVertical ? '' : 'max-content';

        if (isVertical) {
            track.style.flexDirection = 'column';
            segment.style.flexDirection = 'column';
            clone.style.flexDirection = 'column';

            const segmentHeight = segment.offsetHeight + this.gap();
            this.animation = track.animate(
                [
                    { transform: 'translateY(0)' },
                    { transform: `translateY(-${segmentHeight}px)` },
                ],
                {
                    duration: this.speed() * 1000,
                    iterations: Infinity,
                    easing: 'linear',
                    direction: isReverse ? 'reverse' : 'normal',
                }
            );
        } else {
            const segmentWidth = segment.offsetWidth + this.gap();
            this.animation = track.animate(
                [
                    { transform: 'translateX(0)' },
                    { transform: `translateX(-${segmentWidth}px)` },
                ],
                {
                    duration: this.speed() * 1000,
                    iterations: Infinity,
                    easing: 'linear',
                    direction: isReverse ? 'reverse' : 'normal',
                }
            );
        }
    }
}
