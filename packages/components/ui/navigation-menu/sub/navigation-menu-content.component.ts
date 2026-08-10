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
  selector: 'ui-navigation-menu-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (item.isOpen()) {
      <div
        [class]="classes()"
        [attr.data-slot]="'navigation-menu-content'"
        [attr.data-state]="item.isOpen() ? 'open' : 'closed'"
        role="menu"
      >
        <ng-content />
      </div>
    }
  `,
  styleUrl: './navigation-menu-content.component.css',
  host: { class: 'contents' },
})
export class NavigationMenuContentComponent {
  /**
   * Extra classes merged onto the dropdown panel. The base classes already position it
   * `absolute` at `start-0 top-full mt-1.5` (start-relative, so it flips correctly in RTL)
   * against the parent {@link NavigationMenuItemComponent}, size it
   * `min-w-[200px] max-w-[calc(100vw-2rem)]` so it can never overflow a phone viewport, and
   * give it the popover surface (`rounded-md border bg-popover shadow-lg`) plus a
   * fade/zoom-in entry animation. Padding is not a utility here — it scales with the
   * `--density-menu` / `--density` CSS variables, so pass a `p-*` class only if you mean to
   * opt out of density. Override `start-0`/`top-full` to re-anchor the panel (e.g. `end-0`
   * for a right-aligned menu).
   */
  class = input('');
  readonly item = inject(NAVIGATION_MENU_ITEM);

  classes = computed(() => cn(
    'start-0 top-full mt-1.5',
    'absolute',
    'min-w-[200px] max-w-[calc(100vw-2rem)]',
    'rounded-md border bg-popover text-popover-foreground shadow-lg',
    'animate-in fade-in-0 zoom-in-95',
    this.class()
  ));
}
