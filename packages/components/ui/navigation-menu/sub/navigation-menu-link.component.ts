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
  class = input('');
  href = input('#');
  active = input(false);

  classes = computed(() => cn(
    'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    this.active() && 'bg-accent/50',
    this.class()
  ));
}
