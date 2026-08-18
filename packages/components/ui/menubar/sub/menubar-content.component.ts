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
        tabindex="-1"
        (keydown)="onKeydown($event)"
      >
        <ng-content />
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class MenubarContentComponent {
  /**
   * Extra classes for the dropdown panel. The panel is absolutely positioned
   * under the trigger and edge-aligned per direction (`ltr:left-0 rtl:right-0`)
   * with `min-w-[12rem] max-w-[calc(100vw-2rem)]` — override the width here,
   * and the alignment classes if you need it flipped.
   */
  class = input('');
  readonly menu = inject<MenubarMenuComponent>(MENUBAR_MENU);
  readonly service = inject(MenubarService);
  readonly el = inject(ElementRef);

  classes = computed(() => cn(
    'absolute top-full z-50 mt-1 min-w-[12rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
    'animate-in fade-in-0 zoom-in-95',
    'ltr:left-0 rtl:right-0',
    this.class()
  ));

  /**
   * Keyboard map for an open menu: ArrowDown/ArrowUp move through the items
   * ({@link focusNextItem} / {@link focusPrevItem}, wrapping at both ends),
   * Escape closes the menu and returns focus to its trigger, and
   * ArrowLeft/ArrowRight step to the adjacent menu in the bar (mirrored under
   * RTL) which opens it in place. Typeahead and Home/End are not handled.
   */
  onKeydown(event: KeyboardEvent): void {
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
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.handleArrowNav(event.key);
    }
  }

  private handleArrowNav(key: 'ArrowLeft' | 'ArrowRight'): void {
    const trigger = this.service.menus.get(this.menu.id)?.trigger;
    if (key === 'ArrowLeft') {
      if (this.service.isRtl()) {
        trigger?.focusNextTrigger();
      } else {
        trigger?.focusPrevTrigger();
      }
    } else if (this.service.isRtl()) {
      trigger?.focusPrevTrigger();
    } else {
      trigger?.focusNextTrigger();
    }
  }

  /**
   * Moves focus to the item after `currentItem`, wrapping from the last back to
   * the first. Disabled items are skipped — see {@link getFocusableItems}. If
   * `currentItem` is not itself a focusable item the search starts at index -1,
   * so focus lands on the first item.
   */
  focusNextItem(currentItem: HTMLElement): void {
    const items = this.getFocusableItems();
    const index = items.indexOf(currentItem);
    const nextIndex = (index + 1) % items.length;
    items[nextIndex]?.focus();
  }

  /**
   * Mirror of {@link focusNextItem} — moves focus to the previous item, wrapping
   * from the first around to the last.
   */
  focusPrevItem(currentItem: HTMLElement): void {
    const items = this.getFocusableItems();
    const index = items.indexOf(currentItem);
    const prevIndex = (index - 1 + items.length) % items.length;
    items[prevIndex]?.focus();
  }

  /**
   * The arrow-key ring for this menu: every `[role="menuitem"]` inside the open
   * panel that does not carry `data-disabled`, so a disabled `ui-menubar-item`
   * is genuinely removed from keyboard navigation rather than just dimmed. The
   * lookup is a document-wide query keyed on the menu's generated id, and it
   * descends into any open `ui-menubar-sub-content`, so nested items join the
   * parent ring while a submenu is open.
   */
  getFocusableItems(): HTMLElement[] {
    const contentDiv = document.querySelector(`[data-menubar-content="${this.menu.id}"]`);
    if (!contentDiv) return [];
    return Array.from(contentDiv.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
  }
}
