import {
    Component,
    ElementRef,
    ChangeDetectorRef,
    OnDestroy,
    computed,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-number-ticker-digit',
    standalone: true,
    template: `
    <div class="relative inline-block overflow-hidden h-[1em] w-[0.6em] align-top">
      @if (isDigit()) {
        <div class="flex flex-col will-change-transform">
          <span class="h-[1em] flex items-center justify-center">{{ prevDigit() }}</span>
          <span class="h-[1em] flex items-center justify-center">{{ digit() }}</span>
        </div>
      } @else {
         <span class="h-[1em] flex items-center justify-center">{{ digit() }}</span>
      }
    </div>
  `,
})
export class NumberTickerDigitComponent {
    digit = input.required<string>();

    private el = inject(ElementRef);
    private cdr = inject(ChangeDetectorRef);
    prevDigit = signal<string>('0');
    isDigit = computed(() => /^[0-9]$/.test(this.digit()));

    private _lastValue = '';
    private _initialized = false;
    private _currentAnimation: Animation | null = null;

    constructor() {
        effect(() => {
            const current = this.digit();

            if (!this._initialized) {
                this._lastValue = current;
                this.prevDigit.set(current);
                this._initialized = true;
                return;
            }

            if (current !== this._lastValue) {
                // Finish any ongoing animation immediately to update state
                if (this._currentAnimation) {
                    this._currentAnimation.finish();
                }

                if (this.isDigit()) {
                    const previous = this._lastValue;
                    this.prevDigit.set(previous);

                    // Animate
                    const container = this.el.nativeElement.querySelector('.flex');
                    if (container) {
                        const animation = container.animate(
                            [
                                { transform: 'translateY(0)' },
                                { transform: 'translateY(-50%)' }
                            ],
                            {
                                duration: 300,
                                easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
                                fill: 'forwards'
                            }
                        );
                        this._currentAnimation = animation;

                        animation.onfinish = () => {
                            this.prevDigit.set(current);
                            this.cdr.detectChanges();
                            animation.cancel();
                            if (this._currentAnimation === animation) {
                                this._currentAnimation = null;
                            }
                        };
                    } else {
                        // Fallback if element not found
                        this.prevDigit.set(current);
                    }
                } else {
                    this.prevDigit.set(current);
                }
                this._lastValue = current;
            }
        });
    }
}

@Component({
    selector: 'ui-number-ticker',
    standalone: true,
    imports: [NumberTickerDigitComponent],
    template: `
    <span [class]="classes()" #ticker>
      @for (char of displayDigits(); track $index) {
        <ui-number-ticker-digit [digit]="char"/>
      }
    </span>
  `,
})
export class NumberTickerComponent implements OnDestroy {
    private readonly _el = inject(ElementRef);

    value = input.required<number>();
    direction = input<'up' | 'down'>('up');
    delay = input<number>(0);
    duration = input<number>(1);
    decimalPlaces = input<number>(0);
    class = input<string>('');

    classes = computed(() => cn('inline-block tabular-nums tracking-wider text-black dark:text-white', this.class()));

    displayValue = signal<string>('0');
    displayDigits = computed(() => this.displayValue().split(''));

    private _animationFrameId: number | null = null;
    private _startTime: number | null = null;
    private _startValue: number = 0;
    private _endValue: number = 0;
    private _currentValue: number = 0;

    constructor() {
        effect(() => {
            const v = this.value();
            const d = this.delay();
            this._setupAnimation(v, d);
        });
    }

    private _setupAnimation(value: number, delay: number) {
        this._stopAnimation();

        this._endValue = value;
        this._startValue = this._currentValue;

        const delayMs = delay * 1000;

        setTimeout(() => {
            this._startTime = null;
            this._animationFrameId = requestAnimationFrame(this._animate);
        }, delayMs);
    }

    private _animate = (timestamp: number) => {
        if (!this._startTime) this._startTime = timestamp;

        const durationMs = this.duration() * 1000;
        const runtime = timestamp - this._startTime;
        const relativeProgress = runtime / durationMs;

        const progress = Math.min(relativeProgress, 1);

        const easeOutCubic = (x: number): number => {
            return 1 - Math.pow(1 - x, 3);
        };

        const easedProgress = easeOutCubic(progress);

        this._currentValue = this._startValue + (this._endValue - this._startValue) * easedProgress;

        this.displayValue.set(new Intl.NumberFormat('en-US', {
            minimumFractionDigits: this.decimalPlaces(),
            maximumFractionDigits: this.decimalPlaces(),
        }).format(this._currentValue));

        if (progress < 1) {
            this._animationFrameId = requestAnimationFrame(this._animate);
        } else {
            this._currentValue = this._endValue;
            this.displayValue.set(new Intl.NumberFormat('en-US', {
                minimumFractionDigits: this.decimalPlaces(),
                maximumFractionDigits: this.decimalPlaces(),
            }).format(this._endValue));
            this._startValue = this._endValue;
        }
    };

    private _stopAnimation() {
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }
    }

    ngOnDestroy(): void {
        this._stopAnimation();
    }
}
