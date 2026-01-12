import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
  effect,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../lib/utils';
import { CalendarComponent, DateRange } from './calendar.component';

/**
 * DatePickerComponent - A date selection component combining Popover and Calendar
 * 
 * Usage:
 * <ui-date-picker [(date)]="selectedDate" placeholder="Select a date" />
 * <ui-date-picker [showTime]="true" placeholder="Pick date & time" />
 * 
 * Or with reactive forms:
 * <ui-date-picker formControlName="birthDate" />
 */
@Component({
  selector: 'ui-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
  template: `
    <div class="relative" [attr.data-slot]="'date-picker'">
      <button
        type="button"
        [class]="buttonClasses()"
        [disabled]="disabled()"
        (click)="toggleOpen()"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-haspopup]="'dialog'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ltr:mr-2 rtl:ml-2 h-4 w-4">
          <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>
        </svg>
        @if (internalValue()) {
          <span>{{ formatDate(internalValue()!) }}</span>
        } @else {
          <span class="text-muted-foreground">{{ placeholder() }}</span>
        }
      </button>
      
      @if (isOpen()) {
        <div 
          class="absolute ltr:left-0 rtl:right-0 top-full z-50 mt-1 rounded-md border bg-popover p-0 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          (click)="$event.stopPropagation()"
        >
          <ui-calendar
            mode="single"
            [selected]="internalValue()"
            [showTimeSelect]="showTime()"
            [showMonthSelect]="true"
            [showYearSelect]="true"
            [locale]="locale()"
            (selectedChange)="onDateSelect($event)"
          />
        </div>
      }
    </div>
  `,
  host: {
    class: 'contents',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class DatePickerComponent implements ControlValueAccessor {
  class = input('');
  placeholder = input('Pick a date');
  disabled = input(false);
  showTime = input(false);
  locale = input('en');

  // Two-way binding
  date = input<Date | null>(null);
  dateChange = output<Date | null>();

  // Internal state
  isOpen = signal(false);
  internalValue = signal<Date | null>(null);

  // ControlValueAccessor
  private onChange: (value: Date | null) => void = () => { };
  private onTouched: () => void = () => { };

  constructor() {
    // Sync input to internal value
    effect(() => {
      const dateInput = this.date();
      if (dateInput) {
        this.internalValue.set(dateInput);
      }
    });
  }

  buttonClasses = computed(() => cn(
    'inline-flex h-10 w-[240px] items-center justify-start rounded-md border border-input bg-background px-4 py-2 text-sm font-normal ring-offset-background',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    this.class()
  ));

  toggleOpen() {
    if (!this.disabled()) {
      this.isOpen.update(v => !v);
    }
  }

  onDateSelect(value: unknown) {
    // Calendar emits Date for single mode
    let selectedDate: Date | null = null;
    if (value instanceof Date) {
      selectedDate = value;
    }
    this.internalValue.set(selectedDate);
    this.dateChange.emit(selectedDate);
    this.onChange(selectedDate);
    this.onTouched();

    // Close unless time selection is enabled (user might want to adjust time)
    if (!this.showTime()) {
      this.isOpen.set(false);
    }
  }

  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-slot="date-picker"]')) {
      this.isOpen.set(false);
    }
  }

  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(this.showTime() ? { hour: '2-digit', minute: '2-digit' } : {})
    };
    return date.toLocaleDateString(undefined, options);
  }

  // ControlValueAccessor implementation
  writeValue(value: Date | null): void {
    this.internalValue.set(value);
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // The disabled input handles this
  }
}

/**
 * DateRangePickerComponent - For selecting a date range
 * 
 * Usage:
 * <ui-date-range-picker (rangeChange)="onRangeChange($event)" />
 */
@Component({
  selector: 'ui-date-range-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateRangePickerComponent),
      multi: true,
    },
  ],
  template: `
    <div class="relative" [attr.data-slot]="'date-range-picker'">
      <button
        type="button"
        [class]="buttonClasses()"
        [disabled]="disabled()"
        (click)="toggleOpen()"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-haspopup]="'dialog'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 h-4 w-4">
          <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>
        </svg>
        @if (rangeValue().start && rangeValue().end) {
          <span>{{ formatDate(rangeValue().start!) }} - {{ formatDate(rangeValue().end!) }}</span>
        } @else if (rangeValue().start) {
          <span>{{ formatDate(rangeValue().start!) }} - ...</span>
        } @else {
          <span class="text-muted-foreground">{{ placeholder() }}</span>
        }
      </button>
      
      @if (isOpen()) {
        <div 
          class="absolute left-0 top-full z-50 mt-1 rounded-md border bg-popover p-0 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          (click)="$event.stopPropagation()"
        >
          <ui-calendar
            mode="range"
            [selected]="rangeValue()"
            [showMonthSelect]="true"
            [showYearSelect]="true"
            (selectedChange)="onRangeSelect($event)"
          />
        </div>
      }
    </div>
  `,
  host: {
    class: 'contents',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class DateRangePickerComponent implements ControlValueAccessor {
  class = input('');
  placeholder = input('Pick a date range');
  disabled = input(false);

  // Internal state
  isOpen = signal(false);
  rangeValue = signal<DateRange>({ start: null, end: null });

  // Outputs
  rangeChange = output<DateRange>();

  // ControlValueAccessor
  private onChange: (value: DateRange) => void = () => { };
  private onTouched: () => void = () => { };

  buttonClasses = computed(() => cn(
    'inline-flex h-10 w-[300px] items-center justify-start rounded-md border border-input bg-background px-4 py-2 text-sm font-normal ring-offset-background',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    this.class()
  ));

  toggleOpen() {
    if (!this.disabled()) {
      this.isOpen.update(v => !v);
    }
  }

  onRangeSelect(value: unknown) {
    // Calendar emits DateRange for range mode
    if (value && typeof value === 'object' && 'start' in value) {
      const range = value as DateRange;
      this.rangeValue.set(range);
      this.rangeChange.emit(range);
      this.onChange(range);
      this.onTouched();

      // Close when both dates are selected
      if (range.start && range.end) {
        this.isOpen.set(false);
      }
    }
  }

  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-slot="date-range-picker"]')) {
      this.isOpen.set(false);
    }
  }

  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    };
    return date.toLocaleDateString(undefined, options);
  }

  // ControlValueAccessor implementation
  writeValue(value: DateRange | null): void {
    if (value) {
      this.rangeValue.set(value);
    } else {
      this.rangeValue.set({ start: null, end: null });
    }
  }

  registerOnChange(fn: (value: DateRange) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // The disabled input handles this
  }
}
