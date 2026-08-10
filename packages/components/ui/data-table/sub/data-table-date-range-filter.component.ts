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
import { createLocaleBindings, type LocaleInput } from '../../../lib/i18n';
import { CALENDAR_LOCALES, type CalendarLocale } from '../../../lib/i18n/calendar.locales';
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
  /** Extra classes merged onto the panel wrapper (the calendar keeps its own). */
  readonly class = input('');
  /** Optional heading above the preset row; omitted entirely when unset. */
  readonly title = input<string | undefined>(undefined);
  /**
   * Locale dictionary or registry key (BCP-47). Falls back to `UI_LOCALE_ID`
   * when not set — so an embedded date-range filter inside
   * `<ui-data-table locale="he">` is automatically Hebrew.
   */
  readonly locale = input<LocaleInput<CalendarLocale>>();
  /**
   * The externally-held range. An effect mirrors it into the internal signal
   * the calendar reads (`null` becomes an empty `{ start: null, end: null }`),
   * so pushing a new value resets the panel; the component also maintains that
   * signal itself, so it works uncontrolled if you never write back.
   */
  readonly selected = input<DateRange | null>(null);
  /**
   * Replaces the built-in quick ranges (Today / Last 7 days / Last 30 days /
   * This month). An empty array — the default — keeps the built-ins, which are
   * localized from the active {@link locale}; there is no way to render *no*
   * presets.
   */
  readonly presets = input<DateRangePreset[]>([]);

  /**
   * The completed range, or `null` when cleared. Only emitted once *both*
   * endpoints exist — picking the first endpoint updates the calendar but stays
   * silent — so a consumer never sees a half-open range from calendar clicks.
   * Presets emit immediately. Pair with {@link dateRangeFilterFn}.
   */
  readonly filterChange = output<DateRange | null>();

  private readonly _selected = signal<DateRange>({ start: null, end: null });
  readonly selectedValue = this._selected.asReadonly();

  private readonly i18n = createLocaleBindings(this.locale, CALENDAR_LOCALES);
  private readonly activeLocale = this.i18n.t;
  readonly isRtl = this.i18n.isRtl;
  /** `'rtl'` when the active locale is RTL, otherwise `null` — bind to `[attr.dir]`. */
  readonly dir = this.i18n.dir;
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

  /**
   * Calendar `selectedChange` handler. Payloads that aren't range-shaped are
   * ignored; a range with only a start is stored but not emitted (see
   * {@link filterChange}).
   */
  onRangeSelect(value: unknown): void {
    if (value && typeof value === 'object' && 'start' in value) {
      const range = value as DateRange;
      this._selected.set(range);
      if (range.start && range.end) {
        this.filterChange.emit(range);
      }
    }
  }

  /**
   * Selects a quick range and emits it immediately, without waiting for a
   * second calendar click. The preset's `range` object is stored by reference —
   * it is not cloned or normalized to midnight, so a caller-supplied preset
   * carrying a time-of-day is passed through as-is.
   */
  applyPreset(preset: DateRangePreset): void {
    this._selected.set(preset.range);
    this.filterChange.emit(preset.range);
  }

  /** Empties both endpoints and emits `null`, which {@link dateRangeFilterFn} treats as "no filter". */
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
  if (!filterValue.end) return true;
  return cellTs <= toDateOnlyTimestamp(filterValue.end);
}
