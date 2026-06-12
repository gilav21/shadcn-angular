import { zlibInflate } from './inflate';

// ── Stream filter decoders ──────────────────────────────────────────────

function decodeASCIIHex(data: Uint8Array): Uint8Array {
    const text = new TextDecoder('latin1').decode(data);
    let hex = '';
    for (const ch of text) {
        if (ch === '>') break;
        if (!' \t\r\n\0\f'.includes(ch)) hex += ch;
    }
    if (hex.length % 2 !== 0) hex += '0';
    const result = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        result[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
    }
    return result;
}

function ascii85IsEndMarker(text: string, i: number): boolean {
    return text[i] === '~' && i + 1 < text.length && text[i + 1] === '>';
}

function ascii85CollectGroup(text: string, startIndex: number): { group: number[]; nextIndex: number } {
    const group: number[] = [];
    let i = startIndex;
    while (group.length < 5 && i < text.length) {
        if (text[i] === '~') break;
        if (!' \t\r\n\0\f'.includes(text[i])) {
            group.push((text.codePointAt(i) ?? 0) - 33);
        }
        i++;
    }
    return { group, nextIndex: i };
}

function ascii85DecodeGroup(group: number[]): number[] {
    while (group.length < 5) group.push(84);

    let value = 0;
    for (const g of group) value = value * 85 + g;

    const bytes = [
        (value >>> 24) & 0xFF,
        (value >>> 16) & 0xFF,
        (value >>> 8) & 0xFF,
        value & 0xFF,
    ];
    const numBytes = group.length === 5 ? 4 : group.length - 1;
    return bytes.slice(0, numBytes);
}

function decodeASCII85(data: Uint8Array): Uint8Array {
    const text = new TextDecoder('latin1').decode(data);
    const output: number[] = [];
    let i = 0;

    while (i < text.length) {
        if (ascii85IsEndMarker(text, i)) break;
        if (' \t\r\n\0\f'.includes(text[i])) { i++; continue; }

        if (text[i] === 'z') {
            output.push(0, 0, 0, 0);
            i++;
            continue;
        }

        const { group, nextIndex } = ascii85CollectGroup(text, i);
        i = nextIndex;

        if (group.length < 2) break;
        for (const byte of ascii85DecodeGroup(group)) output.push(byte);
    }

    return new Uint8Array(output);
}

interface LZWState {
    bitPos: number;
    codeSize: number;
    nextCode: number;
    table: Uint8Array[];
}

function lzwInitTable(state: LZWState): void {
    state.table = [];
    for (let i = 0; i < 256; i++) state.table[i] = new Uint8Array([i]);
    state.table[256] = new Uint8Array(0);
    state.table[257] = new Uint8Array(0);
    state.nextCode = 258;
    state.codeSize = 9;
}

function lzwReadCode(data: Uint8Array, state: LZWState): number {
    let code = 0;
    for (let i = 0; i < state.codeSize; i++) {
        const byteIdx = (state.bitPos + i) >>> 3;
        const bitIdx = 7 - ((state.bitPos + i) & 7);
        if (byteIdx < data.length) {
            code |= ((data[byteIdx] >>> bitIdx) & 1) << (state.codeSize - 1 - i);
        }
    }
    state.bitPos += state.codeSize;
    return code;
}

function lzwResolveEntry(code: number, state: LZWState, prevEntry: Uint8Array | null): Uint8Array | null {
    if (code < state.nextCode && state.table[code]) return state.table[code];
    if (code === state.nextCode && prevEntry) {
        const entry = new Uint8Array(prevEntry.length + 1);
        entry.set(prevEntry);
        entry[prevEntry.length] = prevEntry[0];
        return entry;
    }
    return null;
}

function decodeLZW(data: Uint8Array, earlyChange: number): Uint8Array {
    const output: number[] = [];
    const state: LZWState = { bitPos: 0, codeSize: 9, nextCode: 258, table: [] };
    lzwInitTable(state);
    let prevEntry: Uint8Array | null = null;

    while (state.bitPos + state.codeSize <= data.length * 8) {
        const code = lzwReadCode(data, state);
        if (code === 257) break;

        if (code === 256) {
            lzwInitTable(state);
            prevEntry = null;
            continue;
        }

        const entry = lzwResolveEntry(code, state, prevEntry);
        if (!entry) break;

        for (const byte of entry) output.push(byte);

        if (prevEntry) {
            const newEntry = new Uint8Array(prevEntry.length + 1);
            newEntry.set(prevEntry);
            newEntry[prevEntry.length] = entry[0];
            state.table[state.nextCode] = newEntry;
            state.nextCode++;
            if (state.nextCode >= (1 << state.codeSize) - earlyChange && state.codeSize < 12) {
                state.codeSize++;
            }
        }
        prevEntry = entry;
    }

    return new Uint8Array(output);
}

function rleCopyLiteral(data: Uint8Array, output: number[], start: number, count: number): number {
    let i = start;
    for (let j = 0; j <= count && i < data.length; j++) {
        output.push(data[i++]);
    }
    return i;
}

function rleRepeatByte(data: Uint8Array, output: number[], pos: number, len: number): number {
    if (pos >= data.length) return pos;
    const byte = data[pos];
    const repeatCount = 257 - len;
    for (let j = 0; j < repeatCount; j++) output.push(byte);
    return pos + 1;
}

function decodeRunLength(data: Uint8Array): Uint8Array {
    const output: number[] = [];
    let i = 0;
    while (i < data.length) {
        const len = data[i];
        i++;
        if (len === 128) break;
        if (len < 128) {
            i = rleCopyLiteral(data, output, i, len);
        } else {
            i = rleRepeatByte(data, output, i, len);
        }
    }
    return new Uint8Array(output);
}

// ── CCITT Fax decoder (Group 3 1D / Group 4 2D) ────────────────────────

interface CCITTCode { readonly runLen: number; readonly bits: number; readonly code: number }

const WHITE_TERM_CODES: CCITTCode[] = [
    {runLen:0,bits:8,code:0x35},{runLen:1,bits:6,code:0x07},{runLen:2,bits:4,code:0x07},{runLen:3,bits:4,code:0x08},
    {runLen:4,bits:4,code:0x0B},{runLen:5,bits:4,code:0x0C},{runLen:6,bits:4,code:0x0E},{runLen:7,bits:4,code:0x0F},
    {runLen:8,bits:5,code:0x13},{runLen:9,bits:5,code:0x14},{runLen:10,bits:5,code:0x07},{runLen:11,bits:5,code:0x08},
    {runLen:12,bits:6,code:0x08},{runLen:13,bits:6,code:0x03},{runLen:14,bits:6,code:0x34},{runLen:15,bits:6,code:0x35},
    {runLen:16,bits:6,code:0x2A},{runLen:17,bits:6,code:0x2B},{runLen:18,bits:7,code:0x27},{runLen:19,bits:7,code:0x0C},
    {runLen:20,bits:7,code:0x08},{runLen:21,bits:7,code:0x17},{runLen:22,bits:7,code:0x03},{runLen:23,bits:7,code:0x04},
    {runLen:24,bits:7,code:0x28},{runLen:25,bits:7,code:0x2B},{runLen:26,bits:7,code:0x13},{runLen:27,bits:7,code:0x24},
    {runLen:28,bits:7,code:0x18},{runLen:29,bits:8,code:0x02},{runLen:30,bits:8,code:0x03},{runLen:31,bits:8,code:0x1A},
    {runLen:32,bits:8,code:0x1B},{runLen:33,bits:8,code:0x12},{runLen:34,bits:8,code:0x13},{runLen:35,bits:8,code:0x14},
    {runLen:36,bits:8,code:0x15},{runLen:37,bits:8,code:0x16},{runLen:38,bits:8,code:0x17},{runLen:39,bits:8,code:0x28},
    {runLen:40,bits:8,code:0x29},{runLen:41,bits:8,code:0x2A},{runLen:42,bits:8,code:0x2B},{runLen:43,bits:8,code:0x2C},
    {runLen:44,bits:8,code:0x2D},{runLen:45,bits:8,code:0x04},{runLen:46,bits:8,code:0x05},{runLen:47,bits:8,code:0x0A},
    {runLen:48,bits:8,code:0x0B},{runLen:49,bits:8,code:0x52},{runLen:50,bits:8,code:0x53},{runLen:51,bits:8,code:0x54},
    {runLen:52,bits:8,code:0x55},{runLen:53,bits:8,code:0x24},{runLen:54,bits:8,code:0x25},{runLen:55,bits:8,code:0x58},
    {runLen:56,bits:8,code:0x59},{runLen:57,bits:8,code:0x5A},{runLen:58,bits:8,code:0x5B},{runLen:59,bits:8,code:0x4A},
    {runLen:60,bits:8,code:0x4B},{runLen:61,bits:8,code:0x32},{runLen:62,bits:8,code:0x33},{runLen:63,bits:8,code:0x34},
];

const WHITE_MAKEUP_CODES: CCITTCode[] = [
    {runLen:64,bits:5,code:0x1B},{runLen:128,bits:5,code:0x12},{runLen:192,bits:6,code:0x17},{runLen:256,bits:7,code:0x37},
    {runLen:320,bits:8,code:0x36},{runLen:384,bits:8,code:0x37},{runLen:448,bits:8,code:0x64},{runLen:512,bits:8,code:0x65},
    {runLen:576,bits:8,code:0x68},{runLen:640,bits:8,code:0x67},{runLen:704,bits:9,code:0xCC},{runLen:768,bits:9,code:0xCD},
    {runLen:832,bits:9,code:0xD2},{runLen:896,bits:9,code:0xD3},{runLen:960,bits:9,code:0xD4},{runLen:1024,bits:9,code:0xD5},
    {runLen:1088,bits:9,code:0xD6},{runLen:1152,bits:9,code:0xD7},{runLen:1216,bits:9,code:0xD8},{runLen:1280,bits:9,code:0xD9},
    {runLen:1344,bits:9,code:0xDA},{runLen:1408,bits:9,code:0xDB},{runLen:1472,bits:9,code:0x98},{runLen:1536,bits:9,code:0x99},
    {runLen:1600,bits:9,code:0x9A},{runLen:1664,bits:6,code:0x18},{runLen:1728,bits:9,code:0x9B},
];

const BLACK_TERM_CODES: CCITTCode[] = [
    {runLen:0,bits:10,code:0x37},{runLen:1,bits:3,code:0x02},{runLen:2,bits:2,code:0x03},{runLen:3,bits:2,code:0x02},
    {runLen:4,bits:3,code:0x03},{runLen:5,bits:4,code:0x03},{runLen:6,bits:4,code:0x02},{runLen:7,bits:5,code:0x03},
    {runLen:8,bits:6,code:0x05},{runLen:9,bits:6,code:0x04},{runLen:10,bits:7,code:0x04},{runLen:11,bits:7,code:0x05},
    {runLen:12,bits:7,code:0x07},{runLen:13,bits:8,code:0x04},{runLen:14,bits:8,code:0x07},{runLen:15,bits:9,code:0x18},
    {runLen:16,bits:10,code:0x17},{runLen:17,bits:10,code:0x18},{runLen:18,bits:10,code:0x08},{runLen:19,bits:11,code:0x67},
    {runLen:20,bits:11,code:0x68},{runLen:21,bits:11,code:0x6C},{runLen:22,bits:11,code:0x37},{runLen:23,bits:11,code:0x28},
    {runLen:24,bits:11,code:0x17},{runLen:25,bits:11,code:0x18},{runLen:26,bits:12,code:0xCA},{runLen:27,bits:12,code:0xCB},
    {runLen:28,bits:12,code:0xCC},{runLen:29,bits:12,code:0xCD},{runLen:30,bits:12,code:0x68},{runLen:31,bits:12,code:0x69},
    {runLen:32,bits:12,code:0x6A},{runLen:33,bits:12,code:0x6B},{runLen:34,bits:12,code:0xD2},{runLen:35,bits:12,code:0xD3},
    {runLen:36,bits:12,code:0xD4},{runLen:37,bits:12,code:0xD5},{runLen:38,bits:12,code:0xD6},{runLen:39,bits:12,code:0xD7},
    {runLen:40,bits:12,code:0x6C},{runLen:41,bits:12,code:0x6D},{runLen:42,bits:12,code:0xDA},{runLen:43,bits:12,code:0xDB},
    {runLen:44,bits:12,code:0x54},{runLen:45,bits:12,code:0x55},{runLen:46,bits:12,code:0x56},{runLen:47,bits:12,code:0x57},
    {runLen:48,bits:12,code:0x64},{runLen:49,bits:12,code:0x65},{runLen:50,bits:12,code:0x52},{runLen:51,bits:12,code:0x53},
    {runLen:52,bits:12,code:0x24},{runLen:53,bits:12,code:0x37},{runLen:54,bits:12,code:0x38},{runLen:55,bits:12,code:0x27},
    {runLen:56,bits:12,code:0x28},{runLen:57,bits:12,code:0x58},{runLen:58,bits:12,code:0x59},{runLen:59,bits:12,code:0x2B},
    {runLen:60,bits:12,code:0x2C},{runLen:61,bits:12,code:0x5A},{runLen:62,bits:12,code:0x66},{runLen:63,bits:12,code:0x67},
];

const BLACK_MAKEUP_CODES: CCITTCode[] = [
    {runLen:64,bits:10,code:0x0F},{runLen:128,bits:12,code:0xC8},{runLen:192,bits:12,code:0xC9},{runLen:256,bits:12,code:0x5B},
    {runLen:320,bits:12,code:0x33},{runLen:384,bits:12,code:0x34},{runLen:448,bits:12,code:0x35},{runLen:512,bits:13,code:0x6C},
    {runLen:576,bits:13,code:0x6D},{runLen:640,bits:13,code:0x4A},{runLen:704,bits:13,code:0x4B},{runLen:768,bits:13,code:0x4C},
    {runLen:832,bits:13,code:0x4D},{runLen:896,bits:13,code:0x72},{runLen:960,bits:13,code:0x73},{runLen:1024,bits:13,code:0x74},
    {runLen:1088,bits:13,code:0x75},{runLen:1152,bits:13,code:0x76},{runLen:1216,bits:13,code:0x77},{runLen:1280,bits:13,code:0x52},
    {runLen:1344,bits:13,code:0x53},{runLen:1408,bits:13,code:0x54},{runLen:1472,bits:13,code:0x55},{runLen:1536,bits:13,code:0x5A},
    {runLen:1600,bits:13,code:0x5B},{runLen:1664,bits:13,code:0x64},{runLen:1728,bits:13,code:0x65},
];

const COMMON_MAKEUP_CODES: CCITTCode[] = [
    {runLen:1792,bits:11,code:0x08},{runLen:1856,bits:11,code:0x0C},{runLen:1920,bits:11,code:0x0D},
    {runLen:1984,bits:12,code:0x12},{runLen:2048,bits:12,code:0x13},{runLen:2112,bits:12,code:0x14},
    {runLen:2176,bits:12,code:0x15},{runLen:2240,bits:12,code:0x16},{runLen:2304,bits:12,code:0x17},
    {runLen:2368,bits:12,code:0x1C},{runLen:2432,bits:12,code:0x1D},{runLen:2496,bits:12,code:0x1E},
    {runLen:2560,bits:12,code:0x1F},
];

type CCITTTreeNode = { readonly '0'?: CCITTTreeNode; readonly '1'?: CCITTTreeNode; readonly runLen?: number };

function buildCCITTTree(codes: ReadonlyArray<CCITTCode>): CCITTTreeNode {
    const root: Record<string, unknown> = {};
    for (const c of codes) {
        let node = root;
        for (let i = c.bits - 1; i >= 0; i--) {
            const bit = (c.code >> i) & 1 ? '1' : '0';
            node[bit] ??= {};
            node = node[bit] as Record<string, unknown>;
        }
        node['runLen'] = c.runLen;
    }
    return root as CCITTTreeNode;
}

const whiteTree = buildCCITTTree([...WHITE_TERM_CODES, ...WHITE_MAKEUP_CODES, ...COMMON_MAKEUP_CODES]);
const blackTree = buildCCITTTree([...BLACK_TERM_CODES, ...BLACK_MAKEUP_CODES, ...COMMON_MAKEUP_CODES]);

class CCITTBitReader {
    private pos = 0;
    private bitPos = 0;
    constructor(private readonly data: Uint8Array) {}

    readBit(): number {
        if (this.pos >= this.data.length) return 0;
        const bit = (this.data[this.pos] >> (7 - this.bitPos)) & 1;
        this.bitPos++;
        if (this.bitPos >= 8) { this.bitPos = 0; this.pos++; }
        return bit;
    }

    skipToByteAlign(): void {
        if (this.bitPos > 0) { this.bitPos = 0; this.pos++; }
    }

    get exhausted(): boolean { return this.pos >= this.data.length; }
}

function ccittDecodeRun(reader: CCITTBitReader, tree: CCITTTreeNode): number {
    let total = 0;
    let makeup = true;
    while (makeup) {
        let node: CCITTTreeNode | undefined = tree;
        while (node && node.runLen === undefined) {
            const bit = reader.readBit();
            node = bit ? node['1'] : node['0'];
        }
        if (node?.runLen === undefined) return total;
        total += node.runLen;
        makeup = node.runLen >= 64;
    }
    return total;
}

function ccittDecodeGroup4Rows(
    bitReader: CCITTBitReader, columns: number, maxRows: number, blackIs1: boolean, output: Uint8Array[],
): void {
    let refLine: Uint8Array<ArrayBufferLike> = new Uint8Array(columns);
    for (let row = 0; row < maxRows; row++) {
        if (bitReader.exhausted) break;
        const curLine = decodeCCITTGroup4Row(bitReader, refLine, columns);
        if (!curLine) break;
        output.push(ccittRowToBytes(curLine, columns, blackIs1));
        refLine = curLine;
    }
}

function ccittDecodeGroup3Rows(
    bitReader: CCITTBitReader, columns: number, maxRows: number, blackIs1: boolean,
    encodedByteAlign: boolean, output: Uint8Array[],
): void {
    for (let row = 0; row < maxRows; row++) {
        if (bitReader.exhausted) break;
        if (encodedByteAlign) bitReader.skipToByteAlign();
        const curLine = decodeCCITTGroup3Row(bitReader, columns);
        if (!curLine) break;
        output.push(ccittRowToBytes(curLine, columns, blackIs1));
    }
}

function ccittDecodeMixedRows(
    bitReader: CCITTBitReader, columns: number, maxRows: number, blackIs1: boolean,
    encodedByteAlign: boolean, output: Uint8Array[],
): void {
    let refLine: Uint8Array<ArrayBufferLike> = new Uint8Array(columns);
    for (let row = 0; row < maxRows; row++) {
        if (bitReader.exhausted) break;
        if (encodedByteAlign) bitReader.skipToByteAlign();
        const tag = bitReader.readBit();
        const curLine = tag === 1
            ? decodeCCITTGroup3Row(bitReader, columns)
            : decodeCCITTGroup4Row(bitReader, refLine, columns);
        if (!curLine) break;
        output.push(ccittRowToBytes(curLine, columns, blackIs1));
        refLine = curLine;
    }
}

function ccittAssembleOutput(output: Uint8Array[], rowBytes: number, fallback: Uint8Array): Uint8Array {
    if (output.length === 0) return fallback;
    const result = new Uint8Array(output.length * rowBytes);
    for (let i = 0; i < output.length; i++) {
        result.set(output[i], i * rowBytes);
    }
    return result;
}

function decodeCCITTFax(data: Uint8Array, parms: Record<string, PdfObject>, reader: PdfReader): Uint8Array {
    const k = reader.getNumber(parms['K']);
    const columns = reader.getNumber(parms['Columns']) || 1728;
    const rows = reader.getNumber(parms['Rows']) || 0;
    const encodedByteAlign = !!parms['EncodedByteAlign'];
    const blackIs1 = !!parms['BlackIs1'];

    const rowBytes = Math.ceil(columns / 8);
    const maxRows = rows > 0 ? rows : 10000;
    const output: Uint8Array[] = [];
    const bitReader = new CCITTBitReader(data);

    if (k < 0) {
        ccittDecodeGroup4Rows(bitReader, columns, maxRows, blackIs1, output);
    } else if (k === 0) {
        ccittDecodeGroup3Rows(bitReader, columns, maxRows, blackIs1, encodedByteAlign, output);
    } else {
        ccittDecodeMixedRows(bitReader, columns, maxRows, blackIs1, encodedByteAlign, output);
    }

    return ccittAssembleOutput(output, rowBytes, data);
}

function ccittRowToBytes(line: Uint8Array, columns: number, blackIs1: boolean): Uint8Array {
    const rowBytes = Math.ceil(columns / 8);
    const out = new Uint8Array(rowBytes);
    for (let i = 0; i < columns; i++) {
        const rawPixel = line[i];
        const pixel = blackIs1 ? rawPixel : (1 - rawPixel);
        if (pixel) out[i >> 3] |= 0x80 >> (i & 7);
    }
    return out;
}

function decodeCCITTGroup3Row(reader: CCITTBitReader, columns: number): Uint8Array | null {
    const line = new Uint8Array(columns);
    let col = 0;
    let isWhite = true;
    while (col < columns) {
        const tree = isWhite ? whiteTree : blackTree;
        const runLen = ccittDecodeRun(reader, tree);
        const fill = isWhite ? 0 : 1;
        const end = Math.min(col + runLen, columns);
        for (let i = col; i < end; i++) line[i] = fill;
        col = end;
        isWhite = !isWhite;
    }
    return line;
}

interface Group4State {
    a0: number;
    isWhite: boolean;
    done: boolean;
}

function g4FillRun(line: Uint8Array, start: number, end: number, fill: number): void {
    for (let i = start; i < end; i++) line[i] = fill;
}

function g4FindB1(refLine: Uint8Array, a0pos: number, white: boolean, columns: number): number {
    let pos = a0pos;
    const refColor = white ? 0 : 1;
    if (pos < columns && refLine[pos] === refColor) {
        while (pos < columns && refLine[pos] === refColor) pos++;
    }
    while (pos < columns && refLine[pos] !== refColor) pos++;
    while (pos < columns && refLine[pos] === refColor) pos++;
    return pos;
}

function g4FindB2(refLine: Uint8Array, b1: number, columns: number): number {
    const b1Color = b1 < columns ? refLine[b1] : 0;
    let pos = b1;
    while (pos < columns && refLine[pos] === b1Color) pos++;
    return pos;
}

function g4ApplyVerticalDelta(
    line: Uint8Array, state: Group4State, b1: number, delta: number, columns: number,
): void {
    const a1 = Math.max(0, Math.min(b1 + delta, columns));
    const fill = state.isWhite ? 0 : 1;
    g4FillRun(line, state.a0, a1, fill);
    state.a0 = a1;
    state.isWhite = !state.isWhite;
}

function g4HandleBit1Set(
    reader: CCITTBitReader, refLine: Uint8Array, line: Uint8Array, state: Group4State, columns: number,
): void {
    const bit2 = reader.readBit();
    const bit3 = reader.readBit();
    if (bit2 === 0 && bit3 === 0) {
        state.done = true;
        return;
    }
    const b1 = g4FindB1(refLine, state.a0, state.isWhite, columns);
    if (bit2 === 0 && bit3 === 1) {
        g4FillRun(line, state.a0, Math.min(b1, columns), state.isWhite ? 0 : 1);
        state.a0 = Math.min(b1, columns);
        state.isWhite = !state.isWhite;
        return;
    }
    if (bit2 === 1 && bit3 === 0) {
        const b2 = g4FindB2(refLine, b1, columns);
        g4FillRun(line, state.a0, Math.min(b2, columns), state.isWhite ? 0 : 1);
        state.a0 = Math.min(b2, columns);
        return;
    }
    const d = reader.readBit();
    const delta = d === 0 ? -3 : 3;
    g4ApplyVerticalDelta(line, state, b1, delta, columns);
}

function g4HandleSmallDelta(
    reader: CCITTBitReader, refLine: Uint8Array, line: Uint8Array, state: Group4State, columns: number,
): void {
    const bit3 = reader.readBit();
    const b1 = g4FindB1(refLine, state.a0, state.isWhite, columns);
    let delta: number;
    if (bit3 === 0) {
        delta = reader.readBit() === 0 ? -2 : 2;
    } else {
        delta = reader.readBit() === 0 ? -1 : 1;
    }
    g4ApplyVerticalDelta(line, state, b1, delta, columns);
}

function g4HandleHorizontal(
    reader: CCITTBitReader, line: Uint8Array, state: Group4State, columns: number,
): void {
    const tree = state.isWhite ? whiteTree : blackTree;
    const runLen = ccittDecodeRun(reader, tree);
    const fill = state.isWhite ? 0 : 1;
    const end = Math.min(state.a0 + runLen, columns);
    g4FillRun(line, state.a0, end, fill);
    state.a0 = end;
    state.isWhite = !state.isWhite;

    const tree2 = state.isWhite ? whiteTree : blackTree;
    const runLen2 = ccittDecodeRun(reader, tree2);
    const fill2 = state.isWhite ? 0 : 1;
    const end2 = Math.min(state.a0 + runLen2, columns);
    g4FillRun(line, state.a0, end2, fill2);
    state.a0 = end2;
    state.isWhite = !state.isWhite;
}

function decodeCCITTGroup4Row(reader: CCITTBitReader, refLine: Uint8Array, columns: number): Uint8Array | null {
    const line = new Uint8Array(columns);
    const state: Group4State = { a0: 0, isWhite: true, done: false };

    let safetyCounter = 0;
    while (state.a0 < columns) {
        if (safetyCounter++ > columns * 2) return line;
        const bit1 = reader.readBit();
        if (bit1 === 1) {
            g4HandleBit1Set(reader, refLine, line, state, columns);
            if (state.done) return line;
        } else if (reader.readBit() === 0) {
            g4HandleSmallDelta(reader, refLine, line, state, columns);
        } else {
            g4HandleHorizontal(reader, line, state, columns);
        }
    }
    return line;
}

// ── End CCITT Fax decoder ───────────────────────────────────────────────

function applyPngPredictor(
    data: Uint8Array, columns: number, colors: number, bpc: number,
): Uint8Array {
    const bytesPerPixel = Math.max(1, Math.ceil((colors * bpc) / 8));
    const rowBytes = Math.ceil((columns * colors * bpc) / 8);
    const rowStride = 1 + rowBytes;

    if (data.length < rowStride) return data;

    const numRows = Math.floor(data.length / rowStride);
    const output = new Uint8Array(numRows * rowBytes);
    const prevRow = new Uint8Array(rowBytes);

    for (let row = 0; row < numRows; row++) {
        const srcOffset = row * rowStride;
        const predictor = data[srcOffset];
        const dstOffset = row * rowBytes;

        for (let col = 0; col < rowBytes; col++) {
            const raw = data[srcOffset + 1 + col] ?? 0;
            const a = col >= bytesPerPixel ? output[dstOffset + col - bytesPerPixel] : 0;
            const b = prevRow[col];
            const c = col >= bytesPerPixel ? prevRow[col - bytesPerPixel] : 0;

            let val: number;
            switch (predictor) {
                case 0: val = raw; break;
                case 1: val = (raw + a) & 0xFF; break;
                case 2: val = (raw + b) & 0xFF; break;
                case 3: val = (raw + Math.floor((a + b) / 2)) & 0xFF; break;
                case 4: val = (raw + paethPredictor(a, b, c)) & 0xFF; break;
                default: val = raw; break;
            }
            output[dstOffset + col] = val;
        }

        prevRow.set(output.subarray(dstOffset, dstOffset + rowBytes));
    }

    return output;
}

function paethPredictor(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

export interface PdfParseResult {
    html: string;
    text: string;
    imageOnly: boolean;
}

export interface TextItem {
    text: string;
    fontSize: number;
    x: number;
    y: number;
    endX: number;
    page: number;
    color: string;
    bold: boolean;
    italic: boolean;
    fontFamily: string;
    fontName: string;
    mcid: number;
    charSpacing: number;
    wordSpacing: number;
    textRise: number;
    horizontalScaling: number;
    textRenderMode: number;
    strokeColor: string;
    transformMatrix: readonly [number, number, number, number];
    isSpaceOffset: boolean;
}

export interface FontInfo {
    isTwoByte: boolean;
    widths: Map<number, number>;
    defaultWidth: number;
    toUnicode: Map<number, string>;
    isBold: boolean;
    isItalic: boolean;
    familyName: string;
}

export interface ImageItem {
    dataUrl: string;
    width: number;
    height: number;
    renderWidth: number;
    renderHeight: number;
    x: number;
    y: number;
    page: number;
}

export interface PathRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly page: number;
    readonly stroked: boolean;
    readonly filled: boolean;
    readonly strokeColor: string;
    readonly fillColor: string;
    readonly lineWidth: number;
}

export interface PdfAnnotation {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly page: number;
    readonly uri: string;
}

interface TableGrid {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly page: number;
    readonly rows: number[];
    readonly cols: number[];
}

export interface PdfObject {
    type: 'dict' | 'array' | 'number' | 'string' | 'name' | 'boolean' | 'null' | 'ref' | 'stream';
    value: unknown;
    stream?: Uint8Array;
}

// ── PDF structure parser ────────────────────────────────────────────────

export class PdfReader {
    private data: Uint8Array;
    private text: string;
    private readonly objects: Map<string, { offset: number; gen: number }> = new Map();
    private readonly parsedObjects: Map<string, PdfObject> = new Map();
    private readonly compressedObjects: Map<string, { streamObjNum: number; index: number }> = new Map();
    private trailer: Record<string, PdfObject> | null = null;

    constructor(buffer: ArrayBuffer) {
        this.data = new Uint8Array(buffer);
        this.text = new TextDecoder('latin1').decode(this.data);
    }

    parse(): void {
        this.findXRef();
    }

    private findLastStartxref(chunk: string): RegExpExecArray | null {
        const re = /startxref\s+(\d+)/g;
        let last: RegExpExecArray | null = null;
        let m: RegExpExecArray | null;
        while ((m = re.exec(chunk)) !== null) {
            last = m;
        }
        return last;
    }

    private findXRef(): void {
        let match = this.findLastStartxref(this.text.slice(-1024));
        match ??= this.findLastStartxref(this.text.slice(-8192));
        if (!match) throw new Error('Could not find startxref in PDF');
        const xrefOffset = Number.parseInt(match[1], 10);

        if (this.text.substring(xrefOffset, xrefOffset + 4) === 'xref') {
            this.parseTraditionalXRef(xrefOffset);
        } else {
            this.parseXRefStream(xrefOffset);
        }
    }

    private parseXRefEntry(entryStr: string, startObj: number, index: number): void {
        const entryMatch = /(\d{10})\s+(\d{5})\s+([fn])/.exec(entryStr);
        if (!entryMatch) return;
        const entryOffset = Number.parseInt(entryMatch[1], 10);
        const gen = Number.parseInt(entryMatch[2], 10);
        if (entryMatch[3] === 'f') return;
        const key = `${startObj + index} ${gen}`;
        if (!this.objects.has(key)) {
            this.objects.set(key, { offset: entryOffset, gen });
        }
    }

    private parseTrailerDict(offset: number): void {
        const trailerPos = this.text.indexOf('trailer', offset);
        if (trailerPos === -1) return;
        const dictStart = this.text.indexOf('<<', trailerPos);
        if (dictStart === -1) return;
        const result = this.parseObjectAt(dictStart);
        if (result.obj.type !== 'dict') return;
        const dict = result.obj.value as Record<string, PdfObject>;
        this.trailer ??= dict;
        const prev = dict['Prev'];
        if (prev?.type === 'number') {
            this.parseTraditionalXRef(prev.value as number);
        }
    }

