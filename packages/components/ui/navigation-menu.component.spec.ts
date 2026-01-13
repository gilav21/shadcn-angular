import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    NavigationMenuComponent,
    NavigationMenuListComponent,
    NavigationMenuItemComponent,
    NavigationMenuTriggerComponent,
    NavigationMenuContentComponent,
    NavigationMenuLinkComponent,
    NavigationMenuIndicatorComponent
} from './navigation-menu.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Basic test host
@Component({
    template: `
        <ui-navigation-menu>
            <ui-navigation-menu-list>
                <ui-navigation-menu-item>
                    <ui-navigation-menu-trigger>Getting Started</ui-navigation-menu-trigger>
                    <ui-navigation-menu-content>
                        <ui-navigation-menu-link href="/docs">
                            <div class="font-medium">Documentation</div>
                            <p class="text-sm text-muted-foreground">Learn the basics</p>
                        </ui-navigation-menu-link>
                        <ui-navigation-menu-link href="/docs/components">
                            <div class="font-medium">Components</div>
                            <p class="text-sm text-muted-foreground">Explore components</p>
                        </ui-navigation-menu-link>
                    </ui-navigation-menu-content>
                </ui-navigation-menu-item>
                <ui-navigation-menu-item>
                    <ui-navigation-menu-trigger>Resources</ui-navigation-menu-trigger>
                    <ui-navigation-menu-content>
                        <ui-navigation-menu-link href="/blog">Blog</ui-navigation-menu-link>
                    </ui-navigation-menu-content>
                </ui-navigation-menu-item>
            </ui-navigation-menu-list>
        </ui-navigation-menu>
    `,
    imports: [NavigationMenuComponent, NavigationMenuListComponent, NavigationMenuItemComponent, NavigationMenuTriggerComponent, NavigationMenuContentComponent, NavigationMenuLinkComponent]
})
class TestHostComponent { }

