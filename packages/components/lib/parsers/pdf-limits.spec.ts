import { describe, expect, it } from 'vitest';
import { DEFAULT_PARSER_LIMITS, type ParserLimits } from './limits';
import { parsePdf, parsePdfPaged, PdfReader, type PdfObject, type PdfOutlineItem } from './pdf-parser';
import { renderPixelPerfectPaged } from './pdf-pixel-perfect';
import { parsePdfReadable } from './pdf-readable/pdf-readable';
import { concatBytes, latin1Bytes, onePagePdf, RawPdf } from './pdf-test-fixtures';

/*
 * Resource limits on hostile PDFs (specs/parser-resource-limits-spec.md).
 *
 * Allocation tests inject tiny caps, so a parser that ignores them returns the
 * oversized element cheaply instead of allocating gigabytes. Timing tests use
 * inputs scaled so an unbounded parser takes seconds, never minutes, against a
 * generous budget.
 */

const HELVETICA = '/Type /Font /Subtype /Type1 /BaseFont /Helvetica';
const TIME_BUDGET_MS = 1000;
const MIB = 1024 * 1024;

/** zlib-compresses `bytes` (the FlateDecode format) with the browser's own deflate. */
async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function limits(overrides: Partial<ParserLimits>): ParserLimits {
    return { ...DEFAULT_PARSER_LIMITS, ...overrides };
}

