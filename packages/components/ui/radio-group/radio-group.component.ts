import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
  InjectionToken,
  effect,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';
import { RadioGroupItemComponent } from './sub/radio-group-item.component';

export const RADIO_GROUP = new InjectionToken<RadioGroupComponent>('RADIO_GROUP');

export { RadioGroupItemComponent };

@Component({
  selector: 'ui-radio-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [forwardRef(() => RadioGroupItemComponent)],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioGroupComponent),
      multi: true,
    },
    {
      provide: RADIO_GROUP,
      useExisting: forwardRef(() => RadioGroupComponent),
    },
  ],
  templateUrl: './radio-group.component.html',
  host: {
    '[class]': '"contents"',
  },
})
export class RadioGroupComponent<T = unknown> implements ControlValueAccessor {
  private static groupCounter = 0;
  /** Shared name that groups the native radio inputs of this group. */
  readonly groupName = `radio-group-${++RadioGroupComponent.groupCounter}`;

  /** Lays the items out in a column (`vertical`, default) or a row, and sets `aria-orientation` for screen readers. */
  orientation = input<'horizontal' | 'vertical'>('vertical');
  /**
   * Disables every item in the group. OR-ed with the state pushed by
   * {@link setDisabledState}, and each item may additionally disable itself.
   */
  disabled = input(false);
  /** Extra classes merged onto the `role="radiogroup"` wrapper. */
  class = input('');

  /** Data-driven mode: supplying a non-empty array renders one item per option and makes projected content be ignored. */
  readonly options = input<T[]>([]);
  /** Maps an option to its visible label. Defaults to `String`. See {@link getDisplayValue}. */
  readonly displayWith = input<(option: T) => string>(String);
  /** Property name to read an option's value from when options are objects; without it the whole option is stringified. See {@link getValue}. */
  readonly valueAttribute = input<string | undefined>(undefined);
  /** Predicate deciding per option whether its item is disabled. Defaults to always enabled. See {@link isOptionDisabled}. */
  readonly disabledWith = input<(option: T) => boolean>(() => false);
  /** One-way initial/controlled selection. Applied to {@link internalValue} whenever it is not `null`/`undefined`, so it can never clear a selection. */
  readonly value = input<string | undefined>(undefined);

  private readonly formDisabled = signal(false);
  isDisabled = computed(() => this.disabled() || this.formDisabled());
  readonly isDataDriven = computed(() => this.options().length > 0);

  internalValue = signal<string | null>(null);
  /** Emits the newly selected value on user selection only — not when {@link writeValue} or the {@link value} input changes the selection. */
  valueChange = output<string>();

  private onChange: (value: string) => void = () => { };
  private onTouched: () => void = () => { };

  classes = computed(() =>
    cn(
      'grid gap-2',
      this.orientation() === 'horizontal' ? 'grid-flow-col' : 'grid-flow-row',
      this.class()
    )
  );

  constructor() {
    effect(() => {
      const val = this.value();
      if (val !== undefined && val !== null) {
        this.internalValue.set(val);
      }
    });
  }

  /** Label text for a data-driven option, via {@link displayWith}, falling back to `String(option)`. */
  getDisplayValue(option: T): string {
    const fn = this.displayWith();
    return typeof fn === 'function' ? fn(option) : String(option);
  }

  /** Form value for a data-driven option: the {@link valueAttribute} property when set, otherwise the stringified option. Always a string. */
  getValue(option: T): string {
    const attr = this.valueAttribute();
    if (attr) {
      return String((option as Record<string, unknown>)[attr]);
    }
    return String(option);
  }

  /** Runs {@link disabledWith} for a data-driven option; the group-level {@link disabled} applies on top of this. */
  isOptionDisabled(option: T): boolean {
    return this.disabledWith()(option);
  }

  /** Selects a value on behalf of an item: updates {@link internalValue}, notifies the form and emits {@link valueChange}. No-op while the group is disabled. */
  selectValue(val: string): void {
    if (this.isDisabled()) return;
    this.internalValue.set(val);
    this.onChange(val);
    this.valueChange.emit(val);
    this.onTouched();
  }

  /** Pushes a form value into {@link internalValue} — passing `null` clears the selection. Emits neither `onChange` nor {@link valueChange}. */
  writeValue(value: string): void {
    this.internalValue.set(value);
  }

  /** Stores the form's change callback, invoked by {@link selectValue}. */
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  /** Stores the form's touched callback; the group raises it on selection rather than on blur. */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** Records the form's disabled state separately from the {@link disabled} input; either one disables all items. */
  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}
