import { readOle2 } from './ole2-reader';
import type { PptxParseResult, PptxSlide, PptxTextFrame, PptxParagraph } from './pptx-parser';

const RT_SLIDE_LIST_WITH_TEXT = 0x0FF0;
const RT_SLIDE_PERSIST_ATOM = 0x03F3;
const RT_TEXT_CHARS_ATOM = 0x0FA0;
const RT_TEXT_BYTES_ATOM = 0x0FA8;
const RECORD_HEADER_SIZE = 8;
const CONTAINER_VERSION = 0xF;
const MAX_RECORDS = 500_000;

const DEFAULT_SLIDE_WIDTH = 960;
const DEFAULT_SLIDE_HEIGHT = 540;
const TEXT_MARGIN = 50;
const MIN_FRAME_HEIGHT = 30;
const CHARS_PER_LINE_ESTIMATE = 60;
const LINE_HEIGHT_ESTIMATE = 20;

interface RecordHeader {
    readonly recVer: number;
    readonly recType: number;
    readonly recLen: number;
}

function readU16(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
}

function readU32(data: Uint8Array, offset: number): number {
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function parseRecordHeader(stream: Uint8Array, offset: number): RecordHeader | null {
    if (offset + RECORD_HEADER_SIZE > stream.length) {
        return null;
    }

    const verAndInstance = readU16(stream, offset);
    const recVer = verAndInstance & 0x0F;
    const recType = readU16(stream, offset + 2);
    const recLen = readU32(stream, offset + 4);

    return { recVer, recType, recLen };
}

function decodeTextChars(stream: Uint8Array, dataOffset: number, dataLen: number): string {
    const chars: string[] = [];
    const end = Math.min(dataOffset + dataLen, stream.length);

    for (let i = dataOffset; i + 1 < end; i += 2) {
        chars.push(String.fromCodePoint(readU16(stream, i)));
    }

    return chars.join('');
}

function decodeTextBytes(stream: Uint8Array, dataOffset: number, dataLen: number): string {
    const chars: string[] = [];
    const end = Math.min(dataOffset + dataLen, stream.length);

    for (let i = dataOffset; i < end; i++) {
        chars.push(String.fromCodePoint(stream[i]));
    }

    return chars.join('');
}

function extractTextFromRecord(
    stream: Uint8Array,
    dataOffset: number,
    header: RecordHeader,
): string | null {
    if (header.recType === RT_TEXT_CHARS_ATOM) {
        return decodeTextChars(stream, dataOffset, header.recLen);
    }
    if (header.recType === RT_TEXT_BYTES_ATOM) {
        return decodeTextBytes(stream, dataOffset, header.recLen);
    }
    return null;
}

interface SlideTextBlocks {
    readonly texts: string[];
}

function scanForSlideListTexts(stream: Uint8Array): SlideTextBlocks[] {
    const slides: SlideTextBlocks[] = [];
    let offset = 0;
    let recordCount = 0;

    while (offset + RECORD_HEADER_SIZE <= stream.length) {
        if (recordCount++ > MAX_RECORDS) break;

        const header = parseRecordHeader(stream, offset);
        if (!header) break;

        const dataOffset = offset + RECORD_HEADER_SIZE;

        if (header.recType === RT_SLIDE_LIST_WITH_TEXT && header.recVer === CONTAINER_VERSION) {
            const containerSlides = parseSlideListContainer(stream, dataOffset, header.recLen);
            slides.push(...containerSlides);
            offset = dataOffset + header.recLen;
            continue;
        }

        offset = advanceOffset(header, dataOffset);
    }

    return slides;
}

function handleSlideRecord(
    header: RecordHeader,
    stream: Uint8Array,
    dataOffset: number,
    currentTexts: string[],
    slides: SlideTextBlocks[],
): string[] {
    if (header.recType === RT_SLIDE_PERSIST_ATOM) {
        if (currentTexts.length > 0) {
            slides.push({ texts: [...currentTexts] });
        }
        return [];
    }

    const text = extractTextFromRecord(stream, dataOffset, header);
    if (text !== null && text.trim().length > 0) {
        currentTexts.push(text);
    }
    return currentTexts;
}

function parseSlideListContainer(
    stream: Uint8Array,
    containerStart: number,
    containerLen: number,
): SlideTextBlocks[] {
    const slides: SlideTextBlocks[] = [];
    let currentTexts: string[] = [];
    const containerEnd = Math.min(containerStart + containerLen, stream.length);
    let offset = containerStart;
    let recordCount = 0;

    while (offset + RECORD_HEADER_SIZE <= containerEnd) {
        if (recordCount++ > MAX_RECORDS) break;

        const header = parseRecordHeader(stream, offset);
        if (!header) break;

        const dataOffset = offset + RECORD_HEADER_SIZE;
        currentTexts = handleSlideRecord(header, stream, dataOffset, currentTexts, slides);
        offset = dataOffset + header.recLen;
    }

    if (currentTexts.length > 0) {
        slides.push({ texts: [...currentTexts] });
    }

    return slides;
}

function advanceOffset(header: RecordHeader, dataOffset: number): number {
    if (header.recVer === CONTAINER_VERSION) {
        return dataOffset;
    }
    return dataOffset + header.recLen;
}

function fallbackTextScan(stream: Uint8Array): SlideTextBlocks[] {
    const texts: string[] = [];
    let offset = 0;
    let recordCount = 0;

    while (offset + RECORD_HEADER_SIZE <= stream.length) {
        if (recordCount++ > MAX_RECORDS) break;

        const header = parseRecordHeader(stream, offset);
        if (!header) break;

        const dataOffset = offset + RECORD_HEADER_SIZE;
        const text = extractTextFromRecord(stream, dataOffset, header);

        if (text !== null && text.trim().length > 0) {
            texts.push(text);
        }

        offset = advanceOffset(header, dataOffset);
    }

    if (texts.length === 0) {
        return [];
    }

    return [{ texts }];
}

function estimateFrameHeight(text: string): number {
    const lineCount = Math.ceil(text.length / CHARS_PER_LINE_ESTIMATE);
    const newlineCount = text.split('\n').length - 1;
    return Math.max(MIN_FRAME_HEIGHT, (lineCount + newlineCount) * LINE_HEIGHT_ESTIMATE);
}

function buildTextFrame(
    text: string,
    yPosition: number,
    slideWidth: number,
): PptxTextFrame {
    const frameWidth = slideWidth - TEXT_MARGIN * 2;
    const frameHeight = estimateFrameHeight(text);

    const lines = text.split('\n').filter(line => line.length > 0);
    const paragraphs: PptxParagraph[] = lines.length > 0
        ? lines.map(line => ({ runs: [{ text: line }] }))
        : [{ runs: [{ text }] }];

    return {
        type: 'text',
        paragraphs,
        x: TEXT_MARGIN,
        y: yPosition,
        width: frameWidth,
        height: frameHeight,
    };
}

function buildSlideFromTexts(
    textBlocks: SlideTextBlocks,
    slideIndex: number,
    slideWidth: number,
    slideHeight: number,
): PptxSlide {
    const elements: PptxTextFrame[] = [];
    let yPosition = TEXT_MARGIN;

    for (const text of textBlocks.texts) {
        const frame = buildTextFrame(text, yPosition, slideWidth);
        elements.push(frame);
        yPosition += frame.height + 10;
    }

    const title = textBlocks.texts.length > 0
        ? textBlocks.texts[0].split('\n')[0].substring(0, 200)
        : '';

    return {
        index: slideIndex,
        title,
        elements,
        width: slideWidth,
        height: slideHeight,
    };
}

function buildSlides(
    slideTextBlocks: SlideTextBlocks[],
    slideWidth: number,
    slideHeight: number,
): ReadonlyArray<PptxSlide> {
    return slideTextBlocks.map((block, index) =>
        buildSlideFromTexts(block, index, slideWidth, slideHeight),
    );
}

export function parsePpt(data: Uint8Array): PptxParseResult {
    const ole2 = readOle2(data);
    const pptStream = ole2.streams.get('PowerPoint Document');

    if (!pptStream) {
        throw new Error('PPT: "PowerPoint Document" stream not found');
    }

    let slideTextBlocks = scanForSlideListTexts(pptStream);

    if (slideTextBlocks.length === 0) {
        slideTextBlocks = fallbackTextScan(pptStream);
    }

    const slides = buildSlides(slideTextBlocks, DEFAULT_SLIDE_WIDTH, DEFAULT_SLIDE_HEIGHT);

    return {
        slides,
        slideWidth: DEFAULT_SLIDE_WIDTH,
        slideHeight: DEFAULT_SLIDE_HEIGHT,
    };
}
