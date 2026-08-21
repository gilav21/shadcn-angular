import {
    Component,
    ChangeDetectionStrategy,
    input,
    model,
    computed,
    ElementRef,
    inject,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import { UI_LOCALE_ID, formatNumber } from '../../lib/i18n';

/** Track bounds used when {@link SliderComponent.min} / {@link SliderComponent.max} are left unset. */
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;

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

    /** Lower bound of the range. Must be less than {@link max}, otherwise the fill percentage logs an error and falls back to 0. */
    min = input<number | undefined>(DEFAULT_MIN);
    /** Upper bound of the range. Must be greater than {@link min}. */
    max = input<number | undefined>(DEFAULT_MAX);

    /**
     * {@link min} / {@link max} with their defaults applied. Every bound
     * calculation reads these, never the raw inputs: the Signal Forms `Field`
     * directive binds `min` and `max` from the field's schema, so a field with
     * no such rule pushes `undefined` in, and an unresolved `undefined` would
     * turn every percentage into `NaN`.
     */
    readonly resolvedMin = computed(() => this.min() ?? DEFAULT_MIN);
    readonly resolvedMax = computed(() => this.max() ?? DEFAULT_MAX);
    /** Granularity that pointer, arrow-key and Page-key changes snap to; Page Up/Down move ten steps at once. */
    step = input(1);
    /** Dims the slider and blocks pointer events, and short-circuits every keyboard and drag handler. */
    disabled = input(false);
    /** Starting value, read once in the constructor — later changes to this input do not move the thumb. */
    defaultValue = input(0);
    /** Extra classes merged onto the outer track wrapper, not onto the fill or the thumb. */
    class = input('');
    /** `aria-label` for the visually hidden `<input type="range">` that carries the slider's accessibility semantics. */
    ariaLabel = input<string | undefined>(undefined);
    /** `aria-labelledby` for the visually hidden range input, when an external element already labels the slider. */
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
    /**
     * The slider position, as a two-way `model()`. Emits on every value change
     * from dragging, tapping the track or keyboard input — including each
     * intermediate value during a drag.
     *
     * Being a `ModelSignal` is what makes this component a valid Signal Forms
     * `FormValueControl`, and it doubles as the `valueChange` output: Angular
     * derives the output from the model, so there is no separate declaration.
     */
    value = model(0);

    /** Whether the host resolves to a right-to-left direction; flips the fill/thumb positioning and the arrow-key direction. */
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
        const min = this.resolvedMin();
        const max = this.resolvedMax();
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

    /** Jumps the value to the clicked position, begins a document-level drag and focuses the hidden range input so the keyboard keeps working. */
    onTrackMouseDown(event: MouseEvent): void {
        if (this.disabled()) return;

        event.preventDefault();
        this.updateValueFromEvent(event);
        this.startDragging();

        const input = this.el.nativeElement.querySelector('input[type="range"]');
        input?.focus();
    }

    /** Starts a drag from the thumb, stopping propagation so {@link onTrackMouseDown} does not also jump the value on grab. */
    onThumbMouseDown(event: MouseEvent): void {
        if (this.disabled()) return;

        event.preventDefault();
        event.stopPropagation();
        this.startDragging();
    }

    /** Touch counterpart of {@link onTrackMouseDown}: seeks to the first touch point and tracks `touchmove` on the document until `touchend`. */
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

    /**
     * Keyboard interaction on the hidden range input: arrows move one
     * {@link step} (horizontal arrows are mirrored in RTL), Page Up/Down move
     * ten, Home/End jump to {@link min}/{@link max}. Other keys pass through
     * untouched, and {@link valueChange} fires only when the value really moved.
     */
    onKeyDown(event: KeyboardEvent): void {
        if (this.disabled()) return;

        const step = this.step();
        const min = this.resolvedMin();
        const max = this.resolvedMax();
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
        const min = this.resolvedMin();
        const max = this.resolvedMax();
        const step = this.step();

        let newValue = min + percent * (max - min);
        newValue = Math.round(newValue / step) * step;
        newValue = Math.max(min, Math.min(max, newValue));

        this.value.set(newValue);
    }

    /** Current value as a string, handy for template interpolation and test assertions. */
    toString(): string {
        return String(this.value());
    }
}
