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
import { cn } from '../lib/utils';

const inputVariants = cva(
    'border-input aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-transparent py-1 text-base transition-colors md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    {
        variants: {
            variant: {
                outline: 'dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-lg border px-3 focus-visible:ring-[3px] aria-invalid:ring-[3px]',
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

import { UI_INPUT_GROUP } from './input-group.token';

@Component({
    selector: 'ui-input',
    imports: [FormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputComponent),
            multi: true,
        },
    ],
    template: `
    <input
      [class]="classes()"
      [type]="type()"
      [disabled]="isDisabled()"
      [placeholder]="placeholder()"
      [placeholder]="placeholder()"
      [attr.data-slot]="'input'"
      #inputRef
      [ngModel]="value()"
      (ngModelChange)="onValueChange($event)"
      (blur)="onTouched()"
    />
  `,
    host: {
        '[class]': '"contents"',
    },
})
export class InputComponent implements ControlValueAccessor {
    type = input<string>('text');
    placeholder = input<string>('');
    disabled = input(false);
    class = input('');

    variant = input<InputVariant>('outline');

    private readonly group = inject(UI_INPUT_GROUP, { optional: true });

    protected readonly effectiveVariant = computed(() => {
        const v = this.variant();
        return v === 'outline' && this.group ? 'ghost' : v;
    });

    value = signal('');

    private onChange: (value: string) => void = () => { };
    onTouched: () => void = () => { };

    private formDisabled = signal(false);

    isDisabled = computed(() => this.disabled() || this.formDisabled());

    classes = computed(() =>
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

    readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('inputRef');

    focus() {
        this.inputRef().nativeElement.focus();
    }
}
