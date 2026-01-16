import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  Injectable,
  ElementRef,
  AfterViewInit,
  effect,
} from '@angular/core';
import { cn } from '../lib/utils';

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

/**
 * SidebarProvider - Wraps the sidebar and main content
 */
@Component({
  selector: 'ui-sidebar-provider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SidebarService],
  template: `
    <div 
      [class]="classes()"
      [attr.data-slot]="'sidebar-provider'"
      [attr.data-state]="service.isOpen() ? 'open' : 'closed'"
      [attr.data-collapsed]="service.isCollapsed()"
    >
      <ng-content />
    </div>
  `,
  host: {
    class: 'contents',
    '(window:resize)': 'onResize()',
  },
})
export class SidebarProviderComponent {
  class = input('');
  service = inject(SidebarService);

  constructor() {
    this.checkMobile();
  }

  classes = computed(() => cn(
    'flex min-h-screen w-full',
    this.class()
  ));

  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    this.service.setMobile(isMobile);
  }
}

/**
 * Sidebar - Main sidebar container
 */
@Component({
  selector: 'ui-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Mobile overlay -->
    @if (service.isMobile() && service.isOpen()) {
      <div 
        class="fixed inset-0 z-40 bg-black/50"
        (click)="service.close()"
      ></div>
    }
    
    <aside 
      [class]="classes()"
      [attr.data-slot]="'sidebar'"
      [attr.data-state]="service.isOpen() ? 'open' : 'closed'"
      [attr.data-side]="side()"
      (keydown)="onKeydown($event)"
      tabindex="-1"
    >
      <ng-content />
    </aside>
  `,
  host: { class: 'contents' },
})
export class SidebarComponent implements AfterViewInit {
  class = input('');
  side = input<'left' | 'right'>('left');
  collapsible = input<'icon' | 'none'>('icon');
  service = inject(SidebarService);
  private el = inject(ElementRef);

  private contentEl?: HTMLElement;
  private previousActiveElement?: Element | null;

  constructor() {
    effect(() => {
      const isMobileOpen = this.service.isMobile() && this.service.isOpen();
      if (isMobileOpen) {
        this.previousActiveElement = document.activeElement;
        setTimeout(() => this.focusFirstElement(), 0);
      } else {
        if (this.previousActiveElement instanceof HTMLElement) {
          this.previousActiveElement.focus();
          this.previousActiveElement = null;
        }
      }
    });
  }

  ngAfterViewInit() {
    if (this.service.isMobile() && this.service.isOpen()) {
      this.focusFirstElement();
    }
  }

  private focusFirstElement() {
    const content = this.el.nativeElement.querySelector('[data-slot="sidebar"]');
    if (content) {
      this.contentEl = content;
      const focusable = content.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      if (focusable) {
        focusable.focus();
      } else {
        content.focus();
      }
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (!this.service.isMobile() || !this.service.isOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.service.close();
      return;
    }

    if (event.key === 'Tab' && this.contentEl) {
      const focusableElements = this.contentEl.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }

  classes = computed(() => {
    const isMobile = this.service.isMobile();
    const isOpen = this.service.isOpen();
    const isCollapsed = this.service.isCollapsed();
    const sideValue = this.side();

    return cn(
      'flex flex-col bg-sidebar text-sidebar-foreground',
      'border-r border-sidebar-border',
      isMobile ? [
        'fixed inset-y-0 z-50',
        sideValue === 'left' ? 'left-0' : 'right-0',
        'w-[280px]',
        'transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : (sideValue === 'left' ? '-translate-x-full' : 'translate-x-full'),
      ] : [
        'relative',
        'transition-[width] duration-300 ease-in-out',
        isCollapsed ? 'w-[60px]' : 'w-[280px]',
      ],
      this.class()
    );
  });
}

@Component({
  selector: 'ui-sidebar-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-header'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarHeaderComponent {
  class = input('');
  service = inject(SidebarService);

  classes = computed(() => cn(
    'flex flex-col gap-2 p-4',
    this.service.isCollapsed() && !this.service.isMobile() && 'overflow-hidden [&>*]:sr-only',
    this.class()
  ));
}

/**
 * SidebarContent - Main scrollable content area
 */
@Component({
  selector: 'ui-sidebar-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-content'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarContentComponent {
  class = input('');

  classes = computed(() => cn(
    'flex-1 overflow-auto py-2',
    this.class()
  ));
}

/**
 * SidebarFooter - Bottom section of sidebar
 */
@Component({
  selector: 'ui-sidebar-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-footer'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarFooterComponent {
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-2 p-4 mt-auto',
    this.class()
  ));
}

/**
 * SidebarGroup - Groups related menu items
 */
@Component({
  selector: 'ui-sidebar-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-group'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarGroupComponent {
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-1 px-2 py-2',
    this.class()
  ));
}

/**
 * SidebarGroupLabel - Label for a group
 */
@Component({
  selector: 'ui-sidebar-group-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-group-label'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarGroupLabelComponent {
  class = input('');
  service = inject(SidebarService);

  classes = computed(() => cn(
    'px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70',
    this.service.isCollapsed() && !this.service.isMobile() && 'sr-only',
    this.class()
  ));
}

/**
 * SidebarGroupContent - Content wrapper for group items
 */
@Component({
  selector: 'ui-sidebar-group-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()" [attr.data-slot]="'sidebar-group-content'">
      <ng-content />
    </div>
  `,
  host: { class: 'contents' },
})
export class SidebarGroupContentComponent {
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-1',
    this.class()
  ));
}

