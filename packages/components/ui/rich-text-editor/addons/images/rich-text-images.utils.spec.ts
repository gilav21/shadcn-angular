import { describe, it, expect, vi } from 'vitest';
import {
    applyImageAlignment,
    parseImageSize,
    createImageElement,
    placeImageAtSelection,
    dataUrlToFile,
    readFileAsDataUrl,
    TRANSPARENT_PIXEL,
    type ImageInsertDefaults,
} from './rich-text-images.utils';

describe('rich-text-images.utils', () => {
    describe('applyImageAlignment', () => {
        it('sets inline display and zero margin for inline', () => {
            const img = document.createElement('img');
            applyImageAlignment(img, 'inline');
            expect(img.style.display).toBe('inline');
            expect(img.style.margin).toBe('0px');
        });

        it('floats left with margins for left', () => {
            const img = document.createElement('img');
            applyImageAlignment(img, 'left');
            expect(img.style.display).toBe('block');
            expect(img.style.float).toBe('left');
            expect(img.style.marginRight).toBe('12px');
            expect(img.style.marginBottom).toBe('4px');
        });

        it('centers with auto side margins for center', () => {
            const img = document.createElement('img');
            applyImageAlignment(img, 'center');
            expect(img.style.display).toBe('block');
            expect(img.style.marginLeft).toBe('auto');
            expect(img.style.marginRight).toBe('auto');
        });

        it('floats right with margins for right', () => {
            const img = document.createElement('img');
            applyImageAlignment(img, 'right');
            expect(img.style.display).toBe('block');
            expect(img.style.float).toBe('right');
            expect(img.style.marginLeft).toBe('12px');
            expect(img.style.marginBottom).toBe('4px');
        });

        it('clears prior styles when switching alignment', () => {
            const img = document.createElement('img');
            applyImageAlignment(img, 'left');
            applyImageAlignment(img, 'inline');
            expect(img.style.float).toBe('');
            expect(img.style.display).toBe('inline');
        });
    });

    describe('parseImageSize', () => {
        it('treats a number as pixels', () => {
            expect(parseImageSize(320)).toBe('320px');
        });

        it('passes a string through unchanged', () => {
            expect(parseImageSize('50%')).toBe('50%');
        });
    });

    describe('createImageElement', () => {
        const base: ImageInsertDefaults = { alignment: 'inline' };

        it('sets src and alt', () => {
            const img = createImageElement(document, 'https://x/y.png', 'A picture', base);
            expect(img.getAttribute('src')).toBe('https://x/y.png');
            expect(img.getAttribute('alt')).toBe('A picture');
        });

        it('falls back to a default alt when none is given', () => {
            const img = createImageElement(document, 'https://x/y.png', '', base);
            expect(img.getAttribute('alt')).toBe('Image');
        });

        it('applies default width and height when provided', () => {
            const img = createImageElement(document, 'src', 'a', { width: 100, height: '5rem', alignment: 'center' });
            expect(img.style.width).toBe('100px');
            expect(img.style.height).toBe('5rem');
            expect(img.dataset['align']).toBe('center');
            expect(img.style.display).toBe('block');
        });

        it('omits width and height when the defaults are undefined', () => {
            const img = createImageElement(document, 'src', 'a', base);
            expect(img.style.width).toBe('');
            expect(img.style.height).toBe('');
        });
    });

    describe('placeImageAtSelection', () => {
        function makeRoot(): HTMLElement {
            const root = document.createElement('div');
            root.innerHTML = '<p>text</p>';
            document.body.appendChild(root);
            return root;
        }

        it('appends the image when there is no selection range', () => {
            const root = makeRoot();
            document.getSelection()?.removeAllRanges();
            const img = document.createElement('img');
            placeImageAtSelection(document, root, img);
            expect(root.contains(img)).toBe(true);
            root.remove();
        });

        it('inserts at the caret inside the root and moves the caret after the image', () => {
            const root = document.createElement('div');
            root.innerHTML = '<p>Hello world</p>';
            document.body.appendChild(root);
            const p = root.querySelector('p')!;
            const range = document.createRange();
            range.setStart(p.firstChild!, 'Hello '.length);
            range.collapse(true);
            const sel = document.getSelection()!;
            sel.removeAllRanges();
            sel.addRange(range);

            const img = document.createElement('img');
            placeImageAtSelection(document, root, img);

            expect(p.innerHTML).toBe('Hello <img>world');
            const caret = sel.getRangeAt(0);
            expect(caret.collapsed).toBe(true);
            expect(caret.startContainer).toBe(p);
            expect(caret.startOffset).toBe(Array.from(p.childNodes).indexOf(img) + 1);
            root.remove();
        });

        it('appends when the selection sits outside the root', () => {
            const root = makeRoot();
            const outside = document.createElement('div');
            outside.textContent = 'elsewhere';
            document.body.appendChild(outside);
            const range = document.createRange();
            range.selectNodeContents(outside);
            const sel = document.getSelection()!;
            sel.removeAllRanges();
            sel.addRange(range);

            const img = document.createElement('img');
            placeImageAtSelection(document, root, img);
            expect(root.lastElementChild).toBe(img);
            root.remove();
            outside.remove();
        });
    });

    describe('dataUrlToFile', () => {
        it('decodes a base64 data URL into a File with the parsed MIME type', async () => {
            const file = dataUrlToFile(TRANSPARENT_PIXEL, 'pixel.gif');
            expect(file.name).toBe('pixel.gif');
            expect(file.type).toBe('image/gif');
            // Re-encoding the file must give back the source URL byte for byte.
            // FileReader rather than file.arrayBuffer(): jsdom has no Blob.arrayBuffer.
            expect(await readFileAsDataUrl(file)).toBe(TRANSPARENT_PIXEL);
        });

        it('defaults to image/png when the MIME type cannot be parsed', () => {
            const file = dataUrlToFile('nomime,QUJD', 'x.bin');
            expect(file.type).toBe('image/png');
        });
    });

    describe('readFileAsDataUrl', () => {
        it('resolves with the data URL for a readable file', async () => {
            const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
            const url = await readFileAsDataUrl(file);
            expect(url.startsWith('data:')).toBe(true);
        });

        it('resolves with an empty string when the reader yields a non-string result', async () => {
            const reader = {
                result: new ArrayBuffer(0) as unknown,
                onload: null as null | (() => void),
                onerror: null as null | (() => void),
                readAsDataURL(): void { this.onload?.(); },
            };
            const spy = vi.spyOn(globalThis, 'FileReader')
                .mockImplementation(function (): FileReader { return reader as unknown as FileReader; });
            const url = await readFileAsDataUrl(new File(['x'], 'x.txt'));
            expect(url).toBe('');
            spy.mockRestore();
        });

        it('rejects when the reader errors', async () => {
            const reader = {
                result: null as unknown,
                onload: null as null | (() => void),
                onerror: null as null | (() => void),
                readAsDataURL(): void { this.onerror?.(); },
            };
            const spy = vi.spyOn(globalThis, 'FileReader')
                .mockImplementation(function (): FileReader { return reader as unknown as FileReader; });
            await expect(readFileAsDataUrl(new File(['x'], 'x.txt'))).rejects.toThrow('Could not read image file.');
            spy.mockRestore();
        });
    });
});
