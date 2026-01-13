import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PopoverComponent, PopoverTriggerComponent, PopoverContentComponent, PopoverCloseComponent } from './popover.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-popover (openChange)="onOpenChange($event)">
            <ui-popover-trigger>Open</ui-popover-trigger>
            <ui-popover-content>
                Popover content
                <ui-popover-close>Close</ui-popover-close>
            </ui-popover-content>
        </ui-popover>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent, PopoverCloseComponent]
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
            <ui-popover>
                <ui-popover-trigger>فتح</ui-popover-trigger>
                <ui-popover-content>محتوى النافذة</ui-popover-content>
            </ui-popover>
        </div>
    `,
    imports: [PopoverComponent, PopoverTriggerComponent, PopoverContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('PopoverComponent', () => {
    let component: PopoverComponent;
    let fixture: ComponentFixture<PopoverComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PopoverComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(PopoverComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
    });

    it('should toggle open state', () => {
        component.toggle();
        expect(component.open()).toBe(true);

        component.toggle();
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
});

describe('Popover Integration', () => {
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

    it('should render trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content).toBeTruthy();
    });

    it('should emit openChange on open', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.isOpen).toBe(true);
    });

    it('should have data-state attribute', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content.nativeElement.getAttribute('data-state')).toBe('open');
    });

    it('should close on close button click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const close = fixture.debugElement.query(By.css('[data-slot="popover-close"]'));
        close.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content).toBeNull();
    });
});

describe('Popover RTL Support', () => {
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

    it('should open popover in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="popover-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="popover-content"]'));
        expect(content).toBeTruthy();
    });
});
