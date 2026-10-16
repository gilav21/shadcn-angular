import { describe, expect, it } from 'vitest';
import hebrewReceiptUrl from '../../../../demo/public/examples/hebrew-receipt.pdf?url';
import invoiceUrl from '../../../../demo/public/examples/invoice.pdf?url';
import newsletterUrl from '../../../../demo/public/examples/newsletter.pdf?url';
import quarterlyReportUrl from '../../../../demo/public/examples/quarterly-report.pdf?url';
import registrationFormUrl from '../../../../demo/public/examples/registration-form.pdf?url';
import { parseDoc } from './doc-parser';
import { parseDocEnhanced } from './doc-enhanced-parser';
import { buildClx, buildOle2Doc, buildWordDocument, writeAnsi } from './doc-test-fixtures';
import { parsePdf, parsePdfPaged } from './pdf-parser';
import { renderPixelPerfectPaged } from './pdf-pixel-perfect';
import { parsePdfReadable } from './pdf-readable/pdf-readable';
import { PdfBuilder } from './pdf-test-fixtures';
import { parsePpt } from './ppt-parser';
import { parsePptx } from './pptx-parser';
import { generateXlsx } from './xlsx';
import { parseXlsx } from './xlsx-reader';
import { buildStoredZip } from './zip-test-fixtures';

/**
 * T-19 — every well-formed document produces identical output before and
 * after the parser resource limits. Every hash below was captured from parser
 * sources identical to 14216e9b, before any parser change (the pptx and ppt
 * entries were added later in Task 1, but no pptx, ppt or OLE2 source had
 * changed); a limit that truncates a real document changes its hash.
 */
const GOLDEN: Readonly<Record<string, string>> = {
    'built-doc/parseDoc': '9120a865fe36fa5d401940aa42e7033557af11c44f63ccb68457a3ed255fd8f0',
    'built-doc/parseDocEnhanced': '928317158106a55fe1a5a934dae026243266b8948da94f28f8d0c5b8acfb63eb',
    'built-pdf/parsePdf': '21874ac9fde4739a4440ed636c53aa5679085d7a253140fd9b8ef9b754fbc816',
    'built-pdf/parsePdfPaged': 'd878979cf6ded271ad02ec9ffa78799667e74dbc9a0ee25e6bc942e718dc764f',
    'built-pdf/parsePdfReadable': '739dde4041852b4950a5393630f6cfc1cffa6c75165eb5949f18b4b701f37724',
    'built-pdf/renderPixelPerfectPaged': '2209c47ba4c227fb8b65b859149ee990ce5bae76d1dd5c03786026b890ec561f',
    'built-ppt/parsePpt': '2aad5916ab0328e938bdcee5970bee325557c3bfe15cf691fd5b6732ba23befc',
    'built-pptx/parsePptx': '339ab2dd4f7e0df9d171560052beaff5f7492b22f7d85e0856465781ac9c8d28',
    'generated-xlsx/parseXlsx': 'd4a312bcbfcd9098609cfecc56d3eac732085f2f7e47a19a98b4af52ba377835',
    'hebrew-receipt/parsePdf': '866e7deac53b87a8c8ecab0422be79a03d2a9b8d1e4ad470ac29851a1ace1188',
    'hebrew-receipt/parsePdfPaged': '37840093a815bed69373bdf0d30ed0a1f3b73e37937fc2828c6408d0a4c49e75',
    'hebrew-receipt/parsePdfReadable': '9009112d78c5fce423d84c6aaf65b7750ae9730b37fe9fabe9421070a6785d0a',
    'hebrew-receipt/renderPixelPerfectPaged': '8757b6c797648e219dbea1d38c2502fd2ef23c991b2d10dd9f802379458e14a4',
    'invoice/parsePdf': '23d5356bb47d23e50b157eb0081439e58973cbe928896af979fb324e98edade6',
    'invoice/parsePdfPaged': '1b34fd423e71025629327a082b35bedc133c5d458d2be9b0ad87943822fc4b19',
    'invoice/parsePdfReadable': 'dae2c6136c240783b689072df8c18b05d9c550989b799cdbcb85edbf9425cfd4',
    'invoice/renderPixelPerfectPaged': '1bb05f400cb0e7115a159d61568efcdf83ca87702a5594cfc1d720d35760a1eb',
    'newsletter/parsePdf': '8d32ea256a0c107ba0846ecf8e0f78854e21577c97c8568aaf5c980018c1cea4',
    'newsletter/parsePdfPaged': 'a713bbab16e8a53eb22a8f62ac37f3a5464b0155bfa37a8d27a5f2f2e19dbfd1',
    'newsletter/parsePdfReadable': '3c88cd09194077fec5ed0da13bed12e72c1836a2549f661a6602e420d7a2e0ce',
    'newsletter/renderPixelPerfectPaged': '0862423842e986e0930c551b6124167dc048c5368a99ae8ba1712f20edc9275a',
    'quarterly-report/parsePdf': 'f82c55b84324040b3d6817781bf876bdcb8306687c21a68916bbcaddee3b5334',
    'quarterly-report/parsePdfPaged': 'f94639027ecf81a6861c19a7c2093788bf2cc5b86692cfef0c3335f6e7646a9a',
    'quarterly-report/parsePdfReadable': '12e6b75ea6e3d6a6077d50d273f3d95495bade5269a1bcdb801433dfdac172ed',
    'quarterly-report/renderPixelPerfectPaged': 'd81ea8aa044eee77b4f2a4c6ddb8664da47d91b1f822e8235ec3b93850ac45e3',
    'registration-form/parsePdf': '9c43ef4a09dc8501d1bdda3f6a1fb04cf2253889dcf437c040c4e6a50e0d8ca2',
    'registration-form/parsePdfPaged': '3e5b072f89b383f9732b6953896c086f3f96b81e27d67280fa0097e4e2c7fef7',
    'registration-form/parsePdfReadable': 'cb85d41fdadd7ece48f7004e3020951899149ed59cd070208748a227d68b02e6',
    'registration-form/renderPixelPerfectPaged': '5923b59b0cb8a3f93983963b612bf4f3e8f4676be395c04f27308ae18d57d1e9',
};

