import {
    Component,
    ChangeDetectionStrategy,
    input,
    model,
    computed,
    signal,
    forwardRef,
    viewChild,
    effect,
    DestroyRef,
    inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { UI_LOCALE_ID } from '../../lib/i18n';
import { InputComponent } from '../input';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';

const numberInputWrapperVariants = cva(
    'relative flex items-center border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] aria-disabled:pointer-events-none aria-disabled:opacity-50',
    {
        variants: {
            variant: {
                outline: 'dark:bg-input/30 rounded-lg border',
                underline: 'rounded-none border-b border-t-0 border-x-0 focus-within:ring-0 shadow-none',
                ghost: 'border-none shadow-none focus-within:ring-0',
            },
        },
        defaultVariants: {
            variant: 'outline',
        },
    }
);

export type NumberInputVariant = 'outline' | 'underline' | 'ghost';

@Component({
    selector: 'ui-number-input',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [InputComponent, FormsModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => NumberInputComponent),
            multi: true,
        },
        {
            provide: UI_INPUT_GROUP,
            useExisting: forwardRef(() => NumberInputComponent),
        },
    ],
    templateUrl: './number-input.component.html',
    styleUrl: './number-input.component.css',
    host: { class: 'contents' },
})
export class NumberInputComponent implements ControlValueAccessor {
    /**
     * The value, as a two-way `model()`. A write from outside overwrites the
     * current value, so it acts as a controlled value rather than just an
     * initial one; `null` shows the placeholder.
     *
     * Being a `ModelSignal` is what makes this component a valid Signal Forms
     * `FormValueControl`, and it doubles as the `valueChange` output: Angular
     * derives the output from the model, so there is no separate declaration.
     * A write from outside stays silent; only a user edit emits. Note that
     * after a `writeValue` from a reactive form this still reads the pre-write
     * value — the rendered value is {@link displayValue}.
     */
    readonly value = model<number | null>(null);
    /** Lower bound applied by the steppers, arrow keys and wheel, and enforced on blur. Typing below it is allowed until the field loses focus. */
    readonly min = input<number | undefined>(undefined);
    /** Upper bound applied by the steppers, arrow keys and wheel, and enforced on blur. Typing above it is allowed until the field loses focus. */
    readonly max = input<number | undefined>(undefined);
    /** Increment used by {@link increment}/{@link decrement}; its decimal count also sets the rounding precision, avoiding float drift like `0.30000000000000004`. */
    readonly step = input<number>(1);
    /**
     * Disables the control. OR-ed with the state pushed by
     * {@link setDisabledState}, so a reactive-forms `disable()` also wins.
     */
    readonly disabled = input<boolean>(false);
    /** Placeholder shown while the value is `null`. */
    readonly placeholder = input<string>('0');
    /** Extra classes merged onto the wrapper that frames the field and the stepper buttons, not onto the inner `<input>`. */
    readonly class = input('');
    /** Border/shape treatment of the wrapper. The inner `ui-input` renders borderless because this component itself provides `UI_INPUT_GROUP`. */
    readonly variant = input<NumberInputVariant>('outline');
    /**
     * BCP-47 locale tag used by the input's `lang` attribute so browsers
     * apply locale-appropriate number-pad layout and grouping for
     * accessibility tools. Falls back to the app-wide `UI_LOCALE_ID`.
     * The internal parse/format remains locale-neutral (JS Number) —
     * a fully locale-aware parse/format is a follow-up task.
     */
    readonly locale = input<string>();
    private readonly globalLocale = inject(UI_LOCALE_ID);
    /** Effective locale tag — explicit input wins; otherwise UI_LOCALE_ID. */
    readonly resolvedLocale = computed(() => this.locale() ?? this.globalLocale());


    readonly inputRef = viewChild.required<InputComponent>('inputRef');

    private readonly _currentValue = signal<number | null>(null);
    private readonly _formDisabled = signal(false);

    readonly isDisabled = computed(() => this.disabled() || this._formDisabled());

    readonly displayValue = computed(() => {
        const v = this._currentValue();
        return v === null ? '' : String(v);
    });