function count(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

async function elapsedMs(run: () => Promise<unknown>): Promise<number> {
    const start = performance.now();
    await run();
    return performance.now() - start;
}

interface PdfEntryPoint {
    readonly name: string;
    /** Plain text the entry point extracted from the whole document. */
    readonly text: (bytes: ArrayBuffer, caps?: ParserLimits) => Promise<string>;
}

const ENTRY_POINTS: ReadonlyArray<PdfEntryPoint> = [
    { name: 'parsePdf', text: async (b, caps) => (await parsePdf(b, caps)).text },
    { name: 'parsePdfReadable', text: async (b, caps) => (await parsePdfReadable(b, undefined, caps)).text },
    {
        name: 'pixel-perfect',
        text: async (b, caps) => (await renderPixelPerfectPaged(b, undefined, caps)).pages.map(p => p.text).join(' '),
    },
];

/** A gray 8-bit image XObject of the given size (uncompressed samples). */
function grayImage(width: number, height: number, bitsPerComponent = 8): { dict: string; bytes: Uint8Array } {
    const rowBytes = Math.ceil(width * bitsPerComponent / 8);
    return {
        dict: `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent ${bitsPerComponent}`,
        bytes: new Uint8Array(rowBytes * height).fill(0x80),
    };
}

/** A page that draws two images and a caption; the images render 40pt and 30pt wide. */
function twoImagePdf(small: { dict: string; bytes: Uint8Array }, big: { dict: string; bytes: Uint8Array }): ArrayBuffer {
    return onePagePdf(
        'q 40 0 0 40 72 600 cm /Small Do Q q 30 0 0 30 72 500 cm /Big Do Q BT /F1 12 Tf 72 700 Td (Caption) Tj ET',
        '/Font << /F1 5 0 R >> /XObject << /Small 6 0 R /Big 7 0 R >>',
    )
        .obj(5, HELVETICA)
        .streamObj(6, small.dict, small.bytes)
        .streamObj(7, big.dict, big.bytes)
        .build();
}

describe('PDF images — R1 bounded by bytes', () => {
    it('T-1 skips an image whose declared pixel count exceeds the cap and keeps the rest of the page', async () => {
        // 4×4 = 16 px sits exactly at the cap and renders; 4×5 = 20 px is over it.
        const pdf = twoImagePdf(grayImage(4, 4), grayImage(4, 5));
        const result = await parsePdf(pdf, limits({ maxImagePixels: 16 }));
        expect(result.text).toContain('Caption');
        expect(count(result.html, '<img')).toBe(1);
        expect(result.html).toContain('width:40pt');
        expect(result.html).not.toContain('width:30pt');
    });

    it('T-2 rejects BitsPerComponent outside 1/2/4/8/16, including fractional', async () => {
        // Each pairs an allowed depth (must render) with a disallowed one (must not).
        for (const [allowed, bpc] of [[16, 3], [1, 2.5]]) {
            const pdf = twoImagePdf(grayImage(8, 8, allowed), grayImage(8, 8, bpc));
            const result = await parsePdf(pdf);
            expect(count(result.html, '<img'), `BitsPerComponent ${bpc}`).toBe(1);
            expect(result.html).toContain('width:40pt');
        }
    });

    it('T-3 pixel-perfect image path honours the same cap', async () => {
        const pdf = twoImagePdf(grayImage(4, 4), grayImage(4, 5));
        const result = await renderPixelPerfectPaged(pdf, undefined, limits({ maxImagePixels: 16 }));
        const html = result.pages[0].html;
        expect(count(html, '<img class="bi"')).toBe(1);
        expect(result.pages[0].text).toContain('Caption');
    });

    it('T-4 CCITT decode with oversized Columns/Rows is bounded by the pixel cap', async () => {
        const ccitt = (width: number, height: number, columns: number, rows: number, bytes: number[]): { dict: string; bytes: Uint8Array } => ({
            dict: `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 1 `
                + `/Filter /CCITTFaxDecode /DecodeParms << /K -1 /Columns ${columns} /Rows ${rows} /BlackIs1 true >>`,
            bytes: new Uint8Array(bytes),
        });
        // Within the cap: two Group 4 rows of 8 white pixels (horizontal mode,
        // white run 8, black run 0) decode and render.
        const valid = ccitt(8, 2, 8, 2, [0x33, 0x0d, 0xcc, 0xc3, 0x70]);
        // Parameters claiming 20-million-column rows on an 8×16 image, over data
        // that decodes at two rows per byte: a decoder sizing rows from the
        // parameters allocates and scans 20 M pixels per row. Refusing the
        // oversized rows and clamping them to /Width are both allowed, and they
        // differ in what the 8×16 image shows, so only the shared outcome is
        // asserted: the page and the valid image render, fast.
        const wide = ccitt(8, 16, 20_000_000, 30, new Array<number>(16).fill(0xff));
        let result = { text: '', html: '' };
        const wideMs = await elapsedMs(async () => {
            result = await parsePdf(twoImagePdf(valid, wide), limits({ maxImagePixels: 1024 }));
        });
        expect(result.text).toContain('Caption');
        expect(result.html).toContain('width:40pt');
        expect(wideMs).toBeLessThan(TIME_BUDGET_MS);

        // A 1024×8 image (inside the cap) whose parameters claim a million rows,
        // over 1 MB of data that decodes at two rows per byte: the decoder must
        // stop at the rows the cap allows (16384 / 1024 = 16), not the million the
        // file asks for. Truncating to those rows (the image renders) and
        // skipping the image are both allowed; the time is the real assertion.
        const tall = ccitt(1024, 8, 1024, 1_000_000, new Array<number>(1024 * 1024).fill(0xff));
        let html = '';
        const ms = await elapsedMs(async () => {
            html = (await parsePdf(twoImagePdf(valid, tall), limits({ maxImagePixels: 16_384 }))).html;
        });
        expect(html).toContain('width:40pt');
        expect(ms).toBeLessThan(TIME_BUDGET_MS);

        // A Group 3 row whose data ends mid-row: past the end every bit reads 0,
        // which is no code, so a decoder that keeps reading never advances. A
        // pre-fix run hangs the thread, which no timeout can interrupt.
        const truncated = ccitt(64, 8, 64, 8, [0x00]);
        truncated.dict = truncated.dict.replace('/K -1', '/K 0');
        const truncatedHtml = (await parsePdf(twoImagePdf(valid, truncated))).html;
        expect(truncatedHtml).toContain('width:40pt');
    }, 60_000);
});

/** Form 5 draws itself, shifted 20pt down each level. */
function selfDrawingFormPdf(): ArrayBuffer {
    return onePagePdf('q 1 0 0 1 72 700 cm /Me Do Q', '/Font << /F1 7 0 R >> /XObject << /Me 5 0 R >>')
        .streamObj(5,
            '/Type /XObject /Subtype /Form /BBox [0 -2000 600 100] /Matrix [1 0 0 1 0 -20] '
            + '/Resources << /Font << /F1 7 0 R >> /XObject << /Me 5 0 R >> >>',
            latin1Bytes('BT /F1 12 Tf 0 0 Td (Loop) Tj ET /Me Do'))
        .obj(7, HELVETICA)
        .build();
}

/** Form 5 (Alpha) draws form 6 (Beta), which draws form 5 again. */
function mutuallyRecursiveFormPdf(): ArrayBuffer {
    const formDict = (other: string, otherNum: number): string =>
        '/Type /XObject /Subtype /Form /BBox [0 -2000 600 100] /Matrix [1 0 0 1 0 -20] '
        + `/Resources << /Font << /F1 7 0 R >> /XObject << /${other} ${otherNum} 0 R >> >>`;
    return onePagePdf('q 1 0 0 1 72 700 cm /A Do Q', '/Font << /F1 7 0 R >> /XObject << /A 5 0 R >>')
        .streamObj(5, formDict('B', 6), latin1Bytes('BT /F1 12 Tf 0 0 Td (Alpha) Tj ET /B Do'))
        .streamObj(6, formDict('A', 5), latin1Bytes('BT /F1 12 Tf 0 0 Td (Beta) Tj ET /A Do'))
        .obj(7, HELVETICA)
        .build();
}

/**
 * A form DAG: the page draws L1; each level draws the next level `fanOut`
 * times at distinct offsets; the last level shows "Leaf". Every leaf path
 * lands at a distinct position, so each draw is visible in the text.
 */
function sharedFormDagPdf(fanOut: number, depth: number, pages = 1): ArrayBuffer {
    const firstForm = 10;
    const pageNums = Array.from({ length: pages }, (...[, i]) => 50 + i * 2);
    const pdf = new RawPdf()
        .obj(1, '/Type /Catalog /Pages 2 0 R')
        .obj(2, `/Type /Pages /Kids [${pageNums.map(n => String(n) + ' 0 R').join(' ')}] /Count ${pages}`)
        .obj(7, HELVETICA);
    for (const num of pageNums) {
        pdf.obj(num, `/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> /XObject << /L ${firstForm} 0 R >> >> /Contents ${num + 1} 0 R`)
            .streamObj(num + 1, '', latin1Bytes('q 1 0 0 1 20 100 cm /L Do Q'));
    }
    for (let level = 0; level < depth; level++) {
        const num = firstForm + level;
        const isLeaf = level === depth - 1;
        const resources = isLeaf
            ? '/Font << /F1 7 0 R >>'
            : `/Font << /F1 7 0 R >> /XObject << /L ${num + 1} 0 R >>`;
        const step = 40 * fanOut ** (depth - level - 2);
        const body = isLeaf
            ? 'BT /F1 9 Tf 0 0 Td (Leaf) Tj ET'
            : Array.from({ length: fanOut }, (...[, i]) => `q 1 0 0 1 ${i * step} ${i * 3} cm /L Do Q`).join(' ');
        pdf.streamObj(num, `/Type /XObject /Subtype /Form /BBox [0 0 10000 10000] /Resources << ${resources} >>`, latin1Bytes(body));
    }
    return pdf.build();
}

describe('PDF form XObjects — R2 bounded traversal', () => {
    it.each(ENTRY_POINTS)('T-5 $name draws a self-drawing and a mutually-recursive form once per draw path', async ({ text }) => {
        const loop = await text(selfDrawingFormPdf());
        expect(count(loop, 'Loop')).toBe(1);

        const cycle = await text(mutuallyRecursiveFormPdf());
        expect(count(cycle, 'Alpha')).toBe(1);
        expect(count(cycle, 'Beta')).toBe(1);
    });

    it.each(ENTRY_POINTS)('T-6 $name renders every draw of a shared sub-form, and caps a k^depth form DAG', async ({ text }) => {
        // Shared, not cyclic: 2 draws per level over 4 levels reach 8 leaves, all drawn.
        expect(count(await text(sharedFormDagPdf(2, 4)), 'Leaf')).toBe(8);
        // Those are 1 + 2 + 4 + 8 = 15 form draws: a budget of exactly 15 still draws
        // every leaf, and a budget of 14 loses the last one.
        expect(count(await text(sharedFormDagPdf(2, 4), limits({ maxFormDrawsPerPage: 15 })), 'Leaf')).toBe(8);
        expect(count(await text(sharedFormDagPdf(2, 4), limits({ maxFormDrawsPerPage: 14 })), 'Leaf')).toBe(7);
        // The budget is per page: two pages drawing the same DAG under a
        // 15-draw budget both draw every leaf.
        expect(count(await text(sharedFormDagPdf(2, 4, 2), limits({ maxFormDrawsPerPage: 15 })), 'Leaf')).toBe(16);

        // 3 draws per level over 7 levels is 3^6 = 729 leaves; a 100-draw budget bounds it.
        const capped = await text(sharedFormDagPdf(3, 7), limits({ maxFormDrawsPerPage: 100 }));
        expect(count(capped, 'Leaf')).toBeGreaterThan(0);
        expect(count(capped, 'Leaf')).toBeLessThanOrEqual(100);
    });
});

describe('PDF page tree — R2 bounded traversal', () => {
    it('T-7 a cyclic /Kids returns the distinct pages; a fan-out tree is capped', async () => {
        const cyclic = new RawPdf()
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R 2 0 R] /Count 2')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', latin1Bytes('BT /F1 12 Tf 72 700 Td (Only) Tj ET'))
            .obj(5, HELVETICA)
            .build();
        const cyclicResult = await parsePdfPaged(cyclic);
        expect(cyclicResult.totalPages).toBe(1);
        expect(cyclicResult.text).toBe('Only');

        // Ten levels that each list the same child twice: 2^10 paths to one page.
        const fanOut = new RawPdf()
            .obj(1, '/Type /Catalog /Pages 10 0 R')
            .obj(3, '/Type /Page /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '', latin1Bytes('BT /F1 12 Tf 72 700 Td (Only) Tj ET'))
            .obj(5, HELVETICA);
        for (let level = 0; level < 10; level++) {
            const child = level === 9 ? 3 : 11 + level;
            fanOut.obj(10 + level, `/Type /Pages /Kids [${child} 0 R ${child} 0 R] /Count 1024`);
        }
        expect((await parsePdfPaged(fanOut.build())).totalPages).toBe(1);

        // Five distinct pages under a three-page cap.
        const five = new RawPdf()
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [10 0 R 11 0 R 12 0 R 13 0 R 14 0 R] /Count 5')
            .obj(5, HELVETICA);
        for (let i = 0; i < 5; i++) {
            five.obj(10 + i, `/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents ${20 + i} 0 R`)
                .streamObj(20 + i, '', latin1Bytes(`BT /F1 12 Tf 72 700 Td (Page${i + 1}) Tj ET`));
        }
        const atCap = await parsePdfPaged(five.build(), limits({ maxPages: 5 }));
        expect(atCap.text).toBe('Page1 Page2 Page3 Page4 Page5');
        const capped = await parsePdfPaged(five.build(), limits({ maxPages: 3 }));
        expect(capped.totalPages).toBe(3);
        expect(capped.text).toBe('Page1 Page2 Page3');
    });
});

