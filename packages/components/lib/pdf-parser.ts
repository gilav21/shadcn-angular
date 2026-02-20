export interface PdfParseResult {
    html: string;
    text: string;
    imageOnly: boolean;
}

interface TextItem {
    text: string;
    fontSize: number;
    x: number;
    y: number;
    endX: number;
    page: number;
    color: string;
}

interface FontInfo {
    isTwoByte: boolean;
    widths: Map<number, number>;
    defaultWidth: number;
    toUnicode: Map<number, string>;
}

interface ImageItem {
    dataUrl: string;
    width: number;
    height: number;
    x: number;
    y: number;
    page: number;
}

interface PdfObject {
    type: 'dict' | 'array' | 'number' | 'string' | 'name' | 'boolean' | 'null' | 'ref' | 'stream';
    value: unknown;
    stream?: Uint8Array;
}

interface XRefEntry {
    offset: number;
    gen: number;
    free: boolean;
}

// ── Deflate / Inflate (RFC 1951) ────────────────────────────────────────

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
    private data: Uint8Array;
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
    counts: Uint16Array;
    symbols: Uint16Array;
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

function inflate(compressed: Uint8Array): Uint8Array {
    const reader = new BitReader(compressed);
    const output: number[] = [];
    let finalBlock = false;

    while (!finalBlock) {
        finalBlock = reader.bits(1) === 1;
        const blockType = reader.bits(2);

        if (blockType === 0) {
            reader.alignByte();
            const len = reader.readU16LE();
            reader.readU16LE();
            for (let i = 0; i < len; i++) {
                output.push(reader.readByte());
            }
        } else if (blockType === 1 || blockType === 2) {
            let litTable: HuffmanTable;
            let distTable: HuffmanTable;

            if (blockType === 1) {
                litTable = FIXED_LIT_TABLE;
                distTable = FIXED_DIST_TABLE;
            } else {
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
                    const sym = decodeSymbol(reader, clTable);
                    if (sym < 16) {
                        allLengths[i++] = sym;
                    } else if (sym === 16) {
                        const rep = reader.bits(2) + 3;
                        const prev = i > 0 ? allLengths[i - 1] : 0;
                        for (let r = 0; r < rep; r++) allLengths[i++] = prev;
                    } else if (sym === 17) {
                        const rep = reader.bits(3) + 3;
                        for (let r = 0; r < rep; r++) allLengths[i++] = 0;
                    } else {
                        const rep = reader.bits(7) + 11;
                        for (let r = 0; r < rep; r++) allLengths[i++] = 0;
                    }
                }
                const litLengths = allLengths.slice(0, hlit);
                const distLengths = allLengths.slice(hlit);
                litTable = buildHuffmanTable(litLengths, hlit);
                distTable = buildHuffmanTable(distLengths, hdist);
            }

            while (true) {
                const sym = decodeSymbol(reader, litTable);
                if (sym === 256) break;
                if (sym < 256) {
                    output.push(sym);
                } else {
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
        } else {
            throw new Error('Invalid deflate block type');
        }
    }

    return new Uint8Array(output);
}

function zlibInflate(data: Uint8Array): Uint8Array {
    if (data.length < 2) return data;
    const cmf = data[0];
    const cm = cmf & 0x0f;
    if (cm !== 8) return inflate(data);
    return inflate(data.subarray(2));
}

// ── PDF structure parser ────────────────────────────────────────────────

class PdfReader {
    private data: Uint8Array;
    private text: string;
    private objects: Map<string, { offset: number; gen: number }> = new Map();
    private parsedObjects: Map<string, PdfObject> = new Map();
    private trailer: Record<string, PdfObject> | null = null;

    constructor(buffer: ArrayBuffer) {
        this.data = new Uint8Array(buffer);
        this.text = new TextDecoder('latin1').decode(this.data);
    }

    parse(): void {
        this.findXRef();
    }

    private findXRef(): void {
        const lastChunk = this.text.slice(-1024);
        const match = lastChunk.match(/startxref\s+(\d+)/);
        if (!match) throw new Error('Could not find startxref in PDF');
        const xrefOffset = parseInt(match[1], 10);

        if (this.text.substring(xrefOffset, xrefOffset + 4) === 'xref') {
            this.parseTraditionalXRef(xrefOffset);
        } else {
            this.parseXRefStream(xrefOffset);
        }
    }

    private parseTraditionalXRef(offset: number): void {
        let pos = offset + 4;
        pos = this.skipWhitespace(pos);

        while (pos < this.text.length) {
            if (this.text.substring(pos, pos + 7) === 'trailer') break;

            const headerMatch = this.text.substring(pos).match(/^(\d+)\s+(\d+)/);
            if (!headerMatch) break;
            const startObj = parseInt(headerMatch[1], 10);
            const count = parseInt(headerMatch[2], 10);
            pos += headerMatch[0].length;
            pos = this.skipWhitespace(pos);

            for (let i = 0; i < count; i++) {
                const entryStr = this.text.substring(pos, pos + 20);
                const entryMatch = entryStr.match(/(\d{10})\s+(\d{5})\s+([fn])/);
                if (entryMatch) {
                    const entryOffset = parseInt(entryMatch[1], 10);
                    const gen = parseInt(entryMatch[2], 10);
                    const isFree = entryMatch[3] === 'f';
                    if (!isFree) {
                        const key = `${startObj + i} ${gen}`;
                        if (!this.objects.has(key)) {
                            this.objects.set(key, { offset: entryOffset, gen });
                        }
                    }
                }
                pos += 20;
                while (pos < this.text.length && (this.text[pos] === '\r' || this.text[pos] === '\n' || this.text[pos] === ' ')) pos++;
            }
        }

        const trailerPos = this.text.indexOf('trailer', offset);
        if (trailerPos !== -1) {
            const dictStart = this.text.indexOf('<<', trailerPos);
            if (dictStart !== -1) {
                const result = this.parseObjectAt(dictStart);
                if (result.obj.type === 'dict') {
                    this.trailer = result.obj.value as Record<string, PdfObject>;
                    const prev = this.trailer['Prev'];
                    if (prev && prev.type === 'number') {
                        this.parseTraditionalXRef(prev.value as number);
                    }
                }
            }
        }
    }

    private parseXRefStream(offset: number): void {
        const result = this.parseObjectAt(offset);
        const obj = result.obj;
        if (obj.type !== 'stream') throw new Error('Expected xref stream');
        const dict = obj.value as Record<string, PdfObject>;
        const streamData = obj.stream!;

        if (this.trailer === null) {
            this.trailer = dict;
        }

        const wArr = dict['W'];
        if (!wArr || wArr.type !== 'array') throw new Error('Missing /W in xref stream');
        const w = (wArr.value as PdfObject[]).map(o => o.value as number);
        const entrySize = w[0] + w[1] + w[2];

        let indexArr: number[];
        const indexObj = dict['Index'];
        if (indexObj && indexObj.type === 'array') {
            indexArr = (indexObj.value as PdfObject[]).map(o => o.value as number);
        } else {
            const sizeObj = dict['Size'];
            indexArr = [0, sizeObj ? sizeObj.value as number : 0];
        }

        const decoded = this.decodeStreamData(dict, streamData);
        let bytePos = 0;

        for (let s = 0; s < indexArr.length; s += 2) {
            const startObj = indexArr[s];
            const count = indexArr[s + 1];
            for (let i = 0; i < count; i++) {
                if (bytePos + entrySize > decoded.length) break;
                let fieldType = 1;
                if (w[0] > 0) {
                    fieldType = 0;
                    for (let b = 0; b < w[0]; b++) fieldType = (fieldType << 8) | decoded[bytePos + b];
                }
                let field2 = 0;
                for (let b = 0; b < w[1]; b++) field2 = (field2 << 8) | decoded[bytePos + w[0] + b];
                let field3 = 0;
                for (let b = 0; b < w[2]; b++) field3 = (field3 << 8) | decoded[bytePos + w[0] + w[1] + b];
                bytePos += entrySize;

                if (fieldType === 1) {
                    const key = `${startObj + i} ${field3}`;
                    if (!this.objects.has(key)) {
                        this.objects.set(key, { offset: field2, gen: field3 });
                    }
                }
            }
        }

        const prev = dict['Prev'];
        if (prev && prev.type === 'number') {
            const prevOffset = prev.value as number;
            if (this.text.substring(prevOffset, prevOffset + 4) === 'xref') {
                this.parseTraditionalXRef(prevOffset);
            } else {
                this.parseXRefStream(prevOffset);
            }
        }
    }

    private skipWhitespace(pos: number): number {
        while (pos < this.text.length && ' \t\r\n\0\f'.includes(this.text[pos])) pos++;
        return pos;
    }

    private parseObjectAt(offset: number): { obj: PdfObject; endPos: number } {
        let pos = offset;
        pos = this.skipWhitespace(pos);

        const objHeaderMatch = this.text.substring(pos).match(/^(\d+)\s+(\d+)\s+obj\s*/);
        if (objHeaderMatch) {
            pos += objHeaderMatch[0].length;
        }

        const result = this.parseValue(pos);
        pos = result.endPos;
        pos = this.skipWhitespace(pos);

        if (this.text.substring(pos, pos + 6) === 'stream') {
            pos += 6;
            if (this.text[pos] === '\r') pos++;
            if (this.text[pos] === '\n') pos++;

            const dict = result.obj.value as Record<string, PdfObject>;
            const lengthObj = dict['Length'];
            let streamLength = 0;
            if (lengthObj) {
                if (lengthObj.type === 'ref') {
                    const resolved = this.resolveRef(lengthObj);
                    streamLength = resolved.value as number;
                } else {
                    streamLength = lengthObj.value as number;
                }
            }

            if (streamLength <= 0 || pos + streamLength > this.data.length) {
                const endIdx = this.text.indexOf('endstream', pos);
                if (endIdx !== -1) streamLength = endIdx - pos;
                else streamLength = 0;
            }

            const streamData = this.data.slice(pos, pos + streamLength);
            pos += streamLength;

            return {
                obj: { type: 'stream', value: dict, stream: streamData },
                endPos: pos,
            };
        }

        return result;
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

        const numMatch = this.text.substring(pos).match(/^([+-]?\d+\.?\d*|[+-]?\.\d+)/);
        if (numMatch) {
            const num = parseFloat(numMatch[1]);
            const afterNum = pos + numMatch[0].length;
            const refMatch = this.text.substring(afterNum).match(/^\s+(\d+)\s+R/);
            if (refMatch) {
                const gen = parseInt(refMatch[1], 10);
                return {
                    obj: { type: 'ref', value: `${Math.floor(num)} ${gen}` },
                    endPos: afterNum + refMatch[0].length,
                };
            }
            return { obj: { type: 'number', value: num }, endPos: afterNum };
        }

        return { obj: { type: 'null', value: null }, endPos: pos + 1 };
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
                name += String.fromCharCode(parseInt(this.text.substring(pos + 1, pos + 3), 16));
                pos += 3;
            } else {
                name += c;
                pos++;
            }
        }
        return { obj: { type: 'name', value: name }, endPos: pos };
    }

    private parseLiteralString(pos: number): { obj: PdfObject; endPos: number } {
        pos += 1;
        let str = '';
        let depth = 1;
        while (pos < this.text.length && depth > 0) {
            const c = this.text[pos];
            if (c === '\\' && pos + 1 < this.text.length) {
                pos++;
                const esc = this.text[pos];
                if (esc === 'n') str += '\n';
                else if (esc === 'r') str += '\r';
                else if (esc === 't') str += '\t';
                else if (esc === 'b') str += '\b';
                else if (esc === 'f') str += '\f';
                else if (esc === '(') str += '(';
                else if (esc === ')') str += ')';
                else if (esc === '\\') str += '\\';
                else if (esc >= '0' && esc <= '7') {
                    let octal = esc;
                    if (pos + 1 < this.text.length && this.text[pos + 1] >= '0' && this.text[pos + 1] <= '7') {
                        pos++;
                        octal += this.text[pos];
                        if (pos + 1 < this.text.length && this.text[pos + 1] >= '0' && this.text[pos + 1] <= '7') {
                            pos++;
                            octal += this.text[pos];
                        }
                    }
                    str += String.fromCharCode(parseInt(octal, 8));
                } else {
                    str += esc;
                }
                pos++;
            } else if (c === '(') {
                depth++;
                str += c;
                pos++;
            } else if (c === ')') {
                depth--;
                if (depth > 0) str += c;
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
            str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
        }
        return { obj: { type: 'string', value: str }, endPos: pos };
    }

    resolveRef(obj: PdfObject): PdfObject {
        if (obj.type !== 'ref') return obj;
        const key = obj.value as string;
        if (this.parsedObjects.has(key)) return this.parsedObjects.get(key)!;

        const entry = this.objects.get(key);
        if (!entry) return { type: 'null', value: null };

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

    decodeStreamData(dict: Record<string, PdfObject>, rawStream: Uint8Array): Uint8Array {
        const filterObj = dict['Filter'];
        if (!filterObj) return rawStream;

        const resolved = this.resolveDeep(filterObj);
        const filters: string[] = [];
        if (resolved.type === 'name') {
            filters.push(resolved.value as string);
        } else if (resolved.type === 'array') {
            for (const f of resolved.value as PdfObject[]) {
                const rf = this.resolveDeep(f);
                if (rf.type === 'name') filters.push(rf.value as string);
            }
        }

        let result = rawStream;
        for (const filter of filters) {
            if (filter === 'FlateDecode' || filter === 'Fl') {
                try {
                    result = zlibInflate(result);
                } catch {
                    return rawStream;
                }
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

    getRoot(): Record<string, PdfObject> {
        const trailer = this.getTrailer();
        const rootRef = trailer['Root'];
        if (!rootRef) return {};
        return this.getDict(rootRef);
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

        if (typeName === 'Page') return [this.resolveDeep(node)];

        const kids = dict['Kids'];
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

function pdfStringToUnicode(
    raw: string,
    fontInfo?: FontInfo,
): { text: string; charCodes: number[] } {
    let result = '';
    const charCodes: number[] = [];

    if (fontInfo?.isTwoByte) {
        for (let i = 0; i + 1 < raw.length; i += 2) {
            const code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
            charCodes.push(code);
            if (fontInfo.toUnicode.has(code)) {
                result += fontInfo.toUnicode.get(code)!;
            } else if (code >= 0x20 && code < 0xFFFE) {
                result += String.fromCodePoint(code);
            } else {
                result += '\uFFFD';
            }
        }
        if (raw.length % 2 === 1) {
            const code = raw.charCodeAt(raw.length - 1);
            charCodes.push(code);
            if (fontInfo.toUnicode.has(code)) {
                result += fontInfo.toUnicode.get(code)!;
            } else {
                result += String.fromCharCode(code);
            }
        }
    } else {
        const toUnicode = fontInfo?.toUnicode;
        for (let i = 0; i < raw.length; i++) {
            const code = raw.charCodeAt(i);
            charCodes.push(code);
            if (toUnicode && toUnicode.has(code)) {
                result += toUnicode.get(code)!;
            } else if (PDF_DOC_ENCODING[code]) {
                result += PDF_DOC_ENCODING[code];
            } else {
                result += raw[i];
            }
        }
    }

    return { text: result, charCodes };
}

function parseToUnicodeMap(data: Uint8Array): Map<number, string> {
    const map = new Map<number, string>();
    const text = new TextDecoder('latin1').decode(data);

    const bfCharRe = /beginbfchar\s+([\s\S]*?)endbfchar/g;
    let match: RegExpExecArray | null;
    while ((match = bfCharRe.exec(text)) !== null) {
        const entries = match[1].trim().split('\n');
        for (const entry of entries) {
            const parts = entry.trim().match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
            if (parts) {
                const srcCode = parseInt(parts[1], 16);
                const dstHex = parts[2];
                let dstStr = '';
                for (let i = 0; i < dstHex.length; i += 4) {
                    dstStr += String.fromCharCode(parseInt(dstHex.substring(i, i + 4), 16));
                }
                map.set(srcCode, dstStr);
            }
        }
    }

    const bfRangeRe = /beginbfrange\s+([\s\S]*?)endbfrange/g;
    while ((match = bfRangeRe.exec(text)) !== null) {
        const entries = match[1].trim().split('\n');
        for (const entry of entries) {
            const parts = entry.trim().match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
            if (parts) {
                const start = parseInt(parts[1], 16);
                const end = parseInt(parts[2], 16);
                let dstStart = parseInt(parts[3], 16);
                for (let code = start; code <= end; code++) {
                    map.set(code, String.fromCharCode(dstStart++));
                }
            }
        }
    }

    return map;
}

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
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
        if (isRTLChar(text.charCodeAt(i))) return true;
    }
    return false;
}

function fixVisualOrderRTL(text: string): string {
    if (!hasRTLText(text)) return text;

    const chars = [...text];
    chars.reverse();

    let result = '';
    let ltrRun = '';

    for (const ch of chars) {
        const code = ch.charCodeAt(0);
        const isLTR = (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)
            || (code >= 0x30 && code <= 0x39);

        if (isLTR) {
            ltrRun += ch;
        } else {
            if (ltrRun) {
                result += ltrRun.split('').reverse().join('');
                ltrRun = '';
            }
            const mirrored = ch === '(' ? ')' : ch === ')' ? '(' : ch === '[' ? ']' : ch === ']' ? '[' : ch;
            result += mirrored;
        }
    }
    if (ltrRun) {
        result += ltrRun.split('').reverse().join('');
    }
    return result;
}

function isLineRTL(line: TextLine): boolean {
    let rtl = 0;
    let total = 0;
    for (const item of line.items) {
        for (let i = 0; i < item.text.length; i++) {
            const code = item.text.charCodeAt(i);
            if (code > 0x20) total++;
            if (isRTLChar(code)) rtl++;
        }
    }
    return total > 0 && rtl > total * 0.3;
}

interface GraphicsState {
    ctm: number[];
    fontSize: number;
    fontName: string;
    fillColor: string;
    textMatrix: number[];
    lineMatrix: number[];
    leading: number;
    charSpacing: number;
    wordSpacing: number;
    textRise: number;
    horizontalScaling: number;
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

function tokenizeContentStream(data: Uint8Array): string[] {
    const text = new TextDecoder('latin1').decode(data);
    const tokens: string[] = [];
    let pos = 0;

    while (pos < text.length) {
        while (pos < text.length && ' \t\r\n\0\f'.includes(text[pos])) pos++;
        if (pos >= text.length) break;

        if (text[pos] === '%') {
            while (pos < text.length && text[pos] !== '\n' && text[pos] !== '\r') pos++;
            continue;
        }

        if (text[pos] === '(') {
            let str = '';
            let depth = 1;
            pos++;
            while (pos < text.length && depth > 0) {
                if (text[pos] === '\\') {
                    pos++;
                    if (pos >= text.length) break;
                    const esc = text[pos];
                    if (esc === 'n') str += '\n';
                    else if (esc === 'r') str += '\r';
                    else if (esc === 't') str += '\t';
                    else if (esc === 'b') str += '\b';
                    else if (esc === 'f') str += '\f';
                    else if (esc === '(') str += '(';
                    else if (esc === ')') str += ')';
                    else if (esc === '\\') str += '\\';
                    else if (esc >= '0' && esc <= '7') {
                        let oct = esc;
                        if (pos + 1 < text.length && text[pos + 1] >= '0' && text[pos + 1] <= '7') {
                            pos++; oct += text[pos];
                            if (pos + 1 < text.length && text[pos + 1] >= '0' && text[pos + 1] <= '7') {
                                pos++; oct += text[pos];
                            }
                        }
                        str += String.fromCharCode(parseInt(oct, 8));
                    } else if (esc === '\r' || esc === '\n') {
                        if (esc === '\r' && pos + 1 < text.length && text[pos + 1] === '\n') pos++;
                    } else {
                        str += esc;
                    }
                    pos++;
                } else if (text[pos] === '(') { depth++; str += text[pos++]; }
                else if (text[pos] === ')') { depth--; if (depth > 0) str += text[pos]; pos++; }
                else { str += text[pos++]; }
            }
            tokens.push('(' + str + ')');
            continue;
        }

        if (text[pos] === '<' && pos + 1 < text.length && text[pos + 1] !== '<') {
            let hex = '';
            pos++;
            while (pos < text.length && text[pos] !== '>') {
                if (!' \t\r\n\0\f'.includes(text[pos])) hex += text[pos];
                pos++;
            }
            if (pos < text.length) pos++;
            if (hex.length % 2 !== 0) hex += '0';
            let str = '';
            for (let i = 0; i < hex.length; i += 2) {
                str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
            }
            tokens.push('(' + str + ')');
            continue;
        }

        if (text[pos] === '<' && pos + 1 < text.length && text[pos + 1] === '<') {
            tokens.push('<<');
            pos += 2;
            continue;
        }
        if (text[pos] === '>' && pos + 1 < text.length && text[pos + 1] === '>') {
            tokens.push('>>');
            pos += 2;
            continue;
        }

        if (text[pos] === '[') { tokens.push('['); pos++; continue; }
        if (text[pos] === ']') { tokens.push(']'); pos++; continue; }

        if (text[pos] === '/') {
            let name = '/';
            pos++;
            while (pos < text.length && !' \t\r\n\0\f/<>[]()%'.includes(text[pos])) {
                name += text[pos++];
            }
            tokens.push(name);
            continue;
        }

        let token = '';
        while (pos < text.length && !' \t\r\n\0\f/<>[]()%'.includes(text[pos])) {
            token += text[pos++];
        }
        if (token) tokens.push(token);
    }

    return tokens;
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
            const wList = next.value as PdfObject[];
            for (let j = 0; j < wList.length; j++) {
                widths.set(first + j, reader.getNumber(wList[j]));
            }
            i++;
        } else if (next.type === 'number') {
            const last = next.value as number;
            i++;
            if (i >= arr.length) break;
            const w = reader.getNumber(arr[i]);
            for (let cid = first; cid <= last; cid++) {
                widths.set(cid, w);
            }
            i++;
        } else {
            i++;
        }
    }
    return widths;
}

function buildFontInfo(reader: PdfReader, fontRef: PdfObject): FontInfo {
    const fontObjDict = reader.getDict(fontRef);
    const subtype = reader.getString(fontObjDict['Subtype']);
    const encoding = reader.getString(fontObjDict['Encoding']);

    let isTwoByte = false;
    let widths = new Map<number, number>();
    let defaultWidth = 600;
    let toUnicode = new Map<number, string>();

    const toUnicodeRef = fontObjDict['ToUnicode'];
    if (toUnicodeRef) {
        const cmapData = reader.getStreamData(toUnicodeRef);
        if (cmapData.length > 0) {
            toUnicode = parseToUnicodeMap(cmapData);
        }
    }

    if (subtype === 'Type0') {
        isTwoByte = true;
        const descendantsRef = fontObjDict['DescendantFonts'];
        if (descendantsRef) {
            const descendants = reader.getArray(descendantsRef);
            if (descendants.length > 0) {
                const cidFontDict = reader.getDict(descendants[0]);
                const dw = cidFontDict['DW'];
                defaultWidth = dw ? reader.getNumber(dw) : 1000;
                const wArray = cidFontDict['W'];
                if (wArray) {
                    widths = parseCIDWidths(reader, wArray);
                }
            }
        }
    } else if (encoding === 'Identity-H' || encoding === 'Identity-V') {
        isTwoByte = true;
        defaultWidth = 1000;
    } else {
        const firstChar = reader.getNumber(fontObjDict['FirstChar']);
        const lastChar = reader.getNumber(fontObjDict['LastChar']);
        const widthsArr = fontObjDict['Widths'] ? reader.getArray(fontObjDict['Widths']) : [];
        for (let ci = 0; ci < widthsArr.length; ci++) {
            const w = reader.getNumber(widthsArr[ci]);
            widths.set(firstChar + ci, w);
        }
        if (widthsArr.length === 0) {
            const fontDescRef = fontObjDict['FontDescriptor'];
            if (fontDescRef) {
                const fontDesc = reader.getDict(fontDescRef);
                const mw = fontDesc['MissingWidth'];
                if (mw) defaultWidth = reader.getNumber(mw);
            }
        }
        if (lastChar > 0 && widthsArr.length === 0) {
            defaultWidth = 600;
        }
    }

    return { isTwoByte, widths, defaultWidth, toUnicode };
}

function extractPageContent(
    reader: PdfReader,
    pageObj: PdfObject,
    pageIndex: number,
): { textItems: TextItem[]; imageItems: ImageItem[] } {
    const pageDict = reader.getDict(pageObj);
    const contentsObj = pageDict['Contents'];
    if (!contentsObj) return { textItems: [], imageItems: [] };

    let contentData: Uint8Array;
    const resolved = reader.resolveDeep(contentsObj);
    if (resolved.type === 'array') {
        const parts: Uint8Array[] = [];
        for (const item of resolved.value as PdfObject[]) {
            parts.push(reader.getStreamData(item));
        }
        const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
        contentData = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) {
            contentData.set(part, offset);
            offset += part.length;
        }
    } else {
        contentData = reader.getStreamData(contentsObj);
    }

    if (contentData.length === 0) return { textItems: [], imageItems: [] };

    const resources = pageDict['Resources'] ? reader.getDict(pageDict['Resources']) : {};
    const fontDict = resources['Font'] ? reader.getDict(resources['Font']) : {};
    const xObjectDict = resources['XObject'] ? reader.getDict(resources['XObject']) : {};

    const fontInfoMap = new Map<string, FontInfo>();
    for (const [fontName, fontRef] of Object.entries(fontDict)) {
        fontInfoMap.set(fontName, buildFontInfo(reader, fontRef));
    }

    const tokens = tokenizeContentStream(contentData);
    const textItems: TextItem[] = [];
    const imageItems: ImageItem[] = [];

    const stateStack: GraphicsState[] = [];
    let gs: GraphicsState = {
        ctm: identityMatrix(),
        fontSize: 12,
        fontName: '',
        fillColor: '#000000',
        textMatrix: identityMatrix(),
        lineMatrix: identityMatrix(),
        leading: 0,
        charSpacing: 0,
        wordSpacing: 0,
        textRise: 0,
        horizontalScaling: 100,
    };

    const operandStack: string[] = [];

    const popNumber = (): number => {
        const val = operandStack.pop();
        return val !== undefined ? parseFloat(val) : 0;
    };

    const popString = (): string => {
        const val = operandStack.pop();
        if (!val) return '';
        if (val.startsWith('(') && val.endsWith(')')) return val.slice(1, -1);
        return val;
    };

    const getCurrentXY = (): [number, string] => {
        const tm = gs.textMatrix;
        const ctm = gs.ctm;
        const combined = multiplyMatrix(tm, ctm);
        const effectiveFontSize = Math.abs(gs.fontSize * combined[3]) || gs.fontSize;
        return [effectiveFontSize, gs.fillColor];
    };

    const calcAdvance = (charCodes: number[], fontInfo: FontInfo | undefined): number => {
        let totalWidth = 0;
        for (const code of charCodes) {
            const w = fontInfo ? (fontInfo.widths.get(code) ?? fontInfo.defaultWidth) : 600;
            totalWidth += w;
        }
        const advance = (totalWidth / 1000) * gs.fontSize * (gs.horizontalScaling / 100);
        const spacing = charCodes.length * gs.charSpacing
            + charCodes.filter(c => c === 32).length * gs.wordSpacing;
        return advance + spacing;
    };

    const addTextItem = (raw: string) => {
        const fontInfo = fontInfoMap.get(gs.fontName);
        const { text: rawDecoded, charCodes } = pdfStringToUnicode(raw, fontInfo);
        const decoded = fixVisualOrderRTL(rawDecoded);
        if (!decoded.trim()) {
            const advance = calcAdvance(charCodes, fontInfo);
            gs.textMatrix[4] += advance;
            return;
        }

        const tm = gs.textMatrix;
        const ctm = gs.ctm;
        const combined = multiplyMatrix(tm, ctm);
        const [effectiveFontSize] = getCurrentXY();

        const advance = calcAdvance(charCodes, fontInfo);
        const startX = Math.round(combined[4] * 100) / 100;

        textItems.push({
            text: decoded,
            fontSize: Math.round(effectiveFontSize * 100) / 100,
            x: startX,
            y: Math.round(combined[5] * 100) / 100,
            endX: Math.round((combined[4] + advance) * 100) / 100,
            page: pageIndex,
            color: gs.fillColor,
        });

        gs.textMatrix[4] += advance;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token === 'q') {
            stateStack.push(JSON.parse(JSON.stringify(gs)));
            continue;
        }
        if (token === 'Q') {
            if (stateStack.length > 0) gs = stateStack.pop()!;
            continue;
        }

        if (token === 'cm') {
            const f = popNumber();
            const e = popNumber();
            const d = popNumber();
            const c = popNumber();
            const b = popNumber();
            const a = popNumber();
            gs.ctm = multiplyMatrix([a, b, c, d, e, f], gs.ctm);
            continue;
        }

        if (token === 'BT') {
            gs.textMatrix = identityMatrix();
            gs.lineMatrix = identityMatrix();
            continue;
        }
        if (token === 'ET') {
            continue;
        }

        if (token === 'Tf') {
            gs.fontSize = popNumber();
            const fontNameToken = operandStack.pop() || '';
            gs.fontName = fontNameToken.startsWith('/') ? fontNameToken.slice(1) : fontNameToken;
            continue;
        }

        if (token === 'Tm') {
            const f = popNumber();
            const e = popNumber();
            const d = popNumber();
            const c = popNumber();
            const b = popNumber();
            const a = popNumber();
            gs.textMatrix = [a, b, c, d, e, f];
            gs.lineMatrix = [a, b, c, d, e, f];
            continue;
        }

        if (token === 'Td') {
            const ty = popNumber();
            const tx = popNumber();
            gs.textMatrix = multiplyMatrix([1, 0, 0, 1, tx, ty], gs.lineMatrix);
            gs.lineMatrix = gs.textMatrix.slice();
            continue;
        }
        if (token === 'TD') {
            const ty = popNumber();
            const tx = popNumber();
            gs.leading = -ty;
            gs.textMatrix = multiplyMatrix([1, 0, 0, 1, tx, ty], gs.lineMatrix);
            gs.lineMatrix = gs.textMatrix.slice();
            continue;
        }

        if (token === 'T*') {
            gs.textMatrix = multiplyMatrix([1, 0, 0, 1, 0, -gs.leading], gs.lineMatrix);
            gs.lineMatrix = gs.textMatrix.slice();
            continue;
        }

        if (token === 'TL') {
            gs.leading = popNumber();
            continue;
        }

        if (token === 'Tc') {
            gs.charSpacing = popNumber();
            continue;
        }
        if (token === 'Tw') {
            gs.wordSpacing = popNumber();
            continue;
        }
        if (token === 'Tz') {
            gs.horizontalScaling = popNumber();
            continue;
        }
        if (token === 'Ts') {
            gs.textRise = popNumber();
            continue;
        }

        if (token === 'Tj') {
            const raw = popString();
            addTextItem(raw);
            continue;
        }

        if (token === "'" || token === "'") {
            const raw = popString();
            gs.textMatrix = multiplyMatrix([1, 0, 0, 1, 0, -gs.leading], gs.lineMatrix);
            gs.lineMatrix = gs.textMatrix.slice();
            addTextItem(raw);
            continue;
        }

        if (token === '"') {
            const raw = popString();
            gs.charSpacing = popNumber();
            gs.wordSpacing = popNumber();
            gs.textMatrix = multiplyMatrix([1, 0, 0, 1, 0, -gs.leading], gs.lineMatrix);
            gs.lineMatrix = gs.textMatrix.slice();
            addTextItem(raw);
            continue;
        }

        if (token === 'TJ') {
            const arrTokens: string[] = [];
            while (operandStack.length > 0) {
                arrTokens.unshift(operandStack.pop()!);
            }
            const fontInfo = fontInfoMap.get(gs.fontName);
            const dw = fontInfo ? fontInfo.defaultWidth : 600;

            let combinedText = '';
            let pendingDisplacement = 0;
            const startTm = gs.textMatrix.slice();

            for (const t of arrTokens) {
                if (t === '[' || t === ']') continue;
                if (t.startsWith('(')) {
                    const rawStr = t.slice(1, -1);
                    if (pendingDisplacement !== 0) {
                        gs.textMatrix[4] -= (pendingDisplacement / 1000) * gs.fontSize * (gs.horizontalScaling / 100);
                        if (-pendingDisplacement > dw * 0.3 && combinedText.length > 0) {
                            combinedText += ' ';
                        }
                        pendingDisplacement = 0;
                    }
                    const { text: decoded, charCodes: fragCodes } = pdfStringToUnicode(rawStr, fontInfo);
                    combinedText += decoded;
                    const fragAdvance = calcAdvance(fragCodes, fontInfo);
                    gs.textMatrix[4] += fragAdvance;
                } else {
                    const kern = parseFloat(t);
                    if (!isNaN(kern)) {
                        pendingDisplacement += kern;
                    }
                }
            }
            if (pendingDisplacement !== 0) {
                gs.textMatrix[4] -= (pendingDisplacement / 1000) * gs.fontSize * (gs.horizontalScaling / 100);
            }

            const fixedText = fixVisualOrderRTL(combinedText);
            if (fixedText.trim()) {
                const ctm = gs.ctm;
                const combined = multiplyMatrix(startTm, ctm);
                const endCombined = multiplyMatrix(gs.textMatrix, ctm);
                const [effectiveFontSize] = getCurrentXY();
                textItems.push({
                    text: fixedText,
                    fontSize: Math.round(effectiveFontSize * 100) / 100,
                    x: Math.round(combined[4] * 100) / 100,
                    y: Math.round(combined[5] * 100) / 100,
                    endX: Math.round(endCombined[4] * 100) / 100,
                    page: pageIndex,
                    color: gs.fillColor,
                });
            }
            continue;
        }

        if (token === 'rg') {
            const b = popNumber();
            const g = popNumber();
            const r = popNumber();
            gs.fillColor = rgbToHex(r, g, b);
            continue;
        }
        if (token === 'g') {
            const gray = popNumber();
            gs.fillColor = grayToHex(gray);
            continue;
        }
        if (token === 'k') {
            const kk = popNumber();
            const y = popNumber();
            const m = popNumber();
            const c = popNumber();
            gs.fillColor = cmykToRgbHex(c, m, y, kk);
            continue;
        }
        if (token === 'scn' || token === 'sc') {
            const values: number[] = [];
            while (operandStack.length > 0) {
                const v = operandStack.pop()!;
                if (!isNaN(parseFloat(v))) values.unshift(parseFloat(v));
            }
            if (values.length >= 3) {
                gs.fillColor = rgbToHex(values[0], values[1], values[2]);
            } else if (values.length === 1) {
                gs.fillColor = grayToHex(values[0]);
            }
            continue;
        }

        if (token === 'Do') {
            const imageName = operandStack.pop() || '';
            const name = imageName.startsWith('/') ? imageName.slice(1) : imageName;
            const xObjRef = xObjectDict[name];
            if (xObjRef) {
                const xObj = reader.resolveDeep(xObjRef);
                if (xObj.type === 'stream') {
                    const xDict = xObj.value as Record<string, PdfObject>;
                    const subtype = reader.getString(xDict['Subtype']);
                    if (subtype === 'Image') {
                        const imgResult = extractXObjectImage(reader, xObj, gs.ctm, pageIndex);
                        if (imgResult) imageItems.push(imgResult);
                    }
                }
            }
            continue;
        }

        if (token === 'BI') {
            const inlineImgResult = parseInlineImage(tokens, i, gs.ctm, pageIndex);
            if (inlineImgResult) {
                if (inlineImgResult.imageItem) imageItems.push(inlineImgResult.imageItem);
                i = inlineImgResult.newIndex;
            }
            continue;
        }

        if (token === 'RG' || token === 'G' || token === 'K' ||
            token === 'CS' || token === 'cs' || token === 'SCN' ||
            token === 'SC' || token === 'ri' || token === 'gs' ||
            token === 'w' || token === 'J' || token === 'j' ||
            token === 'M' || token === 'd' || token === 'i' ||
            token === 'W' || token === 'W*' || token === 'n' ||
            token === 'm' || token === 'l' || token === 'c' ||
            token === 'v' || token === 'y' || token === 'h' ||
            token === 're' || token === 'S' || token === 's' ||
            token === 'f' || token === 'F' || token === 'f*' ||
            token === 'B' || token === 'B*' || token === 'b' ||
            token === 'b*' || token === 'sh' || token === 'EI' ||
            token === 'BMC' || token === 'BDC' || token === 'EMC' ||
            token === 'MP' || token === 'DP') {
            operandStack.length = 0;
            continue;
        }

        operandStack.push(token);
    }

    return { textItems, imageItems };
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

    const filterObj = dict['Filter'];
    const filterResolved = filterObj ? reader.resolveDeep(filterObj) : null;
    let filterName = '';
    if (filterResolved) {
        if (filterResolved.type === 'name') filterName = filterResolved.value as string;
        else if (filterResolved.type === 'array') {
            const arr = filterResolved.value as PdfObject[];
            if (arr.length > 0) {
                const last = reader.resolveDeep(arr[arr.length - 1]);
                filterName = last.type === 'name' ? last.value as string : '';
            }
        }
    }

    let dataUrl: string | null = null;

    if (filterName === 'DCTDecode') {
        const rawData = xObj.stream!;
        const base64 = uint8ArrayToBase64(rawData);
        dataUrl = `data:image/jpeg;base64,${base64}`;
    } else if (filterName === 'JPXDecode') {
        const rawData = xObj.stream!;
        const base64 = uint8ArrayToBase64(rawData);
        dataUrl = `data:image/jp2;base64,${base64}`;
    } else {
        const decoded = reader.getStreamData(xObj);
        if (decoded.length > 0) {
            const pngData = rawPixelsToPng(decoded, width, height, dict, reader);
            if (pngData) {
                const base64 = uint8ArrayToBase64(pngData);
                dataUrl = `data:image/png;base64,${base64}`;
            }
        }
    }

    if (!dataUrl) return null;

    return {
        dataUrl,
        width,
        height,
        x: Math.round(ctm[4] * 100) / 100,
        y: Math.round(ctm[5] * 100) / 100,
        page: pageIndex,
    };
}

function parseInlineImage(
    tokens: string[],
    biIndex: number,
    ctm: number[],
    pageIndex: number,
): { imageItem: ImageItem | null; newIndex: number } | null {
    let i = biIndex + 1;
    while (i < tokens.length && tokens[i] !== 'ID' && tokens[i] !== 'EI') {
        i++;
    }
    while (i < tokens.length && tokens[i] !== 'EI') i++;
    return { imageItem: null, newIndex: i };
}

function rawPixelsToPng(
    decoded: Uint8Array,
    width: number,
    height: number,
    dict: Record<string, PdfObject>,
    reader: PdfReader,
): Uint8Array | null {
    const colorSpaceObj = dict['ColorSpace'];
    const colorSpace = colorSpaceObj ? reader.getString(colorSpaceObj) : 'DeviceRGB';
    const bpc = reader.getNumber(dict['BitsPerComponent']) || 8;

    let channels: number;
    if (colorSpace === 'DeviceRGB' || colorSpace === 'RGB') channels = 3;
    else if (colorSpace === 'DeviceCMYK' || colorSpace === 'CMYK') channels = 4;
    else if (colorSpace === 'DeviceGray' || colorSpace === 'Gray' || colorSpace === 'G') channels = 1;
    else channels = 3;

    const expectedBytes = width * height * channels * (bpc / 8);
    if (decoded.length < expectedBytes * 0.8) return null;

    const pngRows: Uint8Array[] = [];
    const rowBytes = width * channels * (bpc / 8);

    for (let row = 0; row < height; row++) {
        const rowStart = row * rowBytes;
        const rgbRow = new Uint8Array(width * 3);
        for (let col = 0; col < width; col++) {
            const srcIdx = rowStart + col * channels * (bpc / 8);
            if (channels === 3) {
                rgbRow[col * 3] = decoded[srcIdx] ?? 0;
                rgbRow[col * 3 + 1] = decoded[srcIdx + 1] ?? 0;
                rgbRow[col * 3 + 2] = decoded[srcIdx + 2] ?? 0;
            } else if (channels === 1) {
                const g = decoded[srcIdx] ?? 0;
                rgbRow[col * 3] = g;
                rgbRow[col * 3 + 1] = g;
                rgbRow[col * 3 + 2] = g;
            } else if (channels === 4) {
                const cc = (decoded[srcIdx] ?? 0) / 255;
                const mm = (decoded[srcIdx + 1] ?? 0) / 255;
                const yy = (decoded[srcIdx + 2] ?? 0) / 255;
                const kk = (decoded[srcIdx + 3] ?? 0) / 255;
                rgbRow[col * 3] = Math.round((1 - cc) * (1 - kk) * 255);
                rgbRow[col * 3 + 1] = Math.round((1 - mm) * (1 - kk) * 255);
                rgbRow[col * 3 + 2] = Math.round((1 - yy) * (1 - kk) * 255);
            }
        }
        const filterRow = new Uint8Array(1 + width * 3);
        filterRow[0] = 0;
        filterRow.set(rgbRow, 1);
        pngRows.push(filterRow);
    }

    return buildPng(width, height, pngRows);
}

function buildPng(width: number, height: number, rows: Uint8Array[]): Uint8Array {
    const rawDataSize = rows.reduce((sum, r) => sum + r.length, 0);
    const rawData = new Uint8Array(rawDataSize);
    let offset = 0;
    for (const row of rows) {
        rawData.set(row, offset);
        offset += row.length;
    }

    const deflatedChunks: Uint8Array[] = [];
    let remaining = rawData.length;
    let pos = 0;
    while (remaining > 0) {
        const blockSize = Math.min(remaining, 65535);
        const isLast = remaining - blockSize === 0;
        const block = new Uint8Array(5 + blockSize);
        block[0] = isLast ? 1 : 0;
        block[1] = blockSize & 0xff;
        block[2] = (blockSize >> 8) & 0xff;
        block[3] = (~blockSize) & 0xff;
        block[4] = ((~blockSize) >> 8) & 0xff;
        block.set(rawData.subarray(pos, pos + blockSize), 5);
        deflatedChunks.push(block);
        pos += blockSize;
        remaining -= blockSize;
    }

    const deflatedSize = deflatedChunks.reduce((sum, c) => sum + c.length, 0);
    const zlibData = new Uint8Array(2 + deflatedSize + 4);
    zlibData[0] = 0x78;
    zlibData[1] = 0x01;
    let zlibPos = 2;
    for (const chunk of deflatedChunks) {
        zlibData.set(chunk, zlibPos);
        zlibPos += chunk.length;
    }
    const adler = adler32(rawData);
    zlibData[zlibPos] = (adler >> 24) & 0xff;
    zlibData[zlibPos + 1] = (adler >> 16) & 0xff;
    zlibData[zlibPos + 2] = (adler >> 8) & 0xff;
    zlibData[zlibPos + 3] = adler & 0xff;

    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = createPngChunk('IHDR', (() => {
        const d = new Uint8Array(13);
        const v = new DataView(d.buffer);
        v.setUint32(0, width);
        v.setUint32(4, height);
        d[8] = 8;
        d[9] = 2;
        d[10] = 0;
        d[11] = 0;
        d[12] = 0;
        return d;
    })());
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
    for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
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
    for (let i = 0; i < data.length; i++) {
        crc = PNG_CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
    let a = 1;
    let b = 0;
    for (let i = 0; i < data.length; i++) {
        a = (a + data[i]) % 65521;
        b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
}

function uint8ArrayToBase64(data: Uint8Array): string {
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < data.length; i += chunkSize) {
        const slice = data.subarray(i, Math.min(i + chunkSize, data.length));
        for (let j = 0; j < slice.length; j++) {
            binary += String.fromCharCode(slice[j]);
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
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function groupIntoLines(items: TextItem[]): TextLine[] {
    if (items.length === 0) return [];

    const sorted = [...items].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
        return a.x - b.x;
    });

    const lines: TextLine[] = [];
    let currentLine: TextItem[] = [sorted[0]];
    let currentY = sorted[0].y;

    for (let i = 1; i < sorted.length; i++) {
        const item = sorted[i];
        if (Math.abs(item.y - currentY) <= 2 && item.page === sorted[i - 1].page) {
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
        sizeCount.set(rounded, (sizeCount.get(rounded) || 0) + item.text.length);
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

function getHeadingLevel(fontSize: number, bodySize: number): number {
    if (bodySize <= 0) return 0;
    const ratio = fontSize / bodySize;
    if (ratio >= 1.6) return 1;
    if (ratio >= 1.3) return 2;
    if (ratio >= 1.1) return 3;
    return 0;
}

function shouldInsertSpace(prev: TextItem, next: TextItem): boolean {
    const gap = next.x - prev.endX;
    if (gap > prev.fontSize * 0.15) return true;
    if (gap < -prev.fontSize * 0.5) return false;
    return false;
}

function findLargeGapIndex(line: TextLine): number {
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
    return maxGap > fontSize * 4 ? splitIdx : -1;
}

function lineToTableRowHtml(line: TextLine, splitIndex: number, bodySize: number): string {
    const sorted = [...line.items].sort((a, b) => a.x - b.x);
    const leftItems = sorted.slice(0, splitIndex);
    const rightItems = sorted.slice(splitIndex);

    const leftLine: TextLine = { items: leftItems, y: line.y, minX: leftItems[0]?.x ?? 0 };
    const rightLine: TextLine = { items: rightItems, y: line.y, minX: rightItems[0]?.x ?? 0 };

    const leftFontSize = leftItems.reduce((max, it) => Math.max(max, it.fontSize), 0);
    const rightFontSize = rightItems.reduce((max, it) => Math.max(max, it.fontSize), 0);

    const leftHeading = getHeadingLevel(leftFontSize, bodySize);
    const rightHeading = getHeadingLevel(rightFontSize, bodySize);

    let leftHtml = lineToHtmlContent(leftLine);
    let rightHtml = lineToHtmlContent(rightLine);

    if (leftHeading > 0) {
        leftHtml = `<h${leftHeading} style="margin: 0;">${leftHtml}</h${leftHeading}>`;
    }
    if (rightHeading > 0) {
        rightHtml = `<h${rightHeading} style="margin: 0;">${rightHtml}</h${rightHeading}>`;
    }

    return `<table style="width: 100%; border-collapse: collapse;"><tr><td style="border: none; padding: 0;">${leftHtml}</td><td style="border: none; padding: 0; text-align: right;">${rightHtml}</td></tr></table>`;
}

function lineToText(line: TextLine): string {
    const rtl = isLineRTL(line);
    const sorted = [...line.items].sort((a, b) => rtl ? b.x - a.x : a.x - b.x);
    let result = '';
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
            const gap = rtl
                ? sorted[i - 1].x - sorted[i].endX
                : sorted[i].x - sorted[i - 1].endX;
            if (gap > sorted[i - 1].fontSize * 0.15) {
                result += ' ';
            }
        }
        result += sorted[i].text;
    }
    return result.trim();
}

function lineToHtmlContent(line: TextLine): string {
    const rtl = isLineRTL(line);
    const sorted = [...line.items].sort((a, b) => rtl ? b.x - a.x : a.x - b.x);
    let result = '';
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
            const gap = rtl
                ? sorted[i - 1].x - sorted[i].endX
                : sorted[i].x - sorted[i - 1].endX;
            if (gap > sorted[i - 1].fontSize * 0.15) {
                result += ' ';
            }
        }
        const text = escapeHtml(sorted[i].text);
        if (!isDefaultColor(sorted[i].color)) {
            result += `<span style="color: ${sorted[i].color}">${text}</span>`;
        } else {
            result += text;
        }
    }
    return result.trim();
}

function detectColumns(lines: TextLine[]): TextLine[] {
    if (lines.length < 4) return lines;

    const pages = new Set(lines.map(l => l.items[0]?.page ?? 0));
    const result: TextLine[] = [];

    for (const page of pages) {
        const pageLines = lines.filter(l => (l.items[0]?.page ?? 0) === page);
        if (pageLines.length < 4) {
            result.push(...pageLines);
            continue;
        }

        const startXs = pageLines.map(l => l.minX).sort((a, b) => a - b);
        let bestGap = 0;
        let splitX = 0;
        for (let i = 1; i < startXs.length; i++) {
            const gap = startXs[i] - startXs[i - 1];
            if (gap > bestGap) {
                bestGap = gap;
                splitX = (startXs[i - 1] + startXs[i]) / 2;
            }
        }

        const pageWidth = Math.max(...pageLines.map(l => {
            const maxEndX = Math.max(...l.items.map(it => it.endX));
            return maxEndX;
        })) - Math.min(...startXs);

        if (bestGap < pageWidth * 0.15 || bestGap < 50) {
            result.push(...pageLines);
            continue;
        }

        const spanningLines: TextLine[] = [];
        const leftLines: TextLine[] = [];
        const rightLines: TextLine[] = [];

        for (const line of pageLines) {
            const leftItems = line.items.filter(it => it.x < splitX);
            const rightItems = line.items.filter(it => it.x >= splitX);

            if (leftItems.length > 0 && rightItems.length > 0) {
                spanningLines.push(line);
            } else if (rightItems.length > 0 && leftItems.length === 0) {
                rightLines.push(line);
            } else {
                leftLines.push(line);
            }
        }

        result.push(...spanningLines, ...leftLines, ...rightLines);
    }

    return result;
}

const BULLET_PATTERN = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u25AA\u25AB\u2013\u2014\-\*]\s*/;
const NUMBERED_PATTERN = /^(\d{1,3})[.)]\s+/;

