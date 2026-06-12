import { describe, expect, it } from 'vitest';
import { detectFileType, detectFileTypeFromFile } from './file-type-detector';

function bytes(...n: number[]): Uint8Array<ArrayBuffer> {
    return new Uint8Array(n);
}

function ascii(s: string): number[] {
    return Array.from(new TextEncoder().encode(s));
}

function padTo(arr: number[], len: number): Uint8Array {
    const out = new Uint8Array(len);
    out.set(arr.slice(0, len));
    return out;
}

// --- STORED ZIP builder with correct CRC32 (mirrors docx-parser.spec) ---

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): number[] { return [n & 0xff, (n >>> 8) & 0xff]; }
function u32(n: number): number[] { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }

function makeZip(files: ReadonlyArray<{ name: string; content: string }>): Uint8Array {
    const enc = new TextEncoder();
    const entries = files.map(f => ({ name: f.name, data: enc.encode(f.content) }));
    const local: number[] = [];
    const central: number[] = [];
    const offsets: number[] = [];
    let offset = 0;
    for (const e of entries) {
        const nb = enc.encode(e.name);
        const crc = crc32(e.data);
        offsets.push(offset);
        const chunk = [
            ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
            ...u32(crc), ...u32(e.data.length), ...u32(e.data.length),
            ...u16(nb.length), ...u16(0), ...nb, ...e.data,
        ];
        local.push(...chunk);
        offset += chunk.length;
    }
    const centralStart = offset;
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const nb = enc.encode(e.name);
        central.push(
            ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
            ...u32(crc32(e.data)), ...u32(e.data.length), ...u32(e.data.length),
            ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
            ...u32(offsets[i]), ...nb,
        );
    }
    const eocd = [
        ...u32(0x06054b50), ...u16(0), ...u16(0),
        ...u16(entries.length), ...u16(entries.length),
        ...u32(central.length), ...u32(centralStart), ...u16(0),
    ];
    return new Uint8Array([...local, ...central, ...eocd]);
}

// --- OLE2 (CFB) builder: header + one FAT sector + one directory sector ---
// 512-byte sectors. Directory holds a single named stream entry.
function makeOle2(streamName: string): Uint8Array {
    const SECTOR = 512;
    const data = new Uint8Array(SECTOR * 3); // header + 2 sectors
    const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    data.set(magic, 0);
    const dv = new DataView(data.buffer);
    dv.setUint16(30, 9, true);        // sector size = 2^9 = 512
    dv.setUint32(48, 0, true);        // first directory sector index = 0
    // Directory sector starts at byte 512 + 0*512 = 512.
    const dirBase = 512;
    // Entry 0 at dirBase: write the UTF-16LE name.
    const nameUtf16: number[] = [];
    for (const ch of streamName) nameUtf16.push(ch.codePointAt(0)!, 0);
    nameUtf16.push(0, 0); // null terminator
    for (let i = 0; i < nameUtf16.length; i++) data[dirBase + i] = nameUtf16[i];
    dv.setUint16(dirBase + 64, nameUtf16.length, true); // name length in bytes (incl. terminator)
    return data;
}

