import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RichTextEditorDemoComponent } from './rich-text-editor-demo.component';
import { provideUiLocale } from '../../../../../packages/components/lib/i18n';
import { RICH_TEXT_EDITOR_DEMO_LOCALES } from './rich-text-editor-demo.locales';

describe('RichTextEditorDemoComponent', () => {
    describe('English (default)', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [RichTextEditorDemoComponent],
            });
        });

        it('shows English heading', () => {
            const fixture = TestBed.createComponent(RichTextEditorDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(RICH_TEXT_EDITOR_DEMO_LOCALES['en'].heading);
        });
    });

    describe('Hebrew locale', () => {
        beforeEach(() => {
            TestBed.configureTestingModule({
                imports: [RichTextEditorDemoComponent],
                providers: [provideUiLocale('he')],
            });
        });

        it('shows Hebrew heading', () => {
            const fixture = TestBed.createComponent(RichTextEditorDemoComponent);
            fixture.detectChanges();
            const el: HTMLElement = fixture.nativeElement;
            expect(el.querySelector('h2')?.textContent?.trim()).toBe(RICH_TEXT_EDITOR_DEMO_LOCALES['he'].heading);
        });
    });
});
