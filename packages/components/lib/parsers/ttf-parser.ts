/**
 * Minimal TrueType font parser.
 * Replaces opentype.js for reading TTF/OTF font metrics, cmap lookups,
 * and raw glyph data extraction + scaling.
 */

// ── Binary helpers (big-endian — TTF standard) ──────────────────────────

function readU8(d: DataView, o: number): number {
    return d.getUint8(o);
}

function readU16(d: DataView, o: number): number {
    return d.getUint16(o, false);
}

function readI16(d: DataView, o: number): number {
    return d.getInt16(o, false);
}

function readU32(d: DataView, o: number): number {
    return d.getUint32(o, false);
}

function writeI16(d: DataView, o: number, v: number): void {
    d.setInt16(o, v, false);
}

// ── Glyph metrics returned by lookup methods ────────────────────────────

export interface TtfGlyphMetrics {
    readonly advanceWidth: number;
    readonly index: number;
}

// ── Table directory entry ───────────────────────────────────────────────

interface TableRecord {
    readonly offset: number;
    readonly length: number;
}

// ── cmap Format 4 helper: resolve a single glyph ID ────────────────────

function resolveFormat4GlyphId(
    data: DataView, cp: number, startCode: number, delta: number,
    rangeOffset: number, rangeOff: number, segIndex: number,
): number {
    if (rangeOffset === 0) {
        return (cp + delta) & 0xFFFF;
    }
    const glyphIdOff = rangeOff + segIndex * 2 + rangeOffset + (cp - startCode) * 2;
    const gid = readU16(data, glyphIdOff);
    if (gid === 0) return 0;
    return (gid + delta) & 0xFFFF;
}

// ── cmap Format 4 parser ────────────────────────────────────────────────

function parseCmapFormat4(data: DataView, offset: number): Map<number, number> {
    const map = new Map<number, number>();
    const segCount = readU16(data, offset + 6) >> 1;
    const endCodesOff = offset + 14;
    const startCodesOff = endCodesOff + segCount * 2 + 2; // +2 for reservedPad
    const deltaOff = startCodesOff + segCount * 2;
    const rangeOff = deltaOff + segCount * 2;

    for (let i = 0; i < segCount; i++) {
        const endCode = readU16(data, endCodesOff + i * 2);
        const startCode = readU16(data, startCodesOff + i * 2);
        const delta = readI16(data, deltaOff + i * 2);
        const rangeOffset = readU16(data, rangeOff + i * 2);

        if (startCode === 0xFFFF) break;

        for (let cp = startCode; cp <= endCode; cp++) {
            const gid = resolveFormat4GlyphId(data, cp, startCode, delta, rangeOffset, rangeOff, i);
            if (gid !== 0) {
                map.set(cp, gid);
            }
        }
    }
    return map;
}

// ── cmap Format 12 parser ───────────────────────────────────────────────

function parseCmapFormat12(data: DataView, offset: number): Map<number, number> {
    const map = new Map<number, number>();
    const nGroups = readU32(data, offset + 12);
    let pos = offset + 16;

    for (let i = 0; i < nGroups; i++) {
        const startCharCode = readU32(data, pos);
        const endCharCode = readU32(data, pos + 4);
        let startGlyphID = readU32(data, pos + 8);
        pos += 12;

        for (let cp = startCharCode; cp <= endCharCode; cp++) {
            map.set(cp, startGlyphID++);
        }
    }
    return map;
}

// ── Score a cmap subtable for Unicode preference ────────────────────────

function scoreCmapSubtable(platformID: number, encodingID: number, format: number): number {
    if (format === 12) {
        if ((platformID === 3 && encodingID === 10) ||
            (platformID === 0 && encodingID >= 4)) {
            return 12;
        }
    }
    if (format === 4) {
        if ((platformID === 3 && encodingID === 1) ||
            (platformID === 0 && (encodingID === 3 || encodingID <= 4))) {
            return 4;
        }
    }
    return 0;
}

// ── Best Unicode cmap subtable selector ─────────────────────────────────

