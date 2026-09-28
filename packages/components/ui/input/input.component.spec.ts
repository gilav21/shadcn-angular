import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InputComponent } from './input.component';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';

// Test host for reactive forms
@Component({
    template: `
        <ui-input [formControl]="control" [placeholder]="placeholder()" />
    `,
    imports: [InputComponent, ReactiveFormsModule]
})
class ReactiveFormTestHost {
    control = new FormControl('');
    placeholder = signal('Enter text...');
}

describe('InputComponent', () => {
    let fixture: ComponentFixture<InputComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [InputComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(InputComponent);
        fixture.detectChanges();
    });

    it('should have data-slot="input"', () => {
        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.dataset.slot).toBe('input');
    });

    it('should apply password type', () => {
        fixture.componentRef.setInput('type', 'password');
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.type).toBe('password');
    });

    it('should apply placeholder', () => {
        fixture.componentRef.setInput('placeholder', 'Enter text...');
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.placeholder).toBe('Enter text...');
    });

    it('should be disabled when disabled input is true', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.disabled).toBe(true);
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-input');
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.className).toContain('my-input');
    });
});

describe('Input ControlValueAccessor', () => {
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

    it('should update FormControl on input', async () => {
        const input = fixture.debugElement.query(By.css('input'));
        input.nativeElement.value = 'test value';
        input.nativeElement.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.control.value).toBe('test value');
    });

    it('should update input when FormControl value changes', async () => {
        component.control.setValue('programmatic value');
        fixture.detectChanges();
        await fixture.whenStable();

        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.value).toBe('programmatic value');
    });

    it('should disable input when FormControl is disabled', async () => {
        component.control.disable();
        fixture.detectChanges();
        await fixture.whenStable();

        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.disabled).toBe(true);
    });
});

describe('InputComponent - floating label', () => {
    let component: InputComponent;
    let fixture: ComponentFixture<InputComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [InputComponent] }).compileComponents();
        fixture = TestBed.createComponent(InputComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('floating', true);
        fixture.componentRef.setInput('label', 'Full name');
        fixture.detectChanges();
    });

    it('renders the floating wrapper with the real input still carrying its variant (not the tall container)', () => {
        // The input keeps data-slot="input" (so its variant + normal-height CSS
        // applies); the tall input-container is NOT used for floating.
        expect(fixture.debugElement.query(By.css('[data-slot="input-floating"]'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('[data-slot="input-container"]'))).toBeNull();
        expect(fixture.debugElement.query(By.css('input[data-slot="input"]'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('label')).nativeElement.textContent.trim()).toBe('Full name');
    });

    it('marks the label active (floated) only when focused or filled', () => {
        const label = () => fixture.debugElement.query(By.css('label')).nativeElement;
        expect(label().hasAttribute('data-active')).toBe(false);

        component.onFocus();
        fixture.detectChanges();
        expect(label().hasAttribute('data-active')).toBe(true);

        component.onBlur();
        component.writeValue('Jane');
        fixture.detectChanges();
        expect(label().hasAttribute('data-active')).toBe(true); // stays floated while filled
    });

    it('applies labelClass only when floated, so the resting placeholder stays uniform', () => {
        fixture.componentRef.setInput('labelClass', 'text-base font-semibold');
        fixture.detectChanges();
        const label = () => fixture.debugElement.query(By.css('label')).nativeElement;

        // Resting: uniform placeholder, no custom font.
        expect(label().className).not.toContain('text-base');
        expect(label().className).not.toContain('font-semibold');

        // Floated: transforms to the dev-customized font.
        component.onFocus();
        fixture.detectChanges();
        expect(label().className).toContain('text-base');
        expect(label().className).toContain('font-semibold');
    });

    it('exposes the variant on the floating wrapper so the resting label can match the input padding', () => {
        fixture.componentRef.setInput('variant', 'underline');
        fixture.detectChanges();
        const wrapper = fixture.debugElement.query(By.css('[data-slot="input-floating"]')).nativeElement;
        expect(wrapper.getAttribute('data-variant')).toBe('underline');
    });
});

