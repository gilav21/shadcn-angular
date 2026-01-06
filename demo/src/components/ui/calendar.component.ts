import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
  model,
} from '@angular/core';
import { cn } from '../lib/utils';
import { CALENDAR_LOCALES, CalendarLocale } from './calendar-locales';
import { ButtonComponent } from './button.component';
import {
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectItemComponent,
} from './select.component';

export type CalendarMode = 'single' | 'range' | 'multi';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

@Component({
  selector: 'ui-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    SelectComponent,
    SelectTriggerComponent,
    SelectValueComponent,
    SelectContentComponent,
    SelectItemComponent,
  ],
  template: `
    <div [class]="classes()" [attr.data-slot]="'calendar'" [dir]="rtl() ? 'rtl' : 'ltr'">
      <!-- Header -->
      <div class="flex items-center justify-between px-1 relative mb-4">
        <ui-button
          variant="outline"
          size="icon-sm"
          (click)="previousMonth()"
          [attr.aria-label]="prevMonthLabel()"
        >
          <svg class="h-4 w-4" [class.rotate-180]="rtl()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </ui-button>

        <div class="flex items-center gap-1 font-medium text-sm">
            @if (showMonthSelect()) {
              <ui-select 
                [defaultValue]="currentMonth().toString()" 
                [rtl]="rtl()"
                position="popper"
                (valueChange)="onMonthChange($event)"
              >
                <ui-select-trigger class="h-7 w-[110px]">
                  <ui-select-value [placeholder]="currentMonthName()" [displayValue]="currentMonthName()" />
                </ui-select-trigger>
                <ui-select-content>
                  @for (month of monthNames(); track $index) {
                    <ui-select-item [value]="$index.toString()">{{ month }}</ui-select-item>
                  }
                </ui-select-content>
              </ui-select>
            } @else {
               <span>{{ currentMonthName() }}</span>
            }

            @if (showYearSelect()) {
              <ui-select 
                [defaultValue]="currentYear().toString()" 
                [rtl]="rtl()"
                position="popper"
                (valueChange)="onYearChange($event)"
              >
                <ui-select-trigger class="h-7 w-[80px]">
                  <ui-select-value [placeholder]="currentYear().toString()" />
                </ui-select-trigger>
                <ui-select-content class="max-h-60">
                  @for (year of years(); track year) {
                    <ui-select-item [value]="year.toString()">{{ year }}</ui-select-item>
                  }
                </ui-select-content>
              </ui-select>
            } @else {
               <span>{{ currentYear() }}</span>
            }
        </div>

        <ui-button
          variant="outline"
          size="icon-sm"
          (click)="nextMonth()"
          [attr.aria-label]="nextMonthLabel()"
        >
          <svg class="h-4 w-4" [class.rotate-180]="rtl()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </ui-button>
      </div>

      <!-- Day names -->
      <div class="mt-4 grid grid-cols-7 text-center text-xs text-muted-foreground">
        @for (day of orderedDayNames(); track day) {
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
              [disabled]="day.getMonth() !== currentMonth()"
            >
              {{ day.getDate() }}
            </button>
          } @else {
            <div class="h-9 w-9"></div>
          }
        }
      </div>

      <!-- Time Selection (Single Mode Only) -->
      @if (showTimeSelect() && mode() === 'single') {
        <div class="mt-4 border-t pt-4">
            <div class="flex flex-col gap-2">
                <span class="text-sm font-medium">{{ timeLabel() }}</span>
                <div class="flex items-center rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
                    <input 
                        type="time"
                        class="flex-1 w-full bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-calendar-picker-indicator]:hidden"
                        [value]="selectedTimeString()"
                        (change)="updateTime($event)"
                    />
                    <div class="flex items-center justify-center px-3 py-2 border-l border-input bg-muted/50 text-muted-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                </div>
            </div>
        </div>
      }
    </div>
  `,
  host: { class: 'contents' },
})
export class CalendarComponent {
  class = input('');
  mode = input<CalendarMode>('single');
  showMonthSelect = input(false);
  showYearSelect = input(false);
  showTimeSelect = input(false);
  weekStartsOn = input<0 | 1>(0); // 0 = Sunday, 1 = Monday
  rtl = input(false);
  locale = input<string>('en');
  selected = model<Date | DateRange | Date[] | string | string[] | null>(null);

  selectedChange = output<Date | DateRange | Date[] | string | string[] | null>();

  private viewDate = signal(new Date());

  constructor() {
    effect(() => {
      const val = this.selected();
      if (val && !this.viewDateInitialized) {
        let d: Date | null = null;
        if (typeof val === 'string') d = this.parseDate(val);
        else if (val instanceof Date) d = val;
        else if (Array.isArray(val) && val.length > 0) d = this.parseDate(val[0]);
        else if (typeof val === 'object' && 'start' in (val as any)) d = (val as any).start;

        if (d) {
          this.viewDate.set(new Date(d));
          this.viewDateInitialized = true;
        }
      }
    }, { allowSignalWrites: true });
  }

