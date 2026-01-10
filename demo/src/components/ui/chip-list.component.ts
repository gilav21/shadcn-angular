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
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const chipVariants = cva(
    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
                secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
                destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
                outline: 'border-input text-foreground hover:bg-accent hover:text-accent-foreground',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
);

export type ChipVariant = VariantProps<typeof chipVariants>['variant'];

/**
 * ChipListComponent - An input that converts text into chips on Enter
 * 
 * Features:
 * - Type text and press Enter to add as a chip
 * - Click the X on a chip to remove it
 * - Backspace on empty input removes the last chip
 * - Configurable max rows before scrolling
 * - Works with Angular reactive forms
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
          <span
            [class]="chipClasses()"
            [attr.data-slot]="'chip'"
          >
            <span class="max-w-[200px] truncate">{{ chip }}</span>
            @if (!disabled()) {
              <button
                type="button"
                class="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-ring"
                [attr.aria-label]="'Remove ' + chip"
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
              </button>
            }
          </span>
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
    // Inputs
    placeholder = input('Add item...');
    disabled = input(false);
    variant = input<ChipVariant>('default');
    class = input('');

    /** Maximum number of visible rows before scrolling. Set to 0 for unlimited. */
    maxRows = input(0);

    /** Allow duplicate chips */
    allowDuplicates = input(false);

    /** Separator keys that also add chips (in addition to Enter) */
    separatorKeys = input<string[]>([]);

    // Outputs
    chipAdded = output<string>();
    chipRemoved = output<string>();

    // State
    chips = signal<string[]>([]);
    inputValue = signal('');

    // View child
    inputElement = viewChild<ElementRef<HTMLInputElement>>('inputElement');

    // CVA
    private onChange: (value: string[]) => void = () => { };
    private onTouched: () => void = () => { };

    // Computed styles
    containerClasses = computed(() => cn(
        'w-full rounded-lg border border-input bg-transparent',
        'transition-colors',
        'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        'overflow-y-auto',
        this.disabled() && 'opacity-50 cursor-not-allowed',
        this.maxRows() > 0 && 'overflow-y-auto',
        this.class()
    ));

    chipClasses = computed(() => cn(
        chipVariants({ variant: this.variant() }),
        'shrink-0'
    ));

    inputClasses = computed(() => cn(
        'flex-1 min-w-[80px] bg-transparent border-none outline-none',
        'text-sm placeholder:text-muted-foreground',
        'py-1 px-1',
        this.disabled() && 'cursor-not-allowed'
    ));

    /** Calculate max height based on maxRows. Each row is ~32px (chip height + gap) */
    maxHeightStyle = computed(() => {
        const rows = this.maxRows();
        if (rows <= 0) return 'none';
        // ~36px per row (chip height ~28px + gap ~8px + padding)
        const heightPx = rows * 36 + 8; // +8 for container padding
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

        // Check if this key should add a chip
        if (event.key === 'Enter' || separators.includes(event.key)) {
            event.preventDefault();
            if (value) {
                this.addChip(value);
            }
            return;
        }

        // Backspace on empty input removes last chip
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

        // Check for duplicates
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
        // Keep focus on input
        this.focusInput();
    }

    onBlur() {
        this.onTouched();
    }

    // ControlValueAccessor implementation
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

export { chipVariants };
