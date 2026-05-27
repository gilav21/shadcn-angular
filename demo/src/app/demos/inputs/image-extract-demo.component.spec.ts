import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ImageExtractDemoComponent } from './image-extract-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { IMAGE_EXTRACT_DEMO_LOCALES } from './image-extract-demo.locales';

describe('ImageExtractDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [ImageExtractDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(ImageExtractDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(IMAGE_EXTRACT_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [ImageExtractDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(ImageExtractDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(IMAGE_EXTRACT_DEMO_LOCALES['he'].heading);
        });
    });
});
