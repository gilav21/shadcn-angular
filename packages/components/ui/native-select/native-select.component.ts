import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  forwardRef,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';

/**
 * NativeSelect - Styled native select element
 * 
 * Usage:
 * <ui-native-select>
 *   <option value="">Select an option</option>
 *   <option value="1">Option 1</option>
 *   <option value="2">Option 2</option>
 * </ui-native-select>
 */
@Component({
  selector: 'ui-native-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NativeSelectComponent),
      multi: true,
    },
  ],
  templateUrl: './native-select.component.html',
  styleUrl: './native-select.component.css',
  host: { class: 'contents' },
})
export class NativeSelectComponent implements ControlValueAccessor {
  @ViewChild('select') selectEl!: ElementRef<HTMLSelectElement>;

  class = input('');
  size = input<'sm' | 'default'>('default');
  disabled = input(false);
  invalid = input(false);

  protected innerValue = signal('');

  private readonly formDisabled = signal(false);
  isDisabled = computed(() => this.disabled() || this.formDisabled());
  onChange: (value: string) => void = () => { };
  onTouched: () => void = () => { };

  classes = computed(() => cn(
    'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
    'h-9 w-full min-w-0 appearance-none rounded-md border bg-transparent px-3 py-2 pr-9 rtl:pr-3 rtl:pl-9 text-sm shadow-xs',
    'transition-[color,box-shadow] outline-none',
    'disabled:pointer-events-none disabled:cursor-not-allowed',
    this.size() === 'sm' && 'h-8 py-1',
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    this.invalid() && 'ring-destructive/20 border-destructive',
    this.class()
  ));

  onSelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.innerValue.set(value);
    this.onChange(value);
  }

  writeValue(value: string): void {
    this.innerValue.set(value ?? '');
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
