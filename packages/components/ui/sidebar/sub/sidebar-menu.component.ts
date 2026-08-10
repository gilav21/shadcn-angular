import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-sidebar-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul [class]="classes()" [attr.data-slot]="'sidebar-menu'">
      <ng-content />
    </ul>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuComponent {
  /** Extra classes merged onto the `<ul>` holding the nav items. Children should be `ui-sidebar-menu-item`s — anything else breaks the list semantics screen readers rely on. */
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-1',
    this.class()
  ));
}
