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
    @if (label()) {
      <div class="flex items-center gap-2">
        <button
          type="button"
          role="checkbox"
          [attr.aria-checked]="checked()"
          [attr.data-state]="indeterminate() ? 'indeterminate' : (checked() ? 'checked' : 'unchecked')"
          [class]="classes()"
          [disabled]="isDisabled()"
          [attr.id]="computedId()"
          [attr.aria-describedby]="ariaDescribedby()"
          [attr.aria-invalid]="ariaInvalid()"
          [attr.data-slot]="'checkbox'"
          (click)="toggle()"
        >
          @if (indeterminate()) {
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
            </svg>
          } @else if (checked()) {
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
        </button>
        <label 
          [attr.for]="computedId()" 
          class="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          (click)="toggle(); $event.preventDefault()"
        >
          {{ label() }}
        </label>
      </div>
    } @else {
      <button
        type="button"
        role="checkbox"
        [attr.aria-checked]="checked()"
        [attr.data-state]="indeterminate() ? 'indeterminate' : (checked() ? 'checked' : 'unchecked')"
        [class]="classes()"
        [disabled]="isDisabled()"
        [attr.id]="elementId()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="ariaLabelledby()"
        [attr.aria-describedby]="ariaDescribedby()"
        [attr.aria-invalid]="ariaInvalid()"
        [attr.data-slot]="'checkbox'"
        (click)="toggle()"
      >
        @if (indeterminate()) {
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
          </svg>
        } @else if (checked()) {
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        }
      </button>
    }
  `,
  host: {
    '[class]': '"contents"',
  },
})
export class CheckboxComponent implements ControlValueAccessor {
  private static idCounter = 0;

  readonly _disabled = signal(false);
  disabled = input(false);

  protected isDisabled = computed(() => this.disabled() || this._disabled());
  class = input('');
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
  computedId = computed(() => this.elementId() ?? this._generatedId);

  private onChange: (value: boolean) => void = () => { };
  private onTouched: () => void = () => { };

  classes = computed(() =>
    cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center',
      this.checked() || this.indeterminate()
        ? 'bg-primary text-primary-foreground'
        : 'bg-background',
      this.class()
    )
  );

  toggle() {
    if (this.isDisabled()) return;
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

  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }

  toString(): string {
    return String(this.checked());
  }
}
