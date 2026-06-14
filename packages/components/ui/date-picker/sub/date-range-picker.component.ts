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
import { cn } from '../../../lib/utils';
import { CalendarComponent, DateRange, TimeRange } from '../../calendar';
import { DEFAULT_POPUP_POSITION, calculatePopupPosition, computePopupClasses, computePopupStyles, PopupPosition } from '../date-picker.component';

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
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.css',
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
    'inline-flex w-full sm:w-[300px] items-center justify-start rounded-md border border-input bg-background text-sm font-normal ring-offset-background',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    this.class()
  ));

  readonly popupClasses = computed(() => computePopupClasses(this.adjustedPosition()));

  readonly popupStyles = computed(() => computePopupStyles(this.adjustedPosition()));

  private calculatePosition(): void {
    if (!this.popupEl?.nativeElement) return;
    this.adjustedPosition.set(calculatePopupPosition(this.popupEl.nativeElement));
  }

  toggleOpen(): void {
    if (this.disabled()) return;
    this.isOpen.update(v => !v);
  }

  onRangeSelect(value: unknown): void {
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

  onTimeRangeChange(range: TimeRange): void {
    this.timeRange.set(range);
    this.timeRangeChange.emit(range);
  }

  onDocumentClick(event: MouseEvent): void {
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
