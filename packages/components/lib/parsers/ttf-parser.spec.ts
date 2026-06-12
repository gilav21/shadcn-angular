import { describe, expect, it } from 'vitest';
import { TtfFont } from './ttf-parser';
import notoUrl from './fonts/NotoSans-Regular.ttf?url';

// ── Byte-writing helpers (big-endian) ───────────────────────────────────

class ByteWriter {
    private bytes: number[] = [];

    u8(v: number): this {
        this.bytes.push(v & 0xff);
        return this;
    }

    u16(v: number): this {
        this.bytes.push((v >> 8) & 0xff, v & 0xff);
        return this;
    }

    i16(v: number): this {
        return this.u16(v < 0 ? v + 0x10000 : v);
    }

    u32(v: number): this {
        this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
        return this;
    }

    tag(s: string): this {
        for (let i = 0; i < 4; i++) this.bytes.push(s.charCodeAt(i));
        return this;
    }

    raw(arr: number[] | Uint8Array): this {
        for (const b of arr) this.bytes.push(b & 0xff);
        return this;
    }

    pad4(): this {
        while (this.bytes.length % 4 !== 0) this.bytes.push(0);
        return this;
    }

    get length(): number {
        return this.bytes.length;
    }

    toArray(): number[] {
        return this.bytes.slice();
    }
}

interface TableSpec {
    tag: string;
    data: number[];
}

/** Assemble a sfnt font from a list of table blobs. */
function buildFont(tables: TableSpec[]): ArrayBuffer {
    const numTables = tables.length;
    const headerSize = 12 + numTables * 16;

    // Compute offsets (4-byte aligned).
    const records: { tag: string; offset: number; length: number; data: number[] }[] = [];
    let offset = headerSize;
    for (const t of tables) {
        records.push({ tag: t.tag, offset, length: t.data.length, data: t.data });
        offset += t.data.length;
        while (offset % 4 !== 0) offset += 1;
    }

    const w = new ByteWriter();
    w.u32(0x00010000); // sfnt version
    w.u16(numTables);
    w.u16(0); // searchRange
    w.u16(0); // entrySelector
    w.u16(0); // rangeShift
    for (const r of records) {
        w.tag(r.tag).u32(0).u32(r.offset).u32(r.length);
    }
    // Now write the table data with padding to match offsets.
    for (const r of records) {
        while (w.length < r.offset) w.u8(0);
        w.raw(r.data);
    }
    return new Uint8Array(w.toArray()).buffer;
}

// ── Table builders ──────────────────────────────────────────────────────

function headTable(opts: { unitsPerEm?: number; indexToLocFormat?: number } = {}): number[] {
    const w = new ByteWriter();
    // head is 54 bytes. unitsPerEm at offset 18, indexToLocFormat at offset 50.
    for (let i = 0; i < 18; i++) w.u8(0);
    w.u16(opts.unitsPerEm ?? 1000); // 18
    for (let i = 20; i < 50; i++) w.u8(0);
    w.i16(opts.indexToLocFormat ?? 0); // 50
    w.u16(0); // 52 glyphDataFormat
    return w.toArray();
}

function hheaTable(opts: { ascender?: number; descender?: number; numberOfHMetrics?: number } = {}): number[] {
    const w = new ByteWriter();
    // hhea is 36 bytes. ascender@4, descender@6, numberOfHMetrics@34.
    w.u32(0); // version
    w.i16(opts.ascender ?? 800); // 4
    w.i16(opts.descender ?? -200); // 6
    for (let i = 8; i < 34; i++) w.u8(0);
    w.u16(opts.numberOfHMetrics ?? 1); // 34
    return w.toArray();
}

function maxpTable(numGlyphs: number): number[] {
    const w = new ByteWriter();
    w.u32(0x00010000); // version
    w.u16(numGlyphs); // numGlyphs @4
    for (let i = 6; i < 32; i++) w.u8(0);
    return w.toArray();
}

function hmtxTable(advanceWidths: number[]): number[] {
    const w = new ByteWriter();
    for (const aw of advanceWidths) {
        w.u16(aw); // advanceWidth
        w.i16(0); // lsb
    }
    return w.toArray();
}

