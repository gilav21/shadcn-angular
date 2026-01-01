import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    forwardRef,
    signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../../lib/utils';

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
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      [attr.data-slot]="'input'"
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

    value = signal('');

    private onChange: (value: string) => void = () => { };
    onTouched: () => void = () => { };

    classes = computed(() =>
        cn(
            'dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-9 rounded-lg border bg-transparent px-3 py-1 text-base transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
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
