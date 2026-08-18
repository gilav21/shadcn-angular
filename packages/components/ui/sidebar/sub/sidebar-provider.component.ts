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
  /** Extra classes merged onto the flex row that holds the sidebar and the inset. It is `min-h-screen w-full overflow-hidden`, so it wants to be the page-level wrapper. */
  class = input('');
  readonly service = inject(SidebarService);

  constructor() {
    this.checkMobile();
  }

  classes = computed(() => cn(
    'flex min-h-screen w-full overflow-hidden',
    this.class()
  ));

  /**
   * Re-evaluates the 768px mobile breakpoint on every window resize and pushes
   * it into the shared service. Unthrottled, and crossing into mobile
   * force-closes the drawer — so dragging a window narrow dismisses an open
   * sidebar. Also runs once at construction, which under SSR resolves to
   * desktop since there is no `window`.
   */
  onResize(): void {
    this.checkMobile();
  }

  private checkMobile(): void {
    const isMobile = 'window' in globalThis && globalThis.window.innerWidth < 768;
    this.service.setMobile(isMobile);
  }
}
