import { describe, it, expect } from 'vitest';
import {
    DOCX_MIME,
    PDF_MIME,
    isZipHeader,
    isPdfHeader,
    isSupportedDocumentFile,
    dragHasSupportedDocument,
} from './rich-text-file-import.utils';

describe('rich-text-file-import.utils', () => {
    describe('isZipHeader', () => {
        it('accepts a PK\\x03\\x04 local-file header', () => {
            expect(isZipHeader(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
        });

        it('rejects a header shorter than four bytes', () => {
            expect(isZipHeader(new Uint8Array([0x50, 0x4b, 0x03]))).toBe(false);
        });

        it('rejects bytes that are not the ZIP signature', () => {
            expect(isZipHeader(new Uint8Array([0x50, 0x4b, 0x05, 0x06]))).toBe(false);
        });
    });

    describe('isPdfHeader', () => {
        it('accepts the %PDF- magic bytes', () => {
            expect(isPdfHeader(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
        });

        it('rejects a header shorter than five bytes', () => {
            expect(isPdfHeader(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false);
        });

        it('rejects non-PDF leading bytes', () => {
            expect(isPdfHeader(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x20]))).toBe(false);
        });
    });

    describe('isSupportedDocumentFile', () => {
        it('accepts a file with the PDF MIME type', () => {
            expect(isSupportedDocumentFile(new File([], 'x', { type: PDF_MIME }))).toBe(true);
        });

        it('accepts a file with the DOCX MIME type', () => {
            expect(isSupportedDocumentFile(new File([], 'x', { type: DOCX_MIME }))).toBe(true);
        });

        it('accepts a .pdf extension when the MIME type is missing', () => {
            expect(isSupportedDocumentFile(new File([], 'doc.pdf'))).toBe(true);
        });

        it('accepts a .docx extension when the MIME type is missing', () => {
            expect(isSupportedDocumentFile(new File([], 'doc.docx'))).toBe(true);
        });

        it('rejects an unrelated file', () => {
            expect(isSupportedDocumentFile(new File([], 'note.txt', { type: 'text/plain' }))).toBe(false);
        });
    });

    describe('dragHasSupportedDocument', () => {
        function dataTransfer(items: Array<{ kind: string; type: string }> | null): DataTransfer {
            return { items } as unknown as DataTransfer;
        }

        it('optimistically accepts a payload with no dataTransfer', () => {
            expect(dragHasSupportedDocument(null)).toBe(true);
        });

        it('optimistically accepts a payload with no items', () => {
            expect(dragHasSupportedDocument(dataTransfer(null))).toBe(true);
        });

        it('accepts when a file item carries the PDF MIME type', () => {
            expect(dragHasSupportedDocument(dataTransfer([{ kind: 'file', type: PDF_MIME }]))).toBe(true);
        });

        it('accepts when a file item carries the DOCX MIME type', () => {
            expect(dragHasSupportedDocument(dataTransfer([{ kind: 'file', type: DOCX_MIME }]))).toBe(true);
        });

        it('ignores non-file items and rejects when none match', () => {
            expect(dragHasSupportedDocument(dataTransfer([
                { kind: 'string', type: PDF_MIME },
                { kind: 'file', type: 'image/png' },
            ]))).toBe(false);
        });
    });
});
