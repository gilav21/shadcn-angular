import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, inject, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import {
  SidebarComponent,
  SidebarProviderComponent,
  SidebarService,
  SidebarTriggerComponent,
  SidebarContentComponent,
  SidebarHeaderComponent,
  SidebarFooterComponent,
  SidebarGroupComponent,
  SidebarGroupLabelComponent,
  SidebarGroupContentComponent,
  SidebarMenuComponent,
  SidebarMenuItemComponent,
  SidebarMenuButtonComponent,
  SidebarMenuLinkComponent,
  SidebarInsetComponent,
  SidebarSeparatorComponent,
  SidebarMenuSubComponent,
  SidebarMenuSubItemComponent,
  SidebarMenuSubButtonComponent,
  SidebarMenuSubTriggerComponent,
  SidebarMenuActionComponent,
  SidebarMenuBadgeComponent,
  SidebarMenuSkeletonComponent,
  SidebarRailComponent,
  SIDEBAR_STORAGE_KEY,
} from './';

class ResizeObserverStub {
  observe(): void {
    /* no-op: jsdom lacks ResizeObserver; ScrollArea inside SidebarContent needs it */
  }
  unobserve(): void {
    /* no-op */
  }
  disconnect(): void {
    /* no-op */
  }
}

type CollapseMode = 'icon' | 'hidden';
type Side = 'left' | 'right';
type Variant = 'sidebar' | 'floating' | 'inset';

@Component({
  selector: 'test-main-host',
  template: `
    <ui-sidebar-provider>
      <ui-sidebar
        [side]="side()"
        [variant]="variant()"
        [collapsible]="collapsible()"
        [collapseMode]="mode()"
        [class]="cls()"
      >
        <ui-sidebar-header>Header</ui-sidebar-header>
        <ui-sidebar-content>
          <ui-sidebar-group>
            <ui-sidebar-group-label>Group</ui-sidebar-group-label>
            <ui-sidebar-group-content>
              <ui-sidebar-menu>
                <ui-sidebar-menu-item>
                  <ui-sidebar-menu-button
                    [isActive]="true"
                    tooltip="Home"
                    (clicked)="onClick($event)"
                  >Home</ui-sidebar-menu-button>
                </ui-sidebar-menu-item>
                <ui-sidebar-menu-item>
                  <ui-sidebar-menu-link href="/about" [isActive]="false">About</ui-sidebar-menu-link>
                </ui-sidebar-menu-item>
              </ui-sidebar-menu>
            </ui-sidebar-group-content>
          </ui-sidebar-group>
          <ui-sidebar-separator></ui-sidebar-separator>
        </ui-sidebar-content>
        <ui-sidebar-footer>Footer</ui-sidebar-footer>
      </ui-sidebar>
      <ui-sidebar-inset>
        <ui-sidebar-trigger></ui-sidebar-trigger>
      </ui-sidebar-inset>
    </ui-sidebar-provider>
  `,
  imports: [
    SidebarComponent,
    SidebarProviderComponent,
    SidebarTriggerComponent,
    SidebarContentComponent,
    SidebarHeaderComponent,
    SidebarFooterComponent,
    SidebarGroupComponent,
    SidebarGroupLabelComponent,
    SidebarGroupContentComponent,
    SidebarMenuComponent,
    SidebarMenuItemComponent,
    SidebarMenuButtonComponent,
    SidebarMenuLinkComponent,
    SidebarInsetComponent,
    SidebarSeparatorComponent,
  ],
})
class MainHostComponent {
  readonly side = signal<Side>('left');
  readonly variant = signal<Variant>('sidebar');
  readonly collapsible = signal(true);
  readonly mode = signal<CollapseMode>('icon');
  readonly cls = signal('custom-sidebar-class');
  clicks = 0;
  lastEvent?: MouseEvent;

  onClick(event: MouseEvent): void {
    this.clicks++;
    this.lastEvent = event;
  }
}

@Component({
  selector: 'test-focus-host',
  template: `
    <ui-sidebar>
      <button type="button" class="first-btn">First</button>
      <button type="button" class="last-btn">Last</button>
    </ui-sidebar>
  `,
  imports: [SidebarComponent],
  providers: [SidebarService],
})
class FocusTrapHostComponent {
  readonly service = inject(SidebarService);
  constructor() {
    this.service.isMobile.set(true);
    this.service.isOpen.set(true);
  }
}

@Component({
  selector: 'test-nofocus-host',
  template: `<ui-sidebar>Only text, nothing focusable</ui-sidebar>`,
  imports: [SidebarComponent],
  providers: [SidebarService],
})
class NoFocusHostComponent {
  readonly service = inject(SidebarService);
  constructor() {
    this.service.isMobile.set(true);
    this.service.isOpen.set(true);
  }
}

@Component({
  selector: 'test-blank-route',
  template: '',
})
class BlankRouteComponent {}

@Component({
  selector: 'test-router-host',
  template: `
    <ui-sidebar-provider>
      <ui-sidebar>
        <ui-sidebar-content>
          <ui-sidebar-menu>
            <ui-sidebar-menu-item>
              <ui-sidebar-menu-link routerLink="/home" (navigated)="onNavigated()"
                >Home</ui-sidebar-menu-link
              >
            </ui-sidebar-menu-item>
            <ui-sidebar-menu-item>
              <ui-sidebar-menu-link [routerLink]="['/about']" (navigated)="onNavigated()"
                >About</ui-sidebar-menu-link
              >
            </ui-sidebar-menu-item>
            <ui-sidebar-menu-item>
              <ui-sidebar-menu-link routerLink="/about" [routerLinkActiveOptions]="{ exact: true }"
                >About exact</ui-sidebar-menu-link
              >
            </ui-sidebar-menu-item>
            <ui-sidebar-menu-item>
              <ui-sidebar-menu-link
                routerLink="/home"
                [queryParams]="{ tab: 'settings' }"
                fragment="section"
                >Home params</ui-sidebar-menu-link
              >
            </ui-sidebar-menu-item>
            <ui-sidebar-menu-item>
              <ui-sidebar-menu-link routerLink="">Self</ui-sidebar-menu-link>
            </ui-sidebar-menu-item>
            <ui-sidebar-menu-item>
              <ui-sidebar-menu-link routerLink="/about" target="_blank"
                >External route</ui-sidebar-menu-link
              >
            </ui-sidebar-menu-item>
          </ui-sidebar-menu>
        </ui-sidebar-content>
      </ui-sidebar>
      <ui-sidebar-inset><router-outlet /></ui-sidebar-inset>
    </ui-sidebar-provider>
  `,
  imports: [
    SidebarComponent,
    SidebarProviderComponent,
    SidebarContentComponent,
    SidebarMenuComponent,
    SidebarMenuItemComponent,
    SidebarMenuLinkComponent,
    SidebarInsetComponent,
    RouterOutlet,
  ],
})
class RouterHostComponent {
  navigations = 0;