/** The body of a one-page PDF ending in the given text, plus its xref-ready offsets. */
function textPageBody(word: string): { bytes: Uint8Array; offsets: ReadonlyMap<number, number> } {
    return onePagePdf(`BT /F1 12 Tf 72 700 Td (${word}) Tj ET`, '/Font << /F1 5 0 R >>').obj(5, HELVETICA).buildBody();
}

function xrefTable(offsets: ReadonlyMap<number, number>, size: number, claimedCount = size): string {
    let table = `xref\n0 ${claimedCount}\n0000000000 65535 f \n`;
    for (let i = 1; i < size; i++) table += `${String(offsets.get(i) ?? 0).padStart(10, '0')} 00000 n \n`;
    return table;
}

describe('PDF cross-reference — R1 bounded by bytes', () => {
    it('T-8 an xref subsection count larger than the file parses in time proportional to its size', async () => {
        const { bytes, offsets } = textPageBody('Counted');
        const tail = `${xrefTable(offsets, 6, 200_000_000)}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${bytes.length}\n%%EOF`;
        const pdf = concatBytes([bytes, latin1Bytes(tail)]).buffer;
        let text = '';
        const ms = await elapsedMs(async () => { text = (await parsePdf(pdf)).text; });
        expect(text).toBe('Counted');
        expect(ms).toBeLessThan(TIME_BUDGET_MS);

        // The same claim over a table cut off before its trailer: only the bytes
        // left bound the count, and the file falls back to a scan.
        const cut = concatBytes([bytes, latin1Bytes(`${xrefTable(offsets, 6, 200_000_000)}startxref
${bytes.length}
%%EOF`)]).buffer;
        const cutMs = await elapsedMs(async () => { text = (await parsePdf(cut)).text; });
        expect(text).toBe('Counted');
        expect(cutMs).toBeLessThan(TIME_BUDGET_MS);
    }, 30_000);

    it('T-8 an xref stream with entry width 0 is rejected and the file falls back to a scan', async () => {
        // Width 0 means no entry consumes a byte, so a million-entry /Index
        // never runs out of stream; each claimed entry costs a map write.
        const { bytes } = textPageBody('Rescanned');
        const xrefStream = '9 0 obj\n<< /Type /XRef /Size 10 /W [0 0 0] /Index [0 1000000] /Root 1 0 R /Length 0 >>\nstream\n\nendstream\nendobj\n';
        const pdf = concatBytes([bytes, latin1Bytes(`${xrefStream}startxref\n${bytes.length}\n%%EOF`)]).buffer;
        let text = '';
        const ms = await elapsedMs(async () => { text = (await parsePdf(pdf)).text; });
        expect(text).toBe('Rescanned');
        expect(ms).toBeLessThan(TIME_BUDGET_MS);
    }, 30_000);
});

