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
import { cn, prefersReducedMotion } from '../lib/utils';

@Component({
    selector: 'ui-marquee',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div
            [class]="classes()"
            [attr.data-slot]="'marquee'"
            (mouseenter)="onMouseEnter()"
            (mouseleave)="onMouseLeave()"
            (touchstart)="onMouseEnter()"
            (touchend)="onMouseLeave()"
        >
            <div #track [style.gap.px]="gap()">
                <div class="shrink-0" [style.display]="'flex'" [style.gap.px]="gap()" #segment>
                    <ng-content />
                </div>
            </div>
        </div>
    `,
    host: { class: 'block' },
})
export class MarqueeComponent implements AfterViewInit, OnDestroy {
    private readonly ngZone = inject(NgZone);

    class = input('');
    direction = input<'left' | 'right' | 'up' | 'down'>('left');
    speed = input(20);
    pauseOnHover = input(false);
    gap = input(16);

    @ViewChild('track') trackRef!: ElementRef<HTMLElement>;
    @ViewChild('segment') segmentRef!: ElementRef<HTMLElement>;

    classes = computed(() => cn('overflow-hidden', this.class()));

    private animation?: Animation;

    ngAfterViewInit() {
        if (prefersReducedMotion()) return;

        this.ngZone.runOutsideAngular(() => {
            requestAnimationFrame(() => this.setupAnimation());
        });
    }

    ngOnDestroy() {
        this.animation?.cancel();
    }

    onMouseEnter() {
        if (this.pauseOnHover() && this.animation) {
            this.animation.pause();
        }
    }

    onMouseLeave() {
        if (this.pauseOnHover() && this.animation) {
            this.animation.play();
        }
    }

    private setupAnimation() {
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