function parseCmapTable(data: DataView, tableOffset: number, tableLength: number): Map<number, number> {
    const numSubtables = readU16(data, tableOffset + 2);
    let bestOffset = -1;
    let bestFormat = -1;

    for (let i = 0; i < numSubtables; i++) {
        const recOff = tableOffset + 4 + i * 8;
        const platformID = readU16(data, recOff);
        const encodingID = readU16(data, recOff + 2);
        const subtableOffset = tableOffset + readU32(data, recOff + 4);

        if (subtableOffset < tableOffset || subtableOffset >= tableOffset + tableLength) continue;

        const format = readU16(data, subtableOffset);
        const score = scoreCmapSubtable(platformID, encodingID, format);

        if (score > bestFormat) {
            bestOffset = subtableOffset;
            bestFormat = score;
        }
    }

    if (bestFormat === 12 && bestOffset >= 0) return parseCmapFormat12(data, bestOffset);
    if (bestFormat === 4 && bestOffset >= 0) return parseCmapFormat4(data, bestOffset);
    return new Map();
}

// ── Simple glyph flag constants ─────────────────────────────────────────

const X_SHORT_VECTOR = 0x02;
const Y_SHORT_VECTOR = 0x04;
const REPEAT_FLAG = 0x08;
const X_IS_SAME_OR_POSITIVE = 0x10;
const Y_IS_SAME_OR_POSITIVE = 0x20;

// ── Compound glyph flag constants ───────────────────────────────────────

const ARG_1_AND_2_ARE_WORDS = 0x0001;
const ARGS_ARE_XY_VALUES = 0x0002;
const WE_HAVE_A_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const WE_HAVE_A_TWO_BY_TWO = 0x0080;

// ── Parse glyph flags (simple glyphs) ───────────────────────────────────

function parseSimpleGlyphFlags(data: DataView, offset: number, numPoints: number): { flags: Uint8Array; bytesRead: number } {
    const flags = new Uint8Array(numPoints);
    let pos = offset;
    let i = 0;
    while (i < numPoints) {
        const flag = readU8(data, pos++);
        flags[i++] = flag;
        if ((flag & REPEAT_FLAG) !== 0 && i < numPoints) {
            const repeatCount = readU8(data, pos++);
            for (let r = 0; r < repeatCount && i < numPoints; r++) {
                flags[i++] = flag;
            }
        }
    }
    return { flags, bytesRead: pos - offset };
}

// ── Options for scaleSimpleGlyphAxis ────────────────────────────────────

interface ScaleAxisOptions {
    readonly data: Uint8Array;
    readonly view: DataView;
    readonly offset: number;
    readonly flags: Uint8Array;
    readonly numPoints: number;
    readonly shortBit: number;
    readonly sameBit: number;
    readonly scale: number;
}

// ── Scale a 1-byte coordinate and update flag ───────────────────────────

function scaleShortCoordinate(opts: ScaleAxisOptions, pos: number, i: number): void {
    const val = readU8(opts.view, pos);
    const signed = (opts.flags[i] & opts.sameBit) === 0 ? -val : val;
    const scaled = Math.round(signed * opts.scale);
    const absScaled = Math.abs(scaled);
    opts.data[pos] = Math.min(absScaled, 255);
    if (scaled >= 0) {
        opts.flags[i] |= opts.sameBit;
    } else {
        opts.flags[i] &= ~opts.sameBit;
    }
}

// ── Scale a 2-byte signed coordinate ────────────────────────────────────

function scaleLongCoordinate(view: DataView, pos: number, scale: number): void {
    const val = readI16(view, pos);
    const scaled = Math.round(val * scale);
    const clamped = Math.max(-32768, Math.min(32767, scaled));
    writeI16(view, pos, clamped);
}

// ── Scale coordinates in a simple glyph ─────────────────────────────────

function scaleSimpleGlyphAxis(opts: ScaleAxisOptions): number {
    let pos = opts.offset;
    for (let i = 0; i < opts.numPoints; i++) {
        const flag = opts.flags[i];
        if ((flag & opts.shortBit) !== 0) {
            scaleShortCoordinate(opts, pos, i);
            pos += 1;
        } else if ((flag & opts.sameBit) === 0) {
            scaleLongCoordinate(opts.view, pos, opts.scale);
            pos += 2;
        }
        // else: 0-byte delta (same as previous) — no bytes to modify
    }
    return pos;
}

// ── Scale a simple glyph's raw bytes ────────────────────────────────────

