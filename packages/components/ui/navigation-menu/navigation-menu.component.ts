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
  Injector,
  afterNextRender,
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
    '(keydown)': 'onKeydown($event)',
    '(focusout)': 'onFocusOut($event)',
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
  private readonly injector = inject(Injector);

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

  /**
   * Keyboard model, bound to `keydown` on the host. On the bar: Left/Right (mirrored in RTL) and
   * Home/End move between top-level entries and carry an open panel to the next trigger; Down
   * opens a trigger's panel and focuses its first link. In a panel: Up/Down, Home/End walk the
   * links; Escape closes the panel and returns focus to its trigger.
   */
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const panel = target.closest<HTMLElement>('[data-slot="navigation-menu-content"]');
    if (event.key === 'Escape') {
      this.closeAndRefocus(target, panel);
    } else if (panel) {
      this.onPanelKey(event, panel);
    } else {
      this.onBarKey(event, target);
    }
  }

  /**
   * Closes the open panel when focus lands on a top-level entry of another item, or leaves the
   * menu altogether. A `null` `relatedTarget` (a click on non-focusable panel padding, or the
   * window losing focus) is ignored: pointer dismissal is {@link onClick}'s job.
   */
  onFocusOut(event: FocusEvent): void {
    const active = this.service.activeItem();
    const next = event.relatedTarget as HTMLElement | null;
    if (!active || !next) return;
    const openItem = this.itemElement(active);
    if (!openItem?.contains(next)) this.service.setActive(null);
  }

  private onBarKey(event: KeyboardEvent, target: HTMLElement): void {
    const bar = this.barItems();
    const index = bar.indexOf(target);
    if (index < 0) return;
    const rtl = getComputedStyle(this.el.nativeElement.querySelector('nav') ?? this.el.nativeElement).direction === 'rtl';
    const step = rtl ? -1 : 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = index + step; break;
      case 'ArrowLeft': next = index - step; break;
      case 'Home': next = 0; break;
      case 'End': next = bar.length - 1; break;
      case 'ArrowDown':
        if (target.dataset['slot'] !== 'navigation-menu-trigger') return;
        event.preventDefault();
        this.openAndFocusFirst(target);
        return;
      default: return;
    }
    event.preventDefault();
    this.moveOnBar(bar[(next + bar.length) % bar.length]);
  }

  private moveOnBar(entry: HTMLElement): void {
    const carry = this.service.activeItem() !== null && entry.dataset['slot'] === 'navigation-menu-trigger';
    entry.focus();
    this.service.setActive(carry ? (entry.closest<HTMLElement>('[data-item-id]')?.dataset['itemId'] ?? null) : null);
  }

  private onPanelKey(event: KeyboardEvent, panel: HTMLElement): void {
    const links = Array.from(panel.querySelectorAll<HTMLElement>('a[data-slot="navigation-menu-link"]'));
    const index = links.indexOf(event.target as HTMLElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = index + 1; break;
      case 'ArrowUp': next = index - 1; break;
      case 'Home': next = 0; break;
      case 'End': next = links.length - 1; break;
      default: return;
    }
    event.preventDefault();
    if (links.length) links[(next + links.length) % links.length].focus();
  }

  private closeAndRefocus(target: HTMLElement, panel: HTMLElement | null): void {
    const active = this.service.activeItem();
    if (!active) return;
    const trigger = (panel ?? target).closest('[data-item-id]')?.querySelector<HTMLElement>('[data-slot="navigation-menu-trigger"]');
    this.service.setActive(null);
    trigger?.focus();
  }

  private openAndFocusFirst(trigger: HTMLElement): void {
    const id = trigger.closest<HTMLElement>('[data-item-id]')?.dataset['itemId'];
    if (!id) return;
    this.service.setActive(id);
    afterNextRender(() => {
      this.itemElement(id)?.querySelector<HTMLElement>('a[data-slot="navigation-menu-link"]')?.focus();
    }, { injector: this.injector });
  }

  private itemElement(id: string): HTMLElement | null {
    return this.el.nativeElement.querySelector(`[data-item-id="${id}"]`);
  }

  private barItems(): HTMLElement[] {
    const root: HTMLElement = this.el.nativeElement;
    return Array.from(
      root.querySelectorAll<HTMLElement>('[data-slot="navigation-menu-trigger"], a[data-slot="navigation-menu-link"]'),
    ).filter(entry => !entry.closest('[data-slot="navigation-menu-content"]'));
  }
}
