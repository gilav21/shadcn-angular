import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  ElementRef,
  ViewChild,
  model,
} from '@angular/core';
import { cn } from '../../lib/utils';

/** Slot count used when {@link InputOTPComponent.maxLength} is left unset. */
const DEFAULT_OTP_LENGTH = 6;

@Component({
  selector: 'ui-input-otp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="containerClasses()"
      [attr.data-slot]="'input-otp'"
      (keydown)="onKeydown($event)"
      tabindex="-1"
    >
      @for (i of slots(); track i; let idx = $index) {
        <div
          [class]="slotClasses(idx)"
          [attr.data-slot]="'input-otp-slot'"
          (click)="focusSlot(idx)"
          (keydown.enter)="focusSlot(idx)"
          tabindex="0"
          role="button"
          [attr.aria-label]="'Digit ' + (idx + 1)"
        >
          <span class="text-center">{{ getValue(idx) }}</span>
          @if (focusedIndex() === idx && !getValue(idx)) {
            <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div class="h-4 w-px animate-caret-blink bg-foreground"></div>
            </div>
          }
        </div>
        @if (separatorAfter().includes(idx)) {
          <div class="flex items-center px-1">
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
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="ariaLabelledby()"
        (input)="onInput($event)"
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
export class InputOTPComponent {
  @ViewChild('hiddenInput') hiddenInput!: ElementRef<HTMLInputElement>;

  /** Extra classes merged onto the row that holds the slots, not onto an individual slot. */
  class = input('');
  /** `aria-label` for the visually hidden input that actually receives typing — without it or {@link ariaLabelledby} the field is unnamed. */
  ariaLabel = input<string | undefined>(undefined);
  /** `aria-labelledby` for the visually hidden input, when an external element already labels the field. */
  ariaLabelledby = input<string | undefined>(undefined);
  /**
   * Number of slots rendered, and the hard cap on {@link value}'s length.
   * Accepts `undefined` so a Signal Forms `[field]` binding can push the
   * field's max-length rule in (and push nothing when the schema has none);
   * unset falls back to {@link DEFAULT_OTP_LENGTH} via {@link slotCount}.
   */
  maxLength = input<number | undefined>(DEFAULT_OTP_LENGTH);
  /** Zero-based slot indices after which a separator dot is drawn; the flanking slots get rounded outer corners. Default `[2]` splits a 6-digit code into 3+3. */
  separator = input<number[]>([2]);

  /** Two-way code. Typed input is stripped to alphanumerics, upper-cased and truncated to {@link maxLength}, so what is written back may differ from what was typed. */
  value = model<string>('');
  focusedIndex = signal(-1);

  /** {@link maxLength} with the default applied — every internal length calculation reads this, never the raw input. */
  readonly slotCount = computed(() => this.maxLength() ?? DEFAULT_OTP_LENGTH);

  slots = computed(() => Array.from({ length: this.slotCount() }, (_, i) => i));
  separatorAfter = computed(() => this.separator());

  containerClasses = computed(() => cn(
    'flex items-center gap-0 has-[:disabled]:opacity-50',
    this.class()
  ));

  slotClasses = (idx: number): string => cn(
    'relative flex items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all cursor-text',
    idx === 0 && 'ltr:rounded-l-md rtl:rounded-r-md ltr:border-l rtl:border-r',
    idx === this.slotCount() - 1 && 'ltr:rounded-r-md rtl:rounded-l-md ltr:border-r rtl:border-l',
    this.separatorAfter().includes(idx) && 'ltr:rounded-r-md rtl:rounded-l-md ltr:border-r rtl:border-l',
    this.separatorAfter().includes(idx - 1) && 'ltr:rounded-l-md rtl:rounded-r-md ltr:border-l rtl:border-r',
    this.focusedIndex() === idx && 'z-10 ring-2 ring-ring',
  );

  /** Character shown in the slot at `idx`, or `''` when the code is not that long yet. */
  getValue(idx: number): string {
    return this.value()[idx] || '';
  }

  /** Click/Enter handler for a slot: focuses the hidden input and moves the caret there, clamped to the end of the code so gaps can't be created. */
  focusSlot(idx: number): void {
    this.hiddenInput?.nativeElement?.focus();
    this.focusedIndex.set(Math.min(idx, this.value().length));
  }

  /** Sanitizes typed or pasted text (alphanumerics only, upper-cased, truncated to {@link maxLength}), publishes it, advances the caret and writes the cleaned text back to the hidden input. */
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newValue = input.value.replaceAll(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, this.slotCount());
    this.value.set(newValue);
    this.focusedIndex.set(Math.min(newValue.length, this.slotCount() - 1));
    input.value = newValue;
  }


  /** Arrow keys move the caret between slots; Backspace drops the last character regardless of caret position. All three suppress the browser default. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focusedIndex.update(i => Math.max(0, i - 1));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusedIndex.update(i => Math.min(this.value().length, i + 1));
    } else if (event.key === 'Backspace') {
      const currentValue = this.value();
      if (currentValue.length > 0) {
        const newValue = currentValue.slice(0, -1);
        this.value.set(newValue);
        this.focusedIndex.set(newValue.length);
        if (this.hiddenInput?.nativeElement) {
          this.hiddenInput.nativeElement.value = newValue;
        }
      }
      event.preventDefault();
    }
  }


  /** Puts the blinking caret on the first empty slot when the hidden input gains focus. */
  onFocus(): void {
    this.focusedIndex.set(this.value().length);
  }

  /** Clears the caret highlight on blur so no slot appears active. */
  onBlur(): void {
    this.focusedIndex.set(-1);
  }

  /** Focuses the field programmatically by focusing the hidden input behind the slots. */
  focus(): void {
    this.hiddenInput?.nativeElement?.focus();
  }
}
