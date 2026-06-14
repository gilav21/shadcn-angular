import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  forwardRef,
  signal,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

/**
 * InputGroupInput - Legacy input for input-group.
 * Prefer using `ui-input` inside `ui-input-group`.
 */
@Component({
  selector: 'ui-input-group-input',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputGroupInputComponent),
      multi: true,
    },
  ],
  templateUrl: './input-group-input.component.html',
  styleUrl: './input-group-input.component.css',
  host: { class: 'contents' },
})
export class InputGroupInputComponent implements ControlValueAccessor {
  class = input('');
  type = input('text');
  placeholder = input('');
  disabled = input(false);

  value = signal('');
  private readonly formDisabled = signal(false);
  isDisabled = computed(() => this.disabled() || this.formDisabled());

  private onChange: (value: string) => void = () => { };
  onTouched: () => void = () => { };

  classes = computed(() => cn(
    'flex-1 min-w-0 bg-transparent text-base md:text-sm',
    'placeholder:text-muted-foreground',
    'focus:outline-none',
    'disabled:cursor-not-allowed',
    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
    this.class()
  ));

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

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}
