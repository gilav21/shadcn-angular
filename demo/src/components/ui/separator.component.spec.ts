import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeparatorComponent } from './separator.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-separator [orientation]="orientation()" />
        </div>
    `,
    imports: [SeparatorComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

describe('SeparatorComponent', () => {
    let component: SeparatorComponent;
    let fixture: ComponentFixture<SeparatorComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SeparatorComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SeparatorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="separator"', () => {
        expect(fixture.nativeElement.getAttribute('data-slot')).toBe('separator');
    });

    it('should have role="separator"', () => {
        expect(fixture.nativeElement.getAttribute('role')).toBe('separator');
    });

    it('should have aria-orientation attribute', () => {
        expect(fixture.nativeElement.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('should apply horizontal orientation by default', () => {
        expect(fixture.nativeElement.className).toContain('h-[1px]');
        expect(fixture.nativeElement.className).toContain('w-full');
    });

    it('should apply vertical orientation classes', () => {
        fixture.componentRef.setInput('orientation', 'vertical');
        fixture.detectChanges();

        expect(fixture.nativeElement.getAttribute('aria-orientation')).toBe('vertical');
        expect(fixture.nativeElement.className).toContain('w-[1px]');
        expect(fixture.nativeElement.className).toContain('h-full');
    });

    it('should apply base classes', () => {
        expect(fixture.nativeElement.className).toContain('bg-border');
        expect(fixture.nativeElement.className).toContain('shrink-0');
    });

    it('should apply custom class', () => {
        fixture.componentRef.setInput('class', 'my-separator');
        fixture.detectChanges();

        expect(fixture.nativeElement.className).toContain('my-separator');
    });
});

describe('Separator RTL Support', () => {
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

    it('should maintain horizontal orientation in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const separator = fixture.debugElement.query(By.directive(SeparatorComponent));
        expect(separator.nativeElement.className).toContain('w-full');
    });

    it('should maintain vertical orientation in RTL', async () => {
        component.dir.set('rtl');
        component.orientation.set('vertical');
        fixture.detectChanges();
        await fixture.whenStable();

        const separator = fixture.debugElement.query(By.directive(SeparatorComponent));
        expect(separator.nativeElement.className).toContain('h-full');
    });
});
