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

  toggle() {
    if (this.isOpen()) {
      this.service.setActive(null);
    } else {
      this.service.setActive(this.id);
    }
  }

  open() {
    this.service.setActive(this.id);
  }

  close() {
    if (this.isOpen()) {
      this.service.setActive(null);
    }
  }
}
