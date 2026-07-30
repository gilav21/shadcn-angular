import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, inject, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
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
    it('toggles collapse on desktop and open on mobile', () => {
      const service = new SidebarService();

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
      const service = new SidebarService();

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
});
