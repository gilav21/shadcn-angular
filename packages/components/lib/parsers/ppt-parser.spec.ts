import { describe, expect, it } from 'vitest';
import { parsePpt } from './ppt-parser';

// ---------------------------------------------------------------------------
// Minimal OLE2 (Compound File Binary) builder.
//
// Layout produced (512-byte sectors):
//   - 512-byte header (magic, FAT/dir pointers)
//   - sector 0          : FAT
//   - sectors 1..N      : the "PowerPoint Document" stream payload
//   - sector after      : directory (Root Entry + the stream entry)
//
// miniStreamCutoff is set to 0 so every stream is read via the regular FAT,
// which keeps the fixture simple (no mini-stream needed).
// ---------------------------------------------------------------------------

const SECTOR = 512;
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;

function setU16(buf: Uint8Array, off: number, val: number): void {
    buf[off] = val & 0xff;
    buf[off + 1] = (val >>> 8) & 0xff;
}

function setU32(buf: Uint8Array, off: number, val: number): void {
    buf[off] = val & 0xff;
    buf[off + 1] = (val >>> 8) & 0xff;
    buf[off + 2] = (val >>> 16) & 0xff;
    buf[off + 3] = (val >>> 24) & 0xff;
}

function writeDirEntry(
    dir: Uint8Array,
    index: number,
    name: string,
    type: number,
    startSector: number,
    size: number,
): void {
    const base = index * 128;
    // UTF-16LE name
    for (let i = 0; i < name.length; i++) {
        setU16(dir, base + i * 2, name.codePointAt(i)!);
    }
    const nameLen = (name.length + 1) * 2; // includes terminating null
    setU16(dir, base + 64, nameLen);
    dir[base + 66] = type; // 5 = root, 2 = stream
    setU32(dir, base + 116, startSector);
    setU32(dir, base + 120, size);
}

/**
 * Build an OLE2 container holding a single stream named "PowerPoint Document"
 * with the supplied payload bytes.
 */
function buildOle2(streamName: string, payload: Uint8Array): Uint8Array {
    const payloadSectors = Math.max(1, Math.ceil(payload.length / SECTOR));

    // Sector plan (sector indices are 0-based, each +1 offset from header):
    //   0                         : FAT
    //   1 .. payloadSectors       : stream payload
    //   payloadSectors + 1        : directory
    const fatSector = 0;
    const streamStart = 1;
    const dirSector = streamStart + payloadSectors;
    const totalSectors = dirSector + 1;

    const total = SECTOR + totalSectors * SECTOR;
    const buf = new Uint8Array(total);

    // --- Header ---
    const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    for (let i = 0; i < magic.length; i++) buf[i] = magic[i];
    setU16(buf, 30, 9); // sector size power → 2^9 = 512
    setU16(buf, 32, 6); // mini sector size power → 2^6 = 64
    setU32(buf, 44, 1); // number of FAT sectors
    setU32(buf, 48, dirSector); // first directory sector
    setU32(buf, 56, 0); // mini stream cutoff = 0 (everything uses regular FAT)
    setU32(buf, 60, END_OF_CHAIN); // first mini-FAT sector
    setU32(buf, 64, 0); // number of mini-FAT sectors
    setU32(buf, 68, END_OF_CHAIN); // first DIFAT sector
    setU32(buf, 72, 0); // number of DIFAT sectors
    setU32(buf, 76, fatSector); // DIFAT[0] = FAT sector index

    const sectorBase = (idx: number): number => SECTOR + idx * SECTOR;

    // --- FAT (sector 0): one u32 per sector ---
    const fatOff = sectorBase(fatSector);
    const entriesPerSector = SECTOR / 4;
    for (let i = 0; i < entriesPerSector; i++) setU32(buf, fatOff + i * 4, FREE_SECTOR);
    // FAT sector marks itself as special
    setU32(buf, fatOff + fatSector * 4, 0xfffffffd); // FATSECT
    // payload chain: streamStart → streamStart+1 → ... → END_OF_CHAIN
    for (let i = 0; i < payloadSectors; i++) {
        const sec = streamStart + i;
        const next = i === payloadSectors - 1 ? END_OF_CHAIN : sec + 1;
        setU32(buf, fatOff + sec * 4, next);
    }
    // directory sector chain
    setU32(buf, fatOff + dirSector * 4, END_OF_CHAIN);

    // --- Stream payload ---
    buf.set(payload, sectorBase(streamStart));

    // --- Directory sector ---
    const dir = new Uint8Array(SECTOR);
    writeDirEntry(dir, 0, 'Root Entry', 5, END_OF_CHAIN, 0);
    writeDirEntry(dir, 1, streamName, 2, streamStart, payload.length);
    buf.set(dir, sectorBase(dirSector));

    return buf;
}

