import { readOle2 } from './ole2-reader';

export interface DocParagraphElement {
    readonly type: 'paragraph';
    readonly text: string;
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly rtl?: boolean;
}

export interface DocParseResult {
    readonly elements: ReadonlyArray<DocParagraphElement>;
    readonly plainText: string;
}

/** Word paragraph mark character code */
const PARAGRAPH_MARK = 0x0D;

/** Minimum nFib value for Word 97+ piece table support */
const NFIB_WORD97 = 0x00C1;

/** Pcdt marker byte in CLX structure */
const PCDT_MARKER = 0x02;

/** Prc marker byte in CLX structure */
const PRC_MARKER = 0x01;

/** Bit mask to test if fc indicates compressed (ANSI) text */
const FC_COMPRESSED_BIT = 0x40000000;

/** Bit mask to extract the actual file offset from fc */
const FC_OFFSET_MASK = 0x3FFFFFFF;

/** Size of a single Piece Descriptor (PCD) in bytes */
const PCD_SIZE = 8;

interface FibHeader {
    readonly wIdent: number;
    readonly nFib: number;
    readonly fWhichTblStm: number;
    readonly fcMin: number;
    readonly fcMac: number;
    readonly ccpText: number;
    readonly fcClx: number;
    readonly lcbClx: number;
}

interface PieceDescriptor {
    readonly cpStart: number;
    readonly cpEnd: number;
    readonly fcCompressed: boolean;
    readonly fileOffset: number;
}

function readU16(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
}

