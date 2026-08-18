import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SortDirection } from '../data-table.types';
import { ButtonComponent } from '../../button';
import { IconComponent } from '../../icon';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-data-table-column-header',
  imports: [
    CommonModule,
    ButtonComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table-column-header.component.html',
})
export class DataTableColumnHeaderComponent {
  /** Header text rendered in the button, and the prefix of {@link sortAriaLabel}. */
  title = input('');
  /**
   * The column key this header sorts. Purely informational for consumers that
   * host the header themselves — the component never resolves it against data
   * and emits only a direction; the parent table maps it back to a column.
   */
  column = input('');
  /**
   * Current sort direction, rendered as the arrow icon. This is a *controlled*
   * input: {@link toggleSort} does not change it, it only emits the next
   * direction, so the parent must feed the new value back in.
   */
  direction = input<SortDirection>(null);
  /**
   * When false the header renders plain text instead of a button — no sort
   * affordance, no keyboard target, and {@link sort} never fires.
   */
  enableSorting = input(true);
  /** Extra classes merged onto the flex container (not onto the button). */
  class = input('');
  /**
   * Zero-based position of this column in a multi-sort chain; rendered as a
   * 1-based badge next to the arrow. `null` (the default) hides the badge —
   * pass it only while the table is in multi-sort mode.
   */
  sortIndex = input<number | null>(null);

  /**
   * The next direction in the asc → desc → null cycle. Emitted on every
   * activation; carries no modifier information — use {@link sortMeta} when
   * you need to distinguish a shift-click multi-sort.
   */
  sort = output<SortDirection>();
  /**
   * Same direction as {@link sort}, plus `multi: true` when the activating
   * event carried the shift key (a request to *add* to the sort chain rather
   * than replace it). Both outputs fire on every activation, in this order.
   */
  sortMeta = output<{ direction: SortDirection; multi: boolean }>();

  containerClasses = computed(() => cn('flex items-center gap-x-2', this.class()));

  /** Accessible label for the sort button — conveys current state and next action. */
  readonly sortAriaLabel = computed(() => {
    const title = this.title();
    const index = this.sortIndex();
    const priority = index === null ? '' : `, sort priority ${index + 1}`;
    const direction = this.direction();
    if (direction === 'asc') {
      return `${title}, sorted ascending${priority}. Activate to sort descending.`;
    }
    if (direction === 'desc') {
      return `${title}, sorted descending${priority}. Activate to remove sort.`;
    }
    return `${title}, not sorted. Activate to sort ascending.`;
  });

  /**
   * Advances the asc → desc → unsorted cycle and emits {@link sort} and
   * {@link sortMeta}. Bound to click, Enter and Space. Holding shift sets
   * `multi` on {@link sortMeta} only — the emitted direction is identical
   * either way, and no local state changes (see {@link direction}).
   */
  toggleSort(event: Event): void {
    const current = this.direction();
    const multi = 'shiftKey' in event && (event as MouseEvent).shiftKey;
    if (current === 'asc') {
      this.sort.emit('desc');
      this.sortMeta.emit({ direction: 'desc', multi });
    } else if (current === 'desc') {
      this.sort.emit(null);
      this.sortMeta.emit({ direction: null, multi });
    } else {
      this.sort.emit('asc');
      this.sortMeta.emit({ direction: 'asc', multi });
    }
  }
}