describe('InputComponent - container mode (prefix/suffix/clearable/loading)', () => {
    let component: InputComponent;
    let fixture: ComponentFixture<InputComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [InputComponent] }).compileComponents();
        fixture = TestBed.createComponent(InputComponent);
        component = fixture.componentInstance;
    });

    it('renders the input-container when a prefix is set', () => {
        fixture.componentRef.setInput('prefix', '$');
        fixture.detectChanges();

        const container = fixture.debugElement.query(By.css('[data-slot="input-container"]'));
        expect(container.nativeElement.querySelector('span').textContent.trim()).toBe('$');
        expect(container.nativeElement.querySelector('input')).toBeTruthy();
    });

    it('renders a suffix span when suffix is set and not loading', () => {
        fixture.componentRef.setInput('suffix', 'kg');
        fixture.detectChanges();

        const span = fixture.debugElement.query(By.css('[data-slot="input-container"] span'));
        expect(span.nativeElement.textContent.trim()).toBe('kg');
    });

    it('adds disabled styling to containerClasses when disabled', () => {
        fixture.componentRef.setInput('prefix', '$');
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        const classes = component.containerClasses();
        expect(classes).toContain('pointer-events-none');
        expect(classes).toContain('cursor-not-allowed');
        expect(component.isDisabled()).toBe(true);
    });

    it('does NOT add disabled styling to containerClasses when enabled', () => {
        fixture.componentRef.setInput('prefix', '$');
        fixture.detectChanges();

        expect(component.containerClasses()).not.toContain('cursor-not-allowed');
    });

    it('shows a clear button only when clearable and there is a value, and clears on click', () => {
        fixture.componentRef.setInput('clearable', true);
        fixture.detectChanges();

        expect(fixture.debugElement.query(By.css('button[aria-label="Clear"]'))).toBeNull();

        component.writeValue('hello');
        fixture.detectChanges();

        const clearBtn = fixture.debugElement.query(By.css('button[aria-label="Clear"]'));
        expect(clearBtn).toBeTruthy();

        clearBtn.nativeElement.click();
        fixture.detectChanges();

        expect(component.value()).toBe('');
        expect(document.activeElement).toBe(fixture.debugElement.query(By.css('input')).nativeElement);
    });

    it('shows the spinner when loading and hides the suffix span', () => {
        fixture.componentRef.setInput('loading', true);
        fixture.componentRef.setInput('suffix', 'kg');
        fixture.detectChanges();

        expect(fixture.debugElement.query(By.css('ui-spinner'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('[data-slot="input-container"] span'))).toBeNull();
    });
});

describe('InputComponent - imperative API and CVA callbacks', () => {
    let component: InputComponent;
    let fixture: ComponentFixture<InputComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [InputComponent] }).compileComponents();
        fixture = TestBed.createComponent(InputComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('focus() focuses the inner input element', () => {
        const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;

        component.focus();

        expect(document.activeElement).toBe(input);
    });

    it('toString() returns the current value', () => {
        component.writeValue('abc');
        expect(component.toString()).toBe('abc');
        expect(`${component}`).toBe('abc');
    });

    it('writeValue(null) coerces to an empty string', () => {
        component.writeValue(null as unknown as string);
        expect(component.value()).toBe('');
    });

    it('onValueChange uses the default onChange when no form is registered', () => {
        expect(() => component.onValueChange('typed')).not.toThrow();
        expect(component.value()).toBe('typed');
    });

    it('onValueChange invokes the registered onChange callback', () => {
        const onChange = vi.fn();
        component.registerOnChange(onChange);

        component.onValueChange('new value');

        expect(onChange).toHaveBeenCalledWith('new value');
    });
});

describe('InputComponent - within an input group', () => {
    let component: InputComponent;
    let fixture: ComponentFixture<InputComponent>;
    const groupDisabled = signal(false);

    beforeEach(async () => {
        groupDisabled.set(false);
        await TestBed.configureTestingModule({
            imports: [InputComponent],
            providers: [{ provide: UI_INPUT_GROUP, useValue: { disabled: groupDisabled.asReadonly() } }],
        }).compileComponents();
        fixture = TestBed.createComponent(InputComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('is disabled when the group is disabled', () => {
        groupDisabled.set(true);
        fixture.detectChanges();
        expect(component.isDisabled()).toBe(true);
    });
});
