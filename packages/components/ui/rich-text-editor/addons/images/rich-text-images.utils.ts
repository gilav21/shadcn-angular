/**
 * Horizontal alignment mode for images inside the editor.
 *
 * - `'inline'` — Image flows inline with surrounding text (default).
 * - `'left'` — Image floats to the left, text wraps around it.
 * - `'center'` — Image is centered as a block element.
 * - `'right'` — Image floats to the right, text wraps around it.
 */
export type ImageAlignment = 'inline' | 'left' | 'center' | 'right';

/**
 * Apply the inline styles for a given alignment to an image element. Shared by
 * the resizer overlay and the editor's insert path so both produce identical
 * markup.
 */
export function applyImageAlignment(img: HTMLImageElement, align: ImageAlignment): void {
    img.style.removeProperty('float');
    img.style.removeProperty('display');
    img.style.removeProperty('margin');
    img.style.removeProperty('margin-left');
    img.style.removeProperty('margin-right');

    switch (align) {
        case 'inline':
            img.style.display = 'inline';
            img.style.margin = '0';
            break;
        case 'left':
            img.style.display = 'block';
            img.style.float = 'left';
            img.style.marginRight = '12px';
            img.style.marginBottom = '4px';
            break;
        case 'center':
            img.style.display = 'block';
            img.style.marginLeft = 'auto';
            img.style.marginRight = 'auto';
            break;
        case 'right':
            img.style.display = 'block';
            img.style.float = 'right';
            img.style.marginLeft = '12px';
            img.style.marginBottom = '4px';
            break;
    }
}

/**
 * Normalize an image size input into a CSS dimension string. A `number` is
 * treated as pixels; a `string` is passed through unchanged (e.g. `'50%'`,
 * `'20rem'`).
 */
export function parseImageSize(value: number | string): string {
    return typeof value === 'number' ? `${value}px` : value;
}

/** A 1×1 transparent GIF used as the placeholder src while an image uploads. */
export const TRANSPARENT_PIXEL =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Defaults applied to every inserted image. */
export interface ImageInsertDefaults {
    readonly width?: number | string;
    readonly height?: number | string;
    readonly alignment: ImageAlignment;
}

/**
 * Create an `<img>` for insertion, applying the configured default width,
 * height and alignment. Mirrors the editor's former built-in insert path so
 * inserted markup is identical.
 */
export function createImageElement(
    doc: Document,
    src: string,
    alt: string,
    defaults: ImageInsertDefaults,
): HTMLImageElement {
    const img = doc.createElement('img');
    img.setAttribute('src', src);
    img.setAttribute('alt', alt || 'Image');
    if (defaults.width !== undefined) {
        img.style.width = parseImageSize(defaults.width);
    }
    if (defaults.height !== undefined) {
        img.style.height = parseImageSize(defaults.height);
    }
    img.dataset['align'] = defaults.alignment;
    applyImageAlignment(img, defaults.alignment);
    return img;
}

/**
 * Insert `img` at the current selection inside `root`, falling back to
 * appending it when the selection sits outside the editor. Places the caret
 * after the image. Mirrors the editor's former `insertImageAtSelection`.
 */
export function placeImageAtSelection(doc: Document, root: HTMLElement, img: HTMLImageElement): void {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
        root.appendChild(img);
        return;
    }
    const range = selection.getRangeAt(0);
    if (root.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(img);
    } else {
        root.appendChild(img);
    }
    const after = doc.createRange();
    after.setStartAfter(img);
    after.collapse(true);
    selection.removeAllRanges();
    selection.addRange(after);
}

/** Turn a base64 data URL into a `File` for the upload callback. */
export function dataUrlToFile(dataUrl: string, filename: string): File {
    const [meta, base64] = dataUrl.split(',');
    const mime = /:([^;]{0,4096});/.exec(meta)?.[1] ?? 'image/png';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.codePointAt(i) ?? 0;
    }
    return new File([bytes], filename, { type: mime });
}

/** Read a `File` as a data URL, rejecting if it cannot be read. */
export function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.readAsDataURL(file);
    });
}