describe('PDF reference cycles — R2', () => {
    /*
     * Object 4 (the page content) appears twice: the xref points at the first
     * copy, a stale second copy follows it. Only a parse that gave up on the
     * xref and re-scanned the file — which is what catching a stack overflow
     * here did — picks up the stale copy.
     */
    function stalePageBody(): { bytes: Uint8Array; offsets: ReadonlyMap<number, number> } {
        return onePagePdf('BT /F1 12 Tf 72 700 Td (Current) Tj ET', '/Font << /F1 5 0 R >>')
            .obj(5, HELVETICA)
            .streamObj(4, '', latin1Bytes('BT /F1 12 Tf 72 700 Td (Stale) Tj ET'))
            .buildBody();
    }

    it('T-9 self-referencing and 2-cycle /Prev chains keep the xref the file declares', async () => {
        const { bytes, offsets } = stalePageBody();
        const selfPrev = concatBytes([bytes, latin1Bytes(
            `${xrefTable(offsets, 6)}trailer\n<< /Size 6 /Root 1 0 R /Prev ${bytes.length} >>\nstartxref\n${bytes.length}\n%%EOF`,
        )]).buffer;
        expect((await parsePdf(selfPrev)).text).toBe('Current');

        // The first section points at the second, which points back at the first.
        const firstHead = `${xrefTable(offsets, 6)}trailer\n<< /Size 6 /Root 1 0 R /Prev `;
        const firstTail = ' >>\n';
        const secondAt = bytes.length + firstHead.length + 10 + firstTail.length;
        const firstFixed = `${firstHead}${String(secondAt).padStart(10, '0')}${firstTail}`;
        const second = `xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 6 /Root 1 0 R /Prev ${bytes.length} >>\n`;
        const twoCycle = concatBytes([bytes, latin1Bytes(`${firstFixed}${second}startxref\n${secondAt}\n%%EOF`)]).buffer;
        expect((await parsePdf(twoCycle)).text).toBe('Current');
    });

    it('T-9 a /Prev chain deeper than the call stack is followed to its oldest section', async () => {
        // 20 000 incremental-update sections, each empty, each pointing at the
        // one before; only the oldest indexes the page. A chain followed by
        // recursion overflows the stack, and catching that overflow loses the
        // oldest section — so the page survives only a walk that needs no stack.
        const { bytes, offsets } = stalePageBody();
        const sections = [`${xrefTable(offsets, 6)}trailer\n<< /Size 6 /Root 1 0 R >>\n`];
        const starts = [bytes.length];
        for (let i = 1; i < 20_000; i++) {
            starts.push(starts[i - 1] + sections[i - 1].length);
            sections.push(`xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 6 /Root 1 0 R /Prev ${starts[i - 1]} >>\n`);
        }
        const deepChain = concatBytes([bytes, latin1Bytes(`${sections.join('')}startxref\n${starts.at(-1)}\n%%EOF`)]).buffer;
        expect((await parsePdf(deepChain)).text).toBe('Current');
    }, 30_000);

    it('T-9 a /Length that resolves to its own stream, or through a 2-cycle, terminates with the stream read by the endstream scan', async () => {
        const content = latin1Bytes('BT /F1 12 Tf 72 700 Td (Measured) Tj ET');
        const selfLength = new RawPdf()
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '/Length 4 0 R', content)
            .obj(5, HELVETICA)
            .build();
        expect((await parsePdf(selfLength)).text).toBe('Measured');

        const crossLength = new RawPdf()
            .obj(1, '/Type /Catalog /Pages 2 0 R')
            .obj(2, '/Type /Pages /Kids [3 0 R] /Count 1')
            .obj(3, '/Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R')
            .streamObj(4, '/Length 6 0 R', content)
            .obj(5, HELVETICA)
            .streamObj(6, '/Length 4 0 R', latin1Bytes('12'))
            .build();
        expect((await parsePdf(crossLength)).text).toBe('Measured');
    });
});

