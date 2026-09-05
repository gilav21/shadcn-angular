/**
 * Minimal TrueType font builder.
 * Creates valid TTF binaries from raw glyph data + metrics.
 * Replaces opentype.js Font/Glyph/Path constructors + toArrayBuffer().
 */

// ── Public interfaces ───────────────────────────────────────────────────

export interface TtfBuilderGlyph {
    readonly unicode: number;
    readonly advanceWidth: number;
    readonly glyphData: Uint8Array;
}

export interface TtfBuilderOptions {
    readonly familyName: string;
    readonly styleName: string;
    readonly unitsPerEm: number;
    readonly ascender: number;
    readonly descender: number;
    readonly glyphs: readonly TtfBuilderGlyph[];
}

// ── Binary write helpers (big-endian) ───────────────────────────────────

function writeU8(buf: DataView, off: number, v: number): void {
    buf.setUint8(off, v);
}

function writeU16(buf: DataView, off: number, v: number): void {
    buf.setUint16(off, v, false);
}

function writeI16(buf: DataView, off: number, v: number): void {
    buf.setInt16(off, v, false);
}

function writeU32(buf: DataView, off: number, v: number): void {
    buf.setUint32(off, v, false);
}

function writeI32(buf: DataView, off: number, v: number): void {
    buf.setInt32(off, v, false);
}

function writeTag(buf: DataView, off: number, tag: string): void {
    for (let i = 0; i < 4; i++) {
        writeU8(buf, off + i, tag.codePointAt(i) ?? 0);
    }
}

// ── Checksum computation ────────────────────────────────────────────────

function computeChecksum(data: Uint8Array): number {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let sum = 0;
    const len = Math.ceil(data.length / 4) * 4;
    for (let i = 0; i < len; i += 4) {
        if (i + 4 <= data.length) {
            sum = (sum + view.getUint32(i, false)) >>> 0;
        } else {
            // Pad with zeros for the last partial word
            let word = 0;
            for (let j = 0; j < 4; j++) {
                word = (word << 8) | (i + j < data.length ? data[i + j] : 0);
            }
            sum = (sum + word) >>> 0;
        }
    }
    return sum;
}

// ── Pad to 4-byte boundary ──────────────────────────────────────────────

function pad4(data: Uint8Array): Uint8Array {
    const rem = data.length % 4;
    if (rem === 0) return data;
    const padded = new Uint8Array(data.length + (4 - rem));
    padded.set(data);
    return padded;
}

// ── Table builders ──────────────────────────────────────────────────────

function buildHeadTable(unitsPerEm: number, locaFormat: number): Uint8Array {
    const buf = new Uint8Array(54);
    const v = new DataView(buf.buffer);

    writeU32(v, 0, 0x00010000);   // version 1.0
    writeU32(v, 4, 0x00005000);   // fontRevision 0.5
    writeU32(v, 8, 0x00000000);   // checksumAdjust (filled later)
    writeU32(v, 12, 0x5F0F3CF5);  // magicNumber
    writeU16(v, 16, 0x000B);      // flags: baseline at y=0 + lsb at x=0 + force ppem to int
    writeU16(v, 18, unitsPerEm);
    // created/modified timestamps: 0 (epoch)
    writeI16(v, 36, -1000);       // xMin (placeholder)
    writeI16(v, 38, -500);        // yMin (placeholder)
    writeI16(v, 40, 3000);        // xMax (placeholder)
    writeI16(v, 42, 2000);        // yMax (placeholder)
    writeU16(v, 44, 0);           // macStyle
    writeU16(v, 46, 8);           // lowestRecPPEM
    writeI16(v, 48, 2);           // fontDirectionHint: mixed
    writeI16(v, 50, locaFormat);  // indexToLocFormat
    writeI16(v, 52, 0);           // glyphDataFormat

    return buf;
}

function buildHheaTable(ascender: number, descender: number, numGlyphs: number): Uint8Array {
    const buf = new Uint8Array(36);
    const v = new DataView(buf.buffer);

    writeU32(v, 0, 0x00010000);    // version 1.0
    writeI16(v, 4, ascender);
    writeI16(v, 6, descender);
    writeI16(v, 8, 0);             // lineGap
    writeU16(v, 10, 0x7FFF);       // advanceWidthMax (placeholder)
    writeI16(v, 12, 0);            // minLeftSideBearing
    writeI16(v, 14, 0);            // minRightSideBearing
    writeI16(v, 16, 0x7FFF);       // xMaxExtent (placeholder)
    writeI16(v, 18, 1);            // caretSlopeRise
    writeI16(v, 20, 0);            // caretSlopeRun
    // 5 reserved int16s = 0 (bytes 22-31)
    writeI16(v, 32, 0);            // metricDataFormat
    writeU16(v, 34, numGlyphs);    // numberOfHMetrics

    return buf;
}

