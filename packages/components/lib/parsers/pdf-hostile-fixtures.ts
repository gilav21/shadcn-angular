// Shared test fixture: a PDF whose font name and link targets are hostile.
// NOT a registry component; test scaffolding for the PDF parser specs.
import { TAG_BREAKOUT } from './inert-markup-fixtures';
import { PdfBuilder } from './pdf-test-fixtures';

/** A PDF name token for arbitrary text: everything but letters and digits as `#xx`. */
export function pdfName(text: string): string {
    return Array.from(new TextEncoder().encode(text), (byte) => {
        const ch = String.fromCodePoint(byte);
        return /[A-Za-z\d]/.test(ch) ? ch : `#${byte.toString(16).padStart(2, '0')}`;
    }).join('');
}

export const HOSTILE_PDF_TEXT = 'Hostile run';
export const SAFE_LINK_URI = 'https://example.com/ok';

/**
 * Body text in Helvetica, one run in a font whose `/BaseFont` decodes to
 * {@link TAG_BREAKOUT}, an unsafe `javascript:` link and a safe `https:` link.
 */
export function hostilePdf(): ArrayBuffer {
    return new PdfBuilder()
        .addFont('F1', 'Helvetica')
        .addFont('F2', pdfName(TAG_BREAKOUT))
        .setContent(
            'BT /F1 12 Tf 100 700 Td (Body text of the page runs here) Tj '
            + '0 -20 Td (and carries on with more body text) Tj '
            + `0 -20 Td /F2 12 Tf (${HOSTILE_PDF_TEXT}) Tj `
            + '0 -20 Td /F1 12 Tf (Unsafe link) Tj '
            + '0 -20 Td (Safe link) Tj ET')
        .addLinkAnnotation(0, [95, 635, 200, 655], 'javascript:alert(2)')
        .addLinkAnnotation(0, [95, 615, 200, 635], SAFE_LINK_URI)
        .build();
}
