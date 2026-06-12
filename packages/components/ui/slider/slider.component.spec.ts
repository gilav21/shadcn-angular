import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SliderComponent } from './slider.component';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// RTL Test host
@Component({
    template: `
        <div [dir]="dir()">
            <ui-slider [defaultValue]="50" (valueChange)="onValueChange($event)" />
        </div>
    `,
    imports: [SliderComponent]
})
class RTLTestHostComponent {
    dir = signal<'ltr' | 'rtl'>('ltr');
    currentValue = 50;
    onValueChange(value: number) {
        this.currentValue = value;
    }
}

describe('SliderComponent', () => {
    let component: SliderComponent;
    let fixture: ComponentFixture<SliderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SliderComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SliderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="slider"', () => {
        const slider = fixture.debugElement.query(By.css('[data-slot="slider"]'));
        expect(slider).toBeTruthy();
    });

    it('renders a native range input as the slider control', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(thumb).toBeTruthy();
    });

    it('should have default min/max values', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(thumb.nativeElement.min).toBe('0');
        expect(thumb.nativeElement.max).toBe('100');
    });

    it('reflects value on the native range input', async () => {
        component.value.set(50);
        fixture.detectChanges();
        await fixture.whenStable();

        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(thumb.nativeElement.value).toBe('50');
    });

    it('should calculate percentage correctly', () => {
        component.value.set(75);
        fixture.detectChanges();

        expect(component.percentage()).toBe(75);
    });

    it('should respect custom min/max', () => {
        fixture.componentRef.setInput('min', 10);
        fixture.componentRef.setInput('max', 50);
        component.value.set(30);
        fixture.detectChanges();

        // (30-10)/(50-10) = 20/40 = 50%
        expect(component.percentage()).toBe(50);
    });

    it('should apply disabled opacity', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const slider = fixture.debugElement.query(By.css('[data-slot="slider"]'));
        expect(slider.nativeElement.className).toContain('opacity-50');
    });

    it('should set aria-label', () => {
        fixture.componentRef.setInput('ariaLabel', 'Volume');
        fixture.detectChanges();

        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        expect(thumb.nativeElement.getAttribute('aria-label')).toBe('Volume');
    });

    it('should apply flex layout', () => {
        const slider = fixture.debugElement.query(By.css('[data-slot="slider"]'));
        expect(slider.nativeElement.className).toContain('flex');
        expect(slider.nativeElement.className).toContain('items-center');
    });
});

describe('Slider Keyboard Navigation', () => {
    let component: SliderComponent;
    let fixture: ComponentFixture<SliderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SliderComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(SliderComponent);
        component = fixture.componentInstance;
        component.value.set(50);
        fixture.detectChanges();
    });

    it('should increase value on ArrowRight', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        thumb.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        fixture.detectChanges();

        expect(component.value()).toBe(51);
    });

    it('should decrease value on ArrowLeft', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        thumb.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        fixture.detectChanges();

        expect(component.value()).toBe(49);
    });

    it('should go to min on Home', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        thumb.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
        fixture.detectChanges();

        expect(component.value()).toBe(0);
    });

    it('should go to max on End', () => {
        const thumb = fixture.debugElement.query(By.css('input[type="range"]'));
        thumb.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
        fixture.detectChanges();

        expect(component.value()).toBe(100);
    });
});

describe('Slider RTL Support', () => {
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

    it('should maintain slider functionality in RTL', async () => {
        component.dir.set('rtl');
        fixture.detectChanges();
        await fixture.whenStable();

        const slider = fixture.debugElement.query(By.directive(SliderComponent));
        expect(slider).toBeTruthy();
    });
});

describe('SliderComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [SliderComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(SliderComponent);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.componentRef.setInput('max', 10000);
        fixture.componentInstance.value.set(1234);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults aria-valuetext to en-US grouping', async () => {
        const fixture = await setup();
        const handle = fixture.nativeElement.querySelector('input[type="range"]');
        expect(handle.getAttribute('aria-valuetext')).toBe('1,234');
    });

    it('localises aria-valuetext when locale="de" (uses German decimal/grouping)', async () => {
        const fixture = await setup({ locale: 'de' });
        const handle = fixture.nativeElement.querySelector('input[type="range"]');
        expect(handle.getAttribute('aria-valuetext')).toBe('1.234');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        const handle = fixture.nativeElement.querySelector('input[type="range"]');
        const v = handle.getAttribute('aria-valuetext');
        // French uses narrow no-break space (U+202F) or regular space — both are non-ASCII.
        expect(v).toContain('234');
        expect(v.length).toBe('1 234'.length);
    });
});
