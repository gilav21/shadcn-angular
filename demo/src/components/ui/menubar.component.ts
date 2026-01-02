import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  booleanAttribute,
  Injectable,
  ElementRef,
  AfterContentInit,
  ContentChildren,
  QueryList,
  HostListener,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { cn } from '../lib/utils';
import { Subject } from 'rxjs';

@Injectable()
export class MenubarService {
  activeMenuId = signal<string | null>(null);
  menus = new Map<string, { trigger: MenubarTriggerComponent }>();

  register(id: string, trigger: MenubarTriggerComponent) {
    this.menus.set(id, { trigger });
  }

  unregister(id: string) {
    this.menus.delete(id);
  }

  setActive(id: string | null) {
    this.activeMenuId.set(id);
  }

  isActive(id: string) {
    return this.activeMenuId() === id;
  }
}

let nextId = 0;

@Component({
  selector: 'ui-menubar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MenubarService],
  template: `
    <div [class]="classes()" [attr.data-slot]="'menubar'" role="menubar" (keydown)="onKeydown($event)">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class MenubarComponent {
  class = input('');
  service = inject(MenubarService);
  el = inject(ElementRef);

  classes = computed(() => cn(
    'flex h-10 items-center space-x-1 rounded-md border bg-background p-1',
    this.class()
  ));

  onKeydown(event: KeyboardEvent) {
    // Handle ArrowLeft/Right for moving between triggers at the root level (if focus is on a trigger)
    // Note: Focus management inside menus is handled by Content/Items.
    // This handler catches bubbling events from triggers.

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      // Find custom navigation reset logic if needed, but triggers handle their own navigation
    }
  }
}

@Component({
  selector: 'ui-menubar-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [attr.data-slot]="'menubar-menu'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class MenubarMenuComponent {
  id = `menubar-menu-${nextId++}`;
  service = inject(MenubarService);
  isOpen = computed(() => this.service.isActive(this.id));

  toggle() {
    if (this.isOpen()) {
      this.service.setActive(null);
    } else {
      this.service.setActive(this.id);
    }
  }

  open() {
    this.service.setActive(this.id);
  }

  close() {
    if (this.isOpen()) {
      this.service.setActive(null);
    }
  }
}

@Component({
  selector: 'ui-menubar-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'menubar-trigger'"
      [attr.aria-expanded]="menu.isOpen()"
      [attr.aria-haspopup]="'menu'"
      [attr.data-state]="state()"
      (click)="onClick()"
      (mouseenter)="onMouseEnter()"
      (keydown)="onKeydown($event)"
    >
      <ng-content />
    </button>
  `,
  host: { class: 'contents' },
})
export class MenubarTriggerComponent {
  class = input('');
  menu = inject(MenubarMenuComponent);
  service = inject(MenubarService);
  el = inject(ElementRef);

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
    // If any menu is open, we switch to this one (hover intent)
    if (this.service.activeMenuId()) {
      this.menu.open();
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusNextTrigger();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focusPrevTrigger();
    } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      this.menu.open();
      // We need to wait for content to render then focus first item.
      // Using a small timeout or relying on Content to autofocus first item?
      // Content component can trap focus or focus first item on init.
      setTimeout(() => {
        const content = document.querySelector(`[data-menubar-content="${this.menu.id}"]`);
        if (content) {
          const firstItem = content.querySelector('[role="menuitem"]') as HTMLElement;
          firstItem?.focus();
        }
      }, 0);
    }
  }

  focusNextTrigger() {
    const triggers = Array.from(document.querySelectorAll('[data-slot="menubar-trigger"]')) as HTMLElement[];
    const index = triggers.indexOf(this.el.nativeElement);
    const nextIndex = (index + 1) % triggers.length;
    triggers[nextIndex]?.focus();

    // If a menu is currently open, switch the active menu to the new trigger
    if (this.service.activeMenuId()) {
      // We need to find the component associated with the next trigger element.
      // But we don't have easy access. 
      // Simulating click or just letting focus move? 
      // Standard behavior: if menu is open, Left/Right moves focus AND opens the new menu.
      const nextTriggerEl = triggers[nextIndex];
      nextTriggerEl.click();
    }
  }

  focusPrevTrigger() {
    const triggers = Array.from(document.querySelectorAll('[data-slot="menubar-trigger"]')) as HTMLElement[];
    const index = triggers.indexOf(this.el.nativeElement);
    const prevIndex = (index - 1 + triggers.length) % triggers.length;
    triggers[prevIndex]?.focus();

    if (this.service.activeMenuId()) {
      const prevTriggerEl = triggers[prevIndex];
      prevTriggerEl.click();
    }
  }
}

