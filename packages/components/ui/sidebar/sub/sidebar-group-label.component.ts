import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SidebarService } from '../sidebar.service';

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
  /** Extra classes merged onto the group heading. On a collapsed desktop rail the label becomes `sr-only` — still announced, but taking no space — so groups are distinguishable to screen readers even when the rail is icon-only. */
  class = input('');
  readonly service = inject(SidebarService);

  classes = computed(() => cn(
    'px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70',
    this.service.isCollapsed() && !this.service.isMobile() && 'sr-only',
    this.class()
  ));
}
