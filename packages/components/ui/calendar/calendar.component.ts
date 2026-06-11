import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  effect,
  model,
  untracked,
} from '@angular/core';
import { cn } from '../../lib/utils';
import {
  CALENDAR_LOCALES,
  type CalendarLocale,
  createLocaleBindings,
  type LocaleInput,
} from '../../lib/i18n';
import { ButtonComponent } from '../button';
import {
  SelectComponent,
  SelectTriggerComponent,
  SelectValueComponent,
  SelectContentComponent,
  SelectItemComponent,
} from '../select';

export type CalendarMode = 'single' | 'range' | 'multi';
export type CalendarTimeMode = 'single' | 'range';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface TimeRange {
  start: string;
  end: string;
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
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
  host: { class: 'contents' },
})
export class CalendarComponent {
  class = input('');
  mode = input<CalendarMode>('single');
  showMonthSelect = input(false);
  showYearSelect = input(false);
  showTimeSelect = input(false);
  timeMode = input<CalendarTimeMode>('single');
  weekStartsOn = input<0 | 1 | 2 | 3 | 4 | 5 | 6>(0); // 0 = Sunday, 1 = Monday, etc.
  rtl = model<boolean>(false);
  locale = input<LocaleInput<CalendarLocale>>();
  selected = model<Date | DateRange | Date[] | string | string[] | null>(null);
  selectedTimeRange = model<TimeRange>({ start: '', end: '' });

  private readonly viewDate = signal(new Date());

  private readonly i18n = createLocaleBindings(this.locale, CALENDAR_LOCALES);
  private readonly activeLocale = this.i18n.t;
  /** `'rtl'` when the active locale is RTL, otherwise `null` — bind to `[attr.dir]`. */
  protected readonly dir = this.i18n.dir;

