import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SortDirection } from './data-table.types';
import { ButtonComponent } from '../button.component';
import { IconComponent } from '../icon.component';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-data-table-column-header',
  imports: [
    CommonModule,
    ButtonComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="containerClasses()">
      @if (!enableSorting()) {
        <div>{{ title() }}</div>
      } @else {
        <ui-button
          variant="ghost"
          size="sm"
          class="-ml-3 h-8 data-[state=open]:bg-accent"
          (click)="toggleSort($event)"
        >
          <span>{{ title() }}</span>
          @if (direction() === 'desc') {
            <ui-icon name="arrow-down" class="ml-2 h-4 w-4" />
          } @else if (direction() === 'asc') {
            <ui-icon name="arrow-up" class="ml-2 h-4 w-4" />
          } @else {
            <ui-icon name="chevrons-up-down" class="ml-2 h-4 w-4" />
          }
          @if (sortIndex() !== null) {
            <span class="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] leading-none">
              {{ (sortIndex() ?? 0) + 1 }}
            </span>
          }
        </ui-button>
      }
    </div>
  `,
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

  containerClasses = computed(() => cn('flex items-center space-x-2', this.class()));

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