function scaleSimpleGlyph(srcData: Uint8Array, scaleX: number, scaleY: number): Uint8Array {
    if (srcData.length < 12) return srcData;

    const result = new Uint8Array(srcData);
    const view = new DataView(result.buffer, result.byteOffset, result.byteLength);

    const numberOfContours = readI16(view, 0);
    if (numberOfContours <= 0) return result;

    // Update bounding box
    const xMin = Math.round(readI16(view, 2) * scaleX);
    const yMin = Math.round(readI16(view, 4) * scaleY);
    const xMax = Math.round(readI16(view, 6) * scaleX);
    const yMax = Math.round(readI16(view, 8) * scaleY);
    writeI16(view, 2, Math.max(-32768, Math.min(32767, xMin)));
    writeI16(view, 4, Math.max(-32768, Math.min(32767, yMin)));
    writeI16(view, 6, Math.max(-32768, Math.min(32767, xMax)));
    writeI16(view, 8, Math.max(-32768, Math.min(32767, yMax)));

    // Read endPtsOfContours to find total number of points
    const lastContourEnd = readU16(view, 10 + (numberOfContours - 1) * 2);
    const numPoints = lastContourEnd + 1;

    // Skip endPtsOfContours + instructionLength + instructions
    const instructionLengthOff = 10 + numberOfContours * 2;
    const instructionLength = readU16(view, instructionLengthOff);
    const flagsOff = instructionLengthOff + 2 + instructionLength;

    // Parse flags
    const { flags, bytesRead: flagsSize } = parseSimpleGlyphFlags(view, flagsOff, numPoints);

    // Scale x-coordinates
    const xDataOff = flagsOff + flagsSize;
    let afterX: number;
    if (Math.abs(scaleX - 1) > 1e-6) {
        afterX = scaleSimpleGlyphAxis({
            data: result, view, offset: xDataOff, flags, numPoints,
            shortBit: X_SHORT_VECTOR, sameBit: X_IS_SAME_OR_POSITIVE, scale: scaleX,
        });
    } else {
        afterX = skipCoordinates(view, xDataOff, flags, numPoints, X_SHORT_VECTOR, X_IS_SAME_OR_POSITIVE);
    }

    // Scale y-coordinates
    if (Math.abs(scaleY - 1) > 1e-6) {
        scaleSimpleGlyphAxis({
            data: result, view, offset: afterX, flags, numPoints,
            shortBit: Y_SHORT_VECTOR, sameBit: Y_IS_SAME_OR_POSITIVE, scale: scaleY,
        });
    }

    return result;
}

// ── Skip coordinates without modifying (to find offset of next axis) ────

function skipCoordinates(
    view: DataView, offset: number, flags: Uint8Array, numPoints: number,
    shortBit: number, sameBit: number,
): number {
    let pos = offset;
    for (let i = 0; i < numPoints; i++) {
        const flag = flags[i];
        if ((flag & shortBit) !== 0) {
            pos += 1;
        } else if ((flag & sameBit) === 0) {
            pos += 2;
        }
        // else: 0 bytes (same as previous)
    }
    return pos;
}

// ── Scale a compound glyph's raw bytes ──────────────────────────────────

function scaleCompoundGlyph(srcData: Uint8Array, scaleX: number, scaleY: number): Uint8Array {
    if (srcData.length < 12) return srcData;

    const result = new Uint8Array(srcData);
    const view = new DataView(result.buffer, result.byteOffset, result.byteLength);

    // Update bounding box (compound glyphs also have a bbox at bytes 2-9)
    const xMin = Math.round(readI16(view, 2) * scaleX);
    const yMin = Math.round(readI16(view, 4) * scaleY);
    const xMax = Math.round(readI16(view, 6) * scaleX);
    const yMax = Math.round(readI16(view, 8) * scaleY);
    writeI16(view, 2, Math.max(-32768, Math.min(32767, xMin)));
    writeI16(view, 4, Math.max(-32768, Math.min(32767, yMin)));
    writeI16(view, 6, Math.max(-32768, Math.min(32767, xMax)));
    writeI16(view, 8, Math.max(-32768, Math.min(32767, yMax)));

    let pos = 10; // past numberOfContours(-1) + bbox
    let hasMore = true;

    while (hasMore && pos + 4 <= result.length) {
        const flags = readU16(view, pos);
        pos += 2;
        // Skip glyphIndex
        pos += 2;

        hasMore = (flags & MORE_COMPONENTS) !== 0;

        if ((flags & ARGS_ARE_XY_VALUES) !== 0) {
            scaleCompoundArgs(view, pos, flags, scaleX, scaleY);
        }

        // Advance past arguments
        pos += (flags & ARG_1_AND_2_ARE_WORDS) === 0 ? 2 : 4;

        // Advance past transformation
        if ((flags & WE_HAVE_A_TWO_BY_TWO) !== 0) {
            pos += 8; // 4 × F2Dot14
        } else if ((flags & WE_HAVE_AN_X_AND_Y_SCALE) !== 0) {
            pos += 4; // 2 × F2Dot14
        } else if ((flags & WE_HAVE_A_SCALE) !== 0) {
            pos += 2; // 1 × F2Dot14
        }
    }

    return result;
}

