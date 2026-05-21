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
  host: { class: 'contents' },
})
export class MenubarTriggerComponent {
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
    'flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
    this.class()
  ));

  onClick() {
    this.menu.toggle();
  }

  onMouseEnter() {
    if (isTouchDevice()) return;
    if (this.service.activeMenuId()) {
      this.menu.open();
    }
  }

  onKeydown(event: KeyboardEvent) {
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

  focus() {
    this.triggerEl?.nativeElement.focus();
  }

  focusNextTrigger() {
    const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="menubar-trigger"]'));
    const index = triggers.indexOf(this.triggerEl.nativeElement);
    const nextIndex = (index + 1) % triggers.length;
    triggers[nextIndex]?.focus();
    if (this.service.activeMenuId()) {
      triggers[nextIndex].click();
    }
  }

  focusPrevTrigger() {
    const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="menubar-trigger"]'));
    const index = triggers.indexOf(this.triggerEl.nativeElement);
    const prevIndex = (index - 1 + triggers.length) % triggers.length;
    triggers[prevIndex]?.focus();
    if (this.service.activeMenuId()) {
      triggers[prevIndex].click();
    }
  }
}
