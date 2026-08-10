import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
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

    private readonly group = inject(UI_INPUT_GROUP, { optional: true });

    protected readonly effectiveVariant = computed(() => {
        const v = this.variant();
        return v === 'outline' && this.group ? 'ghost' : v;
    });

    value = signal('');

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
