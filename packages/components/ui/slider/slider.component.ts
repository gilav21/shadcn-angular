import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    ElementRef,
    inject,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import { UI_LOCALE_ID, formatNumber } from '../../lib/i18n';

@Component({
    selector: 'ui-slider',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './slider.component.html',
    styleUrl: './slider.component.css',
    host: {
        class: 'contents',
    },
})
export class SliderComponent {
    private readonly el = inject(ElementRef);

    min = input(0);
    max = input(100);
    step = input(1);
    disabled = input(false);
    defaultValue = input(0);
    class = input('');
    ariaLabel = input<string | undefined>(undefined);
    ariaLabelledby = input<string | undefined>(undefined);
    /**
     * BCP-47 locale tag used to format `aria-valuetext` (the screen-reader
     * announcement) via `Intl.NumberFormat`. Falls back to the app-wide
     * `UI_LOCALE_ID` token. The raw `aria-valuenow` stays unformatted
     * because the ARIA spec requires it to be a JSON number.
     */
    locale = input<string>();
    private readonly globalLocale = inject(UI_LOCALE_ID);
    /** Locale-formatted value text, e.g. `'1,234.5'` in en or `'1.234,5'` in de. */
    readonly valueText = computed(() => formatNumber(this.value(), this.locale() ?? this.globalLocale()));
    valueChange = output<number>();

    value = signal(0);

    rtl(): boolean {
        return isRtl(this.el.nativeElement);
    }

    constructor() {
        const defaultVal = this.defaultValue();
        if (defaultVal !== undefined) {
            this.value.set(defaultVal);
        }
    }

    percentage = computed(() => {
        const min = this.min();
        const max = this.max();
        if (min >= max) {
            console.error('[ui-slider] min should be less than max');
            return 0;
        }
        const val = this.value();
        const range = max - min;
        return Math.max(0, Math.min(100, ((val - min) / range) * 100));
    });

    classes = computed(() =>
        cn(
            'relative flex w-full touch-none select-none items-center',
            this.disabled() && 'opacity-50 pointer-events-none',
            this.class()
        )
    );

    onTrackMouseDown(event: MouseEvent): void {
        if (this.disabled()) return;

        event.preventDefault();
        this.updateValueFromEvent(event);
        this.startDragging();

        const thumb = this.el.nativeElement.querySelector('[role="slider"]');
        thumb?.focus();
    }

    onThumbMouseDown(event: MouseEvent): void {
        if (this.disabled()) return;

        event.preventDefault();
        event.stopPropagation();
        this.startDragging();
    }

    onTouchStart(event: TouchEvent): void {
        if (this.disabled()) return;

        event.preventDefault();
        if (event.touches.length > 0) {
            this.updateValueFromTouch(event.touches[0]);
        }

        const onTouchMove = (e: TouchEvent): void => {
            if (e.touches.length > 0) {
                this.updateValueFromTouch(e.touches[0]);
            }
        };

        const onTouchEnd = (): void => {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };

        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    private startDragging(): void {
        const onMouseMove = (e: MouseEvent): void => {
            this.updateValueFromEvent(e);
        };

        const onMouseUp = (): void => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    onKeyDown(event: KeyboardEvent): void {
        if (this.disabled()) return;

        const step = this.step();
        const min = this.min();
        const max = this.max();
        let newValue = this.value();
        const isRtl = this.rtl();

        switch (event.key) {
            case 'ArrowRight':
            case 'ArrowUp':
                newValue = Math.min(max, newValue + (isRtl && event.key === 'ArrowRight' ? -step : step));
                event.preventDefault();
                break;
            case 'ArrowLeft':
            case 'ArrowDown':
                newValue = Math.max(min, newValue - (isRtl && event.key === 'ArrowLeft' ? -step : step));
                event.preventDefault();
                break;
            case 'Home':
                newValue = min;
                event.preventDefault();
                break;
            case 'End':
                newValue = max;
                event.preventDefault();
                break;
            case 'PageUp':
                newValue = Math.min(max, newValue + step * 10);
                event.preventDefault();
                break;
            case 'PageDown':
                newValue = Math.max(min, newValue - step * 10);
                event.preventDefault();
                break;
            default:
                return;
        }

        if (newValue !== this.value()) {
            this.value.set(newValue);
            this.valueChange.emit(newValue);
        }
    }

    private updateValueFromEvent(event: MouseEvent): void {
        this.updateValueFromPosition(event.clientX);
    }

    private updateValueFromTouch(touch: Touch): void {
        this.updateValueFromPosition(touch.clientX);
    }

    private updateValueFromPosition(clientX: number): void {
        const track = this.el.nativeElement.querySelector('[data-slot="slider"]');
        if (!track) return;

        const rect = track.getBoundingClientRect();
        let percent = (clientX - rect.left) / rect.width;

        if (this.rtl()) {
            percent = 1 - percent;
        }

        percent = Math.max(0, Math.min(1, percent));
        const min = this.min();
        const max = this.max();
        const step = this.step();

        let newValue = min + percent * (max - min);
        newValue = Math.round(newValue / step) * step;
        newValue = Math.max(min, Math.min(max, newValue));

        this.value.set(newValue);
        this.valueChange.emit(newValue);
    }

    toString(): string {
        return String(this.value());
    }
}