// cmap format 4: simple single-segment mapping char 'A'..'C' -> gids 1..3,
// plus the mandatory 0xFFFF terminator segment.
function cmapFormat4Subtable(): number[] {
    // Segments: [65..67] (start 65, gid via delta), [0xFFFF..0xFFFF].
    // For seg0 use idRangeOffset = 0 and delta so that 65+delta=1 -> delta = -64.
    const segCount = 2;
    const seg2 = segCount * 2;
    const w = new ByteWriter();
    w.u16(4); // format
    const lengthPos = w.length;
    w.u16(0); // length (patched below — but parser doesn't read length, so 0 ok)
    w.u16(0); // language
    w.u16(seg2); // segCountX2
    w.u16(0); // searchRange
    w.u16(0); // entrySelector
    w.u16(0); // rangeShift
    // endCode
    w.u16(67).u16(0xffff);
    w.u16(0); // reservedPad
    // startCode
    w.u16(65).u16(0xffff);
    // idDelta: 65 + (-64) = 1
    w.i16(-64).i16(1);
    // idRangeOffset
    w.u16(0).u16(0);
    void lengthPos;
    return w.toArray();
}

// cmap format 4 with idRangeOffset != 0 (glyphIdArray path).
function cmapFormat4WithRangeOffset(): number[] {
    // Single real segment 65..66 (2 chars), then 0xFFFF terminator.
    const segCount = 2;
    const seg2 = segCount * 2;
    const w = new ByteWriter();
    w.u16(4); // format
    w.u16(0); // length
    w.u16(0); // language
    w.u16(seg2); // segCountX2
    w.u16(0).u16(0).u16(0);
    // endCode
    w.u16(66).u16(0xffff);
    w.u16(0); // reservedPad
    // startCode
    w.u16(65).u16(0xffff);
    // idDelta both 0
    w.i16(0).i16(0);
    // idRangeOffset: for seg0, point into glyphIdArray which follows.
    // rangeOff base = position of idRangeOffset array. seg0 idRangeOffset entry
    // is at index 0. glyphIdArray starts right after idRangeOffset array (4 bytes).
    // glyphIdOff = rangeOff + 0*2 + rangeOffset + (cp-startCode)*2
    // We want, for cp=65, to read the first glyphIdArray entry.
    // The two idRangeOffset entries take 4 bytes. So glyphIdArray begins at rangeOff+4.
    // For seg0 (i=0): glyphIdOff = rangeOff + 0 + rangeOffset + 0 => need = rangeOff+4 => rangeOffset=4.
    w.u16(4).u16(0);
    // glyphIdArray: cp 65 -> gid 5, cp 66 -> gid 0 (maps to nothing)
    w.u16(5).u16(0);
    return w.toArray();
}

// cmap format 12: groups mapping 0x1F600..0x1F601 -> gids 7..8.
function cmapFormat12Subtable(): number[] {
    const w = new ByteWriter();
    w.u16(12); // format
    w.u16(0); // reserved
    w.u32(0); // length
    w.u32(0); // language
    w.u32(1); // nGroups
    w.u32(0x1f600).u32(0x1f601).u32(7); // group: start, end, startGlyphID
    return w.toArray();
}

// Build a cmap table wrapping one or more subtables with platform/encoding records.
function cmapTable(subtables: { platformID: number; encodingID: number; data: number[] }[]): number[] {
    const w = new ByteWriter();
    w.u16(0); // version
    w.u16(subtables.length); // numTables
    const recordsSize = subtables.length * 8;
    let subOffset = 4 + recordsSize;
    const offsets: number[] = [];
    for (const s of subtables) {
        offsets.push(subOffset);
        subOffset += s.data.length;
    }
    subtables.forEach((s, i) => {
        w.u16(s.platformID).u16(s.encodingID).u32(offsets[i]);
    });
    for (const s of subtables) {
        w.raw(s.data);
    }
    return w.toArray();
}

// loca table (short format): values are offsets/2.
function locaShort(offsetsHalf: number[]): number[] {
    const w = new ByteWriter();
    for (const v of offsetsHalf) w.u16(v);
    return w.toArray();
}

function locaLong(offsets: number[]): number[] {
    const w = new ByteWriter();
    for (const v of offsets) w.u32(v);
    return w.toArray();
}

