import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-sidebar-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-footer'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarFooterComponent {
  /** Extra classes merged onto the footer. It is pinned to the bottom with `mt-auto`, so it stays put while the content region scrolls. Unlike the header it is *not* hidden when the rail collapses — give collapse-unfriendly content its own handling. */
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-2 p-4 mt-auto',
    this.class()
  ));
}
