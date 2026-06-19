import { describe, expect, it } from 'vitest';
import { parseDoc } from './doc-parser';
import {
    buildOle2Doc,
    buildWordDocument,
    buildClx,
    writeAnsi,
    writeUtf16,
} from './doc-test-fixtures';

// ── Helpers to assemble a complete legacy .doc with a piece table ──────

/**
 * Build a WordDocument + Table pair where `text` is stored as a single
 * ANSI (compressed) piece. The paragraph mark (\r) inside `text` drives
 * paragraph splitting.
 */
function buildAnsiDoc(text: string, tableName: '0Table' | '1Table' = '0Table'): Uint8Array {
    const textFc = 0x600; // arbitrary offset past the FIB
    const wdSize = textFc + text.length + 16;
    const ccpText = text.length;

    const clx = buildClx([{ cpStart: 0, cpEnd: ccpText, fc: textFc, compressed: true }]);
    const tableSize = 0x40 + clx.length;
    const fcClx = 0x40;

    const wd = buildWordDocument(wdSize, {
        nFib: 0x00c1,
        fWhichTblStm: tableName === '1Table' ? 1 : 0,
        ccpText,
        fcClx,
        lcbClx: clx.length,
        fcMin: textFc,
        fcMac: textFc + text.length,
    });
    writeAnsi(wd, textFc, text);

    const table = new Uint8Array(tableSize);
    table.set(clx, fcClx);

    return buildOle2Doc([
        { name: 'WordDocument', data: wd },
        { name: tableName, data: table },
    ]);
}

describe('parseDoc — piece table (ANSI/compressed)', () => {
    it('extracts plain text and splits paragraphs on the \\r mark', () => {
        const doc = buildAnsiDoc('Hello World\rSecond line');
        const result = parseDoc(doc);

        expect(result.plainText).toBe('Hello World\nSecond line');
        expect(result.elements).toHaveLength(2);
        expect(result.elements[0].text).toBe('Hello World');
        expect(result.elements[1].text).toBe('Second line');
        expect(result.elements[0].type).toBe('paragraph');
    });

    it('drops empty paragraphs produced by consecutive marks', () => {
        const doc = buildAnsiDoc('A\r\r\rB');
        const result = parseDoc(doc);
        expect(result.elements.map(e => e.text)).toEqual(['A', 'B']);
    });

    it('honours ccpText by truncating text beyond the declared count', () => {
        // Store more characters than ccpText; only the first `ccpText` survive.
        const fullText = 'VISIBLEHIDDEN';
        const textFc = 0x600;
        const ccpText = 7; // only "VISIBLE"
        const clx = buildClx([{ cpStart: 0, cpEnd: ccpText, fc: textFc, compressed: true }]);
        const wd = buildWordDocument(textFc + fullText.length + 8, {
            ccpText,
            fcClx: 0x40,
            lcbClx: clx.length,
        });
        writeAnsi(wd, textFc, fullText);
        const table = new Uint8Array(0x40 + clx.length);
        table.set(clx, 0x40);

        const result = parseDoc(buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: table },
        ]));
        expect(result.plainText).toBe('VISIBLE');
    });
});

describe('parseDoc — piece table (Unicode/uncompressed)', () => {
    it('decodes a UTF-16LE piece and detects RTL Hebrew text', () => {
        const text = 'שלום\rעולם'; // "Shalom" \r "Olam"
        const textFc = 0x600;
        const ccpText = text.length;
        const clx = buildClx([{ cpStart: 0, cpEnd: ccpText, fc: textFc, compressed: false }]);
        const wd = buildWordDocument(textFc + text.length * 2 + 8, {
            ccpText,
            fcClx: 0x40,
            lcbClx: clx.length,
        });
        writeUtf16(wd, textFc, text);
        const table = new Uint8Array(0x40 + clx.length);
        table.set(clx, 0x40);

        const result = parseDoc(buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: table },
        ]));

        expect(result.elements.map(e => e.text)).toEqual(['שלום', 'עולם']);
        expect(result.elements[0].rtl).toBe(true);
        expect(result.elements[1].rtl).toBe(true);
    });

    it('does not flag predominantly Latin text as RTL', () => {
        const result = parseDoc(buildAnsiDoc('Hello there'));
        expect(result.elements[0].rtl).toBeUndefined();
    });
});

describe('parseDoc — table stream selection', () => {
    it('reads the 1Table stream when fWhichTblStm flag is set', () => {
        const doc = buildAnsiDoc('From One Table', '1Table');
        const result = parseDoc(doc);
        expect(result.plainText).toBe('From One Table');
    });
});

