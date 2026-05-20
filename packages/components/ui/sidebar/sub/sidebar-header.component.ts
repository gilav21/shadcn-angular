import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SidebarService } from '../sidebar.component';

@Component({
  selector: 'ui-sidebar-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-header'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarHeaderComponent {
  class = input('');
  readonly service = inject(SidebarService);

  classes = computed(() => cn(
    'flex flex-col gap-2 p-4',
    this.service.isCollapsed() && !this.service.isMobile() && 'overflow-hidden [&>*]:sr-only',
    this.class()
  ));
}