    private parseTraditionalXRef(offset: number): void {
        let pos = offset + 4;
        pos = this.skipWhitespace(pos);

        while (pos < this.text.length) {
            if (this.text.substring(pos, pos + 7) === 'trailer') break;

            const headerMatch = /^(\d+)\s+(\d+)/.exec(this.text.substring(pos));
            if (!headerMatch) break;
            const startObj = Number.parseInt(headerMatch[1], 10);
            const count = Number.parseInt(headerMatch[2], 10);
            pos += headerMatch[0].length;
            pos = this.skipWhitespace(pos);

            for (let i = 0; i < count; i++) {
                this.parseXRefEntry(this.text.substring(pos, pos + 20), startObj, i);
                pos += 20;
                while (pos < this.text.length && (this.text[pos] === '\r' || this.text[pos] === '\n' || this.text[pos] === ' ')) pos++;
            }
        }

        this.parseTrailerDict(offset);
    }

    private readXRefField(decoded: Uint8Array, bytePos: number, fieldOffset: number, fieldWidth: number): number {
        let value = 0;
        for (let b = 0; b < fieldWidth; b++) {
            value = (value << 8) | decoded[bytePos + fieldOffset + b];
        }
        return value;
    }

    private getXRefIndexArray(dict: Record<string, PdfObject>): number[] {
        const indexObj = dict['Index'];
        if (indexObj?.type === 'array') {
            return (indexObj.value as PdfObject[]).map(o => o.value as number);
        }
        const sizeObj = dict['Size'];
        return [0, sizeObj ? sizeObj.value as number : 0];
    }

    private storeXRefEntry(fieldType: number, objKey: string, field2: number, field3: number): void {
        if (fieldType === 1) {
            if (!this.objects.has(objKey)) {
                this.objects.set(objKey, { offset: field2, gen: field3 });
            }
        } else if (fieldType === 2) {
            if (!this.compressedObjects.has(objKey)) {
                this.compressedObjects.set(objKey, { streamObjNum: field2, index: field3 });
            }
        }
    }

    private processXRefStreamEntries(decoded: Uint8Array, w: number[], indexArr: number[]): void {
        const entrySize = w[0] + w[1] + w[2];
        let bytePos = 0;

        for (let s = 0; s < indexArr.length; s += 2) {
            const startObj = indexArr[s];
            const count = indexArr[s + 1];
            for (let i = 0; i < count; i++) {
                if (bytePos + entrySize > decoded.length) break;
                const fieldType = w[0] > 0 ? this.readXRefField(decoded, bytePos, 0, w[0]) : 1;
                const field2 = this.readXRefField(decoded, bytePos, w[0], w[1]);
                const field3 = this.readXRefField(decoded, bytePos, w[0] + w[1], w[2]);
                bytePos += entrySize;

                const gen = fieldType === 1 ? field3 : 0;
                const key = `${startObj + i} ${gen}`;
                this.storeXRefEntry(fieldType, key, field2, field3);
            }
        }
    }

    private followPrevXRef(dict: Record<string, PdfObject>): void {
        const prev = dict['Prev'];
        if (prev?.type !== 'number') return;
        const prevOffset = prev.value as number;
        if (this.text.substring(prevOffset, prevOffset + 4) === 'xref') {
            this.parseTraditionalXRef(prevOffset);
        } else {
            this.parseXRefStream(prevOffset);
        }
    }

    private parseXRefStream(offset: number): void {
        const result = this.parseObjectAt(offset);
        const obj = result.obj;
        if (obj.type !== 'stream' || !obj.stream) throw new Error('Expected xref stream');
        const dict = obj.value as Record<string, PdfObject>;
        const streamData = obj.stream;

        this.trailer ??= dict;

        const wArr = dict['W'];
        if (wArr?.type !== 'array') throw new Error('Missing /W in xref stream');
        const w = (wArr.value as PdfObject[]).map(o => o.value as number);

        const indexArr = this.getXRefIndexArray(dict);
        const decoded = this.decodeStreamData(dict, streamData);
        this.processXRefStreamEntries(decoded, w, indexArr);
        this.followPrevXRef(dict);
    }

    private skipWhitespace(pos: number): number {
        while (pos < this.text.length && ' \t\r\n\0\f'.includes(this.text[pos])) pos++;
        return pos;
    }

    private resolveStreamLength(dict: Record<string, PdfObject>): number {
        const lengthObj = dict['Length'];
        if (!lengthObj) return 0;
        if (lengthObj.type === 'ref') {
            return this.resolveRef(lengthObj).value as number;
        }
        return lengthObj.value as number;
    }

    private parseObjectAt(offset: number): { obj: PdfObject; endPos: number } {
        let pos = offset;
        pos = this.skipWhitespace(pos);

        const objHeaderMatch = /^(\d+)\s+(\d+)\s+obj\s*/.exec(this.text.substring(pos));
        if (objHeaderMatch) {
            pos += objHeaderMatch[0].length;
        }

        const result = this.parseValue(pos);
        pos = result.endPos;
        pos = this.skipWhitespace(pos);

        if (this.text.substring(pos, pos + 6) !== 'stream') {
            return result;
        }

        pos += 6;
        if (this.text[pos] === '\r') pos++;
        if (this.text[pos] === '\n') pos++;

        const dict = result.obj.value as Record<string, PdfObject>;
        let streamLength = this.resolveStreamLength(dict);

        if (streamLength <= 0 || pos + streamLength > this.data.length) {
            const endIdx = this.text.indexOf('endstream', pos);
            streamLength = endIdx === -1 ? 0 : endIdx - pos;
        }

        const streamData = this.data.slice(pos, pos + streamLength);
        pos += streamLength;

        return {
            obj: { type: 'stream', value: dict, stream: streamData },
            endPos: pos,
        };
    }

    private parseValue(pos: number): { obj: PdfObject; endPos: number } {
        pos = this.skipWhitespace(pos);
        if (pos >= this.text.length) return { obj: { type: 'null', value: null }, endPos: pos };

        const ch = this.text[pos];
        const ch2 = pos + 1 < this.text.length ? this.text[pos + 1] : '';

        if (ch === '<' && ch2 === '<') {
            return this.parseDict(pos);
        }
        if (ch === '<') {
            return this.parseHexString(pos);
        }
        if (ch === '(') {
            return this.parseLiteralString(pos);
        }
        if (ch === '/') {
            return this.parseName(pos);
        }
        if (ch === '[') {
            return this.parseArray(pos);
        }
        if (ch === 't' && this.text.substring(pos, pos + 4) === 'true') {
            return { obj: { type: 'boolean', value: true }, endPos: pos + 4 };
        }
        if (ch === 'f' && this.text.substring(pos, pos + 5) === 'false') {
            return { obj: { type: 'boolean', value: false }, endPos: pos + 5 };
        }
        if (ch === 'n' && this.text.substring(pos, pos + 4) === 'null') {
            return { obj: { type: 'null', value: null }, endPos: pos + 4 };
        }

        return this.parseNumberOrRef(pos);
    }

    private parseNumberOrRef(pos: number): { obj: PdfObject; endPos: number } {
        const numMatch = /^([+-]?\d+\.?\d*|[+-]?\.\d+)/.exec(this.text.substring(pos));
        if (!numMatch) {
            return { obj: { type: 'null', value: null }, endPos: pos + 1 };
        }
        const num = Number.parseFloat(numMatch[1]);
        const afterNum = pos + numMatch[0].length;
        const refMatch = /^\s+(\d+)\s+R/.exec(this.text.substring(afterNum));
        if (refMatch) {
            const gen = Number.parseInt(refMatch[1], 10);
            return {
                obj: { type: 'ref', value: `${Math.floor(num)} ${gen}` },
                endPos: afterNum + refMatch[0].length,
            };
        }
        return { obj: { type: 'number', value: num }, endPos: afterNum };
    }

    private parseDict(pos: number): { obj: PdfObject; endPos: number } {
        pos += 2;
        const dict: Record<string, PdfObject> = {};
        while (pos < this.text.length) {
            pos = this.skipWhitespace(pos);
            if (this.text[pos] === '>' && this.text[pos + 1] === '>') {
                return { obj: { type: 'dict', value: dict }, endPos: pos + 2 };
            }
            if (this.text[pos] !== '/') {
                pos++;
                continue;
            }
            const nameResult = this.parseName(pos);
            const key = nameResult.obj.value as string;
            pos = nameResult.endPos;
            const valResult = this.parseValue(pos);
            dict[key] = valResult.obj;
            pos = valResult.endPos;
        }
        return { obj: { type: 'dict', value: dict }, endPos: pos };
    }

    private parseArray(pos: number): { obj: PdfObject; endPos: number } {
        pos += 1;
        const arr: PdfObject[] = [];
        while (pos < this.text.length) {
            pos = this.skipWhitespace(pos);
            if (this.text[pos] === ']') {
                return { obj: { type: 'array', value: arr }, endPos: pos + 1 };
            }
            const result = this.parseValue(pos);
            arr.push(result.obj);
            pos = result.endPos;
        }
        return { obj: { type: 'array', value: arr }, endPos: pos };
    }

    private parseName(pos: number): { obj: PdfObject; endPos: number } {
        pos += 1;
        let name = '';
        while (pos < this.text.length) {
            const c = this.text[pos];
            if (' \t\r\n\0\f/<>[](){}%'.includes(c)) break;
            if (c === '#' && pos + 2 < this.text.length) {
                name += String.fromCodePoint(Number.parseInt(this.text.substring(pos + 1, pos + 3), 16));
                pos += 3;
            } else {
                name += c;
                pos++;
            }
        }
        return { obj: { type: 'name', value: name }, endPos: pos };
    }

    private parseOctalEscape(pos: number): { char: string; endPos: number } {
        let octal = this.text[pos];
        if (pos + 1 < this.text.length && this.text[pos + 1] >= '0' && this.text[pos + 1] <= '7') {
            pos++;
            octal += this.text[pos];
            if (pos + 1 < this.text.length && this.text[pos + 1] >= '0' && this.text[pos + 1] <= '7') {
                pos++;
                octal += this.text[pos];
            }
        }
        return { char: String.fromCodePoint(Number.parseInt(octal, 8)), endPos: pos };
    }

    private processEscapeChar(pos: number, escapeMap: Record<string, string>): { char: string; endPos: number } {
        pos++;
        const esc = this.text[pos];
        const mapped = escapeMap[esc];
        if (mapped) {
            return { char: mapped, endPos: pos + 1 };
        }
        if (esc >= '0' && esc <= '7') {
            const octalResult = this.parseOctalEscape(pos);
            return { char: octalResult.char, endPos: octalResult.endPos + 1 };
        }
        return { char: esc, endPos: pos + 1 };
    }

    private parseLiteralString(pos: number): { obj: PdfObject; endPos: number } {
        pos += 1;
        let str = '';
        let depth = 1;
        const escapeMap: Record<string, string> = {
            'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f',
            '(': '(', ')': ')', '\\': '\\',
        };
        while (pos < this.text.length && depth > 0) {
            const c = this.text[pos];
            if (c === '\\' && pos + 1 < this.text.length) {
                const result = this.processEscapeChar(pos, escapeMap);
                str += result.char;
                pos = result.endPos;
            } else if (c === '(') {
                depth++;
                str += c;
                pos++;
            } else if (c === ')') {
                depth--;
                if (depth > 0) { str += c; }
                pos++;
            } else {
                str += c;
                pos++;
            }
        }
        return { obj: { type: 'string', value: str }, endPos: pos };
    }

    private parseHexString(pos: number): { obj: PdfObject; endPos: number } {
        pos += 1;
        let hex = '';
        while (pos < this.text.length && this.text[pos] !== '>') {
            const c = this.text[pos];
            if (!' \t\r\n\0\f'.includes(c)) hex += c;
            pos++;
        }
        if (this.text[pos] === '>') pos++;
        if (hex.length % 2 !== 0) hex += '0';
        let str = '';
        for (let i = 0; i < hex.length; i += 2) {
            str += String.fromCodePoint(Number.parseInt(hex.substring(i, i + 2), 16));
        }
        return { obj: { type: 'string', value: str }, endPos: pos };
    }

    private parseObjectStream(streamObjNum: number): void {
        const streamKey = `${streamObjNum} 0`;
        const streamEntry = this.objects.get(streamKey);
        if (!streamEntry) return;

        const streamResult = this.parseObjectAt(streamEntry.offset);
        const streamObj = streamResult.obj;
        if (streamObj.type !== 'stream' || !streamObj.stream) return;

        const dict = streamObj.value as Record<string, PdfObject>;
        const n = this.getNumber(dict['N']);
        const first = this.getNumber(dict['First']);
        if (n <= 0 || first <= 0) return;

        const decoded = this.decodeStreamData(dict, streamObj.stream);
        const decodedText = new TextDecoder('latin1').decode(decoded);
        const headerParts = decodedText.substring(0, first).trim().split(/\s+/);

        const savedText = this.text;
        const savedData = this.data;
        this.text = decodedText;
        this.data = decoded;

        try {
            for (let i = 0; i + 1 < headerParts.length && i / 2 < n; i += 2) {
                const objNum = Number.parseInt(headerParts[i], 10);
                const byteOffset = Number.parseInt(headerParts[i + 1], 10);
                const key = `${objNum} 0`;

                if (this.parsedObjects.has(key)) continue;

                const result = this.parseValue(first + byteOffset);
                this.parsedObjects.set(key, result.obj);
            }
        } finally {
            this.text = savedText;
            this.data = savedData;
        }
    }

    resolveRef(obj: PdfObject): PdfObject {
        if (obj.type !== 'ref') return obj;
        const key = obj.value as string;
        const cached = this.parsedObjects.get(key);
        if (cached) return cached;

        const entry = this.objects.get(key);
        if (!entry) {
            const compressed = this.compressedObjects.get(key);
            if (!compressed) return { type: 'null', value: null };
            this.parseObjectStream(compressed.streamObjNum);
            return this.parsedObjects.get(key) ?? { type: 'null', value: null };
        }

        const result = this.parseObjectAt(entry.offset);
        this.parsedObjects.set(key, result.obj);
        return result.obj;
    }

    resolveDeep(obj: PdfObject): PdfObject {
        if (obj.type === 'ref') return this.resolveDeep(this.resolveRef(obj));
        return obj;
    }

    getDict(obj: PdfObject): Record<string, PdfObject> {
        const resolved = this.resolveDeep(obj);
        if (resolved.type === 'dict' || resolved.type === 'stream') {
            return resolved.value as Record<string, PdfObject>;
        }
        return {};
    }

    getArray(obj: PdfObject): PdfObject[] {
        const resolved = this.resolveDeep(obj);
        if (resolved.type === 'array') return resolved.value as PdfObject[];
        return [];
    }

    getNumber(obj: PdfObject | undefined): number {
        if (!obj) return 0;
        const resolved = this.resolveDeep(obj);
        return resolved.type === 'number' ? resolved.value as number : 0;
    }

    getString(obj: PdfObject | undefined): string {
        if (!obj) return '';
        const resolved = this.resolveDeep(obj);
        if (resolved.type === 'string' || resolved.type === 'name') return resolved.value as string;
        return '';
    }

    private getDecodeParmsArray(dict: Record<string, PdfObject>, filterCount: number): Array<Record<string, PdfObject>> {
        const dpObj = dict['DecodeParms'] ?? dict['DP'];
        if (!dpObj) return new Array<Record<string, PdfObject>>(filterCount).fill({});
        const resolved = this.resolveDeep(dpObj);
        if (resolved.type === 'dict') {
            const d = resolved.value as Record<string, PdfObject>;
            return new Array<Record<string, PdfObject>>(filterCount).fill(d);
        }
        if (resolved.type === 'array') {
            return (resolved.value as PdfObject[]).map(item => {
                const r = this.resolveDeep(item);
                if (r.type === 'dict') return r.value as Record<string, PdfObject>;
                return {};
            });
        }
        return new Array<Record<string, PdfObject>>(filterCount).fill({});
    }

    private applyFlatePredictor(data: Uint8Array, parms: Record<string, PdfObject>): Uint8Array {
        const predictor = this.getNumber(parms['Predictor']);
        if (predictor <= 1) return data;
        const columns = this.getNumber(parms['Columns']) || 1;
        const colors = this.getNumber(parms['Colors']) || 1;
        const bpc = this.getNumber(parms['BitsPerComponent']) || 8;

        if (predictor >= 10) {
            return applyPngPredictor(data, columns, colors, bpc);
        }
        return data;
    }

    private resolveFilterNames(filterObj: PdfObject): string[] {
        const resolved = this.resolveDeep(filterObj);
        if (resolved.type === 'name') return [resolved.value as string];
        if (resolved.type === 'array') {
            const names: string[] = [];
            for (const f of resolved.value as PdfObject[]) {
                const rf = this.resolveDeep(f);
                if (rf.type === 'name') names.push(rf.value as string);
            }
            return names;
        }
        return [];
    }

    private applyFilter(data: Uint8Array, filter: string, parms: Record<string, PdfObject>): Uint8Array | null {
        if (filter === 'FlateDecode' || filter === 'Fl') {
            return this.applyFlatePredictor(zlibInflate(data), parms);
        }
        if (filter === 'ASCIIHexDecode' || filter === 'AHx') return decodeASCIIHex(data);
        if (filter === 'ASCII85Decode' || filter === 'A85') return decodeASCII85(data);
        if (filter === 'LZWDecode' || filter === 'LZW') {
            const earlyChange = this.getNumber(parms['EarlyChange']);
            return this.applyFlatePredictor(decodeLZW(data, earlyChange === 0 ? 0 : 1), parms);
        }
        if (filter === 'RunLengthDecode' || filter === 'RL') return decodeRunLength(data);
        if (filter === 'CCITTFaxDecode' || filter === 'CCF') return decodeCCITTFax(data, parms, this);
        if (filter === 'JBIG2Decode') return null;
        return data;
    }

    decodeStreamData(dict: Record<string, PdfObject>, rawStream: Uint8Array): Uint8Array {
        const filterObj = dict['Filter'];
        if (!filterObj) return rawStream;

        const filters = this.resolveFilterNames(filterObj);
        const decodeParms = this.getDecodeParmsArray(dict, filters.length);
        let result = rawStream;

        for (let fi = 0; fi < filters.length; fi++) {
            try {
                const decoded = this.applyFilter(result, filters[fi], decodeParms[fi] ?? {});
                if (decoded === null) return rawStream;
                result = decoded;
            } catch {
                return rawStream;
            }
        }
        return result;
    }

    getStreamData(obj: PdfObject): Uint8Array {
        const resolved = this.resolveDeep(obj);
        if (resolved.type === 'stream' && resolved.stream) {
            const dict = resolved.value as Record<string, PdfObject>;
            return this.decodeStreamData(dict, resolved.stream);
        }
        return new Uint8Array(0);
    }

    getTrailer(): Record<string, PdfObject> {
        return this.trailer ?? {};
    }

    private isCatalogDict(obj: PdfObject): Record<string, PdfObject> | null {
        if (obj.type !== 'dict' && obj.type !== 'stream') return null;
        const dict = obj.value as Record<string, PdfObject>;
        const typeStr = dict['Type'] ? this.getString(dict['Type']) : '';
        return typeStr === 'Catalog' ? dict : null;
    }

    getRoot(): Record<string, PdfObject> {
        const trailer = this.getTrailer();
        const rootRef = trailer['Root'];
        if (rootRef) return this.getDict(rootRef);

        for (const [, obj] of this.parsedObjects) {
            const catalog = this.isCatalogDict(obj);
            if (catalog) return catalog;
        }
        for (const [key] of this.objects) {
            const obj = this.resolveRef({ type: 'ref', value: key });
            const catalog = this.isCatalogDict(obj);
            if (catalog) return catalog;
        }

        return {};
    }

    getPages(): PdfObject[] {
        const root = this.getRoot();
        const pagesRef = root['Pages'];
        if (!pagesRef) return [];
        return this.collectPages(pagesRef);
    }

    private collectPages(node: PdfObject): PdfObject[] {
        const dict = this.getDict(node);
        const typeObj = dict['Type'];
        const typeName = typeObj ? this.getString(typeObj) : '';
        const kids = dict['Kids'];

        if (typeName === 'Page' || (!kids && dict['Contents'])) {
            return [this.resolveDeep(node)];
        }

        if (!kids) return [];
        const pages: PdfObject[] = [];
        for (const kid of this.getArray(kids)) {
            pages.push(...this.collectPages(kid));
        }
        return pages;
    }

    isEncrypted(): boolean {
        const trailer = this.getTrailer();
        return !!trailer['Encrypt'];
    }
}

// ── Content stream parser ───────────────────────────────────────────────

const PDF_DOC_ENCODING: Record<number, string> = {
    0x80: '\u2022', 0x81: '\u2020', 0x82: '\u2021', 0x83: '\u2026',
    0x84: '\u2014', 0x85: '\u2013', 0x86: '\u0192', 0x87: '\u2044',
    0x88: '\u2039', 0x89: '\u203A', 0x8A: '\u2212', 0x8B: '\u2030',
    0x8C: '\u201E', 0x8D: '\u201C', 0x8E: '\u201D', 0x8F: '\u2018',
    0x90: '\u2019', 0x91: '\u201A', 0x92: '\u2122', 0x93: '\uFB01',
    0x94: '\uFB02', 0x95: '\u0141', 0x96: '\u0152', 0x97: '\u0160',
    0x98: '\u0178', 0x99: '\u017D', 0x9A: '\u0131', 0x9B: '\u0142',
    0x9C: '\u0153', 0x9D: '\u0161', 0x9E: '\u017E', 0xA0: '\u20AC',
    0xAD: '\u02C7',
};

function decodeTwoByteChar(code: number, toUnicode: Map<number, string>): string {
    const mapped = toUnicode.get(code);
    if (mapped !== undefined) {
        return mapped;
    }

    const lo = code & 0xFF;
    const loMapped = toUnicode.get(lo);
    if (loMapped !== undefined) {
        return loMapped;
    }

    if (code >= 0x20 && code < 0xFFFE) {
        const ch = String.fromCodePoint(code);
        if (isValidDecodedChar(code)) {
            return ch;
        }
    }

    if (lo >= 0x20 && lo < 0x7F) {
        return String.fromCodePoint(lo);
    }

    return '';
}

const VALID_DECODED_CHAR_RANGES: ReadonlyArray<[number, number]> = [
    [0x0020, 0x007E], [0x00A0, 0x024F], [0x0370, 0x03FF], [0x0400, 0x04FF],
    [0x0500, 0x05FF], [0x0600, 0x06FF], [0x0900, 0x097F], [0x2000, 0x206F],
    [0x2010, 0x2027], [0x20A0, 0x20CF], [0xFB1D, 0xFB4F], [0xFB50, 0xFDFF],
    [0xFE70, 0xFEFF],
];

function isValidDecodedChar(code: number): boolean {
    return VALID_DECODED_CHAR_RANGES.some(([lo, hi]) => code >= lo && code <= hi);
}

function decodeTwoByteString(raw: string, fontInfo: FontInfo): { result: string; charCodes: number[] } {
    let result = '';
    const charCodes: number[] = [];
    for (let i = 0; i + 1 < raw.length; i += 2) {
        const code = ((raw.codePointAt(i) ?? 0) << 8) | (raw.codePointAt(i + 1) ?? 0);
        charCodes.push(code);
        result += decodeTwoByteChar(code, fontInfo.toUnicode);
    }
    if (raw.length % 2 === 1) {
        const code = raw.codePointAt(raw.length - 1) ?? 0;
        charCodes.push(code);
        result += decodeTwoByteChar(code, fontInfo.toUnicode);
    }
    return { result, charCodes };
}

function decodeSingleByteString(raw: string, toUnicode?: Map<number, string>): { result: string; charCodes: number[] } {
    let result = '';
    const charCodes: number[] = [];
    for (let i = 0; i < raw.length; i++) {
        const code = raw.codePointAt(i) ?? 0;
        charCodes.push(code);
        const unicodeMapped = toUnicode?.get(code);
        if (unicodeMapped !== undefined) {
            result += unicodeMapped;
        } else if (PDF_DOC_ENCODING[code]) {
            result += PDF_DOC_ENCODING[code];
        } else {
            result += raw[i];
        }
    }
    return { result, charCodes };
}

function pdfStringToUnicode(
    raw: string,
    fontInfo?: FontInfo,
): { text: string; charCodes: number[] } {
    if (fontInfo?.isTwoByte) {
        const { result, charCodes } = decodeTwoByteString(raw, fontInfo);
        return { text: result, charCodes };
    }
    const { result, charCodes } = decodeSingleByteString(raw, fontInfo?.toUnicode);
    return { text: result, charCodes };
}

function parseBfCharEntries(text: string, map: Map<number, string>): void {
    const bfCharRe = /beginbfchar\s+([\s\S]*?)endbfchar/g;
    let match: RegExpExecArray | null;
    while ((match = bfCharRe.exec(text)) !== null) {
        for (const entry of match[1].trim().split('\n')) {
            const parts = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/.exec(entry.trim());
            if (!parts) continue;
            const srcCode = Number.parseInt(parts[1], 16);
            map.set(srcCode, hexToUnicodeStr(parts[2]));
        }
    }
}

function hexToUnicodeStr(hex: string): string {
    let result = '';
    for (let i = 0; i < hex.length; i += 4) {
        result += String.fromCodePoint(Number.parseInt(hex.substring(i, i + 4), 16));
    }
    return result;
}

function parseBfRangeArrayEntry(arrayParts: RegExpExecArray, map: Map<number, string>): void {
    const start = Number.parseInt(arrayParts[1], 16);
    const end = Number.parseInt(arrayParts[2], 16);
    const values = [...arrayParts[3].matchAll(/<([0-9a-fA-F]+)>/g)];
    const count = Math.min(values.length, end - start + 1);
    for (let i = 0; i < count; i++) {
        map.set(start + i, hexToUnicodeStr(values[i][1]));
    }
}

function parseBfRangeSimpleEntry(parts: RegExpExecArray, map: Map<number, string>): void {
    const start = Number.parseInt(parts[1], 16);
    const end = Number.parseInt(parts[2], 16);
    if (end - start > 10000) return;
    let dstStart = Number.parseInt(parts[3], 16);
    for (let code = start; code <= end; code++) {
        map.set(code, String.fromCodePoint(dstStart++));
    }
}

function parseBfRangeEntry(trimmed: string, map: Map<number, string>): void {
    const arrayParts = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[((?:\s*<[\dA-Fa-f]+>\s*)+)\]/.exec(trimmed);
    if (arrayParts) {
        parseBfRangeArrayEntry(arrayParts, map);
        return;
    }
    const parts = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/.exec(trimmed);
    if (parts) {
        parseBfRangeSimpleEntry(parts, map);
    }
}

function parseBfRangeEntries(text: string, map: Map<number, string>): void {
    const bfRangeRe = /beginbfrange\s+([\s\S]*?)endbfrange/g;
    let match: RegExpExecArray | null;
    while ((match = bfRangeRe.exec(text)) !== null) {
        for (const entry of match[1].trim().split('\n')) {
            parseBfRangeEntry(entry.trim(), map);
        }
    }
}

function canInterpolateGap(
    prevGlyph: number, nextGlyph: number, prevUnicode: string, nextUnicode: string,
): { prevCode: number; glyphGap: number } | null {
    const glyphGap = nextGlyph - prevGlyph;
    if (glyphGap <= 1 || glyphGap > 32) return null;
    if (prevGlyph < 0x20 || nextGlyph < 0x20) return null;
    if (prevUnicode.length !== 1 || nextUnicode.length !== 1) return null;
    const prevCode = prevUnicode.codePointAt(0) ?? 0;
    const nextCode = nextUnicode.codePointAt(0) ?? 0;
    if (prevCode < 0x20 || nextCode < 0x20) return null;
    if (nextCode - prevCode !== glyphGap) return null;
    return { prevCode, glyphGap };
}

function fillToUnicodeGaps(map: Map<number, string>): void {
    const entries = [...map.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < entries.length; i++) {
        const [prevGlyph, prevUnicode] = entries[i - 1];
        const [nextGlyph, nextUnicode] = entries[i];
        const gap = canInterpolateGap(prevGlyph, nextGlyph, prevUnicode, nextUnicode);
        if (!gap) continue;
        for (let g = prevGlyph + 1; g < nextGlyph; g++) {
            if (!map.has(g)) {
                map.set(g, String.fromCodePoint(gap.prevCode + (g - prevGlyph)));
            }
        }
    }
}

function parseToUnicodeMap(data: Uint8Array): Map<number, string> {
    const map = new Map<number, string>();
    const text = new TextDecoder('latin1').decode(data);
    parseBfCharEntries(text, map);
    parseBfRangeEntries(text, map);
    fillToUnicodeGaps(map);
    return map;
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number): string => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function cmykToRgbHex(c: number, m: number, y: number, k: number): string {
    const r = (1 - c) * (1 - k);
    const g = (1 - m) * (1 - k);
    const b = (1 - y) * (1 - k);
    return rgbToHex(r, g, b);
}

function grayToHex(g: number): string {
    return rgbToHex(g, g, g);
}

function isDefaultColor(color: string): boolean {
    return !color || color === '#000000' || color === '#000' || color === '';
}

function isRTLChar(code: number): boolean {
    return (code >= 0x0590 && code <= 0x05FF) ||
           (code >= 0xFB1D && code <= 0xFB4F) ||
           (code >= 0x0600 && code <= 0x06FF) ||
           (code >= 0x0750 && code <= 0x077F) ||
           (code >= 0xFB50 && code <= 0xFDFF) ||
           (code >= 0xFE70 && code <= 0xFEFF);
}

function hasRTLText(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        if (isRTLChar(text.codePointAt(i) ?? 0)) return true;
    }
    return false;
}

function isLTRCode(code: number): boolean {
    return (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)
        || (code >= 0x30 && code <= 0x39)
        || code === 0x26 || code === 0x2E;  // & and . for compound LTR words like Auto&Play, Autorun.inf
}

function flushLtrRun(ltrRun: string): string {
    return ltrRun.trimEnd().split(' ')
        .map(w => w.split('').reverse().join(''))
        .reverse().join(' ');
}

function fixRTLWordChars(word: string): string {
    const chars = [...word].reverse();
    let result = '';
    let ltrRun = '';
    for (const ch of chars) {
        const code = ch.codePointAt(0) ?? 0;
        if (isLTRCode(code)) {
            ltrRun += ch;
        } else {
            if (ltrRun) {
                result += flushLtrRun(ltrRun);
                ltrRun = '';
            }
            result += ch;
        }
    }
    if (ltrRun) {
        result += flushLtrRun(ltrRun);
    }
    return result;
}

function fixVisualOrderRTL(text: string): string {
    if (!hasRTLText(text)) return text;
    return text.split(/(\s+)/).map(token => hasRTLText(token) ? fixRTLWordChars(token) : token).join('');
}

function joinSplitHebrewFragments(text: string): string {
    return text
        .replaceAll(/"([\u0590-\u05FF]+)\s+([\u0590-\u05FF])(?=\s|[^"\u0590-\u05FF]|$)/g,
            (_m, p1: string, p2: string) => p1 + '"' + p2)
        .replaceAll(/(?<![\u0590-\u05FF])([\u0590-\u05FF])\s+([\u0590-\u05FF]+)"(?=\s|[^"\u0590-\u05FF]|$)/g,
            (_m, p1: string, p2: string) => p1 + p2 + '"');
}

function fixBracketsAroundLtrWords(text: string): string {
    // fixRTLWordChars inverts brackets around LTR words (e.g. "(Default)-ה" → "ה-)Default(").
    // Fix: )(LTR_word)( → (LTR_word).
    return text.replaceAll(/\)([A-Za-z\d][^()\s]*)\(/g, '($1)');
}

