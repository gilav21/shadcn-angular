import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { InputMaskDemoComponent } from './input-mask-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { INPUT_MASK_DEMO_LOCALES } from './input-mask-demo.locales';

describe('InputMaskDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [InputMaskDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(InputMaskDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(INPUT_MASK_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [InputMaskDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(InputMaskDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(INPUT_MASK_DEMO_LOCALES['he'].heading);
        });
    });
});
