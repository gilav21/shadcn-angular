import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SheetComponent, SheetTriggerComponent, SheetContentComponent, SheetHeaderComponent, SheetTitleComponent, SheetDescriptionComponent, SheetFooterComponent, SheetCloseComponent } from './sheet.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-sheet (openChange)="onOpenChange($event)">
            <ui-sheet-trigger>Open</ui-sheet-trigger>
            <ui-sheet-content side="right">
                <ui-sheet-header>
                    <ui-sheet-title>Title</ui-sheet-title>
                    <ui-sheet-description>Description</ui-sheet-description>
                </ui-sheet-header>
                Content
                <ui-sheet-footer>
                    <ui-sheet-close>Close</ui-sheet-close>
                </ui-sheet-footer>
            </ui-sheet-content>
        </ui-sheet>
    `,
    imports: [SheetComponent, SheetTriggerComponent, SheetContentComponent, SheetHeaderComponent, SheetTitleComponent, SheetDescriptionComponent, SheetFooterComponent, SheetCloseComponent]
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
            <ui-sheet>
                <ui-sheet-trigger>فتح</ui-sheet-trigger>
                <ui-sheet-content side="left">محتوى</ui-sheet-content>
            </ui-sheet>
        </div>
    `,
    imports: [SheetComponent, SheetTriggerComponent, SheetContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('SheetComponent', () => {
    let component: SheetComponent;
    let fixture: ComponentFixture<SheetComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SheetComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SheetComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
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

describe('Sheet Integration', () => {
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
        const trigger = fixture.debugElement.query(By.css('[data-slot="sheet-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="sheet-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content).toBeTruthy();
    });

    it('should emit openChange', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="sheet-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.isOpen).toBe(true);
    });

    it('should render header and title', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent));
        sheetComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const header = fixture.debugElement.query(By.css('[data-slot="sheet-header"]'));
        expect(header).toBeTruthy();

        const title = fixture.debugElement.query(By.css('[data-slot="sheet-title"]'));
        expect(title.nativeElement.textContent).toContain('Title');
    });

    it('should close on close button click', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent));
        sheetComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const close = fixture.debugElement.query(By.css('[data-slot="sheet-close"]'));
        close.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content).toBeNull();
    });

    it('should have data-state="open" when opened', async () => {
        const sheetComp = fixture.debugElement.query(By.directive(SheetComponent));
        sheetComp.componentInstance.show();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content.nativeElement.getAttribute('data-state')).toBe('open');
    });
});

describe('Sheet RTL Support', () => {
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

    it('should open sheet in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="sheet-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="sheet-content"]'));
        expect(content).toBeTruthy();
    });
});
