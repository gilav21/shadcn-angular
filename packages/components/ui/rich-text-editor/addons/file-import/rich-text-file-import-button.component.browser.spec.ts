import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextFileImportButtonComponent } from './rich-text-file-import-button.component';
import {
    RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT,
    type RichTextFileImportButtonContext,
} from './rich-text-file-import.context';
import { RICH_TEXT_FILE_IMPORT_LOCALES } from './rich-text-file-import.locales';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';

/**
 * Browser-only file-import-button case. It asserts the button's padding as
 * computed style from the Tailwind stylesheet, which jsdom does not load, so
 * the value would read empty there. It runs in the real-browser leg only; the
 * portable (jsdom) leg and the shipped `testFiles` exclude this file.
 */
describe('RichTextFileImportButtonComponent', () => {
    const disabled = signal(false);
    const readonly = signal(false);
    const compact = signal(false);

    const context: RichTextFileImportButtonContext = {
        locale: signal(RICH_TEXT_FILE_IMPORT_LOCALES['en']),
        accept: signal('.pdf,.docx'),
        onImport: vi.fn<(file: File) => void>(),
    };

    let fixture: ComponentFixture<RichTextFileImportButtonComponent>;
    let host: HTMLElement;

    async function setup(withToolbarView: boolean): Promise<void> {
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            imports: [RichTextFileImportButtonComponent],
            providers: [
                { provide: RichTextEditorAddonHost, useValue: { disabled, isDisabled: disabled, readonly, registerExclusivePopover: () => ({ notifyOpened: () => {}, release: () => {} }) } },
                { provide: RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT, useValue: context },
                ...(withToolbarView ? [{ provide: RichTextToolbarViewContext, useValue: { compact } }] : []),
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextFileImportButtonComponent);
        host = fixture.nativeElement as HTMLElement;
        fixture.detectChanges();
    }

    it('tightens the button padding while the toolbar view is compact', async () => {
        compact.set(true);
        await setup(true);
        const button = host.querySelector<HTMLButtonElement>('[data-slot="rte-file-import-button"]')!;
        expect(getComputedStyle(button).paddingLeft).toBe('4px');

        compact.set(false);
        fixture.detectChanges();
        expect(getComputedStyle(button).paddingLeft).toBe('6px');
    });
});
