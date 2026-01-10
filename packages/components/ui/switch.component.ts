import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    model,
    forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-switch',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => SwitchComponent),
            multi: true,
        },
    ],
    template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [class]="trackClasses()"
      [disabled]="disabled()"
      [attr.data-slot]="'switch'"
      [attr.id]="elementId()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-labelledby]="ariaLabelledby()"
      (click)="toggle()"
    >
      <span [class]="thumbClasses()"></span>
    </button>
  `,
    host: {
        '[class]': '"contents"',
    },
})
export class SwitchComponent implements ControlValueAccessor {
    disabled = input(false);
    class = input('');
    elementId = input<string | undefined>(undefined);
    ariaLabel = input<string | undefined>(undefined);
    ariaLabelledby = input<string | undefined>(undefined);
    checked = model(false);

    private onChange: (value: boolean) => void = () => { };
    private onTouched: () => void = () => { };

    trackClasses = computed(() =>
        cn(
            'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            this.checked() ? 'bg-primary' : 'bg-input',
            this.class()
        )
    );

    thumbClasses = computed(() =>
        cn(
            'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
            this.checked() ? 'translate-x-4' : 'translate-x-0'
        )
    );

    toggle() {
        if (this.disabled()) return;
        const newValue = !this.checked();
        this.checked.set(newValue);
        this.onChange(newValue);
        this.onTouched();
    }

    writeValue(value: boolean): void {
        this.checked.set(value ?? false);
    }

    registerOnChange(fn: (value: boolean) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void { }
}
