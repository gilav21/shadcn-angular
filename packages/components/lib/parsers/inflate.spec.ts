import { describe, expect, it } from 'vitest';
import { inflate, zlibInflate } from './inflate';

// --- Helpers: produce real DEFLATE / zlib streams via the browser API ---

async function deflateRaw(input: Uint8Array): Promise<Uint8Array> {
    return streamThrough(input, 'deflate-raw');
}

async function deflateZlib(input: Uint8Array): Promise<Uint8Array> {
    return streamThrough(input, 'deflate');
}

async function streamThrough(input: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
    const cs = new CompressionStream(format);
    const writer = cs.writable.getWriter();
    void writer.write(input as BufferSource);
    void writer.close();
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
    for (const c of chunks) {
        out.set(c, off);
        off += c.length;
    }
    return out;
}

function bytes(...n: number[]): Uint8Array {
    return new Uint8Array(n);
}

function repeat(str: string, times: number): Uint8Array {
    return new TextEncoder().encode(str.repeat(times));
}

describe('inflate — round-trips against real DEFLATE streams', () => {
    it('reconstructs a short ASCII payload exactly', async () => {
        const original = new TextEncoder().encode('hello deflate world');
        const compressed = await deflateRaw(original);
        const result = inflate(compressed);
        expect(Array.from(result)).toEqual(Array.from(original));
    });

    it('reconstructs highly repetitive data (exercises back-references)', async () => {
        const original = repeat('abcabcabc-', 500);
        const compressed = await deflateRaw(original);
        const result = inflate(compressed);
        expect(result).toHaveLength(original.length);
        expect(Array.from(result)).toEqual(Array.from(original));
    });

    it('reconstructs an empty payload', async () => {
        const original = new Uint8Array(0);
        const compressed = await deflateRaw(original);
        const result = inflate(compressed);
        expect(result).toHaveLength(0);
    });

    it('reconstructs binary data spanning all byte values', async () => {
        const original = new Uint8Array(256 * 4);
        for (let i = 0; i < original.length; i++) original[i] = i & 0xff;
        const compressed = await deflateRaw(original);
        const result = inflate(compressed);
        expect(Array.from(result)).toEqual(Array.from(original));
    });

    it('reconstructs large random-ish text that forces dynamic Huffman blocks', async () => {
        // A long varied text biases the encoder toward a dynamic Huffman block.
        const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
        let text = '';
        for (let i = 0; i < 2000; i++) {
            text += words[(i * 7 + 3) % words.length] + ' ';
        }
        const original = new TextEncoder().encode(text);
        const compressed = await deflateRaw(original);
        const result = inflate(compressed);
        expect(new TextDecoder().decode(result)).toBe(text);
    });
});

describe('inflate — stored (uncompressed) blocks', () => {
    // A single final stored block: BFINAL=1, BTYPE=00 -> first byte 0x01.
    // Then LEN (LE16), NLEN (LE16), then raw bytes.
    it('decodes a hand-built stored block', () => {
        const payload = [0x41, 0x42, 0x43]; // "ABC"
        const len = payload.length;
        const stream = bytes(
            0x01,            // BFINAL=1, BTYPE=00
            len & 0xff, (len >> 8) & 0xff,
            ~len & 0xff, (~len >> 8) & 0xff,
            ...payload,
        );
        const result = inflate(stream);
        expect(Array.from(result)).toEqual(payload);
    });
});

describe('inflate — fixed Huffman blocks', () => {
    it('decodes a fixed-Huffman stream produced by the encoder', async () => {
        // Short inputs are typically encoded as a fixed Huffman block.
        const original = new TextEncoder().encode('aaaaaa');
        const compressed = await deflateRaw(original);
        const result = inflate(compressed);
        expect(new TextDecoder().decode(result)).toBe('aaaaaa');
    });
});

describe('inflate — error branches', () => {
    it('throws on an invalid block type (BTYPE=11)', () => {
        // BFINAL=1, BTYPE=11 -> low 3 bits = 111 -> first byte 0x07
        expect(() => inflate(bytes(0x07, 0x00, 0x00))).toThrow(/Invalid deflate block type/);
    });

    it('throws when the stream ends before a complete block', () => {
        // BFINAL=1, BTYPE=01 (fixed) but no symbol data follows.
        expect(() => inflate(bytes(0x03))).toThrow(/Unexpected end of deflate stream/);
    });

    it('throws when a stored block claims more bytes than are present', () => {
        const stream = bytes(0x01, 0x10, 0x00, 0xef, 0xff, 0x41);
        expect(() => inflate(stream)).toThrow(/Unexpected end of deflate stream/);
    });
});

describe('zlibInflate', () => {
    it('strips the 2-byte zlib header and inflates', async () => {
        const original = new TextEncoder().encode('zlib wrapped content here');
        const compressed = await deflateZlib(original);
        const result = zlibInflate(compressed);
        // CompressionStream('deflate') appends an Adler-32 checksum; the inflater
        // stops at the final block, so the leading bytes must match the original.
        expect(new TextDecoder().decode(result.subarray(0, original.length))).toBe(
            'zlib wrapped content here',
        );
    });

    it('returns input unchanged when shorter than the 2-byte header', () => {
        const tiny = bytes(0x78);
        expect(zlibInflate(tiny)).toBe(tiny);
    });

    it('falls back to raw inflate when CM is not 8 (deflate)', () => {
        // CMF byte with low nibble != 8 -> treated as raw deflate from byte 0.
        // Build a stored block but with a leading byte whose CM != 8.
        const payload = [0x58]; // 'X'
        // first byte 0x01 = BFINAL=1, BTYPE=00; its low nibble (cm) is 1, not 8.
        const stream = bytes(0x01, 0x01, 0x00, 0xfe, 0xff, ...payload);
        const result = zlibInflate(stream);
        expect(Array.from(result)).toEqual(payload);
    });
});
