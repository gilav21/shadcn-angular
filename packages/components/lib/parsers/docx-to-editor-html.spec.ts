import { describe, expect, it } from 'vitest';
import { renderDocxForEditor } from './docx-to-editor-html';
import type {
    DocxParseResult,
    DocxParagraph,
    DocxTable,
    DocxImage,
    DocxRun,
    DocxRunStyle,
    DocxTableRow,
    DocxTableCell,
} from './docx-parser';

function run(text: string, style: Partial<DocxRunStyle> = {}, extra: Partial<DocxRun> = {}): DocxRun {
    return { text, style: style as DocxRunStyle, ...extra };
}

function para(runs: DocxRun[], extra: Partial<DocxParagraph> = {}): DocxParagraph {
    return { type: 'paragraph', runs, style: '', ...extra };
}

function result(elements: Array<DocxParagraph | DocxTable | DocxImage>): DocxParseResult {
    return {
        elements,
        plainText: '',
        footnotes: [],
        endnotes: [],
        comments: [],
        headers: [],
        footers: [],
    };
}

function cell(runs: DocxRun[], extra: Partial<DocxTableCell> = {}): DocxTableCell {
    return { elements: [para(runs)], colSpan: 1, rowSpan: 1, ...extra };
}

function row(cells: DocxTableCell[], extra: Partial<DocxTableRow> = {}): DocxTableRow {
    return { cells, ...extra };
}

