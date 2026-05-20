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
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-2 p-4 mt-auto',
    this.class()
  ));
}
