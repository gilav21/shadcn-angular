import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  model,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../lib/utils';

@Component({
  selector: 'ui-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  template: `
    <button
      type="button"
      role="checkbox"
      [attr.aria-checked]="checked()"
      [attr.data-state]="checked() ? 'checked' : 'unchecked'"
      [class]="classes()"
      [disabled]="disabled()"
      [attr.id]="elementId()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-labelledby]="ariaLabelledby()"
      [attr.data-slot]="'checkbox'"
      (click)="toggle()"
    >
      @if (checked()) {
        <svg
          class="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="3"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      }
    </button>
  `,
  host: {
    '[class]': '"contents"',
  },
})
export class CheckboxComponent implements ControlValueAccessor {
  disabled = input(false);
  class = input('');
  elementId = input<string | undefined>(undefined);
  ariaLabel = input<string | undefined>(undefined);
  ariaLabelledby = input<string | undefined>(undefined);
  checked = model(false);

  private onChange: (value: boolean) => void = () => { };
  private onTouched: () => void = () => { };

  classes = computed(() =>
    cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center',
      this.checked()
        ? 'bg-primary text-primary-foreground'
        : 'bg-background',
      this.class()
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
