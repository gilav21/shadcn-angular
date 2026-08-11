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
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { CALENDAR_LOCALES, type CalendarLocale } from '../../lib/i18n/calendar.locales';
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
/** A single selectable date value: a `Date`, an ISO date string, or null. */
export type CalendarDateValue = Date | string | null;

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
  /** Extra classes merged onto the calendar's bordered container (`p-3 … inline-block`). */
  class = input('');
  /**
   * Selection behaviour, which also dictates the shape carried by {@link selected}:
   * `'single'` → `Date`, `'range'` → {@link DateRange}, `'multi'` → `Date[]`.
   * Changing it at runtime does not convert an already-set value, so reset
   * {@link selected} alongside it.
   */
  mode = input<CalendarMode>('single');
  /** Replaces the static month caption with a `ui-select` month picker. Off by default. */
  showMonthSelect = input(false);
  /**
   * Replaces the static year caption with a `ui-select` year picker listing the
   * current year back 100 years — years beyond that range are unreachable from
   * the UI (navigate with {@link previousMonth} or set {@link selected} instead).
   */
  showYearSelect = input(false);
  /** Renders the `<input type="time">` footer below the day grid; see {@link timeMode}. */
  showTimeSelect = input(false);
  /**
   * Shape of the time footer when {@link showTimeSelect} is on: `'single'` shows one
   * time field bound to {@link updateTime}, `'range'` shows start/end fields whose
   * values are mirrored into {@link selectedTimeRange}. Ignored while
   * {@link showTimeSelect} is `false`.
   */
  timeMode = input<CalendarTimeMode>('single');
  /**
   * First column of the week as a `Date.getDay()` index — `0` = Sunday (default),
   * `1` = Monday, … `6` = Saturday. Rotates both the weekday header and the
   * leading blank cells of the grid.
   */
  weekStartsOn = input<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);
  /**
   * Mirrors the direction of the arrow icons. Set automatically from the active
   * {@link locale} whenever that locale declares `rtl`, so an explicit binding is
   * overwritten on locale change.
   */
  rtl = model<boolean>(false);
  /** Locale id or inline {@link CalendarLocale} overrides for day/month names and control labels. */
  locale = input<LocaleInput<CalendarLocale>>();
  /**
   * Two-way selection. Accepts `Date`s, `'YYYY-MM-DD'` strings, or arrays of either
   * on the way in; always emits parsed `Date`s (or a {@link DateRange}) on the way
   * out. The first non-null value also scrolls the calendar to that month — later
   * changes do not move the view.
   */
  selected = model<Date | DateRange | Date[] | string | string[] | null>(null);
  /**
   * Two-way `HH:mm` pair backing the `timeMode: 'range'` footer. Acts as the
   * time-of-day applied to days picked afterwards; days already in
   * {@link selected} keep the time they were stored with.
   */
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

    const parsed = this.parseDate(val as CalendarDateValue);
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
      const parsed = this.parseDate(val as CalendarDateValue);
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

  /**
   * Class list for one day button — merges today/selected/in-range states plus the
   * squared-off corners that make a range read as one bar. Called per cell on every
   * change detection pass, so keep it side-effect free.
   */
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

  private parseDate(val: CalendarDateValue): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /**
   * Whether `day` is a selected date — compared by calendar day only, so the
   * time-of-day carried by {@link selected} is ignored. In `'range'` mode only the
   * two endpoints count; interior days report through {@link isInRange}.
   */
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

  /**
   * Whether `day` falls strictly between the range endpoints (endpoints themselves
   * return `false` — see {@link isSelected}). Always `false` outside `'range'` mode
   * or while the range is half-open. Endpoints stored out of order are tolerated.
   */
  isInRange(day: Date): boolean {
    if (this.mode() !== 'range') return false;
    const val = this.selected() as DateRange | null;
    if (!val?.start || !val.end) return false;

    const time = day.getTime();
    const start = val.start.getTime();
    const end = val.end.getTime();

    return time > Math.min(start, end) && time < Math.max(start, end);
  }

  /**
   * Whether `day` is the opening endpoint of a *complete* range — used only to flatten
   * the trailing corners. Stays `false` while the user has picked a start but no end,
   * so a half-open range still renders as a lone rounded pill.
   */
  isRangeStart(day: Date): boolean {
    if (this.mode() !== 'range') return false;
    const val = this.selected() as DateRange | null;
    return !!(val?.start && this.isSameDay(day, val.start) && val.end);
  }

  /**
   * Mirror of {@link isRangeStart} for the closing endpoint — flattens the leading
   * corners, and likewise requires both endpoints to be set.
   */
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

  /**
   * Applies a day click for the active {@link mode} and writes the result to
   * {@link selected}: single replaces, multi toggles, range fills start → end and
   * restarts once both ends are set (a click before the current start swaps the two).
   * The argument is never mutated: the stored value is a copy carrying the chosen
   * time-of-day, so passing a `Date` you still hold a reference to — such as a cell
   * of the `calendarDays()` grid — is safe.
   */
  selectDay(date: Date): void {
    const day = new Date(date);
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

  /**
   * `(change)` handler for the single time field. Stamps the `HH:mm` value onto the
   * currently selected date — or onto the month being viewed when nothing is selected
   * yet, which turns a bare time edit into a selection. A cleared field is ignored.
   */
  updateTime(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    if (!val) return;

    const [hours, minutes] = val.split(':').map(Number);

    const currentSel = this.selected();
    let date: Date;

    if (currentSel) {
      const parsed = this.parseDate(currentSel as CalendarDateValue);
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

  /**
   * `(change)` handler for the start field of the range time footer. Always records the
   * raw `HH:mm` in {@link selectedTimeRange}, then stamps it onto the range start in
   * `'range'` mode or onto the selected date in `'single'` mode; in `'multi'` mode it
   * only affects days picked afterwards. A cleared field is ignored.
   */
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
      const parsed = this.parseDate(currentSel as CalendarDateValue);
      const date = parsed ? new Date(parsed) : new Date(this.viewDate());
      date.setHours(hours, minutes);
      this.selected.set(new Date(date));
    }
  }

  /**
   * `(change)` handler for the end field of the range time footer. Counterpart to
   * {@link updateStartTime}: records the `HH:mm` in {@link selectedTimeRange}, and
   * stamps it onto the range end only in `'range'` mode with an end already picked.
   *
   * In `'single'` and `'multi'` mode it deliberately leaves {@link selected}
   * alone: those selections are single `Date`s, which carry one time-of-day each
   * — already claimed by the start field — so writing the end time onto them
   * would overwrite the start time rather than record an end. The end of a
   * single-day span lives in `selectedTimeRange().end`, which is what
   * {@link endTimeString} reads back outside `'range'` mode.
   */
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

  /** Moves the visible month back one, without touching {@link selected}. */
  previousMonth(): void {
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  /** Moves the visible month forward one, without touching {@link selected}. */
  nextMonth(): void {
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  /**
   * `(valueChange)` handler for the {@link showMonthSelect} picker; `month` is the
   * zero-based month index as a string. Jumps the view to the 1st of that month in
   * the current year.
   */
  onMonthChange(month: string): void {
    const monthNum = Number.parseInt(month, 10);
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), monthNum, 1));
  }

  /**
   * `(valueChange)` handler for the {@link showYearSelect} picker; `year` is the
   * four-digit year as a string. Keeps the visible month and jumps to its 1st.
   */
  onYearChange(year: string): void {
    const yearNum = Number.parseInt(year, 10);
    const current = this.viewDate();
    this.viewDate.set(new Date(yearNum, current.getMonth(), 1));
  }
}
