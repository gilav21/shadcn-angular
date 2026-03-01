import { listZipEntries } from './zip-reader';

export type FileViewerType = 'image' | 'pdf' | 'xlsx' | 'docx' | 'pptx' | 'text' | 'video' | 'audio' | 'unknown';

export interface FileTypeResult {
    readonly type: FileViewerType;
    readonly mimeType: string;
    readonly extension: string;
}

const HEADER_READ_SIZE = 4096;

function matchBytes(data: Uint8Array, offset: number, expected: number[]): boolean {
    if (data.length < offset + expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
        if (data[offset + i] !== expected[i]) return false;
    }
    return true;
}

function detectPdf(data: Uint8Array): FileTypeResult | null {
    if (matchBytes(data, 0, [0x25, 0x50, 0x44, 0x46, 0x2D])) {
        return { type: 'pdf', mimeType: 'application/pdf', extension: 'pdf' };
    }
    return null;
}

function detectImageFormat(data: Uint8Array): FileTypeResult | null {
    if (matchBytes(data, 0, [0xFF, 0xD8, 0xFF])) {
        return { type: 'image', mimeType: 'image/jpeg', extension: 'jpg' };
    }
    if (matchBytes(data, 0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
        return { type: 'image', mimeType: 'image/png', extension: 'png' };
    }
    if (matchBytes(data, 0, [0x47, 0x49, 0x46, 0x38])) {
        return { type: 'image', mimeType: 'image/gif', extension: 'gif' };
    }
    if (matchBytes(data, 0, [0x42, 0x4D])) {
        return { type: 'image', mimeType: 'image/bmp', extension: 'bmp' };
    }
    if (matchBytes(data, 0, [0x00, 0x00, 0x01, 0x00])) {
        return { type: 'image', mimeType: 'image/x-icon', extension: 'ico' };
    }
    if (matchBytes(data, 0, [0x49, 0x49, 0x2A, 0x00]) || matchBytes(data, 0, [0x4D, 0x4D, 0x00, 0x2A])) {
        return { type: 'image', mimeType: 'image/tiff', extension: 'tiff' };
    }
    if (isWebp(data)) {
        return { type: 'image', mimeType: 'image/webp', extension: 'webp' };
    }
    if (isAvif(data)) {
        return { type: 'image', mimeType: 'image/avif', extension: 'avif' };
    }
    if (isSvg(data)) {
        return { type: 'image', mimeType: 'image/svg+xml', extension: 'svg' };
    }
    return null;
}

function isWebp(data: Uint8Array): boolean {
    return data.length >= 12 &&
        matchBytes(data, 0, [0x52, 0x49, 0x46, 0x46]) &&
        matchBytes(data, 8, [0x57, 0x45, 0x42, 0x50]);
}

function isAvif(data: Uint8Array): boolean {
    if (data.length < 12) return false;
    const text = new TextDecoder('ascii').decode(data.subarray(4, 12));
    return text.includes('ftyp') && (text.includes('avif') || text.includes('avis'));
}

function isSvg(data: Uint8Array): boolean {
    let offset = 0;
    if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
        offset = 3;
    }
    const length = Math.min(data.length, 256);
    let text = '';
    for (let i = offset; i < length; i++) {
        text += String.fromCharCode(data[i]);
    }
    const trimmed = text.trimStart().toLowerCase();
    return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml');
}

function detectVideo(data: Uint8Array): FileTypeResult | null {
    if (isMp4(data)) {
        return { type: 'video', mimeType: 'video/mp4', extension: 'mp4' };
    }
    if (matchBytes(data, 0, [0x1A, 0x45, 0xDF, 0xA3])) {
        return { type: 'video', mimeType: 'video/webm', extension: 'webm' };
    }
    return null;
}

function isMp4(data: Uint8Array): boolean {
    if (data.length < 8) return false;
    const ftypText = new TextDecoder('ascii').decode(data.subarray(4, 8));
    return ftypText === 'ftyp';
}

function detectAudio(data: Uint8Array): FileTypeResult | null {
    if (matchBytes(data, 0, [0xFF, 0xFB]) || matchBytes(data, 0, [0xFF, 0xF3]) || matchBytes(data, 0, [0xFF, 0xF2])) {
        return { type: 'audio', mimeType: 'audio/mpeg', extension: 'mp3' };
    }
    if (matchBytes(data, 0, [0x49, 0x44, 0x33])) {
        return { type: 'audio', mimeType: 'audio/mpeg', extension: 'mp3' };
    }
    if (data.length >= 12 &&
        matchBytes(data, 0, [0x52, 0x49, 0x46, 0x46]) &&
        matchBytes(data, 8, [0x57, 0x41, 0x56, 0x45])) {
        return { type: 'audio', mimeType: 'audio/wav', extension: 'wav' };
    }
    if (matchBytes(data, 0, [0x4F, 0x67, 0x67, 0x53])) {
        return { type: 'audio', mimeType: 'audio/ogg', extension: 'ogg' };
    }
    return null;
}

