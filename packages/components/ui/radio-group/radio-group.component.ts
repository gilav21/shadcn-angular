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
  orientation = input<'horizontal' | 'vertical'>('vertical');
  disabled = input(false);
  class = input('');

  // Data-driven inputs
  readonly options = input<T[]>([]);
  readonly displayWith = input<(option: T) => string>(String);
  readonly valueAttribute = input<string | undefined>(undefined);
  readonly disabledWith = input<(option: T) => boolean>(() => false);
  readonly value = input<string | undefined>(undefined);

  private readonly formDisabled = signal(false);
  isDisabled = computed(() => this.disabled() || this.formDisabled());
  readonly isDataDriven = computed(() => this.options().length > 0);

  internalValue = signal<string | null>(null);
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

  getDisplayValue(option: T): string {
    const fn = this.displayWith();
    return typeof fn === 'function' ? fn(option) : String(option);
  }

  getValue(option: T): string {
    const attr = this.valueAttribute();
    if (attr) {
      return String((option as Record<string, unknown>)[attr]);
    }
    return String(option);
  }

  isOptionDisabled(option: T): boolean {
    return this.disabledWith()(option);
  }

  selectValue(val: string): void {
    if (this.isDisabled()) return;
    this.internalValue.set(val);
    this.onChange(val);
    this.valueChange.emit(val);
    this.onTouched();
  }

  writeValue(value: string): void {
    this.internalValue.set(value);
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