// ---------------------------------------------------------------------------
// PowerPoint record builders (8-byte record header + data).
// Record header: u16 ver+instance, u16 type, u32 length.
// ---------------------------------------------------------------------------

const RT_SLIDE_LIST_WITH_TEXT = 0x0ff0;
const RT_SLIDE_PERSIST_ATOM = 0x03f3;
const RT_TEXT_CHARS_ATOM = 0x0fa0;
const RT_TEXT_BYTES_ATOM = 0x0fa8;
const CONTAINER_VERSION = 0xf;

function recordHeader(recVer: number, recType: number, recLen: number): number[] {
    const verAndInstance = recVer & 0x0f; // instance = 0
    return [
        verAndInstance & 0xff, (verAndInstance >>> 8) & 0xff,
        recType & 0xff, (recType >>> 8) & 0xff,
        recLen & 0xff, (recLen >>> 8) & 0xff, (recLen >>> 16) & 0xff, (recLen >>> 24) & 0xff,
    ];
}

/** TextCharsAtom: UTF-16LE encoded text. */
function textCharsAtom(text: string): number[] {
    const data: number[] = [];
    for (let i = 0; i < text.length; i++) {
        const code = text.codePointAt(i)!;
        data.push(code & 0xff, (code >>> 8) & 0xff);
    }
    return [...recordHeader(0, RT_TEXT_CHARS_ATOM, data.length), ...data];
}

/** TextBytesAtom: single-byte (latin1) text. */
function textBytesAtom(text: string): number[] {
    const data: number[] = [];
    for (let i = 0; i < text.length; i++) data.push(text.codePointAt(i)! & 0xff);
    return [...recordHeader(0, RT_TEXT_BYTES_ATOM, data.length), ...data];
}

function slidePersistAtom(): number[] {
    // 20-byte body (contents irrelevant to the parser, only the type matters)
    const body = new Array(20).fill(0);
    return [...recordHeader(0, RT_SLIDE_PERSIST_ATOM, body.length), ...body];
}

/** SlideListWithText container wrapping the supplied child record bytes. */
function slideListWithText(children: number[]): number[] {
    return [...recordHeader(CONTAINER_VERSION, RT_SLIDE_LIST_WITH_TEXT, children.length), ...children];
}

