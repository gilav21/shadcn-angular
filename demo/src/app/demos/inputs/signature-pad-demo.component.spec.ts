import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SignaturePadDemoComponent } from './signature-pad-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SIGNATURE_PAD_DEMO_LOCALES } from './signature-pad-demo.locales';

describe('SignaturePadDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({ imports: [SignaturePadDemoComponent] });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(SignaturePadDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(
                SIGNATURE_PAD_DEMO_LOCALES['en'].heading,
            );
        });

        /**
         * The claim of section 3.4: this control cannot be made accessible by
         * labelling it, so the demo has to actually offer the alternative.
         */
        it('offers a typed name as an alternative to drawing', async () => {
            const fixture = TestBed.createComponent(SignaturePadDemoComponent);
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const typed: HTMLInputElement = fixture.nativeElement.querySelector(
                '[data-testid="mode-type"]',
            );
            expect(typed).not.toBeNull();

            typed.click();
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            expect(fixture.nativeElement.querySelector('#typed-name')).not.toBeNull();
        });

        it('starts unsigned', async () => {
            const fixture = TestBed.createComponent(SignaturePadDemoComponent);
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const state = fixture.nativeElement.querySelector('[data-testid="basic-state"]');
            expect(state?.textContent?.trim()).toBe(
                SIGNATURE_PAD_DEMO_LOCALES['en'].notSignedLabel,
            );
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [SignaturePadDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(SignaturePadDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(
                SIGNATURE_PAD_DEMO_LOCALES['he'].heading,
            );
        });
    });
});
