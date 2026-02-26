import { describe, expect, it } from 'vitest';
import { parsePdf } from './pdf-parser';

function toBuffer(bytes: number[]): ArrayBuffer {
    return new Uint8Array(bytes).buffer;
}

describe('parsePdf', () => {
    describe('magic byte validation', () => {
        it('should reject an empty buffer', async () => {
            await expect(parsePdf(new ArrayBuffer(0))).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject a buffer shorter than 5 bytes', async () => {
            await expect(parsePdf(toBuffer([0x25, 0x50]))).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject a file with wrong magic bytes', async () => {
            const jsContent = new TextEncoder().encode('const x = 1;');
            await expect(parsePdf(jsContent.buffer)).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject a PNG file', async () => {
            const pngHeader = toBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            await expect(parsePdf(pngHeader)).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject a file starting with %PDF but missing the dash', async () => {
            const almostPdf = new TextEncoder().encode('%PDF1.7');
            await expect(parsePdf(almostPdf.buffer)).rejects.toThrow('Not a valid PDF file.');
        });

        it('should reject an EXE file (MZ header)', async () => {
            const exeHeader = toBuffer([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
            await expect(parsePdf(exeHeader)).rejects.toThrow('Not a valid PDF file.');
        });

        it('should pass magic byte check but fail structure parsing for a fake PDF', async () => {
            const fakePdf = new TextEncoder().encode('%PDF-1.7\nThis is not a real PDF.');
            await expect(parsePdf(fakePdf.buffer)).rejects.toThrow(
                'Unable to read this PDF. It may be corrupted or use an unsupported format.'
            );
        });
    });
});
