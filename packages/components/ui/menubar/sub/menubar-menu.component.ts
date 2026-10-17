import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  InjectionToken,
  forwardRef,
  input,
} from '@angular/core';
import { MenubarService } from '../menubar.component';
import { cn } from '../../../lib/utils';

export const MENUBAR_MENU = new InjectionToken<MenubarMenuComponent>('MENUBAR_MENU');

let nextId = 0;

@Component({
  selector: 'ui-menubar-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MENUBAR_MENU, useExisting: forwardRef(() => MenubarMenuComponent) }],
  template: `
    <div [class]="classes()" [attr.data-slot]="'menubar-menu'" role="none">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class MenubarMenuComponent {
  /** Extra classes merged onto the element this component renders, after its built-in styling. */
  readonly class = input('');
  readonly classes = computed(() => cn('relative', this.class()));

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

  /**
   * {@link close}, handing focus back to this menu's trigger first: the panel
   * leaves the DOM on close, and focus inside it would fall to `<body>`.
   */
  closeAndFocusTrigger(): void {
    this.service.menus.get(this.id)?.trigger?.focus();
    this.close();
  }

  /**
   * {@link closeAndFocusTrigger} for an item activation. Focus is handed back
   * after the key event: Enter's default action would otherwise click the
   * trigger focus just landed on and reopen the menu.
   */
  closeAfterActivation(): void {
    const trigger = this.service.menus.get(this.id)?.trigger;
    setTimeout(() => trigger?.focus());
    this.close();
  }
}
