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
