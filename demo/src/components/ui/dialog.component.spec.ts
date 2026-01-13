import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogComponent, DialogTriggerComponent, DialogContentComponent, DialogHeaderComponent, DialogTitleComponent, DialogDescriptionComponent, DialogFooterComponent } from './dialog.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-dialog>
            <ui-dialog-trigger>Open</ui-dialog-trigger>
            <ui-dialog-content>
                <ui-dialog-header>
                    <ui-dialog-title>Title</ui-dialog-title>
                    <ui-dialog-description>Description</ui-dialog-description>
                </ui-dialog-header>
                Content
                <ui-dialog-footer>Footer</ui-dialog-footer>
            </ui-dialog-content>
        </ui-dialog>
    `,
    imports: [DialogComponent, DialogTriggerComponent, DialogContentComponent, DialogHeaderComponent, DialogTitleComponent, DialogDescriptionComponent, DialogFooterComponent]
})
class TestHostComponent { }

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-dialog>
                <ui-dialog-trigger>فتح</ui-dialog-trigger>
                <ui-dialog-content>محتوى</ui-dialog-content>
            </ui-dialog>
        </div>
    `,
    imports: [DialogComponent, DialogTriggerComponent, DialogContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('DialogComponent', () => {
    let component: DialogComponent;
    let fixture: ComponentFixture<DialogComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DialogComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
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

describe('Dialog Integration', () => {
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
    });

    it('should render trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dialog-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(content).toBeTruthy();
    });

    it('should render dialog header', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const header = fixture.debugElement.query(By.css('[data-slot="dialog-header"]'));
        expect(header).toBeTruthy();
    });

    it('should render dialog title', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const title = fixture.debugElement.query(By.css('[data-slot="dialog-title"]'));
        expect(title).toBeTruthy();
        expect(title.nativeElement.textContent).toContain('Title');
    });

    it('should render dialog description', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const desc = fixture.debugElement.query(By.css('[data-slot="dialog-description"]'));
        expect(desc).toBeTruthy();
    });

    it('should close on escape key', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(content).toBeTruthy();

        content.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        const contentAfter = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(contentAfter).toBeNull();
    });

    it('should close on overlay click', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        // The overlay is usually the host of content or a sibling. 
        // In this implementation, DialogContent might include the overlay or be wrapped.
        // Let's check the template structure. usually ui-dialog-content renders the overlay.
        // <div data-slot="dialog-overlay" ... (click)="close()">

        const overlay = fixture.debugElement.query(By.css('[data-slot="dialog-overlay"]'));
        expect(overlay).toBeTruthy();

        overlay.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contentAfter = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(contentAfter).toBeNull();
    });

    it('should not close when clicking content', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        content.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const contentAfter = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(contentAfter).toBeTruthy();
    });

    // Note: Testing actual focus trap and scroll locking usually requires a real browser environment 
    // or careful mocking of document/window, which might be flaky in standard unit tests.
    // However, we can check if the methods/logic are triggered.
    // implementing a simple check for body style overflow for scroll locking.

    it('should lock body scroll when open', async () => {
        const dialogComp = fixture.debugElement.query(By.directive(DialogComponent));
        dialogComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.body.style.overflow).toBe('hidden');

        dialogComp.componentInstance.hide();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(document.body.style.overflow).toBe('');
    });
});

describe('Dialog RTL Support', () => {
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
        fixture.detectChanges();
        await fixture.whenStable();

        const container = fixture.debugElement.query(By.css('[dir="rtl"]'));
        expect(container).toBeTruthy();
    });

    it('should open dialog in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="dialog-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="dialog-content"]'));
        expect(content).toBeTruthy();
    });
});
