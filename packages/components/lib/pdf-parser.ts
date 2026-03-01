import { zlibInflate } from './inflate';

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

// ── PDF structure parser ────────────────────────────────────────────────

class PdfReader {
    private readonly data: Uint8Array;
    private readonly text: string;
    private readonly objects: Map<string, { offset: number; gen: number }> = new Map();
    private readonly parsedObjects: Map<string, PdfObject> = new Map();
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
        const match = new RegExp(/startxref\s+(\d+)/).exec(lastChunk);
        if (!match) throw new Error('Could not find startxref in PDF');
        const xrefOffset = Number.parseInt(match[1], 10);

        if (this.text.substring(xrefOffset, xrefOffset + 4) === 'xref') {
            this.parseTraditionalXRef(xrefOffset);
        } else {
            this.parseXRefStream(xrefOffset);
        }
    }

    private parseXRefEntry(entryStr: string, startObj: number, index: number): void {
        const entryMatch = new RegExp(/(\d{10})\s+(\d{5})\s+([fn])/).exec(entryStr);
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
        this.trailer = result.obj.value as Record<string, PdfObject>;
        const prev = this.trailer['Prev'];
        if (prev?.type === 'number') {
            this.parseTraditionalXRef(prev.value as number);
        }
    }

    private parseTraditionalXRef(offset: number): void {
        let pos = offset + 4;
        pos = this.skipWhitespace(pos);

        while (pos < this.text.length) {
            if (this.text.substring(pos, pos + 7) === 'trailer') break;

            const headerMatch = new RegExp(/^(\d+)\s+(\d+)/).exec(this.text.substring(pos));
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

                if (fieldType !== 1) continue;
                const key = `${startObj + i} ${field3}`;
                if (!this.objects.has(key)) {
                    this.objects.set(key, { offset: field2, gen: field3 });
                }
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
        if (obj.type !== 'stream') throw new Error('Expected xref stream');
        const dict = obj.value as Record<string, PdfObject>;
        const streamData = obj.stream!;

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

        const objHeaderMatch = new RegExp(/^(\d+)\s+(\d+)\s+obj\s*/).exec(this.text.substring(pos));
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
        const numMatch = new RegExp(/^([+-]?\d+\.?\d*|[+-]?\.\d+)/).exec(this.text.substring(pos));
        if (!numMatch) {
            return { obj: { type: 'null', value: null }, endPos: pos + 1 };
        }
        const num = Number.parseFloat(numMatch[1]);
        const afterNum = pos + numMatch[0].length;
        const refMatch = new RegExp(/^\s+(\d+)\s+R/).exec(this.text.substring(afterNum));
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

function decodeTwoByteChar(code: number, toUnicode: Map<number, string>): string {
    if (toUnicode.has(code)) return toUnicode.get(code)!;
    if (code >= 0x20 && code < 0xFFFE) return String.fromCodePoint(code);
    return '\uFFFD';
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
        result += fontInfo.toUnicode.has(code)
            ? fontInfo.toUnicode.get(code)!
            : String.fromCodePoint(code);
    }
    return { result, charCodes };
}

function decodeSingleByteString(raw: string, toUnicode?: Map<number, string>): { result: string; charCodes: number[] } {
    let result = '';
    const charCodes: number[] = [];
    for (let i = 0; i < raw.length; i++) {
        const code = raw.codePointAt(i) ?? 0;
        charCodes.push(code);
        if (toUnicode?.has(code)) {
            result += toUnicode.get(code)!;
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
            const dstHex = parts[2];
            let dstStr = '';
            for (let i = 0; i < dstHex.length; i += 4) {
                dstStr += String.fromCodePoint(Number.parseInt(dstHex.substring(i, i + 4), 16));
            }
            map.set(srcCode, dstStr);
        }
    }
}

function parseBfRangeEntries(text: string, map: Map<number, string>): void {
    const bfRangeRe = /beginbfrange\s+([\s\S]*?)endbfrange/g;
    let match: RegExpExecArray | null;
    while ((match = bfRangeRe.exec(text)) !== null) {
        for (const entry of match[1].trim().split('\n')) {
            const parts = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/.exec(entry.trim());
            if (!parts) continue;
            const start = Number.parseInt(parts[1], 16);
            const end = Number.parseInt(parts[2], 16);
            let dstStart = Number.parseInt(parts[3], 16);
            for (let code = start; code <= end; code++) {
                map.set(code, String.fromCodePoint(dstStart++));
            }
        }
    }
}

function parseToUnicodeMap(data: Uint8Array): Map<number, string> {
    const map = new Map<number, string>();
    const text = new TextDecoder('latin1').decode(data);
    parseBfCharEntries(text, map);
    parseBfRangeEntries(text, map);
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
        if (isRTLChar(text.codePointAt(i) ?? 0)) return true;
    }
    return false;
}