function fixSplitRoundBrackets(text: string): string {
    // PDF splits "(word)" into a standalone ")" and "word(" (with bracket merged in visual order).
    // After word-order reversal: ") word(". After mirrorBracketsAdjacentToRtl the trailing "("
    // (adjacent to RTL) becomes ")" giving ") word)". Match both forms and rejoin as "(word)".
    return text.replaceAll(/\) +([\u0590-\u05FF][^\s()]*)[()]/g, '($1)');
}

function hasLatinChar(word: string): boolean {
    for (let i = 0; i < word.length; i++) {
        const c = word.codePointAt(i) ?? 0;
        if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) return true;
    }
    return false;
}

function joinLtrGroup(group: string[], groupSpaces: string[]): string {
    let grouped = group[0];
    for (let j = 1; j < group.length; j++) {
        grouped += groupSpaces[j - 1] + group[j];
    }
    return grouped;
}

function flushLtrGroup(units: string[], ltrGroup: string[], ltrSpaces: string[]): void {
    if (ltrGroup.length > 0) {
        units.push(joinLtrGroup(ltrGroup, ltrSpaces));
        ltrGroup.length = 0;
        ltrSpaces.length = 0;
    }
}

function collectRTLUnits(words: string[], spaces: string[]): string[] {
    const units: string[] = [];
    const ltrGroup: string[] = [];
    const ltrSpaces: string[] = [];

    for (let i = 0; i < words.length; i++) {
        const firstCode = words[i].codePointAt(0) ?? 0;
        const isLtrWord = hasLatinChar(words[i]) && !isRTLChar(firstCode);
        if (isLtrWord) {
            if (ltrGroup.length > 0) {
                ltrSpaces.push(i > 0 ? spaces[i - 1] : ' ');
            }
            ltrGroup.push(words[i]);
        } else {
            flushLtrGroup(units, ltrGroup, ltrSpaces);
            units.push(words[i]);
        }
    }
    flushLtrGroup(units, ltrGroup, ltrSpaces);
    return units;
}

function findLtrStart(text: string): number {
    for (let i = 0; i < text.length; i++) {
        if (isLTRCode(text.codePointAt(i) ?? 0)) return i;
    }
    return -1;
}

function tryReattachPrefix(
    unit: string, next: string, ltrStart: number, result: string[],
): boolean {
    const charBeforeLtr = unit.codePointAt(ltrStart - 1) ?? 0;
    if (charBeforeLtr === 0x22) {
        const hebrewPrefix = unit.substring(0, ltrStart - 1);
        const ltrSuffix = unit.substring(ltrStart) + '"';
        result.push(hebrewPrefix + next, ltrSuffix);
        return true;
    }
    if (isRTLChar(charBeforeLtr)) {
        result.push(unit.substring(0, ltrStart) + next, unit.substring(ltrStart));
        return true;
    }
    return false;
}

function reattachHebrewPrefixes(units: string[]): string[] {
    const result: string[] = [];
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        const next = i + 1 < units.length ? units[i + 1] : null;
        if (next !== null && hasLatinChar(unit) && hasRTLText(unit) && !hasRTLText(next)) {
            const ltrStart = findLtrStart(unit);
            if (ltrStart > 0 && tryReattachPrefix(unit, next, ltrStart, result)) {
                i++;
                continue;
            }
        }
        result.push(unit);
    }
    return result;
}

function fixLeadingPunctuation(units: string[]): string[] {
    return units.map(unit => {
        if (unit.length < 2 || hasRTLText(unit)) return unit;
        let end = 0;
        while (end < unit.length) {
            const code = unit.codePointAt(end) ?? 0;
            if (code === 0x2E || code === 0x21 || code === 0x3F || code === 0x2C || code === 0x3A) end++;
            else break;
        }
        if (end > 0 && end < unit.length) return unit.slice(end) + unit.slice(0, end);
        return unit;
    });
}

function mirrorBracketCode(code: number): number {
    if (code === 0x28) return 0x29;
    if (code === 0x29) return 0x28;
    if (code === 0x5B) return 0x5D;
    if (code === 0x5D) return 0x5B;
    return code;
}

function isBracketCode(code: number): boolean {
    return code === 0x28 || code === 0x29 || code === 0x5B || code === 0x5D;
}

function isSquareBracketCode(code: number): boolean {
    return code === 0x5B || code === 0x5D;
}

function hasMatchingCloseBracket(text: string, openCode: number): boolean {
    const closeCode = mirrorBracketCode(openCode);
    for (const ch of text.slice(1)) {
        if ((ch.codePointAt(0) ?? 0) === closeCode) return true;
    }
    return false;
}

function fixSquareBracketUnit(unit: string, firstCode: number): string {
    const lastCode = unit.codePointAt(unit.length - 1) ?? 0;
    const mirroredFirst = mirrorBracketCode(firstCode);
    if (isBracketCode(lastCode) && mirroredFirst === lastCode) {
        const mirroredLast = mirrorBracketCode(lastCode);
        return String.fromCodePoint(mirroredFirst) + unit.slice(1, -1) + String.fromCodePoint(mirroredLast);
    }
    return String.fromCodePoint(mirroredFirst) + unit.slice(1);
}

function fixRoundBracketUnit(unit: string, firstCode: number): string {
    const rest = unit.slice(1);
    const mirrored = String.fromCodePoint(mirrorBracketCode(firstCode));
    let insertPos = rest.length;
    while (insertPos > 0) {
        const code = rest.codePointAt(insertPos - 1) ?? 0;
        if (code === 0x2E || code === 0x21 || code === 0x3F) insertPos--;
        else break;
    }
    return rest.slice(0, insertPos) + mirrored + rest.slice(insertPos);
}

function fixLeadingBracketInUnit(unit: string): string {
    if (unit.length < 2 || hasRTLText(unit)) return unit;
    const firstCode = unit.codePointAt(0) ?? 0;
    if (!isBracketCode(firstCode)) return unit;
    if (isSquareBracketCode(firstCode)) return fixSquareBracketUnit(unit, firstCode);
    if (hasMatchingCloseBracket(unit, firstCode)) return unit;
    return fixRoundBracketUnit(unit, firstCode);
}

function fixLeadingBracketsInLtrTokens(units: string[]): string[] {
    return units.map(fixLeadingBracketInUnit);
}

function reverseRTLWordOrder(text: string): string {
    const tokens = text.split(/(\s+)/);
    const words: string[] = [];
    const spaces: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
        if (i % 2 === 0) words.push(tokens[i]);
        else spaces.push(tokens[i]);
    }

    const units = collectRTLUnits(words, spaces);
    units.reverse();
    const afterPunct = fixLeadingPunctuation(reattachHebrewPrefixes(units));
    return fixLeadingBracketsInLtrTokens(afterPunct).join(' ');
}

function isLineRTL(line: TextLine): boolean {
    let rtl = 0;
    let total = 0;
    for (const item of line.items) {
        for (let i = 0; i < item.text.length; i++) {
            const code = item.text.codePointAt(i) ?? 0;
            if (code > 0x20) total++;
            if (isRTLChar(code)) rtl++;
        }
    }
    return total > 0 && rtl > total * 0.3;
}

export interface GraphicsState {
    ctm: number[];
    fontSize: number;
    fontName: string;
    fillColor: string;
    strokeColor: string;
    lineWidth: number;
    textMatrix: number[];
    lineMatrix: number[];
    leading: number;
    charSpacing: number;
    wordSpacing: number;
    textRise: number;
    horizontalScaling: number;
    textRenderMode: number;
    fillColorSpace: string;
    strokeColorSpace: string;
    strokeOpacity: number;
    fillOpacity: number;
    dashArray: number[];
    dashPhase: number;
    lineCap: number;
    lineJoin: number;
}

function identityMatrix(): number[] {
    return [1, 0, 0, 1, 0, 0];
}

function multiplyMatrix(a: number[], b: number[]): number[] {
    return [
        a[0] * b[0] + a[1] * b[2],
        a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2],
        a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4],
        a[4] * b[1] + a[5] * b[3] + b[5],
    ];
}

const CONTENT_ESCAPE_MAP: Record<string, string> = {
    'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f',
    '(': '(', ')': ')', '\\': '\\',
};

function tokenizeEscapeSequence(text: string, pos: number): { char: string; endPos: number } {
    const esc = text[pos];
    const mapped = CONTENT_ESCAPE_MAP[esc];
    if (mapped) {
        return { char: mapped, endPos: pos + 1 };
    }
    if (esc >= '0' && esc <= '7') {
        let oct = esc;
        if (pos + 1 < text.length && text[pos + 1] >= '0' && text[pos + 1] <= '7') {
            pos++; oct += text[pos];
            if (pos + 1 < text.length && text[pos + 1] >= '0' && text[pos + 1] <= '7') {
                pos++; oct += text[pos];
            }
        }
        return { char: String.fromCodePoint(Number.parseInt(oct, 8)), endPos: pos + 1 };
    }
    if (esc === '\r' || esc === '\n') {
        const endPos = (esc === '\r' && pos + 1 < text.length && text[pos + 1] === '\n')
            ? pos + 2
            : pos + 1;
        return { char: '', endPos };
    }
    return { char: esc, endPos: pos + 1 };
}

function tokenizeLiteralString(text: string, startPos: number): { token: string; endPos: number } {
    let pos = startPos + 1;
    let str = '';
    let depth = 1;
    while (pos < text.length && depth > 0) {
        if (text[pos] === '\\') {
            pos++;
            if (pos >= text.length) break;
            const result = tokenizeEscapeSequence(text, pos);
            str += result.char;
            pos = result.endPos;
        } else if (text[pos] === '(') {
            depth++; str += text[pos++];
        } else if (text[pos] === ')') {
            depth--;
            if (depth > 0) { str += text[pos]; }
            pos++;
        } else {
            str += text[pos++];
        }
    }
    return { token: '(' + str + ')', endPos: pos };
}

function tokenizeHexString(text: string, startPos: number): { token: string; endPos: number } {
    let pos = startPos + 1;
    let hex = '';
    while (pos < text.length && text[pos] !== '>') {
        if (!' \t\r\n\0\f'.includes(text[pos])) hex += text[pos];
        pos++;
    }
    if (pos < text.length) pos++;
    if (hex.length % 2 !== 0) hex += '0';
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCodePoint(Number.parseInt(hex.substring(i, i + 2), 16));
    }
    return { token: '(' + str + ')', endPos: pos };
}

function skipComment(text: string, pos: number): number {
    while (pos < text.length && text[pos] !== '\n' && text[pos] !== '\r') pos++;
    return pos;
}

function tokenizeAngleBracket(text: string, pos: number, tokens: string[]): number {
    if (pos + 1 < text.length && text[pos + 1] === '<') {
        tokens.push('<<');
        return pos + 2;
    }
    const result = tokenizeHexString(text, pos);
    tokens.push(result.token);
    return result.endPos;
}

function tokenizeClosingAngle(text: string, pos: number, tokens: string[]): number {
    if (pos + 1 < text.length && text[pos + 1] === '>') {
        tokens.push('>>');
        return pos + 2;
    }
    return pos + 1;
}

function tokenizeName(text: string, pos: number, tokens: string[]): number {
    let name = '/';
    pos++;
    while (pos < text.length && !' \t\r\n\0\f/<>[]()%'.includes(text[pos])) {
        name += text[pos++];
    }
    tokens.push(name);
    return pos;
}

function tokenizeGenericToken(text: string, pos: number, tokens: string[]): number {
    let token = '';
    while (pos < text.length && !' \t\r\n\0\f/<>[]()%'.includes(text[pos])) {
        token += text[pos++];
    }
    if (token) tokens.push(token);
    return pos;
}

function tokenizeNextElement(text: string, pos: number, tokens: string[]): number {
    const c = text[pos];
    if (c === '(') {
        const result = tokenizeLiteralString(text, pos);
        tokens.push(result.token);
        return result.endPos;
    }
    if (c === '<') return tokenizeAngleBracket(text, pos, tokens);
    if (c === '>') return tokenizeClosingAngle(text, pos, tokens);
    if (c === '[') { tokens.push('['); return pos + 1; }
    if (c === ']') { tokens.push(']'); return pos + 1; }
    if (c === '/') return tokenizeName(text, pos, tokens);
    return tokenizeGenericToken(text, pos, tokens);
}

function tokenizeContentStream(data: Uint8Array): string[] {
    const text = new TextDecoder('latin1').decode(data);
    const tokens: string[] = [];
    let pos = 0;

    while (pos < text.length) {
        while (pos < text.length && ' \t\r\n\0\f'.includes(text[pos])) pos++;
        if (pos >= text.length) break;

        if (text[pos] === '%') {
            pos = skipComment(text, pos);
            continue;
        }

        pos = tokenizeNextElement(text, pos, tokens);
    }

    return tokens;
}

function setCIDWidthsFromArray(widths: Map<number, number>, reader: PdfReader, first: number, wList: PdfObject[]): void {
    for (let j = 0; j < wList.length; j++) {
        widths.set(first + j, reader.getNumber(wList[j]));
    }
}

function setCIDWidthsFromRange(widths: Map<number, number>, first: number, last: number, w: number): void {
    for (let cid = first; cid <= last; cid++) {
        widths.set(cid, w);
    }
}

function parseCIDWidths(reader: PdfReader, wArray: PdfObject): Map<number, number> {
    const widths = new Map<number, number>();
    const arr = reader.getArray(wArray);
    let i = 0;
    while (i < arr.length) {
        const first = reader.getNumber(arr[i]);
        i++;
        if (i >= arr.length) break;
        const next = reader.resolveDeep(arr[i]);
        if (next.type === 'array') {
            setCIDWidthsFromArray(widths, reader, first, next.value as PdfObject[]);
            i++;
        } else if (next.type === 'number') {
            i++;
            if (i >= arr.length) break;
            setCIDWidthsFromRange(widths, first, next.value as number, reader.getNumber(arr[i]));
            i++;
        } else {
            i++;
        }
    }
    return widths;
}

function buildType0FontWidths(reader: PdfReader, fontObjDict: Record<string, PdfObject>): { widths: Map<number, number>; defaultWidth: number } {
    const descendantsRef = fontObjDict['DescendantFonts'];
    if (!descendantsRef) return { widths: new Map(), defaultWidth: 1000 };
    const descendants = reader.getArray(descendantsRef);
    if (descendants.length === 0) return { widths: new Map(), defaultWidth: 1000 };
    const cidFontDict = reader.getDict(descendants[0]);
    const dw = cidFontDict['DW'];
    const defaultWidth = dw ? reader.getNumber(dw) : 1000;
    const wArray = cidFontDict['W'];
    const widths = wArray ? parseCIDWidths(reader, wArray) : new Map<number, number>();
    return { widths, defaultWidth };
}

function buildStandardFontWidths(reader: PdfReader, fontObjDict: Record<string, PdfObject>): { widths: Map<number, number>; defaultWidth: number } {
    const firstChar = reader.getNumber(fontObjDict['FirstChar']);
    const widthsArr = fontObjDict['Widths'] ? reader.getArray(fontObjDict['Widths']) : [];
    const widths = new Map<number, number>();
    for (let ci = 0; ci < widthsArr.length; ci++) {
        widths.set(firstChar + ci, reader.getNumber(widthsArr[ci]));
    }
    let defaultWidth = 600;
    if (widthsArr.length === 0) {
        const fontDescRef = fontObjDict['FontDescriptor'];
        if (fontDescRef) {
            const fontDesc = reader.getDict(fontDescRef);
            const mw = fontDesc['MissingWidth'];
            if (mw) defaultWidth = reader.getNumber(mw);
            if (defaultWidth === 600 || defaultWidth === 0) {
                defaultWidth = extractCffDefaultWidth(reader, fontDesc) ?? 600;
            }
        }
    }
    return { widths, defaultWidth };
}

function glyphNameToUnicode(name: string): string | null {
    const uniMatch = /^uni([0-9A-Fa-f]{4,6})$/.exec(name);
    if (uniMatch) return String.fromCodePoint(Number.parseInt(uniMatch[1], 16));

    const uMatch = /^u([0-9A-Fa-f]{4,6})$/.exec(name);
    if (uMatch) return String.fromCodePoint(Number.parseInt(uMatch[1], 16));

    return GLYPH_NAME_MAP[name] ?? null;
}

const GLYPH_NAME_MAP: Record<string, string> = {
    space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$',
    percent: '%', ampersand: '&', quotesingle: "'", quoteright: '\u2019',
    parenleft: '(', parenright: ')', asterisk: '*', plus: '+', comma: ',',
    hyphen: '-', period: '.', slash: '/', colon: ':', semicolon: ';',
    less: '<', equal: '=', greater: '>', question: '?', at: '@',
    bracketleft: '[', backslash: '\\', bracketright: ']', underscore: '_',
    braceleft: '{', bar: '|', braceright: '}', bullet: '\u2022',
    endash: '\u2013', emdash: '\u2014', quoteleft: '\u2018',
    quotedblleft: '\u201C', quotedblright: '\u201D', quotesinglbase: '\u201A',
    quotedblbase: '\u201E', ellipsis: '\u2026', trademark: '\u2122',
    fi: '\uFB01', fl: '\uFB02', minus: '\u2212', fraction: '\u2044',
    Euro: '\u20AC', afii57636: '\u05D0', afii57637: '\u05D1',
    afii57638: '\u05D2', afii57639: '\u05D3', afii57640: '\u05D4',
    afii57641: '\u05D5', afii57642: '\u05D6', afii57643: '\u05D7',
    afii57644: '\u05D8', afii57645: '\u05D9', afii57646: '\u05DA',
    afii57647: '\u05DB', afii57648: '\u05DC', afii57649: '\u05DD',
    afii57650: '\u05DE', afii57651: '\u05DF', afii57652: '\u05E0',
    afii57653: '\u05E1', afii57654: '\u05E2', afii57655: '\u05E3',
    afii57656: '\u05E4', afii57657: '\u05E5', afii57658: '\u05E6',
    afii57659: '\u05E7', afii57660: '\u05E8', afii57661: '\u05E9',
    afii57662: '\u05EA', afii57664: '\u05B0', afii57665: '\u05B1',
    afii57666: '\u05B2', afii57667: '\u05B3', afii57668: '\u05B4',
    afii57669: '\u05B5', afii57670: '\u05B6', afii57671: '\u05B7',
    afii57672: '\u05B8', afii57673: '\u05B9', afii57674: '\u05BB',
    afii57675: '\u05BC', afii57676: '\u05BD', afii57677: '\u05BE',
    afii57678: '\u05BF', afii57679: '\u05C0', afii57680: '\u05C1',
    afii57681: '\u05C2', afii57682: '\u05C3', afii57683: '\u05F0',
    afii57684: '\u05F1', afii57685: '\u05F2', afii57686: '\u05F3',
    afii57687: '\u05F4', afii57388: '\u060C', afii57403: '\u061B',
    afii57407: '\u061F', afii57409: '\u0621', afii57410: '\u0622',
    afii57411: '\u0623', afii57412: '\u0624', afii57413: '\u0625',
    afii57414: '\u0626', afii57415: '\u0627', afii57416: '\u0628',
    afii57417: '\u0629', afii57418: '\u062A', afii57419: '\u062B',
    afii57420: '\u062C', afii57421: '\u062D', afii57422: '\u062E',
    afii57423: '\u062F', afii57424: '\u0630', afii57425: '\u0631',
    afii57426: '\u0632', afii57427: '\u0633', afii57428: '\u0634',
    afii57429: '\u0635', afii57430: '\u0636', afii57431: '\u0637',
    afii57432: '\u0638', afii57433: '\u0639', afii57434: '\u063A',
    afii57440: '\u0640', afii57441: '\u0641', afii57442: '\u0642',
    afii57443: '\u0643', afii57444: '\u0644', afii57445: '\u0645',
    afii57446: '\u0646', afii57448: '\u0648', afii57449: '\u0649',
    afii57450: '\u064A', afii57451: '\u064B', afii57452: '\u064C',
    afii57453: '\u064D', afii57454: '\u064E', afii57455: '\u064F',
    afii57456: '\u0650', afii57457: '\u0651', afii57458: '\u0652',
    afii57470: '\u0647', afii57505: '\u06A4', afii57506: '\u067E',
    afii57507: '\u0686', afii57508: '\u0698', afii57509: '\u06AF',
    geresh: '\u05F3', gershayim: '\u05F4', maqaf: '\u05BE',
    sheqel: '\u20AA', afii57534: '\u20AA',
};

function mapGlyphToUnicode(code: number, glyphName: string, toUnicode: Map<number, string>): void {
    if (!toUnicode.has(code) && glyphName !== '.notdef') {
        const unicode = glyphNameToUnicode(glyphName);
        if (unicode) toUnicode.set(code, unicode);
    }
}

function parseEncodingDifferences(reader: PdfReader, encodingObj: PdfObject, toUnicode: Map<number, string>): void {
    const resolved = reader.resolveDeep(encodingObj);
    if (resolved.type !== 'dict') return;

    const dict = resolved.value as Record<string, PdfObject>;
    const diffsObj = dict['Differences'];
    if (!diffsObj) return;

    const diffs = reader.getArray(diffsObj);
    let code = 0;

    for (const entry of diffs) {
        const entryResolved = reader.resolveDeep(entry);
        if (entryResolved.type === 'number') {
            code = entryResolved.value as number;
        } else if (entryResolved.type === 'name') {
            mapGlyphToUnicode(code, entryResolved.value as string, toUnicode);
            code++;
        }
    }
}

const FONT_FAMILY_NORMALIZATION: Record<string, string> = {
    'timesnewroman': 'Times New Roman',
    'timesnewromanps': 'Times New Roman',
    'times': 'Times New Roman',
    'arial': 'Arial',
    'arialmt': 'Arial',
    'helvetica': 'Helvetica',
    'helveticaneue': 'Helvetica Neue',
    'courier': 'Courier',
    'couriernew': 'Courier New',
    'georgia': 'Georgia',
    'verdana': 'Verdana',
    'tahoma': 'Tahoma',
    'trebuchetms': 'Trebuchet MS',
    'palatino': 'Palatino',
    'palatinolinotype': 'Palatino Linotype',
    'garamond': 'Garamond',
    'bookmanoldstyle': 'Bookman Old Style',
    'comicsansms': 'Comic Sans MS',
    'impact': 'Impact',
    'lucidaconsole': 'Lucida Console',
    'lucidasansunicode': 'Lucida Sans Unicode',
    'symbol': 'Symbol',
    'cambria': 'Cambria',
    'calibri': 'Calibri',
    'candara': 'Candara',
    'consolas': 'Consolas',
    'constantia': 'Constantia',
    'corbel': 'Corbel',
    'frankruehl': 'FrankRuehl',
    'miriam': 'Miriam',
    'david': 'David',
    'narkisim': 'Narkisim',
    'rod': 'Rod',
    'opensans': 'Open Sans',
    'roboto': 'Roboto',
    'lato': 'Lato',
    'montserrat': 'Montserrat',
    'sourcesanspro': 'Source Sans Pro',
    'notosans': 'Noto Sans',
    'notoserif': 'Noto Serif',
};

function normalizeFontFamily(baseFontName: string): string {
    if (!baseFontName) return '';
    let name = baseFontName;
    if (name.startsWith('/')) name = name.slice(1);
    const plusIdx = name.indexOf('+');
    if (plusIdx >= 0 && plusIdx <= 6) name = name.slice(plusIdx + 1);
    name = name.replaceAll(',', '-');
    const dashIdx = name.indexOf('-');
    const base = dashIdx >= 0 ? name.slice(0, dashIdx) : name;
    const lookup = base.toLowerCase().replaceAll(/[\s_]/g, '');
    const mapped = FONT_FAMILY_NORMALIZATION[lookup];
    if (mapped) return mapped;
    return base.replaceAll(/([a-z])([A-Z])/g, '$1 $2');
}

function applyFontDescriptorFlags(
    reader: PdfReader, descRef: PdfObject, style: { isBold: boolean; isItalic: boolean },
): void {
    const desc = reader.getDict(descRef);
    const flags = reader.getNumber(desc['Flags']);
    if (flags & (1 << 6)) style.isItalic = true;
    if (flags & (1 << 18)) style.isBold = true;
    const weight = reader.getNumber(desc['FontWeight']);
    if (weight >= 700) style.isBold = true;
    const italicAngle = reader.getNumber(desc['ItalicAngle']);
    if (italicAngle !== 0 && !style.isItalic) style.isItalic = true;
}

function detectFontStyle(reader: PdfReader, fontObjDict: Record<string, PdfObject>): {
    isBold: boolean; isItalic: boolean; familyName: string;
} {
    const baseFontName = reader.getString(fontObjDict['BaseFont']) || '';
    const nameLower = baseFontName.toLowerCase();

    const style = {
        isBold: /bold|heavy|black/.test(nameLower) && !/demi|semi|light/.test(nameLower),
        isItalic: /italic|oblique/.test(nameLower),
    };

    const descriptorRef = fontObjDict['FontDescriptor'];
    if (descriptorRef) {
        applyFontDescriptorFlags(reader, descriptorRef, style);
    }

    const descendantsRef = fontObjDict['DescendantFonts'];
    if (descendantsRef) {
        const descendants = reader.getArray(descendantsRef);
        if (descendants.length > 0) {
            const cidFontDict = reader.getDict(descendants[0]);
            const cidDescRef = cidFontDict['FontDescriptor'];
            if (cidDescRef) {
                applyFontDescriptorFlags(reader, cidDescRef, style);
            }
        }
    }

    const familyName = normalizeFontFamily(baseFontName);
    return { isBold: style.isBold, isItalic: style.isItalic, familyName };
}

function searchCffWidthInData(data: Uint8Array): number | null {
    if (data.length < 10) return null;
    if (data[0] !== 1 || data[3] < 1 || data[3] > 4) return null;
    const nameOffset = data[2];
    if (nameOffset >= data.length) return null;
    for (let i = nameOffset; i < Math.min(data.length - 4, nameOffset + 500); i++) {
        if (data[i] === 0x14) {
            return data[i - 1] >= 32 ? (data[i - 1] - 139) * 100 + 600 : 600;
        }
    }
    return null;
}

function extractCffDefaultWidth(reader: PdfReader, fontDesc: Record<string, PdfObject>): number | null {
    for (const key of ['FontFile3', 'FontFile2', 'FontFile']) {
        const ref = fontDesc[key];
        if (!ref) continue;
        try {
            const data = reader.getStreamData(ref);
            const result = searchCffWidthInData(data);
            if (result !== null) return result;
        } catch { /* skip */ }
    }
    return null;
}

export function buildFontInfo(reader: PdfReader, fontRef: PdfObject): FontInfo {
    const fontObjDict = reader.getDict(fontRef);
    const subtype = reader.getString(fontObjDict['Subtype']);
    const encodingObj = fontObjDict['Encoding'];
    const encoding = encodingObj ? reader.getString(encodingObj) : '';
    const { isBold, isItalic, familyName } = detectFontStyle(reader, fontObjDict);

    let toUnicode = new Map<number, string>();
    const toUnicodeRef = fontObjDict['ToUnicode'];
    if (toUnicodeRef) {
        const cmapData = reader.getStreamData(toUnicodeRef);
        if (cmapData.length > 0) {
            toUnicode = parseToUnicodeMap(cmapData);
        }
    }

    if (encodingObj) {
        parseEncodingDifferences(reader, encodingObj, toUnicode);
    }

    if (subtype === 'Type3') {
        const { widths, defaultWidth } = buildStandardFontWidths(reader, fontObjDict);
        return { isTwoByte: false, widths, defaultWidth, toUnicode, isBold, isItalic, familyName: familyName || 'serif' };
    }

    if (subtype === 'Type0') {
        const { widths, defaultWidth } = buildType0FontWidths(reader, fontObjDict);
        return { isTwoByte: true, widths, defaultWidth, toUnicode, isBold, isItalic, familyName };
    }

    if (encoding === 'Identity-H' || encoding === 'Identity-V') {
        return { isTwoByte: true, widths: new Map(), defaultWidth: 1000, toUnicode, isBold, isItalic, familyName };
    }

    const { widths, defaultWidth } = buildStandardFontWidths(reader, fontObjDict);
    return { isTwoByte: false, widths, defaultWidth, toUnicode, isBold, isItalic, familyName };
}

function resolveContentData(reader: PdfReader, contentsObj: PdfObject): Uint8Array {
    const resolved = reader.resolveDeep(contentsObj);
    if (resolved.type !== 'array') {
        return reader.getStreamData(contentsObj);
    }
    const parts: Uint8Array[] = [];
    for (const item of resolved.value as PdfObject[]) {
        parts.push(reader.getStreamData(item));
    }
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const contentData = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
        contentData.set(part, offset);
        offset += part.length;
    }
    return contentData;
}

function getEffectiveFontSize(gs: GraphicsState): number {
    const combined = multiplyMatrix(gs.textMatrix, gs.ctm);
    return Math.abs(gs.fontSize * combined[3]) || gs.fontSize;
}

function calcTextAdvance(charCodes: number[], fontInfo: FontInfo | undefined, gs: GraphicsState): number {
    let totalWidth = 0;
    for (const code of charCodes) {
        const w = fontInfo ? (fontInfo.widths.get(code) ?? fontInfo.defaultWidth) : 600;
        totalWidth += w;
    }
    const advance = (totalWidth / 1000) * gs.fontSize * (gs.horizontalScaling / 100);
    const spacing = charCodes.length * gs.charSpacing
        + charCodes.filter(c => c === 32).length * gs.wordSpacing;
    return advance + spacing;
}

function isInvisibleTextMode(mode: number): boolean {
    return mode === 3 || mode === 7;
}

function processTextShow(
    raw: string, gs: GraphicsState, fontInfoMap: Map<string, FontInfo>,
    textItems: TextItem[], pageIndex: number, currentMcid: number,
): void {
    const fontInfo = fontInfoMap.get(gs.fontName);
    const { text: rawDecoded, charCodes } = pdfStringToUnicode(raw, fontInfo);
    const advance = calcTextAdvance(charCodes, fontInfo, gs);
    if (isInvisibleTextMode(gs.textRenderMode) || gs.fillOpacity < 0.01) {
        gs.textMatrix[4] += advance;
        return;
    }
    if (!rawDecoded.trim()) {
        gs.textMatrix[4] += advance;
        return;
    }
    const riseMatrix: number[] = [1, 0, 0, 1, 0, gs.textRise];
    const combined = multiplyMatrix(multiplyMatrix(riseMatrix, gs.textMatrix), gs.ctm);
    const effectiveFontSize = getEffectiveFontSize(gs);
    const scaleX = Math.hypot(combined[0], combined[1]);
    const scaleY = Math.hypot(combined[2], combined[3]);
    const normA = scaleX > 0 ? combined[0] / scaleX : 1;
    const normB = scaleX > 0 ? combined[1] / scaleX : 0;
    const normC = scaleY > 0 ? combined[2] / scaleY : 0;
    const normD = scaleY > 0 ? combined[3] / scaleY : 1;

    textItems.push({
        text: rawDecoded,
        fontSize: effectiveFontSize,
        x: combined[4],
        y: combined[5],
        endX: combined[4] + advance,
        page: pageIndex,
        color: gs.fillColor,
        bold: fontInfo?.isBold ?? false,
        italic: fontInfo?.isItalic ?? false,
        fontFamily: fontInfo?.familyName ?? '',
        fontName: gs.fontName,
        mcid: currentMcid,
        charSpacing: gs.charSpacing,
        wordSpacing: gs.wordSpacing,
        textRise: gs.textRise,
        horizontalScaling: gs.horizontalScaling,
        textRenderMode: gs.textRenderMode,
        strokeColor: gs.strokeColor,
        transformMatrix: [normA, normB, normC, normD],
        isSpaceOffset: false,
    });
    gs.textMatrix[4] += advance;
}

