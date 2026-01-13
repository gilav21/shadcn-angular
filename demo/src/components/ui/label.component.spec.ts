import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LabelComponent } from './label.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-label for="input-id">تسمية</ui-label>
        </div>
    `,
    imports: [LabelComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('LabelComponent', () => {
    let component: LabelComponent;
    let fixture: ComponentFixture<LabelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [LabelComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(LabelComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="label"', () => {
        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.getAttribute('data-slot')).toBe('label');
    });

    it('should render a label element', () => {
        const label = fixture.debugElement.query(By.css('label'));
        expect(label).toBeTruthy();
    });

    it('should set for attribute', () => {
        fixture.componentRef.setInput('for', 'my-input');
        fixture.detectChanges();

        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.getAttribute('for')).toBe('my-input');
    });

    it('should apply default classes', () => {
        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.className).toContain('text-sm');
        expect(label.nativeElement.className).toContain('font-medium');
        expect(label.nativeElement.className).toContain('leading-none');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-label');
        fixture.detectChanges();

        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.className).toContain('my-label');
    });
});

describe('Label RTL Support', () => {
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

    it('should maintain for attribute in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.getAttribute('for')).toBe('input-id');
    });
});