// RTL test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-navigation-menu>
                <ui-navigation-menu-list>
                    <ui-navigation-menu-item>
                        <ui-navigation-menu-trigger>البداية</ui-navigation-menu-trigger>
                        <ui-navigation-menu-content>
                            <ui-navigation-menu-link href="/docs">
                                <div class="font-medium">الوثائق</div>
                            </ui-navigation-menu-link>
                        </ui-navigation-menu-content>
                    </ui-navigation-menu-item>
                    <ui-navigation-menu-item>
                        <ui-navigation-menu-trigger>موارد</ui-navigation-menu-trigger>
                        <ui-navigation-menu-content>
                            <ui-navigation-menu-link href="/blog">مدونة</ui-navigation-menu-link>
                        </ui-navigation-menu-content>
                    </ui-navigation-menu-item>
                </ui-navigation-menu-list>
            </ui-navigation-menu>
        </div>
    `,
    imports: [NavigationMenuComponent, NavigationMenuListComponent, NavigationMenuItemComponent, NavigationMenuTriggerComponent, NavigationMenuContentComponent, NavigationMenuLinkComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('NavigationMenuComponent', () => {
    let component: NavigationMenuComponent;
    let fixture: ComponentFixture<NavigationMenuComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NavigationMenuComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(NavigationMenuComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have role="navigation"', () => {
        const nav = fixture.nativeElement.querySelector('[role="navigation"]');
        expect(nav).toBeTruthy();
    });

    it('should have data-slot="navigation-menu"', () => {
        const nav = fixture.nativeElement.querySelector('[data-slot="navigation-menu"]');
        expect(nav).toBeTruthy();
    });
});

describe('NavigationMenu Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render menu list', () => {
        const list = fixture.debugElement.query(By.css('[data-slot="navigation-menu-list"]'));
        expect(list).toBeTruthy();
    });

    it('should have role="menubar" on list', () => {
        const list = fixture.debugElement.query(By.css('[role="menubar"]'));
        expect(list).toBeTruthy();
    });

    it('should render menu items', () => {
        const items = fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-item"]'));
        expect(items.length).toBe(2);
    });

    it('should render menu triggers', () => {
        const triggers = fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-trigger"]'));
        expect(triggers.length).toBe(2);
    });

    it('should have aria-expanded on triggers', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        expect(trigger.nativeElement.getAttribute('aria-expanded')).toBe('false');
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="navigation-menu-content"]'));
        expect(content).toBeNull();
    });

    it('should open on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="navigation-menu-content"]'));
        expect(content).toBeTruthy();
    });

    it('should close on second trigger click', async () => {
        const itemComp = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        itemComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(itemComp.componentInstance.isOpen()).toBe(false);
    });

    it('should open on mouse enter', async () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.onMouseEnter();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(item.componentInstance.isOpen()).toBe(true);
    });

    it('should render links in content', async () => {
        const itemComp = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        itemComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const links = fixture.debugElement.queryAll(By.css('[data-slot="navigation-menu-link"]'));
        expect(links.length).toBe(2);
    });

    it('should have role="menuitem" on links', async () => {
        const itemComp = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        itemComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const link = fixture.debugElement.query(By.css('[data-slot="navigation-menu-link"]'));
        expect(link.nativeElement.getAttribute('role')).toBe('menuitem');
    });

    it('should have href on links', async () => {
        const itemComp = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        itemComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const link = fixture.debugElement.query(By.css('[data-slot="navigation-menu-link"]'));
        expect(link.nativeElement.getAttribute('href')).toBe('/docs');
    });

    it('should switch to another menu item on hover', async () => {
        const items = fixture.debugElement.queryAll(By.directive(NavigationMenuItemComponent));

        // Open first item
        items[0].componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(items[0].componentInstance.isOpen()).toBe(true);

        // Hover on second item
        items[1].componentInstance.onMouseEnter();
        fixture.detectChanges();
        await fixture.whenStable();

        // First should be closed, second should be open
        expect(items[1].componentInstance.isOpen()).toBe(true);
        expect(items[0].componentInstance.isOpen()).toBe(false);
    });
});

describe('NavigationMenu Hover Behavior', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should schedule close on mouse leave', async () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        item.componentInstance.onMouseLeave();
        // Menu should still be open immediately (has delay)
        expect(item.componentInstance.isOpen()).toBe(true);
    });

    it('should cancel scheduled close on mouse re-enter', async () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        // Start leave, then re-enter
        item.componentInstance.onMouseLeave();
        item.componentInstance.onMouseEnter();

        // Wait for potential close timeout
        await new Promise(resolve => setTimeout(resolve, 200));
        fixture.detectChanges();
        await fixture.whenStable();

        // Should still be open because we re-entered
        expect(item.componentInstance.isOpen()).toBe(true);
    });

    it('should close after hover delay expires', async () => {
        const item = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        item.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        item.componentInstance.onMouseLeave();

        // Wait for close delay (150ms + buffer)
        await new Promise(resolve => setTimeout(resolve, 200));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(item.componentInstance.isOpen()).toBe(false);
    });
});

describe('NavigationMenu RTL Support', () => {
    let fixture: ComponentFixture<RTLTestHostComponent>;
    let component: RTLTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RTLTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RTLTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.documentElement.removeAttribute('dir');
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should open menu in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="navigation-menu-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="navigation-menu-content"]'));
        expect(content).toBeTruthy();
    });

    it('should render links in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const itemComp = fixture.debugElement.query(By.directive(NavigationMenuItemComponent));
        itemComp.componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        const link = fixture.debugElement.query(By.css('[data-slot="navigation-menu-link"]'));
        expect(link).toBeTruthy();
    });

    it('should switch menu items on hover in RTL', async () => {
        component.dir.set('rtl');
        document.documentElement.setAttribute('dir', 'rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.directive(NavigationMenuItemComponent));

        items[0].componentInstance.open();
        fixture.detectChanges();
        await fixture.whenStable();

        items[1].componentInstance.onMouseEnter();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(items[1].componentInstance.isOpen()).toBe(true);
        expect(items[0].componentInstance.isOpen()).toBe(false);
    });
});
