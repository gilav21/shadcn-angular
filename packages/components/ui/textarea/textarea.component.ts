import {
    Component,
    ChangeDetectionStrategy,
    ElementRef,
    input,
    computed,
    model,
    forwardRef,
    inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { SkeletonComponent } from '../skeleton';

const textareaVariants = cva(
    'flex w-full border-input bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
    {
        variants: {
            variant: {
                outline: 'rounded-md border shadow-sm focus-visible:ring-1 focus-visible:ring-ring',
                underline: 'rounded-none border-b focus-visible:border-ring px-0 shadow-none resize-none',
                ghost: 'border-none shadow-none focus-visible:ring-0 resize-none px-0',
            },
        },
        defaultVariants: {
            variant: 'outline',
        },
    }
);

export type TextareaVariant = VariantProps<typeof textareaVariants>['variant'];

let nextTextareaId = 0;

import { UI_INPUT_GROUP } from '../../lib/input-group.token';

@Component({
    selector: 'ui-textarea',
    imports: [FormsModule, SkeletonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrl: './textarea.component.css',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => TextareaComponent),
            multi: true,
        },
    ],
    templateUrl: './textarea.component.html',
    host: {
        '[class]': '"contents"',
        '[attr.id]': 'null',
    },
})
export class TextareaComponent implements ControlValueAccessor {
    /** Placeholder text for the native `<textarea>`. */
    placeholder = input<string>('');
    /** Disables the native `<textarea>`. This input is the only source of the disabled state — {@link setDisabledState} is deliberately a no-op. */
    disabled = input(false);
    /** Initial visible height in text rows (native `rows`); the user can still resize unless the {@link variant} disables resizing. */
    rows = input(3);
    /** Extra classes merged onto the `<textarea>` itself, appended after the variant classes so they win. */
    class = input('');
    /** Renders a placeholder block instead of the `<textarea>`. */
    readonly skeleton = input(false);

    /** Visual style. `underline` and `ghost` also drop the resize handle. Inside a `ui-input-group`, `outline` is downgraded to `ghost` so the group draws the border. */
    variant = input<TextareaVariant>('outline');

    /**
     * Forwarded to the inner `<textarea>`'s id so an external `<label for="x">`
     * associates with the real control. Without it, an `id` on the `<ui-textarea>`
     * host (which is `display: contents`) is not a labelable element, so the
     * control reaches screen readers unlabeled — a non-empty {@link placeholder}
     * quietly masks that from everything except axe.
     */
    readonly elementId = input<string | undefined>(undefined);
    /** Forwarded to the inner `<textarea>`'s name, for form submission. */
    readonly name = input<string | undefined>(undefined);
    /** Forwarded to the inner `<textarea>`'s aria-label, for when no visible label exists. */
    readonly ariaLabel = input<string | undefined>(undefined);
    /** Forwarded to the inner `<textarea>`'s aria-labelledby, when an external element already labels it. */
    readonly ariaLabelledby = input<string | undefined>(undefined);
    /** Forwarded to the inner `<textarea>`'s aria-describedby, e.g. pointing at a hint or error message. */
    readonly ariaDescribedby = input<string | undefined>(undefined);

    private readonly autoId = `ui-textarea-${++nextTextareaId}`;

    /**
     * An `id` written the native way — `<ui-textarea id="bio">`. Read off the host
     * and moved to the real control, because the host is a `display: contents`
     * wrapper and `<label for="bio">` would otherwise associate with nothing. The
     * host binding strips it, so the id is never duplicated.
     */
    private readonly hostId =
        inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.getAttribute('id') ?? undefined;

    /** The id actually applied to the inner `<textarea>`, from either spelling, falling back to a generated one. */
    readonly resolvedId = computed(() => this.elementId() ?? this.hostId ?? this.autoId);

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

    readonly classes = computed(() =>
        cn(textareaVariants({ variant: this.effectiveVariant() }), this.class())
    );

    /** Handles each keystroke from the template's `ngModel`: stores the text and notifies the form. Touched is raised separately on blur. */
    onValueChange(value: string): void {
        this.value.set(value);
        this.onChange(value);
    }

    /** Pushes a form value into the textarea, coercing `null`/`undefined` to `''` so the control never renders "null". */
    writeValue(value: string): void {
        this.value.set(value ?? '');
    }

    /** Stores the form's change callback, invoked from {@link onValueChange}. */
    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    /** Stores the form's touched callback, which the template invokes on blur. */
    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    /** Intentionally ignores the form's disabled state — use the {@link disabled} input instead. */
    setDisabledState(_isDisabled: boolean): void { /* ControlValueAccessor - no-op: disabled state managed by input */ }

    /** Current text, so the component can be interpolated directly in a template or asserted on in tests. */
    toString(): string {
        return this.value();
    }
}
