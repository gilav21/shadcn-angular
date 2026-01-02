import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { cn } from '../lib/utils';

export type CalendarMode = 'single' | 'range' | 'multi';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

@Component({
  selector: 'ui-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'calendar'">
      <!-- Header -->
      <div class="flex items-center justify-between px-1 relative">
        <button
          type="button"
          (click)="previousMonth()"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground z-10"
          aria-label="Previous month"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="text-sm font-medium absolute w-full left-0 text-center">
          {{ monthName() }} {{ currentYear() }}
        </div>
        <button
          type="button"
          (click)="nextMonth()"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground z-10"
          aria-label="Next month"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Day names -->
      <div class="mt-4 grid grid-cols-7 text-center text-xs text-muted-foreground">
        @for (day of dayNames; track day) {
          <div class="py-2">{{ day }}</div>
        }
      </div>

      <!-- Days grid -->
      <div class="grid grid-cols-7 gap-1">
        @for (day of calendarDays(); track $index) {
          @if (day) {
            <button
              type="button"
              [class]="getDayClasses(day)"
              (click)="selectDay(day)"
              [attr.aria-selected]="isSelected(day)"
              [disabled]="day.getMonth() !== currentMonth()"
            >
              {{ day.getDate() }}
            </button>
          } @else {
            <div class="h-9 w-9"></div>
          }
        }
      </div>
    </div>
  `,
  host: { class: 'contents' },
})
export class CalendarComponent {
  class = input('');
  mode = input<CalendarMode>('single');

  // We can't really type this strictly as one because it depends on mode
  // but specific consumers can cast it
  selected = signal<Date | DateRange | Date[] | null>(null);
  selectedChange = output<Date | DateRange | Date[] | null>();

  private viewDate = signal(new Date());

  readonly dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  classes = computed(() => cn(
    'p-3 bg-background rounded-md border inline-block',
    this.class()
  ));

  currentMonth = computed(() => this.viewDate().getMonth());
  currentYear = computed(() => this.viewDate().getFullYear());
  monthName = computed(() => this.monthNames[this.currentMonth()]);

  calendarDays = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the 1st
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add the days of the month
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  });

  getDayClasses(day: Date): string {
    const isToday = this.isSameDay(day, new Date());
    const isSelected = this.isSelected(day);
    const isInRange = this.isInRange(day);

    return cn(
      'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm',
      'hover:bg-accent hover:text-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',

      // Today styling
      isToday && !isSelected && 'bg-accent text-accent-foreground',

      // Selected styling
      isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground z-10',

      // Range styling (middle days)
      isInRange && !isSelected && 'bg-accent/80 text-accent-foreground rounded-none',

      // Range ends rounding fix
      this.isRangeStart(day) && 'rounded-r-none',
      this.isRangeEnd(day) && 'rounded-l-none',

      // Outside current month (for visual clarity if we showed them, preventing interactions normally)
      // But we hide interaction via disabled logic in template
      day.getMonth() !== this.currentMonth() && 'opacity-50 pointer-events-none'
    );
  }

  isSelected(day: Date): boolean {
    const val = this.selected();
    const mode = this.mode();

    if (!val) return false;

    if (mode === 'single') {
      return this.isSameDay(day, val as Date);
    }

    if (mode === 'multi') {
      return (val as Date[]).some(d => this.isSameDay(d, day));
    }

    if (mode === 'range') {
      const range = val as DateRange;
      if (range.start && this.isSameDay(day, range.start)) return true;
      if (range.end && this.isSameDay(day, range.end)) return true;
      return false;
    }

    return false;
  }

  isInRange(day: Date): boolean {
    if (this.mode() !== 'range') return false;
    const val = this.selected() as DateRange | null;
    if (!val || !val.start || !val.end) return false;

    // Check if day is strictly between start and end
    const time = day.getTime();
    const start = val.start.getTime();
    const end = val.end.getTime();

    return time > Math.min(start, end) && time < Math.max(start, end);
  }

  isRangeStart(day: Date): boolean {
    if (this.mode() !== 'range') return false;
    const val = this.selected() as DateRange | null;
    return !!(val?.start && this.isSameDay(day, val.start) && val.end);
  }

  isRangeEnd(day: Date): boolean {
    if (this.mode() !== 'range') return false;
    const val = this.selected() as DateRange | null;
    return !!(val?.end && this.isSameDay(day, val.end) && val.start);
  }


  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  selectDay(day: Date) {
    const mode = this.mode();
    let newVal: any;

    if (mode === 'single') {
      // Toggle off if clicking same day? Or just always set? 
      // Usually single date picker allows switching, usually doesn't toggle off unless required=false
      // We'll assume always select for now
      newVal = day;
    } else if (mode === 'multi') {
      const current = (this.selected() as Date[]) || [];
      const exists = current.some(d => this.isSameDay(d, day));
      if (exists) {
        newVal = current.filter(d => !this.isSameDay(d, day));
      } else {
        newVal = [...current, day];
      }
    } else if (mode === 'range') {
      const current = (this.selected() as DateRange) || { start: null, end: null };

      if (!current.start || (current.start && current.end)) {
        // Start new range
        newVal = { start: day, end: null };
      } else {
        // Determine start/end
        if (day < current.start) {
          newVal = { start: day, end: current.start };
        } else {
          newVal = { start: current.start, end: day };
        }
      }
    }

    this.selected.set(newVal);
    this.selectedChange.emit(newVal);
  }

  previousMonth() {
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth() {
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }
}
