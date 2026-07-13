import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  forwardRef,
  inject,
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
  host: {
    class: 'contents',
    '[attr.aria-label]': 'null',
  },
})
export class NativeSelectComponent implements ControlValueAccessor {
  @ViewChild('select') selectEl!: ElementRef<HTMLSelectElement>;

  class = input('');
  /** Accessible name, camelCase form: `[ariaLabel]="'Country'"`. */
  readonly ariaLabel = input<string | undefined>(undefined);
  /**
   * An accessible name written the native way — `aria-label="Country"`. The host is
   * a `display: contents` wrapper, so an aria-label left on it never reaches the
   * inner `<select>`, which stayed nameless (axe `select-name`). Read off the host
   * here and moved to the real control (the host binding above strips it).
   */
  private readonly hostAriaLabel =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.getAttribute('aria-label') ?? undefined;
  /** The name actually applied to the inner `<select>`, from either spelling. */
  readonly resolvedAriaLabel = computed(() => this.ariaLabel() ?? this.hostAriaLabel);
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
    'w-full min-w-0 appearance-none rounded-md border bg-transparent px-3 pr-9 rtl:pr-3 rtl:pl-9 text-sm shadow-xs',
    'transition-[color,box-shadow] outline-none',
    'disabled:pointer-events-none disabled:cursor-not-allowed',
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