function detectZipBased(data: Uint8Array): FileTypeResult | null {
    if (!matchBytes(data, 0, [0x50, 0x4B, 0x03, 0x04])) return null;

    try {
        const entries = listZipEntries(data);
        const paths = new Set(entries.map(e => e.path));

        if (paths.has('word/document.xml')) {
            return { type: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' };
        }
        if (paths.has('xl/workbook.xml')) {
            return { type: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
        }
        if (paths.has('ppt/presentation.xml')) {
            return { type: 'pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx' };
        }
    } catch {
        return null;
    }

    return null;
}

function isTextContent(data: Uint8Array): boolean {
    const checkLen = Math.min(data.length, 512);
    if (checkLen === 0) return false;

    let printable = 0;
    for (let i = 0; i < checkLen; i++) {
        const byte = data[i];
        if (byte === 0x00) return false;
        if ((byte >= 0x20 && byte <= 0x7E) || byte === 0x09 || byte === 0x0A || byte === 0x0D) {
            printable++;
        }
    }

    return (printable / checkLen) > 0.85;
}

export function detectFileType(bytes: Uint8Array): FileTypeResult {
    if (bytes.length === 0) {
        return { type: 'unknown', mimeType: 'application/octet-stream', extension: '' };
    }

    const pdf = detectPdf(bytes);
    if (pdf) return pdf;

    const image = detectImageFormat(bytes);
    if (image) return image;

    const video = detectVideo(bytes);
    if (video) return video;

    const audio = detectAudio(bytes);
    if (audio) return audio;

    const zip = detectZipBased(bytes);
    if (zip) return zip;

    if (isTextContent(bytes)) {
        return { type: 'text', mimeType: 'text/plain', extension: 'txt' };
    }

    return { type: 'unknown', mimeType: 'application/octet-stream', extension: '' };
}

export async function detectFileTypeFromFile(file: File | Blob): Promise<FileTypeResult> {
    const slice = file.slice(0, HEADER_READ_SIZE);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const result = detectFileType(bytes);

    if (result.type === 'unknown' && file instanceof File && file.name) {
        return detectFromExtension(file.name);
    }

    return result;
}

function detectFromExtension(filename: string): FileTypeResult {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, FileTypeResult> = {
        pdf: { type: 'pdf', mimeType: 'application/pdf', extension: 'pdf' },
        jpg: { type: 'image', mimeType: 'image/jpeg', extension: 'jpg' },
        jpeg: { type: 'image', mimeType: 'image/jpeg', extension: 'jpeg' },
        png: { type: 'image', mimeType: 'image/png', extension: 'png' },
        gif: { type: 'image', mimeType: 'image/gif', extension: 'gif' },
        webp: { type: 'image', mimeType: 'image/webp', extension: 'webp' },
        svg: { type: 'image', mimeType: 'image/svg+xml', extension: 'svg' },
        bmp: { type: 'image', mimeType: 'image/bmp', extension: 'bmp' },
        avif: { type: 'image', mimeType: 'image/avif', extension: 'avif' },
        xlsx: { type: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
        docx: { type: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
        pptx: { type: 'pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx' },
        mp4: { type: 'video', mimeType: 'video/mp4', extension: 'mp4' },
        webm: { type: 'video', mimeType: 'video/webm', extension: 'webm' },
        mp3: { type: 'audio', mimeType: 'audio/mpeg', extension: 'mp3' },
        wav: { type: 'audio', mimeType: 'audio/wav', extension: 'wav' },
        ogg: { type: 'audio', mimeType: 'audio/ogg', extension: 'ogg' },
        txt: { type: 'text', mimeType: 'text/plain', extension: 'txt' },
        json: { type: 'text', mimeType: 'application/json', extension: 'json' },
        xml: { type: 'text', mimeType: 'application/xml', extension: 'xml' },
        csv: { type: 'text', mimeType: 'text/csv', extension: 'csv' },
        html: { type: 'text', mimeType: 'text/html', extension: 'html' },
        css: { type: 'text', mimeType: 'text/css', extension: 'css' },
        js: { type: 'text', mimeType: 'text/javascript', extension: 'js' },
        ts: { type: 'text', mimeType: 'text/typescript', extension: 'ts' },
        md: { type: 'text', mimeType: 'text/markdown', extension: 'md' },
    };
    return map[ext] ?? { type: 'unknown', mimeType: 'application/octet-stream', extension: '' };
}
