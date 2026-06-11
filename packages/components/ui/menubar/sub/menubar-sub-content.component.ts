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
  class = input('');
  readonly sub = inject(MENUBAR_SUB) as MenubarSubComponent;
  readonly service = inject(MenubarService);
  readonly el = inject(ElementRef);

  constructor() {
    this.sub.registerContent(this);
  }

  onMouseEnter(): void {
    if (isTouchDevice()) return;
    this.sub.enter();
  }

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

  focusFirst(): void {
    const items = Array.from((this.el.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
    items[0]?.focus();
  }

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

  focusNextItem(currentItem: HTMLElement): void {
    const div = currentItem.closest<HTMLElement>('[role="menu"]') ?? currentItem;
    const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
    const index = items.indexOf(currentItem);
    const nextIndex = (index + 1) % items.length;
    items[nextIndex]?.focus();
  }

  focusPrevItem(currentItem: HTMLElement): void {
    const div = currentItem.closest<HTMLElement>('[role="menu"]') ?? currentItem;
    const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
    const index = items.indexOf(currentItem);
    const prevIndex = (index - 1 + items.length) % items.length;
    items[prevIndex]?.focus();
  }
}
