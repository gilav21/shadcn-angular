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
  class = input('');

  classes = computed(() => cn('flex flex-row items-center gap-1', this.class()));
}
