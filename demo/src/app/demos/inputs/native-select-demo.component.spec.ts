import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NativeSelectDemoComponent } from './native-select-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { NATIVE_SELECT_DEMO_LOCALES } from './native-select-demo.locales';

describe('NativeSelectDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [NativeSelectDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(NativeSelectDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(NATIVE_SELECT_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [NativeSelectDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(NativeSelectDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(NATIVE_SELECT_DEMO_LOCALES['he'].heading);
        });
    });
});
