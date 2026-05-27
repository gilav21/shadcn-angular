import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { InputOtpDemoComponent } from './input-otp-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { INPUT_OTP_DEMO_LOCALES } from './input-otp-demo.locales';

describe('InputOtpDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [InputOtpDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(InputOtpDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(INPUT_OTP_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [InputOtpDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(InputOtpDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(INPUT_OTP_DEMO_LOCALES['he'].heading);
        });
    });
});
