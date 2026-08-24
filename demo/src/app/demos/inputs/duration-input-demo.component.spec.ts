import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DurationInputDemoComponent } from './duration-input-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { DURATION_INPUT_DEMO_LOCALES } from './duration-input-demo.locales';

describe('DurationInputDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({ imports: [DurationInputDemoComponent] });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(DurationInputDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(
                DURATION_INPUT_DEMO_LOCALES['en'].heading,
            );
        });

        /** The same 90 minutes, three ways — the claim the section makes. */
        it('shows the ISO form of the seconds sample', async () => {
            const fixture = TestBed.createComponent(DurationInputDemoComponent);
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const iso = fixture.nativeElement.querySelector('[data-testid="iso-value"]');
            expect(iso?.textContent?.trim()).toBe('PT1H30M45S');
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [DurationInputDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(DurationInputDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(
                DURATION_INPUT_DEMO_LOCALES['he'].heading,
            );
        });
    });
});
