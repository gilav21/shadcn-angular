import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  ElementRef,
  ContentChild,
  AfterContentInit,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { NavigationMenuService } from './navigation-menu.service';
import { NavigationMenuListComponent } from './sub/navigation-menu-list.component';
import { NavigationMenuItemComponent } from './sub/navigation-menu-item.component';
import { NavigationMenuTriggerComponent } from './sub/navigation-menu-trigger.component';
import { NavigationMenuContentComponent } from './sub/navigation-menu-content.component';
import { NavigationMenuLinkComponent } from './sub/navigation-menu-link.component';

/** A child link within a navigation menu dropdown */
export interface NavigationMenuChild {
  title: string;
  description?: string;
  href: string;
}

/** A top-level navigation menu item */
export interface NavigationMenuItem {
  label: string;
  href?: string;
  children?: NavigationMenuChild[];
}

@Component({
  selector: 'ui-navigation-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NavigationMenuService],
  imports: [
    NavigationMenuListComponent,
    NavigationMenuItemComponent,
    NavigationMenuTriggerComponent,
    NavigationMenuContentComponent,
    NavigationMenuLinkComponent,
  ],
  templateUrl: './navigation-menu.component.html',
  host: {
    class: 'contents',
    '(document:click)': 'onClick($event)',
  },
})
export class NavigationMenuComponent implements AfterContentInit {
  /**
   * Extra classes merged onto the `<nav>` element. The base classes already make it a
   * `relative z-10 flex` row that centers its content and is capped at `max-w-full` below
   * the `sm` breakpoint / `max-w-max` above it — override those if the menu should stretch
   * or stack. The `relative` is the positioning context every open
   * {@link NavigationMenuContentComponent} panel is absolutely placed against, so replacing
   * it with `static` will make dropdowns escape the menu.
   */
  class = input('');
  /** Data-driven items for simple mode. When provided (and no content is projected), renders the menu automatically. */
  items = input<NavigationMenuItem[]>([]);

  readonly service = inject(NavigationMenuService);
  readonly el = inject(ElementRef);

  @ContentChild(NavigationMenuListComponent) customList?: NavigationMenuListComponent;

  private readonly _hasCustomContent = signal(true);
  hasCustomContent = this._hasCustomContent.asReadonly();

  ngAfterContentInit(): void {
    this._hasCustomContent.set(!!this.customList || this.items().length === 0);
  }

  classes = computed(() => cn(
    'relative z-10 flex max-w-full sm:max-w-max flex-1 items-center justify-center',
    this.class()
  ));

  /**
   * Outside-click dismissal, bound to `document:click` on the host. Closes the open item
   * immediately (via {@link NavigationMenuService.setActive} with `null`, which also cancels
   * any pending hover close) whenever the click lands outside this menu's DOM subtree; clicks
   * on a trigger or inside a dropdown panel are ignored so they can do their own thing.
   * Note this is the only dismissal path besides hover-out and the trigger toggle — there is
   * no Escape handling, and activating a {@link NavigationMenuLinkComponent} does not close
   * the panel on its own (an in-page `#` link leaves the menu open).
   */
  onClick(event: MouseEvent): void {
    if (this.service.activeItem() && !this.el.nativeElement.contains(event.target)) {
      this.service.setActive(null);
    }
  }
}
