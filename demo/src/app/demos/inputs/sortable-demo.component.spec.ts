import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SortableDemoComponent } from './sortable-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { SORTABLE_DEMO_LOCALES } from './sortable-demo.locales';

describe('SortableDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [SortableDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(SortableDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(SORTABLE_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [SortableDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(SortableDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(SORTABLE_DEMO_LOCALES['he'].heading);
        });
    });
});
