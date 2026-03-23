import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  signal,
  inject,
  ElementRef,
  Injectable,
  ContentChild,
  AfterContentInit,
} from '@angular/core';
import { cn } from '../lib/utils';
import { isTouchDevice } from '../lib/touch';

/** A child link within a navigation menu dropdown */
export interface NavigationMenuChild {
  title: string;
  description?: string;
  href: string;
}

/** A top-level navigation menu item */
export interface NavigationMenuItem {
  label: string;
  href?: string;
  children?: NavigationMenuChild[];
}

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

let nextId = 0;

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
    'group flex flex-1 list-none items-center justify-center space-x-1 overflow-x-auto scrollbar-hide',
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
  readonly service = inject(NavigationMenuService);

  isOpen = computed(() => this.service.isActive(this.id));

  classes = computed(() => cn(
    'relative',
    this.class()
  ));

  onMouseEnter() {
    if (isTouchDevice()) return;
    this.service.cancelClose();
    this.service.setActive(this.id);
  }

  onMouseLeave() {
    if (isTouchDevice()) return;
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
        class="relative top-px ml-1 h-3 w-3 transition duration-200"
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
  readonly item = inject(NavigationMenuItemComponent);

  classes = computed(() => cn(
    'group inline-flex h-10 w-max shrink-0 items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium',
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
  readonly item = inject(NavigationMenuItemComponent);

  classes = computed(() => cn(
    'left-0 top-full mt-1.5',
    'absolute',
    'min-w-[200px] max-w-[calc(100vw-2rem)]',
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
  readonly service = inject(NavigationMenuService);

  classes = computed(() => cn(
    'top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden',
    'data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in',
    this.class()
  ));
}

@Component({
  selector: 'ui-navigation-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NavigationMenuService],
  imports: [
    NavigationMenuListComponent,
    NavigationMenuItemComponent,
    NavigationMenuTriggerComponent,
    NavigationMenuContentComponent,
    NavigationMenuLinkComponent,
  ],
  template: `
    <nav
      [class]="classes()"
      [attr.data-slot]="'navigation-menu'"
      role="navigation"
    >
      @if (hasCustomContent()) {
        <ng-content />
      } @else {
        <ui-navigation-menu-list>
          @for (item of items(); track item.label) {
            @if (item.children && item.children.length > 0) {
              <ui-navigation-menu-item>
                <ui-navigation-menu-trigger>{{ item.label }}</ui-navigation-menu-trigger>
                <ui-navigation-menu-content>
                  <ul class="grid w-full sm:w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2">
                    @for (child of item.children; track child.href) {
                      <li>
                        <ui-navigation-menu-link [href]="child.href">
                          <div class="text-sm font-medium leading-none">{{ child.title }}</div>
                          @if (child.description) {
                            <p class="line-clamp-2 text-sm leading-snug text-muted-foreground">
                              {{ child.description }}
                            </p>
                          }
                        </ui-navigation-menu-link>
                      </li>
                    }
                  </ul>
                </ui-navigation-menu-content>
              </ui-navigation-menu-item>
            } @else {
              <ui-navigation-menu-item>
                <ui-navigation-menu-link [href]="item.href || '#'">
                  <span class="text-sm font-medium">{{ item.label }}</span>
                </ui-navigation-menu-link>
              </ui-navigation-menu-item>
            }
          }
        </ui-navigation-menu-list>
      }
    </nav>
  `,
  host: {
    class: 'contents',
    '(document:click)': 'onClick($event)',
  },
})
export class NavigationMenuComponent implements AfterContentInit {
  class = input('');
  /** Data-driven items for simple mode. When provided (and no content is projected), renders the menu automatically. */
  items = input<NavigationMenuItem[]>([]);

  readonly service = inject(NavigationMenuService);
  readonly el = inject(ElementRef);

  @ContentChild(NavigationMenuListComponent) customList?: NavigationMenuListComponent;

  private readonly _hasCustomContent = signal(true);
  hasCustomContent = this._hasCustomContent.asReadonly();

  ngAfterContentInit() {
    this._hasCustomContent.set(!!this.customList || this.items().length === 0);
  }

  classes = computed(() => cn(
    'relative z-10 flex max-w-full sm:max-w-max flex-1 items-center justify-center',
    this.class()
  ));

  onClick(event: MouseEvent) {
    if (this.service.activeItem() && !this.el.nativeElement.contains(event.target)) {
      this.service.setActive(null);
    }
  }
}
