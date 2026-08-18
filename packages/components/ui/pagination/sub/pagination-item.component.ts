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
  /** Extra classes merged onto the item wrapper, which carries no styling of its own — it exists as a slot for one link, ellipsis or nav button in template mode. */
  class = input('');
  classes = computed(() => cn('', this.class()));
}