const BRACKET_MIRROR: Record<string, string> = {
    '(': ')', ')': '(', '[': ']', ']': '[',
};

function isLTRCode(code: number): boolean {
    return (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)
        || (code >= 0x30 && code <= 0x39);
}

function fixVisualOrderRTL(text: string): string {
    if (!hasRTLText(text)) return text;

    const chars = [...text];
    chars.reverse();

    let result = '';
    let ltrRun = '';

    for (const ch of chars) {
        if (isLTRCode(ch.codePointAt(0) ?? 0)) {
            ltrRun += ch;
            continue;
        }
        if (ltrRun) {
            result += ltrRun.split('').reverse().join('');
            ltrRun = '';
        }
        result += BRACKET_MIRROR[ch] ?? ch;
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
            const code = item.text.codePointAt(i) ?? 0;
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
    const lastChar = reader.getNumber(fontObjDict['LastChar']);
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
        }
    }
    if (lastChar > 0 && widthsArr.length === 0) {
        defaultWidth = 600;
    }
    return { widths, defaultWidth };
}

function buildFontInfo(reader: PdfReader, fontRef: PdfObject): FontInfo {
    const fontObjDict = reader.getDict(fontRef);
    const subtype = reader.getString(fontObjDict['Subtype']);
    const encoding = reader.getString(fontObjDict['Encoding']);

    let toUnicode = new Map<number, string>();
    const toUnicodeRef = fontObjDict['ToUnicode'];
    if (toUnicodeRef) {
        const cmapData = reader.getStreamData(toUnicodeRef);
        if (cmapData.length > 0) {
            toUnicode = parseToUnicodeMap(cmapData);
        }
    }

    if (subtype === 'Type0') {
        const { widths, defaultWidth } = buildType0FontWidths(reader, fontObjDict);
        return { isTwoByte: true, widths, defaultWidth, toUnicode };
    }

    if (encoding === 'Identity-H' || encoding === 'Identity-V') {
        return { isTwoByte: true, widths: new Map(), defaultWidth: 1000, toUnicode };
    }

    const { widths, defaultWidth } = buildStandardFontWidths(reader, fontObjDict);
    return { isTwoByte: false, widths, defaultWidth, toUnicode };
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

function processTextShow(
    raw: string, gs: GraphicsState, fontInfoMap: Map<string, FontInfo>,
    textItems: TextItem[], pageIndex: number,
): void {
    const fontInfo = fontInfoMap.get(gs.fontName);
    const { text: rawDecoded, charCodes } = pdfStringToUnicode(raw, fontInfo);
    const decoded = fixVisualOrderRTL(rawDecoded);
    const advance = calcTextAdvance(charCodes, fontInfo, gs);
    if (!decoded.trim()) {
        gs.textMatrix[4] += advance;
        return;
    }
    const combined = multiplyMatrix(gs.textMatrix, gs.ctm);
    const effectiveFontSize = getEffectiveFontSize(gs);
    textItems.push({
        text: decoded,
        fontSize: Math.round(effectiveFontSize * 100) / 100,
        x: Math.round(combined[4] * 100) / 100,
        y: Math.round(combined[5] * 100) / 100,
        endX: Math.round((combined[4] + advance) * 100) / 100,
        page: pageIndex,
        color: gs.fillColor,
    });
    gs.textMatrix[4] += advance;
}

function processTJOperator(
    operandStack: string[], gs: GraphicsState, fontInfoMap: Map<string, FontInfo>,
    textItems: TextItem[], pageIndex: number,
): void {
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
            combinedText = applyTJStringFragment(t, pendingDisplacement, dw, combinedText, gs, fontInfo);
            pendingDisplacement = 0;
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

    const fixedText = fixVisualOrderRTL(combinedText);
    if (!fixedText.trim()) return;
    const combined = multiplyMatrix(startTm, gs.ctm);
    const endCombined = multiplyMatrix(gs.textMatrix, gs.ctm);
    const effectiveFontSize = getEffectiveFontSize(gs);
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

function processColorOperator(
    token: string, operandStack: string[], gs: GraphicsState,
    popNumber: () => number,
): boolean {
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
                const v = operandStack.pop()!;
                if (!Number.isNaN(Number.parseFloat(v))) values.unshift(Number.parseFloat(v));
            }
            if (values.length >= 3) {
                gs.fillColor = rgbToHex(values[0], values[1], values[2]);
            } else if (values.length === 1) {
                gs.fillColor = grayToHex(values[0]);
            }
            return true;
        }
        default:
            return false;
    }
}

