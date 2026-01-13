import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent, SelectItemComponent, SelectGroupComponent, SelectLabelComponent } from './select.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-select (valueChange)="onValueChange($event)">
            <ui-select-trigger>
                <ui-select-value placeholder="Select option" />
            </ui-select-trigger>
            <ui-select-content>
                <ui-select-item value="option1">Option 1</ui-select-item>
                <ui-select-item value="option2">Option 2</ui-select-item>
                <ui-select-item value="option3">Option 3</ui-select-item>
            </ui-select-content>
        </ui-select>
    `,
    imports: [SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent, SelectItemComponent]
})
class TestHostComponent {
    selectedValue = '';
    onValueChange(value: string) {
        this.selectedValue = value;
    }
}

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-select>
                <ui-select-trigger>
                    <ui-select-value placeholder="اختر خيارًا" />
                </ui-select-trigger>
                <ui-select-content>
                    <ui-select-item value="opt1">الخيار 1</ui-select-item>
                    <ui-select-item value="opt2">الخيار 2</ui-select-item>
                </ui-select-content>
            </ui-select>
        </div>
    `,
    imports: [SelectComponent, SelectTriggerComponent, SelectContentComponent, SelectValueComponent, SelectItemComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('SelectComponent', () => {
    let component: SelectComponent;
    let fixture: ComponentFixture<SelectComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SelectComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SelectComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should be closed by default', () => {
        expect(component.open()).toBe(false);
    });

    it('should have no value by default', () => {
        expect(component.value()).toBeUndefined();
    });

    it('should toggle open state', () => {
        component.toggle();
        expect(component.open()).toBe(true);

        component.toggle();
        expect(component.open()).toBe(false);
    });

    it('should select value and close', () => {
        component.open.set(true);
        component.select('test-value');

        expect(component.value()).toBe('test-value');
        expect(component.open()).toBe(false);
    });
});

describe('Select Integration', () => {
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

    it('should render select with trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        expect(trigger).toBeTruthy();
    });

    it('should render placeholder initially', () => {
        const value = fixture.debugElement.query(By.css('[data-slot="select-value"]'));
        expect(value.nativeElement.textContent).toContain('Select option');
    });

    it('should have role="combobox" on trigger', () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        expect(trigger.nativeElement.getAttribute('role')).toBe('combobox');
    });

    it('should not show content when closed', () => {
        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeNull();
    });

    it('should open content on trigger click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeTruthy();
    });

    it('should have role="listbox" on content', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[role="listbox"]'));
        expect(content).toBeTruthy();
    });

    it('should render items with role="option"', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[role="option"]'));
        expect(items.length).toBe(3);
    });

    it('should select item on click', async () => {
        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('[data-slot="select-item"]'));
        items[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.selectedValue).toBe('option2');
    });
});

describe('Select RTL Support', () => {
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

    it('should open dropdown in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const trigger = fixture.debugElement.query(By.css('[data-slot="select-trigger"]'));
        trigger.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const content = fixture.debugElement.query(By.css('[data-slot="select-content"]'));
        expect(content).toBeTruthy();
    });
});