function textItemsToHtml(
    textItems: TextItem[],
    imageItems: ImageItem[],
): string {
    const rawLines = groupIntoLines(textItems);
    if (rawLines.length === 0) return '';
    const lines = detectColumns(rawLines);

    const bodySize = detectBodyFontSize(textItems);
    const html: string[] = [];
    let inBulletList = false;
    let inNumberedList = false;

    const closeList = () => {
        if (inBulletList) { html.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { html.push('</ol>'); inNumberedList = false; }
    };

    let currentParagraph: string[] = [];
    let currentParagraphRTL = false;
    let lastY: number | null = null;
    let lastPage = -1;
    let lastLineSpacing = 0;
    let imageIdx = 0;

    const sortedImages = [...imageItems].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        return b.y - a.y;
    });

    const flushParagraph = () => {
        if (currentParagraph.length === 0) return;
        const text = currentParagraph.join(' ');
        const dir = currentParagraphRTL ? ' dir="rtl"' : '';
        html.push(`<p${dir}>${text}</p>`);
        currentParagraph = [];
        currentParagraphRTL = false;
    };

    const insertImagesBeforeY = (page: number, y: number) => {
        while (imageIdx < sortedImages.length) {
            const img = sortedImages[imageIdx];
            if (img.page < page || (img.page === page && img.y >= y)) {
                flushParagraph();
                closeList();
                html.push(`<img src="${img.dataUrl}" width="${img.width}" height="${img.height}" alt="Embedded image" />`);
                imageIdx++;
            } else {
                break;
            }
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineText = lineToText(line);
        if (!lineText) continue;

        insertImagesBeforeY(line.items[0].page, line.y);

        const lineSpacing = lastY !== null && line.items[0].page === lastPage
            ? Math.abs(lastY - line.y) : 0;
        const isParagraphBreak = lastY !== null &&
            line.items[0].page === lastPage &&
            lastLineSpacing > 0 &&
            lineSpacing > lastLineSpacing * 1.5;
        const isPageBreak = lastPage !== -1 && line.items[0].page !== lastPage;

        const primaryFontSize = line.items.reduce(
            (max, item) => item.fontSize > max ? item.fontSize : max,
            0,
        );
        const headingLevel = getHeadingLevel(primaryFontSize, bodySize);

        const bulletMatch = lineText.match(BULLET_PATTERN);
        const numberedMatch = lineText.match(NUMBERED_PATTERN);

        const largeGapIdx = findLargeGapIndex(line);
        const rtl = isLineRTL(line);
        const dir = rtl ? ' dir="rtl"' : '';

        if (largeGapIdx > 0) {
            flushParagraph();
            closeList();
            html.push(lineToTableRowHtml(line, largeGapIdx, bodySize));
        } else if (headingLevel > 0) {
            flushParagraph();
            closeList();
            const content = lineToHtmlContent(line);
            html.push(`<h${headingLevel}${dir}>${content}</h${headingLevel}>`);
        } else if (bulletMatch) {
            flushParagraph();
            if (inNumberedList) { html.push('</ol>'); inNumberedList = false; }
            if (!inBulletList) { html.push(`<ul${dir}>`); inBulletList = true; }
            const content = escapeHtml(lineText.replace(BULLET_PATTERN, ''));
            html.push(`<li>${content}</li>`);
        } else if (numberedMatch) {
            flushParagraph();
            if (inBulletList) { html.push('</ul>'); inBulletList = false; }
            if (!inNumberedList) { html.push(`<ol${dir}>`); inNumberedList = true; }
            const content = escapeHtml(lineText.replace(NUMBERED_PATTERN, ''));
            html.push(`<li>${content}</li>`);
        } else {
            closeList();
            const content = lineToHtmlContent(line);
            if (isParagraphBreak || isPageBreak) {
                flushParagraph();
            }
            if (rtl) currentParagraphRTL = true;
            currentParagraph.push(content);
        }

        if (lineSpacing > 0) lastLineSpacing = lineSpacing;
        lastY = line.y;
        lastPage = line.items[0].page;
    }

    flushParagraph();
    closeList();

    while (imageIdx < sortedImages.length) {
        const img = sortedImages[imageIdx];
        html.push(`<img src="${img.dataUrl}" width="${img.width}" height="${img.height}" alt="Embedded image" />`);
        imageIdx++;
    }

    return html.join('\n');
}

