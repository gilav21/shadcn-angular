import { Injectable, signal } from '@angular/core';

@Injectable()
export class NavigationMenuService {
  activeItem = signal<string | null>(null);
  private timeoutId: ReturnType<typeof setTimeout> | undefined;

  setActive(id: string | null): void {
    clearTimeout(this.timeoutId);
    this.activeItem.set(id);
  }

  scheduleClose(): void {
    this.timeoutId = setTimeout(() => {
      this.activeItem.set(null);
    }, 150);
  }

  cancelClose(): void {
    clearTimeout(this.timeoutId);
  }

  isActive(id: string): boolean {
    return this.activeItem() === id;
  }
}
