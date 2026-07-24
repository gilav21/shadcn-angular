import type { Line, RunStyle, TextDirection, Word } from './readable-types';

/** Test-only builders shared by the pdf-readable spec files. */
export function runStyleOf(overrides?: Partial<RunStyle>): RunStyle {
    return {
        fontName: 'F1',
        fontSize: 12,
        color: '#000000',
        bold: false,
        italic: false,
        underline: false,
        baselineShift: 'none',
        letterSpacing: 0,
        link: '',
        ...overrides,
    };
}

export function wordAt(text: string, x: number, endX: number, y: number, style?: Partial<RunStyle>): Word {
    return {
        text,
        x,
        endX,
        y,
        fontSize: style?.fontSize ?? 12,
        style: runStyleOf(style),
        mcid: -1,
        spaceBefore: true,
        hardBreak: false,
    };
}

export function lineOf(
    text: string,
    x: number,
    endX: number,
    y: number,
    opts?: { page?: number; dir?: TextDirection; fontSize?: number; style?: Partial<RunStyle> },
): Line {
    const fontSize = opts?.fontSize ?? 12;
    return {
        words: [wordAt(text, x, endX, y, { ...opts?.style, fontSize })],
        x,
        endX,
        y,
        fontSize,
        dir: opts?.dir ?? 'ltr',
        page: opts?.page ?? 0,
    };
}
