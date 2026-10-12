import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  ElementRef,
  ViewChild,
  model,
  forwardRef,
  effect,
  untracked,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { INPUT_OTP_LOCALES, type InputOtpLocale } from './input-otp.locales';

/** Slot count used when {@link InputOTPComponent.maxLength} is left unset. */
const DEFAULT_OTP_LENGTH = 6;

/** What a user may type: alphanumerics, upper-cased, cut to the slot count. */
function sanitizeCode(text: string, slotCount: number): string {
  return text.replaceAll(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, slotCount);
}

/**
 * One-time-code field: a row of slots drawn over a single visually hidden text
 * input that does all the real editing.
 *
 * The row is pinned `dir="ltr"`, like `ui-time-picker`: a code is a digit or
 * Latin run, which the bidi algorithm lays out left to right in every script,
 * so in an RTL page it still reads `123456` from left to right and the
 * Left/Right arrows move the highlight left/right on screen.
 */
@Component({
  selector: 'ui-input-otp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => InputOTPComponent), multi: true },
  ],
  template: `
    <div
      dir="ltr"
      [class]="containerClasses()"
      [attr.data-slot]="'input-otp'"
    >
      @for (i of slots(); track i; let idx = $index) {
        <div
          [class]="slotClasses(idx)"
          [attr.data-slot]="'input-otp-slot'"
          [attr.data-active]="activeIndex() === idx ? 'true' : null"
          aria-hidden="true"
          (mousedown)="$event.preventDefault()"
          (click)="focusSlot(idx)"
        >
          <span class="text-center">{{ getValue(idx) }}</span>
          @if (activeIndex() === idx && !getValue(idx)) {
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div class="h-4 w-px animate-caret-blink bg-foreground"></div>
            </div>
          }
        </div>
        @if (separatorAfter().includes(idx)) {
          <div class="flex items-center px-1" aria-hidden="true">
            <div class="h-1 w-1 rounded-full bg-muted-foreground"></div>
          </div>
        }
      }
      <input
        #hiddenInput
        type="text"
        inputmode="numeric"
        [attr.maxlength]="slotCount()"
        [value]="value()"
        [disabled]="isDisabled()"
        [attr.aria-label]="resolvedAriaLabel()"
        [attr.aria-labelledby]="ariaLabelledby()"
        (input)="onInput($event)"
        (compositionend)="onInput()"
        (keydown)="onKeydown($event)"
        (paste)="onPaste($event)"
        (focus)="onFocus()"
        (blur)="onBlur()"
        class="sr-only"
        autocomplete="one-time-code"
      />
    </div>
  `,
  styleUrl: './input-otp.component.css',
  host: { class: 'contents' },
})
export class InputOTPComponent implements ControlValueAccessor {
  @ViewChild('hiddenInput') hiddenInput!: ElementRef<HTMLInputElement>;