describe('PDF text scanning — R3 linear', () => {
    /** A page whose font's ToUnicode CMap is `cmap`. */
    function cmapPdf(cmap: string): ArrayBuffer {
        return onePagePdf('BT /F1 12 Tf 72 700 Td (Mapped) Tj ET', '/Font << /F1 5 0 R >>')
            .obj(5, `${HELVETICA} /ToUnicode 6 0 R`)
            .streamObj(6, '', latin1Bytes(cmap))
            .build();
    }

    it('T-10 unterminated bfchar/bfrange CMap sections scan in linear time', async () => {
        for (const section of ['beginbfchar', 'beginbfrange']) {
            const unterminated = `1 ${section}\n<41> <0042>\n`.repeat(33_000);
            const cmap = `/CIDInit /ProcSet findresource begin\n1 begincmap\n${unterminated}`;
            let text = '';
            const ms = await elapsedMs(async () => { text = (await parsePdf(cmapPdf(cmap))).text; });
            expect(text, section).toBe('Mapped');
            expect(ms, section).toBeLessThan(TIME_BUDGET_MS);
        }
    }, 60_000);

    it('T-11 long font names and long RTL numbered lines scan in linear time', async () => {
        const spacedName = `Arial${'#20'.repeat(40_000)}x`;
        const fontPdf = onePagePdf('BT /F1 12 Tf 72 700 Td (Named) Tj ET', '/Font << /F1 5 0 R >>')
            .obj(5, `/Type /Font /Subtype /Type1 /BaseFont /${spacedName}`)
            .build();
        let pages = 0;
        const fontMs = await elapsedMs(async () => { pages = (await renderPixelPerfectPaged(fontPdf)).totalPages; });
        expect(pages).toBe(1);
        expect(fontMs).toBeLessThan(TIME_BUDGET_MS);

        // Byte 0x41 maps to HEBREW LETTER ALEF, so the line is right-to-left. A
        // run of tabs, because a run of spaces is collapsed before the line
        // is tested for a list number.
        const hebrewCmap = '1 begincmap\n1 beginbfchar\n<41> <05D0>\nendbfchar\nendcmap';
        const rtlPdf = onePagePdf(`BT /F1 12 Tf 72 700 Td (AAA${'\t'.repeat(100_000)}x) Tj ET`, '/Font << /F1 5 0 R >>')
            .obj(5, `${HELVETICA} /ToUnicode 6 0 R`)
            .streamObj(6, '', latin1Bytes(hebrewCmap))
            .build();
        let text = '';
        const rtlMs = await elapsedMs(async () => { text = (await parsePdf(rtlPdf)).text; });
        expect(text).toContain('א');
        expect(rtlMs).toBeLessThan(TIME_BUDGET_MS);
    }, 60_000);
});