function processDoOperator(
    operandStack: string[], reader: PdfReader, xObjectDict: Record<string, PdfObject>,
    gs: GraphicsState, imageItems: ImageItem[], pageIndex: number,
): void {
    const imageName = operandStack.pop() || '';
    const name = imageName.startsWith('/') ? imageName.slice(1) : imageName;
    const xObjRef = xObjectDict[name];
    if (!xObjRef) return;
    const xObj = reader.resolveDeep(xObjRef);
    if (xObj.type !== 'stream') return;
    const xDict = xObj.value as Record<string, PdfObject>;
    if (reader.getString(xDict['Subtype']) !== 'Image') return;
    const imgResult = extractXObjectImage(reader, xObj, gs.ctm, pageIndex);
    if (imgResult) imageItems.push(imgResult);
}

const IGNORED_OPERATORS = new Set([
    'RG', 'G', 'K', 'CS', 'cs', 'SCN', 'SC', 'ri', 'gs',
    'w', 'J', 'j', 'M', 'd', 'i', 'W', 'W*', 'n',
    'm', 'l', 'c', 'v', 'y', 'h', 're', 'S', 's',
    'f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'sh', 'EI',
    'BMC', 'BDC', 'EMC', 'MP', 'DP',
]);

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
        case 'Tf': {
            gs.fontSize = popNumber();
            const fontNameToken = operandStack.pop() || '';
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

interface ContentExtractionContext {
    reader: PdfReader;
    fontInfoMap: Map<string, FontInfo>;
    xObjectDict: Record<string, PdfObject>;
    textItems: TextItem[];
    imageItems: ImageItem[];
    stateStack: GraphicsState[];
    gs: GraphicsState;
    operandStack: string[];
    pageIndex: number;
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

function processStateToken(token: string, ctx: ContentExtractionContext): boolean {
    if (token === 'q') { ctx.stateStack.push(structuredClone(ctx.gs)); return true; }
    if (token === 'Q') {
        if (ctx.stateStack.length > 0) {
            ctx.gs = ctx.stateStack.pop()!;
        }
        return true;
    }
    if (token === 'BT') { ctx.gs.textMatrix = identityMatrix(); ctx.gs.lineMatrix = identityMatrix(); return true; }
    if (token === 'ET') return true;
    return false;
}

function processTextShowToken(token: string, ctx: ContentExtractionContext): boolean {
    if (token === 'Tj') {
        processTextShow(popString(ctx), ctx.gs, ctx.fontInfoMap, ctx.textItems, ctx.pageIndex);
        return true;
    }
    if (token === "'") {
        ctx.gs.textMatrix = multiplyMatrix([1, 0, 0, 1, 0, -ctx.gs.leading], ctx.gs.lineMatrix);
        ctx.gs.lineMatrix = ctx.gs.textMatrix.slice();
        processTextShow(popString(ctx), ctx.gs, ctx.fontInfoMap, ctx.textItems, ctx.pageIndex);
        return true;
    }
    if (token === '"') {
        const raw = popString(ctx);
        ctx.gs.charSpacing = popNumber(ctx); ctx.gs.wordSpacing = popNumber(ctx);
        ctx.gs.textMatrix = multiplyMatrix([1, 0, 0, 1, 0, -ctx.gs.leading], ctx.gs.lineMatrix);
        ctx.gs.lineMatrix = ctx.gs.textMatrix.slice();
        processTextShow(raw, ctx.gs, ctx.fontInfoMap, ctx.textItems, ctx.pageIndex);
        return true;
    }
    if (token === 'TJ') {
        processTJOperator(ctx.operandStack, ctx.gs, ctx.fontInfoMap, ctx.textItems, ctx.pageIndex);
        return true;
    }
    return false;
}

function processResourceToken(token: string, ctx: ContentExtractionContext, tokens: string[], tokenIndex: number): number {
    if (token === 'Do') {
        processDoOperator(ctx.operandStack, ctx.reader, ctx.xObjectDict, ctx.gs, ctx.imageItems, ctx.pageIndex);
        return tokenIndex;
    }
    if (token === 'BI') {
        const inlineImgResult = parseInlineImage(tokens, tokenIndex - 1, ctx.gs.ctm, ctx.pageIndex);
        if (inlineImgResult) {
            if (inlineImgResult.imageItem) ctx.imageItems.push(inlineImgResult.imageItem);
            return inlineImgResult.newIndex + 1;
        }
        return tokenIndex;
    }
    return -1;
}

function processContentToken(token: string, ctx: ContentExtractionContext, tokens: string[], tokenIndex: number): number {
    if (processStateToken(token, ctx)) return tokenIndex;
    if (processMatrixOperator(token, ctx.gs, () => popNumber(ctx))) return tokenIndex;
    if (processTextStateOperator(token, ctx.gs, ctx.operandStack, () => popNumber(ctx))) return tokenIndex;
    if (processTextShowToken(token, ctx)) return tokenIndex;
    if (processColorOperator(token, ctx.operandStack, ctx.gs, () => popNumber(ctx))) return tokenIndex;

    const resourceResult = processResourceToken(token, ctx, tokens, tokenIndex);
    if (resourceResult >= 0) return resourceResult;

    if (IGNORED_OPERATORS.has(token)) { ctx.operandStack.length = 0; return tokenIndex; }

    ctx.operandStack.push(token);
    return tokenIndex;
}

function extractPageContent(
    reader: PdfReader,
    pageObj: PdfObject,
    pageIndex: number,
): { textItems: TextItem[]; imageItems: ImageItem[] } {
    const pageDict = reader.getDict(pageObj);
    const contentsObj = pageDict['Contents'];
    if (!contentsObj) return { textItems: [], imageItems: [] };

    const contentData = resolveContentData(reader, contentsObj);
    if (contentData.length === 0) return { textItems: [], imageItems: [] };

    const resources = pageDict['Resources'] ? reader.getDict(pageDict['Resources']) : {};
    const fontDict = resources['Font'] ? reader.getDict(resources['Font']) : {};
    const xObjectDict = resources['XObject'] ? reader.getDict(resources['XObject']) : {};

    const fontInfoMap = new Map<string, FontInfo>();
    for (const [fontName, fontRef] of Object.entries(fontDict)) {
        fontInfoMap.set(fontName, buildFontInfo(reader, fontRef));
    }

    const tokens = tokenizeContentStream(contentData);
    const ctx: ContentExtractionContext = {
        reader,
        fontInfoMap,
        xObjectDict,
        textItems: [],
        imageItems: [],
        stateStack: [],
        gs: {
            ctm: identityMatrix(), fontSize: 12, fontName: '', fillColor: '#000000',
            textMatrix: identityMatrix(), lineMatrix: identityMatrix(),
            leading: 0, charSpacing: 0, wordSpacing: 0, textRise: 0, horizontalScaling: 100,
        },
        operandStack: [],
        pageIndex,
    };

    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];
        i++;
        i = processContentToken(token, ctx, tokens, i);
    }

    return { textItems: ctx.textItems, imageItems: ctx.imageItems };
}

