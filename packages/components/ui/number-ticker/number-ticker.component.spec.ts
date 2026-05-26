import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NumberTickerComponent, NumberTickerDigitComponent } from './number-ticker.component';

@Component({
    template: `<ui-number-ticker [value]="value()" [decimalPlaces]="decimalPlaces()" [delay]="delay()" [duration]="duration()" />`,
    imports: [NumberTickerComponent]
})
class NumberTickerTestHostComponent {
    value = signal(1234);
    decimalPlaces = signal(0);
    delay = signal(0);
    duration = signal(0.01);
}

describe('NumberTickerComponent', () => {
    let fixture: ComponentFixture<NumberTickerTestHostComponent>;
    let component: NumberTickerTestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NumberTickerTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(NumberTickerTestHostComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent));
        expect(ticker).toBeTruthy();
    });

    it('should accept value input', () => {
        const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent));
        expect(ticker.componentInstance.value()).toBe(1234);
    });

    it('should render digit components', () => {
        const digits = fixture.debugElement.queryAll(By.directive(NumberTickerDigitComponent));
        expect(digits.length).toBeGreaterThan(0);
    });

    it('should render a span element with tabular-nums class', () => {
        const span = fixture.debugElement.query(By.css('.tabular-nums'));
        expect(span).toBeTruthy();
    });

    it('should accept decimalPlaces input', () => {
        const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent));
        component.decimalPlaces.set(2);
        fixture.detectChanges();

        expect(ticker.componentInstance.decimalPlaces()).toBe(2);
    });

    it('should update when value changes', async () => {
        component.value.set(5678);
        fixture.detectChanges();

        const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent));
        expect(ticker.componentInstance.value()).toBe(5678);
    });

    it('should accept custom class input', () => {
        const tickerComponent = fixture.debugElement.query(By.directive(NumberTickerComponent)).componentInstance;
        expect(tickerComponent.class()).toBe('');
    });

    describe('display digits formatting', () => {
        it('should display formatted value with commas after animation completes', async () => {
            const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent)).componentInstance as NumberTickerComponent;

            await vi.waitFor(() => {
                const display = ticker.displayValue();
                expect(display).toBe('1,234');
            }, { timeout: 2000 });
        });

        it('should render one digit component per character including commas', async () => {
            const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent)).componentInstance as NumberTickerComponent;

            await vi.waitFor(() => {
                expect(ticker.displayValue()).toBe('1,234');
            }, { timeout: 2000 });

            fixture.detectChanges();

            const digits = fixture.debugElement.queryAll(By.directive(NumberTickerDigitComponent));
            expect(digits.length).toBe(5);
        });
    });

    describe('decimal places', () => {
        it('should include decimal point in display when decimalPlaces is set', async () => {
            component.value.set(12.5);
            component.decimalPlaces.set(2);
            component.duration.set(0.01);
            fixture.detectChanges();

            const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent)).componentInstance as NumberTickerComponent;

            await vi.waitFor(() => {
                expect(ticker.displayValue()).toBe('12.50');
            }, { timeout: 2000 });
        });

        it('should format value with specified number of decimal places', async () => {
            component.value.set(99.1);
            component.decimalPlaces.set(3);
            component.duration.set(0.01);
            fixture.detectChanges();

            const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent)).componentInstance as NumberTickerComponent;

            await vi.waitFor(() => {
                expect(ticker.displayValue()).toBe('99.100');
            }, { timeout: 2000 });
        });
    });

    describe('value change triggers update', () => {
        it('should update displayValue when value changes from 1234 to 5678', async () => {
            const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent)).componentInstance as NumberTickerComponent;

            await vi.waitFor(() => {
                expect(ticker.displayValue()).toBe('1,234');
            }, { timeout: 2000 });

            component.value.set(5678);
            fixture.detectChanges();

            await vi.waitFor(() => {
                expect(ticker.displayValue()).toBe('5,678');
            }, { timeout: 2000 });
        });

        it('should update displayDigits computed when value changes', async () => {
            const ticker = fixture.debugElement.query(By.directive(NumberTickerComponent)).componentInstance as NumberTickerComponent;

            await vi.waitFor(() => {
                expect(ticker.displayValue()).toBe('1,234');
            }, { timeout: 2000 });

            const initialDigits = ticker.displayDigits();
            expect(initialDigits).toEqual(['1', ',', '2', '3', '4']);

            component.value.set(5678);
            fixture.detectChanges();

            await vi.waitFor(() => {
                expect(ticker.displayDigits()).toEqual(['5', ',', '6', '7', '8']);
            }, { timeout: 2000 });
        });
    });
});

describe('NumberTickerDigitComponent', () => {
    @Component({
        template: `<ui-number-ticker-digit [digit]="digit()" />`,
        imports: [NumberTickerDigitComponent]
    })
    class DigitTestHostComponent {
        digit = signal('5');
    }

    let fixture: ComponentFixture<DigitTestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DigitTestHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(DigitTestHostComponent);
        fixture.detectChanges();
    });

    it('should create', () => {
        const digit = fixture.debugElement.query(By.directive(NumberTickerDigitComponent));
        expect(digit).toBeTruthy();
    });

    it('should render the digit value', () => {
        const element = fixture.debugElement.query(By.directive(NumberTickerDigitComponent));
        expect(element.nativeElement.textContent).toContain('5');
    });
});

describe('NumberTickerComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [NumberTickerComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(NumberTickerComponent);
        fixture.componentRef.setInput('value', 1234);
        fixture.componentRef.setInput('duration', 0);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.detectChanges();
        await new Promise<void>(r => setTimeout(r, 50));
        return fixture;
    }

    it('formats with en-US grouping when no locale set (default)', async () => {
        const fixture = await setup();
        const cmp = fixture.componentInstance;
        expect(cmp.resolvedLocale()).toBe('en');
    });

    it('resolves locale from the per-instance input', async () => {
        const fixture = await setup({ locale: 'de' });
        expect(fixture.componentInstance.resolvedLocale()).toBe('de');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        expect(fixture.componentInstance.resolvedLocale()).toBe('fr');
    });
});