// ── Scale compound glyph argument offsets ───────────────────────────────

function scaleCompoundArgs(view: DataView, pos: number, flags: number, scaleX: number, scaleY: number): void {
    if ((flags & ARG_1_AND_2_ARE_WORDS) === 0) {
        // Two int8 values: xOffset, yOffset
        const xOff = (view.getInt8(pos));
        const yOff = (view.getInt8(pos + 1));
        view.setInt8(pos, Math.max(-128, Math.min(127, Math.round(xOff * scaleX))));
        view.setInt8(pos + 1, Math.max(-128, Math.min(127, Math.round(yOff * scaleY))));
    } else {
        // Two int16 values: xOffset, yOffset
        const xOff = readI16(view, pos);
        const yOff = readI16(view, pos + 2);
        writeI16(view, pos, Math.max(-32768, Math.min(32767, Math.round(xOff * scaleX))));
        writeI16(view, pos + 2, Math.max(-32768, Math.min(32767, Math.round(yOff * scaleY))));
    }
}

// ── TtfFont: Main exported class ────────────────────────────────────────

export class TtfFont {
    readonly unitsPerEm: number;
    readonly ascender: number;
    readonly descender: number;
    readonly numGlyphs: number;

    private readonly data: DataView;
    private readonly tables: Map<string, TableRecord>;
    private readonly advanceWidths: Map<number, number>;
    private readonly unicodeToGid: Map<number, number>;
    private readonly glyphOffsets: readonly number[];
    private readonly glyfOffset: number;
    private readonly glyfLength: number;

    constructor(buffer: ArrayBuffer | ArrayBufferLike) {
        this.data = new DataView(buffer as ArrayBuffer);
        this.tables = this.parseTableDirectory();

        // Parse required tables
        const head = this.getTableData('head');
        if (!head) throw new Error('TtfFont: missing head table');
        this.unitsPerEm = readU16(this.data, head.offset + 18);
        const indexToLocFormat = readI16(this.data, head.offset + 50);

        const hhea = this.getTableData('hhea');
        if (!hhea) throw new Error('TtfFont: missing hhea table');
        this.ascender = readI16(this.data, hhea.offset + 4);
        this.descender = readI16(this.data, hhea.offset + 6);
        const numberOfHMetrics = readU16(this.data, hhea.offset + 34);

        const maxp = this.getTableData('maxp');
        if (!maxp) throw new Error('TtfFont: missing maxp table');
        this.numGlyphs = readU16(this.data, maxp.offset + 4);

        // Parse hmtx → advance widths
        this.advanceWidths = this.parseHmtx(numberOfHMetrics);

        // Parse cmap → unicode to GID mapping
        const cmapRec = this.getTableData('cmap');
        this.unicodeToGid = cmapRec
            ? parseCmapTable(this.data, cmapRec.offset, cmapRec.length)
            : new Map();

        // Parse loca → glyph offsets
        const locaRec = this.getTableData('loca');
        const glyfRec = this.getTableData('glyf');
        this.glyfOffset = glyfRec?.offset ?? 0;
        this.glyfLength = glyfRec?.length ?? 0;
        this.glyphOffsets = locaRec && glyfRec
            ? this.parseLoca(locaRec, indexToLocFormat)
            : [];
    }

    /** Get advance width for a glyph by its GID. Returns 0 if not found. */
    getAdvanceWidth(gid: number): number {
        return this.advanceWidths.get(gid) ?? 0;
    }

    /** Map a Unicode codepoint to a GID. Returns 0 (.notdef) if unmapped. */
    charToGlyphIndex(codepoint: number): number {
        return this.unicodeToGid.get(codepoint) ?? 0;
    }

    /** Get metrics for a glyph by GID. */
    getGlyphMetrics(gid: number): TtfGlyphMetrics {
        return {
            advanceWidth: this.advanceWidths.get(gid) ?? 0,
            index: gid,
        };
    }