function resolveImageFilterName(reader: PdfReader, dict: Record<string, PdfObject>): string {
    const filterObj = dict['Filter'];
    if (!filterObj) return '';
    const filterResolved = reader.resolveDeep(filterObj);
    if (filterResolved.type === 'name') return filterResolved.value as string;
    if (filterResolved.type !== 'array') return '';
    const arr = filterResolved.value as PdfObject[];
    if (arr.length === 0) return '';
    const last = reader.resolveDeep(arr.at(-1)!);
    return last.type === 'name' ? last.value as string : '';
}

function buildImageDataUrl(
    filterName: string, xObj: PdfObject, reader: PdfReader,
    width: number, height: number, dict: Record<string, PdfObject>,
): string | null {
    if (filterName === 'DCTDecode') {
        return `data:image/jpeg;base64,${uint8ArrayToBase64(xObj.stream!)}`;
    }
    if (filterName === 'JPXDecode') {
        return `data:image/jp2;base64,${uint8ArrayToBase64(xObj.stream!)}`;
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
        if (isDefaultColor(sorted[i].color)) {
            result += text;
        } else {
            result += `<span style="color: ${sorted[i].color}">${text}</span>`;
        }
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
        const { bestGap, splitX } = findBestColumnGap(startXs);

        const pageWidth = Math.max(...pageLines.map(l =>
            Math.max(...l.items.map(it => it.endX))
        )) - Math.min(...startXs);

        if (bestGap < pageWidth * 0.15 || bestGap < 50) {
            result.push(...pageLines);
            continue;
        }

        result.push(...classifyLinesByColumn(pageLines, splitX));
    }

    return result;
}