describe('detectFileType — documents & images by magic bytes', () => {
    it('detects PDF from %PDF- header', () => {
        const r = detectFileType(padTo(ascii('%PDF-1.7\n'), 16));
        expect(r.type).toBe('pdf');
        expect(r.mimeType).toBe('application/pdf');
        expect(r.extension).toBe('pdf');
    });

    it('detects JPEG from FF D8 FF', () => {
        const r = detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0));
        expect(r).toMatchObject({ type: 'image', mimeType: 'image/jpeg', extension: 'jpg' });
    });

    it('detects PNG from its 8-byte signature', () => {
        const r = detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0));
        expect(r).toMatchObject({ type: 'image', mimeType: 'image/png', extension: 'png' });
    });

    it('detects GIF from GIF8', () => {
        const r = detectFileType(bytes(...ascii('GIF89a')));
        expect(r).toMatchObject({ type: 'image', extension: 'gif' });
    });

    it('detects BMP from BM', () => {
        expect(detectFileType(bytes(0x42, 0x4d, 1, 2, 3, 4)).extension).toBe('bmp');
    });

    it('detects ICO from 00 00 01 00', () => {
        expect(detectFileType(bytes(0x00, 0x00, 0x01, 0x00, 0, 0)).extension).toBe('ico');
    });

    it('detects TIFF little-endian (II*) and big-endian (MM*)', () => {
        expect(detectFileType(bytes(0x49, 0x49, 0x2a, 0x00)).extension).toBe('tiff');
        expect(detectFileType(bytes(0x4d, 0x4d, 0x00, 0x2a)).extension).toBe('tiff');
    });

    it('detects WEBP from RIFF....WEBP', () => {
        const r = detectFileType(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')));
        expect(r).toMatchObject({ type: 'image', extension: 'webp' });
    });

    it('detects AVIF from ftyp + avif brand', () => {
        const r = detectFileType(bytes(0, 0, 0, 0, ...ascii('ftypavif'), 0, 0, 0, 0));
        expect(r).toMatchObject({ type: 'image', extension: 'avif' });
    });

    it('detects SVG from a leading <svg tag', () => {
        const r = detectFileType(new TextEncoder().encode('   <svg xmlns="http://www.w3.org/2000/svg"></svg>'));
        expect(r).toMatchObject({ type: 'image', extension: 'svg' });
    });

    it('detects SVG behind a UTF-8 BOM and xml prolog', () => {
        const body = new TextEncoder().encode('<?xml version="1.0"?><svg></svg>');
        const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...body]);
        expect(detectFileType(withBom).extension).toBe('svg');
    });
});

describe('detectFileType — video & audio', () => {
    it('detects MP4 from ftyp box', () => {
        const r = detectFileType(bytes(0, 0, 0, 0x18, ...ascii('ftypmp42'), 0, 0, 0, 0));
        expect(r).toMatchObject({ type: 'video', mimeType: 'video/mp4', extension: 'mp4' });
    });

    it('detects WebM from EBML magic', () => {
        expect(detectFileType(bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0)).extension).toBe('webm');
    });

    it('detects MP3 from frame sync FF FB', () => {
        expect(detectFileType(bytes(0xff, 0xfb, 0x90, 0x00)).extension).toBe('mp3');
    });

    it('detects MP3 from an ID3 tag', () => {
        expect(detectFileType(bytes(...ascii('ID3'), 3, 0, 0, 0)).extension).toBe('mp3');
    });

    it('detects WAV from RIFF....WAVE', () => {
        const r = detectFileType(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')));
        expect(r).toMatchObject({ type: 'audio', extension: 'wav' });
    });

    it('detects OGG audio from OggS', () => {
        const r = detectFileType(padTo(ascii('OggS'), 16));
        expect(r).toMatchObject({ type: 'audio', extension: 'ogg' });
    });

    it('detects Theora video inside an Ogg container', () => {
        const arr = new Array(40).fill(0);
        arr.splice(0, 4, ...ascii('OggS'));
        // place \x80theora starting at index 28
        arr.splice(28, 7, 0x80, ...ascii('theora'));
        const r = detectFileType(new Uint8Array(arr));
        expect(r).toMatchObject({ type: 'video', mimeType: 'video/ogg', extension: 'ogv' });
    });
});