interface PerCharContext {
    readonly baseCombined: number[];
    readonly effectiveFontSize: number;
    readonly tm: readonly [number, number, number, number];
    readonly fontInfo: FontInfo | undefined;
    readonly gs: GraphicsState;
    readonly pageIndex: number;
    readonly currentMcid: number;
}

function buildPerCharItem(
    text: string, charX: number, charEndX: number,
    isSpaceOffset: boolean, ctx: PerCharContext,
): TextItem {
    return {
        text,
        fontSize: ctx.effectiveFontSize,
        x: charX,
        y: ctx.baseCombined[5],
        endX: charEndX,
        page: ctx.pageIndex,
        color: ctx.gs.fillColor,
        bold: ctx.fontInfo?.isBold ?? false,
        italic: ctx.fontInfo?.isItalic ?? false,
        fontFamily: ctx.fontInfo?.familyName ?? '',
        fontName: ctx.gs.fontName,
        mcid: ctx.currentMcid,
        charSpacing: ctx.gs.charSpacing,
        wordSpacing: ctx.gs.wordSpacing,
        textRise: ctx.gs.textRise,
        horizontalScaling: ctx.gs.horizontalScaling,
        textRenderMode: ctx.gs.textRenderMode,
        strokeColor: ctx.gs.strokeColor,
        transformMatrix: ctx.tm,
        isSpaceOffset,
    };
}

interface ProcessOneCharOptions {
    readonly code: number;
    readonly ch: string;
    readonly fontInfo: FontInfo | undefined;
    readonly dw: number;
    readonly gs: GraphicsState;
    readonly isSingleByte: boolean;
    readonly charX: number;
    readonly ctx: PerCharContext;
}

function processOneChar(opts: ProcessOneCharOptions): { readonly item: TextItem; readonly totalAdvance: number } {
    const { code, ch, fontInfo, dw, gs, isSingleByte, charX, ctx } = opts;
    const w = fontInfo ? (fontInfo.widths.get(code) ?? dw) : 600;
    const charAdvance = (w / 1000) * gs.fontSize * (gs.horizontalScaling / 100);
    const spacing = gs.charSpacing + (code === 32 ? gs.wordSpacing : 0);
    const charEndX = charX + charAdvance;
    const isSpace = isSingleByte && (code === 32);
    const item = buildPerCharItem(isSpace ? '' : ch, charX, charEndX, isSpace, ctx);
    return { item, totalAdvance: charAdvance + spacing };
}

function processTextShowPerChar(
    raw: string, gs: GraphicsState, fontInfoMap: Map<string, FontInfo>,
    textItems: TextItem[], pageIndex: number, currentMcid: number,
): void {
    const fontInfo = fontInfoMap.get(gs.fontName);
    const { text: rawDecoded, charCodes } = pdfStringToUnicode(raw, fontInfo);
    const fullAdvance = calcTextAdvance(charCodes, fontInfo, gs);

    if (isInvisibleTextMode(gs.textRenderMode) || gs.fillOpacity < 0.01) {
        gs.textMatrix[4] += fullAdvance;
        return;
    }
    if (!rawDecoded.trim()) {
        gs.textMatrix[4] += fullAdvance;
        return;
    }

    const riseMatrix: number[] = [1, 0, 0, 1, 0, gs.textRise];
    const baseCombined = multiplyMatrix(multiplyMatrix(riseMatrix, gs.textMatrix), gs.ctm);
    const scaleX = Math.hypot(baseCombined[0], baseCombined[1]);
    const scaleY = Math.hypot(baseCombined[2], baseCombined[3]);
    const ctx: PerCharContext = {
        baseCombined,
        effectiveFontSize: getEffectiveFontSize(gs),
        tm: [
            scaleX > 0 ? baseCombined[0] / scaleX : 1,
            scaleX > 0 ? baseCombined[1] / scaleX : 0,
            scaleY > 0 ? baseCombined[2] / scaleY : 0,
            scaleY > 0 ? baseCombined[3] / scaleY : 1,
        ],
        fontInfo, gs, pageIndex, currentMcid,
    };

    const dw = fontInfo ? fontInfo.defaultWidth : 600;
    const isSingleByte = !(fontInfo?.isTwoByte);
    let xAccum = 0;

    const limit = Math.min(charCodes.length, rawDecoded.length);
    for (let i = 0; i < limit; i++) {
        const ch = rawDecoded[i];
        const result = processOneChar({ code: charCodes[i], ch, fontInfo, dw, gs, isSingleByte, charX: baseCombined[4] + xAccum, ctx });
        textItems.push(result.item);
        xAccum += result.totalAdvance;
    }

    gs.textMatrix[4] += fullAdvance;
}

function processTJOperatorPerChar(
    operandStack: string[], gs: GraphicsState, fontInfoMap: Map<string, FontInfo>,
    textItems: TextItem[], pageIndex: number, currentMcid: number,
): void {
    const arrTokens = drainOperandStack(operandStack);
    let pendingDisplacement = 0;

    for (const t of arrTokens) {
        if (t === '[' || t === ']') continue;
        if (t.startsWith('(')) {
            if (pendingDisplacement !== 0) {
                gs.textMatrix[4] -= (pendingDisplacement / 1000) * gs.fontSize * (gs.horizontalScaling / 100);
                pendingDisplacement = 0;
            }
            const rawStr = t.slice(1, -1);
            processTextShowPerChar(rawStr, gs, fontInfoMap, textItems, pageIndex, currentMcid);
        } else {
            const kern = Number.parseFloat(t);
            if (!Number.isNaN(kern)) {
                pendingDisplacement += kern;
            }
        }
    }
    if (pendingDisplacement !== 0) {
        gs.textMatrix[4] -= (pendingDisplacement / 1000) * gs.fontSize * (gs.horizontalScaling / 100);
    }
}

function drainOperandStack(operandStack: string[]): string[] {
    const tokens: string[] = [];
    while (operandStack.length > 0) {
        tokens.unshift(operandStack.pop() ?? '');
    }
    return tokens;
}

function processTJTokens(
    arrTokens: string[], dw: number, gs: GraphicsState, fontInfo: FontInfo | undefined,
): { combinedText: string; pendingDisplacement: number } {
    let combinedText = '';
    let pendingDisplacement = 0;
    for (const t of arrTokens) {
        if (t === '[' || t === ']') continue;
        if (t.startsWith('(')) {
            combinedText = applyTJStringFragment(t, pendingDisplacement, dw, combinedText, gs, fontInfo);
            pendingDisplacement = 0;
        } else {
            const kern = Number.parseFloat(t);
            if (!Number.isNaN(kern)) {
                pendingDisplacement += kern;
            }
        }
    }
    return { combinedText, pendingDisplacement };
}

function emitTJTextItem(
    combinedText: string, startTm: number[], gs: GraphicsState,
    fontInfo: FontInfo | undefined, textItems: TextItem[],
    pageIndex: number, currentMcid: number,
): void {
    const riseMatrix: number[] = [1, 0, 0, 1, 0, gs.textRise];
    const combined = multiplyMatrix(multiplyMatrix(riseMatrix, startTm), gs.ctm);
    const endCombined = multiplyMatrix(gs.textMatrix, gs.ctm);
    const tjScaleX = Math.hypot(combined[0], combined[1]);
    const tjScaleY = Math.hypot(combined[2], combined[3]);

    textItems.push({
        text: combinedText,
        fontSize: getEffectiveFontSize(gs),
        x: combined[4],
        y: combined[5],
        endX: endCombined[4],
        page: pageIndex,
        color: gs.fillColor,
        bold: fontInfo?.isBold ?? false,
        italic: fontInfo?.isItalic ?? false,
        fontFamily: fontInfo?.familyName ?? '',
        fontName: gs.fontName,
        mcid: currentMcid,
        charSpacing: gs.charSpacing,
        wordSpacing: gs.wordSpacing,
        textRise: gs.textRise,
        horizontalScaling: gs.horizontalScaling,
        textRenderMode: gs.textRenderMode,
        strokeColor: gs.strokeColor,
        transformMatrix: [
            tjScaleX > 0 ? combined[0] / tjScaleX : 1,
            tjScaleX > 0 ? combined[1] / tjScaleX : 0,
            tjScaleY > 0 ? combined[2] / tjScaleY : 0,
            tjScaleY > 0 ? combined[3] / tjScaleY : 1,
        ],
        isSpaceOffset: false,
    });
}

function processTJOperator(
    operandStack: string[], gs: GraphicsState, fontInfoMap: Map<string, FontInfo>,
    textItems: TextItem[], pageIndex: number, currentMcid: number,
): void {
    const arrTokens = drainOperandStack(operandStack);
    const fontInfo = fontInfoMap.get(gs.fontName);
    const dw = fontInfo ? fontInfo.defaultWidth : 600;
    const startTm = gs.textMatrix.slice();

    const { combinedText, pendingDisplacement } = processTJTokens(arrTokens, dw, gs, fontInfo);
    if (pendingDisplacement !== 0) {
        gs.textMatrix[4] -= (pendingDisplacement / 1000) * gs.fontSize * (gs.horizontalScaling / 100);
    }

    if (isInvisibleTextMode(gs.textRenderMode) || gs.fillOpacity < 0.01) return;
    if (!combinedText.trim()) return;
    emitTJTextItem(combinedText, startTm, gs, fontInfo, textItems, pageIndex, currentMcid);
}

function applyTJStringFragment(
    t: string, pendingDisplacement: number, dw: number, combinedText: string,
    gs: GraphicsState, fontInfo: FontInfo | undefined,
): string {
    const rawStr = t.slice(1, -1);
    if (pendingDisplacement !== 0) {
        gs.textMatrix[4] -= (pendingDisplacement / 1000) * gs.fontSize * (gs.horizontalScaling / 100);
        if (-pendingDisplacement > dw * 0.3 && combinedText.length > 0) {
            combinedText += ' ';
        }
    }
    const { text: decoded, charCodes: fragCodes } = pdfStringToUnicode(rawStr, fontInfo);
    combinedText += decoded;
    gs.textMatrix[4] += calcTextAdvance(fragCodes, fontInfo, gs);
    return combinedText;
}

function resolveComponentsColor(values: number[], components: number): string | null {
    if (components === 4 && values.length >= 4) {
        return cmykToRgbHex(values[0], values[1], values[2], values[3]);
    }
    if (components === 3 && values.length >= 3) {
        return rgbToHex(values[0], values[1], values[2]);
    }
    if (components === 1 && values.length >= 1) {
        return grayToHex(values[0]);
    }
    return null;
}

function resolveIndexedColorFromLut(lut: Uint8Array, bc: number, idx: number): string | null {
    const off = idx * bc;
    if (bc === 3) {
        return rgbToHex((lut[off] ?? 0) / 255, (lut[off + 1] ?? 0) / 255, (lut[off + 2] ?? 0) / 255);
    }
    if (bc === 4) {
        return cmykToRgbHex(
            (lut[off] ?? 0) / 255, (lut[off + 1] ?? 0) / 255,
            (lut[off + 2] ?? 0) / 255, (lut[off + 3] ?? 0) / 255,
        );
    }
    if (bc === 1) return grayToHex((lut[off] ?? 0) / 255);
    return null;
}

function resolveScnIndexedColor(ctx: ContentExtractionContext, cs: string, values: number[]): string | null {
    const csResDict = ctx.resources['ColorSpace']
        ? ctx.reader.getDict(ctx.resources['ColorSpace'])
        : {};
    const csRef = csResDict[cs];
    if (!csRef) return null;
    const resolved = ctx.reader.resolveDeep(csRef);
    if (resolved.type !== 'array') return null;
    const csArr = resolved.value as PdfObject[];
    const colorInfo = resolveColorInfoFromArray(ctx.reader, csArr);
    if (colorInfo.indexed && colorInfo.lookupTable && values.length >= 1) {
        const idx = Math.round(values[0]);
        return resolveIndexedColorFromLut(colorInfo.lookupTable, colorInfo.baseChannels, idx);
    }
    return null;
}

function resolveScnFillColor(ctx: ContentExtractionContext, values: number[]): string | null {
    const cs = ctx.gs.fillColorSpace;
    if (cs === 'DeviceCMYK' && values.length >= 4) {
        return cmykToRgbHex(values[0], values[1], values[2], values[3]);
    }
    if (cs === 'DeviceRGB' && values.length >= 3) {
        return rgbToHex(values[0], values[1], values[2]);
    }
    if (cs === 'DeviceGray' && values.length >= 1) {
        return grayToHex(values[0]);
    }

    const indexedColor = resolveScnIndexedColor(ctx, cs, values);
    if (indexedColor !== null) return indexedColor;

    const components = resolveColorSpaceComponents(ctx, cs);
    const componentColor = resolveComponentsColor(values, components);
    if (componentColor !== null) return componentColor;

    if (values.length >= 3) return rgbToHex(values[0], values[1], values[2]);
    if (values.length === 1) return grayToHex(values[0]);
    return null;
}

function processColorOperator(
    token: string, ctx: ContentExtractionContext,
    popNumber: () => number,
): boolean {
    const { operandStack, gs } = ctx;
    switch (token) {
        case 'rg': {
            const b = popNumber();
            const g = popNumber();
            const r = popNumber();
            gs.fillColor = rgbToHex(r, g, b);
            return true;
        }
        case 'g':
            gs.fillColor = grayToHex(popNumber());
            return true;
        case 'k': {
            const kk = popNumber();
            const y = popNumber();
            const m = popNumber();
            const c = popNumber();
            gs.fillColor = cmykToRgbHex(c, m, y, kk);
            return true;
        }
        case 'scn':
        case 'sc': {
            const values: number[] = [];
            while (operandStack.length > 0) {
                const v = operandStack.pop() ?? '';
                if (v.startsWith('/')) continue;
                const num = Number.parseFloat(v);
                if (!Number.isNaN(num)) values.unshift(num);
            }
            const color = resolveScnFillColor(ctx, values);
            if (color) gs.fillColor = color;
            return true;
        }
        default:
            return false;
    }
}

function processDoOperator(ctx: ContentExtractionContext): void {
    const rawName = ctx.operandStack.pop() ?? '';
    const name = rawName.startsWith('/') ? rawName.slice(1) : rawName;
    const xObjRef = ctx.xObjectDict[name];
    if (!xObjRef) return;
    const xObj = ctx.reader.resolveDeep(xObjRef);
    if (xObj.type !== 'stream') return;
    const xDict = xObj.value as Record<string, PdfObject>;
    const subtype = ctx.reader.getString(xDict['Subtype']);

    if (subtype === 'Image') {
        const imgResult = extractXObjectImage(ctx.reader, xObj, ctx.gs.ctm, ctx.pageIndex);
        if (imgResult) {
            ctx.imageItems.push(imgResult);
        }
    } else if (subtype === 'Form') {
        processFormXObject(ctx, xObj);
    }
}

function buildFormFontInfoMap(
    ctx: ContentExtractionContext, fontDict: Record<string, PdfObject>,
): Map<string, FontInfo> {
    const fontInfoMap = new Map(ctx.fontInfoMap);
    for (const [fontName, fontRef] of Object.entries(fontDict)) {
        fontInfoMap.set(fontName, buildFontInfo(ctx.reader, fontRef));
    }
    return fontInfoMap;
}

function buildFormCtm(ctx: ContentExtractionContext, dict: Record<string, PdfObject>): number[] {
    const matrixObj = dict['Matrix'];
    if (!matrixObj) return ctx.gs.ctm.slice();
    const matrixArr = ctx.reader.getArray(matrixObj);
    if (matrixArr.length !== 6) return ctx.gs.ctm.slice();
    const m = matrixArr.map(o => ctx.reader.getNumber(o));
    return multiplyMatrix(m, ctx.gs.ctm);
}

function processFormXObject(parentCtx: ContentExtractionContext, formObj: PdfObject): void {
    if (parentCtx.formDepth >= 10) return;

    const dict = formObj.value as Record<string, PdfObject>;
    if (!formObj.stream) return;
    const decoded = parentCtx.reader.decodeStreamData(dict, formObj.stream);
    if (decoded.length === 0) return;

    const resources = dict['Resources'] ? parentCtx.reader.getDict(dict['Resources']) : {};
    const fontDict = resources['Font'] ? parentCtx.reader.getDict(resources['Font']) : {};
    const xObjectDict = resources['XObject'] ? parentCtx.reader.getDict(resources['XObject']) : {};

    const mergedXObjectDict = { ...parentCtx.xObjectDict, ...xObjectDict };
    const mergedResources = { ...parentCtx.resources, ...resources };
    const fontInfoMap = buildFormFontInfoMap(parentCtx, fontDict);
    const formCtm = buildFormCtm(parentCtx, dict);

    const tokens = tokenizeContentStream(decoded);
    const ctx = buildFormContext(parentCtx, fontInfoMap, mergedXObjectDict, mergedResources, formCtm);
    runExtractionTokens(ctx, tokens);
}

function buildFormContext(
    parentCtx: ContentExtractionContext,
    fontInfoMap: Map<string, FontInfo>,
    xObjectDict: Record<string, PdfObject>,
    resources: Record<string, PdfObject>,
    formCtm: number[],
): ContentExtractionContext {
    return {
        reader: parentCtx.reader, fontInfoMap, xObjectDict, resources,
        textItems: parentCtx.textItems, imageItems: parentCtx.imageItems, pathRects: parentCtx.pathRects,
        currentPath: [], stateStack: [],
        gs: {
            ctm: formCtm, fontSize: parentCtx.gs.fontSize, fontName: parentCtx.gs.fontName,
            fillColor: parentCtx.gs.fillColor, strokeColor: parentCtx.gs.strokeColor, lineWidth: parentCtx.gs.lineWidth,
            textMatrix: identityMatrix(), lineMatrix: identityMatrix(),
            leading: 0, charSpacing: 0, wordSpacing: 0, textRise: 0, horizontalScaling: 100,
            textRenderMode: 0, fillColorSpace: parentCtx.gs.fillColorSpace, strokeColorSpace: parentCtx.gs.strokeColorSpace,
            strokeOpacity: parentCtx.gs.strokeOpacity, fillOpacity: parentCtx.gs.fillOpacity,
            dashArray: [...parentCtx.gs.dashArray], dashPhase: parentCtx.gs.dashPhase,
            lineCap: parentCtx.gs.lineCap, lineJoin: parentCtx.gs.lineJoin,
        },
        operandStack: [], pageIndex: parentCtx.pageIndex,
        formDepth: parentCtx.formDepth + 1, compatibilityMode: 0,
        mcidStack: [], ocgOffSet: parentCtx.ocgOffSet ?? new Set<string>(),
        ocgHiddenDepth: 0, perFragment: parentCtx.perFragment,
    };
}

const IGNORED_OPERATORS = new Set([
    'ri',
    'M', 'i',
    'EI',
    'MP', 'DP',
]);

function processStrokeColorOperator(
    token: string, operandStack: string[], gs: GraphicsState,
    popNum: () => number,
): boolean {
    switch (token) {
        case 'RG': {
            const b = popNum();
            const g = popNum();
            const r = popNum();
            gs.strokeColor = rgbToHex(r, g, b);
            return true;
        }
        case 'G':
            gs.strokeColor = grayToHex(popNum());
            return true;
        case 'K': {
            const kk = popNum();
            const y = popNum();
            const m = popNum();
            const c = popNum();
            gs.strokeColor = cmykToRgbHex(c, m, y, kk);
            return true;
        }
        default:
            return false;
    }
}

function processPathBuildOperator(
    token: string, ctx: ContentExtractionContext, popNum: () => number,
): boolean {
    const basic = processBasicPathOp(token, ctx, popNum);
    if (basic !== null) return basic;
    return processPathCurveOp(token, ctx, popNum);
}

function processBasicPathOp(token: string, ctx: ContentExtractionContext, popNum: () => number): boolean | null {
    switch (token) {
        case 'm': { const y = popNum(); const x = popNum(); ctx.currentPath.push({ op: 'm', args: [x, y] }); return true; }
        case 'l': { const y = popNum(); const x = popNum(); ctx.currentPath.push({ op: 'l', args: [x, y] }); return true; }
        case 're': {
            const h = popNum(); const w = popNum(); const y = popNum(); const x = popNum();
            ctx.currentPath.push({ op: 're', args: [x, y, w, h] }); return true;
        }
        case 'h': ctx.currentPath.push({ op: 'h', args: [] }); return true;
        case 'w': ctx.gs.lineWidth = popNum(); return true;
        default: return null;
    }
}

function processPathCurveOp(token: string, ctx: ContentExtractionContext, popNum: () => number): boolean {
    switch (token) {
        case 'c': {
            const y3 = popNum(); const x3 = popNum(); const y2 = popNum(); const x2 = popNum();
            const y1 = popNum(); const x1 = popNum();
            ctx.currentPath.push({ op: 'c', args: [x1, y1, x2, y2, x3, y3] }); return true;
        }
        case 'v': {
            const y3 = popNum(); const x3 = popNum(); const y2 = popNum(); const x2 = popNum();
            ctx.currentPath.push({ op: 'v', args: [x2, y2, x3, y3] }); return true;
        }
        case 'y': {
            const y3 = popNum(); const x3 = popNum(); const y1 = popNum(); const x1 = popNum();
            ctx.currentPath.push({ op: 'y', args: [x1, y1, x3, y3] }); return true;
        }
        default: return false;
    }
}

function transformPoint(x: number, y: number, ctm: number[]): { tx: number; ty: number } {
    return {
        tx: x * ctm[0] + y * ctm[2] + ctm[4],
        ty: x * ctm[1] + y * ctm[3] + ctm[5],
    };
}

function emitRectFromReOp(op: PathOp, ctx: ContentExtractionContext, stroked: boolean, filled: boolean): void {
    const [rx, ry, rw, rh] = op.args;
    const p1 = transformPoint(rx, ry, ctx.gs.ctm);
    const p2 = transformPoint(rx + rw, ry + rh, ctx.gs.ctm);
    const x = Math.min(p1.tx, p2.tx);
    const y = Math.min(p1.ty, p2.ty);
    const width = Math.abs(p2.tx - p1.tx);
    const height = Math.abs(p2.ty - p1.ty);
    ctx.pathRects.push({
        x, y, width, height,
        page: ctx.pageIndex, stroked, filled,
        strokeColor: ctx.gs.strokeColor,
        fillColor: ctx.gs.fillColor,
        lineWidth: ctx.gs.lineWidth,
    });
}

function emitRectFromLine(
    x1: number, y1: number, x2: number, y2: number,
    ctx: ContentExtractionContext, stroked: boolean, filled: boolean,
): void {
    const p1 = transformPoint(x1, y1, ctx.gs.ctm);
    const p2 = transformPoint(x2, y2, ctx.gs.ctm);
    const lw = Math.max(ctx.gs.lineWidth, 0.5);
    const isHorizontal = Math.abs(p1.ty - p2.ty) < 2;
    const isVertical = Math.abs(p1.tx - p2.tx) < 2;
    if (!isHorizontal && !isVertical) return;

    if (isHorizontal) {
        const x = Math.min(p1.tx, p2.tx);
        const width = Math.abs(p2.tx - p1.tx);
        if (width < 5) return;
        ctx.pathRects.push({
            x, y: p1.ty - lw / 2, width, height: lw,
            page: ctx.pageIndex, stroked, filled,
            strokeColor: ctx.gs.strokeColor,
            fillColor: ctx.gs.fillColor,
            lineWidth: lw,
        });
    } else {
        const y = Math.min(p1.ty, p2.ty);
        const height = Math.abs(p2.ty - p1.ty);
        if (height < 5) return;
        ctx.pathRects.push({
            x: p1.tx - lw / 2, y, width: lw, height,
            page: ctx.pageIndex, stroked, filled,
            strokeColor: ctx.gs.strokeColor,
            fillColor: ctx.gs.fillColor,
            lineWidth: lw,
        });
    }
}

interface SvgBounds {
    minX: number; minY: number; maxX: number; maxY: number; d: string;
}

function expandBoundsX(bounds: SvgBounds, ...xs: number[]): void {
    for (const x of xs) { bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x); }
}

function expandBoundsY(bounds: SvgBounds, ...ys: number[]): void {
    for (const y of ys) { bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y); }
}

function accumulateSvgOp(op: PathOp, ctm: number[], bounds: SvgBounds): void {
    const a = op.args;
    if (op.op === 'm' || op.op === 'l') {
        const { tx: x, ty: y } = transformPoint(a[0], a[1], ctm);
        bounds.d += op.op === 'm' ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`;
        expandBoundsX(bounds, x); expandBoundsY(bounds, y);
        return;
    }
    if (op.op === 'c') {
        const { tx: x1, ty: y1 } = transformPoint(a[0], a[1], ctm);
        const { tx: x2, ty: y2 } = transformPoint(a[2], a[3], ctm);
        const { tx: x3, ty: y3 } = transformPoint(a[4], a[5], ctm);
        bounds.d += `C${x1.toFixed(1)},${y1.toFixed(1)},${x2.toFixed(1)},${y2.toFixed(1)},${x3.toFixed(1)},${y3.toFixed(1)}`;
        expandBoundsX(bounds, x1, x2, x3); expandBoundsY(bounds, y1, y2, y3);
        return;
    }
    if (op.op === 'v') {
        const { tx: x2, ty: y2 } = transformPoint(a[0], a[1], ctm);
        const { tx: x3, ty: y3 } = transformPoint(a[2], a[3], ctm);
        bounds.d += `S${x2.toFixed(1)},${y2.toFixed(1)},${x3.toFixed(1)},${y3.toFixed(1)}`;
        expandBoundsX(bounds, x2, x3); expandBoundsY(bounds, y2, y3);
        return;
    }
    if (op.op === 'y') {
        const { tx: x1, ty: y1 } = transformPoint(a[0], a[1], ctm);
        const { tx: x3, ty: y3 } = transformPoint(a[2], a[3], ctm);
        bounds.d += `Q${x1.toFixed(1)},${y1.toFixed(1)},${x3.toFixed(1)},${y3.toFixed(1)}`;
        expandBoundsX(bounds, x1, x3); expandBoundsY(bounds, y1, y3);
        return;
    }
    if (op.op === 'h') {
        bounds.d += 'Z';
        return;
    }
    if (op.op === 're') {
        const { tx: rx, ty: ry } = transformPoint(a[0], a[1], ctm);
        const w = a[2] * Math.abs(ctm[0]);
        const h = a[3] * Math.abs(ctm[3]);
        bounds.d += `M${rx.toFixed(1)},${ry.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h${(-w).toFixed(1)}Z`;
        expandBoundsX(bounds, rx, rx + w); expandBoundsY(bounds, ry, ry + h);
    }
}

function pathOpsToSvg(ops: ReadonlyArray<PathOp>, ctx: ContentExtractionContext, stroked: boolean, filled: boolean): void {
    const hasCurves = ops.some(op => op.op === 'c' || op.op === 'v' || op.op === 'y');
    if (!hasCurves) return;

    const bounds: SvgBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, d: '' };
    for (const op of ops) {
        accumulateSvgOp(op, ctx.gs.ctm, bounds);
    }

    const { minX, minY, maxX, maxY, d } = bounds;
    if (!d || minX === Infinity) return;

    const width = Math.ceil(maxX - minX + 2);
    const height = Math.ceil(maxY - minY + 2);
    if (width < 2 || height < 2 || width > 5000 || height > 5000) return;

    const fillAttr = filled ? `fill="${ctx.gs.fillColor}"` : 'fill="none"';
    const strokeAttr = stroked ? `stroke="${ctx.gs.strokeColor}" stroke-width="${Math.max(ctx.gs.lineWidth, 0.5)}"` : '';
    const opacityAttr = ctx.gs.fillOpacity < 1 ? ` opacity="${ctx.gs.fillOpacity}"` : '';

    const svgHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${(minX - 1).toFixed(1)} ${(minY - 1).toFixed(1)} ${width} ${height}" style="max-width:100%;height:auto"><path d="${d}" ${fillAttr} ${strokeAttr}${opacityAttr}/></svg>`;

    const avgY = (minY + maxY) / 2;
    ctx.imageItems.push({
        dataUrl: `data:image/svg+xml;base64,${btoa(svgHtml)}`,
        width,
        height,
        renderWidth: width,
        renderHeight: height,
        x: minX,
        y: avgY,
        page: ctx.pageIndex,
    });
}

function extractPathOpPoints(
    op: PathOp, curX: number, curY: number,
): { points: Array<{ x: number; y: number }>; newX: number; newY: number } {
    switch (op.op) {
        case 'm':
        case 'l':
            return { points: [{ x: op.args[0], y: op.args[1] }], newX: op.args[0], newY: op.args[1] };
        case 'c':
            return {
                points: [
                    { x: op.args[0], y: op.args[1] },
                    { x: op.args[2], y: op.args[3] },
                    { x: op.args[4], y: op.args[5] },
                ],
                newX: op.args[4], newY: op.args[5],
            };
        case 'v':
            return {
                points: [
                    { x: curX, y: curY },
                    { x: op.args[0], y: op.args[1] },
                    { x: op.args[2], y: op.args[3] },
                ],
                newX: op.args[2], newY: op.args[3],
            };
        case 'y':
            return {
                points: [
                    { x: op.args[0], y: op.args[1] },
                    { x: op.args[2], y: op.args[3] },
                ],
                newX: op.args[2], newY: op.args[3],
            };
        default:
            return { points: [], newX: curX, newY: curY };
    }
}

function computePathBounds(
    ops: ReadonlyArray<PathOp>, ctm: number[],
): { minX: number; minY: number; maxX: number; maxY: number; hasPoints: boolean } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let curX = 0;
    let curY = 0;
    let hasPoints = false;

    for (const op of ops) {
        const { points, newX, newY } = extractPathOpPoints(op, curX, curY);
        curX = newX;
        curY = newY;
        for (const p of points) {
            const { tx, ty } = transformPoint(p.x, p.y, ctm);
            if (tx < minX) minX = tx;
            if (ty < minY) minY = ty;
            if (tx > maxX) maxX = tx;
            if (ty > maxY) maxY = ty;
            hasPoints = true;
        }
    }
    return { minX, minY, maxX, maxY, hasPoints };
}

function emitBoundingBoxRect(
    ops: ReadonlyArray<PathOp>, ctx: ContentExtractionContext,
    stroked: boolean, filled: boolean,
): void {
    const { minX, minY, maxX, maxY, hasPoints } = computePathBounds(ops, ctx.gs.ctm);
    if (!hasPoints) return;
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 5 || height < 5) return;

    ctx.pathRects.push({
        x: minX, y: minY, width, height,
        page: ctx.pageIndex, stroked, filled,
        strokeColor: ctx.gs.strokeColor,
        fillColor: ctx.gs.fillColor,
        lineWidth: ctx.gs.lineWidth,
    });
}

function emitPathRects(ctx: ContentExtractionContext, stroked: boolean, filled: boolean): void {
    let lastMoveX = 0;
    let lastMoveY = 0;

    for (const op of ctx.currentPath) {
        if (op.op === 're') {
            emitRectFromReOp(op, ctx, stroked, filled);
        } else if (op.op === 'm') {
            lastMoveX = op.args[0];
            lastMoveY = op.args[1];
        } else if (op.op === 'l') {
            emitRectFromLine(lastMoveX, lastMoveY, op.args[0], op.args[1], ctx, stroked, filled);
            lastMoveX = op.args[0];
            lastMoveY = op.args[1];
        }
    }

    // Emit bounding-box rect for paths containing curves (rounded rects, button borders)
    if (ctx.currentPath.some(op => op.op === 'c' || op.op === 'v' || op.op === 'y')) {
        const nonReOps = ctx.currentPath.filter(op => op.op !== 're');
        emitBoundingBoxRect(nonReOps, ctx, stroked, filled);
    }
}