  constructor() {
    effect(() => {
      const val = this.selected();
      if (val && !this.viewDateInitialized) {
        let d: Date | null = null;
        if (typeof val === 'string') d = this.parseDate(val);
        else if (val instanceof Date) d = val;
        else if (Array.isArray(val) && val.length > 0) d = this.parseDate(val[0]);
        else if (typeof val === 'object' && val !== null && 'start' in val) d = (val).start;

        if (d) {
          this.viewDate.set(new Date(d));
          this.viewDateInitialized = true;
        }
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const localeRtl = this.activeLocale().rtl;
      if (localeRtl === undefined) return;
      untracked(() => this.rtl.set(localeRtl));
    });
  }

  private viewDateInitialized = false;

  readonly dayNames = computed(() => this.activeLocale().dayNames);
  readonly monthNames = computed(() => this.activeLocale().monthNames);
  readonly timeLabel = computed(() => this.activeLocale().timeLabel ?? 'Time');
  readonly startTimeLabel = computed(() => this.activeLocale().startTimeLabel ?? 'Start time');
  readonly endTimeLabel = computed(() => this.activeLocale().endTimeLabel ?? 'End time');
  readonly prevMonthLabel = computed(() => this.activeLocale().prevMonthLabel ?? 'Previous month');
  readonly nextMonthLabel = computed(() => this.activeLocale().nextMonthLabel ?? 'Next month');

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

    const parsed = this.parseDate(val as Date | string | null);
    if (!parsed) return '';

    return this.formatTimeFromDate(parsed);
  });

  readonly startTimeString = computed(() => {
    const val = this.selected();
    const mode = this.mode();

    if (mode === 'range') {
      const range = val as DateRange | null;
      return this.formatTimeFromDate(range?.start ?? null) || this.selectedTimeRange().start;
    }

    if (mode === 'single') {
      const parsed = this.parseDate(val as Date | string | null);
      return this.formatTimeFromDate(parsed) || this.selectedTimeRange().start;
    }

    return this.selectedTimeRange().start;
  });

  readonly endTimeString = computed(() => {
    const val = this.selected();
    const mode = this.mode();

    if (mode === 'range') {
      const range = val as DateRange | null;
      return this.formatTimeFromDate(range?.end ?? null) || this.selectedTimeRange().end;
    }

    return this.selectedTimeRange().end;
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

      this.isRangeStart(day) && 'rounded-e-none',
      this.isRangeEnd(day) && 'rounded-s-none',

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
    return Number.isNaN(d.getTime()) ? null : d;
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
    if (!val?.start || !val.end) return false;

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

  selectDay(day: Date): void {
    const mode = this.mode();
    const isTimeRange = this.showTimeSelect() && this.timeMode() === 'range';
    let newVal: Date | DateRange | Date[];

    if (mode === 'single') {
      newVal = this.selectSingleDay(day, isTimeRange);
    } else if (mode === 'multi') {
      newVal = this.selectMultiDay(day, isTimeRange);
    } else {
      newVal = this.selectRangeDay(day, isTimeRange);
    }

    this.selected.set(newVal);
  }

  private selectSingleDay(day: Date, isTimeRange: boolean): Date {
    if (isTimeRange) {
      this.applyTimeStringToDate(day, this.selectedTimeRange().start);
    } else {
      const currentSelected = this.selected();
      if (currentSelected) {
        const currentD = this.parseDate(currentSelected as Date | string);
        if (currentD) {
          day.setHours(currentD.getHours(), currentD.getMinutes());
        }
      }
    }
    return day;
  }

  private selectMultiDay(day: Date, isTimeRange: boolean): Date[] {
    const currentSelected = this.selected();
    const current = (currentSelected as (Date | string)[]) ?? [];
    const parsedCurrent = current.map(v => this.parseDate(v)).filter(Boolean) as Date[];
    const exists = parsedCurrent.some(d => this.isSameDay(d, day));

    if (exists) {
      return parsedCurrent.filter(d => !this.isSameDay(d, day));
    }
    if (isTimeRange) {
      this.applyTimeStringToDate(day, this.selectedTimeRange().start);
    }
    return [...parsedCurrent, day];
  }

  private selectRangeDay(day: Date, isTimeRange: boolean): DateRange {
    const currentSelected = this.selected();
    const current = (currentSelected as DateRange) ?? { start: null, end: null };

    if (!current.start || (current.start && current.end)) {
      if (isTimeRange) {
        this.applyTimeStringToDate(day, this.selectedTimeRange().start);
      }
      return { start: day, end: null };
    }
    if (day < current.start) {
      if (isTimeRange) {
        this.applyTimeStringToDate(day, this.selectedTimeRange().start);
        this.applyTimeStringToDate(current.start, this.selectedTimeRange().end);
      }
      return { start: day, end: current.start };
    }
    if (isTimeRange) {
      this.applyTimeStringToDate(day, this.selectedTimeRange().end);
    }
    return { start: current.start, end: day };
  }

  updateTime(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    if (!val) return;

    const [hours, minutes] = val.split(':').map(Number);

    const currentSel = this.selected();
    let date: Date;

    if (currentSel) {
      const parsed = this.parseDate(currentSel as Date | string | null);
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

    this.selected.set(new Date(date));
  }

  updateStartTime(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    if (!val) return;

    const currentRange = this.selectedTimeRange();
    this.selectedTimeRange.set({ ...currentRange, start: val });

    const [hours, minutes] = val.split(':').map(Number);
    const mode = this.mode();
    const currentSel = this.selected();

    if (mode === 'range') {
      const range = (currentSel as DateRange) ?? { start: null, end: null };
      if (range.start) {
        const newStart = new Date(range.start);
        newStart.setHours(hours, minutes);
        const newRange = { ...range, start: newStart };
        this.selected.set(newRange);
      }
      return;
    }

    if (mode === 'single') {
      const parsed = this.parseDate(currentSel as Date | string | null);
      const date = parsed ? new Date(parsed) : new Date(this.viewDate());
      date.setHours(hours, minutes);
      this.selected.set(new Date(date));
    }
  }

  updateEndTime(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    if (!val) return;

    const currentRange = this.selectedTimeRange();
    this.selectedTimeRange.set({ ...currentRange, end: val });

    const [hours, minutes] = val.split(':').map(Number);
    const mode = this.mode();
    const currentSel = this.selected();

    if (mode === 'range') {
      const range = (currentSel as DateRange) ?? { start: null, end: null };
      if (range.end) {
        const newEnd = new Date(range.end);
        newEnd.setHours(hours, minutes);
        const newRange = { ...range, end: newEnd };
        this.selected.set(newRange);
      }
    }
  }

  private formatTimeFromDate(date: Date | null): string {
    if (!date) return '';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private applyTimeStringToDate(date: Date, timeStr: string): void {
    if (!timeStr) return;
    const [hours, minutes] = timeStr.split(':').map(Number);
    date.setHours(hours, minutes);
  }

  previousMonth(): void {
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  onMonthChange(month: string): void {
    const monthNum = Number.parseInt(month, 10);
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), monthNum, 1));
  }

  onYearChange(year: string): void {
    const yearNum = Number.parseInt(year, 10);
    const current = this.viewDate();
    this.viewDate.set(new Date(yearNum, current.getMonth(), 1));
  }
}
