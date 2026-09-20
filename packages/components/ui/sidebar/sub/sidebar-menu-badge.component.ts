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
 * Trailing count or status on a menu row — unread messages, open issues.
 *
 * Positioned against the row like {@link SidebarMenuActionComponent}, and
 * `aria-hidden` by default: a bare number announced after a link label is
 * noise, so give the row itself an accessible name that includes the count
 * (`aria-label="Inbox, 4 unread"`) and leave the badge decorative. Set
 * {@link announce} if the badge is genuinely the only place the information
 * exists.
 */
@Component({
  selector: 'ui-sidebar-menu-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      [class]="classes()"
      [attr.data-slot]="'sidebar-menu-badge'"
      [attr.data-collapsed]="isCollapsedState()"
      [attr.aria-hidden]="announce() ? null : 'true'"
    >
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuBadgeComponent {
  /** Extra classes merged onto the badge. */
  readonly class = input('');
  /** Expose the badge to screen readers instead of hiding it. Off by default — see the class doc. */
  readonly announce = input(false);

  private readonly service = inject(SidebarService);

  readonly isCollapsedState = computed(
    () => this.service.isCollapsed() && !this.service.isMobile()
  );

  readonly classes = computed(() =>
    cn(
      'pointer-events-none absolute end-2 top-1/2 -translate-y-1/2',
      'flex h-5 min-w-5 items-center justify-center rounded-full px-1',
      'text-xs font-medium tabular-nums',
      'bg-sidebar-accent text-sidebar-accent-foreground',
      // On a 60px rail the row is an icon; a floating count would sit on top of
      // it, so it shrinks to a dot pinned to the icon's corner instead.
      this.isCollapsedState() &&
        'end-1 top-1 h-2 min-w-2 translate-y-0 p-0 text-[0px] bg-sidebar-primary',
      this.class()
    )
  );
}
