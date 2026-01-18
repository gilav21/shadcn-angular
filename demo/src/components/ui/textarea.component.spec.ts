import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextareaComponent } from './textarea.component';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Reactive forms test host
@Component({
    template: `<ui-textarea [formControl]="control" [placeholder]="placeholder()" />`,
    imports: [TextareaComponent, ReactiveFormsModule]
})
class ReactiveFormTestHost {
    control = new FormControl('');
    placeholder = signal('Enter your message...');
}

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-textarea placeholder="أدخل رسالتك" />
        </div>
    `,
    imports: [TextareaComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('TextareaComponent', () => {
    let component: TextareaComponent;
    let fixture: ComponentFixture<TextareaComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TextareaComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TextareaComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="textarea"', () => {
        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.getAttribute('data-slot')).toBe('textarea');
    });

    it('should render a textarea element', () => {
        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea).toBeTruthy();
    });

    it('should apply placeholder', () => {
        fixture.componentRef.setInput('placeholder', 'Enter text...');
        fixture.detectChanges();

        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.placeholder).toBe('Enter text...');
    });

    it('should be disabled when disabled input is true', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.disabled).toBe(true);
    });

    it('should set rows attribute', () => {
        fixture.componentRef.setInput('rows', 5);
        fixture.detectChanges();

        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.rows).toBe(5);
    });

    it('should apply default rows of 3', () => {
        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.rows).toBe(3);
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-textarea');
        fixture.detectChanges();

        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.className).toContain('my-textarea');
    });

    it('should apply outline styling classes by default', () => {
        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.className).toContain('rounded-md');
        expect(textarea.nativeElement.className).toContain('border');
        expect(textarea.nativeElement.className).toContain('w-full');
    });

    it('should apply underline styling classes', () => {
        fixture.componentRef.setInput('variant', 'underline');
        fixture.detectChanges();

        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.className).toContain('border-b');
        expect(textarea.nativeElement.className).toContain('rounded-none');
        expect(textarea.nativeElement.className).not.toContain('rounded-md');
        expect(textarea.nativeElement.className).toContain('px-0');
        expect(textarea.nativeElement.className).toContain('resize-none');
    });
});

describe('Textarea ControlValueAccessor', () => {
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
        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea).toBeTruthy();
    });

    it('should update FormControl on input', async () => {
        const textarea = fixture.debugElement.query(By.css('textarea'));
        textarea.nativeElement.value = 'test message';
        textarea.nativeElement.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.control.value).toBe('test message');
    });

    it('should update textarea when FormControl value changes', async () => {
        component.control.setValue('programmatic text');
        fixture.detectChanges();
        await fixture.whenStable();

        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.value).toBe('programmatic text');
    });
});

describe('Textarea RTL Support', () => {
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

    it('should maintain placeholder in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.placeholder).toBe('أدخل رسالتك');
    });
});
