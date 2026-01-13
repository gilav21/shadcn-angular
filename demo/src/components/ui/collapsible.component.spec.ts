import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollapsibleComponent, CollapsibleTriggerComponent, CollapsibleContentComponent } from './collapsible.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-collapsible (openChange)="onOpenChange($event)">
            <ui-collapsible-trigger>Toggle</ui-collapsible-trigger>
            <ui-collapsible-content>Hidden Content</ui-collapsible-content>
        </ui-collapsible>
    `,
    imports: [CollapsibleComponent, CollapsibleTriggerComponent, CollapsibleContentComponent]
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
            <ui-collapsible>
                <ui-collapsible-trigger>تبديل</ui-collapsible-trigger>
                <ui-collapsible-content>محتوى مخفي</ui-collapsible-content>
            </ui-collapsible>
        </div>
    `,
    imports: [CollapsibleComponent, CollapsibleTriggerComponent, CollapsibleContentComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('CollapsibleComponent', () => {
    let component: CollapsibleComponent;
    let fixture: ComponentFixture<CollapsibleComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CollapsibleComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(CollapsibleComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="collapsible"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('collapsible');
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
        expect(fixture.nativeElement.getAttribute('data-state')).toBe('closed');
    });

    it('should toggle open state', () => {
        component.toggle();
        expect(component.open()).toBe(true);
        fixture.detectChanges();
        expect(fixture.nativeElement.getAttribute('data-state')).toBe('open');
    });

    it('should show on show()', () => {
        component.show();
        expect(component.open()).toBe(true);
    });

    it('should hide on hide()', () => {
        component.show();
        component.hide();
        expect(component.open()).toBe(false);
    });
});

describe('Collapsible Integration', () => {
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
        const trigger = fixture.debugElement.query(By.css('[data-slot="collapsible-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="collapsible-content"]'));
        expect(content).toBeNull();
    });

    it('should show content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="collapsible-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="collapsible-content"]'));
        expect(content).toBeTruthy();
        expect(content.nativeElement.textContent).toContain('Hidden Content');
    });

    it('should emit openChange on toggle', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="collapsible-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.isOpen).toBe(true);
    });

    it('should update trigger data-state', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="collapsible-trigger"]'));
        expect(trigger.nativeElement.getAttribute('data-state')).toBe('closed');

        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(trigger.nativeElement.getAttribute('data-state')).toBe('open');
    });
});

describe('Collapsible RTL Support', () => {
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

    it('should toggle in RTL mode', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="collapsible-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="collapsible-content"]'));
        expect(content).toBeTruthy();
    });
});
