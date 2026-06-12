import { readOle2 } from './ole2-reader';
import { isValidImageMagicBytes } from './image-validator';
import type {
    DocxParseResult, DocxElement, DocxParagraph, DocxRun, DocxRunStyle,
    DocxTable, DocxTableRow, DocxTableCell, DocxTableCellStyle, DocxTableRowStyle,
    DocxTableBorder, DocxImage, DocxBorder, DocxParagraphBorders,
    DocxVertAlign, DocxListType,
} from './docx-parser';

// ── Section A: Constants & Binary Readers ──────────────────────────────

function readU8(data: Uint8Array, offset: number): number {
    return data[offset];
}

function readU16(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
}

function readU32(data: Uint8Array, offset: number): number {
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

const MAX_FKP_PAGES = 50_000;
const MAX_RUNS = 500_000;
const MAX_STYLES = 4096;
const FKP_PAGE_SIZE = 512;

// Character toggle SPRMs
const sprmCFBold = 0x0835;
const sprmCFItalic = 0x0836;
const sprmCFStrike = 0x0837;
const sprmCFSmallCaps = 0x083A;
const sprmCFCaps = 0x083B;
const sprmCFVanish = 0x083C;
const sprmCFDStrike = 0x2A53;
const sprmCFSpec = 0x0855;

// Character value SPRMs
const sprmCKul = 0x2A3E;
const sprmCHps = 0x4A43;
const sprmCIco = 0x2A42;
const sprmCCv = 0x6870;
const sprmCRgFtc0 = 0x4A4F;
const sprmCRgFtc1 = 0x4A50;
const sprmCRgFtc2 = 0x4A51;
const sprmCIss = 0x2A48;
const sprmCHighlight = 0x2A0C;
const sprmCDxaSpace = 0x8840;
const sprmCShd = 0xCA71;
const sprmCPicLocation = 0x6A03;

// Paragraph SPRMs
const sprmPIstd = 0x4600;
const sprmPJc = 0x2461;
const sprmPJc80 = 0x2403;
const sprmPDyaBefore = 0xA413;
const sprmPDyaAfter = 0xA414;
const sprmPDyaLine = 0x6412;
const sprmPDxaLeft = 0x845E;
const sprmPDxaRight = 0x845D;
const sprmPDxaFirst = 0x8460;
const sprmPFInTable = 0x2416;
const sprmPFTtp = 0x2417;
const sprmPItap = 0x6649;
const sprmPFInnerTableCell = 0x244B;
const sprmPFInnerTtp = 0x244C;
const sprmPIlvl = 0x260A;
const sprmPIlfo = 0x460B;
const sprmPFBiDi = 0x2441;
const sprmPShd = 0xC64D;
const sprmPBrcTop = 0xC64E;
const sprmPBrcLeft = 0xC64F;
const sprmPBrcBottom = 0xC650;
const sprmPBrcRight = 0xC651;

const ICO_PALETTE: ReadonlyArray<string | undefined> = [
    undefined,
    '#000000', '#0000FF', '#00FFFF', '#00FF00',
    '#FF00FF', '#FF0000', '#FFFF00', '#FFFFFF',
    '#000080', '#008080', '#008000', '#800080',
    '#800000', '#808000', '#808080', '#C0C0C0',
];

const HIGHLIGHT_PALETTE: ReadonlyArray<string | undefined> = [
    undefined,
    '#000000', '#0000FF', '#00FFFF', '#00FF00',
    '#FF00FF', '#FF0000', '#FFFF00', '#FFFFFF',
    '#000080', '#008080', '#008000', '#800080',
    '#800000', '#808000', '#808080', '#C0C0C0',
];

const PARAGRAPH_MARK = 0x0D;
const CELL_MARK = 0x07;
const NFIB_WORD97 = 0x00C1;
const PCDT_MARKER = 0x02;
const PRC_MARKER = 0x01;
const FC_COMPRESSED_BIT = 0x40000000;
const FC_OFFSET_MASK = 0x3FFFFFFF;
const PCD_SIZE = 8;

// ── Section B: Extended FIB ────────────────────────────────────────────

interface ExtendedFib {
    readonly wIdent: number;
    readonly nFib: number;
    readonly fWhichTblStm: number;
    readonly fcMin: number;
    readonly fcMac: number;
    readonly ccpText: number;
    readonly fcStshf: number;
    readonly lcbStshf: number;
    readonly fcPlcfBteChpx: number;
    readonly lcbPlcfBteChpx: number;
    readonly fcPlcfBtePapx: number;
    readonly lcbPlcfBtePapx: number;
    readonly fcSttbfFfn: number;
    readonly lcbSttbfFfn: number;
    readonly fcClx: number;
    readonly lcbClx: number;
}

function parseExtendedFib(wordDoc: Uint8Array): ExtendedFib {
    const wIdent = readU16(wordDoc, 0);
    const nFib = readU16(wordDoc, 2);
    const flagsWord = readU16(wordDoc, 0x000A);
    const fWhichTblStm = (flagsWord >> 9) & 1;

    const fcMin = readU32(wordDoc, 24);
    const fcMac = readU32(wordDoc, 28);
    const ccpText = readU32(wordDoc, 76);

    const fcStshf = readU32(wordDoc, 0x00A2);
    const lcbStshf = readU32(wordDoc, 0x00A6);
    const fcPlcfBteChpx = readU32(wordDoc, 0x00FA);
    const lcbPlcfBteChpx = readU32(wordDoc, 0x00FE);
    const fcPlcfBtePapx = readU32(wordDoc, 0x0102);
    const lcbPlcfBtePapx = readU32(wordDoc, 0x0106);
    const fcSttbfFfn = readU32(wordDoc, 0x010A);
    const lcbSttbfFfn = readU32(wordDoc, 0x010E);
    const fcClx = readU32(wordDoc, 0x01A2);
    const lcbClx = readU32(wordDoc, 0x01A6);

    return {
        wIdent, nFib, fWhichTblStm, fcMin, fcMac, ccpText,
        fcStshf, lcbStshf,
        fcPlcfBteChpx, lcbPlcfBteChpx,
        fcPlcfBtePapx, lcbPlcfBtePapx,
        fcSttbfFfn, lcbSttbfFfn,
        fcClx, lcbClx,
    };
}

// ── Section C: Piece Table ─────────────────────────────────────────────

interface PieceDescriptor {
    readonly cpStart: number;
    readonly cpEnd: number;
    readonly fcCompressed: boolean;
    readonly fileOffset: number;
    readonly rawFc: number;
}

interface PieceTableResult {
    readonly text: string;
    readonly pieces: ReadonlyArray<PieceDescriptor>;
}

function skipPrcEntries(clxData: Uint8Array, startOffset: number, clxLength: number): number {
    let offset = startOffset;
    while (offset < clxLength) {
        const marker = clxData[offset];
        if (marker === PCDT_MARKER) return offset;
        if (marker !== PRC_MARKER) return offset;
        offset += 1;
        if (offset + 2 > clxLength) return offset;
        const prcLength = readU16(clxData, offset);
        offset += 2 + prcLength;
    }
    return offset;
}

function parsePieceTable(
    wordDoc: Uint8Array,
    tableStream: Uint8Array,
    fib: ExtendedFib,
): PieceTableResult | null {
    if (fib.nFib < NFIB_WORD97 || fib.lcbClx === 0) return null;
    if (fib.fcClx + fib.lcbClx > tableStream.length) return null;

    const clxData = tableStream.subarray(fib.fcClx, fib.fcClx + fib.lcbClx);
    const pcdtOffset = skipPrcEntries(clxData, 0, clxData.length);

    if (pcdtOffset >= clxData.length || clxData[pcdtOffset] !== PCDT_MARKER) return null;

    const pcdtDataOffset = pcdtOffset + 1;
    if (pcdtDataOffset + 4 > clxData.length) return null;

    const pcdtLength = readU32(clxData, pcdtDataOffset);
    const plcPcdStart = pcdtDataOffset + 4;
    const plcPcdEnd = Math.min(plcPcdStart + pcdtLength, clxData.length);

    const plcPcdLength = plcPcdEnd - plcPcdStart;
    const pieceCount = Math.floor((plcPcdLength - 4) / (4 + PCD_SIZE));
    if (pieceCount <= 0) return null;

    const pieces: PieceDescriptor[] = [];
    const cpArrayStart = plcPcdStart;
    const pcdArrayStart = plcPcdStart + (pieceCount + 1) * 4;
    const textParts: string[] = [];
    let totalChars = 0;

    for (let i = 0; i < pieceCount; i++) {
        const cpStart = readU32(clxData, cpArrayStart + i * 4);
        const cpEnd = readU32(clxData, cpArrayStart + (i + 1) * 4);
        const pcdOffset = pcdArrayStart + i * PCD_SIZE;
        if (pcdOffset + PCD_SIZE > clxData.length) break;

        const fcValue = readU32(clxData, pcdOffset + 2);
        const fcCompressed = (fcValue & FC_COMPRESSED_BIT) !== 0;
        const rawFc = fcValue & FC_OFFSET_MASK;
        const fileOffset = fcCompressed ? rawFc >>> 1 : rawFc;

        pieces.push({ cpStart, cpEnd, fcCompressed, fileOffset, rawFc });

        if (totalChars >= fib.ccpText) continue;
        const charCount = cpEnd - cpStart;
        const remaining = fib.ccpText - totalChars;
        const charsToRead = Math.min(charCount, remaining);

        const text = fcCompressed
            ? readAnsiText(wordDoc, fileOffset, charsToRead)
            : readUnicodeText(wordDoc, fileOffset, charsToRead);
        textParts.push(text);
        totalChars += charsToRead;
    }

    return { text: textParts.join(''), pieces };
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

function cpToFc(cp: number, pieces: ReadonlyArray<PieceDescriptor>): number | null {
    for (const p of pieces) {
        if (cp >= p.cpStart && cp < p.cpEnd) {
            const delta = cp - p.cpStart;
            return p.fcCompressed ? p.rawFc + delta : p.rawFc + delta * 2;
        }
    }
    return null;
}

function fcToCp(fc: number, pieces: ReadonlyArray<PieceDescriptor>): number | null {
    for (const p of pieces) {
        const fcStart = p.rawFc;
        const fcEnd = p.fcCompressed
            ? p.rawFc + (p.cpEnd - p.cpStart)
            : p.rawFc + (p.cpEnd - p.cpStart) * 2;
        if (fc >= fcStart && fc < fcEnd) {
            const delta = p.fcCompressed ? fc - fcStart : (fc - fcStart) / 2;
            return p.cpStart + Math.floor(delta);
        }
    }
    return null;
}

// ── Section D: Font Table ──────────────────────────────────────────────

function parseFontTable(tableStream: Uint8Array, fc: number, lcb: number): ReadonlyArray<string> {
    if (lcb === 0 || fc + lcb > tableStream.length) return [];

    const fonts: string[] = [];
    let offset = fc;
    const end = fc + lcb;

    const cData = readU16(tableStream, offset);
    offset += 2;
    const extraDataSize = readU16(tableStream, offset);
    offset += 2;

    if (cData === 0xFFFF) {
        offset += extraDataSize;
    }

    while (offset < end && fonts.length < MAX_STYLES) {
        if (offset + 1 > end) break;
        const cbFfnM1 = readU8(tableStream, offset);
        const entryEnd = offset + 1 + cbFfnM1;
        if (entryEnd > end) break;

        const nameOffset = offset + 1 + 40;
        if (nameOffset < entryEnd) {
            const name = readUtf16String(tableStream, nameOffset, entryEnd);
            fonts.push(name);
        } else {
            fonts.push('');
        }

        offset = entryEnd;
    }

    return fonts;
}

function readUtf16String(data: Uint8Array, start: number, maxEnd: number): string {
    const chars: string[] = [];
    for (let i = start; i + 1 < maxEnd; i += 2) {
        const code = data[i] | (data[i + 1] << 8);
        if (code === 0) break;
        chars.push(String.fromCodePoint(code));
    }
    return chars.join('');
}

// ── Section E: Stylesheet ──────────────────────────────────────────────

interface DocStyleDef {
    readonly istd: number;
    readonly name: string;
    readonly istdBase: number;
    readonly styleKind: number;
    readonly charSprms: Uint8Array | null;
    readonly paraSprms: Uint8Array | null;
}

function parseStylesheet(tableStream: Uint8Array, fc: number, lcb: number): ReadonlyArray<DocStyleDef> {
    if (lcb === 0 || fc + lcb > tableStream.length) return [];

    const styles: DocStyleDef[] = [];
    let offset = fc;
    const end = fc + lcb;

    if (offset + 2 > end) return [];
    const cbStshi = readU16(tableStream, offset);
    offset += 2;

    if (offset + cbStshi > end) return [];
    const stshiStart = offset;

    const cstd = cbStshi >= 2 ? readU16(tableStream, stshiStart) : 0;
    offset += cbStshi;

    const styleCount = Math.min(cstd, MAX_STYLES);

    for (let i = 0; i < styleCount; i++) {
        if (offset + 2 > end) break;
        const cbStd = readU16(tableStream, offset);
        offset += 2;

        if (cbStd === 0) {
            styles.push({ istd: i, name: '', istdBase: 0xFFF, styleKind: 0, charSprms: null, paraSprms: null });
            continue;
        }

        const stdEnd = offset + cbStd;
        if (stdEnd > end) break;

        const parsed = parseSingleStyle(tableStream, offset, stdEnd, i);
        styles.push(parsed);
        offset = stdEnd;
    }

    return styles;
}

function parseSingleStyle(data: Uint8Array, start: number, end: number, istd: number): DocStyleDef {
    if (start + 4 > end) {
        return { istd, name: '', istdBase: 0xFFF, styleKind: 0, charSprms: null, paraSprms: null };
    }

    const sti = readU16(data, start) & 0x0FFF;
    const styleKind = (readU16(data, start) >> 12) & 0x0F;
    const istdBase = readU16(data, start + 2) & 0x0FFF;

    let offset = start + 4;
    if (offset + 2 > end) {
        return { istd, name: '', istdBase, styleKind, charSprms: null, paraSprms: null };
    }

    offset = start + 10;
    if (offset > end) offset = start + 4;

    const nameResult = readStyleName(data, offset, end, sti);
    const name = nameResult.name;
    offset = nameResult.offset;

    const upxResult = parseUpxArrays(data, offset, end, styleKind);

    return { istd, name, istdBase, styleKind, charSprms: upxResult.charSprms, paraSprms: upxResult.paraSprms };
}

function readStyleName(
    data: Uint8Array,
    startOffset: number,
    end: number,
    sti: number,
): { readonly name: string; readonly offset: number } {
    let offset = startOffset;
    let name = '';

    if (offset < end) {
        const nameLen = readU16(data, offset);
        offset += 2;
        if (offset + nameLen * 2 <= end) {
            name = readUtf16String(data, offset, offset + nameLen * 2);
            offset += nameLen * 2;
            if (offset + 2 <= end) offset += 2;
        }
    }

    if (!name && sti < 10) {
        name = getBuiltInStyleName(sti);
    }

    return { name, offset };
}

function parseUpxArrays(
    data: Uint8Array,
    startOffset: number,
    end: number,
    styleKind: number,
): { readonly paraSprms: Uint8Array | null; readonly charSprms: Uint8Array | null } {
    let offset = startOffset;
    let paraSprms: Uint8Array | null = null;
    let charSprms: Uint8Array | null = null;

    if (styleKind === 1 && offset + 2 <= end) {
        const cbUpx = readU16(data, offset);
        offset += 2;
        if (cbUpx > 2 && offset + cbUpx <= end) {
            paraSprms = data.subarray(offset + 2, offset + cbUpx);
        }
        offset += cbUpx;
        if (offset % 2 !== 0) offset++;
    }

    if (offset + 2 <= end) {
        const cbUpx = readU16(data, offset);
        offset += 2;
        if (cbUpx > 0 && offset + cbUpx <= end) {
            charSprms = data.subarray(offset, offset + cbUpx);
        }
    }

    return { paraSprms, charSprms };
}

function getBuiltInStyleName(sti: number): string {
    const names: ReadonlyArray<string> = [
        'Normal', 'heading 1', 'heading 2', 'heading 3',
        'heading 4', 'heading 5', 'heading 6', 'heading 7',
        'heading 8', 'heading 9',
    ];
    return sti < names.length ? names[sti] : '';
}

// ── Section F: SPRM Parsing Engine ─────────────────────────────────────

interface SprmEntry {
    readonly opcode: number;
    readonly operand: number;
    readonly operandBytes: Uint8Array | null;
}

interface CharProps {
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly underline?: boolean;
    readonly strikethrough?: boolean;
    readonly doubleStrikethrough?: boolean;
    readonly caps?: boolean;
    readonly smallCaps?: boolean;
    readonly hidden?: boolean;
    readonly fontSize?: number;
    readonly color?: string;
    readonly fontIndex?: number;
    readonly vertAlign?: DocxVertAlign;
    readonly highlight?: string;
    readonly charSpacing?: number;
    readonly backgroundColor?: string;
    readonly isSpecialChar?: boolean;
    readonly picLocation?: number;
}

interface ParaProps {
    readonly istd?: number;
    readonly alignment?: string;
    readonly spacingBefore?: number;
    readonly spacingAfter?: number;
    readonly lineSpacing?: number;
    readonly indentLeft?: number;
    readonly indentRight?: number;
    readonly indentFirst?: number;
    readonly inTable?: boolean;
    readonly isTtp?: boolean;
    readonly tableDepth?: number;
    readonly isInnerCell?: boolean;
    readonly isInnerTtp?: boolean;
    readonly listLevel?: number;
    readonly listId?: number;
    readonly rtl?: boolean;
    readonly shading?: string;
    readonly borderTop?: DocxBorder;
    readonly borderLeft?: DocxBorder;
    readonly borderBottom?: DocxBorder;
    readonly borderRight?: DocxBorder;
}

interface TableRowProps {
    readonly rowHeight?: number;
    readonly cellWidths?: ReadonlyArray<number>;
    readonly isHeader?: boolean;
    readonly tableBorders?: {
        readonly top?: DocxTableBorder;
        readonly bottom?: DocxTableBorder;
        readonly left?: DocxTableBorder;
        readonly right?: DocxTableBorder;
        readonly insideH?: DocxTableBorder;
        readonly insideV?: DocxTableBorder;
    };
    readonly cellBorders?: ReadonlyArray<{
        readonly top?: DocxTableBorder;
        readonly bottom?: DocxTableBorder;
        readonly left?: DocxTableBorder;
        readonly right?: DocxTableBorder;
    }>;
    readonly cellShadings?: ReadonlyArray<string>;
}

function getSprmOperandSize(opcode: number): number {
    const spra = (opcode >> 13) & 0x07;
    switch (spra) {
        case 0: return 1;
        case 1: return 1;
        case 2: return 2;
        case 3: return 4;
        case 4: return 2;
        case 5: return 2;
        case 6: return -1; // variable
        case 7: return 3;
        default: return 1;
    }
}

function parseGrpprl(data: Uint8Array, offset: number, length: number): ReadonlyArray<SprmEntry> {
    const entries: SprmEntry[] = [];
    const end = offset + length;
    let pos = offset;

    while (pos + 2 <= end && entries.length < 500) {
        const opcode = readU16(data, pos);
        pos += 2;

        const size = getSprmOperandSize(opcode);

        if (size === -1) {
            const result = parseVariableLengthSprm(data, pos, end, opcode);
            if (!result) break;
            entries.push(result.entry);
            pos = result.nextPos;
        } else {
            if (pos + size > end) break;
            entries.push(parseFixedLengthSprm(data, pos, opcode, size));
            pos += size;
        }
    }

    return entries;
}

function parseVariableLengthSprm(
    data: Uint8Array,
    pos: number,
    end: number,
    opcode: number,
): { readonly entry: SprmEntry; readonly nextPos: number } | null {
    if (pos >= end) return null;
    const cb = readU8(data, pos);
    pos += 1;
    if (pos + cb > end) return null;
    const operandBytes = data.subarray(pos, pos + cb);
    return { entry: { opcode, operand: cb, operandBytes }, nextPos: pos + cb };
}

function parseFixedLengthSprm(data: Uint8Array, pos: number, opcode: number, size: number): SprmEntry {
    const operand = readFixedOperand(data, pos, size);
    const operandBytes = size >= 3 ? data.subarray(pos, pos + size) : null;
    return { opcode, operand, operandBytes };
}

function readFixedOperand(data: Uint8Array, pos: number, size: number): number {
    if (size === 1) return readU8(data, pos);
    if (size === 2) return readU16(data, pos);
    if (size === 4) return readU32(data, pos);
    if (size === 3) return data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16);
    return 0;
}

function applyCharSprms(sprms: ReadonlyArray<SprmEntry>, base: CharProps): CharProps {
    let props = { ...base };
    for (const sprm of sprms) {
        props = applyCharToggle(props, sprm.opcode, sprm.operand);
        props = applyCharValue(props, sprm.opcode, sprm.operand, sprm.operandBytes);
    }
    return props;
}

function applyCharToggle(props: CharProps, opcode: number, val: number): CharProps {
    const boolVal = val === 1 || val === 0x80 || val === 0x81;
    switch (opcode) {
        case sprmCFBold: return { ...props, bold: boolVal };
        case sprmCFItalic: return { ...props, italic: boolVal };
        case sprmCFStrike: return { ...props, strikethrough: boolVal };
        case sprmCFSmallCaps: return { ...props, smallCaps: boolVal };
        case sprmCFCaps: return { ...props, caps: boolVal };
        case sprmCFVanish: return { ...props, hidden: boolVal };
        case sprmCFDStrike: return { ...props, doubleStrikethrough: boolVal };
        case sprmCFSpec: return { ...props, isSpecialChar: boolVal };
        default: return props;
    }
}

function applyCharValue(props: CharProps, opcode: number, val: number, bytes: Uint8Array | null): CharProps {
    switch (opcode) {
        case sprmCKul:
            return { ...props, underline: val !== 0 };
        case sprmCHps:
            return { ...props, fontSize: val / 2 };
        case sprmCIco:
            return applyIcoColor(props, val);
        case sprmCCv:
            return { ...props, color: cvToHex(val) };
        case sprmCRgFtc0:
        case sprmCRgFtc1:
        case sprmCRgFtc2:
            return { ...props, fontIndex: val };
        case sprmCIss:
            return applyVertAlign(props, val);
        case sprmCHighlight:
            return applyHighlightColor(props, val);
        case sprmCDxaSpace:
            return { ...props, charSpacing: twipsToPt(readI16AsVal(val)) };
        case sprmCShd:
            return applyShdColor(props, bytes);
        case sprmCPicLocation:
            return { ...props, picLocation: val };
        default:
            return props;
    }
}

function readI16AsVal(val: number): number {
    return val >= 0x8000 ? val - 0x10000 : val;
}

function applyIcoColor(props: CharProps, ico: number): CharProps {
    const color = icoToHex(ico);
    return color ? { ...props, color } : props;
}

function applyVertAlign(props: CharProps, val: number): CharProps {
    if (val === 1) return { ...props, vertAlign: 'superscript' };
    if (val === 2) return { ...props, vertAlign: 'subscript' };
    return props;
}

function applyHighlightColor(props: CharProps, ico: number): CharProps {
    const color = ico < HIGHLIGHT_PALETTE.length ? HIGHLIGHT_PALETTE[ico] : undefined;
    return color ? { ...props, highlight: color } : props;
}

function applyShdColor(props: CharProps, bytes: Uint8Array | null): CharProps {
    if (!bytes || bytes.length < 4) return props;
    const cv = readU32(bytes, 0) & 0x00FFFFFF;
    if (cv === 0 || cv === 0x00FFFFFF) return props;
    return { ...props, backgroundColor: cvToHex(cv) };
}

function applyParaSprms(sprms: ReadonlyArray<SprmEntry>, base: ParaProps): ParaProps {
    let props = { ...base };
    for (const sprm of sprms) {
        props = applyParaCore(props, sprm.opcode, sprm.operand, sprm.operandBytes);
    }
    return props;
}

function applyParaCore(props: ParaProps, opcode: number, val: number, bytes: Uint8Array | null): ParaProps {
    const spacing = applyParaCoreSpacing(props, opcode, val);
    if (spacing) return spacing;
    const layout = applyParaCoreLayout(props, opcode, val);
    if (layout) return layout;
    return applyParaCoreBorders(props, opcode, bytes);
}

function applyParaCoreSpacing(props: ParaProps, opcode: number, val: number): ParaProps | null {
    switch (opcode) {
        case sprmPIstd: return { ...props, istd: val };
        case sprmPJc: return { ...props, alignment: jcToAlignment(val) };
        case sprmPJc80: return { ...props, alignment: jcToAlignment(val) };
        case sprmPDyaBefore: return { ...props, spacingBefore: twipsToPt(val) };
        case sprmPDyaAfter: return { ...props, spacingAfter: twipsToPt(val) };
        case sprmPDyaLine: return applyLineSpacing(props, val);
        case sprmPDxaLeft: return { ...props, indentLeft: twipsToPt(signExtend16(val)) };
        case sprmPDxaRight: return { ...props, indentRight: twipsToPt(signExtend16(val)) };
        case sprmPDxaFirst: return { ...props, indentFirst: twipsToPt(signExtend16(val)) };
        default: return null;
    }
}

function applyParaCoreLayout(props: ParaProps, opcode: number, val: number): ParaProps | null {
    switch (opcode) {
        case sprmPFInTable: return { ...props, inTable: val !== 0 };
        case sprmPFTtp: return { ...props, isTtp: val !== 0 };
        case sprmPItap: return { ...props, tableDepth: val };
        case sprmPFInnerTableCell: return { ...props, isInnerCell: val !== 0 };
        case sprmPFInnerTtp: return { ...props, isInnerTtp: val !== 0 };
        case sprmPIlvl: return { ...props, listLevel: val };
        case sprmPIlfo: return { ...props, listId: val };
        case sprmPFBiDi: return { ...props, rtl: val !== 0 };
        default: return null;
    }
}

function applyParaCoreBorders(props: ParaProps, opcode: number, bytes: Uint8Array | null): ParaProps {
    switch (opcode) {
        case sprmPShd: return applyParaShading(props, bytes);
        case sprmPBrcTop: return { ...props, borderTop: parseBrcSprm(bytes) };
        case sprmPBrcLeft: return { ...props, borderLeft: parseBrcSprm(bytes) };
        case sprmPBrcBottom: return { ...props, borderBottom: parseBrcSprm(bytes) };
        case sprmPBrcRight: return { ...props, borderRight: parseBrcSprm(bytes) };
        default: return props;
    }
}

function signExtend16(val: number): number {
    return val >= 0x8000 ? val - 0x10000 : val;
}

function applyLineSpacing(props: ParaProps, val: number): ParaProps {
    // LSPD: low 16 bits = dyaLine, high 16 bits = fMultLinespace
    const dyaLine = val & 0xFFFF;
    const fMult = (val >> 16) & 0xFFFF;
    if (fMult === 1) {
        // Proportional: 240 = single, 360 = 1.5, 480 = double
        return { ...props, lineSpacing: dyaLine / 240 };
    }
    // Exact/at-least spacing in twips
    const signed = dyaLine >= 0x8000 ? dyaLine - 0x10000 : dyaLine;
    return { ...props, lineSpacing: Math.abs(twipsToPt(signed)) };
}

function applyParaShading(props: ParaProps, bytes: Uint8Array | null): ParaProps {
    if (!bytes || bytes.length < 4) return props;
    const cv = readU32(bytes, 0) & 0x00FFFFFF;
    if (cv === 0 || cv === 0x00FFFFFF) return props;
    return { ...props, shading: cvToHex(cv) };
}

function parseBrcSprm(bytes: Uint8Array | null): DocxBorder | undefined {
    if (!bytes || bytes.length < 4) return undefined;
    const cv = readU32(bytes, 0) & 0x00FFFFFF;
    const dptLineWidth = readU8(bytes, 3);
    if (dptLineWidth === 0) return undefined;
    return {
        style: 'single',
        color: cvToHex(cv),
        size: dptLineWidth,
    };
}

function icoToHex(ico: number): string | undefined {
    return ico < ICO_PALETTE.length ? ICO_PALETTE[ico] : undefined;
}

function cvToHex(cv: number): string {
    const r = cv & 0xFF;
    const g = (cv >> 8) & 0xFF;
    const b = (cv >> 16) & 0xFF;
    return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

function hexByte(val: number): string {
    return val.toString(16).padStart(2, '0').toUpperCase();
}

function twipsToPt(twips: number): number {
    return Math.round(twips / 20 * 10) / 10;
}

function jcToAlignment(jc: number): string {
    switch (jc) {
        case 0: return 'left';
        case 1: return 'center';
        case 2: return 'right';
        case 3: return 'justify';
        case 4: return 'justify';
        default: return 'left';
    }
}

// ── Section G: FKP Page Processing ─────────────────────────────────────

interface ChpxEntry {
    readonly fcFirst: number;
    readonly fcLim: number;
    readonly props: CharProps;
}

interface PapxEntry {
    readonly fcFirst: number;
    readonly fcLim: number;
    readonly props: ParaProps;
    readonly istd: number;
    readonly rawSprms: Uint8Array | null;
}

function parseChpxFkpEntry(page: Uint8Array, bOffset: number): CharProps {
    if (bOffset === 0) return {};
    const bytePos = bOffset * 2;
    if (bytePos >= 511) return {};
    const cb = readU8(page, bytePos);
    if (cb <= 0 || bytePos + 1 + cb > FKP_PAGE_SIZE) return {};
    const sprms = parseGrpprl(page, bytePos + 1, cb);
    return applyCharSprms(sprms, {});
}

function parseChpxFkp(page: Uint8Array): ReadonlyArray<ChpxEntry> {
    const crun = readU8(page, 511);
    if (crun === 0) return [];

    const entries: ChpxEntry[] = [];
    for (let i = 0; i < crun; i++) {
        const fcFirst = readU32(page, i * 4);
        const fcLim = readU32(page, (i + 1) * 4);
        const bOffset = readU8(page, (crun + 1) * 4 + i);

        const props = parseChpxFkpEntry(page, bOffset);
        entries.push({ fcFirst, fcLim, props });
    }

    return entries;
}

function parsePapxFkp(page: Uint8Array): ReadonlyArray<PapxEntry> {
    const crun = readU8(page, 511);
    if (crun === 0) return [];

    const entries: PapxEntry[] = [];
    for (let i = 0; i < crun; i++) {
        const fcFirst = readU32(page, i * 4);
        const fcLim = readU32(page, (i + 1) * 4);
        const bxPos = (crun + 1) * 4 + i * 13;
        const bOffset = bxPos < 511 ? readU8(page, bxPos) * 2 : 0;

        let props: ParaProps = {};
        let istd = 0;
        let rawSprms: Uint8Array | null = null;

        if (bOffset !== 0 && bOffset < FKP_PAGE_SIZE) {
            const result = readPapxData(page, bOffset);
            istd = result.istd;
            props = result.props;
            rawSprms = result.rawSprms;
        }
        entries.push({ fcFirst, fcLim, props, istd, rawSprms });
    }

    return entries;
}

function readPapxData(page: Uint8Array, bOffset: number): { readonly istd: number; readonly props: ParaProps; readonly rawSprms: Uint8Array | null } {
    let cb = readU8(page, bOffset);
    let dataStart = bOffset + 1;

    if (cb === 0) {
        // PAD byte: next byte has actual cb
        cb = readU8(page, bOffset + 1);
        dataStart = bOffset + 2;
    }

    const totalBytes = cb * 2;
    if (totalBytes < 2 || dataStart + totalBytes > FKP_PAGE_SIZE) {
        return { istd: 0, props: {}, rawSprms: null };
    }

    const istd = readU16(page, dataStart);
    const sprmStart = dataStart + 2;
    const sprmLen = totalBytes - 2;

    if (sprmLen <= 0) {
        return { istd, props: { istd }, rawSprms: null };
    }

    const rawSprms = page.subarray(sprmStart, sprmStart + sprmLen);
    const sprms = parseGrpprl(page, sprmStart, sprmLen);
    const props = applyParaSprms(sprms, { istd });

    return { istd, props, rawSprms };
}

// ── Section H: BinTable Processing ─────────────────────────────────────

function buildCharMap(
    tableStream: Uint8Array,
    wordDoc: Uint8Array,
    fib: ExtendedFib,
): ReadonlyArray<ChpxEntry> {
    if (fib.lcbPlcfBteChpx === 0) return [];

    const fc = fib.fcPlcfBteChpx;
    const lcb = fib.lcbPlcfBteChpx;
    if (fc + lcb > tableStream.length) return [];

    const plcData = tableStream.subarray(fc, fc + lcb);
    const n = Math.floor((lcb - 4) / 8);
    if (n <= 0) return [];

    const allEntries: ChpxEntry[] = [];
    const pageCount = Math.min(n, MAX_FKP_PAGES);

    for (let i = 0; i < pageCount; i++) {
        const pn = readU32(plcData, (n + 1) * 4 + i * 4);
        const pageOffset = pn * FKP_PAGE_SIZE;
        if (pageOffset + FKP_PAGE_SIZE > wordDoc.length) continue;

        const page = wordDoc.subarray(pageOffset, pageOffset + FKP_PAGE_SIZE);
        const entries = parseChpxFkp(page);
        for (const entry of entries) {
            allEntries.push(entry);
        }
    }

    return allEntries;
}

function buildParaMap(
    tableStream: Uint8Array,
    wordDoc: Uint8Array,
    fib: ExtendedFib,
): ReadonlyArray<PapxEntry> {
    if (fib.lcbPlcfBtePapx === 0) return [];

    const fc = fib.fcPlcfBtePapx;
    const lcb = fib.lcbPlcfBtePapx;
    if (fc + lcb > tableStream.length) return [];

    const plcData = tableStream.subarray(fc, fc + lcb);
    const n = Math.floor((lcb - 4) / 8);
    if (n <= 0) return [];

    const allEntries: PapxEntry[] = [];
    const pageCount = Math.min(n, MAX_FKP_PAGES);

    for (let i = 0; i < pageCount; i++) {
        const pn = readU32(plcData, (n + 1) * 4 + i * 4);
        const pageOffset = pn * FKP_PAGE_SIZE;
        if (pageOffset + FKP_PAGE_SIZE > wordDoc.length) continue;

        const page = wordDoc.subarray(pageOffset, pageOffset + FKP_PAGE_SIZE);
        const entries = parsePapxFkp(page);
        for (const entry of entries) {
            allEntries.push(entry);
        }
    }

    return allEntries;
}

// ── Section I: Run Assembly ────────────────────────────────────────────

interface TextRun {
    readonly cpStart: number;
    readonly cpEnd: number;
    readonly text: string;
    readonly props: CharProps;
}

function assembleRuns(
    pieceResult: PieceTableResult,
    chpxEntries: ReadonlyArray<ChpxEntry>,
    pieces: ReadonlyArray<PieceDescriptor>,
): ReadonlyArray<TextRun> {
    if (chpxEntries.length === 0) {
        return [{ cpStart: 0, cpEnd: pieceResult.text.length, text: pieceResult.text, props: {} }];
    }

    // Collect all CHPX FC boundaries and convert to CPs
    const cpBreaks = new Set<number>();
    cpBreaks.add(0);
    cpBreaks.add(pieceResult.text.length);

    for (const entry of chpxEntries) {
        const cpFirst = fcToCp(entry.fcFirst, pieces);
        const cpLim = fcToCp(entry.fcLim, pieces);
        if (cpFirst !== null && cpFirst >= 0 && cpFirst <= pieceResult.text.length) cpBreaks.add(cpFirst);
        if (cpLim !== null && cpLim >= 0 && cpLim <= pieceResult.text.length) cpBreaks.add(cpLim);
    }

    const sortedCps = Array.from(cpBreaks).sort((a, b) => a - b);
    const runs: TextRun[] = [];

    for (let i = 0; i < sortedCps.length - 1 && runs.length < MAX_RUNS; i++) {
        const cpStart = sortedCps[i];
        const cpEnd = sortedCps[i + 1];
        if (cpStart >= cpEnd) continue;

        const text = pieceResult.text.substring(cpStart, cpEnd);
        const fc = cpToFc(cpStart, pieces);
        const props = fc === null ? {} : findChpxProps(fc, chpxEntries);

        runs.push({ cpStart, cpEnd, text, props });
    }

    return mergeAdjacentRuns(runs);
}

function findChpxProps(fc: number, entries: ReadonlyArray<ChpxEntry>): CharProps {
    for (const entry of entries) {
        if (fc >= entry.fcFirst && fc < entry.fcLim) {
            return entry.props;
        }
    }
    return {};
}

function mergeAdjacentRuns(runs: ReadonlyArray<TextRun>): ReadonlyArray<TextRun> {
    if (runs.length <= 1) return runs;

    const merged: TextRun[] = [runs[0]];
    for (let i = 1; i < runs.length; i++) {
        const prev = merged.at(-1);
        if (!prev) continue;
        const curr = runs[i];
        if (charPropsEqual(prev.props, curr.props)) {
            merged[merged.length - 1] = {
                cpStart: prev.cpStart,
                cpEnd: curr.cpEnd,
                text: prev.text + curr.text,
                props: prev.props,
            };
        } else {
            merged.push(curr);
        }
    }
    return merged;
}

function charPropsEqual(a: CharProps, b: CharProps): boolean {
    return a.bold === b.bold
        && a.italic === b.italic
        && a.underline === b.underline
        && a.strikethrough === b.strikethrough
        && a.fontSize === b.fontSize
        && a.color === b.color
        && a.fontIndex === b.fontIndex
        && a.hidden === b.hidden
        && a.caps === b.caps
        && a.smallCaps === b.smallCaps
        && a.vertAlign === b.vertAlign
        && a.highlight === b.highlight
        && a.isSpecialChar === b.isSpecialChar
        && a.picLocation === b.picLocation;
}

// ── Section J: Paragraph Assembly ──────────────────────────────────────

interface DocParaInfo {
    readonly text: string;
    readonly runs: ReadonlyArray<TextRun>;
    readonly paraProps: ParaProps;
    readonly styleName: string;
}

function assembleParagraphs(
    text: string,
    runs: ReadonlyArray<TextRun>,
    papxEntries: ReadonlyArray<PapxEntry>,
    pieces: ReadonlyArray<PieceDescriptor>,
    styles: ReadonlyArray<DocStyleDef>,
): ReadonlyArray<DocParaInfo> {
    const paragraphs: DocParaInfo[] = [];
    let paraStart = 0;

    for (let i = 0; i <= text.length; i++) {
        const isEnd = i === text.length;
        const code = isEnd ? 0 : (text.codePointAt(i) ?? 0);
        const isCellMark = code === CELL_MARK;
        const isBoundary = code === PARAGRAPH_MARK || isCellMark;

        if (!isBoundary && !isEnd) continue;

        const paraEnd = isEnd ? i : i + 1;
        const cellMarkOffset = isCellMark ? i + 1 : i;
        const textEnd = isEnd ? i : cellMarkOffset;
        const paraText = text.substring(paraStart, textEnd);
        const paraRuns = collectRunsForRange(runs, paraStart, paraEnd);
        const paraProps = findParaProps(isEnd ? Math.max(0, i - 1) : i, papxEntries, pieces);
        const styleName = resolveStyleName(paraProps.istd ?? 0, styles);

        paragraphs.push({ text: paraText, runs: paraRuns, paraProps, styleName });
        paraStart = paraEnd;
    }

    return paragraphs;
}

function collectRunsForRange(
    runs: ReadonlyArray<TextRun>,
    start: number,
    end: number,
): ReadonlyArray<TextRun> {
    const result: TextRun[] = [];
    for (const run of runs) {
        if (run.cpEnd <= start) continue;
        if (run.cpStart >= end) break;
        const clampStart = Math.max(run.cpStart, start);
        const clampEnd = Math.min(run.cpEnd, end);
        if (clampStart >= clampEnd) continue;
        result.push({
            cpStart: clampStart,
            cpEnd: clampEnd,
            text: run.text.substring(clampStart - run.cpStart, clampEnd - run.cpStart),
            props: run.props,
        });
    }
    return result;
}

function findParaProps(
    cpOfMark: number,
    papxEntries: ReadonlyArray<PapxEntry>,
    pieces: ReadonlyArray<PieceDescriptor>,
): ParaProps {
    const fc = cpToFc(cpOfMark, pieces);
    if (fc === null) return {};

    for (const entry of papxEntries) {
        if (fc >= entry.fcFirst && fc < entry.fcLim) {
            return entry.props;
        }
    }
    return {};
}

function resolveStyleName(istd: number, styles: ReadonlyArray<DocStyleDef>): string {
    if (istd < styles.length) {
        const style = styles[istd];
        if (style.name) return style.name;
    }
    return '';
}

function resolveStyleCharProps(
    istd: number,
    styles: ReadonlyArray<DocStyleDef>,
    cache: Map<number, CharProps>,
): CharProps {
    const cached = cache.get(istd);
    if (cached) return cached;

    if (istd >= styles.length) {
        cache.set(istd, {});
        return {};
    }

    const style = styles[istd];
    let base: CharProps = {};

    // Resolve base style first (with cycle protection via depth limit)
    if (style.istdBase !== 0xFFF && style.istdBase !== istd && style.istdBase < styles.length) {
        base = resolveStyleCharProps(style.istdBase, styles, cache);
    }

    // Apply this style's char SPRMs on top of base
    if (style.charSprms && style.charSprms.length > 0) {
        const sprms = parseGrpprl(style.charSprms, 0, style.charSprms.length);
        base = applyCharSprms(sprms, base);
    }

    cache.set(istd, base);
    return base;
}



// ── Section K: Table Detection & Construction ──────────────────────────

function buildDocxElements(
    paragraphs: ReadonlyArray<DocParaInfo>,
    fonts: ReadonlyArray<string>,
    dataStream: Uint8Array | undefined,
    wordDoc: Uint8Array | undefined,
    styles: ReadonlyArray<DocStyleDef>,
): ReadonlyArray<DocxElement> {
    const elements: DocxElement[] = [];
    const styleCharCache = new Map<number, CharProps>();
    let i = 0;

    while (i < paragraphs.length) {
        const para = paragraphs[i];
        if (para.paraProps.inTable && !para.paraProps.isInnerCell) {
            const tableResult = buildTable(paragraphs, i, fonts, dataStream, wordDoc, styles, styleCharCache);
            elements.push(tableResult.table);
            i = tableResult.nextIndex;
        } else {
            const styleProps = resolveStyleCharProps(para.paraProps.istd ?? 0, styles, styleCharCache);
            buildParagraphElement(para, fonts, dataStream, wordDoc, styleProps, elements);
            i++;
        }
    }

    return elements;
}

function buildParagraphElement(
    para: DocParaInfo,
    fonts: ReadonlyArray<string>,
    dataStream: Uint8Array | undefined,
    wordDoc: Uint8Array | undefined,
    styleCharProps: CharProps,
    outputElements: DocxElement[],
): void {
    if (para.text === '\x0C') {
        outputElements.push(createPageBreakParagraph());
        return;
    }

    const extractedImages: DocxImage[] = [];
    const docxRuns = convertRuns(para.runs, fonts, dataStream, wordDoc, styleCharProps, extractedImages);

    for (const img of extractedImages) {
        outputElements.push(img);
    }

    if (docxRuns.length === 0 && para.text.trim().length === 0) return;

    const paragraph = buildParagraphObject(para, docxRuns);
    outputElements.push(paragraph);
}

function buildParagraphObject(para: DocParaInfo, docxRuns: ReadonlyArray<DocxRun>): DocxParagraph {
    const style = mapStyleName(para.styleName);
    const borders = buildParaBorders(para.paraProps);
    const rtl = para.paraProps.rtl || isRtlText(para.text);
    const indentProps = buildIndentProps(para.paraProps);
    const listProps = buildListProps(para.paraProps);

    return {
        type: 'paragraph',
        runs: docxRuns,
        style,
        ...listProps,
        ...(rtl ? { rtl: true } : {}),
        ...(para.paraProps.alignment ? { alignment: para.paraProps.alignment } : {}),
        ...(para.paraProps.spacingBefore ? { spacingBefore: para.paraProps.spacingBefore } : {}),
        ...(para.paraProps.spacingAfter ? { spacingAfter: para.paraProps.spacingAfter } : {}),
        ...(para.paraProps.lineSpacing ? { lineSpacing: para.paraProps.lineSpacing } : {}),
        ...indentProps,
        ...(para.paraProps.shading ? { shading: para.paraProps.shading } : {}),
        ...(borders ? { borders } : {}),
    };
}

function buildIndentProps(props: ParaProps): Record<string, number> {
    const result: Record<string, number> = {};
    if (props.indentLeft) result['indentLeft'] = props.indentLeft;
    if (props.indentRight) result['indentRight'] = props.indentRight;
    if (props.indentFirst !== undefined && props.indentFirst < 0) {
        result['indentHanging'] = Math.abs(props.indentFirst);
    }
    if (props.indentFirst !== undefined && props.indentFirst > 0) {
        result['indentFirstLine'] = props.indentFirst;
    }
    return result;
}

function buildListProps(props: ParaProps): Record<string, unknown> {
    if (props.listLevel !== undefined && props.listId) {
        return { listLevel: props.listLevel, listType: detectListType(props.listId) };
    }
    return {};
}

function createPageBreakParagraph(): DocxParagraph {
    return {
        type: 'paragraph',
        runs: [{ text: '', style: {}, breakType: 'page' }],
        style: '',
    };
}

function buildParaBorders(props: ParaProps): DocxParagraphBorders | undefined {
    if (!props.borderTop && !props.borderBottom && !props.borderLeft && !props.borderRight) {
        return undefined;
    }
    return {
        ...(props.borderTop ? { top: props.borderTop } : {}),
        ...(props.borderBottom ? { bottom: props.borderBottom } : {}),
        ...(props.borderLeft ? { left: props.borderLeft } : {}),
        ...(props.borderRight ? { right: props.borderRight } : {}),
    };
}

function mapStyleName(name: string): string {
    const lower = name.toLowerCase();
    if (lower.startsWith('heading ')) {
        const num = Number.parseInt(lower.substring(8), 10);
        if (num >= 1 && num <= 9) return `heading ${num}`;
    }
    if (lower === 'title') return 'Title';
    if (lower === 'subtitle') return 'Subtitle';
    return name;
}

function detectListType(listId: number): DocxListType {
    return listId % 2 === 0 ? 'bullet' : 'numbered';
}

function convertRuns(
    runs: ReadonlyArray<TextRun>,
    fonts: ReadonlyArray<string>,
    dataStream: Uint8Array | undefined,
    wordDoc: Uint8Array | undefined,
    styleCharProps: CharProps,
    extractedImages: DocxImage[],
): ReadonlyArray<DocxRun> {
    const result: DocxRun[] = [];

    for (const run of runs) {
        const mergedProps = mergeCharProps(styleCharProps, run.props);
        if (mergedProps.hidden) continue;

        // Handle special characters (images)
        if (run.props.isSpecialChar && run.text === '\u0001' && run.props.picLocation !== undefined) {
            const image = tryExtractImage(dataStream, wordDoc, run.props.picLocation);
            if (image) {
                extractedImages.push(image);
                continue;
            }
        }

        const cleanText = cleanRunText(run.text);
        if (cleanText.length === 0) continue;

        const style = buildRunStyle(mergedProps, fonts);

        // Handle page break char
        if (cleanText === '\x0C') {
            result.push({ text: '', style, breakType: 'page' });
            continue;
        }

        result.push({ text: cleanText, style });
    }

    return result;
}

function tryExtractImage(
    dataStream: Uint8Array | undefined,
    wordDoc: Uint8Array | undefined,
    picLocation: number,
): DocxImage | null {
    if (dataStream) {
        const image = extractInlineImage(dataStream, picLocation);
        if (image) return image;
    }
    if (wordDoc) {
        return extractInlineImage(wordDoc, picLocation);
    }
    return null;
}

function cleanRunText(text: string): string {
    let result = '';
    for (const ch of text) {
        const code = ch.codePointAt(0) ?? 0;
        if (code === PARAGRAPH_MARK) continue;
        if (code === CELL_MARK) continue;
        if (code === 0x01) continue; // special char placeholder
        if (code === 0x08) continue; // drawn object placeholder
        if (code === 0x13 || code === 0x14 || code === 0x15) continue; // field codes
        result += ch;
    }
    return result;
}

function mergeCharProps(styleProps: CharProps, directProps: CharProps): CharProps {
    const merged: Record<string, unknown> = { ...styleProps };
    for (const [key, value] of Object.entries(directProps)) {
        if (value !== undefined) {
            merged[key] = value;
        }
    }
    return merged as CharProps;
}

function buildRunStyle(props: CharProps, fonts: ReadonlyArray<string>): DocxRunStyle {
    return {
        ...buildRunToggleStyles(props),
        ...buildRunValueStyles(props, fonts),
    };
}

function buildRunToggleStyles(props: CharProps): Partial<DocxRunStyle> {
    return {
        ...(props.bold ? { bold: true } : {}),
        ...(props.italic ? { italic: true } : {}),
        ...(props.underline ? { underline: true } : {}),
        ...(props.strikethrough ? { strikethrough: true } : {}),
        ...(props.doubleStrikethrough ? { doubleStrikethrough: true } : {}),
        ...(props.caps ? { caps: true } : {}),
        ...(props.smallCaps ? { smallCaps: true } : {}),
    };
}

function buildRunValueStyles(props: CharProps, fonts: ReadonlyArray<string>): Partial<DocxRunStyle> {
    const fontFamily = props.fontIndex !== undefined && props.fontIndex < fonts.length
        ? fonts[props.fontIndex]
        : undefined;
    const color = props.color && props.color !== '#000000' ? props.color : undefined;

    return {
        ...(props.fontSize ? { fontSize: props.fontSize } : {}),
        ...(color ? { color } : {}),
        ...(fontFamily ? { fontFamily } : {}),
        ...(props.highlight ? { highlight: props.highlight } : {}),
        ...(props.backgroundColor ? { backgroundColor: props.backgroundColor } : {}),
        ...(props.vertAlign ? { vertAlign: props.vertAlign } : {}),
        ...(props.charSpacing ? { charSpacing: props.charSpacing } : {}),
    };
}

// ── Table Building ─────────────────────────────────────────────────────

function buildTable(
    paragraphs: ReadonlyArray<DocParaInfo>,
    startIndex: number,
    fonts: ReadonlyArray<string>,
    dataStream: Uint8Array | undefined,
    wordDoc: Uint8Array | undefined,
    styles: ReadonlyArray<DocStyleDef>,
    styleCharCache: Map<number, CharProps>,
): { readonly table: DocxTable; readonly nextIndex: number } {
    const rows: DocxTableRow[] = [];
    let i = startIndex;

    while (i < paragraphs.length) {
        const para = paragraphs[i];
        if (!para.paraProps.inTable) break;
        if (para.paraProps.isInnerCell || para.paraProps.isInnerTtp) { i++; continue; }

        if (para.paraProps.isTtp) {
            const rowParas = collectRowParagraphs(paragraphs, startIndex, i);
            const rowProps = extractRowProps();
            const row = buildTableRow(rowParas, rowProps, fonts, dataStream, wordDoc, styles, styleCharCache);
            rows.push(row);
            i++;
            startIndex = i;
        } else {
            i++;
        }
    }

    if (startIndex < i) {
        const rowParas = collectRowParagraphs(paragraphs, startIndex, i);
        if (rowParas.length > 0) {
            const row = buildTableRow(rowParas, {}, fonts, dataStream, wordDoc, styles, styleCharCache);
            rows.push(row);
        }
    }

    return { table: { type: 'table', rows }, nextIndex: i };
}

function collectRowParagraphs(
    paragraphs: ReadonlyArray<DocParaInfo>,
    start: number,
    end: number,
): ReadonlyArray<DocParaInfo> {
    const result: DocParaInfo[] = [];
    for (let i = start; i < end; i++) {
        const para = paragraphs[i];
        if (!para.paraProps.isTtp) result.push(para);
    }
    return result;
}

function extractRowProps(): TableRowProps {
    return {
        rowHeight: undefined,
        cellWidths: undefined,
        isHeader: false,
    };
}

function buildTableRow(
    cellParas: ReadonlyArray<DocParaInfo>,
    rowProps: TableRowProps,
    fonts: ReadonlyArray<string>,
    dataStream: Uint8Array | undefined,
    wordDoc: Uint8Array | undefined,
    styles: ReadonlyArray<DocStyleDef>,
    styleCharCache: Map<number, CharProps>,
): DocxTableRow {
    const cells: DocxTableCell[] = [];
    let currentCellParas: DocParaInfo[] = [];

    for (const para of cellParas) {
        const hasCellMark = para.text.includes('\x07');
        currentCellParas.push(para);

        if (hasCellMark) {
            const cellElements = buildCellElements(currentCellParas, fonts, dataStream, wordDoc, styles, styleCharCache);
            const cellStyle = buildCellStyle(cells.length, rowProps);
            cells.push({ elements: cellElements, colSpan: 1, rowSpan: 1, cellStyle });
            currentCellParas = [];
        }
    }

    if (currentCellParas.length > 0) {
        const cellElements = buildCellElements(currentCellParas, fonts, dataStream, wordDoc, styles, styleCharCache);
        cells.push({ elements: cellElements, colSpan: 1, rowSpan: 1 });
    }

    const rowStyle: DocxTableRowStyle = {
        ...(rowProps.rowHeight ? { height: rowProps.rowHeight } : {}),
        ...(rowProps.isHeader ? { isHeader: true } : {}),
    };

    return { cells, rowStyle };
}

function buildCellElements(
    paras: ReadonlyArray<DocParaInfo>,
    fonts: ReadonlyArray<string>,
    dataStream: Uint8Array | undefined,
    wordDoc: Uint8Array | undefined,
    styles: ReadonlyArray<DocStyleDef>,
    styleCharCache: Map<number, CharProps>,
): ReadonlyArray<DocxParagraph | DocxTable> {
    const elements: DocxElement[] = [];
    for (const p of paras) {
        const styleProps = resolveStyleCharProps(p.paraProps.istd ?? 0, styles, styleCharCache);
        buildParagraphElement(p, fonts, dataStream, wordDoc, styleProps, elements);
    }
    return elements.filter((el): el is DocxParagraph | DocxTable => el.type === 'paragraph' || el.type === 'table');
}

function buildCellStyle(cellIndex: number, rowProps: TableRowProps): DocxTableCellStyle | undefined {
    const width = rowProps.cellWidths && cellIndex < rowProps.cellWidths.length
        ? rowProps.cellWidths[cellIndex]
        : undefined;

    if (!width) return undefined;

    return { width, widthUnit: 'dxa' };
}

// ── Section L: Image Extraction ────────────────────────────────────────

function extractInlineImage(dataStream: Uint8Array, picLocation: number): DocxImage | null {
    if (picLocation < 0 || picLocation + 68 > dataStream.length) return null;

    // Read PICF header
    const lcb = readU32(dataStream, picLocation);
    if (lcb < 68 || picLocation + lcb > dataStream.length) return null;

    const dxaGoal = readU16(dataStream, picLocation + 20);
    const dyaGoal = readU16(dataStream, picLocation + 22);

    const width = Math.round(dxaGoal / 15);
    const height = Math.round(dyaGoal / 15);

    // Search for BLIP record in OfficeArt data after PICF
    const artStart = picLocation + 68;
    const artEnd = Math.min(picLocation + lcb, dataStream.length);

    return findBlipImage(dataStream, artStart, artEnd, width, height);
}

function findBlipImage(
    data: Uint8Array,
    start: number,
    end: number,
    width: number,
    height: number,
): DocxImage | null {
    let offset = start;

    while (offset + 8 <= end) {
        const verInst = readU16(data, offset);
        const fbt = readU16(data, offset + 2);
        const recLen = readU32(data, offset + 4);

        // BLIP record types: 0xF01A-0xF02A
        if (fbt >= 0xF01A && fbt <= 0xF02A) {
            return extractBlipData(data, offset + 8, recLen, fbt, width, height);
        }

        // Container record: recurse
        if ((verInst & 0x0F) === 0x0F) {
            const inner = findBlipImage(data, offset + 8, Math.min(offset + 8 + recLen, end), width, height);
            if (inner) return inner;
        }

        offset += 8 + recLen;
        if (recLen === 0) break;
    }

    return null;
}

function extractBlipData(
    data: Uint8Array,
    start: number,
    length: number,
    fbt: number,
    width: number,
    height: number,
): DocxImage | null {
    // Skip UID (16 bytes) and possible secondary UID
    let skip = 16;
    if (fbt === 0xF01A || fbt === 0xF01B) skip = 17; // EMF/WMF have extra byte
    if (fbt === 0xF01C) skip = 17; // PICT
    if (fbt === 0xF01D || fbt === 0xF01E) skip = 17; // JPEG/PNG extra tag byte
    if (fbt === 0xF029 || fbt === 0xF02A) skip = 17; // TIFF

    const imageStart = start + skip;
    const imageEnd = Math.min(start + length, data.length);
    if (imageStart >= imageEnd) return null;

    const imageBytes = data.subarray(imageStart, imageEnd);
    if (!isValidImageMagicBytes(imageBytes)) {
        // Try with an additional 16 bytes skip (secondary UID)
        const altStart = start + skip + 16;
        if (altStart < imageEnd) {
            const altBytes = data.subarray(altStart, imageEnd);
            if (isValidImageMagicBytes(altBytes)) {
                return createImageElement(altBytes, width, height);
            }
        }
        return null;
    }

    return createImageElement(imageBytes, width, height);
}

function createImageElement(imageBytes: Uint8Array, width: number, height: number): DocxImage {
    const mimeType = detectMimeType(imageBytes);
    const base64 = uint8ArrayToBase64(imageBytes);
    return {
        type: 'image',
        dataUrl: `data:${mimeType};base64,${base64}`,
        width: width > 0 ? width : 100,
        height: height > 0 ? height : 100,
        altText: '',
    };
}

function detectMimeType(bytes: Uint8Array): string {
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
    if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
    if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
    return 'image/png';
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }
    return btoa(binary);
}

// ── Section M: Top-Level Orchestration ─────────────────────────────────

export function parseDocEnhanced(data: Uint8Array): DocxParseResult {
    try {
        return parseDocInternal(data);
    } catch {
        return fallbackToBasicParsing(data);
    }
}

function parseDocInternal(data: Uint8Array): DocxParseResult {
    const ole2 = readOle2(data);

    const wordDoc = ole2.streams.get('WordDocument');
    if (!wordDoc) throw new Error('Invalid DOC: missing WordDocument stream');

    const fib = parseExtendedFib(wordDoc);
    const tableStreamName = fib.fWhichTblStm === 1 ? '1Table' : '0Table';
    const tableStream = ole2.streams.get(tableStreamName);
    if (!tableStream) throw new Error('Invalid DOC: missing Table stream');

    const dataStream = ole2.streams.get('Data');

    // Parse piece table for text + FC mapping
    const pieceResult = parsePieceTable(wordDoc, tableStream, fib);
    if (!pieceResult) return fallbackToBasicParsing(data);

    // Parse supporting structures (each degrades gracefully)
    const fonts = safeParse(() => parseFontTable(tableStream, fib.fcSttbfFfn, fib.lcbSttbfFfn), []);
    const styles = safeParse(() => parseStylesheet(tableStream, fib.fcStshf, fib.lcbStshf), []);
    const chpxEntries = safeParse(() => buildCharMap(tableStream, wordDoc, fib), []);
    const papxEntries = safeParse(() => buildParaMap(tableStream, wordDoc, fib), []);

    // Assemble text runs with character formatting
    const runs = assembleRuns(pieceResult, chpxEntries, pieceResult.pieces);

    // Assemble paragraphs with paragraph formatting
    const paragraphs = assembleParagraphs(
        pieceResult.text, runs, papxEntries, pieceResult.pieces, styles,
    );

    // Build final elements (paragraphs, tables, images)
    const elements = buildDocxElements(paragraphs, fonts, dataStream, wordDoc, styles);

    // Extract plain text
    const plainText = paragraphs
        .filter(p => !p.paraProps.isTtp)
        .map(p => p.text.trim())
        .filter(t => t.length > 0)
        .join('\n');

    return {
        elements,
        plainText,
        footnotes: [],
        endnotes: [],
        comments: [],
        headers: [],
        footers: [],
    };
}

function safeParse<T>(fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

function fallbackToBasicParsing(data: Uint8Array): DocxParseResult {
    const ole2 = readOle2(data);
    const wordDoc = ole2.streams.get('WordDocument');
    if (!wordDoc) {
        return emptyResult();
    }

    const fib = parseExtendedFib(wordDoc);
    const tableStreamName = fib.fWhichTblStm === 1 ? '1Table' : '0Table';
    const tableStream = ole2.streams.get(tableStreamName);

    let rawText: string | null = null;
    if (tableStream) {
        rawText = extractFallbackText(wordDoc, tableStream, fib);
    }
    if (!rawText) {
        rawText = extractTextFromRange(wordDoc, fib);
    }

    const paragraphs = splitByParagraphMark(rawText);
    const elements: DocxElement[] = paragraphs.map(text => ({
        type: 'paragraph' as const,
        runs: [{ text, style: {} }],
        style: '',
        ...(isRtlText(text) ? { rtl: true } : {}),
    }));

    return {
        elements,
        plainText: paragraphs.join('\n'),
        footnotes: [],
        endnotes: [],
        comments: [],
        headers: [],
        footers: [],
    };
}

function emptyResult(): DocxParseResult {
    return {
        elements: [],
        plainText: '',
        footnotes: [],
        endnotes: [],
        comments: [],
        headers: [],
        footers: [],
    };
}

function extractFallbackText(
    wordDoc: Uint8Array,
    tableStream: Uint8Array,
    fib: ExtendedFib,
): string | null {
    if (fib.nFib < NFIB_WORD97 || fib.lcbClx === 0) return null;
    if (fib.fcClx + fib.lcbClx > tableStream.length) return null;

    const clxData = tableStream.subarray(fib.fcClx, fib.fcClx + fib.lcbClx);
    const pcdtOffset = skipPrcEntries(clxData, 0, clxData.length);
    if (pcdtOffset >= clxData.length || clxData[pcdtOffset] !== PCDT_MARKER) return null;

    const pcdtDataOffset = pcdtOffset + 1;
    if (pcdtDataOffset + 4 > clxData.length) return null;

    const pcdtLength = readU32(clxData, pcdtDataOffset);
    const plcPcdStart = pcdtDataOffset + 4;
    const plcPcdEnd = Math.min(plcPcdStart + pcdtLength, clxData.length);
    const plcPcdLength = plcPcdEnd - plcPcdStart;
    const pieceCount = Math.floor((plcPcdLength - 4) / (4 + PCD_SIZE));
    if (pieceCount <= 0) return null;

    const textParts: string[] = [];
    let totalChars = 0;

    for (let i = 0; i < pieceCount; i++) {
        if (totalChars >= fib.ccpText) break;
        const cpStart = readU32(clxData, plcPcdStart + i * 4);
        const cpEnd = readU32(clxData, plcPcdStart + (i + 1) * 4);
        const pcdOffset = plcPcdStart + (pieceCount + 1) * 4 + i * PCD_SIZE;
        if (pcdOffset + PCD_SIZE > clxData.length) break;

        const fcValue = readU32(clxData, pcdOffset + 2);
        const fcCompressed = (fcValue & FC_COMPRESSED_BIT) !== 0;
        const rawFc = fcValue & FC_OFFSET_MASK;
        const fileOffset = fcCompressed ? rawFc >>> 1 : rawFc;

        const charCount = cpEnd - cpStart;
        const remaining = fib.ccpText - totalChars;
        const charsToRead = Math.min(charCount, remaining);

        const text = fcCompressed
            ? readAnsiText(wordDoc, fileOffset, charsToRead)
            : readUnicodeText(wordDoc, fileOffset, charsToRead);
        textParts.push(text);
        totalChars += charsToRead;
    }

    return textParts.join('');
}

function extractTextFromRange(wordDoc: Uint8Array, fib: ExtendedFib): string {
    const start = fib.fcMin;
    const end = Math.min(fib.fcMac, wordDoc.length);
    if (start >= end) return '';

    const unicodeText = readUnicodeText(wordDoc, start, Math.floor((end - start) / 2));
    const ansiText = readAnsiText(wordDoc, start, end - start);

    return computeReadability(unicodeText) >= computeReadability(ansiText) ? unicodeText : ansiText;
}

function computeReadability(text: string): number {
    let printable = 0;
    for (const char of text) {
        const code = char.codePointAt(0) ?? 0;
        if ((code >= 0x20 && code <= 0x7E) || (code >= 0xA0 && code <= 0xFFFF)
            || code === 0x09 || code === 0x0A || code === 0x0D) {
            printable++;
        }
    }
    return text.length > 0 ? printable / text.length : 0;
}

function splitByParagraphMark(text: string): ReadonlyArray<string> {
    const result: string[] = [];
    let current = '';

    for (const ch of text) {
        if (ch.codePointAt(0) === PARAGRAPH_MARK) {
            const trimmed = current.trim();
            if (trimmed.length > 0) result.push(trimmed);
            current = '';
        } else {
            current += ch;
        }
    }

    const remaining = current.trim();
    if (remaining.length > 0) result.push(remaining);
    return result;
}

function isRtlCodePoint(code: number): boolean {
    return (code >= 0x0590 && code <= 0x05FF) || (code >= 0x0600 && code <= 0x06FF)
        || (code >= 0x0700 && code <= 0x074F) || (code >= 0xFB50 && code <= 0xFDFF)
        || (code >= 0xFE70 && code <= 0xFEFF);
}

function isRtlText(text: string): boolean {
    let rtlCount = 0;
    let ltrCount = 0;
    for (const char of text) {
        const code = char.codePointAt(0) ?? 0;
        if (isRtlCodePoint(code)) {
            rtlCount++;
        } else if (code >= 0x0041 && code <= 0x007A) {
            ltrCount++;
        }
    }
    return rtlCount > 0 && rtlCount >= ltrCount;
}