    /** Get metrics by Unicode codepoint (convenience). */
    charToGlyphMetrics(codepoint: number): TtfGlyphMetrics {
        const gid = this.charToGlyphIndex(codepoint);
        return this.getGlyphMetrics(gid);
    }

    /** Get raw glyf table bytes for a glyph. Returns null for empty/missing glyphs. */
    getRawGlyph(gid: number): Uint8Array | null {
        if (gid < 0 || gid >= this.glyphOffsets.length - 1) return null;
        const start = this.glyphOffsets[gid];
        const end = this.glyphOffsets[gid + 1];
        if (start >= end) return null; // empty glyph

        const absStart = this.glyfOffset + start;
        const len = end - start;
        if (absStart + len > this.data.byteLength) return null;

        return new Uint8Array(this.data.buffer, this.data.byteOffset + absStart, len);
    }

    /** Scale x-coordinates in raw glyf data by a horizontal factor. Returns new byte array. */
    scaleRawGlyphX(glyphData: Uint8Array, scaleX: number): Uint8Array {
        if (Math.abs(scaleX - 1) < 1e-6) return glyphData;
        return this.scaleRawGlyph(glyphData, scaleX, 1);
    }

    /** Scale raw glyf data uniformly or with separate X/Y factors. Returns new byte array. */
    scaleRawGlyph(glyphData: Uint8Array, scaleXOrUniform: number, scaleY?: number): Uint8Array {
        if (glyphData.length < 2) return glyphData;

        const sx = scaleXOrUniform;
        const sy = scaleY ?? scaleXOrUniform;

        const view = new DataView(glyphData.buffer, glyphData.byteOffset, glyphData.byteLength);
        const numberOfContours = readI16(view, 0);

        if (numberOfContours >= 0) {
            return scaleSimpleGlyph(glyphData, sx, sy);
        }
        if (numberOfContours === -1) {
            return scaleCompoundGlyph(glyphData, sx, sy);
        }

        // Unknown glyph type — return as-is
        return glyphData;
    }

    // ── Private parsing methods ─────────────────────────────────────────

    private parseTableDirectory(): Map<string, TableRecord> {
        const tables = new Map<string, TableRecord>();

        // Validate minimum header size
        if (this.data.byteLength < 12) return tables;

        const numTables = readU16(this.data, 4);
        let pos = 12;

        for (let i = 0; i < numTables; i++) {
            if (pos + 16 > this.data.byteLength) break;

            const tag = String.fromCodePoint(
                readU8(this.data, pos),
                readU8(this.data, pos + 1),
                readU8(this.data, pos + 2),
                readU8(this.data, pos + 3),
            );
            const offset = readU32(this.data, pos + 8);
            const length = readU32(this.data, pos + 12);
            tables.set(tag, { offset, length });
            pos += 16;
        }

        return tables;
    }

    private getTableData(tag: string): TableRecord | undefined {
        return this.tables.get(tag);
    }

    private parseHmtx(numberOfHMetrics: number): Map<number, number> {
        const hmtxRec = this.getTableData('hmtx');
        if (!hmtxRec) return new Map();

        const widths = new Map<number, number>();
        const off = hmtxRec.offset;
        let lastWidth = 0;

        // First numberOfHMetrics entries: advanceWidth (u16) + lsb (i16)
        for (let i = 0; i < numberOfHMetrics; i++) {
            const w = readU16(this.data, off + i * 4);
            widths.set(i, w);
            lastWidth = w;
        }

        // Remaining glyphs reuse the last advanceWidth
        for (let i = numberOfHMetrics; i < this.numGlyphs; i++) {
            widths.set(i, lastWidth);
        }

        return widths;
    }

    private parseLoca(locaRec: TableRecord, indexToLocFormat: number): number[] {
        const offsets: number[] = [];
        const off = locaRec.offset;

        if (indexToLocFormat === 0) {
            // Short format: uint16 offsets, actual offset = value * 2
            const count = Math.min(this.numGlyphs + 1, Math.floor(locaRec.length / 2));
            for (let i = 0; i < count; i++) {
                offsets.push(readU16(this.data, off + i * 2) * 2);
            }
        } else {
            // Long format: uint32 offsets
            const count = Math.min(this.numGlyphs + 1, Math.floor(locaRec.length / 4));
            for (let i = 0; i < count; i++) {
                offsets.push(readU32(this.data, off + i * 4));
            }
        }

        return offsets;
    }
}
