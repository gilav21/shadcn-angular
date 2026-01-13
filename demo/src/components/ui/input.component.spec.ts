import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InputComponent } from './input.component';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-input placeholder="أدخل النص" />
        </div>
    `,
    imports: [InputComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('InputComponent', () => {
    let component: InputComponent;
    let fixture: ComponentFixture<InputComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [InputComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(InputComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="input"', () => {
        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.getAttribute('data-slot')).toBe('input');
    });

    it('should have default type="text"', () => {
        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.type).toBe('text');
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

    it('should apply base styling classes', () => {
        const input = fixture.debugElement.query(By.css('input'));
        expect(input.nativeElement.className).toContain('rounded-lg');
        expect(input.nativeElement.className).toContain('border');
        expect(input.nativeElement.className).toContain('w-full');
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

    it('should bind to FormControl', () => {
        const input = fixture.debugElement.query(By.css('input'));
        expect(input).toBeTruthy();
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
});

describe('Input RTL Support', () => {
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

    it('should maintain input functionality in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const input = fixture.debugElement.query(By.css('input'));
        expect(input).toBeTruthy();
        expect(input.nativeElement.placeholder).toBe('أدخل النص');
    });
});
