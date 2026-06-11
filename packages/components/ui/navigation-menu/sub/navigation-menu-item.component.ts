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
  class = input('');
  id = `nav-menu-item-${nextId++}`;
  readonly service = inject(NavigationMenuService);

  isOpen = computed(() => this.service.isActive(this.id));

  classes = computed(() => cn(
    'relative',
    this.class()
  ));

  onMouseEnter(): void {
    if (isTouchDevice()) return;
    this.service.cancelClose();
    this.service.setActive(this.id);
  }

  onMouseLeave(): void {
    if (isTouchDevice()) return;
    this.service.scheduleClose();
  }

  open(): void {
    this.service.setActive(this.id);
  }

  close(): void {
    this.service.setActive(null);
  }
}
