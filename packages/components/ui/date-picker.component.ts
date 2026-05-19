import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  forwardRef,
  effect,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn, getClippingRect } from '../lib/utils';
import { CalendarComponent, DateRange, TimeRange } from './calendar';

type PopupPosition = { offsetX: number; actualSide: 'top' | 'bottom' };

const DEFAULT_POPUP_POSITION: PopupPosition = { offsetX: 0, actualSide: 'bottom' };

function calculatePopupPosition(element: HTMLElement): PopupPosition {
  const rect = element.getBoundingClientRect();
  const boundary = getClippingRect(element);

  let offsetX = 0;
  let actualSide: 'top' | 'bottom' = 'bottom';

  if (rect.right > boundary.right) {
    offsetX = boundary.right - rect.right - 8;
  } else if (rect.left < boundary.left) {
    offsetX = boundary.left - rect.left + 8;
  }

  const overflowBottom = rect.bottom - boundary.bottom;
  const parentEl = element.parentElement;
  const parentRect = parentEl?.getBoundingClientRect();
  const spaceAbove = parentRect ? parentRect.top - boundary.top : 0;
  const spaceBelow = parentRect ? boundary.bottom - parentRect.bottom : 0;

  if (overflowBottom > 0) {
    actualSide = spaceAbove > spaceBelow ? 'top' : 'bottom';
  }

  return { offsetX, actualSide };
}

function computePopupClasses(position: PopupPosition): string {
  const sideClasses = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
  };
  return cn(
    'absolute ltr:left-0 rtl:right-0 z-50 rounded-md border bg-popover p-0 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
    sideClasses[position.actualSide]
  );
}

function computePopupStyles(position: PopupPosition): string {
  if (position.offsetX !== 0) {
    return `transform: translateX(${position.offsetX}px);`;
  }
  return '';
}

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
          #popupEl
          [class]="popupClasses()"
          [style]="popupStyles()"
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
  readonly class = input('');
  readonly placeholder = input('Pick a date');
  readonly disabled = input(false);
  readonly showTime = input(false);
  readonly locale = input('en');
  readonly date = input<Date | null>(null);
  readonly dateChange = output<Date | null>();

  readonly isOpen = signal(false);
  readonly internalValue = signal<Date | null>(null);
  private onChange: (value: Date | null) => void = () => { };
  private onTouched: () => void = () => { };

  @ViewChild('popupEl') popupEl?: ElementRef<HTMLElement>;

  private readonly adjustedPosition = signal<PopupPosition>({ ...DEFAULT_POPUP_POSITION });

  constructor() {
    effect(() => {
      const dateInput = this.date();
      if (dateInput) {
        this.internalValue.set(dateInput);
      }
    });
    effect(() => {
      if (this.isOpen()) {
        this.adjustedPosition.set({ offsetX: 0, actualSide: 'bottom' });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.calculatePosition();
          });
        });
      }
    });
  }

  readonly buttonClasses = computed(() => cn(
    'inline-flex h-10 w-full sm:w-[240px] items-center justify-start rounded-md border border-input bg-background px-4 py-2 text-sm font-normal ring-offset-background',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    this.class()
  ));

  readonly popupClasses = computed(() => computePopupClasses(this.adjustedPosition()));

  readonly popupStyles = computed(() => computePopupStyles(this.adjustedPosition()));

  private calculatePosition() {
    if (!this.popupEl?.nativeElement) return;
    this.adjustedPosition.set(calculatePopupPosition(this.popupEl.nativeElement));
  }

  toggleOpen() {
    if (!this.disabled()) {
      this.isOpen.update(v => !v);
    }
  }

  onDateSelect(value: unknown) {
    let selectedDate: Date | null = null;
    if (value instanceof Date) {
      selectedDate = value;
    }
    this.internalValue.set(selectedDate);
    this.dateChange.emit(selectedDate);
    this.onChange(selectedDate);
    this.onTouched();
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
    return date.toLocaleDateString(this.locale(), options);
  }

  writeValue(value: Date | null): void {
    this.internalValue.set(value);
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(_isDisabled: boolean): void {
    // Disabled state is managed via the disabled input binding
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
          #popupEl
          [class]="popupClasses()"
          [style]="popupStyles()"
          (click)="$event.stopPropagation()"
        >
          <ui-calendar
            mode="range"
            [selected]="rangeValue()"
            [showTimeSelect]="showTime()"
            timeMode="range"
            [selectedTimeRange]="timeRange()"
            [showMonthSelect]="true"
            [showYearSelect]="true"
            [locale]="locale()"
            (selectedChange)="onRangeSelect($event)"
            (selectedTimeRangeChange)="onTimeRangeChange($event)"
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
  readonly class = input('');
  readonly placeholder = input('Pick a date range');
  readonly disabled = input(false);
  readonly showTime = input(false);
  readonly locale = input('en');

  readonly isOpen = signal(false);
  readonly rangeValue = signal<DateRange>({ start: null, end: null });
  readonly timeRange = signal<TimeRange>({ start: '', end: '' });
  readonly rangeChange = output<DateRange>();
  readonly timeRangeChange = output<TimeRange>();

  private onChange: (value: DateRange) => void = () => { };
  private onTouched: () => void = () => { };

  @ViewChild('popupEl') popupEl?: ElementRef<HTMLElement>;

  private readonly adjustedPosition = signal<PopupPosition>({ ...DEFAULT_POPUP_POSITION });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.adjustedPosition.set({ offsetX: 0, actualSide: 'bottom' });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.calculatePosition();
          });
        });
      }
    });
  }

  readonly buttonClasses = computed(() => cn(
    'inline-flex h-10 w-full sm:w-[300px] items-center justify-start rounded-md border border-input bg-background px-4 py-2 text-sm font-normal ring-offset-background',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    this.class()
  ));

  readonly popupClasses = computed(() => computePopupClasses(this.adjustedPosition()));

  readonly popupStyles = computed(() => computePopupStyles(this.adjustedPosition()));

  private calculatePosition() {
    if (!this.popupEl?.nativeElement) return;
    this.adjustedPosition.set(calculatePopupPosition(this.popupEl.nativeElement));
  }

  toggleOpen() {
    if (this.disabled()) return;
    this.isOpen.update(v => !v);
  }

  onRangeSelect(value: unknown) {
    if (value && typeof value === 'object' && 'start' in value) {
      const range = value as DateRange;
      this.rangeValue.set(range);
      this.rangeChange.emit(range);
      this.onChange(range);
      this.onTouched();

      if (range.start && range.end && !this.showTime()) {
        this.isOpen.set(false);
      }
    }
  }

  onTimeRangeChange(range: TimeRange) {
    this.timeRange.set(range);
    this.timeRangeChange.emit(range);
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
      year: 'numeric',
      ...(this.showTime() ? { hour: '2-digit', minute: '2-digit' } : {})
    };
    return date.toLocaleDateString(this.locale(), options);
  }

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

  setDisabledState(_isDisabled: boolean): void {
    // Disabled state is managed via the disabled input binding
  }
}
