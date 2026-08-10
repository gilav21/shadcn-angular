import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  InjectionToken,
  forwardRef,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { isTouchDevice } from '../../../lib/touch';
import { NavigationMenuService } from '../navigation-menu.service';

export const NAVIGATION_MENU_ITEM = new InjectionToken<NavigationMenuItemComponent>('NAVIGATION_MENU_ITEM');

let nextId = 0;

@Component({
  selector: 'ui-navigation-menu-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NAVIGATION_MENU_ITEM, useExisting: forwardRef(() => NavigationMenuItemComponent) }],
  template: `
    <li
      [class]="classes()"
      [attr.data-slot]="'navigation-menu-item'"
      role="none"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
    >
      <ng-content />
    </li>
  `,
  host: { class: 'contents' },
})
export class NavigationMenuItemComponent {
  /**
   * Extra classes merged onto the `<li>`. The only base class is `relative` — it is the
   * positioning context the item's {@link NavigationMenuContentComponent} panel anchors to,
   * so keep it (or supply your own containing block) or the dropdown will be placed against
   * the `<nav>` instead.
   */
  class = input('');
  id = `nav-menu-item-${nextId++}`;
  readonly service = inject(NavigationMenuService);

  isOpen = computed(() => this.service.isActive(this.id));

  classes = computed(() => cn(
    'relative',
    this.class()
  ));

  /**
   * Hover-to-open, bound to the `<li>`'s `mouseenter`. No-ops on touch devices, where opening
   * is the {@link NavigationMenuTriggerComponent}'s tap handler's job. Otherwise it cancels a
   * close pending from a previous {@link onMouseLeave} and opens this item, which closes any
   * other open one.
   */
  onMouseEnter(): void {
    if (isTouchDevice()) return;
    this.service.cancelClose();
    this.service.setActive(this.id);
  }

  /**
   * Hover-to-close, bound to the `<li>`'s `mouseleave`. No-ops on touch devices; otherwise it
   * schedules the close 150ms out ({@link NavigationMenuService.scheduleClose}) rather than
   * closing at once, so the pointer can cross the gap between trigger and panel. Because the
   * dropdown is rendered inside this `<li>`, moving into the panel does not fire this handler.
   */
  onMouseLeave(): void {
    if (isTouchDevice()) return;
    this.service.scheduleClose();
  }

  /**
   * Opens this item's dropdown immediately, closing whichever item was open and cancelling any
   * pending hover close. Public so a template ref (or the trigger's tap handler) can drive the
   * menu programmatically; {@link isOpen} reflects the result.
   */
  open(): void {
    this.service.setActive(this.id);
  }

  /**
   * Closes the menu immediately, skipping the 150ms grace period. Clears the shared active item
   * rather than just this one, so it closes whatever is open even if that is a sibling — call it
   * from a link's click handler to dismiss the panel on navigation, which does not happen
   * automatically.
   */
  close(): void {
    this.service.setActive(null);
  }
}
