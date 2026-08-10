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
  /**
   * Extra classes merged onto the arrow wrapper. The base classes give it
   * `top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden` plus fade
   * in/out variants keyed on `data-[state=visible|hidden]`; the rotated square inside is the
   * arrow itself. The wrapper is not positioned (no `absolute` and no horizontal offset) and
   * the component renders unconditionally without writing a `data-state` attribute, so it
   * neither follows the open item nor hides itself — pass positioning/visibility classes
   * driven by your own state (e.g. off {@link NavigationMenuService.activeItem}) if you use it.
   */
  class = input('');
  readonly service = inject(NavigationMenuService);

  classes = computed(() => cn(
    'top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden',
    'data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in',
    this.class()
  ));
}
