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
import {
  CommandComponent,
  CommandInputComponent,
  CommandListComponent,
  CommandEmptyComponent,
  CommandItemComponent,
  CommandSeparatorComponent,
} from '../command.component';
import { CheckboxComponent } from '../checkbox.component';
import { BadgeComponent } from '../badge.component';
import { ButtonComponent } from '../button.component';

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
  template: `
    <div [class]="classes()" [attr.data-slot]="'multiselect-filter'">
      @if (title()) {
        <div class="flex items-center justify-between px-2 pb-2">
          <span class="text-sm font-medium">{{ title() }}</span>
          @if (selectedCount() > 0) {
            <ui-badge variant="secondary" [label]="String(selectedCount())" class="text-xs" />
          }
        </div>
      }
      <ui-command [shouldFilter]="true">
        <ui-command-input [placeholder]="placeholder()" />
        <div class="flex items-center gap-1 px-2 py-1.5">
          <ui-button variant="ghost" size="sm" class="h-7 text-xs" (clicked)="selectAll()">
            Select all
          </ui-button>
          <ui-button variant="ghost" size="sm" class="h-7 text-xs" (clicked)="clearAll()">
            Clear
          </ui-button>
        </div>
        <ui-command-separator />
        <ui-command-list class="max-h-64">
          <ui-command-empty>No results.</ui-command-empty>
          @for (option of options(); track trackOption(option)) {
            <ui-command-item
              [value]="getDisplayLabel(option)"
              (select)="toggleOption(option)"
              class="gap-2"
            >
              <ui-checkbox
                [checked]="isSelected(option)"
                [ariaLabel]="getDisplayLabel(option)"
              />
              <span>{{ getDisplayLabel(option) }}</span>
            </ui-command-item>
          }
        </ui-command-list>
      </ui-command>
    </div>
  `,
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
