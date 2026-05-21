import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-breadcrumb-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    role: 'link',
    '[attr.aria-disabled]': 'true',
    '[attr.aria-current]': '"page"',
    '[class]': 'classes()',
    '[attr.data-slot]': '"breadcrumb-page"',
  },
})
export class BreadcrumbPageComponent {
  class = input('');

  classes = computed(() => cn('text-foreground font-normal', this.class()));
}