function buildHmtxTable(glyphs: readonly TtfBuilderGlyph[]): Uint8Array {
    const buf = new Uint8Array(glyphs.length * 4);
    const v = new DataView(buf.buffer);

    for (let i = 0; i < glyphs.length; i++) {
        writeU16(v, i * 4, Math.max(0, Math.round(glyphs[i].advanceWidth)));
        writeI16(v, i * 4 + 2, 0); // leftSideBearing
    }

    return buf;
}

function buildMaxpTable(numGlyphs: number): Uint8Array {
    const buf = new Uint8Array(32);
    const v = new DataView(buf.buffer);

    writeU32(v, 0, 0x00010000);   // version 1.0
    writeU16(v, 4, numGlyphs);
    writeU16(v, 6, 0);            // maxPoints (placeholder)
    writeU16(v, 8, 0);            // maxContours
    writeU16(v, 10, 0);           // maxCompositePoints
    writeU16(v, 12, 0);           // maxCompositeContours
    writeU16(v, 14, 1);           // maxZones
    writeU16(v, 16, 0);           // maxTwilightPoints
    writeU16(v, 18, 0);           // maxStorage
    writeU16(v, 20, 0);           // maxFunctionDefs
    writeU16(v, 22, 0);           // maxInstructionDefs
    writeU16(v, 24, 0);           // maxStackElements
    writeU16(v, 26, 0);           // maxSizeOfInstructions
    writeU16(v, 28, 0);           // maxComponentElements
    writeU16(v, 30, 0);           // maxComponentDepth

    return buf;
}

// ── cmap Format 4 builder ───────────────────────────────────────────────

interface CmapSegment {
    readonly startCode: number;
    readonly endCode: number;
    readonly delta: number;
}

function buildCmapSegments(glyphs: readonly TtfBuilderGlyph[]): readonly CmapSegment[] {
    // Build sorted unicode → GID pairs (GID = index in glyphs array)
    const pairs: Array<{ unicode: number; gid: number }> = [];
    for (let i = 0; i < glyphs.length; i++) {
        if (glyphs[i].unicode > 0 && glyphs[i].unicode <= 0xFFFF) {
            pairs.push({ unicode: glyphs[i].unicode, gid: i });
        }
    }
    pairs.sort((a, b) => a.unicode - b.unicode);

    if (pairs.length === 0) {
        return [{ startCode: 0xFFFF, endCode: 0xFFFF, delta: 1 }];
    }

    // Group into contiguous segments with constant delta
    const segments: CmapSegment[] = [];
    let segStart = pairs[0].unicode;
    let segDelta = pairs[0].gid - pairs[0].unicode;
    let prevUnicode = pairs[0].unicode;

    for (let i = 1; i < pairs.length; i++) {
        const { unicode, gid } = pairs[i];
        const delta = gid - unicode;
        if (unicode === prevUnicode + 1 && delta === segDelta) {
            prevUnicode = unicode;
        } else {
            segments.push({ startCode: segStart, endCode: prevUnicode, delta: segDelta });
            segStart = unicode;
            segDelta = delta;
            prevUnicode = unicode;
        }
    }
    segments.push(
        { startCode: segStart, endCode: prevUnicode, delta: segDelta },
        { startCode: 0xFFFF, endCode: 0xFFFF, delta: 1 },
    );
    return segments;
}

