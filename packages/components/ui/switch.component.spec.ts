import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SwitchComponent } from './switch.component';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Reactive forms test host
@Component({
    template: `<ui-switch [formControl]="control" />`,
    imports: [SwitchComponent, ReactiveFormsModule]
})
class ReactiveFormTestHost {
    control = new FormControl(false);
}

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-switch />
        </div>
    `,
    imports: [SwitchComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('SwitchComponent', () => {
    let component: SwitchComponent;
    let fixture: ComponentFixture<SwitchComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SwitchComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SwitchComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="switch"', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('data-slot')).toBe('switch');
    });

    it('should have role="switch"', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('role')).toBe('switch');
    });

    it('should have aria-checked="false" by default', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('aria-checked')).toBe('false');
    });

    it('should toggle on click', async () => {
        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.checked()).toBe(true);
        expect(button.nativeElement.getAttribute('aria-checked')).toBe('true');
    });

    it('should not toggle when disabled', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();

        expect(component.checked()).toBe(false);
    });

    it('should apply bg-primary when checked', async () => {
        component.checked.set(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('bg-primary');
    });

    it('should apply bg-input when unchecked', () => {
        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.className).toContain('bg-input');
    });

    it('should set aria-label', () => {
        fixture.componentRef.setInput('ariaLabel', 'Toggle notifications');
        fixture.detectChanges();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('aria-label')).toBe('Toggle notifications');
    });
});

describe('Switch ControlValueAccessor', () => {
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
        const button = fixture.debugElement.query(By.css('button'));
        expect(button).toBeTruthy();
    });

    it('should update FormControl on toggle', async () => {
        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.control.value).toBe(true);
    });

    it('should reflect FormControl value', async () => {
        component.control.setValue(true);
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        expect(button.nativeElement.getAttribute('aria-checked')).toBe('true');
    });
});

describe('Switch RTL Support', () => {
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

    it('should use RTL-aware thumb translation classes', () => {
        const switchComp = fixture.debugElement.query(By.directive(SwitchComponent));
        const thumb = switchComp.query(By.css('span'));

        // Component uses ltr: and rtl: prefixes for transforms
        expect(thumb.nativeElement.className).toContain('translate-x-0');
    });

    it('should toggle correctly in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const button = fixture.debugElement.query(By.css('button'));
        button.nativeElement.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(button.nativeElement.getAttribute('aria-checked')).toBe('true');
    });
});