  onNavigated(): void {
    this.navigations++;
  }
}

/** No `provideRouter` anywhere — proves the href branch injects no router. */
@Component({
  selector: 'test-plain-link-host',
  template: `
    <ui-sidebar-provider>
      <ui-sidebar>
        <ui-sidebar-content>
          <ui-sidebar-menu>
            <ui-sidebar-menu-item>
              <ui-sidebar-menu-link
                href="https://example.com/docs"
                target="_blank"
                [isActive]="active()"
                (navigated)="onNavigated()"
                >Docs</ui-sidebar-menu-link
              >
            </ui-sidebar-menu-item>
          </ui-sidebar-menu>
        </ui-sidebar-content>
      </ui-sidebar>
    </ui-sidebar-provider>
  `,
  imports: [
    SidebarComponent,
    SidebarProviderComponent,
    SidebarContentComponent,
    SidebarMenuComponent,
    SidebarMenuItemComponent,
    SidebarMenuLinkComponent,
  ],
})
class PlainLinkHostComponent {
  readonly active = signal(false);
  navigations = 0;

  onNavigated(): void {
    this.navigations++;
  }
}

@Component({
  selector: 'test-persist-host',
  template: `
    <ui-sidebar-provider [persistCollapsed]="persist()" [storageKey]="key()">
      <ui-sidebar>
        <ui-sidebar-content>content</ui-sidebar-content>
      </ui-sidebar>
      <ui-sidebar-trigger />
    </ui-sidebar-provider>
  `,
  imports: [
    SidebarComponent,
    SidebarProviderComponent,
    SidebarContentComponent,
    SidebarTriggerComponent,
  ],
})
class PersistHostComponent {
  readonly persist = signal(true);
  readonly key = signal(SIDEBAR_STORAGE_KEY);
}

@Component({
  selector: 'test-nested-host',
  template: `
    <ui-sidebar-provider>
      <ui-sidebar>
        <ui-sidebar-content>
          <ui-sidebar-menu>
            <ui-sidebar-menu-item>
              <ui-sidebar-menu-sub-trigger [sub]="projects">
                <span>Projects</span>
              </ui-sidebar-menu-sub-trigger>
              <ui-sidebar-menu-badge>4</ui-sidebar-menu-badge>
              <ui-sidebar-menu-action label="Project options" (triggered)="actions = actions + 1">
                <svg viewBox="0 0 24 24"><path d="M0 0" /></svg>
              </ui-sidebar-menu-action>
              <ui-sidebar-menu-sub #projects [(expanded)]="projectsOpen">
                <ui-sidebar-menu-sub-item>
                  <ui-sidebar-menu-sub-button href="/alpha">Alpha</ui-sidebar-menu-sub-button>
                </ui-sidebar-menu-sub-item>
                <ui-sidebar-menu-sub-item>
                  <ui-sidebar-menu-sub-button href="/beta">Beta</ui-sidebar-menu-sub-button>
                </ui-sidebar-menu-sub-item>
              </ui-sidebar-menu-sub>
            </ui-sidebar-menu-item>
            @for (row of skeletonRows; track row) {
              <ui-sidebar-menu-skeleton [seed]="row" />
            }
          </ui-sidebar-menu>
        </ui-sidebar-content>
        <ui-sidebar-rail />
      </ui-sidebar>
    </ui-sidebar-provider>
  `,
  imports: [
    SidebarComponent,
    SidebarProviderComponent,
    SidebarContentComponent,
    SidebarMenuComponent,
    SidebarMenuItemComponent,
    SidebarMenuSubComponent,
    SidebarMenuSubItemComponent,
    SidebarMenuSubButtonComponent,
    SidebarMenuSubTriggerComponent,
    SidebarMenuActionComponent,
    SidebarMenuBadgeComponent,
    SidebarMenuSkeletonComponent,
    SidebarRailComponent,
  ],
})
class NestedHostComponent {
  readonly projectsOpen = signal(true);
  readonly skeletonRows = [0, 1, 2];
  actions = 0;
}

/** Nothing bound to `expanded` — exercises the input's own default. */
@Component({
  selector: 'test-unbound-sub-host',
  template: `
    <ui-sidebar-provider>
      <ui-sidebar>
        <ui-sidebar-content>
          <ui-sidebar-menu>
            <ui-sidebar-menu-item>
              <ui-sidebar-menu-sub>
                <ui-sidebar-menu-sub-item>
                  <ui-sidebar-menu-sub-button href="/solo">Solo</ui-sidebar-menu-sub-button>
                </ui-sidebar-menu-sub-item>
              </ui-sidebar-menu-sub>
            </ui-sidebar-menu-item>
          </ui-sidebar-menu>
        </ui-sidebar-content>
      </ui-sidebar>
    </ui-sidebar-provider>
  `,
  imports: [
    SidebarComponent,
    SidebarProviderComponent,
    SidebarContentComponent,
    SidebarMenuComponent,
    SidebarMenuItemComponent,
    SidebarMenuSubComponent,
    SidebarMenuSubItemComponent,
    SidebarMenuSubButtonComponent,
  ],
})
class UnboundSubHostComponent {}

