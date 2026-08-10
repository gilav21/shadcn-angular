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
  selector: 'ui-sidebar-menu-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [class]="classes()"
      [attr.data-slot]="'sidebar-menu-link'"
      [attr.data-active]="isActive()"
      [attr.data-collapsed]="isCollapsedState()"
      [href]="href()"
    >
      <ng-content />
    </a>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuLinkComponent {
  /** Extra classes merged onto the `<a>`. */
  class = input('');
  /** Plain `href`. This is a real anchor, not a router link — for in-app routing use {@link SidebarMenuButtonComponent} and navigate from its click, or add `routerLink` to your own copy of this file. */
  href = input('#');
  /** Marks the link as current — accent background plus `data-active`. Presentational only; nothing compares it against the active route. */
  isActive = input(false);
  readonly service = inject(SidebarService);

  isCollapsedState = computed(() => this.service.isCollapsed() && !this.service.isMobile());

  classes = computed(() => {
    const isCollapsed = this.isCollapsedState();

    return cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
      'text-sidebar-foreground no-underline',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'transition-colors',
      this.isActive() && 'bg-sidebar-accent text-sidebar-accent-foreground',
      isCollapsed && 'justify-center px-2 overflow-hidden [&>span:not(:first-child)]:hidden [&>svg]:shrink-0',
      this.class()
    );
  });
}
