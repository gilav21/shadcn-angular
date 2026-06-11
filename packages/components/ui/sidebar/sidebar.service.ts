import { Injectable, signal } from '@angular/core';

/**
 * Sidebar Service - Manages sidebar state across components
 */
@Injectable()
export class SidebarService {
  isOpen = signal(true);
  isCollapsed = signal(false);
  isMobile = signal(false);

  toggle(): void {
    if (this.isMobile()) {
      this.isOpen.update(v => !v);
    } else {
      this.isCollapsed.update(v => !v);
    }
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  setMobile(isMobile: boolean): void {
    this.isMobile.set(isMobile);
    if (isMobile) {
      this.isOpen.set(false);
    }
  }
}
