import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-sidebar-menu-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <li [class]="classes()" [attr.data-slot]="'sidebar-menu-item'" role="menuitem">
      <ng-content />
    </li>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuItemComponent {
  class = input('');

  classes = computed(() => cn(
    'list-none',
    this.class()
  ));
}
