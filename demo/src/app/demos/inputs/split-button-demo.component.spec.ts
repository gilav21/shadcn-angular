import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SplitButtonDemoComponent } from './split-button-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SPLIT_BUTTON_DEMO_LOCALES } from './split-button-demo.locales';

describe('SplitButtonDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [SplitButtonDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(SplitButtonDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(SPLIT_BUTTON_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [SplitButtonDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(SplitButtonDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(SPLIT_BUTTON_DEMO_LOCALES['he'].heading);
        });
    });
});
