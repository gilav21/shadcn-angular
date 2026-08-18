import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { NAVIGATION_MENU_ITEM } from './navigation-menu-item.component';

@Component({
  selector: 'ui-navigation-menu-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="menuitem"
      [class]="classes()"
      [attr.data-slot]="'navigation-menu-trigger'"
      [attr.aria-expanded]="item.isOpen()"
      [attr.aria-haspopup]="'menu'"
      [attr.data-state]="item.isOpen() ? 'open' : 'closed'"
      (click)="onClick()"
    >
      <ng-content />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="relative top-px ml-1 h-3 w-3 transition duration-200"
        [class.rotate-180]="item.isOpen()"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>
  `,
  styleUrl: './navigation-menu-trigger.component.css',
  host: { class: 'contents' },
})
export class NavigationMenuTriggerComponent {
  /**
   * Extra classes merged onto the `<button>`. The base classes make it a `w-max shrink-0`
   * inline-flex row (label plus the chevron that rotates 180° while open) with `rounded-md`,
   * `bg-background`, `text-sm font-medium`, `hover:`/`focus:` accent colouring, disabled
   * styling, and a `bg-accent/50` tint while the item is open. Height and inline/block padding
   * come from the density CSS variables (`--density-menu` / `--density`), so `h-*` / `p-*`
   * classes here opt out of density scaling.
   */
  class = input('');
  readonly item = inject(NAVIGATION_MENU_ITEM);

  classes = computed(() => cn(
    'group inline-flex w-max shrink-0 items-center justify-center rounded-md bg-background text-sm font-medium',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
    'disabled:pointer-events-none disabled:opacity-50',
    this.item.isOpen() && 'bg-accent/50',
    'transition-colors',
    this.class()
  ));

  /**
   * Click/tap toggle for the parent item's dropdown — the touch-device open path, since the
   * item's hover handlers no-op there. With a mouse it fires on top of hover: clicking an
   * already hover-opened trigger closes the panel, and it reopens on the next click (leaving and
   * re-entering with the pointer also reopens it). Toggling updates `aria-expanded` and the
   * `data-state` attribute via {@link NavigationMenuItemComponent.isOpen}.
   */
  onClick(): void {
    if (this.item.isOpen()) {
      this.item.close();
    } else {
      this.item.open();
    }
  }
}