// ── Main export ─────────────────────────────────────────────────────────

export async function parsePdf(buffer: ArrayBuffer): Promise<PdfParseResult> {
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

    const allTextItems: TextItem[] = [];
    const allImageItems: ImageItem[] = [];

    for (let i = 0; i < pages.length; i++) {
        try {
            const { textItems, imageItems } = extractPageContent(reader, pages[i], i);
            allTextItems.push(...textItems);
            allImageItems.push(...imageItems);
        } catch {
            continue;
        }
    }

    if (allTextItems.length === 0 && allImageItems.length > 0) {
        const imgTags = allImageItems
            .sort((a, b) => a.page !== b.page ? a.page - b.page : b.y - a.y)
            .map(img => `<img src="${img.dataUrl}" width="${img.width}" height="${img.height}" alt="Page image" />`)
            .join('\n');
        return { html: imgTags, text: '', imageOnly: true };
    }

    if (allTextItems.length === 0) {
        throw new Error('No readable content found in PDF.');
    }

    const html = textItemsToHtml(allTextItems, allImageItems);
    const plainText = allTextItems
        .sort((a, b) => {
            if (a.page !== b.page) return a.page - b.page;
            if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
            return a.x - b.x;
        })
        .map(item => item.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    return { html, text: plainText, imageOnly: false };
}
