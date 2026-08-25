import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    forwardRef,
    model,
    signal,
    inject,
    viewChild,
    ElementRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { SpinnerComponent } from '../spinner';
import { SkeletonComponent } from '../skeleton';
import { IconComponent } from '../icon';

const inputVariants = cva(
    'border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-transparent text-base transition-colors md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    {
        variants: {
            variant: {
                outline: 'dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border focus-visible:ring-[3px] aria-invalid:ring-[3px]',
                underline: 'rounded-none border-b focus-visible:border-ring px-0 shadow-none',
                ghost: 'border-none shadow-none focus-visible:ring-0 px-0',
            },
        },
        defaultVariants: {
            variant: 'outline',
        },
    }
);

export type InputVariant = VariantProps<typeof inputVariants>['variant'];

import { UI_INPUT_GROUP } from '../../lib/input-group.token';

let nextInputId = 0;

@Component({
    selector: 'ui-input',
    imports: [FormsModule, SpinnerComponent, SkeletonComponent, IconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrl: './input.component.css',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputComponent),
            multi: true,
        },
    ],
    templateUrl: './input.component.html',
    host: {
        '[class]': '"contents"',
        '[attr.id]': 'null',
    },
})
export class InputComponent implements ControlValueAccessor {
    /** Native `type` of the inner `<input>` (`'text'`, `'email'`, `'password'`, …). */
    readonly type = input<string>('text');
    /**
     * Placeholder text. Not a substitute for a label — it disappears on typing
     * and does not name the control for assistive tech; use `label`,
     * `ariaLabel`, or an external `<label for>` via `elementId`.
     */
    readonly placeholder = input<string>('');
    /** Disables the control. OR-ed with the form's disabled state and any enclosing input group's. */
    readonly disabled = input(false);
    /**
     * Extra classes. Applied to the inner `<input>` normally, or to the wrapping
     * container when one is rendered (see {@link needsContainer}).
     */
    readonly class = input('');

    /**
     * Forwarded to the inner <input>'s id so `<label for="x">` outside the
     * component correctly associates. Without this, putting `id` on the
     * `<ui-input>` host (which has class="contents") doesn't reach the
     * real form control and screen readers / axe report no label.
     */
    readonly elementId = input<string | undefined>(undefined);
    /** Forwarded to the inner <input>'s name (for form submission). */
    readonly name = input<string | undefined>(undefined);

    private readonly autoId = `ui-input-${++nextInputId}`;

    /**
     * An `id` written the native way — `<ui-input id="email">`. The host is a
     * `display: contents` wrapper, so an `id` left on it is not a labelable control
     * and `<label for="email">` associates with nothing: the input reached screen
     * readers unlabeled (axe `label`), which a non-empty `placeholder` was quietly
     * masking. Read off the host here and moved to the real control instead (the
     * host binding below strips it, so the id is never duplicated).
     */
    private readonly hostId =
        inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.getAttribute('id') ?? undefined;

    /**
     * The id actually applied to the inner `<input>`, from either spelling. Falls
     * back to a generated id so the floating variant's own `<label for>` always
     * has something to bind to.
     */
    readonly resolvedId = computed(() => this.elementId() ?? this.hostId ?? this.autoId);
    /** Forwarded to the inner <input>'s aria-label. */
    readonly ariaLabel = input<string | undefined>(undefined);
    /** Forwarded to the inner <input>'s aria-labelledby. */
    readonly ariaLabelledby = input<string | undefined>(undefined);
    /** Forwarded to the inner <input>'s aria-describedby. */
    readonly ariaDescribedby = input<string | undefined>(undefined);

    /**
     * Border treatment. Inside a `ui-input-group` an `outline` input is
     * automatically downgraded to `ghost` so the group draws the single border.
     */
    readonly variant = input<InputVariant>('outline');
    /** Show a trailing spinner (e.g. while validating or fetching suggestions). */
    readonly loading = input(false);
    /** Replace the control with a skeleton placeholder while content loads. */
    readonly skeleton = input(false);

