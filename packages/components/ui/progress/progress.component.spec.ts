import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressComponent } from './progress.component';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';

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

    it('reflects value on the native progress', () => {
        fixture.componentRef.setInput('value', 50);
        fixture.detectChanges();

        const progress = fixture.debugElement.query(By.css('progress'));
        expect(progress.nativeElement.value).toBe(50);
    });

    it('reflects max on the native progress', () => {
        fixture.componentRef.setInput('max', 200);
        fixture.detectChanges();

        const progress = fixture.debugElement.query(By.css('progress'));
        expect(progress.nativeElement.max).toBe(200);
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

    it('localises aria-valuetext when locale="fr" (no-break space before %)', async () => {
        const fixture = await setup({ locale: 'fr' });
        const root = fixture.nativeElement.querySelector('progress');
        // Engines differ on a narrow (U+202F) or regular (U+00A0) no-break space.
        expect(root.getAttribute('aria-valuetext')).toMatch(/^45[\u00a0\u202f]%$/);
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'de' });
        const root = fixture.nativeElement.querySelector('progress');
        // German: "45 %" with a non-breaking space.
        expect(root.getAttribute('aria-valuetext')).toBe('45\u00a0%');
    });
});
