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
import { cn } from '../../lib/utils';
import { BadgeComponent, type BadgeVariant } from '../badge';
import { ButtonComponent } from '../button';
import { InputComponent } from '../input';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';
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
  templateUrl: './chip-list.component.html',
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

  chipColors = input<Record<string, string>>({});
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
      const removed = this.chips().at(-1)!;
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

  setDisabledState(_isDisabled: boolean): void { /* ControlValueAccessor - no-op: disabled state managed by input */ }
}