function buildCmapTable(glyphs: readonly TtfBuilderGlyph[]): Uint8Array {
    const segments = buildCmapSegments(glyphs);
    const segCount = segments.length;

    // Format 4 subtable size
    const subtableSize = 16 + segCount * 8; // 14 header + 2 reservedPad + 4 arrays of segCount * 2
    const tableSize = 4 + 8 + subtableSize; // cmap header (4) + encoding record (8) + subtable

    const buf = new Uint8Array(tableSize);
    const v = new DataView(buf.buffer);

    // cmap header
    writeU16(v, 0, 0);            // version
    writeU16(v, 2, 1);            // numTables

    // Encoding record: platform 3 (Windows), encoding 1 (Unicode BMP)
    writeU16(v, 4, 3);            // platformID
    writeU16(v, 6, 1);            // encodingID
    writeU32(v, 8, 12);           // offset to subtable

    // Format 4 subtable
    const s = 12; // subtable start
    writeU16(v, s, 4);            // format
    writeU16(v, s + 2, subtableSize); // length
    writeU16(v, s + 4, 0);        // language

    const segCountX2 = segCount * 2;
    const searchRange = 2 * Math.pow(2, Math.floor(Math.log2(segCount)));
    const entrySelector = Math.floor(Math.log2(segCount));
    const rangeShift = segCountX2 - searchRange;

    writeU16(v, s + 6, segCountX2);
    writeU16(v, s + 8, searchRange);
    writeU16(v, s + 10, entrySelector);
    writeU16(v, s + 12, rangeShift);

    const endCodeOff = s + 14;
    const reservedPadOff = endCodeOff + segCount * 2;
    const startCodeOff = reservedPadOff + 2;
    const deltaOff = startCodeOff + segCount * 2;
    const rangeOff = deltaOff + segCount * 2;

    writeU16(v, reservedPadOff, 0); // reservedPad

    for (let i = 0; i < segCount; i++) {
        const seg = segments[i];
        writeU16(v, endCodeOff + i * 2, seg.endCode);
        writeU16(v, startCodeOff + i * 2, seg.startCode);
        writeI16(v, deltaOff + i * 2, seg.delta & 0xFFFF);
        writeU16(v, rangeOff + i * 2, 0); // idRangeOffset = 0 (all delta-based)
    }

    return buf;
}

// ── loca + glyf builder ─────────────────────────────────────────────────

interface LocaGlyfResult {
    readonly loca: Uint8Array;
    readonly glyf: Uint8Array;
    readonly locaFormat: number; // 0=short, 1=long
}

function buildLocaGlyf(glyphs: readonly TtfBuilderGlyph[]): LocaGlyfResult {
    // Calculate total glyf size (each glyph padded to 2-byte boundary for short loca)
    let totalSize = 0;
    const paddedSizes: number[] = [];
    for (const g of glyphs) {
        const padded = g.glyphData.length % 2 === 0 ? g.glyphData.length : g.glyphData.length + 1;
        paddedSizes.push(padded);
        totalSize += padded;
    }

    // Build glyf table
    const glyf = new Uint8Array(totalSize);
    const offsets: number[] = [];
    let pos = 0;
    for (let i = 0; i < glyphs.length; i++) {
        offsets.push(pos);
        if (glyphs[i].glyphData.length > 0) {
            glyf.set(glyphs[i].glyphData, pos);
        }
        pos += paddedSizes[i];
    }
    offsets.push(pos); // final offset (end of last glyph)

    // Decide loca format
    const useShort = totalSize < 131070; // max for short format (0xFFFF * 2)
    const locaFormat = useShort ? 0 : 1;

    // Build loca table
    const locaSize = useShort ? offsets.length * 2 : offsets.length * 4;
    const loca = new Uint8Array(locaSize);
    const locaView = new DataView(loca.buffer);

    for (let i = 0; i < offsets.length; i++) {
        if (useShort) {
            writeU16(locaView, i * 2, offsets[i] >> 1);
        } else {
            writeU32(locaView, i * 4, offsets[i]);
        }
    }

    return { loca, glyf, locaFormat };
}

// ── name table builder ──────────────────────────────────────────────────

