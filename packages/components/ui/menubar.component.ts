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
  HostListener,
  ContentChildren,
  QueryList,
  forwardRef,
  ViewChild,
} from '@angular/core';
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

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    // If a menu is active, and click is outside the menubar tree, close it.
    if (this.service.activeMenuId() && !this.el.nativeElement.contains(event.target)) {
      this.service.setActive(null);
    }
  }

  onKeydown(event: KeyboardEvent) {
    // Handled by triggers/content bubbles
  }
}

@Component({
  selector: 'ui-menubar-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [attr.data-slot]="'menubar-menu'" role="none">
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
      #trigger
      type="button"
      [class]="classes()"
      [attr.data-slot]="'menubar-trigger'"
      [attr.aria-expanded]="menu.isOpen()"
      [attr.aria-haspopup]="'menu'"
      [attr.data-state]="state()"
      (click)="onClick()"
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
  menu = inject(MenubarMenuComponent);
  service = inject(MenubarService);
  el = inject(ElementRef);

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
      setTimeout(() => {
        const content = document.querySelector(`[data-menubar-content="${this.menu.id}"]`);
        if (content) {
          const firstItem = content.querySelector('[role="menuitem"]') as HTMLElement;
          firstItem?.focus();
        }
      }, 0);
    }
  }

  focus() {
    this.triggerEl?.nativeElement.focus();
  }

  focusNextTrigger() {
    const triggers = Array.from(document.querySelectorAll('[data-slot="menubar-trigger"]')) as HTMLElement[];
    const index = triggers.indexOf(this.triggerEl.nativeElement);
    const nextIndex = (index + 1) % triggers.length;
    triggers[nextIndex]?.focus();
    if (this.service.activeMenuId()) {
      triggers[nextIndex].click();
    }
  }

  focusPrevTrigger() {
    const triggers = Array.from(document.querySelectorAll('[data-slot="menubar-trigger"]')) as HTMLElement[];
    const index = triggers.indexOf(this.triggerEl.nativeElement);
    const prevIndex = (index - 1 + triggers.length) % triggers.length;
    triggers[prevIndex]?.focus();
    if (this.service.activeMenuId()) {
      triggers[prevIndex].click();
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
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.menu.close();
      const trigger = this.service.menus.get(this.menu.id)?.trigger;
      trigger?.focus();
    } else if (event.key === 'ArrowLeft') {
      // In root menu: Left -> focus Prev header trigger
      event.preventDefault();
      // Do NOT close menu here, allows seamless switch
      const trigger = this.service.menus.get(this.menu.id)?.trigger;
      trigger?.focusPrevTrigger();
    } else if (event.key === 'ArrowRight') {
      // In root menu: Right -> focus Next header trigger
      event.preventDefault();
      // Do NOT close menu here, allows seamless switch
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

  private trigger: MenubarSubTriggerComponent | null = null;
  private content: MenubarSubContentComponent | null = null;

  registerTrigger(t: MenubarSubTriggerComponent) { this.trigger = t; }
  registerContent(c: MenubarSubContentComponent) { this.content = c; }

  enter() {
    clearTimeout(this.timeoutId);
    this.isOpen.set(true);
  }

  leave() {
    this.timeoutId = setTimeout(() => {
      this.isOpen.set(false);
    }, 100);
  }

  focusTrigger() {
    // Small timeout to allow DOM to settle if parent closing logic is involved
    setTimeout(() => {
      this.trigger?.focus();
    }, 0);
  }

  focusContent() {
    setTimeout(() => {
      this.content?.focusFirst();
    }, 0);
  }
}

@Component({
  selector: 'ui-menubar-sub-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      #trigger
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
  el = inject(ElementRef);

  @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

  constructor() {
    this.sub.registerTrigger(this);
  }

  classes = computed(() => cn(
    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    this.sub.isOpen() && 'bg-accent text-accent-foreground',
    this.inset() && 'pl-8',
    this.class()
  ));

  onClick() { }

  focus() {
    this.triggerEl?.nativeElement.focus();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      this.sub.enter();
      this.sub.focusContent();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.sub.enter();
      this.sub.focusContent();
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
  el = inject(ElementRef);

  constructor() {
    this.sub.registerContent(this);
  }

  classes = computed(() => cn(
    'absolute left-full top-0 z-50 ml-0.5 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
    'animate-in slide-in-from-left-1 fade-in-0 zoom-in-95',
    this.class()
  ));

  focusFirst() {
    const items = Array.from(this.el.nativeElement.querySelectorAll('[role="menuitem"]:not([data-disabled])')) as HTMLElement[];
    items[0]?.focus();
  }

  onKeydown(event: KeyboardEvent) {
    event.stopPropagation();

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.sub.leave();
      this.sub.focusTrigger();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusNextItem(event.target as HTMLElement);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusPrevItem(event.target as HTMLElement);
    }
  }

  focusNextItem(currentItem: HTMLElement) {
    const div = (currentItem.closest('[role="menu"]') || currentItem) as HTMLElement;
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
