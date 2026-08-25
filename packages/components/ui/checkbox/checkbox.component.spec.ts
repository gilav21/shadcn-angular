import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CheckboxComponent } from './checkbox.component';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CheckboxComponent', () => {
    let component: CheckboxComponent;
    let fixture: ComponentFixture<CheckboxComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CheckboxComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CheckboxComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('renders a native checkbox input', () => {
        const input = fixture.debugElement.query(By.css('input[type="checkbox"]'));
        expect(input).toBeTruthy();
    });

    it('should render a skeleton instead of the checkbox when skeleton is true', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('ui-skeleton'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('input'))).toBeNull();
    });

    it('should render two skeletons when skeleton is true and a label is set', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.componentRef.setInput('label', 'Accept terms');
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.css('ui-skeleton'))).toHaveLength(2);
        expect(fixture.debugElement.query(By.css('input'))).toBeNull();
        expect(fixture.debugElement.query(By.css('label'))).toBeNull();
    });

    it('should toggle checked state on click', () => {
        const input = fixture.debugElement.query(By.css('input[type="checkbox"]'));
        const visual = fixture.debugElement.query(By.css('[data-slot="checkbox"]'));

        expect(component.checked()).toBe(false);
        expect(visual.attributes['data-state']).toBe('unchecked');
        expect(input.nativeElement.checked).toBe(false);

        input.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(true);
        expect(visual.attributes['data-state']).toBe('checked');
        expect(input.nativeElement.checked).toBe(true);

        input.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(false);
    });

    it('reflects the indeterminate state on the native input', () => {
        fixture.componentRef.setInput('indeterminate', true);
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input[type="checkbox"]'));
        const visual = fixture.debugElement.query(By.css('[data-slot="checkbox"]'));
        expect(input.nativeElement.indeterminate).toBe(true);
        expect(visual.attributes['data-state']).toBe('indeterminate');
    });

    it('should not toggle when disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input[type="checkbox"]'));
        expect(input.nativeElement.disabled).toBe(true);

        input.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(false);
    });

    it('should apply custom class to the visual box', () => {
        fixture.componentRef.setInput('class', 'custom-class');
        fixture.detectChanges();

        const visual = fixture.debugElement.query(By.css('[data-slot="checkbox"]'));
        expect(visual.nativeElement.className).toContain('custom-class');
    });

    it('should forward ariaDescribedby and ariaInvalid to the control', () => {
        const input = fixture.debugElement.query(By.css('input[type="checkbox"]'));
        expect(input.nativeElement.hasAttribute('aria-describedby')).toBe(false);
        expect(input.nativeElement.hasAttribute('aria-invalid')).toBe(false);

        fixture.componentRef.setInput('ariaDescribedby', 'err-1');
        fixture.componentRef.setInput('ariaInvalid', true);
        fixture.detectChanges();

        expect(input.nativeElement.getAttribute('aria-describedby')).toBe('err-1');
        expect(input.nativeElement.getAttribute('aria-invalid')).toBe('true');
    });
});

describe('CheckboxComponent with Label', () => {
    let component: CheckboxComponent;
    let fixture: ComponentFixture<CheckboxComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CheckboxComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CheckboxComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('label', 'Accept terms');
        fixture.detectChanges();
    });

    it('should render label when label input is provided', () => {
        const label = fixture.debugElement.query(By.css('label'));
        expect(label).toBeTruthy();
        expect(label.nativeElement.textContent).toContain('Accept terms');
    });

    it('should render checkbox with label in flex container', () => {
        const container = fixture.debugElement.query(By.css('div.flex.items-center.gap-2'));
        expect(container).toBeTruthy();
    });

    it('should associate label with checkbox via for/id', () => {
        const label = fixture.debugElement.query(By.css('label'));
        const input = fixture.debugElement.query(By.css('input[type="checkbox"]'));
        const inputId = input.nativeElement.getAttribute('id');
        const labelFor = label.nativeElement.getAttribute('for');
        expect(inputId).toBeTruthy();
        expect(labelFor).toBe(inputId);
    });

    it('should toggle checkbox when clicking label', () => {
        expect(component.checked()).toBe(false);

        const label = fixture.debugElement.query(By.css('label'));
        label.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(true);
    });
});