    readonly wrapperClasses = computed(() =>
        cn(numberInputWrapperVariants({ variant: this.variant() }), this.class())
    );

    private readonly destroyRef = inject(DestroyRef);
    private onChange: (value: number | null) => void = () => { };
    private onTouched: () => void = () => { };

    constructor() {
        effect(() => {
            this._currentValue.set(this.value());
        });
        effect(() => {
            const nativeInput = this.inputRef().inputRef()?.nativeElement;
            if (!nativeInput) return;
            const handler = (e: WheelEvent): void => {
                if (globalThis.document.activeElement !== nativeInput) return;
                e.preventDefault();
                if (e.deltaY < 0) this.increment();
                else if (e.deltaY > 0) this.decrement();
            };
            nativeInput.addEventListener('wheel', handler, { passive: false });
            this.destroyRef.onDestroy(() => nativeInput.removeEventListener('wheel', handler));
        });
    }

    /** Parses raw typed text (empty or unparsable becomes `null`) and publishes it. Deliberately does not clamp — {@link onBlur} does that once editing ends. */
    onInputChange(raw: string): void {
        this.commit(this.parseValue(raw));
    }

    /** Clamps the typed value into {@link min}/{@link max}, emitting only if that actually changed it, then marks the control touched. */
    onBlur(): void {
        const clamped = this.clamp(this._currentValue());
        if (clamped !== this._currentValue()) {
            this.commit(clamped);
        }
        this.onTouched();
    }

    /** Maps ArrowUp/ArrowDown to {@link increment}/{@link decrement}, suppressing the browser's own caret movement. */
    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.increment();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.decrement();
        }
    }

    /** Adds one {@link step}, treating a `null` value as `0`, then rounds to the step's precision and clamps to {@link max}. Also bound to the wheel and ArrowUp. */
    increment(): void {
        const current = this._currentValue() ?? 0;
        const next = this.clamp(this.roundStep(current + this.step()));
        this.updateValue(next);
    }

    /** Subtracts one {@link step}, treating a `null` value as `0`, then rounds to the step's precision and clamps to {@link min}. Also bound to the wheel and ArrowDown. */
    decrement(): void {
        const current = this._currentValue() ?? 0;
        const next = this.clamp(this.roundStep(current - this.step()));
        this.updateValue(next);
    }

    /** Pushes a form value in as-is — `null` empties the field — without clamping to {@link min}/{@link max} and without emitting {@link valueChange}. */
    writeValue(value: number | null): void {
        this._currentValue.set(value);
    }

    /** Stores the form's change callback, invoked alongside {@link valueChange} on every user-driven change. */
    registerOnChange(fn: (value: number | null) => void): void {
        this.onChange = fn;
    }

    /** Stores the form's touched callback, raised by {@link onBlur}. */
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    /** Records the form's disabled state separately from the {@link disabled} input; either one disables the field and its steppers. */
    setDisabledState(isDisabled: boolean): void {
        this._formDisabled.set(isDisabled);
    }

    /** Moves focus to the inner text field (not the stepper buttons). */
    focus(): void {
        this.inputRef().focus();
    }

    private parseValue(raw: string): number | null {
        if (raw.trim() === '') return null;
        const parsed = Number.parseFloat(raw);
        return Number.isNaN(parsed) ? null : parsed;
    }

    private clamp(value: number | null): number | null {
        if (value === null) return null;
        const minVal = this.min();
        const maxVal = this.max();
        let result = value;
        if (minVal !== undefined) result = Math.max(result, minVal);
        if (maxVal !== undefined) result = Math.min(result, maxVal);
        return result;
    }

    private roundStep(value: number): number {
        const step = this.step();
        const decimals = (step.toString().split('.')[1] ?? '').length;
        return Number.parseFloat(value.toFixed(decimals));
    }

    private updateValue(value: number | null): void {
        this.commit(value);
    }

    /**
     * The one path a user-driven change takes: store it, notify the form, then
     * publish it through the {@link value} model, which emits `valueChange`
     * exactly once.
     */
    private commit(value: number | null): void {
        this._currentValue.set(value);
        this.onChange(value);
        this.value.set(value);
    }
}