describe('renderDocxForEditor — paragraphs and runs', () => {
    it('renders a plain paragraph wrapping escaped text', () => {
        const html = renderDocxForEditor(result([para([run('Hello <world> & "co"')])]));
        expect(html).toBe('<p>Hello &lt;world&gt; &amp; &quot;co&quot;</p>');
    });

    it('renders an empty paragraph as <br>', () => {
        expect(renderDocxForEditor(result([para([])]))).toBe('<p><br></p>');
    });

    it('wraps bold, italic, underline, strike runs in semantic tags', () => {
        const html = renderDocxForEditor(result([
            para([run('b', { bold: true })]),
            para([run('i', { italic: true })]),
            para([run('u', { underline: true })]),
            para([run('s', { strikethrough: true })]),
        ]));
        expect(html).toContain('<p><strong>b</strong></p>');
        expect(html).toContain('<p><em>i</em></p>');
        expect(html).toContain('<p><u>u</u></p>');
        expect(html).toContain('<p><s>s</s></p>');
    });

    it('nests bold+italic strong outside em', () => {
        const html = renderDocxForEditor(result([para([run('x', { bold: true, italic: true })])]));
        expect(html).toBe('<p><em><strong>x</strong></em></p>');
    });

    it('renders double strikethrough with double text-decoration style', () => {
        const html = renderDocxForEditor(result([para([run('d', { doubleStrikethrough: true })])]));
        expect(html).toContain('<s style="text-decoration-style:double">d</s>');
    });

    it('renders superscript and subscript', () => {
        const sup = renderDocxForEditor(result([para([run('2', { vertAlign: 'superscript' })])]));
        const sub = renderDocxForEditor(result([para([run('2', { vertAlign: 'subscript' })])]));
        expect(sup).toBe('<p><sup>2</sup></p>');
        expect(sub).toBe('<p><sub>2</sub></p>');
    });

    it('builds a span with color, font-size, font-family, highlight, spacing, caps', () => {
        const html = renderDocxForEditor(result([para([run('styled', {
            color: '#FF0000',
            fontSize: 14,
            fontFamily: 'Arial',
            highlight: '#FFFF00',
            charSpacing: 2,
            smallCaps: true,
            caps: true,
        })])]));
        expect(html).toContain('color:#FF0000');
        expect(html).toContain('font-size:14pt');
        expect(html).toContain('font-family:Arial');
        expect(html).toContain('background-color:#FFFF00');
        expect(html).toContain('letter-spacing:2pt');
        expect(html).toContain('font-variant:small-caps');
        expect(html).toContain('text-transform:uppercase');
        expect(html).toMatch(/^<p><span style="/);
    });

    it('uses backgroundColor when present', () => {
        const html = renderDocxForEditor(result([para([run('bg', { backgroundColor: '#EEEEEE' })])]));
        expect(html).toContain('background-color:#EEEEEE');
    });

    it('adds dir=rtl on rtl runs via span', () => {
        const html = renderDocxForEditor(result([para([run('א', { rtl: true })])]));
        expect(html).toBe('<p><span dir="rtl">א</span></p>');
    });

    it('hidden runs are skipped entirely', () => {
        const html = renderDocxForEditor(result([para([run('visible'), run('secret', { hidden: true })])]));
        expect(html).toBe('<p>visible</p>');
    });

    it('wraps inserted and deleted runs in ins/del', () => {
        const ins = renderDocxForEditor(result([para([run('new', {}, { isInserted: true })])]));
        const del = renderDocxForEditor(result([para([run('old', {}, { isDeleted: true })])]));
        expect(ins).toBe('<p><ins>new</ins></p>');
        expect(del).toBe('<p><del>old</del></p>');
    });

    it('renders hyperlink runs as anchors with escaped href', () => {
        const html = renderDocxForEditor(result([para([
            run('link', { underline: true, color: '#0563C1' }, { href: 'https://x.com/?a=1&b=2' }),
        ])]));
        expect(html).toContain('<a href="https://x.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">');
        expect(html).toContain('</a>');
    });
});

describe('renderDocxForEditor — breaks and headings', () => {
    it('textWrapping/column break produces <br>', () => {
        const wrap = renderDocxForEditor(result([para([run('a'), run('\n', {}, { breakType: 'textWrapping' }), run('b')])]));
        expect(wrap).toBe('<p>a<br>b</p>');
        const col = renderDocxForEditor(result([para([run('\n', {}, { breakType: 'column' })])]));
        expect(col).toBe('<p><br></p>');
    });

    it('a page break run prefixes <hr> and is omitted from content', () => {
        const html = renderDocxForEditor(result([para([run('after', {}, { breakType: 'page' })])]));
        expect(html.startsWith('<hr>')).toBe(true);
        expect(html).toContain('<p>');
        expect(html).not.toContain('\n');
    });

    it('maps Heading1..Heading7 to h1..h6 (clamped at 6)', () => {
        const html = renderDocxForEditor(result([
            para([run('H1')], { style: 'Heading1' }),
            para([run('H7')], { style: 'Heading7' }),
        ]));
        expect(html).toContain('<h1>H1</h1>');
        expect(html).toContain('<h6>H7</h6>');
    });

    it('applies paragraph dir=rtl and style attrs on heading', () => {
        const html = renderDocxForEditor(result([
            para([run('title')], { style: 'Heading2', rtl: true, alignment: 'center' }),
        ]));
        expect(html).toMatch(/<h2 dir="rtl" style="text-align:center">title<\/h2>/);
    });
});

describe('renderDocxForEditor — paragraph styles', () => {
    it('emits alignment, spacing, indents, first-line, line-height, shading', () => {
        const html = renderDocxForEditor(result([para([run('p')], {
            alignment: 'justify',
            spacingBefore: 6,
            spacingAfter: 12,
            indentLeft: 36,
            indentRight: 18,
            indentFirstLine: 24,
            lineSpacing: 1.5,
            shading: '#DDDDDD',
        })]));
        expect(html).toContain('text-align:justify');
        expect(html).toContain('margin-top:6pt');
        expect(html).toContain('margin-bottom:12pt');
        expect(html).toContain('margin-left:36pt');
        expect(html).toContain('margin-right:18pt');
        expect(html).toContain('text-indent:24pt');
        expect(html).toContain('line-height:1.50');
        expect(html).toContain('background-color:#DDDDDD');
    });

    it('renders hanging indent as negative text-indent only when no first-line', () => {
        const html = renderDocxForEditor(result([para([run('p')], { indentHanging: 18 })]));
        expect(html).toContain('text-indent:-18pt');
    });

    it('large lineSpacing (>4) renders as pt', () => {
        const html = renderDocxForEditor(result([para([run('p')], { lineSpacing: 24 })]));
        expect(html).toContain('line-height:24.0pt');
    });

    it('renders paragraph borders with padding and mapped styles', () => {
        const html = renderDocxForEditor(result([para([run('p')], {
            borders: {
                top: { style: 'dashed', color: '#111111', size: 1 },
                bottom: { style: 'dotted', color: '#222222', size: 2 },
                left: { style: 'double', color: '#333333', size: 3 },
                right: { style: 'single', color: '#444444', size: 0.25 },
            },
        })]));
        expect(html).toContain('border-top:1pt dashed #111111');
        expect(html).toContain('border-bottom:2pt dotted #222222');
        expect(html).toContain('border-left:3pt double #333333');
        expect(html).toContain('border-right:0.5pt solid #444444');
        expect(html).toContain('padding:2pt 4pt');
    });
});

describe('renderDocxForEditor — lists', () => {
    it('groups consecutive bullet items into a <ul>', () => {
        const html = renderDocxForEditor(result([
            para([run('a')], { listLevel: 0, listType: 'bullet' }),
            para([run('b')], { listLevel: 0, listType: 'bullet' }),
        ]));
        expect(html).toBe('<ul><li>a</li><li>b</li></ul>');
    });

    it('groups numbered items into <ol>', () => {
        const html = renderDocxForEditor(result([
            para([run('one')], { listLevel: 0, listType: 'numbered' }),
        ]));
        expect(html).toBe('<ol><li>one</li></ol>');
    });

    it('nests a deeper level inside the parent list item', () => {
        const html = renderDocxForEditor(result([
            para([run('top')], { listLevel: 0, listType: 'bullet' }),
            para([run('child')], { listLevel: 1, listType: 'bullet' }),
            para([run('back')], { listLevel: 0, listType: 'bullet' }),
        ]));
        expect(html).toBe('<ul><li>top<ul><li>child</li></ul></li><li>back</li></ul>');
    });

    it('closes list and renders a following plain paragraph', () => {
        const html = renderDocxForEditor(result([
            para([run('item')], { listLevel: 0, listType: 'bullet' }),
            para([run('text')]),
        ]));
        expect(html).toBe('<ul><li>item</li></ul><p>text</p>');
    });
});

describe('renderDocxForEditor — images', () => {
    it('renders an image with width/height/alt and escaped src', () => {
        const img: DocxImage = {
            type: 'image',
            dataUrl: 'data:image/png;base64,AAA"BBB',
            width: 100,
            height: 50,
            altText: 'My <pic>',
        };
        const html = renderDocxForEditor(result([img]));
        expect(html).toContain('<img src="data:image/png;base64,AAA&quot;BBB"');
        expect(html).toContain('width="100"');
        expect(html).toContain('height="50"');
        expect(html).toContain('alt="My &lt;pic&gt;"');
    });

    it('omits zero width/height and falls back alt to "image"', () => {
        const img: DocxImage = { type: 'image', dataUrl: 'data:image/png;base64,X', width: 0, height: 0, altText: '' };
        const html = renderDocxForEditor(result([img]));
        expect(html).not.toContain('width=');
        expect(html).not.toContain('height=');
        expect(html).toContain('alt="image"');
    });
});

describe('renderDocxForEditor — tables', () => {
    it('renders a table with thead/tbody and header cells as th', () => {
        const table: DocxTable = {
            type: 'table',
            rows: [
                row([cell([run('H1')]), cell([run('H2')])], { rowStyle: { isHeader: true } }),
                row([cell([run('a')]), cell([run('b')])]),
            ],
        };
        const html = renderDocxForEditor(result([table]));
        expect(html).toContain('<table style="border-collapse:collapse">');
        expect(html).toContain('<thead><tr><th');
        expect(html).toContain('<p>H1</p></th>');
        expect(html).toContain('<tbody><tr><td');
        expect(html).toContain('<p>a</p></td>');
        expect(html).toContain('</tbody></table>');
    });

    it('applies colspan/rowspan attributes', () => {
        const table: DocxTable = {
            type: 'table',
            rows: [row([cell([run('wide')], { colSpan: 2, rowSpan: 2 })])],
        };
        const html = renderDocxForEditor(result([table]));
        expect(html).toContain('colspan="2"');
        expect(html).toContain('rowspan="2"');
    });

    it('renders cell background, vertical-align, paddings and percent width', () => {
        const table: DocxTable = {
            type: 'table',
            tableStyle: { width: 5000, widthUnit: 'pct' },
            rows: [row([cell([run('c')], {
                cellStyle: {
                    backgroundColor: '#ABCDEF',
                    verticalAlign: 'center',
                    width: 2500,
                    widthUnit: 'pct',
                    paddings: { top: 2, bottom: 2, left: 4, right: 4 },
                },
            })])],
        };
        const html = renderDocxForEditor(result([table]));
        expect(html).toContain('width:100.0%');
        expect(html).toContain('background-color:#ABCDEF');
        expect(html).toContain('vertical-align:center');
        expect(html).toContain('width:50.0%');
        expect(html).toContain('padding-top:2pt');
        expect(html).toContain('padding-left:4pt');
    });

    it('uses table-level border fallbacks on edge and inside cells', () => {
        const border = { style: 'single', color: '#000000', size: 1 };
        const table: DocxTable = {
            type: 'table',
            tableStyle: {
                borders: {
                    top: border, bottom: border, left: border, right: border,
                    insideH: { style: 'single', color: '#999999', size: 1 },
                    insideV: { style: 'single', color: '#888888', size: 1 },
                },
            },
            rows: [
                row([cell([run('r0c0')]), cell([run('r0c1')])]),
                row([cell([run('r1c0')]), cell([run('r1c1')])]),
            ],
        };
        const html = renderDocxForEditor(result([table]));
        expect(html).toContain('border-top:1pt solid #000000');
        expect(html).toContain('border-bottom:1pt solid #999999');
        expect(html).toContain('border-right:1pt solid #888888');
    });

    it('renders row height and dxa table/cell width as pt', () => {
        const table: DocxTable = {
            type: 'table',
            tableStyle: { width: 9000, widthUnit: 'dxa' },
            rows: [row([cell([run('c')], { cellStyle: { width: 1800, widthUnit: 'dxa' } })], { rowStyle: { height: 20 } })],
        };
        const html = renderDocxForEditor(result([table]));
        expect(html).toContain('width:450pt');
        expect(html).toContain('height:20pt');
        expect(html).toContain('width:90pt');
    });

    it('renders nested table inside a cell', () => {
        const inner: DocxTable = { type: 'table', rows: [row([cell([run('inner')])])] };
        const outer: DocxTable = {
            type: 'table',
            rows: [row([{ elements: [inner], colSpan: 1, rowSpan: 1 }])],
        };
        const html = renderDocxForEditor(result([outer]));
        expect(html).toContain('<p>inner</p></td>');
        const tableOpenCount = (html.match(/<table/g) ?? []).length;
        expect(tableOpenCount).toBe(2);
    });
});
