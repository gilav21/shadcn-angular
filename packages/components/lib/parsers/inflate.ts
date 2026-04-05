const LENGTH_EXTRA_BITS = [
    0,0,0,0,0,0,0,0, 1,1,1,1, 2,2,2,2, 3,3,3,3, 4,4,4,4, 5,5,5,5, 0
];
const LENGTH_BASE = [
    3,4,5,6,7,8,9,10, 11,13,15,17, 19,23,27,31, 35,43,51,59,
    67,83,99,115, 131,163,195,227, 258
];
const DIST_EXTRA_BITS = [
    0,0,0,0, 1,1,2,2, 3,3,4,4, 5,5,6,6, 7,7,8,8, 9,9,10,10, 11,11,12,12, 13,13
];
const DIST_BASE = [
    1,2,3,4, 5,7,9,13, 17,25,33,49, 65,97,129,193,
    257,385,513,769, 1025,1537,2049,3073, 4097,6145,8193,12289, 16385,24577
];
const CL_ORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

class BitReader {
    private readonly data: Uint8Array;
    private pos = 0;
    private bitBuf = 0;
    private bitCount = 0;

    constructor(data: Uint8Array) {
        this.data = data;
    }

    bits(n: number): number {
        while (this.bitCount < n) {
            if (this.pos >= this.data.length) throw new Error('Unexpected end of deflate stream');
            this.bitBuf |= this.data[this.pos++] << this.bitCount;
            this.bitCount += 8;
        }
        const val = this.bitBuf & ((1 << n) - 1);
        this.bitBuf >>>= n;
        this.bitCount -= n;
        return val;
    }

    alignByte(): void {
        this.bitBuf = 0;
        this.bitCount = 0;
    }

    readByte(): number {
        if (this.pos >= this.data.length) throw new Error('Unexpected end of deflate stream');
        return this.data[this.pos++];
    }

    readU16LE(): number {
        const lo = this.readByte();
        const hi = this.readByte();
        return lo | (hi << 8);
    }
}

interface HuffmanTable {
    readonly counts: Uint16Array;
    readonly symbols: Uint16Array;
}

function buildHuffmanTable(codeLengths: Uint8Array, maxSymbol: number): HuffmanTable {
    let maxBits = 0;
    for (let i = 0; i < maxSymbol; i++) {
        if (codeLengths[i] > maxBits) maxBits = codeLengths[i];
    }
    const counts = new Uint16Array(maxBits + 1);
    for (let i = 0; i < maxSymbol; i++) {
        if (codeLengths[i]) counts[codeLengths[i]]++;
    }
    const offsets = new Uint16Array(maxBits + 1);
    for (let i = 1; i <= maxBits; i++) {
        offsets[i] = offsets[i - 1] + counts[i - 1];
    }
    const symbols = new Uint16Array(offsets[maxBits] + counts[maxBits]);
    for (let i = 0; i < maxSymbol; i++) {
        if (codeLengths[i]) {
            symbols[offsets[codeLengths[i]]++] = i;
        }
    }
    return { counts, symbols };
}

function decodeSymbol(reader: BitReader, table: HuffmanTable): number {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < table.counts.length; len++) {
        code |= reader.bits(1);
        const count = table.counts[len];
        if (code < first + count) {
            return table.symbols[index + (code - first)];
        }
        index += count;
        first = (first + count) << 1;
        code <<= 1;
    }
    throw new Error('Invalid Huffman code');
}

function buildFixedLitTable(): HuffmanTable {
    const lengths = new Uint8Array(288);
    for (let i = 0; i <= 143; i++) lengths[i] = 8;
    for (let i = 144; i <= 255; i++) lengths[i] = 9;
    for (let i = 256; i <= 279; i++) lengths[i] = 7;
    for (let i = 280; i <= 287; i++) lengths[i] = 8;
    return buildHuffmanTable(lengths, 288);
}

function buildFixedDistTable(): HuffmanTable {
    const lengths = new Uint8Array(32);
    for (let i = 0; i < 32; i++) lengths[i] = 5;
    return buildHuffmanTable(lengths, 32);
}

