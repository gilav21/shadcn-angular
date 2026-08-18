import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-sidebar-inset',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main [class]="classes()" [attr.data-slot]="'sidebar-inset'">
      <ng-content />
    </main>
  `,
  host: {
    '[class]': '"flex flex-1 flex-col min-w-0 max-h-screen " + class()',
  },
})
export class SidebarInsetComponent {
  /** Extra classes merged onto the `<main>` region that sits beside the sidebar. It is applied to both the host and the inner element, so a background utility here paints the whole page area. It is capped at `max-h-screen` with `overflow-hidden`, so long page content needs its own scroll container. */
  class = input('');

  classes = computed(() => cn(
    'flex flex-1 flex-col overflow-hidden',
    this.class()
  ));
}
