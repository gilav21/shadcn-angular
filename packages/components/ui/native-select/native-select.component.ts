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

  /** Extra classes merged onto the inner `<select>`, not onto the positioning wrapper that holds the chevron. */
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
  /** Control height, applied as `data-size` on the `<select>` and styled from the component stylesheet. */
  size = input<'sm' | 'default'>('default');
  /**
   * Disables the select. OR-ed with the state pushed by
   * {@link setDisabledState}, so a reactive-forms `disable()` also wins; the
   * wrapper is dimmed either way.
   */
  disabled = input(false);
  /** Marks the control invalid: adds the destructive ring/border and sets `aria-invalid` (omitted entirely when `false`). */
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

  /** Reads the newly picked option's value off the native `change` event, stores it and notifies the form. Touched is raised separately on blur. */
  onSelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.innerValue.set(value);
    this.onChange(value);
  }

  /** Pushes a form value into the `<select>`, coercing `null`/`undefined` to `''` so it falls back to the empty/placeholder option. */
  writeValue(value: string): void {
    this.innerValue.set(value ?? '');
  }

  /** Stores the form's change callback, invoked from {@link onSelectChange}. */
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  /** Stores the form's touched callback, which the template invokes on the `<select>`'s blur. */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** Records the form's disabled state separately from the {@link disabled} input; either one disables the select. */
  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }
}