// ── Simple glyph builder ────────────────────────────────────────────────

interface SimplePoint {
    x: number;
    y: number;
    onCurve?: boolean;
}

/**
 * Build a simple glyph with one contour. Uses long (i16) coordinate deltas
 * for every point so the scaling code's long-coordinate path is exercised.
 */
function simpleGlyph(points: SimplePoint[], bbox = { xMin: 0, yMin: 0, xMax: 100, yMax: 100 }): number[] {
    const w = new ByteWriter();
    w.i16(1); // numberOfContours
    w.i16(bbox.xMin).i16(bbox.yMin).i16(bbox.xMax).i16(bbox.yMax);
    w.u16(points.length - 1); // endPtsOfContours[0]
    w.u16(0); // instructionLength

    // Flags: every point gets a flag with no SHORT and no SAME bits set for
    // x and y -> forces 2-byte signed deltas (long path).
    for (const p of points) {
        let flag = 0;
        if (p.onCurve ?? true) flag |= 0x01;
        w.u8(flag);
    }

    // x deltas (i16) — relative to previous point.
    let prevX = 0;
    for (const p of points) {
        w.i16(p.x - prevX);
        prevX = p.x;
    }
    let prevY = 0;
    for (const p of points) {
        w.i16(p.y - prevY);
        prevY = p.y;
    }
    return w.toArray();
}

/**
 * Build a simple glyph using SHORT vectors (1-byte deltas) with explicit
 * sign-via-SAME-bit, plus a REPEAT run to exercise the repeat-flag path.
 */
function simpleGlyphShort(): number[] {
    const w = new ByteWriter();
    const numPoints = 4;
    w.i16(1); // numberOfContours
    w.i16(0).i16(0).i16(50).i16(50); // bbox
    w.u16(numPoints - 1); // endPts
    w.u16(0); // instructionLength

    // Flag with X_SHORT|Y_SHORT|X_SAME(positive)|Y_SAME(positive) + on-curve,
    // and REPEAT for the remaining 3 points.
    const flag = 0x01 | 0x02 | 0x04 | 0x10 | 0x20;
    w.u8(flag | 0x08); // REPEAT_FLAG
    w.u8(3); // repeat count -> 4 points total
    // x coords (1 byte each, positive)
    w.u8(10).u8(10).u8(10).u8(10);
    // y coords (1 byte each, positive)
    w.u8(5).u8(5).u8(5).u8(5);
    return w.toArray();
}

/** A simple glyph that includes a "same as previous" (0-byte) coordinate. */
function simpleGlyphWithSame(): number[] {
    const w = new ByteWriter();
    const numPoints = 2;
    w.i16(1);
    w.i16(0).i16(0).i16(20).i16(20);
    w.u16(numPoints - 1);
    w.u16(0);
    // Point 0: long deltas (no short, no same) -> 2 bytes each.
    w.u8(0x01);
    // Point 1: X_SAME + Y_SAME set, but X_SHORT/Y_SHORT NOT set -> 0-byte (same).
    w.u8(0x01 | 0x10 | 0x20);
    // x data: point0 long delta (2 bytes); point1 0 bytes.
    w.i16(15);
    // y data: point0 long delta; point1 0 bytes.
    w.i16(15);
    return w.toArray();
}

// ── Compound glyph builder ──────────────────────────────────────────────

/** Compound glyph: one component, byte args (ARGS_ARE_XY), no scale. */
function compoundGlyphByteArgs(): number[] {
    const w = new ByteWriter();
    w.i16(-1); // numberOfContours -> compound
    w.i16(-10).i16(-10).i16(110).i16(110); // bbox
    // Component 0: flags = ARGS_ARE_XY_VALUES (no MORE_COMPONENTS, no WORDS, no scale)
    w.u16(0x0002); // flags
    w.u16(1); // glyphIndex
    w.u8(20 & 0xff).u8(30 & 0xff); // int8 xOff,yOff
    return w.toArray();
}

