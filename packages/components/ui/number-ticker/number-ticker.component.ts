import {
    Component,
    ElementRef,
    OnDestroy,
    computed,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';
import { cn, prefersReducedMotion } from '../../lib/utils';
import { UI_LOCALE_ID } from '../../lib/i18n';
import { NumberTickerDigitComponent } from './sub/number-ticker-digit.component';
export { NumberTickerDigitComponent };

@Component({
    selector: 'ui-number-ticker',
    imports: [NumberTickerDigitComponent],
    templateUrl: './number-ticker.component.html',
    host: { dir: 'ltr' }
})
export class NumberTickerComponent implements OnDestroy {
    private readonly _el = inject(ElementRef);

    /**
     * Target number. Every change restarts the tween from whatever value is
     * currently on screen, so rapid updates chase the latest value rather than
     * queueing. The first run counts up from 0.
     */
    value = input.required<number>();
    /** Intended count direction. The tween always eases from the current value to {@link value}, so this only matters for presentation — a lower target counts down regardless. */
    direction = input<'up' | 'down'>('up');
    /** Seconds to wait before the tween starts, applied on every {@link value} change. Useful for staggering a row of tickers. */
    delay = input<number>(0);
    /** Tween length in seconds, eased with `easeOutCubic` so most of the movement happens up front. Ignored when the user prefers reduced motion — the value then snaps. */
    duration = input<number>(1);
    /** Fixed number of decimals shown, passed to `Intl.NumberFormat` as both the min and max fraction digits so the width never jitters mid-count. */
    decimalPlaces = input<number>(0);
    /**
     * Extra classes merged onto the host. The default includes literal
     * `text-black dark:text-white` rather than a theme token, so pass a
     * `text-*` utility here when the ticker must follow the theme.
     */
    class = input<string>('');
    /**
     * BCP-47 locale tag passed straight to `Intl.NumberFormat` for the
     * displayed digits (controls grouping + decimal separator). Falls
     * back to the app-wide `UI_LOCALE_ID` (default `'en'`).
     */
    locale = input<string>();
    private readonly globalLocale = inject(UI_LOCALE_ID);
    /** Effective locale id used for Intl.NumberFormat. */
    readonly resolvedLocale = computed(() => this.locale() ?? this.globalLocale());

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

    private _setupAnimation(value: number, delay: number): void {
        this._stopAnimation();

        this._endValue = value;
        this._startValue = this._currentValue;

        if (prefersReducedMotion()) {
            this._currentValue = value;
            this._startValue = value;
            this.displayValue.set(new Intl.NumberFormat(this.resolvedLocale(), {
                minimumFractionDigits: this.decimalPlaces(),
                maximumFractionDigits: this.decimalPlaces(),
            }).format(value));
            return;
        }

        const delayMs = delay * 1000;

        setTimeout(() => {
            this._startTime = null;
            this._animationFrameId = requestAnimationFrame(this._animate);
        }, delayMs);
    }

    private readonly _animate = (timestamp: number): void => {
        this._startTime ??= timestamp;

        const durationMs = this.duration() * 1000;
        const runtime = timestamp - this._startTime;
        const relativeProgress = runtime / durationMs;

        const progress = Math.min(relativeProgress, 1);

        const easeOutCubic = (x: number): number => {
            return 1 - Math.pow(1 - x, 3);
        };

        const easedProgress = easeOutCubic(progress);

        this._currentValue = this._startValue + (this._endValue - this._startValue) * easedProgress;

        this.displayValue.set(new Intl.NumberFormat(this.resolvedLocale(), {
            minimumFractionDigits: this.decimalPlaces(),
            maximumFractionDigits: this.decimalPlaces(),
        }).format(this._currentValue));

        if (progress < 1) {
            this._animationFrameId = requestAnimationFrame(this._animate);
        } else {
            this._currentValue = this._endValue;
            this.displayValue.set(new Intl.NumberFormat(this.resolvedLocale(), {
                minimumFractionDigits: this.decimalPlaces(),
                maximumFractionDigits: this.decimalPlaces(),
            }).format(this._endValue));
            this._startValue = this._endValue;
        }
    };

    private _stopAnimation(): void {
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }
    }

    ngOnDestroy(): void {
        this._stopAnimation();
    }
}
