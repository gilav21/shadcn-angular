import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextFileImportButtonComponent } from './rich-text-file-import-button.component';
import {
    RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT,
    type RichTextFileImportButtonContext,
} from './rich-text-file-import.context';
import { RICH_TEXT_FILE_IMPORT_LOCALES } from './rich-text-file-import.locales';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';

const LOCALE_EN = RICH_TEXT_FILE_IMPORT_LOCALES['en'];

describe('RichTextFileImportButtonComponent', () => {
    const disabled = signal(false);
    const readonly = signal(false);
    const compact = signal(false);
    const onImport = vi.fn<(file: File) => void>();

    const context: RichTextFileImportButtonContext = {
        locale: signal(LOCALE_EN),
        accept: signal('.pdf,.docx'),
        onImport,
    };

    let fixture: ComponentFixture<RichTextFileImportButtonComponent>;
    let host: HTMLElement;

    async function setup(withToolbarView: boolean): Promise<void> {
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            imports: [RichTextFileImportButtonComponent],
            providers: [
                { provide: RichTextEditorAddonHost, useValue: { disabled, readonly } },
                { provide: RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT, useValue: context },
                ...(withToolbarView ? [{ provide: RichTextToolbarViewContext, useValue: { compact } }] : []),
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextFileImportButtonComponent);
        host = fixture.nativeElement as HTMLElement;
        fixture.detectChanges();
    }

    beforeEach(() => {
        disabled.set(false);
        readonly.set(false);
        compact.set(false);
        onImport.mockReset();
    });

    it('renders the toolbar button with the localized tooltip', async () => {
        await setup(false);
        const button = host.querySelector<HTMLButtonElement>('[data-slot="rte-file-import-button"]');
        expect(button).toBeTruthy();
        expect(button?.getAttribute('title')).toBe(LOCALE_EN.tooltip);
        expect(button?.disabled).toBe(false);
    });

    it('sets the accept attribute on the hidden file input', async () => {
        await setup(false);
        const input = host.querySelector<HTMLInputElement>('[data-slot="rte-file-import-input"]');
        expect(input?.getAttribute('accept')).toBe('.pdf,.docx');
    });

    it('disables the button when the host is disabled', async () => {
        await setup(false);
        disabled.set(true);
        fixture.detectChanges();
        const button = host.querySelector<HTMLButtonElement>('[data-slot="rte-file-import-button"]');
        expect(button?.disabled).toBe(true);
    });

    it('disables the button when the host is readonly', async () => {
        await setup(false);
        readonly.set(true);
        fixture.detectChanges();
        const button = host.querySelector<HTMLButtonElement>('[data-slot="rte-file-import-button"]');
        expect(button?.disabled).toBe(true);
    });

    it('imports the chosen file and clears the input value', async () => {
        await setup(false);
        const input = host.querySelector<HTMLInputElement>('[data-slot="rte-file-import-input"]')!;
        const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onImport).toHaveBeenCalledWith(file);
        expect(input.value).toBe('');
    });

    it('does not import when no file was chosen', async () => {
        await setup(false);
        const input = host.querySelector<HTMLInputElement>('[data-slot="rte-file-import-input"]')!;
        Object.defineProperty(input, 'files', { value: [], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onImport).not.toHaveBeenCalled();
    });

    it('does not import while interaction is disabled', async () => {
        await setup(false);
        disabled.set(true);
        fixture.detectChanges();
        const input = host.querySelector<HTMLInputElement>('[data-slot="rte-file-import-input"]')!;
        const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onImport).not.toHaveBeenCalled();
    });

    it('uses compact padding when the toolbar view is compact', async () => {
        compact.set(true);
        await setup(true);
        const button = host.querySelector<HTMLButtonElement>('[data-slot="rte-file-import-button"]');
        expect(button?.className).toContain('p-1');
    });
});
