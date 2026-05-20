import { Injectable, signal } from '@angular/core';

/**
 * Sidebar Service - Manages sidebar state across components
 */
@Injectable()
export class SidebarService {
  isOpen = signal(true);
  isCollapsed = signal(false);
  isMobile = signal(false);

  toggle() {
    if (this.isMobile()) {
      this.isOpen.update(v => !v);
    } else {
      this.isCollapsed.update(v => !v);
    }
  }

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  setMobile(isMobile: boolean) {
    this.isMobile.set(isMobile);
    if (isMobile) {
      this.isOpen.set(false);
    }
  }
}
