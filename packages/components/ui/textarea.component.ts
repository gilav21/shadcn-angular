import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    forwardRef,
    inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const textareaVariants = cva(
    'flex min-h-[60px] w-full border-input bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
    {
        variants: {
            variant: {
                outline: 'rounded-md border px-3 py-2 shadow-sm focus-visible:ring-1 focus-visible:ring-ring',
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

import { UI_INPUT_GROUP } from './input-group.token';

@Component({
    selector: 'ui-textarea',
    imports: [FormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => TextareaComponent),
            multi: true,
        },
    ],
    template: `
    <textarea
      [class]="classes()"
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      [rows]="rows()"
      [attr.data-slot]="'textarea'"
      [ngModel]="value()"
      (ngModelChange)="onValueChange($event)"
      (blur)="onTouched()"
    ></textarea>
  `,
    host: {
        '[class]': '"contents"',
    },
})
export class TextareaComponent implements ControlValueAccessor {
    placeholder = input<string>('');
    disabled = input(false);
    rows = input(3);
    class = input('');

    variant = input<TextareaVariant>('outline');

    private readonly group = inject(UI_INPUT_GROUP, { optional: true });

    protected readonly effectiveVariant = computed(() => {
        const v = this.variant();
        return v === 'outline' && this.group ? 'ghost' : v;
    });

    value = signal('');

    private onChange: (value: string) => void = () => { };
    onTouched: () => void = () => { };

    classes = computed(() =>
        cn(textareaVariants({ variant: this.effectiveVariant() }), this.class())
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

    setDisabledState(isDisabled: boolean): void { }
}