const DEMO_PDFS: ReadonlyArray<readonly [string, string]> = [
    ['hebrew-receipt', hebrewReceiptUrl],
    ['invoice', invoiceUrl],
    ['newsletter', newsletterUrl],
    ['quarterly-report', quarterlyReportUrl],
    ['registration-form', registrationFormUrl],
];

async function sha256(value: unknown): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** Every PDF entry point, each given its own copy of the bytes. */
async function pdfOutputs(bytes: ArrayBuffer): Promise<Record<string, unknown>> {
    return {
        parsePdf: await parsePdf(bytes.slice(0)),
        parsePdfPaged: await parsePdfPaged(bytes.slice(0)),
        parsePdfReadable: await parsePdfReadable(bytes.slice(0), { fontFamilyPrefix: 'golden-' }),
        renderPixelPerfectPaged: await renderPixelPerfectPaged(bytes.slice(0)),
    };
}

function builtPdf(): ArrayBuffer {
    return new PdfBuilder()
        .addFont('F1', 'Helvetica')
        .addFont('F2', 'Helvetica-Bold', { flags: 262144, fontWeight: 700 })
        .addStructureTree('H1', 0)
        .setContent('BT /F2 20 Tf 72 720 Td /H1 << /MCID 0 >> BDC (Quarterly summary) Tj EMC ET '
            + 'BT /F1 12 Tf 72 690 Td (Revenue grew in every region this quarter.) Tj ET')
        .addPage('BT /F1 12 Tf 72 720 Td (Second page body text.) Tj ET')
        .addLinkAnnotation(0, [72, 680, 300, 700], 'https://example.com/report')
        .build();
}

function builtDoc(): Uint8Array {
    const text = 'Meeting notes\rAgenda items for the week.\rAction points follow.\r';
    const textFc = 0x600;
    const clx = buildClx([{ cpStart: 0, cpEnd: text.length, fc: textFc, compressed: true }]);
    const wd = buildWordDocument(textFc + text.length + 16, {
        ccpText: text.length, fcClx: 0x40, lcbClx: clx.length,
        fcMin: textFc, fcMac: textFc + text.length,
    });
    writeAnsi(wd, textFc, text);
    const table = new Uint8Array(0x40 + clx.length);
    table.set(clx, 0x40);
    return buildOle2Doc([
        { name: 'WordDocument', data: wd },
        { name: '0Table', data: table },
    ]);
}