  private viewDateInitialized = false;

  private activeLocale = computed((): CalendarLocale => {
    const key = this.locale();
    return CALENDAR_LOCALES[key] ?? CALENDAR_LOCALES['en'];
  });

  dayNames = computed(() => this.activeLocale().dayNames);
  monthNames = computed(() => this.activeLocale().monthNames);
  timeLabel = computed(() => this.activeLocale().timeLabel ?? 'Time');
  prevMonthLabel = computed(() => this.activeLocale().prevMonthLabel ?? 'Previous month');
  nextMonthLabel = computed(() => this.activeLocale().nextMonthLabel ?? 'Next month');

  orderedDayNames = computed(() => {
    const start = this.weekStartsOn();
    const names = this.dayNames();
    if (start === 0) return names;
    return [...names.slice(start), ...names.slice(0, start)];
  });

  classes = computed(() => cn(
    'p-3 bg-background rounded-md border inline-block',
    this.class()
  ));

  currentMonth = computed(() => this.viewDate().getMonth());
  currentYear = computed(() => this.viewDate().getFullYear());
  currentMonthName = computed(() => this.monthNames()[this.currentMonth()]);

  years = computed(() => {
    const current = new Date().getFullYear();
    const start = current - 100;
    const end = current + 10;
    const years: number[] = [];
    for (let i = current; i >= start; i--) {
      years.push(i);
    }
    return years;
  });

  calendarDays = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = this.weekStartsOn();
    const startingDay = (firstDay.getDay() - startOffset + 7) % 7;
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  });

  selectedTimeString = computed(() => {
    const val = this.selected();
    if (!val) return '';

    const parsed = this.parseDate(val as any);
    if (!parsed) return '';

    const hours = parsed.getHours().toString().padStart(2, '0');
    const minutes = parsed.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  });

  getDayClasses(day: Date): string {
    const isToday = this.isSameDay(day, new Date());
    const isSelected = this.isSelected(day);
    const isInRange = this.isInRange(day);

    return cn(
      'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm',
      'hover:bg-accent hover:text-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',

      isToday && !isSelected && 'bg-accent text-accent-foreground',
      isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground z-10',
      isInRange && !isSelected && 'bg-accent/80 text-accent-foreground rounded-none',

      this.isRangeStart(day) && 'rounded-r-none',
      this.isRangeEnd(day) && 'rounded-l-none',

      day.getMonth() !== this.currentMonth() && 'opacity-50 pointer-events-none'
    );
  }

  private parseDate(val: Date | string | null): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  isSelected(day: Date): boolean {
    const val = this.selected();
    const mode = this.mode();

    if (!val) return false;

    if (mode === 'single') {
      const d = this.parseDate(val as Date | string);
      return d ? this.isSameDay(day, d) : false;
    }

    if (mode === 'multi') {
      const arr = (val as (Date | string)[]);
      return arr.some(v => {
        const d = this.parseDate(v);
        return d ? this.isSameDay(d, day) : false;
      });
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
    const currentSelected = this.selected();

    if (mode === 'single' && currentSelected) {
      const currentD = this.parseDate(currentSelected as any);
      if (currentD) {
        day.setHours(currentD.getHours(), currentD.getMinutes());
      }
    }

    if (mode === 'single') {
      newVal = day;
    } else if (mode === 'multi') {
      const current = (currentSelected as (Date | string)[]) || [];
      const parsedCurrent = current.map(v => this.parseDate(v)).filter(Boolean) as Date[];
      const exists = parsedCurrent.some(d => this.isSameDay(d, day));

      if (exists) {
        newVal = parsedCurrent.filter(d => !this.isSameDay(d, day));
      } else {
        newVal = [...parsedCurrent, day];
      }
    } else if (mode === 'range') {
      const current = (currentSelected as DateRange) || { start: null, end: null };

      if (!current.start || (current.start && current.end)) {
        newVal = { start: day, end: null };
      } else {
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

  updateTime(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value; // "HH:MM"
    if (!val) return;

    const [hours, minutes] = val.split(':').map(Number);

    const currentSel = this.selected();
    let date: Date;

    if (currentSel) {
      const parsed = this.parseDate(currentSel as any);
      if (parsed) {
        date = new Date(parsed);
      } else {
        date = new Date(this.viewDate());
      }
    } else {
      date = new Date(this.viewDate());
    }

    date.setHours(hours);
    date.setMinutes(minutes);

    // Emit new Date
    this.selected.set(new Date(date));
    this.selectedChange.emit(new Date(date));
  }

  previousMonth() {
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth() {
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  onMonthChange(month: string) {
    const monthNum = parseInt(month, 10);
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), monthNum, 1));
  }

  onYearChange(year: string) {
    const yearNum = parseInt(year, 10);
    const current = this.viewDate();
    this.viewDate.set(new Date(yearNum, current.getMonth(), 1));
  }
}