function nestingDepth(obj: PdfObject): number {
    if (obj.type === 'array') {
        return 1 + Math.max(0, ...(obj.value as PdfObject[]).map(nestingDepth));
    }
    if (obj.type === 'dict') {
        return 1 + Math.max(0, ...Object.values(obj.value as Record<string, PdfObject>).map(nestingDepth));
    }
    return 0;
}

describe('PDF object nesting — R2 depth cap', () => {
    it('T-16 nesting past the cap is truncated: PDF arrays and dictionaries', () => {
        const pdf = onePagePdf('')
            .rawObj(6, '[[[[1]]]]')
            .rawObj(7, '[[[[[[1]]]]]]')
            .rawObj(8, '<< /A << /A << /A << /A << /A << /A 1 >> >> >> >> >> >>')
            .build();
        const reader = new PdfReader(pdf, limits({ maxNestingDepth: 4 }));
        reader.parse();
        const resolve = (num: number): PdfObject => reader.resolveRef({ type: 'ref', value: `${num} 0` });
        expect(nestingDepth(resolve(6))).toBe(4);
        expect(nestingDepth(resolve(7))).toBeLessThanOrEqual(4);
        expect(nestingDepth(resolve(8))).toBeLessThanOrEqual(4);
    });

    it('T-16 a skipped container ends where it closes, strings and hex strings included', () => {
        // 50 000 levels is past any call stack. The string and the hex string
        // each hold as many closing brackets as there are levels, then a decoy
        // /After: a skip that read them as the container's end would resume
        // inside and let the decoy replace the real value.
        const levels = 50_000;
        const decoy = `${']'.repeat(levels)} /After 99`;
        const body = `${'['.repeat(levels)}(${decoy}) <${decoy}>${']'.repeat(levels)}`;
        const pdf = onePagePdf('').rawObj(6, `<< /After 7 /Deep ${body} /Last 8 >>`).build();
        const reader = new PdfReader(pdf);
        reader.parse();
        const dict = reader.getDict({ type: 'ref', value: '6 0' });
        expect(nestingDepth(dict['Deep'])).toBeLessThanOrEqual(DEFAULT_PARSER_LIMITS.maxNestingDepth);
        expect([reader.getNumber(dict['After']), reader.getNumber(dict['Last'])]).toEqual([7, 8]);
    });
});

