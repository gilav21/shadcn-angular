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
