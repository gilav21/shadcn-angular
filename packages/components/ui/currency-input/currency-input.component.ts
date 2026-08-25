import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cva } from 'class-variance-authority';
import { UI_LOCALE_ID } from '../../lib/i18n';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';
import { cn } from '../../lib/utils';
import { InputComponent } from '../input';
import {
  currencyScale,
  formatCurrency,
  formatEditable,
  parseCurrency,
  roundToCurrency,
  toMinorUnits,
} from './currency-input.format';

const currencyInputWrapperVariants = cva(
  'relative flex items-center border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] aria-disabled:pointer-events-none aria-disabled:opacity-50',
  {
    variants: {
      variant: {
        outline: 'dark:bg-input/30 rounded-lg border',
        underline: 'rounded-none border-b border-x-0 border-t-0 shadow-none focus-within:ring-0',
        ghost: 'border-none shadow-none focus-within:ring-0',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
);

export type CurrencyInputVariant = 'outline' | 'underline' | 'ghost';

/**
 * An amount of money, written the way the reader's locale writes it.
 *
 * ### The value is major units
 *
 * `12.34` means twelve dollars thirty-four, not 1234 cents. Integer minor
 * units cannot drift and would be the safer type in isolation — but a
 * consumer binding `[(value)]` to a field their API calls `price` would get
 * `1234` where they expect `12.34` and divide by 100 by hand, reintroducing
 * the float in their code without the rounding this control does. Surprise
 * costs more than the drift.
 *
 * The drift is bounded instead of ignored: {@link CurrencyInputComponent.onBlur}
 * rounds to the currency's own scale, so an amount can never carry more
 * precision than the currency has — which is where accumulated float error
 * becomes visible. {@link minorUnits} is there for consumers who want the
 * integer.
 *
 * ### Formatting happens at rest, never mid-keystroke
 *
 * While the field has focus it shows a plain editable number; on blur it shows
 * the locale's full formatting. Reformatting as someone types moves the caret
 * out from under them.
 *
 * See `specs/form-controls-small-spec.md` §3.2 and §3.6.
 *
 * ### Focus is watched on the wrapper, not the field
 *
 * The bubbling focusin/focusout pair is used rather than focus/blur. The inner
 * field is inside `ui-input`, which declares no outputs, so a blur binding on
 * it would attach the native DOM event to the host element — and focus and
 * blur do not bubble, so an event raised on the real field never arrives.
 *
 * ### The field asks for a numeric keypad without being a number field
 *
 * A number field refuses a comma, which is the decimal separator across most
 * of Europe, and strips the formatting this control exists to show. Declaring
 * the input mode gives the keypad without any of the rest.
 */
@Component({
  selector: 'ui-currency-input',
  exportAs: 'uiCurrencyInput',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputComponent, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyInputComponent),
      multi: true,
    },
    {
      provide: UI_INPUT_GROUP,
      useExisting: forwardRef(() => CurrencyInputComponent),
    },
  ],
  templateUrl: './currency-input.component.html',
  styleUrl: './currency-input.component.css',
  host: { class: 'contents' },
})
export class CurrencyInputComponent implements ControlValueAccessor {
  /**
   * The amount, in major units. `null` shows the placeholder.
   *
   * A `model()` named exactly `value` is what makes this a valid Signal Forms
   * `FormValueControl`, and it doubles as the `valueChange` output. A write
   * from outside stays silent; only a user edit emits.
   */
  readonly value = model<number | null>(null);

  /** ISO 4217 code. Drives the symbol, the decimal places and the parsing. */
  readonly currency = input<string>('USD');
  /** BCP-47 tag. Falls back to the app-wide `UI_LOCALE_ID`. */
  readonly locale = input<string>();
  /** Lower bound, enforced on blur so typing is never interrupted. */
  readonly min = input<number | undefined>(undefined);
  /** Upper bound, enforced on blur. */
  readonly max = input<number | undefined>(undefined);
  /** OR-ed with the state a reactive form pushes via `setDisabledState`. */
  readonly disabled = input<boolean>(false);
  /** Shown while the value is `null`. */
  readonly placeholder = input<string>('');
  /** Accessible name for the field. */
  readonly ariaLabel = input<string>('Amount');
  /** Extra classes for the wrapper, not the inner `<input>`. */
  readonly class = input('');
  /** Visual style of the wrapper: `outline`, `underline` or `ghost`. */
  readonly variant = input<CurrencyInputVariant>('outline');

