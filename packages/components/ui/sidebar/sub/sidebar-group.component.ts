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
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-1 px-2 py-2',
    this.class()
  ));
}
