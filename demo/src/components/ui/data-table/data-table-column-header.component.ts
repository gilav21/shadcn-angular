import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SortDirection } from './data-table.types';
import { ButtonComponent } from '../button.component';
import { LucideAngularModule } from 'lucide-angular';
import { cn } from '../../lib/utils';

@Component({
  selector: 'ui-data-table-column-header',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div [class]="containerClasses()">
      @if (!enableSorting()) {
        <div>{{ title() }}</div>
      } @else {
        <ui-button
          variant="ghost"
          size="sm"
          class="-ml-3 h-8 data-[state=open]:bg-accent"
          (click)="toggleSort()"
        >
          <span>{{ title() }}</span>
          @if (direction() === 'desc') {
            <lucide-icon name="arrow-down" class="ml-2 h-4 w-4" />
          } @else if (direction() === 'asc') {
            <lucide-icon name="arrow-up" class="ml-2 h-4 w-4" />
          } @else {
            <lucide-icon name="chevrons-up-down" class="ml-2 h-4 w-4" />
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

  sort = output<SortDirection>();

  containerClasses = computed(() => cn('flex items-center space-x-2', this.class()));

  toggleSort() {
    const current = this.direction();
    if (current === 'asc') {
      this.sort.emit('desc');
    } else if (current === 'desc') {
      this.sort.emit(null);
    } else {
      this.sort.emit('asc');
    }
  }
}
