import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
  ElementRef,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../lib/utils';
import { BadgeComponent, type BadgeVariant } from './badge.component';
import { ButtonComponent } from './button.component';

/**
 * ChipListComponent - An input that converts text into chips on Enter
 * 
 * Features:
 * - Type text and press Enter to add as a chip
 * - Click the X on a chip to remove it
 * - Backspace on empty input removes the last chip
 * - Configurable max rows before scrolling
 * - Works with Angular reactive forms
 * - Uses existing Badge and Button components for consistency
 * 
 * Usage:
 * <ui-chip-list 
 *   [(ngModel)]="tags" 
 *   placeholder="Add tag..."
 *   [maxRows]="3"
 * />
 */
@Component({
  selector: 'ui-chip-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ChipListComponent),
      multi: true,
    },
  ],
  template: `
    <div
      [class]="containerClasses()"
      [style.max-height]="maxHeightStyle()"
      [attr.data-slot]="'chip-list'"
      [attr.data-disabled]="disabled() || null"
      (click)="focusInput()"
    >
      <div class="flex flex-wrap items-center gap-1.5 p-1">
        @for (chip of chips(); track chip; let i = $index) {
          <ui-badge 
            [variant]="variant()" 
            [class]="'shrink-0 gap-1' + (disabled() ? '' : ' ltr:pr-1 rtl:pl-1')"
            [attr.data-slot]="'chip'"
          >
            <span class="max-w-[200px] truncate">{{ chip }}</span>
            @if (!disabled()) {
              <ui-button
                variant="ghost"
                size="icon"
                class="h-4 w-4 p-0 hover:bg-black/10 dark:hover:bg-white/10 rounded-full"
                [ariaLabel]="'Remove ' + chip"
                (click)="removeChip(i, $event)"
              >
                <svg
                  class="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </ui-button>
            }
          </ui-badge>
        }
        @if (!disabled()) {
          <input
            #inputElement
            type="text"
            [class]="inputClasses()"
            [placeholder]="chips().length === 0 ? placeholder() : ''"
            [disabled]="disabled()"
            [value]="inputValue()"
            (input)="onInput($event)"
            (keydown)="onKeyDown($event)"
            (blur)="onBlur()"
            [attr.data-slot]="'chip-input'"
          />
        }
      </div>
    </div>
  `,
  host: {
    '[class]': '"contents"',
  },
})
export class ChipListComponent implements ControlValueAccessor {
  placeholder = input('Add item...');
  disabled = input(false);
  variant = input<BadgeVariant>('default');
  class = input('');

  maxRows = input(0);
  allowDuplicates = input(false);
  separatorKeys = input<string[]>([]);

  chipAdded = output<string>();
  chipRemoved = output<string>();

  chips = signal<string[]>([]);
  inputValue = signal('');

  inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');

  private onChange: (value: string[]) => void = () => { };
  private onTouched: () => void = () => { };

  containerClasses = computed(() => cn(
    'w-full rounded-lg border border-input bg-transparent',
    'transition-colors',
    'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
    this.disabled() && 'opacity-50 cursor-not-allowed',
    this.maxRows() > 0 && 'overflow-y-auto',
    this.class()
  ));

  inputClasses = computed(() => cn(
    'flex-1 min-w-[80px] bg-transparent border-none outline-none',
    'text-sm placeholder:text-muted-foreground',
    'py-1 px-1',
    this.disabled() && 'cursor-not-allowed'
  ));

  maxHeightStyle = computed(() => {
    const rows = this.maxRows();
    if (rows <= 0) return 'none';
    const heightPx = rows * 36 + 8;
    return `${heightPx}px`;
  });

  focusInput() {
    if (this.disabled()) return;
    this.inputElement()?.nativeElement?.focus();
  }

  onInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.inputValue.set(target.value);
  }

  onKeyDown(event: KeyboardEvent) {
    const value = this.inputValue().trim();
    const separators = this.separatorKeys();

    if (event.key === 'Enter' || separators.includes(event.key)) {
      event.preventDefault();
      if (value) {
        this.addChip(value);
      }
      return;
    }

    if (event.key === 'Backspace' && this.inputValue() === '' && this.chips().length > 0) {
      const removed = this.chips()[this.chips().length - 1];
      this.chips.update(chips => chips.slice(0, -1));
      this.onChange(this.chips());
      this.chipRemoved.emit(removed);
    }
  }

  addChip(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (!this.allowDuplicates() && this.chips().includes(trimmed)) {
      this.inputValue.set('');
      return;
    }

    this.chips.update(chips => [...chips, trimmed]);
    this.inputValue.set('');
    this.onChange(this.chips());
    this.chipAdded.emit(trimmed);
  }

  removeChip(index: number, event: Event) {
    event.stopPropagation();
    const removed = this.chips()[index];
    this.chips.update(chips => chips.filter((_, i) => i !== index));
    this.onChange(this.chips());
    this.chipRemoved.emit(removed);
    this.focusInput();
  }

  onBlur() {
    this.onTouched();
  }

  writeValue(value: string[]): void {
    this.chips.set(value ?? []);
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void { }
}
