import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressComponent } from './progress.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-progress [value]="value()" />
        </div>
    `,
    imports: [ProgressComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    value = signal(50);
}

describe('ProgressComponent', () => {
    let component: ProgressComponent;
    let fixture: ComponentFixture<ProgressComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ProgressComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(ProgressComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="progress"', () => {
        const progress = fixture.debugElement.query(By.css('[data-slot="progress"]'));
        expect(progress).toBeTruthy();
    });

    it('should have role="progressbar"', () => {
        const progress = fixture.debugElement.query(By.css('[role="progressbar"]'));
        expect(progress).toBeTruthy();
    });

    it('should have aria-valuenow attribute', () => {
        fixture.componentRef.setInput('value', 50);
        fixture.detectChanges();

        const progress = fixture.debugElement.query(By.css('[role="progressbar"]'));
        expect(progress.nativeElement.getAttribute('aria-valuenow')).toBe('50');
    });

    it('should have aria-valuemin and aria-valuemax', () => {
        const progress = fixture.debugElement.query(By.css('[role="progressbar"]'));
        expect(progress.nativeElement.getAttribute('aria-valuemin')).toBe('0');
        expect(progress.nativeElement.getAttribute('aria-valuemax')).toBe('100');
    });

    it('should calculate percentage correctly', () => {
        fixture.componentRef.setInput('value', 75);
        fixture.detectChanges();

        expect(component.percentage()).toBe(75);
    });

    it('should clamp percentage to 0-100', () => {
        fixture.componentRef.setInput('value', 150);
        fixture.detectChanges();
        expect(component.percentage()).toBe(100);

        fixture.componentRef.setInput('value', -50);
        fixture.detectChanges();
        expect(component.percentage()).toBe(0);
    });

    it('should respect custom max value', () => {
        fixture.componentRef.setInput('value', 50);
        fixture.componentRef.setInput('max', 200);
        fixture.detectChanges();

        expect(component.percentage()).toBe(25);
    });

    it('should set aria-label', () => {
        fixture.componentRef.setInput('ariaLabel', 'Loading progress');
        fixture.detectChanges();

        const progress = fixture.debugElement.query(By.css('[role="progressbar"]'));
        expect(progress.nativeElement.getAttribute('aria-label')).toBe('Loading progress');
    });

    it('should apply base classes', () => {
        const progress = fixture.debugElement.query(By.css('[role="progressbar"]'));
        expect(progress.nativeElement.className).toContain('rounded-full');
        expect(progress.nativeElement.className).toContain('overflow-hidden');
    });

    it('should apply width style to inner bar', () => {
        fixture.componentRef.setInput('value', 60);
        fixture.detectChanges();

        const innerBar = fixture.debugElement.query(By.css('.bg-primary'));
        expect(innerBar.nativeElement.style.width).toBe('60%');
    });
});

describe('Progress RTL Support', () => {
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

    it('should maintain progress value in RTL', async () => {
        component.dir.set('rtl');
        component.value.set(75);
        fixture.detectChanges();
        await fixture.whenStable();

        const innerBar = fixture.debugElement.query(By.css('.bg-primary'));
        expect(innerBar.nativeElement.style.width).toBe('75%');
    });
});
