import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NumberInputDemoComponent } from './number-input-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { NUMBER_INPUT_DEMO_LOCALES } from './number-input-demo.locales';

describe('NumberInputDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [NumberInputDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(NumberInputDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(NUMBER_INPUT_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [NumberInputDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(NumberInputDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(NUMBER_INPUT_DEMO_LOCALES['he'].heading);
        });
    });
});