function processPathPaintOperator(token: string, ctx: ContentExtractionContext): boolean {
    switch (token) {
        case 'S':
        case 's':
            pathOpsToSvg(ctx.currentPath, ctx, true, false);
            emitPathRects(ctx, true, false);
            ctx.currentPath = [];
            return true;
        case 'f':
        case 'F':
        case 'f*':
            pathOpsToSvg(ctx.currentPath, ctx, false, true);
            emitPathRects(ctx, false, true);
            ctx.currentPath = [];
            return true;
        case 'B':
        case 'B*':
        case 'b':
        case 'b*':
            pathOpsToSvg(ctx.currentPath, ctx, true, true);
            emitPathRects(ctx, true, true);
            ctx.currentPath = [];
            return true;
        case 'n':
            ctx.currentPath = [];
            return true;
        default:
            return false;
    }
}

function processTextStateOperator(
    token: string, gs: GraphicsState, operandStack: string[],
    popNumber: () => number,
): boolean {
    switch (token) {
        case 'TL': gs.leading = popNumber(); return true;
        case 'Tc': gs.charSpacing = popNumber(); return true;
        case 'Tw': gs.wordSpacing = popNumber(); return true;
        case 'Tz': gs.horizontalScaling = popNumber(); return true;
        case 'Ts': gs.textRise = popNumber(); return true;
        case 'Tr': gs.textRenderMode = popNumber(); return true;
        case 'Tf': {
            gs.fontSize = popNumber();
            const fontNameToken = operandStack.pop() ?? '';
            gs.fontName = fontNameToken.startsWith('/') ? fontNameToken.slice(1) : fontNameToken;
            return true;
        }
        default: return false;
    }
}

function processMatrixOperator(
    token: string, gs: GraphicsState, popNumber: () => number,
): boolean {
    switch (token) {
        case 'cm': {
            const f = popNumber(); const e = popNumber();
            const d = popNumber(); const c = popNumber();
            const b = popNumber(); const a = popNumber();
            gs.ctm = multiplyMatrix([a, b, c, d, e, f], gs.ctm);
            return true;
        }
        case 'Tm': {
            const f = popNumber(); const e = popNumber();
            const d = popNumber(); const c = popNumber();
            const b = popNumber(); const a = popNumber();
            gs.textMatrix = [a, b, c, d, e, f];
            gs.lineMatrix = [a, b, c, d, e, f];
            return true;
        }
        case 'Td': {
            const ty = popNumber(); const tx = popNumber();
            gs.textMatrix = multiplyMatrix([1, 0, 0, 1, tx, ty], gs.lineMatrix);
            gs.lineMatrix = gs.textMatrix.slice();
            return true;
        }
        case 'TD': {
            const ty = popNumber(); const tx = popNumber();
            gs.leading = -ty;
            gs.textMatrix = multiplyMatrix([1, 0, 0, 1, tx, ty], gs.lineMatrix);
            gs.lineMatrix = gs.textMatrix.slice();
            return true;
        }
        case 'T*':
            gs.textMatrix = multiplyMatrix([1, 0, 0, 1, 0, -gs.leading], gs.lineMatrix);
            gs.lineMatrix = gs.textMatrix.slice();
            return true;
        default:
            return false;
    }
}

interface PathOp {
    readonly op: string;
    readonly args: number[];
}

interface ContentExtractionContext {
    reader: PdfReader;
    fontInfoMap: Map<string, FontInfo>;
    xObjectDict: Record<string, PdfObject>;
    resources: Record<string, PdfObject>;
    textItems: TextItem[];
    imageItems: ImageItem[];
    pathRects: PathRect[];
    currentPath: PathOp[];
    stateStack: GraphicsState[];
    gs: GraphicsState;
    operandStack: string[];
    pageIndex: number;
    formDepth: number;
    compatibilityMode: number;
    mcidStack: number[];
    ocgOffSet: Set<string>;
    ocgHiddenDepth: number;
    perFragment: boolean;
}

function popNumber(ctx: ContentExtractionContext): number {
    const val = ctx.operandStack.pop();
    return val === undefined ? 0 : Number.parseFloat(val);
}

function popString(ctx: ContentExtractionContext): string {
    const val = ctx.operandStack.pop();
    if (!val) return '';
    return val.startsWith('(') && val.endsWith(')') ? val.slice(1, -1) : val;
}

function processDashOperator(ctx: ContentExtractionContext): void {
    const phase = popNumber(ctx);
    const arrTokens: string[] = [];
    while (ctx.operandStack.length > 0) arrTokens.unshift(ctx.operandStack.pop() ?? '');
    const nums: number[] = [];
    for (const t of arrTokens) {
        if (t === '[' || t === ']') continue;
        const n = Number.parseFloat(t);
        if (!Number.isNaN(n)) nums.push(n);
    }
    ctx.gs.dashArray = nums;
    ctx.gs.dashPhase = phase;
}

function processStateToken(token: string, ctx: ContentExtractionContext): boolean {
    if (token === 'q') { ctx.stateStack.push(structuredClone(ctx.gs)); return true; }
    if (token === 'Q') {
        if (ctx.stateStack.length > 0) {
            const prevState = ctx.stateStack.pop();
            if (prevState) { ctx.gs = prevState; }
        }
        return true;
    }
    if (token === 'BT') { ctx.gs.textMatrix = identityMatrix(); ctx.gs.lineMatrix = identityMatrix(); return true; }
    if (token === 'ET') return true;
    if (token === 'J') { ctx.gs.lineCap = popNumber(ctx); return true; }
    if (token === 'j') { ctx.gs.lineJoin = popNumber(ctx); return true; }
    if (token === 'W' || token === 'W*') { return true; }
    if (token === 'd') { processDashOperator(ctx); return true; }
    return false;
}

function currentMcid(ctx: ContentExtractionContext): number {
    for (let i = ctx.mcidStack.length - 1; i >= 0; i--) {
        if (ctx.mcidStack[i] >= 0) return ctx.mcidStack[i];
    }
    return -1;
}

function processTextShowToken(token: string, ctx: ContentExtractionContext): boolean {
    const mcid = currentMcid(ctx);
    const showFn = ctx.perFragment ? processTextShowPerChar : processTextShow;

    if (token === 'Tj') {
        showFn(popString(ctx), ctx.gs, ctx.fontInfoMap, ctx.textItems, ctx.pageIndex, mcid);
        return true;
    }
    if (token === "'") {
        ctx.gs.textMatrix = multiplyMatrix([1, 0, 0, 1, 0, -ctx.gs.leading], ctx.gs.lineMatrix);
        ctx.gs.lineMatrix = ctx.gs.textMatrix.slice();
        showFn(popString(ctx), ctx.gs, ctx.fontInfoMap, ctx.textItems, ctx.pageIndex, mcid);
        return true;
    }
    if (token === '"') {
        const raw = popString(ctx);
        ctx.gs.charSpacing = popNumber(ctx); ctx.gs.wordSpacing = popNumber(ctx);
        ctx.gs.textMatrix = multiplyMatrix([1, 0, 0, 1, 0, -ctx.gs.leading], ctx.gs.lineMatrix);
        ctx.gs.lineMatrix = ctx.gs.textMatrix.slice();
        showFn(raw, ctx.gs, ctx.fontInfoMap, ctx.textItems, ctx.pageIndex, mcid);
        return true;
    }
    if (token === 'TJ') {
        if (ctx.perFragment) {
            processTJOperatorPerChar(ctx.operandStack, ctx.gs, ctx.fontInfoMap, ctx.textItems, ctx.pageIndex, mcid);
        } else {
            processTJOperator(ctx.operandStack, ctx.gs, ctx.fontInfoMap, ctx.textItems, ctx.pageIndex, mcid);
        }
        return true;
    }
    return false;
}

function processResourceToken(token: string, ctx: ContentExtractionContext, tokens: string[], tokenIndex: number): number {
    if (token === 'Do') {
        processDoOperator(ctx);
        return tokenIndex;
    }
    if (token === 'BI') {
        const inlineImgResult = parseInlineImage(tokens, tokenIndex - 1, ctx.gs.ctm, ctx.pageIndex);
        if (inlineImgResult) {
            if (inlineImgResult.imageItem?.dataUrl) ctx.imageItems.push(inlineImgResult.imageItem);
            return inlineImgResult.newIndex + 1;
        }
        return tokenIndex;
    }
    return -1;
}

function applyGsFontFromArr(ctx: ContentExtractionContext, fontArr: PdfObject): void {
    const arr = ctx.reader.getArray(fontArr);
    if (arr.length < 2) return;
    const fontRef = arr[0];
    const fontSize = ctx.reader.getNumber(arr[1]);
    if (fontSize > 0) ctx.gs.fontSize = fontSize;
    const fontDict = ctx.reader.getDict(fontRef);
    const baseFontObj = fontDict['BaseFont'];
    if (baseFontObj) {
        const baseFontName = ctx.reader.getString(baseFontObj);
        if (baseFontName) ctx.gs.fontName = baseFontName;
    }
}

function processGsOperator(ctx: ContentExtractionContext): void {
    const rawName = ctx.operandStack.pop() ?? '';
    const name = rawName.startsWith('/') ? rawName.slice(1) : rawName;
    const extGStateDict = ctx.resources['ExtGState']
        ? ctx.reader.getDict(ctx.resources['ExtGState'])
        : {};
    const gsRef = extGStateDict[name];
    if (!gsRef) return;
    const gsDict = ctx.reader.getDict(gsRef);

    const fontArr = gsDict['Font'];
    if (fontArr) { applyGsFontFromArr(ctx, fontArr); }

    const lwObj = gsDict['LW'];
    if (lwObj) {
        const lw = ctx.reader.getNumber(lwObj);
        if (lw > 0) ctx.gs.lineWidth = lw;
    }

    const caObj = gsDict['CA'];
    if (caObj) ctx.gs.strokeOpacity = ctx.reader.getNumber(caObj);

    const caLowerObj = gsDict['ca'];
    if (caLowerObj) ctx.gs.fillOpacity = ctx.reader.getNumber(caLowerObj);
}

function resolveIccBasedComponents(reader: PdfReader, csArr: PdfObject[]): number {
    if (csArr.length < 2) return -1;
    const iccDict = reader.getDict(csArr[1]);
    const n = reader.getNumber(iccDict['N']);
    return (n === 1 || n === 3 || n === 4) ? n : 3;
}

function resolveIndexedComponents(reader: PdfReader, csArr: PdfObject[]): number {
    if (csArr.length < 2) return 3;
    const baseCs = reader.getString(csArr[1]);
    if (baseCs === 'DeviceRGB' || baseCs === 'CalRGB') return 3;
    if (baseCs === 'DeviceCMYK') return 4;
    return 3;
}

function resolveColorSpaceTypeComponents(reader: PdfReader, csType: string, csArr: PdfObject[]): number {
    if (csType === 'ICCBased') return resolveIccBasedComponents(reader, csArr);
    if (csType === 'CalRGB') return 3;
    if (csType === 'CalGray') return 1;
    if (csType === 'Indexed') return resolveIndexedComponents(reader, csArr);
    if (csType === 'Separation' || csType === 'DeviceN') return 1;
    if (csType === 'Pattern') return 0;
    return -1;
}

function resolveColorSpaceComponents(ctx: ContentExtractionContext, csName: string): number {
    if (csName === 'DeviceRGB' || csName === 'CalRGB') return 3;
    if (csName === 'DeviceGray' || csName === 'CalGray') return 1;
    if (csName === 'DeviceCMYK') return 4;

    const csResDict = ctx.resources['ColorSpace']
        ? ctx.reader.getDict(ctx.resources['ColorSpace'])
        : {};
    const csRef = csResDict[csName];
    if (!csRef) return -1;

    const csArr = ctx.reader.getArray(csRef);
    if (csArr.length === 0) return -1;

    const csType = ctx.reader.getString(csArr[0]);
    return resolveColorSpaceTypeComponents(ctx.reader, csType, csArr);
}

function processColorSpaceOperator(token: string, ctx: ContentExtractionContext): boolean {
    if (token === 'cs') {
        const rawName = ctx.operandStack.pop() ?? '';
        ctx.gs.fillColorSpace = rawName.startsWith('/') ? rawName.slice(1) : rawName;
        return true;
    }
    if (token === 'CS') {
        const rawName = ctx.operandStack.pop() ?? '';
        ctx.gs.strokeColorSpace = rawName.startsWith('/') ? rawName.slice(1) : rawName;
        return true;
    }
    return false;
}

function processStrokeColorSpaceOperator(token: string, ctx: ContentExtractionContext): boolean {
    if (token !== 'SC' && token !== 'SCN') return false;

    const values: number[] = [];
    while (ctx.operandStack.length > 0) {
        const v = ctx.operandStack.pop() ?? '';
        if (v.startsWith('/')) continue;
        const num = Number.parseFloat(v);
        if (!Number.isNaN(num)) values.unshift(num);
    }

    const cs = ctx.gs.strokeColorSpace;
    const components = resolveColorSpaceComponents(ctx, cs);
    if (components === 3 && values.length >= 3) {
        ctx.gs.strokeColor = rgbToHex(values[0], values[1], values[2]);
    } else if (components === 1 && values.length >= 1) {
        ctx.gs.strokeColor = grayToHex(values[0]);
    } else if (components === 4 && values.length >= 4) {
        ctx.gs.strokeColor = cmykToRgbHex(values[0], values[1], values[2], values[3]);
    }
    return true;
}

function findMcidInDictSlice(stack: string[], start: number): number {
    for (let j = start + 1; j < stack.length - 1; j++) {
        if (stack[j] === '/MCID') {
            const val = Number.parseInt(stack[j + 1], 10);
            if (!Number.isNaN(val)) return val;
        }
        if (stack[j] === '>>') break;
    }
    return -1;
}

function extractMcidFromOperands(ctx: ContentExtractionContext): number {
    const stack = ctx.operandStack;
    for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === '/MCID' && i + 1 < stack.length) {
            const val = Number.parseInt(stack[i + 1], 10);
            if (!Number.isNaN(val)) return val;
        }
    }
    for (let i = 0; i < stack.length; i++) {
        if (stack[i] === '<<') {
            const val = findMcidInDictSlice(stack, i);
            if (val >= 0) return val;
        }
    }
    return -1;
}

function processMarkedContentToken(token: string, ctx: ContentExtractionContext): boolean {
    if (token === 'BMC') {
        ctx.operandStack.length = 0;
        ctx.mcidStack.push(-1);
        return true;
    }
    if (token === 'BDC') {
        const mcid = extractMcidFromOperands(ctx);
        ctx.operandStack.length = 0;
        ctx.mcidStack.push(mcid);
        return true;
    }
    if (token === 'EMC') {
        if (ctx.mcidStack.length > 0) ctx.mcidStack.pop();
        return true;
    }
    return false;
}

function dispatchContentOperator(token: string, ctx: ContentExtractionContext): boolean {
    if (processMarkedContentToken(token, ctx)) return true;
    if (processStateToken(token, ctx)) return true;
    if (processMatrixOperator(token, ctx.gs, () => popNumber(ctx))) return true;
    if (processTextStateOperator(token, ctx.gs, ctx.operandStack, () => popNumber(ctx))) return true;
    if (processTextShowToken(token, ctx)) return true;
    if (processColorSpaceOperator(token, ctx)) return true;
    if (processColorOperator(token, ctx, () => popNumber(ctx))) return true;
    if (processStrokeColorOperator(token, ctx.operandStack, ctx.gs, () => popNumber(ctx))) return true;
    if (processStrokeColorSpaceOperator(token, ctx)) return true;
    if (processPathBuildOperator(token, ctx, () => popNumber(ctx))) return true;
    if (processPathPaintOperator(token, ctx)) return true;
    return false;
}

function processContentToken(token: string, ctx: ContentExtractionContext, tokens: string[], tokenIndex: number): number {
    if (token === 'BX') { ctx.compatibilityMode++; ctx.operandStack.length = 0; return tokenIndex; }
    if (token === 'EX') { if (ctx.compatibilityMode > 0) { ctx.compatibilityMode--; } ctx.operandStack.length = 0; return tokenIndex; }
    if (token === 'gs') { processGsOperator(ctx); ctx.operandStack.length = 0; return tokenIndex; }

    if (dispatchContentOperator(token, ctx)) return tokenIndex;

    const resourceResult = processResourceToken(token, ctx, tokens, tokenIndex);
    if (resourceResult >= 0) return resourceResult;

    if (token === 'sh' || IGNORED_OPERATORS.has(token) || ctx.compatibilityMode > 0) {
        ctx.operandStack.length = 0;
        return tokenIndex;
    }

    ctx.operandStack.push(token);
    return tokenIndex;
}

export function getPageMediaBox(reader: PdfReader, pageDict: Record<string, PdfObject>): number[] {
    const mbObj = pageDict['CropBox'] ?? pageDict['MediaBox'];
    if (!mbObj) return [0, 0, 612, 792];
    const arr = reader.getArray(mbObj);
    if (arr.length < 4) return [0, 0, 612, 792];
    return arr.map(o => reader.getNumber(o));
}

function buildRotationCtm(rotate: number, mediaBox: number[]): number[] {
    const width = mediaBox[2] - mediaBox[0];
    const height = mediaBox[3] - mediaBox[1];
    const normalizedRotate = ((rotate % 360) + 360) % 360;

    switch (normalizedRotate) {
        case 90:
            return [0, -1, 1, 0, 0, width];
        case 180:
            return [-1, 0, 0, -1, width, height];
        case 270:
            return [0, 1, -1, 0, height, 0];
        default:
            return identityMatrix();
    }
}

function tryExtractLinkAnnotation(reader: PdfReader, annotRef: PdfObject, pageIndex: number): PdfAnnotation | null {
    const annot = reader.getDict(annotRef);
    const subtype = reader.getString(annot['Subtype'] ?? { type: 'null', value: null });
    if (subtype !== 'Link') return null;
    const aObj = annot['A'];
    if (!aObj) return null;
    const action = reader.getDict(aObj);
    const sType = reader.getString(action['S'] ?? { type: 'null', value: null });
    if (sType !== 'URI') return null;
    const uriObj = action['URI'];
    if (!uriObj) return null;
    const uri = reader.getString(uriObj);
    if (!uri) return null;
    const rectObj = annot['Rect'];
    if (!rectObj) return null;
    const rect = reader.getArray(rectObj).map(o => reader.getNumber(o));
    if (rect.length < 4) return null;
    return {
        x: Math.min(rect[0], rect[2]),
        y: Math.min(rect[1], rect[3]),
        width: Math.abs(rect[2] - rect[0]),
        height: Math.abs(rect[3] - rect[1]),
        page: pageIndex,
        uri,
    };
}

function tryPushAnnotation(reader: PdfReader, annotRef: PdfObject, pageIndex: number, annotations: PdfAnnotation[]): void {
    try {
        const annotation = tryExtractLinkAnnotation(reader, annotRef, pageIndex);
        if (annotation) annotations.push(annotation);
    } catch { /* skip malformed annotation */ }
}

function extractAnnotations(reader: PdfReader, pageDict: Record<string, PdfObject>, pageIndex: number): PdfAnnotation[] {
    const annotsObj = pageDict['Annots'];
    if (!annotsObj) return [];
    const annotations: PdfAnnotation[] = [];
    try {
        const annots = reader.getArray(annotsObj);
        for (const annotRef of annots) {
            tryPushAnnotation(reader, annotRef, pageIndex, annotations);
        }
    } catch { /* skip if annots can't be parsed */ }
    return annotations;
}

export interface ExtractPageOptions {
    readonly perFragment?: boolean;
}

function buildExtractionContext(
    reader: PdfReader,
    resources: Record<string, PdfObject>,
    fontDict: Record<string, PdfObject>,
    xObjectDict: Record<string, PdfObject>,
    initialCtm: number[],
    pageIndex: number,
    options?: ExtractPageOptions,
): ContentExtractionContext {
    const fontInfoMap = new Map<string, FontInfo>();
    for (const [fontName, fontRef] of Object.entries(fontDict)) {
        fontInfoMap.set(fontName, buildFontInfo(reader, fontRef));
    }
    return {
        reader, fontInfoMap, xObjectDict, resources,
        textItems: [], imageItems: [], pathRects: [],
        currentPath: [], stateStack: [],
        gs: {
            ctm: initialCtm, fontSize: 12, fontName: '', fillColor: '#000000',
            strokeColor: '#000000', lineWidth: 1,
            textMatrix: identityMatrix(), lineMatrix: identityMatrix(),
            leading: 0, charSpacing: 0, wordSpacing: 0, textRise: 0, horizontalScaling: 100,
            textRenderMode: 0, fillColorSpace: 'DeviceRGB', strokeColorSpace: 'DeviceRGB',
            strokeOpacity: 1, fillOpacity: 1,
            dashArray: [], dashPhase: 0, lineCap: 0, lineJoin: 0,
        },
        operandStack: [], pageIndex,
        formDepth: 0, compatibilityMode: 0,
        mcidStack: [], ocgOffSet: new Set<string>(),
        ocgHiddenDepth: 0, perFragment: options?.perFragment ?? false,
    };
}

function runExtractionTokens(ctx: ContentExtractionContext, tokens: string[]): void {
    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];
        i++;
        i = processContentToken(token, ctx, tokens, i);
    }
}

export function extractPageContent(
    reader: PdfReader,
    pageObj: PdfObject,
    pageIndex: number,
    options?: ExtractPageOptions,
): { textItems: TextItem[]; imageItems: ImageItem[]; pathRects: PathRect[]; pageWidth: number; pageHeight: number; annotations: PdfAnnotation[] } {
    const pageDict = reader.getDict(pageObj);
    const mediaBox = getPageMediaBox(reader, pageDict);
    const rotate = reader.getNumber(pageDict['Rotate']);
    const normalizedRotate = ((rotate % 360) + 360) % 360;
    const rawWidth = mediaBox[2] - mediaBox[0];
    const rawHeight = mediaBox[3] - mediaBox[1];
    const isRotated = normalizedRotate === 90 || normalizedRotate === 270;
    const pageWidth = isRotated ? rawHeight : rawWidth;
    const pageHeight = isRotated ? rawWidth : rawHeight;

    const annotations = extractAnnotations(reader, pageDict, pageIndex);

    const contentsObj = pageDict['Contents'];
    if (!contentsObj) return { textItems: [], imageItems: [], pathRects: [], pageWidth, pageHeight, annotations };

    const contentData = resolveContentData(reader, contentsObj);
    if (contentData.length === 0) return { textItems: [], imageItems: [], pathRects: [], pageWidth, pageHeight, annotations };

    const resources = pageDict['Resources'] ? reader.getDict(pageDict['Resources']) : {};
    const fontDict = resources['Font'] ? reader.getDict(resources['Font']) : {};
    const xObjectDict = resources['XObject'] ? reader.getDict(resources['XObject']) : {};

    const initialCtm = buildRotationCtm(rotate, mediaBox);

    const tokens = tokenizeContentStream(contentData);
    const ctx = buildExtractionContext(reader, resources, fontDict, xObjectDict, initialCtm, pageIndex, options);
    runExtractionTokens(ctx, tokens);
    return { textItems: ctx.textItems, imageItems: ctx.imageItems, pathRects: ctx.pathRects, pageWidth, pageHeight, annotations };
}

export function resolveImageFilterName(reader: PdfReader, dict: Record<string, PdfObject>): string {
    const filterObj = dict['Filter'];
    if (!filterObj) return '';
    const filterResolved = reader.resolveDeep(filterObj);
    if (filterResolved.type === 'name') return filterResolved.value as string;
    if (filterResolved.type !== 'array') return '';
    const arr = filterResolved.value as PdfObject[];
    const lastEntry = arr.at(-1);
    if (!lastEntry) return '';
    const last = reader.resolveDeep(lastEntry);
    return last.type === 'name' ? last.value as string : '';
}

export function buildImageDataUrl(
    filterName: string, xObj: PdfObject, reader: PdfReader,
    width: number, height: number, dict: Record<string, PdfObject>,
): string | null {
    if (filterName === 'DCTDecode') {
        if (!xObj.stream) return null;
        return `data:image/jpeg;base64,${uint8ArrayToBase64(xObj.stream)}`;
    }
    if (filterName === 'JPXDecode') {
        if (!xObj.stream) return null;
        return `data:image/jp2;base64,${uint8ArrayToBase64(xObj.stream)}`;
    }
    const decoded = reader.getStreamData(xObj);
    if (decoded.length === 0) return null;
    const pngData = rawPixelsToPng(decoded, width, height, dict, reader);
    if (!pngData) return null;
    return `data:image/png;base64,${uint8ArrayToBase64(pngData)}`;
}

function extractXObjectImage(
    reader: PdfReader,
    xObj: PdfObject,
    ctm: number[],
    pageIndex: number,
): ImageItem | null {
    const dict = xObj.value as Record<string, PdfObject>;
    const width = reader.getNumber(dict['Width']);
    const height = reader.getNumber(dict['Height']);
    if (width <= 0 || height <= 0) return null;

    const filterName = resolveImageFilterName(reader, dict);
    const dataUrl = buildImageDataUrl(filterName, xObj, reader, width, height, dict);
    if (!dataUrl) return null;

    return {
        dataUrl, width, height,
        renderWidth: Math.abs(ctm[0]),
        renderHeight: Math.abs(ctm[3]),
        x: Math.round(ctm[4] * 100) / 100,
        y: Math.round(ctm[5] * 100) / 100,
        page: pageIndex,
    };
}

const INLINE_IMAGE_ABBREVS: Record<string, string> = {
    'W': 'Width', 'H': 'Height', 'BPC': 'BitsPerComponent',
    'CS': 'ColorSpace', 'F': 'Filter', 'D': 'Decode', 'DP': 'DecodeParms',
    'IM': 'ImageMask', 'I': 'Interpolate',
};

const INLINE_CS_ABBREVS: Record<string, string> = {
    'G': 'DeviceGray', 'RGB': 'DeviceRGB', 'CMYK': 'DeviceCMYK',
};

const INLINE_FILTER_ABBREVS: Record<string, string> = {
    'AHx': 'ASCIIHexDecode', 'A85': 'ASCII85Decode',
    'LZW': 'LZWDecode', 'Fl': 'FlateDecode',
    'RL': 'RunLengthDecode', 'CCF': 'CCITTFaxDecode',
    'DCT': 'DCTDecode',
};

function parseInlineImageDict(tokens: string[], startIdx: number): { dict: Record<string, string>; idIndex: number } {
    const dict: Record<string, string> = {};
    let i = startIdx;
    while (i < tokens.length && tokens[i] !== 'ID' && tokens[i] !== 'EI') {
        let key = tokens[i];
        if (key.startsWith('/')) key = key.slice(1);
        key = INLINE_IMAGE_ABBREVS[key] ?? key;
        i++;
        if (i >= tokens.length || tokens[i] === 'ID' || tokens[i] === 'EI') break;
        let val = tokens[i];
        if (val.startsWith('/')) val = val.slice(1);
        if (key === 'ColorSpace') val = INLINE_CS_ABBREVS[val] ?? val;
        if (key === 'Filter') val = INLINE_FILTER_ABBREVS[val] ?? val;
        dict[key] = val;
        i++;
    }
    return { dict, idIndex: i };
}

function parseInlineImage(
    tokens: string[],
    biIndex: number,
    ctm: number[],
    pageIndex: number,
): { imageItem: ImageItem | null; newIndex: number } | null {
    const { dict, idIndex } = parseInlineImageDict(tokens, biIndex + 1);
    let i = idIndex;
    if (i < tokens.length && tokens[i] === 'ID') i++;
    while (i < tokens.length && tokens[i] !== 'EI') i++;

    const width = Number.parseInt(dict['Width'] ?? '0', 10);
    const height = Number.parseInt(dict['Height'] ?? '0', 10);
    if (width <= 0 || height <= 0) return { imageItem: null, newIndex: i };

    const filter = dict['Filter'] ?? '';
    if (filter === 'DCTDecode') {
        return { imageItem: null, newIndex: i };
    }

    return {
        imageItem: {
            dataUrl: '',
            width, height,
            renderWidth: Math.abs(ctm[0]),
            renderHeight: Math.abs(ctm[3]),
            x: Math.round(ctm[4] * 100) / 100,
            y: Math.round(ctm[5] * 100) / 100,
            page: pageIndex,
        },
        newIndex: i,
    };
}

function resolveIndexedLookup(reader: PdfReader, csArr: PdfObject[]): Uint8Array | null {
    if (csArr.length < 4) return null;
    const lookupObj = reader.resolveDeep(csArr[3]);
    if (lookupObj.type === 'stream' && lookupObj.stream) {
        return reader.decodeStreamData(lookupObj.value as Record<string, PdfObject>, lookupObj.stream);
    }
    if (lookupObj.type === 'string') {
        const str = lookupObj.value as string;
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) bytes[i] = str.codePointAt(i) ?? 0;
        return bytes;
    }
    return null;
}

type ColorInfo = { channels: number; indexed: boolean; lookupTable: Uint8Array | null; baseChannels: number };

const DEFAULT_COLOR_INFO: ColorInfo = { channels: 3, indexed: false, lookupTable: null, baseChannels: 3 };

function channelsFromName(name: string): number {
    if (name === 'DeviceRGB' || name === 'RGB' || name === 'CalRGB') return 3;
    if (name === 'DeviceCMYK' || name === 'CMYK') return 4;
    if (name === 'DeviceGray' || name === 'Gray' || name === 'G' || name === 'CalGray') return 1;
    return 3;
}

function resolveBaseChannels(reader: PdfReader, baseObj: PdfObject): number {
    const resolved = reader.resolveDeep(baseObj);
    if (resolved.type === 'name') return channelsFromName(resolved.value as string);
    if (resolved.type === 'array') {
        const arr = resolved.value as PdfObject[];
        const type = reader.getString(arr[0]);
        if (type === 'ICCBased' && arr.length >= 2) {
            return reader.getNumber(reader.getDict(arr[1])['N']) || 3;
        }
    }
    return 3;
}

function resolveColorInfoFromArray(reader: PdfReader, arr: PdfObject[]): ColorInfo {
    if (arr.length === 0) return DEFAULT_COLOR_INFO;
    const csType = reader.getString(arr[0]);

    if (csType === 'ICCBased' && arr.length >= 2) {
        const n = reader.getNumber(reader.getDict(arr[1])['N']);
        const ch = (n === 1 || n === 3 || n === 4) ? n : 3;
        return { channels: ch, indexed: false, lookupTable: null, baseChannels: ch };
    }

    if (csType === 'Indexed' && arr.length >= 4) {
        const baseChannels = resolveBaseChannels(reader, arr[1]);
        const lookup = resolveIndexedLookup(reader, arr);
        return { channels: 1, indexed: true, lookupTable: lookup, baseChannels };
    }

    if (csType === 'Separation' || csType === 'DeviceN') {
        return { channels: 1, indexed: false, lookupTable: null, baseChannels: 1 };
    }

    const ch = channelsFromName(csType);
    return { channels: ch, indexed: false, lookupTable: null, baseChannels: ch };
}

function resolveImageColorInfo(dict: Record<string, PdfObject>, reader: PdfReader): ColorInfo {
    const csObj = dict['ColorSpace'];
    if (!csObj) return DEFAULT_COLOR_INFO;

    const resolved = reader.resolveDeep(csObj);
    if (resolved.type === 'name') {
        const ch = channelsFromName(resolved.value as string);
        return { channels: ch, indexed: false, lookupTable: null, baseChannels: ch };
    }

    if (resolved.type === 'array') {
        return resolveColorInfoFromArray(reader, resolved.value as PdfObject[]);
    }

    return { channels: 3, indexed: false, lookupTable: null, baseChannels: 3 };
}

