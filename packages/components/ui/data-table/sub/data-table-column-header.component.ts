import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SortDirection } from '../data-table.types';
import { ButtonComponent } from '../../button.component';
import { IconComponent } from '../../icon.component';
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
  title = input('');
  column = input('');
  direction = input<SortDirection>(null);
  enableSorting = input(true);
  class = input('');
  sortIndex = input<number | null>(null);

  sort = output<SortDirection>();
  sortMeta = output<{ direction: SortDirection; multi: boolean }>();

  containerClasses = computed(() => cn('flex items-center gap-x-2', this.class()));

  /** Accessible label for the sort button — conveys current state and next action. */
  readonly sortAriaLabel = computed(() => {
    const title = this.title();
    const index = this.sortIndex();
    const priority = index !== null ? `, sort priority ${index + 1}` : '';
    const direction = this.direction();
    if (direction === 'asc') {
      return `${title}, sorted ascending${priority}. Activate to sort descending.`;
    }
    if (direction === 'desc') {
      return `${title}, sorted descending${priority}. Activate to remove sort.`;
    }
    return `${title}, not sorted. Activate to sort ascending.`;
  });

  toggleSort(event: MouseEvent) {
    const current = this.direction();
    const multi = event.shiftKey;
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
