import { sniffImageMime } from '../../../../lib/parsers/image-validator';

/**
 * The MIME types and extensions the file-import addon accepts. Kept in one place
 * so the toolbar picker, the drop predicate, and the drop handler agree.
 */
export const DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PDF_MIME = 'application/pdf';

/** `accept` for the two document formats this addon parses itself. */
export const DOCUMENT_IMPORT_ACCEPT = '.pdf,.docx';

/**
 * `accept` fragment added to the picker when an addon owns image files. The
 * addon never inserts these itself — it hands the `File` to the images addon's
 * pipeline — so the types are only offered while that pipeline is present.
 *
 * Note the asymmetry with drag-and-drop, which stays documents-only: the images
 * addon already claims image drops and pastes directly, and the base dispatches
 * a drop to the first interceptor that claims it — so claiming image drops here
 * too would make the winner depend on directive instantiation order.
 */
export const IMAGE_IMPORT_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp';

/** Bytes that must be read to identify every format the addon accepts. */
export const HEADER_BYTES = 12;

/** A format this addon parses itself. */
export type DocumentImportKind = { readonly type: 'docx' } | { readonly type: 'pdf' };

/** What the magic bytes of a picked file identify it as. */
export type ImportKind = DocumentImportKind | { readonly type: 'image'; readonly mime: string };

/** Whether the first bytes are a ZIP local-file header (`PK\x03\x04`) — a DOCX. */
export function isZipHeader(header: Uint8Array): boolean {
    return header.length >= 4 &&
        header[0] === 0x50 && header[1] === 0x4b &&
        header[2] === 0x03 && header[3] === 0x04;
}

/** Whether the first bytes are a PDF header (`%PDF-`). */
export function isPdfHeader(header: Uint8Array): boolean {
    return header.length >= 5 &&
        header[0] === 0x25 && header[1] === 0x50 &&
        header[2] === 0x44 && header[3] === 0x46 &&
        header[4] === 0x2d;
}

/**
 * Identify a picked file from its first {@link HEADER_BYTES} bytes, or `null`
 * when it is none of the supported formats. The file's own `type` is ignored —
 * it is spoofable and often empty.
 *
 * An `image` result is not something this addon renders — it is the signal to
 * hand the file to the editor's image pipeline instead of parsing it.
 */
export function classifyImport(header: Uint8Array): ImportKind | null {
    if (isZipHeader(header)) return { type: 'docx' };
    if (isPdfHeader(header)) return { type: 'pdf' };
    const mime = sniffImageMime(header);
    return mime ? { type: 'image', mime } : null;
}

/** Whether a dropped/selected file looks like a supported document by type or name. */
export function isSupportedDocumentFile(file: File): boolean {
    return file.type === PDF_MIME || file.type === DOCX_MIME ||
        file.name.endsWith('.pdf') || file.name.endsWith('.docx');
}

/** Cheap FNV-1a content hash used to dedupe injected font stylesheets. */
export function simpleHash(text: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.codePointAt(i) ?? 0;
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}

/**
 * Whether a drag payload carries a supported document, mirroring the former
 * built-in: a drag with no inspectable items is optimistically accepted.
 */
export function dragHasSupportedDocument(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer?.items) return true;
    for (const item of Array.from(dataTransfer.items)) {
        if (item.kind !== 'file') continue;
        if (item.type === PDF_MIME || item.type === DOCX_MIME) return true;
    }
    return false;
}