function channelsToRgb(data: Uint8Array, offset: number, ch: number): [number, number, number] {
    if (ch === 3) return [data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0];
    if (ch === 1) { const g = data[offset] ?? 0; return [g, g, g]; }
    if (ch === 4) {
        const c = (data[offset] ?? 0) / 255, m = (data[offset + 1] ?? 0) / 255;
        const y = (data[offset + 2] ?? 0) / 255, k = (data[offset + 3] ?? 0) / 255;
        return [Math.round((1-c)*(1-k)*255), Math.round((1-m)*(1-k)*255), Math.round((1-y)*(1-k)*255)];
    }
    return [0, 0, 0];
}

function pixelToRgb(
    decoded: Uint8Array, srcIdx: number, channels: number,
    indexed: boolean, lookupTable: Uint8Array | null, baseChannels: number,
): [number, number, number] {
    if (indexed && lookupTable) {
        const index = decoded[srcIdx] ?? 0;
        return channelsToRgb(lookupTable, index * baseChannels, baseChannels);
    }
    return channelsToRgb(decoded, srcIdx, channels);
}

function decodeSMask(dict: Record<string, PdfObject>, reader: PdfReader, width: number, height: number): Uint8Array | null {
    const smaskRef = dict['SMask'];
    if (!smaskRef) return null;
    try {
        const smaskDict = reader.getDict(smaskRef);
        const smaskW = reader.getNumber(smaskDict['Width']);
        const smaskH = reader.getNumber(smaskDict['Height']);
        if (smaskW !== width || smaskH !== height) return null;
        const maskData = reader.getStreamData(smaskRef);
        if (maskData.length < width * height) return null;
        return maskData;
    } catch {
        return null;
    }
}

interface BitPackedPixelOptions {
    readonly decoded: Uint8Array;
    readonly col: number;
    readonly rowStart: number;
    readonly srcChannels: number;
    readonly bpc: number;
    readonly indexed: boolean;
    readonly lookupTable: Uint8Array | null;
    readonly baseChannels: number;
}

interface PngRowOptions {
    readonly decoded: Uint8Array;
    readonly row: number;
    readonly width: number;
    readonly rowBytes: number;
    readonly srcChannels: number;
    readonly bpc: number;
    readonly channels: number;
    readonly indexed: boolean;
    readonly lookupTable: Uint8Array | null;
    readonly baseChannels: number;
    readonly smask: Uint8Array | null;
    readonly pixelBytes: number;
}

function decodeBitPackedPixel(opts: BitPackedPixelOptions): [number, number, number] {
    const { decoded, col, rowStart, srcChannels, bpc, indexed, lookupTable, baseChannels } = opts;
    const bitOffset = col * srcChannels * bpc;
    const byteIdx = rowStart + (bitOffset >> 3);
    const bitShift = 8 - bpc - (bitOffset & 7);
    const mask = (1 << bpc) - 1;
    const sample = (decoded[byteIdx] >> bitShift) & mask;
    const normalized = Math.round(sample * 255 / mask);
    if (indexed && lookupTable) {
        const lutOffset = sample * baseChannels;
        const r = lookupTable[lutOffset] ?? 0;
        const g = baseChannels >= 3 ? (lookupTable[lutOffset + 1] ?? 0) : r;
        const b = baseChannels >= 3 ? (lookupTable[lutOffset + 2] ?? 0) : r;
        return [r, g, b];
    }
    return [normalized, normalized, normalized];
}

function buildPngRow(opts: PngRowOptions): Uint8Array {
    const { decoded, row, width, rowBytes, srcChannels, bpc, channels, indexed, lookupTable, baseChannels, smask, pixelBytes } = opts;
    const rowStart = row * rowBytes;
    const pixelRow = new Uint8Array(width * pixelBytes);
    const isBitPacked = bpc < 8;
    for (let col = 0; col < width; col++) {
        let r: number, g: number, b: number;
        if (isBitPacked) {
            [r, g, b] = decodeBitPackedPixel({ decoded, col, rowStart, srcChannels, bpc, indexed, lookupTable, baseChannels });
        } else {
            const srcIdx = rowStart + col * srcChannels;
            [r, g, b] = pixelToRgb(decoded, srcIdx, channels, indexed, lookupTable, baseChannels);
        }
        const outIdx = col * pixelBytes;
        pixelRow[outIdx] = r;
        pixelRow[outIdx + 1] = g;
        pixelRow[outIdx + 2] = b;
        if (smask !== null) {
            pixelRow[outIdx + 3] = smask[row * width + col];
        }
    }
    const filterRow = new Uint8Array(1 + width * pixelBytes);
    filterRow[0] = 0;
    filterRow.set(pixelRow, 1);
    return filterRow;
}

function rawPixelsToPng(
    decoded: Uint8Array,
    width: number,
    height: number,
    dict: Record<string, PdfObject>,
    reader: PdfReader,
): Uint8Array | null {
    const { channels, indexed, lookupTable, baseChannels } = resolveImageColorInfo(dict, reader);
    const bpc = reader.getNumber(dict['BitsPerComponent']) || 8;

    const srcChannels = indexed ? 1 : channels;
    const expectedBytes = Math.ceil(width * height * srcChannels * bpc / 8);
    if (decoded.length < expectedBytes * 0.8) return null;

    const smask = decodeSMask(dict, reader, width, height);
    const hasAlpha = smask !== null;
    const pixelBytes = hasAlpha ? 4 : 3;
    const rowBytes = Math.ceil(width * srcChannels * bpc / 8);

    const pngRows: Uint8Array[] = [];
    for (let row = 0; row < height; row++) {
        pngRows.push(buildPngRow({ decoded, row, width, rowBytes, srcChannels, bpc, channels, indexed, lookupTable, baseChannels, smask, pixelBytes }));
    }

    return buildPng(width, height, pngRows, hasAlpha);
}

function buildIhdrData(width: number, height: number, hasAlpha: boolean): Uint8Array {
    const d = new Uint8Array(13);
    const v = new DataView(d.buffer);
    v.setUint32(0, width);
    v.setUint32(4, height);
    d[8] = 8;
    d[9] = hasAlpha ? 6 : 2;
    return d;
}

function deflateRawData(rawData: Uint8Array): Uint8Array {
    const deflatedChunks: Uint8Array[] = [];
    let remaining = rawData.length;
    let pos = 0;
    while (remaining > 0) {
        const blockSize = Math.min(remaining, 65535);
        const isLast = remaining - blockSize === 0;
        const block = new Uint8Array(5 + blockSize);
        block[0] = isLast ? 1 : 0;
        block[1] = blockSize & 0xff; block[2] = (blockSize >> 8) & 0xff;
        block[3] = (~blockSize) & 0xff; block[4] = ((~blockSize) >> 8) & 0xff;
        block.set(rawData.subarray(pos, pos + blockSize), 5);
        deflatedChunks.push(block);
        pos += blockSize; remaining -= blockSize;
    }
    const deflatedSize = deflatedChunks.reduce((sum, c) => sum + c.length, 0);
    const zlibData = new Uint8Array(2 + deflatedSize + 4);
    zlibData[0] = 0x78; zlibData[1] = 0x01;
    let zlibPos = 2;
    for (const chunk of deflatedChunks) { zlibData.set(chunk, zlibPos); zlibPos += chunk.length; }
    const adler = adler32(rawData);
    zlibData[zlibPos] = (adler >> 24) & 0xff; zlibData[zlibPos + 1] = (adler >> 16) & 0xff;
    zlibData[zlibPos + 2] = (adler >> 8) & 0xff; zlibData[zlibPos + 3] = adler & 0xff;
    return zlibData;
}

function buildPng(width: number, height: number, rows: Uint8Array[], hasAlpha = false): Uint8Array {
    const rawDataSize = rows.reduce((sum, r) => sum + r.length, 0);
    const rawData = new Uint8Array(rawDataSize);
    let offset = 0;
    for (const row of rows) { rawData.set(row, offset); offset += row.length; }

    const zlibData = deflateRawData(rawData);
    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = createPngChunk('IHDR', buildIhdrData(width, height, hasAlpha));
    const idat = createPngChunk('IDAT', zlibData);
    const iend = createPngChunk('IEND', new Uint8Array(0));

    const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
    let pngPos = 0;
    png.set(signature, pngPos); pngPos += signature.length;
    png.set(ihdr, pngPos); pngPos += ihdr.length;
    png.set(idat, pngPos); pngPos += idat.length;
    png.set(iend, pngPos);
    return png;
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
    const chunk = new Uint8Array(12 + data.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) chunk[4 + i] = type.codePointAt(i) ?? 0;
    chunk.set(data, 8);
    const crcData = chunk.subarray(4, 8 + data.length);
    view.setUint32(8 + data.length, pngCrc32(crcData));
    return chunk;
}

const PNG_CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c;
    }
    return table;
})();

function pngCrc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
    let a = 1;
    let b = 0;
    for (const byte of data) {
        a = (a + byte) % 65521;
        b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
}

function uint8ArrayToBase64(data: Uint8Array): string {
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < data.length; i += chunkSize) {
        const slice = data.subarray(i, Math.min(i + chunkSize, data.length));
        for (const byte of slice) {
            binary += String.fromCodePoint(byte);
        }
    }
    return btoa(binary);
}

// ── Text-to-HTML conversion ─────────────────────────────────────────────

interface TextLine {
    items: TextItem[];
    y: number;
    minX: number;
}

function escapeHtml(str: string): string {
    return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function deduplicateTextItems(items: TextItem[]): TextItem[] {
    if (items.length <= 1) return items;
    const sorted = [...items].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 0.5) return a.y - b.y;
        if (Math.abs(a.x - b.x) > 0.5) return a.x - b.x;
        return 0;
    });
    const result: TextItem[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (
            curr.page === prev.page &&
            Math.abs(curr.x - prev.x) < 1.5 &&
            Math.abs(curr.y - prev.y) < 1.5 &&
            curr.text === prev.text
        ) {
            continue;
        }
        result.push(curr);
    }
    return removeOverlappingCharDuplicates(result);
}

function buildPageWordIndex(wordItems: TextItem[]): Map<number, TextItem[]> {
    const pageMap = new Map<number, TextItem[]>();
    for (const item of wordItems) {
        const list = pageMap.get(item.page) ?? [];
        list.push(item);
        pageMap.set(item.page, list);
    }
    return pageMap;
}

function isCharCoveredByWord(charItem: TextItem, wordItem: TextItem): boolean {
    if (charItem.page !== wordItem.page) return false;
    const yDiff = Math.abs(charItem.y - wordItem.y);
    if (yDiff > wordItem.fontSize * 0.5) return false;
    const margin = wordItem.fontSize * 0.3;
    const positionOverlaps = charItem.x >= wordItem.x - margin && charItem.endX <= wordItem.endX + margin;
    if (!positionOverlaps) return false;
    // Only remove if the word actually contains the char (true duplicate, not adjacent punctuation)
    const charText = charItem.text.trim();
    return charText.length > 0 && wordItem.text.includes(charText);
}

function removeOverlappingCharDuplicates(items: TextItem[]): TextItem[] {
    const wordItems = items.filter(it => it.text.trim().length > 2);
    if (wordItems.length === 0) return items;

    const charItems = items.filter(it => it.text.trim().length <= 2);
    if (charItems.length === 0) return items;

    const wordsByPage = buildPageWordIndex(wordItems);

    const keptChars: TextItem[] = [];
    for (const charItem of charItems) {
        const pageWords = wordsByPage.get(charItem.page);
        if (!pageWords) {
            keptChars.push(charItem);
            continue;
        }

        let covered = false;
        for (const word of pageWords) {
            if (isCharCoveredByWord(charItem, word)) {
                covered = true;
                break;
            }
        }
        if (!covered) {
            keptChars.push(charItem);
        }
    }

    return [...wordItems, ...keptChars];
}

function computeLineYTolerance(items: TextItem[]): number {
    if (items.length === 0) return 2;
    const sizes: number[] = [];
    for (const item of items) {
        if (item.fontSize > 0) sizes.push(item.fontSize);
    }
    if (sizes.length === 0) return 2;
    sizes.sort((a, b) => a - b);
    const medianSize = sizes[Math.floor(sizes.length / 2)];
    return Math.max(2, medianSize * 0.35);
}

function sortByReadingOrder(items: TextItem[], yTolerance: number): TextItem[] {
    return [...items].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > yTolerance) return b.y - a.y;
        return a.x - b.x;
    });
}

function computePerCharThreshold(sorted: TextItem[], yTolerance: number): Map<number, number> {
    const pageGaps = new Map<number, number[]>();
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const next = sorted[i];
        if (prev.page !== next.page || Math.abs(prev.y - next.y) > yTolerance) continue;
        if (prev.text.trim().length > 2 || next.text.trim().length > 2) continue;
        const gap = next.x - prev.endX;
        if (gap > 0 && gap < prev.fontSize * 5) {
            const gaps = pageGaps.get(prev.page) ?? [];
            gaps.push(gap);
            pageGaps.set(prev.page, gaps);
        }
    }
    const result = new Map<number, number>();
    for (const [page, gaps] of pageGaps) {
        if (gaps.length < 5) continue;
        gaps.sort((a, b) => a - b);
        const median = gaps[Math.floor(gaps.length / 2)];
        result.set(page, median * 2.5);
    }
    return result;
}

function detectCharByCharPages(items: TextItem[]): Set<number> {
    const pageCounts = new Map<number, { total: number; singleChar: number }>();
    for (const item of items) {
        const counts = pageCounts.get(item.page) ?? { total: 0, singleChar: 0 };
        counts.total++;
        if (item.text.trim().length <= 2) counts.singleChar++;
        pageCounts.set(item.page, counts);
    }
    const result = new Set<number>();
    for (const [page, counts] of pageCounts) {
        if (counts.total >= 10 && counts.singleChar / counts.total > 0.6) {
            result.add(page);
        }
    }
    return result;
}

function computePageGapThreshold(gaps: number[]): number {
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    let maxJump = 0;
    let jumpIndex = -1;
    for (let i = 0; i < gaps.length - 1; i++) {
        const jump = gaps[i + 1] - gaps[i];
        if (jump > maxJump) {
            maxJump = jump;
            jumpIndex = i;
        }
    }
    if (jumpIndex >= 0 && maxJump > median * 0.3) {
        return (gaps[jumpIndex] + gaps[jumpIndex + 1]) / 2;
    }
    return median * 1.5;
}

function collectPageGaps(sorted: TextItem[], yTolerance: number, charPages: Set<number>): Map<number, number[]> {
    const pageGaps = new Map<number, number[]>();
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const next = sorted[i];
        if (!charPages.has(next.page)) continue;
        if (prev.page !== next.page) continue;
        if (Math.abs(prev.y - next.y) > yTolerance) continue;
        if (prev.text.trim().length > 2 || next.text.trim().length > 2) continue;
        const gap = next.x - prev.endX;
        if (gap > 0 && gap < prev.fontSize * 5) {
            const gaps = pageGaps.get(next.page) ?? [];
            gaps.push(gap);
            pageGaps.set(next.page, gaps);
        }
    }
    return pageGaps;
}

function computeWordGapThreshold(
    sorted: TextItem[],
    yTolerance: number,
    charPages: Set<number>,
): Map<number, number> {
    if (charPages.size === 0) return new Map();

    const pageGaps = collectPageGaps(sorted, yTolerance, charPages);
    const result = new Map<number, number>();
    for (const [page, gaps] of pageGaps) {
        if (gaps.length < 5) continue;
        result.set(page, computePageGapThreshold(gaps));
    }
    return result;
}

function hasScriptBoundary(prevText: string, nextText: string): boolean {
    if (!prevText || !nextText) return false;
    const lastChar = prevText.codePointAt(prevText.length - 1) ?? 0;
    const firstChar = nextText.codePointAt(0) ?? 0;
    const lastIsRTL = isRTLChar(lastChar);
    const firstIsRTL = isRTLChar(firstChar);
    const lastIsLTR = isLTRCode(lastChar);
    const firstIsLTR = isLTRCode(firstChar);
    return (lastIsRTL && firstIsLTR) || (lastIsLTR && firstIsRTL);
}

function mergeTextItems(current: TextItem, next: TextItem, gap: number, wordGapThresholds: Map<number, number>): TextItem {
    const fontSize = Math.max(current.fontSize, next.fontSize);
    const wordGap = wordGapThresholds.get(next.page);
    const fallbackGap = fontSize * 0.15;
    const scriptChange = hasScriptBoundary(current.text, next.text);
    const needsSpace = scriptChange || (wordGap === undefined ? gap > fallbackGap : gap > wordGap);
    const separator = needsSpace ? ' ' : '';
    const text = current.text + separator + next.text;
    return {
        text,
        fontSize,
        x: Math.min(current.x, next.x),
        y: current.y,
        endX: Math.max(current.endX, next.endX),
        page: current.page,
        color: current.color,
        bold: current.bold || next.bold,
        italic: current.italic || next.italic,
        fontFamily: current.fontFamily || next.fontFamily,
        fontName: current.fontName || next.fontName,
        mcid: current.mcid >= 0 ? current.mcid : next.mcid,
        charSpacing: current.charSpacing,
        wordSpacing: current.wordSpacing,
        textRise: current.textRise,
        horizontalScaling: current.horizontalScaling,
        textRenderMode: current.textRenderMode,
        strokeColor: current.strokeColor,
        transformMatrix: current.transformMatrix,
        isSpaceOffset: false,
    };
}

function mergeAdjacentChars(items: TextItem[]): TextItem[] {
    if (items.length <= 1) return items;

    const yTolerance = computeLineYTolerance(items);
    const sorted = sortByReadingOrder(items, yTolerance);

    const perCharThresholds = computePerCharThreshold(sorted, yTolerance);
    const charPages = detectCharByCharPages(items);
    const wordGapThresholds = computeWordGapThreshold(sorted, yTolerance, charPages);
    const merged: TextItem[] = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        const sameLine = next.page === current.page && Math.abs(next.y - current.y) <= yTolerance;
        const gap = next.x - current.endX;
        const fontSize = Math.max(current.fontSize, next.fontSize);
        const charWidth = fontSize * 0.6;
        const isNearby = gap >= -charWidth * 0.3 && gap < charWidth * 1.2;
        const pageThreshold = perCharThresholds.get(next.page);
        const wideMerge = pageThreshold !== undefined
            && next.text.trim().length <= 2
            && gap >= 0 && gap < pageThreshold;
        const isAdjacent = isNearby || wideMerge;

        if (sameLine && isAdjacent) {
            current = mergeTextItems(current, next, gap, wordGapThresholds);
        } else {
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);
    return merged;
}

function groupIntoLines(items: TextItem[]): TextLine[] {
    if (items.length === 0) return [];

    const yTolerance = computeLineYTolerance(items);
    const sorted = sortByReadingOrder(items, yTolerance);

    const lines: TextLine[] = [];
    let currentLine: TextItem[] = [sorted[0]];
    let currentY = sorted[0].y;

    for (let i = 1; i < sorted.length; i++) {
        const item = sorted[i];
        if (Math.abs(item.y - currentY) <= yTolerance && item.page === sorted[i - 1].page) {
            currentLine.push(item);
        } else {
            lines.push({
                items: currentLine,
                y: currentY,
                minX: Math.min(...currentLine.map(it => it.x)),
            });
            currentLine = [item];
            currentY = item.y;
        }
    }
    lines.push({
        items: currentLine,
        y: currentY,
        minX: Math.min(...currentLine.map(it => it.x)),
    });

    return lines;
}

function detectBodyFontSize(items: TextItem[]): number {
    if (items.length === 0) return 12;
    const sizeCount = new Map<number, number>();
    for (const item of items) {
        const rounded = Math.round(item.fontSize * 2) / 2;
        sizeCount.set(rounded, (sizeCount.get(rounded) ?? 0) + item.text.length);
    }
    let maxCount = 0;
    let bodySize = 12;
    for (const [size, count] of sizeCount) {
        if (count > maxCount) {
            maxCount = count;
            bodySize = size;
        }
    }
    return bodySize;
}

function detectBodyFont(items: TextItem[]): string {
    if (items.length === 0) return '';
    const fontCount = new Map<string, number>();
    for (const item of items) {
        if (item.fontFamily) {
            fontCount.set(item.fontFamily, (fontCount.get(item.fontFamily) ?? 0) + item.text.length);
        }
    }
    let maxCount = 0;
    let bodyFont = '';
    for (const [font, count] of fontCount) {
        if (count > maxCount) {
            maxCount = count;
            bodyFont = font;
        }
    }
    return bodyFont;
}

function getHeadingLevel(fontSize: number, bodySize: number): number {
    if (bodySize <= 0) return 0;
    const ratio = fontSize / bodySize;
    if (ratio >= 1.6) return 1;
    if (ratio >= 1.3) return 2;
    if (ratio >= 1.1) return 3;
    return 0;
}

function findLargeGapIndex(line: TextLine): number {
    if (line.items.length < 2) return -1;
    const sorted = [...line.items].sort((a, b) => a.x - b.x);
    let maxGap = 0;
    let splitIdx = -1;
    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].x - sorted[i - 1].endX;
        if (gap > maxGap) {
            maxGap = gap;
            splitIdx = i;
        }
    }
    const fontSize = sorted[0]?.fontSize ?? 12;
    if (maxGap <= fontSize * 2.5) return -1;

    const leftText = sorted.slice(0, splitIdx).map(it => it.text).join('').trim();
    const rightText = sorted.slice(splitIdx).map(it => it.text).join('').trim();
    if (leftText.length < 3 || rightText.length < 3) return -1;

    return splitIdx;
}

function lineToTableRowHtml(line: TextLine, splitIndex: number, bodySize: number, bodyFont: string): string {
    const sorted = [...line.items].sort((a, b) => a.x - b.x);
    const leftItems = sorted.slice(0, splitIndex);
    const rightItems = sorted.slice(splitIndex);

    const leftLine: TextLine = { items: leftItems, y: line.y, minX: leftItems[0]?.x ?? 0 };
    const rightLine: TextLine = { items: rightItems, y: line.y, minX: rightItems[0]?.x ?? 0 };

    const leftFontSize = leftItems.reduce((max, it) => Math.max(max, it.fontSize), 0);
    const rightFontSize = rightItems.reduce((max, it) => Math.max(max, it.fontSize), 0);

    const leftHeading = getHeadingLevel(leftFontSize, bodySize);
    const rightHeading = getHeadingLevel(rightFontSize, bodySize);

    let leftHtml = lineToHtmlContent(leftLine, bodyFont, bodySize);
    let rightHtml = lineToHtmlContent(rightLine, bodyFont, bodySize);

    if (leftHeading > 0) {
        leftHtml = `<h${leftHeading} style="margin: 0;">${leftHtml}</h${leftHeading}>`;
    }
    if (rightHeading > 0) {
        rightHtml = `<h${rightHeading} style="margin: 0;">${rightHtml}</h${rightHeading}>`;
    }

    const tableDir = isLineRTL(line) ? ' dir="rtl"' : '';
    return `<table${tableDir} style="width: 100%; border-collapse: collapse;"><tr><td style="border: none; padding: 0;">${leftHtml}</td><td style="border: none; padding: 0; text-align: right;">${rightHtml}</td></tr></table>`;
}

function lineToText(line: TextLine): string {
    const sorted = [...line.items].sort((a, b) => a.x - b.x);
    let result = '';
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
            const gap = sorted[i].x - sorted[i - 1].endX;
            if (gap > sorted[i - 1].fontSize * 0.12
                    && !isSingleBracket(sorted[i - 1].text)
                    && !isSingleBracket(sorted[i].text)) {
                result += ' ';
            }
        }
        result += sorted[i].text;
    }
    return result.trim();
}

function findAnnotationForItem(item: TextItem, annotations: ReadonlyArray<PdfAnnotation>): string | null {
    for (const ann of annotations) {
        if (ann.page !== item.page) continue;
        const itemCenterX = (item.x + item.endX) / 2;
        const itemY = item.y;
        if (itemCenterX >= ann.x && itemCenterX <= ann.x + ann.width &&
            itemY >= ann.y && itemY <= ann.y + ann.height) {
            return ann.uri;
        }
    }
    return null;
}

function buildItemStyles(item: TextItem, bodyFont: string, bodySize: number): string[] {
    const styles: string[] = [];
    if (!isDefaultColor(item.color)) styles.push(`color: ${item.color}`);
    if (item.fontFamily && item.fontFamily !== bodyFont) styles.push(`font-family: '${item.fontFamily}'`);
    const sizeRatio = bodySize > 0 ? item.fontSize / bodySize : 1;
    if (sizeRatio < 0.85 || sizeRatio > 1.15) {
        styles.push(`font-size: ${Math.round(item.fontSize)}pt`);
    }
    if (Math.abs(item.charSpacing) > 0.1) {
        styles.push(`letter-spacing: ${(item.charSpacing * 0.75).toFixed(1)}px`);
    }
    if (Math.abs(item.wordSpacing) > 0.5) {
        styles.push(`word-spacing: ${(item.wordSpacing * 0.75).toFixed(1)}px`);
    }
    if (item.horizontalScaling !== 100 && Math.abs(item.horizontalScaling - 100) > 1) {
        styles.push(`display:inline-block;transform:scaleX(${(item.horizontalScaling / 100).toFixed(2)})`);
    }
    applyTextRenderModeStyles(item, styles);
    return styles;
}

function wrapItemHtml(item: TextItem, text: string, bodyFont: string, bodySize: number, linkUri?: string | null): string {
    let fragment = text;
    const styles = buildItemStyles(item, bodyFont, bodySize);
    if (styles.length > 0) {
        fragment = `<span style="${styles.join('; ')}">${fragment}</span>`;
    }
    if (item.textRise > 1) {
        fragment = `<sup>${fragment}</sup>`;
    } else if (item.textRise < -1) {
        fragment = `<sub>${fragment}</sub>`;
    }
    if (item.italic) fragment = `<em>${fragment}</em>`;
    if (item.bold) fragment = `<strong>${fragment}</strong>`;
    if (linkUri) {
        const safeUri = escapeHtml(linkUri);
        const linkColor = isDefaultColor(item.color) ? '#1a0dab' : item.color;
        fragment = `<a href="${safeUri}" target="_blank" rel="noopener noreferrer" style="color:${linkColor};text-decoration:underline">${fragment}</a>`;
    }
    return fragment;
}

function applyTextRenderModeStyles(item: TextItem, styles: string[]): void {
    if (item.textRenderMode === 1) {
        styles.push(`-webkit-text-stroke: 1px ${item.color}; color: transparent`);
    } else if (item.textRenderMode === 2) {
        styles.push(`-webkit-text-stroke: 1px ${item.color}`);
    }
}

function isSingleBracket(text: string): boolean {
    const t = text.trim();
    return t === '(' || t === ')' || t === '[' || t === ']';
}

function lineToHtmlContent(line: TextLine, bodyFont?: string, bodySize?: number, annotations?: ReadonlyArray<PdfAnnotation>): string {
    const sorted = [...line.items].sort((a, b) => a.x - b.x);
    let result = '';
    const bf = bodyFont ?? '';
    const bs = bodySize ?? 12;
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
            const gap = sorted[i].x - sorted[i - 1].endX;
            if (gap > sorted[i - 1].fontSize * 0.12
                    && !isSingleBracket(sorted[i - 1].text)
                    && !isSingleBracket(sorted[i].text)) {
                result += ' ';
            }
        }
        const text = escapeHtml(sorted[i].text);
        const uri = annotations ? findAnnotationForItem(sorted[i], annotations) : null;
        result += wrapItemHtml(sorted[i], text, bf, bs, uri);
    }
    return result.trim();
}

function findBestColumnGap(startXs: number[]): { bestGap: number; splitX: number } {
    let bestGap = 0;
    let splitX = 0;
    for (let i = 1; i < startXs.length; i++) {
        const gap = startXs[i] - startXs[i - 1];
        if (gap > bestGap) {
            bestGap = gap;
            splitX = (startXs[i - 1] + startXs[i]) / 2;
        }
    }
    return { bestGap, splitX };
}

function classifyLinesByColumn(pageLines: TextLine[], splitX: number): TextLine[] {
    const spanningLines: TextLine[] = [];
    const leftLines: TextLine[] = [];
    const rightLines: TextLine[] = [];

    for (const line of pageLines) {
        const hasLeft = line.items.some(it => it.x < splitX);
        const hasRight = line.items.some(it => it.x >= splitX);

        if (hasLeft && hasRight) {
            spanningLines.push(line);
        } else if (hasRight) {
            rightLines.push(line);
        } else {
            leftLines.push(line);
        }
    }

    return [...spanningLines, ...leftLines, ...rightLines];
}

function detectColumns(lines: TextLine[]): { lines: TextLine[]; hasColumns: boolean } {
    if (lines.length < 4) return { lines, hasColumns: false };

    const pages = new Set(lines.map(l => l.items[0]?.page ?? 0));
    const result: TextLine[] = [];
    let hasColumns = false;

    for (const page of pages) {
        const pageLines = lines.filter(l => (l.items[0]?.page ?? 0) === page);
        if (pageLines.length < 4) {
            result.push(...pageLines);
            continue;
        }

        const pageText = pageLines.map(l => l.items.map(it => it.text).join('')).join('');
        if (hasRTLText(pageText)) {
            result.push(...pageLines);
            continue;
        }

        const startXs = pageLines.map(l => l.minX).sort((a, b) => a - b);
        const { bestGap, splitX } = findBestColumnGap(startXs);

        const pageWidth = Math.max(...pageLines.map(l =>
            Math.max(...l.items.map(it => it.endX))
        )) - Math.min(...startXs);

        if (bestGap < pageWidth * 0.15 || bestGap < 50) {
            result.push(...pageLines);
            continue;
        }

        hasColumns = true;
        result.push(...classifyLinesByColumn(pageLines, splitX));
    }

    return { lines: result, hasColumns };
}

const BULLET_PATTERN = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u25AA\u25AB\u2013\u2014\-*]\s*/;
const BULLET_CHARS = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u25AA\u25AB\u2013\u2014\-*]+$/;
const NUMBERED_PATTERN = /^(\d{1,3})[.)]\s+/;
const NUMBERED_PATTERN_RTL_END = /\s+[.)]\d{1,3}$/;

function stripBulletItems(line: TextLine): TextLine {
    const filtered = line.items.filter(item => {
        const t = item.text.trim();
        if (BULLET_CHARS.test(t)) return false;
        if (t.length <= 2 && /symbol/i.test(item.fontFamily)) return false;
        if (t.length === 1 && (t.codePointAt(0) ?? 0) >= 0xF000) return false;
        return true;
    });
    if (filtered.length === 0) return line;
    const first = filtered[0];
    return {
        items: filtered.map(item => {
            const trimmed = item.text.replace(BULLET_PATTERN, '');
            if (trimmed !== item.text) return { ...item, text: trimmed };
            return item;
        }),
        y: line.y,
        minX: first.x,
    };
}

function stripNumberedPrefix(line: TextLine): TextLine {
    const filtered = line.items.filter(item => {
        const t = item.text.trim();
        return !(/^\d{1,3}[.)]$/.test(t));
    });
    if (filtered.length === 0) return line;
    const first = filtered[0];
    return {
        items: filtered.map(item => {
            const trimmed = item.text.replace(NUMBERED_PATTERN, '');
            if (trimmed !== item.text) return { ...item, text: trimmed };
            const trimmedRtl = item.text.replace(NUMBERED_PATTERN_RTL_END, '');
            if (trimmedRtl !== item.text) return { ...item, text: trimmedRtl };
            return item;
        }),
        y: line.y,
        minX: first.x,
    };
}