function buildNameTable(familyName: string, styleName: string): Uint8Array {
    // We write 6 name records (IDs 0-5) all with platform 3 encoding 1 (Windows Unicode BMP)
    const names = [
        familyName,                              // 0: copyright (reuse family)
        familyName,                              // 1: fontFamily
        styleName,                               // 2: fontSubfamily
        `${familyName}-${styleName}`,            // 3: uniqueID
        `${familyName} ${styleName}`,            // 4: fullName
        'Version 1.0',                           // 5: version
    ];

    // Encode strings as UTF-16BE
    const encodedStrings: Uint8Array[] = [];
    let totalStringBytes = 0;
    for (const name of names) {
        const encoded = new Uint8Array(name.length * 2);
        const ev = new DataView(encoded.buffer);
        for (let i = 0; i < name.length; i++) {
            writeU16(ev, i * 2, name.codePointAt(i) ?? 0);
        }
        encodedStrings.push(encoded);
        totalStringBytes += encoded.length;
    }

    const numRecords = names.length;
    const headerSize = 6;
    const recordSize = 12 * numRecords;
    const storageOffset = headerSize + recordSize;
    const tableSize = storageOffset + totalStringBytes;

    const buf = new Uint8Array(tableSize);
    const v = new DataView(buf.buffer);

    // Header
    writeU16(v, 0, 0);               // format
    writeU16(v, 2, numRecords);       // count
    writeU16(v, 4, storageOffset);    // stringOffset

    // Records
    let stringPos = 0;
    for (let i = 0; i < numRecords; i++) {
        const recOff = headerSize + i * 12;
        writeU16(v, recOff, 3);                       // platformID: Windows
        writeU16(v, recOff + 2, 1);                   // encodingID: Unicode BMP
        writeU16(v, recOff + 4, 0x0409);              // languageID: English US
        writeU16(v, recOff + 6, i);                   // nameID
        writeU16(v, recOff + 8, encodedStrings[i].length); // length
        writeU16(v, recOff + 10, stringPos);          // offset
        stringPos += encodedStrings[i].length;
    }

    // String data
    let strOff = storageOffset;
    for (const encoded of encodedStrings) {
        buf.set(encoded, strOff);
        strOff += encoded.length;
    }

    return buf;
}

// ── OS/2 table builder ──────────────────────────────────────────────────

function buildOs2Table(ascender: number, descender: number, unitsPerEm: number): Uint8Array {
    const buf = new Uint8Array(78);
    const v = new DataView(buf.buffer);

    writeU16(v, 0, 0x0004);           // version 4
    writeI16(v, 2, Math.round(unitsPerEm * 0.5)); // xAvgCharWidth
    writeU16(v, 4, 400);              // usWeightClass: Normal
    writeU16(v, 6, 5);                // usWidthClass: Medium
    writeU16(v, 8, 0);                // fsType: installable embedding
    writeI16(v, 10, Math.round(unitsPerEm * 0.6)); // ySubscriptXSize
    writeI16(v, 12, Math.round(unitsPerEm * 0.7)); // ySubscriptYSize
    writeI16(v, 14, 0);               // ySubscriptXOffset
    writeI16(v, 16, Math.round(unitsPerEm * 0.14)); // ySubscriptYOffset
    writeI16(v, 18, Math.round(unitsPerEm * 0.6)); // ySuperscriptXSize
    writeI16(v, 20, Math.round(unitsPerEm * 0.7)); // ySuperscriptYSize
    writeI16(v, 22, 0);               // ySuperscriptXOffset
    writeI16(v, 24, Math.round(unitsPerEm * 0.48)); // ySuperscriptYOffset
    writeI16(v, 26, Math.round(unitsPerEm * 0.05)); // yStrikeoutSize
    writeI16(v, 28, Math.round(unitsPerEm * 0.3)); // yStrikeoutPosition
    writeI16(v, 30, 0);               // sFamilyClass
    // panose: 10 bytes at offset 32 (all zeros = any)
    // ulUnicodeRange: 16 bytes at offset 42 (all zeros)
    // achVendID: 4 bytes at offset 58 (all zeros)
    writeU16(v, 62, 0x0040);          // fsSelection: REGULAR
    writeU16(v, 64, 0x0020);          // usFirstCharIndex: space
    writeU16(v, 66, 0xFFFF);          // usLastCharIndex
    writeI16(v, 68, ascender);         // sTypoAscender
    writeI16(v, 70, descender);        // sTypoDescender
    writeI16(v, 72, 0);               // sTypoLineGap
    writeU16(v, 74, Math.max(0, ascender)); // usWinAscent
    writeU16(v, 76, Math.max(0, -descender)); // usWinDescent

    return buf;
}

// ── post table builder ──────────────────────────────────────────────────

function buildPostTable(): Uint8Array {
    const buf = new Uint8Array(32);
    const v = new DataView(buf.buffer);

    writeU32(v, 0, 0x00030000);   // version 3.0 (no glyph names)
    writeI32(v, 4, 0);            // italicAngle
    writeI16(v, 8, -100);         // underlinePosition
    writeI16(v, 10, 50);          // underlineThickness
    writeU32(v, 12, 0);           // isFixedPitch
    // minMemType42/maxMemType42/minMemType1/maxMemType1: 0

    return buf;
}