function readU32(data: Uint8Array, offset: number): number {
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function parseFibHeader(wordDoc: Uint8Array): FibHeader {
    const wIdent = readU16(wordDoc, 0);
    const nFib = readU16(wordDoc, 2);

    const flagsWord = readU16(wordDoc, 0x000A);
    const fWhichTblStm = (flagsWord >> 9) & 1;

    const fcMin = readU32(wordDoc, 24);
    const fcMac = readU32(wordDoc, 28);
    const ccpText = readU32(wordDoc, 76);

    const fcClx = readU32(wordDoc, 0x01A2);
    const lcbClx = readU32(wordDoc, 0x01A6);

    return { wIdent, nFib, fWhichTblStm, fcMin, fcMac, ccpText, fcClx, lcbClx };
}

function getTableStreamName(fWhichTblStm: number): string {
    return fWhichTblStm === 1 ? '1Table' : '0Table';
}

function skipPrcEntries(clxData: Uint8Array, startOffset: number, clxLength: number): number {
    let offset = startOffset;

    while (offset < clxLength) {
        const marker = clxData[offset];
        if (marker === PCDT_MARKER) {
            return offset;
        }
        if (marker !== PRC_MARKER) {
            return offset;
        }
        offset += 1;
        if (offset + 2 > clxLength) {
            return offset;
        }
        const prcLength = readU16(clxData, offset);
        offset += 2 + prcLength;
    }

    return offset;
}

function parsePcdtPieces(clxData: Uint8Array, pcdtOffset: number): ReadonlyArray<PieceDescriptor> {
    const pcdtDataOffset = pcdtOffset + 1;
    if (pcdtDataOffset + 4 > clxData.length) {
        return [];
    }

    const pcdtLength = readU32(clxData, pcdtDataOffset);
    const plcPcdStart = pcdtDataOffset + 4;
    const plcPcdEnd = Math.min(plcPcdStart + pcdtLength, clxData.length);

    return extractPieceDescriptors(clxData, plcPcdStart, plcPcdEnd);
}

function extractPieceDescriptors(
    clxData: Uint8Array,
    plcPcdStart: number,
    plcPcdEnd: number,
): ReadonlyArray<PieceDescriptor> {
    const plcPcdLength = plcPcdEnd - plcPcdStart;
    const pieceCount = computePieceCount(plcPcdLength);

    if (pieceCount <= 0) {
        return [];
    }

    const pieces: PieceDescriptor[] = [];
    const cpArrayStart = plcPcdStart;
    const pcdArrayStart = plcPcdStart + (pieceCount + 1) * 4;

    for (let i = 0; i < pieceCount; i++) {
        const cpStart = readU32(clxData, cpArrayStart + i * 4);
        const cpEnd = readU32(clxData, cpArrayStart + (i + 1) * 4);
        const pcdOffset = pcdArrayStart + i * PCD_SIZE;

        if (pcdOffset + PCD_SIZE > clxData.length) {
            break;
        }

        const fcValue = readU32(clxData, pcdOffset + 2);
        const fcCompressed = (fcValue & FC_COMPRESSED_BIT) !== 0;
        const fileOffset = fcCompressed
            ? (fcValue & FC_OFFSET_MASK) >>> 1
            : fcValue & FC_OFFSET_MASK;

        pieces.push({ cpStart, cpEnd, fcCompressed, fileOffset });
    }

    return pieces;
}

function computePieceCount(plcPcdLength: number): number {
    return Math.floor((plcPcdLength - 4) / (4 + PCD_SIZE));
}

function readPieceText(wordDoc: Uint8Array, piece: PieceDescriptor): string {
    const charCount = piece.cpEnd - piece.cpStart;

    if (piece.fcCompressed) {
        return readAnsiText(wordDoc, piece.fileOffset, charCount);
    }

    return readUnicodeText(wordDoc, piece.fileOffset, charCount);
}

function readAnsiText(data: Uint8Array, offset: number, charCount: number): string {
    const chars: string[] = [];
    const end = Math.min(offset + charCount, data.length);

    for (let i = offset; i < end; i++) {
        chars.push(String.fromCodePoint(data[i]));
    }

    return chars.join('');
}

function readUnicodeText(data: Uint8Array, offset: number, charCount: number): string {
    const chars: string[] = [];
    const byteEnd = Math.min(offset + charCount * 2, data.length - 1);

    for (let i = offset; i < byteEnd; i += 2) {
        const code = data[i] | (data[i + 1] << 8);
        chars.push(String.fromCodePoint(code));
    }

    return chars.join('');
}

function extractTextViaPieceTable(
    wordDoc: Uint8Array,
    tableStream: Uint8Array,
    fib: FibHeader,
): string | null {
    if (fib.nFib < NFIB_WORD97 || fib.lcbClx === 0) {
        return null;
    }

    if (fib.fcClx + fib.lcbClx > tableStream.length) {
        return null;
    }

    const clxData = tableStream.subarray(fib.fcClx, fib.fcClx + fib.lcbClx);
    const pcdtOffset = skipPrcEntries(clxData, 0, clxData.length);

    if (pcdtOffset >= clxData.length || clxData[pcdtOffset] !== PCDT_MARKER) {
        return null;
    }

    const pieces = parsePcdtPieces(clxData, pcdtOffset);
    if (pieces.length === 0) {
        return null;
    }

    return assemblePieceText(wordDoc, pieces, fib.ccpText);
}

function assemblePieceText(
    wordDoc: Uint8Array,
    pieces: ReadonlyArray<PieceDescriptor>,
    ccpText: number,
): string {
    const textParts: string[] = [];
    let totalChars = 0;

    for (const piece of pieces) {
        if (totalChars >= ccpText) {
            break;
        }
        const text = readPieceText(wordDoc, piece);
        const remaining = ccpText - totalChars;
        const trimmed = text.length > remaining ? text.substring(0, remaining) : text;
        textParts.push(trimmed);
        totalChars += trimmed.length;
    }

    return textParts.join('');
}

function extractTextFallback(wordDoc: Uint8Array, fib: FibHeader): string {
    const start = fib.fcMin;
    const end = Math.min(fib.fcMac, wordDoc.length);

    if (start >= end) {
        return '';
    }

    const unicodeText = readUnicodeText(wordDoc, start, Math.floor((end - start) / 2));
    const ansiText = readAnsiText(wordDoc, start, end - start);

    return pickMoreReadableText(unicodeText, ansiText);
}

function pickMoreReadableText(unicodeText: string, ansiText: string): string {
    const unicodeScore = computeReadabilityScore(unicodeText);
    const ansiScore = computeReadabilityScore(ansiText);

    return unicodeScore >= ansiScore ? unicodeText : ansiText;
}

function computeReadabilityScore(text: string): number {
    let printable = 0;

    for (const char of text) {
        const code = char.codePointAt(0) ?? 0;
        if (isReadableCodePoint(code)) {
            printable++;
        }
    }

    return text.length > 0 ? printable / text.length : 0;
}

function isReadableCodePoint(code: number): boolean {
    return (code >= 0x20 && code <= 0x7E)
        || (code >= 0xA0 && code <= 0xFFFF)
        || code === 0x09
        || code === 0x0A
        || code === 0x0D;
}

function splitIntoParagraphs(rawText: string): ReadonlyArray<string> {
    const paragraphs: string[] = [];
    let current = '';

    for (const char of rawText) {
        if (char.codePointAt(0) === PARAGRAPH_MARK) {
            const trimmed = current.trim();
            if (trimmed.length > 0) {
                paragraphs.push(trimmed);
            }
            current = '';
        } else {
            current += char;
        }
    }

    const remaining = current.trim();
    if (remaining.length > 0) {
        paragraphs.push(remaining);
    }

    return paragraphs;
}

function isRtlText(text: string): boolean {
    let rtlCount = 0;
    let ltrCount = 0;
    for (const char of text) {
        const code = char.codePointAt(0) ?? 0;
        if ((code >= 0x0590 && code <= 0x05FF) || (code >= 0x0600 && code <= 0x06FF) ||
            (code >= 0x0700 && code <= 0x074F) || (code >= 0xFB50 && code <= 0xFDFF) ||
            (code >= 0xFE70 && code <= 0xFEFF)) {
            rtlCount++;
        } else if (code >= 0x0041 && code <= 0x007A) {
            ltrCount++;
        }
    }
    return rtlCount > 0 && rtlCount >= ltrCount;
}

function buildElements(paragraphs: ReadonlyArray<string>): ReadonlyArray<DocParagraphElement> {
    return paragraphs.map(text => ({
        type: 'paragraph' as const,
        text,
        ...(isRtlText(text) ? { rtl: true } : {}),
    }));
}

function buildPlainText(paragraphs: ReadonlyArray<string>): string {
    return paragraphs.join('\n');
}

export function parseDoc(data: Uint8Array): DocParseResult {
    const ole2 = readOle2(data);

    const wordDoc = ole2.streams.get('WordDocument');
    if (!wordDoc) {
        throw new Error('Invalid DOC: missing WordDocument stream');
    }

    const fib = parseFibHeader(wordDoc);

    const tableStreamName = getTableStreamName(fib.fWhichTblStm);
    const tableStream = ole2.streams.get(tableStreamName);

    let rawText = tableStream
        ? extractTextViaPieceTable(wordDoc, tableStream, fib)
        : null;

    if (!rawText) {
        rawText = extractTextFallback(wordDoc, fib);
    }

    const paragraphs = splitIntoParagraphs(rawText);
    const elements = buildElements(paragraphs);
    const plainText = buildPlainText(paragraphs);

    return { elements, plainText };
}
