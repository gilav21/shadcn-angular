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
  class = input('');
  /** Data-driven items for simple mode. When provided (and no content is projected), renders the menu automatically. */
  items = input<NavigationMenuItem[]>([]);

  readonly service = inject(NavigationMenuService);
  readonly el = inject(ElementRef);

  @ContentChild(NavigationMenuListComponent) customList?: NavigationMenuListComponent;

  private readonly _hasCustomContent = signal(true);
  hasCustomContent = this._hasCustomContent.asReadonly();

  ngAfterContentInit() {
    this._hasCustomContent.set(!!this.customList || this.items().length === 0);
  }

  classes = computed(() => cn(
    'relative z-10 flex max-w-full sm:max-w-max flex-1 items-center justify-center',
    this.class()
  ));

  onClick(event: MouseEvent) {
    if (this.service.activeItem() && !this.el.nativeElement.contains(event.target)) {
      this.service.setActive(null);
    }
  }
}
