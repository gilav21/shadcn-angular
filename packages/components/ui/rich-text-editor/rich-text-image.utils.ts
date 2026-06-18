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
