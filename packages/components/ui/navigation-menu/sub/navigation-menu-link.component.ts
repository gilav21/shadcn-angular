import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-navigation-menu-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [class]="classes()"
      [attr.data-slot]="'navigation-menu-link'"
      [href]="href()"
      role="menuitem"
    >
      <ng-content />
    </a>
  `,
  styleUrl: './navigation-menu-link.component.css',
  host: { class: 'contents' },
})
export class NavigationMenuLinkComponent {
  /**
   * Extra classes merged onto the `<a>`. The base classes make it a `block select-none`
   * no-underline row with `rounded-md`, `space-y-1` between projected lines (title over
   * description) and `hover:`/`focus:` accent colouring. Padding comes from the density CSS
   * variables (`--density-menu` / `--density`), not a utility, so add `p-*` only to opt out.
   * Applied after {@link active}'s highlight, so a background class here overrides it.
   */
  class = input('');
  /**
   * The `href` of the rendered anchor. Defaults to `'#'`, which is a real in-page link — leaving
   * it unset gives a clickable no-op rather than an inert element. Always a plain anchor
   * navigation: there is no `routerLink` support and clicking does not close the dropdown, so
   * for in-app routing wire your own click handler and call
   * {@link NavigationMenuItemComponent.close}.
   */
  href = input('#');
  /**
   * Marks this link as the current one, tinting it `bg-accent/50` so it reads as selected next to
   * its siblings. Purely visual — it sets no `aria-current`, and nothing computes it for you;
   * derive it from your router state.
   */
  active = input(false);

  classes = computed(() => cn(
    'block select-none space-y-1 rounded-md leading-none no-underline outline-none transition-colors',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    this.active() && 'bg-accent/50',
    this.class()
  ));
}
