import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { cn } from '../lib/utils';
import { BadgeComponent, type BadgeVariant } from './badge.component';
import { ButtonComponent } from './button.component';
import { InputComponent } from './input.component';
import { UI_INPUT_GROUP } from './input-group.token';
import { cva, type VariantProps } from 'class-variance-authority';

const chipListVariants = cva(
  'w-full flex-wrap flex items-center gap-1.5 p-1 transition-[color,box-shadow] outline-none min-h-9 has-[input:focus-visible]:ring-[3px]',
  {
    variants: {
      variant: {
        outline: 'rounded-md border border-input shadow-xs has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50',
        underline: 'rounded-none border-b border-input has-[input:focus-visible]:border-ring px-0 has-[input:focus-visible]:ring-0',
        ghost: 'border-none shadow-none has-[input:focus-visible]:ring-0',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  }
);

export type ChipListVariant = VariantProps<typeof chipListVariants>['variant'];

@Component({
  selector: 'ui-chip-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonComponent, InputComponent, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ChipListComponent),
      multi: true,
    },
    { provide: UI_INPUT_GROUP, useExisting: forwardRef(() => ChipListComponent) }
  ],
  template: `
    <div
      [class]="containerClasses()"
      [style.max-height]="maxHeightStyle()"
      [attr.data-slot]="'chip-list'"
      [attr.data-disabled]="disabled() || null"
      (click)="focusInput()"
    >
      @for (chip of chips(); track chip; let i = $index) {
        <ui-badge 
          [variant]="badgeVariant()" 
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
      
      <ui-input
        #inputRef
        [placeholder]="chips().length === 0 ? placeholder() : ''"
        [disabled]="disabled()"
        [ngModel]="inputValue()"
        (ngModelChange)="onInputChange($event)"
        (keydown)="onKeyDown($event)"
        (blur)="onBlur()"
        class="flex-1 min-w-[80px] bg-transparent border-none outline-none shadow-none focus-visible:ring-0 p-0 h-auto"
        variant="ghost"
      />
    </div>
  `,
  host: {
    '[class]': '"contents"',
  },
})
export class ChipListComponent implements ControlValueAccessor {
  placeholder = input('Add item...');
  disabled = input(false);
  variant = input<ChipListVariant>('outline');
  badgeVariant = input<BadgeVariant>('default');
  class = input('');

  maxRows = input(0);
  allowDuplicates = input(false);
  separatorKeys = input<string[]>([]);

  chipAdded = output<string>();
  chipRemoved = output<string>();

  chips = signal<string[]>([]);
  inputValue = signal('');

  inputComponent = viewChild.required(InputComponent);

  private onChange: (value: string[]) => void = () => { };
  private onTouched: () => void = () => { };

  containerClasses = computed(() => cn(
    chipListVariants({ variant: this.variant() }),
    this.disabled() && 'opacity-50 cursor-not-allowed',
    this.maxRows() > 0 && 'overflow-y-auto',
    this.class()
  ));

  maxHeightStyle = computed(() => {
    const rows = this.maxRows();
    if (rows <= 0) return 'none';
    const heightPx = rows * 36 + 8;
    return `${heightPx}px`;
  });

  focusInput() {
    if (this.disabled()) return;
    this.inputComponent().focus();
  }

  onInputChange(value: string) {
    this.inputValue.set(value);
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

    // Maintain focus on input after removal
    setTimeout(() => this.focusInput());
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