/** Compound glyph: word args + 2x2 transform + a second component. */
function compoundGlyphWordArgs(): number[] {
    const w = new ByteWriter();
    w.i16(-1);
    w.i16(-10).i16(-10).i16(200).i16(200);
    // Component 0: WORDS | ARGS_ARE_XY | TWO_BY_TWO | MORE_COMPONENTS
    w.u16(0x0001 | 0x0002 | 0x0080 | 0x0020);
    w.u16(2); // glyphIndex
    w.i16(40).i16(50); // word args
    w.i16(0).i16(0).i16(0).i16(0); // 4 x F2Dot14 (2x2)
    // Component 1: ARGS_ARE_XY | WE_HAVE_A_SCALE, no MORE_COMPONENTS
    w.u16(0x0002 | 0x0008);
    w.u16(3);
    w.u8(5 & 0xff).u8(7 & 0xff); // byte args
    w.i16(0); // 1 x F2Dot14 scale
    return w.toArray();
}

/** Compound glyph component with X_AND_Y_SCALE flag. */
function compoundGlyphXYScale(): number[] {
    const w = new ByteWriter();
    w.i16(-1);
    w.i16(0).i16(0).i16(100).i16(100);
    // ARGS_ARE_XY | WE_HAVE_AN_X_AND_Y_SCALE
    w.u16(0x0002 | 0x0040);
    w.u16(1);
    w.u8(10 & 0xff).u8(20 & 0xff);
    w.i16(0).i16(0); // 2 x F2Dot14
    return w.toArray();
}

/** Compound glyph where ARGS_ARE_XY is NOT set (point-matching args). */
function compoundGlyphNoXY(): number[] {
    const w = new ByteWriter();
    w.i16(-1);
    w.i16(0).i16(0).i16(100).i16(100);
    w.u16(0x0000); // no flags at all
    w.u16(1);
    w.u8(1).u8(2); // point indices (not scaled)
    return w.toArray();
}

// ── Composite font builder for the happy path ───────────────────────────

interface FontOptions {
    unitsPerEm?: number;
    indexToLocFormat?: number;
    ascender?: number;
    descender?: number;
    numberOfHMetrics?: number;
    advanceWidths?: number[];
    numGlyphs?: number;
    glyphs?: number[][];
    cmapSubtables?: { platformID: number; encodingID: number; data: number[] }[];
    longLoca?: boolean;
    omit?: string[];
    includeCmap?: boolean;
    includeGlyfLoca?: boolean;
    includeHmtx?: boolean;
}

function buildTtf(opts: FontOptions = {}): ArrayBuffer {
    const glyphs = opts.glyphs ?? [
        [], // glyph 0: empty (.notdef)
        simpleGlyph([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
        ]),
    ];
    const numGlyphs = opts.numGlyphs ?? glyphs.length;
    const advanceWidths = opts.advanceWidths ?? [500];
    const numberOfHMetrics = opts.numberOfHMetrics ?? advanceWidths.length;

    // Build glyf + loca.
    const glyfWriter = new ByteWriter();
    const locaOffsets: number[] = [0];
    for (const g of glyphs) {
        glyfWriter.raw(g);
        // glyf entries must be 2-byte aligned for loca short format.
        while (glyfWriter.length % 2 !== 0) glyfWriter.u8(0);
        locaOffsets.push(glyfWriter.length);
    }

    const tables: TableSpec[] = [];
    const omit = new Set(opts.omit ?? []);

    if (!omit.has('head')) {
        tables.push({ tag: 'head', data: headTable({ unitsPerEm: opts.unitsPerEm, indexToLocFormat: opts.longLoca ? 1 : (opts.indexToLocFormat ?? 0) }) });
    }
    if (!omit.has('hhea')) {
        tables.push({ tag: 'hhea', data: hheaTable({ ascender: opts.ascender, descender: opts.descender, numberOfHMetrics }) });
    }
    if (!omit.has('maxp')) {
        tables.push({ tag: 'maxp', data: maxpTable(numGlyphs) });
    }
    if (!omit.has('hmtx') && (opts.includeHmtx ?? true)) {
        tables.push({ tag: 'hmtx', data: hmtxTable(advanceWidths) });
    }
    if (!omit.has('cmap') && (opts.includeCmap ?? true)) {
        const subs = opts.cmapSubtables ?? [{ platformID: 3, encodingID: 1, data: cmapFormat4Subtable() }];
        tables.push({ tag: 'cmap', data: cmapTable(subs) });
    }
    if (!omit.has('glyf') && (opts.includeGlyfLoca ?? true)) {
        tables.push({ tag: 'glyf', data: glyfWriter.toArray() });
        const loca = opts.longLoca
            ? locaLong(locaOffsets)
            : locaShort(locaOffsets.map((o) => o / 2));
        tables.push({ tag: 'loca', data: loca });
    }

    return buildFont(tables);
}

