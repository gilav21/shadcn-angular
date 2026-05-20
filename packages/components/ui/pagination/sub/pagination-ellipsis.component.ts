import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-pagination-ellipsis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()" [attr.data-slot]="'pagination-ellipsis'" aria-hidden="true">
      <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
      </svg>
      <span class="sr-only">More pages</span>
    </span>
  `,
  host: { class: 'contents' },
})
export class PaginationEllipsisComponent {
  class = input('');

  classes = computed(() => cn(
    'flex h-9 w-9 items-center justify-center',
    this.class()
  ));
}
