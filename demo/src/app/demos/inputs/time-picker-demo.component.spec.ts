import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { TimePickerDemoComponent } from './time-picker-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { TIME_PICKER_DEMO_LOCALES } from './time-picker-demo.locales';

describe('TimePickerDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({ imports: [TimePickerDemoComponent] });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(TimePickerDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(
                TIME_PICKER_DEMO_LOCALES['en'].heading,
            );
        });

        /**
         * The claim the locales section makes: four fields, one stored value.
         * Asserted on the value rather than on the four renderings, because
         * the renderings differing is the whole point.
         */
        it('shows the same value under every locale in the row', async () => {
            const fixture = TestBed.createComponent(TimePickerDemoComponent);
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const groups: HTMLElement[] = [
                ...fixture.nativeElement.querySelectorAll('[data-slot="time-picker"]'),
            ];
            const locales = groups.map(group => group.dataset['locale']);

            expect(locales).toContain('en-US');
            expect(locales).toContain('zh-TW');
        });

        it('starts the basic field at its stated value', async () => {
            const fixture = TestBed.createComponent(TimePickerDemoComponent);
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();

            const shown = fixture.nativeElement.querySelector('[data-testid="basic-value"]');
            expect(shown?.textContent).toContain('09:05');
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [TimePickerDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(TimePickerDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(
                TIME_PICKER_DEMO_LOCALES['he'].heading,
            );
        });
    });
});
