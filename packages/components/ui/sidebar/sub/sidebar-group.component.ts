import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-sidebar-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-group'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarGroupComponent {
  /** Extra classes merged onto the group wrapper — one titled section of the nav, normally a `ui-sidebar-group-label` plus a `ui-sidebar-group-content`. */
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-1 px-2 py-2',
    this.class()
  ));
}