const FIXED_LIT_TABLE = buildFixedLitTable();
const FIXED_DIST_TABLE = buildFixedDistTable();

function inflateStoredBlock(reader: BitReader, output: number[]): void {
    reader.alignByte();
    const len = reader.readU16LE();
    reader.readU16LE();
    for (let i = 0; i < len; i++) {
        output.push(reader.readByte());
    }
}

function fillRepeatLengths(allLengths: Uint8Array, startIdx: number, count: number, value: number): number {
    let idx = startIdx;
    for (let r = 0; r < count; r++) {
        allLengths[idx++] = value;
    }
    return idx;
}

function decodeLengthSymbol(reader: BitReader, clTable: HuffmanTable, allLengths: Uint8Array, idx: number): number {
    const sym = decodeSymbol(reader, clTable);
    if (sym < 16) {
        allLengths[idx++] = sym;
        return idx;
    }
    if (sym === 16) {
        const rep = reader.bits(2) + 3;
        const prev = idx > 0 ? allLengths[idx - 1] : 0;
        return fillRepeatLengths(allLengths, idx, rep, prev);
    }
    const rep = sym === 17 ? reader.bits(3) + 3 : reader.bits(7) + 11;
    return fillRepeatLengths(allLengths, idx, rep, 0);
}

function buildDynamicTables(reader: BitReader): { litTable: HuffmanTable; distTable: HuffmanTable } {
    const hlit = reader.bits(5) + 257;
    const hdist = reader.bits(5) + 1;
    const hclen = reader.bits(4) + 4;
    const clLengths = new Uint8Array(19);
    for (let i = 0; i < hclen; i++) {
        clLengths[CL_ORDER[i]] = reader.bits(3);
    }
    const clTable = buildHuffmanTable(clLengths, 19);
    const allLengths = new Uint8Array(hlit + hdist);
    let i = 0;
    while (i < hlit + hdist) {
        i = decodeLengthSymbol(reader, clTable, allLengths, i);
    }
    const litLengths = allLengths.slice(0, hlit);
    const distLengths = allLengths.slice(hlit);
    return {
        litTable: buildHuffmanTable(litLengths, hlit),
        distTable: buildHuffmanTable(distLengths, hdist),
    };
}

function inflateCompressedBlock(reader: BitReader, output: number[], litTable: HuffmanTable, distTable: HuffmanTable): void {
    while (true) {
        const sym = decodeSymbol(reader, litTable);
        if (sym === 256) break;
        if (sym < 256) {
            output.push(sym);
            continue;
        }
        const lengthIdx = sym - 257;
        const length = LENGTH_BASE[lengthIdx] + reader.bits(LENGTH_EXTRA_BITS[lengthIdx]);
        const distSym = decodeSymbol(reader, distTable);
        const distance = DIST_BASE[distSym] + reader.bits(DIST_EXTRA_BITS[distSym]);
        const start = output.length - distance;
        for (let j = 0; j < length; j++) {
            output.push(output[start + j]);
        }
    }
}

export function inflate(compressed: Uint8Array): Uint8Array {
    const reader = new BitReader(compressed);
    const output: number[] = [];
    let finalBlock = false;

    while (!finalBlock) {
        finalBlock = reader.bits(1) === 1;
        const blockType = reader.bits(2);

        if (blockType === 0) {
            inflateStoredBlock(reader, output);
        } else if (blockType === 1) {
            inflateCompressedBlock(reader, output, FIXED_LIT_TABLE, FIXED_DIST_TABLE);
        } else if (blockType === 2) {
            const { litTable, distTable } = buildDynamicTables(reader);
            inflateCompressedBlock(reader, output, litTable, distTable);
        } else {
            throw new Error('Invalid deflate block type');
        }
    }

    return new Uint8Array(output);
}

export function zlibInflate(data: Uint8Array): Uint8Array {
    if (data.length < 2) return data;
    const cmf = data[0];
    const cm = cmf & 0x0f;
    if (cm !== 8) return inflate(data);
    return inflate(data.subarray(2));
}
