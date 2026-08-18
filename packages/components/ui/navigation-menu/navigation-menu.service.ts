import { Injectable, signal } from '@angular/core';

@Injectable()
export class NavigationMenuService {
  activeItem = signal<string | null>(null);
  private timeoutId: ReturnType<typeof setTimeout> | undefined;

  /**
   * Opens the item with the given id — or closes everything when passed `null` — and cancels
   * any close scheduled by {@link scheduleClose}, so a fresh open always wins over a pending
   * dismissal. Only one item can be open at a time: opening one closes the previous.
   */
  setActive(id: string | null): void {
    clearTimeout(this.timeoutId);
    this.activeItem.set(id);
  }

  /**
   * Closes whatever is open after a 150ms grace period, so that moving the pointer diagonally
   * from a trigger into its dropdown — briefly crossing dead space — does not dismiss the panel.
   * Re-entering any item calls {@link cancelClose} and aborts the pending close. Closes
   * unconditionally when it fires: it does not check that the item it was scheduled for is still
   * the active one.
   */
  scheduleClose(): void {
    this.timeoutId = setTimeout(() => {
      this.activeItem.set(null);
    }, 150);
  }

  /**
   * Aborts a close pending from {@link scheduleClose}, leaving the currently open item open.
   * Called on pointer re-entry; safe to call when nothing is scheduled.
   */
  cancelClose(): void {
    clearTimeout(this.timeoutId);
  }

  /**
   * Whether the given item id is the open one. Reads the `activeItem` signal, so calling it
   * inside a `computed` makes that computed react to open/close — this is how
   * {@link NavigationMenuItemComponent.isOpen} (and through it the trigger's `aria-expanded`
   * and the content panel's rendering) stays in sync.
   */
  isActive(id: string): boolean {
    return this.activeItem() === id;
  }
}
