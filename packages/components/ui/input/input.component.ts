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
    },
})
export class InputComponent implements ControlValueAccessor {
    readonly type = input<string>('text');
    readonly placeholder = input<string>('');
    readonly disabled = input(false);
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
    /** Forwarded to the inner <input>'s aria-label. */
    readonly ariaLabel = input<string | undefined>(undefined);
    /** Forwarded to the inner <input>'s aria-labelledby. */
    readonly ariaLabelledby = input<string | undefined>(undefined);
    /** Forwarded to the inner <input>'s aria-describedby. */
    readonly ariaDescribedby = input<string | undefined>(undefined);

    readonly variant = input<InputVariant>('outline');
    readonly loading = input(false);
    readonly skeleton = input(false);

    readonly autofocus = input(false);
    readonly clearable = input(false);
    readonly floating = input(false);
    readonly label = input<string>();
    readonly prefix = input<string>();
    readonly suffix = input<string>();

    private readonly group = inject(UI_INPUT_GROUP, { optional: true });

    protected readonly effectiveVariant = computed(() => {
        const v = this.variant();
        return v === 'outline' && this.group ? 'ghost' : v;
    });

    readonly value = signal('');

    private onChange: (value: string) => void = () => { };
    onTouched: () => void = () => { };

    private readonly formDisabled = signal(false);
    private readonly isFocused = signal(false);

    readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

    readonly needsContainer = computed(() =>
        !!this.prefix() ||
        !!this.suffix() ||
        this.clearable() ||
        (this.floating() && !!this.label()) ||
        this.loading()
    );

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
        'absolute left-3 select-none pointer-events-none',
        'transition-all duration-150',
        this.labelIsActive()
            ? 'top-1.5 text-xs text-muted-foreground'
            : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground'
    ));

    onValueChange(value: string): void {
        this.value.set(value);
        this.onChange(value);
    }

    onFocus(): void {
        this.isFocused.set(true);
    }

    onBlur(): void {
        this.isFocused.set(false);
        this.onTouched();
    }

    clearValue(): void {
        this.onValueChange('');
        this.focus();
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

    focus(): void {
        this.inputRef()?.nativeElement.focus();
    }

    toString(): string {
        return this.value();
    }
}
