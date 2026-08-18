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
  /**
   * Disables the checkbox. OR-ed with the state pushed by
   * {@link setDisabledState}, so a reactive-forms `disable()` also wins even
   * when this input stays `false`.
   */
  disabled = input(false);

  protected readonly isDisabled = computed(() => this.disabled() || this._disabled());
  /** Extra classes merged onto the visual box (not the host or the label). */
  class = input('');
  /** Renders placeholder blocks instead of the control; the label slot gets its own placeholder when {@link label} is set. */
  readonly skeleton = input(false);
  /** `id` for the native input. When {@link label} is set an auto-generated id is used instead so the label's `for` can bind. */
  elementId = input<string | undefined>(undefined);
  /** `aria-label` for the native input. Ignored when {@link label} is set, since the rendered label labels the control. */
  ariaLabel = input<string | undefined>(undefined);
  /** `aria-labelledby` for the native input. Ignored when {@link label} is set — the generated label element is referenced instead. */
  ariaLabelledby = input<string | undefined>(undefined);
  /** `aria-describedby` for the native input, e.g. pointing at a hint or error message. */
  ariaDescribedby = input<string | undefined>(undefined);
  /** `aria-invalid` for the native input; leave undefined to omit the attribute entirely. */
  ariaInvalid = input<boolean | undefined>(undefined);
  /** Two-way checked state. Also written by {@link writeValue} and emitted through the registered `onChange`. */
  checked = model<boolean>(false);
  /** Renders the dash glyph and sets `data-state="indeterminate"`; purely visual — it does not change {@link checked}, and toggling clears it only if the consumer does. */
  indeterminate = input(false);

  /** Simple mode: renders an associated `<label>` next to the box, wired to the auto-generated id. */
  label = input<string | undefined>(undefined);

  // Auto-generate ID when label is used
  private readonly _generatedId = `checkbox-${++CheckboxComponent.idCounter}`;
  readonly computedId = computed(() => this.elementId() ?? this._generatedId);

  private onChange: (value: boolean) => void = () => { };
  private onTouched: () => void = () => { };

  readonly classes = computed(() =>
    cn(
      'shrink-0 rounded-sm border border-primary shadow outline-none peer-focus-visible:ring-1 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50 flex items-center justify-center',
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

  /** Flips {@link checked} and notifies the form (change + touched). No-op while disabled. */
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

  /** Pushes a form value into {@link checked}, coercing `null`/`undefined` to `false`. Does not emit back to the form. */
  writeValue(value: boolean): void {
    this.checked.set(value ?? false);
  }

  /** Stores the form's change callback, invoked by {@link toggle} and by native input changes. */
  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  /** Stores the form's touched callback, invoked on blur and on every toggle. */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** Records the form's disabled state separately from the {@link disabled} input; either one disables the control. */
  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }

  /** String form of the current {@link checked} value (`"true"`/`"false"`), handy in templates and test assertions. */
  toString(): string {
    return String(this.checked());
  }
}