    /** Focus the inner `<input>` on first render. */
    readonly autofocus = input(false);
    /** Show a clear (✕) button once the field has a value. */
    readonly clearable = input(false);
    /** Float {@link label} above the field on focus/value. Requires `label`; ignored without it. */
    readonly floating = input(false);
    /** Label text. Rendered as a floating label when {@link floating} is set. */
    readonly label = input<string>();
    /** Extra classes for the floating label, e.g. `text-base font-semibold
     * text-foreground` — merged last so they override the defaults. */
    readonly labelClass = input('');
    /** Icon name shown before the field. Presence forces the bordered container layout. */
    /**
     * Which on-screen keyboard a touch device should offer.
     *
     * Separate from {@link type} because the two answer different questions.
     * A currency or duration field cannot use `type="number"` — a number field
     * refuses the comma that most of Europe uses as a decimal separator, and
     * strips any formatting — but it still wants a numeric keypad. Without
     * this the only way to get one is to reach past the component to the
     * native element.
     */
    readonly inputMode = input<string | undefined>(undefined);
    /**
     * BCP-47 tag on the field itself, so a browser offers the right keypad
     * layout and assistive tech reads digits in the right language.
     */
    readonly lang = input<string | undefined>(undefined);
    /** Text shown before the field, such as a currency symbol or `https://`. Presence forces the bordered container layout. */
    readonly prefix = input<string>();
    /** Icon name shown after the field. Presence forces the bordered container layout. */
    readonly suffix = input<string>();

    private readonly group = inject(UI_INPUT_GROUP, { optional: true });

    protected readonly effectiveVariant = computed(() => {
        const v = this.variant();
        return v === 'outline' && this.group ? 'ghost' : v;
    });

    /**
     * The text, as a two-way `model()`. Written by user typing, by
     * {@link writeValue} when a form pushes a value in, and by a `[(value)]`
     * binding.
     *
     * Being a `ModelSignal` is what makes this component a valid Signal Forms
     * `FormValueControl`. Unlike the controls that already had a hand-written
     * `valueChange` output, this one never promised silence on a programmatic
     * write — the output is new here — so there is no second signal and no
     * suppression: the model is the single source of truth, and a form write
     * keeps a `[(value)]` binding in sync instead of letting it drift.
     */
    readonly value = model('');

    private onChange: (value: string) => void = () => { };
    onTouched: () => void = () => { };

    private readonly formDisabled = signal(false);
    private readonly isFocused = signal(false);

    readonly isDisabled = computed(() =>
        this.disabled() || this.formDisabled() || (this.group?.disabled() ?? false)
    );

    readonly needsContainer = computed(() =>
        !!this.prefix() ||
        !!this.suffix() ||
        this.clearable() ||
        this.loading()
    );

    /** Floating-label mode: the label animates from a placeholder position to
     * above the input, which keeps its variant styling and normal height. */
    readonly isFloating = computed(() => this.floating() && !!this.label());

    readonly labelIsActive = computed(() =>
        this.isFocused() || !!this.value()
    );

    readonly classes = computed(() =>
        cn(inputVariants({ variant: this.effectiveVariant() }), this.class())
    );

    readonly containerClasses = computed(() => cn(
        'relative flex w-full items-center rounded-lg border border-input shadow-xs',
        'transition-[color,box-shadow]',
        'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50',
        'dark:bg-input/30 bg-transparent',
        this.isDisabled() && 'opacity-50 pointer-events-none cursor-not-allowed',
        this.class()
    ));

    readonly innerClasses = computed(() => cn(
        inputVariants({ variant: 'ghost' }),
        'flex-1 h-full',
    ));

    readonly floatingLabelClasses = computed(() => cn(
        'pointer-events-none absolute select-none text-muted-foreground transition-all duration-150',
        // Resting = uniform placeholder; on float it transforms to the (optionally
        // dev-customized via labelClass) heading font.
        this.labelIsActive() ? cn('text-xs', this.labelClass()) : 'text-sm'
    ));

    /** Commit a new value from the inner `<input>` and notify the form. */
    onValueChange(value: string): void {
        this.value.set(value);
        this.onChange(value);
    }

    /** Track focus so the floating label can rise. */
    onFocus(): void {
        this.isFocused.set(true);
    }

    /** Drop focus state and mark the control touched. */
    onBlur(): void {
        this.isFocused.set(false);
        this.onTouched();
    }

    /** Clear the value and return focus to the field, so typing can continue immediately. */
    clearValue(): void {
        this.onValueChange('');
        this.focus();
    }

    /** `ControlValueAccessor`: adopt a value from the form. Null/undefined become `''`. */
    writeValue(value: string): void {
        this.value.set(value ?? '');
    }

    /** `ControlValueAccessor`: register the form's change callback. */
    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    /** `ControlValueAccessor`: register the form's touched callback. */
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    /**
     * `ControlValueAccessor`: adopt the form's disabled state. Kept separate
     * from the {@link disabled} input so neither overrides the other — see
     * {@link isDisabled}.
     */
    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }

    /** The inner `<input>` element. */
    readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputRef');

    /** Focus the inner `<input>`. */
    focus(): void {
        this.inputRef()?.nativeElement.focus();
    }

    /** The current value, so the component interpolates as its text in a template. */
    toString(): string {
        return this.value();
    }
}