const PML = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
    + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function pptxShape(id: number, text: string, x: number): string {
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
        + `<p:spPr><a:xfrm><a:off x="${x}" y="952500"/><a:ext cx="1905000" cy="476250"/></a:xfrm><a:prstGeom prst="rect"/>`
        + '<a:solidFill><a:srgbClr val="4472C4"/></a:solidFill></p:spPr>'
        + `<p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1800" b="1"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

/** One slide: a title shape and a two-level group holding two shapes. */
function builtPptx(): Uint8Array {
    const group = (id: number, inner: string): string =>
        `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="g${id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
        + '<p:grpSpPr><a:xfrm><a:off x="952500" y="952500"/><a:ext cx="3810000" cy="3810000"/>'
        + `<a:chOff x="0" y="0"/><a:chExt cx="3810000" cy="3810000"/></a:xfrm></p:grpSpPr>${inner}</p:grpSp>`;
    const body = pptxShape(2, 'Roadmap review', 0) + group(10, pptxShape(3, 'Grouped', 0) + group(11, pptxShape(4, 'Nested', 1905000)));
    return buildStoredZip([
        {
            path: 'ppt/presentation.xml',
            content: `<?xml version="1.0"?><p:presentation ${PML}><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`,
        },
        {
            path: 'ppt/_rels/presentation.xml.rels',
            content: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
        },
        { path: 'ppt/slides/slide1.xml', content: `<?xml version="1.0"?><p:sld ${PML}><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>` },
    ]);
}

/** A PowerPoint 97 file: two slides of text atoms in a SlideListWithText container. */
function builtPpt(): Uint8Array {
    const record = (ver: number, type: number, body: number[]): number[] => [
        ver, 0, type & 0xff, type >> 8, body.length & 0xff, (body.length >> 8) & 0xff, 0, 0, ...body,
    ];
    const chars = (text: string): number[] => [...text].flatMap(c => [(c.codePointAt(0) ?? 0) & 0xff, (c.codePointAt(0) ?? 0) >> 8]);
    const persist = record(0, 0x03f3, new Array<number>(20).fill(0));
    const children = [
        ...persist, ...record(0, 0x0fa0, chars('Launch plan')), ...record(0, 0x0fa0, chars('Milestones and owners')),
        ...persist, ...record(0, 0x0fa0, chars('Risks')),
    ];
    return buildOle2Doc([{ name: 'PowerPoint Document', data: new Uint8Array(record(0x0f, 0x0ff0, children)) }]);
}

async function expectGolden(key: string, value: unknown): Promise<void> {
    const json = JSON.stringify(value);
    const hash = await sha256(value);
    // The size beside the key says, on a mismatch, whether output grew or shrank.
    expect.soft(hash, `${key} (${json.length} chars of JSON)`).toBe(GOLDEN[key]);
}

describe('T-19 every existing parser fixture produces identical output', () => {
    it.each(DEMO_PDFS)('demo PDF %s through every PDF entry point', async (name, url) => {
        const bytes = await fetch(url).then(r => r.arrayBuffer());
        const outputs = await pdfOutputs(bytes);
        for (const [entry, value] of Object.entries(outputs)) {
            await expectGolden(`${name}/${entry}`, value);
        }
    });

    it('the shared PdfBuilder fixture through every PDF entry point', async () => {
        const outputs = await pdfOutputs(builtPdf());
        for (const [entry, value] of Object.entries(outputs)) {
            await expectGolden(`built-pdf/${entry}`, value);
        }
    });

    it('the shared .doc fixture through both .doc parsers', async () => {
        await expectGolden('built-doc/parseDoc', parseDoc(builtDoc()));
        await expectGolden('built-doc/parseDocEnhanced', parseDocEnhanced(builtDoc()));
    });

    it('a generated workbook through parseXlsx', async () => {
        const workbook = generateXlsx([
            ['Region', 'Q1', 'Q2'],
            ['North', '1200', '1350'],
            ['South', '980', '1010'],
        ], { boldFirstRow: true });
        await expectGolden('generated-xlsx/parseXlsx', parseXlsx(workbook));
    });

    it('a grouped-shape presentation through parsePptx', async () => {
        await expectGolden('built-pptx/parsePptx', parsePptx(builtPptx()));
    });

    it('a PowerPoint 97 file through parsePpt', async () => {
        await expectGolden('built-ppt/parsePpt', parsePpt(builtPpt()));
    });
});
