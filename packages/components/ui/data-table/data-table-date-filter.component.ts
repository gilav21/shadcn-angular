import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { CalendarComponent, DateRange } from '../calendar.component';
import { ButtonComponent } from '../button.component';

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toDateOnlyTimestamp(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export interface DateRangePreset {
  readonly label: string;
  readonly range: DateRange;
}

@Component({
  selector: 'ui-data-table-date-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent, ButtonComponent],
  template: `
    <div [class]="classes()" [attr.data-slot]="'date-filter'">
      @if (title()) {
        <div class="flex items-center justify-between px-3 pb-2">
          <span class="text-sm font-medium">{{ title() }}</span>
        </div>
      }
      <div class="flex items-center gap-1 px-3 pb-2">
        <ui-button variant="outline" size="sm" class="h-7 text-xs" (clicked)="selectToday()">
          Today
        </ui-button>
        <ui-button variant="ghost" size="sm" class="h-7 text-xs" (clicked)="clear()">
          Clear
        </ui-button>
      </div>
      <ui-calendar
        mode="single"
        [selected]="selectedValue()"
        [showMonthSelect]="true"
        [showYearSelect]="true"
        [locale]="locale()"
        class="border-0 rounded-none"
        (selectedChange)="onDateSelect($event)"
      />
    </div>
  `,
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

@Component({
  selector: 'ui-data-table-date-range-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalendarComponent, ButtonComponent],
  template: `
    <div [class]="classes()" [attr.data-slot]="'date-range-filter'">
      @if (title()) {
        <div class="flex items-center justify-between px-3 pb-2">
          <span class="text-sm font-medium">{{ title() }}</span>
        </div>
      }
      <div class="flex flex-wrap items-center gap-1 px-3 pb-2">
        @for (preset of effectivePresets(); track preset.label) {
          <ui-button variant="outline" size="sm" class="h-7 text-xs" (clicked)="applyPreset(preset)">
            {{ preset.label }}
          </ui-button>
        }
        <ui-button variant="ghost" size="sm" class="h-7 text-xs" (clicked)="clear()">
          Clear
        </ui-button>
      </div>
      <ui-calendar
        mode="range"
        [selected]="selectedValue()"
        [showMonthSelect]="true"
        [showYearSelect]="true"
        [locale]="locale()"
        class="border-0 rounded-none"
        (selectedChange)="onRangeSelect($event)"
      />
    </div>
  `,
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
    return buildDefaultPresets();
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

function buildDefaultPresets(): DateRangePreset[] {
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return [
    {
      label: 'Today',
      range: { start: todayOnly, end: todayOnly },
    },
    {
      label: 'Last 7 days',
      range: {
        start: new Date(todayOnly.getFullYear(), todayOnly.getMonth(), todayOnly.getDate() - 6),
        end: todayOnly,
      },
    },
    {
      label: 'Last 30 days',
      range: {
        start: new Date(todayOnly.getFullYear(), todayOnly.getMonth(), todayOnly.getDate() - 29),
        end: todayOnly,
      },
    },
    {
      label: 'This month',
      range: {
        start: new Date(todayOnly.getFullYear(), todayOnly.getMonth(), 1),
        end: todayOnly,
      },
    },
  ];
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
