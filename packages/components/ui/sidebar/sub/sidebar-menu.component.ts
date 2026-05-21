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
    <ul [class]="classes()" [attr.data-slot]="'sidebar-menu'" role="menu">
      <ng-content />
    </ul>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuComponent {
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-1',
    this.class()
  ));
}
