import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-sidebar-group-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-group-content'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarGroupContentComponent {
  /** Extra classes merged onto the group body — the column that holds a group's menu. Unlike the label it stays visible on a collapsed rail. */
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-1',
    this.class()
  ));
}
