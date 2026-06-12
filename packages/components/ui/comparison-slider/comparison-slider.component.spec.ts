import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComparisonSliderComponent } from './comparison-slider.component';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
    if (!('ResizeObserver' in globalThis)) {
        (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
});

describe('ComparisonSliderComponent', () => {
    let component: ComparisonSliderComponent;
    let fixture: ComponentFixture<ComparisonSliderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ComparisonSliderComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ComparisonSliderComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('beforeSrc', 'https://picsum.photos/id/10/800/450');
        fixture.componentRef.setInput('afterSrc', 'https://picsum.photos/id/20/800/450');
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="comparison-slider"', () => {
        const root = fixture.nativeElement.querySelector('[data-slot="comparison-slider"]');
        expect(root).toBeTruthy();
    });

    it('should render both images with correct src', () => {
        const imgs: NodeListOf<HTMLImageElement> = fixture.nativeElement.querySelectorAll('img');
        const srcs = Array.from(imgs).map((img) => img.src);
        expect(srcs.some((s) => s.includes('id/10'))).toBe(true);
        expect(srcs.some((s) => s.includes('id/20'))).toBe(true);
    });

    it('should default position to 50', () => {
        expect(component.position()).toBe(50);
    });

    it('should reflect position in clip wrapper style', () => {
        const clipWrapper = fixture.nativeElement.querySelector('[data-slot="comparison-slider"] > div:nth-child(2)');
        expect(clipWrapper).toBeTruthy();
        fixture.componentRef.setInput('position', 70);
        fixture.detectChanges();
        expect(component.position()).toBe(70);
    });

    it('should increment position on ArrowRight', () => {
        const handle: HTMLElement = fixture.nativeElement.querySelector('input[type="range"]');
        expect(handle).toBeTruthy();
        fixture.componentRef.setInput('position', 50);
        fixture.detectChanges();
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        expect(component.position()).toBe(51);
    });

    it('should decrement position on ArrowLeft', () => {
        const handle: HTMLElement = fixture.nativeElement.querySelector('input[type="range"]');
        fixture.componentRef.setInput('position', 50);
        fixture.detectChanges();
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        fixture.detectChanges();
        expect(component.position()).toBe(49);
    });

    it('should go to 0 on Home key', () => {
        const handle: HTMLElement = fixture.nativeElement.querySelector('input[type="range"]');
        fixture.componentRef.setInput('position', 50);
        fixture.detectChanges();
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        fixture.detectChanges();
        expect(component.position()).toBe(0);
    });

    it('should go to 100 on End key', () => {
        const handle: HTMLElement = fixture.nativeElement.querySelector('input[type="range"]');
        fixture.componentRef.setInput('position', 50);
        fixture.detectChanges();
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        fixture.detectChanges();
        expect(component.position()).toBe(100);
    });

    it('should clamp position at lower bound', () => {
        const handle: HTMLElement = fixture.nativeElement.querySelector('input[type="range"]');
        fixture.componentRef.setInput('position', 0);
        fixture.detectChanges();
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        fixture.detectChanges();
        expect(component.position()).toBe(0);
    });

    it('should clamp position at upper bound', () => {
        const handle: HTMLElement = fixture.nativeElement.querySelector('input[type="range"]');
        fixture.componentRef.setInput('position', 100);
        fixture.detectChanges();
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
        expect(component.position()).toBe(100);
    });

    it('should switch clip axis with vertical orientation', () => {
        fixture.componentRef.setInput('orientation', 'vertical');
        fixture.detectChanges();
        expect(component.isHorizontal()).toBe(false);
    });

    it('should move the divider down on ArrowDown in vertical orientation', () => {
        fixture.componentRef.setInput('orientation', 'vertical');
        fixture.componentRef.setInput('position', 50);
        fixture.detectChanges();
        const handle: HTMLElement = fixture.nativeElement.querySelector('input[type="range"]');
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        fixture.detectChanges();
        expect(component.position()).toBe(51);
    });

    it('should move the divider up on ArrowUp in vertical orientation', () => {
        fixture.componentRef.setInput('orientation', 'vertical');
        fixture.componentRef.setInput('position', 50);
        fixture.detectChanges();
        const handle: HTMLElement = fixture.nativeElement.querySelector('input[type="range"]');
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        fixture.detectChanges();
        expect(component.position()).toBe(49);
    });

    it('should expose aria-valuetext on the handle', () => {
        fixture.componentRef.setInput('position', 30);
        fixture.detectChanges();
        const handle: HTMLElement = fixture.nativeElement.querySelector('input[type="range"]');
        expect(handle.getAttribute('aria-valuetext')).toBe('30% before, 70% after');
    });

    it('should render beforeLabel chip when provided', () => {
        fixture.componentRef.setInput('beforeLabel', 'Before');
        fixture.detectChanges();
        const chips: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('span');
        const texts = Array.from(chips).map((s) => s.textContent?.trim());
        expect(texts.some((t) => t === 'Before')).toBe(true);
    });

    it('should not render beforeLabel chip when omitted', () => {
        fixture.detectChanges();
        const chips: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('span');
        expect(chips.length).toBe(0);
    });

    it('should render afterLabel chip when provided', () => {
        fixture.componentRef.setInput('afterLabel', 'After');
        fixture.detectChanges();
        const chips: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('span');
        const texts = Array.from(chips).map((s) => s.textContent?.trim());
        expect(texts.some((t) => t === 'After')).toBe(true);
    });

    it('should apply custom class to root', () => {
        fixture.componentRef.setInput('class', 'my-custom-class');
        fixture.detectChanges();
        const root: HTMLElement = fixture.nativeElement.querySelector('[data-slot="comparison-slider"]');
        expect(root.className).toContain('my-custom-class');
    });
});

describe('ComparisonSliderComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [ComparisonSliderComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(ComparisonSliderComponent);
        fixture.componentRef.setInput('beforeSrc', 'a.png');
        fixture.componentRef.setInput('afterSrc', 'b.png');
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults handle aria-label to English "Comparison slider"', async () => {
        const fixture = await setup();
        const handle = fixture.nativeElement.querySelector('input[type="range"]');
        expect(handle.getAttribute('aria-label')).toBe('Comparison slider');
    });

    it('localises handle aria-label and applies dir="rtl" when locale="he"', async () => {
        const fixture = await setup({ locale: 'he' });
        const handle = fixture.nativeElement.querySelector('input[type="range"]');
        expect(handle.getAttribute('aria-label')).toBe('מחוון השוואה');
        const root = fixture.nativeElement.querySelector('div');
        expect(root.getAttribute('dir')).toBe('rtl');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        const handle = fixture.nativeElement.querySelector('input[type="range"]');
        expect(handle.getAttribute('aria-label')).toBe('Curseur de comparaison');
    });
});
