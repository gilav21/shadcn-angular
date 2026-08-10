import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  ElementRef,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { isTouchDevice } from '../../../lib/touch';
import { MenubarService } from '../menubar.component';
import { MENUBAR_SUB, type MenubarSubComponent } from './menubar-sub.component';

@Component({
  selector: 'ui-menubar-sub-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sub.isOpen()) {
      <div
        [class]="classes()"
        role="menu"
        tabindex="-1"
        (mouseenter)="onMouseEnter()"
        (mouseleave)="onMouseLeave()"
        (keydown)="onKeydown($event)"
      >
        <ng-content />
      </div>
    }
  `,
  host: { class: 'contents' }
})
export class MenubarSubContentComponent {
  /**
   * Extra classes for the submenu panel. It flies out sideways from the trigger
   * on `sm` and up (`left-full` / `right-full` under RTL) but drops below the
   * trigger on phones (`max-sm:top-full`), and is capped at
   * `max-w-[calc(100vw-2rem)]`; override those here if you need different
   * placement.
   */
  class = input('');
  readonly sub = inject(MENUBAR_SUB) as MenubarSubComponent;
  readonly service = inject(MenubarService);
  readonly el = inject(ElementRef);

  constructor() {
    this.sub.registerContent(this);
  }

  /**
   * Cancels the pending close started when the pointer left the trigger, so the
   * panel survives the gap between trigger and panel. No-op on touch devices,
   * where the sub-trigger's tap handler owns open/close.
   */
  onMouseEnter(): void {
    if (isTouchDevice()) return;
    this.sub.enter();
  }

  /**
   * Starts the 100ms close timer when the pointer leaves the panel; re-entering
   * the panel or the trigger within that window cancels it. No-op on touch
   * devices.
   */
  onMouseLeave(): void {
    if (isTouchDevice()) return;
    this.sub.leave();
  }

  classes = computed(() => cn(
    'absolute top-0 z-50 min-w-[8rem] max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
    'max-sm:left-0 max-sm:top-full max-sm:mt-0.5',
    'sm:ltr:left-full sm:ltr:ml-0.5 ltr:animate-in ltr:slide-in-from-left-1 ltr:fade-in-0 ltr:zoom-in-95',
    'sm:rtl:right-full sm:rtl:mr-0.5 rtl:animate-in rtl:slide-in-from-right-1 rtl:fade-in-0 rtl:zoom-in-95',
    this.class()
  ));

  /**
   * Focuses the first enabled item in the panel, skipping any `data-disabled`
   * one. Called by the sub's `focusContent()` after the panel renders; does
   * nothing if the submenu is closed or holds no enabled items.
   */
  focusFirst(): void {
    const items = Array.from((this.el.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
    items[0]?.focus();
  }

  /**
   * Keyboard map inside an open submenu: ArrowDown/ArrowUp cycle through the
   * items ({@link focusNextItem} / {@link focusPrevItem}, wrapping at both
   * ends), and the "back" arrow (ArrowLeft under LTR, ArrowRight under RTL)
   * closes the submenu and returns focus to its trigger. Every key event is
   * stopped from propagating, so the parent `ui-menubar-content` never sees
   * them — which also means Escape does not close the parent menu while focus
   * is inside a submenu.
   */
  onKeydown(event: KeyboardEvent): void {
    event.stopPropagation();

    if (event.key === 'ArrowLeft') {
      if (!this.service.isRtl()) {
        event.preventDefault();
        this.sub.leave();
        this.sub.focusTrigger();
      }
    } else if (event.key === 'ArrowRight') {
      if (this.service.isRtl()) {
        event.preventDefault();
        this.sub.leave();
        this.sub.focusTrigger();
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusNextItem(event.target as HTMLElement);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusPrevItem(event.target as HTMLElement);
    }
  }

  /**
   * Moves focus to the next enabled item, wrapping from the last back to the
   * first. The ring is scoped to the nearest enclosing `[role="menu"]` of
   * `currentItem` rather than to this panel, so focus stays within whichever
   * submenu level the key was pressed in.
   */
  focusNextItem(currentItem: HTMLElement): void {
    const div = currentItem.closest<HTMLElement>('[role="menu"]') ?? currentItem;
    const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
    const index = items.indexOf(currentItem);
    const nextIndex = (index + 1) % items.length;
    items[nextIndex]?.focus();
  }

  /**
   * Mirror of {@link focusNextItem} — moves focus to the previous enabled item,
   * wrapping from the first around to the last.
   */
  focusPrevItem(currentItem: HTMLElement): void {
    const div = currentItem.closest<HTMLElement>('[role="menu"]') ?? currentItem;
    const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
    const index = items.indexOf(currentItem);
    const prevIndex = (index - 1 + items.length) % items.length;
    items[prevIndex]?.focus();
  }
}
