import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DrawerComponent, DrawerTriggerComponent, DrawerContentComponent, DrawerHeaderComponent, DrawerTitleComponent, DrawerDescriptionComponent, DrawerFooterComponent, DrawerCloseComponent } from './drawer.component';
import { Component, signal } from '@angular/core';
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

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-drawer direction="right">
                <ui-drawer-trigger>فتح</ui-drawer-trigger>
                <ui-drawer-content>محتوى</ui-drawer-content>
            </ui-drawer>
        </div>
    `,
    imports: [DrawerComponent, DrawerTriggerComponent, DrawerContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
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

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="drawer"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('drawer');
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
    });

    it('should have default direction of bottom', () => {
        expect(component.direction()).toBe('bottom');
    });

    it('should show when show() is called', () => {
        component.show();
        expect(component.open()).toBe(true);
    });

    it('should hide when hide() is called', () => {
        component.show();
        component.hide();
        expect(component.open()).toBe(false);
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

    it('should render trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="drawer-trigger"]'));
        expect(trigger).toBeTruthy();
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
    });

    it('should emit openChange', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="drawer-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

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
});

describe('Drawer RTL Support', () => {
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
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    it('should render in LTR mode', () => {
        const container = fixture.debugElement.query(By.css('[dir="ltr"]'));
        expect(container).toBeTruthy();
    });

    it('should render in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should open drawer in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="drawer-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="drawer-content"]'));
        expect(content).toBeTruthy();
    });
});
