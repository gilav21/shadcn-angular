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
  /** Extra classes merged onto the header. On a collapsed desktop rail every direct child is pushed to `sr-only`, so a logo placed here disappears rather than shrinking — put a rail-safe icon inside the sidebar body if you need one visible. */
  class = input('');
  readonly service = inject(SidebarService);

  classes = computed(() => cn(
    'flex flex-col gap-2 p-4',
    this.service.isCollapsed() && !this.service.isMobile() && 'overflow-hidden [&>*]:sr-only',
    this.class()
  ));
}
