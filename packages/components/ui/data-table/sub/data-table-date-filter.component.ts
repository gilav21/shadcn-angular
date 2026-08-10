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
import { CalendarComponent } from '../../calendar';
import { ButtonComponent } from '../../button';
import { createLocaleBindings, type LocaleInput } from '../../../lib/i18n';
import { CALENDAR_LOCALES, type CalendarLocale } from '../../../lib/i18n/calendar.locales';
import { toDate, toDateOnlyTimestamp } from './data-table-date-utils';

@Component({
  selector: 'ui-data-table-date-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent, ButtonComponent],
  templateUrl: './data-table-date-filter.component.html',
  host: { class: 'contents' },
})
export class DataTableDateFilterComponent {
  /** Extra classes merged onto the panel wrapper (the calendar keeps its own). */
  readonly class = input('');
  /** Optional heading above the Today/Clear row; omitted entirely when unset. */
  readonly title = input<string | undefined>(undefined);
  /**
   * Locale dictionary or registry key (BCP-47). Falls back to `UI_LOCALE_ID`
   * when not set — so an embedded date filter inside `<ui-data-table
   * locale="he">` is automatically Hebrew without per-column wiring.
   */
  readonly locale = input<LocaleInput<CalendarLocale>>();
  /**
   * The externally-held selected date. An effect mirrors it into the internal
   * signal the calendar reads, so pushing a new value (or `null`) resets the
   * panel — but the component also updates that signal itself on interaction,
   * so it works uncontrolled if you never write back.
   */
  readonly selected = input<Date | null>(null);

  /**
   * The newly picked date, or `null` when cleared. The component filters
   * nothing itself — pair it with {@link dateFilterFn} as the column's filter
   * function and feed this value in as the column filter value.
   */
  readonly filterChange = output<Date | null>();

  private readonly _selected = signal<Date | null>(null);
  readonly selectedValue = this._selected.asReadonly();

  private readonly i18n = createLocaleBindings(this.locale, CALENDAR_LOCALES);
  private readonly activeLocale = this.i18n.t;
  readonly isRtl = this.i18n.isRtl;
  /** `'rtl'` when the active locale is RTL, otherwise `null` — bind to `[attr.dir]`. */
  readonly dir = this.i18n.dir;
  readonly todayLabel = computed(() => this.activeLocale().todayLabel ?? 'Today');
  readonly clearLabel = computed(() => this.activeLocale().clearLabel ?? 'Clear');

  constructor() {
    effect(() => {
      const sel = this.selected();
      this._selected.set(sel);
    });
  }

  readonly classes = computed(() => cn(
    'flex flex-col',
    this.class()
  ));

  /**
   * Calendar `selectedChange` handler. Non-`Date` payloads (the range/multiple
   * calendar modes) are ignored, so nothing is emitted for them.
   */
  onDateSelect(value: unknown): void {
    if (value instanceof Date) {
      this._selected.set(value);
      this.filterChange.emit(value);
    }
  }

  /**
   * Selects the current local date with the time truncated to midnight, and
   * emits it — matching the day-granularity comparison {@link dateFilterFn}
   * performs.
   */
  selectToday(): void {
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this._selected.set(dateOnly);
    this.filterChange.emit(dateOnly);
  }

  /** Drops the selection and emits `null`, which {@link dateFilterFn} treats as "no filter". */
  clear(): void {
    this._selected.set(null);
    this.filterChange.emit(null);
  }
}

export function dateFilterFn<TRow>(
  row: TRow,
  filterValue: Date | null,
  getValue: (row: TRow) => unknown
): boolean {
  if (!filterValue) return true;
  const cellDate = toDate(getValue(row));
  if (!cellDate) return false;
  return toDateOnlyTimestamp(cellDate) === toDateOnlyTimestamp(filterValue);
}
