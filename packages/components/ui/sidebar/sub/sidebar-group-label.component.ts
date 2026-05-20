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
  selector: 'ui-sidebar-group-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-group-label'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarGroupLabelComponent {
  class = input('');
  readonly service = inject(SidebarService);

  classes = computed(() => cn(
    'px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70',
    this.service.isCollapsed() && !this.service.isMobile() && 'sr-only',
    this.class()
  ));
}
