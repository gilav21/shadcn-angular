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
import { cn, getClippingRect } from '../../lib/utils';
import { CalendarComponent } from '../calendar';
export { DateRangePickerComponent } from './sub/date-range-picker.component';

export type PopupPosition = { offsetX: number; actualSide: 'top' | 'bottom' };

export const DEFAULT_POPUP_POSITION: PopupPosition = { offsetX: 0, actualSide: 'bottom' };

export function calculatePopupPosition(element: HTMLElement): PopupPosition {
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

export function computePopupClasses(position: PopupPosition): string {
  const sideClasses = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
  };
  return cn(
    'absolute ltr:left-0 rtl:right-0 z-50 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-0 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
    sideClasses[position.actualSide]
  );
}

export function computePopupStyles(position: PopupPosition): string {
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
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
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
    'inline-flex w-full sm:w-[240px] items-center justify-start rounded-md border border-input bg-background text-sm font-normal ring-offset-background',
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
    if (!this.disabled()) {
      this.isOpen.update(v => !v);
    }
  }

  onDateSelect(value: unknown): void {
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

  onDocumentClick(event: MouseEvent): void {
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