describe('detectFileType — zip-based office formats', () => {
    it('detects DOCX from word/document.xml entry', () => {
        const zip = makeZip([{ name: 'word/document.xml', content: '<w:document/>' }]);
        expect(detectFileType(zip)).toMatchObject({ type: 'docx', extension: 'docx' });
    });

    it('detects XLSX from xl/workbook.xml entry', () => {
        const zip = makeZip([{ name: 'xl/workbook.xml', content: '<workbook/>' }]);
        expect(detectFileType(zip)).toMatchObject({ type: 'xlsx', extension: 'xlsx' });
    });

    it('detects PPTX from ppt/presentation.xml entry', () => {
        const zip = makeZip([{ name: 'ppt/presentation.xml', content: '<p:presentation/>' }]);
        expect(detectFileType(zip)).toMatchObject({ type: 'pptx', extension: 'pptx' });
    });

    it('returns unknown for a zip with no recognised office part', () => {
        const zip = makeZip([{ name: 'random/file.txt', content: 'hi' }]);
        expect(detectFileType(zip).type).toBe('unknown');
    });

    it('returns unknown for a corrupt zip (PK header but no central dir)', () => {
        const broken = bytes(0x50, 0x4b, 0x03, 0x04, ...new Array(40).fill(0));
        expect(detectFileType(broken).type).toBe('unknown');
    });
});

describe('detectFileType — OLE2 legacy office formats', () => {
    it('detects legacy DOC from a WordDocument stream', () => {
        const ole = makeOle2('WordDocument');
        expect(detectFileType(ole)).toMatchObject({ type: 'doc', extension: 'doc' });
    });

    it('detects legacy PPT from a PowerPoint Document stream', () => {
        const ole = makeOle2('PowerPoint Document');
        expect(detectFileType(ole)).toMatchObject({ type: 'ppt', extension: 'ppt' });
    });

    it('returns unknown for an encrypted OLE2 package', () => {
        const ole = makeOle2('EncryptedPackage');
        expect(detectFileType(ole).type).toBe('unknown');
    });

    it('returns unknown for an OLE2 magic with too little data', () => {
        const tiny = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
        expect(detectFileType(tiny).type).toBe('unknown');
    });
});

describe('detectFileType — text & unknown branches', () => {
    it('detects plain text from printable content', () => {
        const r = detectFileType(new TextEncoder().encode('The quick brown fox jumps.\n'));
        expect(r).toMatchObject({ type: 'text', mimeType: 'text/plain', extension: 'txt' });
    });

    it('classifies a buffer with a NUL byte as unknown (binary)', () => {
        const r = detectFileType(bytes(0x68, 0x69, 0x00, 0xff, 0xfe, 0xfd, 0xfc, 0xfb));
        expect(r.type).toBe('unknown');
    });

    it('returns unknown for an empty buffer', () => {
        const r = detectFileType(new Uint8Array(0));
        expect(r).toEqual({ type: 'unknown', mimeType: 'application/octet-stream', extension: '' });
    });

    it('returns unknown for random high-byte binary', () => {
        expect(detectFileType(bytes(0x9a, 0xbc, 0xde, 0xf1, 0x23, 0x45)).type).toBe('unknown');
    });
});

describe('detectFileTypeFromFile', () => {
    it('detects type from blob content (PNG)', async () => {
        const blob = new Blob([bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)]);
        const r = await detectFileTypeFromFile(blob);
        expect(r.extension).toBe('png');
    });

    it('falls back to filename extension when content is unrecognised', async () => {
        const file = new File([bytes(0x00, 0x01, 0x02, 0x03)], 'report.csv');
        const r = await detectFileTypeFromFile(file);
        expect(r).toMatchObject({ type: 'text', mimeType: 'text/csv', extension: 'csv' });
    });

    it('maps a json extension to text/json', async () => {
        const file = new File([bytes(0x00, 0xff)], 'data.json');
        const r = await detectFileTypeFromFile(file);
        expect(r).toMatchObject({ type: 'text', mimeType: 'application/json', extension: 'json' });
    });

    it('returns unknown when neither content nor extension is recognised', async () => {
        const file = new File([bytes(0x00, 0xff)], 'mystery.qqq');
        const r = await detectFileTypeFromFile(file);
        expect(r.type).toBe('unknown');
    });

    it('prefers content detection over extension', async () => {
        // PDF content but a .png name -> content wins.
        const file = new File([new TextEncoder().encode('%PDF-1.4')], 'fake.png');
        const r = await detectFileTypeFromFile(file);
        expect(r.type).toBe('pdf');
    });
});
