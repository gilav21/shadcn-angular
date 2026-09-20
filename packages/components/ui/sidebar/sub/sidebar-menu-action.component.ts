import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SidebarService } from '../sidebar.service';

/**
 * Trailing action on a menu row — the "…" button that opens a row's own menu.
 *
 * Sits as a sibling of the row's button/link inside `ui-sidebar-menu-item`,
 * positioned absolutely against it, so it does not join the row's own click
 * target. The item is `relative` for this reason.
 *
 * On a fine pointer it fades in on row hover or when it takes focus. On touch
 * there is no hover, so {@link showOnHover} is ignored under
 * `(hover: none)` and the button is always visible — an action that only
 * appears on hover is unreachable on a phone.
 */
@Component({
  selector: 'ui-sidebar-menu-action',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'sidebar-menu-action'"
      [attr.data-collapsed]="isCollapsedState()"
      [attr.aria-label]="label() || null"
      (click)="onClick($event)"
    >
      <ng-content />
    </button>
  `,
  styleUrl: './sidebar-menu-action.component.css',
  host: { class: 'contents' },
})
export class SidebarMenuActionComponent {
  /** Extra classes merged onto the `<button>`. */
  readonly class = input('');
  /** Accessible name — the icon alone says nothing to a screen reader. Worth setting on every action. */
  readonly label = input('');
  /**
   * Keep the action hidden until the row is hovered or the button is focused.
   * Ignored on touch devices, where it is always visible.
   */
  readonly showOnHover = input(false);
  /** The click, with propagation stopped so it never triggers the row behind it. */
  readonly triggered = output<MouseEvent>();

  private readonly service = inject(SidebarService);

  readonly isCollapsedState = computed(
    () => this.service.isCollapsed() && !this.service.isMobile()
  );

  /** Stops the event so activating the action does not also navigate the row. */
  onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.triggered.emit(event);
  }

  readonly classes = computed(() =>
    cn(
      'absolute end-1 top-1/2 -translate-y-1/2 flex items-center justify-center',
      'size-6 rounded-md text-sidebar-foreground/70',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'transition-opacity [&>svg]:size-4 [&>svg]:shrink-0',
      // A 60px rail has no room for a second control beside the icon.
      this.isCollapsedState() && 'hidden',
      this.showOnHover() && 'sidebar-action-hover-only',
      this.class()
    )
  );
}
