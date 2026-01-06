import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  ElementRef,
  HostListener,
  Injectable,
} from '@angular/core';
import { cn } from '../lib/utils';

@Injectable()
export class NavigationMenuService {
  activeItem = signal<string | null>(null);
  private timeoutId: any;

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

let nextId = 0;

@Component({
  selector: 'ui-navigation-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NavigationMenuService],
  template: `
    <nav 
      [class]="classes()"
      [attr.data-slot]="'navigation-menu'"
      role="navigation"
    >
      <ng-content />
    </nav>
  `,
  host: { class: 'contents' },
})
export class NavigationMenuComponent {
  class = input('');
  service = inject(NavigationMenuService);
  el = inject(ElementRef);

  classes = computed(() => cn(
    'relative z-10 flex max-w-max flex-1 items-center justify-center',
    this.class()
  ));

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (this.service.activeItem() && !this.el.nativeElement.contains(event.target)) {
      this.service.setActive(null);
    }
  }
}

@Component({
  selector: 'ui-navigation-menu-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul [class]="classes()" [attr.data-slot]="'navigation-menu-list'" role="menubar">
      <ng-content />
    </ul>
  `,
  host: { class: 'contents' },
})
export class NavigationMenuListComponent {
  class = input('');

  classes = computed(() => cn(
    'group flex flex-1 list-none items-center justify-center space-x-1',
    this.class()
  ));
}

@Component({
  selector: 'ui-navigation-menu-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <li 
      [class]="classes()" 
      [attr.data-slot]="'navigation-menu-item'"
      role="none"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
    >
      <ng-content />
    </li>
  `,
  host: { class: 'contents' },
})
export class NavigationMenuItemComponent {
  class = input('');
  id = `nav-menu-item-${nextId++}`;
  service = inject(NavigationMenuService);

  isOpen = computed(() => this.service.isActive(this.id));

  classes = computed(() => cn(
    'relative',
    this.class()
  ));

  onMouseEnter() {
    this.service.cancelClose();
    this.service.setActive(this.id);
  }

  onMouseLeave() {
    this.service.scheduleClose();
  }

  open() {
    this.service.setActive(this.id);
  }

  close() {
    this.service.setActive(null);
  }
}

@Component({
  selector: 'ui-navigation-menu-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="menuitem"
      [class]="classes()"
      [attr.data-slot]="'navigation-menu-trigger'"
      [attr.aria-expanded]="item.isOpen()"
      [attr.aria-haspopup]="'menu'"
      [attr.data-state]="item.isOpen() ? 'open' : 'closed'"
      (click)="onClick()"
    >
      <ng-content />
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="relative top-[1px] ml-1 h-3 w-3 transition duration-200"
        [class.rotate-180]="item.isOpen()"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>
  `,
  host: { class: 'contents' },
})
export class NavigationMenuTriggerComponent {
  class = input('');
  item = inject(NavigationMenuItemComponent);

  classes = computed(() => cn(
    'group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
    'disabled:pointer-events-none disabled:opacity-50',
    this.item.isOpen() && 'bg-accent/50',
    'transition-colors',
    this.class()
  ));

  onClick() {
    if (this.item.isOpen()) {
      this.item.close();
    } else {
      this.item.open();
    }
  }
}

@Component({
  selector: 'ui-navigation-menu-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (item.isOpen()) {
      <div 
        [class]="classes()" 
        [attr.data-slot]="'navigation-menu-content'"
        [attr.data-state]="item.isOpen() ? 'open' : 'closed'"
        role="menu"
      >
        <ng-content />
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class NavigationMenuContentComponent {
  class = input('');
  item = inject(NavigationMenuItemComponent);

  classes = computed(() => cn(
    'left-0 top-full mt-1.5',
    'absolute',
    'min-w-[200px]',
    'rounded-md border bg-popover p-4 text-popover-foreground shadow-lg',
    'animate-in fade-in-0 zoom-in-95',
    this.class()
  ));
}

@Component({
  selector: 'ui-navigation-menu-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a 
      [class]="classes()" 
      [attr.data-slot]="'navigation-menu-link'"
      [href]="href()"
      role="menuitem"
    >
      <ng-content />
    </a>
  `,
  host: { class: 'contents' },
})
export class NavigationMenuLinkComponent {
  class = input('');
  href = input('#');
  active = input(false);

  classes = computed(() => cn(
    'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors',
    'hover:bg-accent hover:text-accent-foreground',
    'focus:bg-accent focus:text-accent-foreground',
    this.active() && 'bg-accent/50',
    this.class()
  ));
}

@Component({
  selector: 'ui-navigation-menu-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      [class]="classes()" 
      [attr.data-slot]="'navigation-menu-indicator'"
    >
      <div class="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md"></div>
    </div>
  `,
  host: { class: 'contents' },
})
export class NavigationMenuIndicatorComponent {
  class = input('');
  service = inject(NavigationMenuService);

  classes = computed(() => cn(
    'top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden',
    'data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in',
    this.class()
  ));
}