  private readonly globalLocale = inject(UI_LOCALE_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly resolvedLocale = computed(() => this.locale() ?? this.globalLocale());

  /** Decimal places this currency has: 2 for USD, 0 for JPY, 3 for KWD. */
  readonly scale = computed(() =>
    currencyScale(this.resolvedLocale(), this.currency()),
  );

  /** The amount in cents, sen or fils, for consumers who want the integer. */
  readonly minorUnits = computed(() => {
    const current = this._currentValue();
    return current === null
      ? null
      : toMinorUnits(current, this.resolvedLocale(), this.currency());
  });

  private readonly inputRef = viewChild.required<InputComponent>('inputRef');

  /**
   * What is rendered, kept apart from {@link value}.
   *
   * This split is the feedback-loop defence: a form writing in must not look
   * like a user typing. `writeValue` touches only this.
   */
  private readonly _currentValue = signal<number | null>(null);
  private readonly _formDisabled = signal(false);
  private readonly _focused = signal(false);
  /** What the person actually typed, held while the field has focus. */
  private readonly _editing = signal<string | null>(null);

  readonly isDisabled = computed(() => this.disabled() || this._formDisabled());

  /**
   * Plain while editing, fully formatted at rest.
   *
   * While focused this deliberately echoes the raw text rather than a
   * reformatting of it, so a half-typed `1.` survives to become `1.5`.
   */
  readonly displayValue = computed(() => {
    if (this._focused()) return this._editing() ?? '';

    const current = this._currentValue();
    if (current === null) return '';
    return formatCurrency(current, this.resolvedLocale(), this.currency());
  });

  readonly wrapperClasses = computed(() =>
    cn(currencyInputWrapperVariants({ variant: this.variant() }), this.class()),
  );

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      const next = this.value();
      /*
       * A programmatic write while someone is typing does not yank the field
       * out from under them — §2.2, "must not fight the user". The value is
       * still recorded; only the visible text is left alone until blur.
       */
      this._currentValue.set(next);
    });
    this.destroyRef.onDestroy(() => this._editing.set(null));
  }

  /** Parses what was typed and publishes it, without rounding or clamping. */
  onInputChange(raw: string): void {
    this._editing.set(raw);
    this.commit(parseCurrency(raw, this.resolvedLocale(), this.currency()));
  }

  onFocus(): void {
    this._focused.set(true);
    const current = this._currentValue();
    this._editing.set(
      current === null ? '' : formatEditable(current, this.resolvedLocale(), this.currency()),
    );
  }

  /**
   * Editing is over: round to the currency's scale, clamp, and reformat.
   *
   * All three wait for blur. Rounding `12.345` to `12.35` while someone is
   * still typing takes the field away from them.
   */
  onBlur(): void {
    this._focused.set(false);
    this._editing.set(null);

    const current = this._currentValue();
    if (current !== null) {
      const settled = this.clamp(
        roundToCurrency(current, this.resolvedLocale(), this.currency()),
      );
      if (settled !== current) this.commit(settled);
    }
    this.onTouched();
  }

  /** Renders a form value as-is — no rounding, no clamping, no emit. */
  writeValue(value: number | null): void {
    this._currentValue.set(value);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** Kept apart from the {@link disabled} input; either one disables. */
  setDisabledState(isDisabled: boolean): void {
    this._formDisabled.set(isDisabled);
  }

  focus(): void {
    this.inputRef().focus();
  }

  private clamp(value: number): number {
    const low = this.min();
    const high = this.max();
    let result = value;
    if (low !== undefined) result = Math.max(result, low);
    if (high !== undefined) result = Math.min(result, high);
    return result;
  }

  /**
   * The one path a user-driven change takes: store it, tell the form, then
   * publish through {@link value}, which emits `valueChange` exactly once.
   */
  private commit(value: number | null): void {
    this._currentValue.set(value);
    this.onChange(value);
    this.value.set(value);
  }
}
