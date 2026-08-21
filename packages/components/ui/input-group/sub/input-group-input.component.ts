import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  forwardRef,
  model,
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
  /** Extra classes merged onto the `<input>`. The group shell owns the border and ring, so this element is deliberately transparent and borderless. */
  class = input('');
  /** Native `type` attribute. Number inputs already have their spinner buttons hidden by the built-in styling. */
  type = input('text');
  /** Native placeholder text, styled muted. Not a substitute for a label — pair the group with a `ui-label`. */
  placeholder = input('');
  /** Disables the input. Combined with `FormControl.disable()` via {@link setDisabledState} — either source disables it. */
  disabled = input(false);

  /**
   * The text, as a two-way `model()`. Written by user typing, by
   * {@link writeValue} when a form pushes a value in, and by a `[(value)]`
   * binding. Being a `ModelSignal` is what makes this component a valid Signal
   * Forms `FormValueControl`.
   */
  readonly value = model('');
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

  /** Handles native input events, updating the local value signal and notifying the registered form callback. */
  onValueChange(value: string): void {
    this.value.set(value);
    this.onChange(value);
  }

  /** `ControlValueAccessor` write. Coerces `null`/`undefined` to `''`, so resetting the form clears the field instead of rendering "null". */
  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  /** `ControlValueAccessor` hook; the callback receives the raw string value on every keystroke. */
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  /** `ControlValueAccessor` hook; the stored callback is exposed as `onTouched` and invoked from the template's blur binding. */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** `ControlValueAccessor` hook for `FormControl.disable()`. Tracked separately from the {@link disabled} input — either one disables the field. */
  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}
