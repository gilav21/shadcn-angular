import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextareaComponent } from './textarea.component';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';

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
        expect(textarea.nativeElement.dataset.slot).toBe('textarea');
    });

    it('should render a textarea element', () => {
        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea).toBeTruthy();
    });

    it('should render a skeleton instead of the textarea when skeleton is true', () => {
        fixture.componentRef.setInput('skeleton', true);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('ui-skeleton'))).toBeTruthy();
        expect(fixture.debugElement.query(By.css('textarea'))).toBeNull();
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

    it('should apply base styling classes', () => {
        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.className).toContain('rounded-md');
        expect(textarea.nativeElement.className).toContain('border');
        expect(textarea.nativeElement.className).toContain('w-full');
    });

    it('should update the value signal and default onChange when onValueChange is called', () => {
        expect(() => component.onValueChange('typed text')).not.toThrow();
        expect(component.value()).toBe('typed text');
    });

    it('should invoke the default onTouched without a registered callback', () => {
        expect(() => component.onTouched()).not.toThrow();
    });

    it('should reflect the current value through toString()', () => {
        component.onValueChange('serialized');
        expect(component.toString()).toBe('serialized');
    });

    it('should coerce a null value to an empty string in writeValue', () => {
        component.value.set('previous');
        component.writeValue(null as unknown as string);
        expect(component.value()).toBe('');
    });
});

describe('Textarea inside an input group', () => {
    let fixture: ComponentFixture<TextareaComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TextareaComponent],
            providers: [
                {
                    provide: UI_INPUT_GROUP,
                    useValue: { disabled: signal(false) },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(TextareaComponent);
        fixture.detectChanges();
    });

    it('should downgrade the default outline variant to ghost when grouped', () => {
        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.className).toContain('border-none');
        expect(textarea.nativeElement.className).not.toContain('rounded-md');
    });

    it('should keep an explicit variant unchanged when grouped', () => {
        fixture.componentRef.setInput('variant', 'underline');
        fixture.detectChanges();
        const textarea = fixture.debugElement.query(By.css('textarea'));
        expect(textarea.nativeElement.className).toContain('border-b');
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