describe('PDF decode budget — R1 bounded by bytes', () => {
    it('T-17 repeated references to one stream stay within the total decode budget', async () => {
        // One FlateDecode stream that inflates to 1 MiB, shared as the ToUnicode
        // CMap of 1500 fonts: each reference decodes it again unless the parse
        // bounds what all decodes together may produce. The text font (F1)
        // has no CMap, so a parse that stops decoding still renders the page.
        const compressed = await deflate(new Uint8Array(MIB));
        const fonts = 1500;
        const fontRefs = Array.from({ length: fonts }, (...[, i]) => `/C${i} ${10 + i} 0 R`).join(' ');
        const pdf = onePagePdf('BT /F1 12 Tf 72 700 Td (Budgeted) Tj ET', `/Font << /F1 5 0 R ${fontRefs} >>`)
            .obj(5, HELVETICA)
            .streamObj(6, '/Filter /FlateDecode', compressed);
        for (let i = 0; i < fonts; i++) pdf.obj(10 + i, `${HELVETICA} /ToUnicode 6 0 R`);
        let text = '';
        const ms = await elapsedMs(async () => {
            text = (await parsePdf(pdf.build(), limits({ maxDecodedBytesTotal: 4 * MIB }))).text;
        });
        expect(text).toBe('Budgeted');
        expect(ms).toBeLessThan(TIME_BUDGET_MS);
    }, 60_000);

    it('T-17 distinct streams past the total decode budget are not decoded', async () => {
        // Six fonts, each with its own 1 MiB CMap mapping byte 0x41 to a different
        // letter. Under a 4.5 MiB budget the first four CMaps decode and the
        // sixth has no budget left, so its font shows the unmapped byte. Caching
        // alone cannot pass this: every stream here is distinct.
        const letters = ['Q', 'R', 'S', 'T', 'U', 'V'];
        const lines = letters.map((...[, i]) => `BT /F${i} 12 Tf 72 ${700 - i * 30} Td (A) Tj ET`).join(' ');
        const fontRefs = letters.map((...[, i]) => `/F${i} ${10 + i} 0 R`).join(' ');
        const pdf = onePagePdf(lines, `/Font << ${fontRefs} >>`);
        for (const [i, letter] of letters.entries()) {
            const cmap = `1 begincmap\n1 beginbfchar\n<41> <00${(letter.codePointAt(0) ?? 0).toString(16)}>\nendbfchar\nendcmap\n`;
            pdf.obj(10 + i, `${HELVETICA} /ToUnicode ${20 + i} 0 R`)
                .streamObj(20 + i, '/Filter /FlateDecode', await deflate(latin1Bytes(cmap.padEnd(MIB, ' '))));
        }
        const text = (await parsePdf(pdf.build(), limits({ maxDecodedBytesTotal: 4.5 * MIB }))).text;
        // The fifth CMap straddles the budget: skipping it or truncating it are
        // both allowed, so only the fully-fitting four and the sixth, for which
        // nothing is left, are pinned.
        const glyphs = text.split(/\s+/);
        expect(glyphs).toHaveLength(6);
        expect(glyphs.slice(0, 4)).toEqual(['Q', 'R', 'S', 'T']);
        expect(glyphs[5]).toBe('A');
    }, 60_000);
});