// ── Font assembly ───────────────────────────────────────────────────────

interface TableEntry {
    readonly tag: string;
    readonly data: Uint8Array;
}

function assembleFont(tables: readonly TableEntry[]): Uint8Array {
    const numTables = tables.length;
    const searchRange = Math.pow(2, Math.floor(Math.log2(numTables))) * 16;
    const entrySelector = Math.floor(Math.log2(numTables));
    const rangeShift = numTables * 16 - searchRange;

    const headerSize = 12;
    const directorySize = numTables * 16;
    let dataOffset = headerSize + directorySize;

    // Pad data offset to 4-byte boundary
    dataOffset = (dataOffset + 3) & ~3;

    // Calculate total size
    let totalSize = dataOffset;
    const paddedTables: Uint8Array[] = [];
    for (const table of tables) {
        const padded = pad4(table.data);
        paddedTables.push(padded);
        totalSize += padded.length;
    }

    const result = new Uint8Array(totalSize);
    const view = new DataView(result.buffer);

    // Offset table
    writeU32(view, 0, 0x00010000); // sfVersion: TrueType
    writeU16(view, 4, numTables);
    writeU16(view, 6, searchRange);
    writeU16(view, 8, entrySelector);
    writeU16(view, 10, rangeShift);

    // Sort tables by tag for the directory
    const sorted = tables.map((t, i) => ({ tag: t.tag, index: i }));
    sorted.sort((a, b) => a.tag.localeCompare(b.tag));

    // Build table directory and copy data
    let currentOffset = dataOffset;
    const offsets: number[] = new Array(tables.length);
    for (const entry of sorted) {
        offsets[entry.index] = currentOffset;
        currentOffset += paddedTables[entry.index].length;
    }

    // Write directory entries in sorted order
    for (let i = 0; i < sorted.length; i++) {
        const dirOff = headerSize + i * 16;
        const entry = sorted[i];
        const tableData = tables[entry.index].data;
        const checksum = computeChecksum(pad4(tableData));

        writeTag(view, dirOff, entry.tag);
        writeU32(view, dirOff + 4, checksum);
        writeU32(view, dirOff + 8, offsets[entry.index]);
        writeU32(view, dirOff + 12, tableData.length);
    }

    // Copy table data
    for (const entry of sorted) {
        result.set(paddedTables[entry.index], offsets[entry.index]);
    }

    // Fix head.checksumAdjust
    fixHeadChecksum(result, view, tables, offsets);

    return result;
}

function fixHeadChecksum(
    result: Uint8Array, view: DataView,
    tables: readonly TableEntry[], offsets: readonly number[],
): void {
    // Find head table offset
    let headOffset = -1;
    for (let i = 0; i < tables.length; i++) {
        if (tables[i].tag === 'head') {
            headOffset = offsets[i];
            break;
        }
    }
    if (headOffset < 0) return;

    // Clear checksumAdjust field first
    writeU32(view, headOffset + 8, 0);

    // Compute whole-file checksum
    const wholeChecksum = computeChecksum(result);
    const checksumAdjust = (0xB1B0AFBA - wholeChecksum) >>> 0;
    writeU32(view, headOffset + 8, checksumAdjust);
}

// ── Main export ─────────────────────────────────────────────────────────

export function buildTtf(options: TtfBuilderOptions): Uint8Array {
    const { familyName, styleName, unitsPerEm, ascender, descender, glyphs } = options;

    const { loca, glyf, locaFormat } = buildLocaGlyf(glyphs);

    const tables: TableEntry[] = [
        { tag: 'head', data: buildHeadTable(unitsPerEm, locaFormat) },
        { tag: 'hhea', data: buildHheaTable(ascender, descender, glyphs.length) },
        { tag: 'hmtx', data: buildHmtxTable(glyphs) },
        { tag: 'maxp', data: buildMaxpTable(glyphs.length) },
        { tag: 'cmap', data: buildCmapTable(glyphs) },
        { tag: 'loca', data: loca },
        { tag: 'glyf', data: glyf },
        { tag: 'name', data: buildNameTable(familyName, styleName) },
        { tag: 'OS/2', data: buildOs2Table(ascender, descender, unitsPerEm) },
        { tag: 'post', data: buildPostTable() },
    ];

    return assembleFont(tables);
}
