import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-breadcrumb-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"breadcrumb-item"',
  },
})
export class BreadcrumbItemComponent {
  class = input('');

  classes = computed(() => cn('inline-flex items-center gap-1.5', this.class()));
}
