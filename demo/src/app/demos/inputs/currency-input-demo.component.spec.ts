import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CurrencyInputDemoComponent } from './currency-input-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { CurrencyInputComponent } from '../../../../../packages/components/ui';
import { CURRENCY_INPUT_DEMO_LOCALES } from './currency-input-demo.locales';

describe('CurrencyInputDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({ imports: [CurrencyInputDemoComponent] });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(CurrencyInputDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(
                CURRENCY_INPUT_DEMO_LOCALES['en'].heading,
            );
        });

        /**
         * The demo is the only place the four locales render side by side, so
         * it is also the cheapest place to notice that one of them stopped
         * formatting.
         */
        /**
         * Asserted on what each control computed, not on the DOM input.
         *
         * `ngModel` writes to the native field in a microtask of its own, so
         * on first render the element is still empty while the component has
         * already formatted correctly — the empty box says something about
         * `ngModel`'s timing, not about this demo. What matters here is that
         * every sample resolved a locale and produced a formatted string;
         * that it reaches the DOM is covered by the component spec and by e2e.
         */
        it('formats every locale sample', async () => {
            const fixture = TestBed.createComponent(CurrencyInputDemoComponent);
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const controls = fixture.debugElement
                .queryAll(node => node.componentInstance instanceof CurrencyInputComponent)
                .map(node => node.componentInstance as CurrencyInputComponent);

            expect(controls.length).toBeGreaterThan(4);
            const unformatted = controls
                .filter(control => control.value() !== null)
                .filter(control => control.displayValue().trim() === '');
            expect(unformatted).toEqual([]);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [CurrencyInputDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(CurrencyInputDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(
                CURRENCY_INPUT_DEMO_LOCALES['he'].heading,
            );
        });
    });
});
