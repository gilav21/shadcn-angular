import { describe, expect, it } from 'vitest';
import { buildTtf, type TtfBuilderGlyph, type TtfBuilderOptions } from './ttf-builder';
import { TtfFont } from './ttf-parser';

// ── Big-endian read helpers for direct byte assertions ─────────────────
function u16(d: DataView, o: number): number {
    return d.getUint16(o, false);
}
function u32(d: DataView, o: number): number {
    return d.getUint32(o, false);
}
function i16(d: DataView, o: number): number {
    return d.getInt16(o, false);
}
function tagAt(d: DataView, o: number): string {
    return String.fromCodePoint(
        d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3),
    );
}

/** Build a minimal valid simple glyph (single triangular contour). */
function makeGlyph(unicode: number, advanceWidth: number): TtfBuilderGlyph {
    // numberOfContours=1, bbox, endPtsOfContours=[2], instructionLength=0,
    // flags for 3 on-curve points, x/y coords.
    const bytes: number[] = [];
    const push16 = (v: number) => { bytes.push((v >> 8) & 0xff, v & 0xff); };
    push16(1);          // numberOfContours
    push16(0);          // xMin
    push16(0);          // yMin
    push16(100);        // xMax
    push16(100);        // yMax
    push16(2);          // endPtsOfContours[0] = 2 (3 points)
    push16(0);          // instructionLength
    // flags: ON_CURVE(0x01) | X_SHORT(0x02) | Y_SHORT(0x04) | X_SAME(0x10) | Y_SAME(0x20)
    const flag = 0x01 | 0x02 | 0x04 | 0x10 | 0x20;
    bytes.push(flag, flag, flag);
    // x coords (short, positive): 0, 50, 50
    bytes.push(0, 50, 50);
    // y coords (short, positive): 0, 0, 100
    bytes.push(0, 0, 100);
    return { unicode, advanceWidth, glyphData: new Uint8Array(bytes) };
}

function baseOptions(glyphs: readonly TtfBuilderGlyph[]): TtfBuilderOptions {
    return {
        familyName: 'TestFamily',
        styleName: 'Regular',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
        glyphs,
    };
}

function viewOf(ttf: Uint8Array): DataView {
    return new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
}

function toArrayBuffer(ttf: Uint8Array): ArrayBuffer {
    return ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength) as ArrayBuffer;
}

