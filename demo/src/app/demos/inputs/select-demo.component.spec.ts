import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SelectDemoComponent } from './select-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SELECT_DEMO_LOCALES } from './select-demo.locales';

describe('SelectDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [SelectDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(SelectDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(SELECT_DEMO_LOCALES['en'].heading);
        });

        it('renders the disabled-item example and marks the disabled option when opened', () => {
            const fixture = TestBed.createComponent(SelectDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.textContent).toContain(SELECT_DEMO_LOCALES['en'].disabledItemHeading);
            expect(el.textContent).toContain(SELECT_DEMO_LOCALES['en'].disabledItemDescription);

            const triggers = el.querySelectorAll<HTMLElement>('ui-select-trigger button[role="combobox"]');
            triggers[triggers.length - 1].click();
            fixture.detectChanges();

            const disabled = el.querySelectorAll('ui-select-content [data-disabled]');
            expect(disabled).toHaveLength(1);
            expect(disabled[0].textContent?.trim()).toBe(SELECT_DEMO_LOCALES['en'].banana);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [SelectDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(SelectDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(SELECT_DEMO_LOCALES['he'].heading);
        });
    });
});