/**
 * SidebarMenu - Container for menu items
 */
@Component({
  selector: 'ui-sidebar-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul [class]="classes()" [attr.data-slot]="'sidebar-menu'" role="menu">
      <ng-content />
    </ul>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuComponent {
  class = input('');

  classes = computed(() => cn(
    'flex flex-col gap-1',
    this.class()
  ));
}

/**
 * SidebarMenuItem - Individual menu item wrapper
 */
@Component({
  selector: 'ui-sidebar-menu-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <li [class]="classes()" [attr.data-slot]="'sidebar-menu-item'" role="menuitem">
      <ng-content />
    </li>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuItemComponent {
  class = input('');

  classes = computed(() => cn(
    'list-none',
    this.class()
  ));
}

@Component({
  selector: 'ui-sidebar-menu-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'sidebar-menu-button'"
      [attr.data-active]="isActive()"
      [attr.data-collapsed]="isCollapsedState()"
      (click)="onClick.emit($event)"
    >
      <ng-content />
    </button>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuButtonComponent {
  class = input('');
  isActive = input(false);
  onClick = output<MouseEvent>();
  service = inject(SidebarService);

  isCollapsedState = computed(() => this.service.isCollapsed() && !this.service.isMobile());

  classes = computed(() => {
    const isCollapsed = this.isCollapsedState();

    return cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
      'text-sidebar-foreground',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'transition-colors',
      this.isActive() && 'bg-sidebar-accent text-sidebar-accent-foreground',
      isCollapsed && 'justify-center px-2 overflow-hidden [&>span]:hidden [&>svg]:shrink-0',
      this.class()
    );
  });
}

@Component({
  selector: 'ui-sidebar-menu-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [class]="classes()"
      [attr.data-slot]="'sidebar-menu-link'"
      [attr.data-active]="isActive()"
      [attr.data-collapsed]="isCollapsedState()"
      [href]="href()"
    >
      <ng-content />
    </a>
  `,
  host: { class: 'contents' },
})
export class SidebarMenuLinkComponent {
  class = input('');
  href = input('#');
  isActive = input(false);
  service = inject(SidebarService);

  isCollapsedState = computed(() => this.service.isCollapsed() && !this.service.isMobile());

  classes = computed(() => {
    const isCollapsed = this.isCollapsedState();

    return cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm',
      'text-sidebar-foreground no-underline',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'transition-colors',
      this.isActive() && 'bg-sidebar-accent text-sidebar-accent-foreground',
      isCollapsed && 'justify-center px-2 overflow-hidden [&>span]:hidden [&>svg]:shrink-0',
      this.class()
    );
  });
}

/**
 * SidebarTrigger - Button to toggle sidebar
 */
@Component({
  selector: 'ui-sidebar-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.data-slot]="'sidebar-trigger'"
      [attr.aria-expanded]="service.isOpen()"
      aria-label="Toggle sidebar"
      (click)="service.toggle()"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <line x1="9" x2="9" y1="3" y2="21"/>
      </svg>
      <span class="sr-only">Toggle Sidebar</span>
    </button>
  `,
  host: { class: 'contents' },
})
export class SidebarTriggerComponent {
  class = input('');
  service = inject(SidebarService);

  classes = computed(() => cn(
    'inline-flex h-8 w-8 items-center justify-center rounded-md',
    'text-sidebar-foreground',
    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    this.class()
  ));
}

/**
 * SidebarInset - Main content area next to sidebar
 */
@Component({
  selector: 'ui-sidebar-inset',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main [class]="classes()" [attr.data-slot]="'sidebar-inset'">
      <ng-content />
    </main>
  `,
  host: { class: 'contents' },
})
export class SidebarInsetComponent {
  class = input('');

  classes = computed(() => cn(
    'flex flex-1 flex-col',
    this.class()
  ));
}

/**
 * SidebarSeparator - Visual separator
 */
@Component({
  selector: 'ui-sidebar-separator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hr [class]="classes()" [attr.data-slot]="'sidebar-separator'" />
  `,
  host: { class: 'contents' },
})
export class SidebarSeparatorComponent {
  class = input('');

  classes = computed(() => cn(
    'mx-2 my-2 border-t border-sidebar-border',
    this.class()
  ));
}
