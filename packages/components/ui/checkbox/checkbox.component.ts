import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  forwardRef,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';
import { SkeletonComponent } from '../skeleton';

@Component({
  selector: 'ui-checkbox',
  imports: [SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './checkbox.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
  templateUrl: './checkbox.component.html',
  host: {
    '[class]': '"contents"',
  },
})
export class CheckboxComponent implements ControlValueAccessor {
  private static idCounter = 0;

  readonly _disabled = signal(false);
  disabled = input(false);

  protected readonly isDisabled = computed(() => this.disabled() || this._disabled());
  class = input('');
  readonly skeleton = input(false);
  elementId = input<string | undefined>(undefined);
  ariaLabel = input<string | undefined>(undefined);
  ariaLabelledby = input<string | undefined>(undefined);
  ariaDescribedby = input<string | undefined>(undefined);
  ariaInvalid = input<boolean | undefined>(undefined);
  checked = model<boolean>(false);
  indeterminate = input(false);

  // Simple mode: inline label
  label = input<string | undefined>(undefined);

  // Auto-generate ID when label is used
  private readonly _generatedId = `checkbox-${++CheckboxComponent.idCounter}`;
  readonly computedId = computed(() => this.elementId() ?? this._generatedId);

  private onChange: (value: boolean) => void = () => { };
  private onTouched: () => void = () => { };

  readonly classes = computed(() =>
    cn(
      'h-4 w-4 shrink-0 rounded-sm border border-primary shadow outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50 flex items-center justify-center',
      this.checked() || this.indeterminate()
        ? 'bg-primary text-primary-foreground'
        : 'bg-background',
      this.class()
    )
  );

  readonly dataState = computed(() => {
    if (this.indeterminate()) return 'indeterminate';
    return this.checked() ? 'checked' : 'unchecked';
  });

  toggle(): void {
    if (this.isDisabled()) return;
    const newValue = !this.checked();
    this.checked.set(newValue);
    this.onChange(newValue);
    this.onTouched();
  }

  protected onNativeChange(event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.checked.set(value);
    this.onChange(value);
    this.onTouched();
  }

  protected markTouched(): void {
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

  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }

  toString(): string {
    return String(this.checked());
  }
}