const BULLET_PATTERN = /^[\u2022\u2023\u25E6\u2043\u2219\u25CF\u25CB\u25AA\u25AB\u2013\u2014\-*]\s*/;
const NUMBERED_PATTERN = /^(\d{1,3})[.)]\s+/;

interface HtmlBuilderState {
    html: string[];
    inBulletList: boolean;
    inNumberedList: boolean;
    currentParagraph: string[];
    currentParagraphRTL: boolean;
    lastY: number | null;
    lastPage: number;
    lastLineSpacing: number;
    imageIdx: number;
}

function flushParagraph(state: HtmlBuilderState): void {
    if (state.currentParagraph.length === 0) return;
    const text = state.currentParagraph.join(' ');
    const dir = state.currentParagraphRTL ? ' dir="rtl"' : '';
    state.html.push(`<p${dir}>${text}</p>`);
    state.currentParagraph = [];
    state.currentParagraphRTL = false;
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
        state.html.push(`<img src="${img.dataUrl}" width="${img.width}" height="${img.height}" alt="Embedded image" />`);
        state.imageIdx++;
    }
}

function renderLineAsHeading(state: HtmlBuilderState, line: TextLine, headingLevel: number, dir: string): void {
    flushParagraph(state);
    closeList(state);
    const content = lineToHtmlContent(line);
    state.html.push(`<h${headingLevel}${dir}>${content}</h${headingLevel}>`);
}

function renderLineAsBullet(state: HtmlBuilderState, lineText: string, dir: string): void {
    flushParagraph(state);
    if (state.inNumberedList) { state.html.push('</ol>'); state.inNumberedList = false; }
    if (!state.inBulletList) { state.html.push(`<ul${dir}>`); state.inBulletList = true; }
    state.html.push(`<li>${escapeHtml(lineText.replace(BULLET_PATTERN, ''))}</li>`);
}

function renderLineAsNumbered(state: HtmlBuilderState, lineText: string, dir: string): void {
    flushParagraph(state);
    if (state.inBulletList) { state.html.push('</ul>'); state.inBulletList = false; }
    if (!state.inNumberedList) { state.html.push(`<ol${dir}>`); state.inNumberedList = true; }
    state.html.push(`<li>${escapeHtml(lineText.replace(NUMBERED_PATTERN, ''))}</li>`);
}

function processHtmlLine(
    line: TextLine, lineText: string, bodySize: number,
    state: HtmlBuilderState, isParagraphBreak: boolean, isPageBreak: boolean,
): void {
    const largeGapIdx = findLargeGapIndex(line);
    const rtl = isLineRTL(line);
    const dir = rtl ? ' dir="rtl"' : '';

    if (largeGapIdx > 0) {
        flushParagraph(state);
        closeList(state);
        state.html.push(lineToTableRowHtml(line, largeGapIdx, bodySize));
        return;
    }

    const primaryFontSize = line.items.reduce((max, item) => Math.max(max, item.fontSize), 0);
    const headingLevel = getHeadingLevel(primaryFontSize, bodySize);
    if (headingLevel > 0) {
        renderLineAsHeading(state, line, headingLevel, dir);
        return;
    }

    if (BULLET_PATTERN.exec(lineText)) {
        renderLineAsBullet(state, lineText, dir);
        return;
    }
    if (NUMBERED_PATTERN.exec(lineText)) {
        renderLineAsNumbered(state, lineText, dir);
        return;
    }

    closeList(state);
    if (isParagraphBreak || isPageBreak) {
        flushParagraph(state);
    }
    if (rtl) state.currentParagraphRTL = true;
    state.currentParagraph.push(lineToHtmlContent(line));
}

