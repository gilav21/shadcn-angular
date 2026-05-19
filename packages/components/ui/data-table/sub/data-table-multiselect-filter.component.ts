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
import {
  CommandComponent,
  CommandInputComponent,
  CommandListComponent,
  CommandEmptyComponent,
  CommandItemComponent,
  CommandSeparatorComponent,
} from '../../command.component';
import { CheckboxComponent } from '../../checkbox.component';
import { BadgeComponent } from '../../badge';
import { ButtonComponent } from '../../button.component';

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
  readonly class = input('');
  readonly options = input<T[]>([]);
  readonly displayWith = input<(option: T) => string>(String);
  readonly valueWith = input<(option: T) => unknown>((o: T) => o);
  readonly placeholder = input('Search...');
  readonly title = input<string | undefined>(undefined);
  readonly selected = input<unknown[]>([]);

  readonly filterChange = output<unknown[] | null>();

  protected readonly String = String;

  private readonly _selected = signal<T[]>([]);

  readonly selectedValues = computed(() => {
    const vw = this.valueWith();
    return new Set(this._selected().map(o => vw(o)));
  });

  readonly selectedCount = computed(() => this._selected().length);

  constructor() {
    effect(() => {
      const selectedInput = this.selected();
      const opts = this.options();
      const vw = this.valueWith();

      if (selectedInput.length === 0) {
        this._selected.set([]);
        return;
      }

      const inputSet = new Set(selectedInput);
      const restored = opts.filter(o => inputSet.has(vw(o)));
      this._selected.set(restored);
    });
  }

  readonly classes = computed(() => cn(
    'flex flex-col',
    this.class()
  ));

  getDisplayLabel(option: T): string {
    return this.displayWith()(option);
  }

  trackOption(option: T): unknown {
    return this.valueWith()(option);
  }

  isSelected(option: T): boolean {
    return this.selectedValues().has(this.valueWith()(option));
  }

  toggleOption(option: T): void {
    const vw = this.valueWith();
    const val = vw(option);
    const current = this._selected();

    if (this.selectedValues().has(val)) {
      const next = current.filter(o => vw(o) !== val);
      this._selected.set(next);
      this.emitChange(next);
    } else {
      const next = [...current, option];
      this._selected.set(next);
      this.emitChange(next);
    }
  }

  selectAll(): void {
    const all = this.options();
    this._selected.set(all);
    this.emitChange(all);
  }

  clearAll(): void {
    this._selected.set([]);
    this.filterChange.emit(null);
  }

  private emitChange(selected: T[]): void {
    if (selected.length === 0) {
      this.filterChange.emit(null);
      return;
    }
    const vw = this.valueWith();
    this.filterChange.emit(selected.map(o => vw(o)));
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