@Component({
  selector: 'ui-menubar-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (menu.isOpen()) {
      <div 
        [class]="classes()" 
        [attr.data-slot]="'menubar-content'" 
        [attr.data-menubar-content]="menu.id"
        role="menu"
        (keydown)="onKeydown($event)"
      >
        <ng-content />
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class MenubarContentComponent {
  class = input('');
  menu = inject(MenubarMenuComponent);
  service = inject(MenubarService);
  el = inject(ElementRef);

  classes = computed(() => cn(
    'absolute left-0 top-full z-50 mt-1 min-w-[12rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
    'animate-in fade-in-0 zoom-in-95',
    this.class()
  ));

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusNextItem(event.target as HTMLElement);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusPrevItem(event.target as HTMLElement);
    } else if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      // If ArrowLeft, usually moves to prev trigger if we are at root level content.
      event.preventDefault();
      this.menu.close();
      // Focus trigger
      const trigger = this.service.menus.get(this.menu.id)?.trigger;
      trigger?.el.nativeElement.focus();

      if (event.key === 'ArrowLeft') {
        // Also move to prev trigger? Standard behavior varies.
        // Often Left in a vertical menu triggers "Back to parent" (if submenu) or "Prev Header" (if root).
        // Since this is root content, we might want to trigger 'ArrowLeft' logic on the trigger itself?
        // But we already closed it.
        // We can emulate 'ArrowLeft' on trigger.
        trigger?.focusPrevTrigger();
      }
    } else if (event.key === 'ArrowRight') {
      // Standard behavior: Move to next trigger
      event.preventDefault();
      this.menu.close();
      const trigger = this.service.menus.get(this.menu.id)?.trigger;
      trigger?.focusNextTrigger();
    }
  }

  focusNextItem(currentItem: HTMLElement) {
    const items = this.getFocusableItems();
    const index = items.indexOf(currentItem);
    const nextIndex = (index + 1) % items.length;
    items[nextIndex]?.focus();
  }

  focusPrevItem(currentItem: HTMLElement) {
    const items = this.getFocusableItems();
    const index = items.indexOf(currentItem);
    const prevIndex = (index - 1 + items.length) % items.length;
    items[prevIndex]?.focus();
  }

  getFocusableItems(): HTMLElement[] {
    // Query scoped to this content element in the DOM
    // We find the rendered div first
    // Note: the component host is 'contents', so we need to find the actual div in the template.
    // But we are listening on the div (template).
    // Wait, onKeydown bubbles. The event.target is the item.
    // event.currentTarget is the div?
    // We can query selectorAll inside the div.
    // But we need reference to the div? 
    // We can use document.querySelector based on data id?
    // Or inject ElementRef? ElementRef is comment node for 'contents'.
    // So we can't query inside ElementRef easily.
    // Best bet: use document.querySelector(`[data-menubar-content="${this.menu.id}"]`)

    const contentDiv = document.querySelector(`[data-menubar-content="${this.menu.id}"]`);
    if (!contentDiv) return [];

    return Array.from(contentDiv.querySelectorAll('[role="menuitem"]:not([data-disabled])')) as HTMLElement[];
  }
}

