import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  booleanAttribute,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
  selector: 'ui-menubar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'menubar'" role="menubar">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class MenubarComponent {
  class = input('');

  classes = computed(() => cn(
    'flex h-10 items-center space-x-1 rounded-md border bg-background p-1',
    this.class()
  ));
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
  isOpen = signal(false);

  toggle() {
    this.isOpen.update(v => !v);
  }

  close() {
    this.isOpen.set(false);
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
      (click)="menu.toggle()"
    >
      <ng-content />
    </button>
  `,
  host: { class: 'contents' },
})
export class MenubarTriggerComponent {
  class = input('');
  menu = inject(MenubarMenuComponent);

  classes = computed(() => cn(
    'flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    this.menu.isOpen() && 'bg-accent text-accent-foreground',
    this.class()
  ));
}

@Component({
  selector: 'ui-menubar-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (menu.isOpen()) {
      <div [class]="classes()" [attr.data-slot]="'menubar-content'" role="menu">
        <ng-content />
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class MenubarContentComponent {
  class = input('');
  menu = inject(MenubarMenuComponent);

  classes = computed(() => cn(
    'absolute left-0 top-full z-50 mt-1 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
    'animate-in fade-in-0 zoom-in-95',
    this.class()
  ));
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
