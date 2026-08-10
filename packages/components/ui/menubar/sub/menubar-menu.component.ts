import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  InjectionToken,
  forwardRef,
} from '@angular/core';
import { MenubarService } from '../menubar.component';

export const MENUBAR_MENU = new InjectionToken<MenubarMenuComponent>('MENUBAR_MENU');

let nextId = 0;

@Component({
  selector: 'ui-menubar-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MENUBAR_MENU, useExisting: forwardRef(() => MenubarMenuComponent) }],
  template: `
    <div class="relative" [attr.data-slot]="'menubar-menu'" role="none">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class MenubarMenuComponent {
  id = `menubar-menu-${nextId++}`;
  readonly service = inject(MenubarService);
  isOpen = computed(() => this.service.isActive(this.id));

  /**
   * Flips this menu open or closed. Opening closes whichever sibling menu was
   * open, since the menubar allows only one at a time. Bound to the trigger's
   * click.
   */
  toggle(): void {
    if (this.isOpen()) {
      this.service.setActive(null);
    } else {
      this.service.setActive(this.id);
    }
  }

  /**
   * Opens this menu and closes any sibling that was open. Used by the trigger's
   * hover-to-switch behaviour and by ArrowDown/Enter on the trigger; unlike
   * {@link toggle} it is idempotent.
   */
  open(): void {
    this.service.setActive(this.id);
  }

  /**
   * Closes this menu, but only if it is the currently open one — calling it on
   * an inactive menu will not close a sibling. Invoked on Escape and after a
   * `ui-menubar-item` is selected.
   */
  close(): void {
    if (this.isOpen()) {
      this.service.setActive(null);
    }
  }
}
