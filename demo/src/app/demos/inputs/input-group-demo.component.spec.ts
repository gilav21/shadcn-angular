import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { InputGroupDemoComponent } from './input-group-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { INPUT_GROUP_DEMO_LOCALES } from './input-group-demo.locales';

describe('InputGroupDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [InputGroupDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(InputGroupDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(INPUT_GROUP_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [InputGroupDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(InputGroupDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(INPUT_GROUP_DEMO_LOCALES['he'].heading);
        });
    });
});
