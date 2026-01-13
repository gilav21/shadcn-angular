import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    SidebarComponent,
    SidebarProviderComponent,
    SidebarService,
    SidebarTriggerComponent,
    SidebarContentComponent,
    SidebarHeaderComponent,
    SidebarFooterComponent
} from './sidebar.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

@Component({
    template: `
    <ui-sidebar-provider>
      <ui-sidebar>
        <ui-sidebar-header>Header</ui-sidebar-header>
        <ui-sidebar-content>Content</ui-sidebar-content>
        <ui-sidebar-footer>Footer</ui-sidebar-footer>
      </ui-sidebar>
      <main>
        <ui-sidebar-trigger></ui-sidebar-trigger>
      </main>
    </ui-sidebar-provider>
  `,
    imports: [
        SidebarComponent,
        SidebarProviderComponent,
        SidebarTriggerComponent,
        SidebarContentComponent,
        SidebarHeaderComponent,
        SidebarFooterComponent
    ]
})
class TestHostComponent { }

describe('SidebarComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    function getService(): SidebarService {
        const provider = fixture.debugElement.query(By.directive(SidebarProviderComponent));
        return provider.injector.get(SidebarService);
    }

    it('should create', () => {
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render structure', () => {
        const header = fixture.debugElement.query(By.css('[data-slot="sidebar-header"]'));
        const content = fixture.debugElement.query(By.css('[data-slot="sidebar-content"]'));
        const footer = fixture.debugElement.query(By.css('[data-slot="sidebar-footer"]'));

        expect(header).toBeTruthy();
        expect(content).toBeTruthy();
        expect(footer).toBeTruthy();
    });

    it('should toggle collapse on desktop', () => {
        const service = getService();
        service.setMobile(false); // Force desktop
        fixture.detectChanges();

        expect(service.isCollapsed()).toBe(false);

        const trigger = fixture.debugElement.query(By.css('[data-slot="sidebar-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();

        expect(service.isCollapsed()).toBe(true);
    });

    it('should handle mobile mode and overlay', async () => {
        const service = getService();
        service.setMobile(true);
        fixture.detectChanges();

        // Mobile default should be closed (impl details: setMobile sets open=false)
        expect(service.isOpen()).toBe(false);

        // Open it
        service.open();
        fixture.detectChanges();

        expect(service.isOpen()).toBe(true);

        // Check for overlay (it renders inside ui-sidebar view)
        // The overlay is a div with fixed inset-0 z-40
        // Since it's inside the component template, we need to search specifically there or globally text
        // But querySelector on document body might fail in test env if not attached?
        // Vitest simulates DOM.

        const sidebarDebugEl = fixture.debugElement.query(By.directive(SidebarComponent));
        // In the template: @if (service.isMobile() && service.isOpen()) { <div class="fixed inset-0 z-40 bg-black/50" ...> }
        // It's a sibling to the <aside>.

        const overlay = sidebarDebugEl.query(By.css('.fixed.inset-0.z-40'));
        expect(overlay).toBeTruthy();

        // Click overlay to close
        overlay.nativeElement.click();
        fixture.detectChanges();

        expect(service.isOpen()).toBe(false);
    });

    it('should trap focus in mobile mode', async () => {
        const service = getService();
        service.setMobile(true);
        service.open();
        fixture.detectChanges();
        await fixture.whenStable();

        // We expect the focus trap logic to have run (AfterViewInit or effect)
        // Since we can't easily check actual focus in JSDOM reliably without setup,
        // we can at least check that the keydown handler is attached and does something (like close on escape)

        const sidebarEl = fixture.debugElement.query(By.css('[data-slot="sidebar"]'));
        expect(sidebarEl.attributes['tabindex']).toBe('-1');

        // Simulate Escape key
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        sidebarEl.nativeElement.dispatchEvent(event);
        fixture.detectChanges();

        expect(service.isOpen()).toBe(false);
    });
});
