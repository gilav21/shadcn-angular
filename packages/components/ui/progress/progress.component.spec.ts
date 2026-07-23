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

    it('renders a native <progress> element', () => {
        const progress = fixture.debugElement.query(By.css('progress'));
        expect(progress).toBeTruthy();
    });

    it('reflects value on the native progress', () => {
        fixture.componentRef.setInput('value', 50);
        fixture.detectChanges();

        const progress = fixture.debugElement.query(By.css('progress'));
        expect(progress.nativeElement.value).toBe(50);
    });

    it('reflects max on the native progress', () => {
        const progress = fixture.debugElement.query(By.css('progress'));
        expect(progress.nativeElement.max).toBe(100);
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

        const progress = fixture.debugElement.query(By.css('progress'));
        expect(progress.nativeElement.getAttribute('aria-label')).toBe('Loading progress');
    });

    it('should apply base classes', () => {
        const root = fixture.debugElement.query(By.css('[data-slot="progress"]'));
        expect(root.nativeElement.className).toContain('rounded-full');
        expect(root.nativeElement.className).toContain('overflow-hidden');
    });

    it('should apply width style to inner bar', () => {
        fixture.componentRef.setInput('value', 60);
        fixture.detectChanges();

        const innerBar = fixture.debugElement.query(By.css('.bg-primary'));
        expect(innerBar.nativeElement.style.width).toBe('60%');
    });

    it('toString() returns the current value as a string', () => {
        fixture.componentRef.setInput('value', 42);
        fixture.detectChanges();
        expect(component.toString()).toBe('42');

        fixture.componentRef.setInput('value', 0);
        fixture.detectChanges();
        expect(component.toString()).toBe('0');
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

describe('ProgressComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [ProgressComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(ProgressComponent);
        fixture.componentRef.setInput('value', 45);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults aria-valuetext to en-US percent format', async () => {
        const fixture = await setup();
        const root = fixture.nativeElement.querySelector('progress');
        expect(root.getAttribute('aria-valuetext')).toBe('45%');
    });

    it('localises aria-valuetext when locale="fr" (uses French narrow space + %)', async () => {
        const fixture = await setup({ locale: 'fr' });
        const root = fixture.nativeElement.querySelector('progress');
        const v = root.getAttribute('aria-valuetext');
        expect(v).toContain('45');
        expect(v).toContain('%');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'de' });
        const root = fixture.nativeElement.querySelector('progress');
        // German: "45 %" with non-breaking space.
        const v = root.getAttribute('aria-valuetext');
        expect(v).toContain('45');
        expect(v).toContain('%');
    });
});
