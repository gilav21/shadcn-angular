import { describe, expect, it } from 'vitest';
import { listZipEntries, extractZipEntry, readZip } from './zip-reader';

// --- CRC32 (matches zip-reader's own table) ---

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

interface BuildEntry {
    name: string;
    content: Uint8Array;
    method: number;        // 0 = stored, 8 = deflate
    stored: Uint8Array;    // bytes placed in the file payload
    flags?: number;
}

function buildZip(entries: BuildEntry[]): Uint8Array {
    const enc = new TextEncoder();
    const local: number[] = [];
    const central: number[] = [];
    const offsets: number[] = [];
    let offset = 0;
    for (const e of entries) {
        const nb = enc.encode(e.name);
        offsets.push(offset);
        const chunk = [
            ...u32(0x04034b50), ...u16(20), ...u16(e.flags ?? 0), ...u16(e.method),
            ...u16(0), ...u16(0),
            ...u32(crc32(e.content)), ...u32(e.stored.length), ...u32(e.content.length),
            ...u16(nb.length), ...u16(0),
            ...nb, ...e.stored,
        ];
        local.push(...chunk);
        offset += chunk.length;
    }
    const centralStart = offset;
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const nb = enc.encode(e.name);
        central.push(
            ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(e.flags ?? 0), ...u16(e.method),
            ...u16(0), ...u16(0),
            ...u32(crc32(e.content)), ...u32(e.stored.length), ...u32(e.content.length),
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

function stored(name: string, content: string | Uint8Array, flags?: number): BuildEntry {
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    return { name, content: data, method: 0, stored: data, flags };
}

async function deflateRaw(input: Uint8Array): Promise<Uint8Array> {
    const cs = new CompressionStream('deflate-raw');
    const w = cs.writable.getWriter();
    void w.write(input as BufferSource);
    void w.close();
    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    let total = 0;
    for (const c of chunks) total += c.length;
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
}

async function deflated(name: string, content: string): Promise<BuildEntry> {
    const data = new TextEncoder().encode(content);
    const comp = await deflateRaw(data);
    return { name, content: data, method: 8, stored: comp };
}

describe('listZipEntries', () => {
    it('lists entry names, sizes and compression method', () => {
        const zip = buildZip([
            stored('a.txt', 'hello'),
            stored('dir/b.txt', 'world!!'),
        ]);
        const entries = listZipEntries(zip);
        expect(entries.map(e => e.path)).toEqual(['a.txt', 'dir/b.txt']);
        expect(entries[0].uncompressedSize).toBe(5);
        expect(entries[1].uncompressedSize).toBe(7);
        expect(entries[0].compressionMethod).toBe(0);
    });

    it('throws on data too small to be a zip', () => {
        expect(() => listZipEntries(new Uint8Array(10))).toThrow(/too small/i);
    });

    it('throws when the PK local signature is missing', () => {
        const notZip = new Uint8Array(40);
        notZip[0] = 0x00;
        expect(() => listZipEntries(notZip)).toThrow(/missing PK signature/);
    });

    it('throws when end of central directory cannot be found', () => {
        // Valid local header prefix but no EOCD record anywhere.
        const data = new Uint8Array(40);
        data.set([0x50, 0x4b, 0x03, 0x04], 0);
        expect(() => listZipEntries(data)).toThrow(/Cannot find end of central directory/);
    });
});

describe('extractZipEntry', () => {
    it('extracts a STORED entry verbatim with CRC validation', () => {
        const zip = buildZip([stored('greeting.txt', 'Hello, ZIP!')]);
        const out = extractZipEntry(zip, 'greeting.txt');
        expect(out).not.toBeNull();
        expect(new TextDecoder().decode(out!)).toBe('Hello, ZIP!');
    });

    it('extracts and inflates a DEFLATE entry', async () => {
        const longText = 'compress me '.repeat(50);
        const zip = buildZip([await deflated('z.txt', longText)]);
        const out = extractZipEntry(zip, 'z.txt');
        expect(new TextDecoder().decode(out!)).toBe(longText);
    });

    it('returns null for a missing entry', () => {
        const zip = buildZip([stored('a.txt', 'x')]);
        expect(extractZipEntry(zip, 'nope.txt')).toBeNull();
    });

    it('throws on CRC32 mismatch when payload is corrupted', () => {
        const data = new TextEncoder().encode('original');
        const tampered: BuildEntry = {
            name: 'c.txt', content: data, method: 0,
            stored: new TextEncoder().encode('TAMPERED'),
        };
        // content (used for the stored CRC) differs from stored bytes -> mismatch.
        const zip = buildZip([tampered]);
        expect(() => extractZipEntry(zip, 'c.txt')).toThrow(/CRC32 mismatch/);
    });

    it('throws on an encrypted entry (flag bit 0 set)', () => {
        const zip = buildZip([stored('secret.txt', 'x', 0x01)]);
        expect(() => extractZipEntry(zip, 'secret.txt')).toThrow(/Encrypted ZIP entry/);
    });

    it('throws on an unsupported compression method', () => {
        const data = new TextEncoder().encode('data');
        const entry: BuildEntry = { name: 'u.txt', content: data, method: 12, stored: data };
        const zip = buildZip([entry]);
        expect(() => extractZipEntry(zip, 'u.txt')).toThrow(/Unsupported compression method 12/);
    });

    it('throws when the entry exceeds maxFileSize', () => {
        const zip = buildZip([stored('big.txt', 'abcdef')]);
        expect(() => extractZipEntry(zip, 'big.txt', { maxFileSize: 3 })).toThrow(/File too large/);
    });

    it('rejects path traversal entries', () => {
        const zip = buildZip([stored('../escape.txt', 'x')]);
        expect(() => extractZipEntry(zip, '../escape.txt')).toThrow(/Path traversal rejected/);
    });

    it('rejects absolute path entries', () => {
        const zip = buildZip([stored('/etc/passwd', 'x')]);
        expect(() => extractZipEntry(zip, '/etc/passwd')).toThrow(/Absolute path rejected/);
    });
});

describe('readZip', () => {
    it('returns a map of all file entries with correct contents', async () => {
        const zip = buildZip([
            stored('a.txt', 'AAA'),
            await deflated('b.txt', 'B'.repeat(40)),
        ]);
        const map = readZip(zip);
        expect([...map.keys()].sort((a, b) => a.localeCompare(b))).toEqual(['a.txt', 'b.txt']);
        expect(new TextDecoder().decode(map.get('a.txt')!)).toBe('AAA');
        expect(new TextDecoder().decode(map.get('b.txt')!)).toBe('B'.repeat(40));
    });

    it('skips directory entries (names ending in /)', () => {
        const zip = buildZip([stored('folder/', ''), stored('folder/f.txt', 'leaf')]);
        const map = readZip(zip);
        expect(map.has('folder/')).toBe(false);
        expect(new TextDecoder().decode(map.get('folder/f.txt')!)).toBe('leaf');
    });

    it('throws when total uncompressed size exceeds the configured limit', () => {
        const zip = buildZip([stored('a.txt', 'abcdefghij')]);
        expect(() => readZip(zip, { maxUncompressedSize: 5 })).toThrow(/Total uncompressed size too large/);
    });
});

function u64(n: number): number[] {
    const lo = n >>> 0;
    const hi = Math.floor(n / 0x100000000) >>> 0;
    return [...u32(lo), ...u32(hi)];
}

/**
 * Build a ZIP64 archive for a single STORED entry whose 32-bit size/offset
 * fields are set to 0xFFFFFFFF sentinels and supplied via the zip64 extra
 * field + zip64 EOCD record.
 */
function buildZip64(name: string, content: string): Uint8Array {
    const enc = new TextEncoder();
    const data = enc.encode(content);
    const nb = enc.encode(name);
    const crc = crc32(data);
    const FFFF = 0xffffffff;

    // Local header: real sizes here (so extraction works), offset 0.
    const local = [
        ...u32(0x04034b50), ...u16(45), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(nb.length), ...u16(0),
        ...nb, ...data,
    ];
    const centralStart = local.length;

    // zip64 extra field: id 0x0001, holds uncompressed, compressed, offset (8 bytes each).
    const extra = [
        ...u16(0x0001), ...u16(24),
        ...u64(data.length), ...u64(data.length), ...u64(0),
    ];

    const central = [
        ...u32(0x02014b50), ...u16(45), ...u16(45), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(FFFF), ...u32(FFFF),
        ...u16(nb.length), ...u16(extra.length), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
        ...u32(FFFF),
        ...nb, ...extra,
    ];
    const centralEnd = centralStart + central.length;

    // zip64 end of central directory record (56 bytes).
    const zip64Eocd = [
        ...u32(0x06064b50),
        ...u64(44),            // size of remaining record
        ...u16(45), ...u16(45),
        ...u32(0), ...u32(0),  // this disk / cd start disk
        ...u64(1), ...u64(1),  // entries on disk / total entries
        ...u64(central.length),
        ...u64(centralStart),
    ];
    const zip64EocdOffset = centralEnd;

    // zip64 end of central directory locator (20 bytes).
    const locator = [
        ...u32(0x07064b50),
        ...u32(0),
        ...u64(zip64EocdOffset),
        ...u32(1),
    ];

    // Classic EOCD with 0xFFFF / 0xFFFFFFFF sentinels to force zip64 read.
    const eocd = [
        ...u32(0x06054b50), ...u16(0), ...u16(0),
        ...u16(0xffff), ...u16(0xffff),
        ...u32(FFFF), ...u32(FFFF), ...u16(0),
    ];

    return new Uint8Array([...local, ...central, ...zip64Eocd, ...locator, ...eocd]);
}

describe('zip-reader — ZIP64', () => {
    it('reads entry sizes/offset from the zip64 EOCD and extra field', () => {
        const zip = buildZip64('big/data.bin', 'zip64 payload content');
        const entries = listZipEntries(zip);
        expect(entries).toHaveLength(1);
        expect(entries[0].path).toBe('big/data.bin');
        expect(entries[0].uncompressedSize).toBe('zip64 payload content'.length);
        expect(entries[0].offset).toBe(0);
    });

    it('extracts a zip64 entry by name', () => {
        const zip = buildZip64('big/data.bin', 'zip64 payload content');
        const out = extractZipEntry(zip, 'big/data.bin');
        expect(new TextDecoder().decode(out!)).toBe('zip64 payload content');
    });
});

describe('zip-reader — local header validation', () => {
    it('throws when the local header offset runs past the end of the data', () => {
        // Corrupt the central localHeaderOffset to point beyond the buffer so the
        // `localOffset + 30 > data.length` guard fires.
        const zip = buildZip([stored('a.txt', 'hello world')]);
        const corrupt = zip.slice();
        const cdSig = [0x50, 0x4b, 0x01, 0x02];
        let cdPos = -1;
        for (let i = 0; i + 4 <= corrupt.length; i++) {
            if (corrupt[i] === cdSig[0] && corrupt[i + 1] === cdSig[1] && corrupt[i + 2] === cdSig[2] && corrupt[i + 3] === cdSig[3]) {
                cdPos = i;
                break;
            }
        }
        corrupt[cdPos + 42] = 0xff;
        corrupt[cdPos + 43] = 0xff;
        corrupt[cdPos + 44] = 0x00;
        corrupt[cdPos + 45] = 0x00;
        expect(() => extractZipEntry(corrupt, 'a.txt')).toThrow(/Invalid local header offset/);
    });

    it('throws when a central entry points at an invalid local offset', () => {
        // Build a valid zip, then corrupt the stored local header offset in the
        // central directory so the local signature check fails.
        const zip = buildZip([stored('a.txt', 'hello world')]);
        // Find the central dir signature and overwrite its localHeaderOffset (+42) to
        // point into the middle of the file (no valid PK\x03\x04 there).
        const corrupt = zip.slice();
        const cdSig = [0x50, 0x4b, 0x01, 0x02];
        let cdPos = -1;
        for (let i = 0; i + 4 <= corrupt.length; i++) {
            if (corrupt[i] === cdSig[0] && corrupt[i + 1] === cdSig[1] && corrupt[i + 2] === cdSig[2] && corrupt[i + 3] === cdSig[3]) {
                cdPos = i;
                break;
            }
        }
        expect(cdPos).toBeGreaterThanOrEqual(0);
        // localHeaderOffset = 5 (middle of first local header, not a signature).
        corrupt[cdPos + 42] = 5;
        corrupt[cdPos + 43] = 0;
        corrupt[cdPos + 44] = 0;
        corrupt[cdPos + 45] = 0;
        expect(() => extractZipEntry(corrupt, 'a.txt')).toThrow(/Invalid local header/);
    });
});
