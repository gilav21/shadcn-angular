import { describe, expect, it } from 'vitest';
import { isValidImageMagicBytes, isValidImageDataUrl } from './image-validator';

function toBytes(arr: number[]): Uint8Array {
    return new Uint8Array(arr);
}

function toBase64DataUrl(mime: string, bytes: number[]): string {
    const binary = String.fromCharCode(...bytes);
    return `data:${mime};base64,${btoa(binary)}`;
}

describe('isValidImageMagicBytes', () => {
    it('should reject empty bytes', () => {
        expect(isValidImageMagicBytes(new Uint8Array(0))).toBe(false);
    });

    it('should reject bytes shorter than 3', () => {
        expect(isValidImageMagicBytes(toBytes([0xFF, 0xD8]))).toBe(false);
    });

    it('should accept valid JPEG header', () => {
        expect(isValidImageMagicBytes(toBytes([0xFF, 0xD8, 0xFF, 0xE0]))).toBe(true);
    });

    it('should accept valid JPEG with EXIF marker', () => {
        expect(isValidImageMagicBytes(toBytes([0xFF, 0xD8, 0xFF, 0xE1]))).toBe(true);
    });

    it('should accept valid PNG header', () => {
        expect(isValidImageMagicBytes(toBytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))).toBe(true);
    });

    it('should accept valid GIF87a header', () => {
        expect(isValidImageMagicBytes(toBytes([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]))).toBe(true);
    });

    it('should accept valid GIF89a header', () => {
        expect(isValidImageMagicBytes(toBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe(true);
    });

    it('should accept valid WebP header', () => {
        const webp = [
            0x52, 0x49, 0x46, 0x46,
            0x00, 0x00, 0x00, 0x00,
            0x57, 0x45, 0x42, 0x50,
        ];
        expect(isValidImageMagicBytes(toBytes(webp))).toBe(true);
    });

    it('should accept SVG content', () => {
        const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
        expect(isValidImageMagicBytes(svgBytes)).toBe(true);
    });

    it('should accept SVG with XML declaration', () => {
        const svgBytes = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
        expect(isValidImageMagicBytes(svgBytes)).toBe(true);
    });

    it('should accept SVG with leading whitespace', () => {
        const svgBytes = new TextEncoder().encode('  \n  <svg xmlns="http://www.w3.org/2000/svg"></svg>');
        expect(isValidImageMagicBytes(svgBytes)).toBe(true);
    });

    it('should accept SVG with BOM', () => {
        const svgBytes = new TextEncoder().encode('\uFEFF<svg xmlns="http://www.w3.org/2000/svg"></svg>');
        expect(isValidImageMagicBytes(svgBytes)).toBe(true);
    });

    it('should reject EXE file (MZ header)', () => {
        expect(isValidImageMagicBytes(toBytes([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]))).toBe(false);
    });

    it('should reject JavaScript text content', () => {
        const jsBytes = new TextEncoder().encode('const x = 1; function hack() {}');
        expect(isValidImageMagicBytes(jsBytes)).toBe(false);
    });

    it('should reject PDF content', () => {
        const pdfBytes = new TextEncoder().encode('%PDF-1.7');
        expect(isValidImageMagicBytes(pdfBytes)).toBe(false);
    });

    it('should reject ZIP file (PK header)', () => {
        expect(isValidImageMagicBytes(toBytes([0x50, 0x4B, 0x03, 0x04]))).toBe(false);
    });

    it('should reject WASM file', () => {
        expect(isValidImageMagicBytes(toBytes([0x00, 0x61, 0x73, 0x6D]))).toBe(false);
    });

    it('should reject HTML disguised as image', () => {
        const htmlBytes = new TextEncoder().encode('<html><body><script>alert(1)</script></body></html>');
        expect(isValidImageMagicBytes(htmlBytes)).toBe(false);
    });

    it('should reject RIFF file that is not WebP (WAV)', () => {
        const wav = [
            0x52, 0x49, 0x46, 0x46,
            0x00, 0x00, 0x00, 0x00,
            0x57, 0x41, 0x56, 0x45,
        ];
        expect(isValidImageMagicBytes(toBytes(wav))).toBe(false);
    });

    it('should reject RIFF file that is not WebP (AVI)', () => {
        const avi = [
            0x52, 0x49, 0x46, 0x46,
            0x00, 0x00, 0x00, 0x00,
            0x41, 0x56, 0x49, 0x20,
        ];
        expect(isValidImageMagicBytes(toBytes(avi))).toBe(false);
    });

    it('should reject random arbitrary bytes', () => {
        expect(isValidImageMagicBytes(toBytes([0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE]))).toBe(false);
    });
});

describe('isValidImageDataUrl', () => {
    it('should reject non-data URLs', () => {
        expect(isValidImageDataUrl('https://example.com/image.png')).toBe(false);
    });

    it('should reject data URL without image MIME type', () => {
        expect(isValidImageDataUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    });

    it('should reject data URL without base64 marker', () => {
        expect(isValidImageDataUrl('data:image/png,raw-content')).toBe(false);
    });

    it('should accept valid PNG data URL', () => {
        const dataUrl = toBase64DataUrl('image/png', [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
        expect(isValidImageDataUrl(dataUrl)).toBe(true);
    });

    it('should accept valid JPEG data URL', () => {
        const dataUrl = toBase64DataUrl('image/jpeg', [0xFF, 0xD8, 0xFF, 0xE0, 0x00]);
        expect(isValidImageDataUrl(dataUrl)).toBe(true);
    });

    it('should accept valid GIF data URL', () => {
        const dataUrl = toBase64DataUrl('image/gif', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
        expect(isValidImageDataUrl(dataUrl)).toBe(true);
    });

    it('should reject fake PNG data URL with JavaScript content', () => {
        const jsContent = new TextEncoder().encode('const x = 1;');
        const binary = String.fromCharCode(...jsContent);
        const dataUrl = `data:image/png;base64,${btoa(binary)}`;
        expect(isValidImageDataUrl(dataUrl)).toBe(false);
    });

    it('should reject fake PNG data URL with EXE content', () => {
        const dataUrl = toBase64DataUrl('image/png', [0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]);
        expect(isValidImageDataUrl(dataUrl)).toBe(false);
    });

    it('should accept valid SVG data URL', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
        const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
        expect(isValidImageDataUrl(dataUrl)).toBe(true);
    });

    it('should reject data:image/svg+xml with non-SVG content', () => {
        const jsContent = 'const x = 1; function hack() {}';
        const dataUrl = `data:image/svg+xml;base64,${btoa(jsContent)}`;
        expect(isValidImageDataUrl(dataUrl)).toBe(false);
    });

    it('should reject invalid base64 content', () => {
        expect(isValidImageDataUrl('data:image/png;base64,!!!invalid!!!')).toBe(false);
    });

    it('should reject empty base64 content', () => {
        expect(isValidImageDataUrl('data:image/png;base64,')).toBe(false);
    });
});