interface HtmlBuilderState {
    html: string[];
    inBulletList: boolean;
    inNumberedList: boolean;
    inColumnLayout: boolean;
    currentParagraph: string[];
    currentParagraphRTL: boolean;
    currentParagraphAlign: string;
    currentParagraphSpacingPx: number;
    pendingMarginTopPt: number;
    currentParagraphIndent: number;
    currentParagraphLineXs: number[];
    currentParagraphLineSpacings: number[];
    currentParagraphBodySize: number;
    lastY: number | null;
    lastPage: number;
    lastLineSpacing: number;
    imageIdx: number;
    readonly annotations: ReadonlyArray<PdfAnnotation>;
    readonly pageWidth: number;
    readonly leftMargin: number;
    readonly rightMargin: number;
}

function buildParagraphStyles(state: HtmlBuilderState, useFlowingText: boolean): string[] {
    const styles: string[] = [];
    if (state.currentParagraphAlign) {
        styles.push(`text-align:${state.currentParagraphAlign}`);
    } else if (useFlowingText) {
        styles.push('text-align:justify');
    }
    if (state.pendingMarginTopPt > 0) {
        styles.push(`margin-top:${Math.round(state.pendingMarginTopPt * 100) / 100}pt`);
        state.pendingMarginTopPt = 0;
    }
    if (state.currentParagraphSpacingPx > 0) {
        styles.push(`margin-bottom:${Math.round(state.currentParagraphSpacingPx * 100) / 100}pt`);
    }
    if (state.currentParagraphLineSpacings.length > 0 && state.currentParagraphBodySize > 0) {
        const sorted = [...state.currentParagraphLineSpacings].sort((a, b) => a - b);
        const medianSpacing = sorted[Math.floor(sorted.length / 2)];
        const lineHeightRatio = medianSpacing / state.currentParagraphBodySize;
        if (lineHeightRatio > 0.5 && lineHeightRatio < 5) {
            styles.push(`line-height:${Math.round(lineHeightRatio * 100) / 100}`);
        }
    }
    if (state.currentParagraphIndent > 5) {
        styles.push(`text-indent:${Math.round(state.currentParagraphIndent * 0.75)}px`);
    }
    return styles;
}

function resetParagraphState(state: HtmlBuilderState): void {
    state.currentParagraph = [];
    state.currentParagraphRTL = false;
    state.currentParagraphAlign = '';
    state.currentParagraphSpacingPx = 0;
    state.currentParagraphIndent = 0;
    state.currentParagraphLineXs = [];
    state.currentParagraphLineSpacings = [];
    state.currentParagraphBodySize = 0;
}

function flushParagraph(state: HtmlBuilderState): void {
    if (state.currentParagraph.length === 0) {
        if (state.currentParagraphSpacingPx > 0) {
            state.pendingMarginTopPt = state.currentParagraphSpacingPx;
            state.currentParagraphSpacingPx = 0;
        }
        return;
    }
    const isMultiLine = state.currentParagraph.length > 1;
    const isCenteredOrAligned = state.currentParagraphAlign === 'center' || state.currentParagraphAlign === 'right';
    const useFlowingText = isMultiLine && !isCenteredOrAligned;
    const text = useFlowingText
        ? state.currentParagraph.join(' ')
        : state.currentParagraph.join('<br>');
    const styles = buildParagraphStyles(state, useFlowingText);
    const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
    const dirAttr = state.currentParagraphRTL ? ' dir="rtl"' : '';
    state.html.push(`<p${dirAttr}${styleAttr}>${text}</p>`);
    resetParagraphState(state);
}

function detectParagraphIndent(state: HtmlBuilderState): void {
    if (state.currentParagraphRTL) return;
    const xs = state.currentParagraphLineXs;
    if (xs.length < 2) return;
    const firstX = xs[0];
    const restXs = xs.slice(1);
    const avgRestX = restXs.reduce((s, x) => s + x, 0) / restXs.length;
    const indent = firstX - avgRestX;
    if (indent > 5 && restXs.every(x => Math.abs(x - avgRestX) < 5)) {
        state.currentParagraphIndent = indent;
    }
}

function closeList(state: HtmlBuilderState): void {
    if (state.inBulletList) { state.html.push('</ul>'); state.inBulletList = false; }
    if (state.inNumberedList) { state.html.push('</ol>'); state.inNumberedList = false; }
}

function insertImagesBeforeY(state: HtmlBuilderState, sortedImages: ImageItem[], page: number, y: number): void {
    while (state.imageIdx < sortedImages.length) {
        const img = sortedImages[state.imageIdx];
        if (img.page > page || (img.page === page && img.y < y)) break;
        flushParagraph(state);
        closeList(state);
        const styles = [`width:${Math.round(img.renderWidth * 100) / 100}pt`, 'max-width:100%', 'height:auto'];
        if (state.lastY !== null && img.page === state.lastPage) {
            const imgTop = img.y + img.renderHeight;
            const gap = state.lastY - imgTop;
            if (gap > 0) styles.push(`margin-top:${Math.round(gap * 100) / 100}pt`);
        }
        state.html.push(`<img src="${img.dataUrl}" alt="Embedded image" style="${styles.join(';')}" />`);
        state.lastY = img.y;
        state.lastPage = img.page;
        state.imageIdx++;
    }
}

function renderLineAsHeading(
    state: HtmlBuilderState, line: TextLine, headingLevel: number, bodyFont: string, bodySize: number,
    _lineSpacing = 0,
): void {
    flushParagraph(state);
    closeList(state);
    const content = lineToHtmlContent(line, bodyFont, bodySize, state.annotations);
    const rtl = isLineRTL(line);
    const dirAttr = rtl ? ' dir="rtl"' : '';
    const align = state.pageWidth > 0
        ? detectTextAlignment(line, state.pageWidth, state.leftMargin, state.rightMargin) : '';
    const hStyles: string[] = [];
    const effectiveAlign = align || (rtl ? 'right' : '');
    if (effectiveAlign) hStyles.push(`text-align:${effectiveAlign}`);
    const marginTop = Math.max(state.currentParagraphSpacingPx, state.pendingMarginTopPt);
    if (marginTop > 0) {
        hStyles.push(`margin-top:${Math.round(marginTop * 100) / 100}pt`);
        state.currentParagraphSpacingPx = 0;
        state.pendingMarginTopPt = 0;
    }
    const styleAttr = hStyles.length > 0 ? ` style="${hStyles.join(';')}"` : '';
    state.html.push(`<h${headingLevel}${dirAttr}${styleAttr}>${content}</h${headingLevel}>`);
    state.lastLineSpacing = 0;
}

function renderLineAsBullet(
    state: HtmlBuilderState, line: TextLine, lineText: string, bodyFont: string, bodySize: number,
): void {
    flushParagraph(state);
    if (state.inNumberedList) { state.html.push('</ol>'); state.inNumberedList = false; }
    const rtl = isLineRTL(line);
    if (!state.inBulletList) {
        const listDir = rtl ? ' dir="rtl"' : '';
        state.html.push(`<ul${listDir}>`);
        state.inBulletList = true;
    }
    const filteredLine = stripBulletItems(line);
    const content = lineToHtmlContent(filteredLine, bodyFont, bodySize, state.annotations);
    const dirAttr = rtl ? ' dir="rtl"' : '';
    state.html.push(`<li${dirAttr}>${content}</li>`);
}

function renderLineAsNumbered(
    state: HtmlBuilderState, line: TextLine, lineText: string, bodyFont: string, bodySize: number,
): void {
    flushParagraph(state);
    const rtl = isLineRTL(line);
    if (state.inBulletList) { state.html.push('</ul>'); state.inBulletList = false; }
    if (!state.inNumberedList) {
        const listDir = rtl ? ' dir="rtl"' : '';
        state.html.push(`<ol${listDir}>`);
        state.inNumberedList = true;
    }
    const filteredLine = stripNumberedPrefix(line);
    const content = lineToHtmlContent(filteredLine, bodyFont, bodySize, state.annotations);
    const dirAttr = rtl ? ' dir="rtl"' : '';
    state.html.push(`<li${dirAttr}>${content}</li>`);
}

interface HtmlLineOptions {
    readonly isParagraphBreak: boolean;
    readonly isPageBreak: boolean;
    readonly structureMap: StructureMap;
    readonly lineSpacing: number;
    readonly bodySize: number;
}

function appendToParagraph(
    line: TextLine, bodySize: number, bodyFont: string,
    state: HtmlBuilderState, options: HtmlLineOptions,
    rtl: boolean,
): void {
    const { isParagraphBreak, isPageBreak } = options;
    closeList(state);
    if (isParagraphBreak || isPageBreak) {
        flushParagraph(state);
    }
    if (rtl) state.currentParagraphRTL = true;
    state.currentParagraphLineXs.push(line.minX);
    if (!isParagraphBreak && !isPageBreak && options.lineSpacing > 0) {
        state.currentParagraphLineSpacings.push(options.lineSpacing);
        if (state.currentParagraphBodySize === 0) state.currentParagraphBodySize = bodySize;
    }
    state.currentParagraph.push(lineToHtmlContent(line, bodyFont, bodySize, state.annotations));
    detectParagraphIndent(state);
}

function isNumberedLine(lineText: string, rtl: boolean): boolean {
    return NUMBERED_PATTERN.test(lineText) || (rtl && NUMBERED_PATTERN_RTL_END.test(lineText));
}

function processHtmlLine(
    line: TextLine, lineText: string, bodySize: number, bodyFont: string,
    state: HtmlBuilderState, options: HtmlLineOptions,
): void {
    const { structureMap } = options;
    const largeGapIdx = findLargeGapIndex(line);
    const rtl = isLineRTL(line);

    if (largeGapIdx > 0) {
        flushParagraph(state);
        closeList(state);
        state.html.push(lineToTableRowHtml(line, largeGapIdx, bodySize, bodyFont));
        return;
    }

    const structType = getStructureTypeForLine(line, structureMap);
    const structHeading = structType ? structureTypeToHeadingLevel(structType) : 0;
    const primaryFontSize = line.items.reduce((max, item) => Math.max(max, item.fontSize), 0);
    const headingLevel = structHeading > 0 ? structHeading : getHeadingLevel(primaryFontSize, bodySize);
    if (headingLevel > 0) {
        renderLineAsHeading(state, line, headingLevel, bodyFont, bodySize, options.lineSpacing);
        return;
    }

    const isStructList = structType !== null && isStructureListItem(structType);
    if (isStructList || BULLET_PATTERN.test(lineText)) {
        renderLineAsBullet(state, line, lineText, bodyFont, bodySize);
        return;
    }
    if (isNumberedLine(lineText, rtl)) {
        renderLineAsNumbered(state, line, lineText, bodyFont, bodySize);
        return;
    }

    appendToParagraph(line, bodySize, bodyFont, state, options, rtl);
}

interface HtmlLineWithUnderlinesOptions extends HtmlLineOptions {
    readonly underlinedItems: Set<TextItem>;
}

function renderUnderlinedHeading(
    state: HtmlBuilderState, headingLevel: number, content: string, rtl: boolean,
): void {
    flushParagraph(state);
    closeList(state);
    const dirAttr = rtl ? ' dir="rtl"' : '';
    const hStyles: string[] = [];
    if (rtl) hStyles.push('text-align:right');
    const marginTop = Math.max(state.currentParagraphSpacingPx, state.pendingMarginTopPt);
    if (marginTop > 0) {
        hStyles.push(`margin-top:${Math.round(marginTop * 100) / 100}pt`);
        state.currentParagraphSpacingPx = 0;
        state.pendingMarginTopPt = 0;
    }
    const styleAttr = hStyles.length > 0 ? ` style="${hStyles.join(';')}"` : '';
    state.html.push(`<h${headingLevel}${dirAttr}${styleAttr}>${content}</h${headingLevel}>`);
    state.lastLineSpacing = 0;
}

function processHtmlLineWithUnderlines(
    line: TextLine, lineText: string, bodySize: number, bodyFont: string,
    state: HtmlBuilderState, options: HtmlLineWithUnderlinesOptions,
): void {
    const { isParagraphBreak, isPageBreak, underlinedItems, structureMap, lineSpacing, bodySize: bs } = options;
    const baseOptions: HtmlLineOptions = { isParagraphBreak, isPageBreak, structureMap, lineSpacing, bodySize: bs };

    if (underlinedItems.size === 0 || !line.items.some(it => underlinedItems.has(it))) {
        processHtmlLine(line, lineText, bodySize, bodyFont, state, baseOptions);
        return;
    }

    const structType = getStructureTypeForLine(line, structureMap);
    const structHeading = structType ? structureTypeToHeadingLevel(structType) : 0;
    const primaryFontSize = line.items.reduce((max, item) => Math.max(max, item.fontSize), 0);
    const headingLevel = structHeading > 0 ? structHeading : getHeadingLevel(primaryFontSize, bodySize);
    const content = lineToHtmlContentWithUnderlines(line, underlinedItems, bodyFont, bodySize, state.annotations);
    const rtl = isLineRTL(line);

    if (headingLevel > 0) {
        renderUnderlinedHeading(state, headingLevel, content, rtl);
        return;
    }

    closeList(state);
    if (isParagraphBreak || isPageBreak) {
        flushParagraph(state);
    }
    if (rtl) state.currentParagraphRTL = true;
    state.currentParagraphLineXs.push(line.minX);
    if (!isParagraphBreak && !isPageBreak && lineSpacing > 0) {
        state.currentParagraphLineSpacings.push(lineSpacing);
        if (state.currentParagraphBodySize === 0) state.currentParagraphBodySize = bs;
    }
    state.currentParagraph.push(content);
    detectParagraphIndent(state);
}

// ── Path-based detection (underlines, tables, borders) ──────────────────

function clusterValues(values: number[], tolerance: number): number[] {
    if (values.length === 0) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const clusters: number[][] = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
        const lastCluster = clusters.at(-1);
        if (!lastCluster) continue;
        const lastVal = lastCluster.at(-1) ?? sorted[i];
        if (sorted[i] - lastVal <= tolerance) {
            lastCluster.push(sorted[i]);
        } else {
            clusters.push([sorted[i]]);
        }
    }
    return clusters.map(c => c.reduce((sum, v) => sum + v, 0) / c.length);
}

function isHorizontalLine(r: PathRect): boolean {
    return r.height <= 3 && r.width > 5;
}

function isVerticalLine(r: PathRect): boolean {
    return r.width <= 3 && r.height > 5;
}

function isThinHorizontalForUnderline(r: PathRect): boolean {
    return Math.abs(r.height) < 2 && r.width > 5;
}

function detectUnderlines(rects: PathRect[], textItems: TextItem[]): { underlinedItems: Set<TextItem>; usedRects: Set<PathRect> } {
    const underlinedItems = new Set<TextItem>();
    const usedRects = new Set<PathRect>();
    const thinHorizontals = rects.filter(r => isThinHorizontalForUnderline(r));

    for (const rect of thinHorizontals) {
        let matched = false;
        for (const item of textItems) {
            if (item.page !== rect.page) continue;
            const xOverlap = rect.x < item.endX && rect.x + rect.width > item.x;
            if (!xOverlap) continue;
            const baselineY = item.y - item.fontSize * 0.15;
            if (Math.abs(rect.y - baselineY) < item.fontSize * 0.4) {
                underlinedItems.add(item);
                matched = true;
            }
        }
        if (matched) usedRects.add(rect);
    }

    return { underlinedItems, usedRects };
}

interface LineSegment {
    readonly x1: number;
    readonly x2: number;
    readonly y1: number;
    readonly y2: number;
    readonly horizontal: boolean;
}

function collectLineSegments(rects: PathRect[], page: number): LineSegment[] {
    const segments: LineSegment[] = [];
    for (const r of rects) {
        if (r.page !== page) continue;
        if (isHorizontalLine(r)) {
            segments.push({ x1: r.x, x2: r.x + r.width, y1: r.y + r.height / 2, y2: r.y + r.height / 2, horizontal: true });
        } else if (isVerticalLine(r)) {
            segments.push({ x1: r.x + r.width / 2, x2: r.x + r.width / 2, y1: r.y, y2: r.y + r.height, horizontal: false });
        }
    }
    return segments;
}

function segmentsIntersectOrTouch(a: LineSegment, b: LineSegment, tolerance: number): boolean {
    if (a.horizontal === b.horizontal) {
        if (a.horizontal) {
            if (Math.abs(a.y1 - b.y1) > tolerance) return false;
            return a.x2 >= b.x1 - tolerance && b.x2 >= a.x1 - tolerance;
        }
        if (Math.abs(a.x1 - b.x1) > tolerance) return false;
        return a.y2 >= b.y1 - tolerance && b.y2 >= a.y1 - tolerance;
    }

    const h = a.horizontal ? a : b;
    const v = a.horizontal ? b : a;

    const xHit = v.x1 >= h.x1 - tolerance && v.x1 <= h.x2 + tolerance;
    const yHit = h.y1 >= v.y1 - tolerance && h.y1 <= v.y2 + tolerance;
    return xHit && yHit;
}

function expandGroup(segments: LineSegment[], visited: boolean[], queue: number[], group: LineSegment[], tolerance: number): void {
    while (queue.length > 0) {
        const cur = queue.pop() ?? 0;
        for (let j = 0; j < segments.length; j++) {
            if (visited[j]) continue;
            if (segmentsIntersectOrTouch(segments[cur], segments[j], tolerance)) {
                visited[j] = true;
                group.push(segments[j]);
                queue.push(j);
            }
        }
    }
}

function groupSegmentsSpatially(segments: LineSegment[], tolerance: number): LineSegment[][] {
    const visited = new Array<boolean>(segments.length).fill(false);
    const groups: LineSegment[][] = [];

    for (let i = 0; i < segments.length; i++) {
        if (visited[i]) continue;
        visited[i] = true;
        const group: LineSegment[] = [segments[i]];
        const queue = [i];
        expandGroup(segments, visited, queue, group, tolerance);
        groups.push(group);
    }
    return groups;
}

function tryBuildTableGrid(group: LineSegment[], page: number): TableGrid | null {
    const hSegs = group.filter(s => s.horizontal);
    const vSegs = group.filter(s => !s.horizontal);

    if (hSegs.length < 3 || vSegs.length < 3) return null;

    const rowClusters = clusterValues(hSegs.map(s => s.y1), 3);
    const colClusters = clusterValues(vSegs.map(s => s.x1), 3);

    if (rowClusters.length < 3 || colClusters.length < 3) return null;
    if (colClusters.length > 20 || rowClusters.length > 50) return null;

    const gridMinX = Math.min(...colClusters);
    const gridMaxX = Math.max(...colClusters);
    const gridWidth = gridMaxX - gridMinX;
    const gridMinY = Math.min(...rowClusters);
    const gridMaxY = Math.max(...rowClusters);
    const gridHeight = gridMaxY - gridMinY;

    if (gridWidth < 50 || gridHeight < 20) return null;

    const wideH = hSegs.filter(s => (s.x2 - s.x1) > gridWidth * 0.3);
    if (wideH.length < 2) return null;

    const tallV = vSegs.filter(s => (s.y2 - s.y1) > gridHeight * 0.3);
    if (tallV.length < 2) return null;

    return {
        x: gridMinX, y: gridMinY,
        width: gridWidth, height: gridHeight,
        page, rows: rowClusters, cols: colClusters,
    };
}

function detectTableGrids(rects: PathRect[], page: number): TableGrid[] {
    const segments = collectLineSegments(rects, page);
    if (segments.length < 6) return [];

    const groups = groupSegmentsSpatially(segments, 5);

    const grids: TableGrid[] = [];
    for (const group of groups) {
        const grid = tryBuildTableGrid(group, page);
        if (grid) grids.push(grid);
    }
    return grids;
}

function detectBorderBoxes(rects: PathRect[], tableGrids: TableGrid[], page: number): PathRect[] {
    const pageRects = rects.filter(r =>
        r.page === page && (r.stroked || r.filled) && r.width > 50 && r.height > 8
        && !isHorizontalLine(r) && !isVerticalLine(r)
    );
    return pageRects.filter(r => {
        for (const grid of tableGrids) {
            if (grid.page !== page) continue;
            const overlapX = r.x < grid.x + grid.width && r.x + r.width > grid.x;
            const overlapY = r.y < grid.y + grid.height && r.y + r.height > grid.y;
            if (overlapX && overlapY) return false;
        }
        return true;
    });
}

function mergeAdjacentBorderBoxes(boxes: PathRect[]): PathRect[] {
    if (boxes.length <= 1) return boxes;
    const sorted = [...boxes].sort((a, b) => b.y - a.y);
    const merged: PathRect[] = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const prev = merged.at(-1);
        if (!prev) continue;
        const curr = sorted[i];
        const sameX = Math.abs(prev.x - curr.x) < 5 && Math.abs(prev.width - curr.width) < 10;
        const prevTop = prev.y + prev.height;
        const currTop = curr.y + curr.height;
        const adjacent = Math.abs(prev.y - currTop) < 5
            || Math.abs(curr.y - prevTop) < 5
            || (curr.y < prevTop && currTop > prev.y);
        if (sameX && adjacent) {
            const newY = Math.min(prev.y, curr.y);
            const newTop = Math.max(prevTop, currTop);
            const newX = Math.min(prev.x, curr.x);
            const newWidth = Math.max(prev.x + prev.width, curr.x + curr.width) - newX;
            merged[merged.length - 1] = {
                ...prev, x: newX, y: newY, width: newWidth, height: newTop - newY,
            };
        } else {
            merged.push({ ...curr });
        }
    }
    return merged;
}

function isItemInBounds(item: TextItem, x: number, y: number, w: number, h: number): boolean {
    const cx = (item.x + item.endX) / 2;
    const cy = item.y;
    return cx >= x && cx <= x + w && cy >= y && cy <= y + h;
}

function renderTableGrid(
    grid: TableGrid, textItems: TextItem[], underlinedItems: Set<TextItem>, bodySize: number, bodyFont: string,
): string {
    const { rows, cols } = grid;
    const sortedRows = [...rows].sort((a, b) => b - a);
    const sortedCols = [...cols].sort((a, b) => a - b);

    if (sortedRows.length < 2 || sortedCols.length < 2) return '';

    const pageItems = textItems.filter(it => it.page === grid.page);
    let html = '<table style="width: 100%; border-collapse: collapse;">';

    for (let ri = 0; ri < sortedRows.length - 1; ri++) {
        html += '<tr>';
        const cellTopY = sortedRows[ri + 1];
        const cellH = sortedRows[ri] - sortedRows[ri + 1];

        for (let ci = 0; ci < sortedCols.length - 1; ci++) {
            const cellX = sortedCols[ci];
            const cellW = sortedCols[ci + 1] - sortedCols[ci];
            const cellItems = pageItems.filter(it => isItemInBounds(it, cellX, cellTopY, cellW, cellH));
            const cellRtl = cellItems.length > 0 && hasRTLText(cellItems.map(it => it.text).join(''));
            cellItems.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
                return a.x - b.x;
            });

            const cellContent = buildCellContent(cellItems, underlinedItems, bodySize, bodyFont);
            const dirAttr = cellRtl ? ' dir="rtl"' : '';

            html += `<td style="border: 1px solid #000; padding: 4px;"${dirAttr}>${cellContent}</td>`;
        }
        html += '</tr>';
    }

    html += '</table>';
    return html;
}

function buildCellContent(
    items: TextItem[], underlinedItems: Set<TextItem>, bodySize: number, bodyFont = '',
): string {
    if (items.length === 0) return '';
    let result = '';
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let text = escapeHtml(item.text);
        if (underlinedItems.has(item)) text = `<u>${text}</u>`;
        const fragment = wrapItemHtml(item, text, bodyFont, bodySize);
        if (i > 0) {
            const prev = items[i - 1];
            const gap = item.x - prev.endX;
            if (gap > prev.fontSize * 0.15) {
                result += ' ';
            }
        }
        result += fragment;
    }
    return result;
}

function lineToHtmlContentWithUnderlines(
    line: TextLine, underlinedItems: Set<TextItem>, bodyFont?: string, bodySize?: number,
    annotations?: ReadonlyArray<PdfAnnotation>,
): string {
    const sorted = [...line.items].sort((a, b) => a.x - b.x);
    const bf = bodyFont ?? '';
    const bs = bodySize ?? 12;
    let result = '';
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
            const gap = sorted[i].x - sorted[i - 1].endX;
            if (gap > sorted[i - 1].fontSize * 0.12
                    && !isSingleBracket(sorted[i - 1].text)
                    && !isSingleBracket(sorted[i].text)) {
                result += ' ';
            }
        }
        let text = escapeHtml(sorted[i].text);
        if (underlinedItems.has(sorted[i])) {
            text = `<u>${text}</u>`;
        }
        const uri = annotations ? findAnnotationForItem(sorted[i], annotations) : null;
        result += wrapItemHtml(sorted[i], text, bf, bs, uri);
    }
    return result.trim();
}

function isLineInsideGrid(line: TextLine, grids: TableGrid[]): boolean {
    for (const grid of grids) {
        if (line.items[0]?.page !== grid.page) continue;
        for (const item of line.items) {
            if (isItemInBounds(item, grid.x - 5, grid.y - 5, grid.width + 10, grid.height + 10)) {
                return true;
            }
        }
    }
    return false;
}

function isLineInsideBorderBox(line: TextLine, boxes: PathRect[]): PathRect | undefined {
    for (const box of boxes) {
        if (line.items[0]?.page !== box.page) continue;
        const allInside = line.items.every(item =>
            isItemInBounds(item, box.x - 3, box.y - 3, box.width + 6, box.height + 6)
        );
        if (allInside) return box;
    }
    return undefined;
}

function isLineNearBorderBox(line: PathRect, boxes: PathRect[]): boolean {
    for (const box of boxes) {
        if (box.page !== line.page) continue;
        const xOverlap = line.x >= box.x - 10 && line.x + line.width <= box.x + box.width + 10;
        const nearTop = Math.abs(line.y - box.y) < 8;
        const nearBottom = Math.abs(line.y - (box.y + box.height)) < 8;
        if (xOverlap && (nearTop || nearBottom)) return true;
    }
    return false;
}

function groupFooterLinesByY(lines: TextLine[]): TextLine[][] {
    if (lines.length === 0) return [];
    const sorted = [...lines].sort((a, b) => b.y - a.y);
    const groups: TextLine[][] = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
        const lastGroup = groups.at(-1);
        if (!lastGroup) continue;
        const lastY = lastGroup[0].y;
        if (Math.abs(sorted[i].y - lastY) < 3) {
            lastGroup.push(sorted[i]);
        } else {
            groups.push([sorted[i]]);
        }
    }
    return groups;
}

function detectTextAlignment(line: TextLine, pageWidth: number, leftMargin: number, rightMargin: number): string {
    if (pageWidth <= 0) return '';
    const lineLeft = Math.min(...line.items.map(it => it.x));
    const lineRight = Math.max(...line.items.map(it => it.endX));
    const contentWidth = rightMargin - leftMargin;
    if (contentWidth <= 0) return '';

    const leftDist = lineLeft - leftMargin;
    const rightDist = rightMargin - lineRight;

    if (leftDist > contentWidth * 0.15 && rightDist > contentWidth * 0.15) {
        if (isLineRTL(line)) {
            const balance = Math.min(leftDist, rightDist) / Math.max(leftDist, rightDist);
            if (balance > 0.5) return 'center';
        } else {
            return 'center';
        }
    }
    if (leftDist > contentWidth * 0.2 && rightDist < contentWidth * 0.05) {
        return 'right';
    }
    return '';
}

function computeContentBounds(textItems: ReadonlyArray<TextItem>): { left: number; right: number; top: number; bottom: number } {
    let left = Infinity;
    let right = -Infinity;
    let top = -Infinity;
    let bottom = Infinity;
    for (const item of textItems) {
        if (item.x < left) left = item.x;
        if (item.endX > right) right = item.endX;
        if (item.y > top) top = item.y;
        if (item.y - item.fontSize < bottom) bottom = item.y - item.fontSize;
    }
    return { left, right, top, bottom };
}

function buildTableGridRects(allTableGrids: TableGrid[], remainingRects: PathRect[], allBorderBoxes: PathRect[]): Set<PathRect> {
    const tableGridRects = new Set<PathRect>();
    for (const grid of allTableGrids) {
        for (const rect of remainingRects) {
            if (rect.x >= grid.x - 2 && rect.x + rect.width <= grid.x + grid.width + 2 &&
                rect.y >= grid.y - 2 && rect.y + rect.height <= grid.y + grid.height + 2) {
                tableGridRects.add(rect);
            }
        }
    }
    for (const box of allBorderBoxes) {
        tableGridRects.add(box);
    }
    return tableGridRects;
}

function insertHrBeforeLine(
    state: HtmlBuilderState, decorativeLines: PathRect[], hrIdx: number, linePageIdx: number, lineY: number,
): number {
    while (hrIdx < decorativeLines.length) {
        const hr = decorativeLines[hrIdx];
        if (hr.page > linePageIdx || (hr.page === linePageIdx && hr.y < lineY)) break;
        flushParagraph(state);
        closeList(state);
        const color = hr.stroked ? hr.strokeColor : hr.fillColor;
        const weight = hr.stroked
            ? Math.max(2, Math.round(hr.lineWidth))
            : Math.max(2, Math.round(Math.abs(hr.height)));
        let marginTop = '0';
        if (state.lastY !== null && hr.page === state.lastPage) {
            const gap = state.lastY - hr.y;
            if (gap > 0) marginTop = `${Math.round(gap * 100) / 100}pt`;
        }
        state.html.push(`<hr style="border:none;border-top:${weight}px solid ${color};margin:${marginTop} 0 0 0" />`);
        state.lastY = hr.y;
        state.lastPage = hr.page;
        hrIdx++;
    }
    return hrIdx;
}

function renderBorderBoxToHtml(
    borderBox: PathRect, lines: TextLine[], underlinedItems: Set<TextItem>, bodyFont: string, bodySize: number,
    annotations: ReadonlyArray<PdfAnnotation>,
): string {
    const boxLines = lines.filter(l => isLineInsideBorderBox(l, [borderBox]));
    const boxContent = boxLines
        .map(l => {
            const content = lineToHtmlContentWithUnderlines(l, underlinedItems, bodyFont, bodySize, annotations);
            if (!content.length) return '';
            const lineDir = isLineRTL(l) ? ' dir="rtl"' : '';
            return `<div${lineDir}>${content}</div>`;
        })
        .filter(c => c.length > 0)
        .join('');
    const boxStyles: string[] = [];
    if (borderBox.filled && borderBox.fillColor !== '#ffffff' && borderBox.fillColor !== '#fff') {
        boxStyles.push(`background-color:${borderBox.fillColor}`);
    }
    if (borderBox.stroked) {
        const bw = Math.max(1, Math.round(borderBox.lineWidth));
        boxStyles.push(`border:${bw}px solid ${borderBox.strokeColor}`);
    } else {
        boxStyles.push('border:1px solid #000');
    }
    boxStyles.push('padding:8px 12px', 'margin:8px 0', 'font-family:monospace', 'font-size:0.85em', 'overflow-x:auto', 'white-space:pre-wrap', 'width:100%', 'box-sizing:border-box');
    return `<div style="${boxStyles.join(';')}">${boxContent}</div>`;
}

