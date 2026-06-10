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

    it('should render a skeleton instead of the checkbox when skeleton is true', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('ui-skeleton'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('button'))).toBeNull();
    });

    it('should render two skeletons when skeleton is true and a label is set', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.componentRef.setInput('label', 'Accept terms');
        fixture.detectChanges();
        expect(fixture.debugElement.queryAll(By.css('ui-skeleton')).length).toBe(2);
        expect(fixture.debugElement.query(By.css('button'))).toBeNull();
        expect(fixture.debugElement.query(By.css('label'))).toBeNull();
    });

    it('should toggle checked state on click', () => {
        const button = fixture.debugElement.query(By.css('button'));

        // Initial state: unchecked
        expect(component.checked()).toBe(false);
        expect(button.attributes['data-state']).toBe('unchecked');
        expect(button.attributes['aria-checked']).toBe('false');

        // Click to toggle
        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(true);
        expect(button.attributes['data-state']).toBe('checked');
        expect(button.attributes['aria-checked']).toBe('true');

        // Click again to untoggle
        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(false);
    });

    it('should not toggle when disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.attributes['disabled']).toBeDefined();

        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(false);
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'custom-class');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('custom-class');
    });

    it('should forward ariaDescribedby and ariaInvalid to the control', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.hasAttribute('aria-describedby')).toBe(false);
        expect(button.nativeElement.hasAttribute('aria-invalid')).toBe(false);

        fixture.componentRef.setInput('ariaDescribedby', 'err-1');
        fixture.componentRef.setInput('ariaInvalid', true);
        fixture.detectChanges();

        expect(button.nativeElement.getAttribute('aria-describedby')).toBe('err-1');
        expect(button.nativeElement.getAttribute('aria-invalid')).toBe('true');
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
        const button = fixture.debugElement.query(By.css('button'));
        const buttonId = button.nativeElement.getAttribute('id');
        const labelFor = label.nativeElement.getAttribute('for');
        expect(buttonId).toBeTruthy();
        expect(labelFor).toBe(buttonId);
    });

    it('should toggle checkbox when clicking label', () => {
        expect(component.checked()).toBe(false);

        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(true);
    });
});
