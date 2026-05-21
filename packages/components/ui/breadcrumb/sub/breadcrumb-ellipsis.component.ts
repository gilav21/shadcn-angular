import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-breadcrumb-ellipsis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span role="presentation" aria-hidden="true" [class]="classes()">
      <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </svg>
      <span class="sr-only">More</span>
    </span>
  `,
  host: {
    class: 'contents',
    '[attr.data-slot]': '"breadcrumb-ellipsis"',
  },
})
export class BreadcrumbEllipsisComponent {
  class = input('');

  classes = computed(() => cn('flex h-9 w-9 items-center justify-center', this.class()));
}
