import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PhoneInputDemoComponent } from './phone-input-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { PHONE_INPUT_DEMO_LOCALES } from './phone-input-demo.locales';

describe('PhoneInputDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [PhoneInputDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(PhoneInputDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(PHONE_INPUT_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [PhoneInputDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(PhoneInputDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(PHONE_INPUT_DEMO_LOCALES['he'].heading);
        });
    });
});
