import {
    Component,
    ChangeDetectionStrategy,
    input,
    model,
    computed,
    ElementRef,
    inject,
    linkedSignal,
    OnInit,
    DestroyRef,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import { UI_LOCALE_ID, formatNumber } from '../../lib/i18n';
import { snapToStep, stepFrom, type StepGrid } from '../../lib/numeric-step';

/** Track bounds used when {@link SliderComponent.min} / {@link SliderComponent.max} are left unset. */
const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
/** Steps Page Up / Page Down move at once. */
const PAGE_STEPS = 10;

@Component({
    selector: 'ui-slider',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './slider.component.html',
    styleUrl: './slider.component.css',
    host: {
        class: 'contents',
    },
})
export class SliderComponent implements OnInit {
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
    /**
     * Starting value for an uncontrolled slider, applied once on init and
     * snapped to the grid — later changes to this input do not move the thumb.
     * Silent: it neither emits {@link value} nor dirties a form. A value
     * supplied by `[value]` / `[(value)]` or by a form wins over it; a bound
     * `[value]` of exactly `0` is indistinguishable from "unset" and lets the
     * default apply.
     */
    defaultValue = input<number | undefined>(undefined);
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
    readonly valueText = computed(() => formatNumber(this.rendered(), this.locale() ?? this.globalLocale()));
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

    /**
     * What the slider holds: follows every {@link value} change, and is also
     * written locally — silently — by a seed or a form write.
     */
    private readonly current = linkedSignal(() => this.value());

    private readonly grid = computed<StepGrid>(() => ({
        min: this.resolvedMin(),
        max: this.resolvedMax(),
        step: this.step(),
    }));

    /**
     * The value on the grid — `min + k·step` inside `[min, top]`, where *top*
     * is the largest grid point ≤ `max`. The only value the template,
     * keyboard and pointer read. Snapped here rather than where the value is
     * stored, so a later `min`/`max`/`step` change re-snaps what is held, and
     * an off-grid value written from outside is shown on the grid without
     * being rewritten (and echoed) back to whoever wrote it.
     */
    readonly rendered = computed(() => snapToStep(this.current(), this.grid()));

    /** Whether the host resolves to a right-to-left direction; flips the fill/thumb positioning and the arrow-key direction. */
    rtl(): boolean {
        return isRtl(this.el.nativeElement);
    }

    constructor() {
        // A slider destroyed mid-drag (navigating away with the button held)
        // would otherwise keep its document listeners writing into a dead view.
        inject(DestroyRef).onDestroy(() => this.cancelDrag());
    }

    /**
     * Seeds {@link defaultValue}. Signal inputs are not bound yet in the
     * constructor, which is why a constructor read always saw the default.
     */
    ngOnInit(): void {
        const seed = this.defaultValue();
        if (seed !== undefined && this.value() === 0) {
            this.current.set(seed);
        }
    }

    percentage = computed(() => {
        const min = this.resolvedMin();
        const max = this.resolvedMax();
        if (min >= max) {
            console.error('[ui-slider] min should be less than max');
            return 0;
        }
        const val = this.rendered();
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

    /**
     * Touch counterpart of {@link onTrackMouseDown}: seeks to the first touch
     * point and tracks `touchmove` on the document until `touchend` or
     * `touchcancel` (an incoming call, an OS gesture).
     */
    onTouchStart(event: TouchEvent): void {
        if (this.disabled()) return;

        event.preventDefault();
        if (event.touches.length > 0) {
            this.updateValueFromTouch(event.touches[0]);
        }

        const signal = this.beginDrag();
        document.addEventListener('touchmove', (e: TouchEvent) => {
            if (e.touches.length > 0) {
                this.updateValueFromTouch(e.touches[0]);
            }
        }, { signal, passive: false });
        document.addEventListener('touchend', () => this.endDrag(), { signal });
        document.addEventListener('touchcancel', () => this.cancelDrag(), { signal });
    }

    /**
     * A value set on the hidden range input from outside the keyboard
     * handler — the increment/decrement gesture of a mobile screen reader,
     * which sets the value and fires `input`. Goes through the grid like any
     * other user change. Keys never arrive here twice: {@link onKeyDown}
     * prevents the default of every key it handles.
     */
    onNativeInput(event: Event): void {
        if (this.disabled()) return;
        const input = event.target as HTMLInputElement;
        this.commit(snapToStep(input.valueAsNumber, this.grid()));
    }

    /** Listeners of the drag in progress; aborting removes every one of them at once. */
    private drag: AbortController | null = null;

    private beginDrag(): AbortSignal {
        this.cancelDrag();
        this.drag = new AbortController();
        return this.drag.signal;
    }

    private cancelDrag(): void {
        this.drag?.abort();
        this.drag = null;
    }

    private endDrag(): void {
        this.cancelDrag();
    }

    private startDragging(): void {
        const signal = this.beginDrag();
        document.addEventListener('mousemove', (e: MouseEvent) => this.updateValueFromEvent(e), { signal });
        document.addEventListener('mouseup', () => this.endDrag(), { signal });
    }

    /**
     * Keyboard interaction on the hidden range input: arrows move one
     * {@link step} (horizontal arrows are mirrored in RTL), Page Up/Down move
     * ten, Home/End jump to {@link min} and to the largest grid value ≤
     * {@link max}. Every key lands on the grid, stepping from the rendered
     * value. Other keys pass through untouched, and {@link valueChange} fires
     * only when the value really moved.
     */
    onKeyDown(event: KeyboardEvent): void {
        if (this.disabled()) return;

        const next = this.keyTarget(event.key);
        if (next === null) return;

        event.preventDefault();
        this.commit(next);
    }

    private keyTarget(key: string): number | null {
        const grid = this.grid();
        const from = this.rendered();
        const forward = this.rtl() ? -1 : 1;
        switch (key) {
            case 'ArrowUp':
                return stepFrom(from, 1, 1, grid);
            case 'ArrowDown':
                return stepFrom(from, -1, 1, grid);
            case 'ArrowRight':
                return stepFrom(from, forward, 1, grid);
            case 'ArrowLeft':
                return stepFrom(from, forward === 1 ? -1 : 1, 1, grid);
            case 'PageUp':
                return stepFrom(from, 1, PAGE_STEPS, grid);
            case 'PageDown':
                return stepFrom(from, -1, PAGE_STEPS, grid);
            case 'Home':
                return snapToStep(Number.NEGATIVE_INFINITY, grid);
            case 'End':
                return snapToStep(Number.POSITIVE_INFINITY, grid);
            default:
                return null;
        }
    }

    /**
     * The one path a user-driven change takes. A move inside the same grid
     * cell changes nothing and emits nothing; otherwise the value is stored
     * and published through the {@link value} model, which emits once.
     */
    private commit(next: number): void {
        if (next === this.rendered()) return;
        this.current.set(next);
        this.value.set(next);
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

        this.commit(snapToStep(min + percent * (max - min), this.grid()));
    }

    /** Rendered (on-grid) value as a string, handy for template interpolation and test assertions. */
    toString(): string {
        return String(this.rendered());
    }
}
