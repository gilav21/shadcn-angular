import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RadioGroupComponent, RadioGroupItemComponent } from './radio-group.component';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

// Test host for integration
@Component({
    template: `
        <ui-radio-group (valueChange)="onValueChange($event)">
            <ui-radio-group-item value="option1" />
            <ui-radio-group-item value="option2" />
            <ui-radio-group-item value="option3" />
        </ui-radio-group>
    `,
    imports: [RadioGroupComponent, RadioGroupItemComponent]
})
class TestHostComponent {
    selectedValue = '';
    onValueChange(value: string | undefined) {
        this.selectedValue = value ?? '';
    }
}

// Reactive forms test host
@Component({
    template: `
        <ui-radio-group [formControl]="control">
            <ui-radio-group-item value="a" />
            <ui-radio-group-item value="b" />
        </ui-radio-group>
    `,
    imports: [RadioGroupComponent, RadioGroupItemComponent, ReactiveFormsModule]
})
class ReactiveFormTestHost {
    control = new FormControl('');
}

describe('RadioGroupComponent', () => {
    let fixture: ComponentFixture<RadioGroupComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RadioGroupComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(RadioGroupComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="radio-group"', () => {
        const div = fixture.debugElement.query(By.css('[data-slot="radio-group"]'));
        expect(div).toBeTruthy();
    });

    it('should have role="radiogroup"', () => {
        const div = fixture.debugElement.query(By.css('[role="radiogroup"]'));
        expect(div).toBeTruthy();
    });

    it('reports vertical aria-orientation by default', () => {
        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('reports horizontal aria-orientation', () => {
        fixture.componentRef.setInput('orientation', 'horizontal');
        fixture.detectChanges();

        const div = fixture.debugElement.query(By.css('div'));
        expect(div.nativeElement.getAttribute('aria-orientation')).toBe('horizontal');
    });
});

describe('RadioGroup Integration', () => {
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

    it('renders a native radio input per item', () => {
        const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
        expect(items).toHaveLength(3);
    });

    it('should select item on click', async () => {
        const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
        items[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        const visuals = fixture.debugElement.queryAll(By.css('[data-slot="radio-group-item"]'));
        expect(items[1].nativeElement.checked).toBe(true);
        expect(visuals[1].nativeElement.dataset.state).toBe('checked');
    });

    it('should emit valueChange on selection', async () => {
        const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
        items[2].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.selectedValue).toBe('option3');
    });

    it('should deselect previous item when selecting new one', async () => {
        const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));

        items[0].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        items[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(items[0].nativeElement.checked).toBe(false);
        expect(items[1].nativeElement.checked).toBe(true);
    });
});

describe('RadioGroup ControlValueAccessor', () => {
    let fixture: ComponentFixture<ReactiveFormTestHost>;
    let component: ReactiveFormTestHost;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ReactiveFormTestHost]
        }).compileComponents();

        fixture = TestBed.createComponent(ReactiveFormTestHost);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should update FormControl on selection', async () => {
        const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
        items[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.control.value).toBe('b');
    });

    it('should reflect FormControl value', async () => {
        component.control.setValue('a');
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
        expect(items[0].nativeElement.checked).toBe(true);
    });

    it('should disable all items when disabled via FormControl', async () => {
        component.control.disable();
        fixture.detectChanges();
        await fixture.whenStable();

        const items = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
        items.forEach(item => {
            expect(item.nativeElement.disabled).toBe(true);
        });
    });
});

// Test host for label mode
@Component({
    template: `
        <ui-radio-group (valueChange)="onValueChange($event)">
            <ui-radio-group-item value="option1" label="First option" />
            <ui-radio-group-item value="option2" label="Second option" />
            <ui-radio-group-item value="option3" label="Third option" />
        </ui-radio-group>
    `,
    imports: [RadioGroupComponent, RadioGroupItemComponent]
})
class LabelModeTestHostComponent {
    selectedValue = '';
    onValueChange(value: string | undefined) {
        this.selectedValue = value ?? '';
    }
}

describe('RadioGroupItem with Label', () => {
    let fixture: ComponentFixture<LabelModeTestHostComponent>;
    let component: LabelModeTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [LabelModeTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(LabelModeTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should display correct label text', () => {
        const labels = fixture.debugElement.queryAll(By.css('label'));
        expect(labels[0].nativeElement.textContent).toContain('First option');
        expect(labels[1].nativeElement.textContent).toContain('Second option');
        expect(labels[2].nativeElement.textContent).toContain('Third option');
    });

    it('should associate labels with radio buttons via for/id', () => {
        const labels = fixture.debugElement.queryAll(By.css('label'));
        const buttons = fixture.debugElement.queryAll(By.css('input[type="radio"]'));

        labels.forEach((label, index) => {
            const labelFor = label.nativeElement.getAttribute('for');
            const buttonId = buttons[index].nativeElement.getAttribute('id');
            expect(labelFor).toBeTruthy();
            expect(buttonId).toBeTruthy();
            expect(labelFor).toBe(buttonId);
        });
    });

    it('should select item by clicking radio button', async () => {
        const buttons = fixture.debugElement.queryAll(By.css('input[type="radio"]'));
        buttons[1].nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.selectedValue).toBe('option2');
        expect(buttons[1].nativeElement.checked).toBe(true);
    });
});
