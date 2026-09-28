import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DrawerComponent, DrawerTriggerComponent, DrawerContentComponent, DrawerHeaderComponent, DrawerTitleComponent, DrawerDescriptionComponent, DrawerFooterComponent, DrawerCloseComponent } from './index';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-drawer (openChange)="onOpenChange($event)">
            <ui-drawer-trigger>Open</ui-drawer-trigger>
            <ui-drawer-content>
                <ui-drawer-header>
                    <ui-drawer-title>Title</ui-drawer-title>
                    <ui-drawer-description>Description</ui-drawer-description>
                </ui-drawer-header>
                Content
                <ui-drawer-footer>
                    <ui-drawer-close>Close</ui-drawer-close>
                </ui-drawer-footer>
            </ui-drawer-content>
        </ui-drawer>
    `,
    imports: [DrawerComponent, DrawerTriggerComponent, DrawerContentComponent, DrawerHeaderComponent, DrawerTitleComponent, DrawerDescriptionComponent, DrawerFooterComponent, DrawerCloseComponent]
})
class TestHostComponent {
    isOpen = false;
    onOpenChange(open: boolean) {
        this.isOpen = open;
    }
}

describe('DrawerComponent', () => {
    let component: DrawerComponent;
    let fixture: ComponentFixture<DrawerComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DrawerComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DrawerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        // Clean up body styles
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    it('should have data-slot="drawer"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('drawer');
    });

    it('should toggle open state', () => {
        component.toggle();
        expect(component.open()).toBe(true);
        component.toggle();
        expect(component.open()).toBe(false);
    });
});

describe('Drawer Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="drawer-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="drawer-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="drawer-content"]'));
        expect(content).toBeTruthy();
        expect(component.isOpen).toBe(true);
    });

    it('should render header and title', async () => {
        const drawerComp = fixture.debugElement.query(By.directive(DrawerComponent));
        drawerComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const header = fixture.debugElement.query(By.css('[data-slot="drawer-header"]'));
        expect(header).toBeTruthy();

        const title = fixture.debugElement.query(By.css('[data-slot="drawer-title"]'));
        expect(title.nativeElement.textContent).toContain('Title');
    });

    it('should close on close button click', async () => {
        const drawerComp = fixture.debugElement.query(By.directive(DrawerComponent));
        drawerComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const close = fixture.debugElement.query(By.css('[data-slot="drawer-close"]'));
        close.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="drawer-content"]'));
        expect(content).toBeNull();
    });

    it('should close on overlay click', async () => {
        const drawerComp = fixture.debugElement.query(By.directive(DrawerComponent));
        drawerComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const overlay = fixture.debugElement.query(By.css('[data-slot="drawer-overlay"]'));
        expect(overlay).toBeTruthy();

        overlay.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="drawer-content"]'));
        expect(content).toBeNull();
    });

    it('should close on escape key', async () => {
        const drawerComp = fixture.debugElement.query(By.directive(DrawerComponent));
        drawerComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="drawer-content"]'));
        expect(content).toBeTruthy();

        // Dispatch on content (focus is there), bubbles up to wrapper
        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        const contentAfter = fixture.debugElement.query(By.css('[data-slot="drawer-content"]'));
        expect(contentAfter).toBeNull();
    });

    it('should lock body scroll when open', async () => {
        const drawerComp = fixture.debugElement.query(By.directive(DrawerComponent));
        drawerComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.body.style.overflow).toBe('hidden');

        drawerComp.componentInstance.hide();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.body.style.overflow).toBe('');
    });
});

// Simple mode test host
@Component({
    template: `
        <ui-drawer>
            <ui-drawer-trigger>Open</ui-drawer-trigger>
            <ui-drawer-content title="Edit Profile" description="Make changes here.">
                <div class="p-4">Body content</div>
            </ui-drawer-content>
        </ui-drawer>
    `,
    imports: [DrawerComponent, DrawerTriggerComponent, DrawerContentComponent]
})
class SimpleModeTestHostComponent { }

describe('Drawer Simple Mode', () => {
    let fixture: ComponentFixture<SimpleModeTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SimpleModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SimpleModeTestHostComponent);
        fixture.detectChanges();
    });

    it('should auto-render header with title input', async () => {
        const drawerComp = fixture.debugElement.query(By.directive(DrawerComponent));
        drawerComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const title = fixture.debugElement.query(By.css('[data-slot="drawer-title"]'));
        expect(title).toBeTruthy();
        expect(title.nativeElement.textContent).toContain('Edit Profile');

        const desc = fixture.debugElement.query(By.css('[data-slot="drawer-description"]'));
        expect(desc.nativeElement.textContent).toContain('Make changes here.');
    });

    it('should still render projected body content', async () => {
        const drawerComp = fixture.debugElement.query(By.directive(DrawerComponent));
        drawerComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="drawer-content"]'));
        expect(content.nativeElement.textContent).toContain('Body content');
    });
});