describe('PDF shared document structure — R2 visit once', () => {
    it('T-18 the structure tree visits a shared element once', async () => {
        const depth = 23;
        const pdf = onePagePdf(
            'BT /F1 12 Tf 72 700 Td /H1 << /MCID 0 >> BDC (Tagged) Tj EMC ET', '/Font << /F1 5 0 R >>', '/StructTreeRoot 10 0 R',
        ).obj(5, HELVETICA);
        pdf.obj(10, '/Type /StructTreeRoot /K 11 0 R');
        // Every level lists the same child twice; only the leaf tags the text as H1.
        for (let level = 0; level < depth; level++) {
            const kids = level === depth - 1 ? '0' : `[${12 + level} 0 R ${12 + level} 0 R]`;
            pdf.obj(11 + level, `/Type /StructElem /S /${level === depth - 1 ? 'H1' : 'Div'} /Pg 3 0 R /K ${kids}`);
        }
        let result = { text: '', html: '' };
        const ms = await elapsedMs(async () => { result = await parsePdf(pdf.build()); });
        expect(result.text).toBe('Tagged');
        // 12pt body text becomes a heading only through the structure tree, so a
        // parse that drops a shared tree loses it.
        expect(result.html).toMatch(/<h1[^>]*>.*Tagged/);
        expect(ms).toBeLessThan(TIME_BUDGET_MS);
    }, 60_000);

    it('T-18 outlines visit a shared child list once', async () => {
        // Every item of every level points at the same next-level list, so a
        // walk that re-enters shared lists yields 3 + 9 + … + 3^10 items.
        const fanOut = 3;
        const levels = 10;
        const pdf = onePagePdf('BT /F1 12 Tf 72 700 Td (Outlined) Tj ET', '/Font << /F1 5 0 R >>', '/Outlines 9 0 R')
            .obj(5, HELVETICA);
        pdf.obj(9, '/Type /Outlines /First 100 0 R');
        for (let level = 0; level < levels; level++) {
            for (let i = 0; i < fanOut; i++) {
                const num = 100 + level * fanOut + i;
                const next = i < fanOut - 1 ? ` /Next ${num + 1} 0 R` : '';
                const first = level < levels - 1 ? ` /First ${100 + (level + 1) * fanOut} 0 R` : '';
                pdf.obj(num, `/Title (L${level}I${i})${next}${first}`);
            }
        }
        const outline = (await parsePdfPaged(pdf.build())).outline;
        const flatten = (items: ReadonlyArray<PdfOutlineItem>): string[] =>
            items.flatMap(item => [item.title, ...flatten(item.children)]);
        const titles = flatten(outline);
        expect(titles).toHaveLength(fanOut * levels);
        expect(new Set(titles).size).toBe(fanOut * levels);
        expect(outline.map(item => item.title)).toEqual(['L0I0', 'L0I1', 'L0I2']);
    });

    it('T-18 readable font resources visit a shared form XObject once', async () => {
        const fanOut = 260;
        const names = (num: number): string =>
            Array.from({ length: fanOut }, (...[, i]) => `/X${i} ${num} 0 R`).join(' ');
        const pdf = onePagePdf('BT /F1 12 Tf 72 700 Td (Fonts) Tj ET', `/Font << /F1 5 0 R >> /XObject << ${names(10)} >>`)
            .obj(5, HELVETICA)
            .streamObj(10, `/Type /XObject /Subtype /Form /BBox [0 0 1 1] /Resources << /Font << /F1 5 0 R >> /XObject << ${names(11)} >> >>`, latin1Bytes(''))
            .streamObj(11, `/Type /XObject /Subtype /Form /BBox [0 0 1 1] /Resources << /Font << /F1 5 0 R >> /XObject << ${names(12)} >> >>`, latin1Bytes(''))
            .streamObj(12, '/Type /XObject /Subtype /Form /BBox [0 0 1 1] /Resources << /Font << /F1 5 0 R >> >>', latin1Bytes(''));
        let text = '';
        const ms = await elapsedMs(async () => { text = (await parsePdfReadable(pdf.build())).text; });
        expect(text).toContain('Fonts');
        expect(ms).toBeLessThan(TIME_BUDGET_MS);
    }, 60_000);
});