function renderFooterLines(
    state: HtmlBuilderState, footerLines: TextLine[], underlinedItems: Set<TextItem>, bodyFont: string, bodySize: number,
): void {
    state.html.push('<hr style="border:none;border-top:1px solid #ccc;margin:1.5em 0 0.5em 0" />');
    const yGroups = groupFooterLinesByY(footerLines);
    state.html.push('<footer style="font-size:0.75em;color:#666">');
    for (const group of yGroups) {
        if (group.length === 1) {
            const content = lineToHtmlContentWithUnderlines(group[0], underlinedItems, bodyFont, bodySize, state.annotations);
            const rtl = isLineRTL(group[0]);
            const dirAttr = rtl ? ' dir="rtl"' : '';
            state.html.push(`<p${dirAttr} style="margin:0.15em 0;text-align:center">${content}</p>`);
        } else {
            const sorted = [...group].sort((a, b) => a.minX - b.minX);
            const parts = sorted.map(l =>
                lineToHtmlContentWithUnderlines(l, underlinedItems, bodyFont, bodySize, state.annotations));
            state.html.push(`<div style="display:flex;justify-content:space-between;margin:0.15em 0">`);
            for (const part of parts) {
                state.html.push(`<span>${part}</span>`);
            }
            state.html.push('</div>');
        }
    }
    state.html.push('</footer>');
}

interface HtmlBuilderContext {
    readonly lines: TextLine[];
    readonly mergedItems: TextItem[];
    readonly underlinedItems: Set<TextItem>;
    readonly structureMap: StructureMap;
    readonly allTableGrids: TableGrid[];
    readonly allBorderBoxes: PathRect[];
    readonly sortedImages: ImageItem[];
    readonly decorativeLines: PathRect[];
    readonly bodySize: number;
    readonly bodyFont: string;
    readonly pageWidth: number;
    readonly leftMargin: number;
    readonly rightMargin: number;
    readonly footerThreshold: number;
    readonly isRtlDoc: boolean;
}

function renderGridForLine(
    line: TextLine, state: HtmlBuilderState, ctx: HtmlBuilderContext,
    renderedGrids: Set<TableGrid>,
): void {
    const { allTableGrids, mergedItems, underlinedItems, bodySize, bodyFont } = ctx;
    const grid = allTableGrids.find(g => {
        if (line.items[0]?.page !== g.page) return false;
        return line.items.some(it => isItemInBounds(it, g.x - 5, g.y - 5, g.width + 10, g.height + 10));
    });
    if (grid && !renderedGrids.has(grid)) {
        flushParagraph(state);
        closeList(state);
        state.html.push(renderTableGrid(grid, mergedItems, underlinedItems, bodySize, bodyFont));
        renderedGrids.add(grid);
    }
}

function applyParagraphSpacing(state: HtmlBuilderState, lineSpacing: number, bodySize: number): void {
    if (lineSpacing <= 0) return;
    const baselineSpacing = state.lastLineSpacing > 0 ? state.lastLineSpacing : bodySize;
    const extraSpacing = lineSpacing - baselineSpacing;
    if (extraSpacing > 0) {
        const px = Math.min(extraSpacing, bodySize * 5);
        state.currentParagraphSpacingPx = Math.max(state.currentParagraphSpacingPx, px);
    }
}

function handleBorderBoxLine(
    line: TextLine, ctx: HtmlBuilderContext, state: HtmlBuilderState,
    renderedBorderBoxes: Set<PathRect>, borderBox: PathRect,
): void {
    if (!renderedBorderBoxes.has(borderBox)) {
        flushParagraph(state);
        closeList(state);
        const { lines, underlinedItems, bodyFont, bodySize } = ctx;
        state.html.push(renderBorderBoxToHtml(borderBox, lines, underlinedItems, bodyFont, bodySize, state.annotations));
        renderedBorderBoxes.add(borderBox);
    }
}

function detectParagraphBreak(line: TextLine, state: HtmlBuilderState, bodySize: number, lineSpacing: number): boolean {
    return state.lastY !== null &&
        line.items[0].page === state.lastPage &&
        (
            (state.lastLineSpacing > 0 &&
                lineSpacing > Math.min(state.lastLineSpacing, bodySize * 1.5) * 1.3) ||
            lineSpacing > bodySize * 1.5
        );
}

function applyInitialGapSpacing(state: HtmlBuilderState, lineSpacing: number, bodySize: number): void {
    if (state.lastLineSpacing === 0 && lineSpacing > 0 && state.lastY !== null) {
        const gap = lineSpacing - bodySize;
        if (gap > 0) {
            state.pendingMarginTopPt = Math.max(state.pendingMarginTopPt, gap);
        }
    }
}

function processRegularLine(
    line: TextLine, lineText: string, ctx: HtmlBuilderContext, state: HtmlBuilderState,
    renderedBorderBoxes: Set<PathRect>,
): void {
    const { underlinedItems, structureMap, allBorderBoxes, bodySize, bodyFont, pageWidth, leftMargin, rightMargin } = ctx;
    const borderBox = isLineInsideBorderBox(line, allBorderBoxes);
    if (borderBox) {
        handleBorderBoxLine(line, ctx, state, renderedBorderBoxes, borderBox);
        return;
    }

    const lineSpacing = state.lastY !== null && line.items[0].page === state.lastPage
        ? Math.abs(state.lastY - line.y) : 0;
    const isParagraphBreak = detectParagraphBreak(line, state, bodySize, lineSpacing);
    const isPageBreak = state.lastPage !== -1 && line.items[0].page !== state.lastPage;

    if (isParagraphBreak) {
        applyParagraphSpacing(state, lineSpacing, bodySize);
    } else {
        applyInitialGapSpacing(state, lineSpacing, bodySize);
    }

    const align = pageWidth > 0 ? detectTextAlignment(line, pageWidth, leftMargin, rightMargin) : '';
    if (align && state.currentParagraph.length === 0) {
        state.currentParagraphAlign = align;
    }

    processHtmlLineWithUnderlines(line, lineText, bodySize, bodyFont, state, { isParagraphBreak, isPageBreak, underlinedItems, structureMap, lineSpacing, bodySize });

    if (ctx.isRtlDoc && !state.currentParagraphRTL && hasRTLText(lineText)) {
        state.currentParagraphRTL = true;
    }

    if (lineSpacing > 0 && state.lastLineSpacing !== 0) state.lastLineSpacing = lineSpacing;
}

function processLinesToHtml(ctx: HtmlBuilderContext, state: HtmlBuilderState): TextLine[] {
    const { lines, allTableGrids, sortedImages, decorativeLines, footerThreshold } = ctx;
    const renderedGrids = new Set<TableGrid>();
    const renderedBorderBoxes = new Set<PathRect>();
    const footerLines: TextLine[] = [];
    let hrIdx = 0;

    for (const line of lines) {
        const lineText = lineToText(line);
        if (!lineText) continue;

        if (footerThreshold > 0 && line.items.every(it => it.y < footerThreshold)) {
            footerLines.push(line);
            continue;
        }

        insertImagesBeforeY(state, sortedImages, line.items[0].page, line.y);
        hrIdx = insertHrBeforeLine(state, decorativeLines, hrIdx, line.items[0].page, line.y);

        if (isLineInsideGrid(line, allTableGrids)) {
            renderGridForLine(line, state, ctx, renderedGrids);
            state.lastY = line.y;
            state.lastPage = line.items[0].page;
            continue;
        }

        processRegularLine(line, lineText, ctx, state, renderedBorderBoxes);
        state.lastY = line.y;
        state.lastPage = line.items[0].page;
    }

    return footerLines;
}

function isNearRTL(text: string, pos: number, dir: -1 | 1): boolean {
    const c1 = pos + dir >= 0 && pos + dir < text.length ? (text.codePointAt(pos + dir) ?? 0) : 0;
    if (isRTLChar(c1)) return true;
    if (c1 === 0x27 || c1 === 0x22) {
        const c2 = pos + dir * 2 >= 0 && pos + dir * 2 < text.length ? (text.codePointAt(pos + dir * 2) ?? 0) : 0;
        return isRTLChar(c2);
    }
    return false;
}

function mirrorBracketsAdjacentToRtl(text: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(' || ch === ')') {
            if (isNearRTL(text, i, -1) || isNearRTL(text, i, 1)) {
                result += ch === '(' ? ')' : '(';
                continue;
            }
        }
        result += ch;
    }
    return result;
}

function fixLtrLineItemInRtlDoc(item: TextItem): void {
    if (hasRTLText(item.text)) {
        item.text = fixVisualOrderRTL(item.text);
        item.text = fixBracketsAroundLtrWords(item.text);
        if (item.text.includes(' ')) {
            item.text = reverseRTLWordOrder(item.text);
            item.text = joinSplitHebrewFragments(item.text);
            item.text = fixSplitRoundBrackets(item.text);
        }
    } else if ((item.text.codePointAt(0) ?? 0) === 0x5D) {
        item.text = fixLeadingBracketsInLtrTokens([item.text])[0];
    }
}

function fixRtlLineItem(item: TextItem): void {
    if (!hasRTLText(item.text)) return;
    item.text = fixVisualOrderRTL(item.text);
    item.text = fixBracketsAroundLtrWords(item.text);
    if (item.text.includes(' ')) {
        item.text = reverseRTLWordOrder(item.text);
        item.text = joinSplitHebrewFragments(item.text);
    }
    item.text = mirrorBracketsAdjacentToRtl(item.text);
    item.text = fixSplitRoundBrackets(item.text);
}

function applyRtlWordFixes(rawLines: TextLine[]): void {
    const isRtlDoc = rawLines.some(line => isLineRTL(line));
    for (const line of rawLines) {
        if (!isLineRTL(line)) { applyLtrLineFixesIfRtlDoc(line, isRtlDoc); continue; }
        for (const item of line.items) fixRtlLineItem(item);
    }
}

function applyLtrLineFixesIfRtlDoc(line: TextLine, isRtlDoc: boolean): void {
    if (isRtlDoc) {
        for (const item of line.items) fixLtrLineItemInRtlDoc(item);
    }
}

function buildLayoutRects(
    pathRects: PathRect[], mergedItems: TextItem[],
): { underlinedItems: Set<TextItem>; allTableGrids: TableGrid[]; allBorderBoxes: PathRect[]; decorativeLines: PathRect[] } {
    const { underlinedItems, usedRects } = detectUnderlines(pathRects, mergedItems);
    const remainingRects = pathRects.filter(r => !usedRects.has(r));

    const pages = new Set(mergedItems.map(it => it.page));
    const allTableGrids: TableGrid[] = [];
    const allBorderBoxes: PathRect[] = [];
    for (const page of pages) {
        const grids = detectTableGrids(remainingRects, page);
        allTableGrids.push(...grids);
        const boxes = detectBorderBoxes(remainingRects, grids, page);
        allBorderBoxes.push(...mergeAdjacentBorderBoxes(boxes));
    }

    const tableGridRects = buildTableGridRects(allTableGrids, remainingRects, allBorderBoxes);
    const decorativeLines = remainingRects
        .filter(r => !tableGridRects.has(r) && r.height <= 3 && r.width > 50 && (r.stroked || r.filled)
            && !isLineNearBorderBox(r, allBorderBoxes))
        .sort((a, b) => a.page === b.page ? b.y - a.y : a.page - b.page);

    return { underlinedItems, allTableGrids, allBorderBoxes, decorativeLines };
}

function appendRemainingImages(state: HtmlBuilderState, sortedImages: ImageItem[]): void {
    while (state.imageIdx < sortedImages.length) {
        const img = sortedImages[state.imageIdx];
        const styles = [`width:${Math.round(img.renderWidth * 100) / 100}pt`, 'max-width:100%', 'height:auto'];
        if (state.lastY !== null && img.page === state.lastPage) {
            const imgTop = img.y + img.renderHeight;
            const gap = state.lastY - imgTop;
            if (gap > 0) styles.push(`margin-top:${Math.round(gap * 100) / 100}pt`);
        }
        state.html.push(`<img src="${img.dataUrl}" alt="Embedded image" style="${styles.join(';')}" />`);
        state.lastY = img.y;
        state.lastPage = img.page;
        state.imageIdx++;
    }
}

function textItemsToHtml(
    textItems: TextItem[],
    imageItems: ImageItem[],
    structureMap: StructureMap,
    pathRects: PathRect[] = [],
    pageWidth = 0,
    pageHeight = 0,
    annotations: PdfAnnotation[] = [],
): string {
    const mergedItems = mergeAdjacentChars(textItems);
    const rawLines = groupIntoLines(mergedItems);
    if (rawLines.length === 0) return '';

    applyRtlWordFixes(rawLines);

    const { lines, hasColumns } = detectColumns(rawLines);
    const bodySize = detectBodyFontSize(mergedItems);
    const bodyFont = detectBodyFont(mergedItems);

    const contentBounds = computeContentBounds(mergedItems);
    const leftMargin = pageWidth > 0 ? contentBounds.left : 0;
    const rightMargin = pageWidth > 0 ? contentBounds.right : pageWidth;

    const { underlinedItems, allTableGrids, allBorderBoxes, decorativeLines } = buildLayoutRects(pathRects, mergedItems);

    const sortedImages = [...imageItems].sort((a, b) =>
        a.page === b.page ? b.y - a.y : a.page - b.page
    );

    const state: HtmlBuilderState = {
        html: [], inBulletList: false, inNumberedList: false, inColumnLayout: false,
        currentParagraph: [], currentParagraphRTL: false,
        currentParagraphAlign: '', currentParagraphSpacingPx: 0, pendingMarginTopPt: 0,
        currentParagraphIndent: 0, currentParagraphLineXs: [], currentParagraphLineSpacings: [], currentParagraphBodySize: 0,
        lastY: null, lastPage: -1, lastLineSpacing: 0, imageIdx: 0,
        annotations, pageWidth, leftMargin, rightMargin,
    };

    const htmlCtx: HtmlBuilderContext = {
        lines, mergedItems, underlinedItems, structureMap, allTableGrids, allBorderBoxes,
        sortedImages, decorativeLines, bodySize, bodyFont, pageWidth, leftMargin, rightMargin,
        footerThreshold: pageHeight > 0 ? pageHeight * 0.1 : 0,
        isRtlDoc: lines.some(l => isLineRTL(l)),
    };

    const footerLines = processLinesToHtml(htmlCtx, state);

    flushParagraph(state);
    closeList(state);
    appendRemainingImages(state, sortedImages);

    if (footerLines.length > 0) {
        renderFooterLines(state, footerLines, underlinedItems, bodyFont, bodySize);
    }

    let result = state.html.join('\n');
    if (hasColumns) {
        result = `<div style="column-count:2;column-gap:2em">${result}</div>`;
    }
    return result;
}

// ── Structure tree parsing (tagged PDF) ─────────────────────────────────

interface StructureMcidEntry {
    readonly mcid: number;
    readonly page: number;
}

interface StructureNode {
    readonly type: string;
    readonly mcids: StructureMcidEntry[];
    readonly children: StructureNode[];
}

interface StructureMap {
    readonly mcidToType: Map<string, string>;
    readonly hasStructure: boolean;
}

function findPageIndexByDict(reader: PdfReader, dict: Record<string, PdfObject>, pages: PdfObject[]): number {
    for (let i = 0; i < pages.length; i++) {
        if (reader.getDict(pages[i]) === dict) return i;
    }
    return -1;
}

function resolvePageIndex(reader: PdfReader, pageRef: PdfObject | undefined, pages: PdfObject[]): number {
    if (!pageRef) return -1;
    const resolved = reader.resolveDeep(pageRef);
    if (resolved.type !== 'dict') return -1;
    const dict = resolved.value as Record<string, PdfObject>;
    if (reader.getString(dict['Type']) !== 'Page') return -1;
    return findPageIndexByDict(reader, dict, pages);
}

interface StructKDictOptions {
    readonly reader: PdfReader;
    readonly kDict: Record<string, PdfObject>;
    readonly pages: PdfObject[];
    readonly effectivePage: number;
    readonly depth: number;
    readonly mcids: StructureMcidEntry[];
    readonly children: StructureNode[];
    readonly elemRef: PdfObject;
}

function processStructKDict(opts: StructKDictOptions): void {
    const { reader, kDict, pages, effectivePage, depth, mcids, children, elemRef } = opts;
    const mcidObj = kDict['MCID'];
    if (mcidObj) {
        const mcidVal = reader.getNumber(mcidObj);
        const mcidPageRef = kDict['Pg'];
        const mcidPage = mcidPageRef ? resolvePageIndex(reader, mcidPageRef, pages) : effectivePage;
        mcids.push({ mcid: mcidVal, page: mcidPage >= 0 ? mcidPage : effectivePage });
    } else {
        const child = parseStructureElement(reader, elemRef, pages, effectivePage, depth + 1);
        if (child) children.push(child);
    }
}

function processStructKArrayItem(
    reader: PdfReader, item: PdfObject, pages: PdfObject[], effectivePage: number, depth: number,
    mcids: StructureMcidEntry[], children: StructureNode[],
): void {
    const itemResolved = reader.resolveDeep(item);
    if (itemResolved.type === 'number') {
        mcids.push({ mcid: itemResolved.value as number, page: effectivePage });
    } else if (itemResolved.type === 'dict') {
        const itemDict = itemResolved.value as Record<string, PdfObject>;
        processStructKDict({ reader, kDict: itemDict, pages, effectivePage, depth, mcids, children, elemRef: item });
    }
}

function parseStructureElement(
    reader: PdfReader, elemObj: PdfObject, pages: PdfObject[], parentPageIdx: number, depth: number,
): StructureNode | null {
    if (depth > 50) return null;
    const resolved = reader.resolveDeep(elemObj);
    if (resolved.type === 'number') {
        return { type: 'MCID', mcids: [{ mcid: resolved.value as number, page: parentPageIdx }], children: [] };
    }
    if (resolved.type !== 'dict') return null;
    const dict = resolved.value as Record<string, PdfObject>;
    const typeStr = reader.getString(dict['Type']);
    if (typeStr && typeStr !== 'StructElem') return null;

    const sType: string = reader.getString(dict['S']) || 'Span';
    const pageRef = dict['Pg'];
    const pageIdx = pageRef ? resolvePageIndex(reader, pageRef, pages) : parentPageIdx;
    const effectivePage = pageIdx >= 0 ? pageIdx : parentPageIdx;

    const kObj = dict['K'];
    const mcids: StructureMcidEntry[] = [];
    const children: StructureNode[] = [];

    if (!kObj) return { type: sType, mcids, children };

    const kResolved = reader.resolveDeep(kObj);

    if (kResolved.type === 'number') {
        mcids.push({ mcid: kResolved.value as number, page: effectivePage });
    } else if (kResolved.type === 'dict') {
        const kDict = kResolved.value as Record<string, PdfObject>;
        processStructKDict({ reader, kDict, pages, effectivePage, depth, mcids, children, elemRef: kResolved });
    } else if (kResolved.type === 'array') {
        for (const item of kResolved.value as PdfObject[]) {
            processStructKArrayItem(reader, item, pages, effectivePage, depth, mcids, children);
        }
    }

    return { type: sType, mcids, children };
}

function collectMcidTypes(node: StructureNode, result: Map<string, string>): void {
    for (const entry of node.mcids) {
        const key = `${entry.page}:${entry.mcid}`;
        if (!result.has(key)) {
            result.set(key, node.type);
        }
    }
    for (const child of node.children) {
        collectMcidTypes(child, result);
    }
}

function collectMcidTypesFromElement(
    reader: PdfReader, item: PdfObject, pages: PdfObject[], mcidToType: Map<string, string>,
): void {
    const node = parseStructureElement(reader, item, pages, 0, 0);
    if (node) collectMcidTypes(node, mcidToType);
}

function parseStructureTree(reader: PdfReader, pages: PdfObject[]): StructureMap {
    const emptyResult: StructureMap = { mcidToType: new Map(), hasStructure: false };
    try {
        const catalog = reader.getRoot();
        const structTreeRef = catalog['StructTreeRoot'];
        if (!structTreeRef) return emptyResult;

        const structTreeDict = reader.getDict(structTreeRef);
        const kObj = structTreeDict['K'];
        if (!kObj) return emptyResult;

        const mcidToType = new Map<string, string>();

        const kResolved = reader.resolveDeep(kObj);
        if (kResolved.type === 'array') {
            for (const item of kResolved.value as PdfObject[]) {
                collectMcidTypesFromElement(reader, item, pages, mcidToType);
            }
        } else {
            collectMcidTypesFromElement(reader, kObj, pages, mcidToType);
        }

        return { mcidToType, hasStructure: mcidToType.size > 0 };
    } catch {
        return emptyResult;
    }
}

function getStructureTypeForLine(line: TextLine, structureMap: StructureMap): string | null {
    if (!structureMap.hasStructure) return null;
    for (const item of line.items) {
        if (item.mcid < 0) continue;
        const key = `${item.page}:${item.mcid}`;
        const type = structureMap.mcidToType.get(key);
        if (type) return type;
    }
    return null;
}

function structureTypeToHeadingLevel(type: string): number {
    switch (type) {
        case 'H1': return 1;
        case 'H2': return 2;
        case 'H3': return 3;
        case 'H4': return 4;
        case 'H5': return 5;
        case 'H6': return 6;
        case 'H': return 1;
        default: return 0;
    }
}

function isStructureListItem(type: string): boolean {
    return type === 'LI' || type === 'LBody' || type === 'Lbl';
}

// ── Main export ─────────────────────────────────────────────────────────

export async function parsePdf(buffer: ArrayBuffer): Promise<PdfParseResult> {
    const header = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
    if (header.length < 5 ||
        header[0] !== 0x25 ||
        header[1] !== 0x50 ||
        header[2] !== 0x44 ||
        header[3] !== 0x46 ||
        header[4] !== 0x2D
    ) {
        throw new Error('Not a valid PDF file.');
    }

    const reader = new PdfReader(buffer);

    try {
        reader.parse();
    } catch {
        throw new Error('Unable to read this PDF. It may be corrupted or use an unsupported format.');
    }

    if (reader.isEncrypted()) {
        throw new Error('Encrypted PDFs are not supported.');
    }

    const pages = reader.getPages();
    if (pages.length === 0) {
        throw new Error('PDF contains no pages.');
    }

    const structureMap = parseStructureTree(reader, pages);

    const allTextItems: TextItem[] = [];
    const allImageItems: ImageItem[] = [];
    const allPathRects: PathRect[] = [];

    for (let i = 0; i < pages.length; i++) {
        try {
            const { textItems, imageItems, pathRects } = extractPageContent(reader, pages[i], i);
            allTextItems.push(...textItems);
            allImageItems.push(...imageItems);
            allPathRects.push(...pathRects);
        } catch {
            continue;
        }
    }

    const dedupedItems = deduplicateTextItems(allTextItems);
    return buildParsePdfResult(dedupedItems, allImageItems, allPathRects, structureMap);
}

function buildParsePdfResult(
    dedupedItems: TextItem[],
    allImageItems: ImageItem[],
    allPathRects: PathRect[],
    structureMap: StructureMap,
): PdfParseResult {
    if (dedupedItems.length === 0 && allImageItems.length > 0) {
        allImageItems.sort((a, b) => a.page === b.page ? b.y - a.y : a.page - b.page);
        const imgTags = allImageItems
            .map(img => `<img src="${img.dataUrl}" alt="Page image" style="width:${Math.round(img.renderWidth * 100) / 100}pt;max-width:100%;height:auto" />`)
            .join('\n');
        return { html: imgTags, text: '', imageOnly: true };
    }
    if (dedupedItems.length === 0) throw new Error('No readable content found in PDF.');
    const html = textItemsToHtml(dedupedItems, allImageItems, structureMap, allPathRects);
    dedupedItems.sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
        return a.x - b.x;
    });
    const plainText = dedupedItems.map(item => item.text).join(' ').replaceAll(/\s+/g, ' ').trim();
    return { html, text: plainText, imageOnly: false };
}

// ── Paged PDF parsing ───────────────────────────────────────────────────

export interface PdfPageResult {
    readonly html: string;
    readonly text: string;
    readonly imageOnly: boolean;
    readonly pageIndex: number;
    readonly pageWidth: number;
    readonly pageHeight: number;
    readonly bodyFontSize: number;
    readonly contentLeft: number;
    readonly contentRight: number;
}

export interface PdfOutlineItem {
    readonly title: string;
    readonly pageIndex: number;
    readonly children: ReadonlyArray<PdfOutlineItem>;
}

export interface PdfParseResultPaged {
    readonly pages: ReadonlyArray<PdfPageResult>;
    readonly totalPages: number;
    readonly html: string;
    readonly text: string;
    readonly imageOnly: boolean;
    readonly outline: ReadonlyArray<PdfOutlineItem>;
}

interface BuildPageResultOptions {
    readonly pageIndex: number;
    readonly structureMap: StructureMap;
    readonly pageWidth: number;
    readonly pageHeight: number;
    readonly annotations?: PdfAnnotation[];
}

function buildPageResult(
    pageTextItems: TextItem[], pageImageItems: ImageItem[], pagePathRects: PathRect[],
    options: BuildPageResultOptions,
): PdfPageResult {
    const { pageIndex, structureMap, pageWidth, pageHeight, annotations = [] } = options;
    const deduped = deduplicateTextItems(pageTextItems);

    if (deduped.length === 0 && pageImageItems.length > 0) {
        const sortedImages = [...pageImageItems].sort((a, b) => b.y - a.y);
        const imgTags = sortedImages
            .map(img => {
                return `<img src="${img.dataUrl}" alt="Page image" style="width:${Math.round(img.renderWidth * 100) / 100}pt;max-width:100%;height:auto" />`;
            })
            .join('\n');
        return { html: imgTags, text: '', imageOnly: true, pageIndex, pageWidth, pageHeight, bodyFontSize: 12, contentLeft: 0, contentRight: pageWidth };
    }

    if (deduped.length === 0) {
        return { html: '', text: '', imageOnly: false, pageIndex, pageWidth, pageHeight, bodyFontSize: 12, contentLeft: 0, contentRight: pageWidth };
    }

    const bodyFontSize = detectBodyFontSize(deduped);
    const bounds = computeContentBounds(deduped);
    const html = textItemsToHtml(deduped, pageImageItems, structureMap, pagePathRects, pageWidth, pageHeight, annotations);
    const sorted = [...deduped].sort((a, b) => {
        if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
        return a.x - b.x;
    });
    const text = sorted.map(item => item.text).join(' ').replaceAll(/\s+/g, ' ').trim();

    return { html, text, imageOnly: false, pageIndex, pageWidth, pageHeight, bodyFontSize, contentLeft: bounds.left, contentRight: bounds.right };
}

function extractAllPages(
    reader: PdfReader, pdfPages: PdfObject[], structureMap: StructureMap,
): { pages: PdfPageResult[]; allTextParts: string[]; allHtmlParts: string[]; allImageOnly: boolean } {
    const pages: PdfPageResult[] = [];
    const allTextParts: string[] = [];
    const allHtmlParts: string[] = [];
    let allImageOnly = true;

    for (let i = 0; i < pdfPages.length; i++) {
        try {
            const { textItems, imageItems, pathRects, pageWidth, pageHeight, annotations } = extractPageContent(reader, pdfPages[i], i);
            const pageResult = buildPageResult(textItems, imageItems, pathRects, { pageIndex: i, structureMap, pageWidth, pageHeight, annotations });
            pages.push(pageResult);
            if (pageResult.html) allHtmlParts.push(pageResult.html);
            if (pageResult.text) allTextParts.push(pageResult.text);
            if (!pageResult.imageOnly || pageResult.text) allImageOnly = false;
        } catch {
            pages.push({ html: '', text: '', imageOnly: false, pageIndex: i, pageWidth: 612, pageHeight: 792, bodyFontSize: 12, contentLeft: 0, contentRight: 612 });
        }
    }
    return { pages, allTextParts, allHtmlParts, allImageOnly };
}

export async function parsePdfPaged(buffer: ArrayBuffer): Promise<PdfParseResultPaged> {
    const header = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
    if (header.length < 5 ||
        header[0] !== 0x25 || header[1] !== 0x50 || header[2] !== 0x44 ||
        header[3] !== 0x46 || header[4] !== 0x2D
    ) {
        throw new Error('Not a valid PDF file.');
    }

    const reader = new PdfReader(buffer);
    try {
        reader.parse();
    } catch {
        throw new Error('Unable to read this PDF. It may be corrupted or use an unsupported format.');
    }

    if (reader.isEncrypted()) {
        throw new Error('Encrypted PDFs are not supported.');
    }

    const pdfPages = reader.getPages();
    if (pdfPages.length === 0) {
        throw new Error('PDF contains no pages.');
    }

    const structureMap = parseStructureTree(reader, pdfPages);

    const { pages, allTextParts, allHtmlParts, allImageOnly } = extractAllPages(reader, pdfPages, structureMap);
    const outline = parseOutline(reader, pdfPages);

    return {
        pages,
        totalPages: pages.length,
        html: allHtmlParts.join('\n'),
        text: allTextParts.join(' '),
        imageOnly: allImageOnly && pages.length > 0,
        outline,
    };
}

function parseOutline(reader: PdfReader, pdfPages: PdfObject[]): PdfOutlineItem[] {
    try {
        const root = reader.getRoot();
        const outlinesRef = root['Outlines'];
        if (!outlinesRef) return [];
        const outlinesDict = reader.getDict(outlinesRef);
        const firstRef = outlinesDict['First'];
        if (!firstRef) return [];
        const pageMap = buildPageObjNumMap(reader, pdfPages);
        return parseOutlineItems(reader, firstRef, pageMap, 0);
    } catch {
        return [];
    }
}

function buildPageObjNumMap(reader: PdfReader, pdfPages: PdfObject[]): Map<string, number> {
    const map = new Map<string, number>();
    for (let i = 0; i < pdfPages.length; i++) {
        const page = pdfPages[i];
        if (page.type === 'ref') {
            map.set(page.value as string, i);
        }
    }
    return map;
}

function resolveRefArrayPageIndex(reader: PdfReader, destObj: PdfObject, pageMap: Map<string, number>): number {
    const resolved = reader.resolveDeep(destObj);
    if (resolved.type === 'array') {
        const arr = resolved.value as PdfObject[];
        if (arr.length > 0 && arr[0].type === 'ref') {
            return pageMap.get(arr[0].value as string) ?? -1;
        }
    }
    return -1;
}

function resolveOutlinePageIndex(reader: PdfReader, item: Record<string, PdfObject>, pageMap: Map<string, number>): number {
    const dest = item['Dest'];
    if (dest) {
        const resolved = reader.resolveDeep(dest);
        if (resolved.type === 'string') return -1;
        const idx = resolveRefArrayPageIndex(reader, dest, pageMap);
        if (idx >= 0) return idx;
    }
    const aObj = item['A'];
    if (!aObj) return -1;
    try {
        const action = reader.getDict(aObj);
        const s = reader.getString(action['S'] ?? { type: 'null', value: null });
        if (s !== 'GoTo') return -1;
        const d = action['D'];
        return d ? resolveRefArrayPageIndex(reader, d, pageMap) : -1;
    } catch { return -1; }
}

function parseOutlineItems(reader: PdfReader, firstRef: PdfObject, pageMap: Map<string, number>, depth: number): PdfOutlineItem[] {
    if (depth > 10) return [];
    const items: PdfOutlineItem[] = [];
    const visited = new Set<string>();
    let currentRef: PdfObject | null = firstRef;

    while (currentRef) {
        const key = currentRef.type === 'ref' ? currentRef.value as string : '';
        if (key && visited.has(key)) break;
        if (key) visited.add(key);

        try {
            const itemDict = reader.getDict(currentRef);
            const title = reader.getString(itemDict['Title'] ?? { type: 'string', value: '' });
            const pageIndex = resolveOutlinePageIndex(reader, itemDict, pageMap);

            let children: PdfOutlineItem[] = [];
            const childFirst = itemDict['First'];
            if (childFirst) {
                children = parseOutlineItems(reader, childFirst, pageMap, depth + 1);
            }

            items.push({ title, pageIndex, children });

            const nextRef = itemDict['Next'];
            currentRef = nextRef ?? null;
        } catch {
            break;
        }
    }
    return items;
}
