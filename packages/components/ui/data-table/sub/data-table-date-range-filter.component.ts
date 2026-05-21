import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CalendarComponent, DateRange } from '../../calendar';
import { ButtonComponent } from '../../button';
import { CALENDAR_LOCALES, CalendarLocale } from '../../../lib/calendar-locales';
import { toDate, toDateOnlyTimestamp } from './data-table-date-utils';

export interface DateRangePreset {
  readonly label: string;
  readonly range: DateRange;
}

@Component({
  selector: 'ui-data-table-date-range-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent, ButtonComponent],
  templateUrl: './data-table-date-range-filter.component.html',
  host: { class: 'contents' },
})
export class DataTableDateRangeFilterComponent {
  readonly class = input('');
  readonly title = input<string | undefined>(undefined);
  readonly locale = input('en');
  readonly selected = input<DateRange | null>(null);
  readonly presets = input<DateRangePreset[]>([]);

  readonly filterChange = output<DateRange | null>();

  private readonly _selected = signal<DateRange>({ start: null, end: null });
  readonly selectedValue = this._selected.asReadonly();

  private readonly activeLocale = computed((): CalendarLocale =>
    CALENDAR_LOCALES[this.locale()] ?? CALENDAR_LOCALES['en']
  );
  readonly isRtl = computed(() => this.activeLocale().rtl === true);
  readonly clearLabel = computed(() => this.activeLocale().clearLabel ?? 'Clear');

  constructor() {
    effect(() => {
      const sel = this.selected();
      if (sel) {
        this._selected.set(sel);
      } else {
        this._selected.set({ start: null, end: null });
      }
    });
  }

  readonly classes = computed(() => cn(
    'flex flex-col',
    this.class()
  ));

  readonly effectivePresets = computed(() => {
    const custom = this.presets();
    if (custom.length > 0) return custom;
    return buildDefaultPresets(this.activeLocale());
  });

  onRangeSelect(value: unknown): void {
    if (value && typeof value === 'object' && 'start' in value) {
      const range = value as DateRange;
      this._selected.set(range);
      if (range.start && range.end) {
        this.filterChange.emit(range);
      }
    }
  }

  applyPreset(preset: DateRangePreset): void {
    this._selected.set(preset.range);
    this.filterChange.emit(preset.range);
  }

  clear(): void {
    this._selected.set({ start: null, end: null });
    this.filterChange.emit(null);
  }
}

function buildDefaultPresets(locale: CalendarLocale): DateRangePreset[] {
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return [
    {
      label: locale.todayLabel ?? 'Today',
      range: { start: todayOnly, end: todayOnly },
    },
    {
      label: locale.last7DaysLabel ?? 'Last 7 days',
      range: {
        start: new Date(todayOnly.getFullYear(), todayOnly.getMonth(), todayOnly.getDate() - 6),
        end: todayOnly,
      },
    },
    {
      label: locale.last30DaysLabel ?? 'Last 30 days',
      range: {
        start: new Date(todayOnly.getFullYear(), todayOnly.getMonth(), todayOnly.getDate() - 29),
        end: todayOnly,
      },
    },
    {
      label: locale.thisMonthLabel ?? 'This month',
      range: {
        start: new Date(todayOnly.getFullYear(), todayOnly.getMonth(), 1),
        end: todayOnly,
      },
    },
  ];
}

export function dateRangeFilterFn<TRow>(
  row: TRow,
  filterValue: DateRange | null,
  getValue: (row: TRow) => unknown
): boolean {
  if (!filterValue) return true;
  if (!filterValue.start && !filterValue.end) return true;

  const cellDate = toDate(getValue(row));
  if (!cellDate) return false;
  const cellTs = toDateOnlyTimestamp(cellDate);

  if (filterValue.start && filterValue.end) {
    return cellTs >= toDateOnlyTimestamp(filterValue.start)
      && cellTs <= toDateOnlyTimestamp(filterValue.end);
  }
  if (filterValue.start) {
    return cellTs >= toDateOnlyTimestamp(filterValue.start);
  }
  return cellTs <= toDateOnlyTimestamp(filterValue.end!);
}
