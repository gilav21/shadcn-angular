import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextImagesButtonComponent } from './rich-text-images-button.component';
import {
    RICH_TEXT_IMAGES_BUTTON_CONTEXT,
    type RichTextImagesButtonContext,
    type RichTextImageSources,
} from './rich-text-images.context';
import { RICH_TEXT_IMAGES_LOCALES } from './rich-text-images.locales';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';

/**
 * Browser-only image-button cases. Picking a file needs a real `FileList`,
 * which only `DataTransfer` can build and jsdom does not implement — and only
 * a file input holding a real pick has a non-empty value to clear. The compact
 * padding is computed style from the Tailwind stylesheet, which jsdom does not
 * load. They run in the real-browser leg only; the portable (jsdom) leg and
 * the shipped `testFiles` exclude this file.
 */
interface ButtonInternals {
    onOpenChange(next: boolean): void;
}

describe('RichTextImagesButtonComponent', () => {
    const disabled = signal(false);
    const readonly = signal(false);
    const compact = signal(false);
    const onUploadFile = vi.fn<(file: File) => void>();

    const context: RichTextImagesButtonContext = {
        locale: signal(RICH_TEXT_IMAGES_LOCALES['en']),
        sources: signal<RichTextImageSources>('all'),
        onOpen: vi.fn<() => void>(),
        onInsertUrl: vi.fn<(url: string, alt: string) => void>(),
        onUploadFile,
    };

    let fixture: ComponentFixture<RichTextImagesButtonComponent>;
    let internals: ButtonInternals;

    async function setup(withToolbarView = false): Promise<void> {
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            imports: [RichTextImagesButtonComponent],
            providers: [
                { provide: RichTextEditorAddonHost, useValue: { disabled, isDisabled: disabled, readonly, registerExclusivePopover: () => ({ notifyOpened: () => {}, release: () => {} }) } },
                { provide: RICH_TEXT_IMAGES_BUTTON_CONTEXT, useValue: context },
                ...(withToolbarView ? [{ provide: RichTextToolbarViewContext, useValue: { compact } }] : []),
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextImagesButtonComponent);
        internals = fixture.componentInstance as unknown as ButtonInternals;
        fixture.detectChanges();
    }

    /** Open the popover so its insert controls render. */
    function openControls(): void {
        internals.onOpenChange(true);
        fixture.detectChanges();
    }

    beforeEach(() => {
        compact.set(false);
        onUploadFile.mockReset();
    });

    it('uploads a chosen file, closes, and clears the input value', async () => {
        await setup();
        openControls();
        const host = fixture.nativeElement as HTMLElement;
        const input = host.querySelector<HTMLInputElement>('[data-slot="rte-images-file"]')!;
        const file = new File(['x'], 'p.png', { type: 'image/png' });
        const picked = new DataTransfer();
        picked.items.add(file);
        input.files = picked.files;
        expect(input.value).not.toBe('');

        input.dispatchEvent(new Event('change'));
        fixture.detectChanges();

        expect(onUploadFile).toHaveBeenCalledWith(file);
        // Cleared so picking the same file again still fires `change`.
        expect(input.value).toBe('');
        expect(host.querySelector('[data-slot="rte-images-file"]')).toBeNull();
    });

    it('uses compact padding inside a compact toolbar', async () => {
        compact.set(true);
        await setup(true);
        const button = (fixture.nativeElement as HTMLElement)
            .querySelector<HTMLButtonElement>('[data-slot="rte-images-button"]')!;
        expect(getComputedStyle(button).paddingTop).toBe('4px');
        expect(getComputedStyle(button).paddingLeft).toBe('4px');
    });
});