describe('buildTtf', () => {
    it('produces a TrueType offset table with the expected header fields', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(65, 500)];
        const ttf = buildTtf(baseOptions(glyphs));
        const v = viewOf(ttf);

        expect(u32(v, 0)).toBe(0x00010000); // sfVersion TrueType
        const numTables = u16(v, 4);
        expect(numTables).toBe(10); // head,hhea,hmtx,maxp,cmap,loca,glyf,name,OS/2,post

        // binary-search params must be self-consistent
        const searchRange = u16(v, 6);
        const entrySelector = u16(v, 8);
        const rangeShift = u16(v, 10);
        expect(searchRange).toBe(2 ** Math.floor(Math.log2(numTables)) * 16);
        expect(entrySelector).toBe(Math.floor(Math.log2(numTables)));
        expect(rangeShift).toBe(numTables * 16 - searchRange);
    });

    it('writes a table directory sorted by tag with 4-byte-aligned offsets', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(65, 500)];
        const ttf = buildTtf(baseOptions(glyphs));
        const v = viewOf(ttf);
        const numTables = u16(v, 4);

        const tags: string[] = [];
        for (let i = 0; i < numTables; i++) {
            const dirOff = 12 + i * 16;
            tags.push(tagAt(v, dirOff));
            const offset = u32(v, dirOff + 8);
            expect(offset % 4).toBe(0); // every table offset 4-byte aligned
            // offset + length must be within the file
            const length = u32(v, dirOff + 12);
            expect(offset + length).toBeLessThanOrEqual(ttf.length);
        }
        const sorted = [...tags].sort((a, b) => a.localeCompare(b));
        expect(tags).toEqual(sorted);
        expect(new Set(tags)).toEqual(new Set([
            'head', 'hhea', 'hmtx', 'maxp', 'cmap', 'loca', 'glyf', 'name', 'OS/2', 'post',
        ]));
    });

    it('round-trips core metrics through TtfFont parser', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(65, 500), makeGlyph(66, 600)];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));

        expect(font.unitsPerEm).toBe(1000);
        expect(font.ascender).toBe(800);
        expect(font.descender).toBe(-200);
        expect(font.numGlyphs).toBe(3);
    });

    it('round-trips advance widths via hmtx', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(65, 500), makeGlyph(66, 600)];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));

        expect(font.getAdvanceWidth(0)).toBe(0);
        expect(font.getAdvanceWidth(1)).toBe(500);
        expect(font.getAdvanceWidth(2)).toBe(600);
    });

    it('rounds and clamps negative advance widths to >= 0', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(65, -50), makeGlyph(66, 499.6)];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));

        expect(font.getAdvanceWidth(1)).toBe(0);   // negative clamped
        expect(font.getAdvanceWidth(2)).toBe(500); // rounded
    });

    it('round-trips the cmap unicode→GID mapping', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(0x41, 500), makeGlyph(0x42, 600)];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));

        expect(font.charToGlyphIndex(0x41)).toBe(1);
        expect(font.charToGlyphIndex(0x42)).toBe(2);
        expect(font.charToGlyphIndex(0x43)).toBe(0); // unmapped → .notdef
    });

    it('builds a single contiguous cmap segment for adjacent codepoints', () => {
        // 0x41,0x42,0x43 contiguous with constant delta → 1 real segment + sentinel
        const glyphs = [
            makeGlyph(0, 0), makeGlyph(0x41, 1), makeGlyph(0x42, 1), makeGlyph(0x43, 1),
        ];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));
        expect(font.charToGlyphIndex(0x41)).toBe(1);
        expect(font.charToGlyphIndex(0x42)).toBe(2);
        expect(font.charToGlyphIndex(0x43)).toBe(3);
    });

    it('builds multiple cmap segments for non-contiguous codepoints', () => {
        // gaps force separate segments
        const glyphs = [
            makeGlyph(0, 0), makeGlyph(0x41, 1), makeGlyph(0x50, 1), makeGlyph(0x100, 1),
        ];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));
        expect(font.charToGlyphIndex(0x41)).toBe(1);
        expect(font.charToGlyphIndex(0x50)).toBe(2);
        expect(font.charToGlyphIndex(0x100)).toBe(3);
        expect(font.charToGlyphIndex(0x42)).toBe(0); // in the gap
    });

    it('ignores out-of-BMP and non-positive unicodes in cmap', () => {
        const glyphs = [
            makeGlyph(0, 0),          // unicode 0 → skipped
            makeGlyph(0x41, 500),     // valid
            makeGlyph(0x10000, 600),  // > 0xFFFF → skipped
        ];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));
        expect(font.charToGlyphIndex(0x41)).toBe(1);
        expect(font.charToGlyphIndex(0x10000)).toBe(0);
    });

    it('handles a glyph set with no mappable unicodes (sentinel-only cmap)', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(0, 500)];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));
        // No characters mapped, but the font still parses.
        expect(font.charToGlyphIndex(0x41)).toBe(0);
        expect(font.numGlyphs).toBe(2);
    });

    it('round-trips raw glyph data via loca/glyf (short loca format)', () => {
        const g1 = makeGlyph(0x41, 500);
        const glyphs = [makeGlyph(0, 0), g1];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));

        const raw = font.getRawGlyph(1);
        expect(raw).not.toBeNull();
        // first 2 bytes = numberOfContours = 1
        const rv = new DataView(raw!.buffer, raw!.byteOffset, raw!.byteLength);
        expect(i16(rv, 0)).toBe(1);
        // bbox xMax stored
        expect(i16(rv, 6)).toBe(100);
    });

    it('emits an empty (zero-length) glyph for a notdef with no glyphData', () => {
        const empty: TtfBuilderGlyph = { unicode: 0, advanceWidth: 0, glyphData: new Uint8Array(0) };
        const glyphs = [empty, makeGlyph(0x41, 500)];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));
        // gid 0 has 0 bytes (start === end), so getRawGlyph(0) returns null
        expect(font.getRawGlyph(0)).toBeNull();
        // but gid 1 has data
        expect(font.getRawGlyph(1)).not.toBeNull();
    });

    it('pads odd-length glyph data to a 2-byte boundary in glyf', () => {
        // odd-length glyphData (3 bytes) exercises the pad branch in buildLocaGlyf
        const odd: TtfBuilderGlyph = { unicode: 0x41, advanceWidth: 100, glyphData: new Uint8Array([0x00, 0x00, 0x01]) };
        const glyphs = [makeGlyph(0, 0), odd, makeGlyph(0x42, 200)];
        const ttf = buildTtf(baseOptions(glyphs));
        const font = new TtfFont(toArrayBuffer(ttf));
        // glyph 2 must still be readable after the padded glyph 1
        const raw2 = font.getRawGlyph(2);
        expect(raw2).not.toBeNull();
        const rv = new DataView(raw2!.buffer, raw2!.byteOffset, raw2!.byteLength);
        expect(i16(rv, 0)).toBe(1);
    });

    it('builds a long loca format when total glyf exceeds the short limit', () => {
        // One huge glyph forces total glyf size past 131070 → long loca.
        const big = new Uint8Array(140000);
        const bigView = new DataView(big.buffer);
        bigView.setInt16(0, 1, false);   // numberOfContours
        bigView.setInt16(6, 50, false);  // xMax marker
        const huge: TtfBuilderGlyph = { unicode: 0x41, advanceWidth: 500, glyphData: big };
        const glyphs = [makeGlyph(0, 0), huge];
        const ttf = buildTtf(baseOptions(glyphs));

        // verify head.indexToLocFormat == 1 (long) via the parser round-trip
        const font = new TtfFont(toArrayBuffer(ttf));
        const raw = font.getRawGlyph(1);
        expect(raw).not.toBeNull();
        expect(raw!.length).toBe(140000);
        const rv = new DataView(raw!.buffer, raw!.byteOffset, raw!.byteLength);
        expect(i16(rv, 6)).toBe(50);
    });

    it('encodes family and style names as UTF-16BE in the name table', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(0x41, 500)];
        const ttf = buildTtf({ ...baseOptions(glyphs), familyName: 'Acme', styleName: 'Bold' });
        const v = viewOf(ttf);
        const numTables = u16(v, 4);

        let nameOff = -1;
        let nameLen = 0;
        for (let i = 0; i < numTables; i++) {
            const dirOff = 12 + i * 16;
            if (tagAt(v, dirOff) === 'name') {
                nameOff = u32(v, dirOff + 8);
                nameLen = u32(v, dirOff + 12);
            }
        }
        expect(nameOff).toBeGreaterThan(0);

        // name header: format=0, count=6, storageOffset
        expect(u16(v, nameOff)).toBe(0);
        expect(u16(v, nameOff + 2)).toBe(6);
        const storageOffset = u16(v, nameOff + 4);

        // Record 1 = fontFamily ("Acme"). Decode its UTF-16BE bytes.
        const rec1 = nameOff + 6 + 1 * 12;
        expect(u16(v, rec1)).toBe(3);      // platformID Windows
        expect(u16(v, rec1 + 2)).toBe(1);  // encodingID Unicode BMP
        expect(u16(v, rec1 + 4)).toBe(0x0409); // language English US
        expect(u16(v, rec1 + 6)).toBe(1);  // nameID fontFamily
        const len = u16(v, rec1 + 8);
        const strPos = nameOff + storageOffset + u16(v, rec1 + 10);
        let decoded = '';
        for (let j = 0; j < len; j += 2) {
            decoded += String.fromCodePoint(u16(v, strPos + j));
        }
        expect(decoded).toBe('Acme');
        // table length must contain all records + strings
        expect(nameLen).toBeGreaterThanOrEqual(6 + 6 * 12);
    });

    it('writes head magic number and unitsPerEm correctly', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(0x41, 500)];
        const ttf = buildTtf(baseOptions(glyphs));
        const v = viewOf(ttf);
        const numTables = u16(v, 4);

        let headOff = -1;
        for (let i = 0; i < numTables; i++) {
            const dirOff = 12 + i * 16;
            if (tagAt(v, dirOff) === 'head') headOff = u32(v, dirOff + 8);
        }
        expect(u32(v, headOff + 12)).toBe(0x5F0F3CF5); // magicNumber
        expect(u16(v, headOff + 18)).toBe(1000);       // unitsPerEm
        expect(i16(v, headOff + 50)).toBe(0);          // indexToLocFormat short
    });

    it('sets a non-zero head checksumAdjustment derived from the whole file', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(0x41, 500)];
        const ttf = buildTtf(baseOptions(glyphs));
        const v = viewOf(ttf);
        const numTables = u16(v, 4);

        let headOff = -1;
        for (let i = 0; i < numTables; i++) {
            const dirOff = 12 + i * 16;
            if (tagAt(v, dirOff) === 'head') headOff = u32(v, dirOff + 8);
        }
        const checksumAdjust = u32(v, headOff + 8);
        expect(checksumAdjust).not.toBe(0);

        // Recompute whole-file checksum with checksumAdjust zeroed → magic constant.
        const copy = new Uint8Array(ttf);
        const cv = new DataView(copy.buffer);
        cv.setUint32(headOff + 8, 0, false);
        let sum = 0;
        const len = Math.ceil(copy.length / 4) * 4;
        for (let i = 0; i < len; i += 4) {
            let word = 0;
            for (let j = 0; j < 4; j++) {
                word = (word << 8) | (i + j < copy.length ? copy[i + j] : 0);
            }
            sum = (sum + (word >>> 0)) >>> 0;
        }
        const expected = (0xB1B0AFBA - sum) >>> 0;
        expect(checksumAdjust).toBe(expected);
    });

    it('writes OS/2 typo ascender/descender from the options', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(0x41, 500)];
        const ttf = buildTtf(baseOptions(glyphs));
        const v = viewOf(ttf);
        const numTables = u16(v, 4);

        let os2Off = -1;
        for (let i = 0; i < numTables; i++) {
            const dirOff = 12 + i * 16;
            if (tagAt(v, dirOff) === 'OS/2') os2Off = u32(v, dirOff + 8);
        }
        expect(u16(v, os2Off)).toBe(0x0004);     // version 4
        expect(i16(v, os2Off + 68)).toBe(800);   // sTypoAscender
        expect(i16(v, os2Off + 70)).toBe(-200);  // sTypoDescender
        expect(u16(v, os2Off + 74)).toBe(800);   // usWinAscent
        expect(u16(v, os2Off + 76)).toBe(200);   // usWinDescent (= -descender)
    });

    it('writes a version 3.0 post table', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(0x41, 500)];
        const ttf = buildTtf(baseOptions(glyphs));
        const v = viewOf(ttf);
        const numTables = u16(v, 4);

        let postOff = -1;
        for (let i = 0; i < numTables; i++) {
            const dirOff = 12 + i * 16;
            if (tagAt(v, dirOff) === 'post') postOff = u32(v, dirOff + 8);
        }
        expect(u32(v, postOff)).toBe(0x00030000);
    });

    it('writes hhea numberOfHMetrics equal to the glyph count', () => {
        const glyphs = [makeGlyph(0, 0), makeGlyph(0x41, 500), makeGlyph(0x42, 600)];
        const ttf = buildTtf(baseOptions(glyphs));
        const v = viewOf(ttf);
        const numTables = u16(v, 4);

        let hheaOff = -1;
        for (let i = 0; i < numTables; i++) {
            const dirOff = 12 + i * 16;
            if (tagAt(v, dirOff) === 'hhea') hheaOff = u32(v, dirOff + 8);
        }
        expect(i16(v, hheaOff + 4)).toBe(800);   // ascender
        expect(i16(v, hheaOff + 6)).toBe(-200);  // descender
        expect(u16(v, hheaOff + 34)).toBe(3);    // numberOfHMetrics
    });

    it('stored directory length excludes padding but data is padded', () => {
        // Use a glyph count of 1 so hmtx (4 bytes) and others trigger pad4 paths.
        const glyphs = [makeGlyph(0, 0)];
        const ttf = buildTtf(baseOptions(glyphs));
        const v = viewOf(ttf);
        const numTables = u16(v, 4);
        // file length must be a multiple of 4 (all tables padded)
        expect(ttf.length % 4).toBe(0);

        // each stored offset + padded length stays within the file
        let maxEnd = 0;
        for (let i = 0; i < numTables; i++) {
            const dirOff = 12 + i * 16;
            const offset = u32(v, dirOff + 8);
            const length = u32(v, dirOff + 12);
            const paddedEnd = offset + Math.ceil(length / 4) * 4;
            maxEnd = Math.max(maxEnd, paddedEnd);
        }
        expect(maxEnd).toBeLessThanOrEqual(ttf.length);
    });
});
