import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { page } from 'vitest/browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SidebarComponent,
  SidebarProviderComponent,
  SidebarService,
  SidebarContentComponent,
  SidebarMenuComponent,
  SidebarMenuSkeletonComponent,
} from './';

/**
 * Browser-only sidebar cases: they assert rendered geometry, which jsdom does
 * not lay out. The desktop aside is `hidden md:flex`, so the desktop cases set
 * a viewport of at least 768px; the drawer cases set a phone viewport.
 */
@Component({
  selector: 'test-layout-host',
  template: `
    <ui-sidebar-provider>
      <ui-sidebar [side]="side()" [collapseMode]="mode()">
        <ui-sidebar-content>
          <ui-sidebar-menu>
            @for (row of skeletonRows; track row) {
              <ui-sidebar-menu-skeleton [seed]="row" />
            }
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
    SidebarMenuSkeletonComponent,
  ],
})
class LayoutHostComponent {
  readonly side = signal<'left' | 'right'>('left');
  readonly mode = signal<'icon' | 'hidden'>('icon');
  readonly skeletonRows = [0, 1, 2];
}

describe('Sidebar (browser layout)', () => {
  let fixture: ComponentFixture<LayoutHostComponent> | undefined;
  let originalSize: [number, number];

  async function mount(
    width: number,
    configure: (host: LayoutHostComponent) => void = () => undefined
  ): Promise<ComponentFixture<LayoutHostComponent>> {
    await page.viewport(width, 800);
    await TestBed.configureTestingModule({ imports: [LayoutHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(LayoutHostComponent);
    configure(fixture.componentInstance);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function aside(f: ComponentFixture<unknown>): HTMLElement {
    return f.debugElement.query(By.css('[data-slot="sidebar"]')).nativeElement;
  }

  function service(f: ComponentFixture<unknown>): SidebarService {
    return f.debugElement.query(By.directive(SidebarProviderComponent)).injector.get(SidebarService);
  }

  beforeEach(() => {
    originalSize = [globalThis.innerWidth, globalThis.innerHeight];
    globalThis.localStorage.clear();
  });

  afterEach(async () => {
    fixture?.destroy();
    fixture = undefined;
    globalThis.localStorage.clear();
    await page.viewport(...originalSize);
  });

  it('renders the hidden collapse mode width when collapsed', async () => {
    const f = await mount(1024, host => host.mode.set('hidden'));
    expect(aside(f).getBoundingClientRect().width).toBe(280);

    service(f).isCollapsed.set(true);
    f.detectChanges();

    // The width animates over 300ms, so wait for it to settle.
    await expect.poll(() => aside(f).getBoundingClientRect().width, { timeout: 2000 }).toBe(0);
  });

  it('parks the closed mobile drawer fully off-screen on its own side', async () => {
    const right = await mount(375, host => host.side.set('right'));
    expect(service(right).isMobile()).toBe(true);
    expect(aside(right).getBoundingClientRect().left).toBeGreaterThanOrEqual(globalThis.innerWidth);
    right.destroy();
    TestBed.resetTestingModule();

    const left = await mount(375);
    expect(aside(left).getBoundingClientRect().right).toBeLessThanOrEqual(0);
  });

  it('renders one row per entry with varying widths', async () => {
    const f = await mount(1024);
    const rows = f.debugElement.queryAll(By.css('[data-slot="sidebar-menu-skeleton"]'));
    expect(rows).toHaveLength(3);

    const widths = rows.map(row => {
      const bars = row.nativeElement.querySelectorAll('[data-slot="skeleton"]');
      return Math.round((bars[bars.length - 1] as HTMLElement).getBoundingClientRect().width);
    });
    expect(widths.every(width => width > 0)).toBe(true);
    expect(new Set(widths).size).toBe(3);
  });
});
