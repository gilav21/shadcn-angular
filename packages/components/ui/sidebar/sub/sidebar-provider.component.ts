import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SidebarService } from '../sidebar.service';

/**
 * SidebarProvider - Wraps the sidebar and main content
 */
@Component({
  selector: 'ui-sidebar-provider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SidebarService],
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'sidebar-provider'"
      [attr.data-state]="service.isOpen() ? 'open' : 'closed'"
      [attr.data-collapsed]="service.isCollapsed()"
    >
      <ng-content />
    </div>
  `,
  host: {
    class: 'contents',
    '(window:resize)': 'onResize()',
  },
})
export class SidebarProviderComponent {
  class = input('');
  readonly service = inject(SidebarService);

  constructor() {
    this.checkMobile();
  }

  classes = computed(() => cn(
    'flex min-h-screen w-full overflow-hidden',
    this.class()
  ));

  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    const isMobile = globalThis.window !== undefined && globalThis.window.innerWidth < 768;
    this.service.setMobile(isMobile);
  }
}
