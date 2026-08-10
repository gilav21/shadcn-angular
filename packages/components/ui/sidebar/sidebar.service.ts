import { Injectable, signal } from '@angular/core';

/**
 * Sidebar Service - Manages sidebar state across components
 */
@Injectable()
export class SidebarService {
  isOpen = signal(true);
  isCollapsed = signal(false);
  isMobile = signal(false);

  /** The one action bound to the trigger: on mobile it opens/closes the drawer, on desktop it collapses/expands the rail. The two states are independent, so a drawer left open stays open when the viewport grows back to desktop. */
  toggle(): void {
    if (this.isMobile()) {
      this.isOpen.update(v => !v);
    } else {
      this.isCollapsed.update(v => !v);
    }
  }

  /** Opens the drawer. Only observable on mobile — on desktop the sidebar is always rendered and `isCollapsed` is what controls its width. */
  open(): void {
    this.isOpen.set(true);
  }

  /** Closes the drawer (scrim click, Escape, or a nav item's own handler). Focus returns to whatever was focused before it opened. */
  close(): void {
    this.isOpen.set(false);
  }

  /**
   * Switches between drawer and rail behaviour; the provider calls this on every
   * window resize. Entering mobile force-closes the drawer, so crossing the
   * breakpoint always dismisses an open sidebar. Leaving mobile does not reopen
   * it — `isOpen` stays false until something calls {@link open}, which is
   * harmless because desktop ignores it.
   */
  setMobile(isMobile: boolean): void {
    this.isMobile.set(isMobile);
    if (isMobile) {
      this.isOpen.set(false);
    }
  }
}