@Component({
  selector: 'ui-menubar-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      [class]="classes()"
      [attr.data-slot]="'menubar-item'"
      [attr.data-disabled]="disabled() || null"
      role="menuitem"
      tabindex="0"
      (click)="onClick()"
      (keydown.enter)="onClick()"
      (focus)="onFocus()"
    >
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class MenubarItemComponent {
  class = input('');
  disabled = input(false, { transform: booleanAttribute });
  inset = input(false, { transform: booleanAttribute });

  select = output<void>();
  menu = inject(MenubarMenuComponent, { optional: true });

  // For manual focus tracking if needed
  onFocus() { }

  classes = computed(() => cn(
    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    this.inset() && 'pl-8',
    this.class()
  ));

  onClick() {
    if (!this.disabled()) {
      this.select.emit();
      this.menu?.close();
    }
  }
}

@Component({
  selector: 'ui-menubar-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="-mx-1 my-1 h-px bg-muted" [attr.data-slot]="'menubar-separator'"></div>
  `,
  host: { class: 'contents' },
})
export class MenubarSeparatorComponent { }

@Component({
  selector: 'ui-menubar-shortcut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ml-auto text-xs tracking-widest text-muted-foreground" [attr.data-slot]="'menubar-shortcut'">
      <ng-content />
    </span>
  `,
  host: { class: 'contents' },
})
export class MenubarShortcutComponent { }

@Component({
  selector: 'ui-menubar-sub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: { class: 'relative block w-full' },
})
export class MenubarSubComponent {
  isOpen = signal(false);
  private timeoutId: any;

  enter() {
    clearTimeout(this.timeoutId);
    this.isOpen.set(true);
  }

  leave() {
    this.timeoutId = setTimeout(() => {
      this.isOpen.set(false);
    }, 100);
  }
}

@Component({
  selector: 'ui-menubar-sub-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      [class]="classes()"
      role="menuitem"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      tabindex="0"
      (mouseenter)="sub.enter()"
      (mouseleave)="sub.leave()"
      (keydown)="onKeydown($event)"
      (click)="onClick()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto h-4 w-4"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
  host: { class: 'contents' }
})
export class MenubarSubTriggerComponent {
  class = input('');
  disabled = input(false, { transform: booleanAttribute });
  inset = input(false, { transform: booleanAttribute });

  sub = inject(MenubarSubComponent);

  classes = computed(() => cn(
    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    this.sub.isOpen() && 'bg-accent text-accent-foreground',
    this.inset() && 'pl-8',
    this.class()
  ));

  onClick() {
    // Click logic if defined
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      this.sub.enter();
      // Focus first item in sub
      setTimeout(() => {
        // We need to find the sub content. 
        // Since we are in the trigger, we don't have direct ref to content.
        // But content is sibling in template.
        // Best to rely on SubContent to focus first item when opened?
        // Or traverse DOM: The sub control uses a specific logic.
        // Shortcuts for demo: find next sibling element that is sub-content?
        // Since Sub wraps Trigger and Content, they are siblings.
        // But we are in Trigger component.
        // Let's rely on standard focus management or just open it.
        // User can press Down to enter sub?
        // Standard: Right arrow enters sub.

        // Simplest: 
        // Find parent wrapper of this trigger?
        // Not robust.
        // But the SubContent renders 'menu' role.
        // document.activeElement is this trigger.
        // sibling should be the content.
      }, 0);
    }
    if (event.key === 'Enter') {
      // Open sub
      event.preventDefault();
      this.sub.enter();
    }
  }
}

@Component({
  selector: 'ui-menubar-sub-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sub.isOpen()) {
      <div 
        [class]="classes()" 
        role="menu"
        (mouseenter)="sub.enter()"
        (mouseleave)="sub.leave()"
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
  sub = inject(MenubarSubComponent);

  classes = computed(() => cn(
    'absolute left-full top-0 z-50 ml-0.5 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
    'animate-in slide-in-from-left-1 fade-in-0 zoom-in-95',
    this.class()
  ));

  onKeydown(event: KeyboardEvent) {
    event.stopPropagation(); // Don't bubble to parent menu

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.sub.leave();
      // Focus the trigger... how to find it?
      // It's the sibling in the 'ui-menubar-sub'
      // We can't easily find it without reference.
      // BUT, focus returns to body if we hide?
      // Trap: we need to restore focus.
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusNextItem(event.target as HTMLElement);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusPrevItem(event.target as HTMLElement);
    }
  }

  focusNextItem(currentItem: HTMLElement) {
    // Similar logic, scope to this subcontent div
    const div = (currentItem.closest('[role="menu"]') || currentItem) as HTMLElement;
    // If currentItem is the menu itself (rare), items is children.
    // Actually closest role=menu is this component's div.
    const items = Array.from(div.querySelectorAll('[role="menuitem"]:not([data-disabled])')) as HTMLElement[];
    const index = items.indexOf(currentItem);
    const nextIndex = (index + 1) % items.length;
    items[nextIndex]?.focus();
  }

  focusPrevItem(currentItem: HTMLElement) {
    const div = (currentItem.closest('[role="menu"]') || currentItem) as HTMLElement;
    const items = Array.from(div.querySelectorAll('[role="menuitem"]:not([data-disabled])')) as HTMLElement[];
    const index = items.indexOf(currentItem);
    const prevIndex = (index - 1 + items.length) % items.length;
    items[prevIndex]?.focus();
  }
}
