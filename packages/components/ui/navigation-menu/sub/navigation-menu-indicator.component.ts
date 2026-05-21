import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { NavigationMenuService } from '../navigation-menu.service';

@Component({
  selector: 'ui-navigation-menu-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="classes()"
      [attr.data-slot]="'navigation-menu-indicator'"
    >
      <div class="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md"></div>
    </div>
  `,
  host: { class: 'contents' },
})
export class NavigationMenuIndicatorComponent {
  class = input('');
  readonly service = inject(NavigationMenuService);

  classes = computed(() => cn(
    'top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden',
    'data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in',
    this.class()
  ));
}
