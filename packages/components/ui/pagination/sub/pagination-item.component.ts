import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-pagination-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"pagination-item"',
  },
})
export class PaginationItemComponent {
  class = input('');
  classes = computed(() => cn('', this.class()));
}
