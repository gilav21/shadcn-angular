import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../lib/utils';

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

    value = signal('');

    private onChange: (value: string) => void = () => { };
    onTouched: () => void = () => { };

    classes = computed(() =>
        cn(
            'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            this.class()
        )
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
