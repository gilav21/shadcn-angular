import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { isTouchDevice } from '../../../lib/touch';
import { MenubarService } from '../menubar.component';
import { MENUBAR_MENU, type MenubarMenuComponent } from './menubar-menu.component';

@Component({
  selector: 'ui-menubar-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #trigger
      type="button"
      [class]="classes()"
      [attr.data-slot]="'menubar-trigger'"
      [attr.aria-expanded]="menu.isOpen()"
      [attr.aria-haspopup]="'menu'"
      [attr.data-state]="state()"
      (click)="onClick()"
      (mouseenter)="onMouseEnter()"
      (keydown)="onKeydown($event)"
      role="menuitem"
    >
      <ng-content />
    </button>
  `,
  styleUrl: './menubar-trigger.component.css',
  host: { class: 'contents' },
})
export class MenubarTriggerComponent {
  /**
   * Extra classes merged onto the trigger `<button>`, after the hover/focus and
   * `data-[state=open]` accent classes.
   */
  class = input('');
  readonly menu = inject(MENUBAR_MENU) as MenubarMenuComponent;
  readonly service = inject(MenubarService);
  readonly el = inject(ElementRef);

  @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

  state = computed(() => this.menu.isOpen() ? 'open' : 'closed');

  constructor() {
    this.service.register(this.menu.id, this);
  }

  classes = computed(() => cn(
    'flex cursor-pointer select-none items-center rounded-sm text-sm font-medium outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
    this.class()
  ));

  /**
   * Click handler: toggles this menu open or closed. Because only one menubar
   * menu may be open at a time, opening this one closes whichever sibling was
   * open. Clicking the trigger of the already-open menu closes it.
   */
  onClick(): void {
    this.menu.toggle();
  }

  /**
   * Hover-to-switch: once *any* menu in the bar is open, moving the pointer over
   * another trigger switches to that menu immediately (no grace period). With
   * every menu closed, hover does nothing — the bar must first be opened with a
   * click. No-op on touch devices, where {@link onClick} is the only way in.
   */
  onMouseEnter(): void {
    if (isTouchDevice()) return;
    if (this.service.activeMenuId()) {
      this.menu.open();
    }
  }

  /**
   * Keyboard map for a focused trigger: ArrowLeft/ArrowRight walk the trigger
   * row (mirrored under RTL) via {@link focusPrevTrigger} /
   * {@link focusNextTrigger}, and ArrowDown or Enter opens this menu and moves
   * focus to its first item on the next macrotask, once the panel has rendered.
   * That first-item lookup does not filter on `data-disabled`, so it can land on
   * a disabled item that the subsequent arrow keys then skip over. Escape is
   * handled by the open content, not here; Space and typeahead are not handled.
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (this.service.isRtl()) {
        this.focusNextTrigger();
      } else {
        this.focusPrevTrigger();
      }
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (this.service.isRtl()) {
        this.focusPrevTrigger();
      } else {
        this.focusNextTrigger();
      }
    } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      this.menu.open();
      setTimeout(() => {
        const content = document.querySelector(`[data-menubar-content="${this.menu.id}"]`);
        if (content) {
          const firstItem = content.querySelector<HTMLElement>('[role="menuitem"]');
          firstItem?.focus();
        }
      }, 0);
    }
  }

  /**
   * Moves DOM focus to this trigger's `<button>` without opening the menu. Used
   * by the open content on Escape to hand focus back.
   */
  focus(): void {
    this.triggerEl?.nativeElement.focus();
  }

  /**
   * Focuses the next trigger in the bar, wrapping from the last back to the
   * first. If a menu is currently open the new trigger is also clicked, so the
   * open menu follows focus. The lookup is a document-wide
   * `[data-slot="menubar-trigger"]` query, so two menubars on one page share a
   * single wrap-around ring.
   */
  focusNextTrigger(): void {
    const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="menubar-trigger"]'));
    const index = triggers.indexOf(this.triggerEl.nativeElement);
    const nextIndex = (index + 1) % triggers.length;
    triggers[nextIndex]?.focus();
    if (this.service.activeMenuId()) {
      triggers[nextIndex].click();
    }
  }

  /**
   * Mirror of {@link focusNextTrigger} — focuses the previous trigger, wrapping
   * from the first around to the last, and carries the open menu with it.
   */
  focusPrevTrigger(): void {
    const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="menubar-trigger"]'));
    const index = triggers.indexOf(this.triggerEl.nativeElement);
    const prevIndex = (index - 1 + triggers.length) % triggers.length;
    triggers[prevIndex]?.focus();
    if (this.service.activeMenuId()) {
      triggers[prevIndex].click();
    }
  }
}
