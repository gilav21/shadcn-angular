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
    placeholder = input<string>('');
    disabled = input(false);
    rows = input(3);
    class = input('');
    readonly skeleton = input(false);

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

    onValueChange(value: string): void {
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

    setDisabledState(_isDisabled: boolean): void { /* ControlValueAccessor - no-op: disabled state managed by input */ }

    toString(): string {
        return this.value();
    }
}
