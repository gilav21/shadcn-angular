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
import { createLocaleBindings, type LocaleInput } from '../../../lib/i18n';
import { DATA_TABLE_LOCALES, type DataTableLocale } from '../data-table.locales';
import {
  CommandComponent,
  CommandInputComponent,
  CommandListComponent,
  CommandEmptyComponent,
  CommandItemComponent,
  CommandSeparatorComponent,
} from '../../command';
import { CheckboxComponent } from '../../checkbox';
import { BadgeComponent } from '../../badge';
import { ButtonComponent } from '../../button';

@Component({
  selector: 'ui-data-table-multiselect-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommandComponent,
    CommandInputComponent,
    CommandListComponent,
    CommandEmptyComponent,
    CommandItemComponent,
    CommandSeparatorComponent,
    CheckboxComponent,
    BadgeComponent,
    ButtonComponent,
  ],
  templateUrl: './data-table-multiselect-filter.component.html',
  host: { class: 'contents' },
})
export class DataTableMultiselectFilterComponent<T = unknown> {
  /** Extra classes merged onto the panel wrapper (the command palette keeps its own). */
  readonly class = input('');
  /**
   * The full option list. Every option is rendered — the search box filters the
   * DOM via `ui-command`, it does not narrow this array, so {@link selectAll}
   * still selects everything regardless of the current search text.
   */
  readonly options = input<T[]>([]);
  /** Maps an option to its visible label, also used as the command item's search text. */
  readonly displayWith = input<(option: T) => string>(String);
  /**
   * Maps an option to the value emitted on {@link filterChange} and compared
   * against the cell value by {@link multiselectFilterFn}. Comparison is by
   * `Set`/`includes` identity, so object values must be referentially stable —
   * project to a primitive key here for object options.
   */
  readonly valueWith = input<(option: T) => unknown>((o: T) => o);
  /** Override for the command-input placeholder. Falls back to the locale's `searchPlaceholder`. */
  readonly placeholder = input<string>();
  /** Optional heading above the palette; when set, a badge shows the selected count. */
  readonly title = input<string | undefined>(undefined);
  /**
   * Externally-held selection, expressed as {@link valueWith} values (not
   * options). Values are kept as given — one with no matching option yet (or
   * ever) stays selected and is re-emitted with the rest, so `selected` may be
   * set before {@link options} arrives.
   */
  readonly selected = input<unknown[]>([]);

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<DataTableLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, DATA_TABLE_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

  readonly resolvedPlaceholder = computed(() => this.placeholder() ?? this.t().searchPlaceholder ?? 'Search...');
  readonly selectAllLabel = computed(() => this.t().selectAllRows ?? 'Select all');
  readonly clearAllLabel = computed(() => this.t().clearAll ?? 'Clear');
  readonly noResultsLabel = computed(() => this.t().noResultsLabel ?? 'No results.');

  /**
   * The selected {@link valueWith} values after each toggle, or `null` when the
   * selection becomes empty — `null` means "no filter" to
   * {@link multiselectFilterFn}, so an empty array is never emitted.
   */
  readonly filterChange = output<unknown[] | null>();

  protected readonly String = String;

  private readonly _selected = signal<unknown[]>([]);

  readonly selectedValues = computed(() => new Set(this._selected()));

  readonly selectedCount = computed(() => this._selected().length);

  constructor() {
    effect(() => {
      const selectedInput = this.selected();
      this._selected.set([...new Set(selectedInput)]);
    });
  }

  readonly classes = computed(() => cn(
    'flex flex-col',
    this.class()
  ));

  /** Applies {@link displayWith} to an option (label, checkbox aria-label and search text). */
  getDisplayLabel(option: T): string {
    return this.displayWith()(option);
  }

  /** `@for` track key — the option's {@link valueWith} value, so it must be unique per option. */
  trackOption(option: T): unknown {
    return this.valueWith()(option);
  }

  /** Whether the option's value is in the current selection (by {@link valueWith} identity). */
  isSelected(option: T): boolean {
    return this.selectedValues().has(this.valueWith()(option));
  }

  /**
   * Adds or removes an option and emits the new selection. Newly selected
   * options are appended, so emission order is selection order, not
   * {@link options} order.
   */
  toggleOption(option: T): void {
    const val = this.valueWith()(option);
    const current = this._selected();
    const next = this.selectedValues().has(val)
      ? current.filter(v => v !== val)
      : [...current, val];

    this._selected.set(next);
    this.emitChange(next);
  }

  /**
   * Selects every entry of {@link options} — including ones hidden by the
   * current search text — keeping any already-selected value that has no
   * option, and emits the result. With no options and nothing already selected
   * this emits `null`.
   */
  selectAll(): void {
    const vw = this.valueWith();
    const all = [...new Set([...this._selected(), ...this.options().map(o => vw(o))])];
    this._selected.set(all);
    this.emitChange(all);
  }

  /** Empties the selection and emits `null` ("no filter"), leaving the search text alone. */
  clearAll(): void {
    this._selected.set([]);
    this.filterChange.emit(null);
  }

  private emitChange(selected: unknown[]): void {
    if (selected.length === 0) {
      this.filterChange.emit(null);
      return;
    }
    this.filterChange.emit([...selected]);
  }
}

export function multiselectFilterFn<TRow>(
  row: TRow,
  filterValue: unknown[] | null,
  getValue: (row: TRow) => unknown
): boolean {
  if (!filterValue || filterValue.length === 0) return true;
  const rowVal = getValue(row);
  return filterValue.includes(rowVal);
}
