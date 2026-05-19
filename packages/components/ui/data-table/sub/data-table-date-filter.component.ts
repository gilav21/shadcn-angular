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
import { CalendarComponent } from '../../calendar.component';
import { ButtonComponent } from '../../button.component';
import { CALENDAR_LOCALES, CalendarLocale } from '../../../lib/calendar-locales';
import { toDate, toDateOnlyTimestamp } from './data-table-date-utils';

@Component({
  selector: 'ui-data-table-date-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent, ButtonComponent],
  templateUrl: './data-table-date-filter.component.html',
  host: { class: 'contents' },
})
export class DataTableDateFilterComponent {
  readonly class = input('');
  readonly title = input<string | undefined>(undefined);
  readonly locale = input('en');
  readonly selected = input<Date | null>(null);

  readonly filterChange = output<Date | null>();

  private readonly _selected = signal<Date | null>(null);
  readonly selectedValue = this._selected.asReadonly();

  private readonly activeLocale = computed((): CalendarLocale =>
    CALENDAR_LOCALES[this.locale()] ?? CALENDAR_LOCALES['en']
  );
  readonly isRtl = computed(() => this.activeLocale().rtl === true);
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

  onDateSelect(value: unknown): void {
    if (value instanceof Date) {
      this._selected.set(value);
      this.filterChange.emit(value);
    }
  }

  selectToday(): void {
    const today = new Date();
    const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this._selected.set(dateOnly);
    this.filterChange.emit(dateOnly);
  }

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
