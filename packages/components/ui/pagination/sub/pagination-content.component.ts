import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-pagination-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"pagination-content"',
  },
})
export class PaginationContentComponent {
  /** Extra classes merged onto the row of pagination items. Only needed in template mode; the built-in bar renders its own row (and, unlike this one, lets it wrap). */
  class = input('');

  classes = computed(() => cn('flex flex-row items-center gap-1', this.class()));
}
