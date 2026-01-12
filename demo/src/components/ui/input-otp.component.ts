import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  ElementRef,
  ViewChild,
  forwardRef,
  ContentChildren,
  QueryList,
  AfterContentInit,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
  selector: 'ui-input-otp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      [class]="containerClasses()" 
      [attr.data-slot]="'input-otp'"
      (keydown)="onKeydown($event)"
    >
      @for (i of slots(); track i; let idx = $index) {
        <div 
          [class]="slotClasses(idx)"
          (click)="focusSlot(idx)"
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
        [attr.maxlength]="maxLength()"
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
  host: { class: 'contents' },
})
export class InputOTPComponent {
  @ViewChild('hiddenInput') hiddenInput!: ElementRef<HTMLInputElement>;

  class = input('');
  ariaLabel = input<string | undefined>(undefined);
  ariaLabelledby = input<string | undefined>(undefined);
  maxLength = input(6);
  separator = input<number[]>([2]); // indices after which to show separator (default: after 3rd slot for 6-digit OTP)

  value = signal('');
  valueChange = output<string>();
  focusedIndex = signal(-1);

  slots = computed(() => Array.from({ length: this.maxLength() }, (_, i) => i));
  separatorAfter = computed(() => this.separator());

  containerClasses = computed(() => cn(
    'flex items-center gap-0 has-[:disabled]:opacity-50',
    this.class()
  ));

  slotClasses = (idx: number) => cn(
    'relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all cursor-text',
    idx === 0 && 'ltr:rounded-l-md rtl:rounded-r-md ltr:border-l rtl:border-r',
    idx === this.maxLength() - 1 && 'ltr:rounded-r-md rtl:rounded-l-md ltr:border-r rtl:border-l',
    this.separatorAfter().includes(idx) && 'ltr:rounded-r-md rtl:rounded-l-md ltr:border-r rtl:border-l',
    this.separatorAfter().includes(idx - 1) && 'ltr:rounded-l-md rtl:rounded-r-md ltr:border-l rtl:border-r',
    this.focusedIndex() === idx && 'z-10 ring-2 ring-ring',
  );

  getValue(idx: number): string {
    return this.value()[idx] || '';
  }

  focusSlot(idx: number) {
    this.hiddenInput?.nativeElement?.focus();
    this.focusedIndex.set(Math.min(idx, this.value().length));
  }

  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    // Allow alphanumeric characters (letters and numbers)
    const newValue = input.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, this.maxLength());
    this.value.set(newValue);
    this.valueChange.emit(newValue);
    this.focusedIndex.set(Math.min(newValue.length, this.maxLength() - 1));
    // Sync hidden input value
    input.value = newValue;
  }


  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focusedIndex.update(i => Math.max(0, i - 1));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusedIndex.update(i => Math.min(this.value().length, i + 1));
    } else if (event.key === 'Backspace') {
      // Handle backspace - delete last character
      const currentValue = this.value();
      if (currentValue.length > 0) {
        const newValue = currentValue.slice(0, -1);
        this.value.set(newValue);
        this.valueChange.emit(newValue);
        this.focusedIndex.set(newValue.length);
        // Also update the hidden input
        if (this.hiddenInput?.nativeElement) {
          this.hiddenInput.nativeElement.value = newValue;
        }
      }
      event.preventDefault();
    }
  }


  onFocus() {
    this.focusedIndex.set(this.value().length);
  }

  onBlur() {
    this.focusedIndex.set(-1);
  }

  focus() {
    this.hiddenInput?.nativeElement?.focus();
  }
}

// Keep these for backwards compatibility, but they're not needed with the new design
@Component({
  selector: 'ui-input-otp-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  host: { class: 'hidden' },
})
export class InputOTPGroupComponent { }

@Component({
  selector: 'ui-input-otp-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  host: { class: 'hidden' },
})
export class InputOTPSlotComponent {
  index = input(0);
}

@Component({
  selector: 'ui-input-otp-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
  host: { class: 'hidden' },
})
export class InputOTPSeparatorComponent { }