describe('TtfFont', () => {
    describe('table directory & required tables', () => {
        it('parses a minimal valid font and exposes head/hhea/maxp metrics', () => {
            const font = new TtfFont(buildTtf({ unitsPerEm: 2048, ascender: 1900, descender: -500 }));
            expect(font.unitsPerEm).toBe(2048);
            expect(font.ascender).toBe(1900);
            expect(font.descender).toBe(-500);
            expect(font.numGlyphs).toBe(2);
        });

        it('throws if the head table is missing', () => {
            expect(() => new TtfFont(buildTtf({ omit: ['head'] }))).toThrow('missing head table');
        });

        it('throws if the hhea table is missing', () => {
            expect(() => new TtfFont(buildTtf({ omit: ['hhea'] }))).toThrow('missing hhea table');
        });

        it('throws if the maxp table is missing', () => {
            expect(() => new TtfFont(buildTtf({ omit: ['maxp'] }))).toThrow('missing maxp table');
        });

        it('handles a truncated header (< 12 bytes) by producing no tables', () => {
            const buf = new Uint8Array([0, 1, 0, 0, 0, 1]).buffer;
            expect(() => new TtfFont(buf)).toThrow('missing head table');
        });

        it('stops parsing table records that exceed the buffer length', () => {
            // numTables claims 5 but buffer only has room for the header + a few bytes.
            const w = new ByteWriter();
            w.u32(0x00010000).u16(5).u16(0).u16(0).u16(0);
            // only 8 bytes of record data, not enough for one full 16-byte record.
            w.u32(0).u32(0);
            expect(() => new TtfFont(new Uint8Array(w.toArray()).buffer)).toThrow('missing head table');
        });
    });

    describe('hmtx / advance widths', () => {
        it('returns advance widths for explicit metrics', () => {
            const font = new TtfFont(buildTtf({ advanceWidths: [600], numberOfHMetrics: 1, numGlyphs: 2 }));
            expect(font.getAdvanceWidth(0)).toBe(600);
        });

        it('reuses the last advance width for glyphs beyond numberOfHMetrics', () => {
            const font = new TtfFont(buildTtf({
                advanceWidths: [600],
                numberOfHMetrics: 1,
                glyphs: [[], simpleGlyph([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])],
                numGlyphs: 2,
            }));
            // glyph 1 is beyond numberOfHMetrics=1 -> reuses last width 600.
            expect(font.getAdvanceWidth(1)).toBe(600);
        });

        it('returns 0 for an unknown glyph id', () => {
            const font = new TtfFont(buildTtf());
            expect(font.getAdvanceWidth(999)).toBe(0);
        });

        it('returns an empty advance-width map when hmtx is absent', () => {
            const font = new TtfFont(buildTtf({ includeHmtx: false }));
            expect(font.getAdvanceWidth(0)).toBe(0);
        });

        it('exposes glyph metrics via getGlyphMetrics', () => {
            const font = new TtfFont(buildTtf({ advanceWidths: [712], numberOfHMetrics: 1 }));
            const m = font.getGlyphMetrics(0);
            expect(m.advanceWidth).toBe(712);
            expect(m.index).toBe(0);
        });
    });

    describe('cmap parsing', () => {
        it('maps characters using a format 4 subtable (idRangeOffset = 0)', () => {
            const font = new TtfFont(buildTtf());
            expect(font.charToGlyphIndex(65)).toBe(1); // 'A'
            expect(font.charToGlyphIndex(66)).toBe(2); // 'B'
            expect(font.charToGlyphIndex(67)).toBe(3); // 'C'
        });

        it('returns 0 (.notdef) for unmapped codepoints', () => {
            const font = new TtfFont(buildTtf());
            expect(font.charToGlyphIndex(0x9999)).toBe(0);
        });

        it('maps characters using a format 4 subtable with idRangeOffset != 0', () => {
            const font = new TtfFont(buildTtf({
                cmapSubtables: [{ platformID: 3, encodingID: 1, data: cmapFormat4WithRangeOffset() }],
            }));
            expect(font.charToGlyphIndex(65)).toBe(5); // via glyphIdArray
            expect(font.charToGlyphIndex(66)).toBe(0); // glyphIdArray entry 0 -> unmapped
        });

        it('maps astral characters using a format 12 subtable', () => {
            const font = new TtfFont(buildTtf({
                cmapSubtables: [{ platformID: 3, encodingID: 10, data: cmapFormat12Subtable() }],
            }));
            expect(font.charToGlyphIndex(0x1f600)).toBe(7);
            expect(font.charToGlyphIndex(0x1f601)).toBe(8);
        });

        it('prefers a format 12 Unicode subtable over a format 4 one', () => {
            const font = new TtfFont(buildTtf({
                cmapSubtables: [
                    { platformID: 3, encodingID: 1, data: cmapFormat4Subtable() },
                    { platformID: 3, encodingID: 10, data: cmapFormat12Subtable() },
                ],
            }));
            // Format 12 wins -> astral chars map, but BMP from format 4 is gone.
            expect(font.charToGlyphIndex(0x1f600)).toBe(7);
            expect(font.charToGlyphIndex(65)).toBe(0);
        });

        it('returns an empty map when cmap is absent', () => {
            const font = new TtfFont(buildTtf({ includeCmap: false }));
            expect(font.charToGlyphIndex(65)).toBe(0);
        });

        it('returns an empty map when no recognised Unicode subtable exists', () => {
            // platform 1 (Macintosh) format 4 -> score 0 -> not selected.
            const font = new TtfFont(buildTtf({
                cmapSubtables: [{ platformID: 1, encodingID: 0, data: cmapFormat4Subtable() }],
            }));
            expect(font.charToGlyphIndex(65)).toBe(0);
        });

        it('provides charToGlyphMetrics convenience accessor', () => {
            const font = new TtfFont(buildTtf({ advanceWidths: [500, 0], numberOfHMetrics: 2 }));
            const metrics = font.charToGlyphMetrics(65);
            expect(metrics.index).toBe(1);
        });
    });

    describe('loca / raw glyph extraction', () => {
        it('returns raw glyph bytes for a non-empty glyph (short loca)', () => {
            const font = new TtfFont(buildTtf());
            const raw = font.getRawGlyph(1);
            expect(raw).not.toBeNull();
            expect(raw!.length).toBeGreaterThan(0);
            // numberOfContours is the first i16 and should be 1 for our simple glyph.
            const view = new DataView(raw!.buffer, raw!.byteOffset, raw!.byteLength);
            expect(view.getInt16(0, false)).toBe(1);
        });

        it('returns raw glyph bytes using the long loca format', () => {
            const font = new TtfFont(buildTtf({ longLoca: true }));
            const raw = font.getRawGlyph(1);
            expect(raw).not.toBeNull();
        });

        it('returns null for an empty glyph (start === end)', () => {
            const font = new TtfFont(buildTtf());
            expect(font.getRawGlyph(0)).toBeNull(); // .notdef is empty
        });

        it('returns null for a negative glyph id', () => {
            const font = new TtfFont(buildTtf());
            expect(font.getRawGlyph(-1)).toBeNull();
        });

        it('returns null for a glyph id beyond the loca table', () => {
            const font = new TtfFont(buildTtf());
            expect(font.getRawGlyph(99)).toBeNull();
        });

        it('returns an empty offsets array when glyf/loca are missing', () => {
            const font = new TtfFont(buildTtf({ includeGlyfLoca: false }));
            expect(font.getRawGlyph(0)).toBeNull();
            expect(font.getRawGlyph(1)).toBeNull();
        });
    });

    describe('scaleRawGlyph — simple glyphs', () => {
        it('returns the same array when scale is ~1 (scaleRawGlyphX shortcut)', () => {
            const font = new TtfFont(buildTtf());
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyphX(raw, 1);
            expect(scaled).toBe(raw); // identity reference
        });

        it('returns input unchanged for buffers shorter than 2 bytes', () => {
            const font = new TtfFont(buildTtf());
            const tiny = new Uint8Array([5]);
            expect(font.scaleRawGlyph(tiny, 2)).toBe(tiny);
        });

        it('scales long-coordinate x-deltas and updates the bounding box', () => {
            const font = new TtfFont(buildTtf());
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyphX(raw, 2);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            // bbox xMax was 100 -> 200 after 2x scale.
            expect(view.getInt16(6, false)).toBe(200);
            expect(scaled).not.toBe(raw);
        });

        it('skips x-coordinates when only the y-axis is scaled (scaleX ~ 1)', () => {
            // scaleX = 1 -> skipCoordinates path for x; scaleY = 2 -> scale y.
            const font = new TtfFont(buildTtf());
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 1, 2);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            expect(view.getInt16(6, false)).toBe(100); // xMax unchanged
            expect(view.getInt16(8, false)).toBe(200); // yMax 100*2
        });

        it('skips short-vector and same x-coords when only y is scaled', () => {
            // Exercise skipCoordinates over SHORT, LONG and SAME flag combinations.
            const font = new TtfFont(buildTtf({ glyphs: [[], simpleGlyphShort()] }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 1, 2);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            expect(view.getInt16(8, false)).toBe(100); // yMax 50*2
        });

        it('skips same-as-previous x-coords when only y is scaled', () => {
            const font = new TtfFont(buildTtf({ glyphs: [[], simpleGlyphWithSame()] }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 1, 2);
            expect(scaled.length).toBe(raw.length);
        });

        it('scales both axes when given separate X and Y factors', () => {
            const font = new TtfFont(buildTtf());
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 3, 2);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            expect(view.getInt16(6, false)).toBe(300); // xMax 100*3
            expect(view.getInt16(8, false)).toBe(200); // yMax 100*2
        });

        it('handles short-vector coordinates with a REPEAT flag run', () => {
            const font = new TtfFont(buildTtf({
                glyphs: [[], simpleGlyphShort()],
            }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 2, 2);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            // bbox xMax 50 -> 100.
            expect(view.getInt16(6, false)).toBe(100);
        });

        it('handles a negative short coordinate (flips the SAME sign bit)', () => {
            // Build a short glyph whose x delta is negative: SHORT set, SAME (sign) clear.
            const w = new ByteWriter();
            w.i16(1); // contours
            w.i16(-50).i16(0).i16(0).i16(50); // bbox
            w.u16(0); // endPts -> 1 point
            w.u16(0); // instructionLength
            w.u8(0x01 | 0x02 | 0x04); // on-curve + X_SHORT + Y_SHORT, SAME bits clear -> negative
            w.u8(10); // x magnitude (negative because SAME clear)
            w.u8(5); // y magnitude (negative)
            const font = new TtfFont(buildTtf({ glyphs: [[], w.toArray()] }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 2, 2);
            // Should not throw; result preserves the SHORT layout length.
            expect(scaled.length).toBe(raw.length);
        });

        it('handles same-as-previous (0-byte) coordinates', () => {
            const font = new TtfFont(buildTtf({ glyphs: [[], simpleGlyphWithSame()] }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 2, 2);
            expect(scaled.length).toBe(raw.length);
        });

        it('returns the result unchanged for a zero-contour glyph (numberOfContours <= 0)', () => {
            // numberOfContours = 0 -> scaleSimpleGlyph early-returns after bbox copy.
            const w = new ByteWriter();
            w.i16(0); // numberOfContours = 0
            w.i16(0).i16(0).i16(10).i16(10);
            // pad to >= 12 bytes
            w.u16(0).u16(0);
            const font = new TtfFont(buildTtf({ glyphs: [[], w.toArray()] }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 2, 2);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            expect(view.getInt16(0, false)).toBe(0);
        });

        it('returns srcData unchanged when simple glyph data is < 12 bytes', () => {
            // numberOfContours >= 0 path but too few bytes.
            const tiny = new Uint8Array([0, 1, 0, 0, 0, 0]); // contours=1, then 4 bytes
            const font = new TtfFont(buildTtf());
            const scaled = font.scaleRawGlyph(tiny, 2);
            expect(scaled).toBe(tiny);
        });

        it('clamps scaled coordinates that overflow i16 range', () => {
            // Large coordinates * large scale -> clamp to 32767.
            const font = new TtfFont(buildTtf({
                glyphs: [[], simpleGlyph(
                    [{ x: 0, y: 0 }, { x: 30000, y: 30000 }],
                    { xMin: 0, yMin: 0, xMax: 30000, yMax: 30000 },
                )],
            }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 4, 4);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            expect(view.getInt16(6, false)).toBe(32767); // xMax clamped
        });
    });

    describe('scaleRawGlyph — compound glyphs', () => {
        it('scales a compound glyph with int8 xy args', () => {
            const font = new TtfFont(buildTtf({ glyphs: [[], compoundGlyphByteArgs()] }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 2, 2);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            // numberOfContours stays -1.
            expect(view.getInt16(0, false)).toBe(-1);
            // bbox xMax 110 -> 220.
            expect(view.getInt16(6, false)).toBe(220);
            // arg xOff 20 -> 40 (int8 at byte 14).
            expect(view.getInt8(14)).toBe(40);
        });

        it('scales a compound glyph with i16 word args, 2x2 transform and multiple components', () => {
            const font = new TtfFont(buildTtf({ glyphs: [[], compoundGlyphWordArgs()] }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 2, 2);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            // first component word xOff 40 -> 80 (i16 at byte 14).
            expect(view.getInt16(14, false)).toBe(80);
        });

        it('skips the X_AND_Y_SCALE transform bytes correctly', () => {
            const font = new TtfFont(buildTtf({ glyphs: [[], compoundGlyphXYScale()] }));
            const raw = font.getRawGlyph(1)!;
            const scaled = font.scaleRawGlyph(raw, 2, 2);
            const view = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength);
            expect(view.getInt8(14)).toBe(20); // xOff 10 -> 20
        });

        it('leaves point-matching args untouched when ARGS_ARE_XY is unset', () => {
            const font = new TtfFont(buildTtf({ glyphs: [[], compoundGlyphNoXY()] }));
            const raw = font.getRawGlyph(1)!;
            const before = view14(raw);
            const scaled = font.scaleRawGlyph(raw, 2, 2);
            // point indices are not scaled.
            expect(view14(scaled)).toBe(before);
        });

        it('returns srcData unchanged when compound glyph data is < 12 bytes', () => {
            const tiny = new Uint8Array([0xff, 0xff, 0, 0, 0, 0]); // contours=-1, 4 more bytes
            const font = new TtfFont(buildTtf());
            const scaled = font.scaleRawGlyph(tiny, 2);
            expect(scaled).toBe(tiny);
        });

        it('returns glyph data unchanged for an unknown numberOfContours (< -1)', () => {
            const w = new ByteWriter();
            w.i16(-2); // unknown
            w.i16(0).i16(0).i16(0).i16(0);
            w.u16(0).u16(0);
            const data = new Uint8Array(w.toArray());
            const font = new TtfFont(buildTtf());
            const scaled = font.scaleRawGlyph(data, 2);
            expect(scaled).toBe(data);
        });
    });

    describe('real NotoSans-Regular.ttf fixture', () => {
        it('parses a real font and answers metric/cmap queries', async () => {
            const buffer = await fetch(notoUrl).then((r) => r.arrayBuffer());
            const font = new TtfFont(buffer);

            expect(font.unitsPerEm).toBeGreaterThan(0);
            expect(font.numGlyphs).toBeGreaterThan(100);
            expect(font.ascender).toBeGreaterThan(0);

            const gid = font.charToGlyphIndex('A'.codePointAt(0)!);
            expect(gid).toBeGreaterThan(0);
            expect(font.getAdvanceWidth(gid)).toBeGreaterThan(0);

            const raw = font.getRawGlyph(gid);
            if (raw) {
                const scaled = font.scaleRawGlyphX(raw, 1.5);
                expect(scaled.length).toBe(raw.length);
            }
        });
    });
});

function view14(arr: Uint8Array): number {
    const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    return view.getInt16(14, false);
}
