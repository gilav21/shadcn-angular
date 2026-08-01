import { describe, expect, it } from 'vitest';
import { emitDocument, preserveLineBreaks } from './readable-emit';
import { lineOf, wordAt } from './readable-spec-helpers';
import type { DocModel, Line, Word } from './readable-types';

describe('preserveLineBreaks', () => {
    it('is false for a single line', () => {
        expect(preserveLineBreaks([lineOf('only line', 50, 500, 700)])).toBe(false);
    });

    it('keeps flowing prose joined (most lines reach the wrap edge)', () => {
        const lines = [
            lineOf('a line that runs the full measure here', 50, 540, 700),
            lineOf('another line that also fills the measure', 50, 535, 686),
            lineOf('and one more that reaches across too', 50, 538, 672),
            lineOf('short tail', 50, 130, 658),
        ];
        expect(preserveLineBreaks(lines)).toBe(false);
    });

    it('preserves breaks for a stack of short key/value lines', () => {
        const lines = [
            lineOf('Name: Ada', 50, 160, 700),
            lineOf('Email: ada@x.io', 50, 200, 686),
            lineOf('Phone: 123', 50, 150, 672),
            lineOf('City: Metropolis', 50, 210, 658),
        ];
        expect(preserveLineBreaks(lines)).toBe(true);
    });

    it('measures the right edge for RTL stacks', () => {
        const lines: Line[] = [
            lineOf('ערך', 530, 582, 600, { dir: 'rtl' }),
            lineOf('ועוד', 535, 582, 584, { dir: 'rtl' }),
            lineOf('ערך ארוך יותר', 440, 582, 568, { dir: 'rtl' }),
        ];
        expect(preserveLineBreaks(lines)).toBe(true);
    });
});

describe('inline image emission', () => {
    const OPTS = { embedFonts: false, includeImages: true, pageWrappers: false, fontFamilyPrefix: 'p-' };
    const icon = {
        dataUrl: 'data:image/png;base64,AAAA', width: 9, height: 9,
        renderWidth: 9, renderHeight: 9, x: 438, y: 743, page: 0,
    };

    function docWith(lines: Line[]): DocModel {
        return {
            pages: [{ index: 0, width: 612, height: 792, blocks: [
                { kind: 'paragraph', lines, page: 0, style: { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '', background: '', border: '' } },
            ] }],
            bodyFontSize: 12,
        };
    }

    function imageWord(): Word {
        return {
            text: '', x: 438, endX: 447, y: 743, fontSize: 12,
            style: wordAt('x', 0, 0, 0).style, mcid: -1,
            spaceBefore: true, hardBreak: false, image: icon,
        };
    }

    it('emits an inline word image as an <img> at its reading position', () => {
        const line = lineOf('/in/gil-avraham/', 453, 543, 743);
        line.words.unshift(imageWord());
        const { html } = emitDocument(docWith([line]), OPTS, new Map());
        const img = html.indexOf('<img');
        const text = html.indexOf('/in/gil-avraham/');
        expect(img).toBeGreaterThan(-1);
        expect(img).toBeLessThan(text);
    });

    it('keeps a line-ending image across a paragraph line join', () => {
        const first = lineOf('Jerusalem, Israel', 311, 427, 743);
        first.words.push(imageWord());
        const second = lineOf('more text below', 311, 400, 723);
        const { html } = emitDocument(docWith([first, second]), OPTS, new Map());
        expect(html).toContain('<img');
        expect(html).toContain('more text below');
    });
});

describe('stacked line breaks', () => {
    const OPTS = { embedFonts: false, includeImages: true, pageWrappers: false, fontFamilyPrefix: 'p-' };

    function stackDoc(): DocModel {
        const lines = [
            lineOf('Name: Ada', 50, 160, 700),
            lineOf('Email: ada@x.io', 50, 200, 686),
            lineOf('Phone: 123', 50, 150, 672),
            lineOf('City: Metropolis', 50, 210, 658),
        ];
        return {
            pages: [{ index: 0, width: 612, height: 792, blocks: [
                { kind: 'paragraph', lines, page: 0, style: { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '', background: '', border: '' } },
            ] }],
            bodyFontSize: 12,
        };
    }

    it('keeps the words separated in the text layer across a <br>', () => {
        const { html } = emitDocument(stackDoc(), OPTS, new Map());
        expect(html).toContain('<br>');
        const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
        expect(text).not.toContain('Adaemail');
        expect(text.replaceAll(/\s+/g, ' ')).toContain('Name: Ada Email: ada@x.io');
    });
});

describe('heading font weight', () => {
    const OPTS2 = { embedFonts: false, includeImages: true, pageWrappers: false, fontFamilyPrefix: 'p-' };
    const styleOf = (bold: boolean) => ({ ...wordAt('x', 0, 0, 0).style, bold });

    function headingDoc(bold: boolean): DocModel {
        const line = lineOf('Welcome', 50, 300, 700, { fontSize: 30 });
        line.words[0].style = styleOf(bold);
        return {
            pages: [{ index: 0, width: 612, height: 792, blocks: [
                { kind: 'heading', level: 1, lines: [line], page: 0, style: { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: '', background: '', border: '' } },
            ] }],
            bodyFontSize: 12,
        };
    }

    it('emits font-weight:normal on a heading whose PDF text is not bold', () => {
        const { html } = emitDocument(headingDoc(false), OPTS2, new Map());
        expect(html).toContain('font-weight:normal');
    });

    it('leaves a genuinely bold heading without the override', () => {
        const { html } = emitDocument(headingDoc(true), OPTS2, new Map());
        expect(html).not.toContain('font-weight:normal');
    });
});

describe('signature slot cells', () => {
    const OPTS3 = { embedFonts: false, includeImages: true, pageWrappers: false, fontFamilyPrefix: 'p-' };

    function sigDoc(): DocModel {
        const value = lineOf('הפקה מקוונת', 88, 161, 530, { dir: 'rtl', fontSize: 10 });
        value.words[0].style = { ...value.words[0].style, underline: true, color: '#00008b' };
        const label = lineOf('חתימה וחותמת הרופא', 90, 177, 503, { dir: 'rtl', fontSize: 10 });
        return {
            pages: [{ index: 0, width: 612, height: 792, blocks: [{
                kind: 'table',
                rows: [[{ lines: [value] }], [{ lines: [label] }]],
                ruled: false, headerRow: false, page: 0,
                style: { align: '', indentStart: 0, textIndent: 0, lineHeight: 0, marginTop: 0, dir: 'rtl', background: '', border: '' },
            }] }],
            bodyFontSize: 10,
        };
    }

    it('promotes a fully-underlined cell to a centered wide slot line', () => {
        const { html } = emitDocument(sigDoc(), OPTS3, new Map());
        expect(html).toContain('border-bottom:1pt solid #00008b');
        expect(html).toContain('text-align:center');
        expect(html).not.toContain('<u>');
    });
});
