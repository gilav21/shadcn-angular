import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckboxComponent } from './checkbox.component';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it } from 'vitest';

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