describe('parseDoc — multi-piece assembly', () => {
    it('concatenates two pieces (ANSI then Unicode) in CP order', () => {
        const part1 = 'ABC'; // ANSI piece, cp 0..3
        const part2 = 'XY'; // Unicode piece, cp 3..5
        const fc1 = 0x600;
        const fc2 = 0x700;
        const ccpText = part1.length + part2.length;

        const clx = buildClx([
            { cpStart: 0, cpEnd: part1.length, fc: fc1, compressed: true },
            { cpStart: part1.length, cpEnd: ccpText, fc: fc2, compressed: false },
        ]);
        const wd = buildWordDocument(fc2 + part2.length * 2 + 8, {
            ccpText,
            fcClx: 0x40,
            lcbClx: clx.length,
        });
        writeAnsi(wd, fc1, part1);
        writeUtf16(wd, fc2, part2);
        const table = new Uint8Array(0x40 + clx.length);
        table.set(clx, 0x40);

        const result = parseDoc(buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: table },
        ]));
        expect(result.plainText).toBe('ABCXY');
    });
});

describe('parseDoc — fallback path (no usable piece table)', () => {
    it('falls back to fcMin..fcMac range scan when lcbClx is 0', () => {
        // Text stored as UTF-16LE so the fallback's unicode interpretation
        // wins the readability comparison cleanly.
        const text = 'Fallback Text';
        const textFc = 0x200;
        const wd = buildWordDocument(textFc + text.length * 2 + 8, {
            nFib: 0x00c1,
            ccpText: text.length,
            fcClx: 0,
            lcbClx: 0, // no CLX -> piece table returns null
            fcMin: textFc,
            fcMac: textFc + text.length * 2,
        });
        writeUtf16(wd, textFc, text);

        // Provide a (present but unused for text) table stream.
        const result = parseDoc(buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: new Uint8Array(16) },
        ]));
        expect(result.plainText).toContain('Fallback Text');
    });

    it('falls back when nFib is below the Word97 threshold', () => {
        const text = 'Old Word';
        const textFc = 0x200;
        const clx = buildClx([{ cpStart: 0, cpEnd: text.length, fc: textFc, compressed: true }]);
        const wd = buildWordDocument(textFc + text.length * 2 + 8, {
            nFib: 0x00a0, // < 0x00C1 -> piece table rejected
            ccpText: text.length,
            fcClx: 0x40,
            lcbClx: clx.length,
            fcMin: textFc,
            fcMac: textFc + text.length * 2,
        });
        writeUtf16(wd, textFc, text);
        const table = new Uint8Array(0x40 + clx.length);
        table.set(clx, 0x40);

        const result = parseDoc(buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: table },
        ]));
        expect(result.plainText).toContain('Old Word');
    });

    it('returns empty result when fcMin >= fcMac in the fallback', () => {
        const wd = buildWordDocument(0x400, {
            nFib: 0x00c1,
            ccpText: 0,
            lcbClx: 0,
            fcMin: 0x300,
            fcMac: 0x300, // start >= end
        });
        const result = parseDoc(buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: new Uint8Array(8) },
        ]));
        expect(result.plainText).toBe('');
        expect(result.elements).toHaveLength(0);
    });
});

describe('parseDoc — CLX with PRC entries', () => {
    it('skips a leading PRC block before the PCDT', () => {
        const text = 'After Prc';
        const textFc = 0x600;
        const ccpText = text.length;
        const pcdt = buildClx([{ cpStart: 0, cpEnd: ccpText, fc: textFc, compressed: true }]);

        // Prepend a PRC entry: marker 0x01, U16 length, then `length` bytes.
        const prcPayloadLen = 6;
        const prc = new Uint8Array(1 + 2 + prcPayloadLen);
        prc[0] = 0x01; // PRC marker
        prc[1] = prcPayloadLen & 0xff;
        prc[2] = (prcPayloadLen >> 8) & 0xff;

        const clx = new Uint8Array(prc.length + pcdt.length);
        clx.set(prc, 0);
        clx.set(pcdt, prc.length);

        const wd = buildWordDocument(textFc + text.length + 8, {
            ccpText,
            fcClx: 0x40,
            lcbClx: clx.length,
        });
        writeAnsi(wd, textFc, text);
        const table = new Uint8Array(0x40 + clx.length);
        table.set(clx, 0x40);

        const result = parseDoc(buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: table },
        ]));
        expect(result.plainText).toBe('After Prc');
    });
});

describe('parseDoc — error handling', () => {
    it('throws when the WordDocument stream is missing', () => {
        const doc = buildOle2Doc([
            { name: '0Table', data: new Uint8Array(16) },
        ]);
        expect(() => parseDoc(doc)).toThrow(/missing WordDocument/);
    });

    it('uses the fallback when CLX extends past the table stream bounds', () => {
        const text = 'Bounds';
        const textFc = 0x200;
        const wd = buildWordDocument(textFc + text.length * 2 + 8, {
            nFib: 0x00c1,
            ccpText: text.length,
            fcClx: 0x40,
            lcbClx: 0x500, // far beyond a tiny table stream
            fcMin: textFc,
            fcMac: textFc + text.length * 2,
        });
        writeUtf16(wd, textFc, text);

        const result = parseDoc(buildOle2Doc([
            { name: 'WordDocument', data: wd },
            { name: '0Table', data: new Uint8Array(8) },
        ]));
        // Piece table rejected (out of bounds) -> fallback recovers the text.
        expect(result.plainText).toContain('Bounds');
    });
});