describe('Sidebar', () => {
  const fixtures: ComponentFixture<unknown>[] = [];
  let originalInnerWidth: PropertyDescriptor | undefined;
  let originalResizeObserver: typeof globalThis.ResizeObserver;

  function track<T>(fixture: ComponentFixture<T>): ComponentFixture<T> {
    fixtures.push(fixture as ComponentFixture<unknown>);
    return fixture;
  }

  // Defined rather than assigned: other suites stub `innerWidth` with
  // `defineProperty(..., { value })`, which omits `writable` and so leaves the
  // property read-only for the rest of the run — a plain assignment here then
  // throws in strict mode, depending on which file ran first. Re-defining is
  // order-independent. The original descriptor (an accessor with a setter) is
  // put back in afterEach, so this suite leaves no trace of its own.
  function setInnerWidth(width: number): void {
    Object.defineProperty(globalThis.window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
  }

  function restoreInnerWidth(): void {
    if (originalInnerWidth) {
      Object.defineProperty(globalThis.window, 'innerWidth', originalInnerWidth);
    }
  }

  function getService(fixture: ComponentFixture<unknown>): SidebarService {
    const provider = fixture.debugElement.query(By.directive(SidebarProviderComponent));
    return provider.injector.get(SidebarService);
  }

  async function createMainHost(): Promise<ComponentFixture<MainHostComponent>> {
    await TestBed.configureTestingModule({ imports: [MainHostComponent] }).compileComponents();
    const fixture = track(TestBed.createComponent(MainHostComponent));
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
    originalInnerWidth = Object.getOwnPropertyDescriptor(globalThis.window, 'innerWidth');
    setInnerWidth(1024);
  });

  afterEach(() => {
    for (const fixture of fixtures) {
      fixture.destroy();
    }
    fixtures.length = 0;
    vi.useRealTimers();
    restoreInnerWidth();
    (globalThis as unknown as { ResizeObserver: typeof globalThis.ResizeObserver }).ResizeObserver =
      originalResizeObserver;
  });

  describe('SidebarService', () => {
    /**
     * The service injects `DOCUMENT` (for `localStorage`), so it needs an
     * injection context — `new SidebarService()` throws outside one.
     */
    function createService(): SidebarService {
      TestBed.configureTestingModule({ providers: [SidebarService] });
      return TestBed.inject(SidebarService);
    }

    it('toggles collapse on desktop and open on mobile', () => {
      const service = createService();

      service.isMobile.set(false);
      service.toggle();
      expect(service.isCollapsed()).toBe(true);
      service.toggle();
      expect(service.isCollapsed()).toBe(false);

      service.isMobile.set(true);
      service.isOpen.set(true);
      service.toggle();
      expect(service.isOpen()).toBe(false);
    });

    it('opens, closes and switches to mobile (forcing closed)', () => {
      const service = createService();

      service.open();
      expect(service.isOpen()).toBe(true);
      service.close();
      expect(service.isOpen()).toBe(false);

      service.open();
      service.setMobile(true);
      expect(service.isMobile()).toBe(true);
      expect(service.isOpen()).toBe(false);

      service.setMobile(false);
      expect(service.isMobile()).toBe(false);
    });
  });

  describe('structure and simple parts', () => {
    it('renders header, content, footer, menu and inset', async () => {
      const fixture = await createMainHost();
      const q = (slot: string) =>
        fixture.debugElement.query(By.css(`[data-slot="${slot}"]`));

      expect(q('sidebar-header')).toBeTruthy();
      expect(q('sidebar-content')).toBeTruthy();
      expect(q('sidebar-footer')).toBeTruthy();
      expect(q('sidebar-group')).toBeTruthy();
      expect(q('sidebar-group-label')).toBeTruthy();
      expect(q('sidebar-group-content')).toBeTruthy();
      expect(q('sidebar-menu')).toBeTruthy();
      expect(q('sidebar-menu-item')).toBeTruthy();
      expect(q('sidebar-menu-button')).toBeTruthy();
      expect(q('sidebar-menu-link')).toBeTruthy();
      expect(q('sidebar-separator')).toBeTruthy();
      expect(q('sidebar-inset')).toBeTruthy();
    });

    it('applies the custom class to the aside element', async () => {
      const fixture = await createMainHost();
      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));
      expect(aside.nativeElement.getAttribute('class') ?? '').toContain('custom-sidebar-class');
    });

    it('reflects the active menu button and link state', async () => {
      const fixture = await createMainHost();
      const button = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-button"]'));
      const link = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-link"]'));
      expect(button.nativeElement.getAttribute('data-active')).toBe('true');
      expect(link.nativeElement.getAttribute('data-active')).toBe('false');
      expect(link.nativeElement.getAttribute('href')).toBe('/about');
    });
  });

  describe('desktop toggle and collapsed mode', () => {
    it('collapses via the trigger and updates collapsed-only classes', async () => {
      const fixture = await createMainHost();
      const service = getService(fixture);
      expect(service.isMobile()).toBe(false);
      expect(service.isCollapsed()).toBe(false);

      const trigger = fixture.debugElement.query(By.css('[data-slot="sidebar-trigger"]'));
      trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(service.isCollapsed()).toBe(true);

      const button = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-button"]'));
      const link = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-link"]'));
      const header = fixture.debugElement.query(By.css('[data-slot="sidebar-header"]'));
      const groupLabel = fixture.debugElement.query(By.css('[data-slot="sidebar-group-label"]'));
      expect(button.nativeElement.getAttribute('data-collapsed')).toBe('true');
      expect(link.nativeElement.getAttribute('data-collapsed')).toBe('true');
      expect(header.nativeElement.getAttribute('class') ?? '').toContain('overflow-hidden');
      expect(groupLabel.nativeElement.getAttribute('class') ?? '').toContain('sr-only');
    });

    it('renders the hidden collapse mode width when collapsed', async () => {
      const fixture = await createMainHost();
      const service = getService(fixture);
      fixture.componentInstance.mode.set('hidden');
      service.isCollapsed.set(true);
      fixture.detectChanges();

      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));
      expect(aside.nativeElement.getAttribute('class') ?? '').toContain('w-0');
    });

    it('renders a distinct desktop chrome per variant', async () => {
      const fixture = await createMainHost();
      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));

      const classesFor = (variant: Variant): string => {
        fixture.componentInstance.variant.set(variant);
        fixture.detectChanges();
        return aside.nativeElement.getAttribute('class') ?? '';
      };

      const sidebar = classesFor('sidebar');
      const floating = classesFor('floating');
      const inset = classesFor('inset');

      expect(sidebar).toContain('border-e');
      expect(sidebar).not.toContain('rounded-lg');

      expect(floating).toContain('rounded-lg');
      expect(floating).toContain('shadow-lg');

      expect(inset).toContain('rounded-lg');
      expect(inset).toContain('border-none');
      expect(inset).not.toContain('shadow-lg');

      expect(new Set([sidebar, floating, inset]).size).toBe(3);
      expect(aside.nativeElement.getAttribute('data-variant')).toBe('inset');
    });

    it('does not collapse while collapsible is false', async () => {
      const fixture = await createMainHost();
      const service = getService(fixture);
      fixture.componentInstance.collapsible.set(false);
      fixture.detectChanges();

      const trigger = fixture.debugElement.query(By.css('[data-slot="sidebar-trigger"]'));
      trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(service.isCollapsed()).toBe(false);
      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));
      expect(aside.nativeElement.getAttribute('class') ?? '').toContain('w-[280px]');
      expect(aside.nativeElement.getAttribute('data-collapsible')).toBe('none');
    });

    it('expands an already-collapsed rail when collapsible turns false', async () => {
      const fixture = await createMainHost();
      const service = getService(fixture);
      service.isCollapsed.set(true);
      fixture.detectChanges();
      expect(service.isCollapsed()).toBe(true);

      fixture.componentInstance.collapsible.set(false);
      fixture.detectChanges();

      expect(service.isCollapsed()).toBe(false);
    });

    it('renders on the right side', async () => {
      const fixture = await createMainHost();
      fixture.componentInstance.side.set('right');
      fixture.detectChanges();

      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));
      expect(aside.nativeElement.getAttribute('data-side')).toBe('right');
    });
  });

  describe('responsive mobile detection', () => {
    it('switches to mobile on window resize below the breakpoint', async () => {
      const fixture = await createMainHost();
      const service = getService(fixture);
      expect(service.isMobile()).toBe(false);

      setInnerWidth(500);
      globalThis.window.dispatchEvent(new Event('resize'));
      fixture.detectChanges();

      expect(service.isMobile()).toBe(true);
    });
  });

  describe('mobile overlay and toggle', () => {
    it('renders the overlay and closes on click, enter and space', async () => {
      const fixture = await createMainHost();
      const service = getService(fixture);
      service.setMobile(true);
      service.open();
      fixture.detectChanges();

      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));
      expect(aside.nativeElement.getAttribute('class') ?? '').toContain('translate-x-0');

      let overlay = fixture.debugElement.query(By.css('.fixed.inset-0.z-40'));
      expect(overlay).toBeTruthy();
      overlay.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(service.isOpen()).toBe(false);

      service.open();
      fixture.detectChanges();
      overlay = fixture.debugElement.query(By.css('.fixed.inset-0.z-40'));
      overlay.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
      fixture.detectChanges();
      expect(service.isOpen()).toBe(false);

      service.open();
      fixture.detectChanges();
      overlay = fixture.debugElement.query(By.css('.fixed.inset-0.z-40'));
      overlay.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true })
      );
      fixture.detectChanges();
      expect(service.isOpen()).toBe(false);
    });

    it('renders the right-side mobile transform when closed', async () => {
      const fixture = await createMainHost();
      const service = getService(fixture);
      fixture.componentInstance.side.set('right');
      service.setMobile(true);
      fixture.detectChanges();

      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));
      expect(aside.nativeElement.getAttribute('class') ?? '').toContain('translate-x-full');
      expect(aside.nativeElement.getAttribute('class') ?? '').toContain('right-0');
    });

    it('toggles open state via the trigger while in mobile mode', async () => {
      const fixture = await createMainHost();
      const service = getService(fixture);
      service.setMobile(true);
      fixture.detectChanges();
      expect(service.isOpen()).toBe(false);

      const trigger = fixture.debugElement.query(By.css('[data-slot="sidebar-trigger"]'));
      trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(service.isOpen()).toBe(true);
    });
  });

  describe('focus management effect', () => {
    it('restores focus to the previous element when the mobile sidebar closes', async () => {
      vi.useFakeTimers();
      const fixture = await createMainHost();
      const service = getService(fixture);

      const marker = document.createElement('button');
      document.body.appendChild(marker);
      marker.focus();

      service.setMobile(true);
      service.open();
      fixture.detectChanges();
      vi.runAllTimers();

      service.close();
      fixture.detectChanges();

      expect(document.activeElement).toBe(marker);
      marker.remove();
      vi.useRealTimers();
    });
  });

  describe('mobile focus trap', () => {
    async function createFocusTrapHost(): Promise<ComponentFixture<FocusTrapHostComponent>> {
      vi.useFakeTimers();
      await TestBed.configureTestingModule({ imports: [FocusTrapHostComponent] }).compileComponents();
      const fixture = track(TestBed.createComponent(FocusTrapHostComponent));
      fixture.detectChanges();
      vi.runAllTimers();
      return fixture;
    }

    it('focuses the first focusable element on init', async () => {
      const fixture = await createFocusTrapHost();
      const firstBtn = fixture.nativeElement.querySelector('.first-btn') as HTMLElement;
      expect(document.activeElement).toBe(firstBtn);
      vi.useRealTimers();
    });

    it('wraps focus forward from the last element on Tab', async () => {
      const fixture = await createFocusTrapHost();
      const firstBtn = fixture.nativeElement.querySelector('.first-btn') as HTMLElement;
      const lastBtn = fixture.nativeElement.querySelector('.last-btn') as HTMLElement;
      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));

      lastBtn.focus();
      aside.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      );
      expect(document.activeElement).toBe(firstBtn);
      vi.useRealTimers();
    });

    it('wraps focus backward from the first element on Shift+Tab', async () => {
      const fixture = await createFocusTrapHost();
      const firstBtn = fixture.nativeElement.querySelector('.first-btn') as HTMLElement;
      const lastBtn = fixture.nativeElement.querySelector('.last-btn') as HTMLElement;
      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));

      firstBtn.focus();
      aside.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
      );
      expect(document.activeElement).toBe(lastBtn);
      vi.useRealTimers();
    });

    it('does nothing on Tab when focus is mid-list', async () => {
      const fixture = await createFocusTrapHost();
      const firstBtn = fixture.nativeElement.querySelector('.first-btn') as HTMLElement;
      const lastBtn = fixture.nativeElement.querySelector('.last-btn') as HTMLElement;
      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));

      firstBtn.focus();
      aside.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      );
      expect(document.activeElement).toBe(firstBtn);

      lastBtn.focus();
      aside.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
      );
      expect(document.activeElement).toBe(lastBtn);
      vi.useRealTimers();
    });

    it('closes the sidebar on Escape', async () => {
      const fixture = await createFocusTrapHost();
      const service = fixture.componentInstance.service;
      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));

      aside.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      expect(service.isOpen()).toBe(false);
      vi.useRealTimers();
    });

    it('ignores keydown when not in mobile open state', async () => {
      const fixture = await createFocusTrapHost();
      const service = fixture.componentInstance.service;
      service.isMobile.set(false);
      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));

      aside.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      expect(service.isOpen()).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('focus fallback with no focusable content', () => {
    it('focuses the sidebar container and no-ops Tab with zero focusables', async () => {
      vi.useFakeTimers();
      await TestBed.configureTestingModule({ imports: [NoFocusHostComponent] }).compileComponents();
      const fixture = track(TestBed.createComponent(NoFocusHostComponent));
      fixture.detectChanges();
      vi.runAllTimers();

      const aside = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));
      expect(document.activeElement).toBe(aside.nativeElement);

      aside.nativeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      );
      expect(document.activeElement).toBe(aside.nativeElement);
      vi.useRealTimers();
    });
  });

  describe('menu button interaction', () => {
    it('emits the clicked event with the mouse event', async () => {
      const fixture = await createMainHost();
      const button = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-button"]'));
      button.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(fixture.componentInstance.clicks).toBe(1);
      expect(fixture.componentInstance.lastEvent).toBeInstanceOf(MouseEvent);
    });
  });

  /**
   * Item 1 of the app-shell brief: `ui-sidebar-menu-link` used to be a plain
   * `<a [href]>` whose JSDoc told consumers to fork the file for routing. These
   * cover both modes of the replacement — and in particular that the active
   * state of a routed link follows the URL rather than a bound input, which is
   * the whole point of the change.
   */
  describe('menu link routing', () => {
    async function createRouterHost(
      initialUrl = '/home'
    ): Promise<ComponentFixture<RouterHostComponent>> {
      await TestBed.configureTestingModule({
        imports: [RouterHostComponent],
        providers: [
          provideRouter([
            { path: 'home', component: BlankRouteComponent },
            { path: 'about', component: BlankRouteComponent },
            { path: 'about/team', component: BlankRouteComponent },
          ]),
        ],
      }).compileComponents();

      const fixture = track(TestBed.createComponent(RouterHostComponent));
      fixture.detectChanges();
      await navigateTo(fixture, initialUrl);
      return fixture;
    }

    /**
     * Navigates and then settles the active state. `RouterLinkActive.update()`
     * defers its work into a `queueMicrotask`, so `isActiveChange` — and hence
     * `data-active` — lands one microtask AFTER `navigateByUrl` resolves. A
     * plain `detectChanges()` here reads the pre-navigation state and the
     * assertion passes or fails on whatever an earlier test happened to leave
     * behind. Awaiting a macrotask drains that microtask queue first.
     */
    async function navigateTo(
      fixture: ComponentFixture<unknown>,
      url: string
    ): Promise<void> {
      await TestBed.inject(Router).navigateByUrl(url);
      await new Promise(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();
    }

    function linkByText(
      fixture: ComponentFixture<unknown>,
      text: string
    ): HTMLAnchorElement {
      const match = fixture.debugElement
        .queryAll(By.css('a[data-slot="sidebar-menu-link"]'))
        .find(candidate => (candidate.nativeElement.textContent ?? '').trim() === text);
      if (!match) throw new Error(`no sidebar menu link labelled "${text}"`);
      return match.nativeElement as HTMLAnchorElement;
    }

    it('resolves routerLink into a real href', async () => {
      const fixture = await createRouterHost();
      expect(linkByText(fixture, 'Home').getAttribute('href')).toBe('/home');
      expect(linkByText(fixture, 'About').getAttribute('href')).toBe('/about');
    });

    it('derives the active state from the route, not from an input', async () => {
      const fixture = await createRouterHost('/home');
      expect(linkByText(fixture, 'Home').getAttribute('data-active')).toBe('true');
      expect(linkByText(fixture, 'About').getAttribute('data-active')).toBe('false');

      // Nothing on the host changes here — only the URL does.
      await navigateTo(fixture, '/about');

      expect(linkByText(fixture, 'Home').getAttribute('data-active')).toBe('false');
      expect(linkByText(fixture, 'About').getAttribute('data-active')).toBe('true');
    });

    it('applies the accent class and aria-current to the routed active link', async () => {
      const fixture = await createRouterHost('/home');
      const home = linkByText(fixture, 'Home');
      expect(home.getAttribute('class') ?? '').toContain('bg-sidebar-accent');
      expect(home.getAttribute('aria-current')).toBe('page');
      expect(linkByText(fixture, 'About').getAttribute('aria-current')).toBeNull();
    });

    /**
     * The default is `{ exact: false }`, so a parent route stays highlighted on a
     * child URL. `/about/team` is the general case for this: a two-segment child
     * under a one-segment parent. Navigating to `/about` itself would pass under
     * both exact and non-exact matching and so would prove nothing.
     */
    it('keeps a parent link active on a child route by default', async () => {
      const fixture = await createRouterHost('/about/team');
      expect(linkByText(fixture, 'About').getAttribute('data-active')).toBe('true');
    });

    it('honours exact matching when routerLinkActiveOptions asks for it', async () => {
      const fixture = await createRouterHost('/about/team');
      expect(linkByText(fixture, 'About exact').getAttribute('data-active')).toBe('false');

      await navigateTo(fixture, '/about');
      expect(linkByText(fixture, 'About exact').getAttribute('data-active')).toBe('true');
    });

    it('navigates on click and moves the active state with it', async () => {
      const fixture = await createRouterHost('/home');

      linkByText(fixture, 'About').click();
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();

      expect(TestBed.inject(Router).url).toBe('/about');
      expect(linkByText(fixture, 'About').getAttribute('data-active')).toBe('true');
      expect(linkByText(fixture, 'Home').getAttribute('data-active')).toBe('false');
    });

    it('emits navigated on click in router mode', async () => {
      const fixture = await createRouterHost('/home');
      linkByText(fixture, 'About').click();
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();
      expect(fixture.componentInstance.navigations).toBe(1);
    });

    it('applies target on a routed link too, not only on href links', async () => {
      const fixture = await createRouterHost();
      expect(linkByText(fixture, 'External route').getAttribute('target')).toBe('_blank');
    });

    /**
     * Seeding path 1 of 2. A link that is already active on FIRST PAINT never
     * sees a `NavigationEnd` (the navigation completed before the component
     * existed) and `isActiveChange` may have fired before the binding was live,
     * so only the post-view-init read can set it. The host is created AFTER the
     * router has already settled on /about, which is the shape that isolates
     * this path — a host created before navigating would be rescued by the
     * NavigationEnd subscription instead.
     */
    it('marks a link active on first paint, with no navigation after creation', async () => {
      await TestBed.configureTestingModule({
        imports: [RouterHostComponent],
        providers: [
          provideRouter([
            { path: 'home', component: BlankRouteComponent },
            { path: 'about', component: BlankRouteComponent },
            { path: 'about/team', component: BlankRouteComponent },
          ]),
        ],
      }).compileComponents();

      const router = TestBed.inject(Router);
      await router.navigateByUrl('/about');

      const fixture = track(TestBed.createComponent(RouterHostComponent));
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 0));
      fixture.detectChanges();

      expect(linkByText(fixture, 'About').getAttribute('data-active')).toBe('true');
      expect(linkByText(fixture, 'Home').getAttribute('data-active')).toBe('false');
    });

    /**
     * Seeding path 2 of 2. `isActiveChange` fires on a transition, but a link
     * going from active to INACTIVE while another becomes active exercises the
     * NavigationEnd resync: without it a link can keep a stale `true` after the
     * route moves away. Distinct from the first-paint case above, which the
     * post-view-init read covers.
     */
    it('clears a stale active state when the route moves away', async () => {
      const fixture = await createRouterHost('/about/team');
      expect(linkByText(fixture, 'About').getAttribute('data-active')).toBe('true');

      await navigateTo(fixture, '/home');

      expect(linkByText(fixture, 'About').getAttribute('data-active')).toBe('false');
      expect(linkByText(fixture, 'Home').getAttribute('data-active')).toBe('true');
    });

    it('carries queryParams and fragment into the resolved href', async () => {
      const fixture = await createRouterHost();
      expect(linkByText(fixture, 'Home params').getAttribute('href')).toBe(
        '/home?tab=settings#section'
      );
    });

    /**
     * The href branch must not instantiate `RouterLink`, which injects `Router`
     * as a hard dependency. This host has no `provideRouter` at all, so if the
     * routed branch were ever rendered unconditionally the fixture would throw
     * on creation rather than merely fail an assertion.
     */
    it('renders plain href links in an app with no router provider', async () => {
      await TestBed.configureTestingModule({
        imports: [PlainLinkHostComponent],
      }).compileComponents();
      const fixture = track(TestBed.createComponent(PlainLinkHostComponent));
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css('a[data-slot="sidebar-menu-link"]'));
      expect(link.nativeElement.getAttribute('href')).toBe('https://example.com/docs');
      expect(link.nativeElement.getAttribute('target')).toBe('_blank');
    });

    it('honours the isActive input in href mode', async () => {
      await TestBed.configureTestingModule({
        imports: [PlainLinkHostComponent],
      }).compileComponents();
      const fixture = track(TestBed.createComponent(PlainLinkHostComponent));
      fixture.detectChanges();
      const link = fixture.debugElement.query(By.css('a[data-slot="sidebar-menu-link"]'));

      expect(link.nativeElement.getAttribute('data-active')).toBe('false');
      fixture.componentInstance.active.set(true);
      fixture.detectChanges();
      expect(link.nativeElement.getAttribute('data-active')).toBe('true');
    });

    it('emits navigated on click in href mode', async () => {
      await TestBed.configureTestingModule({
        imports: [PlainLinkHostComponent],
      }).compileComponents();
      const fixture = track(TestBed.createComponent(PlainLinkHostComponent));
      fixture.detectChanges();

      const link = fixture.debugElement.query(By.css('a[data-slot="sidebar-menu-link"]'));
      link.nativeElement.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
      fixture.detectChanges();

      expect(fixture.componentInstance.navigations).toBe(1);
    });

    /**
     * `routerLink=""` is a real destination ("this route"), so it must select the
     * routed branch. It resolves against the sidebar's own `ActivatedRoute`,
     * which is the root — hence `/`, not the current URL. The assertion that
     * matters is that it is NOT the `#` href fallback, which is what a
     * truthiness check on the input would have produced.
     */
    it('treats an empty-string routerLink as routed, not as unset', async () => {
      const fixture = await createRouterHost('/home');
      const self = linkByText(fixture, 'Self');
      expect(self.getAttribute('href')).toBe('/');
      expect(self.getAttribute('href')).not.toBe('#');
    });
  });

  /**
   * Item 2 of the app-shell brief: the collapsed rail used to reset on every
   * reload because the service held plain in-memory signals.
   */
  describe('collapsed-state persistence', () => {
    const KEY = SIDEBAR_STORAGE_KEY;

    async function createPersistHost(): Promise<ComponentFixture<PersistHostComponent>> {
      await TestBed.configureTestingModule({ imports: [PersistHostComponent] }).compileComponents();
      const fixture = track(TestBed.createComponent(PersistHostComponent));
      fixture.detectChanges();
      return fixture;
    }

    function collapsedAttr(fixture: ComponentFixture<unknown>): string | null {
      return fixture.debugElement
        .query(By.css('[data-slot="sidebar-provider"]'))
        .nativeElement.getAttribute('data-collapsed');
    }

    beforeEach(() => {
      globalThis.localStorage.clear();
    });

    afterEach(() => {
      globalThis.localStorage.clear();
    });

    it('writes the collapsed flag when the rail is toggled', async () => {
      const fixture = await createPersistHost();
      expect(globalThis.localStorage.getItem(KEY)).toBeNull();

      fixture.debugElement
        .query(By.css('[data-slot="sidebar-trigger"]'))
        .nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(globalThis.localStorage.getItem(KEY)).toBe('true');
    });

    it('writes the expanded flag when toggled back', async () => {
      const fixture = await createPersistHost();
      const trigger = fixture.debugElement.query(By.css('[data-slot="sidebar-trigger"]'));

      trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      trigger.nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(globalThis.localStorage.getItem(KEY)).toBe('false');
    });

    /**
     * The reload case, which is the whole point of the feature: a fresh
     * component tree over an already-populated store must come up collapsed.
     */
    it('restores the collapsed rail from storage on a fresh mount', async () => {
      globalThis.localStorage.setItem(KEY, 'true');
      const fixture = await createPersistHost();

      expect(getService(fixture).isCollapsed()).toBe(true);
      expect(collapsedAttr(fixture)).toBe('true');
    });

    it('restores an expanded rail from storage on a fresh mount', async () => {
      globalThis.localStorage.setItem(KEY, 'false');
      const fixture = await createPersistHost();

      expect(getService(fixture).isCollapsed()).toBe(false);
      expect(collapsedAttr(fixture)).toBe('false');
    });

    it('starts expanded when nothing is stored', async () => {
      const fixture = await createPersistHost();
      expect(getService(fixture).isCollapsed()).toBe(false);
    });

    /**
     * A value we did not write is treated as absent rather than coerced — a
     * stray key from another app on the same origin must not collapse the rail.
     * `'1'` is the general case here: truthy under a naive `Boolean(raw)` and
     * under `raw !== 'false'`, so it discriminates between real parsing and
     * either sloppy shortcut.
     */
    it('ignores a stored value it did not write', async () => {
      globalThis.localStorage.setItem(KEY, '1');
      const fixture = await createPersistHost();
      expect(getService(fixture).isCollapsed()).toBe(false);
    });

    it('does not read or write when persistence is opted out', async () => {
      globalThis.localStorage.setItem(KEY, 'true');

      await TestBed.configureTestingModule({ imports: [PersistHostComponent] }).compileComponents();
      const fixture = track(TestBed.createComponent(PersistHostComponent));
      fixture.componentInstance.persist.set(false);
      fixture.detectChanges();

      expect(getService(fixture).isCollapsed()).toBe(false);

      fixture.debugElement
        .query(By.css('[data-slot="sidebar-trigger"]'))
        .nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(getService(fixture).isCollapsed()).toBe(true);
      // Still the pre-existing value: opting out must not write either, or a
      // disabled sidebar would silently clobber an enabled one's preference.
      expect(globalThis.localStorage.getItem(KEY)).toBe('true');

      fixture.debugElement
        .query(By.css('[data-slot="sidebar-trigger"]'))
        .nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(getService(fixture).isCollapsed()).toBe(false);
      expect(globalThis.localStorage.getItem(KEY)).toBe('true');
    });

    it('keeps two sidebars on one origin apart via distinct keys', async () => {
      globalThis.localStorage.setItem('sidebar-a', 'true');
      globalThis.localStorage.setItem('sidebar-b', 'false');

      await TestBed.configureTestingModule({ imports: [PersistHostComponent] }).compileComponents();
      const first = track(TestBed.createComponent(PersistHostComponent));
      first.componentInstance.key.set('sidebar-a');
      first.detectChanges();

      const second = track(TestBed.createComponent(PersistHostComponent));
      second.componentInstance.key.set('sidebar-b');
      second.detectChanges();

      expect(getService(first).isCollapsed()).toBe(true);
      expect(getService(second).isCollapsed()).toBe(false);

      globalThis.localStorage.removeItem('sidebar-a');
      globalThis.localStorage.removeItem('sidebar-b');
    });

    /**
     * The narrower failure: reads succeed but `setItem` throws, which is what
     * Safari's private mode does on quota. The access-throws stub below cannot
     * reach this path because the read guard catches it first, so this needs
     * its own store.
     */
    describe('when setItem throws but reads work', () => {
      let original: PropertyDescriptor | undefined;

      beforeEach(() => {
        original = Object.getOwnPropertyDescriptor(globalThis.window, 'localStorage');
        // Reads succeed and always report "nothing stored"; only writes fail.
        // Keeping a real backing map would be dead weight, since setItem never
        // reaches it.
        Object.defineProperty(globalThis.window, 'localStorage', {
          configurable: true,
          value: {
            getItem: () => null,
            setItem: () => {
              throw new DOMException('quota exceeded', 'QuotaExceededError');
            },
            removeItem: () => undefined,
            clear: () => undefined,
          },
        });
      });

      afterEach(() => {
        if (original) {
          Object.defineProperty(globalThis.window, 'localStorage', original);
        }
      });

      /*
       * Asserting only on the rendered state is NOT enough here: Angular
       * reports an exception thrown from an event handler as an unhandled
       * error and still applies the signal update, so the sidebar looks
       * correct while the throw escapes into the consumer's app. The service
       * is therefore driven directly, where an unguarded `setItem` propagates
       * to this call and fails the test.
       */
      it('still toggles when the write is rejected', async () => {
        const fixture = await createPersistHost();
        const service = getService(fixture);

        expect(() => service.toggle()).not.toThrow();

        fixture.detectChanges();
        expect(service.isCollapsed()).toBe(true);
        expect(collapsedAttr(fixture)).toBe('true');
      });

      it('does not throw when seeding from an unreadable store', async () => {
        expect(() => createPersistHost()).not.toThrow();
      });
    });

    /**
     * Private windows and blocked site data throw on ACCESS, not just on
     * setItem — so the stub throws from the property getter, which is the
     * harsher of the two and the one a `try { setItem }` alone would miss.
     * The sidebar must still render and still toggle in memory.
     */
    describe('when localStorage is unavailable', () => {
      let original: PropertyDescriptor | undefined;

      beforeEach(() => {
        original = Object.getOwnPropertyDescriptor(globalThis.window, 'localStorage');
        Object.defineProperty(globalThis.window, 'localStorage', {
          configurable: true,
          get() {
            throw new DOMException('access denied', 'SecurityError');
          },
        });
      });

      afterEach(() => {
        if (original) {
          Object.defineProperty(globalThis.window, 'localStorage', original);
        }
      });

      it('still renders and still toggles', async () => {
        const fixture = await createPersistHost();

        expect(fixture.debugElement.query(By.css('[data-slot="sidebar"]'))).toBeTruthy();
        expect(getService(fixture).isCollapsed()).toBe(false);

        fixture.debugElement
          .query(By.css('[data-slot="sidebar-trigger"]'))
          .nativeElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        expect(getService(fixture).isCollapsed()).toBe(true);
        expect(collapsedAttr(fixture)).toBe('true');
      });
    });
  });

  /**
   * Item 3 of the app-shell brief: nested menus plus the action / badge /
   * skeleton / rail parts. The sub list is deliberately always rendered and
   * hidden with `inert` + a grid-rows transition, so these assert reachability
   * (inert) and state, not the animation itself.
   */
  describe('nested menus', () => {
    /*
     * The provider persists the collapsed rail to localStorage, so a test that
     * collapses it seeds the next fixture's initial state. Clearing between
     * tests keeps each one independent — without this the rail cases pass or
     * fail depending on the order they run in.
     */
    beforeEach(() => {
      globalThis.localStorage.clear();
    });

    afterEach(() => {
      globalThis.localStorage.clear();
    });

    async function createNestedHost(): Promise<ComponentFixture<NestedHostComponent>> {
      await TestBed.configureTestingModule({ imports: [NestedHostComponent] }).compileComponents();
      const fixture = track(TestBed.createComponent(NestedHostComponent));
      fixture.detectChanges();
      return fixture;
    }

    function subList(fixture: ComponentFixture<unknown>): HTMLElement {
      return fixture.debugElement.query(By.css('[data-slot="sidebar-menu-sub"] ul')).nativeElement;
    }

    function trigger(fixture: ComponentFixture<unknown>): HTMLElement {
      return fixture.debugElement.query(By.css('[data-slot="sidebar-menu-sub-trigger"]')).nativeElement;
    }

    it('renders sub items as list items inside a nested list', async () => {
      const fixture = await createNestedHost();
      const list = subList(fixture);

      expect(list.tagName).toBe('UL');
      const items = list.querySelectorAll('[data-slot="sidebar-menu-sub-item"]');
      expect(items).toHaveLength(2);
      for (const item of Array.from(items)) {
        expect(item.getAttribute('role')).toBe('listitem');
      }
    });

    /** The sidebar is a navigation list, not an ARIA menu widget. */
    it('never declares menu roles on the nested list', async () => {
      const fixture = await createNestedHost();
      const sidebar = fixture.debugElement.query(By.css('[data-slot="sidebar"]')).nativeElement;
      expect(sidebar.querySelectorAll('[role="menu"]')).toHaveLength(0);
      expect(sidebar.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
      expect(sidebar.querySelectorAll('[role="menubar"]')).toHaveLength(0);
    });

    it('starts expanded by default', async () => {
      const fixture = await createNestedHost();
      expect(trigger(fixture).getAttribute('aria-expanded')).toBe('true');
      expect(subList(fixture).hasAttribute('inert')).toBe(false);
    });

    /**
     * The host above binds `[(expanded)]`, which would mask the input's own
     * default. This mounts a sub with nothing bound — the shape a consumer
     * writing plain markup gets — so a default of `false` is caught.
     */
    it('defaults to open when expanded is never bound', async () => {
      await TestBed.configureTestingModule({ imports: [UnboundSubHostComponent] }).compileComponents();
      const fixture = track(TestBed.createComponent(UnboundSubHostComponent));
      fixture.detectChanges();

      const list = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-sub"] ul')).nativeElement;
      expect(list.hasAttribute('inert')).toBe(false);
      expect(
        fixture.debugElement
          .query(By.css('[data-slot="sidebar-menu-sub"]'))
          .nativeElement.getAttribute('data-state')
      ).toBe('open');
    });

    /**
     * The whole point of keeping the list rendered: it must leave the tab order
     * when closed, or Tab would walk invisible rows. `inert` is what does that,
     * so it is asserted directly rather than via a class string.
     */
    it('makes the closed list inert so Tab skips it', async () => {
      const fixture = await createNestedHost();

      trigger(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(subList(fixture).hasAttribute('inert')).toBe(true);
      expect(trigger(fixture).getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps the closed list in the DOM so the collapse can animate', async () => {
      const fixture = await createNestedHost();

      trigger(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      const wrapper = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-sub"]')).nativeElement;
      expect(wrapper.querySelectorAll('[data-slot="sidebar-menu-sub-button"]')).toHaveLength(2);
      expect(wrapper.getAttribute('data-state')).toBe('closed');
      expect(wrapper.getAttribute('class') ?? '').toContain('grid-rows-[0fr]');

      /*
       * `display: none` (or a `hidden` attribute) would suppress the
       * grid-template-rows transition entirely, so the collapse would pop
       * instead of animating. The rows must stay laid out and merely be
       * clipped by the zero-height row.
       */
      const list = subList(fixture);
      expect(list.hasAttribute('hidden')).toBe(false);
      expect(getComputedStyle(list).display).not.toBe('none');
      expect(getComputedStyle(list.parentElement as HTMLElement).display).not.toBe('none');
    });

    it('reopens on a second click', async () => {
      const fixture = await createNestedHost();
      const button = trigger(fixture);

      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(subList(fixture).hasAttribute('inert')).toBe(false);
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    it('points aria-controls at the list it toggles', async () => {
      const fixture = await createNestedHost();
      const controls = trigger(fixture).getAttribute('aria-controls');
      const wrapper = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-sub"]')).nativeElement;

      expect(controls).toBeTruthy();
      expect(wrapper.getAttribute('id')).toBe(controls);
    });

    it('writes the expanded model back to the host (two-way)', async () => {
      const fixture = await createNestedHost();

      trigger(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(fixture.componentInstance.projectsOpen()).toBe(false);
    });

    it('follows the expanded model when the host drives it', async () => {
      const fixture = await createNestedHost();

      fixture.componentInstance.projectsOpen.set(false);
      fixture.detectChanges();

      expect(subList(fixture).hasAttribute('inert')).toBe(true);
      expect(trigger(fixture).getAttribute('aria-expanded')).toBe('false');
    });

    /**
     * A 60px rail cannot show nested rows. The list must shut without
     * destroying the consumer's `expanded` value, so expanding the rail again
     * restores what they had open.
     */
    it('force-closes on a collapsed rail and restores on expand', async () => {
      const fixture = await createNestedHost();
      const service = getService(fixture);

      service.isCollapsed.set(true);
      fixture.detectChanges();

      expect(subList(fixture).hasAttribute('inert')).toBe(true);
      expect(fixture.componentInstance.projectsOpen()).toBe(true);

      service.isCollapsed.set(false);
      fixture.detectChanges();

      expect(subList(fixture).hasAttribute('inert')).toBe(false);
    });

    it('routes sub buttons through href when routerLink is unset', async () => {
      const fixture = await createNestedHost();
      const links = fixture.debugElement.queryAll(By.css('[data-slot="sidebar-menu-sub-button"]'));
      expect(links.map(l => l.nativeElement.getAttribute('href'))).toEqual(['/alpha', '/beta']);
    });

    describe('menu action', () => {
      it('emits without triggering the row behind it', async () => {
        const fixture = await createNestedHost();
        const action = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-action"]')).nativeElement;
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });

        action.dispatchEvent(event);
        fixture.detectChanges();

        expect(fixture.componentInstance.actions).toBe(1);
        expect(event.defaultPrevented).toBe(true);
      });

      it('carries an accessible name', async () => {
        const fixture = await createNestedHost();
        const action = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-action"]')).nativeElement;
        expect(action.getAttribute('aria-label')).toBe('Project options');
      });

      it('is hidden on a collapsed rail, where there is no room for it', async () => {
        const fixture = await createNestedHost();
        getService(fixture).isCollapsed.set(true);
        fixture.detectChanges();

        const action = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-action"]')).nativeElement;
        expect(action.getAttribute('class') ?? '').toContain('hidden');
      });
    });

    describe('menu badge', () => {
      it('is hidden from screen readers by default', async () => {
        const fixture = await createNestedHost();
        const badge = fixture.debugElement.query(By.css('[data-slot="sidebar-menu-badge"]')).nativeElement;
        expect(badge.getAttribute('aria-hidden')).toBe('true');
        expect(badge.textContent?.trim()).toBe('4');
      });
    });

    describe('menu skeleton', () => {
      it('renders one row per entry with varying widths', async () => {
        const fixture = await createNestedHost();
        const rows = fixture.debugElement.queryAll(By.css('[data-slot="sidebar-menu-skeleton"]'));
        expect(rows).toHaveLength(3);

        const widths = rows.map(row => {
          const bars = row.nativeElement.querySelectorAll('[data-slot="skeleton"]');
          return (bars[bars.length - 1] as HTMLElement).getAttribute('class') ?? '';
        });
        expect(new Set(widths).size).toBe(3);
      });
    });

    describe('rail', () => {
      function rail(fixture: ComponentFixture<unknown>): HTMLElement {
        return fixture.debugElement.query(By.css('[data-slot="sidebar-rail"]')).nativeElement;
      }

      it('toggles the rail and reports its state', async () => {
        const fixture = await createNestedHost();
        const service = getService(fixture);

        expect(rail(fixture).getAttribute('aria-expanded')).toBe('true');

        rail(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        expect(service.isCollapsed()).toBe(true);
        expect(rail(fixture).getAttribute('aria-expanded')).toBe('false');
        expect(rail(fixture).getAttribute('data-state')).toBe('collapsed');
      });

      /**
       * The edge line is the rail's only visual affordance, and it shipped
       * broken once: it relied on Tailwind's `group-hover:` variants, which
       * this project's CSS build does not emit, so it silently never appeared.
       * Asserting the rendered classes catches that class of failure, where
       * asserting the component's inputs would not.
       */
      it('reveals its edge line on hover and on keyboard focus', async () => {
        const fixture = await createNestedHost();
        const line = () =>
          (rail(fixture).querySelector('span') as HTMLElement).getAttribute('class') ?? '';

        expect(line()).toContain('opacity-0');

        rail(fixture).dispatchEvent(new MouseEvent('mouseenter'));
        fixture.detectChanges();
        expect(line()).toContain('opacity-100');
        expect(line()).toContain('bg-sidebar-primary');

        rail(fixture).dispatchEvent(new MouseEvent('mouseleave'));
        fixture.detectChanges();
        expect(line()).toContain('opacity-0');

        rail(fixture).dispatchEvent(new FocusEvent('focus'));
        fixture.detectChanges();
        expect(line()).toContain('opacity-100');
      });

      it('is a real button with a label that describes the action', async () => {
        const fixture = await createNestedHost();
        expect(rail(fixture).tagName).toBe('BUTTON');
        expect(rail(fixture).getAttribute('aria-label')).toBe('Collapse sidebar');

        rail(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();

        expect(rail(fixture).getAttribute('aria-label')).toBe('Expand sidebar');
      });
    });
  });
});
