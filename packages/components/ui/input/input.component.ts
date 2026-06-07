import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    forwardRef,
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

const inputVariants = cva(
    'border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-transparent py-[calc(0.25rem*var(--_d))] text-base transition-colors md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    {
        variants: {
            variant: {
                outline: 'dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-[calc(2.25rem*var(--_d))] rounded-lg border px-[calc(0.75rem*var(--_d))] focus-visible:ring-[3px] aria-invalid:ring-[3px]',
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

@Component({
    selector: 'ui-input',
    imports: [FormsModule, SpinnerComponent, SkeletonComponent],
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
    },
})
export class InputComponent implements ControlValueAccessor {
    type = input<string>('text');
    placeholder = input<string>('');
    disabled = input(false);
    class = input('');

    /**
     * Forwarded to the inner <input>'s id so `<label for="x">` outside the
     * component correctly associates. Without this, putting `id` on the
     * `<ui-input>` host (which has class="contents") doesn't reach the
     * real form control and screen readers / axe report no label.
     */
    elementId = input<string | undefined>(undefined);
    /** Forwarded to the inner <input>'s name (for form submission). */
    name = input<string | undefined>(undefined);
    /** Forwarded to the inner <input>'s aria-label. */
    ariaLabel = input<string | undefined>(undefined);
    /** Forwarded to the inner <input>'s aria-labelledby. */
    ariaLabelledby = input<string | undefined>(undefined);
    /** Forwarded to the inner <input>'s aria-describedby. */
    ariaDescribedby = input<string | undefined>(undefined);

    variant = input<InputVariant>('outline');
    readonly loading = input(false);
    readonly skeleton = input(false);

    private readonly group = inject(UI_INPUT_GROUP, { optional: true });

    protected readonly effectiveVariant = computed(() => {
        const v = this.variant();
        return v === 'outline' && this.group ? 'ghost' : v;
    });

    value = signal('');

    private onChange: (value: string) => void = () => { };
    onTouched: () => void = () => { };

    private readonly formDisabled = signal(false);

    readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

    readonly classes = computed(() =>
        cn(inputVariants({ variant: this.effectiveVariant() }), this.class())
    );

    onValueChange(value: string) {
        this.value.set(value);
        this.onChange(value);
    }

    writeValue(value: string): void {
        this.value.set(value ?? '');
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.formDisabled.set(isDisabled);
    }

    readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputRef');

    focus() {
        this.inputRef()?.nativeElement.focus();
    }

    toString(): string {
        return this.value();
    }
}
