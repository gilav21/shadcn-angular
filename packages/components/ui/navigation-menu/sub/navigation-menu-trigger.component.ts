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
  class = input('');
  readonly item = inject(NAVIGATION_MENU_ITEM);

  classes = computed(() => cn(
    'group inline-flex h-10 w-max shrink-0 items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
    'disabled:pointer-events-none disabled:opacity-50',
    this.item.isOpen() && 'bg-accent/50',
    'transition-colors',
    this.class()
  ));

  onClick(): void {
    if (this.item.isOpen()) {
      this.item.close();
    } else {
      this.item.open();
    }
  }
}
