import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  ElementRef,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { MenubarService } from '../menubar.component';
import { MENUBAR_MENU, type MenubarMenuComponent } from './menubar-menu.component';

@Component({
  selector: 'ui-menubar-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (menu.isOpen()) {
      <div
        [class]="classes()"
        [attr.data-slot]="'menubar-content'"
        [attr.data-menubar-content]="menu.id"
        role="menu"
        (keydown)="onKeydown($event)"
      >
        <ng-content />
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class MenubarContentComponent {
  class = input('');
  readonly menu = inject(MENUBAR_MENU) as MenubarMenuComponent;
  readonly service = inject(MenubarService);
  readonly el = inject(ElementRef);

  classes = computed(() => cn(
    'absolute top-full z-50 mt-1 min-w-[12rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
    'animate-in fade-in-0 zoom-in-95',
    'ltr:left-0 rtl:right-0',
    this.class()
  ));

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusNextItem(event.target as HTMLElement);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusPrevItem(event.target as HTMLElement);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.menu.close();
      const trigger = this.service.menus.get(this.menu.id)?.trigger;
      trigger?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const trigger = this.service.menus.get(this.menu.id)?.trigger;
      if (this.service.isRtl()) {
        trigger?.focusNextTrigger();
      } else {
        trigger?.focusPrevTrigger();
      }
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const trigger = this.service.menus.get(this.menu.id)?.trigger;
      if (this.service.isRtl()) {
        trigger?.focusPrevTrigger();
      } else {
        trigger?.focusNextTrigger();
      }
    }
  }

  focusNextItem(currentItem: HTMLElement) {
    const items = this.getFocusableItems();
    const index = items.indexOf(currentItem);
    const nextIndex = (index + 1) % items.length;
    items[nextIndex]?.focus();
  }

  focusPrevItem(currentItem: HTMLElement) {
    const items = this.getFocusableItems();
    const index = items.indexOf(currentItem);
    const prevIndex = (index - 1 + items.length) % items.length;
    items[prevIndex]?.focus();
  }

  getFocusableItems(): HTMLElement[] {
    const contentDiv = document.querySelector(`[data-menubar-content="${this.menu.id}"]`);
    if (!contentDiv) return [];
    return Array.from(contentDiv.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
  }
}