function buildPpt(streamBytes: number[]): Uint8Array {
    return buildOle2('PowerPoint Document', new Uint8Array(streamBytes));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parsePpt — SlideListWithText path', () => {
    it('splits text blocks into slides on SlidePersistAtom boundaries', () => {
        const children = [
            ...slidePersistAtom(),
            ...textCharsAtom('Slide One Title'),
            ...textCharsAtom('Body of slide one'),
            ...slidePersistAtom(),
            ...textCharsAtom('Slide Two Title'),
        ];
        const result = parsePpt(buildPpt(slideListWithText(children)));

        expect(result.slideWidth).toBe(960);
        expect(result.slideHeight).toBe(540);
        expect(result.slides).toHaveLength(2);

        const s1 = result.slides[0];
        expect(s1.index).toBe(0);
        expect(s1.title).toBe('Slide One Title');
        expect(s1.width).toBe(960);
        expect(s1.height).toBe(540);
        // Two text blocks → two text frames
        expect(s1.elements).toHaveLength(2);
        expect(s1.elements[0].type).toBe('text');
        const frame0 = s1.elements[0];
        if (frame0.type === 'text') {
            expect(frame0.paragraphs[0].runs[0].text).toBe('Slide One Title');
            expect(frame0.x).toBe(50); // TEXT_MARGIN
            expect(frame0.width).toBe(960 - 100); // slideWidth - 2*margin
        }

        const s2 = result.slides[1];
        expect(s2.index).toBe(1);
        expect(s2.title).toBe('Slide Two Title');
        expect(s2.elements).toHaveLength(1);
    });

    it('decodes single-byte TextBytesAtom records', () => {
        const children = [
            ...slidePersistAtom(),
            ...textBytesAtom('ASCII Slide'),
        ];
        const result = parsePpt(buildPpt(slideListWithText(children)));
        expect(result.slides).toHaveLength(1);
        const frame = result.slides[0].elements[0];
        expect(frame.type).toBe('text');
        if (frame.type === 'text') {
            expect(frame.paragraphs[0].runs[0].text).toBe('ASCII Slide');
        }
        expect(result.slides[0].title).toBe('ASCII Slide');
    });

    it('ignores whitespace-only text atoms', () => {
        const children = [
            ...slidePersistAtom(),
            ...textCharsAtom('   '),
            ...textCharsAtom('Real content'),
        ];
        const result = parsePpt(buildPpt(slideListWithText(children)));
        expect(result.slides).toHaveLength(1);
        // Only the non-blank atom becomes a frame
        expect(result.slides[0].elements).toHaveLength(1);
        expect(result.slides[0].title).toBe('Real content');
    });

    it('builds a frame per newline-split line within a text block', () => {
        const children = [
            ...slidePersistAtom(),
            ...textCharsAtom('Line A\nLine B\nLine C'),
        ];
        const result = parsePpt(buildPpt(slideListWithText(children)));
        const frame = result.slides[0].elements[0];
        expect(frame.type).toBe('text');
        if (frame.type === 'text') {
            // Each line becomes its own paragraph
            expect(frame.paragraphs).toHaveLength(3);
            expect(frame.paragraphs.map(p => p.runs[0].text)).toEqual(['Line A', 'Line B', 'Line C']);
        }
        // Title is the first line only, capped at 200 chars
        expect(result.slides[0].title).toBe('Line A');
    });
});

describe('parsePpt — fallback text scan', () => {
    it('collects text atoms into a single slide when no SlideListWithText exists', () => {
        // Bare text atoms at the top level (no container, no persist atoms)
        const streamBytes = [
            ...textCharsAtom('Loose text one'),
            ...textCharsAtom('Loose text two'),
        ];
        const result = parsePpt(buildPpt(streamBytes));
        expect(result.slides).toHaveLength(1);
        expect(result.slides[0].elements).toHaveLength(2);
        expect(result.slides[0].title).toBe('Loose text one');
    });

    it('returns zero slides when the stream contains no text', () => {
        // Only a (non-text, non-container) atom present
        const streamBytes = recordHeader(0, 0x03e8, 4).concat([0, 0, 0, 0]);
        const result = parsePpt(buildPpt(streamBytes));
        expect(result.slides).toHaveLength(0);
    });
});

describe('parsePpt — error handling', () => {
    it('throws when the PowerPoint Document stream is missing', () => {
        const ole2 = buildOle2('Pictures', new Uint8Array([1, 2, 3, 4]));
        expect(() => parsePpt(ole2)).toThrow(/PowerPoint Document/);
    });
});

describe('parsePpt — malformed input', () => {
    it('handles a SlideListWithText container whose declared length overruns the stream', () => {
        // Container header claims a child region larger than the bytes that follow.
        const childAtom = textCharsAtom('Partial');
        const oversized = [
            ...recordHeader(CONTAINER_VERSION, RT_SLIDE_LIST_WITH_TEXT, childAtom.length + 64),
            ...slidePersistAtom(),
            ...childAtom,
        ];
        const result = parsePpt(buildPpt(oversized));
        // Parser must not crash and should still surface the text it could read.
        expect(result.slides.length).toBeGreaterThanOrEqual(1);
        expect(result.slides[0].title).toBe('Partial');
    });

    it('stops cleanly on a trailing truncated record header', () => {
        // A valid text atom followed by 3 stray bytes (less than an 8-byte header).
        const streamBytes = [...textCharsAtom('Good'), 0x01, 0x02, 0x03];
        const result = parsePpt(buildPpt(streamBytes));
        expect(result.slides).toHaveLength(1);
        expect(result.slides[0].title).toBe('Good');
    });
});
