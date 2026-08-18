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
  /** Extra classes merged onto the current-page crumb. It renders as a disabled `role="link"` carrying `aria-current="page"` — the trail's endpoint, deliberately not clickable. */
  class = input('');

  classes = computed(() => cn('text-foreground font-normal', this.class()));
}
