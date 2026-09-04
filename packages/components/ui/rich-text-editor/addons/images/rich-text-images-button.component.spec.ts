import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

const LOCALE_EN = RICH_TEXT_IMAGES_LOCALES['en'];

/** jsdom lacks the Popover API the popover trigger toggles. */
type PopoverProto = {
    showPopover?: () => void;
    hidePopover?: () => void;
    togglePopover?: () => void;
};
const proto = HTMLElement.prototype as unknown as PopoverProto;

/**
 * Whether THIS suite added the Popover API, decided at install time rather than
 * at module load. `HTMLElement.prototype` is shared with every other spec file
 * in the run, so a module-load reading can record "absent" while another suite
 * has it temporarily removed — and the teardown would then delete the native
 * implementation for everything that follows. Only remove what we added.
 */
let addedPopoverApi = false;

beforeEach(() => {
    addedPopoverApi = !('showPopover' in proto);
    proto.showPopover ??= (): void => { /* no-op */ };
    proto.hidePopover ??= (): void => { /* no-op */ };
    proto.togglePopover ??= (): void => { /* no-op */ };
});

afterEach(() => {
    if (addedPopoverApi) {
        delete proto.showPopover;
        delete proto.hidePopover;
        delete proto.togglePopover;
        addedPopoverApi = false;
    }
});

interface ButtonInternals {
    onOpenChange(next: boolean): void;
    onInsertUrl(src: string, alt: string): void;
    onFileSelected(event: Event): void;
    readonly open: () => boolean;
    readonly showUrl: () => boolean;
    readonly showUpload: () => boolean;
    readonly locale: () => typeof LOCALE_EN;
}

describe('RichTextImagesButtonComponent', () => {
    const disabled = signal(false);
    const readonly = signal(false);
    const compact = signal(false);
    const sources = signal<RichTextImageSources>('all');
    const onOpen = vi.fn<() => void>();
    const onInsertUrl = vi.fn<(url: string, alt: string) => void>();
    const onUploadFile = vi.fn<(file: File) => void>();

    const context: RichTextImagesButtonContext = {
        locale: signal(LOCALE_EN),
        sources,
        onOpen,
        onInsertUrl,
        onUploadFile,
    };

    let fixture: ComponentFixture<RichTextImagesButtonComponent>;
    let internals: ButtonInternals;

    async function setup(withToolbarView = false): Promise<void> {
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            imports: [RichTextImagesButtonComponent],
            providers: [
                { provide: RichTextEditorAddonHost, useValue: { disabled, isDisabled: disabled, readonly } },
                { provide: RICH_TEXT_IMAGES_BUTTON_CONTEXT, useValue: context },
                ...(withToolbarView ? [{ provide: RichTextToolbarViewContext, useValue: { compact } }] : []),
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextImagesButtonComponent);
        internals = fixture.componentInstance as unknown as ButtonInternals;
        fixture.detectChanges();
    }

    beforeEach(() => {
        disabled.set(false);
        readonly.set(false);
        compact.set(false);
        sources.set('all');
        onOpen.mockReset();
        onInsertUrl.mockReset();
        onUploadFile.mockReset();
    });

    it('renders the trigger button with the localized tooltip', async () => {
        await setup();
        const button = (fixture.nativeElement as HTMLElement)
            .querySelector<HTMLButtonElement>('[data-slot="rte-images-button"]');
        expect(button?.getAttribute('title')).toBe(LOCALE_EN.tooltip);
    });

    it('exposes both URL and upload sources by default', async () => {
        await setup();
        expect(internals.showUrl()).toBe(true);
        expect(internals.showUpload()).toBe(true);
    });

    it('hides the URL form when sources is upload-only', async () => {
        await setup();
        sources.set('upload');
        fixture.detectChanges();
        expect(internals.showUrl()).toBe(false);
        expect(internals.showUpload()).toBe(true);
    });

    it('hides the upload control when sources is url-only', async () => {
        await setup();
        sources.set('url');
        fixture.detectChanges();
        expect(internals.showUrl()).toBe(true);
        expect(internals.showUpload()).toBe(false);
    });

    it('saves the selection and opens on open change', async () => {
        await setup();
        internals.onOpenChange(true);
        expect(onOpen).toHaveBeenCalledTimes(1);
        expect(internals.open()).toBe(true);
    });

    it('does not save the selection when closing', async () => {
        await setup();
        internals.onOpenChange(false);
        expect(onOpen).not.toHaveBeenCalled();
        expect(internals.open()).toBe(false);
    });

    it('inserts a URL and closes the popover', async () => {
        await setup();
        internals.onOpenChange(true);
        internals.onInsertUrl('https://x/y.png', 'alt');
        expect(onInsertUrl).toHaveBeenCalledWith('https://x/y.png', 'alt');
        expect(internals.open()).toBe(false);
    });

    it('ignores an empty URL', async () => {
        await setup();
        internals.onInsertUrl('', 'alt');
        expect(onInsertUrl).not.toHaveBeenCalled();
    });

    it('ignores URL insert while interaction is disabled', async () => {
        await setup();
        disabled.set(true);
        fixture.detectChanges();
        internals.onInsertUrl('https://x/y.png', 'alt');
        expect(onInsertUrl).not.toHaveBeenCalled();
    });

    it('uploads a chosen file, closes, and clears the input value', async () => {
        await setup();
        const input = document.createElement('input');
        input.type = 'file';
        const file = new File(['x'], 'p.png', { type: 'image/png' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.value = '';
        internals.onOpenChange(true);
        internals.onFileSelected({ target: input } as unknown as Event);
        expect(onUploadFile).toHaveBeenCalledWith(file);
        expect(internals.open()).toBe(false);
    });

    it('ignores a file change with no file', async () => {
        await setup();
        const input = document.createElement('input');
        Object.defineProperty(input, 'files', { value: [], configurable: true });
        internals.onFileSelected({ target: input } as unknown as Event);
        expect(onUploadFile).not.toHaveBeenCalled();
    });

    it('ignores a file change while interaction is disabled', async () => {
        await setup();
        readonly.set(true);
        fixture.detectChanges();
        const input = document.createElement('input');
        const file = new File(['x'], 'p.png', { type: 'image/png' });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        internals.onFileSelected({ target: input } as unknown as Event);
        expect(onUploadFile).not.toHaveBeenCalled();
    });

    it('uses compact padding inside a compact toolbar', async () => {
        compact.set(true);
        await setup(true);
        const button = (fixture.nativeElement as HTMLElement)
            .querySelector<HTMLButtonElement>('[data-slot="rte-images-button"]');
        expect(button?.className).toContain('p-1');
    });
});