  /** Extra classes merged onto the row that holds the slots, not onto an individual slot. */
  class = input('');
  /** `aria-label` for the visually hidden input that actually receives typing. Falls back to the locale's `label` unless {@link ariaLabelledby} names the field instead. */
  ariaLabel = input<string | undefined>(undefined);
  /** `aria-labelledby` for the visually hidden input, when an external element already labels the field. */
  ariaLabelledby = input<string | undefined>(undefined);
  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<InputOtpLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, INPUT_OTP_LOCALES);
  private readonly t = this.i18n.t;
  /**
   * Number of slots rendered, and the hard cap on {@link value}'s length.
   * Accepts `undefined` so a Signal Forms `[field]` binding can push the
   * field's max-length rule in (and push nothing when the schema has none);
   * unset falls back to {@link DEFAULT_OTP_LENGTH} via {@link slotCount}.
   */
  maxLength = input<number | undefined>(DEFAULT_OTP_LENGTH);
  /** Disables the field: the hidden input becomes unfocusable and the row dims. A reactive-forms `disable()` disables it too — see {@link isDisabled}. */
  disabled = input(false);
  /** Zero-based slot indices after which a separator dot is drawn; the flanking slots get rounded outer corners. Default `[2]` splits a 6-digit code into 3+3. */
  separator = input<number[]>([2]);

  /**
   * Two-way code. Typed input is stripped to alphanumerics, upper-cased and
   * truncated to {@link maxLength}, so what is written back may differ from
   * what was typed. A write from a form (`formControlName`, `ngModel`) lands
   * here too and is rendered as-is, without sanitising.
   */
  value = model<string>('');

  private onChange: (value: string) => void = () => { };
  private onTouched: () => void = () => { };
  private readonly formDisabled = signal(false);
  private readonly focused = signal(false);
  /** Slot the next character lands in; mirrors the hidden input's selection start. */
  private readonly caret = signal(0);

  /** Effective disabled state: the {@link disabled} input OR a reactive `control.disable()` relayed through {@link setDisabledState}. */
  readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  /** The hidden input's `aria-label`: an explicit {@link ariaLabel} wins, an {@link ariaLabelledby} suppresses the default, otherwise the locale's `label`. */
  readonly resolvedAriaLabel = computed(() => this.ariaLabel() ?? (this.ariaLabelledby() ? null : this.t().label));

  /** {@link maxLength} with the default applied — every internal length calculation reads this, never the raw input. */
  readonly slotCount = computed(() => this.maxLength() ?? DEFAULT_OTP_LENGTH);

  /** Index of the highlighted slot — the one the next character replaces or fills — or `-1` while the field is not focused. */
  readonly activeIndex = computed(() => (this.focused() ? Math.min(this.caret(), this.slotCount() - 1) : -1));

  slots = computed(() => Array.from({ length: this.slotCount() }, (_, i) => i));
  separatorAfter = computed(() => this.separator());

  containerClasses = computed(() => cn(
    'flex items-center gap-0 has-[:disabled]:opacity-50',
    this.class()
  ));

  slotClasses = (idx: number): string => cn(
    'relative flex items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all cursor-text',
    idx === 0 && 'rounded-l-md border-l',
    idx === this.slotCount() - 1 && 'rounded-r-md',
    this.separatorAfter().includes(idx) && 'rounded-r-md',
    this.separatorAfter().includes(idx - 1) && 'rounded-l-md border-l',
    this.activeIndex() === idx && 'z-10 ring-2 ring-ring',
  );

  constructor() {
    effect(() => {
      const next = this.value();
      untracked(() => this.followExternalValue(next));
    });
  }

  /**
   * A value written from outside (a form `reset()`, a `[(value)]` parent) while
   * the field is focused leaves the browser caret at the end of the text and
   * `caret` pointing at the old slot; this re-aims both at the end of the new
   * code. Edits made here already match the field, so they fall through.
   */
  private followExternalValue(next: string): void {
    const field = this.hiddenInput?.nativeElement;
    if (!field || !this.focused() || field.value === next) return;
    field.value = next;
    this.select(next.length);
  }

  /** Character shown in the slot at `idx`, or `''` when the code is not that long yet. */
  getValue(idx: number): string {
    return this.value()[idx] || '';
  }

  /** Click/tap handler for a slot: focuses the hidden input and puts the caret on that slot, clamped to the end of the code so gaps can't be created. */
  focusSlot(idx: number): void {
    if (this.isDisabled()) return;
    this.hiddenInput.nativeElement.focus();
    this.select(idx);
  }

  /**
   * Moves the hidden input's real selection to `index`, clamped to
   * `[0, min(value.length, slotCount - 1)]`. A slot holding a character is
   * selected, so typing replaces it natively; the first empty slot gets a
   * collapsed caret, so typing fills it. Invariant: the highlighted slot is
   * always where the next character lands.
   */
  private select(index: number): void {
    const length = this.value().length;
    const slot = Math.max(0, Math.min(index, length, this.slotCount() - 1));
    this.caret.set(slot);
    this.hiddenInput.nativeElement.setSelectionRange(slot, slot < length ? slot + 1 : slot);
  }

  /**
   * Reads what native editing produced (typing, Backspace, autofill, dictation),
   * sanitises it, publishes it and re-selects the slot after the edit.
   *
   * Two guards keep the sanitiser from destroying what the user did not mean to
   * remove: an insertion made only of rejected characters is undone (typing
   * `!` over a selected slot must not delete that slot's digit), and nothing is
   * touched while an IME composition is open (moving the selection mid-composition
   * cancels it) — the closing `compositionend` calls this again.
   */
  onInput(event?: Event): void {
    const field = this.hiddenInput.nativeElement;
    if (event instanceof InputEvent && event.isComposing) return;
    if (event instanceof InputEvent && this.isRejectedInsertion(event)) {
      field.value = this.value();
      this.select(this.caret());
      return;
    }
    const raw = field.value;
    const next = sanitizeCode(raw, this.slotCount());
    const caretAfter = sanitizeCode(raw.slice(0, field.selectionStart ?? raw.length), this.slotCount()).length;
    field.value = next;
    if (next !== this.value()) {
      this.commit(next);
    }
    this.select(caretAfter);
  }

  private isRejectedInsertion(event: InputEvent): boolean {
    return event.inputType.startsWith('insert') && !!event.data && !sanitizeCode(event.data, this.slotCount());
  }

  /**
   * A paste replaces the code: the browser's own paste would insert at the
   * selection, which appends to a partial code and does nothing at all in a full
   * field (`maxlength`). Invariant: after a paste the field holds exactly the
   * pasted code, sanitised and cut to the slot count.
   */
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const code = sanitizeCode(event.clipboardData?.getData('text') ?? '', this.slotCount());
    if (!code) return;
    this.hiddenInput.nativeElement.value = code;
    if (code !== this.value()) {
      this.commit(code);
    }
    this.select(code.length);
  }

  /** Arrow keys, Home and End move the highlight (and with it the real selection) between slots; everything else is native editing. */
  onKeydown(event: KeyboardEvent): void {
    const target = this.slotTarget(event.key);
    if (target === null) return;
    event.preventDefault();
    this.select(target);
  }

  private slotTarget(key: string): number | null {
    switch (key) {
      case 'ArrowLeft': return this.caret() - 1;
      case 'ArrowRight': return this.caret() + 1;
      case 'Home': return 0;
      case 'End': return this.value().length;
      default: return null;
    }
  }

  /** Highlights the first empty slot, or the last slot when the code is full, so typing always has a defined target. */
  onFocus(): void {
    this.focused.set(true);
    this.select(this.value().length);
  }

  /** Clears the highlight so no slot appears active, and marks the form control touched. */
  onBlur(): void {
    this.focused.set(false);
    this.onTouched();
  }

  /** The one place a user edit leaves the component: tells the form, then publishes it on {@link value}. */
  private commit(next: string): void {
    this.onChange(next);
    this.value.set(next);
  }

  /**
   * `ControlValueAccessor`: renders a form value as-is — no sanitising, the
   * sanitiser filters user input only. `null` clears. The write reaches
   * {@link value} (so `valueChange` fires when it differs) but never loops back
   * into the form: only {@link commit} calls the registered change callback.
   */
  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  /** `ControlValueAccessor`: the callback receives the sanitised code on every user edit. */
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  /** `ControlValueAccessor`: invoked when the hidden input loses focus. */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** `ControlValueAccessor`: relays `control.disable()` / `enable()` into {@link isDisabled}. */
  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  /** Focuses the field programmatically by focusing the hidden input behind the slots. */
  focus(): void {
    this.hiddenInput?.nativeElement?.focus();
  }
}
