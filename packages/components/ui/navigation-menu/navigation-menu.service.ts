import { Injectable, signal } from '@angular/core';

@Injectable()
export class NavigationMenuService {
  activeItem = signal<string | null>(null);
  private timeoutId: ReturnType<typeof setTimeout> | undefined;

  setActive(id: string | null) {
    clearTimeout(this.timeoutId);
    this.activeItem.set(id);
  }

  scheduleClose() {
    this.timeoutId = setTimeout(() => {
      this.activeItem.set(null);
    }, 150);
  }

  cancelClose() {
    clearTimeout(this.timeoutId);
  }

  isActive(id: string) {
    return this.activeItem() === id;
  }
}