describe('CheckboxComponent methods', () => {
    let component: CheckboxComponent;
    let fixture: ComponentFixture<CheckboxComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CheckboxComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CheckboxComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('toggle() flips checked and notifies registered callbacks', () => {
        const onChange = vi.fn();
        const onTouched = vi.fn();
        component.registerOnChange(onChange);
        component.registerOnTouched(onTouched);

        component.toggle();

        expect(component.checked()).toBe(true);
        expect(onChange).toHaveBeenCalledWith(true);
        expect(onTouched).toHaveBeenCalledTimes(1);

        component.toggle();
        expect(component.checked()).toBe(false);
        expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it('toggle() is a no-op when disabled', () => {
        const onChange = vi.fn();
        component.registerOnChange(onChange);
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        component.toggle();

        expect(component.checked()).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('markTouched() runs on blur of the native input', () => {
        const onTouched = vi.fn();
        component.registerOnTouched(onTouched);

        const input = fixture.debugElement.query(By.css('input[type="checkbox"]'));
        input.nativeElement.dispatchEvent(new Event('blur'));

        expect(onTouched).toHaveBeenCalledTimes(1);
    });

    it('writeValue() sets the checked state, coercing null to false', () => {
        component.writeValue(true);
        expect(component.checked()).toBe(true);

        component.writeValue(null as unknown as boolean);
        expect(component.checked()).toBe(false);
    });

    it('setDisabledState() drives the disabled computed and native input', () => {
        component.setDisabledState(true);
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input[type="checkbox"]'));
        expect(input.nativeElement.disabled).toBe(true);

        component.setDisabledState(false);
        fixture.detectChanges();
        expect(input.nativeElement.disabled).toBe(false);
    });

    it('toString() reflects the current checked value', () => {
        expect(component.toString()).toBe('false');
        component.checked.set(true);
        expect(component.toString()).toBe('true');
    });

    it('renders aria-label when no label is set', () => {
        fixture.componentRef.setInput('ariaLabel', 'Agree');
        fixture.componentRef.setInput('ariaLabelledby', 'lbl-1');
        fixture.componentRef.setInput('elementId', 'cb-1');
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input[type="checkbox"]'));
        expect(input.nativeElement.getAttribute('aria-label')).toBe('Agree');
        expect(input.nativeElement.getAttribute('aria-labelledby')).toBe('lbl-1');
        expect(input.nativeElement.getAttribute('id')).toBe('cb-1');
    });
});

@Component({
    imports: [CheckboxComponent, FormsModule, ReactiveFormsModule],
    template: `
        <ui-checkbox [formControl]="control" />
        <ui-checkbox [(ngModel)]="modelValue" />
    `,
})
class CheckboxHostComponent {
    readonly control = new FormControl(false);
    modelValue = false;
}

describe('CheckboxComponent as a form control', () => {
    let fixture: ComponentFixture<CheckboxHostComponent>;
    let host: CheckboxHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CheckboxHostComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CheckboxHostComponent);
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('wires NG_VALUE_ACCESSOR so reactive + template forms drive the checkbox', () => {
        const checkboxes = fixture.debugElement.queryAll(By.directive(CheckboxComponent));
        const reactive = checkboxes[0].componentInstance as CheckboxComponent;
        const template = checkboxes[1].componentInstance as CheckboxComponent;

        host.control.setValue(true);
        fixture.detectChanges();
        expect(reactive.checked()).toBe(true);

        const reactiveInput = checkboxes[0].query(By.css('input'));
        reactiveInput.nativeElement.click();
        fixture.detectChanges();
        expect(host.control.value).toBe(false);

        host.control.disable();
        fixture.detectChanges();
        expect(reactiveInput.nativeElement.disabled).toBe(true);

        expect(template.checked()).toBe(false);
    });
});

@Component({
    template: `<ui-checkbox [(checked)]="flag" (checkedChange)="emissions.push($event)" />`,
    imports: [CheckboxComponent],
})
class TwoWayCheckboxHost {
    readonly flag = signal(false);
    readonly emissions: boolean[] = [];
}

@Component({
    template: `<form [formGroup]="form"><ui-checkbox formControlName="agree" /></form>`,
    imports: [CheckboxComponent, ReactiveFormsModule],
})
class FormGroupCheckboxHost {
    readonly form = new FormGroup({ agree: new FormControl(false) });
}

/**
 * Reference harness for the signal-forms readiness spec. `checked` is already a
 * `model()`, so these pass unchanged — they exist to pin the behaviour every
 * converted control must reproduce.
 */
describe('CheckboxComponent — signal-forms readiness', () => {
    const nativeInput = (fixture: ComponentFixture<unknown>): HTMLInputElement =>
        fixture.debugElement.query(By.css('input[type="checkbox"]')).nativeElement;

    const toggleNative = (fixture: ComponentFixture<unknown>, next: boolean): void => {
        const input = nativeInput(fixture);
        input.checked = next;
        input.dispatchEvent(new Event('change'));
        fixture.detectChanges();
    };

    it('T-1: two-way [(checked)] updates the model on user input', () => {
        const fixture = TestBed.createComponent(TwoWayCheckboxHost);
        fixture.detectChanges();

        toggleNative(fixture, true);

        expect(fixture.componentInstance.flag()).toBe(true);
    });

    it('T-2: two-way [(checked)] updates the view when the model changes', () => {
        const fixture = TestBed.createComponent(TwoWayCheckboxHost);
        fixture.detectChanges();

        fixture.componentInstance.flag.set(true);
        fixture.detectChanges();

        expect(nativeInput(fixture).checked).toBe(true);
    });

    it('T-3: works with formControlName and reports value to the form group', () => {
        const fixture = TestBed.createComponent(FormGroupCheckboxHost);
        fixture.detectChanges();

        toggleNative(fixture, true);

        expect(fixture.componentInstance.form.value.agree).toBe(true);
    });

    it('T-4: writeValue from the form updates the rendered value', () => {
        const fixture = TestBed.createComponent(FormGroupCheckboxHost);
        fixture.detectChanges();

        fixture.componentInstance.form.setValue({ agree: true });
        fixture.detectChanges();

        expect(nativeInput(fixture).checked).toBe(true);
    });

    it('T-9: emits checkedChange exactly once per user interaction', () => {
        const fixture = TestBed.createComponent(TwoWayCheckboxHost);
        fixture.detectChanges();

        toggleNative(fixture, true);

        expect(fixture.componentInstance.emissions).toEqual([true]);
    });

    it('T-10: does not re-emit when writeValue is called with the current value', () => {
        const fixture = TestBed.createComponent(TwoWayCheckboxHost);
        fixture.detectChanges();
        const checkbox: CheckboxComponent = fixture.debugElement
            .query(By.directive(CheckboxComponent)).componentInstance;
        toggleNative(fixture, true);
        fixture.componentInstance.emissions.length = 0;

        checkbox.writeValue(true);
        fixture.detectChanges();

        expect(fixture.componentInstance.emissions).toEqual([]);
    });
});