function textItemsToHtml(
    textItems: TextItem[],
    imageItems: ImageItem[],
): string {
    const rawLines = groupIntoLines(textItems);
    if (rawLines.length === 0) return '';
    const lines = detectColumns(rawLines);
    const bodySize = detectBodyFontSize(textItems);

    const sortedImages = [...imageItems].sort((a, b) =>
        a.page === b.page ? b.y - a.y : a.page - b.page
    );

    const state: HtmlBuilderState = {
        html: [], inBulletList: false, inNumberedList: false,
        currentParagraph: [], currentParagraphRTL: false,
        lastY: null, lastPage: -1, lastLineSpacing: 0, imageIdx: 0,
    };

    for (const line of lines) {
        const lineText = lineToText(line);
        if (!lineText) continue;

        insertImagesBeforeY(state, sortedImages, line.items[0].page, line.y);

        const lineSpacing = state.lastY !== null && line.items[0].page === state.lastPage
            ? Math.abs(state.lastY - line.y) : 0;
        const isParagraphBreak = state.lastY !== null &&
            line.items[0].page === state.lastPage &&
            state.lastLineSpacing > 0 &&
            lineSpacing > state.lastLineSpacing * 1.5;
        const isPageBreak = state.lastPage !== -1 && line.items[0].page !== state.lastPage;

        processHtmlLine(line, lineText, bodySize, state, isParagraphBreak, isPageBreak);

        if (lineSpacing > 0) state.lastLineSpacing = lineSpacing;
        state.lastY = line.y;
        state.lastPage = line.items[0].page;
    }

    flushParagraph(state);
    closeList(state);

    while (state.imageIdx < sortedImages.length) {
        const img = sortedImages[state.imageIdx];
        state.html.push(`<img src="${img.dataUrl}" width="${img.width}" height="${img.height}" alt="Embedded image" />`);
        state.imageIdx++;
    }

    return state.html.join('\n');
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
        allImageItems.sort((a, b) => a.page === b.page ? b.y - a.y : a.page - b.page);
        const imgTags = allImageItems
            .map(img => `<img src="${img.dataUrl}" width="${img.width}" height="${img.height}" alt="Page image" />`)
            .join('\n');
        return { html: imgTags, text: '', imageOnly: true };
    }

    if (allTextItems.length === 0) {
        throw new Error('No readable content found in PDF.');
    }

    const html = textItemsToHtml(allTextItems, allImageItems);
    allTextItems.sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
        return a.x - b.x;
    });
    const plainText = allTextItems
        .map(item => item.text)
        .join(' ')
        .replaceAll(/\s+/g, ' ')
        .trim();

    return { html, text: plainText, imageOnly: false };
}

// ── Paged PDF parsing ───────────────────────────────────────────────────

export interface PdfPageResult {
    readonly html: string;
    readonly text: string;
    readonly imageOnly: boolean;
    readonly pageIndex: number;
}

export interface PdfParseResultPaged {
    readonly pages: ReadonlyArray<PdfPageResult>;
    readonly totalPages: number;
    readonly html: string;
    readonly text: string;
    readonly imageOnly: boolean;
}

function buildPageResult(pageTextItems: TextItem[], pageImageItems: ImageItem[], pageIndex: number): PdfPageResult {
    if (pageTextItems.length === 0 && pageImageItems.length > 0) {
        const sortedImages = [...pageImageItems].sort((a, b) => b.y - a.y);
        const imgTags = sortedImages
            .map(img => `<img src="${img.dataUrl}" width="${img.width}" height="${img.height}" alt="Page image" />`)
            .join('\n');
        return { html: imgTags, text: '', imageOnly: true, pageIndex };
    }

    if (pageTextItems.length === 0) {
        return { html: '', text: '', imageOnly: false, pageIndex };
    }

    const html = textItemsToHtml(pageTextItems, pageImageItems);
    const sorted = [...pageTextItems].sort((a, b) => {
        if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
        return a.x - b.x;
    });
    const text = sorted.map(item => item.text).join(' ').replaceAll(/\s+/g, ' ').trim();

    return { html, text, imageOnly: false, pageIndex };
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

    const pages: PdfPageResult[] = [];
    const allTextParts: string[] = [];
    const allHtmlParts: string[] = [];
    let allImageOnly = true;

    for (let i = 0; i < pdfPages.length; i++) {
        try {
            const { textItems, imageItems } = extractPageContent(reader, pdfPages[i], i);
            const pageResult = buildPageResult(textItems, imageItems, i);
            pages.push(pageResult);

            if (pageResult.html) allHtmlParts.push(pageResult.html);
            if (pageResult.text) allTextParts.push(pageResult.text);
            if (!pageResult.imageOnly || pageResult.text) allImageOnly = false;
        } catch {
            pages.push({ html: '', text: '', imageOnly: false, pageIndex: i });
        }
    }

    return {
        pages,
        totalPages: pages.length,
        html: allHtmlParts.join('\n'),
        text: allTextParts.join(' '),
        imageOnly: allImageOnly && pages.length > 0,
    };
}
