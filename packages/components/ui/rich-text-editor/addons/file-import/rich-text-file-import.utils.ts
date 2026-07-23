/**
 * The MIME types and extensions the file-import addon accepts. Kept in one place
 * so the toolbar picker, the drop predicate, and the drop handler agree.
 */
export const DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PDF_MIME = 'application/pdf';

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
